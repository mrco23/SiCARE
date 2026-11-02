import { useCallback, useEffect, useRef, useState } from "react";
import {
  checkCounselorHistoryPasswordConfigured,
  clearCounselorHistoryAccess,
  clearCounselorHistoryAttempts,
  COUNSELOR_HISTORY_ACCESS_DURATION_MS,
  initCounselorHistoryPassword,
  readCounselorHistoryAccess,
  readCounselorHistoryAttempts,
  readCounselorHistoryGrantToken,
  recordClientFailedAttempt,
  verifyCounselorHistoryPasswordWithServer,
  type CounselorHistoryAttemptState,
} from "../counselorHistoryAccess";

export const COUNSELOR_HISTORY_MAX_ATTEMPTS = 5;

export type CounselorHistoryUnlockResult =
  | { status: "success"; expiresAt: number; grantToken: string }
  | { status: "invalid"; remainingAttempts: number; message?: string }
  | { status: "locked"; message?: string }
  | { status: "not_configured"; message?: string }
  | { status: "error"; message?: string };

/** Keeps the 30-minute history access window absolute, including route changes and tab suspension. */
export function useCounselorHistoryAccess(
  onExpired?: () => void,
  onCooldownExpired?: () => void,
) {
  const [accessUntil, setAccessUntil] = useState(readCounselorHistoryAccess);
  const [grantToken, setGrantToken] = useState(readCounselorHistoryGrantToken);
  const [attemptState, setAttemptState] = useState<CounselorHistoryAttemptState>(
    readCounselorHistoryAttempts,
  );
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);
  const [checkingConfig, setCheckingConfig] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const onExpiredRef = useRef(onExpired);
  const onCooldownExpiredRef = useRef(onCooldownExpired);

  useEffect(() => {
    onExpiredRef.current = onExpired;
  }, [onExpired]);
  useEffect(() => {
    onCooldownExpiredRef.current = onCooldownExpired;
  }, [onCooldownExpired]);

  // Check password configuration status on mount
  const checkConfigStatus = useCallback(async () => {
    try {
      const configured = await checkCounselorHistoryPasswordConfigured();
      setIsConfigured(configured);
    } catch {
      setIsConfigured(false);
    } finally {
      setCheckingConfig(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    checkCounselorHistoryPasswordConfigured()
      .then((configured) => {
        if (active) {
          setIsConfigured(configured);
          setCheckingConfig(false);
        }
      })
      .catch(() => {
        if (active) {
          setIsConfigured(false);
          setCheckingConfig(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const refreshClock = useCallback(() => {
    const currentTime = Date.now();
    setNow(currentTime);

    if (accessUntil > 0 && currentTime >= accessUntil) {
      clearCounselorHistoryAccess();
      setAccessUntil(0);
      setGrantToken(null);
      onExpiredRef.current?.();
    }

    if (
      attemptState.lockedUntil > 0 &&
      currentTime >= attemptState.lockedUntil
    ) {
      clearCounselorHistoryAttempts();
      setAttemptState({ count: 0, lockedUntil: 0 });
      onCooldownExpiredRef.current?.();
    }
  }, [accessUntil, attemptState.lockedUntil]);

  useEffect(() => {
    const interval = window.setInterval(refreshClock, 1000);
    const timeout =
      accessUntil > Date.now()
        ? window.setTimeout(refreshClock, accessUntil - Date.now())
        : undefined;

    window.addEventListener("focus", refreshClock);
    window.addEventListener("pageshow", refreshClock);
    document.addEventListener("visibilitychange", refreshClock);

    return () => {
      window.clearInterval(interval);
      if (timeout !== undefined) window.clearTimeout(timeout);
      window.removeEventListener("focus", refreshClock);
      window.removeEventListener("pageshow", refreshClock);
      document.removeEventListener("visibilitychange", refreshClock);
    };
  }, [accessUntil, refreshClock]);

  const unlock = useCallback(
    async (password: string): Promise<CounselorHistoryUnlockResult> => {
      try {
        const latestAttempts = readCounselorHistoryAttempts();
        setAttemptState(latestAttempts);
        if (latestAttempts.lockedUntil > Date.now()) {
          return { status: "locked", message: "Akses terkunci sementara karena terlalu banyak percobaan." };
        }

        const result = await verifyCounselorHistoryPasswordWithServer(password);

        if (result.status === "success") {
          setAccessUntil(result.expiresAt);
          setGrantToken(result.grantToken);
          setNow(Date.now());
          setAttemptState({ count: 0, lockedUntil: 0 });
          clearCounselorHistoryAttempts();
          return { status: "success", expiresAt: result.expiresAt, grantToken: result.grantToken };
        }

        if (result.status === "locked") {
          const nextAttempts = recordClientFailedAttempt();
          setAttemptState(nextAttempts);
          return { status: "locked", message: result.message };
        }

        if (result.status === "invalid") {
          const nextAttempts = readCounselorHistoryAttempts();
          setAttemptState(nextAttempts);
          const remaining = Math.max(0, COUNSELOR_HISTORY_MAX_ATTEMPTS - nextAttempts.count);
          return { status: "invalid", remainingAttempts: remaining, message: result.message };
        }

        return { status: "error", message: result.message };
      } catch (err: unknown) {
        return { status: "error", message: err instanceof Error ? err.message : "Terjadi kesalahan." };
      }
    },
    [],
  );

  const initPassword = useCallback(async (password: string) => {
    const res = await initCounselorHistoryPassword(password);
    if (res.success) {
      setIsConfigured(true);
    }
    return res;
  }, []);

  const lock = useCallback(() => {
    clearCounselorHistoryAccess();
    setAccessUntil(0);
    setGrantToken(null);
    onExpiredRef.current?.();
  }, []);

  const hasAccess = accessUntil > now && Boolean(grantToken);
  const timeLeft = Math.max(0, accessUntil - now);
  const timerText = `${Math.floor(timeLeft / 60000)}:${String(
    Math.floor((timeLeft % 60000) / 1000),
  ).padStart(2, "0")}`;

  return {
    accessUntil,
    grantToken,
    attemptState,
    now,
    hasAccess,
    timeLeft,
    timerText,
    isPasswordLocked: attemptState.lockedUntil > now,
    isConfigured,
    checkingConfig,
    maxAttempts: COUNSELOR_HISTORY_MAX_ATTEMPTS,
    accessDurationMs: COUNSELOR_HISTORY_ACCESS_DURATION_MS,
    unlock,
    lock,
    initPassword,
    refetchConfigStatus: checkConfigStatus,
  };
}
