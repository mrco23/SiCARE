import { PageHeader } from "../../components/shared";
import {
  CLIENT_BOOKING_STATUS,
  SESSION_OUTCOME_STATUS,
  type ClientHistoryBookingStatus,
  type SessionOutcomeStatus,
} from "../../constants/status";
import type { CounselingFormat, IntakeAnswer } from "../../types/counseling";
import { formatIndonesianDate, parseLocalISODate as parseISO } from "../../lib/dateUtils";
import { useEffect, useMemo, useState } from "react";
import {
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
import { CLIENT_HISTORY_COUNSELORS as COUNSELORS, type ClientCounselorKey as CounselorKey } from "../../data/mock/clientCounselors";
import { SEMESTERS, SESSIONS, BOOKINGS, ESSAY_POOL, type Session } from "../../data/mock/clientHistory";
import { INTAKE_TOPICS as TOPICS, INTAKE_YESNO_OPTIONS as YESNO, INTAKE_ESSAY_OPTIONS as ESSAYS } from "../../data/mock/intakeOptions";

const CONSENT_PDF_URL = "/informed-consent.pdf";

type ViewKind = "hub" | "booking" | "konseling";
type Period = "hari" | "minggu" | "bulan" | "semester";
type FormatFilter = "all" | CounselingFormat;

type HistoryItem = {
  kind: "booking" | "konseling";
  id: string | number;
  counselor: CounselorKey;
  format: CounselingFormat;
  date: string;
  time: string;
  title: string;
  status: ClientHistoryBookingStatus | SessionOutcomeStatus;
  requestedAt?: string;
  note: Session | null;
};

type Intake = {
  selfHarm: IntakeAnswer;
  distress: IntakeAnswer;
  abuse: IntakeAnswer;
  substance: IntakeAnswer;
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

const BOOK_STATUS: Record<
  ClientHistoryBookingStatus,
  { label: string; badge: string; iconWrap: string; icon: LucideIcon }
> = {
  [CLIENT_BOOKING_STATUS.PENDING]: {
    label: "Menunggu Konfirmasi",
    badge: "bg-amber-50 text-amber-700",
    iconWrap: "bg-amber-50 text-amber-600",
    icon: Clock3,
  },
  [CLIENT_BOOKING_STATUS.SCHEDULED]: {
    label: "Terjadwal",
    badge: "bg-primary-soft text-primary",
    iconWrap: "bg-primary-soft text-primary",
    icon: CalendarCheck,
  },
  [CLIENT_BOOKING_STATUS.REJECTED]: {
    label: "Ditolak",
    badge: "bg-red-50 text-red-700",
    iconWrap: "bg-red-50 text-red-600",
    icon: XCircle,
  },
};

const FORMAT_STYLE: Record<CounselingFormat, { icon: LucideIcon; tone: string }> =
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
    status: SESSION_OUTCOME_STATUS.COMPLETED,
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

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function fmtDate(iso: string) {
  return formatIndonesianDate(parseISO(iso), {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function fmtShort(date: Date) {
  return formatIndonesianDate(date, { day: "numeric", month: "short" });
}

function fmtShortISO(iso: string) {
  return formatIndonesianDate(parseISO(iso), {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function intakeFor(id: number): Intake {
  const pick = <T,>(items: T[], index: number) => items[index % items.length];
  return {
    selfHarm: "Tidak",
    distress: pick<IntakeAnswer>(["Tidak", "Mungkin", "Tidak", "Ya"], id),
    abuse: pick<IntakeAnswer>(["Tidak", "Mungkin", "Tidak"], id + 1),
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

const ANSWER_STYLE: Record<IntakeAnswer, string> = {
  Ya: "bg-red-100 text-red-800",
  Mungkin: "bg-amber-100 text-amber-800",
  Tidak: "bg-primary-soft text-primary",
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

  const items = useMemo(
    () =>
      view === "booking"
        ? BOOKING_ITEMS
        : view === "konseling"
          ? SESSION_ITEMS
          : [],
    [view],
  );

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

  // Jika konselor yang dipilih tidak ada di baseItems periode ini, fallback ke "all"
  // tanpa mengubah state (menghindari cascading render).
  const effectiveCounselor: "all" | CounselorKey =
    counselor !== "all" &&
    !baseItems.some((item) => item.counselor === counselor)
      ? "all"
      : counselor;

  const visibleItems = useMemo(
    () =>
      effectiveCounselor === "all"
        ? baseItems
        : baseItems.filter((item) => item.counselor === effectiveCounselor),
    [baseItems, effectiveCounselor],
  );

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
    (booking) => booking.status === CLIENT_BOOKING_STATUS.PENDING,
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
          <PageHeader
            title="Riwayat"
            description="Pilih riwayat yang ingin kamu lihat."
          />

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
              <p className="mt-4 text-sm font-semibold text-primary">
                {BOOKINGS.length} booking
                {pendingBookings
                  ? ` · ${pendingBookings} menunggu konfirmasi`
                  : ""}
              </p>
              <span className="mt-auto inline-flex items-center gap-1 pt-5 text-sm font-semibold text-primary">
                Lihat booking{" "}
                <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </span>
            </button>

            <button
              type="button"
              onClick={() => openList("konseling")}
              className="group flex flex-col rounded-2xl border border-gray-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#36c08f] hover:shadow-md"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <MessageSquare className="h-6 w-6" strokeWidth={1.8} />
              </span>
              <p className="mt-5 font-display text-xl font-bold text-gray-900">
                Riwayat Konseling
              </p>
              <p className="mt-1 text-sm text-gray-600">
                Lihat sesi yang sudah kamu jalani dan catatan dari konselormu.
              </p>
              <p className="mt-4 text-sm font-semibold text-primary">
                {SESSIONS.length} sesi · {notesCount} catatan dari konselor
              </p>
              <span className="mt-auto inline-flex items-center gap-1 pt-5 text-sm font-semibold text-primary">
                Lihat konseling{" "}
                <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </span>
            </button>
          </div>
        </section>
      ) : (
        <section>
          <PageHeader
            backAction={{
              label: "Kembali ke riwayat",
              onClick: backToHub,
            }}
            title={listMeta.title}
            description={listMeta.desc}
            className="mt-3"
          />

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
                      ? "bg-white text-primary shadow-sm"
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
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 outline-none focus:border-primary"
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
                        ? "bg-white text-primary shadow-sm"
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
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-primary sm:w-72"
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
                ? BOOK_STATUS[item.status as ClientHistoryBookingStatus].icon
                : CheckCircle2;
              const statusWrap = isBooking
                ? BOOK_STATUS[item.status as ClientHistoryBookingStatus].iconWrap
                : "bg-primary-soft text-primary";
              const statusBadge = isBooking
                ? BOOK_STATUS[item.status as ClientHistoryBookingStatus].badge
                : "";
              const statusLabel = isBooking
                ? BOOK_STATUS[item.status as ClientHistoryBookingStatus].label
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
                        {item.status === CLIENT_BOOKING_STATUS.PENDING
                          ? ". Menunggu konfirmasi dari konselor."
                          : "."}
                      </p>
                    ) : (
                      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
                        <button
                          type="button"
                          onClick={() => setDetailSessionId(Number(item.id))}
                          className="inline-flex items-center gap-1.5 rounded-full border border-primary px-4 py-1.5 text-xs font-semibold text-primary hover:bg-primary-soft"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Lihat detail
                        </button>
                        <button
                          type="button"
                          onClick={() => setConsentSessionId(Number(item.id))}
                          className="inline-flex items-center gap-1.5 rounded-full border border-primary px-4 py-1.5 text-xs font-semibold text-primary hover:bg-primary-soft"
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
                className="rounded-full border border-primary bg-white px-5 py-2 text-sm font-semibold text-primary transition hover:bg-primary-soft"
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
                  className={`flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-gray-50 ${counselor === "all" ? "bg-primary-tint" : ""}`}
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
                    <Check className="h-5 w-5 shrink-0 text-primary" />
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
                      className={`flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-gray-50 ${counselor === key ? "bg-primary-tint" : ""}`}
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
                        <Check className="h-5 w-5 shrink-0 text-primary" />
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
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark"
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
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
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
            <p className="text-xs font-bold uppercase tracking-wider text-primary">
              1 · Catatan dari konselor untukmu
            </p>
            <div className="mt-3 rounded-2xl border border-[#36c08f]/40 bg-primary-tint p-5">
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
                                ? "bg-primary text-white"
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
