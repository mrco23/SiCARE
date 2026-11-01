import { Router } from "express";
import { z } from "zod";
import { getSupabaseAdminClient, isSupabaseConfigured } from "../config/supabase.js";
import { allowRoles, authenticate } from "../middleware/auth.js";
import { asyncHandler, HttpError, parseBody, sendData, supabaseError } from "../lib/http.js";
import { callDomainRpc } from "../lib/domainRpc.js";
import { writeAudit } from "../lib/audit.js";

const router = Router();
const uuid = z.string().uuid();
const sessionListQuerySchema = z.object({
  status: z.enum(["scheduled", "ongoing", "completed", "cancelled"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
}).strict();
const sessionStatusSchema = z.object({ status: z.enum(["ongoing", "completed", "cancelled"]) }).strict();

function supa() {
  if (!isSupabaseConfigured()) throw new HttpError(503, "SUPABASE_NOT_CONFIGURED", "Supabase belum dikonfigurasi pada backend.");
  return getSupabaseAdminClient();
}

async function loadSessionForParty(client, sessionId, profile) {
  const { data: session, error } = await client.from("counseling_sessions")
    .select("id,booking_id,counselor_id,starts_at,ends_at,status,format,room,started_at,completed_at,created_at,updated_at")
    .eq("id", sessionId).maybeSingle();
  if (error) supabaseError(error, "Sesi tidak dapat dibaca.");
  if (!session) throw new HttpError(404, "SESSION_NOT_FOUND", "Sesi konseling tidak ditemukan.");

  let bookingQuery = client.from("bookings").select("id,client_id,counselor_id,service_type,group_name,participant_count,status")
    .eq("id", session.booking_id);
  bookingQuery = profile.app_role === "client"
    ? bookingQuery.eq("client_id", profile.id)
    : bookingQuery.eq("counselor_id", profile.id);
  const { data: booking, error: bookingError } = await bookingQuery.maybeSingle();
  if (bookingError) supabaseError(bookingError, "Booking sesi tidak dapat diverifikasi.");
  if (!booking) throw new HttpError(404, "SESSION_NOT_FOUND", "Sesi konseling tidak ditemukan.");
  return { ...session, booking };
}


router.get("/", authenticate, allowRoles("client", "counselor"), asyncHandler(async (request, response) => {
  const filters = sessionListQuerySchema.safeParse(request.query);
  if (!filters.success) throw new HttpError(400, "VALIDATION_ERROR", "Filter sesi tidak valid.", filters.error.issues);
  const client = supa();
  let bookingQuery = client.from("bookings").select("id");
  bookingQuery = request.auth.profile.app_role === "client"
    ? bookingQuery.eq("client_id", request.auth.user.id)
    : bookingQuery.eq("counselor_id", request.auth.user.id);
  const { data: bookings, error: bookingError } = await bookingQuery;
  if (bookingError) supabaseError(bookingError, "Daftar booking tidak dapat dibaca.");
  const bookingIds = (bookings ?? []).map((booking) => booking.id);
  if (!bookingIds.length) return sendData(response, []);

  let query = client.from("counseling_sessions")
    .select("id,booking_id,counselor_id,starts_at,ends_at,status,format,room,started_at,completed_at,created_at,updated_at")
    .in("booking_id", bookingIds).order("starts_at", { ascending: false }).limit(filters.data.limit);
  if (filters.data.status) query = query.eq("status", filters.data.status);
  const { data, error } = await query;
  if (error) supabaseError(error, "Daftar sesi tidak dapat dibaca.");
  return sendData(response, data ?? []);
}));

router.get("/:id", authenticate, allowRoles("client", "counselor"), asyncHandler(async (request, response) => {
  if (!uuid.safeParse(request.params.id).success) throw new HttpError(400, "INVALID_ID", "ID sesi tidak valid.");
  return sendData(response, await loadSessionForParty(supa(), request.params.id, request.auth.profile));
}));

router.patch("/:id/status", authenticate, allowRoles("counselor"), asyncHandler(async (request, response) => {
  if (!uuid.safeParse(request.params.id).success) throw new HttpError(400, "INVALID_ID", "ID sesi tidak valid.");
  const input = parseBody(sessionStatusSchema, request.body);
  const sessionId = await callDomainRpc(supa(), "sicare_transition_session", {
    p_actor_id: request.auth.user.id,
    p_session_id: request.params.id,
    p_target_status: input.status,
  }, "Status sesi tidak dapat diperbarui.");
  await writeAudit({ actorUserId: request.auth.user.id, action: "session.status", entityType: "session", entityId: sessionId, metadata: { status: input.status, role: "counselor" } });
  return sendData(response, await loadSessionForParty(supa(), sessionId, request.auth.profile));
}));

export default router;
