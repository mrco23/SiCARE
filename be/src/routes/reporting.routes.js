import { Router } from "express";
import { getSupabaseAdminClient, isSupabaseConfigured } from "../config/supabase.js";
import { allowRoles, authenticate } from "../middleware/auth.js";
import { asyncHandler, HttpError, sendData, supabaseError } from "../lib/http.js";

const router = Router();
const supa = () => {
  if (!isSupabaseConfigured()) throw new HttpError(503, "SUPABASE_NOT_CONFIGURED", "Supabase belum dikonfigurasi pada backend.");
  return getSupabaseAdminClient();
};

async function countRows(table, configure = (q) => q) {
  const { count, error } = await configure(supa().from(table).select("id", { count: "exact", head: true }));
  if (error) supabaseError(error, "Statistik dashboard tidak dapat dihitung.");
  return count ?? 0;
}

async function getDashboard() {
  const [activeClients, activeCounselors, waitingBookings, confirmedBookings, completedSessions, pendingFeedback, totalBookings, totalSessions] = await Promise.all([
    countRows("profiles", (q) => q.eq("app_role", "client").eq("account_status", "active")),
    countRows("profiles", (q) => q.eq("app_role", "counselor").eq("account_status", "active")),
    countRows("bookings", (q) => q.eq("status", "waiting_confirmation")),
    countRows("bookings", (q) => q.eq("status", "confirmed")),
    countRows("counseling_sessions", (q) => q.eq("status", "completed")),
    countRows("feedback", (q) => q.eq("moderation_status", "pending")),
    countRows("bookings"),
    countRows("counseling_sessions"),
  ]);
  return { users: { active_clients: activeClients, active_counselors: activeCounselors }, bookings: { total: totalBookings, waiting_confirmation: waitingBookings, confirmed: confirmedBookings }, sessions: { total: totalSessions, completed: completedSessions }, feedback: { pending_moderation: pendingFeedback } };
}

async function getReport() {
  const since = new Date();
  since.setMonth(since.getMonth() - 11, 1);
  since.setHours(0, 0, 0, 0);
  const from = since.toISOString();
  const [bookingResult, sessionResult, feedbackResult, counselorResult] = await Promise.all([
    supa().from("bookings").select("id,status,service_type,starts_at,created_at,counselor_id").gte("created_at", from).order("created_at", { ascending: true }).limit(1000),
    supa().from("counseling_sessions").select("id,status,starts_at,completed_at,counselor_id").gte("created_at", from).order("created_at", { ascending: true }).limit(1000),
    supa().from("feedback").select("id,rating,moderation_status,created_at,counselor_id").gte("created_at", from).order("created_at", { ascending: true }).limit(1000),
    supa().from("profiles").select("id,full_name").eq("app_role", "counselor").eq("account_status", "active").limit(500),
  ]);
  for (const result of [bookingResult, sessionResult, feedbackResult, counselorResult]) if (result.error) supabaseError(result.error, "Laporan tidak dapat dibuat.");
  const bookings = bookingResult.data ?? [];
  const sessions = sessionResult.data ?? [];
  const feedback = feedbackResult.data ?? [];
  const counselors = counselorResult.data ?? [];
  const monthly = new Map();
  const monthKey = (value) => value.slice(0, 7);
  for (const row of bookings) {
    const key = monthKey(row.created_at);
    if (!monthly.has(key)) monthly.set(key, { month: key, bookings: 0, completed_sessions: 0, feedback_count: 0 });
    monthly.get(key).bookings += 1;
  }
  for (const row of sessions) {
    if (row.status !== "completed") continue;
    const key = monthKey(row.completed_at ?? row.starts_at);
    if (!monthly.has(key)) monthly.set(key, { month: key, bookings: 0, completed_sessions: 0, feedback_count: 0 });
    monthly.get(key).completed_sessions += 1;
  }
  for (const row of feedback) {
    const key = monthKey(row.created_at);
    if (!monthly.has(key)) monthly.set(key, { month: key, bookings: 0, completed_sessions: 0, feedback_count: 0 });
    monthly.get(key).feedback_count += 1;
  }
  const byCounselor = new Map(counselors.map((c) => [c.id, { counselor_id: c.id, counselor_name: c.full_name, bookings: 0, completed_sessions: 0, feedback_count: 0, rating_total: 0 }]));
  for (const row of bookings) if (byCounselor.has(row.counselor_id)) byCounselor.get(row.counselor_id).bookings += 1;
  for (const row of sessions) if (row.status === "completed" && byCounselor.has(row.counselor_id)) byCounselor.get(row.counselor_id).completed_sessions += 1;
  for (const row of feedback) if (byCounselor.has(row.counselor_id)) {
    const item = byCounselor.get(row.counselor_id);
    item.feedback_count += 1;
    item.rating_total += row.rating;
  }
  return {
    period: { from, to: new Date().toISOString() },
    totals: {
      bookings: bookings.length,
      completed_sessions: sessions.filter((x) => x.status === "completed").length,
      cancelled_sessions: sessions.filter((x) => x.status === "cancelled").length,
      feedback: feedback.length,
      shown_feedback: feedback.filter((x) => x.moderation_status === "shown").length,
      average_rating: feedback.length ? Math.round(feedback.reduce((n, x) => n + x.rating, 0) / feedback.length * 100) / 100 : null,
    },
    monthly: [...monthly.values()].sort((a, b) => a.month.localeCompare(b.month)),
    counselors: [...byCounselor.values()].map((x) => ({ ...x, average_rating: x.feedback_count ? Math.round(x.rating_total / x.feedback_count * 100) / 100 : null, rating_total: undefined })).sort((a, b) => b.completed_sessions - a.completed_sessions),
    truncated: bookings.length === 1000 || sessions.length === 1000 || feedback.length === 1000,
  };
}

router.get("/admin/dashboard", authenticate, allowRoles("admin"), asyncHandler(async (_req, res) => sendData(res, await getDashboard())));
router.get("/head-lmi/dashboard", authenticate, allowRoles("head_lmi"), asyncHandler(async (_req, res) => sendData(res, await getDashboard())));
router.get("/admin/reports", authenticate, allowRoles("admin"), asyncHandler(async (_req, res) => sendData(res, await getReport())));
router.get("/head-lmi/reports", authenticate, allowRoles("head_lmi"), asyncHandler(async (_req, res) => sendData(res, await getReport())));

export default router;
