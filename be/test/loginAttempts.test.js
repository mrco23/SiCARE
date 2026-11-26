import assert from "node:assert/strict";
import { test } from "node:test";
import {
  LOGIN_LOCKED_MESSAGE,
  assertLoginNotLocked,
  clearLoginFailures,
  loginAttemptKey,
  recordLoginFailure,
} from "../src/services/loginAttempts.service.js";

function memoryClient({ failReads = false } = {}) {
  const rows = new Map();
  return {
    rows,
    from() {
      const filters = {};
      const q = {
        select() { return q; },
        eq(col, val) { filters[col] = val; return q; },
        async maybeSingle() {
          if (failReads) return { data: null, error: { code: "42P01" } };
          return { data: rows.get(filters.identifier_hash) ?? null, error: null };
        },
        async upsert(row) { rows.set(row.identifier_hash, { ...row }); return { error: null }; },
        delete() {
          return { eq: async (_c, val) => { rows.delete(val); return { error: null }; } };
        },
      };
      return q;
    },
  };
}

test("login is locked for 30 minutes after the third wrong password", async () => {
  const client = memoryClient();
  const key = loginAttemptKey(" Klien@Unikadelasalle.ac.id ");
  assert.equal(key, loginAttemptKey("klien@unikadelasalle.ac.id"), "identitas dinormalisasi");
  const t0 = new Date("2026-11-25T03:00:00Z");

  await recordLoginFailure(key, { client, now: t0 });
  await recordLoginFailure(key, { client, now: new Date(t0.getTime() + 60_000) });
  await assertLoginNotLocked(key, { client, now: new Date(t0.getTime() + 90_000) });

  await assert.rejects(
    recordLoginFailure(key, { client, now: new Date(t0.getTime() + 120_000) }),
    (e) => e.status === 429 && e.code === "LOGIN_LOCKED" && e.message === LOGIN_LOCKED_MESSAGE,
  );
  // Masih terkunci 29 menit kemudian, terbuka setelah 30 menit.
  await assert.rejects(
    assertLoginNotLocked(key, { client, now: new Date(t0.getTime() + 120_000 + 29 * 60_000) }),
    (e) => e.code === "LOGIN_LOCKED",
  );
  await assertLoginNotLocked(key, { client, now: new Date(t0.getTime() + 120_000 + 31 * 60_000) });

  // Setelah kunci berakhir, hitungan mulai dari nol lagi.
  await recordLoginFailure(key, { client, now: new Date(t0.getTime() + 120_000 + 32 * 60_000) });
  assert.equal(client.rows.get(key).failed_count, 1);
});

test("successful login clears failures and failures expire after 30 minutes", async () => {
  const client = memoryClient();
  const key = loginAttemptKey("24013031");
  const t0 = new Date("2026-11-25T03:00:00Z");
  await recordLoginFailure(key, { client, now: t0 });
  await recordLoginFailure(key, { client, now: t0 });
  await clearLoginFailures(key, { client });
  assert.equal(client.rows.has(key), false);

  await recordLoginFailure(key, { client, now: t0 });
  await recordLoginFailure(key, { client, now: t0 });
  // Kegagalan ketiga lebih dari 30 menit setelah yang terakhir: tidak mengunci.
  await recordLoginFailure(key, { client, now: new Date(t0.getTime() + 31 * 60_000) });
  assert.equal(client.rows.get(key).failed_count, 1);
});

test("login attempt tracking fails open when the table is unavailable", async () => {
  const client = memoryClient({ failReads: true });
  const key = loginAttemptKey("x@unikadelasalle.ac.id");
  await assertLoginNotLocked(key, { client });
  await recordLoginFailure(key, { client });
});
