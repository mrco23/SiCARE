import type { AcademicPeriod } from "../../../lib/academicPeriods";
import type { CounselingFormat } from "../../../types/counseling";
import type { Session } from "../../../data/mock/counselorHistory";

const DAY_MS = 86_400_000;

export type CounselorHistoryPeriod = "hari" | "minggu" | "bulan" | "semester";
export type CounselorHistoryDateRange = { start: Date; end: Date };

export function parseCounselorHistoryDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function getCounselorHistoryDateRange(
  period: CounselorHistoryPeriod,
  anchor: Date,
  semester: AcademicPeriod | null,
): CounselorHistoryDateRange {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const day = anchor.getDate();
  if (period === "hari") {
    return { start: new Date(year, month, day), end: new Date(year, month, day + 1) };
  }
  if (period === "minggu") {
    return { start: new Date(year, month, day - 6), end: new Date(year, month, day + 1) };
  }
  if (period === "bulan") {
    return { start: new Date(year, month, 1), end: new Date(year, month + 1, 1) };
  }
  if (!semester) return { start: new Date(0), end: new Date(0) };
  return {
    start: parseCounselorHistoryDate(semester.start),
    end: new Date(parseCounselorHistoryDate(semester.end).getTime() + DAY_MS),
  };
}

export function getCounselorHistoryDateRangeLabel(
  period: CounselorHistoryPeriod,
  range: CounselorHistoryDateRange,
  semester: AcademicPeriod | null,
): string {
  if (period === "hari") {
    return range.start.toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }
  if (period === "minggu") {
    const end = new Date(range.end.getTime() - DAY_MS);
    return `${range.start.toLocaleDateString("id-ID", { day: "numeric", month: "short" })} – ${end.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}`;
  }
  if (period === "bulan") {
    return range.start.toLocaleDateString("id-ID", {
      month: "long",
      year: "numeric",
    });
  }
  return semester ? `TA ${semester.ta} · ${semester.sem}` : "Belum ada periode";
}

export function isCounselorHistoryDateInRange(
  isoDate: string,
  range: CounselorHistoryDateRange,
): boolean {
  const value = parseCounselorHistoryDate(isoDate).getTime();
  return value >= range.start.getTime() && value < range.end.getTime();
}

export function counselorHistorySessionKey(session: Session): string {
  return `${session.date} ${session.time}`;
}

export function matchesCounselorHistoryFilter(
  session: Session,
  format: CounselingFormat,
  range: CounselorHistoryDateRange,
): boolean {
  return session.format === format && isCounselorHistoryDateInRange(session.date, range);
}

export function formatCounselorHistoryDate(isoDate: string): string {
  return parseCounselorHistoryDate(isoDate).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
