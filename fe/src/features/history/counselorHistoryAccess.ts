import { counselorApi } from "../../lib/counselorApi";
import { ApiError } from "../../lib/api";

export const COUNSELOR_HISTORY_ACCESS_DURATION_MS = 30 * 60 * 1000;

const ACCESS_STORAGE_KEY = "sicare:konselor:riwayat-access";
const GRANT_STORAGE_KEY = "sicare:konselor:riwayat-grant";
const ATTEMPT_STORAGE_KEY = "sicare:konselor:riwayat-attempts";

export interface CounselorHistoryAttemptState {
  count: number;
  lockedUntil: number;
}

const EMPTY_ATTEMPTS: CounselorHistoryAttemptState = {
  count: 0,
  lockedUntil: 0,
};

function getSessionStorageSafely(): Storage | null {
  try {
    if (typeof window !== "undefined") return window.sessionStorage;
  } catch {
    // blocked or unavailable
  }
  return null;
}

/** Reads only the fixed access expiry timestamp; it never stores a password. */
export function readCounselorHistoryAccess(now = Date.now()): number {
  const storage = getSessionStorageSafely();
  if (!storage) return 0;

  try {
    const raw = storage.getItem(ACCESS_STORAGE_KEY);
    const expiry = raw === null ? 0 : Number(raw);
    if (
      Number.isFinite(expiry) &&
      expiry > now &&
      expiry <= now + COUNSELOR_HISTORY_ACCESS_DURATION_MS
    ) {
      return expiry;
    }
    if (raw !== null) {
      storage.removeItem(ACCESS_STORAGE_KEY);
      storage.removeItem(GRANT_STORAGE_KEY);
    }
  } catch {
    // Fail closed: history remains locked.
  }
  return 0;
}

/** Reads the server-issued history access grant token from session storage. */
export function readCounselorHistoryGrantToken(): string | null {
  const expiry = readCounselorHistoryAccess();
  if (expiry <= Date.now()) return null;
  const storage = getSessionStorageSafely();
  return storage ? storage.getItem(GRANT_STORAGE_KEY) : null;
}

export function readCounselorHistoryAttempts(
  now = Date.now(),
): CounselorHistoryAttemptState {
  const storage = getSessionStorageSafely();
  if (!storage) return { ...EMPTY_ATTEMPTS };

  try {
    const raw = storage.getItem(ATTEMPT_STORAGE_KEY);
    if (!raw) return { ...EMPTY_ATTEMPTS };

    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const entry = parsed as Partial<CounselorHistoryAttemptState>;
      if (
        typeof entry.count === "number" &&
        Number.isInteger(entry.count) &&
        entry.count >= 0 &&
        typeof entry.lockedUntil === "number" &&
        Number.isFinite(entry.lockedUntil)
      ) {
        if (entry.lockedUntil > now) {
          return {
            count: entry.count,
            lockedUntil: entry.lockedUntil,
          };
        }
        return { count: entry.count, lockedUntil: 0 };
      }
    }
    storage.removeItem(ATTEMPT_STORAGE_KEY);
  } catch {
    // reset local attempt counter
  }
  return { ...EMPTY_ATTEMPTS };
}

export function recordClientFailedAttempt(now = Date.now()): CounselorHistoryAttemptState {
  const storage = getSessionStorageSafely();
  const current = readCounselorHistoryAttempts(now);
  const count = current.count + 1;
  const lockedUntil = count >= 3 ? now + 30 * 1000 : 0; // 30s local cooldown
  const updated: CounselorHistoryAttemptState = { count, lockedUntil };
  try {
    storage?.setItem(ATTEMPT_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
  return updated;
}

export function clearCounselorHistoryAttempts(): void {
  const storage = getSessionStorageSafely();
  try {
    storage?.removeItem(ATTEMPT_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function clearCounselorHistoryAccess(): void {
  const storage = getSessionStorageSafely();
  try {
    storage?.removeItem(ACCESS_STORAGE_KEY);
    storage?.removeItem(GRANT_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Check whether counselor has configured a history password in the database */
export async function checkCounselorHistoryPasswordConfigured(): Promise<boolean> {
  try {
    const res = await counselorApi.getHistoryPasswordStatus();
    return res.configured;
  } catch {
    return false;
  }
}

/** Initialize first-time history password in database */
export async function initCounselorHistoryPassword(password: string): Promise<{ success: boolean; message: string }> {
  return counselorApi.initHistoryPassword(password);
}

/** Verifies password with backend server */
export async function verifyCounselorHistoryPasswordWithServer(
  input: string,
): Promise<
  | { status: "success"; expiresAt: number; grantToken: string }
  | { status: "invalid"; message: string }
  | { status: "locked"; message: string }
  | { status: "error"; message: string }
> {
  try {
    const res = await counselorApi.verifyHistoryPassword(input);
    const storage = getSessionStorageSafely();
    const expiresAt = Date.now() + (res.expires_in_seconds || 1800) * 1000;
    if (storage) {
      storage.setItem(ACCESS_STORAGE_KEY, String(expiresAt));
      storage.setItem(GRANT_STORAGE_KEY, res.grant_token || res.token);
      storage.removeItem(ATTEMPT_STORAGE_KEY);
    }
    return { status: "success", expiresAt, grantToken: res.grant_token || res.token };
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      if (err.status === 429) {
        return { status: "locked", message: err.message };
      }
      if (err.status === 401) {
        recordClientFailedAttempt();
        return { status: "invalid", message: err.message };
      }
      return { status: "error", message: err.message };
    }
    return { status: "error", message: "Gagal memverifikasi kata sandi dengan server." };
  }
}

/**
 * Changes history password in backend database.
 */
export async function changeCounselorHistoryPassword(
  currentPassword: string,
  nextPassword: string,
  confirmPassword = nextPassword,
): Promise<{ success: boolean; message: string }> {
  try {
    const res = await counselorApi.changeHistoryPassword({
      current_password: currentPassword,
      new_password: nextPassword,
      confirm_password: confirmPassword,
    });
    clearCounselorHistoryAccess();
    clearCounselorHistoryAttempts();
    return res;
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      return { success: false, message: err.message };
    }
    return { success: false, message: "Gagal memperbarui kata sandi riwayat." };
  }
}
