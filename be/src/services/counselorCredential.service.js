import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { getEncryptionKey } from "./tokenEncryption.service.js";
import { HttpError } from "../lib/http.js";

const GRANT_DURATION_SECONDS = 30 * 60; // 30 minutes
const MAX_VERIFY_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

// In-memory rate limiting tracker for password verification attempts per counselor
const failedAttemptsMap = new Map();

/**
 * Checks rate limiting for a counselor.
 *
 * @param {string} counselorId
 */
export function checkRateLimit(counselorId) {
  const now = Date.now();
  const entry = failedAttemptsMap.get(counselorId);

  if (!entry) {
    return { locked: false, remainingAttempts: MAX_VERIFY_ATTEMPTS };
  }

  if (entry.lockedUntil > now) {
    const remainingSeconds = Math.ceil((entry.lockedUntil - now) / 1000);
    throw new HttpError(
      429,
      "TOO_MANY_ATTEMPTS",
      `Terlalu banyak percobaan salah. Akun terkunci sementara selama ${remainingSeconds} detik.`
    );
  }

  // Lockout expired, reset counter
  if (entry.lockedUntil > 0 && entry.lockedUntil <= now) {
    failedAttemptsMap.delete(counselorId);
    return { locked: false, remainingAttempts: MAX_VERIFY_ATTEMPTS };
  }

  const remaining = Math.max(0, MAX_VERIFY_ATTEMPTS - entry.count);
  return { locked: false, remainingAttempts: remaining };
}

/**
 * Records a failed verification attempt.
 *
 * @param {string} counselorId
 */
export function recordFailedAttempt(counselorId) {
  const now = Date.now();
  const entry = failedAttemptsMap.get(counselorId) || { count: 0, lockedUntil: 0 };
  entry.count += 1;

  if (entry.count >= MAX_VERIFY_ATTEMPTS) {
    entry.lockedUntil = now + LOCKOUT_DURATION_MS;
    failedAttemptsMap.set(counselorId, entry);
    throw new HttpError(
      429,
      "TOO_MANY_ATTEMPTS",
      "Terlalu banyak percobaan salah. Akses riwayat dikunci sementara selama 15 menit."
    );
  }

  failedAttemptsMap.set(counselorId, entry);
  const remaining = MAX_VERIFY_ATTEMPTS - entry.count;
  return remaining;
}

/**
 * Resets failed attempts after successful verification.
 *
 * @param {string} counselorId
 */
export function resetFailedAttempts(counselorId) {
  failedAttemptsMap.delete(counselorId);
}

/**
 * Hashes a plaintext password using bcrypt.
 *
 * @param {string} plaintext
 * @returns {Promise<string>}
 */
export async function hashPassword(plaintext) {
  if (typeof plaintext !== "string" || plaintext.length < 4) {
    throw new HttpError(400, "VALIDATION_ERROR", "Kata sandi minimal 4 karakter.");
  }
  return bcrypt.hash(plaintext, 10);
}

/**
 * Verifies a plaintext password against a bcrypt hash.
 *
 * @param {string} plaintext
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
export async function comparePassword(plaintext, hash) {
  if (typeof plaintext !== "string" || typeof hash !== "string") {
    return false;
  }
  return bcrypt.compare(plaintext, hash);
}

/**
 * Creates a signed 30-minute history access grant token.
 *
 * @param {string} counselorId
 * @param {number} [durationSeconds]
 * @returns {{ token: string, expires_at: string, expires_in_seconds: number }}
 */
export function createHistoryGrantToken(counselorId, durationSeconds = GRANT_DURATION_SECONDS) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + durationSeconds;
  const key = getEncryptionKey();

  const payload = `${counselorId}:${issuedAt}:${expiresAt}`;
  const hmac = crypto.createHmac("sha256", key);
  hmac.update(payload);
  const signature = hmac.digest("hex");

  const token = `${payload}:${signature}`;
  return {
    token,
    expires_at: new Date(expiresAt * 1000).toISOString(),
    expires_in_seconds: durationSeconds,
  };
}

/**
 * Verifies and validates a history grant token.
 *
 * @param {string} token
 * @param {string} expectedCounselorId
 * @returns {boolean}
 */
export function verifyHistoryGrantToken(token, expectedCounselorId) {
  if (!token || typeof token !== "string") {
    return false;
  }

  const parts = token.split(":");
  if (parts.length !== 4) {
    return false;
  }

  const [counselorId, issuedAtStr, expiresAtStr, providedSignature] = parts;

  if (counselorId !== expectedCounselorId) {
    return false;
  }

  const expiresAt = Number.parseInt(expiresAtStr, 10);
  if (!Number.isFinite(expiresAt) || Math.floor(Date.now() / 1000) > expiresAt) {
    return false;
  }

  const key = getEncryptionKey();
  const payload = `${counselorId}:${issuedAtStr}:${expiresAtStr}`;
  const hmac = crypto.createHmac("sha256", key);
  hmac.update(payload);
  const expectedSignature = hmac.digest("hex");

  try {
    const providedBuf = Buffer.from(providedSignature, "hex");
    const expectedBuf = Buffer.from(expectedSignature, "hex");
    if (providedBuf.length !== expectedBuf.length) {
      return false;
    }
    return crypto.timingSafeEqual(providedBuf, expectedBuf);
  } catch {
    return false;
  }
}

