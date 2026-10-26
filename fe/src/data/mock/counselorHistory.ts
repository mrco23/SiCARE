import type { CounselingFormat as Format } from "../../types/counseling";
import { toISO } from "../../lib/academicPeriods";

/** Counselor history fixture with client notes; no relationship to other pages is inferred from names. */

const relativeDate = (daysAgo: number) => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return toISO(date);
};

export type Session = {
  id: number;
  topic: string;
  format: Format;
  date: string; // YYYY-MM-DD
  time: string; // "HH.MM"
  summary: string;
  note: string;
};

export type Client = {
  id: string;
  name: string;
  email: string;
  role: string;
  password: string;
  sessions: Session[];
};

export const clients: Client[] = [
  {
    id: "c1",
    name: "Yusli Ngongano",
    email: "yusli@mhs.unikadelasalle.ac.id",
    role: "Mahasiswa",
    password: "1234",
    sessions: [
      {
        id: 1,
        topic: "Pengembangan Diri",
        format: "Individu",
        date: "2026-09-28",
        time: "15.00",
        summary: "Klien membahas rencana pengembangan diri jangka pendek.",
        note: "Klien aktif berdiskusi. Disepakati tugas refleksi mingguan.",
      },
      {
        id: 2,
        topic: "Pengembangan Diri",
        format: "Individu",
        date: "2026-10-02",
        time: "15.00",
        summary: "Lanjutan sesi sebelumnya.",
        note: "Progres baik. Perlu evaluasi pada sesi berikutnya.",
      },
      {
        id: 3,
        topic: "Pengembangan Diri",
        format: "Individu",
        date: "2026-10-05",
        time: "15.00",
        summary: "Sesi evaluasi bulanan.",
        note: "Klien menunjukkan kemajuan. Lanjutkan sesi rutin.",
      },
    ],
  },
  {
    id: "c2",
    name: "Ayu Pratiwi",
    email: "ayu@mhs.unikadelasalle.ac.id",
    role: "Mahasiswa",
    password: "1234",
    sessions: [
      {
        id: 4,
        topic: "Motivasi",
        format: "Kelompok",
        date: "2026-10-07",
        time: "10.00",
        summary: "Sesi kelompok motivasi belajar.",
        note: "Peserta aktif. Disepakati jadwal lanjutan.",
      },
    ],
  },
  {
    id: "c3",
    name: "Bagas Hermawan",
    email: "bagas@staf.unikadelasalle.ac.id",
    role: "Dosen / Staf",
    password: "1234",
    sessions: [
      {
        id: 5,
        topic: "Stres",
        format: "Individu",
        date: "2026-10-08",
        time: "14.00",
        summary: "Diskusi pengelolaan stres kerja.",
        note: "Teknik pernapasan diperkenalkan. Perlu tindak lanjut.",
      },
    ],
  },

  {
    id: "c4",
    name: "Nadia Putri",
    email: "nadia@mhs.unikadelasalle.ac.id",
    role: "Mahasiswa",
    password: "1234",
    sessions: [
      {
        id: 6,
        topic: "Manajemen Stres",
        format: "Individu",
        date: relativeDate(0),
        time: "09.00",
        summary:
          "Klien membahas pemicu stres akademik dan strategi pengelolaan waktu.",
        note: "Disepakati jadwal harian yang realistis dan latihan pernapasan.",
      },
      {
        id: 7,
        topic: "Manajemen Stres",
        format: "Individu",
        date: relativeDate(5),
        time: "09.00",
        summary: "Tindak lanjut strategi pengelolaan stres.",
        note: "Klien mulai menerapkan jadwal belajar. Evaluasi dilanjutkan pada sesi berikutnya.",
      },
    ],
  },
  {
    id: "c5",
    name: "Rizky Mahendra",
    email: "rizky@mhs.unikadelasalle.ac.id",
    role: "Mahasiswa",
    password: "1234",
    sessions: [
      {
        id: 8,
        topic: "Motivasi Belajar",
        format: "Kelompok",
        date: relativeDate(1),
        time: "10.00",
        summary: "Diskusi kelompok mengenai motivasi dan kebiasaan belajar.",
        note: "Peserta menyusun target belajar mingguan.",
      },
      {
        id: 9,
        topic: "Motivasi Belajar",
        format: "Kelompok",
        date: relativeDate(12),
        time: "10.00",
        summary: "Evaluasi target belajar kelompok.",
        note: "Sebagian target tercapai. Kelompok menyepakati strategi tindak lanjut.",
      },
    ],
  },
  {
    id: "c6",
    name: "Clara Lumenta",
    email: "clara@mhs.unikadelasalle.ac.id",
    role: "Mahasiswa",
    password: "1234",
    sessions: [
      {
        id: 10,
        topic: "Kepercayaan Diri",
        format: "Individu",
        date: relativeDate(2),
        time: "13.00",
        summary: "Klien membahas rasa gugup saat presentasi.",
        note: "Latihan presentasi bertahap direkomendasikan.",
      },
      {
        id: 11,
        topic: "Kepercayaan Diri",
        format: "Individu",
        date: relativeDate(18),
        time: "13.00",
        summary: "Tindak lanjut latihan presentasi.",
        note: "Klien melaporkan peningkatan kesiapan berbicara.",
      },
    ],
  },
  {
    id: "c7",
    name: "Fajar Saputra",
    email: "fajar@staf.unikadelasalle.ac.id",
    role: "Dosen / Staf",
    password: "1234",
    sessions: [
      {
        id: 12,
        topic: "Keseimbangan Kerja",
        format: "Individu",
        date: relativeDate(3),
        time: "14.00",
        summary: "Diskusi keseimbangan antara pekerjaan dan kehidupan pribadi.",
        note: "Klien akan mengevaluasi batas waktu kerja dan waktu istirahat.",
      },
      {
        id: 13,
        topic: "Keseimbangan Kerja",
        format: "Individu",
        date: relativeDate(25),
        time: "14.00",
        summary: "Evaluasi rutinitas kerja dan istirahat.",
        note: "Perlu mempertahankan rutinitas yang sudah membantu.",
      },
    ],
  },
  {
    id: "c8",
    name: "Melisa Tumiwa",
    email: "melisa@mhs.unikadelasalle.ac.id",
    role: "Mahasiswa",
    password: "1234",
    sessions: [
      {
        id: 14,
        topic: "Relasi Sosial",
        format: "Individu",
        date: relativeDate(4),
        time: "11.00",
        summary:
          "Klien mengeksplorasi kesulitan membangun komunikasi dengan teman.",
        note: "Latihan komunikasi asertif diberikan sebagai tugas refleksi.",
      },
      {
        id: 15,
        topic: "Relasi Sosial",
        format: "Individu",
        date: relativeDate(30),
        time: "11.00",
        summary: "Tinjauan pengalaman komunikasi asertif.",
        note: "Klien mulai mencoba menyampaikan kebutuhan secara langsung.",
      },
    ],
  },
  {
    id: "c9",
    name: "Kevin Manopo",
    email: "kevin@mhs.unikadelasalle.ac.id",
    role: "Mahasiswa",
    password: "1234",
    sessions: [
      {
        id: 16,
        topic: "Adaptasi Kampus",
        format: "Kelompok",
        date: relativeDate(6),
        time: "15.00",
        summary:
          "Sesi kelompok untuk membahas adaptasi terhadap lingkungan kampus.",
        note: "Peserta berbagi pengalaman dan menyusun rencana dukungan sebaya.",
      },
      {
        id: 17,
        topic: "Adaptasi Kampus",
        format: "Kelompok",
        date: relativeDate(35),
        time: "15.00",
        summary: "Tindak lanjut proses adaptasi kampus.",
        note: "Peserta didorong untuk menjaga komunikasi dengan kelompok.",
      },
    ],
  },
  {
    id: "c10",
    name: "Anisa Rahmawati",
    email: "anisa@mhs.unikadelasalle.ac.id",
    role: "Mahasiswa",
    password: "1234",
    sessions: [
      {
        id: 18,
        topic: "Pengembangan Diri",
        format: "Individu",
        date: relativeDate(8),
        time: "08.30",
        summary: "Klien menetapkan prioritas pengembangan diri.",
        note: "Target mingguan dibuat dengan indikator sederhana.",
      },
      {
        id: 19,
        topic: "Pengembangan Diri",
        format: "Individu",
        date: relativeDate(42),
        time: "08.30",
        summary: "Evaluasi target pengembangan diri.",
        note: "Target diperbarui sesuai perkembangan klien.",
      },
    ],
  },
  {
    id: "c11",
    name: "Dimas Prakoso",
    email: "dimas@staf.unikadelasalle.ac.id",
    role: "Dosen / Staf",
    password: "1234",
    sessions: [
      {
        id: 20,
        topic: "Pengelolaan Emosi",
        format: "Individu",
        date: relativeDate(10),
        time: "16.00",
        summary:
          "Klien membahas cara mengenali dan mengelola emosi saat bekerja.",
        note: "Klien diminta mencatat situasi pemicu dan respons yang muncul.",
      },
      {
        id: 21,
        topic: "Pengelolaan Emosi",
        format: "Individu",
        date: relativeDate(50),
        time: "16.00",
        summary: "Tinjauan catatan situasi pemicu emosi.",
        note: "Identifikasi pemicu membaik. Strategi regulasi emosi dilanjutkan.",
      },
    ],
  },
  {
    id: "c12",
    name: "Grace Kalalo",
    email: "grace@mhs.unikadelasalle.ac.id",
    role: "Mahasiswa",
    password: "1234",
    sessions: [
      {
        id: 22,
        topic: "Kesiapan Karier",
        format: "Kelompok",
        date: relativeDate(14),
        time: "13.30",
        summary:
          "Diskusi kelompok tentang kesiapan karier dan eksplorasi minat.",
        note: "Peserta akan mencari informasi bidang karier yang diminati.",
      },
      {
        id: 23,
        topic: "Kesiapan Karier",
        format: "Kelompok",
        date: relativeDate(60),
        time: "13.30",
        summary: "Sesi awal eksplorasi minat karier.",
        note: "Peserta mulai mengidentifikasi kekuatan dan bidang minat.",
      },
    ],
  },
  {
    id: "c13",
    name: "Andreas Wenas",
    email: "andreas@mhs.unikadelasalle.ac.id",
    role: "Mahasiswa",
    password: "1234",
    sessions: [
      {
        id: 24,
        topic: "Kecemasan Akademik",
        format: "Individu",
        date: relativeDate(20),
        time: "12.30",
        summary: "Klien membahas kecemasan menjelang ujian.",
        note: "Strategi persiapan ujian dan relaksasi dibahas.",
      },
      {
        id: 25,
        topic: "Kecemasan Akademik",
        format: "Individu",
        date: relativeDate(75),
        time: "12.30",
        summary: "Tindak lanjut kecemasan akademik.",
        note: "Klien akan melanjutkan latihan relaksasi sebelum ujian.",
      },
    ],
  },
];
