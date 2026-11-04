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

export const bookingService = {
  async listBookings({ authUser, authRole, status, limit }) {
    const client = getClient();
    return bookingRepository.list(client, {
      userId: authUser.id,
      role: authRole,
      status,
      limit,
    });
  },

  async getBookingDetail({ authProfile, bookingId }) {
    const client = getClient();
    return bookingRepository.findById(client, bookingId, authProfile);
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
      metadata: { status: "waiting_confirmation", role: "client" },
    });

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

