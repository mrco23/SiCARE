import { SESSION_OUTCOME_LABEL, type SessionOutcomeLabel } from "../../constants/status";
import type { CounselingFormat } from "../../types/counseling";
import {
  REPORT_COUNSELORS as COUNSELORS,
} from "./reportCommon";

/** Synthetic aggregate sessions for Head LMI reports; intentionally separate from Admin report sessions. */

export type Session = {
  id: string;
  date: string;
  format: CounselingFormat;
  status: SessionOutcomeLabel;
  counselor: string;
  cancellationReason: string;
};

export const CANCELLATION_REASONS = [
  "Klien berhalangan",
  "Konselor berhalangan",
  "Jadwal bentrok",
  "Alasan administratif",
];

export const SESSIONS: Session[] = Array.from({ length: 240 }, (_, index) => {
  const date = new Date(Date.UTC(2024, 7, 20) + index * 2.3 * 864e5);
  const cancelled = index % 8 === 0 || index % 17 === 0;

  return {
    id: `S${String(index + 1).padStart(3, "0")}`,
    date: date.toISOString().slice(0, 10),
    format: index % 4 === 0 ? "Kelompok" : "Individu",
    status: cancelled
      ? SESSION_OUTCOME_LABEL.CANCELLED
      : SESSION_OUTCOME_LABEL.COMPLETED,
    counselor: COUNSELORS[index % COUNSELORS.length],
    cancellationReason: cancelled
      ? CANCELLATION_REASONS[index % CANCELLATION_REASONS.length]
      : "",
  };
});
