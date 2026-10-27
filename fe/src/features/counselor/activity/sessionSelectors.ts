import { COUNSELING_SESSION_STATUS } from "../../../constants/status";
import type {
  ClientIntake,
  CounselingSession,
} from "../../../data/mock/counselorActivity";

export interface CounselorSessionStatusInfo {
  label: string;
  style: string;
}

export function canStartCounselorSession(
  session: CounselingSession,
  nowMinutes: number,
): boolean {
  return (
    session.status === COUNSELING_SESSION_STATUS.SCHEDULED &&
    nowMinutes >= session.start
  );
}

export function isCounselorSessionFilled(session: CounselingSession): boolean {
  return (
    session.noteCounselor.trim().length >= 20 &&
    session.noteClient.trim().length >= 20
  );
}

export function getCounselorSessionStatusInfo(
  session: CounselingSession,
  nowMinutes: number,
): CounselorSessionStatusInfo {
  if (session.status === COUNSELING_SESSION_STATUS.CANCELLED) {
    return { label: "Dibatalkan", style: "bg-red-100 text-red-800" };
  }
  if (session.status === COUNSELING_SESSION_STATUS.COMPLETED) {
    return { label: "Selesai", style: "bg-gray-100 text-gray-700" };
  }
  if (session.status === COUNSELING_SESSION_STATUS.ONGOING) {
    return { label: "Berlangsung", style: "bg-primary text-white" };
  }
  if (canStartCounselorSession(session, nowMinutes)) {
    return {
      label: "Siap dimulai",
      style: "bg-gray-100 text-gray-700 ring-1 ring-gray-200",
    };
  }
  return { label: "Terjadwal", style: "bg-slate-100 text-slate-600" };
}

export function selectActiveCounselorSessions(
  sessions: readonly CounselingSession[],
  filter: string,
): CounselingSession[] {
  return sessions
    .filter(
      (session) =>
        session.status === COUNSELING_SESSION_STATUS.SCHEDULED ||
        session.status === COUNSELING_SESSION_STATUS.ONGOING,
    )
    .filter((session) => filter === "semua" || session.status === filter)
    .sort((a, b) => a.start - b.start);
}

export function selectReadyCounselorSessions(
  activeSessions: readonly CounselingSession[],
  nowMinutes: number,
): CounselingSession[] {
  const ongoing = activeSessions.filter(
    (session) => session.status === COUNSELING_SESSION_STATUS.ONGOING,
  );
  if (ongoing.length > 0) return ongoing.slice(0, 1);
  return activeSessions
    .filter((session) => canStartCounselorSession(session, nowMinutes))
    .slice(0, 1);
}

export function selectUpcomingCounselorSessions(
  activeSessions: readonly CounselingSession[],
  nowMinutes: number,
): CounselingSession[] {
  return activeSessions
    .filter(
      (session) =>
        session.status === COUNSELING_SESSION_STATUS.SCHEDULED &&
        !canStartCounselorSession(session, nowMinutes),
    )
    .sort((a, b) => a.start - b.start);
}

export function getCounselorSessionCounts(sessions: readonly CounselingSession[]) {
  return {
    scheduled: sessions.filter(
      (session) => session.status === COUNSELING_SESSION_STATUS.SCHEDULED,
    ).length,
    ongoing: sessions.filter(
      (session) => session.status === COUNSELING_SESSION_STATUS.ONGOING,
    ).length,
    today: sessions.filter(
      (session) =>
        session.status === COUNSELING_SESSION_STATUS.SCHEDULED ||
        session.status === COUNSELING_SESSION_STATUS.ONGOING,
    ).length,
  };
}

export function getCounselorIntakeSafetyFlags(intake: ClientIntake): string[] {
  return [
    intake.selfHarm !== "Tidak" ? "keinginan menyakiti diri" : null,
    intake.distress !== "Tidak" ? "kesedihan atau depresi berat" : null,
    intake.abuse !== "Tidak" ? "riwayat pelecehan" : null,
    intake.substance !== "Tidak" ? "penggunaan obat-obatan" : null,
  ].filter((flag): flag is string => Boolean(flag));
}
