import { Router } from "express";
import { z } from "zod";
import { getSupabaseAdminClient, isSupabaseConfigured } from "../config/supabase.js";
import { allowRoles, authenticate } from "../middleware/auth.js";
import { asyncHandler, HttpError, parseBody, sendData, supabaseError } from "../lib/http.js";
import { callDomainRpc } from "../lib/domainRpc.js";
import { writeAudit } from "../lib/audit.js";
import {
  getGroupConsentSummary,
  initializeGroupConsentInvitations,
} from "../services/consent.service.js";

const router = Router();
const uuid = z.string().uuid();
const participantSchema = z.object({
  display_name: z.string().trim().min(1).max(160),
  full_name: z.string().trim().min(1).max(160).optional(),
  phone_e164: z.string().trim().min(8).max(25).optional().nullable(),
  is_representative: z.boolean().default(false),
}).strict();
const createBookingSchema = z.object({
  counselor_id: uuid,
  availability_slot_id: uuid,
  service_type: z.enum(["individual", "group"]),
  group_name: z.string().trim().min(1).max(160).nullable().optional(),
  participants: z.array(participantSchema).max(10).default([]),
}).strict().superRefine((input, context) => {
  if (input.service_type === "individual") {
    if (input.group_name != null || input.participants.length !== 0) {
      context.addIssue({ code: "custom", message: "Booking individual tidak boleh memiliki data kelompok.", path: ["participants"] });
    }
  } else {
    if (!input.group_name) context.addIssue({ code: "custom", message: "Nama kelompok wajib diisi.", path: ["group_name"] });
    if (input.participants.length < 2 || input.participants.length > 10) {
      context.addIssue({ code: "custom", message: "Kelompok harus memiliki 2 sampai 10 peserta.", path: ["participants"] });
    }
    if (input.participants.filter((participant) => participant.is_representative).length !== 1) {
      context.addIssue({ code: "custom", message: "Tepat satu peserta harus ditandai sebagai perwakilan.", path: ["participants"] });
    }
  }
});
const bookingListQuerySchema = z.object({
  status: z.enum(["waiting_confirmation", "confirmed", "rejected", "reschedule_requested", "cancelled"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
}).strict();
const bookingTransitionSchema = z.object({
  status: z.enum(["confirmed", "rejected", "reschedule_requested", "cancelled"]),
  reason: z.string().trim().min(1).max(1000).optional(),
  session_format: z.enum(["online", "offline"]).optional(),
  room: z.string().trim().max(240).nullable().optional(),
}).strict().superRefine((input, context) => {
  if (input.status === "confirmed" && !input.session_format) {
    context.addIssue({ code: "custom", message: "Format sesi wajib dipilih saat menerima booking.", path: ["session_format"] });
  }
  if (["cancelled", "rejected", "reschedule_requested"].includes(input.status) && !input.reason) {
    context.addIssue({ code: "custom", message: "Alasan wajib diisi untuk pembatalan, penolakan, atau permintaan penjadwalan ulang.", path: ["reason"] });
  }
});
const rescheduleBookingSchema = z.object({ availability_slot_id: uuid }).strict();

function supa() {
  if (!isSupabaseConfigured()) throw new HttpError(503, "SUPABASE_NOT_CONFIGURED", "Supabase belum dikonfigurasi pada backend.");
  return getSupabaseAdminClient();
}

async function loadBookingById(client, bookingId, profile) {
  let query = client.from("bookings")
    .select("id,client_id,counselor_id,availability_slot_id,service_type,group_name,participant_count,starts_at,ends_at,status,cancellation_reason,reschedule_reason,created_at,updated_at,booking_participants(id,display_name,is_representative)")
    .eq("id", bookingId);
  query = profile.app_role === "client" ? query.eq("client_id", profile.id) : query.eq("counselor_id", profile.id);
  const { data, error } = await query.maybeSingle();
  if (error) supabaseError(error, "Booking tidak dapat dibaca.");
  if (!data) throw new HttpError(404, "BOOKING_NOT_FOUND", "Booking tidak ditemukan.");
  return data;
}


router.get("/", authenticate, allowRoles("client", "counselor"), asyncHandler(async (request, response) => {
  const filters = bookingListQuerySchema.safeParse(request.query);
  if (!filters.success) throw new HttpError(400, "VALIDATION_ERROR", "Filter booking tidak valid.", filters.error.issues);
  let query = supa().from("bookings")
    .select("id,client_id,counselor_id,availability_slot_id,service_type,group_name,participant_count,starts_at,ends_at,status,cancellation_reason,reschedule_reason,created_at,updated_at,booking_participants(id,display_name,is_representative)")
    .order("created_at", { ascending: false }).limit(filters.data.limit);
  query = request.auth.profile.app_role === "client"
    ? query.eq("client_id", request.auth.user.id)
    : query.eq("counselor_id", request.auth.user.id);
  if (filters.data.status) query = query.eq("status", filters.data.status);
  const { data, error } = await query;
  if (error) supabaseError(error, "Daftar booking tidak dapat dibaca.");
  return sendData(response, data ?? []);
}));

router.post("/", authenticate, allowRoles("client"), asyncHandler(async (request, response) => {
  const input = parseBody(createBookingSchema, request.body);
  const bookingId = await callDomainRpc(supa(), "sicare_create_booking", {
    p_client_id: request.auth.user.id,
    p_counselor_id: input.counselor_id,
    p_slot_id: input.availability_slot_id,
    p_service_type: input.service_type,
    p_group_name: input.group_name ?? null,
    p_participants: input.participants,
  }, "Booking tidak dapat dibuat.");
  await writeAudit({ actorUserId: request.auth.user.id, action: "booking.create", entityType: "booking", entityId: bookingId, metadata: { status: "waiting_confirmation", role: "client" } });
  const booking = await loadBookingById(supa(), bookingId, request.auth.profile);
  return sendData(response, booking, 201);
}));

router.patch("/:id/reschedule", authenticate, allowRoles("client"), asyncHandler(async (request, response) => {
  if (!uuid.safeParse(request.params.id).success) throw new HttpError(400, "INVALID_ID", "ID booking tidak valid.");
  const input = parseBody(rescheduleBookingSchema, request.body);
  const bookingId = await callDomainRpc(supa(), "sicare_reschedule_booking", {
    p_client_id: request.auth.user.id,
    p_booking_id: request.params.id,
    p_slot_id: input.availability_slot_id,
  }, "Penjadwalan ulang tidak dapat diajukan.");
  await writeAudit({ actorUserId: request.auth.user.id, action: "booking.reschedule", entityType: "booking", entityId: bookingId, metadata: { status: "waiting_confirmation", role: "client" } });
  const booking = await loadBookingById(supa(), bookingId, request.auth.profile);
  return sendData(response, booking);
}));

router.get("/:id", authenticate, allowRoles("client", "counselor"), asyncHandler(async (request, response) => {
  if (!uuid.safeParse(request.params.id).success) throw new HttpError(400, "INVALID_ID", "ID booking tidak valid.");
  return sendData(response, await loadBookingById(supa(), request.params.id, request.auth.profile));
}));

router.patch("/:id/status", authenticate, allowRoles("client", "counselor"), asyncHandler(async (request, response) => {
  if (!uuid.safeParse(request.params.id).success) throw new HttpError(400, "INVALID_ID", "ID booking tidak valid.");
  const input = parseBody(bookingTransitionSchema, request.body);
  if (request.auth.profile.app_role === "client" && input.status !== "cancelled") {
    throw new HttpError(403, "BOOKING_FORBIDDEN", "Klien hanya dapat membatalkan booking miliknya.");
  }
  if (request.auth.profile.app_role === "counselor" && input.status === "cancelled") {
    throw new HttpError(403, "BOOKING_FORBIDDEN", "Gunakan alur status konselor untuk menolak atau meminta penjadwalan ulang.");
  }
  const bookingId = await callDomainRpc(supa(), "sicare_transition_booking", {
    p_actor_id: request.auth.user.id,
    p_booking_id: request.params.id,
    p_target_status: input.status,
    p_reason: input.reason ?? null,
    p_session_format: input.session_format ?? null,
    p_room: input.room ?? null,
  }, "Status booking tidak dapat diperbarui.");
  if (input.status === "confirmed") {
    try {
      await initializeGroupConsentInvitations({ supabaseClient: supa(), bookingId });
    } catch (inviteError) {
      console.warn("Gagal inisialisasi undangan informed consent booking:", inviteError?.message);
    }
  }
  await writeAudit({ actorUserId: request.auth.user.id, action: "booking.status", entityType: "booking", entityId: bookingId, metadata: { status: input.status, role: request.auth.profile.app_role } });
  const booking = await loadBookingById(supa(), bookingId, request.auth.profile);
  return sendData(response, booking);
}));

router.get("/:id/consent-summary", authenticate, allowRoles("client", "counselor"), asyncHandler(async (request, response) => {
  if (!uuid.safeParse(request.params.id).success) throw new HttpError(400, "INVALID_ID", "ID booking tidak valid.");
  const summary = await getGroupConsentSummary({
    supabaseClient: supa(),
    bookingId: request.params.id,
    authUser: request.auth.user,
    authRole: request.auth.profile.app_role,
  });
  return sendData(response, summary);
}));

export default router;
