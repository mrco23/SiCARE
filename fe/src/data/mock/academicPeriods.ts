import type { AcademicPeriod } from "../../types/academicPeriod";

/**
 * Canonical deterministic academic-period seed shared by the period manager
 * and reporting pages. Dates and IDs preserve the existing lib default list.
 */
export const DEFAULT_ACADEMIC_PERIODS: AcademicPeriod[] = [
  { id: "2024-2025-ganjil", ta: "2024/2025", sem: "Ganjil", label: "2024/2025 Ganjil", start: "2024-08-19", end: "2025-01-31" },
  { id: "2024-2025-genap", ta: "2024/2025", sem: "Genap", label: "2024/2025 Genap", start: "2025-02-01", end: "2025-07-31" },
  { id: "2025-2026-ganjil", ta: "2025/2026", sem: "Ganjil", label: "2025/2026 Ganjil", start: "2025-08-18", end: "2026-01-31" },
  { id: "2025-2026-genap", ta: "2025/2026", sem: "Genap", label: "2025/2026 Genap", start: "2026-02-01", end: "2026-07-31" },
  { id: "2026-2027-ganjil", ta: "2026/2027", sem: "Ganjil", label: "2026/2027 Ganjil", start: "2026-08-17", end: "2027-01-31" },
];

/**
 * Legacy semester selector seed used by the client-history and counselor-feedback
 * screens. It intentionally retains the existing August 1 boundaries; do not
 * conflate it with DEFAULT_ACADEMIC_PERIODS (August 17/18) without product review.
 */
export interface LegacyUISemester {
  id: string;
  ta: string;
  sem: string;
  start: string;
  end: string;
}

export const LEGACY_UI_SEMESTERS: LegacyUISemester[] = [
  { id: "2025-1", ta: "2025/2026", sem: "Ganjil", start: "2025-08-01", end: "2026-01-31" },
  { id: "2025-2", ta: "2025/2026", sem: "Genap", start: "2026-02-01", end: "2026-07-31" },
  { id: "2026-1", ta: "2026/2027", sem: "Ganjil", start: "2026-08-01", end: "2027-01-31" },
];
