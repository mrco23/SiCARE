import { Router } from "express";
import { z } from "zod";
import { getSupabaseAdminClient, isSupabaseConfigured } from "../config/supabase.js";
import { allowRoles, authenticate } from "../middleware/auth.js";
import { asyncHandler, HttpError, parseBody, sendData, supabaseError } from "../lib/http.js";
import { writeAudit } from "../lib/audit.js";
import { fonnteService } from "../services/fonnte.service.js";

const router = Router();
const uuid = z.string().uuid();
const roles = ["client", "counselor", "admin", "head_lmi"];
const accountQuerySchema = z.object({
  role: z.enum(roles).optional(),
  status: z.enum(["pending", "active", "disabled"]).optional(),
  search: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
}).strict();
const createAccountSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128),
  full_name: z.string().trim().min(1).max(160),
  identity_code: z.string().trim().min(1).max(80).regex(/^[A-Za-z0-9._/-]+$/).nullable().optional(),
  member_category: z.enum(["student", "faculty_staff", "other"]).nullable().optional(),
  app_role: z.enum(roles).default("client"),
  account_status: z.enum(["pending", "active", "disabled"]).default("active"),
}).strict();
const patchAccountSchema = z.object({
  full_name: z.string().trim().min(1).max(160).optional(),
  identity_code: z.string().trim().min(1).max(80).regex(/^[A-Za-z0-9._/-]+$/).nullable().optional(),
  member_category: z.enum(["student", "faculty_staff", "other"]).nullable().optional(),
  phone_e164: z.string().trim().min(7).max(20).nullable().optional(),
  app_role: z.enum(roles).optional(),
  account_status: z.enum(["pending", "active", "disabled"]).optional(),
}).strict();
// Keep the reusable object schema unrefined. Zod 4 does not allow .partial()
// on a schema that already has .refine() / .superRefine() applied.
const periodBaseSchema = z.object({
  academic_year: z.string().trim().min(4).max(20),
  semester: z.enum(["Ganjil", "Genap"]),
  starts_on: z.string().date(),
  ends_on: z.string().date(),
  is_published: z.boolean().default(false),
}).strict();
const periodSchema = periodBaseSchema.superRefine((v, c) => {
  if (v.ends_on < v.starts_on) c.addIssue({ code: "custom", message: "Tanggal akhir harus sama dengan atau setelah tanggal mulai.", path: ["ends_on"] });
});
const periodPatchSchema = periodBaseSchema.partial().strict().superRefine((v, c) => {
  if (v.starts_on && v.ends_on && v.ends_on < v.starts_on) c.addIssue({ code: "custom", message: "Tanggal akhir harus sama dengan atau setelah tanggal mulai.", path: ["ends_on"] });
});
const publicToggleSchema = z.object({ is_public: z.boolean() }).strict();
const heroMotivationCreateSchema = z.object({
  content: z.string().trim().min(1).max(180).regex(/^[^\r\n]+$/),
  is_active: z.boolean().default(true),
}).strict();
const heroMotivationPatchSchema = z.object({
  content: z.string().trim().min(1).max(180).regex(/^[^\r\n]+$/).optional(),
  is_active: z.boolean().optional(),
}).strict();
const limitSchema = z.object({ limit: z.coerce.number().int().min(1).max(100).default(50) }).strict();

const supa = () => {
  if (!isSupabaseConfigured()) throw new HttpError(503, "SUPABASE_NOT_CONFIGURED", "Supabase belum dikonfigurasi pada backend.");
  return getSupabaseAdminClient();
};

router.get("/accounts", authenticate, allowRoles("admin"), asyncHandler(async (req, res) => {
  const parsed = accountQuerySchema.safeParse(req.query);
  if (!parsed.success) throw new HttpError(400, "VALIDATION_ERROR", "Filter akun tidak valid.", parsed.error.issues);
  let query = supa().from("profiles")
    .select("id,identity_code,full_name,app_role,member_category,account_status,phone_e164,whatsapp_opt_in,created_at,updated_at")
    .order("created_at", { ascending: false }).limit(parsed.data.limit);
  if (parsed.data.role) query = query.eq("app_role", parsed.data.role);
  if (parsed.data.status) query = query.eq("account_status", parsed.data.status);
  if (parsed.data.search) query = query.or(`full_name.ilike.%${parsed.data.search.replace(/[^\p{L}\p{N}\s_-]/gu, " ")}%,identity_code.ilike.%${parsed.data.search.replace(/[^\p{L}\p{N}\s_-]/gu, " ")}%`);
  const { data, error } = await query;
  if (error) supabaseError(error, "Daftar akun tidak dapat dibaca.");
  const ids = (data ?? []).map((p) => p.id);
  let emails = new Map();
  // Email is read from Auth Admin API, not stored in public.profiles.
  for (const id of ids) {
    const { data: authUser, error: authError } = await supa().auth.admin.getUserById(id);
    if (!authError && authUser?.user) emails.set(id, authUser.user.email ?? null);
  }
  return sendData(res, (data ?? []).map((p) => ({ ...p, email: emails.get(p.id) ?? null })));
}));

router.get("/accounts/:id", authenticate, allowRoles("admin"), asyncHandler(async (req, res) => {
  if (!uuid.safeParse(req.params.id).success) throw new HttpError(400, "INVALID_ID", "ID akun tidak valid.");
  const { data, error } = await supa().from("profiles")
    .select("id,identity_code,full_name,app_role,member_category,account_status,phone_e164,whatsapp_opt_in,created_at,updated_at")
    .eq("id", req.params.id).maybeSingle();
  if (error) supabaseError(error, "Detail akun tidak dapat dibaca.");
  if (!data) throw new HttpError(404, "ACCOUNT_NOT_FOUND", "Akun tidak ditemukan.");
  const { data: authUser, error: authError } = await supa().auth.admin.getUserById(data.id);
  if (authError) throw new HttpError(503, "AUTH_USER_LOOKUP_FAILED", "Email akun tidak dapat diverifikasi.");
  return sendData(res, { ...data, email: authUser?.user?.email ?? null });
}));

router.post("/accounts", authenticate, allowRoles("admin"), asyncHandler(async (req, res) => {
  const input = parseBody(createAccountSchema, req.body);
  const { data: created, error: createError } = await supa().auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.full_name },
  });
  if (createError || !created?.user) {
    if (/already|exists/i.test(createError?.message ?? "")) throw new HttpError(409, "ACCOUNT_EXISTS", "Email sudah terdaftar.");
    throw new HttpError(400, "ACCOUNT_CREATE_FAILED", "Akun tidak dapat dibuat. Periksa konfigurasi Supabase Auth.");
  }
  const profilePatch = {
    full_name: input.full_name,
    identity_code: input.identity_code ?? null,
    member_category: input.member_category ?? null,
    app_role: input.app_role,
    account_status: input.account_status,
  };
  const { data, error } = await supa().from("profiles").update(profilePatch).eq("id", created.user.id)
    .select("id,identity_code,full_name,app_role,member_category,account_status,phone_e164,created_at,updated_at").single();
  if (error) {
    await supa().auth.admin.deleteUser(created.user.id);
    supabaseError(error, "Profil akun tidak dapat dibuat.");
  }
  if (input.app_role === "counselor") {
    const { error: counselorError } = await supa().from("counselor_profiles").upsert({ profile_id: data.id, public_name: input.full_name, is_public: false }, { onConflict: "profile_id" });
    if (counselorError) {
      await supa().auth.admin.deleteUser(created.user.id);
      supabaseError(counselorError, "Profil konselor tidak dapat disiapkan.");
    }
  }
  await writeAudit({ actorUserId: req.auth.user.id, action: "admin.account.create", entityType: "profile", entityId: data.id, metadata: { role: input.app_role, status: input.account_status } });
  return sendData(res, { ...data, email: created.user.email ?? input.email }, 201);
}));

router.patch("/accounts/:id", authenticate, allowRoles("admin"), asyncHandler(async (req, res) => {
  if (!uuid.safeParse(req.params.id).success) throw new HttpError(400, "INVALID_ID", "ID akun tidak valid.");
  const input = parseBody(patchAccountSchema, req.body);
  if (!Object.keys(input).length) throw new HttpError(400, "VALIDATION_ERROR", "Minimal satu field harus dikirim.");
  if (req.params.id === req.auth.user.id && (input.app_role && input.app_role !== "admin" || input.account_status && input.account_status !== "active")) {
    throw new HttpError(409, "SELF_ADMIN_CHANGE_BLOCKED", "Admin tidak dapat menurunkan role atau menonaktifkan akunnya sendiri.");
  }
  const { data: current, error: currentError } = await supa().from("profiles").select("id,app_role,account_status").eq("id", req.params.id).maybeSingle();
  if (currentError) supabaseError(currentError);
  if (!current) throw new HttpError(404, "ACCOUNT_NOT_FOUND", "Akun tidak ditemukan.");
  const losingAdmin = current.app_role === "admin" && current.account_status === "active" &&
    ((input.app_role && input.app_role !== "admin") || (input.account_status && input.account_status !== "active"));
  if (losingAdmin) {
    const { count, error: countError } = await supa().from("profiles").select("id", { count: "exact", head: true }).eq("app_role", "admin").eq("account_status", "active");
    if (countError) supabaseError(countError);
    if ((count ?? 0) <= 1) throw new HttpError(409, "LAST_ADMIN", "Tidak dapat menonaktifkan atau menurunkan role admin aktif terakhir.");
  }
  const { data, error } = await supa().from("profiles").update(input).eq("id", req.params.id)
    .select("id,identity_code,full_name,app_role,member_category,account_status,phone_e164,whatsapp_opt_in,created_at,updated_at").maybeSingle();
  if (error) supabaseError(error, "Akun tidak dapat diperbarui.");
  if (!data) throw new HttpError(404, "ACCOUNT_NOT_FOUND", "Akun tidak ditemukan.");
  if (input.app_role === "counselor" || current.app_role === "counselor") {
    if (data.app_role === "counselor") {
      const { error: counselorError } = await supa().from("counselor_profiles").upsert({ profile_id: data.id, public_name: data.full_name, is_public: false }, { onConflict: "profile_id", ignoreDuplicates: true });
      if (counselorError) supabaseError(counselorError, "Profil konselor tidak dapat disiapkan.");
      if (data.account_status !== "active") {
        const { error: hideError } = await supa().from("counselor_profiles").update({ is_public: false }).eq("profile_id", data.id);
        if (hideError) supabaseError(hideError, "Publikasi profil konselor tidak dapat dihentikan.");
      }
    } else {
      const { error: hideError } = await supa().from("counselor_profiles").update({ is_public: false }).eq("profile_id", data.id);
      if (hideError) supabaseError(hideError, "Publikasi profil konselor tidak dapat dihentikan.");
    }
  }
  await writeAudit({ actorUserId: req.auth.user.id, action: "admin.account.update", entityType: "profile", entityId: data.id, metadata: { role: data.app_role, status: data.account_status } });
  return sendData(res, data);
}));

router.delete("/accounts/:id", authenticate, allowRoles("admin"), asyncHandler(async (req, res) => {
  if (!uuid.safeParse(req.params.id).success) throw new HttpError(400, "INVALID_ID", "ID akun tidak valid.");
  if (req.params.id === req.auth.user.id) throw new HttpError(409, "SELF_ADMIN_CHANGE_BLOCKED", "Admin tidak dapat menonaktifkan akunnya sendiri.");
  const { data: current, error: currentError } = await supa().from("profiles").select("id,app_role,account_status").eq("id", req.params.id).maybeSingle();
  if (currentError) supabaseError(currentError);
  if (!current) throw new HttpError(404, "ACCOUNT_NOT_FOUND", "Akun tidak ditemukan.");
  if (current.app_role === "admin" && current.account_status === "active") {
    const { count, error } = await supa().from("profiles").select("id", { count: "exact", head: true }).eq("app_role", "admin").eq("account_status", "active");
    if (error) supabaseError(error);
    if ((count ?? 0) <= 1) throw new HttpError(409, "LAST_ADMIN", "Tidak dapat menonaktifkan admin aktif terakhir.");
  }
  const { data, error } = await supa().from("profiles").update({ account_status: "disabled" }).eq("id", req.params.id)
    .select("id,app_role,account_status").single();
  if (error) supabaseError(error, "Akun tidak dapat dinonaktifkan.");
  if (data.app_role === "counselor") {
    const { error: hideError } = await supa().from("counselor_profiles").update({ is_public: false }).eq("profile_id", data.id);
    if (hideError) supabaseError(hideError, "Akun dinonaktifkan tetapi publikasi konselor gagal dihentikan.");
  }
  await writeAudit({ actorUserId: req.auth.user.id, action: "admin.account.update", entityType: "profile", entityId: data.id, metadata: { role: data.app_role, status: "disabled" } });
  return sendData(res, { ...data, deactivated: true });
}));

router.patch("/counselors/:id/publication", authenticate, allowRoles("admin"), asyncHandler(async (req, res) => {
  if (!uuid.safeParse(req.params.id).success) throw new HttpError(400, "INVALID_ID", "ID konselor tidak valid.");
  const input = parseBody(publicToggleSchema, req.body);
  const { data: profile, error: profileError } = await supa().from("profiles").select("id,app_role,account_status,full_name").eq("id", req.params.id).maybeSingle();
  if (profileError) supabaseError(profileError);
  if (!profile || profile.app_role !== "counselor" || profile.account_status !== "active") throw new HttpError(404, "COUNSELOR_NOT_FOUND", "Konselor aktif tidak ditemukan.");
  const { data: counselor, error: counselorError } = await supa().from("counselor_profiles").select("profile_id,public_name").eq("profile_id", req.params.id).maybeSingle();
  if (counselorError) supabaseError(counselorError);
  if (!counselor) throw new HttpError(404, "COUNSELOR_PROFILE_NOT_FOUND", "Profil konselor belum tersedia.");
  if (input.is_public && !counselor.public_name?.trim()) throw new HttpError(400, "PUBLIC_NAME_REQUIRED", "Nama publik konselor harus diisi sebelum dipublikasikan.");
  const { data, error } = await supa().from("counselor_profiles").update({ is_public: input.is_public }).eq("profile_id", req.params.id)
    .select("profile_id,public_name,is_public,updated_at").single();
  if (error) supabaseError(error, "Status publikasi tidak dapat diperbarui.");
  await writeAudit({ actorUserId: req.auth.user.id, action: "admin.counselor.publication", entityType: "counselor_profile", entityId: data.profile_id, metadata: { status: input.is_public ? "shown" : "disabled", role: "admin" } });
  return sendData(res, data);
}));

router.get("/periods", authenticate, allowRoles("admin"), asyncHandler(async (_req, res) => {
  const { data, error } = await supa().from("academic_periods").select("id,academic_year,semester,starts_on,ends_on,is_published,created_at,updated_at").order("starts_on", { ascending: false });
  if (error) supabaseError(error, "Daftar periode akademik tidak dapat dibaca.");
  return sendData(res, data ?? []);
}));

router.post("/periods", authenticate, allowRoles("admin"), asyncHandler(async (req, res) => {
  const input = parseBody(periodSchema, req.body);
  const { data, error } = await supa().from("academic_periods").insert(input)
    .select("id,academic_year,semester,starts_on,ends_on,is_published,created_at,updated_at").single();
  if (error) supabaseError(error, "Periode akademik tidak dapat dibuat.");
  await writeAudit({ actorUserId: req.auth.user.id, action: "admin.period.create", entityType: "academic_period", entityId: data.id, metadata: { status: input.is_published ? "published" : "draft", role: "admin" } });
  return sendData(res, data, 201);
}));

router.patch("/periods/:id", authenticate, allowRoles("admin"), asyncHandler(async (req, res) => {
  if (!uuid.safeParse(req.params.id).success) throw new HttpError(400, "INVALID_ID", "ID periode tidak valid.");
  const input = parseBody(periodPatchSchema, req.body);
  if (!Object.keys(input).length) throw new HttpError(400, "VALIDATION_ERROR", "Minimal satu field harus dikirim.");
  const { data: current, error: currentError } = await supa().from("academic_periods").select("starts_on,ends_on").eq("id", req.params.id).maybeSingle();
  if (currentError) supabaseError(currentError);
  if (!current) throw new HttpError(404, "PERIOD_NOT_FOUND", "Periode akademik tidak ditemukan.");
  const starts = input.starts_on ?? current.starts_on;
  const ends = input.ends_on ?? current.ends_on;
  if (ends < starts) throw new HttpError(400, "INVALID_DATE_RANGE", "Tanggal akhir harus sama dengan atau setelah tanggal mulai.");
  const { data, error } = await supa().from("academic_periods").update(input).eq("id", req.params.id)
    .select("id,academic_year,semester,starts_on,ends_on,is_published,created_at,updated_at").maybeSingle();
  if (error) supabaseError(error, "Periode akademik tidak dapat diperbarui.");
  if (!data) throw new HttpError(404, "PERIOD_NOT_FOUND", "Periode akademik tidak ditemukan.");
  await writeAudit({ actorUserId: req.auth.user.id, action: "admin.period.update", entityType: "academic_period", entityId: data.id, metadata: { status: data.is_published ? "published" : "draft", role: "admin" } });
  return sendData(res, data);
}));

router.delete("/periods/:id", authenticate, allowRoles("admin"), asyncHandler(async (req, res) => {
  if (!uuid.safeParse(req.params.id).success) throw new HttpError(400, "INVALID_ID", "ID periode tidak valid.");
  const { count, error: slotsError } = await supa().from("availability_slots").select("id", { count: "exact", head: true }).eq("academic_period_id", req.params.id);
  if (slotsError) supabaseError(slotsError);
  if ((count ?? 0) > 0) throw new HttpError(409, "PERIOD_HAS_SLOTS", "Periode masih memiliki jadwal. Batalkan atau pindahkan jadwal terlebih dahulu.");
  const { data, error } = await supa().from("academic_periods").delete().eq("id", req.params.id).select("id").maybeSingle();
  if (error) supabaseError(error, "Periode akademik tidak dapat dihapus.");
  if (!data) throw new HttpError(404, "PERIOD_NOT_FOUND", "Periode akademik tidak ditemukan.");
  await writeAudit({ actorUserId: req.auth.user.id, action: "admin.period.delete", entityType: "academic_period", entityId: data.id, metadata: { role: "admin" } });
  return sendData(res, { deleted: true, id: data.id });
}));

router.get("/counseling", authenticate, allowRoles("admin", "head_lmi"), asyncHandler(async (req, res) => {
  const parsed = limitSchema.safeParse(req.query);
  if (!parsed.success) throw new HttpError(400, "VALIDATION_ERROR", "Limit tidak valid.", parsed.error.issues);
  const { data, error } = await supa().from("bookings")
    .select("id,client_id,counselor_id,availability_slot_id,service_type,group_name,participant_count,starts_at,ends_at,status,cancellation_reason,reschedule_reason,created_at,updated_at,client:profiles!bookings_client_id_fkey(id,full_name),counselor:profiles!bookings_counselor_id_fkey(id,full_name),booking_participants(id,display_name,is_representative),counseling_sessions(id,status,format,room,started_at,completed_at)")
    .order("starts_at", { ascending: false }).limit(parsed.data.limit);
  if (error) supabaseError(error, "Data konseling tidak dapat dibaca.");
  return sendData(res, data ?? []);
}));

router.get("/activity", authenticate, allowRoles("admin"), asyncHandler(async (req, res) => {
  const parsed = limitSchema.safeParse(req.query);
  if (!parsed.success) throw new HttpError(400, "VALIDATION_ERROR", "Limit tidak valid.", parsed.error.issues);
  const [bookings, sessions, feedback] = await Promise.all([
    supa().from("bookings").select("id,status,client_id,counselor_id,created_at,updated_at").order("updated_at", { ascending: false }).limit(parsed.data.limit),
    supa().from("counseling_sessions").select("id,booking_id,status,counselor_id,created_at,updated_at").order("updated_at", { ascending: false }).limit(parsed.data.limit),
    supa().from("feedback").select("id,session_id,moderation_status,review_status,created_at,updated_at").order("updated_at", { ascending: false }).limit(parsed.data.limit),
  ]);
  for (const result of [bookings, sessions, feedback]) if (result.error) supabaseError(result.error, "Aktivitas admin tidak dapat dibaca.");
  const items = [
    ...(bookings.data ?? []).map((x) => ({ id: x.id, entity_type: "booking", status: x.status, created_at: x.created_at, updated_at: x.updated_at, entity_id: x.id })),
    ...(sessions.data ?? []).map((x) => ({ id: x.id, entity_type: "session", status: x.status, created_at: x.created_at, updated_at: x.updated_at, entity_id: x.id })),
    ...(feedback.data ?? []).map((x) => ({ id: x.id, entity_type: "feedback", status: x.moderation_status, review_status: x.review_status, created_at: x.created_at, updated_at: x.updated_at, entity_id: x.id })),
  ].sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at)).slice(0, parsed.data.limit);
  return sendData(res, items);
}));

// Hero motivational sentences are managed by admins and exposed publicly only when active.
router.get("/hero-motivations", authenticate, allowRoles("admin"), asyncHandler(async (_req, res) => {
  const { data, error } = await supa().from("hero_motivations")
    .select("id,content,is_active,created_at,updated_at")
    .order("created_at", { ascending: true });
  if (error) supabaseError(error, "Daftar kalimat motivasi tidak dapat dibaca.");
  return sendData(res, data ?? []);
}));

router.post("/hero-motivations", authenticate, allowRoles("admin"), asyncHandler(async (req, res) => {
  const input = parseBody(heroMotivationCreateSchema, req.body);
  const { data, error } = await supa().from("hero_motivations").insert(input)
    .select("id,content,is_active,created_at,updated_at").single();
  if (error) supabaseError(error, "Kalimat motivasi tidak dapat dibuat.");
  await writeAudit({
    actorUserId: req.auth.user.id,
    action: "admin.hero_motivation.create",
    entityType: "hero_motivation",
    entityId: data.id,
    metadata: { status: data.is_active ? "active" : "inactive" },
  });
  return sendData(res, data, 201);
}));

router.patch("/hero-motivations/:id", authenticate, allowRoles("admin"), asyncHandler(async (req, res) => {
  if (!uuid.safeParse(req.params.id).success) throw new HttpError(400, "INVALID_ID", "ID kalimat motivasi tidak valid.");
  const input = parseBody(heroMotivationPatchSchema, req.body);
  if (!Object.keys(input).length) throw new HttpError(400, "VALIDATION_ERROR", "Minimal satu field harus dikirim.");
  const { data, error } = await supa().from("hero_motivations").update(input).eq("id", req.params.id)
    .select("id,content,is_active,created_at,updated_at").maybeSingle();
  if (error) supabaseError(error, "Kalimat motivasi tidak dapat diperbarui.");
  if (!data) throw new HttpError(404, "HERO_MOTIVATION_NOT_FOUND", "Kalimat motivasi tidak ditemukan.");
  await writeAudit({
    actorUserId: req.auth.user.id,
    action: "admin.hero_motivation.update",
    entityType: "hero_motivation",
    entityId: data.id,
    metadata: { status: data.is_active ? "active" : "inactive" },
  });
  return sendData(res, data);
}));

router.delete("/hero-motivations/:id", authenticate, allowRoles("admin"), asyncHandler(async (req, res) => {
  if (!uuid.safeParse(req.params.id).success) throw new HttpError(400, "INVALID_ID", "ID kalimat motivasi tidak valid.");
  const { data, error } = await supa().from("hero_motivations").delete().eq("id", req.params.id)
    .select("id").maybeSingle();
  if (error) supabaseError(error, "Kalimat motivasi tidak dapat dihapus.");
  if (!data) throw new HttpError(404, "HERO_MOTIVATION_NOT_FOUND", "Kalimat motivasi tidak ditemukan.");
  await writeAudit({
    actorUserId: req.auth.user.id,
    action: "admin.hero_motivation.delete",
    entityType: "hero_motivation",
    entityId: data.id,
    metadata: { role: "admin" },
  });
  return sendData(res, { deleted: true, id: data.id });
}));

router.get("/whatsapp/health", authenticate, allowRoles("admin"), asyncHandler(async (_req, res) => {
  const fonnteConfig = fonnteService.checkConfiguration();

  let stats = {
    total: 0,
    pending: 0,
    processing: 0,
    accepted: 0,
    delivered: 0,
    retry_wait: 0,
    failed: 0,
    cancelled: 0,
    unknown: 0,
  };

  try {
    const { data: rpcStats, error: rpcError } = await supa().rpc("sicare_get_whatsapp_stats");
    if (!rpcError && rpcStats) {
      stats = rpcStats;
    } else {
      const { data: rows } = await supa().from("whatsapp_outbox").select("status");
      if (rows) {
        stats.total = rows.length;
        for (const row of rows) {
          if (row.status in stats) stats[row.status]++;
          else if (row.status === "queued") stats.pending++;
          else if (row.status === "sending") stats.processing++;
        }
      }
    }
  } catch {
    // Graceful fallback if database is inaccessible
  }

  const { data: recentErrors } = await supa()
    .from("whatsapp_outbox")
    .select("id,message_type,status,last_error_code,last_error_message,attempt_count,error_category,updated_at")
    .in("status", ["failed", "retry_wait", "unknown"])
    .order("updated_at", { ascending: false })
    .limit(10);

  return sendData(res, {
    provider: {
      name: "Fonnte",
      configured: fonnteConfig.configured,
      send_enabled: fonnteConfig.sendEnabled,
      test_mode: fonnteConfig.testMode,
      api_url: fonnteConfig.apiUrl,
      timeout_ms: fonnteConfig.timeoutMs,
      test_recipients_count: fonnteConfig.testRecipientsCount,
    },
    outbox: stats,
    recent_issues: recentErrors ?? [],
    timestamp: new Date().toISOString(),
  });
}));

export default router;
