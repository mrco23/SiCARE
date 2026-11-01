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
}).strict();
const whatsappConsentSchema = z.object({ opted_in: z.boolean() }).strict();
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

// The server-side Supabase client bypasses RLS, so active counselor check is enforced here.
async function loadPublicCounselors() {
  const { data: activeProfiles, error: profileError } = await supa()
    .from("profiles")
    .select("id,full_name")
    .eq("app_role", "counselor")
    .eq("account_status", "active")
    .order("full_name");
  if (profileError) supabaseError(profileError);

  const active = activeProfiles ?? [];
  if (!active.length) return [];

  const { data: counselorProfiles, error: counselorError } = await supa()
    .from("counselor_profiles")
    .select("profile_id,public_name,headline,bio,specialties,years_experience,photo_path")
    .in("profile_id", active.map((profile) => profile.id));
  if (counselorError) supabaseError(counselorError);

  const counselorMap = new Map((counselorProfiles ?? []).map((cp) => [cp.profile_id, cp]));

  return active
    .map((profile) => {
      const cp = counselorMap.get(profile.id);
      const publicName = cp?.public_name?.trim() || profile.full_name?.trim() || "";
      return {
        profile_id: profile.id,
        public_name: publicName,
        headline: cp?.headline ?? null,
        bio: cp?.bio ?? null,
        specialties: cp?.specialties ?? [],
        years_experience: cp?.years_experience ?? null,
        photo_path: cp?.photo_path ?? null,
      };
    })
    .filter((profile) => profile.public_name.trim().length > 0)
    .sort((a, b) => a.public_name.localeCompare(b.public_name));
}

router.get("/public/hero-motivations", asyncHandler(async (_request, response) => {
  const { data, error } = await supa().from("hero_motivations")
    .select("id,content")
    .eq("is_active", true)
    .order("created_at", { ascending: true });
  if (error) supabaseError(error, "Kalimat motivasi publik tidak dapat dibaca.");
  return sendData(response, data ?? []);
}));

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

  const counselorIds = parsed.data.counselor_id ? [parsed.data.counselor_id] : publicIds;
  const { data, error } = await supa().rpc("sicare_public_availability", {
    p_counselor_ids: counselorIds,
    p_from: from,
    p_to: new Date(toMs).toISOString(),
    p_limit: parsed.data.limit,
  });
  if (error) supabaseError(error, "Jadwal publik tidak dapat dibaca.");
  return sendData(response, data ?? []);
}));

router.get("/public/feedback", asyncHandler(async (request, response) => {
  const parsed = feedbackQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    throw new HttpError(400, "VALIDATION_ERROR", "Filter feedback tidak valid.", parsed.error.issues);
  }
  const counselors = await loadPublicCounselors();
  const publicIds = counselors.map((profile) => profile.profile_id);
  if (!publicIds.length) return sendData(response, []);

  const { data, error } = await supa().from("feedback")
    .select("id,rating,comment,counselor_id,created_at")
    .eq("moderation_status", "shown")
    .in("counselor_id", publicIds)
    .order("created_at", { ascending: false })
    .limit(parsed.data.limit);
  if (error) supabaseError(error, "Feedback publik tidak dapat dibaca.");
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

// WhatsApp consent is deliberately separate from ordinary profile edits. The API
// records the affirmative opt-in timestamp and clears it when consent is withdrawn.
router.patch("/profile/whatsapp-consent", authenticate, asyncHandler(async (request, response) => {
  const input = parseBody(whatsappConsentSchema, request.body);
  const updatedAt = new Date().toISOString();
  const patch = {
    whatsapp_opt_in: input.opted_in,
    whatsapp_opt_in_at: input.opted_in ? updatedAt : null,
  };

  const { data, error } = await supa().from("profiles")
    .update(patch)
    .eq("id", request.auth.user.id)
    .select("id,whatsapp_opt_in,whatsapp_opt_in_at,updated_at")
    .single();
  if (error) supabaseError(error, "Persetujuan WhatsApp tidak dapat diperbarui.");

  await writeAudit({
    actorUserId: request.auth.user.id,
    action: "profile.whatsapp_consent",
    entityType: "profile",
    entityId: request.auth.user.id,
    metadata: { status: input.opted_in ? "opted_in" : "opted_out" },
  });
  return sendData(response, data);
}));

export default router;
