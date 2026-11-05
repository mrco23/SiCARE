import assert from "node:assert/strict";
import { test } from "node:test";
import express from "express";
import adminRoutes from "../src/routes/admin.routes.js";
import { errorHandler } from "../src/middleware/errorHandler.js";
import { setSupabaseAdminClientForTests } from "../src/config/supabase.js";

function invokeApp(app, { method, url, body = {}, headers = {} }) {
  return new Promise((resolve) => {
    const req = {
      method,
      url,
      headers: { "content-type": "application/json", ...headers },
      get(name) {
        return this.headers[name.toLowerCase()];
      },
      body,
    };
    let statusCode = 200;
    const resHeaders = {};
    let responseBody = null;

    const res = {
      status(code) {
        statusCode = code;
        return res;
      },
      setHeader(name, val) {
        resHeaders[name.toLowerCase()] = val;
        return res;
      },
      getHeader(name) {
        return resHeaders[name.toLowerCase()];
      },
      json(data) {
        responseBody = data;
        resolve({ status: statusCode, body: responseBody });
        return res;
      },
      send(data) {
        responseBody = data;
        resolve({ status: statusCode, body: responseBody });
        return res;
      },
      end() {
        resolve({ status: statusCode, body: responseBody });
      },
    };

    app.handle(req, res);
  });
}

function createMockSupabase() {
  const adminUser = {
    id: "00000000-0000-4000-8000-000000000001",
    email: "admin@sicare.test",
    user_metadata: { full_name: "Admin" },
  };
  const profiles = [
    {
      id: adminUser.id,
      identity_code: "ADM01",
      full_name: "Admin",
      app_role: "admin",
      member_category: "faculty_staff",
      account_status: "active",
      phone_e164: "+628111111111",
      whatsapp_opt_in: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "00000000-0000-4000-8000-000000000002",
      identity_code: "CO01",
      full_name: "Konselor Uji",
      app_role: "counselor",
      member_category: "faculty_staff",
      account_status: "active",
      phone_e164: "+628222222222",
      whatsapp_opt_in: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "00000000-0000-4000-8000-000000000003",
      identity_code: "CL01",
      full_name: "Klien Uji",
      app_role: "client",
      member_category: "student",
      account_status: "active",
      phone_e164: "+628333333333",
      whatsapp_opt_in: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  return {
    auth: {
      getUser: async (token) => {
        if (token === "valid-admin-token") {
          return { data: { user: adminUser }, error: null };
        }
        return { data: { user: null }, error: { message: "Invalid token" } };
      },
      admin: {
        createUser: async ({ email, password, email_confirm, user_metadata }) => {
          const newUser = {
            id: "00000000-0000-4000-8000-000000000099",
            email,
            email_confirmed_at: email_confirm ? new Date().toISOString() : null,
            user_metadata,
          };
          return { data: { user: newUser }, error: null };
        },
        deleteUser: async () => ({ error: null }),
      },
    },
    from(table) {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: (_col, val) => ({
              maybeSingle: async () => {
                const found = profiles.find((p) => p.id === val);
                return { data: found ? { ...found } : null, error: null };
              },
              single: async () => {
                const found = profiles.find((p) => p.id === val);
                return { data: found ? { ...found } : null, error: null };
              },
            }),
          }),
          update: (patch) => ({
            eq: (_col, val) => {
              let target = profiles.find((p) => p.id === val);
              if (!target) {
                target = {
                  id: val,
                  ...patch,
                  phone_e164: null,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                };
                profiles.push(target);
              } else {
                Object.assign(target, patch);
              }
              return {
                select: () => ({
                  single: async () => ({ data: { ...target }, error: null }),
                  maybeSingle: async () => ({ data: { ...target }, error: null }),
                }),
              };
            },
          }),
        };
      }
      if (table === "counselor_profiles") {
        return {
          upsert: async () => ({ error: null }),
          update: () => ({ eq: () => ({ error: null }) }),
        };
      }
      if (table === "audit_events") {
        return {
          insert: async () => ({ error: null }),
        };
      }
      if (table === "bookings") {
        return {
          select: () => ({
            order: () => ({
              limit: async () => ({
                data: [
                  {
                    id: "b-1",
                    client_id: "c-1",
                    counselor_id: "co-1",
                    status: "confirmed",
                    starts_at: "2026-11-03T10:00:00Z",
                    ends_at: "2026-11-03T11:00:00Z",
                    counseling_sessions: { id: "s-1", status: "completed", format: "online", room: "A" },
                  },
                  {
                    id: "b-2",
                    client_id: "c-2",
                    counselor_id: "co-1",
                    status: "waiting_confirmation",
                    starts_at: "2026-11-03T11:00:00Z",
                    ends_at: "2026-11-03T12:00:00Z",
                    counseling_sessions: null,
                  },
                  {
                    id: "b-3",
                    client_id: "c-3",
                    counselor_id: "co-2",
                    status: "rejected",
                    starts_at: "2026-11-03T13:00:00Z",
                    ends_at: "2026-11-03T14:00:00Z",
                  },
                ],
                error: null,
              }),
            }),
          }),
        };
      }
      return {};
    },
  };
}

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/v1/admin", adminRoutes);
  app.use(errorHandler);
  return app;
}

test("admin routes load with Zod 4 schemas", () => {
  assert.ok(adminRoutes);
  assert.equal(typeof adminRoutes, "function");
});

test("POST /admin/accounts with app_role: 'client' is rejected with 400", async () => {
  const mockDb = createMockSupabase();
  setSupabaseAdminClientForTests(mockDb);
  try {
    const app = createTestApp();
    const res = await invokeApp(app, {
      method: "POST",
      url: "/api/v1/admin/accounts",
      headers: { authorization: "Bearer valid-admin-token" },
      body: {
        email: "client.new@sicare.test",
        password: "password123",
        full_name: "Calon Klien",
        app_role: "client",
      },
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "VALIDATION_ERROR");
  } finally {
    setSupabaseAdminClientForTests(null);
  }
});

test("POST /admin/accounts with app_role: 'admin' is rejected with 400", async () => {
  const mockDb = createMockSupabase();
  setSupabaseAdminClientForTests(mockDb);
  try {
    const app = createTestApp();
    const res = await invokeApp(app, {
      method: "POST",
      url: "/api/v1/admin/accounts",
      headers: { authorization: "Bearer valid-admin-token" },
      body: {
        email: "admin.new@sicare.test",
        password: "password123",
        full_name: "Calon Admin",
        app_role: "admin",
      },
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "VALIDATION_ERROR");
  } finally {
    setSupabaseAdminClientForTests(null);
  }
});

test("POST /admin/accounts with app_role: 'counselor' succeeds (201)", async () => {
  const mockDb = createMockSupabase();
  setSupabaseAdminClientForTests(mockDb);
  try {
    const app = createTestApp();
    const res = await invokeApp(app, {
      method: "POST",
      url: "/api/v1/admin/accounts",
      headers: { authorization: "Bearer valid-admin-token" },
      body: {
        email: "konselor.baru@sicare.test",
        password: "password123",
        full_name: "Konselor Baru",
        gender: "female",
        siap_number: "SIAP-001",
        sipp_silp_number: "SIPP-001",
        app_role: "counselor",
      },
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.app_role, "counselor");
    assert.equal(res.body.data.email, "konselor.baru@sicare.test");
  } finally {
    setSupabaseAdminClientForTests(null);
  }
});

test("POST /admin/accounts with app_role: 'head_lmi' succeeds (201)", async () => {
  const mockDb = createMockSupabase();
  setSupabaseAdminClientForTests(mockDb);
  try {
    const app = createTestApp();
    const res = await invokeApp(app, {
      method: "POST",
      url: "/api/v1/admin/accounts",
      headers: { authorization: "Bearer valid-admin-token" },
      body: {
        email: "headlmi.baru@sicare.test",
        password: "password123",
        full_name: "Pimpinan LMI Baru",
        gender: "male",
        app_role: "head_lmi",
      },
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.app_role, "head_lmi");
    assert.equal(res.body.data.email, "headlmi.baru@sicare.test");
  } finally {
    setSupabaseAdminClientForTests(null);
  }
});

test("PATCH /admin/accounts/:id with app_role: 'client' or 'admin' is rejected with 400", async () => {
  const mockDb = createMockSupabase();
  setSupabaseAdminClientForTests(mockDb);
  try {
    const app = createTestApp();
    const counselorId = "00000000-0000-4000-8000-000000000002";

    const resClient = await invokeApp(app, {
      method: "PATCH",
      url: `/api/v1/admin/accounts/${counselorId}`,
      headers: { authorization: "Bearer valid-admin-token" },
      body: {
        app_role: "client",
      },
    });
    assert.equal(resClient.status, 400);
    assert.equal(resClient.body.error.code, "VALIDATION_ERROR");

    const resAdmin = await invokeApp(app, {
      method: "PATCH",
      url: `/api/v1/admin/accounts/${counselorId}`,
      headers: { authorization: "Bearer valid-admin-token" },
      body: {
        app_role: "admin",
      },
    });
    assert.equal(resAdmin.status, 400);
    assert.equal(resAdmin.body.error.code, "VALIDATION_ERROR");
  } finally {
    setSupabaseAdminClientForTests(null);
  }
});

test("PATCH /admin/accounts/:id rejecting role changes on non-counselor/non-head_lmi accounts", async () => {
  const mockDb = createMockSupabase();
  setSupabaseAdminClientForTests(mockDb);
  try {
    const app = createTestApp();
    const clientId = "00000000-0000-4000-8000-000000000003";

    const res = await invokeApp(app, {
      method: "PATCH",
      url: `/api/v1/admin/accounts/${clientId}`,
      headers: { authorization: "Bearer valid-admin-token" },
      body: {
        app_role: "counselor",
      },
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "ROLE_CHANGE_NOT_ALLOWED");
  } finally {
    setSupabaseAdminClientForTests(null);
  }
});

test("PATCH /admin/accounts/:id allows transitioning counselor to head_lmi", async () => {
  const mockDb = createMockSupabase();
  setSupabaseAdminClientForTests(mockDb);
  try {
    const app = createTestApp();
    const counselorId = "00000000-0000-4000-8000-000000000002";

    const res = await invokeApp(app, {
      method: "PATCH",
      url: `/api/v1/admin/accounts/${counselorId}`,
      headers: { authorization: "Bearer valid-admin-token" },
      body: {
        app_role: "head_lmi",
      },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.app_role, "head_lmi");
  } finally {
    setSupabaseAdminClientForTests(null);
  }
});


test("GET /admin/counseling normalizes counseling_sessions into an array for object, null, and missing embeds", async () => {
  const mockDb = createMockSupabase();
  setSupabaseAdminClientForTests(mockDb);
  try {
    const app = createTestApp();
    const res = await invokeApp(app, {
      method: "GET",
      url: "/api/v1/admin/counseling?limit=10",
      headers: { authorization: "Bearer valid-admin-token" },
    });

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data));
    assert.equal(res.body.data.length, 3);

    // Condition 1: Object is normalized to 1-element array
    const b1 = res.body.data.find((b) => b.id === "b-1");
    assert.ok(Array.isArray(b1.counseling_sessions));
    assert.equal(b1.counseling_sessions.length, 1);
    assert.equal(b1.counseling_sessions[0].id, "s-1");
    assert.equal(b1.counseling_sessions[0].status, "completed");

    // Condition 2: null is normalized to empty array
    const b2 = res.body.data.find((b) => b.id === "b-2");
    assert.ok(Array.isArray(b2.counseling_sessions));
    assert.equal(b2.counseling_sessions.length, 0);

    // Condition 3: missing/undefined is normalized to empty array
    const b3 = res.body.data.find((b) => b.id === "b-3");
    assert.ok(Array.isArray(b3.counseling_sessions));
    assert.equal(b3.counseling_sessions.length, 0);
  } finally {
    setSupabaseAdminClientForTests(null);
  }
});
