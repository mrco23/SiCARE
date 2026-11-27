import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  markMissedSessions,
  markMissedSessionsSafely,
  MISSED_SESSION_GRACE_MINUTES,
  resetMissedSessionThrottleForTests,
} from "../../src/services/missedSession.service.js";
import { sessionRepository } from "../../src/repositories/session.repository.js";
import { sessionListQuerySchema } from "../../src/validators/session.validator.js";

const migration = readFileSync(
  new URL("../../../supabase/migrations/20261115120000_sicare_session_missed_status.sql", import.meta.url),
  "utf8",
);

/* ---------------- Migrasi (statis) ---------------- */

test("migration allows the missed status with a required reason", () => {
  assert.match(migration, /check \(status in \('scheduled', 'ongoing', 'completed', 'cancelled', 'missed'\)\)/);
  assert.match(migration, /missed_reason in \('consent_unsigned', 'not_started'\)/);
  assert.match(migration, /status <> 'missed' and missed_reason is null and missed_at is null/);
});

test("mark function only touches overdue scheduled sessions and uses consent readiness for the reason", () => {
  assert.match(migration, /where s\.status = 'scheduled'\s+and s\.ends_at \+ pg_catalog\.make_interval\(mins => v_grace\) <= v_now/);
  assert.match(migration, /sicare_check_booking_consent_readiness\(v_session\.booking_id\)/);
  assert.match(migration, /case when v_consented then 'not_started' else 'consent_unsigned' end/);
  assert.match(migration, /where id = v_session\.id and status = 'scheduled'/);
});

test("mark function cancels pending reminders, notifies both parties, and leaves bookings unchanged", () => {
  assert.match(migration, /update public\.whatsapp_outbox[\s\S]*status in \('pending', 'queued', 'retry_wait'\)/);
  assert.match(migration, /'session\.missed'[\s\S]*'session\.missed'/);
  assert.doesNotMatch(migration, /update public\.bookings/);
});

test("mark function is executable by service_role only", () => {
  assert.match(migration, /revoke all on function public\.sicare_mark_missed_sessions\(integer\) from public, anon, authenticated;/);
  assert.match(migration, /grant execute on function public\.sicare_mark_missed_sessions\(integer\) to service_role;/);
  assert.match(migration, /security definer\s+set search_path = ''/);
});

/* ---------------- Service ---------------- */

function rpcClient(result) {
  const calls = [];
  return {
    calls,
    rpc: async (name, args) => {
      calls.push({ name, args });
      return typeof result === "function" ? result() : result;
    },
  };
}

test("markMissedSessions calls the RPC with the 30 minute grace period", async () => {
  resetMissedSessionThrottleForTests();
  const client = rpcClient({ data: 2, error: null });
  assert.equal(await markMissedSessions(client), 2);
  assert.deepEqual(client.calls, [
    { name: "sicare_mark_missed_sessions", args: { p_grace_minutes: MISSED_SESSION_GRACE_MINUTES } },
  ]);
  assert.equal(MISSED_SESSION_GRACE_MINUTES, 30);
});

test("read path is throttled and never throws when the RPC fails", async () => {
  resetMissedSessionThrottleForTests();
  const failing = rpcClient({ data: null, error: { code: "PGRST202", message: "function not found" } });
  const originalError = console.error;
  console.error = () => {};
  try {
    assert.equal(await markMissedSessionsSafely(failing), 0);
    // One pass calls every RPC (expired bookings, auto-complete, missed sessions); a second call
    // inside the throttle window does not hit the database again.
    assert.equal(await markMissedSessionsSafely(failing), 0);
    assert.deepEqual(failing.calls.map((c) => c.name), [
      "sicare_mark_expired_bookings",
      "sicare_auto_complete_sessions",
      "sicare_mark_missed_sessions",
    ]);
  } finally {
    console.error = originalError;
    resetMissedSessionThrottleForTests();
  }
});

/* ---------------- Repository fallback ---------------- */

function sessionsClient({ missingColumns }) {
  const selects = [];
  const makeQuery = (table) => {
    let fields = "";
    const q = {
      select(f) { fields = f; if (table === "counseling_sessions") selects.push(f); return q; },
      eq() { return q; },
      in() { return q; },
      order() { return q; },
      limit() { return q; },
      range() { return q; },
      then(resolve) {
        if (table === "bookings") return resolve({ data: [{ id: "b1" }], error: null });
        if (missingColumns && fields.includes("missed_reason")) {
          return resolve({ data: null, error: { code: "42703", message: "column counseling_sessions.missed_reason does not exist" } });
        }
        return resolve({ data: [{ id: "s1", booking_id: "b1", status: "scheduled" }], error: null });
      },
    };
    return q;
  };
  return { selects, from: (table) => makeQuery(table) };
}

test("session list falls back to base columns before the migration is applied", async () => {
  const client = sessionsClient({ missingColumns: true });
  const rows = await sessionRepository.list(client, { userId: "u1", role: "client" });
  assert.equal(rows.length, 1);
  // Latest columns -> without auto_completed_at -> base columns.
  assert.equal(client.selects.length, 3);
  assert.ok(client.selects[0].includes("auto_completed_at"));
  assert.ok(client.selects[1].includes("missed_reason") && !client.selects[1].includes("auto_completed_at"));
  assert.ok(!client.selects[2].includes("missed_reason"));
});

test("session list returns missed fields once the migration is applied", async () => {
  const client = sessionsClient({ missingColumns: false });
  await sessionRepository.list(client, { userId: "u1", role: "client" });
  assert.equal(client.selects.length, 1);
  assert.ok(client.selects[0].includes("missed_reason,missed_at"));
});

test("session list filter accepts the missed status", () => {
  assert.equal(sessionListQuerySchema.safeParse({ status: "missed" }).success, true);
});
