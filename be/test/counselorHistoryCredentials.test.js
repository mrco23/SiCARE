import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import http from "node:http";
import { test } from "node:test";
import app from "../app.js";
import { setSupabaseAdminClientForTests } from "../src/config/supabase.js";
import {
  comparePassword,
  createHistoryGrantToken,
  hashPassword,
  recordFailedAttempt,
  resetFailedAttempts,
  verifyHistoryGrantToken,
} from "../src/services/counselorCredential.service.js";

const migrationSql = readFileSync(
  new URL("../../supabase/migrations/20261102000000_sicare_counselor_history_credentials.sql", import.meta.url),
  "utf8"
);

test("counselor history credentials migration defines table, check constraint, RLS and triggers", () => {
  assert.match(migrationSql, /create table if not exists public\.counselor_history_credentials/);
  assert.match(migrationSql, /counselor_id uuid primary key references public\.profiles\(id\) on delete cascade/);
  assert.match(migrationSql, /password_hash text not null/);
  assert.match(migrationSql, /constraint counselor_history_password_hash_format check/);
  assert.match(migrationSql, /alter table public\.counselor_history_credentials enable row level security/);
  assert.match(migrationSql, /revoke all on public\.counselor_history_credentials from anon, authenticated/);
  assert.match(migrationSql, /grant all on public\.counselor_history_credentials to service_role/);
});

const mergeMigrationSql = readFileSync(
  new URL("../../supabase/migrations/20261124120000_sicare_merge_counselor_history_credentials.sql", import.meta.url),
  "utf8"
);

test("merge migration moves the hash into counselor_profiles and drops the old table", () => {
  assert.match(mergeMigrationSql, /add column if not exists history_password_hash text/);
  assert.match(mergeMigrationSql, /constraint counselor_profiles_history_password_hash_format check/);
  assert.match(mergeMigrationSql, /set history_password_hash = c\.password_hash/);
  assert.match(mergeMigrationSql, /COUNSELOR_HISTORY_CREDENTIAL_COPY_MISMATCH/);
  assert.ok(
    mergeMigrationSql.indexOf("COUNSELOR_HISTORY_CREDENTIAL_COPY_MISMATCH") <
      mergeMigrationSql.indexOf("drop table if exists public.counselor_history_credentials")
  );
});

test("merge migration keeps the password hash unreadable for anon and authenticated", () => {
  assert.match(mergeMigrationSql, /revoke select on public\.counselor_profiles from anon, authenticated;/);
  const grant = mergeMigrationSql.match(/grant select \(([^)]*)\) on public\.counselor_profiles to anon, authenticated;/);
  assert.ok(grant, "column-level select grant expected");
  assert.doesNotMatch(grant[1], /history_password/);
  assert.doesNotMatch(mergeMigrationSql, /grant (select|update|all)[^;]*history_password[^;]*to (anon|authenticated)/);
  // Table-level select must not be granted back anywhere in the migration.
  assert.doesNotMatch(mergeMigrationSql, /grant select on public\.counselor_profiles to/);
});

test("backend never reads counselor_profiles with select * or exposes the hash outside the credential controller", () => {
  const files = [
    "../src/middleware/auth.js",
    "../src/routes/domain.routes.js",
    "../src/services/admin/accounts.service.js",
    "../src/services/counselor/profile.service.js",
    "../src/workers/whatsapp.scheduler.js",
  ];
  for (const file of files) {
    const source = readFileSync(new URL(file, import.meta.url), "utf8");
    assert.doesNotMatch(source, /history_password/, file);
    assert.doesNotMatch(source, /from\("counselor_profiles"\)\s*\.select\("\*"\)/, file);
  }
});

test("password hashing with bcrypt produces valid non-reversible hashes and verifies correctly", async () => {
  const hash = await hashPassword("superSecret123");
  assert.ok(hash.startsWith("$2a$") || hash.startsWith("$2b$"));
  assert.notEqual(hash, "superSecret123");

  const valid = await comparePassword("superSecret123", hash);
  assert.equal(valid, true);

  const invalid = await comparePassword("wrongPassword", hash);
  assert.equal(invalid, false);
});

test("history grant token generates and verifies tamper-proof timestamped HMAC tokens", () => {
  const counselorId = "11111111-1111-1111-1111-111111111111";
  const grant = createHistoryGrantToken(counselorId, 1800);

  assert.ok(grant.token);
  assert.equal(grant.expires_in_seconds, 1800);

  // Valid token for matching counselor
  const isValid = verifyHistoryGrantToken(grant.token, counselorId);
  assert.equal(isValid, true);

  // Rejected for different counselor
  const otherCounselorId = "22222222-2222-2222-2222-222222222222";
  assert.equal(verifyHistoryGrantToken(grant.token, otherCounselorId), false);

  // Rejected for tampered token
  const tampered = grant.token.replace(/1/g, "2");
  assert.equal(verifyHistoryGrantToken(tampered, counselorId), false);
});

test("rate limiting triggers lockout after maximum failed attempts", () => {
  const counselorId = "33333333-3333-3333-3333-333333333333";
  resetFailedAttempts(counselorId);

  for (let i = 0; i < 4; i++) {
    recordFailedAttempt(counselorId);
  }

  // 5th attempt throws TOO_MANY_ATTEMPTS
  assert.throws(() => {
    recordFailedAttempt(counselorId);
  }, /Terlalu banyak percobaan salah/);

  resetFailedAttempts(counselorId);
});

// Mock HTTP test helper
function requestApp(mockClient, { method, path, token, body, headers = {} }) {
  setSupabaseAdminClientForTests(mockClient);
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      const payload = body ? JSON.stringify(body) : null;
      const reqHeaders = {
        ...headers,
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(payload
          ? {
              "content-type": "application/json",
              "content-length": Buffer.byteLength(payload),
            }
          : {}),
      };

      const req = http.request(
        {
          host: "127.0.0.1",
          port,
          method,
          path,
          headers: reqHeaders,
        },
        (res) => {
          let raw = "";
          res.setEncoding("utf8");
          res.on("data", (chunk) => (raw += chunk));
          res.on("end", () => {
            server.close(() => {
              let parsedBody = null;
              try {
                parsedBody = raw ? JSON.parse(raw) : null;
              } catch {
                parsedBody = raw;
              }
              resolve({ status: res.statusCode, body: parsedBody });
            });
          });
        }
      );

      req.on("error", (err) => {
        server.close();
        reject(err);
      });

      if (payload) req.write(payload);
      req.end();
    });
  });
}

function createMockSupabaseForCredentials(counselorId, { withCounselorProfile = true } = {}) {
  // Sandi riwayat tersimpan di counselor_profiles.history_password_hash.
  const counselorProfiles = withCounselorProfile
    ? [{ profile_id: counselorId, public_name: "Konselor Test", history_password_hash: null, history_password_updated_at: null }]
    : [];
  const profiles = [
    {
      id: counselorId,
      app_role: "counselor",
      account_status: "active",
      full_name: "Konselor Test",
    },
    {
      id: "99999999-9999-9999-9999-999999999999",
      app_role: "client",
      account_status: "active",
      full_name: "Klien Test",
    },
  ];
  const sessions = [
    {
      id: "session-1",
      booking_id: "booking-1",
      counselor_id: counselorId,
      starts_at: "2026-10-15T09:00:00Z",
      ends_at: "2026-10-15T10:00:00Z",
      status: "completed",
      format: "offline",
      room: "Ruang A",
      created_at: "2026-10-15T08:00:00Z",
      updated_at: "2026-10-15T10:00:00Z",
    },
  ];
  const bookings = [
    {
      id: "booking-1",
      client_id: "99999999-9999-9999-9999-999999999999",
      counselor_id: counselorId,
      service_type: "individual",
      status: "confirmed",
      starts_at: "2026-10-15T09:00:00Z",
      ends_at: "2026-10-15T10:00:00Z",
      booking_participants: [],
    },
  ];

  return {
    counselorProfiles,
    auth: {
      getUser: async (token) => {
        if (token === "valid-counselor-token") {
          return { data: { user: { id: counselorId, email: "counselor@test.com" } }, error: null };
        }
        if (token === "client-token") {
          return { data: { user: { id: "99999999-9999-9999-9999-999999999999", email: "client@test.com" } }, error: null };
        }
        return { data: { user: null }, error: new Error("Invalid token") };
      },
    },
    from: (table) => {
      let selectedFields = null;
      let filterCol = null;
      let filterVal = null;

      const filters = [];
      let pendingPatch = null;
      const matches = (row) => filters.every(([col, val]) => row[col] === val);
      const rowsFor = () => {
        if (table === "profiles") return profiles;
        if (table === "counselor_profiles") return counselorProfiles;
        return [];
      };
      const applyPatch = () => {
        const row = rowsFor().find(matches) || null;
        if (row && pendingPatch) Object.assign(row, pendingPatch);
        return row;
      };

      const builder = {
        select: () => builder,
        eq: (col, val) => {
          filters.push([col, val]);
          return builder;
        },
        is: (col, val) => {
          filters.push([col, val]);
          return builder;
        },
        in: () => builder,
        order: () => builder,
        limit: () => builder,
        update: (patch) => {
          pendingPatch = patch;
          return builder;
        },
        maybeSingle: async () => {
          if (pendingPatch) return { data: applyPatch(), error: null };
          return { data: rowsFor().find(matches) || null, error: null };
        },
        single: async () => ({ data: rowsFor().find(matches) || null, error: null }),
        then: (resolve) => {
          if (pendingPatch) {
            resolve({ data: applyPatch(), error: null });
          } else if (table === "counseling_sessions") {
            resolve({ data: sessions, error: null });
          } else if (table === "bookings") {
            resolve({ data: bookings, error: null });
          } else if (table === "profiles") {
            resolve({ data: profiles, error: null });
          } else {
            resolve({ data: [], error: null });
          }
        },
      };

      return builder;
    },
  };
}

test("full lifecycle: init, status, verify, change password and protected history access", async () => {
  const counselorId = "44444444-4444-4444-4444-444444444444";
  const mockDb = createMockSupabaseForCredentials(counselorId);

  // 1. Initial status: configured = false
  const statusRes1 = await requestApp(mockDb, {
    method: "GET",
    path: "/api/v1/counselor/history-password/status",
    token: "valid-counselor-token",
  });
  assert.equal(statusRes1.status, 200);
  assert.equal(statusRes1.body.data.configured, false);

  // 2. Accessing history without configured password returns configured: false
  const historyNoConfig = await requestApp(mockDb, {
    method: "GET",
    path: "/api/v1/counselor/history",
    token: "valid-counselor-token",
  });
  assert.equal(historyNoConfig.status, 200);
  assert.equal(historyNoConfig.body.data.configured, false);

  // 3. Configure initial password
  const initRes = await requestApp(mockDb, {
    method: "POST",
    path: "/api/v1/counselor/history-password/init",
    token: "valid-counselor-token",
    body: { password: "securePIN1234" },
  });
  assert.equal(initRes.status, 201);
  assert.equal(initRes.body.data.success, true);
  assert.ok(mockDb.counselorProfiles[0].history_password_hash.startsWith("$2"));
  assert.ok(mockDb.counselorProfiles[0].history_password_updated_at);
  assert.equal(JSON.stringify(initRes.body).includes("$2"), false, "hash must not be returned");

  // 3b. Second init is rejected
  const initAgain = await requestApp(mockDb, {
    method: "POST",
    path: "/api/v1/counselor/history-password/init",
    token: "valid-counselor-token",
    body: { password: "anotherPIN999" },
  });
  assert.equal(initAgain.status, 409);
  assert.equal(initAgain.body.error.code, "CREDENTIAL_ALREADY_CONFIGURED");

  // 4. Status is now configured = true
  const statusRes2 = await requestApp(mockDb, {
    method: "GET",
    path: "/api/v1/counselor/history-password/status",
    token: "valid-counselor-token",
  });
  assert.equal(statusRes2.status, 200);
  assert.equal(statusRes2.body.data.configured, true);

  // 5. Accessing history without grant token now returns 403 HISTORY_ACCESS_LOCKED
  const historyLocked = await requestApp(mockDb, {
    method: "GET",
    path: "/api/v1/counselor/history",
    token: "valid-counselor-token",
  });
  assert.equal(historyLocked.status, 403);
  assert.equal(historyLocked.body.error.code, "HISTORY_ACCESS_LOCKED");

  // 6. Verify with incorrect password returns 401 INVALID_CREDENTIALS
  const verifyWrong = await requestApp(mockDb, {
    method: "POST",
    path: "/api/v1/counselor/history-password/verify",
    token: "valid-counselor-token",
    body: { password: "wrongPIN" },
  });
  assert.equal(verifyWrong.status, 401);
  assert.equal(verifyWrong.body.error.code, "INVALID_CREDENTIALS");

  // 7. Verify with correct password returns grant_token
  const verifyRight = await requestApp(mockDb, {
    method: "POST",
    path: "/api/v1/counselor/history-password/verify",
    token: "valid-counselor-token",
    body: { password: "securePIN1234" },
  });
  assert.equal(verifyRight.status, 200);
  assert.ok(verifyRight.body.data.grant_token);
  const grantToken = verifyRight.body.data.grant_token;

  // 8. Access history with valid grant token succeeds
  const historyUnlocked = await requestApp(mockDb, {
    method: "GET",
    path: "/api/v1/counselor/history",
    token: "valid-counselor-token",
    headers: { "x-counselor-history-grant": grantToken },
  });
  assert.equal(historyUnlocked.status, 200);
  assert.equal(historyUnlocked.body.data.configured, true);
  assert.ok(Array.isArray(historyUnlocked.body.data.sessions));

  // 9. Change password with wrong current password returns 401
  const changeWrong = await requestApp(mockDb, {
    method: "POST",
    path: "/api/v1/counselor/history-password/change",
    token: "valid-counselor-token",
    body: {
      current_password: "wrongCurrent",
      new_password: "newSecurePIN5678",
      confirm_password: "newSecurePIN5678",
    },
  });
  assert.equal(changeWrong.status, 401);

  // 10. Change password with correct current password succeeds
  const changeRight = await requestApp(mockDb, {
    method: "POST",
    path: "/api/v1/counselor/history-password/change",
    token: "valid-counselor-token",
    body: {
      current_password: "securePIN1234",
      new_password: "newSecurePIN5678",
      confirm_password: "newSecurePIN5678",
    },
  });
  assert.equal(changeRight.status, 200);
  assert.equal(changeRight.body.data.success, true);
  assert.equal(await comparePassword("newSecurePIN5678", mockDb.counselorProfiles[0].history_password_hash), true);

  // 11. Role enforcement: Client cannot access counselor history endpoints
  const clientAccess = await requestApp(mockDb, {
    method: "GET",
    path: "/api/v1/counselor/history-password/status",
    token: "client-token",
  });
  assert.equal(clientAccess.status, 403);
});


test("history response attaches clients[].photo_url from auth metadata and tolerates lookup failure", async () => {
  const counselorId = "55555555-5555-5555-5555-555555555555";
  const mockDb = createMockSupabaseForCredentials(counselorId);
  mockDb.auth.admin = {
    getUserById: async (id) => {
      if (id === "99999999-9999-9999-9999-999999999999") {
        return {
          data: { user: { id, user_metadata: { avatar_url: "https://cdn.example.test/avatar.png" } } },
          error: null,
        };
      }
      throw new Error("lookup failed");
    },
  };

  await requestApp(mockDb, {
    method: "POST",
    path: "/api/v1/counselor/history-password/init",
    token: "valid-counselor-token",
    body: { password: "securePIN1234" },
  });
  const verify = await requestApp(mockDb, {
    method: "POST",
    path: "/api/v1/counselor/history-password/verify",
    token: "valid-counselor-token",
    body: { password: "securePIN1234" },
  });

  const history = await requestApp(mockDb, {
    method: "GET",
    path: "/api/v1/counselor/history",
    token: "valid-counselor-token",
    headers: { "x-counselor-history-grant": verify.body.data.grant_token },
  });

  assert.equal(history.status, 200);
  const byId = new Map(history.body.data.clients.map((c) => [c.id, c]));
  assert.equal(byId.get("99999999-9999-9999-9999-999999999999").photo_url, "https://cdn.example.test/avatar.png");
  // Lookup failure for another profile must not break the response.
  assert.equal(byId.get(counselorId).photo_url, null);
  resetFailedAttempts(counselorId);
});

test("init is rejected when the counselor has no counselor_profiles row", async () => {
  const counselorId = "66666666-6666-6666-6666-666666666666";
  const mockDb = createMockSupabaseForCredentials(counselorId, { withCounselorProfile: false });

  const status = await requestApp(mockDb, {
    method: "GET",
    path: "/api/v1/counselor/history-password/status",
    token: "valid-counselor-token",
  });
  assert.equal(status.status, 200);
  assert.equal(status.body.data.configured, false);

  const init = await requestApp(mockDb, {
    method: "POST",
    path: "/api/v1/counselor/history-password/init",
    token: "valid-counselor-token",
    body: { password: "securePIN1234" },
  });
  assert.equal(init.status, 404);
  assert.equal(init.body.error.code, "COUNSELOR_PROFILE_NOT_FOUND");
});
