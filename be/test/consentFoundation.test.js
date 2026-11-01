import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createConsentInvitation,
  ensureBookingParticipants,
  generateInvitationToken,
  getActiveConsentTemplate,
  getBookingConsentStatus,
  hashInvitationToken,
  initializeConsentForParticipant,
  recordConsentAuditLog,
  verifyInvitationToken,
} from "../src/services/consent.service.js";

test("hashInvitationToken produces consistent SHA-256 hex string and rejects invalid input", () => {
  const token = "a1b2c3d4e5f678901234567890abcdefa1b2c3d4e5f678901234567890abcdef";
  const hash1 = hashInvitationToken(token);
  const hash2 = hashInvitationToken(token);

  assert.equal(hash1, hash2);
  assert.equal(hash1.length, 64);
  assert.match(hash1, /^[0-9a-f]{64}$/);

  assert.notEqual(hash1, hashInvitationToken("different-token"));
  assert.throws(() => hashInvitationToken(""), /non-empty string/);
  assert.throws(() => hashInvitationToken(null), /non-empty string/);
});

test("generateInvitationToken produces high-entropy 64-character hex token", () => {
  const t1 = generateInvitationToken();
  const t2 = generateInvitationToken();

  assert.equal(t1.length, 64);
  assert.equal(t2.length, 64);
  assert.notEqual(t1, t2);
  assert.match(t1, /^[0-9a-f]{64}$/);
});

test("getActiveConsentTemplate queries active template by code", async () => {
  const mockTemplate = {
    id: "tpl-uuid-1",
    template_code: "SICARE_IC_STD",
    version: "v1.0",
    is_active: true,
    file_sha256: "59012141d8a54336928a4c076d9d0ad7276bbbc36064c37d9654cc031f14cd8f",
  };

  const mockClient = {
    from(table) {
      assert.equal(table, "consent_templates");
      return {
        select() {
          return {
            eq(col1, val1) {
              assert.equal(col1, "template_code");
              assert.equal(val1, "SICARE_IC_STD");
              return {
                eq(col2, val2) {
                  assert.equal(col2, "is_active");
                  assert.equal(val2, true);
                  return {
                    maybeSingle: async () => ({ data: mockTemplate, error: null }),
                  };
                },
              };
            },
          };
        },
      };
    },
  };

  const tpl = await getActiveConsentTemplate(mockClient);
  assert.equal(tpl.id, "tpl-uuid-1");
  assert.equal(tpl.version, "v1.0");
  assert.equal(tpl.file_sha256, "59012141d8a54336928a4c076d9d0ad7276bbbc36064c37d9654cc031f14cd8f");
});

test("ensureBookingParticipants initializes primary client participant for individual booking", async () => {
  let insertedRow = null;
  const auditLogs = [];

  const mockClient = {
    from(table) {
      if (table === "bookings") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: "b-indiv-1",
                  client_id: "user-client-1",
                  service_type: "individual",
                  participant_count: 1,
                },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "booking_participants") {
        return {
          select: () => ({
            eq: () => ({ data: [], error: null }), // No participants yet
          }),
          insert: (row) => {
            insertedRow = { ...row, id: "part-indiv-1" };
            return {
              select: () => ({
                maybeSingle: async () => ({ data: insertedRow, error: null }),
              }),
            };
          },
        };
      }
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: "user-client-1",
                  full_name: "Mahasiswa Individual",
                  identity_code: "210111001",
                  phone_e164: "628123456789",
                },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "consent_audit_logs") {
        return {
          insert: (log) => {
            auditLogs.push(log);
            return {
              select: () => ({
                maybeSingle: async () => ({ data: { id: "audit-1" }, error: null }),
              }),
            };
          },
        };
      }
      throw new Error(`Unexpected table ${table}`);
    },
  };

  const participants = await ensureBookingParticipants({
    supabaseClient: mockClient,
    bookingId: "b-indiv-1",
  });

  assert.equal(participants.length, 1);
  assert.equal(insertedRow.booking_id, "b-indiv-1");
  assert.equal(insertedRow.user_id, "user-client-1");
  assert.equal(insertedRow.participant_type, "primary_client");
  assert.equal(insertedRow.is_primary, true);
  assert.equal(insertedRow.nim, "210111001");
  assert.equal(auditLogs.length, 1);
  assert.equal(auditLogs[0].event_type, "participant_registered");
});

test("initializeConsentForParticipant creates pending consent and snapshot idempotently", async () => {
  let insertedConsent = null;
  const auditLogs = [];

  const mockClient = {
    from(table) {
      if (table === "consent_templates") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    id: "tpl-1",
                    template_code: "SICARE_IC_STD",
                    version: "v1.0",
                  },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      if (table === "booking_participants") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    id: "part-1",
                    booking_id: "book-1",
                    user_id: "user-1",
                    full_name: "Budi Santoso",
                    faculty: "Fakultas Teknik",
                    study_program: "Teknik Informatika",
                    nim: "210111045",
                    birthplace: "Manado",
                    date_of_birth: "2003-05-14",
                    gender: "Laki-laki",
                    phone_e164: "62811223344",
                  },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      if (table === "informed_consents") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                in: () => ({
                  maybeSingle: async () => ({ data: null, error: null }), // None yet
                }),
              }),
            }),
          }),
          insert: (row) => {
            insertedConsent = { ...row, id: "consent-new-1" };
            return {
              select: () => ({
                maybeSingle: async () => ({ data: insertedConsent, error: null }),
              }),
            };
          },
        };
      }
      if (table === "consent_audit_logs") {
        return {
          insert: (log) => {
            auditLogs.push(log);
            return {
              select: () => ({
                maybeSingle: async () => ({ data: { id: "log-1" }, error: null }),
              }),
            };
          },
        };
      }
      throw new Error(`Unexpected table ${table}`);
    },
  };

  const result = await initializeConsentForParticipant({
    supabaseClient: mockClient,
    bookingId: "book-1",
    participantId: "part-1",
  });

  assert.equal(result.created, true);
  assert.equal(insertedConsent.status, "pending");
  assert.equal(insertedConsent.signer_user_id, "user-1");
  assert.equal(insertedConsent.signer_name_snapshot, "Budi Santoso");
  assert.equal(insertedConsent.identity_snapshot.faculty, "Fakultas Teknik");
  assert.equal(insertedConsent.identity_snapshot.nim, "210111045");
  assert.equal(insertedConsent.identity_snapshot.gender, "Laki-laki");
  assert.equal(auditLogs.length, 1);
  assert.equal(auditLogs[0].event_type, "consent_created");
});

test("createConsentInvitation and verifyInvitationToken manage token lifecycle safely", async () => {
  let storedInvitation = null;
  const auditLogs = [];

  const mockClient = {
    from(table) {
      if (table === "consent_invitations") {
        return {
          insert: (row) => {
            storedInvitation = { ...row, id: "inv-uuid-101" };
            return {
              select: () => ({
                maybeSingle: async () => ({ data: storedInvitation, error: null }),
              }),
            };
          },
          select: () => ({
            eq: (col, val) => ({
              maybeSingle: async () => {
                if (storedInvitation && storedInvitation.token_hash === val) {
                  return { data: storedInvitation, error: null };
                }
                return { data: null, error: null };
              },
            }),
          }),
          update: (patch) => {
            Object.assign(storedInvitation, patch);
            return {
              eq: () => ({ data: null, error: null }),
            };
          },
        };
      }
      if (table === "consent_audit_logs") {
        return {
          insert: (log) => {
            auditLogs.push(log);
            return {
              select: () => ({
                maybeSingle: async () => ({ data: { id: "audit-inv-1" }, error: null }),
              }),
            };
          },
        };
      }
      throw new Error(`Unexpected table ${table}`);
    },
  };

  // 1. Create invitation
  const created = await createConsentInvitation({
    supabaseClient: mockClient,
    participantId: "guest-part-99",
    recipientPhone: "628999888777",
    invitationType: "guest_participant",
    expiresInHours: 48,
    createdBy: "client-primary-1",
  });

  assert.ok(created.rawToken);
  assert.equal(created.rawToken.length, 64);
  assert.equal(storedInvitation.token_hash, hashInvitationToken(created.rawToken));
  assert.notEqual(storedInvitation.token_hash, created.rawToken); // Raw token never stored!
  assert.equal(storedInvitation.status, "pending");
  assert.equal(auditLogs.length, 1);
  assert.equal(auditLogs[0].event_type, "invitation_created");

  // 2. Verify valid token
  const verified = await verifyInvitationToken({
    supabaseClient: mockClient,
    rawToken: created.rawToken,
  });
  assert.equal(verified.valid, true);
  assert.equal(verified.invitation.id, "inv-uuid-101");

  // 3. Reject invalid / forged token
  const forged = await verifyInvitationToken({
    supabaseClient: mockClient,
    rawToken: "forged-token-that-does-not-exist",
  });
  assert.equal(forged.valid, false);
  assert.equal(forged.error, "INVITATION_NOT_FOUND");

  // 4. Handle expired token
  storedInvitation.expires_at = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago
  const expired = await verifyInvitationToken({
    supabaseClient: mockClient,
    rawToken: created.rawToken,
  });
  assert.equal(expired.valid, false);
  assert.equal(expired.error, "INVITATION_EXPIRED");
  assert.equal(storedInvitation.status, "expired");
});

test("recordConsentAuditLog creates append-only audit entries", async () => {
  const inserted = [];
  const mockClient = {
    from(table) {
      assert.equal(table, "consent_audit_logs");
      return {
        insert: (row) => {
          inserted.push(row);
          return {
            select: () => ({
              maybeSingle: async () => ({ data: { id: "log-uuid-" + inserted.length }, error: null }),
            }),
          };
        },
      };
    },
  };

  const res = await recordConsentAuditLog({
    supabaseClient: mockClient,
    consentId: "c-1",
    bookingId: "b-1",
    eventType: "consent_signed",
    actorUserId: "u-1",
    actorType: "user",
    metadata: { signature_method: "electronic_canvas" },
  });

  assert.equal(res.success, true);
  assert.equal(inserted.length, 1);
  assert.equal(inserted[0].consent_id, "c-1");
  assert.equal(inserted[0].event_type, "consent_signed");
  assert.equal(inserted[0].metadata.signature_method, "electronic_canvas");
  assert.ok(inserted[0].event_timestamp);
});

test("getBookingConsentStatus calculates consent readiness for group booking", async () => {
  const mockClient = {
    rpc: async () => ({ data: null, error: new Error("RPC not found in mock") }),
    from(table) {
      if (table === "bookings") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { id: "b-grp-1", service_type: "group", participant_count: 3 },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "booking_participants") {
        return {
          select: () => ({
            eq: () => ({
              data: [
                { id: "p1", full_name: "Member 1", is_primary: true, informed_consents: [{ id: "c1", status: "signed" }] },
                { id: "p2", full_name: "Member 2", is_primary: false, informed_consents: [{ id: "c2", status: "signed" }] },
                { id: "p3", full_name: "Member 3", is_primary: false, informed_consents: [{ id: "c3", status: "pending" }] },
              ],
              error: null,
            }),
          }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    },
  };

  const status = await getBookingConsentStatus({
    supabaseClient: mockClient,
    bookingId: "b-grp-1",
  });

  assert.equal(status.totalParticipants, 3);
  assert.equal(status.signedParticipants, 2);
  assert.equal(status.pendingParticipants, 1);
  assert.equal(status.isFullyConsented, false); // Block session: Member 3 pending!

  assert.equal(status.participants.length, 3);
  assert.equal(status.participants[0].consent_status, "signed");
  assert.equal(status.participants[2].consent_status, "pending");
});
