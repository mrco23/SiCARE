import type { BookingExpiredReasonApi, SessionMissedReasonApi } from "../types/api";

/** Label status otomatis untuk sesi yang lewat waktu tanpa dimulai (status server `missed`). */
export const MISSED_SESSION_LABEL = "Terlewat";

/** Penjelasan singkat alasan sesi terlewat, aman ditampilkan ke klien maupun konselor. */
export function missedReasonText(reason?: SessionMissedReasonApi | null): string {
  if (reason === "consent_unsigned") return "Informed consent belum ditandatangani sampai waktu sesi berakhir.";
  if (reason === "not_started") return "Sesi belum dimulai sampai waktunya berakhir.";
  return "Sesi tidak terlaksana sesuai jadwal.";
}

/** Label status otomatis booking yang tidak dikonfirmasi sampai jadwalnya tiba (status server `expired`). */
export const EXPIRED_BOOKING_LABEL = "Kedaluwarsa";

export const EXPIRED_BOOKING_REASON =
  "Permintaan tidak sempat dikonfirmasi konselor sampai jadwalnya tiba.";

/** Penjelasan alasan booking kedaluwarsa; tanpa alasan dianggap belum dikonfirmasi. */
export function expiredReasonText(reason?: BookingExpiredReasonApi | null): string {
  if (reason === "reschedule_not_selected") {
    return "Jadwal pengganti tidak dipilih sampai jadwal awal lewat.";
  }
  return EXPIRED_BOOKING_REASON;
}

/** Label booking `reschedule_requested`: konselor meminta jadwal ulang, klien memilih jam pengganti. */
export const RESCHEDULE_PENDING_LABEL = "Menunggu jadwal pengganti";

/** Label booking `expired` karena jadwal pengganti tidak dipilih (expired_reason reschedule_not_selected). */
export const RESCHEDULE_NOT_SELECTED_LABEL = "Dibatalkan · jadwal pengganti tidak dipilih";

/** Label booking kedaluwarsa sesuai alasannya; tanpa migrasi status baru. */
export function expiredBookingLabel(reason?: BookingExpiredReasonApi | null): string {
  return reason === "reschedule_not_selected" ? RESCHEDULE_NOT_SELECTED_LABEL : EXPIRED_BOOKING_LABEL;
}

/** Catatan untuk sesi berlangsung yang ditutup otomatis oleh sistem. */
export const AUTO_COMPLETED_NOTE =
  "Ditutup otomatis karena sesi belum diakhiri sampai 2 jam setelah jadwal selesai.";

/** Sesi dapat dimulai paling cepat sekian menit sebelum jam mulai (sama dengan aturan server). */
export const SESSION_START_LEAD_MINUTES = 15;

/**
 * Alasan sesi belum/tidak dapat dimulai berdasarkan waktu, atau null bila sedang dalam jendela
 * mulai. Server tetap menjadi penentu akhir (SESSION_START_TOO_EARLY / SESSION_START_WINDOW_PASSED).
 */
export function sessionStartTimeBlockReason(startsAt: string, endsAt: string, now: number): string | null {
  const opensAt = new Date(startsAt).getTime() - SESSION_START_LEAD_MINUTES * 60 * 1000;
  if (now < opensAt) {
    const opens = new Date(opensAt).toLocaleString("id-ID", {
      timeZone: "Asia/Makassar",
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    });
    return `Sesi baru dapat dimulai ${opens} WITA (${SESSION_START_LEAD_MINUTES} menit sebelum jadwal).`;
  }
  if (now > new Date(endsAt).getTime()) {
    return "Jadwal sesi sudah berakhir, sehingga sesi tidak dapat dimulai lagi.";
  }
  return null;
}
