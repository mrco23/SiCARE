import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { markExpiredBookings } from "../../src/services/missedSession.service.js";
import { handleDomainRpcError } from "../../src/lib/domainRpc.js";
import { bookingListQuerySchema } from "../../src/validators/booking.validator.js";

const migration = readFileSync(
  new URL("../../../supabase/migrations/20261115140000_sicare_booking_expired_status.sql", import.meta.url),
  "utf8",
);

test("migration adds the expired booking status with a consistent expired_at", () => {
  assert.match(migration, /check \(status in \('waiting_confirmation', 'confirmed', 'rejected', 'reschedule_requested', 'cancelled', 'expired'\)\)/);
  assert.match(migration, /check \(\(status = 'expired'\) = \(expired_at is not null\)\)/);
});

test("only waiting_confirmation bookings whose start time has arrived are expired", () => {
  assert.match(migration, /where b\.status = 'waiting_confirmation'\s+and b\.starts_at <= v_now/);
  assert.match(migration, /where id = v_booking\.id and status = 'waiting_confirmation'/);
  assert.doesNotMatch(migration, /b\.status = 'reschedule_requested'/);
});

test("expiring cancels pending WhatsApp messages and notifies client and counselor", () => {
  assert.match(migration, /update public\.whatsapp_outbox[\s\S]*last_error_code = 'BOOKING_EXPIRED'[\s\S]*status in \('pending', 'queued', 'retry_wait'\)/);
  assert.match(migration, /v_booking\.client_id,\s+'booking\.expired'/);
  assert.match(migration, /v_booking\.counselor_id,\s+'booking\.expired'/);
});

test("guard trigger blocks confirming a booking whose start time has arrived", () => {
  assert.match(migration, /new\.status = 'confirmed'\s+and old\.status is distinct from 'confirmed'\s+and new\.starts_at <= pg_catalog\.now\(\)/);
  assert.match(migration, /message = 'BOOKING_EXPIRED'/);
  assert.match(migration, /before update of status on public\.bookings/);
});

test("mark function is executable by service_role only", () => {
  assert.match(migration, /revoke all on function public\.sicare_mark_expired_bookings\(\) from public, anon, authenticated;/);
  assert.match(migration, /grant execute on function public\.sicare_mark_expired_bookings\(\) to service_role;/);
});

test("markExpiredBookings calls the RPC and returns the count", async () => {
  const calls = [];
  const client = { rpc: async (name) => { calls.push(name); return { data: 3, error: null }; } };
  assert.equal(await markExpiredBookings(client), 3);
  assert.deepEqual(calls, ["sicare_mark_expired_bookings"]);
});

test("BOOKING_EXPIRED from the database maps to HTTP 409", () => {
  assert.throws(
    () => handleDomainRpcError({ message: "BOOKING_EXPIRED" }),
    (error) => error.status === 409 && error.code === "BOOKING_EXPIRED",
  );
});

test("booking list filter accepts the expired status", () => {
  assert.equal(bookingListQuerySchema.safeParse({ status: "expired" }).success, true);
});
