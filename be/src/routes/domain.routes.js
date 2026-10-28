import { Router } from "express";
import { z } from "zod";
import { getSupabaseAdminClient, isSupabaseConfigured } from "../config/supabase.js";
import { authenticate } from "../middleware/auth.js";
import { asyncHandler, HttpError, parseBody, sendData, supabaseError } from "../lib/http.js";
import { writeAudit } from "../lib/audit.js";

const router = Router();
const uuid = z.string().uuid();
const profilePatchSchema = z.object({
  full_name: z.string().trim().min(1).max(160).optional(),
  phone_e164: z.string().trim().min(7).max(20).nullable().optional(),
  whatsapp_opt_in: z.boolean().optional(),
}).strict();
const MAX_PUBLIC_AVAILABILITY_RANGE_MS = 90 * 24 * 60 * 60 * 1000;
const availabilityQuerySchema = z.object({
  counselor_id: uuid.optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(100),
}).strict();
const feedbackQuerySchema = z.object({ limit: z.coerce.number().int().min(1).max(100).default(20) }).strict();
const supa = () => {
  if (!isSupabaseConfigured()) {
    throw new HttpError(503, "SUPABASE_NOT_CONFIGURED", "Supabase belum dikonfigurasi pada backend.");
  }
  return getSupabaseAdminClient();
};

// The server-side Supabase client bypasses RLS, so public visibility is enforced here too.
async function loadPublicCounselors() {
  const { data: publicProfiles, error: publicError } = await supa()
    .from("counselor_profiles")
    .select("profile_id,public_name,headline,bio,specialties,years_experience,photo_path")
    .eq("is_public", true)
    .not("public_name", "is", null)
    .order("public_name");
  if (publicError) supabaseError(publicError);

  const candidates = publicProfiles ?? [];
  if (!candidates.length) return [];
  const { data: activeProfiles, error: profileError } = await supa()
    .from("profiles")
    .select("id")
    .in("id", candidates.map((profile) => profile.profile_id))
    .eq("app_role", "counselor")
    .eq("account_status", "active");
  if (profileError) supabaseError(profileError);

  const activeIds = new Set((activeProfiles ?? []).map((profile) => profile.id));
  return candidates.filter((profile) => activeIds.has(profile.profile_id));
}

router.get("/public/counselors", asyncHandler(async (_request, response) => {
  return sendData(response, await loadPublicCounselors());
}));

router.get("/public/periods", asyncHandler(async (_request, response) => {
  const { data, error } = await supa().from("academic_periods")
    .select("id,academic_year,semester,starts_on,ends_on")
    .eq("is_published", true)
    .order("starts_on", { ascending: false });
  if (error) supabaseError(error);
  return sendData(response, data ?? []);
}));

router.get("/public/availability", asyncHandler(async (request, response) => {
  const parsed = availabilityQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    throw new HttpError(400, "VALIDATION_ERROR", "Filter jadwal tidak valid.", parsed.error.issues);
  }

  const now = Date.now();
  const from = parsed.data.from ?? new Date(now).toISOString();
  const fromMs = Date.parse(from);
  const toMs = parsed.data.to ? Date.parse(parsed.data.to) : fromMs + MAX_PUBLIC_AVAILABILITY_RANGE_MS;
  if (toMs < fromMs) {
    throw new HttpError(400, "INVALID_DATE_RANGE", "Tanggal akhir harus sama dengan atau setelah tanggal mulai.");
  }
  if (toMs - fromMs > MAX_PUBLIC_AVAILABILITY_RANGE_MS) {
    throw new HttpError(400, "DATE_RANGE_TOO_LARGE", "Rentang pencarian jadwal maksimal 90 hari.");
  }

  const counselors = await loadPublicCounselors();
  const publicIds = counselors.map((profile) => profile.profile_id);
  if (!publicIds.length) return sendData(response, []);
  if (parsed.data.counselor_id && !publicIds.includes(parsed.data.counselor_id)) return sendData(response, []);

  const { data: slots, error: slotsError } = await supa().from("availability_slots")
    .select("id,counselor_id,academic_period_id,starts_at,ends_at,status")
    .eq("status", "available")
    .in("counselor_id", parsed.data.counselor_id ? [parsed.data.counselor_id] : publicIds)
    .gte("starts_at", from)
    .lte("starts_at", new Date(toMs).toISOString())
    .order("starts_at")
    .limit(parsed.data.limit);
  if (slotsError) supabaseError(slotsError);
  const availableSlots = slots ?? [];
  if (!availableSlots.length) return sendData(response, []);

  const { data: activeBookings, error: bookingError } = await supa().from("bookings")
    .select("availability_slot_id")
    .in("availability_slot_id", availableSlots.map((slot) => slot.id))
    .in("status", ["waiting_confirmation", "confirmed", "reschedule_requested"]);
  if (bookingError) supabaseError(bookingError);
  const reservedIds = new Set((activeBookings ?? []).map((booking) => booking.availability_slot_id));
  return sendData(response, availableSlots.filter((slot) => !reservedIds.has(slot.id)));
}));

router.get("/public/feedback", asyncHandler(async (request, response) => {
  const parsed = feedbackQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    throw new HttpError(400, "VALIDATION_ERROR", "Filter feedback tidak valid.", parsed.error.issues);
  }
  const { data, error } = await supa().from("feedback")
    .select("id,rating,comment,counselor_id,created_at")
    .eq("moderation_status", "shown")
    .order("created_at", { ascending: false })
    .limit(parsed.data.limit);
  if (error) supabaseError(error);
  return sendData(response, data ?? []);
}));

router.get("/profile", authenticate, (request, response) => sendData(response, request.auth.profile));

router.patch("/profile", authenticate, asyncHandler(async (request, response) => {
  const input = parseBody(profilePatchSchema, request.body);
  if (Object.keys(input).length === 0) {
    throw new HttpError(400, "VALIDATION_ERROR", "Minimal satu field profil harus dikirim.");
  }
  const { data, error } = await supa().from("profiles")
    .update(input)
    .eq("id", request.auth.user.id)
    .select("id,identity_code,full_name,app_role,member_category,account_status,phone_e164,whatsapp_opt_in,created_at,updated_at")
    .single();
  if (error) supabaseError(error, "Profil tidak dapat diperbarui.");
  await writeAudit({
    actorUserId: request.auth.user.id,
    action: "profile.update",
    entityType: "profile",
    entityId: request.auth.user.id,
    metadata: { field: Object.keys(input).join(",") },
  });
  return sendData(response, data);
}));

export default router;
