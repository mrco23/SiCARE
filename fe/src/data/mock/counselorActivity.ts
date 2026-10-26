import {
  COUNSELING_SESSION_STATUS,
  type CounselingSessionStatus,
} from "../../constants/status";
import type { CounselingFormat, IntakeAnswer } from "../../types/counseling";

/** Seed-only counselor activity data. It is intentionally not linked to history records by name. */

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

export const CANCEL_REASONS = [
  { code: "KLIEN_SAKIT", label: "Klien sakit" },
  { code: "KONSELOR_BERHALANGAN", label: "Konselor berhalangan" },
  { code: "KLIEN_TIDAK_HADIR", label: "Klien tidak hadir tanpa kabar" },
  { code: "JADWAL_BENTROK", label: "Jadwal bentrok" },
  { code: "LAINNYA", label: "Lainnya" },
];

const WORK_START = 8 * 60;

const WORK_LAST_START = 15 * 60;

const clamp = (value: number): number =>
  Math.min(WORK_LAST_START, Math.max(WORK_START, Math.round(value / 15) * 15));

const emptySession: Pick<
  CounselingSession,
  "cancel" | "noteCounselor" | "noteClient" | "plan"
> = {
  cancel: null,
  noteCounselor: "",
  noteClient: "",
  plan: "",
};

export function buildDummySessions(nowM: number): CounselingSession[] {
  const scheduled = (
    id: number,
    client: string,
    topic: string,
    format: CounselingFormat,
    offset: number,
    minStart: number,
  ): CounselingSession => ({
    id,
    client,
    topic,
    format,
    start: clamp(Math.max(nowM + offset, minStart)),
    status: COUNSELING_SESSION_STATUS.SCHEDULED,
    startedAt: null,
    ...emptySession,
  });

  return [
    {
      id: 1,
      client: "Yusli Ngongano",
      topic: "Pengembangan Diri",
      format: "Individu",
      start: clamp(nowM - 20),
      status: COUNSELING_SESSION_STATUS.ONGOING,
      startedAt: clamp(nowM - 20),
      ...emptySession,
    },
    scheduled(2, "Ayu Pratiwi", "Motivasi", "Kelompok", 60, 495),
    scheduled(3, "Dimas Prasetyo", "Kecemasan", "Individu", 150, 510),
    scheduled(6, "Nadia Putri", "Manajemen Emosi", "Individu", 210, 525),
    scheduled(7, "Rizky Ramadhan", "Adaptasi Akademik", "Individu", 270, 540),
    scheduled(8, "Siti Maharani", "Pengembangan Diri", "Kelompok", 330, 555),
    scheduled(9, "Fajar Nugraha", "Stres Akademik", "Individu", 390, 570),
    scheduled(10, "Intan Permata", "Kepercayaan Diri", "Individu", 450, 585),
    scheduled(11, "Rafi Kurniawan", "Perencanaan Karier", "Individu", 510, 600),
    scheduled(12, "Melati Safitri", "Relasi Sosial", "Kelompok", 570, 615),
    scheduled(13, "Andi Saputra", "Pengelolaan Waktu", "Individu", 630, 630),
    scheduled(14, "Putri Amelia", "Motivasi Belajar", "Individu", 690, 645),
    scheduled(15, "Bima Prakoso", "Stres Kerja", "Individu", 750, 660),
    scheduled(16, "Nabila Zahra", "Regulasi Emosi", "Kelompok", 810, 675),
    scheduled(17, "Dewi Anggraini", "Persiapan Karier", "Individu", 870, 690),
    scheduled(18, "Arga Pratama", "Komunikasi Asertif", "Individu", 930, 705),
    {
      id: 4,
      client: "Bagas Hermawan",
      topic: "Stres kerja",
      format: "Individu",
      start: clamp(nowM - 300),
      status: COUNSELING_SESSION_STATUS.COMPLETED,
      startedAt: clamp(nowM - 300),
      cancel: null,
      noteCounselor:
        "Klien menunjukkan tanda kelelahan tinggi. Perlu asesmen lanjutan terkait beban kerja.",
      noteClient:
        "Kamu sudah mulai mengenali pemicu stres. Latihan pernapasan yang kita pelajari bisa dilakukan setiap pagi.",
      plan: "Sesi lanjutan dua minggu lagi.",
    },
    {
      id: 5,
      client: "Chelsea Ngongano",
      topic: "Motivasi",
      format: "Individu",
      start: clamp(nowM - 150),
      status: COUNSELING_SESSION_STATUS.CANCELLED,
      startedAt: null,
      cancel: {
        code: "KLIEN_SAKIT",
        label: "Klien sakit",
        note: "Klien mendadak sakit dan meminta jadwal ulang.",
      },
      noteCounselor: "",
      noteClient: "",
      plan: "",
    },
  ];
}

export const getCounselorActivityIntake = (client: string): ClientIntake => {
  const base: ClientIntake = {
    selfHarm: "Tidak",
    distress: "Tidak",
    abuse: "Tidak",
    substance: "Tidak",
    sleep: 3,
    finance: 3,
    topics: ["Motivasi"],
    complaint: "Klien merasa kewalahan dan sulit fokus.",
    history: "Keluhan muncul sejak beberapa bulan terakhir.",
    reason:
      "Ingin memiliki strategi untuk mengelola kondisi yang sedang dialami.",
    efforts: "Klien sudah mencoba beberapa cara secara mandiri.",
    goal: "Klien berharap mendapat rencana yang realistis.",
    strengths: "Klien mudah bergaul dan bertanggung jawab.",
    weaknesses: "Klien cenderung menunda pekerjaan.",
  };
  const overrides: Record<string, Partial<ClientIntake>> = {
    "Yusli Ngongano": {
      distress: "Ya",
      sleep: 2,
      topics: ["Karir, pendidikan, dan pekerjaan", "Motivasi"],
    },
    "Ayu Pratiwi": { distress: "Mungkin", sleep: 4, finance: 4 },
    "Dimas Prasetyo": { topics: ["Kecemasan"], sleep: 2 },
    "Chelsea Ngongano": {
      abuse: "Mungkin",
      finance: 2,
      topics: ["Stres atau tekanan kerja"],
    },
    "Bagas Hermawan": { topics: ["Karir, pendidikan, dan pekerjaan"] },
  };
  return { ...base, ...(overrides[client] || {}) };
};
