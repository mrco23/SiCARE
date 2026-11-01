import { getSupabaseAdminClient, isSupabaseConfigured } from "../config/supabase.js";
import {
  cancelObsoleteReminders,
  enqueueSessionReminders,
} from "../services/whatsappOutbox.service.js";

/**
 * Scans upcoming scheduled counseling sessions and enqueues H-1 and Day-of reminders.
 * Completely idempotent: running repeatedly produces no duplicate outbox records.
 *
 * @param {object} [options]
 * @param {object} [options.supabaseClient]
 * @param {number} [options.lookaheadDays=7]
 * @returns {Promise<{ scannedSessions: number, enqueuedReminders: number, cleanedReminders: number }>}
 */
export async function scanUpcomingSessionsAndEnqueueReminders(options = {}) {
  const supa = options.supabaseClient || getSupabaseAdminClient();
  const lookaheadDays = options.lookaheadDays || 7;
  const now = new Date();
  const maxDate = new Date(now.getTime() + lookaheadDays * 24 * 60 * 60 * 1000);

  // 1. Fetch upcoming scheduled sessions
  const { data: sessions, error: sessionError } = await supa
    .from("counseling_sessions")
    .select("id,booking_id,counselor_id,starts_at,ends_at,status,format,room,bookings(id,client_id,counselor_id,status,service_type,starts_at,ends_at)")
    .eq("status", "scheduled")
    .gte("starts_at", now.toISOString())
    .lte("starts_at", maxDate.toISOString())
    .order("starts_at", { ascending: true });

  if (sessionError || !sessions || sessions.length === 0) {
    return { scannedSessions: 0, enqueuedReminders: 0, cleanedReminders: 0 };
  }

  let totalEnqueued = 0;
  let totalCleaned = 0;

  for (const session of sessions) {
    const booking = session.bookings;
    if (!booking) continue;

    // Safety gate: If booking is cancelled or reschedule_requested, cancel any reminders
    if (booking.status !== "confirmed") {
      const cleaned = await cancelObsoleteReminders(booking.id, supa);
      totalCleaned += cleaned;
      continue;
    }

    // Load profile names for friendly notification
    const { data: clientProf } = await supa
      .from("profiles")
      .select("full_name")
      .eq("id", booking.client_id)
      .maybeSingle();

    const { data: counselorProf } = await supa
      .from("counselor_profiles")
      .select("public_name")
      .eq("profile_id", booking.counselor_id)
      .maybeSingle();

    const result = await enqueueSessionReminders({
      supabaseClient: supa,
      booking: {
        id: booking.id,
        client_id: booking.client_id,
        counselor_id: booking.counselor_id,
        starts_at: session.starts_at || booking.starts_at,
        ends_at: session.ends_at || booking.ends_at,
      },
      sessionFormat: session.format,
      room: session.room,
      clientName: clientProf?.full_name || "Klien",
      counselorName: counselorProf?.public_name || "Konselor",
    });

    totalEnqueued += result.enqueued;
  }

  return {
    scannedSessions: sessions.length,
    enqueuedReminders: totalEnqueued,
    cleanedReminders: totalCleaned,
  };
}

/**
 * Scans eligible pending informed consent invitations and enqueues reminders.
 * Idempotent: repeated runs never duplicate reminders for the same interval.
 *
 * @param {object} [options]
 * @param {object} [options.supabaseClient]
 * @param {number} [options.firstReminderHours=24]
 * @param {number} [options.secondReminderHours=72]
 * @param {number} [options.maxReminders=2]
 * @returns {Promise<{ scannedInvitations: number, enqueuedReminders: number }>}
 */
export async function scanPendingConsentsAndEnqueueReminders(options = {}) {
  const supa = options.supabaseClient || getSupabaseAdminClient();
  const firstDelayHours = options.firstReminderHours ?? 24;
  const secondDelayHours = options.secondReminderHours ?? 72;
  const maxReminders = options.maxReminders ?? 2;
  const now = new Date();

  // 1. Fetch active invitations with participant, booking, and consent status
  const { data: invitations, error: invError } = await supa
    .from("consent_invitations")
    .select(`
      id,
      booking_participant_id,
      consent_id,
      recipient_phone_e164,
      status,
      created_at,
      expires_at,
      booking_participants (
        id,
        booking_id,
        user_id,
        display_name,
        full_name,
        phone_e164,
        participant_status,
        bookings (
          id,
          status,
          service_type,
          client_id,
          counselor_id,
          starts_at,
          ends_at
        ),
        informed_consents (
          id,
          status
        )
      )
    `)
    .in("status", ["pending", "sent"])
    .gt("expires_at", now.toISOString());

  if (invError || !invitations || invitations.length === 0) {
    return { scannedInvitations: 0, enqueuedReminders: 0 };
  }

  let totalEnqueued = 0;

  for (const inv of invitations) {
    const part = inv.booking_participants;
    if (!part || part.participant_status === "removed") continue;

    const booking = part.bookings;
    // 1. Booking must be confirmed and active
    if (!booking || booking.status !== "confirmed") continue;

    // 2. Consent must not be signed or revoked
    const consent = part.informed_consents?.[0];
    if (!consent || consent.status === "signed" || consent.status === "revoked") continue;

    // 3. Calculate interval eligibility based on elapsed time since invitation creation
    const createdAt = new Date(inv.created_at);
    const elapsedHours = (now.getTime() - createdAt.getTime()) / (3600 * 1000);

    let eligibleInterval = null;
    if (elapsedHours >= firstDelayHours && elapsedHours < secondDelayHours) {
      eligibleInterval = 1;
    } else if (elapsedHours >= secondDelayHours && maxReminders >= 2) {
      eligibleInterval = 2;
    }

    if (!eligibleInterval) continue;

    const idempotencyKey = `invitation:${inv.id}:consent_reminder:interval_${eligibleInterval}`;
    const targetPhone = inv.recipient_phone_e164 || part.phone_e164;
    if (!targetPhone) continue;

    // Load counselor name for friendly reminder text
    const { data: counselorProf } = await supa
      .from("counselor_profiles")
      .select("public_name")
      .eq("profile_id", booking.counselor_id)
      .maybeSingle();

    const row = {
      booking_id: booking.id,
      booking_participant_id: part.id,
      recipient_user_id: part.user_id || null,
      phone_e164: targetPhone,
      message_type: "consent_reminder",
      scheduled_at: now.toISOString(),
      status: "pending",
      idempotency_key: idempotencyKey,
      attempt_count: 0,
      max_attempts: 5,
      payload: {
        invitation_id: inv.id,
        booking_id: booking.id,
        booking_participant_id: part.id,
        recipient_name: part.full_name || part.display_name,
        counselor_name: counselorProf?.public_name || "Konselor",
        reminder_interval: eligibleInterval,
      },
      next_attempt_at: now.toISOString(),
    };

    try {
      const { data: inserted, error: insertError } = await supa
        .from("whatsapp_outbox")
        .insert(row)
        .select("id")
        .maybeSingle();

      if (!insertError && inserted) {
        totalEnqueued++;
      }
    } catch {
      // Duplicate idempotency constraint 23505 ignored safely
    }
  }

  return {
    scannedInvitations: invitations.length,
    enqueuedReminders: totalEnqueued,
  };
}

/**
 * Runs a single pass of the reminder scheduler.
 */
export async function runSchedulerPass(options = {}) {
  try {
    const sessionRes = await scanUpcomingSessionsAndEnqueueReminders(options);
    const consentRes = await scanPendingConsentsAndEnqueueReminders(options);
    return {
      scannedSessions: sessionRes.scannedSessions,
      enqueuedReminders: sessionRes.enqueuedReminders,
      cleanedReminders: sessionRes.cleanedReminders,
      scannedInvitations: consentRes.scannedInvitations,
      enqueuedConsentReminders: consentRes.enqueuedReminders,
    };
  } catch (err) {
    console.error("[WhatsApp Scheduler] Error running reminder scheduler pass:", err);
    throw err;
  }
}

// Standalone execution support
if (process.argv[1] && process.argv[1].endsWith("whatsapp.scheduler.js")) {
  const isOnce = process.argv.includes("--once");
  console.log(`[WhatsApp Scheduler] Memulai reminder scheduler (pid: ${process.pid}, once: ${isOnce})...`);

  async function loop() {
    try {
      const result = await runSchedulerPass();
      console.log(`[WhatsApp Scheduler] Pemindaian selesai: ${result.scannedSessions} sesi diperiksa, ${result.enqueuedReminders} pengingat dijadwalkan, ${result.cleanedReminders} pengingat usang dibatalkan.`);
    } catch (err) {
      console.error("[WhatsApp Scheduler] Error saat menjalankan jadwal pengingat:", err);
    }

    if (!isOnce) {
      // Run every 10 minutes in daemon mode
      setTimeout(loop, 10 * 60 * 1000);
    }
  }

  loop();
}
