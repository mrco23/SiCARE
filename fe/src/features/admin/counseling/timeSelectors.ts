import type { AcademicPeriod } from "../../../lib/academicPeriods";

export type CounselingPeriodKey = "hari" | "minggu" | "bulan" | "semester";
export type CounselingDateRange = { s: Date; e: Date };
const DAY = 864e5;

const parseISO = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};

/** Date range uses local calendar boundaries, matching the existing Admin view. */
export function getCounselingDateRange(
  period: CounselingPeriodKey,
  anchor: Date,
  semester: AcademicPeriod | null,
): CounselingDateRange {
  const y = anchor.getFullYear();
  const m = anchor.getMonth();
  const d = anchor.getDate();
  if (period === "hari") return { s: new Date(y, m, d), e: new Date(y, m, d + 1) };
  if (period === "minggu") return { s: new Date(y, m, d - 6), e: new Date(y, m, d + 1) };
  if (period === "bulan") return { s: new Date(y, m, 1), e: new Date(y, m + 1, 1) };
  if (!semester) return { s: new Date(0), e: new Date(0) };
  return { s: parseISO(semester.start), e: new Date(parseISO(semester.end).getTime() + DAY) };
}

/** Chart buckets retain the existing daily/hourly and semester/month grouping. */
export function createCounselingChartBuckets(period: CounselingPeriodKey, range: CounselingDateRange) {
  const y = range.s.getFullYear();
  const m = range.s.getMonth();
  const d = range.s.getDate();
  if (period === "hari") {
    return Array.from({ length: 9 }, (_, i) => ({ label: `${8 + i}:00`, s: new Date(y, m, d, 8 + i), e: new Date(y, m, d, 9 + i) }));
  }
  if (period === "semester") {
    return Array.from({ length: 6 }, (_, i) => ({
      label: new Date(y, m + i, 1).toLocaleDateString("id-ID", { month: "short" }),
      s: i === 0 ? range.s : new Date(y, m + i, 1),
      e: new Date(y, m + i + 1, 1),
    }));
  }
  const days = Math.round((range.e.getTime() - range.s.getTime()) / DAY);
  return Array.from({ length: days }, (_, i) => {
    const start = new Date(y, m, d + i);
    return { label: String(start.getDate()), s: start, e: new Date(y, m, d + i + 1) };
  });
}
