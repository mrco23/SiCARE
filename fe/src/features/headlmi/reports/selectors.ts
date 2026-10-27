import { SESSION_OUTCOME_LABEL } from "../../../constants/status";
import type { Session } from "../../../data/mock/headlmiReports";
import type { AcademicPeriod } from "../../../lib/academicPeriods";
import { isInPeriod, toISO } from "../../../lib/academicPeriods";

export function selectHeadLmiSessionsInPeriod(
  sessions: readonly Session[],
  period: AcademicPeriod | null,
): Session[] {
  return sessions.filter((session) =>
    !period || isInPeriod(toISO(new Date(`${session.date}T00:00:00`)), period),
  );
}

export function countSessionOutcomes(sessions: readonly Session[]) {
  const completed = sessions.filter((session) => session.status === SESSION_OUTCOME_LABEL.COMPLETED);
  const cancelled = sessions.filter((session) => session.status === SESSION_OUTCOME_LABEL.CANCELLED);
  return {
    total: sessions.length, completed, cancelled,
    individualCompleted: completed.filter((session) => session.format === "Individu"),
    groupCompleted: completed.filter((session) => session.format === "Kelompok"),
    individualCancelled: cancelled.filter((session) => session.format === "Individu"),
    groupCancelled: cancelled.filter((session) => session.format === "Kelompok"),
  };
}

export function groupHeadLmiSessionsByMonth(sessions: readonly Session[]) {
  const grouped: Record<string, { done: number; cancelled: number }> = {};
  for (const session of sessions) {
    const key = session.date.slice(0, 7);
    grouped[key] ??= { done: 0, cancelled: 0 };
    if (session.status === SESSION_OUTCOME_LABEL.COMPLETED) grouped[key].done += 1;
    else grouped[key].cancelled += 1;
  }
  return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => ({ key, ...value }));
}

export function summarizeHeadLmiSessionsByCounselor(sessions: readonly Session[], counselors: readonly string[]) {
  return counselors.map((counselor) => {
    const matching = sessions.filter((session) => session.counselor === counselor);
    const completed = matching.filter((session) => session.status === SESSION_OUTCOME_LABEL.COMPLETED);
    const cancelled = matching.filter((session) => session.status === SESSION_OUTCOME_LABEL.CANCELLED);
    return {
      counselor,
      individualDone: completed.filter((session) => session.format === "Individu").length,
      groupDone: completed.filter((session) => session.format === "Kelompok").length,
      individualCancelled: cancelled.filter((session) => session.format === "Individu").length,
      groupCancelled: cancelled.filter((session) => session.format === "Kelompok").length,
      done: completed.length,
      cancelled: cancelled.length,
      total: matching.length,
    };
  }).filter((item) => item.total > 0);
}

export function countHeadLmiCancellationReasons(sessions: readonly Session[], reasons: readonly string[]) {
  const cancelled = sessions.filter((session) => session.status === SESSION_OUTCOME_LABEL.CANCELLED);
  return reasons.map((reason) => ({
    reason,
    count: cancelled.filter((session) => session.cancellationReason === reason).length,
  })).filter((item) => item.count > 0).sort((a, b) => b.count - a.count);
}
