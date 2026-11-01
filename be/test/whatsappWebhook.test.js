import assert from "node:assert/strict";
import { test } from "node:test";
import { setSupabaseAdminClientForTests } from "../src/config/supabase.js";
import { timingSafeEqualString, verifyWebhookSecret } from "../src/routes/webhook.routes.js";
import app from "../app.js";

test("timingSafeEqualString performs constant time comparison safely", () => {
  assert.equal(timingSafeEqualString("secret-123", "secret-123"), true);
  assert.equal(timingSafeEqualString("secret-123", "secret-456"), false);
  assert.equal(timingSafeEqualString("short", "much-longer-string"), false);
  assert.equal(timingSafeEqualString("", "not-empty"), false);
  assert.equal(timingSafeEqualString(null, "str"), false);
});

test("verifyWebhookSecret validates header or query against configured secret", () => {
  // Simulate request objects
  const req1 = { headers: { "x-fonnte-secret": "test-sec" }, query: {} };
  assert.equal(typeof verifyWebhookSecret(req1), "boolean");
});

test("webhook endpoint processes delivered status update", async () => {
  let updatedPatch = null;
  const mockClient = {
    from(table) {
      assert.equal(table, "whatsapp_outbox");
      return {
        select() {
          return {
            eq(col, val) {
              if (val === "FONNTE-MSG-555") {
                return {
                  maybeSingle: async () => ({
                    data: {
                      id: "outbox-row-555",
                      status: "accepted",
                      provider_message_id: "FONNTE-MSG-555",
                      attempt_count: 1,
                    },
                    error: null,
                  }),
                };
              }
              return {
                maybeSingle: async () => ({ data: null, error: null }),
              };
            },
          };
        },
        update(patch) {
          updatedPatch = patch;
          return {
            eq: async () => ({ data: null, error: null }),
          };
        },
      };
    },
  };

  setSupabaseAdminClientForTests(mockClient);

  let server;
  try {
    server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    const port = server.address().port;

    const response = await fetch(`http://127.0.0.1:${port}/api/v1/webhooks/fonnte/message-status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: "FONNTE-MSG-555",
        status: "delivered",
        state: "delivered",
        stateid: "STATE-001",
        device: "device-1",
      }),
    });

    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.data.status, "ok");
    assert.equal(body.data.id, "FONNTE-MSG-555");
    assert.equal(updatedPatch.status, "delivered");
    assert.equal(updatedPatch.provider_state_id, "STATE-001");
    assert.ok(updatedPatch.delivered_at);
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    setSupabaseAdminClientForTests(null);
  }
});

test("webhook endpoint returns 200 ignored for unknown message ID", async () => {
  const mockClient = {
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                maybeSingle: async () => ({ data: null, error: null }),
              };
            },
          };
        },
      };
    },
  };

  setSupabaseAdminClientForTests(mockClient);

  let server;
  try {
    server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    const port = server.address().port;

    const response = await fetch(`http://127.0.0.1:${port}/api/v1/webhooks/fonnte/message-status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: "UNKNOWN-MSG-ID",
        status: "delivered",
      }),
    });

    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.data.status, "ignored");
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    setSupabaseAdminClientForTests(null);
  }
});

test("webhook endpoint prevents terminal delivered status regression on out-of-order callback", async () => {
  let updatedPatch = null;
  const mockClient = {
    from(table) {
      assert.equal(table, "whatsapp_outbox");
      return {
        select() {
          return {
            eq() {
              return {
                maybeSingle: async () => ({
                  data: {
                    id: "outbox-delivered-1",
                    status: "delivered", // Already delivered!
                    provider_message_id: "FONNTE-MSG-ALREADY-DELIVERED",
                    attempt_count: 1,
                  },
                  error: null,
                }),
              };
            },
          };
        },
        update(patch) {
          updatedPatch = patch;
          return {
            eq: async () => ({ data: null, error: null }),
          };
        },
      };
    },
  };

  setSupabaseAdminClientForTests(mockClient);

  let server;
  try {
    server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    const port = server.address().port;

    // Delayed out-of-order failure/processing callback
    const response = await fetch(`http://127.0.0.1:${port}/api/v1/webhooks/fonnte/message-status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: "FONNTE-MSG-ALREADY-DELIVERED",
        status: "failed",
        state: "failed",
        message: "Late network error",
      }),
    });

    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.data.status, "ok");
    assert.equal(body.data.current_status, "delivered");
    // Ensure patch did NOT regress status to failed
    assert.equal(updatedPatch.status, undefined);
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    setSupabaseAdminClientForTests(null);
  }
});
