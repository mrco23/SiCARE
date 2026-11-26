import type { AcademicPeriod, PeriodStatus } from "../types/academicPeriod";
import type { AcademicPeriodRecordDto } from "../types/api";
import { DEFAULT_ACADEMIC_PERIODS } from "../constants/academicPeriods";
import {
  formatIndonesianDate,
  parseLocalISODate,
  toISODate,
} from "./dateUtils";

export type { AcademicPeriod, PeriodStatus, Semester } from "../types/academicPeriod";

export function mapAcademicPeriodDto(
  dto: AcademicPeriodRecordDto,
): AcademicPeriod {
  return {
    id: dto.id,
    ta: dto.academic_year,
    sem: dto.semester,
    label: `${dto.academic_year} ${dto.semester}`,
    start: dto.starts_on,
    end: dto.ends_on,
  };
}

export const DEFAULT_PERIODS: AcademicPeriod[] = DEFAULT_ACADEMIC_PERIODS;

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
