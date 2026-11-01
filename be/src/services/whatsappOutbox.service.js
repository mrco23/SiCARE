import { getSupabaseAdminClient, isSupabaseConfigured } from "../config/supabase.js";
import { formatBookingReference, formatIndonesianDate, formatIndonesianTimeWindow } from "../templates/whatsapp/index.js";

/**
 * Deterministic idempotency key generator for outbox messages.
 * Prevents duplicates from retries, page refreshes, and concurrent events.
 *
 * @param {string} bookingId
 * @param {string} messageType
 * @param {string} recipientUserId
 * @param {string|null} [qualifier=null]
 * @returns {string}
 */
export function generateIdempotencyKey(bookingId, messageType, recipientUserId, qualifier = null) {
  if (!bookingId || !messageType || !recipientUserId) {
    throw new Error("bookingId, messageType, and recipientUserId are required for idempotency key");
  }
  return qualifier
    ? `booking:${bookingId}:${messageType}:${recipientUserId}:${qualifier}`
    : `booking:${bookingId}:${messageType}:${recipientUserId}`;
}

/**
 * Calculates exponential backoff with jitter for retries.
 * Attempt 1: ~60s (1m)
 * Attempt 2: ~300s (5m)
 * Attempt 3: ~900s (15m)
 * Attempt 4: ~3600s (60m)
 *
 * @param {number} attemptCount
 * @returns {number} Delay in milliseconds
 */
export function calculateRetryDelayMs(attemptCount) {
  const delaysSec = [60, 300, 900, 3600];
  const index = Math.min(Math.max(0, attemptCount - 1), delaysSec.length - 1);
  const baseSec = delaysSec[index];
  // Add +/- 15% random jitter to avoid thundering herd
  const jitterFactor = 0.85 + Math.random() * 0.3;
  return Math.round(baseSec * jitterFactor * 1000);
}

function getClient(client) {
  if (client) return client;
  if (!isSupabaseConfigured()) throw new Error("Supabase is not configured");
  return getSupabaseAdminClient();
}

/**
 * Inserts a message into public.whatsapp_outbox idempotently.
 *
 * @param {object} params
 * @param {object} [params.supabaseClient]
 * @param {string} params.bookingId
 * @param {string} params.recipientUserId
 * @param {string} params.messageType
 * @param {Date|string} [params.scheduledAt]
 * @param {object} [params.payload]
 * @param {string|null} [params.phoneE164]
 * @returns {Promise<{ success: boolean, outboxId?: string, skippedDuplicate?: boolean, error?: Error }>}
 */
export async function enqueueOutboxMessage({
  supabaseClient,
  bookingId,
  recipientUserId,
  messageType,
  scheduledAt = new Date(),
  payload = {},
  phoneE164 = null,
  idempotencyKey = null,
  qualifier = null,
}) {
  const supa = getClient(supabaseClient);
  const scheduledIso = new Date(scheduledAt).toISOString();
  const finalIdempotencyKey = idempotencyKey || generateIdempotencyKey(bookingId, messageType, recipientUserId, qualifier);

  const row = {
    booking_id: bookingId,
    recipient_user_id: recipientUserId,
    message_type: messageType,
    scheduled_at: scheduledIso,
    status: "pending",
    idempotency_key: finalIdempotencyKey,
    attempt_count: 0,
    max_attempts: 5,
    payload,
    phone_e164: phoneE164 || null,
    next_attempt_at: scheduledIso,
  };

  try {
    const { data, error } = await supa
      .from("whatsapp_outbox")
      .insert(row)
      .select("id")
      .maybeSingle();

    if (error) {
      // 23505 is PostgreSQL unique constraint violation for idempotency_key
      if (error.code === "23505" || error.message?.includes("idempotency_key")) {
        return { success: true, skippedDuplicate: true };
      }
      return { success: false, error };
    }

    return { success: true, outboxId: data?.id };
  } catch (err) {
    if (err?.code === "23505" || err?.message?.includes("idempotency_key")) {
      return { success: true, skippedDuplicate: true };
    }
    return { success: false, error: err };
  }
}

/**
 * Cancels obsolete reminder jobs for a booking (e.g. when cancelled or rescheduled).
 *
 * @param {string} bookingId
 * @param {object} [supabaseClient]
 * @returns {Promise<number>} Number of cancelled records
 */
export async function cancelObsoleteReminders(bookingId, supabaseClient) {
  if (!bookingId) return 0;
  const supa = getClient(supabaseClient);
  try {
    const { data, error } = await supa
      .from("whatsapp_outbox")
      .update({
        status: "cancelled",
        updated_at: new Date().toISOString(),
      })
      .eq("booking_id", bookingId)
      .in("message_type", ["reminder_h1", "reminder_day_of"])
      .in("status", ["pending", "queued", "retry_wait"])
      .select("id");

    if (error) return 0;
    return data?.length ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Enqueues booking lifecycle event notifications based on the event and recipient matrix.
 *
 * @param {object} params
 * @param {object} [params.supabaseClient]
 * @param {object} params.booking Full booking record with client_id, counselor_id, starts_at, ends_at, etc.
 * @param {string} params.eventType 'booking_created' | 'confirmed' | 'rejected' | 'reschedule_requested' | 'cancelled'
 * @param {string} [params.actorRole] Role of person initiating transition ('client' or 'counselor')
 * @param {string} [params.reason] Reason for cancellation/rejection/reschedule
 * @param {string} [params.sessionFormat] 'online' | 'offline'
 * @param {string} [params.room] Room or meeting URL
 * @param {string} [params.clientName]
 * @param {string} [params.counselorName]
 * @returns {Promise<{ enqueued: number, errors: unknown[] }>}
 */
export async function enqueueBookingNotifications({
  supabaseClient,
  booking,
  eventType,
  actorRole = null,
  reason = null,
  sessionFormat = null,
  room = null,
  clientName = null,
  counselorName = null,
}) {
  const supa = getClient(supabaseClient);
  const results = [];
  const errors = [];

  const basePayload = {
    booking_id: booking.id,
    booking_reference: formatBookingReference(booking.id),
    starts_at: booking.starts_at,
    ends_at: booking.ends_at,
    session_date: formatIndonesianDate(booking.starts_at),
    session_time: formatIndonesianTimeWindow(booking.starts_at, booking.ends_at),
    service_type: booking.service_type,
    client_name: clientName || "Klien",
    counselor_name: counselorName || "Konselor",
    session_format: sessionFormat,
    room,
    reason,
    initiator_role: actorRole,
  };

  if (eventType === "booking_created") {
    // 1. Notify Counselor that a new booking was requested
    const r1 = await enqueueOutboxMessage({
      supabaseClient: supa,
      bookingId: booking.id,
      recipientUserId: booking.counselor_id,
      messageType: "booking_requested",
      payload: { ...basePayload, recipient_name: counselorName || "Konselor" },
    });
    if (r1.success) results.push(r1); else errors.push(r1.error);

    // 2. Notify Client that booking request was received
    const r2 = await enqueueOutboxMessage({
      supabaseClient: supa,
      bookingId: booking.id,
      recipientUserId: booking.client_id,
      messageType: "booking_received",
      payload: { ...basePayload, recipient_name: clientName || "Klien" },
    });
    if (r2.success) results.push(r2); else errors.push(r2.error);
  } else if (eventType === "confirmed") {
    // Notify Client that booking was accepted
    const r = await enqueueOutboxMessage({
      supabaseClient: supa,
      bookingId: booking.id,
      recipientUserId: booking.client_id,
      messageType: "booking_accepted",
      payload: { ...basePayload, recipient_name: clientName || "Klien" },
    });
    if (r.success) results.push(r); else errors.push(r.error);

    // Also enqueue session reminders (H-1 and Day-of) for both parties
    await enqueueSessionReminders({
      supabaseClient: supa,
      booking,
      sessionFormat,
      room,
      clientName,
      counselorName,
    });
  } else if (eventType === "rejected") {
    // Notify Client that booking was rejected
    const r = await enqueueOutboxMessage({
      supabaseClient: supa,
      bookingId: booking.id,
      recipientUserId: booking.client_id,
      messageType: "booking_rejected",
      payload: { ...basePayload, recipient_name: clientName || "Klien" },
    });
    if (r.success) results.push(r); else errors.push(r.error);
  } else if (eventType === "reschedule_requested") {
    // Obsolete reminders must be cancelled
    await cancelObsoleteReminders(booking.id, supa);

    // Recipient is the other party
    const recipientId = actorRole === "counselor" ? booking.client_id : booking.counselor_id;
    const recipientName = actorRole === "counselor" ? (clientName || "Klien") : (counselorName || "Konselor");

    const r = await enqueueOutboxMessage({
      supabaseClient: supa,
      bookingId: booking.id,
      recipientUserId: recipientId,
      messageType: "reschedule_requested",
      payload: { ...basePayload, recipient_name: recipientName },
    });
    if (r.success) results.push(r); else errors.push(r.error);
  } else if (eventType === "cancelled") {
    // Obsolete reminders must be cancelled
    await cancelObsoleteReminders(booking.id, supa);

    // Recipient is the other party
    const recipientId = actorRole === "counselor" ? booking.client_id : booking.counselor_id;
    const recipientName = actorRole === "counselor" ? (clientName || "Klien") : (counselorName || "Konselor");

    const r = await enqueueOutboxMessage({
      supabaseClient: supa,
      bookingId: booking.id,
      recipientUserId: recipientId,
      messageType: "booking_cancelled",
      payload: { ...basePayload, recipient_name: recipientName },
    });
    if (r.success) results.push(r); else errors.push(r.error);
  }

  return { enqueued: results.length, errors };
}

/**
 * Enqueues H-1 and Day-of session reminders for Client and Counselor.
 *
 * @param {object} params
 * @param {object} [params.supabaseClient]
 * @param {object} params.booking
 * @param {string} [params.sessionFormat]
 * @param {string} [params.room]
 * @param {string} [params.clientName]
 * @param {string} [params.counselorName]
 * @returns {Promise<{ enqueued: number }>}
 */
export async function enqueueSessionReminders({
  supabaseClient,
  booking,
  sessionFormat = "offline",
  room = null,
  clientName = null,
  counselorName = null,
}) {
  const supa = getClient(supabaseClient);
  const startsAtMs = new Date(booking.starts_at).getTime();
  const nowMs = Date.now();

  const h1ScheduledAt = new Date(startsAtMs - 24 * 60 * 60 * 1000); // 24 hours before
  const dayOfScheduledAt = new Date(startsAtMs - 60 * 60 * 1000); // 1 hour before

  const recipients = [
    {
      userId: booking.client_id,
      name: clientName || "Klien",
      partnerName: counselorName || "Konselor",
    },
    {
      userId: booking.counselor_id,
      name: counselorName || "Konselor",
      partnerName: clientName || "Klien",
    },
  ];

  let enqueued = 0;

  for (const r of recipients) {
    const reminderPayload = {
      booking_id: booking.id,
      booking_reference: formatBookingReference(booking.id),
      starts_at: booking.starts_at,
      ends_at: booking.ends_at,
      session_date: formatIndonesianDate(booking.starts_at),
      session_time: formatIndonesianTimeWindow(booking.starts_at, booking.ends_at),
      session_format: sessionFormat,
      room,
      recipient_name: r.name,
      partner_name: r.partnerName,
    };

    // H-1 Reminder (only if scheduled time is not more than 1 day in the past)
    if (h1ScheduledAt.getTime() > nowMs - 12 * 60 * 60 * 1000) {
      const resH1 = await enqueueOutboxMessage({
        supabaseClient: supa,
        bookingId: booking.id,
        recipientUserId: r.userId,
        messageType: "reminder_h1",
        scheduledAt: h1ScheduledAt,
        payload: reminderPayload,
        qualifier: String(booking.starts_at),
      });
      if (resH1.success) enqueued++;
    }

    // Day-of / 1 Hour Reminder
    if (dayOfScheduledAt.getTime() > nowMs - 30 * 60 * 1000) {
      const resDayOf = await enqueueOutboxMessage({
        supabaseClient: supa,
        bookingId: booking.id,
        recipientUserId: r.userId,
        messageType: "reminder_day_of",
        scheduledAt: dayOfScheduledAt,
        payload: reminderPayload,
        qualifier: String(booking.starts_at),
      });
      if (resDayOf.success) enqueued++;
    }
  }

  return { enqueued };
}
