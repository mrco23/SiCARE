import { SESSION_OUTCOME_LABEL } from "../../../constants/status";
import type { Session } from "../../../data/mock/adminReports";

export type ReportPeriodLike = { start: string; end: string };

/** Uses the existing inclusive YYYY-MM-DD period semantics of the Admin report. */
export function isAdminReportDateInPeriod(date: string, period: ReportPeriodLike): boolean {
  return date >= period.start && date <= period.end;
}

export function calculateAdminReportAverage(rows: readonly Session[]) {
  const rated = rows.filter((row) => row.rating !== null);
  return {
    n: rated.length,
    value: rated.length ? rated.reduce((sum, row) => sum + (row.rating ?? 0), 0) / rated.length : 0,
  };
}

export function selectAdminReportRows(
  sessions: readonly Session[],
  period: ReportPeriodLike,
  format: "Semua" | "Individu" | "Kelompok",
  counselor: string,
): Session[] {
  return sessions.filter((session) =>
    isAdminReportDateInPeriod(session.date, period) &&
    (format === "Semua" || session.format === format) &&
    (counselor === "Semua" || session.counselor === counselor),
  );
}

export function summarizeAdminReportSessions(rows: readonly Session[]) {
  const completed = rows.filter((row) => row.status === SESSION_OUTCOME_LABEL.COMPLETED);
  const cancelled = rows.filter((row) => row.status === SESSION_OUTCOME_LABEL.CANCELLED);
  return {
    completed, cancelled,
    completedIndividual: completed.filter((row) => row.format === "Individu"),
    completedGroup: completed.filter((row) => row.format === "Kelompok"),
    cancelledIndividual: cancelled.filter((row) => row.format === "Individu"),
    cancelledGroup: cancelled.filter((row) => row.format === "Kelompok"),
  };
}

export function groupAdminReportByMonth(rows: readonly Session[]) {
  const grouped: Record<string, { done: number; cancelled: number }> = {};
  for (const row of rows) {
    const key = row.date.slice(0, 7);
    grouped[key] ??= { done: 0, cancelled: 0 };
    if (row.status === SESSION_OUTCOME_LABEL.COMPLETED) grouped[key].done += 1;
    else grouped[key].cancelled += 1;
  }
  return Object.keys(grouped).sort().map((key) => ({ key, ...grouped[key] }));
}

export function summarizeAdminReportByCounselor(rows: readonly Session[], counselors: readonly string[]) {
  return counselors.map((counselor) => {
    const matching = rows.filter((row) => row.counselor === counselor);
    const completed = matching.filter((row) => row.status === SESSION_OUTCOME_LABEL.COMPLETED);
    const cancelled = matching.filter((row) => row.status === SESSION_OUTCOME_LABEL.CANCELLED);
    return {
      counselor,
      individualDone: completed.filter((row) => row.format === "Individu").length,
      groupDone: completed.filter((row) => row.format === "Kelompok").length,
      individualCancelled: cancelled.filter((row) => row.format === "Individu").length,
      groupCancelled: cancelled.filter((row) => row.format === "Kelompok").length,
      totalDone: completed.length,
      totalCancelled: cancelled.length,
    };
  }).filter((row) => row.totalDone + row.totalCancelled > 0);
}

export function countAdminCancellationReasons(rows: readonly Session[], reasons: readonly string[]) {
  const cancelled = rows.filter((row) => row.status === SESSION_OUTCOME_LABEL.CANCELLED);
  return reasons.map((reason) => ({
    reason,
    count: cancelled.filter((row) => row.reason === reason).length,
  })).sort((a, b) => b.count - a.count);
}

export function summarizeAdminReportTopics(rows: readonly Session[], topics: readonly string[]) {
  return topics.map((topic) => {
    const matching = rows.filter((row) => row.topic === topic);
    const completed = matching.filter((row) => row.status === SESSION_OUTCOME_LABEL.COMPLETED);
    const average = calculateAdminReportAverage(completed);
    return {
      topic,
      total: matching.length,
      completed: completed.length,
      cancelled: matching.filter((row) => row.status === SESSION_OUTCOME_LABEL.CANCELLED).length,
      rating: average.n ? average.value.toFixed(1) : "-",
    };
  });
}
