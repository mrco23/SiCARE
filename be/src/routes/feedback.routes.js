import { Router } from "express";
import { z } from "zod";
import { getSupabaseAdminClient, isSupabaseConfigured } from "../config/supabase.js";
import { allowRoles, authenticate } from "../middleware/auth.js";
import { asyncHandler, HttpError, parseBody, sendData, supabaseError } from "../lib/http.js";
import { callDomainRpc } from "../lib/domainRpc.js";
import { writeAudit } from "../lib/audit.js";

const router = Router();
const uuid = z.string().uuid();
const submitFeedbackSchema = z.object({ rating: z.number().int().min(1).max(5), comment: z.string().trim().max(5000).optional().nullable() }).strict();
const adminFeedbackQuerySchema = z.object({
  moderation_status: z.enum(["pending", "shown", "disabled"]).optional(),
  review_status: z.enum(["new", "reviewed", "resolved"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
}).strict();
const moderationSchema = z.object({
  moderation_status: z.enum(["pending", "shown", "disabled"]),
  disabled_reason: z.string().trim().min(1).max(1000).optional(),
}).strict().superRefine((input, context) => {
  if (input.moderation_status === "disabled" && !input.disabled_reason) {
    context.addIssue({ code: "custom", message: "Alasan wajib diisi saat feedback dinonaktifkan.", path: ["disabled_reason"] });
  }
});
const reviewSchema = z.object({ review_status: z.enum(["new", "reviewed", "resolved"]) }).strict();

function supa() {
  if (!isSupabaseConfigured()) throw new HttpError(503, "SUPABASE_NOT_CONFIGURED", "Supabase belum dikonfigurasi pada backend.");
  return getSupabaseAdminClient();
}

router.post("/sessions/:sessionId/feedback", authenticate, allowRoles("client"), asyncHandler(async (request, response) => {
  if (!uuid.safeParse(request.params.sessionId).success) throw new HttpError(400, "INVALID_ID", "ID sesi tidak valid.");
  const input = parseBody(submitFeedbackSchema, request.body);
  const feedbackId = await callDomainRpc(supa(), "sicare_submit_feedback", {
    p_client_id: request.auth.user.id,
    p_session_id: request.params.sessionId,
    p_rating: input.rating,
    p_comment: input.comment ?? null,
  }, "Feedback tidak dapat dikirim.");
  await writeAudit({ actorUserId: request.auth.user.id, action: "feedback.submit", entityType: "feedback", entityId: feedbackId, metadata: { status: "pending", role: "client" } });
  const { data, error } = await supa().from("feedback")
    .select("id,session_id,client_id,counselor_id,rating,comment,moderation_status,review_status,created_at,updated_at")
    .eq("id", feedbackId).single();
  if (error) supabaseError(error, "Feedback tersimpan tetapi tidak dapat dibaca.");
  return sendData(response, data, 201);
}));

router.get("/feedback/counselor", authenticate, allowRoles("counselor"), asyncHandler(async (request, response) => {
  const parsed = z.object({ rating: z.coerce.number().int().min(1).max(5).optional(), limit: z.coerce.number().int().min(1).max(100).default(50) }).strict().safeParse(request.query);
  if (!parsed.success) throw new HttpError(400, "VALIDATION_ERROR", "Filter feedback konselor tidak valid.", parsed.error.issues);
  let query = supa().from("feedback")
    .select("id,session_id,rating,comment,created_at,counselor_id")
    .eq("counselor_id", request.auth.user.id)
    .eq("moderation_status", "shown")
    .order("created_at", { ascending: false }).limit(parsed.data.limit);
  if (parsed.data.rating) query = query.eq("rating", parsed.data.rating);
  const { data, error } = await query;
  if (error) supabaseError(error, "Feedback konselor tidak dapat dibaca.");
  return sendData(response, data ?? []);
}));

router.get("/feedback/mine", authenticate, allowRoles("client"), asyncHandler(async (_request, response) => {
  const { data, error } = await supa().from("feedback")
    .select("id,session_id,counselor_id,rating,comment,moderation_status,review_status,created_at,updated_at")
    .eq("client_id", _request.auth.user.id).order("created_at", { ascending: false }).limit(100);
  if (error) supabaseError(error, "Riwayat feedback tidak dapat dibaca.");
  return sendData(response, data ?? []);
}));

router.get("/admin/feedback/statistics", authenticate, allowRoles("admin", "head_lmi"), asyncHandler(async (_request, response) => {
  const statuses = ["pending", "shown", "disabled"];
  const results = await Promise.all(statuses.map(async (status) => {
    const { count, error } = await supa().from("feedback").select("id", { count: "exact", head: true }).eq("moderation_status", status);
    if (error) supabaseError(error, "Statistik feedback tidak dapat dibaca.");
    return [status, count ?? 0];
  }));
  const reviews = await Promise.all(["new", "reviewed", "resolved"].map(async (status) => {
    const { count, error } = await supa().from("feedback").select("id", { count: "exact", head: true }).eq("review_status", status);
    if (error) supabaseError(error, "Statistik peninjauan feedback tidak dapat dibaca.");
    return [status, count ?? 0];
  }));
  return sendData(response, { moderation: Object.fromEntries(results), review: Object.fromEntries(reviews) });
}));

router.get("/admin/feedback/:id", authenticate, allowRoles("admin", "head_lmi"), asyncHandler(async (request, response) => {
  if (!uuid.safeParse(request.params.id).success) throw new HttpError(400, "INVALID_ID", "ID feedback tidak valid.");
  const { data, error } = await supa().from("feedback")
    .select("id,session_id,client_id,counselor_id,rating,comment,moderation_status,review_status,disabled_reason,created_at,updated_at")
    .eq("id", request.params.id).maybeSingle();
  if (error) supabaseError(error, "Detail feedback tidak dapat dibaca.");
  if (!data) throw new HttpError(404, "FEEDBACK_NOT_FOUND", "Feedback tidak ditemukan.");
  return sendData(response, data);
}));

router.get("/admin/feedback", authenticate, allowRoles("admin", "head_lmi"), asyncHandler(async (request, response) => {
  const filters = adminFeedbackQuerySchema.safeParse(request.query);
  if (!filters.success) throw new HttpError(400, "VALIDATION_ERROR", "Filter feedback tidak valid.", filters.error.issues);
  let query = supa().from("feedback")
    .select("id,session_id,client_id,counselor_id,rating,comment,moderation_status,review_status,disabled_reason,created_at,updated_at")
    .order("created_at", { ascending: false }).limit(filters.data.limit);
  if (filters.data.moderation_status) query = query.eq("moderation_status", filters.data.moderation_status);
  if (filters.data.review_status) query = query.eq("review_status", filters.data.review_status);
  const { data, error } = await query;
  if (error) supabaseError(error, "Daftar feedback tidak dapat dibaca.");
  return sendData(response, data ?? []);
}));

router.patch("/admin/feedback/:id/moderation", authenticate, allowRoles("admin"), asyncHandler(async (request, response) => {
  if (!uuid.safeParse(request.params.id).success) throw new HttpError(400, "INVALID_ID", "ID feedback tidak valid.");
  const input = parseBody(moderationSchema, request.body);
  const patch = {
    moderation_status: input.moderation_status,
    disabled_reason: input.moderation_status === "disabled" ? input.disabled_reason : null,
  };
  const { data, error } = await supa().from("feedback").update(patch)
    .eq("id", request.params.id)
    .select("id,session_id,client_id,counselor_id,rating,comment,moderation_status,review_status,disabled_reason,created_at,updated_at")
    .maybeSingle();
  if (error) supabaseError(error, "Moderasi feedback tidak dapat disimpan.");
  if (!data) throw new HttpError(404, "FEEDBACK_NOT_FOUND", "Feedback tidak ditemukan.");
  await writeAudit({ actorUserId: request.auth.user.id, action: "feedback.moderate", entityType: "feedback", entityId: data.id, metadata: { status: input.moderation_status, role: "admin" } });
  return sendData(response, data);
}));

router.patch("/admin/feedback/:id/review", authenticate, allowRoles("head_lmi"), asyncHandler(async (request, response) => {
  if (!uuid.safeParse(request.params.id).success) throw new HttpError(400, "INVALID_ID", "ID feedback tidak valid.");
  const input = parseBody(reviewSchema, request.body);
  const { data, error } = await supa().from("feedback").update({ review_status: input.review_status })
    .eq("id", request.params.id)
    .select("id,session_id,client_id,counselor_id,rating,comment,moderation_status,review_status,disabled_reason,created_at,updated_at")
    .maybeSingle();
  if (error) supabaseError(error, "Status peninjauan feedback tidak dapat disimpan.");
  if (!data) throw new HttpError(404, "FEEDBACK_NOT_FOUND", "Feedback tidak ditemukan.");
  await writeAudit({ actorUserId: request.auth.user.id, action: "feedback.review", entityType: "feedback", entityId: data.id, metadata: { status: input.review_status, role: "head_lmi" } });
  return sendData(response, data);
}));

export default router;
