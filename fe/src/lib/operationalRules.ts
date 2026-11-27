/**
 * Aturan operasional jadwal konseling, dikendalikan satu variabel lingkungan VITE_APP_ENV.
 *
 * - production (default, juga bila kosong/tidak dikenal): konseling hanya Senin–Jumat dan
 *   jam mulai 08.00–15.00 (sesi 60 menit selesai paling lambat 16.00).
 * - development: semua hari dan 24 jam (00.00–23.00 sebagai jam mulai) agar alur konseling
 *   bisa diuji di luar hari dan jam kerja.
 *
 * Backend memakai variabel APP_ENV dengan nilai yang sama. Tampilan ini hanya kenyamanan;
 * validasi hari tetap di server.
 */
export type AppEnv = "development" | "production";

export const APP_ENV: AppEnv =
  import.meta.env.VITE_APP_ENV?.trim().toLowerCase() === "development" ? "development" : "production";

export const IS_DEVELOPMENT = APP_ENV === "development";

/** Batas jam layanan dalam menit sejak 00.00 waktu lokal. */
export const SERVICE_START_MINUTES = IS_DEVELOPMENT ? 0 : 8 * 60;
export const SERVICE_END_MINUTES = IS_DEVELOPMENT ? 24 * 60 : 16 * 60;

/** True bila hari (0 = Minggu ... 6 = Sabtu) tidak melayani konseling menurut aturan aktif. */
export function isClosedWeekday(day: number): boolean {
  return !IS_DEVELOPMENT && (day === 0 || day === 6);
}

/** Nama hari layanan, urut Senin lebih dulu. Sabtu & Minggu ikut hanya di development. */
export const SERVICE_DAY_NAMES: readonly string[] = IS_DEVELOPMENT
  ? ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"]
  : ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"];

const DAY_NAMES_BY_JS_DAY = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

/** Nama hari layanan untuk Date.getDay(), atau null bila hari itu tidak melayani konseling. */
export function serviceDayName(day: number): string | null {
  return isClosedWeekday(day) ? null : DAY_NAMES_BY_JS_DAY[day] ?? null;
}
