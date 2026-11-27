/**
 * Aturan operasional yang dapat dilonggarkan saat pengembangan.
 *
 * WEEKDAY_ONLY: konseling hanya dilayani Senin–Jumat. Aktif di build production, mati saat
 * `npm run dev` agar alur konseling bisa diuji di akhir pekan. Override dengan
 * VITE_WEEKDAY_ONLY=true|false. Backend punya sakelar serupa (WEEKDAY_ONLY / NODE_ENV); tampilan
 * ini hanya kenyamanan, validasi tetap di server.
 */
function readBooleanFlag(value: string | undefined, fallback: boolean): boolean {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return fallback;
}

export const WEEKDAY_ONLY = readBooleanFlag(import.meta.env.VITE_WEEKDAY_ONLY, import.meta.env.PROD);

/** True bila hari (0 = Minggu ... 6 = Sabtu) tidak melayani konseling menurut aturan aktif. */
export function isClosedWeekday(day: number): boolean {
  return WEEKDAY_ONLY && (day === 0 || day === 6);
}

/** Nama hari layanan, urut Senin lebih dulu. Sabtu & Minggu ikut hanya saat WEEKDAY_ONLY mati. */
export const SERVICE_DAY_NAMES: readonly string[] = WEEKDAY_ONLY
  ? ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"]
  : ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

const DAY_NAMES_BY_JS_DAY = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

/** Nama hari layanan untuk Date.getDay(), atau null bila hari itu tidak melayani konseling. */
export function serviceDayName(day: number): string | null {
  return isClosedWeekday(day) ? null : DAY_NAMES_BY_JS_DAY[day] ?? null;
}
