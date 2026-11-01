import { HttpError, supabaseError } from "./http.js";

export const DOMAIN_ERRORS = {
  BOOKING_CLIENT_NOT_ALLOWED: [403, "BOOKING_FORBIDDEN", "Akun ini tidak dapat membuat booking."],
  BOOKING_COUNSELOR_UNAVAILABLE: [404, "COUNSELOR_UNAVAILABLE", "Konselor tidak tersedia untuk pemesanan publik."],
  BOOKING_SLOT_UNAVAILABLE: [409, "SLOT_UNAVAILABLE", "Slot jadwal sudah tidak tersedia atau sudah lewat."],
  BOOKING_PERIOD_UNAVAILABLE: [409, "PERIOD_UNAVAILABLE", "Periode akademik untuk slot ini tidak aktif atau belum dipublikasikan."],
  BOOKING_PARTICIPANTS_INVALID: [400, "INVALID_PARTICIPANTS", "Data peserta kelompok tidak valid."],
  BOOKING_GROUP_FIELDS_INVALID: [400, "INVALID_GROUP_BOOKING", "Data layanan kelompok tidak konsisten."],
  BOOKING_SERVICE_TYPE_INVALID: [400, "INVALID_SERVICE_TYPE", "Jenis layanan tidak valid."],
  BOOKING_ACTOR_INACTIVE: [403, "ACCOUNT_INACTIVE", "Akun tidak aktif."],
  BOOKING_NOT_FOUND: [404, "BOOKING_NOT_FOUND", "Booking tidak ditemukan."],
  BOOKING_TRANSITION_NOT_ALLOWED: [409, "BOOKING_TRANSITION_NOT_ALLOWED", "Perubahan status booking tidak diizinkan."],
  BOOKING_RESCHEDULE_NOT_ALLOWED: [409, "BOOKING_RESCHEDULE_NOT_ALLOWED", "Booking tidak sedang menunggu penjadwalan ulang dari klien."],
  BOOKING_RESCHEDULE_REASON_REQUIRED: [400, "BOOKING_RESCHEDULE_REASON_REQUIRED", "Alasan penjadwalan ulang wajib diisi."],
  BOOKING_REASON_REQUIRED: [400, "BOOKING_REASON_REQUIRED", "Alasan wajib diisi untuk perubahan status ini."],
  BOOKING_SESSION_ALREADY_STARTED: [409, "SESSION_ALREADY_STARTED", "Booking tidak dapat dibatalkan setelah sesi dimulai atau selesai."],
  BOOKING_FORBIDDEN: [403, "BOOKING_FORBIDDEN", "Kamu tidak memiliki akses ke booking ini."],
  SESSION_FORMAT_REQUIRED: [400, "SESSION_FORMAT_REQUIRED", "Format sesi online atau offline wajib dipilih saat menerima booking."],
  SESSION_ROOM_INVALID: [400, "SESSION_ROOM_INVALID", "Informasi ruang maksimal 240 karakter."],
  SESSION_NOT_FOUND: [404, "SESSION_NOT_FOUND", "Sesi konseling tidak ditemukan."],
  SESSION_FORBIDDEN: [403, "SESSION_FORBIDDEN", "Hanya konselor pemilik sesi yang dapat mengubah statusnya."],
  SESSION_TRANSITION_NOT_ALLOWED: [409, "SESSION_TRANSITION_NOT_ALLOWED", "Perubahan status sesi tidak diizinkan."],
  CONSENT_READINESS_INCOMPLETE: [409, "CONSENT_READINESS_INCOMPLETE", "Sesi konseling belum dapat dimulai karena informed consent belum dilengkapi oleh seluruh peserta."],
  FEEDBACK_INVALID: [400, "INVALID_FEEDBACK", "Rating atau komentar feedback tidak valid."],
  FEEDBACK_SESSION_NOT_ELIGIBLE: [409, "FEEDBACK_NOT_ELIGIBLE", "Feedback hanya dapat diberikan klien setelah sesi selesai."],
  FEEDBACK_FORBIDDEN: [403, "FEEDBACK_FORBIDDEN", "Akun ini tidak dapat memberikan feedback."],
};

export function handleDomainRpcError(error, fallback = "Operasi domain gagal.") {
  const message = typeof error?.message === "string" ? error.message : "";
  const domainKey = Object.keys(DOMAIN_ERRORS).find((key) => message.includes(key));
  if (domainKey) {
    const [status, code, safeMessage] = DOMAIN_ERRORS[domainKey];
    throw new HttpError(status, code, safeMessage);
  }
  if (error?.code === "23505") throw new HttpError(409, "CONFLICT", "Data duplikat atau slot sudah dipesan.");
  if (error?.code === "23503" || error?.code === "23514" || error?.code === "22P02") {
    throw new HttpError(400, "INVALID_DATA", "Data tidak memenuhi aturan database.");
  }
  supabaseError(error, fallback);
}

export async function callDomainRpc(client, functionName, parameters, fallback) {
  const { data, error } = await client.rpc(functionName, parameters);
  if (error) handleDomainRpcError(error, fallback);
  return data;
}
