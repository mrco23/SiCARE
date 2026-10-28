export const COUNSELOR_HISTORY_MAX_ATTEMPTS = 3;
export const COUNSELOR_HISTORY_ACCESS_DURATION_MS = 30 * 60 * 1000;
export const COUNSELOR_HISTORY_LOCK_DURATION_MS = 5 * 60 * 1000;
export const COUNSELOR_HISTORY_DEFAULT_PASSWORD = "1234";

const PASSWORD_DIGEST_KEY = "sicare:konselor:riwayat-password-digest";
const ACCESS_STORAGE_KEY = "sicare:konselor:riwayat-access";
const ATTEMPT_STORAGE_KEY = "sicare:konselor:riwayat-attempts";

export interface CounselorHistoryAttemptState {
  count: number;
  lockedUntil: number;
}

const EMPTY_ATTEMPTS: CounselorHistoryAttemptState = {
  count: 0,
  lockedUntil: 0,
};

function getSessionStorage(): Storage {
  if (typeof window === "undefined") {
    throw new Error("Penyimpanan sesi tidak tersedia di lingkungan ini.");
  }
  return window.sessionStorage;
}

function getSessionStorageSafely(): Storage | null {
  try {
    return getSessionStorage();
  } catch {
    return null;
  }
}

async function passwordDigest(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
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
    if (raw !== null) storage.removeItem(ACCESS_STORAGE_KEY);
  } catch {
    // A blocked browser storage should fail closed: history remains locked.
  }
  return 0;
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
        entry.count <= COUNSELOR_HISTORY_MAX_ATTEMPTS &&
        typeof entry.lockedUntil === "number" &&
        Number.isFinite(entry.lockedUntil)
      ) {
        if (entry.lockedUntil > now) {
          return {
            count: COUNSELOR_HISTORY_MAX_ATTEMPTS,
            lockedUntil: entry.lockedUntil,
          };
        }
        if (entry.count < COUNSELOR_HISTORY_MAX_ATTEMPTS) {
          return { count: entry.count, lockedUntil: 0 };
        }
      }
    }
    storage.removeItem(ATTEMPT_STORAGE_KEY);
  } catch {
    // Invalid or unavailable storage resets the local attempt counter.
  }
  return { ...EMPTY_ATTEMPTS };
}

export async function verifyCounselorHistoryPassword(
  input: string,
): Promise<boolean> {
  const storage = getSessionStorage();
  const savedDigest = storage.getItem(PASSWORD_DIGEST_KEY);
  const expectedDigest =
    savedDigest ?? (await passwordDigest(COUNSELOR_HISTORY_DEFAULT_PASSWORD));
  return (await passwordDigest(input)) === expectedDigest;
}

export function grantCounselorHistoryAccess(now = Date.now()): number {
  const storage = getSessionStorage();
  const expiry = now + COUNSELOR_HISTORY_ACCESS_DURATION_MS;
  storage.setItem(ACCESS_STORAGE_KEY, String(expiry));
  storage.removeItem(ATTEMPT_STORAGE_KEY);
  return expiry;
}

export function recordCounselorHistoryFailedAttempt(
  now = Date.now(),
): CounselorHistoryAttemptState {
  const latest = readCounselorHistoryAttempts(now);
  if (latest.lockedUntil > now) return latest;

  const count = Math.min(
    COUNSELOR_HISTORY_MAX_ATTEMPTS,
    latest.count + 1,
  );
  const next: CounselorHistoryAttemptState = {
    count,
    lockedUntil:
      count >= COUNSELOR_HISTORY_MAX_ATTEMPTS
        ? now + COUNSELOR_HISTORY_LOCK_DURATION_MS
        : 0,
  };
  getSessionStorage().setItem(ATTEMPT_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function clearCounselorHistoryAccess(): void {
  const storage = getSessionStorageSafely();
  try {
    storage?.removeItem(ACCESS_STORAGE_KEY);
  } catch {
    // Fail closed in memory even if browser storage is blocked.
  }
}

export function clearCounselorHistoryAttempts(): void {
  const storage = getSessionStorageSafely();
  try {
    storage?.removeItem(ATTEMPT_STORAGE_KEY);
  } catch {
    // In-memory state is reset by the caller.
  }
}

/**
 * Change the session-only history password. The verifier is a SHA-256 digest,
 * never the clear-text password. This remains a demo-only browser mechanism;
 * production authorization must be enforced by the backend.
 */
export async function changeCounselorHistoryPassword(
  currentPassword: string,
  nextPassword: string,
): Promise<boolean> {
  const storage = getSessionStorage();
  const currentDigest = await passwordDigest(currentPassword);
  const savedDigest = storage.getItem(PASSWORD_DIGEST_KEY);
  const defaultDigest = await passwordDigest(
    COUNSELOR_HISTORY_DEFAULT_PASSWORD,
  );

  if (currentDigest !== (savedDigest ?? defaultDigest)) return false;

  storage.setItem(PASSWORD_DIGEST_KEY, await passwordDigest(nextPassword));
  storage.removeItem(ACCESS_STORAGE_KEY);
  storage.removeItem(ATTEMPT_STORAGE_KEY);
  return true;
}
