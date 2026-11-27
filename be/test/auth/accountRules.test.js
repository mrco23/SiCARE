import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import authRoutes, { setPublicAuthClientForTests } from "../../src/routes/auth.routes.js";
import { setSupabaseAdminClientForTests } from "../../src/config/supabase.js";
import { errorHandler } from "../../src/middleware/errorHandler.js";
import {
  campusEmailSchema,
  indonesianPhoneSchema,
  strongPasswordSchema,
} from "../../src/validators/shared.validator.js";
import { registerSchema, changePasswordSchema } from "../../src/validators/auth.validator.js";
import { createAccountSchema, patchAccountSchema } from "../../src/validators/admin.validator.js";

/* ---------------- Validator rules ---------------- */

test("strong password requires lower, upper, digit, symbol and 8-128 chars", () => {
  assert.equal(strongPasswordSchema.safeParse("Sandi#Kuat1").success, true);
  for (const weak of ["sandi#kuat1", "SANDI#KUAT1", "Sandi#Kuat", "SandiKuat1", "Sa#1a", `Aa1!${"x".repeat(125)}`]) {
    assert.equal(strongPasswordSchema.safeParse(weak).success, false, weak);
  }
  assert.equal(strongPasswordSchema.safeParse(`Aa1!${"x".repeat(124)}`).success, true);
});

test("campus email only accepts @unikadelasalle.ac.id", () => {
  assert.equal(campusEmailSchema.safeParse("nama.dosen@unikadelasalle.ac.id").success, true);
  assert.equal(campusEmailSchema.safeParse("NAMA@UNIKADELASALLE.AC.ID").success, true);
  assert.equal(campusEmailSchema.safeParse("nama@gmail.com").success, false);
  assert.equal(campusEmailSchema.safeParse("nama@unikadelasalle.ac.id.evil.com").success, false);
});

test("phone must be Indonesian E.164 (+62)", () => {
  assert.equal(indonesianPhoneSchema.safeParse("+6281234567890").success, true);
  for (const bad of ["081234567890", "6281234567890", "+62081234567", "+1415555123", "+62812"]) {
    assert.equal(indonesianPhoneSchema.safeParse(bad).success, false, bad);
  }
});

test("register and admin account schemas apply the shared rules", () => {
  const base = { full_name: "Uji", password: "Sandi#Kuat1" };
  assert.equal(registerSchema.safeParse({ ...base, email: "a@unikadelasalle.ac.id", phone_e164: "+6281234567890" }).success, true);
  assert.equal(registerSchema.safeParse({ ...base, email: "a@gmail.com" }).success, false);
  assert.equal(registerSchema.safeParse({ ...base, email: "a@unikadelasalle.ac.id", password: "password123" }).success, false);
  assert.equal(registerSchema.safeParse({ ...base, email: "a@unikadelasalle.ac.id", phone_e164: "081234567890" }).success, false);

  const account = { ...base, email: "lmi@unikadelasalle.ac.id", identity_code: "NIP-LMI-01", app_role: "head_lmi", gender: "female" };
  const { identity_code: _nip, ...withoutNip } = account;
  assert.equal(createAccountSchema.safeParse(withoutNip).success, false, "NIP wajib untuk akun buatan admin");
  assert.equal(createAccountSchema.safeParse(account).success, true);
  assert.equal(createAccountSchema.safeParse({ ...account, email: "lmi@sicare.test" }).success, false);
  assert.equal(createAccountSchema.safeParse({ ...account, password: "Lemah123" }).success, false);

  // Admin hanya boleh mengubah status akun; data akun lain ditolak.
  assert.equal(patchAccountSchema.safeParse({ account_status: "active" }).success, true);
  assert.equal(patchAccountSchema.safeParse({ phone_e164: "+6281234567890" }).success, false);
  assert.equal(patchAccountSchema.safeParse({ account_status: "active", full_name: "Nama Baru" }).success, false);
  assert.equal(patchAccountSchema.safeParse({ app_role: "counselor" }).success, false);
  assert.equal(patchAccountSchema.safeParse({}).success, false);
});

test("change password schema rejects weak or unchanged passwords", () => {
  assert.equal(changePasswordSchema.safeParse({ current_password: "Lama#123a", new_password: "Baru#123a" }).success, true);
  assert.equal(changePasswordSchema.safeParse({ current_password: "Lama#123a", new_password: "lemah" }).success, false);
  assert.equal(changePasswordSchema.safeParse({ current_password: "Sama#123a", new_password: "Sama#123a" }).success, false);
});

/* ---------------- POST /auth/change-password ---------------- */

function invokeApp(app, { method, url, body = {}, headers = {} }) {
  return new Promise((resolve) => {
    const req = { method, url, headers: { "content-type": "application/json", ...headers }, body };
    let statusCode = 200;
    const resHeaders = {};
    const res = {
      status(code) { statusCode = code; return res; },
      setHeader(name, val) { resHeaders[name.toLowerCase()] = val; return res; },
      getHeader(name) { return resHeaders[name.toLowerCase()]; },
      json(data) { resolve({ status: statusCode, body: data }); return res; },
      send(data) { resolve({ status: statusCode, body: data }); return res; },
      end() { resolve({ status: statusCode, body: null }); },
    };
    app.handle(req, res);
  });
}

const USER = { id: "11111111-1111-4111-8111-111111111111", email: "klien@unikadelasalle.ac.id" };

function createAdminMock(state) {
  return {
    auth: {
      getUser: async () => ({ data: { user: { ...USER, user_metadata: {} } }, error: null }),
      admin: {
        updateUserById: async (id, attrs) => {
          state.updated.push({ id, attrs });
          return { data: { user: { id } }, error: state.updateError ?? null };
        },
      },
    },
    from(table) {
      const query = {
        select: () => query,
        eq: () => query,
        maybeSingle: async () => ({
          data: table === "profiles" ? { id: USER.id, app_role: "client", account_status: "active" } : null,
          error: null,
        }),
        insert: async (row) => { state.audits.push(row); return { error: null }; },
      };
      return query;
    },
  };
}

function setup({ currentPassword = "Lama#123a", updateError = null } = {}) {
  const state = { updated: [], audits: [], signIns: [], updateError };
  setSupabaseAdminClientForTests(createAdminMock(state));
  setPublicAuthClientForTests({
    auth: {
      signInWithPassword: async ({ email, password }) => {
        state.signIns.push(email);
        return password === currentPassword
          ? { data: { user: { id: USER.id }, session: {} }, error: null }
          : { data: { user: null, session: null }, error: { message: "Invalid login credentials" } };
      },
    },
  });
  const app = express();
  app.use(express.json());
  app.use("/api/v1/auth", authRoutes);
  app.use(errorHandler);
  return { app, state };
}

function teardown() {
  setSupabaseAdminClientForTests(null);
  setPublicAuthClientForTests(null);
}

const authHeader = { authorization: "Bearer test-token" };

test("change-password requires authentication", async () => {
  const { app } = setup();
  try {
    const res = await invokeApp(app, {
      method: "POST",
      url: "/api/v1/auth/change-password",
      body: { current_password: "Lama#123a", new_password: "Baru#123a" },
    });
    assert.equal(res.status, 401);
  } finally {
    teardown();
  }
});

test("change-password rejects a weak new password before touching Supabase Auth", async () => {
  const { app, state } = setup();
  try {
    const res = await invokeApp(app, {
      method: "POST",
      url: "/api/v1/auth/change-password",
      headers: authHeader,
      body: { current_password: "Lama#123a", new_password: "lemahsekali" },
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "VALIDATION_ERROR");
    assert.equal(state.signIns.length, 0);
    assert.equal(state.updated.length, 0);
  } finally {
    teardown();
  }
});

test("change-password rejects a wrong current password without updating", async () => {
  const { app, state } = setup();
  try {
    const res = await invokeApp(app, {
      method: "POST",
      url: "/api/v1/auth/change-password",
      headers: authHeader,
      body: { current_password: "Salah#123a", new_password: "Baru#123a" },
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "CURRENT_PASSWORD_INVALID");
    assert.deepEqual(state.signIns, [USER.email]);
    assert.equal(state.updated.length, 0);
  } finally {
    teardown();
  }
});

test("change-password updates the signed-in user's password only after re-verification", async () => {
  const { app, state } = setup();
  try {
    const res = await invokeApp(app, {
      method: "POST",
      url: "/api/v1/auth/change-password",
      headers: authHeader,
      body: { current_password: "Lama#123a", new_password: "Baru#123a" },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.password_changed, true);
    assert.deepEqual(state.updated, [{ id: USER.id, attrs: { password: "Baru#123a" } }]);
    // Audit must never contain password material.
    assert.equal(JSON.stringify(state.audits).includes("Baru#123a"), false);
    assert.equal(JSON.stringify(state.audits).includes("Lama#123a"), false);
  } finally {
    teardown();
  }
});

test("change-password reports a server failure instead of success", async () => {
  const { app } = setup({ updateError: { message: "network down" } });
  try {
    const res = await invokeApp(app, {
      method: "POST",
      url: "/api/v1/auth/change-password",
      headers: authHeader,
      body: { current_password: "Lama#123a", new_password: "Baru#123a" },
    });
    assert.equal(res.status, 503);
    assert.equal(res.body.error.code, "PASSWORD_UPDATE_FAILED");
  } finally {
    teardown();
  }
});
