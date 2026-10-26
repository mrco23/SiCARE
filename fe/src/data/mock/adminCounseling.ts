import {
  SESSION_OUTCOME_STATUS,
  type SessionOutcomeStatus,
} from "../../constants/status";
import type { CounselingFormatKey } from "../../types/counseling";

/** Admin counseling analytics seed. Participant indices are synthetic report values, not client IDs. */

export const COUNSELORS = [
  "Ma'am Giovanna Yudi, M.Psi",
  "Dr. Budi Santoso, Psikolog",
  "Sari Wulandari, M.Psi",
];

export const RATING = [4.8, 4.2, 4.5];

export const REASONS = [
  "Konflik jadwal pribadi",
  "Klien sakit",
  "Tidak ada respons dari klien",
  "Konselor berhalangan",
  "Masalah koneksi sesi online",
];

export type Session = {
  id: number;
  start: Date;
  type: CounselingFormatKey;
  durasi: number;
  konselor: number;
  participants: number[];
  status: SessionOutcomeStatus;
  cancelledBy: "konselor" | "klien" | null;
  cancelReason: string | null;
  cancelLead: number | null; // jam sebelum jadwal
};

export const NOW = new Date();

let seed = 7;

const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

export const SESI: Session[] = Array.from({ length: 60 }, (_, i) => {
  const ago = i < 6 ? 0 : i < 9 ? 1 : Math.floor(rnd() * 240);
  const hour = 8 + Math.floor(rnd() * 9);
  const start = new Date(
    NOW.getFullYear(),
    NOW.getMonth(),
    NOW.getDate() - ago,
    hour,
    0,
  );
  const type: CounselingFormatKey = rnd() < 0.65 ? "individu" : "kelompok";
  const cancelled = rnd() < 0.15;
  const n = type === "individu" ? 1 : 3 + Math.floor(rnd() * 6);
  return {
    id: 1001 + i,
    start,
    type,
    durasi: rnd() < 0.7 ? 60 : 45,
    konselor: Math.floor(rnd() * 3),
    participants: Array.from({ length: n }, (_, k) => i * 10 + k),
    status: cancelled
      ? SESSION_OUTCOME_STATUS.CANCELLED
      : SESSION_OUTCOME_STATUS.COMPLETED,
    cancelledBy: (cancelled
      ? rnd() < 0.6
        ? "konselor"
        : "klien"
      : null) as Session["cancelledBy"],
    cancelReason: cancelled
      ? REASONS[Math.floor(rnd() * REASONS.length)]
      : null,
    cancelLead: cancelled ? Math.round(rnd() * 48) : null,
  };
}).sort((a, b) => b.start.getTime() - a.start.getTime());
