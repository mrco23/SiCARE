export type Semester = "Ganjil" | "Genap";

export type AcademicPeriod = {
  id: string;
  ta: string; // "2025/2026"
  sem: Semester;
  label: string;
  start: string; // yyyy-mm-dd
  end: string; // yyyy-mm-dd
};

export type PeriodStatus = "Aktif" | "Mendatang" | "Selesai";

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

export const DEFAULT_PERIODS: AcademicPeriod[] = [
  makePeriod("2024/2025", "Ganjil", "2024-08-19", "2025-01-31"),
  makePeriod("2024/2025", "Genap", "2025-02-01", "2025-07-31"),
  makePeriod("2025/2026", "Ganjil", "2025-08-18", "2026-01-31"),
  makePeriod("2025/2026", "Genap", "2026-02-01", "2026-07-31"),
  makePeriod("2026/2027", "Ganjil", "2026-08-17", "2027-01-31"),
];

export function loadPeriods(): AcademicPeriod[] {
  try {
    const a = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
    if (Array.isArray(a)) return a;
  } catch {
    /* abaikan */
  }
  return DEFAULT_PERIODS.map((p) => ({ ...p }));
}

export const sortPeriods = (list: AcademicPeriod[]) =>
  [...list].sort((a, b) => a.start.localeCompare(b.start));

const pad = (n: number) => String(n).padStart(2, "0");

/** Tanggal lokal dalam format yyyy-mm-dd */
export const toISO = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const fmtDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

export const periodStatus = (p: AcademicPeriod, today: string): PeriodStatus =>
  today < p.start ? "Mendatang" : today > p.end ? "Selesai" : "Aktif";

export const isInPeriod = (iso: string, p: AcademicPeriod) =>
  iso >= p.start && iso <= p.end;
