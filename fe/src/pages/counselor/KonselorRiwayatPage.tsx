import { PageContainer, PageHeader } from "../../components/shared";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileSignature,
  Download,
  Eye,
  EyeOff,
  Lock,
  Search,
  X,
} from "lucide-react";
import {
  isInPeriod,
  loadPeriods,
  sortPeriods,
  toISO,
  type AcademicPeriod,
} from "../../lib/academicPeriods";

type Format = "Individu" | "Kelompok";

type PeriodKey = "hari" | "minggu" | "bulan" | "semester";
const PERIOD_OPTIONS: [PeriodKey, string][] = [
  ["hari", "Hari"],
  ["minggu", "Minggu"],
  ["bulan", "Bulan"],
  ["semester", "Semester"],
];
const DAY_MS = 864e5;

const relativeDate = (daysAgo: number) => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return toISO(date);
};

type DateRange = { start: Date; end: Date };
const parseISODate = (iso: string) => {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
};
const getDateRange = (
  period: PeriodKey,
  anchor: Date,
  semester: AcademicPeriod | null,
): DateRange => {
  const y = anchor.getFullYear();
  const m = anchor.getMonth();
  const d = anchor.getDate();
  if (period === "hari")
    return { start: new Date(y, m, d), end: new Date(y, m, d + 1) };
  if (period === "minggu")
    return { start: new Date(y, m, d - 6), end: new Date(y, m, d + 1) };
  if (period === "bulan")
    return { start: new Date(y, m, 1), end: new Date(y, m + 1, 1) };
  if (!semester) return { start: new Date(0), end: new Date(0) };
  return {
    start: parseISODate(semester.start),
    end: new Date(parseISODate(semester.end).getTime() + DAY_MS),
  };
};
const dateRangeLabel = (
  period: PeriodKey,
  range: DateRange,
  semester: AcademicPeriod | null,
) => {
  if (period === "hari") {
    return range.start.toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }
  if (period === "minggu") {
    const end = new Date(range.end.getTime() - DAY_MS);
    return `${range.start.toLocaleDateString("id-ID", { day: "numeric", month: "short" })} – ${end.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}`;
  }
  if (period === "bulan") {
    return range.start.toLocaleDateString("id-ID", {
      month: "long",
      year: "numeric",
    });
  }
  return semester ? `TA ${semester.ta} · ${semester.sem}` : "Belum ada periode";
};
const inDateRange = (date: string, range: DateRange) => {
  const value = parseISODate(date).getTime();
  return value >= range.start.getTime() && value < range.end.getTime();
};

type Session = {
  id: number;
  topic: string;
  format: Format;
  date: string; // YYYY-MM-DD
  time: string; // "HH.MM"
  summary: string;
  note: string;
};

type Client = {
  id: string;
  name: string;
  email: string;
  role: string;
  password: string;
  sessions: Session[];
};

const MAX_ATTEMPTS = 3;
const ACCESS_DURATION_MS = 30 * 60 * 1000;
const LOCK_DURATION_MS = 5 * 60 * 1000;
const HISTORY_PASSWORD = "1234"; // Khusus prototipe. Ganti dengan verifikasi backend.
const ACCESS_STORAGE_KEY = "sicare:konselor:riwayat-access";
const ATTEMPT_STORAGE_KEY = "sicare:konselor:riwayat-attempts";
const CONSENT_PDF_URL = "/informed-consent.pdf";

type AttemptState = { count: number; lockedUntil: number };

// Hanya timestamp akses yang disimpan. Password tidak pernah masuk storage.
function loadAccess(): number {
  try {
    const raw = sessionStorage.getItem(ACCESS_STORAGE_KEY);
    const expiry = raw === null ? 0 : Number(raw);
    const currentTime = Date.now();
    if (
      Number.isFinite(expiry) &&
      expiry > currentTime &&
      expiry <= currentTime + ACCESS_DURATION_MS
    )
      return expiry;
    sessionStorage.removeItem(ACCESS_STORAGE_KEY);
  } catch {
    /* Penyimpanan mungkin tidak tersedia. */
  }
  return 0;
}

function loadAttempts(): AttemptState {
  try {
    const raw = sessionStorage.getItem(ATTEMPT_STORAGE_KEY);
    if (!raw) return { count: 0, lockedUntil: 0 };
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const entry = parsed as Partial<AttemptState>;
      if (
        typeof entry.count === "number" &&
        Number.isInteger(entry.count) &&
        entry.count >= 0 &&
        entry.count <= MAX_ATTEMPTS &&
        typeof entry.lockedUntil === "number" &&
        Number.isFinite(entry.lockedUntil)
      ) {
        if (entry.lockedUntil > Date.now())
          return {
            count: MAX_ATTEMPTS,
            lockedUntil: entry.lockedUntil,
          };
        if (entry.count < MAX_ATTEMPTS)
          return {
            count: entry.count,
            lockedUntil: 0,
          };
      }
    }
    sessionStorage.removeItem(ATTEMPT_STORAGE_KEY);
  } catch {
    /* Penyimpanan mungkin tidak tersedia. */
  }
  return { count: 0, lockedUntil: 0 };
}

// Fungsi terpisah sehingga nantinya dapat diganti API verifikasi backend.
async function verifyHistoryPassword(input: string): Promise<boolean> {
  return input === HISTORY_PASSWORD;
}

// Data contoh. Semua sesi sudah memiliki catatan.
const clients: Client[] = [
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

const allSessions = clients.flatMap((c) => c.sessions);

const initials = (name: string) =>
  name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

const fmtDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

const sessionKey = (s: Session) => `${s.date} ${s.time}`;

const matches = (s: Session, format: Format, range: DateRange) =>
  s.format === format && inDateRange(s.date, range);

export default function KonselorRiwayatPage() {
  const navigate = useNavigate();
  const today = useMemo(() => toISO(new Date()), []);
  const periods = useMemo(() => sortPeriods(loadPeriods()), []);
  const defaultSemester =
    periods.find((p) => isInPeriod(today, p)) ??
    periods[periods.length - 1] ??
    null;
  const [period, setPeriod] = useState<PeriodKey>("bulan");
  const [anchor, setAnchor] = useState(
    () =>
      new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        new Date().getDate(),
        12,
      ),
  );
  const [semesterId, setSemesterId] = useState<string | null>(
    defaultSemester?.id ?? null,
  );
  const [format, setFormat] = useState<Format>("Individu");
  const [query, setQuery] = useState("");
  const [timeSort, setTimeSort] = useState<"terbaru" | "terlama">("terbaru");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [noteId, setNoteId] = useState<number | null>(null);
  const [consentSessionId, setConsentSessionId] = useState<number | null>(null);

  const [accessUntil, setAccessUntil] = useState<number>(loadAccess);
  const [attemptState, setAttemptState] = useState<AttemptState>(loadAttempts);
  const [now, setNow] = useState(() => Date.now());
  const [pwInput, setPwInput] = useState("");
  const [pwVisible, setPwVisible] = useState(false);
  const [pwError, setPwError] = useState("");
  const [verifying, setVerifying] = useState(false);

  const [toastMsg, setToastMsg] = useState("");

  // Timestamp absolut tidak diperpanjang ketika pindah route atau refresh.
  useEffect(() => {
    const checkTime = () => {
      const currentTime = Date.now();
      setNow(currentTime);
      if (accessUntil > 0 && currentTime >= accessUntil) {
        sessionStorage.removeItem(ACCESS_STORAGE_KEY);
        setAccessUntil(0);
        setSelectedId(null);
        setNoteId(null);
        setConsentSessionId(null);
        setToastMsg("Akses riwayat terkunci kembali.");
      }
      if (
        attemptState.lockedUntil > 0 &&
        currentTime >= attemptState.lockedUntil
      ) {
        sessionStorage.removeItem(ATTEMPT_STORAGE_KEY);
        setAttemptState({ count: 0, lockedUntil: 0 });
        setPwError("");
      }
    };
    const interval = window.setInterval(checkTime, 1000);
    const timeout =
      accessUntil > Date.now()
        ? window.setTimeout(checkTime, accessUntil - Date.now())
        : undefined;
    window.addEventListener("focus", checkTime);
    window.addEventListener("pageshow", checkTime);
    document.addEventListener("visibilitychange", checkTime);
    return () => {
      window.clearInterval(interval);
      if (timeout !== undefined) window.clearTimeout(timeout);
      window.removeEventListener("focus", checkTime);
      window.removeEventListener("pageshow", checkTime);
      document.removeEventListener("visibilitychange", checkTime);
    };
  }, [accessUntil, attemptState.lockedUntil]);

  // Sembunyikan toast otomatis.
  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(""), 2800);
    return () => clearTimeout(t);
  }, [toastMsg]);

  const hasAccess = accessUntil > now;
  const semester = periods.find((p) => p.id === semesterId) ?? null;
  const range = useMemo(
    () => getDateRange(period, anchor, semester),
    [period, anchor, semester],
  );
  const label = dateRangeLabel(period, range, semester);

  function stepPeriod(direction: -1 | 1) {
    if (period === "semester") {
      const index = periods.findIndex((p) => p.id === semesterId);
      const next = periods[index + direction];
      if (next) setSemesterId(next.id);
      return;
    }
    const next = new Date(anchor);
    if (period === "hari") next.setDate(next.getDate() + direction);
    else if (period === "minggu") next.setDate(next.getDate() + 7 * direction);
    else {
      next.setDate(15);
      next.setMonth(next.getMonth() + direction);
    }
    setAnchor(next);
  }

  const semesterIndex = periods.findIndex((p) => p.id === semesterId);
  const canPrevious = period !== "semester" || semesterIndex > 0;
  const canNext = period !== "semester" || semesterIndex < periods.length - 1;

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clients
      .filter((c) => !q || c.name.toLowerCase().includes(q))
      .map((c) => {
        const sessions = c.sessions.filter((s) => matches(s, format, range));
        const latest =
          sessions
            .map((s) => s.date)
            .sort()
            .at(-1) ?? "";
        return { client: c, count: sessions.length, latest };
      })
      .filter((r) => r.count > 0)
      .sort((a, b) => b.latest.localeCompare(a.latest));
  }, [query, format, range]);

  const selected = clients.find((c) => c.id === selectedId) ?? null;

  const detailSessions = useMemo(() => {
    if (!selected) return [];
    return selected.sessions
      .filter((s) => matches(s, format, range))
      .sort((a, b) =>
        timeSort === "terlama"
          ? sessionKey(a).localeCompare(sessionKey(b))
          : sessionKey(b).localeCompare(sessionKey(a)),
      );
  }, [selected, format, range, timeSort]);

  const lastDate =
    detailSessions
      .map((s) => s.date)
      .sort()
      .at(-1) ?? "";

  const noteSession =
    noteId !== null ? (allSessions.find((s) => s.id === noteId) ?? null) : null;
  const consentSession =
    consentSessionId !== null
      ? (detailSessions.find((s) => s.id === consentSessionId) ?? null)
      : null;

  const timeLeft = Math.max(0, accessUntil - now);
  const timerText = `${Math.floor(timeLeft / 60000)}:${String(
    Math.floor((timeLeft % 60000) / 1000),
  ).padStart(2, "0")}`;

  const pwUsed = attemptState.count;
  const pwLocked = attemptState.lockedUntil > now;

  function handleOpenClient(cid: string) {
    if (!hasAccess) {
      return;
    }
    setSelectedId(cid);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function closePw() {
    setPwInput("");
    navigate("/konselor");
  }

  async function handleUnlock(e: FormEvent) {
    e.preventDefault();
    if (verifying) return;
    const latestAttempts = loadAttempts();
    if (latestAttempts.lockedUntil > Date.now()) {
      setAttemptState(latestAttempts);
      return;
    }
    setVerifying(true);
    try {
      if (await verifyHistoryPassword(pwInput)) {
        const expiry = Date.now() + ACCESS_DURATION_MS;
        sessionStorage.setItem(ACCESS_STORAGE_KEY, String(expiry));
        sessionStorage.removeItem(ATTEMPT_STORAGE_KEY);
        setAccessUntil(expiry);
        setNow(Date.now());
        setAttemptState({ count: 0, lockedUntil: 0 });
        setPwInput("");
        setPwError("");
        setToastMsg(
          "Riwayat konseling dibuka. Terkunci otomatis dalam 30 menit.",
        );
        return;
      }
      const used = latestAttempts.count + 1;
      const lockedUntil =
        used >= MAX_ATTEMPTS ? Date.now() + LOCK_DURATION_MS : 0;
      const next = { count: used, lockedUntil };
      sessionStorage.setItem(ATTEMPT_STORAGE_KEY, JSON.stringify(next));
      setAttemptState(next);
      const left = MAX_ATTEMPTS - used;
      setPwError(
        left > 0
          ? `Kata sandi salah. Sisa percobaan: ${left}`
          : "Terlalu banyak percobaan. Coba lagi dalam 5 menit.",
      );
      setPwInput("");
    } finally {
      setVerifying(false);
    }
  }

  function backToClients() {
    setSelectedId(null);
    setNoteId(null);
    setConsentSessionId(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleOpenConsent(id: number) {
    if (!hasAccess || !selectedId) {
      setConsentSessionId(null);
      return;
    }
    setConsentSessionId(id);
  }

  function handleOpenNote(id: number) {
    if (!selectedId || !hasAccess) {
      setToastMsg("Akses habis. Masukkan kata sandi kembali.");
      backToClients();
      return;
    }
    setNoteId(id);
  }

  return (
    <PageContainer role="counselor" spacing="none">
      {hasAccess &&
        (!selected ? (
          <>
            {/* ================= DAFTAR KLIEN ================= */}
            <PageHeader
              title="Riwayat Konseling"
              description="Pilih klien untuk membuka riwayat dan catatan konseling."
            />

            {/* Filter nama, format, dan periode waktu */}
            <div className="mt-6 space-y-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm sm:p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Cari nama klien ..."
                    className="w-full rounded-xl border border-gray-200 bg-gray-100/70 py-3 pl-12 pr-4 text-sm text-gray-800 outline-none placeholder:text-gray-500 focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/15"
                  />
                </div>

                <div
                  role="tablist"
                  aria-label="Format konseling"
                  className="flex w-full rounded-xl border border-gray-200 bg-gray-100/70 p-1 lg:w-auto"
                >
                  {(["Individu", "Kelompok"] as Format[]).map((f) => {
                    const active = format === f;
                    return (
                      <button
                        key={f}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => setFormat(f)}
                        className={`flex-1 whitespace-nowrap rounded-lg px-4 py-2 text-sm transition lg:flex-none ${
                          active
                            ? "bg-white font-semibold text-gray-900 shadow-sm"
                            : "font-medium text-gray-500"
                        }`}
                      >
                        {f}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t border-gray-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-1 rounded-xl border border-gray-200 bg-gray-100/70 p-1">
                  {PERIOD_OPTIONS.map(([key, labelText]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setPeriod(key)}
                      className={`rounded-lg px-3 py-2 text-xs font-semibold transition sm:text-sm ${
                        period === key
                          ? "bg-white text-gray-900 shadow-sm"
                          : "text-gray-500 hover:text-gray-900"
                      }`}
                    >
                      {labelText}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => stepPeriod(-1)}
                    disabled={!canPrevious}
                    aria-label="Periode sebelumnya"
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="min-w-[170px] flex-1 text-center text-sm font-semibold text-gray-800 sm:flex-none">
                    {label}
                  </span>
                  <button
                    type="button"
                    onClick={() => stepPeriod(1)}
                    disabled={!canNext}
                    aria-label="Periode berikutnya"
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-40"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>

                  {period === "semester" && (
                    <select
                      value={semesterId ?? ""}
                      onChange={(e) => setSemesterId(e.target.value)}
                      aria-label="Pilih semester akademik"
                      className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-xs font-semibold text-gray-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    >
                      {periods.map((p) => (
                        <option key={p.id} value={p.id}>
                          TA {p.ta} · {p.sem}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            </div>

            <p className="mt-4 text-xs text-gray-500">
              Menampilkan {rows.length} klien · {format} · {label}
            </p>

            <ul className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {rows.map(({ client, count, latest }) => (
                <li key={client.id}>
                  <button
                    type="button"
                    onClick={() => handleOpenClient(client.id)}
                    className="flex w-full flex-col rounded-2xl border border-gray-200 bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-[#36c08f]/60 hover:shadow-md"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-soft font-bold text-primary">
                        {initials(client.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-gray-900">
                          {client.name}
                        </p>
                        <p className="truncate text-xs text-gray-500">
                          {client.role}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4 text-sm">
                      <span className="text-gray-600">
                        {count} sesi {format.toLowerCase()}
                      </span>
                      <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">
                        Selesai
                      </span>
                    </div>
                    <p className="mt-3 text-xs text-gray-400">
                      Terakhir: {fmtDate(latest)}
                    </p>
                  </button>
                </li>
              ))}
            </ul>

            {rows.length === 0 && (
              <div className="mt-5 rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
                Tidak ada klien yang cocok dengan filter ini.
              </div>
            )}
          </>
        ) : (
          <>
            {/* ================= DETAIL KLIEN ================= */}
            <nav className="flex items-center gap-2 text-sm text-gray-500">
              <button
                type="button"
                onClick={backToClients}
                className="inline-flex items-center gap-1.5 font-semibold text-primary hover:underline"
              >
                <ChevronLeft className="h-4 w-4" />
                Riwayat Konseling
              </button>
              <span>/</span>
              <span className="truncate text-gray-700">{selected.name}</span>
            </nav>

            <div className="mt-5 flex flex-col gap-5 rounded-2xl border border-gray-200 bg-white p-5 sm:flex-row sm:items-center sm:p-6">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[#36c08f] text-xl font-bold text-white">
                {initials(selected.name)}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-bold sm:text-2xl">
                  {selected.name}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  {selected.role} · {selected.email}
                </p>
              </div>
              <dl className="grid grid-cols-2 gap-3 sm:gap-6">
                <div className="rounded-xl bg-gray-50 px-3 py-2.5 text-center sm:px-4">
                  <dt className="text-xs text-gray-500">Total sesi</dt>
                  <dd className="mt-0.5 text-lg font-bold">
                    {detailSessions.length}
                  </dd>
                </div>
                <div className="rounded-xl bg-gray-50 px-3 py-2.5 text-center sm:px-4">
                  <dt className="text-xs text-gray-500">Terakhir</dt>
                  <dd className="mt-0.5 text-sm font-semibold">
                    {lastDate ? fmtDate(lastDate) : "-"}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  Riwayat sesi
                </h3>
                <p className="text-xs text-gray-500">
                  {format} · {label}
                </p>
              </div>
              <div className="relative">
                <select
                  value={timeSort}
                  onChange={(e) =>
                    setTimeSort(e.target.value as "terbaru" | "terlama")
                  }
                  className="w-full appearance-none rounded-xl border border-gray-200 bg-gray-100/70 py-2.5 pl-4 pr-10 text-sm text-gray-600 outline-none focus:border-primary focus:bg-white sm:w-auto"
                >
                  <option value="terbaru">Waktu terbaru</option>
                  <option value="terlama">Waktu terlama</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              </div>
            </div>

            {detailSessions.length === 0 ? (
              <p className="mt-4 text-sm text-gray-500">
                Tidak ada sesi yang cocok dengan filter ini.
              </p>
            ) : (
              <ol className="relative mt-4 space-y-4 border-l-2 border-gray-200 pl-5 sm:pl-7">
                {detailSessions.map((s) => (
                  <li key={s.id} className="relative">
                    <span className="absolute -left-[27px] top-5 h-3 w-3 rounded-full border-2 border-white bg-[#36c08f] sm:-left-[35px]" />
                    <div className="rounded-2xl border border-gray-200 bg-white p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-gray-900">
                            {s.topic}
                          </p>
                          <p className="mt-0.5 text-sm text-gray-500">
                            {fmtDate(s.date)} · {s.time} WITA
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            s.format === "Kelompok"
                              ? "bg-yellow-200 text-yellow-900"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {s.format}
                        </span>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
                        <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">
                          Selesai
                        </span>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenConsent(s.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-primary px-3.5 py-2 text-sm font-semibold text-primary hover:bg-primary-soft"
                          >
                            <FileSignature className="h-4 w-4" />
                            Lihat informed consent
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenNote(s.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-white hover:bg-primary-dark"
                          >
                            <Eye className="h-4 w-4" />
                            Lihat catatan
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </>
        ))}

      {/* ================= MODAL PASSWORD ================= */}
      {!hasAccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0c2619]/45 p-4">
          <form
            onSubmit={handleUnlock}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <Lock className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-bold">Buka Riwayat Konseling</h2>
            <p className="mt-1 text-sm text-gray-500">
              Masukkan kata sandi khusus untuk membuka{" "}
              <span className="font-semibold text-gray-700">
                seluruh riwayat dan catatan konseling
              </span>
              . Ini berbeda dari kata sandi login Anda.
            </p>

            <label
              htmlFor="pwInput"
              className="mt-5 block text-sm font-medium text-gray-700"
            >
              Kata sandi
            </label>
            <div className="relative mt-1.5">
              <input
                id="pwInput"
                type={pwVisible ? "text" : "password"}
                autoComplete="off"
                autoFocus
                value={pwInput}
                onChange={(e) => setPwInput(e.target.value)}
                disabled={pwLocked || verifying}
                className="w-full rounded-xl border border-gray-300 py-2.5 pl-4 pr-20 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/15 disabled:bg-gray-100"
              />
              <button
                type="button"
                onClick={() => setPwVisible((v) => !v)}
                className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-primary hover:bg-primary-soft"
              >
                {pwVisible ? (
                  <EyeOff className="h-3.5 w-3.5" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
                {pwVisible ? "Sembunyikan" : "Lihat"}
              </button>
            </div>

            {pwError && <p className="mt-2 text-sm text-red-600">{pwError}</p>}
            {!pwError && pwUsed > 0 && !pwLocked && (
              <p className="mt-1 text-xs text-gray-500">
                Sisa percobaan: {MAX_ATTEMPTS - pwUsed}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={closePw}
                className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={pwLocked || verifying || pwInput.length === 0}
                className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
              >
                Buka
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ================= MODAL LIHAT INFORMED CONSENT ================= */}
      {hasAccess && selected && consentSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0c2619]/45 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="consent-view-title"
            className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-gray-200 p-5">
              <div>
                <h2
                  id="consent-view-title"
                  className="text-lg font-bold text-gray-900"
                >
                  Informed Consent
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  {selected.name} · {fmtDate(consentSession.date)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConsentSessionId(null)}
                aria-label="Tutup informed consent"
                className="rounded-lg p-2 hover:bg-gray-100"
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
                <div className="p-6 text-center text-sm text-gray-600">
                  Browser tidak dapat menampilkan PDF.{" "}
                  <a
                    href={CONSENT_PDF_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-primary underline"
                  >
                    Buka dokumen di tab baru
                  </a>
                </div>
              </object>
              <p className="border-t border-gray-200 p-5 text-sm text-gray-600">
                Ini adalah dokumen informed consent standar. Status persetujuan
                dan tanda tangan klien belum dapat ditampilkan karena data dari
                halaman KlienAktivitas belum terhubung dengan riwayat sesi ini.
              </p>
            </div>
            <div className="flex justify-end border-t border-gray-200 p-5">
              <a
                href={CONSENT_PDF_URL}
                download="informed-consent.pdf"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark"
              >
                <Download className="h-4 w-4" />
                Unduh PDF
              </a>
            </div>
          </section>
        </div>
      )}

      {/* ================= MODAL BACA CATATAN ================= */}
      {hasAccess && noteSession && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0c2619]/45 p-4">
          <div className="flex max-h-[88vh] w-full max-w-xl flex-col rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-gray-200 p-5 sm:p-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                  Catatan terbuka sementara
                </p>
                <h2 className="mt-1 text-lg font-bold">{noteSession.topic}</h2>
                <p className="mt-1 text-sm text-gray-500">
                  {fmtDate(noteSession.date)} · {noteSession.time} WITA ·{" "}
                  {noteSession.format}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setNoteId(null)}
                aria-label="Tutup"
                className="rounded-lg p-2 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto p-5 sm:p-6">
              <h3 className="text-sm font-semibold text-gray-700">
                Ringkasan sesi
              </h3>
              <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-gray-700">
                {noteSession.summary}
              </p>
              <h3 className="mt-5 text-sm font-semibold text-gray-700">
                Catatan konselor
              </h3>
              <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-gray-700">
                {noteSession.note}
              </p>
              <p className="mt-5 text-xs text-gray-400">
                Akses terkunci otomatis dalam {timerText}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ================= TOAST ================= */}
      <div
        className={`pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-gray-900 px-4 py-3 text-sm text-white shadow-lg transition duration-300 ${
          toastMsg ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
        }`}
      >
        {toastMsg}
      </div>
    </PageContainer>
  );
}
