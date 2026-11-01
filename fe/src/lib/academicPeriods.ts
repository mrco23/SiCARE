import type { AcademicPeriod, PeriodStatus, Semester } from "../types/academicPeriod";
import type { AcademicPeriodRecordDto } from "../types/api";
import { DEFAULT_ACADEMIC_PERIODS } from "../data/mock/academicPeriods";
import {
  formatIndonesianDate,
  parseLocalISODate,
  toISODate,
} from "./dateUtils";

export type { AcademicPeriod, PeriodStatus, Semester } from "../types/academicPeriod";

export function mapAcademicPeriodDto(
  dto: AcademicPeriodRecordDto,
): AcademicPeriod & { isPublished: boolean } {
  return {
    id: dto.id,
    ta: dto.academic_year,
    sem: dto.semester,
    label: `${dto.academic_year} ${dto.semester}`,
    start: dto.starts_on,
    end: dto.ends_on,
    isPublished: dto.is_published,
  };
}

export const STORE_KEY = "sicare.periods";

export const makePeriod = (
  ta: string,
  sem: Semester,
  start: string,
  end: string,
): AcademicPeriod => ({
  id: `${ta.replace("/", "-")}-${sem.toLowerCase()}`,
  ta,
  sem,
  label: `${ta} ${sem}`,
  start,
  end,
});

export const DEFAULT_PERIODS: AcademicPeriod[] = DEFAULT_ACADEMIC_PERIODS;

export function loadPeriods(): AcademicPeriod[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
    if (Array.isArray(parsed)) return parsed as AcademicPeriod[];
  } catch {
    /* abaikan */
  }
  return DEFAULT_PERIODS.map((period) => ({ ...period }));
}

/** Persist the editable demo period list using the shared versioned key. */
export function savePeriods(periods: readonly AcademicPeriod[]): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(periods));
  } catch {
    /* Storage may be unavailable in private/restricted browser contexts. */
  }
}

export const sortPeriods = (list: AcademicPeriod[]) =>
  [...list].sort((a, b) => a.start.localeCompare(b.start));

/** Backward-compatible alias used by existing pages. */
export const toISO = toISODate;

/** Short date format used by the period selectors and report headers. */
export const fmtDate = (iso: string) =>
  formatIndonesianDate(parseLocalISODate(iso), {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

export const periodStatus = (period: AcademicPeriod, today: string): PeriodStatus =>
  today < period.start ? "Mendatang" : today > period.end ? "Selesai" : "Aktif";

export const isInPeriod = (iso: string, period: AcademicPeriod) =>
  iso >= period.start && iso <= period.end;
