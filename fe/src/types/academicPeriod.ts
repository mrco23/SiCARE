export type Semester = "Ganjil" | "Genap";

export type PeriodStatus = "Aktif" | "Mendatang" | "Selesai";

export interface AcademicPeriod {
  id: string;
  ta: string; // Tahun akademik, misalnya "2025/2026"
  sem: Semester;
  label: string;
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
}
