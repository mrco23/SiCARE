import {
  CLIENT_ACTIVITY_COUNSELOR_SCHEDULE,
  CLIENT_COUNSELOR_IDENTITIES,
} from "./clientCounselors";

/** Initial client activity fixture; consent/signature values are deliberately unsigned/empty. */
export const COUNSELOR_SCHEDULE = CLIENT_ACTIVITY_COUNSELOR_SCHEDULE;

export type PendingSlot = {
  reason: string;
  note: string;
  label: string;
};

export type Session = {
  id: number;
  counselor: string;
  initials: string;
  service: string;
  room: string;
  start: Date;
  end: Date;
  rescheduleCount: number;
  feedbackGiven: boolean;
  rating: number;
  pendingSlot?: PendingSlot | null;
  consentSigned?: boolean;
  consentSignature?: string | null;
  consentSignedAt?: Date | null;
};

export const RESCHEDULE_REASONS = [
  "Bentrok jadwal kuliah",
  "Sakit",
  "Keperluan mendesak",
  "Lainnya",
];

export function createInitialSessions(): Session[] {
  const at = (minutesFromNow: number) =>
    new Date(Date.now() + minutesFromNow * 60_000);

  return [
    {
      id: 1,
      counselor: CLIENT_COUNSELOR_IDENTITIES.GY.historyName,
      initials: CLIENT_COUNSELOR_IDENTITIES.GY.initials,
      service: "Konseling Individu",
      room: "Ruang Konseling 01",
      start: at(-10),
      end: at(50),
      rescheduleCount: 0,
      feedbackGiven: false,
      rating: 0,
      pendingSlot: null,
      consentSigned: false,
      consentSignature: null,
      consentSignedAt: null,
    },
    {
      id: 2,
      counselor: CLIENT_COUNSELOR_IDENTITIES.RW.historyName,
      initials: CLIENT_COUNSELOR_IDENTITIES.RW.initials,
      service: "Konseling Individu",
      room: "Ruang Konseling 02",
      start: at(60 * 30),
      end: at(60 * 31),
      rescheduleCount: 0,
      feedbackGiven: false,
      rating: 0,
      pendingSlot: null,
    },
    {
      id: 3,
      counselor: CLIENT_COUNSELOR_IDENTITIES.GY.historyName,
      initials: CLIENT_COUNSELOR_IDENTITIES.GY.initials,
      service: "Konseling Individu",
      room: "Ruang Konseling 01",
      start: at(-60 * 20),
      end: at(-60 * 19),
      rescheduleCount: 0,
      feedbackGiven: false,
      rating: 0,
      pendingSlot: null,
    },
    {
      id: 4,
      counselor: CLIENT_COUNSELOR_IDENTITIES.RW.historyName,
      initials: CLIENT_COUNSELOR_IDENTITIES.RW.initials,
      service: "Konseling Individu",
      room: "Ruang Konseling 02",
      start: at(-60 * 48),
      end: at(-60 * 47),
      rescheduleCount: 0,
      feedbackGiven: false,
      rating: 0,
      pendingSlot: null,
    },
    {
      id: 5,
      counselor: CLIENT_COUNSELOR_IDENTITIES.GY.historyName,
      initials: CLIENT_COUNSELOR_IDENTITIES.GY.initials,
      service: "Konseling Individu",
      room: "Ruang Konseling 01",
      start: at(-60 * 72),
      end: at(-60 * 71),
      rescheduleCount: 0,
      feedbackGiven: true,
      rating: 5,
      pendingSlot: null,
    },
  ];
}
