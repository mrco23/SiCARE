import type { SessionMissedReasonApi } from "../types/api";

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
