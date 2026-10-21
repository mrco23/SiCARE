import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  CalendarPlus,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Star,
  X,
} from "lucide-react";

type SessionStatus = "ongoing" | "done" | "upcoming";

type PendingSlot = {
  reason: string;
  note: string;
  label: string;
};

type Session = {
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
};

type RescheduleState = {
  sessionId: number;
  reason: string | null;
  date: Date | null;
  slotIndex: number | null;
  note: string;
  error: string;
  month: Date;
};

type TimeSlot = {
  label: string;
  start: Date;
};

const RESCHEDULE_MIN_HOURS = 24;
const RESCHEDULE_MAX = 1;
const SESSION_MIN = 60;
const MAX_AHEAD_DAYS = 60;

const RESCHEDULE_REASONS = [
  "Bentrok jadwal kuliah",
  "Sakit",
  "Keperluan mendesak",
  "Lainnya",
];

const COUNSELOR_WEEK: Record<number, string[]> = {
  2: ["14.00-15.00", "15.00-16.00"],
  3: ["09.00-10.00", "10.00-11.00"],
  4: ["14.00-15.00", "15.00-16.00"],
};

const COUNSELOR_SCHEDULE: Record<string, Record<number, string[]>> = {
  "Giovanna Yudi, S.Psi., M.Psi.": COUNSELOR_WEEK,
  "Rico Kornelius Wahani, S.Psi., M.Psi.": COUNSELOR_WEEK,
};

function createInitialSessions(): Session[] {
  const at = (minutesFromNow: number) =>
    new Date(Date.now() + minutesFromNow * 60_000);

  return [
    {
      id: 1,
      counselor: "Giovanna Yudi, S.Psi., M.Psi.",
      initials: "GY",
      service: "Konseling Individu",
      room: "Ruang Konseling 01",
      start: at(-10),
      end: at(50),
      rescheduleCount: 0,
      feedbackGiven: false,
      rating: 0,
      pendingSlot: null,
    },
    {
      id: 2,
      counselor: "Rico Kornelius Wahani, S.Psi., M.Psi.",
      initials: "RW",
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
      counselor: "Giovanna Yudi, S.Psi., M.Psi.",
      initials: "GY",
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
      counselor: "Rico Kornelius Wahani, S.Psi., M.Psi.",
      initials: "RW",
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
      counselor: "Giovanna Yudi, S.Psi., M.Psi.",
      initials: "GY",
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

const formatTime = (date: Date) =>
  `${String(date.getHours()).padStart(2, "0")}.${String(date.getMinutes()).padStart(2, "0")}`;

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

const formatDateLong = (date: Date) =>
  date.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

const dayLabel = (date: Date, now: number) => {
  const today = startOfDay(new Date(now));
  const target = startOfDay(date);
  const difference = Math.round(
    (target.getTime() - today.getTime()) / 86_400_000,
  );

  if (difference === 0) return "Hari ini";
  if (difference === 1) return "Besok";
  if (difference === -1) return "Kemarin";

  return date.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
};

const countdown = (milliseconds: number) => {
  const minutes = Math.max(0, Math.floor(milliseconds / 60_000));
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return hours > 0
    ? `${hours} jam ${remainingMinutes} menit lagi`
    : `${remainingMinutes} menit lagi`;
};

const statusOf = (session: Session, now: number): SessionStatus => {
  if (now >= session.start.getTime() && now < session.end.getTime()) {
    return "ongoing";
  }
  if (now >= session.end.getTime()) return "done";
  return "upcoming";
};

const canReschedule = (session: Session, now: number) => {
  const hoursLeft = (session.start.getTime() - now) / 3_600_000;
  return (
    statusOf(session, now) === "upcoming" &&
    hoursLeft >= RESCHEDULE_MIN_HOURS &&
    session.rescheduleCount < RESCHEDULE_MAX
  );
};

const needsFeedback = (session: Session, now: number) =>
  statusOf(session, now) === "done" && !session.feedbackGiven;

export default function KlienAktivitasPage() {
  const [sessions, setSessions] = useState<Session[]>(createInitialSessions);
  const [now, setNow] = useState(() => Date.now());
  const [feedbackSessionId, setFeedbackSessionId] = useState<number | null>(
    null,
  );
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackNote, setFeedbackNote] = useState("");
  const [toast, setToast] = useState("");
  const [view, setView] = useState<"main" | "reschedule">("main");
  const [reschedule, setReschedule] = useState<RescheduleState | null>(null);
  const toastTimeout = useRef<ReturnType<typeof window.setTimeout> | null>(
    null,
  );

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(
    () => () => {
      if (toastTimeout.current !== null)
        window.clearTimeout(toastTimeout.current);
    },
    [],
  );

  const showToast = (message: string) => {
    setToast(message);
    if (toastTimeout.current !== null)
      window.clearTimeout(toastTimeout.current);
    toastTimeout.current = window.setTimeout(() => setToast(""), 2600);
  };

  const ongoing = useMemo(
    () =>
      sessions
        .filter((session) => statusOf(session, now) === "ongoing")
        .sort((a, b) => a.start.getTime() - b.start.getTime()),
    [sessions, now],
  );

  const upcoming = useMemo(
    () =>
      sessions
        .filter((session) => statusOf(session, now) === "upcoming")
        .sort((a, b) => a.start.getTime() - b.start.getTime()),
    [sessions, now],
  );

  const pendingFeedback = useMemo(
    () =>
      sessions
        .filter((session) => needsFeedback(session, now))
        .sort((a, b) => b.end.getTime() - a.end.getTime()),
    [sessions, now],
  );

  const weekCount = upcoming.filter(
    (session) => session.start.getTime() - now <= 7 * 86_400_000,
  ).length;

  const summaryLine = [
    ongoing.length
      ? "Kamu sedang dalam sesi konseling. Kamu aman untuk bercerita."
      : "",
    !ongoing.length && upcoming.length
      ? weekCount
        ? `Kamu punya ${weekCount} sesi dalam 7 hari ke depan.`
        : "Belum ada sesi dalam 7 hari ke depan."
      : !ongoing.length && !upcoming.length
        ? "Belum ada sesi yang dijadwalkan."
        : "",
    pendingFeedback.length
      ? `${pendingFeedback.length} sesi menunggu penilaianmu.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  const timelineGroups = useMemo(() => {
    const rest = upcoming.slice(1);
    const groups = new Map<string, { date: Date; items: Session[] }>();

    rest.forEach((session) => {
      const key = session.start.toDateString();
      const group = groups.get(key);
      if (group) group.items.push(session);
      else groups.set(key, { date: session.start, items: [session] });
    });

    return Array.from(groups.values());
  }, [upcoming]);

  const feedbackSession = sessions.find(
    (session) => session.id === feedbackSessionId,
  );

  const rescheduleSession = reschedule
    ? sessions.find((session) => session.id === reschedule.sessionId)
    : undefined;

  const slotsFor = (counselor: string, date: Date): TimeSlot[] => {
    const times = (COUNSELOR_SCHEDULE[counselor] ?? {})[date.getDay()] ?? [];

    return times
      .map((label) => ({
        label,
        start: new Date(
          date.getFullYear(),
          date.getMonth(),
          date.getDate(),
          Number(label.slice(0, 2)),
          Number(label.slice(3, 5)),
        ),
      }))
      .filter(
        (slot) =>
          slot.start.getTime() - now >= RESCHEDULE_MIN_HOURS * 3_600_000,
      );
  };

  const openFeedback = (sessionId: number) => {
    const session = sessions.find((item) => item.id === sessionId);
    if (!session) return;
    setFeedbackSessionId(sessionId);
    setFeedbackRating(0);
    setFeedbackNote("");
  };

  const closeFeedback = () => setFeedbackSessionId(null);

  const submitFeedback = () => {
    if (feedbackSessionId === null || feedbackRating < 1) return;

    setSessions((current) =>
      current.map((session) =>
        session.id === feedbackSessionId
          ? { ...session, feedbackGiven: true, rating: feedbackRating }
          : session,
      ),
    );
    closeFeedback();
    showToast("Terima kasih! Penilaianmu sudah kami terima.");
  };

  const openReschedule = (sessionId: number) => {
    const session = sessions.find((item) => item.id === sessionId);
    if (!session || !canReschedule(session, now)) return;

    const today = new Date(now);
    setReschedule({
      sessionId,
      reason: null,
      date: null,
      slotIndex: null,
      note: "",
      error: "",
      month: new Date(today.getFullYear(), today.getMonth(), 1),
    });
    setView("reschedule");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const backToActivity = () => {
    setView("main");
    setReschedule(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const updateReschedule = (changes: Partial<RescheduleState>) => {
    setReschedule((current) =>
      current ? { ...current, ...changes } : current,
    );
  };

  const submitReschedule = () => {
    if (
      !reschedule ||
      !rescheduleSession ||
      !reschedule.reason ||
      !reschedule.date ||
      reschedule.slotIndex === null
    ) {
      return;
    }

    const availableSlots = slotsFor(
      rescheduleSession.counselor,
      reschedule.date,
    );
    const selectedSlot = availableSlots[reschedule.slotIndex];

    if (!selectedSlot) {
      updateReschedule({
        error: "Jam yang dipilih sudah tidak tersedia. Silakan pilih kembali.",
      });
      return;
    }

    if (!canReschedule(rescheduleSession, now)) {
      updateReschedule({
        error:
          "Pengajuan tidak dapat diproses. Periksa batas waktu atau kuota ubah jadwal.",
      });
      return;
    }

    const requestedLabel = `${reschedule.date.toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
    })}, ${selectedSlot.label.replace("-", "–")} WITA`;

    setSessions((current) =>
      current.map((session) =>
        session.id === rescheduleSession.id
          ? {
              ...session,
              rescheduleCount: session.rescheduleCount + 1,
              pendingSlot: {
                reason: reschedule.reason as string,
                note: reschedule.note,
                label: requestedLabel,
              },
            }
          : session,
      ),
    );

    setReschedule(null);
    setView("main");
    showToast(
      "Pengajuan ubah jadwal dikirim. Kami kabari begitu konselor menyetujuinya.",
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const renderFeedbackItem = (session: Session) => (
    <div
      key={session.id}
      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 p-4"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-500">
          <Star className="h-5 w-5" fill="currentColor" strokeWidth={1.5} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">
            {dayLabel(session.start, now)}, {formatTime(session.start)}–
            {formatTime(session.end)} WITA
          </p>
          <p className="truncate text-sm text-gray-700">{session.counselor}</p>
          <p className="truncate text-xs text-gray-500">
            {session.service} · {session.room}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => openFeedback(session.id)}
        className="rounded-full bg-[#1e5b3a] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#174a2f]"
      >
        Beri penilaian
      </button>
    </div>
  );

  const renderLiveCard = (session: Session) => {
    return (
      <article
        key={session.id}
        className="relative overflow-hidden rounded-3xl bg-[#0f3d2a] p-6 text-white shadow-lg sm:p-8"
      >
        <div className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-[#8fe3bf]/10 blur-2xl" />
        <div className="relative flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#36c08f] opacity-60" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-[#36c08f]" />
          </span>
          <p className="text-sm font-semibold uppercase tracking-wider text-[#8fe3bf]">
            Sedang berlangsung
          </p>
        </div>
        <p className="relative mt-4 font-display text-2xl font-bold sm:text-3xl">
          {session.counselor}
        </p>
        <p className="relative mt-1 text-sm text-white/75">
          {session.service} · {session.room}
        </p>
        <div
          className="relative mt-6 h-2 w-full overflow-hidden rounded-full bg-white/15"
          role="status"
          aria-label="Sesi konseling sedang berlangsung"
        >
          <div className="absolute inset-y-0 w-1/3 rounded-full bg-gradient-to-r from-[#36c08f]/40 via-[#8fe3bf] to-[#36c08f]/40 animate-[session-loading_1.8s_ease-in-out_infinite]" />
          <style>{`
            @keyframes session-loading {
              0% { left: -35%; }
              100% { left: 100%; }
            }
          `}</style>
        </div>
        <p className="relative mt-5 text-sm text-white/85">
          Sesimu sedang berjalan. Kamu aman untuk bercerita.
        </p>
      </article>
    );
  };

  const renderNextSession = (session: Session) => {
    const allowed = canReschedule(session, now);
    const showLimitNote = !allowed && session.rescheduleCount < RESCHEDULE_MAX;

    return (
      <article
        key={session.id}
        className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
      >
        <p className="text-xs font-semibold text-[#1e5b3a]">
          Sesimu berikutnya
        </p>
        <p className="mt-1.5 font-display text-lg font-bold text-gray-900">
          {session.counselor}
        </p>
        <p className="mt-1 text-sm text-gray-600">
          {dayLabel(session.start, now)}, {formatTime(session.start)} WITA ·{" "}
          {countdown(session.start.getTime() - now)}
        </p>
        <p className="text-sm text-gray-500">
          {session.service} · {session.room}
        </p>
        {session.pendingSlot && (
          <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Pengajuan jadwal baru: {session.pendingSlot.label}
          </div>
        )}
        <div className="mt-4">
          <button
            type="button"
            disabled={!allowed}
            onClick={() => openReschedule(session.id)}
            className="rounded-full border border-[#1e5b3a] px-4 py-2 text-xs font-semibold text-[#1e5b3a] transition hover:bg-[#e8f9f0] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Ubah jadwal
          </button>
        </div>
        {showLimitNote && (
          <p className="mt-3 text-xs text-gray-500">
            Ubah jadwal hanya bisa diajukan minimal 24 jam sebelum sesi.
          </p>
        )}
        {session.rescheduleCount > 0 && (
          <p className="mt-3 text-xs text-amber-700">
            Pengajuan ubah jadwal sedang menunggu persetujuan konselor.
          </p>
        )}
      </article>
    );
  };

  const renderTimelineItem = (session: Session) => {
    const allowed = canReschedule(session, now);

    return (
      <li
        key={session.id}
        className="relative rounded-2xl border border-gray-200 bg-white p-4 sm:p-5"
      >
        <span className="absolute -left-[29px] top-6 h-3 w-3 rounded-full border-2 border-white bg-[#36c08f]" />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900">
              {formatTime(session.start)}–{formatTime(session.end)} WITA
            </p>
            <p className="mt-0.5 truncate text-sm text-gray-700">
              {session.counselor}
            </p>
            <p className="truncate text-xs text-gray-500">
              {session.service} · {session.room}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            {session.rescheduleCount > 0 && (
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
                Menunggu persetujuan
              </span>
            )}
            <button
              type="button"
              disabled={!allowed}
              onClick={() => openReschedule(session.id)}
              className="rounded-full border border-gray-300 px-4 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Ubah jadwal
            </button>
          </div>
        </div>
      </li>
    );
  };

  const renderReschedulePage = () => {
    if (!reschedule || !rescheduleSession) return null;

    const month = reschedule.month;
    const year = month.getFullYear();
    const monthIndex = month.getMonth();
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const firstDayOffset = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
    const today = startOfDay(new Date(now));
    const maxDate = new Date(today.getTime() + MAX_AHEAD_DAYS * 86_400_000);
    const previousMonth = new Date(year, monthIndex - 1, 1);
    const nextMonth = new Date(year, monthIndex + 1, 1);
    const canGoPrevious =
      previousMonth >= new Date(today.getFullYear(), today.getMonth(), 1);
    const canGoNext = nextMonth <= maxDate;
    const selectedSlots = reschedule.date
      ? slotsFor(rescheduleSession.counselor, reschedule.date)
      : [];

    const calendarCells = [
      ...Array.from({ length: firstDayOffset }, (_, index) => (
        <span key={`blank-${index}`} aria-hidden="true" />
      )),
      ...Array.from({ length: daysInMonth }, (_, index) => {
        const day = index + 1;
        const date = new Date(year, monthIndex, day);
        const isAvailable =
          date >= today &&
          date <= maxDate &&
          slotsFor(rescheduleSession.counselor, date).length > 0;
        const isSelected = reschedule.date
          ? sameDay(reschedule.date, date)
          : false;

        return (
          <button
            key={day}
            type="button"
            disabled={!isAvailable}
            onClick={() =>
              updateReschedule({ date, slotIndex: null, error: "" })
            }
            className={`flex h-10 items-center justify-center rounded-xl border text-sm font-semibold transition disabled:cursor-not-allowed ${
              isSelected
                ? "border-[#1e5b3a] bg-[#1e5b3a] text-white"
                : isAvailable
                  ? "border-[#1e5b3a]/30 bg-[#e8f9f0] text-[#1e5b3a] hover:border-[#1e5b3a]"
                  : "border-transparent text-gray-300"
            }`}
          >
            {day}
          </button>
        );
      }),
    ];

    return (
      <div className="space-y-6">
        <button
          type="button"
          onClick={backToActivity}
          className="inline-flex items-center gap-1 text-sm font-semibold text-[#1e5b3a] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke aktivitas
        </button>

        <section>
          <h1 className="font-display text-2xl font-extrabold text-gray-900 sm:text-3xl">
            Ubah jadwal sesi
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            {rescheduleSession.counselor} · jadwal semula{" "}
            {dayLabel(rescheduleSession.start, now)},{" "}
            {formatTime(rescheduleSession.start)} WITA
          </p>
        </section>

        <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
          <section className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-6">
            <p className="text-sm font-bold text-gray-900">
              1. Alasan <span className="text-red-600">*</span>
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {RESCHEDULE_REASONS.map((reason) => {
                const selected = reschedule.reason === reason;
                return (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => updateReschedule({ reason, error: "" })}
                    className={`rounded-xl border px-3 py-3 text-left text-sm transition ${
                      selected
                        ? "border-[#1e5b3a] bg-[#f7fcf9] font-semibold text-[#1e5b3a]"
                        : "border-gray-200 text-gray-700 hover:border-[#36c08f]"
                    }`}
                  >
                    {reason}
                  </button>
                );
              })}
            </div>

            <label
              htmlFor="reschedule-note"
              className="mt-6 block text-sm font-bold text-gray-900"
            >
              Catatan{" "}
              <span className="text-xs font-normal text-gray-400">
                (opsional)
              </span>
            </label>
            <textarea
              id="reschedule-note"
              rows={3}
              value={reschedule.note}
              onChange={(event) =>
                updateReschedule({ note: event.target.value })
              }
              className="mt-2 w-full rounded-xl border border-gray-300 p-3 text-sm outline-none transition focus:border-[#1e5b3a] focus:ring-4 focus:ring-[#1e5b3a]/15"
              placeholder="Tambahkan catatan jika diperlukan"
            />
          </section>

          <section className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-6">
            <p className="text-sm font-bold text-gray-900">
              2. Pilih tanggal <span className="text-red-600">*</span>
            </p>
            <p className="mt-0.5 text-xs text-gray-500">
              Tanggal berwarna hijau memiliki jadwal konselor. Minimal 24 jam
              dari sekarang.
            </p>

            <div className="mt-3 rounded-2xl border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  disabled={!canGoPrevious}
                  onClick={() =>
                    updateReschedule({
                      month: new Date(year, monthIndex - 1, 1),
                    })
                  }
                  aria-label="Bulan sebelumnya"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <p className="font-display text-sm font-bold capitalize text-gray-900">
                  {month.toLocaleDateString("id-ID", {
                    month: "long",
                    year: "numeric",
                  })}
                </p>
                <button
                  type="button"
                  disabled={!canGoNext}
                  onClick={() =>
                    updateReschedule({
                      month: new Date(year, monthIndex + 1, 1),
                    })
                  }
                  aria-label="Bulan berikutnya"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-gray-500">
                {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map(
                  (label) => (
                    <span key={label}>{label}</span>
                  ),
                )}
              </div>
              <div className="mt-1 grid grid-cols-7 gap-1">{calendarCells}</div>
            </div>

            <p className="mt-6 text-sm font-bold text-gray-900">
              3. Pilih jam <span className="text-red-600">*</span>
            </p>
            {!reschedule.date ? (
              <p className="mt-3 text-sm text-gray-500">
                Pilih tanggal terlebih dahulu.
              </p>
            ) : selectedSlots.length === 0 ? (
              <p className="mt-3 text-sm text-gray-500">
                Tidak ada jam tersedia pada tanggal ini.
              </p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedSlots.map((slot, index) => {
                  const selected = reschedule.slotIndex === index;
                  return (
                    <button
                      key={slot.label}
                      type="button"
                      onClick={() =>
                        updateReschedule({ slotIndex: index, error: "" })
                      }
                      className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                        selected
                          ? "border-[#1e5b3a] bg-[#1e5b3a] text-white"
                          : "border-[#1e5b3a] bg-white text-[#1e5b3a] hover:bg-[#e8f9f0]"
                      }`}
                    >
                      {slot.label.replace("-", "–")} WITA
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {reschedule.error && (
          <p role="alert" className="text-sm text-red-600">
            {reschedule.error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={backToActivity}
            className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={
              !(
                reschedule.reason &&
                reschedule.date &&
                reschedule.slotIndex !== null
              )
            }
            onClick={submitReschedule}
            className="rounded-xl bg-[#1e5b3a] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#174a2f] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Kirim pengajuan
          </button>
        </div>
      </div>
    );
  };

  const renderMainPage = () => (
    <div className="space-y-6">
      <section>
        <p className="text-sm text-gray-500">
          {new Date(now).toLocaleDateString("id-ID", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
        <h1 className="mt-1 font-display text-2xl font-extrabold text-gray-900 sm:text-3xl">
          Aktivitasmu
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-gray-600 sm:text-base">
          {summaryLine}
        </p>
      </section>

      {ongoing.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-lg font-bold text-gray-900">
            Sedang berlangsung
          </h2>
          <div className="space-y-4">{ongoing.map(renderLiveCard)}</div>
        </section>
      )}

      {pendingFeedback.length > 0 && (
        <section className="rounded-3xl border border-amber-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold text-gray-900">
                Menunggu penilaian
              </h2>
              <p className="mt-0.5 text-xs text-gray-500">
                Sesi sudah selesai. Bantu kami meningkatkan layanan dengan
                memberi penilaian.
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">
              {pendingFeedback.length}
            </span>
          </div>
          <div className="mt-4 space-y-3">
            {pendingFeedback.map(renderFeedbackItem)}
          </div>
        </section>
      )}

      <section>
        <div>
          <h2 className="font-display text-lg font-bold text-gray-900">
            Sesi mendatang
          </h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Sesi yang sedang berlangsung dan akan datang.
          </p>
        </div>

        <div className="mt-4 space-y-8">
          {upcoming[0] && renderNextSession(upcoming[0])}

          {timelineGroups.length > 0 && (
            <div className="space-y-8">
              {timelineGroups.map((group) => (
                <div key={group.date.toDateString()}>
                  <p className="mb-3 font-display text-sm font-bold uppercase tracking-wider text-[#1e5b3a]">
                    {dayLabel(group.date, now)}
                  </p>
                  <ol className="relative space-y-3 border-l-2 border-[#e8f9f0] pl-5">
                    {group.items.map(renderTimelineItem)}
                  </ol>
                </div>
              ))}
            </div>
          )}

          {upcoming.length === 0 && (
            <div className="mt-6 rounded-3xl border border-dashed border-gray-300 bg-white p-10 text-center">
              <p className="font-display text-lg font-semibold text-gray-800">
                Belum ada sesi yang akan datang
              </p>
              <p className="mt-2 text-sm text-gray-500">
                Kalau kamu ingin berbicara dengan seseorang, kami siap
                mendampingimu.
              </p>
              <Link
                to="/klien/pesanan"
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#1e5b3a] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#174a2f]"
              >
                <CalendarPlus className="h-4 w-4" />
                Buat janji baru
              </Link>
            </div>
          )}
        </div>
      </section>

      <p className="rounded-2xl bg-white p-5 text-center text-sm italic text-gray-500">
        “Langkah kecil yang kamu ambil hari ini tetap berarti.”
      </p>
    </div>
  );

  return (
    <>
      {view === "reschedule" ? renderReschedulePage() : renderMainPage()}

      {feedbackSession && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0c2619]/40 p-4"
          role="presentation"
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedback-title"
            className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between border-b border-gray-200 p-6 pb-4">
              <div>
                <h2
                  id="feedback-title"
                  className="text-lg font-bold text-gray-900"
                >
                  Bagaimana sesimu?
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  {feedbackSession.counselor} · {feedbackSession.service}
                </p>
              </div>
              <button
                type="button"
                onClick={closeFeedback}
                aria-label="Tutup penilaian"
                className="rounded-full p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-gray-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5 overflow-y-auto p-6">
              <div>
                <p className="text-sm font-semibold text-gray-800">
                  Penilaian <span className="text-red-600">*</span>
                </p>
                <div
                  className="mt-2 flex gap-2"
                  role="radiogroup"
                  aria-label="Penilaian sesi"
                >
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <button
                      key={rating}
                      type="button"
                      role="radio"
                      aria-checked={feedbackRating === rating}
                      aria-label={`${rating} bintang`}
                      onClick={() => setFeedbackRating(rating)}
                      className={`text-3xl leading-none transition ${
                        rating <= feedbackRating
                          ? "text-amber-400"
                          : "text-gray-300 hover:text-amber-300"
                      }`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label
                  htmlFor="feedback-note"
                  className="text-sm font-semibold text-gray-800"
                >
                  Komentar{" "}
                  <span className="text-xs font-normal text-gray-400">
                    (opsional)
                  </span>
                </label>
                <textarea
                  id="feedback-note"
                  rows={3}
                  value={feedbackNote}
                  onChange={(event) => setFeedbackNote(event.target.value)}
                  placeholder="Ceritakan apa yang membantumu, atau apa yang bisa kami perbaiki"
                  className="mt-1.5 w-full rounded-xl border border-gray-300 p-3 text-sm outline-none transition focus:border-[#1e5b3a] focus:ring-4 focus:ring-[#1e5b3a]/15"
                />
              </div>

              <p className="rounded-xl bg-[#f7fcf9] p-3 text-xs text-gray-600">
                Penilaianmu bersifat anonim dan hanya digunakan untuk
                meningkatkan layanan. Kamu hanya dapat mengirim satu kali untuk
                setiap sesi.
              </p>
            </div>

            <div className="flex justify-end gap-2 border-t border-gray-200 p-6 pt-4">
              <button
                type="button"
                onClick={closeFeedback}
                className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                Lewati
              </button>
              <button
                type="button"
                disabled={feedbackRating < 1}
                onClick={submitFeedback}
                className="rounded-xl bg-[#1e5b3a] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#174a2f] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Kirim penilaian
              </button>
            </div>
          </section>
        </div>
      )}

      {toast && (
        <div
          role="status"
          className="pointer-events-none fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-xl bg-gray-900 px-4 py-3 text-sm text-white shadow-lg"
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-[#8fe3bf]" />
            {toast}
          </span>
        </div>
      )}
    </>
  );
}
