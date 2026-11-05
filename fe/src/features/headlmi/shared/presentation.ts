import { ApiError } from "../../../lib/api";
import type { AcademicPeriod } from "../../../lib/academicPeriods";
import type {
  AdminReportDto,
  PublicAcademicPeriodDto,
  PublicCounselorDto,
} from "../../../types/api";

/** Kepala LMI membaca periode dari direktori publik (hanya yang dipublikasikan). */
export function mapPublicAcademicPeriod(dto: PublicAcademicPeriodDto): AcademicPeriod {
  return {
    id: dto.id,
    ta: dto.academic_year,
    sem: dto.semester === "Genap" ? "Genap" : "Ganjil",
    label: `${dto.academic_year} ${dto.semester}`,
    start: dto.starts_on,
    end: dto.ends_on,
  };
}

/** Short Indonesian month labels used by Head LMI charts. */
export const MONTH_SHORT_ID = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
] as const;

/** Formats a backend `YYYY-MM` key as "Okt 2026". */
export function formatMonthKey(key: string, withYear = true): string {
  const month = Number(key.slice(5, 7));
  const label = MONTH_SHORT_ID[month - 1] ?? key;
  return withYear ? `${label} ${key.slice(0, 4)}` : label;
}

/** Formats an ISO timestamp as a readable Indonesian date. */
export function formatIsoDate(
  iso: string | null | undefined,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" },
): string {
  if (!iso) return "-";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("id-ID", options);
}

/** Formats an ISO timestamp with date and time. */
export function formatIsoDateTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Builds the list of `YYYY-MM` keys between the report range bounds (UTC, inclusive),
 * so months without any record are shown as zero instead of silently disappearing.
 * Backend groups records with `created_at.slice(0, 7)` (UTC ISO), so UTC is used here too.
 */
export function buildMonthKeys(fromIso: string, toIso: string, maxMonths = 24): string[] {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) return [];
  const keys: string[] = [];
  let year = from.getUTCFullYear();
  let month = from.getUTCMonth();
  const endYear = to.getUTCFullYear();
  const endMonth = to.getUTCMonth();
  while ((year < endYear || (year === endYear && month <= endMonth)) && keys.length < maxMonths) {
    keys.push(`${year}-${String(month + 1).padStart(2, "0")}`);
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }
  return keys;
}

export type MonthlyRow = AdminReportDto["monthly"][number];

/** Merges backend monthly aggregates into a contiguous month range filled with zeros. */
export function fillMonthlyRange(report: AdminReportDto): MonthlyRow[] {
  const byMonth = new Map(report.monthly.map((row) => [row.month, row]));
  const keys = buildMonthKeys(report.period.from, report.period.to);
  if (keys.length === 0) return [...report.monthly];
  const filled = keys.map(
    (month) => byMonth.get(month) ?? { month, bookings: 0, completed_sessions: 0, feedback_count: 0 },
  );
  // Keep any backend month outside the computed range instead of dropping real data.
  for (const row of report.monthly) if (!keys.includes(row.month)) filled.push(row);
  return filled.sort((a, b) => a.month.localeCompare(b.month));
}

/** Short administrative reference for UUIDs; never derived from client identity. */
export function shortRef(id: string): string {
  return id.replace(/-/g, "").slice(0, 8).toUpperCase() || "-";
}

/**
 * Builds a counselor-name lookup from backend sources available to `head_lmi`:
 * report counselors (active profiles) take precedence, public directory is the fallback.
 */
export function buildCounselorNameMap(
  reportCounselors: AdminReportDto["counselors"] | null | undefined,
  publicCounselors: PublicCounselorDto[] | null | undefined,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const counselor of publicCounselors ?? []) {
    if (counselor.profile_id && counselor.public_name) map.set(counselor.profile_id, counselor.public_name);
  }
  for (const counselor of reportCounselors ?? []) {
    if (counselor.counselor_id && counselor.counselor_name) map.set(counselor.counselor_id, counselor.counselor_name);
  }
  return map;
}

export function counselorLabel(map: Map<string, string>, counselorId: string): string {
  return map.get(counselorId) ?? `Konselor #${shortRef(counselorId)}`;
}

/** Converts API/network failures into user-facing Indonesian messages. */
export function describeApiError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Sesi login berakhir. Silakan masuk kembali.";
    if (error.status === 403) return "Akun Anda tidak memiliki akses ke data ini.";
    if (error.status === 404) return "Data tidak ditemukan atau sudah berubah.";
    return error.message || fallback;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export function formatRating(value: number | null | undefined, digits = 1): string {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(digits) : "–";
}

export const percent = (value: number, total: number): number =>
  total > 0 ? Math.round((value / total) * 100) : 0;

/** Normalizes Indonesian phone numbers to E.164 format (+62...). */
export function normalizePhoneToE164(raw: string): string | null {
  const cleaned = raw.replace(/[\s()-]/g, "").trim();
  if (!cleaned) return null;
  if (cleaned.startsWith("0")) {
    return `+62${cleaned.slice(1)}`;
  }
  if (cleaned.startsWith("62")) {
    return `+${cleaned}`;
  }
  return cleaned;
}

/** Validates phone string for backend compatibility (min 7, max 20, E.164). */
export function validatePhoneInput(phone: string): string | null {
  const cleaned = phone.replace(/[\s()-]/g, "").trim();
  if (!cleaned) return null;
  const e164 = normalizePhoneToE164(cleaned);
  if (!e164 || !/^\+[1-9][0-9]{6,14}$/.test(e164)) {
    return "Format nomor telepon tidak valid. Gunakan format 08... atau +628... (8-15 digit).";
  }
  return null;
}
