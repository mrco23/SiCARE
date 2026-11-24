// @ts-check
import { getSupabaseAdminClient, isSupabaseConfigured } from "../config/supabase.js";
import { markMissedSessionsSafely } from "./missedSession.service.js";
import { HttpError, supabaseError } from "../lib/http.js";

const supa = () => {
  if (!isSupabaseConfigured()) throw new HttpError(503, "SUPABASE_NOT_CONFIGURED", "Supabase belum dikonfigurasi pada server.");
  return getSupabaseAdminClient();
};

async function countRows(table, configure = (q) => q) {
  const { count, error } = await configure(supa().from(table).select("id", { count: "exact", head: true }));
  if (error) supabaseError(error, "Statistik dashboard tidak dapat dihitung.");
  return count ?? 0;
}

/** Laporan menghitung bulan dalam WITA (Asia/Makassar, UTC+8, tanpa DST). */
const WITA_OFFSET_MS = 8 * 60 * 60 * 1000;
const REPORT_PAGE_SIZE = 1000;
/** Batas pengaman per tabel; di atas ini laporan ditandai truncated. */
const REPORT_MAX_ROWS = 20000;

/** "YYYY-MM" menurut kalender WITA. */
/** @param {string} value */
export function witaMonthKey(value) {
  return new Date(Date.parse(value) + WITA_OFFSET_MS).toISOString().slice(0, 7);
}

/** Awal bulan WITA, 11 bulan sebelum bulan berjalan (12 bulan termasuk bulan ini), dalam ISO UTC. */
/** @param {number} nowMs */
export function reportWindowStart(nowMs) {
  const wita = new Date(nowMs + WITA_OFFSET_MS);
  return new Date(Date.UTC(wita.getUTCFullYear(), wita.getUTCMonth() - 11, 1) - WITA_OFFSET_MS).toISOString();
}

/**
 * Mengambil semua baris sejak `from` per halaman (urut created_at, id), bukan hanya 1000 tertua.
 * @param {"bookings" | "counseling_sessions" | "feedback"} table
 * @param {string} fields
 * @param {string} from
 * @returns {Promise<{ rows: any[], truncated: boolean }>}
 */
async function fetchAllRows(table, fields, from) {
  /** @type {any[]} */
  const rows = [];
  for (let offset = 0; offset < REPORT_MAX_ROWS; offset += REPORT_PAGE_SIZE) {
    const { data, error } = await supa()
      .from(table)
      .select(fields)
      .gte("created_at", from)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + REPORT_PAGE_SIZE - 1);
    if (error) supabaseError(error, "Laporan tidak dapat dibuat.");
    rows.push(...(data ?? []));
    if (!data || data.length < REPORT_PAGE_SIZE) return { rows, truncated: false };
  }
  return { rows, truncated: true };
}

export const reportingService = {
  async getDashboard() {
    await markMissedSessionsSafely();
    const [
      activeClients,
      activeCounselors,
      waitingBookings,
      confirmedBookings,
      completedSessions,
      pendingFeedback,
      totalBookings,
      totalSessions,
    ] = await Promise.all([
      countRows("profiles", (q) => q.eq("app_role", "client").eq("account_status", "active")),
      countRows("profiles", (q) => q.eq("app_role", "counselor").eq("account_status", "active")),
      countRows("bookings", (q) => q.eq("status", "waiting_confirmation")),
      countRows("bookings", (q) => q.eq("status", "confirmed")),
      countRows("counseling_sessions", (q) => q.eq("status", "completed")),
      countRows("feedback", (q) => q.eq("moderation_status", "pending")),
      countRows("bookings"),
      countRows("counseling_sessions"),
    ]);

    return {
      users: { active_clients: activeClients, active_counselors: activeCounselors },
      bookings: { total: totalBookings, waiting_confirmation: waitingBookings, confirmed: confirmedBookings },
      sessions: { total: totalSessions, completed: completedSessions },
      feedback: { pending_moderation: pendingFeedback },
    };
  },

  async getReport() {
    await markMissedSessionsSafely();
    const from = reportWindowStart(Date.now());

    const [bookings, sessions, feedback, activeCounselorResult] = await Promise.all([
      fetchAllRows("bookings", "id,status,service_type,starts_at,created_at,counselor_id", from),
      fetchAllRows("counseling_sessions", "id,status,starts_at,completed_at,counselor_id", from),
      fetchAllRows("feedback", "id,rating,moderation_status,created_at,counselor_id", from),
      supa().from("profiles").select("id,full_name,account_status,app_role").eq("app_role", "counselor").eq("account_status", "active").limit(500),
    ]);
    if (activeCounselorResult.error) supabaseError(activeCounselorResult.error, "Laporan tidak dapat dibuat.");

    // Konselor yang sudah nonaktif/berganti role tetap muncul bila punya data pada periode laporan.
    const counselorRows = [...(activeCounselorResult.data ?? [])];
    const known = new Set(counselorRows.map((c) => c.id));
    const missingIds = [
      ...new Set(
        [...bookings.rows, ...sessions.rows, ...feedback.rows]
          .map((row) => row.counselor_id)
          .filter((id) => id && !known.has(id)),
      ),
    ];
    if (missingIds.length) {
      const { data: formerCounselors, error } = await supa()
        .from("profiles")
        .select("id,full_name,account_status,app_role")
        .in("id", missingIds);
      if (error) supabaseError(error, "Laporan tidak dapat dibuat.");
      counselorRows.push(...(formerCounselors ?? []));
    }

    const monthly = new Map();
    const bump = (value, field) => {
      if (!value) return;
      const key = witaMonthKey(value);
      if (!monthly.has(key)) monthly.set(key, { month: key, bookings: 0, completed_sessions: 0, feedback_count: 0 });
      monthly.get(key)[field] += 1;
    };
    for (const row of bookings.rows) bump(row.created_at, "bookings");
    for (const row of sessions.rows) if (row.status === "completed") bump(row.completed_at ?? row.starts_at, "completed_sessions");
    for (const row of feedback.rows) bump(row.created_at, "feedback_count");

    const byCounselor = new Map(
      counselorRows.map((c) => [
        c.id,
        {
          counselor_id: c.id,
          counselor_name: c.full_name,
          is_active: c.app_role === "counselor" && c.account_status === "active",
          bookings: 0,
          completed_sessions: 0,
          feedback_count: 0,
          rating_total: 0,
        },
      ])
    );
    for (const row of bookings.rows) {
      const item = byCounselor.get(row.counselor_id);
      if (item) item.bookings += 1;
    }
    for (const row of sessions.rows) {
      const item = byCounselor.get(row.counselor_id);
      if (item && row.status === "completed") item.completed_sessions += 1;
    }
    for (const row of feedback.rows) {
      const item = byCounselor.get(row.counselor_id);
      if (item) {
        item.feedback_count += 1;
        item.rating_total += row.rating;
      }
    }

    const feedbackRows = feedback.rows;
    return {
      period: { from, to: new Date().toISOString() },
      totals: {
        bookings: bookings.rows.length,
        completed_sessions: sessions.rows.filter((x) => x.status === "completed").length,
        cancelled_sessions: sessions.rows.filter((x) => x.status === "cancelled").length,
        missed_sessions: sessions.rows.filter((x) => x.status === "missed").length,
        expired_bookings: bookings.rows.filter((x) => x.status === "expired").length,
        feedback: feedbackRows.length,
        shown_feedback: feedbackRows.filter((x) => x.moderation_status === "shown").length,
        average_rating: feedbackRows.length
          ? Math.round((feedbackRows.reduce((n, x) => n + x.rating, 0) / feedbackRows.length) * 100) / 100
          : null,
      },
      monthly: [...monthly.values()].sort((a, b) => a.month.localeCompare(b.month)),
      counselors: [...byCounselor.values()]
        .map((x) => ({
          ...x,
          average_rating: x.feedback_count ? Math.round((x.rating_total / x.feedback_count) * 100) / 100 : null,
          rating_total: undefined,
        }))
        .sort((a, b) => b.completed_sessions - a.completed_sessions),
      truncated: bookings.truncated || sessions.truncated || feedback.truncated,
    };
  },
};

