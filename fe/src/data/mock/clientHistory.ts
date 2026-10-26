import {
  CLIENT_BOOKING_STATUS,
  type ClientHistoryBookingStatus,
} from "../../constants/status";
import type { CounselingFormat } from "../../types/counseling";
import type { ClientCounselorKey as CounselorKey } from "./clientCounselors";
import { LEGACY_UI_SEMESTERS as SEMESTERS } from "./academicPeriods";
export { SEMESTERS };

/** Screen-specific history fixture; IDs are intentionally not linked to other role datasets. */

export type Session = {
  id: number;
  counselor: CounselorKey;
  format: CounselingFormat;
  date: string;
  time: string;
  topic: string;
  noteClient: string;
  plan: string;
};

export type Booking = {
  id: string;
  counselor: CounselorKey;
  format: CounselingFormat;
  requestedAt: string;
  date: string;
  time: string;
  status: ClientHistoryBookingStatus;
};

export const SESSIONS: Session[] = [
  {
    id: 1,
    counselor: "GY",
    format: "Individu",
    date: "2026-09-02",
    time: "15.00",
    topic: "Pengembangan Diri",
    noteClient:
      "Kamu mulai berani menetapkan target kecil setiap minggu. Pertahankan ritme ini.",
    plan: "",
  },
  {
    id: 2,
    counselor: "RW",
    format: "Individu",
    date: "2026-09-05",
    time: "14.00",
    topic: "Stres",
    noteClient:
      "Teknik jeda lima menit saat tekanan muncul sudah kamu coba. Bagus sekali.",
    plan: "Catat situasi pemicu stres selama satu minggu.",
  },
  {
    id: 3,
    counselor: "GY",
    format: "Kelompok",
    date: "2026-09-09",
    time: "10.00",
    topic: "Motivasi belajar",
    noteClient:
      "Kamu aktif memberi dukungan kepada teman kelompok. Terima kasih.",
    plan: "",
  },
  {
    id: 4,
    counselor: "GY",
    format: "Individu",
    date: "2026-09-12",
    time: "15.00",
    topic: "Kecemasan",
    noteClient:
      "Latihan pernapasan dalam membantu saat cemas mendadak. Lanjutkan.",
    plan: "Sesi lanjutan dua minggu lagi.",
  },
  {
    id: 5,
    counselor: "RW",
    format: "Kelompok",
    date: "2026-09-16",
    time: "09.00",
    topic: "Manajemen emosi",
    noteClient:
      "Kamu jujur menceritakan pengalamanmu. Itu membantu kelompok belajar bersama.",
    plan: "",
  },
  {
    id: 6,
    counselor: "GY",
    format: "Individu",
    date: "2026-09-19",
    time: "15.00",
    topic: "Evaluasi",
    noteClient: "Perkembanganmu sudah terlihat. Teruskan jurnal harian.",
    plan: "",
  },
  {
    id: 7,
    counselor: "RW",
    format: "Individu",
    date: "2026-09-23",
    time: "14.00",
    topic: "Hubungan keluarga",
    noteClient:
      "Membuka percakapan dengan keluarga adalah langkah besar. Kamu sudah melakukannya.",
    plan: "Latihan komunikasi asertif di rumah.",
  },
  {
    id: 8,
    counselor: "GY",
    format: "Kelompok",
    date: "2026-09-26",
    time: "10.00",
    topic: "Kepercayaan diri",
    noteClient: "Kamu mulai percaya pada pendapatmu sendiri di dalam kelompok.",
    plan: "",
  },
  {
    id: 9,
    counselor: "GY",
    format: "Individu",
    date: "2026-09-28",
    time: "15.00",
    topic: "Pengembangan Diri",
    noteClient:
      "Kamu sudah mulai mengenali pola pikirmu sendiri. Coba tuliskan satu hal kecil yang berhasil setiap malam.",
    plan: "Sesi lanjutan dua minggu lagi.",
  },
  {
    id: 10,
    counselor: "RW",
    format: "Individu",
    date: "2026-09-30",
    time: "13.00",
    topic: "Karir",
    noteClient:
      "Kamu sudah punya beberapa opsi karir yang ingin dieksplorasi. Langkah yang baik.",
    plan: "",
  },
  {
    id: 11,
    counselor: "GY",
    format: "Individu",
    date: "2026-10-02",
    time: "15.00",
    topic: "Tidur",
    noteClient: "",
    plan: "",
  },
  {
    id: 12,
    counselor: "RW",
    format: "Kelompok",
    date: "2026-10-03",
    time: "09.00",
    topic: "Stres",
    noteClient:
      "Kamu membantu peserta lain merasa nyaman untuk berbagi cerita.",
    plan: "",
  },
  {
    id: 13,
    counselor: "GY",
    format: "Individu",
    date: "2026-10-05",
    time: "15.00",
    topic: "Evaluasi",
    noteClient:
      "Kemajuanmu terlihat baik. Lanjutkan latihan pernapasan setiap pagi.",
    plan: "",
  },
  {
    id: 14,
    counselor: "RW",
    format: "Individu",
    date: "2026-10-06",
    time: "14.00",
    topic: "Kecemasan",
    noteClient: "Kamu sudah bisa mengenali tanda-tanda kecemasan lebih awal.",
    plan: "",
  },
  {
    id: 15,
    counselor: "GY",
    format: "Kelompok",
    date: "2026-10-07",
    time: "10.00",
    topic: "Motivasi belajar",
    noteClient:
      "Terima kasih sudah aktif berdiskusi bersama kelompok. Saling mendukung adalah kekuatan.",
    plan: "Jadwal lanjutan akan diinfokan.",
  },
  {
    id: 16,
    counselor: "RW",
    format: "Individu",
    date: "2026-10-08",
    time: "14.00",
    topic: "Stres",
    noteClient:
      "Kamu sudah berani membicarakan tekanan yang dirasakan. Itu langkah yang penting.",
    plan: "",
  },
  {
    id: 17,
    counselor: "GY",
    format: "Individu",
    date: "2026-10-09",
    time: "15.00",
    topic: "Hubungan keluarga",
    noteClient: "Kamu mulai menyampaikan kebutuhanmu dengan lebih tenang.",
    plan: "",
  },
  {
    id: 18,
    counselor: "RW",
    format: "Kelompok",
    date: "2026-10-10",
    time: "09.00",
    topic: "Manajemen emosi",
    noteClient:
      "Kamu berhasil mengenali emosi saat diskusi kelompok berlangsung.",
    plan: "",
  },
  {
    id: 19,
    counselor: "GY",
    format: "Individu",
    date: "2026-10-12",
    time: "13.00",
    topic: "Kepercayaan diri",
    noteClient: "",
    plan: "",
  },
  {
    id: 20,
    counselor: "RW",
    format: "Individu",
    date: "2026-10-14",
    time: "14.00",
    topic: "Karir",
    noteClient: "Kamu sudah menyusun langkah konkret untuk rencana karirmu.",
    plan: "Tinjau kembali rencana tersebut bulan depan.",
  },
];

export const BOOKINGS: Booking[] = [
  {
    id: "B-101",
    counselor: "GY",
    format: "Individu",
    requestedAt: "2026-10-15",
    date: "2026-10-20",
    time: "10.00",
    status: CLIENT_BOOKING_STATUS.PENDING,
  },
  {
    id: "B-102",
    counselor: "RW",
    format: "Individu",
    requestedAt: "2026-10-02",
    date: "2026-10-09",
    time: "14.00",
    status: CLIENT_BOOKING_STATUS.REJECTED,
  },
  {
    id: "B-103",
    counselor: "GY",
    format: "Kelompok",
    requestedAt: "2026-10-12",
    date: "2026-10-27",
    time: "10.00",
    status: CLIENT_BOOKING_STATUS.SCHEDULED,
  },
  {
    id: "B-104",
    counselor: "RW",
    format: "Individu",
    requestedAt: "2026-10-16",
    date: "2026-10-23",
    time: "14.00",
    status: CLIENT_BOOKING_STATUS.PENDING,
  },
  {
    id: "B-105",
    counselor: "GY",
    format: "Individu",
    requestedAt: "2026-09-18",
    date: "2026-09-25",
    time: "15.00",
    status: CLIENT_BOOKING_STATUS.SCHEDULED,
  },
  {
    id: "B-106",
    counselor: "RW",
    format: "Kelompok",
    requestedAt: "2026-10-17",
    date: "2026-10-29",
    time: "09.00",
    status: CLIENT_BOOKING_STATUS.SCHEDULED,
  },
  {
    id: "B-107",
    counselor: "GY",
    format: "Individu",
    requestedAt: "2026-09-22",
    date: "2026-09-30",
    time: "15.00",
    status: CLIENT_BOOKING_STATUS.REJECTED,
  },
  {
    id: "B-108",
    counselor: "RW",
    format: "Individu",
    requestedAt: "2026-09-25",
    date: "2026-10-01",
    time: "13.00",
    status: CLIENT_BOOKING_STATUS.SCHEDULED,
  },
  {
    id: "B-109",
    counselor: "GY",
    format: "Kelompok",
    requestedAt: "2026-09-27",
    date: "2026-10-07",
    time: "10.00",
    status: CLIENT_BOOKING_STATUS.SCHEDULED,
  },
  {
    id: "B-110",
    counselor: "RW",
    format: "Kelompok",
    requestedAt: "2026-10-05",
    date: "2026-10-13",
    time: "09.00",
    status: CLIENT_BOOKING_STATUS.REJECTED,
  },
  {
    id: "B-111",
    counselor: "GY",
    format: "Individu",
    requestedAt: "2026-10-07",
    date: "2026-10-12",
    time: "13.00",
    status: CLIENT_BOOKING_STATUS.SCHEDULED,
  },
  {
    id: "B-112",
    counselor: "RW",
    format: "Individu",
    requestedAt: "2026-10-09",
    date: "2026-10-16",
    time: "14.00",
    status: CLIENT_BOOKING_STATUS.REJECTED,
  },
  {
    id: "B-113",
    counselor: "GY",
    format: "Individu",
    requestedAt: "2026-10-13",
    date: "2026-11-02",
    time: "15.00",
    status: CLIENT_BOOKING_STATUS.SCHEDULED,
  },
  {
    id: "B-114",
    counselor: "RW",
    format: "Individu",
    requestedAt: "2026-10-14",
    date: "2026-11-04",
    time: "14.00",
    status: CLIENT_BOOKING_STATUS.PENDING,
  },
  {
    id: "B-115",
    counselor: "GY",
    format: "Kelompok",
    requestedAt: "2026-10-15",
    date: "2026-11-06",
    time: "10.00",
    status: CLIENT_BOOKING_STATUS.PENDING,
  },
  {
    id: "B-116",
    counselor: "RW",
    format: "Individu",
    requestedAt: "2026-10-03",
    date: "2026-10-10",
    time: "14.00",
    status: CLIENT_BOOKING_STATUS.SCHEDULED,
  },
  {
    id: "B-117",
    counselor: "GY",
    format: "Individu",
    requestedAt: "2026-09-29",
    date: "2026-10-05",
    time: "15.00",
    status: CLIENT_BOOKING_STATUS.REJECTED,
  },
  {
    id: "B-118",
    counselor: "RW",
    format: "Kelompok",
    requestedAt: "2026-10-08",
    date: "2026-10-15",
    time: "09.00",
    status: CLIENT_BOOKING_STATUS.SCHEDULED,
  },
  {
    id: "B-119",
    counselor: "GY",
    format: "Individu",
    requestedAt: "2026-10-10",
    date: "2026-11-10",
    time: "13.00",
    status: CLIENT_BOOKING_STATUS.SCHEDULED,
  },
  {
    id: "B-120",
    counselor: "RW",
    format: "Individu",
    requestedAt: "2026-10-18",
    date: "2026-11-12",
    time: "15.00",
    status: CLIENT_BOOKING_STATUS.SCHEDULED,
  },
];

export const ESSAY_POOL = {
  complaint: [
    "Sering merasa cemas berlebihan menjelang tugas dan presentasi.",
    "Sulit fokus dan mudah lelah saat bekerja, terutama di sore hari.",
    "Merasa tertekan dengan banyaknya tanggung jawab sehingga sulit beristirahat.",
  ],
  history: [
    "Keluhan muncul sejak beberapa bulan terakhir setelah perubahan rutinitas.",
    "Awalnya ringan, lalu semakin sering terasa sejak awal semester.",
    "Terjadi setiap kali ada tenggat waktu, dan membaik ketika beban berkurang.",
  ],
  reason: [
    "Ingin memiliki strategi untuk mengelola kondisi yang sedang dialami.",
    "Ingin belajar cara menenangkan diri saat tekanan datang.",
    "Merasa butuh teman bicara yang netral untuk memahami diri sendiri.",
  ],
  efforts: [
    "Sudah mencoba membuat jadwal harian dan beristirahat lebih teratur.",
    "Berbicara dengan teman dekat, tetapi masih terasa belum cukup.",
    "Mencoba olahraga ringan dan menulis jurnal beberapa kali.",
  ],
  goal: [
    "Mendapat rencana yang realistis untuk mengelola stres.",
    "Ingin lebih tenang dan percaya diri saat menghadapi tugas.",
    "Ingin memahami pemicu emosi dan cara meresponsnya dengan baik.",
  ],
  strengths: [
    "Mudah bergaul dan bertanggung jawab terhadap komitmen.",
    "Teliti, mau belajar, dan terbuka menerima masukan.",
    "Peduli pada orang lain dan pekerja keras.",
  ],
  weaknesses: [
    "Cenderung menunda pekerjaan dan terlalu keras pada diri sendiri.",
    "Sulit berkata tidak saat diminta bantuan.",
    "Mudah khawatir berlebihan terhadap hal yang belum terjadi.",
  ],
};
