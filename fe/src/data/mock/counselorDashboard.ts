import {
  COUNSELING_REQUEST_STATUS,
  type CounselingRequestStatus,
} from "../../constants/status";
import type { CounselingFormat } from "../../types/counseling";

/** Dashboard snapshot kept separate from the request-queue fixture until IDs/topics are reconciled. */

export type Request = {
  id: number;
  name: string;
  role: string;
  topic: string;
  format: CounselingFormat;
  waitMin: number;
  status: CounselingRequestStatus;
};

export type Session = {
  id: number;
  client: string;
  topic: string;
  format: CounselingFormat;
  time: string; // "HH.MM", durasi 1 jam
};

export const initialRequests: Request[] = [
  {
    id: 1,
    name: "Yusli Ngongano",
    role: "Mahasiswa",
    topic: "Masalah akademik & manajemen waktu",
    format: "Individu",
    waitMin: 185,
    status: COUNSELING_REQUEST_STATUS.PENDING,
  },
  {
    id: 2,
    name: "Ayu Pratiwi",
    role: "Mahasiswa",
    topic: "Kecemasan menghadapi ujian",
    format: "Kelompok",
    waitMin: 42,
    status: COUNSELING_REQUEST_STATUS.PENDING,
  },
  {
    id: 3,
    name: "Bagas Hermawan",
    role: "Dosen / Staf",
    topic: "Stres kerja",
    format: "Individu",
    waitMin: 1440,
    status: COUNSELING_REQUEST_STATUS.PENDING,
  },
];

export const initialSessions: Session[] = [
  {
    id: 101,
    client: "Ayu Pratiwi",
    topic: "Motivasi",
    format: "Kelompok",
    time: "10.00",
  },
  {
    id: 102,
    client: "Yusli Ngongano",
    topic: "Pengembangan Diri",
    format: "Individu",
    time: "15.00",
  },
];

export const SESSIONS_THIS_WEEK = 4;

export const RATINGS = [5, 5, 4, 5, 3];
