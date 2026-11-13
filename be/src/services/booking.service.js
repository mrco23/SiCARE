import { getSupabaseAdminClient, isSupabaseConfigured } from "../config/supabase.js";
import { HttpError } from "../lib/http.js";
import { callDomainRpc } from "../lib/domainRpc.js";
import { writeAudit } from "../lib/audit.js";
import { bookingRepository } from "../repositories/booking.repository.js";
import {
  getGroupConsentSummary,
  initializeGroupConsentInvitations,
} from "./consent.service.js";

function getClient() {
  if (!isSupabaseConfigured()) {
    throw new HttpError(503, "SUPABASE_NOT_CONFIGURED", "Supabase belum dikonfigurasi pada backend.");
  }
  return getSupabaseAdminClient();
}

/**
 * Attaches `intake_answers` to each booking, but only for the counselor who owns it
 * (SOP decision, 2026-11-13). Clients never get their own intake echoed back here;
 * bookingRepository already filtered these bookings to counselor_id = authProfile.id,
 * so no extra ownership check is needed before reading booking_intakes.
 *
 * Fails open: if the lookup errors (e.g. migration 20261113130000 not applied yet, so
 * booking_intakes doesn't exist in this environment), bookings/sessions must still load.
 * `intake_answers` is simply left unset for every booking in that case, same as it would
 * be for a client's own request.
 */
export async function attachIntakeAnswersForCounselor(client, authProfile, bookings) {
  if (authProfile.app_role !== "counselor") return bookings;
  const list = Array.isArray(bookings) ? bookings : [bookings];
  const bookingIds = list.filter(Boolean).map((b) => b.id);
  try {
    const answersByBookingId = await bookingRepository.findIntakeAnswersByBookingIds(client, bookingIds);
    for (const booking of list) {
      if (booking) booking.intake_answers = answersByBookingId.get(booking.id) ?? null;
    }
  } catch (intakeError) {
    console.warn("Gagal membaca jawaban formulir klien untuk booking:", intakeError?.message);
  }
  return bookings;
}

export const bookingService = {
  async listBookings({ authUser, authProfile, authRole, status, limit }) {
    const client = getClient();
    const bookings = await bookingRepository.list(client, {
      userId: authUser.id,
      role: authRole,
      status,
      limit,
    });
    return attachIntakeAnswersForCounselor(client, authProfile, bookings);
  },

  async getBookingDetail({ authProfile, bookingId }) {
    const client = getClient();
    const booking = await bookingRepository.findById(client, bookingId, authProfile);
    await attachIntakeAnswersForCounselor(client, authProfile, booking);
    return booking;
  },

  async createBooking({ authUser, authProfile, input }) {
    const client = getClient();
    const bookingId = await callDomainRpc(
      client,
      "sicare_create_booking",
      {
        p_client_id: authUser.id,
        p_counselor_id: input.counselor_id,
        p_slot_id: input.availability_slot_id,
        p_service_type: input.service_type,
        p_group_name: input.group_name ?? null,
        p_participants: input.participants,
      },
      "Booking tidak dapat dibuat.",
    );

    await writeAudit({
      actorUserId: authUser.id,
      action: "booking.create",
      entityType: "booking",
      entityId: bookingId,
      // Never copy intake content into audit metadata (AGENTS.md sec. 3) — count only.
      metadata: {
        status: "waiting_confirmation",
        role: "client",
        has_intake_answers: Boolean(input.intake_answers),
      },
    });

    if (input.intake_answers) {
      try {
        await bookingRepository.saveIntakeAnswers(client, {
          bookingId,
          clientId: authUser.id,
          answers: input.intake_answers,
        });
      } catch (intakeError) {
        // The booking itself already succeeded and its slot is already consumed; failing
        // the whole request here would make the client re-submit into a slot that no
        // longer exists. Log and continue — the counselor simply won't see the form.
        console.warn("Gagal menyimpan jawaban formulir klien untuk booking:", intakeError?.message);
      }
    }

    return bookingRepository.findById(client, bookingId, authProfile);
  },

  async rescheduleBooking({ authUser, authProfile, bookingId, availabilitySlotId }) {
    const client = getClient();
    await callDomainRpc(
      client,
      "sicare_reschedule_booking",
      {
        p_client_id: authUser.id,
        p_booking_id: bookingId,
        p_slot_id: availabilitySlotId,
      },
      "Penjadwalan ulang tidak dapat diajukan.",
    );

    await writeAudit({
      actorUserId: authUser.id,
      action: "booking.reschedule",
      entityType: "booking",
      entityId: bookingId,
      metadata: { status: "waiting_confirmation", role: "client" },
    });

    return bookingRepository.findById(client, bookingId, authProfile);
  },

  async transitionBooking({ authUser, authProfile, bookingId, input }) {
    if (authProfile.app_role === "client" && input.status !== "cancelled") {
      throw new HttpError(403, "BOOKING_FORBIDDEN", "Klien hanya dapat membatalkan booking miliknya.");
    }
    if (authProfile.app_role === "counselor" && input.status === "cancelled") {
      throw new HttpError(403, "BOOKING_FORBIDDEN", "Gunakan alur status konselor untuk menolak atau meminta penjadwalan ulang.");
    }

    const client = getClient();
    await callDomainRpc(
      client,
      "sicare_transition_booking",
      {
        p_actor_id: authUser.id,
        p_booking_id: bookingId,
        p_target_status: input.status,
        p_reason: input.reason ?? null,
        p_session_format: input.session_format ?? null,
        p_room: input.room ?? null,
      },
      "Status booking tidak dapat diperbarui.",
    );

    if (input.status === "confirmed") {
      try {
        await initializeGroupConsentInvitations({ supabaseClient: client, bookingId });
      } catch (inviteError) {
        console.warn("Gagal inisialisasi undangan informed consent booking:", inviteError?.message);
      }
    }

    await writeAudit({
      actorUserId: authUser.id,
      action: "booking.status",
      entityType: "booking",
      entityId: bookingId,
      metadata: { status: input.status, role: authProfile.app_role },
    });

    return bookingRepository.findById(client, bookingId, authProfile);
  },

  async getConsentSummary({ authUser, authRole, bookingId }) {
    const client = getClient();
    return getGroupConsentSummary({
      supabaseClient: client,
      bookingId,
      authUser,
      authRole,
    });
  },
};

