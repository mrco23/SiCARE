import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  autoCompleteSessions,
  AUTO_COMPLETE_GRACE_MINUTES,
} from "../src/services/missedSession.service.js";
import { handleDomainRpcError } from "../src/lib/domainRpc.js";
import { bookingRepository } from "../src/repositories/booking.repository.js";

const migration = readFileSync(
  new URL("../../supabase/migrations/20261116120000_sicare_counseling_flow_guards.sql", import.meta.url),
  "utf8",
);

function section(startMarker, endMarker) {
  const start = migration.indexOf(startMarker);
  const end = endMarker ? migration.indexOf(endMarker, start) : migration.length;
  assert.ok(start >= 0, `missing ${startMarker}`);
  return migration.slice(start, end);
}

function domainCode(message) {
  try {
    handleDomainRpcError({ message });
  } catch (error) {
    return [error.status, error.code];
  }
  return null;
}

/* ---------------- 1. Penutupan otomatis sesi ---------------- */

test("ongoing sessions are auto-completed 2 hours after their end and flagged", () => {
  const fn = section("function public.sicare_auto_complete_sessions", "revoke all on function public.sicare_auto_complete_sessions");
  assert.match(fn, /where s\.status = 'ongoing'\s+and s\.ends_at \+ pg_catalog\.make_interval\(mins => v_grace\) <= v_now/);
  assert.match(fn, /set status = 'completed',[\s\S]*auto_completed_at = v_now/);
  assert.match(fn, /where id = v_session\.id and status = 'ongoing'/);
  assert.match(fn, /'session\.completed'[\s\S]*'session\.auto_completed'/);
  assert.match(migration, /check \(auto_completed_at is null or status = 'completed'\)/);
  assert.match(migration, /grant execute on function public\.sicare_auto_complete_sessions\(integer\) to service_role;/);
});

test("autoCompleteSessions calls the RPC with the 2 hour grace period", async () => {
  const calls = [];
  const client = { rpc: async (name, args) => { calls.push({ name, args }); return { data: 3, error: null }; } };
  assert.equal(await autoCompleteSessions(client), 3);
  assert.deepEqual(calls, [{ name: "sicare_auto_complete_sessions", args: { p_grace_minutes: 120 } }]);
  assert.equal(AUTO_COMPLETE_GRACE_MINUTES, 120);
});

/* ---------------- 2. Jadwal ulang ikut kedaluwarsa ---------------- */

test("reschedule_requested bookings expire at their original start with their own reason", () => {
  const fn = section("function public.sicare_mark_expired_bookings", "revoke all on function public.sicare_mark_expired_bookings");
  assert.match(fn, /where b\.status in \('waiting_confirmation', 'reschedule_requested'\)\s+and b\.starts_at <= v_now/);
  assert.match(fn, /case when v_booking\.status = 'reschedule_requested'\s+then 'reschedule_not_selected' else 'not_confirmed'/);
  assert.match(fn, /where id = v_booking\.id and status = v_booking\.status/);
  assert.match(fn, /update public\.consent_invitations[\s\S]*status = 'revoked'/);
  assert.match(migration, /expired_reason in \('not_confirmed', 'reschedule_not_selected'\)/);
  assert.match(migration, /set expired_reason = 'not_confirmed'\s+where status = 'expired' and expired_reason is null/);
});

test("booking reads include expired_reason and fall back when the column is missing", async () => {
  const selects = [];
  const client = {
    from() {
      let fields = "";
      const q = {
        select(f) { fields = f; selects.push(f); return q; },
        eq() { return q; },
        order() { return q; },
        limit() { return q; },
        then(resolve) {
          if (fields.includes("expired_reason")) {
            return resolve({ data: null, error: { code: "42703", message: "column bookings.expired_reason does not exist" } });
          }
          return resolve({ data: [{ id: "b1" }], error: null });
        },
      };
      return q;
    },
  };
  const rows = await bookingRepository.list(client, { userId: "u1", role: "client" });
  assert.equal(rows.length, 1);
  assert.equal(selects.length, 2);
  assert.ok(selects[0].includes("expired_at,expired_reason"));
  assert.ok(selects[1].includes("expired_at") && !selects[1].includes("expired_reason"));
});

/* ---------------- 3. Jendela waktu mulai sesi ---------------- */

test("sessions can only start from 15 minutes before start until their end", () => {
  const fn = section("function public.sicare_transition_session", "revoke all on function public.sicare_transition_session");
  assert.match(fn, /v_now < v_session\.starts_at - interval '15 minutes'[\s\S]*'SESSION_START_TOO_EARLY'/);
  assert.match(fn, /v_now > v_session\.ends_at[\s\S]*'SESSION_START_WINDOW_PASSED'/);
  // Consent tetap diperiksa sebelum sesi dimulai.
  assert.match(fn, /sicare_check_booking_consent_readiness\(v_session\.booking_id\)[\s\S]*'CONSENT_READINESS_INCOMPLETE'/);
  assert.deepEqual(domainCode("SESSION_START_TOO_EARLY"), [409, "SESSION_START_TOO_EARLY"]);
  assert.deepEqual(domainCode("SESSION_START_WINDOW_PASSED"), [409, "SESSION_START_WINDOW_PASSED"]);
});

/* ---------------- 4. Booking dengan sesi yang sudah ditutup ---------------- */

test("a confirmed booking cannot be cancelled or rescheduled once its session is closed", () => {
  const fn = section("function public.sicare_guard_booking_closed_session", "revoke all on function public.sicare_guard_booking_closed_session");
  assert.match(fn, /old\.status = 'confirmed'\s+and new\.status in \('cancelled', 'reschedule_requested'\)/);
  assert.match(fn, /s\.status in \('ongoing', 'completed', 'missed'\)/);
  assert.match(fn, /'BOOKING_SESSION_CLOSED'/);
  assert.match(migration, /create trigger bookings_guard_closed_session\s+before update of status on public\.bookings/);
  assert.deepEqual(domainCode("BOOKING_SESSION_CLOSED"), [409, "BOOKING_SESSION_CLOSED"]);
});
