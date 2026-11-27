import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  REBOOK_WINDOW_DAYS,
  rebookIneligibleReason,
  rebookParticipants,
} from "../../src/services/booking.service.js";
import { rebookBookingSchema } from "../../src/validators/booking.validator.js";
import { writeAudit } from "../../src/lib/audit.js";

const NOW = Date.parse("2026-11-28T03:00:00Z");
const daysAgo = (days) => new Date(NOW - days * 86_400_000).toISOString();

test("rebook is allowed for cancelled, rejected, and expired bookings within the window", () => {
  for (const status of ["cancelled", "rejected", "expired"]) {
    assert.equal(rebookIneligibleReason({ status, starts_at: daysAgo(3), counseling_sessions: null }, NOW), null, status);
  }
  // Dibatalkan konselor: sesi berstatus cancelled tetap boleh.
  assert.equal(
    rebookIneligibleReason({ status: "cancelled", starts_at: daysAgo(1), counseling_sessions: { status: "cancelled" } }, NOW),
    null,
  );
});

test("rebook is allowed for a confirmed booking whose session was missed", () => {
  assert.equal(
    rebookIneligibleReason({ status: "confirmed", starts_at: daysAgo(2), counseling_sessions: [{ status: "missed" }] }, NOW),
    null,
  );
});

test("rebook is refused for active bookings and sessions that already ran", () => {
  for (const status of ["waiting_confirmation", "confirmed", "reschedule_requested"]) {
    const reason = rebookIneligibleReason({ status, starts_at: daysAgo(1), counseling_sessions: { status: "scheduled" } }, NOW);
    assert.equal(reason?.code, "BOOKING_REBOOK_NOT_ALLOWED", status);
  }
  for (const sessionStatus of ["ongoing", "completed"]) {
    const reason = rebookIneligibleReason({ status: "cancelled", starts_at: daysAgo(1), counseling_sessions: { status: sessionStatus } }, NOW);
    assert.equal(reason?.code, "BOOKING_REBOOK_NOT_ALLOWED", sessionStatus);
  }
});

test("rebook is refused after the window", () => {
  const reason = rebookIneligibleReason({ status: "rejected", starts_at: daysAgo(REBOOK_WINDOW_DAYS + 1) }, NOW);
  assert.equal(reason?.code, "BOOKING_REBOOK_WINDOW_PASSED");
  assert.equal(rebookIneligibleReason({ status: "rejected", starts_at: daysAgo(REBOOK_WINDOW_DAYS - 1) }, NOW), null);
});

test("rebookParticipants copies active group members and keeps the representative", () => {
  const participants = rebookParticipants({
    service_type: "group",
    booking_participants: [
      { display_name: "Perwakilan", full_name: "Perwakilan Lengkap", phone_e164: "+6281200000001", is_representative: true, participant_status: "registered" },
      { display_name: "Anggota A", full_name: null, phone_e164: "+6281200000002", is_representative: false, participant_status: "confirmed" },
      { display_name: "Keluar", full_name: "Keluar", phone_e164: "+6281200000003", is_representative: false, participant_status: "removed" },
    ],
  });
  assert.deepEqual(participants, [
    { display_name: "Perwakilan", full_name: "Perwakilan Lengkap", phone_e164: "+6281200000001", is_representative: true },
    { display_name: "Anggota A", full_name: "Anggota A", phone_e164: "+6281200000002", is_representative: false },
  ]);
  assert.deepEqual(rebookParticipants({ service_type: "individual", booking_participants: [{ display_name: "X" }] }), []);
});

test("rebookBookingSchema only accepts a slot id", () => {
  assert.equal(rebookBookingSchema.safeParse({ availability_slot_id: "4b8f3c1e-2d5a-4c6b-9e7f-1a2b3c4d5e6f" }).success, true);
  assert.equal(rebookBookingSchema.safeParse({}).success, false);
  assert.equal(
    rebookBookingSchema.safeParse({ availability_slot_id: "4b8f3c1e-2d5a-4c6b-9e7f-1a2b3c4d5e6f", intake_answers: {} }).success,
    false,
  );
});

test("booking.rebook audit keeps source_booking_id and drops other metadata", async () => {
  let inserted = null;
  const fakeClient = {
    from(table) {
      assert.equal(table, "audit_events");
      return {
        insert(row) {
          inserted = row;
          return Promise.resolve({ error: null });
        },
      };
    },
  };
  await writeAudit(
    {
      actorUserId: "user-1",
      action: "booking.rebook",
      entityType: "booking",
      entityId: "new-booking",
      metadata: { status: "waiting_confirmation", source_booking_id: "old-booking", complaint: "rahasia" },
    },
    fakeClient,
  );
  assert.equal(inserted?.action, "booking.rebook");
  assert.equal(inserted?.metadata?.source_booking_id, "old-booking");
  assert.equal(inserted?.metadata?.complaint, undefined);
});

test("rebook route is registered for clients only", () => {
  const source = readFileSync(new URL("../../src/routes/booking.routes.js", import.meta.url), "utf8");
  assert.match(source, /router\.post\("\/:id\/rebook", authenticate, allowRoles\("client"\)/);
});
