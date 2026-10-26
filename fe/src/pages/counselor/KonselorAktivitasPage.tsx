import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  Clock3,
  HeartPulse,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type SessionFormat = "Individu" | "Kelompok";
type SessionStatus = "scheduled" | "ongoing" | "done" | "cancelled";

interface CancelInfo {
  code: string;
  label: string;
  note: string;
}

interface CounselingSession {
  id: number;
  client: string;
  topic: string;
  format: SessionFormat;
  start: number;
  status: SessionStatus;
  startedAt: number | null;
  cancel: CancelInfo | null;
  noteCounselor: string;
  noteClient: string;
  plan: string;
}

type DialogType = "start" | "finish";

interface DialogState {
  type: DialogType;
  id: number;
}

interface ClientIntake {
  selfHarm: string;
  distress: string;
  abuse: string;
  substance: string;
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

const CANCEL_REASONS = [
  { code: "KLIEN_SAKIT", label: "Klien sakit" },
  { code: "KONSELOR_BERHALANGAN", label: "Konselor berhalangan" },
  { code: "KLIEN_TIDAK_HADIR", label: "Klien tidak hadir tanpa kabar" },
  { code: "JADWAL_BENTROK", label: "Jadwal bentrok" },
  { code: "LAINNYA", label: "Lainnya" },
];

// Jam kerja konseling: sesi mulai 08.00 – 15.00 (selesai paling lambat 16.00)
const WORK_START = 8 * 60;
const WORK_LAST_START = 15 * 60;

const clamp = (value: number): number =>
  Math.min(WORK_LAST_START, Math.max(WORK_START, Math.round(value / 15) * 15));
const formatMinutes = (minutes: number): string =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}.${String(minutes % 60).padStart(2, "0")}`;
const initials = (name: string): string =>
  name
    .split(" ")
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

function getCurrentMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

const emptySession: Pick<
  CounselingSession,
  "cancel" | "noteCounselor" | "noteClient" | "plan"
> = {
  cancel: null,
  noteCounselor: "",
  noteClient: "",
  plan: "",
};

// Data dummy relatif terhadap jam sekarang. Hanya ada satu sesi yang berlangsung.
function buildDummySessions(nowM: number): CounselingSession[] {
  const scheduled = (
    id: number,
    client: string,
    topic: string,
    format: SessionFormat,
    offset: number,
    minStart: number,
  ): CounselingSession => ({
    id,
    client,
    topic,
    format,
    start: clamp(Math.max(nowM + offset, minStart)),
    status: "scheduled",
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
      status: "ongoing",
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
      status: "done",
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
      status: "cancelled",
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

function Badge({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}
    >
      {children}
    </span>
  );
}

function ScaleView({ value }: { value: number }) {
  const labels: Record<number, string> = {
    1: "Sangat buruk",
    2: "Buruk",
    3: "Cukup",
    4: "Baik",
    5: "Sangat baik",
  };
  return (
    <div>
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4, 5].map((number) => (
          <span
            key={number}
            className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${
              number === value
                ? "bg-[#064e3b] text-white"
                : "bg-gray-100 text-gray-400"
            }`}
          >
            {number}
          </span>
        ))}
      </div>
      <p className="mt-2 text-xs text-gray-500">
        Dipilih:{" "}
        <span className="font-semibold text-gray-800">
          {value} · {labels[value]}
        </span>
      </p>
    </div>
  );
}

function AnswerRow({
  question,
  answer,
}: {
  question: string;
  answer: string;
}) {
  const style =
    answer === "Ya"
      ? "bg-red-100 text-red-800"
      : answer === "Mungkin"
        ? "bg-amber-100 text-amber-800"
        : "bg-gray-100 text-gray-700";

  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 py-3 last:border-0">
      <p className="text-sm text-gray-700">{question}</p>
      <Badge className={style}>{answer}</Badge>
    </div>
  );
}

function EssayCard({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-200 p-4">
      <p className="text-sm font-semibold text-gray-700">{title}</p>
      <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-gray-800">
        {children || "-"}
      </p>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone = "slate",
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  tone?: "slate" | "green" | "amber";
}) {
  const tones: Record<"slate" | "green" | "amber", string> = {
    slate: "text-slate-600 bg-slate-100",
    green: "text-gray-700 bg-gray-100",
    amber: "text-amber-600 bg-amber-50",
  };
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="text-xs font-medium text-gray-500 sm:text-sm">{label}</p>
        <p className="mt-0.5 text-2xl font-bold text-gray-800">{value}</p>
      </div>
    </div>
  );
}

const primaryBtn =
  "rounded-xl bg-[#064e3b] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#043d2e]";
const inputFocus =
  "outline-none focus:border-[#064e3b] focus:ring-4 focus:ring-[#064e3b]/10";

export default function KonselorAktivitasPage() {
  const navigate = useNavigate();
  const [now, setNow] = useState(() => new Date());
  const [sessions, setSessions] = useState<CounselingSession[]>(() =>
    buildDummySessions(getCurrentMinutes()),
  );
  const [filter, setFilter] = useState("semua");
  const [visibleUpcomingCount, setVisibleUpcomingCount] = useState(10);
  const [selectedBookingId, setSelectedBookingId] = useState<number | null>(
    null,
  );
  const [view, setView] = useState("list");
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [cancelId, setCancelId] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelOther, setCancelOther] = useState("");
  const [cancelNote, setCancelNote] = useState("");
  const [toastMsg, setToastMsg] = useState("");

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!toastMsg) return undefined;
    const timer = window.setTimeout(() => setToastMsg(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toastMsg]);

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const currentSession = sessions.find((session) => session.id === currentId);
  const ongoingSession = sessions.find(
    (session) => session.status === "ongoing",
  );

  const canStart = (session: CounselingSession) =>
    session.status === "scheduled" && nowMinutes >= session.start;
  const isFilled = (session: CounselingSession) =>
    session.noteCounselor.trim().length >= 20 &&
    session.noteClient.trim().length >= 20;

  const activeSessions = useMemo(
    () =>
      sessions
        .filter(
          (session) =>
            session.status === "scheduled" || session.status === "ongoing",
        )
        .filter((session) => filter === "semua" || session.status === filter)
        .sort((a, b) => a.start - b.start),
    [sessions, filter],
  );

  // Satu sesi aktif ditampilkan pada area utama. Jika ada sesi berlangsung,
  // sesi terjadwal yang waktunya terlewat tetap berada di daftar sesi mendatang.
  const readySessions = activeSessions.some(
    (session) => session.status === "ongoing",
  )
    ? activeSessions
        .filter((session) => session.status === "ongoing")
        .slice(0, 1)
    : activeSessions.filter((session) => canStart(session)).slice(0, 1);
  const upcomingSessions = activeSessions
    .filter((session) => session.status === "scheduled" && !canStart(session))
    .sort((a, b) => a.start - b.start);
  const visibleUpcomingSessions = upcomingSessions.slice(
    0,
    visibleUpcomingCount,
  );
  const scheduledCount = sessions.filter(
    (session) => session.status === "scheduled",
  ).length;
  const ongoingCount = sessions.filter(
    (session) => session.status === "ongoing",
  ).length;
  const todayCount = sessions.filter(
    (session) => session.status === "scheduled" || session.status === "ongoing",
  ).length;

  const intakeFor = (client: string): ClientIntake => {
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

  const statusInfo = (
    session: CounselingSession,
  ): { label: string; style: string } => {
    if (session.status === "cancelled")
      return { label: "Dibatalkan", style: "bg-red-100 text-red-800" };
    if (session.status === "done")
      return { label: "Selesai", style: "bg-gray-100 text-gray-700" };
    if (session.status === "ongoing")
      return { label: "Berlangsung", style: "bg-[#064e3b] text-white" };
    if (canStart(session))
      return {
        label: "Siap dimulai",
        style: "bg-gray-100 text-gray-700 ring-1 ring-gray-200",
      };
    return { label: "Terjadwal", style: "bg-slate-100 text-slate-600" };
  };

  function notify(message: string) {
    setToastMsg(message);
  }

  function openSession(id: number) {
    setCurrentId(id);
    setView("session");
  }

  function backToList() {
    setCurrentId(null);
    setView("list");
  }

  function startSession() {
    if (!dialog) return;
    const session = sessions.find((item) => item.id === dialog.id);
    if (!session) return;
    // Hanya boleh satu sesi yang berlangsung dalam satu waktu
    if (ongoingSession && ongoingSession.id !== session.id) {
      setDialog(null);
      notify(
        `Masih ada sesi dengan ${ongoingSession.client} yang berlangsung. Selesaikan dulu sebelum memulai sesi lain.`,
      );
      return;
    }
    setSessions((previous) =>
      previous.map((item) =>
        item.id === dialog.id
          ? { ...item, status: "ongoing", startedAt: nowMinutes }
          : item,
      ),
    );
    setDialog(null);
    setCurrentId(session.id);
    setView("session");
    notify(
      `Sesi dengan ${session.client} dimulai. Silakan isi catatan konseling.`,
    );
  }

  function finishSession() {
    if (!currentSession || !isFilled(currentSession)) return;
    setSessions((previous) =>
      previous.map((item) =>
        item.id === currentSession.id ? { ...item, status: "done" } : item,
      ),
    );
    setDialog(null);
    backToList();
    notify("Sesi diselesaikan. Catatan tersimpan di Riwayat Konseling.");
  }

  function updateNote(
    field: "noteCounselor" | "noteClient" | "plan",
    value: string,
  ) {
    if (!currentSession || currentSession.status !== "ongoing") return;
    setSessions((previous) =>
      previous.map((item) =>
        item.id === currentSession.id ? { ...item, [field]: value } : item,
      ),
    );
  }

  function openCancel(id: number) {
    setCancelId(id);
    setCancelReason("");
    setCancelOther("");
    setCancelNote("");
  }

  function closeCancel() {
    setCancelId(null);
    setCancelReason("");
    setCancelOther("");
    setCancelNote("");
  }

  const otherReasonValid =
    cancelReason !== "LAINNYA" || cancelOther.trim().length >= 3;
  const cancelValid =
    Boolean(cancelReason) && otherReasonValid && cancelNote.trim().length >= 10;

  function confirmCancel() {
    if (!cancelId || !cancelValid) return;
    const reason = CANCEL_REASONS.find((item) => item.code === cancelReason);
    if (!reason) return;
    const label =
      cancelReason === "LAINNYA"
        ? `Lainnya: ${cancelOther.trim()}`
        : reason.label;
    setSessions((previous) =>
      previous.map((item) =>
        item.id === cancelId
          ? {
              ...item,
              status: "cancelled",
              cancel: { code: reason.code, label, note: cancelNote.trim() },
            }
          : item,
      ),
    );
    closeCancel();
    notify(
      "Sesi dibatalkan. Alasan tercatat dan sesi masuk ke Riwayat Konseling.",
    );
  }

  const intake = currentSession ? intakeFor(currentSession.client) : null;
  const selectedBooking = sessions.find(
    (session) => session.id === selectedBookingId,
  );
  const selectedBookingIntake = selectedBooking
    ? intakeFor(selectedBooking.client)
    : null;
  const safetyFlags = intake
    ? [
        intake.selfHarm !== "Tidak" ? "keinginan menyakiti diri" : null,
        intake.distress !== "Tidak" ? "kesedihan atau depresi berat" : null,
        intake.abuse !== "Tidak" ? "riwayat pelecehan" : null,
        intake.substance !== "Tidak" ? "penggunaan obat-obatan" : null,
      ].filter(Boolean)
    : [];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      {view === "list" && (
        <>
          <header>
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
              Aktivitas Saya
            </h1>
            <p className="mt-1 text-sm text-gray-500 sm:text-base">
              Mulai sesi saat jam mulai tiba. Jika mendadak tidak bisa hadir,
              batalkan dengan alasan.
            </p>
          </header>

          <section className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
            <StatCard
              icon={CalendarDays}
              label="Terjadwal"
              value={scheduledCount}
              tone="slate"
            />
            <StatCard
              icon={HeartPulse}
              label="Berlangsung"
              value={ongoingCount}
              tone="green"
            />
            <StatCard
              icon={Clock3}
              label="Sesi hari ini"
              value={todayCount}
              tone="amber"
            />
          </section>

          <section className="mt-6 inline-flex max-w-full items-center gap-1 rounded-2xl border border-gray-200 bg-gray-100/80 p-1">
            {[
              { value: "semua", label: "Semua" },
              { value: "scheduled", label: "Terjadwal" },
              { value: "ongoing", label: "Berlangsung" },
            ].map((item) => (
              <button
                key={item.value}
                type="button"
                aria-pressed={filter === item.value}
                onClick={() => setFilter(item.value)}
                className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-sm transition-colors ${
                  filter === item.value
                    ? "bg-white font-semibold text-gray-900 shadow-sm ring-1 ring-black/5"
                    : "font-medium text-gray-500 hover:text-gray-800"
                }`}
              >
                {item.label}
              </button>
            ))}
          </section>

          <p className="mt-4 text-xs text-gray-500">
            Menampilkan {activeSessions.length} sesi
          </p>

          {readySessions.length > 0 && (
            <section className="mt-4 rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#0a7a5c] opacity-60" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-[#064e3b]" />
                  </span>
                  <h2 className="text-base font-bold text-gray-900">
                    {ongoingSession ? "Sedang berlangsung" : "Siap dimulai"}
                  </h2>
                </div>
                <Badge className="bg-gray-100 text-gray-700">
                  {readySessions.length}
                </Badge>
              </div>
              <ul className="space-y-3">
                {readySessions.map((session) => {
                  const ongoing = session.status === "ongoing";
                  const status = statusInfo(session);
                  return (
                    <li
                      key={session.id}
                      className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
                    >
                      {ongoing && (
                        <div className="absolute inset-y-0 left-0 w-1 bg-[#064e3b]" />
                      )}
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gray-100 font-bold text-gray-700">
                            {initials(session.client)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-gray-900">
                              {session.client}
                            </p>
                            <p className="truncate text-xs text-gray-500">
                              {session.topic} · {session.format}
                            </p>
                          </div>
                        </div>
                        {!ongoing && (
                          <Badge className={status.style}>{status.label}</Badge>
                        )}
                      </div>
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
                        <div>
                          <p className="text-xs font-medium text-gray-500">
                            Jadwal
                          </p>
                          <p className="text-base font-bold text-gray-900">
                            {formatMinutes(session.start)} WITA
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {ongoing ? (
                            <button
                              type="button"
                              onClick={() => openSession(session.id)}
                              className={primaryBtn}
                            >
                              Lanjutkan Sesi
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  setDialog({ type: "start", id: session.id })
                                }
                                className={primaryBtn}
                              >
                                Mulai Sesi
                              </button>
                              <button
                                type="button"
                                onClick={() => openCancel(session.id)}
                                className="rounded-xl border border-red-300 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50"
                              >
                                Batalkan
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {upcomingSessions.length > 0 && (
            <section className="mt-8">
              <div className="mb-3 flex items-center justify-between gap-2 px-1">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Sesi mendatang
                </h2>
                <Badge className="bg-slate-200 text-slate-700">
                  {upcomingSessions.length}
                </Badge>
              </div>
              <ul className="space-y-2">
                {visibleUpcomingSessions.map((session) => (
                  <li
                    key={session.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedBookingId(session.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedBookingId(session.id);
                      }
                    }}
                    className="flex cursor-pointer flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3.5 transition-colors hover:border-[#0a7a5c]/40 hover:bg-[#dff5e8]/30 focus:outline-none focus:ring-2 focus:ring-[#064e3b]/20"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xs font-bold text-slate-600">
                        {initials(session.client)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-700">
                          {session.client}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {session.topic} · {session.format}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-semibold text-slate-700">
                          {formatMinutes(session.start)} WITA
                        </p>
                        <p className="text-xs text-slate-500">Sesi terjadwal</p>
                      </div>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          openCancel(session.id);
                        }}
                        className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                      >
                        Batalkan
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              {upcomingSessions.length > visibleUpcomingCount && (
                <div className="mt-4 flex justify-center">
                  <button
                    type="button"
                    onClick={() =>
                      setVisibleUpcomingCount((count) =>
                        Math.min(count + 10, upcomingSessions.length),
                      )
                    }
                    className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-[#0a7a5c]/40 hover:bg-[#dff5e8]/30"
                  >
                    Muat lebih banyak
                  </button>
                </div>
              )}
            </section>
          )}

          {activeSessions.length === 0 && (
            <div className="mt-5 rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
              Tidak ada sesi aktif. Sesi selesai dan dibatalkan dapat dilihat di
              Riwayat Konseling.
            </div>
          )}
        </>
      )}

      {view === "session" && currentSession && intake && (
        <>
          <nav className="flex items-center gap-2 text-sm text-gray-500">
            <button
              type="button"
              onClick={backToList}
              className="inline-flex items-center gap-1 font-semibold text-gray-700 hover:underline"
            >
              <ArrowLeft className="h-4 w-4" /> Aktivitas Saya
            </button>
            <span>/</span>
            <span className="truncate text-gray-700">
              {currentSession.client}
            </span>
          </nav>

          <section className="mt-5 flex flex-col gap-5 rounded-2xl border border-gray-200 bg-white p-5 sm:flex-row sm:items-center sm:p-6">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gray-900 text-xl font-bold text-white">
              {initials(currentSession.client)}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-bold sm:text-2xl">
                {currentSession.client}
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                {currentSession.topic} · {currentSession.format}
              </p>
              <div className="mt-2">
                <Badge className={statusInfo(currentSession).style}>
                  {statusInfo(currentSession).label}
                </Badge>
                {currentSession.status === "ongoing" && (
                  <span className="ml-2 text-xs text-gray-500">
                    Dimulai pukul{" "}
                    {formatMinutes(
                      currentSession.startedAt ?? currentSession.start,
                    )}{" "}
                    · berjalan{" "}
                    {Math.max(
                      0,
                      nowMinutes -
                        (currentSession.startedAt ?? currentSession.start),
                    )}{" "}
                    menit
                  </span>
                )}
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-3 sm:gap-6">
              <div className="rounded-xl bg-gray-50 px-3 py-2.5 text-center sm:px-4">
                <dt className="text-xs text-gray-500">Jenis</dt>
                <dd className="mt-0.5 text-sm font-bold">
                  {currentSession.format}
                </dd>
              </div>
              <div className="rounded-xl bg-gray-50 px-3 py-2.5 text-center sm:px-4">
                <dt className="text-xs text-gray-500">Jadwal</dt>
                <dd className="mt-0.5 text-sm font-bold">
                  {formatMinutes(currentSession.start)} WITA
                </dd>
              </div>
            </dl>
          </section>

          {safetyFlags.length > 0 && (
            <section className="mt-5 rounded-2xl border border-red-300 bg-red-50 p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-200 font-bold text-red-800">
                  !
                </span>
                <div>
                  <p className="font-semibold text-red-900">
                    Perlu perhatian khusus
                  </p>
                  <p className="mt-0.5 text-sm text-red-800">
                    Klien menjawab ya atau mungkin pada:{" "}
                    {safetyFlags.join(", ")}. Pertimbangkan tindak lanjut selama
                    sesi.
                  </p>
                </div>
              </div>
            </section>
          )}

          <details className="mt-5 rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
            <summary className="flex cursor-pointer list-none items-center justify-between text-base font-bold">
              Formulir intake klien
              <span className="text-sm font-semibold text-gray-600">
                Lihat / sembunyikan
              </span>
            </summary>
            <div className="mt-4">
              <h3 className="text-sm font-bold">Kondisi saat ini</h3>
              <div className="mt-2">
                <AnswerRow
                  question="Apakah Anda sedang merasa ingin bunuh diri?"
                  answer={intake.selfHarm}
                />
                <AnswerRow
                  question="Apakah Anda sedang merasakan kesedihan, kehilangan, atau depresi yang luar biasa?"
                  answer={intake.distress}
                />
                <AnswerRow
                  question="Apakah Anda pernah mengalami pelecehan? (fisik, seksual, dan/atau emosional)"
                  answer={intake.abuse}
                />
                <AnswerRow
                  question="Apakah saat ini Anda sedang menggunakan obat-obatan?"
                  answer={intake.substance}
                />
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm font-semibold text-gray-700">
                    Kualitas tidur
                  </p>
                  <div className="mt-2">
                    <ScaleView value={intake.sleep} />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-700">
                    Keadaan finansial
                  </p>
                  <div className="mt-2">
                    <ScaleView value={intake.finance} />
                  </div>
                </div>
              </div>
              <h3 className="mt-5 text-sm font-bold">
                Masalah yang ingin dibahas
              </h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {intake.topics.map((topic) => (
                  <Badge key={topic} className="bg-blue-100 text-blue-800">
                    {topic}
                  </Badge>
                ))}
              </div>
              <div className="mt-4 space-y-3">
                <EssayCard title="Deskripsikan keluhan yang Anda rasakan">
                  {intake.complaint}
                </EssayCard>
                <EssayCard title="Deskripsikan riwayat terjadinya keluhan">
                  {intake.history}
                </EssayCard>
                <EssayCard title="Keluhan dan alasan ingin memulai konseling">
                  {intake.reason}
                </EssayCard>
                <EssayCard title="Apa yang sudah dilakukan untuk menangani masalah ini?">
                  {intake.efforts}
                </EssayCard>
                <EssayCard title="Solusi apa yang diinginkan dari bantuan yang diterima?">
                  {intake.goal}
                </EssayCard>
                <EssayCard title="Apa kelebihan diri Anda?">
                  {intake.strengths}
                </EssayCard>
                <EssayCard title="Apa kekurangan diri Anda?">
                  {intake.weaknesses}
                </EssayCard>
              </div>
            </div>
          </details>

          <section className="mt-5 rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-bold">Catatan konseling</h3>
              <p className="text-xs text-gray-500">
                {currentSession.status === "ongoing"
                  ? "Draf tersimpan otomatis selama halaman terbuka"
                  : ""}
              </p>
            </div>

            {currentSession.status === "ongoing" ? (
              <div className="mt-4 space-y-5">
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <label
                    htmlFor="noteCounselor"
                    className="text-sm font-semibold text-gray-800"
                  >
                    Catatan konselor <span className="text-red-600">*</span>
                  </label>
                  <p className="text-xs text-gray-500">
                    Hanya dapat dilihat konselor di menu Riwayat Konseling.
                  </p>
                  <textarea
                    id="noteCounselor"
                    rows={5}
                    value={currentSession.noteCounselor}
                    onChange={(event) =>
                      updateNote("noteCounselor", event.target.value)
                    }
                    className={`mt-2 w-full rounded-xl border border-gray-300 bg-white p-3 text-sm ${inputFocus}`}
                    placeholder="Perkembangan klien, asesmen, dan hal penting untuk konselor (minimal 20 karakter)"
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    {currentSession.noteCounselor.trim().length}/20 karakter
                    minimum
                  </p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <label
                    htmlFor="noteClient"
                    className="text-sm font-semibold text-gray-800"
                  >
                    Catatan untuk klien <span className="text-red-600">*</span>
                  </label>
                  <p className="text-xs text-gray-500">
                    Dapat dilihat klien di menu Riwayat Konselingnya. Gunakan
                    bahasa yang ramah dan mudah dipahami.
                  </p>
                  <textarea
                    id="noteClient"
                    rows={4}
                    value={currentSession.noteClient}
                    onChange={(event) =>
                      updateNote("noteClient", event.target.value)
                    }
                    className={`mt-2 w-full rounded-xl border border-gray-300 bg-white p-3 text-sm ${inputFocus}`}
                    placeholder="Ringkasan yang dapat dibaca klien (minimal 20 karakter)"
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    {currentSession.noteClient.trim().length}/20 karakter
                    minimum
                  </p>
                </div>
                <div>
                  <label
                    htmlFor="notePlan"
                    className="text-sm font-semibold text-gray-700"
                  >
                    Rencana tindak lanjut{" "}
                    <span className="text-xs font-normal text-gray-400">
                      (opsional)
                    </span>
                  </label>
                  <textarea
                    id="notePlan"
                    rows={2}
                    value={currentSession.plan}
                    onChange={(event) => updateNote("plan", event.target.value)}
                    className={`mt-1.5 w-full rounded-xl border border-gray-300 p-3 text-sm ${inputFocus}`}
                    placeholder="Misalnya: sesi lanjutan minggu depan"
                  />
                </div>
              </div>
            ) : (
              <p className="mt-4 rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
                Sesi belum dimulai. Kembali ke daftar dan tekan "Mulai Sesi"
                saat jam mulai tiba.
              </p>
            )}
          </section>

          {currentSession.status === "ongoing" && (
            <div className="sticky bottom-0 mt-6 flex flex-col gap-3 border-t border-gray-200 bg-gray-50/95 py-4 backdrop-blur sm:flex-row sm:items-center sm:justify-end">
              <p className="text-xs text-gray-500 sm:mr-auto">
                {isFilled(currentSession)
                  ? "Catatan sudah lengkap. Anda bisa menyelesaikan sesi."
                  : "Isi kedua catatan wajib, masing-masing minimal 20 karakter."}
              </p>
              <button
                type="button"
                onClick={() =>
                  setDialog({ type: "finish", id: currentSession.id })
                }
                disabled={!isFilled(currentSession)}
                className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Selesaikan Sesi
              </button>
            </div>
          )}
        </>
      )}

      {selectedBooking && selectedBookingIntake && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-4"
          onClick={() => setSelectedBookingId(null)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="booking-detail-title"
            className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="flex items-start justify-between gap-4 border-b border-gray-100 p-5 sm:p-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#0a7a5c]">
                  Detail booking klien
                </p>
                <h2
                  id="booking-detail-title"
                  className="mt-1 text-xl font-bold text-gray-900"
                >
                  {selectedBooking.client}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  {selectedBooking.topic} · {selectedBooking.format}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBookingId(null)}
                aria-label="Tutup detail booking"
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="space-y-6 overflow-y-auto p-5 sm:p-6">
              <section className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-[#dff5e8]/70 p-4">
                  <p className="text-xs font-medium text-gray-500">
                    Jenis layanan
                  </p>
                  <p className="mt-1 font-semibold text-gray-900">
                    {selectedBooking.format}
                  </p>
                </div>
                <div className="rounded-xl bg-[#dff5e8]/70 p-4">
                  <p className="text-xs font-medium text-gray-500">
                    Topik booking
                  </p>
                  <p className="mt-1 font-semibold text-gray-900">
                    {selectedBooking.topic}
                  </p>
                </div>
                <div className="rounded-xl bg-[#dff5e8]/70 p-4">
                  <p className="text-xs font-medium text-gray-500">Jadwal</p>
                  <p className="mt-1 font-semibold text-gray-900">
                    {formatMinutes(selectedBooking.start)} WITA
                  </p>
                </div>
              </section>

              <section>
                <h3 className="text-sm font-bold text-gray-900">
                  Kondisi saat ini
                </h3>
                <div className="mt-2 divide-y divide-gray-100 rounded-xl border border-gray-200 px-4">
                  <AnswerRow
                    question="Apakah Anda sedang merasa ingin bunuh diri?"
                    answer={selectedBookingIntake.selfHarm}
                  />
                  <AnswerRow
                    question="Apakah Anda sedang merasakan kesedihan, kehilangan, atau depresi yang luar biasa?"
                    answer={selectedBookingIntake.distress}
                  />
                  <AnswerRow
                    question="Apakah Anda pernah mengalami pelecehan (fisik, seksual, dan/atau emosional)?"
                    answer={selectedBookingIntake.abuse}
                  />
                  <AnswerRow
                    question="Apakah saat ini Anda sedang menggunakan obat-obatan?"
                    answer={selectedBookingIntake.substance}
                  />
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-gray-200 p-4">
                    <p className="text-sm font-semibold text-gray-700">
                      Kualitas tidur
                    </p>
                    <div className="mt-2">
                      <ScaleView value={selectedBookingIntake.sleep} />
                    </div>
                  </div>
                  <div className="rounded-xl border border-gray-200 p-4">
                    <p className="text-sm font-semibold text-gray-700">
                      Keadaan finansial
                    </p>
                    <div className="mt-2">
                      <ScaleView value={selectedBookingIntake.finance} />
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-sm font-bold text-gray-900">
                  Masalah yang ingin dibahas
                </h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedBookingIntake.topics.map((topic) => (
                    <Badge key={topic} className="bg-[#dff5e8] text-[#064e3b]">
                      {topic}
                    </Badge>
                  ))}
                </div>
              </section>

              <section className="space-y-3">
                <EssayCard title="Deskripsikan keluhan yang Anda rasakan">
                  {selectedBookingIntake.complaint}
                </EssayCard>
                <EssayCard title="Deskripsikan riwayat terjadinya keluhan">
                  {selectedBookingIntake.history}
                </EssayCard>
                <EssayCard title="Keluhan dan alasan ingin memulai konseling">
                  {selectedBookingIntake.reason}
                </EssayCard>
                <EssayCard title="Apa yang sudah dilakukan untuk menangani masalah ini?">
                  {selectedBookingIntake.efforts}
                </EssayCard>
                <EssayCard title="Solusi apa yang diinginkan dari bantuan yang diterima?">
                  {selectedBookingIntake.goal}
                </EssayCard>
                <EssayCard title="Apa kelebihan diri Anda?">
                  {selectedBookingIntake.strengths}
                </EssayCard>
                <EssayCard title="Apa kekurangan diri Anda?">
                  {selectedBookingIntake.weaknesses}
                </EssayCard>
              </section>

              {selectedBooking.format === "Kelompok" && (
                <section className="rounded-xl border border-gray-200 p-4">
                  <h3 className="text-sm font-bold text-gray-900">
                    Informasi kelompok
                  </h3>
                  <p className="mt-2 text-sm text-gray-500">
                    Nama kelompok, jumlah anggota, dan daftar anggota belum
                    tersedia pada data dummy booking ini.
                  </p>
                </section>
              )}
            </div>

            <footer className="flex justify-end border-t border-gray-100 p-4 sm:p-5">
              <button
                type="button"
                onClick={() => setSelectedBookingId(null)}
                className={primaryBtn}
              >
                Tutup detail
              </button>
            </footer>
          </section>
        </div>
      )}

      {dialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-bold">
                {dialog.type === "start"
                  ? `Mulai sesi dengan ${sessions.find((item) => item.id === dialog.id)?.client}?`
                  : "Selesaikan sesi ini?"}
              </h2>
              <button
                type="button"
                onClick={() => setDialog(null)}
                aria-label="Tutup"
                className="rounded-lg p-1 text-gray-500 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-2 text-sm text-gray-600">
              {dialog.type === "start"
                ? "Sesi akan dimulai sekarang. Anda akan diarahkan ke halaman sesi untuk mengisi catatan."
                : "Setelah diselesaikan, kedua catatan disimpan dan tidak dapat diubah lagi. Catatan konselor hanya dapat dilihat Anda, catatan untuk klien dapat dilihat klien."}
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDialog(null)}
                className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Kembali
              </button>
              <button
                type="button"
                onClick={dialog.type === "start" ? startSession : finishSession}
                className={primaryBtn}
              >
                {dialog.type === "start" ? "Ya, mulai sesi" : "Ya, selesaikan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {cancelId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-4">
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="border-b border-gray-200 p-6 pb-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold">Batalkan sesi</h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Sesi dengan{" "}
                    {sessions.find((item) => item.id === cancelId)?.client}.
                    Alasan akan tercatat di laporan.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeCancel}
                  aria-label="Tutup"
                  className="rounded-lg p-1 text-gray-500 hover:bg-gray-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="space-y-5 overflow-y-auto p-6">
              <fieldset>
                <legend className="text-sm font-semibold text-gray-800">
                  Alasan pembatalan <span className="text-red-600">*</span>
                </legend>
                <div className="mt-2 space-y-2">
                  {CANCEL_REASONS.map((reason) => (
                    <label
                      key={reason.code}
                      className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 p-3.5 transition hover:border-red-300 has-[:checked]:border-red-500 has-[:checked]:bg-red-50/60"
                    >
                      <input
                        type="radio"
                        name="cancelReason"
                        value={reason.code}
                        checked={cancelReason === reason.code}
                        onChange={() => setCancelReason(reason.code)}
                        className="h-4 w-4 accent-red-600"
                      />
                      <span className="text-sm font-medium text-gray-800">
                        {reason.label}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              {cancelReason === "LAINNYA" && (
                <div>
                  <label
                    htmlFor="cancelOther"
                    className="text-sm font-semibold text-gray-800"
                  >
                    Sebutkan alasan lainnya{" "}
                    <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="cancelOther"
                    type="text"
                    maxLength={80}
                    value={cancelOther}
                    onChange={(event) => setCancelOther(event.target.value)}
                    placeholder="Misalnya: ruangan rusak mendadak"
                    className="mt-1.5 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/15"
                  />
                </div>
              )}

              <div>
                <label
                  htmlFor="cancelNote"
                  className="text-sm font-semibold text-gray-800"
                >
                  Penjelasan tambahan <span className="text-red-600">*</span>
                </label>
                <textarea
                  id="cancelNote"
                  rows={3}
                  value={cancelNote}
                  onChange={(event) => setCancelNote(event.target.value)}
                  placeholder="Jelaskan kondisi secara singkat (minimal 10 karakter)"
                  className="mt-1.5 w-full rounded-xl border border-gray-300 p-3 text-sm outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/15"
                />
                <p className="mt-1 text-xs text-gray-400">
                  Catatan ini hanya dapat dilihat konselor. Laporan admin
                  menampilkan alasan pilihan saja.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-200 p-6 pt-4">
              <button
                type="button"
                onClick={closeCancel}
                className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Kembali
              </button>
              <button
                type="button"
                onClick={confirmCancel}
                disabled={!cancelValid}
                className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Ya, batalkan sesi
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        role="status"
        aria-live="polite"
        className={`pointer-events-none fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-xl bg-gray-900 px-4 py-3 text-sm text-white shadow-lg transition duration-300 ${
          toastMsg ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
        }`}
      >
        {toastMsg}
      </div>

      {view === "list" && (
        <button
          type="button"
          onClick={() => navigate("/konselor/riwayat")}
          className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-gray-700 hover:underline"
        >
          Lihat Riwayat Konseling <ChevronDown className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
