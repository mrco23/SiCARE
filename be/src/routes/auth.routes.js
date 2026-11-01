import { Router } from "express";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { env } from "../config/env.js";
import { getSupabaseAdminClient } from "../config/supabase.js";
import { authenticate } from "../middleware/auth.js";
import { asyncHandler, HttpError, parseBody, sendData } from "../lib/http.js";
import { writeAudit } from "../lib/audit.js";

const router = Router();
const registerSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128),
  full_name: z.string().trim().min(1).max(160),
  identity_code: z.string().trim().min(1).max(80).regex(/^[A-Za-z0-9._/-]+$/).optional(),
  member_category: z.enum(["student", "faculty_staff", "other"]).optional(),
  phone_e164: z.string().trim().regex(/^\+[1-9]\d{6,14}$/).optional(),
}).strict();
const loginSchema = z.object({
  identifier: z.string().trim().min(1).max(254).optional(),
  email: z.string().trim().email().max(254).optional(),
  password: z.string().min(1).max(128),
}).strict().refine((input) => Boolean(input.identifier || input.email), {
  path: ["identifier"],
  message: "Email atau kode identitas wajib diisi.",
});

function getPublicAuthClient() {
  const key = env.SUPABASE_PUBLISHABLE_KEY ?? env.SUPABASE_ANON_KEY;
  if (!env.SUPABASE_URL || !key) {
    throw new HttpError(503, "AUTH_NOT_CONFIGURED", "SUPABASE_PUBLISHABLE_KEY belum dikonfigurasi pada backend.");
  }
  return createClient(env.SUPABASE_URL, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

async function rollbackCreatedAuthUser(userId) {
  try {
    const { error } = await getSupabaseAdminClient().auth.admin.deleteUser(userId);
    if (error) {
      console.error("Registration rollback failed", {
        stage: "profile_initialization",
        code: typeof error.code === "string" ? error.code : "UNKNOWN",
      });
      return false;
    }
    return true;
  } catch (error) {
    console.error("Registration rollback failed", {
      stage: "profile_initialization",
      code: typeof error?.code === "string" ? error.code : "UNKNOWN",
    });
    return false;
  }
}

router.post("/register", asyncHandler(async (request, response) => {
  // Validate before any external service call. Public registration cannot set an application role.
  const input = parseBody(registerSchema, request.body);
  const admin = getSupabaseAdminClient();
  const authClient = getPublicAuthClient();

  // This pre-check improves the error message for exact matches. The unique database
  // index remains authoritative for case/whitespace variants and concurrent requests.
  if (input.identity_code) {
    const { data: existing, error: identityError } = await admin
      .from("profiles").select("id").eq("identity_code", input.identity_code).limit(1).maybeSingle();
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

  const createdUser = data?.user;
  if (!createdUser?.id) {
    throw new HttpError(503, "REGISTER_INCOMPLETE", "Supabase tidak mengembalikan akun yang dapat diverifikasi.");
  }

  // The auth trigger creates a basic profile. Complete it in one update, and roll back
  // the Auth user if that update fails so a partial registration is not silently kept.
  const profilePatch = { full_name: input.full_name };
  if (input.identity_code !== undefined) profilePatch.identity_code = input.identity_code;
  if (input.member_category !== undefined) profilePatch.member_category = input.member_category;
  if (input.phone_e164 !== undefined) profilePatch.phone_e164 = input.phone_e164;

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .update(profilePatch)
    .eq("id", createdUser.id)
    .select("id")
    .maybeSingle();

  if (profileError || !profile) {
    const rollbackSucceeded = await rollbackCreatedAuthUser(createdUser.id);
    if (!rollbackSucceeded) {
      throw new HttpError(
        503,
        "REGISTER_ROLLBACK_FAILED",
        "Pendaftaran belum dapat diselesaikan. Akun mungkin sudah terbentuk; hubungi administrator sebelum mencoba lagi.",
      );
    }

    if (profileError?.code === "23505") {
      throw new HttpError(409, "IDENTITY_EXISTS", "Kode identitas sudah terdaftar.");
    }
    throw new HttpError(503, "PROFILE_INITIALIZATION_FAILED", "Profil awal gagal disimpan. Silakan coba registrasi kembali.");
  }

  await writeAudit({
    actorUserId: createdUser.id,
    action: "auth.register",
    entityType: "profile",
    entityId: createdUser.id,
    metadata: { role: "client" },
  });

  return sendData(response, {
    user: { id: createdUser.id, email: createdUser.email },
    session: data.session,
    email_confirmation_required: !data.session,
  }, 201);
}));

router.post("/login", asyncHandler(async (request, response) => {
  const input = parseBody(loginSchema, request.body);
  const identifier = (input.identifier ?? input.email ?? "").trim();
  const admin = getSupabaseAdminClient();
  let email = identifier;

  // The public form supports email, NIM, or NIP. Resolve non-email identifiers
  // server-side so the browser never needs access to auth.users or an admin key.
  if (!z.string().email().safeParse(identifier).success) {
    const escapedIdentifier = identifier.replace(/[\\%_]/g, "\\$&");
    const { data: identityProfile, error: identityError } = await admin
      .from("profiles")
      .select("id")
      .ilike("identity_code", escapedIdentifier)
      .maybeSingle();

    if (identityError) {
      throw new HttpError(503, "IDENTITY_LOOKUP_FAILED", "Kode identitas tidak dapat diverifikasi.");
    }
    if (!identityProfile) {
      throw new HttpError(401, "INVALID_CREDENTIALS", "Email/kode identitas atau kata sandi tidak benar, atau email belum dikonfirmasi.");
    }

    const { data: authUserData, error: authUserError } = await admin.auth.admin.getUserById(identityProfile.id);
    if (authUserError) {
      throw new HttpError(503, "AUTH_USER_LOOKUP_FAILED", "Akun tidak dapat diverifikasi saat ini.");
    }
    if (!authUserData.user?.email) {
      throw new HttpError(401, "INVALID_CREDENTIALS", "Email/kode identitas atau kata sandi tidak benar, atau email belum dikonfirmasi.");
    }
    email = authUserData.user.email;
  }

  const { data, error } = await getPublicAuthClient().auth.signInWithPassword({
    email,
    password: input.password,
  });
  if (error || !data.user || !data.session) {
    throw new HttpError(401, "INVALID_CREDENTIALS", "Email/kode identitas atau kata sandi tidak benar, atau email belum dikonfirmasi.");
  }

  const { data: profile, error: profileError } = await admin.from("profiles")
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
