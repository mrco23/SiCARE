import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarCheck,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  FileSignature,
  Download,
  MessageSquare,
  UsersRound,
  UserRound,
  X,
  XCircle,
  type LucideIcon,
} from "lucide-react";

const CONSENT_PDF_URL = "/informed-consent.pdf";

type CounselorKey = "GY" | "RW";
type ViewKind = "hub" | "booking" | "konseling";
type Period = "hari" | "minggu" | "bulan" | "semester";
type SessionFormat = "Individu" | "Kelompok";
type FormatFilter = "all" | SessionFormat;
type BookingStatus = "pending" | "scheduled" | "rejected";
type Answer = "Ya" | "Mungkin" | "Tidak";

type Counselor = {
  name: string;
  initials: string;
  degree: string;
};

type Session = {
  id: number;
  counselor: CounselorKey;
  format: SessionFormat;
  date: string;
  time: string;
  topic: string;
  noteClient: string;
  plan: string;
};

type Booking = {
  id: string;
  counselor: CounselorKey;
  format: SessionFormat;
  requestedAt: string;
  date: string;
  time: string;
  status: BookingStatus;
};

type HistoryItem = {
  kind: "booking" | "konseling";
  id: string | number;
  counselor: CounselorKey;
  format: SessionFormat;
  date: string;
  time: string;
  title: string;
  status: BookingStatus | "selesai";
  requestedAt?: string;
  note: Session | null;
};

type Intake = {
  selfHarm: Answer;
  distress: Answer;
  abuse: Answer;
  substance: Answer;
  sleep: number;
  finance: number;
  topics: string[];
  complaint: string;
  history: string;
  reason: string;
  efforts: string;
  goal: string;
  strengths: string;
  weaknesses: string;
};

const COUNSELORS: Record<CounselorKey, Counselor> = {
  GY: {
    name: "Giovanna Yudi, S.Psi., M.Psi.",
    initials: "GY",
    degree: "S2 Psikolog",
  },
  RW: {
    name: "Rico Kornelius Wahani, S.Psi., M.Psi.",
    initials: "RW",
    degree: "S2 Psikolog",
  },
};

const SEMESTERS = [
  {
    id: "2025-1",
    ta: "2025/2026",
    sem: "Ganjil",
    start: "2025-08-01",
    end: "2026-01-31",
  },
  {
    id: "2025-2",
    ta: "2025/2026",
    sem: "Genap",
    start: "2026-02-01",
    end: "2026-07-31",
  },
  {
    id: "2026-1",
    ta: "2026/2027",
    sem: "Ganjil",
    start: "2026-08-01",
    end: "2027-01-31",
  },
];

const SESSIONS: Session[] = [
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

const BOOKINGS: Booking[] = [
  {
    id: "B-101",
    counselor: "GY",
    format: "Individu",
    requestedAt: "2026-10-15",
    date: "2026-10-20",
    time: "10.00",
    status: "pending",
  },
  {
    id: "B-102",
    counselor: "RW",
    format: "Individu",
    requestedAt: "2026-10-02",
    date: "2026-10-09",
    time: "14.00",
    status: "rejected",
  },
  {
    id: "B-103",
    counselor: "GY",
    format: "Kelompok",
    requestedAt: "2026-10-12",
    date: "2026-10-27",
    time: "10.00",
    status: "scheduled",
  },
  {
    id: "B-104",
    counselor: "RW",
    format: "Individu",
    requestedAt: "2026-10-16",
    date: "2026-10-23",
    time: "14.00",
    status: "pending",
  },
  {
    id: "B-105",
    counselor: "GY",
    format: "Individu",
    requestedAt: "2026-09-18",
    date: "2026-09-25",
    time: "15.00",
    status: "scheduled",
  },
  {
    id: "B-106",
    counselor: "RW",
    format: "Kelompok",
    requestedAt: "2026-10-17",
    date: "2026-10-29",
    time: "09.00",
    status: "scheduled",
  },
  {
    id: "B-107",
    counselor: "GY",
    format: "Individu",
    requestedAt: "2026-09-22",
    date: "2026-09-30",
    time: "15.00",
    status: "rejected",
  },
  {
    id: "B-108",
    counselor: "RW",
    format: "Individu",
    requestedAt: "2026-09-25",
    date: "2026-10-01",
    time: "13.00",
    status: "scheduled",
  },
  {
    id: "B-109",
    counselor: "GY",
    format: "Kelompok",
    requestedAt: "2026-09-27",
    date: "2026-10-07",
    time: "10.00",
    status: "scheduled",
  },
  {
    id: "B-110",
    counselor: "RW",
    format: "Kelompok",
    requestedAt: "2026-10-05",
    date: "2026-10-13",
    time: "09.00",
    status: "rejected",
  },
  {
    id: "B-111",
    counselor: "GY",
    format: "Individu",
    requestedAt: "2026-10-07",
    date: "2026-10-12",
    time: "13.00",
    status: "scheduled",
  },
  {
    id: "B-112",
    counselor: "RW",
    format: "Individu",
    requestedAt: "2026-10-09",
    date: "2026-10-16",
    time: "14.00",
    status: "rejected",
  },
  {
    id: "B-113",
    counselor: "GY",
    format: "Individu",
    requestedAt: "2026-10-13",
    date: "2026-11-02",
    time: "15.00",
    status: "scheduled",
  },
  {
    id: "B-114",
    counselor: "RW",
    format: "Individu",
    requestedAt: "2026-10-14",
    date: "2026-11-04",
    time: "14.00",
    status: "pending",
  },
  {
    id: "B-115",
    counselor: "GY",
    format: "Kelompok",
    requestedAt: "2026-10-15",
    date: "2026-11-06",
    time: "10.00",
    status: "pending",
  },
  {
    id: "B-116",
    counselor: "RW",
    format: "Individu",
    requestedAt: "2026-10-03",
    date: "2026-10-10",
    time: "14.00",
    status: "scheduled",
  },
  {
    id: "B-117",
    counselor: "GY",
    format: "Individu",
    requestedAt: "2026-09-29",
    date: "2026-10-05",
    time: "15.00",
    status: "rejected",
  },
  {
    id: "B-118",
    counselor: "RW",
    format: "Kelompok",
    requestedAt: "2026-10-08",
    date: "2026-10-15",
    time: "09.00",
    status: "scheduled",
  },
  {
    id: "B-119",
    counselor: "GY",
    format: "Individu",
    requestedAt: "2026-10-10",
    date: "2026-11-10",
    time: "13.00",
    status: "scheduled",
  },
  {
    id: "B-120",
    counselor: "RW",
    format: "Individu",
    requestedAt: "2026-10-18",
    date: "2026-11-12",
    time: "15.00",
    status: "scheduled",
  },
];

const TOPICS = [
  "Karir, pendidikan, dan pekerjaan",
  "Motivasi",
  "Stres atau tekanan kerja",
  "Emosi, mood, kepribadian",
  "Kecemasan",
  "Hubungan dan keluarga",
  "Pengembangan diri",
  "Kesehatan dan kebiasaan sehari-hari",
];

const ESSAY_POOL = {
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

const YESNO: {
  key: "selfHarm" | "distress" | "abuse" | "substance";
  label: string;
}[] = [
  { key: "selfHarm", label: "Apakah Anda sedang merasa ingin bunuh diri?" },
  {
    key: "distress",
    label:
      "Apakah Anda sedang merasakan kesedihan, kehilangan, atau depresi yang luar biasa?",
  },
  {
    key: "abuse",
    label:
      "Apakah Anda pernah mengalami pelecehan? (fisik, seksual, dan/atau emosional)",
  },
  {
    key: "substance",
    label: "Apakah saat ini Anda sedang menggunakan obat-obatan?",
  },
];

const ESSAYS: {
  key:
    | "complaint"
    | "history"
    | "reason"
    | "efforts"
    | "goal"
    | "strengths"
    | "weaknesses";
  label: string;
}[] = [
  { key: "complaint", label: "Deskripsikan keluhan yang Anda rasakan" },
  {
    key: "history",
    label: "Deskripsikan riwayat terjadinya keluhan secara jelas dan rinci",
  },
  { key: "reason", label: "Keluhan dan alasan ingin memulai konseling" },
  {
    key: "efforts",
    label: "Apa yang sudah dilakukan untuk menangani masalah ini?",
  },
  {
    key: "goal",
    label: "Solusi apa yang diinginkan dari bantuan yang diterima?",
  },
  { key: "strengths", label: "Apa kelebihan diri Anda?" },
  { key: "weaknesses", label: "Apa kekurangan diri Anda?" },
];

const BOOK_STATUS: Record<
  BookingStatus,
  { label: string; badge: string; iconWrap: string; icon: LucideIcon }
> = {
  pending: {
    label: "Menunggu Konfirmasi",
    badge: "bg-amber-50 text-amber-700",
    iconWrap: "bg-amber-50 text-amber-600",
    icon: Clock3,
  },
  scheduled: {
    label: "Terjadwal",
    badge: "bg-[#e8f9f0] text-[#1e5b3a]",
    iconWrap: "bg-[#e8f9f0] text-[#1e5b3a]",
    icon: CalendarCheck,
  },
  rejected: {
    label: "Ditolak",
    badge: "bg-red-50 text-red-700",
    iconWrap: "bg-red-50 text-red-600",
    icon: XCircle,
  },
};

const FORMAT_STYLE: Record<SessionFormat, { icon: LucideIcon; tone: string }> =
  {
    Individu: { icon: UserRound, tone: "text-sky-600" },
    Kelompok: { icon: UsersRound, tone: "text-violet-600" },
  };

const BOOKING_ITEMS: HistoryItem[] = BOOKINGS.map(
  (booking): HistoryItem => ({
    kind: "booking",
    id: booking.id,
    counselor: booking.counselor,
    format: booking.format,
    date: booking.date,
    time: booking.time,
    requestedAt: booking.requestedAt,
    title: `Konseling ${booking.format}`,
    status: booking.status,
    note: null,
  }),
).sort(byNewest);

const SESSION_ITEMS: HistoryItem[] = SESSIONS.map(
  (session): HistoryItem => ({
    kind: "konseling",
    id: session.id,
    counselor: session.counselor,
    format: session.format,
    date: session.date,
    time: session.time,
    title: session.topic,
    status: "selesai",
    note: session,
  }),
).sort(byNewest);

const PAGE_SIZE = 15;
const DAY_MS = 864e5;

function byNewest(a: HistoryItem, b: HistoryItem) {
  return `${b.date}${b.time.replace(".", ":")}`.localeCompare(
    `${a.date}${a.time.replace(".", ":")}`,
  );
}

function parseISO(iso: string) {
  return new Date(`${iso}T00:00:00`);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function fmtDate(iso: string) {
  return parseISO(iso).toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function fmtShort(date: Date) {
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

function fmtShortISO(iso: string) {
  return parseISO(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function intakeFor(id: number): Intake {
  const pick = <T,>(items: T[], index: number) => items[index % items.length];
  return {
    selfHarm: "Tidak",
    distress: pick<Answer>(["Tidak", "Mungkin", "Tidak", "Ya"], id),
    abuse: pick<Answer>(["Tidak", "Mungkin", "Tidak"], id + 1),
    substance: "Tidak",
    sleep: (id % 5) + 1,
    finance: ((id * 2) % 5) + 1,
    topics: [TOPICS[id % TOPICS.length], TOPICS[(id + 3) % TOPICS.length]],
    complaint: pick(ESSAY_POOL.complaint, id),
    history: pick(ESSAY_POOL.history, id + 1),
    reason: pick(ESSAY_POOL.reason, id + 2),
    efforts: pick(ESSAY_POOL.efforts, id),
    goal: pick(ESSAY_POOL.goal, id + 1),
    strengths: pick(ESSAY_POOL.strengths, id + 2),
    weaknesses: pick(ESSAY_POOL.weaknesses, id),
  };
}

const ANSWER_STYLE: Record<Answer, string> = {
  Ya: "bg-red-100 text-red-800",
  Mungkin: "bg-amber-100 text-amber-800",
  Tidak: "bg-[#e8f9f0] text-[#1e5b3a]",
};

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: "hari", label: "Hari" },
  { value: "minggu", label: "Minggu" },
  { value: "bulan", label: "Bulan" },
  { value: "semester", label: "Semester" },
];

const FORMAT_OPTIONS: { value: FormatFilter; label: string }[] = [
  { value: "all", label: "Semua" },
  { value: "Individu", label: "Individu" },
  { value: "Kelompok", label: "Kelompok" },
];

export default function KlienRiwayatPage() {
  const todayStart = useMemo(() => startOfDay(new Date()), []);
  const defaultSemesterIndex = useMemo(() => {
    const index = SEMESTERS.findIndex(
      (semester) =>
        todayStart >= parseISO(semester.start) &&
        todayStart <= parseISO(semester.end),
    );
    return index >= 0 ? index : SEMESTERS.length - 1;
  }, [todayStart]);

  const [view, setView] = useState<ViewKind>("hub");
  const [period, setPeriod] = useState<Period>("bulan");
  const [anchor, setAnchor] = useState<Date>(todayStart);
  const [semesterIndex, setSemesterIndex] = useState(defaultSemesterIndex);
  const [format, setFormat] = useState<FormatFilter>("all");
  const [counselor, setCounselor] = useState<"all" | CounselorKey>("all");
  const [shown, setShown] = useState(PAGE_SIZE);
  const [counselorModalOpen, setCounselorModalOpen] = useState(false);
  const [detailSessionId, setDetailSessionId] = useState<number | null>(null);
  const [consentSessionId, setConsentSessionId] = useState<number | null>(null);

  const items =
    view === "booking"
      ? BOOKING_ITEMS
      : view === "konseling"
        ? SESSION_ITEMS
        : [];

  const range = useMemo(() => {
    const year = anchor.getFullYear();
    const month = anchor.getMonth();
    const day = anchor.getDate();

    if (period === "hari") {
      return {
        start: new Date(year, month, day),
        end: new Date(year, month, day + 1),
      };
    }
    if (period === "minggu") {
      return {
        start: new Date(year, month, day - 6),
        end: new Date(year, month, day + 1),
      };
    }
    if (period === "bulan") {
      return {
        start: new Date(year, month, 1),
        end: new Date(year, month + 1, 1),
      };
    }
    const semester = SEMESTERS[semesterIndex];
    return {
      start: parseISO(semester.start),
      end: new Date(parseISO(semester.end).getTime() + DAY_MS),
    };
  }, [anchor, period, semesterIndex]);

  const periodLabel = useMemo(() => {
    if (period === "hari") {
      return range.start.toLocaleDateString("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    }
    if (period === "minggu") {
      return `${fmtShort(range.start)} – ${fmtShort(new Date(range.end.getTime() - DAY_MS))}`;
    }
    if (period === "bulan") {
      return range.start.toLocaleDateString("id-ID", {
        month: "long",
        year: "numeric",
      });
    }
    const semester = SEMESTERS[semesterIndex];
    return `TA ${semester.ta} · ${semester.sem}`;
  }, [period, range, semesterIndex]);

  const baseItems = useMemo(
    () =>
      items.filter((item) => {
        const date = parseISO(item.date);
        const matchesPeriod = date >= range.start && date < range.end;
        const matchesFormat = format === "all" || item.format === format;
        return matchesPeriod && matchesFormat;
      }),
    [items, range, format],
  );

  const visibleItems = useMemo(
    () =>
      counselor === "all"
        ? baseItems
        : baseItems.filter((item) => item.counselor === counselor),
    [baseItems, counselor],
  );

  useEffect(() => {
    if (
      counselor !== "all" &&
      !baseItems.some((item) => item.counselor === counselor)
    ) {
      setCounselor("all");
    }
  }, [baseItems, counselor]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDetailSessionId(null);
        setConsentSessionId(null);
        setCounselorModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const pendingBookings = BOOKINGS.filter(
    (booking) => booking.status === "pending",
  ).length;
  const notesCount = SESSIONS.filter((session) =>
    Boolean(session.noteClient),
  ).length;
  const detailSession =
    detailSessionId === null
      ? null
      : (SESSIONS.find((session) => session.id === detailSessionId) ?? null);
  const consentSession =
    consentSessionId === null
      ? null
      : (SESSIONS.find((session) => session.id === consentSessionId) ?? null);

  function openList(nextView: Exclude<ViewKind, "hub">) {
    setView(nextView);
    setPeriod("bulan");
    setAnchor(todayStart);
    setSemesterIndex(defaultSemesterIndex);
    setFormat("all");
    setCounselor("all");
    setShown(PAGE_SIZE);
  }

  function backToHub() {
    setView("hub");
    setCounselorModalOpen(false);
    setDetailSessionId(null);
    setConsentSessionId(null);
  }

  function changePeriod(nextPeriod: Period) {
    setPeriod(nextPeriod);
    setShown(PAGE_SIZE);
  }

  function stepPeriod(direction: -1 | 1) {
    if (period === "semester") {
      const nextIndex = semesterIndex + direction;
      if (nextIndex < 0 || nextIndex >= SEMESTERS.length) return;
      setSemesterIndex(nextIndex);
    } else if (period === "hari") {
      setAnchor(
        (current) =>
          new Date(
            current.getFullYear(),
            current.getMonth(),
            current.getDate() + direction,
          ),
      );
    } else if (period === "minggu") {
      setAnchor(
        (current) =>
          new Date(
            current.getFullYear(),
            current.getMonth(),
            current.getDate() + 7 * direction,
          ),
      );
    } else {
      setAnchor(
        (current) =>
          new Date(current.getFullYear(), current.getMonth() + direction, 1),
      );
    }
    setShown(PAGE_SIZE);
  }

  const activeSemester = period === "semester";
  const canStepSemesterBack = semesterIndex <= 0;
  const canStepSemesterForward = semesterIndex >= SEMESTERS.length - 1;
  const listMeta =
    view === "booking"
      ? {
          title: "Riwayat Booking",
          desc: "Janji temu yang pernah kamu ajukan beserta statusnya.",
          emptyTitle: "Belum ada booking",
          emptyDesc: "Booking yang kamu ajukan akan muncul di sini.",
        }
      : {
          title: "Riwayat Konseling",
          desc: "Sesi konseling yang sudah kamu jalani dan catatan dari konselormu.",
          emptyTitle: "Belum ada riwayat konseling",
          emptyDesc: "Sesi yang sudah selesai akan muncul di sini.",
        };

  return (
    <div className="space-y-6">
      {view === "hub" ? (
        <section>
          <h1 className="font-display text-2xl font-extrabold text-gray-900 sm:text-3xl">
            Riwayat
          </h1>
          <p className="mt-2 text-sm text-gray-600 sm:text-base">
            Pilih riwayat yang ingin kamu lihat.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <button
              type="button"
              onClick={() => openList("booking")}
              className="group flex flex-col rounded-2xl border border-gray-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#36c08f] hover:shadow-md"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                <CalendarDays className="h-6 w-6" strokeWidth={1.8} />
              </span>
              <p className="mt-5 font-display text-xl font-bold text-gray-900">
                Riwayat Booking
              </p>
              <p className="mt-1 text-sm text-gray-600">
                Lihat janji temu yang pernah kamu ajukan beserta statusnya.
              </p>
              <p className="mt-4 text-sm font-semibold text-[#1e5b3a]">
                {BOOKINGS.length} booking
                {pendingBookings
                  ? ` · ${pendingBookings} menunggu konfirmasi`
                  : ""}
              </p>
              <span className="mt-auto inline-flex items-center gap-1 pt-5 text-sm font-semibold text-[#1e5b3a]">
                Lihat booking{" "}
                <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </span>
            </button>

            <button
              type="button"
              onClick={() => openList("konseling")}
              className="group flex flex-col rounded-2xl border border-gray-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#36c08f] hover:shadow-md"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#e8f9f0] text-[#1e5b3a]">
                <MessageSquare className="h-6 w-6" strokeWidth={1.8} />
              </span>
              <p className="mt-5 font-display text-xl font-bold text-gray-900">
                Riwayat Konseling
              </p>
              <p className="mt-1 text-sm text-gray-600">
                Lihat sesi yang sudah kamu jalani dan catatan dari konselormu.
              </p>
              <p className="mt-4 text-sm font-semibold text-[#1e5b3a]">
                {SESSIONS.length} sesi · {notesCount} catatan dari konselor
              </p>
              <span className="mt-auto inline-flex items-center gap-1 pt-5 text-sm font-semibold text-[#1e5b3a]">
                Lihat konseling{" "}
                <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </span>
            </button>
          </div>
        </section>
      ) : (
        <section>
          <button
            type="button"
            onClick={backToHub}
            className="inline-flex items-center gap-1 text-sm font-semibold text-[#1e5b3a] hover:underline"
          >
            <ArrowLeft className="h-4 w-4" /> Kembali ke riwayat
          </button>

          <h1 className="mt-3 font-display text-2xl font-extrabold text-gray-900 sm:text-3xl">
            {listMeta.title}
          </h1>
          <p className="mt-2 text-sm text-gray-600 sm:text-base">
            {listMeta.desc}
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div
              role="tablist"
              aria-label="Periode"
              className="inline-flex w-fit flex-wrap rounded-xl border border-gray-200 bg-gray-100 p-1"
            >
              {PERIOD_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="tab"
                  aria-selected={period === option.value}
                  onClick={() => changePeriod(option.value)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition sm:text-sm ${
                    period === option.value
                      ? "bg-white text-[#1e5b3a] shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                aria-label="Periode sebelumnya"
                onClick={() => stepPeriod(-1)}
                disabled={activeSemester && canStepSemesterBack}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-[170px] text-center text-sm font-bold capitalize text-gray-900">
                {periodLabel}
              </span>
              <button
                type="button"
                aria-label="Periode berikutnya"
                onClick={() => stepPeriod(1)}
                disabled={activeSemester && canStepSemesterForward}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              {activeSemester && (
                <select
                  aria-label="Pilih semester"
                  value={semesterIndex}
                  onChange={(event) => {
                    setSemesterIndex(Number(event.target.value));
                    setShown(PAGE_SIZE);
                  }}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 outline-none focus:border-[#1e5b3a]"
                >
                  {SEMESTERS.map((semester, index) => (
                    <option key={semester.id} value={index}>
                      TA {semester.ta} · {semester.sem}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-gray-500">
              {visibleItems.length
                ? `Menampilkan ${Math.min(shown, visibleItems.length)} dari ${visibleItems.length} riwayat`
                : ""}
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div
                role="tablist"
                aria-label="Jenis layanan"
                className="inline-flex w-full rounded-full bg-gray-100 p-1 sm:w-auto"
              >
                {FORMAT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="tab"
                    aria-selected={format === option.value}
                    onClick={() => {
                      setFormat(option.value);
                      setShown(PAGE_SIZE);
                    }}
                    className={`flex-1 rounded-full px-4 py-1.5 text-sm font-semibold transition sm:flex-none ${
                      format === option.value
                        ? "bg-white text-[#1e5b3a] shadow-sm"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                aria-haspopup="dialog"
                aria-expanded={counselorModalOpen}
                onClick={() => setCounselorModalOpen(true)}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-[#1e5b3a] sm:w-72"
              >
                <span className="truncate">
                  {counselor === "all"
                    ? "Semua konselor"
                    : COUNSELORS[counselor].name}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 rotate-90 text-gray-500" />
              </button>
            </div>
          </div>

          <ol className="mt-4 space-y-4">
            {visibleItems.slice(0, shown).map((item) => {
              const counselorInfo = COUNSELORS[item.counselor];
              const isBooking = item.kind === "booking";
              const formatStyle = FORMAT_STYLE[item.format];
              const FormatIcon = formatStyle.icon;
              const StatusIcon = isBooking
                ? BOOK_STATUS[item.status as BookingStatus].icon
                : CheckCircle2;
              const statusWrap = isBooking
                ? BOOK_STATUS[item.status as BookingStatus].iconWrap
                : "bg-[#e8f9f0] text-[#1e5b3a]";
              const statusBadge = isBooking
                ? BOOK_STATUS[item.status as BookingStatus].badge
                : "";
              const statusLabel = isBooking
                ? BOOK_STATUS[item.status as BookingStatus].label
                : "";
              const dateLine = isBooking
                ? `Jadwal ${fmtShortISO(item.date)} · ${item.time} WITA`
                : `${fmtShortISO(item.date)} · ${item.time} WITA`;

              return (
                <li
                  key={`${item.kind}-${item.id}`}
                  className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
                >
                  <span
                    className={`pointer-events-none absolute -right-4 top-1/2 -translate-y-1/2 opacity-[0.09] ${formatStyle.tone}`}
                    aria-hidden="true"
                  >
                    <FormatIcon className="h-32 w-32" strokeWidth={1.2} />
                  </span>
                  <div className="relative min-w-0 pr-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${statusWrap}`}
                        >
                          <StatusIcon className="h-4 w-4" strokeWidth={2} />
                        </span>
                        <p className="truncate font-semibold text-gray-900">
                          {item.title}
                        </p>
                      </div>
                      {isBooking && (
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusBadge}`}
                        >
                          {statusLabel}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-gray-500">{dateLine}</p>
                    <p className="mt-0.5 text-sm text-gray-500">
                      {item.format} · {counselorInfo.name}
                    </p>
                    {isBooking ? (
                      <p className="mt-3 text-xs text-gray-500">
                        Dibooking {fmtShortISO(item.requestedAt ?? item.date)}
                        {item.status === "pending"
                          ? ". Menunggu konfirmasi dari konselor."
                          : "."}
                      </p>
                    ) : (
                      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
                        <button
                          type="button"
                          onClick={() => setDetailSessionId(Number(item.id))}
                          className="inline-flex items-center gap-1.5 rounded-full border border-[#1e5b3a] px-4 py-1.5 text-xs font-semibold text-[#1e5b3a] hover:bg-[#e8f9f0]"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Lihat detail
                        </button>
                        <button
                          type="button"
                          onClick={() => setConsentSessionId(Number(item.id))}
                          className="inline-flex items-center gap-1.5 rounded-full border border-[#1e5b3a] px-4 py-1.5 text-xs font-semibold text-[#1e5b3a] hover:bg-[#e8f9f0]"
                        >
                          <FileSignature className="h-3.5 w-3.5" />
                          Lihat informed consent
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>

          {visibleItems.length === 0 && (
            <div className="mt-4 rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center">
              <p className="text-sm font-semibold text-gray-700">
                {format !== "all" || counselor !== "all"
                  ? "Tidak ada riwayat dengan filter ini"
                  : listMeta.emptyTitle}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {format !== "all" || counselor !== "all"
                  ? "Coba ubah periode, layanan, atau konselor di filter."
                  : `Tidak ada data pada ${periodLabel}.`}
              </p>
            </div>
          )}

          {visibleItems.length > shown && (
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => setShown((current) => current + PAGE_SIZE)}
                className="rounded-full border border-[#1e5b3a] bg-white px-5 py-2 text-sm font-semibold text-[#1e5b3a] transition hover:bg-[#e8f9f0]"
              >
                Muat lebih banyak
              </button>
            </div>
          )}
        </section>
      )}

      {counselorModalOpen && view !== "hub" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0c2619]/40 p-4"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget)
              setCounselorModalOpen(false);
          }}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="counselorModalTitle"
          >
            <div className="flex items-start justify-between gap-4 border-b border-gray-200 p-5">
              <div>
                <h2
                  id="counselorModalTitle"
                  className="text-base font-bold text-gray-900"
                >
                  Pilih konselor
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Riwayat akan ditampilkan sesuai konselor yang dipilih.
                </p>
              </div>
              <button
                type="button"
                aria-label="Tutup"
                onClick={() => setCounselorModalOpen(false)}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <ul className="divide-y divide-gray-100 overflow-y-auto">
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setCounselor("all");
                    setShown(PAGE_SIZE);
                    setCounselorModalOpen(false);
                  }}
                  className={`flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-gray-50 ${counselor === "all" ? "bg-[#f7fcf9]" : ""}`}
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-500">
                    <UsersRound className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-gray-900">
                      Semua konselor
                    </span>
                    <span className="block text-sm text-gray-500">
                      {baseItems.length} riwayat
                    </span>
                  </span>
                  {counselor === "all" && (
                    <Check className="h-5 w-5 shrink-0 text-[#1e5b3a]" />
                  )}
                </button>
              </li>
              {(Object.keys(COUNSELORS) as CounselorKey[]).map((key) => {
                const count = baseItems.filter(
                  (item) => item.counselor === key,
                ).length;
                if (count === 0) return null;
                const info = COUNSELORS[key];
                return (
                  <li key={key}>
                    <button
                      type="button"
                      onClick={() => {
                        setCounselor(key);
                        setShown(PAGE_SIZE);
                        setCounselorModalOpen(false);
                      }}
                      className={`flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-gray-50 ${counselor === key ? "bg-[#f7fcf9]" : ""}`}
                    >
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-sm font-bold text-gray-700">
                        {info.initials}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-gray-900">
                          {info.name}
                        </span>
                        <span className="block text-sm text-gray-500">
                          {count} riwayat · {info.degree}
                        </span>
                      </span>
                      {counselor === key && (
                        <Check className="h-5 w-5 shrink-0 text-[#1e5b3a]" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      {consentSession && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0c2619]/40 p-4"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) setConsentSessionId(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="client-consent-title"
            className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-gray-200 p-5">
              <div>
                <h2
                  id="client-consent-title"
                  className="text-lg font-bold text-gray-900"
                >
                  Informed Consent
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  {consentSession.topic} · {fmtDate(consentSession.date)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConsentSessionId(null)}
                aria-label="Tutup informed consent"
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <object
                data={`${CONSENT_PDF_URL}#toolbar=0&navpanes=0`}
                type="application/pdf"
                className="h-[55vh] w-full"
                aria-label="Dokumen informed consent"
              >
                <p className="p-6 text-center text-sm text-gray-600">
                  Browser tidak dapat menampilkan dokumen PDF.
                </p>
              </object>
              <p className="border-t border-gray-200 p-5 text-sm text-gray-600">
                Ini adalah dokumen informed consent standar. Tanda tangan dan
                status persetujuan sesi belum dapat ditampilkan karena data pada
                halaman Aktivitas belum terhubung ke Riwayat Konseling.
              </p>
            </div>
            <div className="flex justify-end border-t border-gray-200 p-5">
              <a
                href={CONSENT_PDF_URL}
                download="informed-consent.pdf"
                className="inline-flex items-center gap-2 rounded-xl bg-[#1e5b3a] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#174a2f]"
              >
                <Download className="h-4 w-4" />
                Unduh PDF
              </a>
            </div>
          </section>
        </div>
      )}

      {detailSession && (
        <DetailModal
          session={detailSession}
          onClose={() => setDetailSessionId(null)}
        />
      )}
    </div>
  );
}

function DetailModal({
  session,
  onClose,
}: {
  session: Session;
  onClose: () => void;
}) {
  const counselor = COUNSELORS[session.counselor];
  const intake = intakeFor(session.id);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0c2619]/40 p-4"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="detailTitle"
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 p-6 pb-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#1e5b3a]">
              Detail konseling
            </p>
            <h2
              id="detailTitle"
              className="mt-1 text-lg font-bold text-gray-900"
            >
              {session.topic}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {fmtDate(session.date)} · {session.time} WITA · {counselor.name}
            </p>
          </div>
          <button
            type="button"
            aria-label="Tutup detail"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-8 overflow-y-auto p-6">
          <section>
            <p className="text-xs font-bold uppercase tracking-wider text-[#1e5b3a]">
              1 · Catatan dari konselor untukmu
            </p>
            <div className="mt-3 rounded-2xl border border-[#36c08f]/40 bg-[#f7fcf9] p-5">
              {session.noteClient ? (
                <p className="whitespace-pre-line text-sm leading-relaxed text-gray-800">
                  {session.noteClient}
                </p>
              ) : (
                <p className="text-sm text-gray-500">
                  Belum ada catatan dari konselor.
                </p>
              )}
              {session.plan && (
                <div className="mt-4 border-t border-[#36c08f]/30 pt-4">
                  <p className="text-sm font-semibold text-gray-800">
                    Rencana tindak lanjut
                  </p>
                  <p className="mt-1 text-sm text-gray-700">{session.plan}</p>
                </div>
              )}
            </div>
          </section>

          <section>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
              2 · Form pesanan konseling
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Jawaban yang kamu isi saat membuat janji temu.
            </p>
            <div className="mt-3 space-y-4">
              <div className="rounded-2xl border border-gray-200 p-5">
                <h3 className="text-sm font-bold text-gray-900">
                  Kondisi saat ini
                </h3>
                <div className="mt-2 divide-y divide-gray-100">
                  {YESNO.map((item) => (
                    <div
                      key={item.key}
                      className="flex flex-wrap items-start justify-between gap-3 py-3"
                    >
                      <p className="text-sm text-gray-700">{item.label}</p>
                      <span
                        className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${ANSWER_STYLE[intake[item.key]]}`}
                      >
                        {intake[item.key]}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 grid gap-5 sm:grid-cols-2">
                  {(
                    [
                      { key: "sleep", label: "Kualitas tidur" },
                      { key: "finance", label: "Keadaan finansial" },
                    ] as const
                  ).map((item) => (
                    <div key={item.key}>
                      <p className="text-sm font-semibold text-gray-700">
                        {item.label}
                      </p>
                      <div className="mt-2 flex gap-2">
                        {[1, 2, 3, 4, 5].map((number) => (
                          <span
                            key={number}
                            className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold ${
                              number === intake[item.key]
                                ? "bg-[#1e5b3a] text-white"
                                : "bg-gray-100 text-gray-400"
                            }`}
                          >
                            {number}
                          </span>
                        ))}
                      </div>
                      <p className="mt-1.5 text-xs text-gray-500">
                        Dipilih:{" "}
                        <b className="text-gray-800">{intake[item.key]}</b>
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 p-5">
                <h3 className="text-sm font-bold text-gray-900">
                  Masalah yang ingin dibahas
                </h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {intake.topics.map((topic) => (
                    <span
                      key={topic}
                      className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800"
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              </div>

              {ESSAYS.map((item) => (
                <div
                  key={item.key}
                  className="rounded-2xl border border-gray-200 p-5"
                >
                  <p className="text-sm font-semibold text-gray-700">
                    {item.label}
                  </p>
                  <p className="mt-2 whitespace-pre-line text-sm text-gray-800">
                    {intake[item.key]}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
