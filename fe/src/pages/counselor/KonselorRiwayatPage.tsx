import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Info,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
  Video,
  X,
  XCircle,
} from "lucide-react";
import { PageContainer, PageHeader, AcademicPeriodFilter } from "../../components/shared";
import {
  formatAcademicPeriodLabel,
  formatBookingClientTitle,
  formatBookingRepresentative,
  formatIsoDateId,
  formatIsoShortDateId,
  formatIsoTimeRangeWita,
  formatSessionFormatLabel,
  getCounselorInitials,
  toLocalDateKey,
} from "../../features/counselor/shared/presentation";
import { ApiError } from "../../lib/api";
import {
  getPublicAcademicPeriods,
  type PublicAcademicPeriod,
} from "../../lib/publicApi";
import { sicareApi } from "../../lib/sicareApi";
import type { BookingRecordBaseDto, SessionListItemDto } from "../../types/api";

type PeriodFilter = "semua" | "hari" | "minggu" | "bulan" | "semester";
type StatusFilter = "Semua" | "Selesai" | "Dibatalkan";
type FormatFilter = "Semua" | "Tatap Muka" | "Online";
type TypeFilter = "Semua" | "Individu" | "Kelompok";

const DAY_MS = 86_400_000;

function parseDateOnly(isoDate: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function getDateRange(
  period: PeriodFilter,
  anchor: Date,
  semester: PublicAcademicPeriod | null,
): { start: Date; end: Date } | null {
  if (period === "semua") return null;
  const y = anchor.getFullYear();
  const m = anchor.getMonth();
  const d = anchor.getDate();

  if (period === "hari") {
    return { start: new Date(y, m, d), end: new Date(y, m, d + 1) };
  }
  if (period === "minggu") {
    return { start: new Date(y, m, d - 6), end: new Date(y, m, d + 1) };
  }
  if (period === "bulan") {
    return { start: new Date(y, m, 1), end: new Date(y, m + 1, 1) };
  }
  if (!semester) return null;
  return {
    start: parseDateOnly(semester.starts_on),
    end: new Date(parseDateOnly(semester.ends_on).getTime() + DAY_MS),
  };
}

function formatRangeLabel(
  period: PeriodFilter,
  range: { start: Date; end: Date } | null,
  semester: PublicAcademicPeriod | null,
): string {
  if (period === "semua") return "Semua Waktu";
  if (period === "semester") {
    return semester
      ? formatAcademicPeriodLabel(semester)
      : "Belum ada periode akademik";
  }
  if (!range) return "Semua Waktu";
  if (period === "hari") {
    return range.start.toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }
  if (period === "minggu") {
    const endInclusive = new Date(range.end.getTime() - DAY_MS);
    return `${range.start.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
    })} – ${endInclusive.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })}`;
  }
  return range.start.toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });
}

export default function KonselorRiwayatPage() {
  const [sessions, setSessions] = useState<SessionListItemDto[]>([]);
  const [bookings, setBookings] = useState<BookingRecordBaseDto[]>([]);
  const [periods, setPeriods] = useState<PublicAcademicPeriod[]>([]);

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("semua");
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("");

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("Semua");
  const [formatFilter, setFormatFilter] = useState<FormatFilter>("Semua");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("Semua");
  const [searchQuery, setSearchQuery] = useState("");

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null,
  );

  const fetchHistoryData = useCallback(async () => {
    const [sessionsRes, bookingsRes, periodsRes] = await Promise.all([
      sicareApi.sessions(100),
      sicareApi.bookings(100),
      getPublicAcademicPeriods().catch(() => [] as PublicAcademicPeriod[]),
    ]);

    return {
      sessions: sessionsRes,
      bookings: bookingsRes,
      periods: periodsRes,
    };
  }, []);

  useEffect(() => {
    let active = true;
    fetchHistoryData()
      .then((data) => {
        if (!active) return;
        setSessions(data.sessions);
        setBookings(data.bookings);
        setPeriods(data.periods);
        if (data.periods.length > 0) {
          const todayKey = toLocalDateKey(new Date());
          const current =
            data.periods.find(
              (p) => todayKey >= p.starts_on && todayKey <= p.ends_on,
            ) ?? data.periods[0];
          setSelectedPeriodId(current.id);
        }
        setErrorMessage(null);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setErrorMessage(
          err instanceof ApiError
            ? err.message
            : "Gagal memuat riwayat sesi konseling dari server.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [fetchHistoryData]);

  const handleManualRefresh = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const data = await fetchHistoryData();
      setSessions(data.sessions);
      setBookings(data.bookings);
      setPeriods(data.periods);
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof ApiError
          ? err.message
          : "Gagal memuat ulang riwayat sesi konseling.",
      );
    } finally {
      setLoading(false);
    }
  };

  const bookingMap = useMemo(() => {
    const map = new Map<string, BookingRecordBaseDto>();
    for (const b of bookings) {
      map.set(b.id, b);
    }
    return map;
  }, [bookings]);

  const activeSemester = useMemo(
    () =>
      periods.find((p) => p.id === selectedPeriodId) ?? periods[0] ?? null,
    [periods, selectedPeriodId],
  );

  const dateRange = useMemo(
    () => getDateRange(periodFilter, anchorDate, activeSemester),
    [activeSemester, anchorDate, periodFilter],
  );

  const historySessions = useMemo(
    () =>
      sessions.filter(
        (s) => s.status === "completed" || s.status === "cancelled",
      ),
    [sessions],
  );

  const filteredSessions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return historySessions
      .filter((session) => {
        if (statusFilter === "Selesai" && session.status !== "completed") {
          return false;
        }
        if (statusFilter === "Dibatalkan" && session.status !== "cancelled") {
          return false;
        }

        const fmtLabel = formatSessionFormatLabel(session.format);
        if (formatFilter !== "Semua" && fmtLabel !== formatFilter) {
          return false;
        }

        const booking = bookingMap.get(session.booking_id);
        const svcType =
          booking?.service_type === "group" ? "Kelompok" : "Individu";
        if (typeFilter !== "Semua" && svcType !== typeFilter) {
          return false;
        }

        if (dateRange) {
          const t = new Date(session.starts_at).getTime();
          if (t < dateRange.start.getTime() || t >= dateRange.end.getTime()) {
            return false;
          }
        }

        if (!q) return true;
        const title = formatBookingClientTitle(booking).toLowerCase();
        const clientId = (booking?.client_id ?? "").toLowerCase();
        const room = (session.room ?? "").toLowerCase();
        const reason = (booking?.cancellation_reason ?? "").toLowerCase();
        const participantMatch = (booking?.booking_participants ?? []).some(
          (p) => p.display_name.toLowerCase().includes(q),
        );

        return (
          session.id.toLowerCase().includes(q) ||
          session.booking_id.toLowerCase().includes(q) ||
          clientId.includes(q) ||
          title.includes(q) ||
          room.includes(q) ||
          reason.includes(q) ||
          participantMatch
        );
      })
      .sort(
        (a, b) =>
          new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime(),
      );
  }, [
    bookingMap,
    dateRange,
    formatFilter,
    historySessions,
    searchQuery,
    statusFilter,
    typeFilter,
  ]);

  const summaryCounts = useMemo(() => {
    const completedCount = filteredSessions.filter(
      (s) => s.status === "completed",
    ).length;
    const cancelledCount = filteredSessions.filter(
      (s) => s.status === "cancelled",
    ).length;
    const uniqueClients = new Set(
      filteredSessions.map(
        (s) => bookingMap.get(s.booking_id)?.client_id ?? s.booking_id,
      ),
    ).size;
    return {
      total: filteredSessions.length,
      completed: completedCount,
      cancelled: cancelledCount,
      uniqueClients,
    };
  }, [bookingMap, filteredSessions]);

  const selectedSession = useMemo(
    () => historySessions.find((s) => s.id === selectedSessionId) ?? null,
    [historySessions, selectedSessionId],
  );

  const shiftAnchor = (dir: -1 | 1) => {
    setAnchorDate((prev) => {
      const y = prev.getFullYear();
      const m = prev.getMonth();
      const d = prev.getDate();
      if (periodFilter === "hari") return new Date(y, m, d + dir);
      if (periodFilter === "minggu") return new Date(y, m, d + dir * 7);
      if (periodFilter === "bulan") return new Date(y, m + dir, 1);
      return prev;
    });
  };

  return (
    <PageContainer className="py-6 lg:py-8">
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <PageHeader
            title="Riwayat"
            description="Arsip sesi konseling yang telah selesai dan dibatalkan dari server"
          />
          <button
            type="button"
            onClick={() => void handleManualRefresh()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-xs transition hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Muat Ulang
          </button>
        </div>

        {/* Banner Informasi Keamanan & Batas Data Klinis */}
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 text-xs text-gray-700">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#064E3B]" />
          <div className="leading-relaxed">
            <p className="font-bold text-gray-900">
              Otorisasi Server Aktif · Batas Penyimpanan Catatan Klinis
            </p>
            <p className="mt-0.5">
              Seluruh riwayat sesi di halaman ini diverifikasi langsung oleh
              autentikasi server (`/api/v1/sessions` & `/api/v1/bookings`).
              Catatan konseling naratif dan dokumen Informed Consent PDF belum
              disimpan pada database backend sesuai batas SOP saat ini.
            </p>
          </div>
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="flex items-start justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            <div className="flex items-start gap-2.5">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              <div>
                <p className="font-semibold">Gagal Memuat Riwayat</p>
                <p className="mt-0.5">{errorMessage}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void handleManualRefresh()}
              className="shrink-0 rounded-xl border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
            >
              Coba Lagi
            </button>
          </div>
        )}

        {selectedSession ? (
          /* ========================= DETAIL RIWAYAT SESI ========================= */
          (() => {
            const booking = bookingMap.get(selectedSession.booking_id);
            const title = formatBookingClientTitle(booking);
            const isCompleted = selectedSession.status === "completed";

            return (
              <div className="space-y-5">
                <button
                  type="button"
                  onClick={() => setSelectedSessionId(null)}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-900"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Kembali ke daftar riwayat
                </button>

                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs">
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-100 pb-5">
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-base font-bold text-[#064E3B]">
                        {getCounselorInitials(title)}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-lg font-bold text-gray-900">
                            {title}
                          </h2>
                          <span
                            className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                              isCompleted
                                ? "border-teal-200 bg-teal-50 text-teal-800"
                                : "border-red-200 bg-red-50 text-red-700"
                            }`}
                          >
                            {isCompleted ? "Selesai" : "Dibatalkan"}
                          </span>
                          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-700">
                            {formatSessionFormatLabel(selectedSession.format)}
                          </span>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              booking?.service_type === "group"
                                ? "bg-purple-50 text-purple-700"
                                : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {booking?.service_type === "group"
                              ? `Kelompok (${booking.participant_count} orang)`
                              : "Individu"}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-gray-500">
                          ID Sesi:{" "}
                          <code className="font-mono">{selectedSession.id}</code>{" "}
                          · ID Booking:{" "}
                          <code className="font-mono">
                            {selectedSession.booking_id}
                          </code>
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-4">
                      <div className="flex items-center gap-2 text-xs font-semibold text-gray-500">
                        <Calendar className="h-4 w-4 text-[#064E3B]" />
                        Tanggal Sesi
                      </div>
                      <p className="mt-1.5 text-sm font-bold text-gray-900">
                        {formatIsoDateId(selectedSession.starts_at)}
                      </p>
                    </div>

                    <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-4">
                      <div className="flex items-center gap-2 text-xs font-semibold text-gray-500">
                        <Clock className="h-4 w-4 text-[#064E3B]" />
                        Rentang Waktu
                      </div>
                      <p className="mt-1.5 text-sm font-bold text-gray-900">
                        {formatIsoTimeRangeWita(
                          selectedSession.starts_at,
                          selectedSession.ends_at,
                        )}
                      </p>
                    </div>

                    <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-4">
                      <div className="flex items-center gap-2 text-xs font-semibold text-gray-500">
                        {selectedSession.format === "online" ? (
                          <Video className="h-4 w-4 text-[#064E3B]" />
                        ) : (
                          <MapPin className="h-4 w-4 text-[#064E3B]" />
                        )}
                        Format & Lokasi
                      </div>
                      <p className="mt-1.5 text-sm font-bold text-gray-900">
                        {formatSessionFormatLabel(selectedSession.format)}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {selectedSession.room || "Ruang Konseling LMI"}
                      </p>
                    </div>

                    <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-4">
                      <div className="flex items-center gap-2 text-xs font-semibold text-gray-500">
                        <Users className="h-4 w-4 text-[#064E3B]" />
                        Identitas Klien
                      </div>
                      <p className="mt-1.5 text-sm font-bold text-gray-900">
                        ID:{" "}
                        {booking?.client_id
                          ? `#${booking.client_id.slice(0, 8).toUpperCase()}`
                          : "—"}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {booking?.service_type === "group"
                          ? `Perwakilan: ${formatBookingRepresentative(booking) ?? "—"}`
                          : "Konseling Individu"}
                      </p>
                    </div>
                  </div>

                  {/* Timestamp Rekaman */}
                  <div className="mt-4 flex flex-wrap gap-4 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-xs text-gray-600">
                    {selectedSession.started_at && (
                      <span>
                        <strong className="text-gray-800">Dimulai:</strong>{" "}
                        {new Date(selectedSession.started_at).toLocaleString("id-ID")}
                      </span>
                    )}
                    {selectedSession.completed_at && (
                      <span>
                        <strong className="text-teal-800">Diselesaikan:</strong>{" "}
                        {new Date(selectedSession.completed_at).toLocaleString("id-ID")}
                      </span>
                    )}
                    {selectedSession.status === "cancelled" && (
                      <span>
                        <strong className="text-red-700">Diperbarui (Batal):</strong>{" "}
                        {new Date(selectedSession.updated_at).toLocaleString("id-ID")}
                      </span>
                    )}
                  </div>

                  {booking?.service_type === "group" && (
                    <div className="mt-5 rounded-xl border border-purple-100 bg-purple-50/40 p-4">
                      <h3 className="text-sm font-bold text-purple-950">
                        Daftar Anggota Kelompok ({booking.participant_count} Peserta)
                      </h3>
                      {(booking.booking_participants ?? []).length > 0 ? (
                        <ul className="mt-2.5 grid gap-2 sm:grid-cols-2">
                          {(booking.booking_participants ?? []).map((p, idx) => (
                            <li
                              key={p.id}
                              className="flex items-center justify-between rounded-lg border border-purple-100 bg-white px-3 py-2 text-sm"
                            >
                              <span className="font-medium text-gray-800">
                                {idx + 1}. {p.display_name}
                              </span>
                              {p.is_representative && (
                                <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[11px] font-semibold text-purple-800">
                                  Perwakilan
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-1 text-xs text-purple-800">
                          Kelompok {booking.group_name ?? "—"} ({booking.participant_count} peserta).
                        </p>
                      )}
                    </div>
                  )}

                  {booking?.cancellation_reason && (
                    <div className="mt-5 rounded-xl border border-red-200 bg-red-50/70 p-4 text-sm text-red-900">
                      <p className="font-bold">Alasan Pembatalan:</p>
                      <p className="mt-1">{booking.cancellation_reason}</p>
                    </div>
                  )}

                  <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <div className="flex items-start gap-3">
                      <Info className="mt-0.5 h-5 w-5 shrink-0 text-[#064E3B]" />
                      <div>
                        <h3 className="text-sm font-bold text-gray-900">
                          Catatan Klinis & Informed Consent Belum Disimpan di Database
                        </h3>
                        <p className="mt-1 text-xs leading-relaxed text-gray-600">
                          Saat ini tabel `sessions` di backend menyimpan metadata
                          pelaksanaan sesi terverifikasi (jadwal, format, ruangan, dan
                          waktu mulai/selesai/batal). Penyimpanan dokumen tanda tangan
                          Informed Consent dan catatan klinis konselor akan ditambahkan
                          setelah SOP retensi & enkripsi rekam konseling disahkan.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()
        ) : (
          /* ========================= DAFTAR RIWAYAT SESI ========================= */
          <>
            {/* Ringkasan Angka */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-xs">
                <p className="text-xs font-medium text-gray-500">
                  Total Sesi (Terfilter)
                </p>
                <p className="mt-1.5 text-2xl font-bold text-gray-900">
                  {loading ? "—" : summaryCounts.total}
                </p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-xs">
                <p className="text-xs font-medium text-teal-700">
                  Sesi Selesai (`completed`)
                </p>
                <p className="mt-1.5 text-2xl font-bold text-teal-800">
                  {loading ? "—" : summaryCounts.completed}
                </p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-xs">
                <p className="text-xs font-medium text-red-600">
                  Sesi Dibatalkan (`cancelled`)
                </p>
                <p className="mt-1.5 text-2xl font-bold text-red-700">
                  {loading ? "—" : summaryCounts.cancelled}
                </p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-xs">
                <p className="text-xs font-medium text-gray-500">
                  Klien Unik Dilayani
                </p>
                <p className="mt-1.5 text-2xl font-bold text-gray-900">
                  {loading ? "—" : summaryCounts.uniqueClients}
                </p>
              </div>
            </div>

            {/* Filter Periode & Pencarian */}
            <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3">
                <div className="inline-flex flex-wrap rounded-xl border border-gray-200 bg-gray-50 p-1">
                  {(
                    [
                      ["semua", "Semua Waktu"],
                      ["hari", "Hari"],
                      ["minggu", "Minggu"],
                      ["bulan", "Bulan"],
                      ["semester", "Semester"],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setPeriodFilter(key)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                        periodFilter === key
                          ? "bg-white text-[#064E3B] shadow-xs"
                          : "text-gray-600 hover:text-gray-900"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {periodFilter === "semester" ? (
                  <AcademicPeriodFilter
                    periods={periods}
                    selectedId={selectedPeriodId}
                    onSelect={setSelectedPeriodId}
                    showAllOption={false}
                    className="relative w-full sm:w-80"
                  />
                ) : periodFilter !== "semua" ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label="Periode sebelumnya"
                      onClick={() => shiftAnchor(-1)}
                      className="rounded-lg border border-gray-200 p-1.5 hover:bg-gray-50"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="min-w-[160px] text-center text-xs font-bold text-gray-800">
                      {formatRangeLabel(periodFilter, dateRange, activeSemester)}
                    </span>
                    <button
                      type="button"
                      aria-label="Periode berikutnya"
                      onClick={() => shiftAnchor(1)}
                      className="rounded-lg border border-gray-200 p-1.5 hover:bg-gray-50"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari ID sesi, klien, kelompok, ruangan, atau alasan batal..."
                    className="w-full rounded-xl border border-gray-200 py-2.5 pl-10 pr-9 text-sm outline-none focus:border-[#064E3B] focus:ring-2 focus:ring-[#064E3B]/15"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      aria-label="Hapus pencarian"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex rounded-xl border border-gray-200 bg-gray-50 p-1">
                    {(["Semua", "Selesai", "Dibatalkan"] as const).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setStatusFilter(st)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                          statusFilter === st
                            ? "bg-white text-[#064E3B] shadow-xs"
                            : "text-gray-600 hover:text-gray-900"
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>

                  <div className="inline-flex rounded-xl border border-gray-200 bg-gray-50 p-1">
                    {(["Semua", "Tatap Muka", "Online"] as const).map((fmt) => (
                      <button
                        key={fmt}
                        type="button"
                        onClick={() => setFormatFilter(fmt)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                          formatFilter === fmt
                            ? "bg-white text-[#064E3B] shadow-xs"
                            : "text-gray-600 hover:text-gray-900"
                        }`}
                      >
                        {fmt}
                      </button>
                    ))}
                  </div>

                  <div className="inline-flex rounded-xl border border-gray-200 bg-gray-50 p-1">
                    {(["Semua", "Individu", "Kelompok"] as const).map((tp) => (
                      <button
                        key={tp}
                        type="button"
                        onClick={() => setTypeFilter(tp)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                          typeFilter === tp
                            ? "bg-white text-[#064E3B] shadow-xs"
                            : "text-gray-600 hover:text-gray-900"
                        }`}
                      >
                        {tp}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white py-16 text-center shadow-xs">
                <Loader2 className="h-7 w-7 animate-spin text-[#064E3B]" />
                <p className="mt-3 text-sm font-medium text-gray-600">
                  Memuat riwayat sesi konseling dari server...
                </p>
              </div>
            ) : filteredSessions.length === 0 ? (
              <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center shadow-xs">
                <FileText className="mx-auto h-10 w-10 text-gray-300" />
                <p className="mt-3 text-base font-bold text-gray-900">
                  Tidak ada riwayat sesi pada filter ini
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  Sesi yang telah ditandai selesai (`completed`) atau dibatalkan
                  (`cancelled`) akan tercatat secara otomatis di sini.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredSessions.map((session) => {
                  const booking = bookingMap.get(session.booking_id);
                  const title = formatBookingClientTitle(booking);
                  const isCompleted = session.status === "completed";

                  return (
                    <div
                      key={session.id}
                      className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs transition hover:border-gray-300"
                    >
                      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                        <div className="flex items-start gap-4">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-sm font-bold text-[#064E3B]">
                            {getCounselorInitials(title)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-bold text-gray-900">{title}</p>
                              <span
                                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                                  isCompleted
                                    ? "border-teal-200 bg-teal-50 text-teal-800"
                                    : "border-red-200 bg-red-50 text-red-700"
                                }`}
                              >
                                {isCompleted ? (
                                  <CheckCircle2 className="h-3 w-3" />
                                ) : (
                                  <XCircle className="h-3 w-3" />
                                )}
                                {isCompleted ? "Selesai" : "Dibatalkan"}
                              </span>
                              <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-700">
                                {formatSessionFormatLabel(session.format)}
                              </span>
                              <span
                                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                  booking?.service_type === "group"
                                    ? "bg-purple-50 text-purple-700"
                                    : "bg-gray-100 text-gray-700"
                                }`}
                              >
                                {booking?.service_type === "group"
                                  ? `Kelompok · ${booking.participant_count} orang`
                                  : "Individu"}
                              </span>
                            </div>

                            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600">
                              <span className="inline-flex items-center gap-1.5 font-medium text-gray-800">
                                <Calendar className="h-3.5 w-3.5 text-[#064E3B]" />
                                {formatIsoDateId(session.starts_at)}
                              </span>
                              <span className="inline-flex items-center gap-1.5 font-medium text-gray-800">
                                <Clock className="h-3.5 w-3.5 text-[#064E3B]" />
                                {formatIsoTimeRangeWita(
                                  session.starts_at,
                                  session.ends_at,
                                )}
                              </span>
                              <span>
                                {session.room || "Ruang Konseling LMI"}
                              </span>
                              {session.completed_at && (
                                <span>
                                  Diselesaikan{" "}
                                  {formatIsoShortDateId(session.completed_at)}
                                </span>
                              )}
                            </div>

                            {booking?.cancellation_reason && (
                              <p className="mt-2 rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-700">
                                <span className="font-semibold">
                                  Alasan pembatalan:
                                </span>{" "}
                                {booking.cancellation_reason}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="lg:shrink-0">
                          <button
                            type="button"
                            onClick={() => setSelectedSessionId(session.id)}
                            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 sm:text-sm"
                          >
                            Lihat Detail Riwayat
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </PageContainer>
  );
}
