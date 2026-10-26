import {
  SESSION_OUTCOME_LABEL,
  type SessionOutcomeLabel,
} from "../../constants/status";
import type { CounselingFormat } from "../../types/counseling";
import { REPORT_COUNSELORS as COUNSELORS } from "./reportCommon";

/** Synthetic Admin report sessions; kept separate from the Head LMI report fixture. */

export type Session = {
  id: string;
  clientId: string; // ID anonim untuk data contoh
  date: string; // YYYY-MM-DD
  format: CounselingFormat;
  topic: string;
  status: SessionOutcomeLabel;
  rating: number | null;
  reason: string;
  cancelledBy: "Klien" | "Konselor" | "Administrasi" | "";
  counselor: string;
};

export const TOPICS = [
  "Pengembangan Diri",
  "Motivasi",
  "Stres kerja",
  "Kecemasan",
  "Relasi keluarga",
];

export const REASONS = [
  "Klien sakit",
  "Konselor berhalangan",
  "Klien tidak hadir tanpa kabar",
  "Jadwal bentrok",
];

export const SESSIONS: Session[] = Array.from({ length: 220 }, (_, i) => {
  const date = new Date(
    Date.UTC(2024, 7, 26) + i * 4 * 864e5 + (i % 3) * 864e5,
  );
  const cancelled = i % 7 === 0 || i % 19 === 0;
  const format = i % 4 === 0 ? "Kelompok" : "Individu";

  return {
    id: `S${String(i + 1).padStart(3, "0")}`,
    clientId: `K${String((i % 23) + 1).padStart(2, "0")}`,
    date: date.toISOString().slice(0, 10),
    format,
    topic: TOPICS[i % TOPICS.length],
    status: cancelled
      ? SESSION_OUTCOME_LABEL.CANCELLED
      : SESSION_OUTCOME_LABEL.COMPLETED,
    rating: cancelled ? null : [5, 4, 5, 3, 4, 5, 2, 4][i % 8],
    reason: cancelled ? REASONS[i % REASONS.length] : "",
    cancelledBy: cancelled
      ? (["Klien", "Konselor", "Administrasi"][i % 3] as Session["cancelledBy"])
      : "",
    counselor: COUNSELORS[i % COUNSELORS.length],
  };
});
