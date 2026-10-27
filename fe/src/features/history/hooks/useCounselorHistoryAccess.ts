import { useCallback, useEffect, useRef, useState } from "react";
import {
  clearCounselorHistoryAccess,
  clearCounselorHistoryAttempts,
  COUNSELOR_HISTORY_ACCESS_DURATION_MS,
  COUNSELOR_HISTORY_MAX_ATTEMPTS,
  grantCounselorHistoryAccess,
  readCounselorHistoryAccess,
  readCounselorHistoryAttempts,
  recordCounselorHistoryFailedAttempt,
  verifyCounselorHistoryPassword,
  type CounselorHistoryAttemptState,
} from "../counselorHistoryAccess";

export type CounselorHistoryUnlockResult =
  | { status: "success"; expiresAt: number }
  | { status: "invalid"; remainingAttempts: number }
  | { status: "locked" }
  | { status: "error" };

/** Keeps the 30-minute history access window absolute, including route changes and tab suspension. */
export function useCounselorHistoryAccess(
  onExpired?: () => void,
  onCooldownExpired?: () => void,
) {
  const [accessUntil, setAccessUntil] = useState(readCounselorHistoryAccess);
  const [attemptState, setAttemptState] = useState<CounselorHistoryAttemptState>(
    readCounselorHistoryAttempts,
  );
  const [now, setNow] = useState(() => Date.now());
  const onExpiredRef = useRef(onExpired);
  const onCooldownExpiredRef = useRef(onCooldownExpired);

  useEffect(() => {
    onExpiredRef.current = onExpired;
  }, [onExpired]);
  useEffect(() => {
    onCooldownExpiredRef.current = onCooldownExpired;
  }, [onCooldownExpired]);

  const refreshClock = useCallback(() => {
    const currentTime = Date.now();
    setNow(currentTime);

    if (accessUntil > 0 && currentTime >= accessUntil) {
      clearCounselorHistoryAccess();
      setAccessUntil(0);
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
          return { status: "locked" };
        }

        if (await verifyCounselorHistoryPassword(password)) {
          const expiresAt = grantCounselorHistoryAccess();
          setAccessUntil(expiresAt);
          setNow(Date.now());
          setAttemptState({ count: 0, lockedUntil: 0 });
          return { status: "success", expiresAt };
        }

        const nextAttempts = recordCounselorHistoryFailedAttempt();
        setAttemptState(nextAttempts);
        if (nextAttempts.lockedUntil > Date.now()) {
          return { status: "locked" };
        }
        return {
          status: "invalid",
          remainingAttempts: COUNSELOR_HISTORY_MAX_ATTEMPTS - nextAttempts.count,
        };
      } catch {
        return { status: "error" };
      }
    },
    [],
  );

  const hasAccess = accessUntil > now;
  const timeLeft = Math.max(0, accessUntil - now);
  const timerText = `${Math.floor(timeLeft / 60000)}:${String(
    Math.floor((timeLeft % 60000) / 1000),
  ).padStart(2, "0")}`;

  return {
    accessUntil,
    attemptState,
    now,
    hasAccess,
    timeLeft,
    timerText,
    isPasswordLocked: attemptState.lockedUntil > now,
    maxAttempts: COUNSELOR_HISTORY_MAX_ATTEMPTS,
    accessDurationMs: COUNSELOR_HISTORY_ACCESS_DURATION_MS,
    unlock,
  };
}
