import type { CounselingSessionStatus } from "../constants/status";

/** Shared format values used by booking, session, and history screens. */
export type CounselingFormat = "Individu" | "Kelompok";

/** Lowercase format keys used by the administrative reporting view. */
export type CounselingFormatKey = "individu" | "kelompok";

/** Shared answer options used by the client intake questionnaire. */
export type IntakeAnswer = "Ya" | "Mungkin" | "Tidak";

export interface CancelInfo {
  code: string;
  label: string;
  note: string;
}

export interface CounselingSession {
  id: number;
  client: string;
  topic: string;
  format: CounselingFormat;
  start: number;
  status: CounselingSessionStatus;
  startedAt: number | null;
  cancel: CancelInfo | null;
  noteCounselor: string;
  noteClient: string;
  plan: string;
}

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
