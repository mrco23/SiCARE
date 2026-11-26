import crypto from "node:crypto";
import { getSupabaseAdminClient } from "../config/supabase.js";
import { HttpError } from "../lib/http.js";

/**
 * Pembatasan percobaan login: 3 kali kata sandi salah untuk identitas yang sama -> dikunci
 * 30 menit. Disimpan di public.login_attempts (identitas di-hash). Bila tabel belum tersedia
 * atau database gagal diakses, login tidak diblokir (fail-open) agar pengguna tidak terkunci
 * karena masalah infrastruktur; kejadian dicatat di log server.
 */
export const LOGIN_MAX_FAILURES = 3;
export const LOGIN_LOCK_MINUTES = 30;
export const LOGIN_LOCKED_MESSAGE = "Terlalu banyak percobaan masuk yang gagal. Coba lagi kembali nanti.";

export function loginAttemptKey(identifier) {
  return crypto.createHash("sha256").update(String(identifier ?? "").trim().toLowerCase()).digest("hex");
}

function lockedError() {
  return new HttpError(429, "LOGIN_LOCKED", LOGIN_LOCKED_MESSAGE);
}

async function readRow(client, key) {
  const { data, error } = await client
    .from("login_attempts")
    .select("identifier_hash,failed_count,last_failed_at,locked_until")
    .eq("identifier_hash", key)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Melempar 429 LOGIN_LOCKED bila identitas sedang dikunci. */
export async function assertLoginNotLocked(key, { client = getSupabaseAdminClient(), now = new Date() } = {}) {
  try {
    const row = await readRow(client, key);
    if (row?.locked_until && new Date(row.locked_until) > now) throw lockedError();
  } catch (error) {
    if (error instanceof HttpError) throw error;
    console.warn("[Auth] Status percobaan login tidak dapat dibaca:", error?.code ?? "unknown");
  }
}

/**
 * Mencatat satu kegagalan kata sandi. Pada kegagalan ke-3 (dalam 30 menit) identitas dikunci
 * 30 menit dan fungsi melempar 429 LOGIN_LOCKED.
 */
export async function recordLoginFailure(key, { client = getSupabaseAdminClient(), now = new Date() } = {}) {
  let lockedNow = false;
  try {
    const row = await readRow(client, key);
    const windowMs = LOGIN_LOCK_MINUTES * 60 * 1000;
    const expired =
      !row ||
      (row.locked_until && new Date(row.locked_until) <= now) ||
      (row.last_failed_at && now.getTime() - new Date(row.last_failed_at).getTime() > windowMs);
    const count = (expired ? 0 : row.failed_count) + 1;
    lockedNow = count >= LOGIN_MAX_FAILURES;
    const { error } = await client.from("login_attempts").upsert(
      {
        identifier_hash: key,
        failed_count: lockedNow ? 0 : count,
        last_failed_at: now.toISOString(),
        locked_until: lockedNow ? new Date(now.getTime() + windowMs).toISOString() : null,
        updated_at: now.toISOString(),
      },
      { onConflict: "identifier_hash" },
    );
    if (error) throw error;
  } catch (error) {
    console.warn("[Auth] Percobaan login gagal tidak dapat dicatat:", error?.code ?? "unknown");
    return;
  }
  if (lockedNow) throw lockedError();
}

/** Login berhasil: hapus catatan kegagalan. */
export async function clearLoginFailures(key, { client = getSupabaseAdminClient() } = {}) {
  try {
    const { error } = await client.from("login_attempts").delete().eq("identifier_hash", key);
    if (error) throw error;
  } catch (error) {
    console.warn("[Auth] Catatan percobaan login tidak dapat dihapus:", error?.code ?? "unknown");
  }
}
