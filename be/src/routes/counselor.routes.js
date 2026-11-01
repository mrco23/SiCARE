import { Router } from "express";
import { z } from "zod";
import { getSupabaseAdminClient, isSupabaseConfigured } from "../config/supabase.js";
import { allowRoles, authenticate } from "../middleware/auth.js";
import { asyncHandler, HttpError, parseBody, sendData, supabaseError } from "../lib/http.js";
import { writeAudit } from "../lib/audit.js";

const router = Router();
const uuid = z.string().uuid();
const profilePatchSchema = z.object({
  public_name: z.string().trim().min(1).max(160).optional(),
  headline: z.string().trim().max(240).nullable().optional(),
  bio: z.string().trim().max(5000).nullable().optional(),
  specialties: z.array(z.string().trim().min(1).max(100)).max(20).optional(),
  years_experience: z.number().int().min(0).max(80).nullable().optional(),
  photo_path: z.string().trim().max(1000).nullable().optional(),
}).strict();
const slotSchema = z.object({
  starts_at: z.string().datetime({ offset: true }),
  ends_at: z.string().datetime({ offset: true }),
  academic_period_id: uuid.nullable().optional(),
}).strict().superRefine((v, c) => {
  if (Date.parse(v.ends_at) <= Date.parse(v.starts_at)) c.addIssue({ code: "custom", message: "Waktu akhir harus setelah waktu mulai.", path: ["ends_at"] });
  if (Date.parse(v.starts_at) <= Date.now()) c.addIssue({ code: "custom", message: "Jadwal harus berada di masa depan.", path: ["starts_at"] });
});
const supa = () => {
  if (!isSupabaseConfigured()) throw new HttpError(503, "SUPABASE_NOT_CONFIGURED", "Supabase belum dikonfigurasi pada backend.");
  return getSupabaseAdminClient();
};

router.get("/profile", authenticate, allowRoles("counselor"), asyncHandler(async (req, res) => {
  const { data, error } = await supa().from("counselor_profiles")
    .select("profile_id,public_name,headline,bio,specialties,years_experience,photo_path,is_public,created_at,updated_at")
    .eq("profile_id", req.auth.user.id).maybeSingle();
  if (error) supabaseError(error, "Profil konselor tidak dapat dibaca.");
  if (!data) throw new HttpError(404, "COUNSELOR_PROFILE_NOT_FOUND", "Profil konselor belum disiapkan oleh admin.");
  return sendData(res, data);
}));

router.patch("/profile", authenticate, allowRoles("counselor"), asyncHandler(async (req, res) => {
  const input = parseBody(profilePatchSchema, req.body);
  if (!Object.keys(input).length) throw new HttpError(400, "VALIDATION_ERROR", "Minimal satu field profil harus dikirim.");
  const { data, error } = await supa().from("counselor_profiles").update(input).eq("profile_id", req.auth.user.id)
    .select("profile_id,public_name,headline,bio,specialties,years_experience,photo_path,is_public,created_at,updated_at").maybeSingle();
  if (error) supabaseError(error, "Profil konselor tidak dapat diperbarui.");
  if (!data) throw new HttpError(404, "COUNSELOR_PROFILE_NOT_FOUND", "Profil konselor belum disiapkan oleh admin.");
  await writeAudit({ actorUserId: req.auth.user.id, action: "counselor.profile.update", entityType: "counselor_profile", entityId: data.profile_id, metadata: { role: "counselor" } });
  return sendData(res, data);
}));

router.get("/availability", authenticate, allowRoles("counselor"), asyncHandler(async (req, res) => {
  const status = req.query.status;
  if (status !== undefined && !["available", "blocked", "cancelled"].includes(status)) throw new HttpError(400, "VALIDATION_ERROR", "Filter status jadwal tidak valid.");
  let query = supa().from("availability_slots")
    .select("id,counselor_id,academic_period_id,starts_at,ends_at,status,created_at,updated_at")
    .eq("counselor_id", req.auth.user.id).order("starts_at", { ascending: true }).limit(200);
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) supabaseError(error, "Jadwal konselor tidak dapat dibaca.");
  return sendData(res, data ?? []);
}));

async function saveSlot(req, res, slotId = null) {
  if (slotId && !uuid.safeParse(slotId).success) throw new HttpError(400, "INVALID_ID", "ID jadwal tidak valid.");
  const input = parseBody(slotSchema, req.body);
  const { data, error } = await supa().rpc("sicare_save_availability_slot", {
    p_counselor_id: req.auth.user.id,
    p_slot_id: slotId,
    p_starts_at: input.starts_at,
    p_ends_at: input.ends_at,
    p_academic_period_id: input.academic_period_id ?? null,
  });
  if (error) {
    const message = error.message ?? "";
    if (message.includes("AVAILABILITY_OVERLAP")) throw new HttpError(409, "AVAILABILITY_OVERLAP", "Jadwal bertabrakan dengan jadwal atau booking lain.");
    if (message.includes("AVAILABILITY_NOT_FOUND")) throw new HttpError(404, "AVAILABILITY_NOT_FOUND", "Jadwal tidak ditemukan.");
    if (message.includes("AVAILABILITY_BOOKED")) throw new HttpError(409, "AVAILABILITY_BOOKED", "Jadwal sudah memiliki booking aktif dan tidak dapat diubah.");
    if (message.includes("AVAILABILITY_PERIOD_INVALID")) throw new HttpError(400, "AVAILABILITY_PERIOD_INVALID", "Periode akademik tidak valid atau tanggal jadwal di luar periode.");
    if (message.includes("AVAILABILITY_TIME_INVALID")) throw new HttpError(400, "AVAILABILITY_TIME_INVALID", "Jadwal harus berada di masa depan dan waktu akhir setelah waktu mulai.");
    if (message.includes("AVAILABILITY_FORBIDDEN")) throw new HttpError(403, "AVAILABILITY_FORBIDDEN", "Akun tidak berhak mengelola jadwal ini.");
    supabaseError(error, "Jadwal tidak dapat disimpan.");
  }
  const { data: slot, error: slotError } = await supa().from("availability_slots")
    .select("id,counselor_id,academic_period_id,starts_at,ends_at,status,created_at,updated_at")
    .eq("id", data).single();
  if (slotError) supabaseError(slotError, "Jadwal tersimpan tetapi tidak dapat dibaca.");
  await writeAudit({ actorUserId: req.auth.user.id, action: slotId ? "counselor.availability.update" : "counselor.availability.create", entityType: "availability_slot", entityId: data, metadata: { status: "available", role: "counselor" } });
  return sendData(res, slot, slotId ? 200 : 201);
}

router.post("/availability", authenticate, allowRoles("counselor"), asyncHandler((req, res) => saveSlot(req, res)));
router.patch("/availability/:id", authenticate, allowRoles("counselor"), asyncHandler((req, res) => saveSlot(req, res, req.params.id)));
router.delete("/availability/:id", authenticate, allowRoles("counselor"), asyncHandler(async (req, res) => {
  if (!uuid.safeParse(req.params.id).success) throw new HttpError(400, "INVALID_ID", "ID jadwal tidak valid.");
  const { data, error } = await supa().rpc("sicare_cancel_availability_slot", { p_counselor_id: req.auth.user.id, p_slot_id: req.params.id });
  if (error) {
    if ((error.message ?? "").includes("AVAILABILITY_NOT_FOUND")) throw new HttpError(404, "AVAILABILITY_NOT_FOUND", "Jadwal tidak ditemukan.");
    if ((error.message ?? "").includes("AVAILABILITY_BOOKED")) throw new HttpError(409, "AVAILABILITY_BOOKED", "Jadwal memiliki booking aktif dan tidak dapat dibatalkan.");
    if ((error.message ?? "").includes("AVAILABILITY_FORBIDDEN")) throw new HttpError(403, "AVAILABILITY_FORBIDDEN", "Akun tidak berhak mengelola jadwal ini.");
    supabaseError(error, "Jadwal tidak dapat dibatalkan.");
  }
  await writeAudit({ actorUserId: req.auth.user.id, action: "counselor.availability.cancel", entityType: "availability_slot", entityId: req.params.id, metadata: { status: "cancelled", role: "counselor" } });
  return sendData(res, { id: req.params.id, status: data ?? "cancelled" });
}));

export default router;
