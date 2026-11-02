import { Router } from "express";
import { z } from "zod";
import { getSupabaseAdminClient, isSupabaseConfigured } from "../config/supabase.js";
import { allowRoles, authenticate } from "../middleware/auth.js";
import { asyncHandler, HttpError, parseBody, sendData, supabaseError } from "../lib/http.js";
import { writeAudit } from "../lib/audit.js";
import {
  checkRateLimit,
  comparePassword,
  createHistoryGrantToken,
  hashPassword,
  recordFailedAttempt,
  resetFailedAttempts,
  verifyHistoryGrantToken,
} from "../services/counselorCredential.service.js";

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

const initPasswordSchema = z.object({
  password: z.string().trim().min(4, "Kata sandi minimal 4 karakter.").max(100),
}).strict();

const verifyPasswordSchema = z.object({
  password: z.string().trim().min(1, "Kata sandi wajib diisi.").max(100),
}).strict();

const changePasswordSchema = z.object({
  current_password: z.string().trim().min(1, "Kata sandi saat ini wajib diisi.").max(100),
  new_password: z.string().trim().min(4, "Kata sandi baru minimal 4 karakter.").max(100),
  confirm_password: z.string().trim().min(4, "Konfirmasi kata sandi minimal 4 karakter.").max(100),
}).strict().superRefine((val, ctx) => {
  if (val.new_password !== val.confirm_password) {
    ctx.addIssue({ code: "custom", message: "Konfirmasi kata sandi tidak cocok.", path: ["confirm_password"] });
  }
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

router.get("/history-password/status", authenticate, allowRoles("counselor"), asyncHandler(async (req, res) => {
  const { data, error } = await supa().from("counselor_history_credentials")
    .select("counselor_id")
    .eq("counselor_id", req.auth.user.id)
    .maybeSingle();
  if (error && !error.message?.includes("does not exist")) supabaseError(error, "Gagal memeriksa status sandi riwayat.");
  return sendData(res, { configured: Boolean(data) });
}));

router.post("/history-password/init", authenticate, allowRoles("counselor"), asyncHandler(async (req, res) => {
  const input = parseBody(initPasswordSchema, req.body);
  const client = supa();
  const { data: existing } = await client.from("counselor_history_credentials")
    .select("counselor_id")
    .eq("counselor_id", req.auth.user.id)
    .maybeSingle();
  if (existing) {
    throw new HttpError(409, "CREDENTIAL_ALREADY_CONFIGURED", "Kata sandi riwayat sudah dikonfigurasi. Gunakan menu ganti kata sandi.");
  }
  const hash = await hashPassword(input.password);
  const { error: insertError } = await client.from("counselor_history_credentials").upsert({
    counselor_id: req.auth.user.id,
    password_hash: hash,
    updated_at: new Date().toISOString(),
  });
  if (insertError) supabaseError(insertError, "Gagal menyimpan kata sandi riwayat.");
  resetFailedAttempts(req.auth.user.id);
  await writeAudit({
    actorUserId: req.auth.user.id,
    action: "counselor.history_password.init",
    entityType: "counselor_history_credential",
    entityId: req.auth.user.id,
    metadata: { role: "counselor" },
  });
  return sendData(res, { success: true, message: "Kata sandi riwayat berhasil dikonfigurasi." }, 201);
}));

router.post("/history-password/verify", authenticate, allowRoles("counselor"), asyncHandler(async (req, res) => {
  checkRateLimit(req.auth.user.id);
  const input = parseBody(verifyPasswordSchema, req.body);
  const { data: cred, error } = await supa().from("counselor_history_credentials")
    .select("counselor_id,password_hash")
    .eq("counselor_id", req.auth.user.id)
    .maybeSingle();
  if (error) supabaseError(error, "Gagal memverifikasi kata sandi riwayat.");
  if (!cred) {
    throw new HttpError(404, "CREDENTIAL_NOT_CONFIGURED", "Kata sandi riwayat belum dikonfigurasi.");
  }
  const valid = await comparePassword(input.password, cred.password_hash);
  if (!valid) {
    const remaining = recordFailedAttempt(req.auth.user.id);
    throw new HttpError(401, "INVALID_CREDENTIALS", `Kata sandi riwayat salah. Sisa percobaan: ${remaining}`);
  }
  resetFailedAttempts(req.auth.user.id);
  const grant = createHistoryGrantToken(req.auth.user.id, 1800);
  await writeAudit({
    actorUserId: req.auth.user.id,
    action: "counselor.history_password.verify",
    entityType: "counselor_history_credential",
    entityId: req.auth.user.id,
    metadata: { role: "counselor" },
  });
  return sendData(res, { success: true, grant_token: grant.token, ...grant });
}));

router.post("/history-password/change", authenticate, allowRoles("counselor"), asyncHandler(async (req, res) => {
  const input = parseBody(changePasswordSchema, req.body);
  const client = supa();
  const { data: cred, error } = await client.from("counselor_history_credentials")
    .select("counselor_id,password_hash")
    .eq("counselor_id", req.auth.user.id)
    .maybeSingle();
  if (error) supabaseError(error, "Gagal memverifikasi kata sandi riwayat.");
  if (!cred) {
    throw new HttpError(404, "CREDENTIAL_NOT_CONFIGURED", "Kata sandi riwayat belum dikonfigurasi. Silakan atur kata sandi terlebih dahulu.");
  }
  const valid = await comparePassword(input.current_password, cred.password_hash);
  if (!valid) {
    throw new HttpError(401, "INVALID_CREDENTIALS", "Kata sandi riwayat saat ini salah.");
  }
  const newHash = await hashPassword(input.new_password);
  const { error: updateError } = await client.from("counselor_history_credentials")
    .update({ password_hash: newHash, updated_at: new Date().toISOString() })
    .eq("counselor_id", req.auth.user.id);
  if (updateError) supabaseError(updateError, "Gagal memperbarui kata sandi riwayat.");
  resetFailedAttempts(req.auth.user.id);
  await writeAudit({
    actorUserId: req.auth.user.id,
    action: "counselor.history_password.change",
    entityType: "counselor_history_credential",
    entityId: req.auth.user.id,
    metadata: { role: "counselor" },
  });
  return sendData(res, { success: true, message: "Kata sandi riwayat berhasil diperbarui." });
}));

router.get("/history", authenticate, allowRoles("counselor"), asyncHandler(async (req, res) => {
  const client = supa();
  const { data: cred } = await client.from("counselor_history_credentials")
    .select("counselor_id")
    .eq("counselor_id", req.auth.user.id)
    .maybeSingle();
  if (!cred) {
    return sendData(res, { configured: false, sessions: [], bookings: [], clients: [], message: "Kata sandi riwayat belum dikonfigurasi." });
  }

  const grantToken = req.headers["x-counselor-history-grant"] || req.query.grant_token;
  if (!grantToken || !verifyHistoryGrantToken(String(grantToken), req.auth.user.id)) {
    throw new HttpError(403, "HISTORY_ACCESS_LOCKED", "Akses riwayat konseling terkunci. Masukkan kata sandi riwayat untuk membuka.");
  }

  const { data: sessions, error: sessionError } = await client.from("counseling_sessions")
    .select("id,booking_id,counselor_id,starts_at,ends_at,status,format,room,started_at,completed_at,created_at,updated_at")
    .eq("counselor_id", req.auth.user.id)
    .order("starts_at", { ascending: false })
    .limit(200);
  if (sessionError) supabaseError(sessionError, "Riwayat sesi tidak dapat dibaca.");

  const bookingIds = Array.from(new Set((sessions ?? []).map((s) => s.booking_id).filter(Boolean)));
  let bookings = [];
  if (bookingIds.length > 0) {
    const { data: bData, error: bError } = await client.from("bookings")
      .select("id,client_id,counselor_id,service_type,group_name,participant_count,starts_at,ends_at,status,booking_participants(id,display_name,is_representative)")
      .in("id", bookingIds);
    if (bError) supabaseError(bError, "Data booking riwayat tidak dapat dibaca.");
    bookings = bData ?? [];
  }

  const clientIds = Array.from(new Set(bookings.map((b) => b.client_id).filter(Boolean)));
  let clientProfiles = [];
  if (clientIds.length > 0) {
    const { data: pData, error: pError } = await client.from("profiles")
      .select("id,full_name,student_id,faculty,study_program,phone_e164")
      .in("id", clientIds);
    if (pError) supabaseError(pError, "Data profil klien riwayat tidak dapat dibaca.");
    clientProfiles = pData ?? [];
  }

  await writeAudit({
    actorUserId: req.auth.user.id,
    action: "counselor.history.read",
    entityType: "counselor_history",
    entityId: req.auth.user.id,
    metadata: { role: "counselor", count: sessions?.length ?? 0 },
  });

  return sendData(res, {
    configured: true,
    sessions: sessions ?? [],
    bookings,
    clients: clientProfiles,
  });
}));

export default router;
