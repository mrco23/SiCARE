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
    throw new HttpError(503, "AUTH_NOT_CONFIGURED", "SUPABASE_PUBLISHABLE_KEY belum dikonfigurasi pada server.");
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

/**
 * Maps a Supabase signUp error to a specific API error and logs only its status/code (never the
 * email), so the real cause (SMTP, rate limit, password policy) is visible in the server logs.
 * @param {{ status?: number, code?: string, message?: string } | null | undefined} error
 * @returns {HttpError}
 */
export function signUpErrorToHttp(error) {
  const status = Number(error?.status);
  const code = String(error?.code ?? "");
  const message = String(error?.message ?? "");
  console.error("Registration sign-up failed", { status: Number.isFinite(status) ? status : null, code: code || "UNKNOWN" });

  if (code === "user_already_exists" || code === "email_exists" || /already registered|already exists/i.test(message)) {
    return new HttpError(409, "ACCOUNT_EXISTS", "Email sudah terdaftar.");
  }
  if (status === 429 || /rate_limit/i.test(code) || /rate limit|too many/i.test(message)) {
    return new HttpError(429, "RATE_LIMITED", "Batas pengiriman email verifikasi sedang tercapai. Silakan coba lagi beberapa menit lagi.");
  }
  if (code === "weak_password" || /password/i.test(message)) {
    return new HttpError(400, "PASSWORD_REJECTED", "Kata sandi ditolak sistem autentikasi. Gunakan kata sandi lain yang lebih kuat.");
  }
  if (code === "email_address_invalid" || code === "email_address_not_authorized" || /email address.*invalid|not authorized/i.test(message)) {
    return new HttpError(400, "EMAIL_REJECTED", "Alamat email ditolak sistem autentikasi. Periksa kembali email kampus Anda.");
  }
  if (code === "signup_disabled") {
    return new HttpError(503, "SIGNUP_DISABLED", "Pendaftaran akun sedang dinonaktifkan. Hubungi admin LMI.");
  }
  if (!status || status >= 500 || /sending|smtp|email/i.test(message)) {
    return new HttpError(503, "EMAIL_SEND_FAILED", "Email verifikasi tidak dapat dikirim saat ini. Silakan coba lagi nanti atau hubungi admin LMI.");
  }
  return new HttpError(400, "REGISTER_FAILED", "Registrasi tidak dapat diproses. Periksa kembali data Anda.");
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
    throw signUpErrorToHttp(error);
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

/**
 * Distinguishes a wrong password from Supabase throttling or an outage, so a client is not
 * told their password is wrong when the auth service only refused or failed the request.
 * @param {{ status?: number, code?: string, message?: string } | null | undefined} error
 * @returns {"rate_limited" | "unavailable" | "invalid"}
 */
export function classifySignInError(error) {
  if (!error) return "invalid";
  const status = Number(error.status);
  const message = String(error.message ?? "");
  if (status === 429 || /rate_limit/i.test(String(error.code ?? "")) || /rate limit|too many/i.test(message)) {
    return "rate_limited";
  }
  if (status === 0 || status >= 500 || error.name === "AuthRetryableFetchError") return "unavailable";
  return "invalid";
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
    if (error && (error.code === "email_not_confirmed" || /email not confirmed/i.test(error.message ?? ""))) {
      throw new HttpError(403, "EMAIL_NOT_CONFIRMED", "Email akun Anda belum diverifikasi. Silakan periksa kotak masuk atau spam email Anda untuk mengonfirmasi akun sebelum masuk.");
    }
    const failure = classifySignInError(error);
    if (failure === "rate_limited") {
      throw new HttpError(429, "RATE_LIMITED", "Terlalu banyak percobaan masuk. Silakan tunggu beberapa menit lalu coba lagi.");
    }
    if (failure === "unavailable") {
      throw new HttpError(503, "AUTH_UNAVAILABLE", "Layanan login sedang tidak dapat dijangkau. Silakan coba beberapa saat lagi.");
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


/**
 * Changes the signed-in user's Supabase Auth password after re-verifying the current one.
 * The new password is validated by strongPasswordSchema before reaching this function.
 */
export async function changeAccountPassword(auth, input) {
  const userId = auth?.user?.id;
  const email = auth?.user?.email;
  if (!userId || !email) {
    throw new HttpError(400, "PASSWORD_CHANGE_UNSUPPORTED", "Akun ini tidak memiliki email untuk verifikasi kata sandi.");
  }

  const { data, error } = await getPublicAuthClient().auth.signInWithPassword({
    email,
    password: input.current_password,
  });
  if (error || data?.user?.id !== userId) {
    if (error && /rate limit|too many/i.test(error.message ?? "")) {
      throw new HttpError(429, "RATE_LIMITED", "Terlalu banyak percobaan. Silakan coba beberapa saat lagi.");
    }
    throw new HttpError(400, "CURRENT_PASSWORD_INVALID", "Kata sandi saat ini tidak benar.");
  }

  const { error: updateError } = await getSupabaseAdminClient().auth.admin.updateUserById(userId, {
    password: input.new_password,
  });
  if (updateError) {
    if (/weak|pwned|leaked|should be different|same/i.test(updateError.message ?? "")) {
      throw new HttpError(400, "PASSWORD_REJECTED", "Kata sandi baru ditolak oleh sistem autentikasi. Gunakan kata sandi lain.");
    }
    throw new HttpError(503, "PASSWORD_UPDATE_FAILED", "Kata sandi belum dapat diperbarui. Silakan coba lagi.");
  }

  await writeAudit({
    actorUserId: userId,
    action: "auth.password_change",
    entityType: "profile",
    entityId: userId,
    metadata: {},
  });

  return { password_changed: true };
}

const passwordResetCooldowns = new Map();
const PASSWORD_RESET_COOLDOWN_MS = 60 * 1000;
/** Sesi pemulihan hanya boleh dipakai untuk mengganti kata sandi dalam 1 jam. */
const RECOVERY_SESSION_MAX_AGE_MS = 60 * 60 * 1000;

const PASSWORD_RESET_GENERIC_MESSAGE =
  "Jika akun terdaftar, tautan untuk mengatur ulang kata sandi telah dikirim ke email akun tersebut. Periksa juga folder spam.";

/**
 * Halaman frontend tujuan tautan reset, dari origin tepercaya (sama seperti tautan verifikasi).
 * @param {import("express").Request} request
 */
export function getTrustedPasswordResetUrl(request) {
  const originHeader = request.headers.origin;
  const isAllowedOrigin = originHeader && env.frontendOrigins.includes(originHeader);
  const baseUrl = isAllowedOrigin ? originHeader : env.appBaseUrl;
  return `${baseUrl.replace(/\/+$/, "")}/auth/reset-password`;
}

/**
 * Sends a password reset email for an email, NIM, or NIP. Always answers with the same
 * message so the endpoint does not reveal which accounts exist.
 * @param {{ identifier: string }} input
 * @param {import("express").Request} request
 */
export async function requestPasswordReset(input, request) {
  const identifier = input.identifier.trim();
  const admin = getSupabaseAdminClient();
  let email = z.string().email().safeParse(identifier).success ? identifier : null;

  if (!email) {
    const escapedIdentifier = identifier.replace(/[\\%_]/g, "\\$&");
    const { data: identityProfile } = await admin
      .from("profiles")
      .select("id")
      .ilike("identity_code", escapedIdentifier)
      .maybeSingle();
    if (identityProfile) {
      const { data: authUserData } = await admin.auth.admin.getUserById(identityProfile.id);
      email = authUserData?.user?.email ?? null;
    }
  }
  if (!email) return { sent: true, message: PASSWORD_RESET_GENERIC_MESSAGE };

  const normalizedEmail = email.toLowerCase();
  const now = Date.now();
  const lastSent = passwordResetCooldowns.get(normalizedEmail);
  if (lastSent && now - lastSent < PASSWORD_RESET_COOLDOWN_MS) {
    const remainingSeconds = Math.ceil((PASSWORD_RESET_COOLDOWN_MS - (now - lastSent)) / 1000);
    throw new HttpError(429, "RATE_LIMITED", `Mohon tunggu ${remainingSeconds} detik sebelum meminta tautan baru.`);
  }

  const { error } = await getPublicAuthClient().auth.resetPasswordForEmail(normalizedEmail, {
    redirectTo: getTrustedPasswordResetUrl(request),
  });
  if (error && classifySignInError(error) === "rate_limited") {
    throw new HttpError(429, "RATE_LIMITED", "Terlalu banyak permintaan. Silakan coba beberapa saat lagi.");
  }
  if (error && classifySignInError(error) === "unavailable") {
    throw new HttpError(503, "AUTH_UNAVAILABLE", "Layanan email sedang tidak dapat dijangkau. Silakan coba beberapa saat lagi.");
  }

  passwordResetCooldowns.set(normalizedEmail, now);
  if (passwordResetCooldowns.size > 1000) {
    for (const [key, timestamp] of passwordResetCooldowns.entries()) {
      if (now - timestamp > PASSWORD_RESET_COOLDOWN_MS) passwordResetCooldowns.delete(key);
    }
  }
  return { sent: true, message: PASSWORD_RESET_GENERIC_MESSAGE };
}

/**
 * Reads the `amr` claim of an access token that Supabase already verified (authenticate
 * middleware) and returns when the session was opened through a recovery link, if it was.
 * @param {string} token
 * @returns {number | null} epoch ms of the recovery sign-in
 */
export function recoverySignInTime(token) {
  try {
    const payload = JSON.parse(Buffer.from(String(token).split(".")[1] ?? "", "base64url").toString("utf8"));
    const entry = Array.isArray(payload?.amr)
      ? payload.amr.find((item) => item?.method === "recovery")
      : null;
    return entry && Number.isFinite(entry.timestamp) ? entry.timestamp * 1000 : null;
  } catch {
    return null;
  }
}

/**
 * Sets a new password for a session opened from the reset email (no current password).
 * @param {{ user: { id: string }, token: string }} auth
 * @param {{ new_password: string }} input
 */
export async function resetPasswordWithRecovery(auth, input) {
  const recoveredAt = recoverySignInTime(auth.token);
  if (!recoveredAt || Date.now() - recoveredAt > RECOVERY_SESSION_MAX_AGE_MS) {
    throw new HttpError(
      403,
      "RECOVERY_SESSION_REQUIRED",
      "Tautan atur ulang kata sandi tidak valid atau sudah kedaluwarsa. Minta tautan baru dari halaman masuk.",
    );
  }

  const { error } = await getSupabaseAdminClient().auth.admin.updateUserById(auth.user.id, {
    password: input.new_password,
  });
  if (error) {
    if (/password/i.test(error.message ?? "")) {
      throw new HttpError(400, "PASSWORD_REJECTED", "Kata sandi baru ditolak oleh sistem autentikasi. Gunakan kata sandi lain.");
    }
    throw new HttpError(503, "PASSWORD_UPDATE_FAILED", "Kata sandi belum dapat diperbarui. Silakan coba lagi.");
  }
  return { updated: true, message: "Kata sandi berhasil diperbarui. Silakan masuk dengan kata sandi baru." };
}
