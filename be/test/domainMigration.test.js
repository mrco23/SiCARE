import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const migration = readFileSync(
  new URL("../../supabase/migrations/20261028120000_sicare_public_availability_rescheduling.sql", import.meta.url),
  "utf8",
);
const domainRoutes = readFileSync(new URL("../src/routes/domain.routes.js", import.meta.url), "utf8");
const bookingRoutes = readFileSync(new URL("../src/routes/booking.routes.js", import.meta.url), "utf8");

function functionBody(sql, functionName, nextMarker) {
  const start = sql.indexOf(`create or replace function public.${functionName}`);
  assert.notEqual(start, -1, `Missing function ${functionName}`);
  const end = sql.indexOf(nextMarker, start);
  assert.notEqual(end, -1, `Missing end marker for ${functionName}`);
  return sql.slice(start, end);
}

test("public availability filters unpublished periods and overlapping active bookings before LIMIT", () => {
  const body = functionBody(
    migration,
    "sicare_public_availability",
    "revoke all on function public.sicare_public_availability",
  );
  assert.match(body, /ap\.is_published\s*=\s*true/);
  assert.match(body, /s\.starts_at::date between ap\.starts_on and ap\.ends_on/);
  assert.match(body, /b\.status in \('waiting_confirmation', 'confirmed', 'reschedule_requested'\)/);
  assert.match(body, /b\.starts_at < s\.ends_at\s+and b\.ends_at > s\.starts_at/);
  assert.match(body, /p\.account_status\s*=\s*'active'/);
  assert.match(body, /cp\.is_public\s*=\s*true/);
});

test("public API calls the database availability policy and limits public feedback to eligible counselors", () => {
  assert.match(domainRoutes, /rpc\("sicare_public_availability"/);
  assert.match(domainRoutes, /profile\.public_name\.trim\(\)\.length > 0/);
  assert.match(domainRoutes, /\.eq\("moderation_status", "shown"\)\s*\.in\("counselor_id", publicIds\)/);
});

test("rescheduling migration stores a reason and accepts only an eligible client's replacement slot", () => {
  assert.match(migration, /add column if not exists reschedule_reason text/);
  const body = functionBody(
    migration,
    "sicare_reschedule_booking",
    "revoke all on function public.sicare_reschedule_booking",
  );
  assert.match(body, /v_booking\.status <> 'reschedule_requested'/);
  assert.match(body, /v_booking\.client_id <> p_client_id/);
  assert.match(body, /v_slot\.id = v_booking\.availability_slot_id/);
  assert.match(body, /v_slot\.academic_period_id/);
  assert.match(body, /b\.id <> v_booking\.id/);
  assert.match(body, /b\.starts_at < v_slot\.ends_at\s+and b\.ends_at > v_slot\.starts_at/);
  assert.match(body, /status = 'waiting_confirmation'/);
});

test("booking transition saves reschedule reason and reuses a cancelled session when confirming a replacement slot", () => {
  const body = functionBody(
    migration,
    "sicare_transition_booking",
    "revoke all on function public.sicare_transition_booking",
  );
  assert.match(body, /reschedule_reason = case[\s\S]*when p_target_status = 'reschedule_requested' then nullif\(pg_catalog\.btrim\(p_reason\), ''\)/);
  assert.match(body, /if v_session\.status <> 'cancelled' then/);
  assert.match(body, /status = 'scheduled',[\s\S]*started_at = null,[\s\S]*completed_at = null/);
  assert.match(body, /p_target_status = 'reschedule_requested'[\s\S]*v_booking\.status not in \('waiting_confirmation', 'confirmed'\)/);
});

test("client reschedule API requires authentication and delegates the state transition to SQL", () => {
  assert.match(bookingRoutes, /router\.patch\("\/:id\/reschedule", authenticate, allowRoles\("client"\)/);
  assert.match(bookingRoutes, /callDomainRpc\(supa\(\), "sicare_reschedule_booking"/);
  assert.match(bookingRoutes, /action: "booking\.reschedule"/);
  assert.match(bookingRoutes, /reschedule_reason/);
  assert.match(bookingRoutes, /\["cancelled", "rejected", "reschedule_requested"\]\.includes\(input\.status\)/);
});
