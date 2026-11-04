import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { env } from "../config/env.js";
import { getSupabaseAdminClient } from "../config/supabase.js";
import { HttpError } from "../lib/http.js";
import { writeAudit } from "../lib/audit.js";

let testPublicAuthClient = null;

export function setPublicAuthClientForTests(client = null) {
  testPublicAuthClient = client;
}

export function getPublicAuthClient() {
  if (testPublicAuthClient) return testPublicAuthClient;
  const key = env.SUPABASE_PUBLISHABLE_KEY ?? env.SUPABASE_ANON_KEY;
  if (!env.SUPABASE_URL || !key) {
    throw new HttpError(503, "AUTH_NOT_CONFIGURED", "SUPABASE_PUBLISHABLE_KEY belum dikonfigurasi pada backend.");
  }
  return createClient(env.SUPABASE_URL, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

export function getTrustedConfirmationCallbackUrl(request) {
  const originHeader = request.headers.origin;
  const isAllowedOrigin = originHeader && env.frontendOrigins.includes(originHeader);
  const baseUrl = isAllowedOrigin ? originHeader : env.appBaseUrl;
  return `${baseUrl.replace(/\/+$/, "")}/auth/confirmed`;
}

// In-memory cooldown tracker: Map<normalized_email, timestamp>
const resendCooldowns = new Map();
const RESEND_COOLDOWN_MS = 60 * 1000;

export async function rollbackCreatedAuthUser(userId) {
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

export async function registerUser(input, request) {
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

  const emailRedirectTo = getTrustedConfirmationCallbackUrl(request);

  const { data, error } = await authClient.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: { full_name: input.full_name },
      emailRedirectTo,
    },
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

  return {
    user: { id: createdUser.id, email: createdUser.email },
    session: data.session,
    email_confirmation_required: !data.session,
  };
}

export async function resendConfirmation(input, request) {
  const identifier = (input.identifier ?? input.email ?? "").trim();
  const admin = getSupabaseAdminClient();
  let email = identifier;

  // If identifier is not email (e.g. NIM/NIP), resolve it to registered email
  if (!z.string().email().safeParse(identifier).success) {
    const escapedIdentifier = identifier.replace(/[\\%_]/g, "\\$&");
    const { data: identityProfile } = await admin
      .from("profiles")
      .select("id")
      .ilike("identity_code", escapedIdentifier)
      .maybeSingle();

    if (identityProfile) {
      const { data: authUserData } = await admin.auth.admin.getUserById(identityProfile.id);
      if (authUserData?.user?.email) {
        email = authUserData.user.email;
      }
    }
  }

  const normalizedEmail = email.toLowerCase();

  // Cooldown check
  const now = Date.now();
  const lastSent = resendCooldowns.get(normalizedEmail);
  if (lastSent && now - lastSent < RESEND_COOLDOWN_MS) {
    const remainingSeconds = Math.ceil((RESEND_COOLDOWN_MS - (now - lastSent)) / 1000);
    throw new HttpError(
      429,
      "RATE_LIMITED",
      `Mohon tunggu ${remainingSeconds} detik sebelum meminta pengiriman ulang email verifikasi.`,
    );
  }

  const emailRedirectTo = getTrustedConfirmationCallbackUrl(request);
  const authClient = getPublicAuthClient();

  const { error } = await authClient.auth.resend({
    type: "signup",
    email: normalizedEmail,
    options: {
      emailRedirectTo,
    },
  });

  if (error) {
    if (/rate limit|too many requests/i.test(error.message)) {
      throw new HttpError(
        429,
        "RATE_LIMITED",
        "Terlalu banyak permintaan pengiriman email verifikasi. Silakan coba beberapa saat lagi.",
      );
    }
    if (/already confirmed|confirmed/i.test(error.message)) {
      return {
        sent: false,
        message: "Email ini sudah dikonfirmasi sebelumnya. Silakan langsung masuk ke akun Anda.",
      };
    }
  }

  resendCooldowns.set(normalizedEmail, now);
  if (resendCooldowns.size > 1000) {
    for (const [key, timestamp] of resendCooldowns.entries()) {
      if (now - timestamp > RESEND_COOLDOWN_MS) {
        resendCooldowns.delete(key);
      }
    }
  }

  return {
    sent: true,
    message: "Jika email terdaftar dan belum dikonfirmasi, tautan verifikasi telah dikirimkan ke kotak masuk Anda.",
  };
}

export async function loginUser(input) {
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
      throw new HttpError(401, "INVALID_CREDENTIALS", "NIM/NIP/email atau kata sandi tidak benar.");
    }

    const { data: authUserData, error: authUserError } = await admin.auth.admin.getUserById(identityProfile.id);
    if (authUserError) {
      throw new HttpError(503, "AUTH_USER_LOOKUP_FAILED", "Akun tidak dapat diverifikasi saat ini.");
    }
    if (!authUserData.user?.email) {
      throw new HttpError(401, "INVALID_CREDENTIALS", "NIM/NIP/email atau kata sandi tidak benar.");
    }
    email = authUserData.user.email;
  }

  const { data, error } = await getPublicAuthClient().auth.signInWithPassword({
    email,
    password: input.password,
  });
  if (error || !data.user || !data.session) {
    if (error && /email not confirmed/i.test(error.message)) {
      throw new HttpError(403, "EMAIL_NOT_CONFIRMED", "Email akun Anda belum diverifikasi. Silakan periksa kotak masuk atau spam email Anda untuk mengonfirmasi akun sebelum masuk.");
    }
    throw new HttpError(401, "INVALID_CREDENTIALS", "NIM/NIP/email atau kata sandi tidak benar.");
  }

  // Explicit verification: reject login if email has not been confirmed
  const isEmailConfirmed = Boolean(data.user.email_confirmed_at || data.user.confirmed_at);
  if (!isEmailConfirmed) {
    throw new HttpError(403, "EMAIL_NOT_CONFIRMED", "Email akun Anda belum diverifikasi. Silakan periksa kotak masuk atau spam email Anda untuk mengonfirmasi akun sebelum masuk.");
  }

  const { data: profile, error: profileError } = await admin.from("profiles")
    .select("id,identity_code,full_name,app_role,member_category,account_status")
    .eq("id", data.user.id).maybeSingle();
  if (profileError) throw new HttpError(503, "PROFILE_LOOKUP_FAILED", "Profil tidak dapat diverifikasi.");
  if (!profile || profile.account_status !== "active") {
    throw new HttpError(403, "ACCOUNT_INACTIVE", "Akun belum aktif atau telah dinonaktifkan.");
  }
  return { user: { id: data.user.id, email: data.user.email }, profile, session: data.session };
}

