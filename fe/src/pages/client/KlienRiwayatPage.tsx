import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  RefreshCw,
  Search,
  Star,
  Users,
} from "lucide-react";
import {
  AcademicPeriodFilter,
  PageContainer,
  PageHeader,
} from "../../components/shared";
import {
  sicareApi,
  type BookingRecordApi,
  type FeedbackRecordApi,
  type SessionRecordApi,
} from "../../lib/sicareApi";
import {
  getPublicAcademicPeriods,
  type PublicAcademicPeriod,
} from "../../lib/publicApi";
import { ApiError } from "../../lib/api";
import type {
  BookingStatusApi,
  FeedbackModerationStatusApi,
  SessionStatusApi,
} from "../../types/api";

/* ========================= TIPE & LABEL ========================= */

type StatusFilter = "semua" | "menunggu" | "terjadwal" | "selesai" | "batal";
type NoteTab = "klien" | "tindak";
type ServiceType = BookingRecordApi["service_type"];

interface HistoryItem {
  booking: BookingRecordApi;
  session: SessionRecordApi | null;
}

const SERVICE_OPTIONS: [ServiceType, string][] = [
  ["individual", "Individu"],
  ["group", "Kelompok"],
];

const BOOKING_STATUS: Record<BookingStatusApi, { label: string; style: string }> = {
  waiting_confirmation: {
    label: "Menunggu konfirmasi",
    style: "bg-amber-50 text-amber-700",
  },
  confirmed: { label: "Dikonfirmasi", style: "bg-emerald-50 text-emerald-700" },
  rejected: { label: "Ditolak", style: "bg-red-50 text-red-700" },
  reschedule_requested: {
    label: "Jadwal ulang diminta",
    style: "bg-sky-50 text-sky-700",
  },
  cancelled: { label: "Dibatalkan", style: "bg-red-50 text-red-700" },
};

const SESSION_STATUS: Record<SessionStatusApi, { label: string; style: string }> = {
  scheduled: { label: "Sesi terjadwal", style: "bg-sky-50 text-sky-700" },
  ongoing: { label: "Sesi berlangsung", style: "bg-amber-50 text-amber-700" },
  completed: { label: "Sesi selesai", style: "bg-primary-soft text-primary" },
  cancelled: { label: "Sesi dibatalkan", style: "bg-red-50 text-red-700" },
};

const STATUS_FILTERS: [StatusFilter, string][] = [
  ["semua", "Semua"],
  ["menunggu", "Menunggu"],
  ["terjadwal", "Terjadwal"],
  ["selesai", "Selesai"],
  ["batal", "Batal/Ditolak"],
];

// Catatan konselor sengaja tidak ada: hanya konselor yang dapat membacanya.
const NOTE_TABS: { key: NoteTab; label: string; hint: string }[] = [
  {
    key: "klien",
    label: "Untuk klien",
    hint: "Catatan dari konselor untukmu",
  },
  {
    key: "tindak",
    label: "Tindak lanjut",
    hint: "Rencana untuk sesi berikutnya",
  },
];

const moderationLabels: Record<FeedbackModerationStatusApi, string> = {
  pending: "Menunggu moderasi Admin",
  shown: "Ditampilkan ke publik",
  disabled: "Dinonaktifkan oleh Admin",
};

const MAX_COMMENT_LENGTH = 5000;

/* ========================= HELPER ========================= */

const dateLabel = (value: string) =>
  new Date(value).toLocaleDateString("id-ID", { dateStyle: "full" });

const timeLabel = (value: string) =>
  new Date(value).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });

const dateTimeLabel = (value: string) =>
  new Date(value).toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });

function bookingCode(id: string): string {
  return `BKG-${id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

function historyTitle(booking: BookingRecordApi): string {
  if (booking.service_type === "group") {
    return booking.group_name?.trim() || "Konseling Kelompok";
  }
  return "Konseling Individu";
}

function statusGroup(item: HistoryItem): Exclude<StatusFilter, "semua"> {
  const { booking, session } = item;
  if (session?.status === "completed") return "selesai";
  if (
    session?.status === "cancelled" ||
    booking.status === "cancelled" ||
    booking.status === "rejected"
  ) {
    return "batal";
  }
  if (
    booking.status === "waiting_confirmation" ||
    booking.status === "reschedule_requested"
  ) {
    return "menunggu";
  }
  return "terjadwal";
}

function isInAcademicPeriod(iso: string, period: PublicAcademicPeriod) {
  const day = iso.slice(0, 10);
  return day >= period.starts_on && day <= period.ends_on;
}

function StatusPill({ label, style }: { label: string; style: string }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${style}`}>
      {label}
    </span>
  );
}

function DateBadge({ iso, className = "" }: { iso: string; className?: string }) {
  const date = new Date(iso);
  return (
    <div
      aria-hidden="true"
      className={`flex shrink-0 flex-col items-center justify-center rounded-2xl bg-primary-soft text-primary ${className}`}
    >
      <span className="text-lg font-bold leading-none">{date.getDate()}</span>
      <span className="mt-1 text-[10px] font-semibold uppercase tracking-wide">
        {date.toLocaleDateString("id-ID", { month: "short" })}
      </span>
    </div>
  );
}

function StatusPills({ item }: { item: HistoryItem }) {
  const booking = BOOKING_STATUS[item.booking.status];
  const session = item.session ? SESSION_STATUS[item.session.status] : null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {booking ? (
        <StatusPill {...booking} />
      ) : (
        <StatusPill label={item.booking.status} style="bg-slate-100 text-slate-700" />
      )}
      {session && <StatusPill {...session} />}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-gray-800">{value}</dd>
    </div>
  );
}

function HistoryListSkeleton() {
  return (
    <ul aria-hidden="true" className="mt-5 space-y-3">
      {Array.from({ length: 4 }, (_, index) => (
        <li
          key={index}
          className="flex animate-pulse items-center gap-4 rounded-2xl border border-gray-200 bg-white p-4 sm:p-5"
        >
          <div className="h-14 w-14 shrink-0 rounded-2xl bg-gray-200" />
          <div className="min-w-0 flex-1 space-y-2.5">
            <div className="flex justify-between gap-3">
              <div className="h-4 w-40 rounded bg-gray-200" />
              <div className="h-3 w-20 rounded bg-gray-100" />
            </div>
            <div className="h-3 w-56 max-w-full rounded bg-gray-100" />
            <div className="flex gap-2">
              <div className="h-6 w-28 rounded-full bg-gray-100" />
              <div className="h-6 w-24 rounded-full bg-gray-100" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ========================= HALAMAN ========================= */

export default function KlienRiwayatPage() {
  const [bookings, setBookings] = useState<BookingRecordApi[]>([]);
  const [sessions, setSessions] = useState<SessionRecordApi[]>([]);
  const [feedback, setFeedback] = useState<FeedbackRecordApi[]>([]);
  const [periods, setPeriods] = useState<PublicAcademicPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [query, setQuery] = useState("");
  const [serviceType, setServiceType] = useState<ServiceType>("individual");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("semua");
  const [periodId, setPeriodId] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [noteTab, setNoteTab] = useState<NoteTab>("klien");

  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedbackError, setFeedbackError] = useState("");

  const fetchHistory = useCallback(async () => {
    const [bookingRows, sessionRows, feedbackRows, periodRows] =
      await Promise.all([
        sicareApi.bookings(100),
        sicareApi.sessions(100),
        sicareApi.myFeedback(),
        getPublicAcademicPeriods().catch(() => [] as PublicAcademicPeriod[]),
      ]);
    return { bookingRows, sessionRows, feedbackRows, periodRows };
  }, []);

  const applyHistory = useCallback(
    (result: Awaited<ReturnType<typeof fetchHistory>>) => {
      setBookings(result.bookingRows);
      setSessions(result.sessionRows);
      setFeedback(result.feedbackRows);
      setPeriods(result.periodRows);
      setError("");
    },
    [],
  );

  const reportLoadError = useCallback((cause: unknown) => {
    setError(
      cause instanceof ApiError || cause instanceof Error
        ? cause.message
        : "Riwayat konseling tidak dapat dimuat.",
    );
  }, []);

  useEffect(() => {
    let active = true;
    void fetchHistory()
      .then((result) => {
        if (active) applyHistory(result);
      })
      .catch((cause: unknown) => {
        if (active) reportLoadError(cause);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fetchHistory, applyHistory, reportLoadError]);

  const refresh = () => {
    setLoading(true);
    setError("");
    void fetchHistory()
      .then(applyHistory)
      .catch(reportLoadError)
      .finally(() => setLoading(false));
  };

  // Satu item per booking; sesi dipasangkan lewat booking_id (ID kanonis backend).
  const items = useMemo<HistoryItem[]>(() => {
    const sessionByBooking = new Map<string, SessionRecordApi>();
    for (const session of sessions) {
      const current = sessionByBooking.get(session.booking_id);
      if (!current || current.updated_at < session.updated_at) {
        sessionByBooking.set(session.booking_id, session);
      }
    }
    return bookings
      .map((booking) => ({
        booking,
        session: sessionByBooking.get(booking.id) ?? null,
      }))
      .sort((a, b) => b.booking.starts_at.localeCompare(a.booking.starts_at));
  }, [bookings, sessions]);

  const selectedPeriod = periods.find((period) => period.id === periodId) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(
      (item) =>
        item.booking.service_type === serviceType &&
        (statusFilter === "semua" || statusGroup(item) === statusFilter) &&
        (!selectedPeriod ||
          isInAcademicPeriod(item.booking.starts_at, selectedPeriod)) &&
        (!q ||
          bookingCode(item.booking.id).toLowerCase().includes(q) ||
          historyTitle(item.booking).toLowerCase().includes(q)),
    );
  }, [items, serviceType, statusFilter, selectedPeriod, query]);

  const selected = items.find((item) => item.booking.id === selectedId) ?? null;
  const selectedFeedback = selected?.session
    ? feedback.find((row) => row.session_id === selected.session?.id)
    : undefined;

  const openDetail = (id: string) => {
    setSelectedId(id);
    setNoteTab("klien");
    setRating(5);
    setComment("");
    setFeedbackError("");
    window.scrollTo({ top: 0 });
  };

  const submitFeedback = async (session: SessionRecordApi) => {
    if (feedback.some((row) => row.session_id === session.id)) {
      setFeedbackError("Feedback untuk sesi ini sudah pernah dikirim.");
      return;
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      setFeedbackError("Rating harus bernilai antara 1 sampai 5.");
      return;
    }
    const commentText = comment.trim();
    if (commentText.length > MAX_COMMENT_LENGTH) {
      setFeedbackError(`Komentar maksimal ${MAX_COMMENT_LENGTH} karakter.`);
      return;
    }

    setBusy(true);
    setFeedbackError("");
    try {
      const saved = await sicareApi.submitFeedback(session.id, {
        rating,
        comment: commentText || null,
      });
      setFeedback((previous) => [
        saved,
        ...previous.filter(
          (row) => row.id !== saved.id && row.session_id !== saved.session_id,
        ),
      ]);
      setComment("");
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 409) {
        setFeedbackError(
          cause.message || "Feedback untuk sesi ini sudah pernah dikirim.",
        );
        void fetchHistory().then(applyHistory).catch(() => {});
      } else {
        setFeedbackError(
          cause instanceof ApiError || cause instanceof Error
            ? cause.message
            : "Feedback tidak dapat dikirim.",
        );
      }
    } finally {
      setBusy(false);
    }
  };

  /* ========================= DETAIL ========================= */
  if (selected) {
    const { booking, session } = selected;
    const activeTab = NOTE_TABS.find((tab) => tab.key === noteTab) ?? NOTE_TABS[0];
    const isGroup = booking.service_type === "group";
    const participants = booking.booking_participants ?? [];

    return (
      <PageContainer role="client" spacing="none">
        <nav
          aria-label="Breadcrumb"
          className="flex min-w-0 flex-wrap items-center gap-1.5 text-sm text-gray-500"
        >
          <button
            type="button"
            onClick={() => setSelectedId(null)}
            className="inline-flex shrink-0 items-center gap-1 font-semibold text-primary hover:underline"
          >
            <ChevronLeft className="h-4 w-4" />
            Riwayat Konseling
          </button>
          <span>/</span>
          <span className="truncate font-mono text-gray-700">
            {bookingCode(booking.id)}
          </span>
        </nav>

        {/* Ringkasan */}
        <div className="mt-5 flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-5 sm:flex-row sm:items-center sm:p-6">
          <DateBadge iso={booking.starts_at} className="h-16 w-16" />
          <div className="min-w-0 flex-1">
            <StatusPills item={selected} />
            <h2 className="mt-2 text-lg font-bold text-gray-900 sm:text-xl">
              {historyTitle(booking)}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {dateLabel(booking.starts_at)} · {timeLabel(booking.starts_at)}–
              {timeLabel(booking.ends_at)}
            </p>
          </div>
        </div>

        {/* Informasi booking & sesi */}
        <section className="mt-5 rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
          <h3 className="text-sm font-bold text-gray-900">Detail pesanan</h3>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <InfoRow label="Kode pesanan" value={bookingCode(booking.id)} />
            <InfoRow
              label="Layanan"
              value={
                isGroup
                  ? `Kelompok${booking.group_name ? ` · ${booking.group_name}` : ""}`
                  : "Individu"
              }
            />
            <InfoRow label="Dipesan pada" value={dateTimeLabel(booking.created_at)} />
            {session && (
              <>
                <InfoRow
                  label="Format sesi"
                  value={
                    session.format === "online"
                      ? "Daring"
                      : session.format === "offline"
                        ? "Tatap muka"
                        : "-"
                  }
                />
                <InfoRow
                  label="Ruang"
                  value={
                    session.room ??
                    (session.format === "offline" ? "Ruang Konseling LMI" : "-")
                  }
                />
                {session.completed_at && (
                  <InfoRow
                    label="Selesai pada"
                    value={dateTimeLabel(session.completed_at)}
                  />
                )}
              </>
            )}
          </dl>

          {(booking.cancellation_reason || booking.reschedule_reason) && (
            <div className="mt-4 space-y-2 border-t border-gray-100 pt-4">
              {booking.cancellation_reason && (
                <p className="text-sm text-gray-700">
                  <span className="font-semibold">Alasan pembatalan/penolakan:</span>{" "}
                  {booking.cancellation_reason}
                </p>
              )}
              {booking.reschedule_reason && (
                <p className="text-sm text-gray-700">
                  <span className="font-semibold">Alasan jadwal ulang:</span>{" "}
                  {booking.reschedule_reason}
                </p>
              )}
            </div>
          )}

          {isGroup && participants.length > 0 && (
            <div className="mt-4 border-t border-gray-100 pt-4">
              <p className="text-xs font-medium text-gray-500">
                Peserta ({participants.length})
              </p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {participants.map((participant) => (
                  <li
                    key={participant.id}
                    className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700"
                  >
                    {participant.display_name}
                    {participant.is_representative && " · Perwakilan"}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {session?.status === "completed" && (
          <>
            {/* Catatan: dua tab, catatan konselor tidak ditampilkan ke klien */}
            <section className="mt-5 overflow-hidden rounded-2xl border border-gray-200 bg-white">
              <div
                role="tablist"
                aria-label="Jenis catatan"
                className="no-scrollbar flex overflow-x-auto border-b border-gray-200"
              >
                {NOTE_TABS.map((tab) => {
                  const active = tab.key === noteTab;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setNoteTab(tab.key)}
                      className={`-mb-px shrink-0 border-b-2 px-4 py-3 text-sm transition sm:px-6 ${
                        active
                          ? "border-primary font-semibold text-primary"
                          : "border-transparent font-medium text-gray-500 hover:text-gray-800"
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
              <div role="tabpanel" className="p-4 sm:p-6">
                <p className="mb-3 text-xs text-gray-500">{activeTab.hint}</p>
                {/* Belum ada endpoint/tabel catatan sesi; jangan tampilkan data palsu. */}
                <p className="text-sm italic text-gray-400">
                  Catatan belum tersedia.
                </p>
              </div>
            </section>

            {/* Feedback */}
            <section className="mt-5 space-y-3 rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
              <h3 className="text-sm font-bold text-gray-900">Feedback sesi</h3>
              {selectedFeedback ? (
                <div className="rounded-xl bg-primary-soft p-3">
                  <p className="text-sm font-semibold text-primary">
                    Feedback sudah dikirim · {selectedFeedback.rating}/5
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    {selectedFeedback.comment || "Tanpa komentar."}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Status publik:{" "}
                    {moderationLabels[selectedFeedback.moderation_status] ??
                      selectedFeedback.moderation_status}
                  </p>
                </div>
              ) : (
                <>
                  {feedbackError && (
                    <p
                      role="alert"
                      className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                    >
                      {feedbackError}
                    </p>
                  )}
                  <label className="block text-xs font-semibold text-slate-600">
                    Rating
                    <select
                      value={rating}
                      onChange={(event) => setRating(Number(event.target.value))}
                      className="mt-1 block rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    >
                      {[5, 4, 3, 2, 1].map((value) => (
                        <option key={value} value={value}>
                          {value} / 5
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs font-semibold text-slate-600">
                    Komentar (opsional)
                    <textarea
                      value={comment}
                      onChange={(event) => setComment(event.target.value)}
                      maxLength={MAX_COMMENT_LENGTH}
                      rows={3}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                      placeholder="Tuliskan pengalamanmu secara sopan."
                    />
                  </label>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void submitFeedback(session)}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    <Star className="h-4 w-4" />
                    {busy ? "Mengirim..." : "Kirim feedback"}
                  </button>
                  <p className="text-xs text-slate-500">
                    Feedback dikirim dengan status pending dan hanya ditampilkan ke
                    publik setelah disetujui Admin.
                  </p>
                </>
              )}
            </section>
          </>
        )}
      </PageContainer>
    );
  }

  /* ========================= DAFTAR ========================= */
  return (
    <PageContainer role="client" spacing="none">
      <PageHeader
        title="Riwayat Konseling"
        description="Riwayat konseling yang telah kamu ikuti beserta statusnya."
        actions={
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className="h-4 w-4" /> Muat ulang
          </button>
        }
      />

      {/* Filter */}
      <div className="mt-6 space-y-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cari kode pesanan atau nama kelompok ..."
              className="w-full rounded-xl border border-gray-200 bg-gray-100/70 py-3 pl-12 pr-4 text-sm text-gray-800 outline-none placeholder:text-gray-500 focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/15"
            />
          </div>
          <div
            role="tablist"
            aria-label="Jenis layanan"
            className="flex w-full rounded-xl border border-gray-200 bg-gray-100/70 p-1 lg:w-auto"
          >
            {SERVICE_OPTIONS.map(([key, label]) => {
              const active = serviceType === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setServiceType(key)}
                  className={`flex-1 whitespace-nowrap rounded-lg px-4 py-2 text-sm transition lg:flex-none ${
                    active
                      ? "bg-white font-semibold text-gray-900 shadow-sm"
                      : "font-medium text-gray-500"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <AcademicPeriodFilter
            periods={periods}
            selectedId={periodId}
            onSelect={setPeriodId}
            className="relative w-full lg:w-80"
          />
        </div>
        <div
          role="tablist"
          aria-label="Status riwayat"
          className="no-scrollbar flex gap-1 overflow-x-auto rounded-xl border border-gray-200 bg-gray-100/70 p-1"
        >
          {STATUS_FILTERS.map(([key, label]) => {
            const active = statusFilter === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setStatusFilter(key)}
                className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold transition sm:flex-1 sm:text-sm ${
                  active
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      {loading && (
        <>
          <p role="status" className="sr-only">
            Memuat riwayat...
          </p>
          <HistoryListSkeleton />
        </>
      )}

      {!loading && filtered.length > 0 && (
        <ul className="mt-5 space-y-3">
          {filtered.map((item) => (
            <li key={item.booking.id}>
              <button
                type="button"
                onClick={() => openDetail(item.booking.id)}
                className="flex w-full items-center gap-4 rounded-2xl border border-gray-200 bg-white p-4 text-left transition hover:border-primary/40 hover:shadow-sm sm:p-5"
              >
                <DateBadge iso={item.booking.starts_at} className="h-14 w-14" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="truncate font-bold text-gray-900">
                      {historyTitle(item.booking)}
                    </h2>
                    <span className="font-mono text-xs text-gray-400">
                      {bookingCode(item.booking.id)}
                    </span>
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-600">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-4 w-4 text-gray-400" />
                      {dateLabel(item.booking.starts_at)} ·{" "}
                      {timeLabel(item.booking.starts_at)}–
                      {timeLabel(item.booking.ends_at)}
                    </span>
                    {item.booking.service_type === "group" && (
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-4 w-4 text-gray-400" />
                        {item.booking.participant_count} peserta
                      </span>
                    )}
                  </p>
                  <div className="mt-2">
                    <StatusPills item={item} />
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-gray-400" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {!loading && filtered.length === 0 && (
        <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="font-semibold text-slate-700">
            {items.length === 0
              ? "Belum ada riwayat konseling."
              : "Tidak ada riwayat yang cocok dengan filter."}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {items.length === 0
              ? "Pesanan konseling akan muncul di sini setelah kamu membuat booking."
              : "Coba ubah jenis layanan, status, periode, atau kata kunci pencarian."}
          </p>
        </div>
      )}
    </PageContainer>
  );
}
