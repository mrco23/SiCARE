import { Router } from "express";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { env } from "../config/env.js";
import { getSupabaseAdminClient } from "../config/supabase.js";
import { authenticate } from "../middleware/auth.js";
import { asyncHandler, HttpError, parseBody, sendData, supabaseError } from "../lib/http.js";
import { writeAudit } from "../lib/audit.js";

const router = Router();
const registerSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128),
  full_name: z.string().trim().min(1).max(160),
  identity_code: z.string().trim().min(1).max(80).regex(/^[A-Za-z0-9._/-]+$/).optional(),
  member_category: z.enum(["student", "faculty_staff", "other"]).optional(),
}).strict();
const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128),
}).strict();

function getPublicAuthClient() {
  const key = env.SUPABASE_PUBLISHABLE_KEY ?? env.SUPABASE_ANON_KEY;
  if (!env.SUPABASE_URL || !key) {
    throw new HttpError(503, "AUTH_NOT_CONFIGURED", "SUPABASE_PUBLISHABLE_KEY belum dikonfigurasi pada backend.");
  }
  return createClient(env.SUPABASE_URL, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

router.post("/register", asyncHandler(async (request, response) => {
  // Validate before any external service call. Public registration cannot set an application role.
  const input = parseBody(registerSchema, request.body);
  const authClient = getPublicAuthClient();

  if (input.identity_code) {
    const { data: existing, error: identityError } = await getSupabaseAdminClient()
      .from("profiles").select("id").ilike("identity_code", input.identity_code).limit(1).maybeSingle();
    if (identityError) throw new HttpError(503, "IDENTITY_LOOKUP_FAILED", "Kode identitas tidak dapat diverifikasi.");
    if (existing) throw new HttpError(409, "IDENTITY_EXISTS", "Kode identitas sudah terdaftar.");
  }

  const { data, error } = await authClient.auth.signUp({
    email: input.email,
    password: input.password,
    options: { data: { full_name: input.full_name } },
  });
  if (error) {
    if (/already registered|already exists/i.test(error.message)) {
      throw new HttpError(409, "ACCOUNT_EXISTS", "Email sudah terdaftar.");
    }
    throw new HttpError(400, "REGISTER_FAILED", "Registrasi tidak dapat diproses. Periksa data dan konfigurasi email Supabase.");
  }

  if (data.user && (input.identity_code || input.member_category)) {
    const patch = {};
    if (input.identity_code) patch.identity_code = input.identity_code;
    if (input.member_category) patch.member_category = input.member_category;
    const { error: profileError } = await getSupabaseAdminClient().from("profiles").update(patch).eq("id", data.user.id);
    if (profileError) supabaseError(profileError, "Profil awal gagal disimpan.");
  }

  await writeAudit({ actorUserId: data.user?.id ?? null, action: "auth.register", entityType: "profile", entityId: data.user?.id ?? null, metadata: { role: "client" } });
  return sendData(response, {
    user: data.user ? { id: data.user.id, email: data.user.email } : null,
    session: data.session,
    email_confirmation_required: !data.session,
  }, 201);
}));

router.post("/login", asyncHandler(async (request, response) => {
  const input = parseBody(loginSchema, request.body);
  const { data, error } = await getPublicAuthClient().auth.signInWithPassword(input);
  if (error || !data.user || !data.session) {
    throw new HttpError(401, "INVALID_CREDENTIALS", "Email atau password tidak benar, atau email belum dikonfirmasi.");
  }

  const { data: profile, error: profileError } = await getSupabaseAdminClient().from("profiles")
    .select("id,identity_code,full_name,app_role,member_category,account_status")
    .eq("id", data.user.id).maybeSingle();
  if (profileError) throw new HttpError(503, "PROFILE_LOOKUP_FAILED", "Profil tidak dapat diverifikasi.");
  if (!profile || profile.account_status !== "active") {
    throw new HttpError(403, "ACCOUNT_INACTIVE", "Akun belum aktif atau telah dinonaktifkan.");
  }
  return sendData(response, { user: { id: data.user.id, email: data.user.email }, profile, session: data.session });
}));

router.get("/me", authenticate, (request, response) => sendData(response, {
  user: { id: request.auth.user.id, email: request.auth.user.email },
  profile: request.auth.profile,
}));

router.post("/logout", authenticate, (_request, response) => {
  // Supabase access tokens are stateless here; the client must clear its local session.
  return response.status(200).json({ data: { logged_out: true }, message: "Hapus session lokal di client." });
});

export default router;
