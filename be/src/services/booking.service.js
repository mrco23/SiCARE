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
    throw new HttpError(503, "SUPABASE_NOT_CONFIGURED", "Supabase belum dikonfigurasi pada server.");
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

/** Booking terkonfirmasi hanya dapat dibatalkan klien paling lambat sekian jam sebelum mulai. */
export const CLIENT_CANCEL_CUTOFF_HOURS = 2;

/**
 * @param {{ status: string, starts_at: string }} booking
 * @param {number} nowMs
 */
export function isPastClientCancelCutoff(booking, nowMs) {
  if (booking.status !== "confirmed") return false;
  return Date.parse(booking.starts_at) - nowMs < CLIENT_CANCEL_CUTOFF_HOURS * 3_600_000;
}

/** "Ajukan jadwal baru" hanya untuk booking yang jadwalnya dalam sekian hari terakhir. */
export const REBOOK_WINDOW_DAYS = 30;

function sessionStatusOf(booking) {
  const sessions = booking?.counseling_sessions;
  const session = Array.isArray(sessions) ? sessions[0] : sessions;
  return session?.status ?? null;
}

/**
 * Alasan booking asal tidak dapat diajukan ulang, atau null bila boleh. Boleh untuk booking
 * dibatalkan/ditolak/kedaluwarsa, atau terkonfirmasi yang sesinya terlewat, selama sesinya belum
 * pernah berjalan dan jadwalnya tidak lebih dari REBOOK_WINDOW_DAYS hari lalu.
 *
 * @param {{ status: string, starts_at: string, counseling_sessions?: unknown }} source
 * @param {number} nowMs
 * @returns {{ code: string, message: string } | null}
 */
export function rebookIneligibleReason(source, nowMs) {
  const sessionStatus = sessionStatusOf(source);
  if (sessionStatus === "ongoing" || sessionStatus === "completed") {
    return { code: "BOOKING_REBOOK_NOT_ALLOWED", message: "Sesi ini sudah berjalan sehingga tidak dapat diajukan ulang." };
  }
  const closed = ["cancelled", "rejected", "expired"].includes(source.status)
    || (source.status === "confirmed" && sessionStatus === "missed");
  if (!closed) {
    return { code: "BOOKING_REBOOK_NOT_ALLOWED", message: "Hanya permintaan yang dibatalkan, ditolak, kedaluwarsa, atau terlewat yang dapat diajukan ulang." };
  }
  if (nowMs - Date.parse(source.starts_at) > REBOOK_WINDOW_DAYS * 86_400_000) {
    return {
      code: "BOOKING_REBOOK_WINDOW_PASSED",
      message: `Pengajuan ulang hanya untuk jadwal dalam ${REBOOK_WINDOW_DAYS} hari terakhir. Silakan isi permintaan baru.`,
    };
  }
  return null;
}

/** Anggota kelompok booking asal dalam format p_participants sicare_create_booking. */
export function rebookParticipants(source) {
  if (source.service_type !== "group") return [];
  return (source.booking_participants ?? [])
    .filter((participant) => participant.participant_status !== "removed")
    .map((participant) => ({
      display_name: participant.display_name,
      full_name: participant.full_name ?? participant.display_name,
      phone_e164: participant.phone_e164 ?? null,
      is_representative: participant.is_representative === true,
    }));
}

export const bookingService = {
  async listBookings({ authUser, authProfile, authRole, status, limit, offset }) {
    const client = getClient();
    // Penanda otomatis dijalankan cron worker tiap menit (internal/worker-run), tidak lagi
    // menahan respons daftar: tiap panggilan RPC menambah waktu tunggu halaman.
    const bookings = await bookingRepository.list(client, {
      userId: authUser.id,
      role: authRole,
      status,
      limit,
      offset,
    });
    if (authRole === "client") {
      // Tandai booking yang sudah diajukan ulang agar kartu "Perlu jadwal baru" tidak muncul lagi.
      // Gagal baca tidak memblokir daftar (server tetap menolak pengajuan ganda).
      try {
        const rebooked = await bookingRepository.findRebookedMap(client, authUser.id);
        for (const booking of bookings) booking.rebooked_booking_id = rebooked.get(booking.id) ?? null;
      } catch (rebookError) {
        console.warn("Gagal membaca riwayat pengajuan ulang booking:", rebookError?.message);
      }
    }
    return attachIntakeAnswersForCounselor(client, authProfile, bookings);
  },

  /**
   * "Ajukan jadwal baru" (2026-11-28): booking baru dengan konselor yang sama memakai
   * sicare_create_booking (aturan slot, periode, bentrok, dan batas 2 booking aktif tetap berlaku),
   * lalu menyalin jawaban form awal. Booking asal tidak diubah.
   */
  async rebookBooking({ authUser, authProfile, sourceBookingId, availabilitySlotId }) {
    const client = getClient();
    const source = await bookingRepository.findRebookSource(client, sourceBookingId, authUser.id);
    if (!source) throw new HttpError(404, "BOOKING_NOT_FOUND", "Booking tidak ditemukan.");

    const ineligible = rebookIneligibleReason(source, Date.now());
    if (ineligible) throw new HttpError(409, ineligible.code, ineligible.message);

    const rebooked = await bookingRepository.findRebookedMap(client, authUser.id);
    if (rebooked.has(source.id)) {
      throw new HttpError(409, "BOOKING_ALREADY_REBOOKED", "Permintaan ini sudah diajukan ulang. Lihat jadwal barunya di Aktivitas.");
    }

    const bookingId = await callDomainRpc(
      client,
      "sicare_create_booking",
      {
        p_client_id: authUser.id,
        p_counselor_id: source.counselor_id,
        p_slot_id: availabilitySlotId,
        p_service_type: source.service_type,
        p_group_name: source.service_type === "group" ? source.group_name : null,
        p_participants: rebookParticipants(source),
      },
      "Jadwal baru tidak dapat diajukan.",
    );

    // Salin form awal; gagal salin tidak membatalkan booking (slot sudah terpakai).
    let intakeCopied = false;
    try {
      const answers = (await bookingRepository.findIntakeAnswersByBookingIds(client, [source.id])).get(source.id);
      if (answers) {
        await bookingRepository.saveIntakeAnswers(client, { bookingId, clientId: authUser.id, answers });
        intakeCopied = true;
      }
    } catch (intakeError) {
      console.warn("Gagal menyalin jawaban formulir klien ke booking baru:", intakeError?.message);
    }

    await writeAudit({
      actorUserId: authUser.id,
      action: "booking.rebook",
      entityType: "booking",
      entityId: bookingId,
      // Hanya ID booking asal; isi form awal tidak pernah disalin ke audit.
      metadata: { status: "waiting_confirmation", role: "client", source_booking_id: source.id },
    });

    const booking = await bookingRepository.findById(client, bookingId, authProfile);
    return { ...booking, source_booking_id: source.id, intake_copied: intakeCopied };
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

    let intakeSaved = true;
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
        // The response carries intake_saved: false so the client is told the form did not arrive.
        intakeSaved = false;
        console.warn("Gagal menyimpan jawaban formulir klien untuk booking:", intakeError?.message);
      }
    }

    const booking = await bookingRepository.findById(client, bookingId, authProfile);
    return input.intake_answers ? { ...booking, intake_saved: intakeSaved } : booking;
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
      throw new HttpError(403, "BOOKING_FORBIDDEN", "Klien hanya dapat membatalkan penjadwalan miliknya.");
    }
    if (authProfile.app_role === "counselor" && input.status === "cancelled") {
      throw new HttpError(403, "BOOKING_FORBIDDEN", "Gunakan alur status konselor untuk menolak atau meminta penjadwalan ulang.");
    }

    const client = getClient();

    if (authProfile.app_role === "client" && input.status === "cancelled") {
      // Batas waktu pembatalan klien untuk booking terkonfirmasi (2026-11-17).
      const { data: current } = await client
        .from("bookings")
        .select("status,starts_at")
        .eq("id", bookingId)
        .eq("client_id", authUser.id)
        .maybeSingle();
      if (current && isPastClientCancelCutoff(current, Date.now())) {
        throw new HttpError(
          409,
          "BOOKING_CANCEL_CUTOFF_PASSED",
          `Booking terkonfirmasi hanya dapat dibatalkan paling lambat ${CLIENT_CANCEL_CUTOFF_HOURS} jam sebelum jadwal. Hubungi konselor bila ada keperluan mendesak.`,
        );
      }
    }

    await callDomainRpc(
      client,
      "sicare_transition_booking",
      {
        p_actor_id: authUser.id,
        p_booking_id: bookingId,
        p_target_status: input.status,
        p_reason: input.reason ?? null,
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

