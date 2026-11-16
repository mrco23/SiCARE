import { getSupabaseAdminClient, isSupabaseConfigured } from "../config/supabase.js";

/**
 * Menandai data yang lewat waktu:
 * - sesi `scheduled` yang sudah lewat jam selesai + toleransi menjadi `missed`
 *   (RPC `sicare_mark_missed_sessions`, migrasi 20261115120000);
 * - booking `waiting_confirmation` / `reschedule_requested` yang jam mulainya sudah tiba
 *   menjadi `expired` (RPC `sicare_mark_expired_bookings`, migrasi 20261115140000 dan
 *   20261116120000);
 * - sesi `ongoing` yang tidak diakhiri sampai jam selesai + 2 jam ditutup otomatis menjadi
 *   `completed` (RPC `sicare_auto_complete_sessions`, migrasi 20261116120000).
 *
 * Dipanggil dari dua tempat:
 * - scheduler cron (tiap 10 menit) — jalur utama;
 * - saat daftar sesi dibaca — supaya status tetap benar walau cron tidak berjalan.
 * Pemanggilan dari jalur baca dibatasi sekali per MIN_INTERVAL_MS per instance dan
 * gagal-terbuka: kegagalan hanya dicatat dan tidak menggagalkan request pembaca.
 */

export const MISSED_SESSION_GRACE_MINUTES = 30;
export const AUTO_COMPLETE_GRACE_MINUTES = 120;
const MIN_INTERVAL_MS = 60 * 1000;

let lastRunAt = 0;
let inFlight = null;

export function resetMissedSessionThrottleForTests() {
  lastRunAt = 0;
  inFlight = null;
}

async function callRpc(supabaseClient) {
  const client = supabaseClient ?? getSupabaseAdminClient();
  const { data, error } = await client.rpc("sicare_mark_missed_sessions", {
    p_grace_minutes: MISSED_SESSION_GRACE_MINUTES,
  });
  if (error) throw error;
  return typeof data === "number" ? data : 0;
}

/** Jalur scheduler: selalu dijalankan, galat diteruskan ke pemanggil. */
export async function markMissedSessions(supabaseClient) {
  const marked = await callRpc(supabaseClient);
  lastRunAt = Date.now();
  return marked;
}

/** Jalur scheduler untuk booking kedaluwarsa; galat diteruskan ke pemanggil. */
export async function markExpiredBookings(supabaseClient) {
  const client = supabaseClient ?? getSupabaseAdminClient();
  const { data, error } = await client.rpc("sicare_mark_expired_bookings");
  if (error) throw error;
  return typeof data === "number" ? data : 0;
}

/** Jalur scheduler untuk sesi berlangsung yang tidak diakhiri; galat diteruskan ke pemanggil. */
export async function autoCompleteSessions(supabaseClient) {
  const client = supabaseClient ?? getSupabaseAdminClient();
  const { data, error } = await client.rpc("sicare_auto_complete_sessions", {
    p_grace_minutes: AUTO_COMPLETE_GRACE_MINUTES,
  });
  if (error) throw error;
  return typeof data === "number" ? data : 0;
}

function logFailure(kind, error) {
  console.error(`[MissedSession] Penandaan ${kind} gagal:`, {
    code: typeof error?.code === "string" ? error.code : "UNKNOWN",
  });
}

/** Jalur baca: dibatasi frekuensinya dan tidak pernah melempar galat. */
export async function markMissedSessionsSafely(supabaseClient) {
  if (!supabaseClient && !isSupabaseConfigured()) return 0;
  if (inFlight) return inFlight;
  if (Date.now() - lastRunAt < MIN_INTERVAL_MS) return 0;

  inFlight = (async () => {
    // Masing-masing gagal-terbuka (mis. migrasinya belum diterapkan) tanpa menggagalkan pembaca.
    try {
      try {
        await markExpiredBookings(supabaseClient);
      } catch (error) {
        logFailure("booking kedaluwarsa", error);
      }
      try {
        await autoCompleteSessions(supabaseClient);
      } catch (error) {
        logFailure("sesi ditutup otomatis", error);
      }
      try {
        return await callRpc(supabaseClient);
      } catch (error) {
        logFailure("sesi terlewat", error);
        return 0;
      }
    } finally {
      lastRunAt = Date.now();
      inFlight = null;
    }
  })();
  return inFlight;
}
