/** Shared format values used by booking, session, and history screens. */
export type CounselingFormat = "Individu" | "Kelompok";

/** Shared answer options used by the client intake questionnaire. */
export type IntakeAnswer = "Ya" | "Mungkin" | "Tidak";

export interface ClientIntake {
  selfHarm: IntakeAnswer;
  distress: IntakeAnswer;
  abuse: IntakeAnswer;
  substance: IntakeAnswer;
  sleep: number;
  finance: number;
  topics: string[];
  other?: string;
  complaint: string;
  history: string;
  reason: string;
  efforts: string;
  goal: string;
  strengths: string;
  weaknesses: string;
}
