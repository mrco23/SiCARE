import assert from "node:assert/strict";
import { test } from "node:test";
import { setSupabaseAdminClientForTests } from "../src/config/supabase.js";
import app from "../app.js";

test("GET /api/v1/admin/whatsapp/health requires authentication", async () => {
  const server = app.listen(0, "127.0.0.1");
  try {
    await new Promise((resolve) => server.once("listening", resolve));
    const port = server.address().port;

    const response = await fetch(`http://127.0.0.1:${port}/api/v1/admin/whatsapp/health`);
    assert.equal(response.status, 401);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("GET /api/v1/admin/whatsapp/health returns provider and outbox health without secrets for admin", async () => {
  const mockClient = {
    auth: {
      getUser: async (token) => {
        if (token === "valid-admin-token") {
          return { data: { user: { id: "admin-uid" } }, error: null };
        }
        return { data: { user: null }, error: new Error("invalid") };
      },
    },
    from(table) {
      if (table === "profiles") {
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle: async () => ({
                    data: {
                      id: "admin-uid",
                      app_role: "admin",
                      account_status: "active",
                      full_name: "Admin SiCARE",
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
          select() {
            return {
              in() {
                return {
                  order() {
                    return {
                      limit: async () => ({ data: [], error: null }),
                    };
                  },
                };
              },
            };
          },
        };
      }
      throw new Error(`Unexpected table ${table}`);
    },
    rpc: async () => ({
      data: {
        total: 10,
        pending: 2,
        processing: 1,
        accepted: 5,
        delivered: 2,
        retry_wait: 0,
        failed: 0,
        cancelled: 0,
        unknown: 0,
      },
      error: null,
    }),
  };

  setSupabaseAdminClientForTests(mockClient);

  const server = app.listen(0, "127.0.0.1");
  try {
    await new Promise((resolve) => server.once("listening", resolve));
    const port = server.address().port;

    const response = await fetch(`http://127.0.0.1:${port}/api/v1/admin/whatsapp/health`, {
      headers: { Authorization: "Bearer valid-admin-token" },
    });

    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.data.provider.name, "Fonnte");
    assert.equal(typeof body.data.provider.send_enabled, "boolean");
    assert.equal(body.data.outbox.total, 10);
    assert.equal(body.data.outbox.accepted, 5);
    assert.equal("FONNTE_TOKEN" in body.data.provider, false);
    assert.equal("token" in body.data.provider, false);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    setSupabaseAdminClientForTests(null);
  }
});
