import {
  COUNSELING_REQUEST_STATUS,
  type CounselingRequestStatus,
} from "../../constants/status";
import type { CounselingFormat, IntakeAnswer } from "../../types/counseling";

/** Independent request-queue and intake fixtures; not linked to dashboard or history records by name. */

export type CounselingRequest = {
  id: number;
  name: string;
  format: CounselingFormat;
  time: string;
  waitMin: number;
  status: CounselingRequestStatus;
  isNew: boolean;
  pastSessions: number;
  topic: string;
  room?: string;
};

export type IntakeData = {
  date: string;
  selfHarm: IntakeAnswer;
  distress: IntakeAnswer;
  abuse: IntakeAnswer;
  substance: IntakeAnswer;
  sleep: number;
  finance: number;
  topics: string[];
  other: string;
  complaint: string;
  history: string;
  reason: string;
  efforts: string;
  goal: string;
  strengths: string;
  weaknesses: string;
};

export const initialRequests: CounselingRequest[] = [
  {
    id: 1,
    name: "Yusli Ngongano",
    format: "Individu",
    time: "15.00",
    waitMin: 185,
    status: COUNSELING_REQUEST_STATUS.PENDING,
    isNew: false,
    pastSessions: 3,
    topic: "Pengembangan Diri",
  },
  {
    id: 2,
    name: "Chelsea Ngongano",
    format: "Kelompok",
    time: "15.00",
    waitMin: 42,
    status: COUNSELING_REQUEST_STATUS.PENDING,
    isNew: true,
    pastSessions: 0,
    topic: "Motivasi",
  },
  {
    id: 3,
    name: "Chelsea Ngongano",
    format: "Individu",
    time: "15.00",
    waitMin: 1440,
    status: COUNSELING_REQUEST_STATUS.PENDING,
    isNew: true,
    pastSessions: 0,
    topic: "Stres",
  },
  {
    id: 4,
    name: "Bagas Hermawan",
    format: "Individu",
    time: "10.00",
    waitMin: 300,
    status: COUNSELING_REQUEST_STATUS.PENDING,
    isNew: false,
    pastSessions: 1,
    topic: "Stres kerja",
  },
];

const intakeDefaults: IntakeData = {
  date: "28 September 2026",
  selfHarm: "Tidak",
  distress: "Tidak",
  abuse: "Tidak",
  substance: "Tidak",
  sleep: 3,
  finance: 3,
  topics: ["Motivasi"],
  other: "",
  complaint: "Klien merasa kewalahan dan sulit fokus.",
  history: "Keluhan muncul sejak beberapa bulan terakhir.",
  reason:
    "Ingin memiliki strategi untuk mengelola kondisi yang sedang dialami.",
  efforts: "Klien sudah mencoba beberapa cara secara mandiri.",
  goal: "Klien berharap mendapat rencana yang realistis.",
  strengths: "Klien mudah bergaul dan bertanggung jawab.",
  weaknesses: "Klien cenderung menunda pekerjaan.",
};

export const intakes: Record<number, IntakeData> = {
  1: {
    ...intakeDefaults,
    distress: "Ya",
    sleep: 2,
    topics: ["Karir, pendidikan, dan pekerjaan", "Motivasi"],
  },
  2: { ...intakeDefaults, distress: "Mungkin", sleep: 4, finance: 4 },
  3: {
    ...intakeDefaults,
    abuse: "Mungkin",
    sleep: 3,
    finance: 2,
    topics: ["Stres atau tekanan kerja", "Emosi, mood, kepribadian"],
  },
  4: {
    ...intakeDefaults,
    topics: ["Karir, pendidikan, dan pekerjaan"],
    date: "10 Oktober 2026",
  },
};
