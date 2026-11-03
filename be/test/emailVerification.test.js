import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import authRoutes, { setPublicAuthClientForTests } from "../src/routes/auth.routes.js";
import { setSupabaseAdminClientForTests } from "../src/config/supabase.js";
import { errorHandler } from "../src/middleware/errorHandler.js";

function invokeApp(app, { method, url, body = {}, headers = {} }) {
  return new Promise((resolve) => {
    const req = {
      method,
      url,
      headers: { "content-type": "application/json", ...headers },
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

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/v1/auth", authRoutes);
  app.use(errorHandler);
  return app;
}

test("resend-confirmation validates email or identifier requirement", async () => {
  const app = createTestApp();
  const res = await invokeApp(app, {
    method: "POST",
    url: "/api/v1/auth/resend-confirmation",
    body: {},
  });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, "VALIDATION_ERROR");
});

test("resend-confirmation rejects invalid email format", async () => {
  const app = createTestApp();
  const res = await invokeApp(app, {
    method: "POST",
    url: "/api/v1/auth/resend-confirmation",
    body: { email: "not-an-email" },
  });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, "VALIDATION_ERROR");
});

test("resend-confirmation rejects non-string or oversized email", async () => {
  const app = createTestApp();
  const res = await invokeApp(app, {
    method: "POST",
    url: "/api/v1/auth/resend-confirmation",
    body: { email: "a".repeat(250) + "@example.com" },
  });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, "VALIDATION_ERROR");
});

test("registration requires valid student or staff payload", async () => {
  const app = createTestApp();
  const res = await invokeApp(app, {
    method: "POST",
    url: "/api/v1/auth/register",
    body: {
      email: "invalid-email",
      password: "short",
      full_name: "",
    },
  });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, "VALIDATION_ERROR");
});

test("login requires valid identifier and password", async () => {
  const app = createTestApp();
  const res = await invokeApp(app, {
    method: "POST",
    url: "/api/v1/auth/login",
    body: {
      identifier: "",
      password: "",
    },
  });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, "VALIDATION_ERROR");
});


test("login security: wrong NIM and wrong password produce identical 401 message without verification words", async () => {
  const mockAdmin = {
    from(table) {
      if (table === "profiles") {
        return {
          select: () => ({
            ilike: (_col, val) => ({
              maybeSingle: async () => {
                if (val === "210101001") {
                  return { data: { id: "user-id-1" }, error: null };
                }
                return { data: null, error: null };
              },
            }),
          }),
        };
      }
      return {};
    },
    auth: {
      admin: {
        getUserById: async (id) => {
          if (id === "user-id-1") {
            return { data: { user: { email: "student@sicare.test" } }, error: null };
          }
          return { data: { user: null }, error: { message: "Not found" } };
        },
      },
    },
  };

  const mockPublicAuth = {
    auth: {
      signInWithPassword: async ({ email, password }) => {
        // Only student@sicare.test with "correct-password" succeeds
        if (email === "student@sicare.test" && password === "wrong-password") {
          return { data: { user: null, session: null }, error: { message: "Invalid login credentials" } };
        }
        return { data: { user: null, session: null }, error: { message: "Invalid login credentials" } };
      },
    },
  };

  setSupabaseAdminClientForTests(mockAdmin);
  setPublicAuthClientForTests(mockPublicAuth);

  try {
    const app = createTestApp();

    // Skenario A: NIM salah (tidak terdaftar)
    const resWrongNim = await invokeApp(app, {
      method: "POST",
      url: "/api/v1/auth/login",
      body: { identifier: "999999999", password: "any-password" },
    });
    assert.equal(resWrongNim.status, 401);
    assert.equal(resWrongNim.body.error.code, "INVALID_CREDENTIALS");

    // Skenario B: NIM benar, kata sandi salah
    const resWrongPass = await invokeApp(app, {
      method: "POST",
      url: "/api/v1/auth/login",
      body: { identifier: "210101001", password: "wrong-password" },
    });
    assert.equal(resWrongPass.status, 401);
    assert.equal(resWrongPass.body.error.code, "INVALID_CREDENTIALS");

    // Skenario C: Email benar, kata sandi salah
    const resWrongPassEmail = await invokeApp(app, {
      method: "POST",
      url: "/api/v1/auth/login",
      body: { identifier: "student@sicare.test", password: "wrong-password" },
    });
    assert.equal(resWrongPassEmail.status, 401);
    assert.equal(resWrongPassEmail.body.error.code, "INVALID_CREDENTIALS");

    // Assertion 1: Pesan NIM salah dan kata sandi salah SAMA PERSIS
    assert.equal(resWrongNim.body.error.message, resWrongPass.body.error.message);
    assert.equal(resWrongPass.body.error.message, resWrongPassEmail.body.error.message);
    assert.equal(resWrongNim.body.error.message, "NIM/NIP/email atau kata sandi tidak benar.");

    // Assertion 2: Pesan 401 tidak mengandung kata "dikonfirmasi" atau "verifikasi"
    assert.equal(/dikonfirmasi/i.test(resWrongNim.body.error.message), false);
    assert.equal(/verifikasi/i.test(resWrongNim.body.error.message), false);
  } finally {
    setSupabaseAdminClientForTests(null);
    setPublicAuthClientForTests(null);
  }
});

test("login security: correct password with unconfirmed email returns 403 EMAIL_NOT_CONFIRMED for both email and NIM", async () => {
  const mockAdmin = {
    from(table) {
      if (table === "profiles") {
        return {
          select: () => ({
            ilike: (_col, val) => ({
              maybeSingle: async () => {
                if (val === "210101001") {
                  return { data: { id: "user-id-unconfirmed" }, error: null };
                }
                return { data: null, error: null };
              },
            }),
          }),
        };
      }
      return {};
    },
    auth: {
      admin: {
        getUserById: async (id) => {
          if (id === "user-id-unconfirmed") {
            return { data: { user: { email: "unconfirmed@sicare.test" } }, error: null };
          }
          return { data: { user: null }, error: { message: "Not found" } };
        },
      },
    },
  };

  const mockPublicAuth = {
    auth: {
      signInWithPassword: async ({ email, password }) => {
        if (email === "unconfirmed@sicare.test" && password === "correct-password") {
          return {
            data: { user: null, session: null },
            error: { message: "Email not confirmed" },
          };
        }
        return { data: { user: null, session: null }, error: { message: "Invalid login credentials" } };
      },
    },
  };

  setSupabaseAdminClientForTests(mockAdmin);
  setPublicAuthClientForTests(mockPublicAuth);

  try {
    const app = createTestApp();

    // Skenario 1: Login via Email dengan email belum dikonfirmasi
    const resEmail = await invokeApp(app, {
      method: "POST",
      url: "/api/v1/auth/login",
      body: { identifier: "unconfirmed@sicare.test", password: "correct-password" },
    });
    assert.equal(resEmail.status, 403);
    assert.equal(resEmail.body.error.code, "EMAIL_NOT_CONFIRMED");
    assert.match(resEmail.body.error.message, /belum diverifikasi/i);

    // Skenario 2: Login via NIM dengan email belum dikonfirmasi
    const resNim = await invokeApp(app, {
      method: "POST",
      url: "/api/v1/auth/login",
      body: { identifier: "210101001", password: "correct-password" },
    });
    assert.equal(resNim.status, 403);
    assert.equal(resNim.body.error.code, "EMAIL_NOT_CONFIRMED");
    assert.equal(resNim.body.error.message, resEmail.body.error.message);
  } finally {
    setSupabaseAdminClientForTests(null);
    setPublicAuthClientForTests(null);
  }
});

test("login security: inactive account with correct password returns 403 ACCOUNT_INACTIVE", async () => {
  const mockAdmin = {
    from(table) {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: (_col, val) => ({
              maybeSingle: async () => {
                if (val === "user-id-inactive") {
                  return {
                    data: {
                      id: "user-id-inactive",
                      full_name: "Mahasiswa Nonaktif",
                      app_role: "client",
                      account_status: "disabled",
                    },
                    error: null,
                  };
                }
                return { data: null, error: null };
              },
            }),
          }),
        };
      }
      return {};
    },
  };

  const mockPublicAuth = {
    auth: {
      signInWithPassword: async ({ email, password }) => {
        if (email === "disabled@sicare.test" && password === "correct-password") {
          return {
            data: {
              user: {
                id: "user-id-inactive",
                email: "disabled@sicare.test",
                email_confirmed_at: "2026-11-01T00:00:00Z",
              },
              session: { access_token: "mock-token" },
            },
            error: null,
          };
        }
        return { data: { user: null, session: null }, error: { message: "Invalid login credentials" } };
      },
    },
  };

  setSupabaseAdminClientForTests(mockAdmin);
  setPublicAuthClientForTests(mockPublicAuth);

  try {
    const app = createTestApp();

    const res = await invokeApp(app, {
      method: "POST",
      url: "/api/v1/auth/login",
      body: { identifier: "disabled@sicare.test", password: "correct-password" },
    });
    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, "ACCOUNT_INACTIVE");
    assert.equal(/verifikasi|dikonfirmasi/i.test(res.body.error.message), false);
  } finally {
    setSupabaseAdminClientForTests(null);
    setPublicAuthClientForTests(null);
  }
});
