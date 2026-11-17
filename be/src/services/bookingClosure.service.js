// @ts-check
import { getSupabaseAdminClient } from "../config/supabase.js";
import { enqueueBookingNotifications } from "./whatsappOutbox.service.js";

const ACTIVE_BOOKING_STATUSES = ["waiting_confirmation", "confirmed", "reschedule_requested"];
const OPEN_OUTBOX_STATUSES = ["pending", "queued", "retry_wait"];
const OBSOLETE_MESSAGE_TYPES = [
  "reminder_h1",
  "reminder_morning",
  "reminder_day_of",
  "consent_invitation",
  "consent_reminder",
];

/**
 * Side effects after a booking is cancelled by the system or a counselor:
 * cancel queued reminders/consent messages, revoke open consent invitations, and queue a
 * WhatsApp cancellation notice for the other party. Each step is best effort (the booking
 * itself is already cancelled); failures are returned so callers can log them.
 *
 * @param {object} params
 * @param {any} [params.supabaseClient]
 * @param {{ id: string, client_id: string, counselor_id: string, starts_at?: string, ends_at?: string, service_type?: string }} params.booking
 * @param {"counselor" | "client"} params.actorRole Party that cancelled; the other party is notified.
 * @param {string | null} [params.reason]
 * @param {string | null} [params.actorUserId]
 * @returns {Promise<{ errors: string[] }>}
 */
export async function applyBookingClosureSideEffects({
  supabaseClient,
  booking,
  actorRole,
  reason = null,
  actorUserId = null,
}) {
  const supa = supabaseClient ?? getSupabaseAdminClient();
  const errors = [];
  const nowIso = new Date().toISOString();

  const { error: outboxError } = await supa
    .from("whatsapp_outbox")
    .update({ status: "cancelled", updated_at: nowIso })
    .eq("booking_id", booking.id)
    .in("message_type", OBSOLETE_MESSAGE_TYPES)
    .in("status", OPEN_OUTBOX_STATUSES);
  if (outboxError) errors.push("outbox_cancel_failed");

  const { data: participants, error: participantError } = await supa
    .from("booking_participants")
    .select("id")
    .eq("booking_id", booking.id);
  if (participantError) {
    errors.push("participants_lookup_failed");
  } else if (participants?.length) {
    const { error: revokeError } = await supa
      .from("consent_invitations")
      .update({ status: "revoked", revoked_at: nowIso, revoked_by: actorUserId, updated_at: nowIso })
      .in("booking_participant_id", participants.map((participant) => participant.id))
      .in("status", ["pending", "sent", "claimed"]);
    if (revokeError) errors.push("invitation_revoke_failed");
  }

  const { data: names } = await supa
    .from("profiles")
    .select("id,full_name")
    .in("id", [booking.client_id, booking.counselor_id]);
  const nameOf = (id) => names?.find((row) => row.id === id)?.full_name ?? null;

  try {
    const result = await enqueueBookingNotifications({
      supabaseClient: supa,
      booking,
      eventType: "cancelled",
      actorRole,
      reason: reason ?? undefined,
      clientName: nameOf(booking.client_id) ?? undefined,
      counselorName: nameOf(booking.counselor_id) ?? undefined,
    });
    if (result.errors.length) errors.push("whatsapp_enqueue_failed");
  } catch {
    errors.push("whatsapp_enqueue_failed");
  }

  return { errors };
}

/**
 * Cancels every active, not-yet-started booking of an account that can no longer take part
 * (deactivated, or a counselor whose role changed). Sessions already ongoing are left alone:
 * the counselor or the automatic closing handles them.
 *
 * @param {object} params
 * @param {any} [params.supabaseClient]
 * @param {string} params.profileId
 * @param {"counselor" | "client"} params.side Which column of bookings the profile occupies.
 * @param {string} params.reason Cancellation reason shown to the other party.
 * @param {string | null} [params.actorUserId]
 * @returns {Promise<{ cancelled: number, skipped: number, errors: string[] }>}
 */
export async function cancelActiveBookingsForProfile({
  supabaseClient,
  profileId,
  side,
  reason,
  actorUserId = null,
}) {
  const supa = supabaseClient ?? getSupabaseAdminClient();
  const column = side === "counselor" ? "counselor_id" : "client_id";
  const errors = [];

  const { data: bookings, error } = await supa
    .from("bookings")
    .select("id,client_id,counselor_id,starts_at,ends_at,service_type,status")
    .eq(column, profileId)
    .in("status", ACTIVE_BOOKING_STATUSES);
  if (error) return { cancelled: 0, skipped: 0, errors: ["bookings_lookup_failed"] };
  if (!bookings?.length) return { cancelled: 0, skipped: 0, errors };

  const { data: sessions } = await supa
    .from("counseling_sessions")
    .select("booking_id,status")
    .in("booking_id", bookings.map((booking) => booking.id));
  const sessionStatus = new Map((sessions ?? []).map((row) => [row.booking_id, row.status]));

  let cancelled = 0;
  let skipped = 0;
  for (const booking of bookings) {
    if (["ongoing", "completed", "missed"].includes(sessionStatus.get(booking.id) ?? "")) {
      skipped += 1;
      continue;
    }

    const { error: sessionError } = await supa
      .from("counseling_sessions")
      .update({ status: "cancelled" })
      .eq("booking_id", booking.id)
      .eq("status", "scheduled");
    if (sessionError) {
      errors.push("session_cancel_failed");
      skipped += 1;
      continue;
    }

    const { error: bookingError } = await supa
      .from("bookings")
      .update({ status: "cancelled", cancellation_reason: reason })
      .eq("id", booking.id)
      .in("status", ACTIVE_BOOKING_STATUSES);
    if (bookingError) {
      errors.push("booking_cancel_failed");
      skipped += 1;
      continue;
    }
    cancelled += 1;

    const otherParty = side === "counselor" ? booking.client_id : booking.counselor_id;
    const { error: notifyError } = await supa.from("notifications").insert({
      recipient_user_id: otherParty,
      type: "booking.cancelled",
      title: "Booking konseling dibatalkan",
      body: reason,
      entity_type: "booking",
      entity_id: booking.id,
    });
    if (notifyError) errors.push("notification_failed");

    const sideEffects = await applyBookingClosureSideEffects({
      supabaseClient: supa,
      booking,
      actorRole: side,
      reason,
      actorUserId,
    });
    errors.push(...sideEffects.errors);
  }

  return { cancelled, skipped, errors };
}
