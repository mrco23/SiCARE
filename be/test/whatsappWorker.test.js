import assert from "node:assert/strict";
import { test } from "node:test";
import { FonnteService } from "../src/services/fonnte.service.js";
import { claimEligibleJobs, processOutboxJob } from "../src/workers/whatsapp.worker.js";

function dryRunService() {
  return new FonnteService({
    sendEnabled: false,
    testMode: false,
    token: "",
    fetchFn: async () => {
      throw new Error("Dry-run must not call the network");
    },
  });
}

test("claimEligibleJobs atomically claims eligible jobs and increments attempt_count", async () => {
  const outbox = [
    {
      id: "job-1",
      status: "pending",
      scheduled_at: new Date(Date.now() - 1000).toISOString(),
      attempt_count: 0,
      max_attempts: 5,
      lease_expires_at: null,
    },
    {
      id: "job-2",
      status: "pending",
      scheduled_at: new Date(Date.now() + 100000).toISOString(), // future -> not eligible
      attempt_count: 0,
      max_attempts: 5,
      lease_expires_at: null,
    },
  ];

  const mockClient = {
    rpc: async () => ({ data: null, error: new Error("RPC not found in mock") }),
    from(table) {
      assert.equal(table, "whatsapp_outbox");
      return {
        select() {
          return {
            or() {
              return {
                limit() {
                  return { data: outbox.filter((j) => j.status === "pending"), error: null };
                },
              };
            },
          };
        },
        update(patch) {
          return {
            eq(col, val) {
              const target = outbox.find((j) => j.id === val);
              Object.assign(target, patch);
              return {
                select() {
                  return {
                    maybeSingle: async () => ({ data: target, error: null }),
                  };
                },
              };
            },
          };
        },
      };
    },
  };

  const claimed = await claimEligibleJobs({
    supabaseClient: mockClient,
    workerId: "worker-test-1",
    batchSize: 5,
  });

  assert.equal(claimed.length, 1);
  assert.equal(claimed[0].id, "job-1");
  assert.equal(claimed[0].status, "processing");
  assert.equal(claimed[0].locked_by, "worker-test-1");
  assert.equal(claimed[0].attempt_count, 1);
  assert.ok(claimed[0].lease_expires_at);
});

test("processOutboxJob rejects non-opted-in recipients immediately", async () => {
  let updatedPatch = null;
  const mockClient = {
    from(table) {
      if (table === "profiles") {
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle: async () => ({
                    data: {
                      id: "prof-1",
                      full_name: "Ahmad",
                      phone_e164: "628123456789",
                      account_status: "active",
                      whatsapp_opt_in: false, // NOT OPTED IN!
                    },
                    error: null,
                  }),
                };
              },
            };
          },
        };
      }
      if (table === "whatsapp_outbox") {
        return {
          update(patch) {
            updatedPatch = patch;
            return {
              eq: async () => ({ data: null, error: null }),
            };
          },
        };
      }
      throw new Error(`Unexpected table ${table}`);
    },
  };

  let serviceCalled = false;
  const mockService = {
    sendMessage: async () => {
      serviceCalled = true;
      return { success: true };
    },
  };

  const job = {
    id: "job-opt-out",
    recipient_user_id: "prof-1",
    message_type: "booking_accepted",
    attempt_count: 1,
    max_attempts: 5,
    payload: { booking_id: "b-1", starts_at: new Date().toISOString() },
  };

  const result = await processOutboxJob({
    supabaseClient: mockClient,
    job,
    service: mockService,
  });

  assert.equal(serviceCalled, false);
  assert.equal(result.success, false);
  assert.equal(result.status, "failed");
  assert.equal(updatedPatch.status, "failed");
  assert.equal(updatedPatch.last_error_code, "RECIPIENT_NOT_OPTED_IN");
  assert.equal(updatedPatch.error_category, "opt_out");
});

test("processOutboxJob successfully sends and transitions to accepted", async () => {
  let updatedPatch = null;
  const mockClient = {
    from(table) {
      if (table === "profiles") {
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle: async () => ({
                    data: {
                      id: "prof-2",
                      full_name: "Budi Klien",
                      phone_e164: "628123456780",
                      account_status: "active",
                      whatsapp_opt_in: true, // Opted in!
                    },
                    error: null,
                  }),
                };
              },
            };
          },
        };
      }
      if (table === "whatsapp_outbox") {
        return {
          update(patch) {
            updatedPatch = patch;
            return {
              eq: async () => ({ data: null, error: null }),
            };
          },
        };
      }
      throw new Error(`Unexpected table ${table}`);
    },
  };

  const mockService = {
    sendMessage: async ({ target, message }) => {
      assert.equal(target, "628123456780");
      assert.match(message, /Budi Klien/);
      return {
        success: true,
        providerMessageId: "FONNTE-MSG-111",
        providerRequestId: "REQ-222",
        providerProcess: "processing",
        rawResponse: { status: true },
      };
    },
  };

  const job = {
    id: "job-success-1",
    recipient_user_id: "prof-2",
    message_type: "booking_received",
    attempt_count: 1,
    max_attempts: 5,
    payload: { booking_id: "b-2", starts_at: new Date().toISOString(), counselor_name: "Dr. Siti" },
  };

  const result = await processOutboxJob({
    supabaseClient: mockClient,
    job,
    service: mockService,
  });

  assert.equal(result.success, true);
  assert.equal(result.status, "accepted");
  assert.equal(updatedPatch.status, "accepted");
  assert.equal(updatedPatch.provider_message_id, "FONNTE-MSG-111");
  assert.equal(updatedPatch.locked_by, null);
  assert.ok(updatedPatch.sent_at);
});

test("processOutboxJob transitions to retry_wait on temporary provider errors", async () => {
  let updatedPatch = null;
  const mockClient = {
    from(table) {
      if (table === "profiles") {
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle: async () => ({
                    data: {
                      id: "prof-3",
                      full_name: "Citra",
                      phone_e164: "628123456788",
                      account_status: "active",
                      whatsapp_opt_in: true,
                    },
                    error: null,
                  }),
                };
              },
            };
          },
        };
      }
      if (table === "whatsapp_outbox") {
        return {
          update(patch) {
            updatedPatch = patch;
            return {
              eq: async () => ({ data: null, error: null }),
            };
          },
        };
      }
      throw new Error(`Unexpected table ${table}`);
    },
  };

  const mockService = {
    sendMessage: async () => ({
      success: false,
      errorCategory: "temporary",
      errorCode: "FONNTE_DEVICE_DISCONNECTED",
      errorMessage: "device disconnected",
    }),
  };

  const job = {
    id: "job-retry-1",
    recipient_user_id: "prof-3",
    message_type: "booking_accepted",
    attempt_count: 1,
    max_attempts: 5,
    payload: { booking_id: "b-3", starts_at: new Date().toISOString() },
  };

  const result = await processOutboxJob({
    supabaseClient: mockClient,
    job,
    service: mockService,
  });

  assert.equal(result.success, false);
  assert.equal(result.status, "retry_wait");
  assert.equal(updatedPatch.status, "retry_wait");
  assert.equal(updatedPatch.last_error_code, "FONNTE_DEVICE_DISCONNECTED");
  assert.equal(updatedPatch.error_category, "temporary");
  assert.ok(updatedPatch.next_attempt_at);
});

test("claimEligibleJobs reaps expired jobs that exhausted all attempts", async () => {
  let reapedPatch = null;
  const mockClient = {
    rpc: async () => ({ data: null, error: new Error("RPC not found") }),
    from(table) {
      assert.equal(table, "whatsapp_outbox");
      return {
        select() {
          return {
            or() {
              return {
                limit: async () => ({
                  data: [
                    {
                      id: "job-exhausted-1",
                      status: "processing",
                      lease_expires_at: new Date(Date.now() - 10000).toISOString(),
                      attempt_count: 5,
                      max_attempts: 5,
                    },
                  ],
                  error: null,
                }),
              };
            },
          };
        },
        update(patch) {
          reapedPatch = patch;
          return {
            eq: async () => ({ data: null, error: null }),
          };
        },
      };
    },
  };

  const claimed = await claimEligibleJobs({
    supabaseClient: mockClient,
    workerId: "reaper-worker",
    batchSize: 5,
  });

  assert.equal(claimed.length, 0);
  assert.ok(reapedPatch);
  assert.equal(reapedPatch.status, "failed");
  assert.equal(reapedPatch.last_error_code, "LEASE_EXPIRED_MAX_ATTEMPTS");
  assert.equal(reapedPatch.error_category, "permanent");
});

test("processOutboxJob transitions to unknown on ambiguous provider timeouts", async () => {
  let updatedPatch = null;
  const mockClient = {
    from(table) {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { id: "prof-timeout", full_name: "Klien", account_status: "active", whatsapp_opt_in: true, phone_e164: "62812345678" },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "whatsapp_outbox") {
        return {
          update(patch) {
            updatedPatch = patch;
            return { eq: async () => ({ data: null, error: null }) };
          },
        };
      }
      throw new Error(`Unexpected table ${table}`);
    },
  };

  const timeoutService = {
    sendMessage: async () => ({
      success: false,
      isTimeout: true,
      errorCategory: "unknown",
      errorCode: "FONNTE_TIMEOUT",
      errorMessage: "Request to Fonnte timed out after 15000ms",
    }),
  };

  const job = {
    id: "job-timeout-1",
    recipient_user_id: "prof-timeout",
    message_type: "booking_received",
    attempt_count: 1,
    max_attempts: 5,
    payload: { booking_id: "b-timeout", starts_at: new Date().toISOString() },
  };

  const result = await processOutboxJob({
    supabaseClient: mockClient,
    job,
    service: timeoutService,
  });

  assert.equal(result.success, false);
  assert.equal(result.status, "unknown");
  assert.equal(updatedPatch.status, "unknown");
  assert.equal(updatedPatch.last_error_code, "FONNTE_TIMEOUT");
  assert.equal(updatedPatch.error_category, "unknown");
});

test("processOutboxJob does not record a dry-run booking message as sent", async () => {
  let updatedPatch = null;
  const mockClient = {
    from(table) {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { id: "prof-dry", full_name: "Klien", account_status: "active", whatsapp_opt_in: true, phone_e164: "62812345678" },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "whatsapp_outbox") {
        return {
          update(patch) {
            updatedPatch = patch;
            return { eq: async () => ({ data: null, error: null }) };
          },
        };
      }
      throw new Error(`Unexpected table ${table}`);
    },
  };

  const result = await processOutboxJob({
    supabaseClient: mockClient,
    service: dryRunService(),
    job: {
      id: "job-dry-1",
      recipient_user_id: "prof-dry",
      message_type: "booking_received",
      attempt_count: 1,
      max_attempts: 5,
      payload: { booking_id: "b-dry", starts_at: new Date().toISOString() },
    },
  });

  assert.equal(result.success, false);
  assert.equal(result.status, "cancelled");
  assert.equal(updatedPatch.status, "cancelled");
  assert.equal(updatedPatch.last_error_code, "DRY_RUN_NOT_SENT");
  assert.equal(updatedPatch.provider_status, "simulated");
  assert.equal(updatedPatch.locked_by, null);
  assert.equal("sent_at" in updatedPatch, false);
  assert.equal("provider_message_id" in updatedPatch, false);
});

test("processOutboxJob keeps a dry-run consent invitation pending and its secret uncleared", async () => {
  let updatedPatch = null;
  const emptyLookup = {
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
  };
  const mockClient = {
    from(table) {
      if (table === "booking_participants") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { id: "part-dry", full_name: "Tamu", phone_e164: "62812345679", participant_status: "active" },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "consent_invitations") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { id: "inv-dry", status: "pending", expires_at: new Date(Date.now() + 86400000).toISOString() },
                error: null,
              }),
            }),
          }),
          update() {
            throw new Error("Dry-run must not update the invitation");
          },
        };
      }
      if (table === "consent_invitation_secrets") {
        return {
          ...emptyLookup,
          update() {
            throw new Error("Dry-run must not clear the invitation secret");
          },
        };
      }
      if (table === "informed_consents" || table === "bookings") return emptyLookup;
      if (table === "whatsapp_outbox") {
        return {
          update(patch) {
            updatedPatch = patch;
            return { eq: async () => ({ data: null, error: null }) };
          },
        };
      }
      throw new Error(`Unexpected table ${table}`);
    },
  };

  const result = await processOutboxJob({
    supabaseClient: mockClient,
    service: dryRunService(),
    job: {
      id: "job-dry-2",
      booking_id: "b-dry-2",
      booking_participant_id: "part-dry",
      recipient_user_id: null,
      message_type: "consent_invitation",
      phone_e164: "62812345679",
      attempt_count: 1,
      max_attempts: 5,
      payload: { invitation_id: "inv-dry", booking_id: "b-dry-2", booking_participant_id: "part-dry" },
    },
  });

  assert.equal(result.status, "cancelled");
  assert.equal(result.error, "DRY_RUN_NOT_SENT");
  assert.equal(updatedPatch.status, "cancelled");
});
