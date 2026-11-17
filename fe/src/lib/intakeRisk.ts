import type { ClientIntake } from "../types/counseling";

/**
 * Penanda keselamatan dari formulir intake: klien menjawab "Ya" atau "Mungkin" pada
 * pertanyaan keinginan bunuh diri. Penanda ini hanya menonjolkan permintaan agar ditinjau
 * lebih dulu; prosedur penanganan krisis mengikuti SOP LMI, bukan aplikasi.
 */
export function hasUrgentIntake(intake?: ClientIntake | null): boolean {
  return intake?.selfHarm === "Ya" || intake?.selfHarm === "Mungkin";
}

export const URGENT_INTAKE_LABEL = "Perlu perhatian segera";

export function urgentIntakeMessage(intake?: ClientIntake | null): string {
  const answer = intake?.selfHarm ?? "Ya";
  return `Klien menjawab "${answer}" pada pertanyaan keinginan bunuh diri. Tinjau permintaan ini lebih dulu dan ikuti SOP penanganan krisis LMI.`;
}
