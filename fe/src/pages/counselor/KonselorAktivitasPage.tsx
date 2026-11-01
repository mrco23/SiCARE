import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Info,
  Loader2,
  MapPin,
  Play,
  RefreshCw,
  Search,
  Users,
  Video,
  X,
  XCircle,
} from "lucide-react";
import { PageContainer, PageHeader } from "../../components/shared";
import {
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
import { sicareApi } from "../../lib/sicareApi";
import { GroupConsentModal } from "../../components/consent/GroupConsentModal";
import type {
  BookingRecordBaseDto,
  SessionListItemDto,
  SessionStatusApi,
} from "../../types/api";

type ActivityTab = "active" | "today" | "upcoming" | "finished";
type FormatFilter = "Semua" | "Tatap Muka" | "Online";
type TypeFilter = "Semua" | "Individu" | "Kelompok";

function getSessionStatusBadge(status: SessionStatusApi) {
  switch (status) {
    case "ongoing":
      return {
        label: "Sedang Berlangsung",
        className: "border-emerald-300 bg-[#064E3B] text-white",
      };
    case "scheduled":
      return {
        label: "Terjadwal",
        className: "border-emerald-200 bg-emerald-50 text-[#064E3B]",
      };
    case "completed":
      return {
        label: "Selesai",
        className: "border-teal-200 bg-teal-50 text-teal-800",
      };
    case "cancelled":
      return {
        label: "Dibatalkan",
        className: "border-red-200 bg-red-50 text-red-700",
      };
    default:
      return {
        label: status,
        className: "border-gray-200 bg-gray-100 text-gray-700",
      };
  }
}

export default function KonselorAktivitasPage() {
  const navigate = useNavigate();

  const [sessions, setSessions] = useState<SessionListItemDto[]>([]);
  const [bookings, setBookings] = useState<BookingRecordBaseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<ActivityTab>("active");
  const [formatFilter, setFormatFilter] = useState<FormatFilter>("Semua");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("Semua");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const [transitionDialog, setTransitionDialog] = useState<{
    session: SessionListItemDto;
    targetStatus: "ongoing" | "completed" | "cancelled";
  } | null>(null);
  const [transitionSubmitting, setTransitionSubmitting] = useState(false);
  const [transitionError, setTransitionError] = useState<string | null>(null);
  const [consentModalBookingId, setConsentModalBookingId] = useState<string | null>(null);

  const [toast, setToast] = useState<{
    type: "success" | "cancel";
    message: string;
  } | null>(null);

  const fetchActivityData = useCallback(async () => {
    const [sessionsRes, bookingsRes] = await Promise.all([
      sicareApi.sessions(100),
      sicareApi.bookings(100),
    ]);
    return {
      sessions: sessionsRes,
      bookings: bookingsRes,
    };
  }, []);

  useEffect(() => {
    let active = true;
    fetchActivityData()
      .then((data) => {
        if (!active) return;
        setSessions(data.sessions);
        setBookings(data.bookings);
        setErrorMessage(null);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setErrorMessage(
          err instanceof ApiError
            ? err.message
            : "Gagal memuat daftar aktivitas sesi konseling dari server.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [fetchActivityData]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const handleManualRefresh = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const data = await fetchActivityData();
      setSessions(data.sessions);
      setBookings(data.bookings);
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof ApiError
          ? err.message
          : "Gagal memuat ulang daftar aktivitas sesi konseling.",
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

  const todayKey = useMemo(() => toLocalDateKey(new Date()), []);

  const tabCounts = useMemo(() => {
    return {
      active: sessions.filter(
        (s) => s.status === "ongoing" || s.status === "scheduled",
      ).length,
      today: sessions.filter(
        (s) =>
          (s.status === "ongoing" || s.status === "scheduled") &&
          toLocalDateKey(s.starts_at) === todayKey,
      ).length,
      upcoming: sessions.filter(
        (s) =>
          s.status === "scheduled" && toLocalDateKey(s.starts_at) > todayKey,
      ).length,
      finished: sessions.filter(
        (s) => s.status === "completed" || s.status === "cancelled",
      ).length,
    };
  }, [sessions, todayKey]);

  const filteredSessions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return sessions
      .filter((session) => {
        const dateKey = toLocalDateKey(session.starts_at);
        if (
          activeTab === "active" &&
          session.status !== "ongoing" &&
          session.status !== "scheduled"
        ) {
          return false;
        }
        if (
          activeTab === "today" &&
          ((session.status !== "ongoing" && session.status !== "scheduled") ||
            dateKey !== todayKey)
        ) {
          return false;
        }
        if (
          activeTab === "upcoming" &&
          (session.status !== "scheduled" || dateKey <= todayKey)
        ) {
          return false;
        }
        if (
          activeTab === "finished" &&
          session.status !== "completed" &&
          session.status !== "cancelled"
        ) {
          return false;
        }

        const booking = bookingMap.get(session.booking_id);
        const fmtLabel = formatSessionFormatLabel(session.format);
        if (formatFilter !== "Semua" && fmtLabel !== formatFilter) {
          return false;
        }

        const svcType =
          booking?.service_type === "group" ? "Kelompok" : "Individu";
        if (typeFilter !== "Semua" && svcType !== typeFilter) {
          return false;
        }

        if (!q) return true;
        const title = formatBookingClientTitle(booking).toLowerCase();
        const clientId = (booking?.client_id ?? "").toLowerCase();
        const room = (session.room ?? "").toLowerCase();
        const participantMatch = (booking?.booking_participants ?? []).some((p) =>
          p.display_name.toLowerCase().includes(q),
        );
        return (
          session.id.toLowerCase().includes(q) ||
          session.booking_id.toLowerCase().includes(q) ||
          clientId.includes(q) ||
          title.includes(q) ||
          room.includes(q) ||
          participantMatch
        );
      })
      .sort((a, b) => {
        if (a.status === "ongoing" && b.status !== "ongoing") return -1;
        if (b.status === "ongoing" && a.status !== "ongoing") return 1;
        const timeA = new Date(a.starts_at).getTime();
        const timeB = new Date(b.starts_at).getTime();
        return activeTab === "finished" ? timeB - timeA : timeA - timeB;
      });
  }, [activeTab, bookingMap, formatFilter, searchQuery, sessions, todayKey, typeFilter]);

  const selectedSession = useMemo(
    () => sessions.find((s) => s.id === selectedSessionId) ?? null,
    [selectedSessionId, sessions],
  );

  const handleOpenDetail = async (sessionId: string) => {
    setSelectedSessionId(sessionId);
    try {
      const detail = await sicareApi.session(sessionId);
      setSessions((prev) =>
        prev.map((item) => (item.id === sessionId ? detail : item)),
      );
    } catch {
      // Keep list projection if individual fetch fails
    }
  };

  const handleConfirmTransition = async () => {
    if (!transitionDialog || transitionSubmitting) return;
    setTransitionSubmitting(true);
    setTransitionError(null);

    try {
      const { session, targetStatus } = transitionDialog;
      const result = await sicareApi.transitionSession(session.id, {
        status: targetStatus,
      });

      const booking = bookingMap.get(session.booking_id);
      const clientTitle = formatBookingClientTitle(booking, result.booking?.client_id);

      setSessions((prev) =>
        prev.map((item) => (item.id === result.id ? result : item)),
      );
      if (result.booking) {
        setBookings((prev) =>
          prev.map((item) =>
            item.id === result.booking.id
              ? {
                  ...item,
                  status: result.booking.status,
                }
              : item,
          ),
        );
      }

      setTransitionDialog(null);

      if (targetStatus === "ongoing") {
        setToast({
          type: "success",
          message: `Sesi dengan ${clientTitle} telah dimulai.`,
        });
        setSelectedSessionId(result.id);
      } else if (targetStatus === "completed") {
        setToast({
          type: "success",
          message: `Sesi dengan ${clientTitle} telah diselesaikan.`,
        });
      } else {
        setToast({
          type: "cancel",
          message: `Sesi dengan ${clientTitle} telah dibatalkan dan slot jadwal dibuka kembali.`,
        });
      }

      const fresh = await fetchActivityData();
      setSessions(fresh.sessions);
      setBookings(fresh.bookings);
    } catch (err: unknown) {
      setTransitionError(
        err instanceof ApiError
          ? err.message
          : "Gagal memperbarui status sesi konseling.",
      );
    } finally {
      setTransitionSubmitting(false);
    }
  };

  return (
    <PageContainer className="py-6 lg:py-8">
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <PageHeader
            title="Aktivitas"
            description="Kelola jalannya sesi konseling yang terjadwal dan sedang berlangsung"
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

        {toast && (
          <div
            role="status"
            className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm font-medium ${
              toast.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-[#064E3B]"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            <div className="flex items-center gap-2.5">
              {toast.type === "success" ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 shrink-0" />
              )}
              <span>{toast.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setToast(null)}
              aria-label="Tutup notifikasi"
              className="rounded-lg p-1 hover:bg-black/5"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {errorMessage && (
          <div
            role="alert"
            className="flex items-start justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            <div className="flex items-start gap-2.5">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              <div>
                <p className="font-semibold">Gagal Memuat Aktivitas Sesi</p>
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
          /* ========================= DETAIL SESI KONSELING ========================= */
          (() => {
            const booking = bookingMap.get(selectedSession.booking_id);
            const title = formatBookingClientTitle(booking);
            const badge = getSessionStatusBadge(selectedSession.status);

            return (
              <div className="space-y-5">
                <button
                  type="button"
                  onClick={() => setSelectedSessionId(null)}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-900"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Kembali ke daftar sesi
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
                            className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${badge.className}`}
                          >
                            {badge.label}
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

                    <div className="flex flex-wrap items-center gap-2">
                      {selectedSession.status === "scheduled" && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setTransitionError(null);
                              setTransitionDialog({
                                session: selectedSession,
                                targetStatus: "cancelled",
                              });
                            }}
                            className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                          >
                            Batalkan Sesi
                          </button>
                          <button
                            type="button"
                            onClick={() => setConsentModalBookingId(selectedSession.booking_id)}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
                          >
                            <FileText className="h-4 w-4 text-emerald-800" />
                            <span>Persetujuan</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setTransitionError(null);
                              setTransitionDialog({
                                session: selectedSession,
                                targetStatus: "ongoing",
                              });
                            }}
                            className="inline-flex items-center gap-2 rounded-xl bg-[#064E3B] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#053e2f]"
                          >
                            <Play className="h-4 w-4" />
                            Mulai Sesi
                          </button>
                        </>
                      )}

                      {selectedSession.status === "ongoing" && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setTransitionError(null);
                              setTransitionDialog({
                                session: selectedSession,
                                targetStatus: "cancelled",
                              });
                            }}
                            className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                          >
                            Batalkan Sesi
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setTransitionError(null);
                              setTransitionDialog({
                                session: selectedSession,
                                targetStatus: "completed",
                              });
                            }}
                            className="inline-flex items-center gap-2 rounded-xl bg-[#064E3B] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#053e2f]"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            Selesaikan Sesi
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Metadata Sesi */}
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
                        Waktu Terjadwal
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
                        Format & Lokasi Ruang
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
                        Informasi Peserta
                      </div>
                      <p className="mt-1.5 text-sm font-bold text-gray-900">
                        ID Klien:{" "}
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

                  {/* Timestamp Pelaksanaan Sesi */}
                  {(selectedSession.started_at ||
                    selectedSession.completed_at ||
                    selectedSession.status === "cancelled") && (
                    <div className="mt-4 flex flex-wrap gap-4 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-xs text-gray-600">
                      {selectedSession.started_at && (
                        <span>
                          <strong className="text-gray-800">Dimulai:</strong>{" "}
                          {new Date(selectedSession.started_at).toLocaleString("id-ID")}
                        </span>
                      )}
                      {selectedSession.completed_at && (
                        <span>
                          <strong className="text-gray-800">Diselesaikan:</strong>{" "}
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
                  )}

                  {/* Daftar Peserta Kelompok */}
                  {booking?.service_type === "group" && (
                    <div className="mt-5 rounded-xl border border-purple-100 bg-purple-50/40 p-4">
                      <h3 className="text-sm font-bold text-purple-950">
                        Anggota Kelompok ({booking.participant_count} Peserta)
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
                      <p className="font-bold">Keterangan Pembatalan:</p>
                      <p className="mt-1">{booking.cancellation_reason}</p>
                    </div>
                  )}

                  {/* Informasi Batas Kontrak Catatan Klinis & Intake */}
                  <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <div className="flex items-start gap-3">
                      <Info className="mt-0.5 h-5 w-5 shrink-0 text-[#064E3B]" />
                      <div>
                        <h3 className="text-sm font-bold text-gray-900">
                          Catatan Konseling Klinis & Formulir Intake Belum Tersedia di Server
                        </h3>
                        <p className="mt-1 text-xs leading-relaxed text-gray-600">
                          Penyimpanan catatan konseling klinis (Catatan Rahasia Konselor, Catatan
                          untuk Klien, dan Rencana Tindak Lanjut) serta jawaban kuesioner intake
                          belum diaktifkan pada tabel database `/api/v1/sessions` sambil menunggu
                          pengesahan SOP retensi dan enkripsi data klinis. Anda dapat memulai dan
                          menyelesaikan status sesi secara langsung menggunakan tombol di atas.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()
        ) : (
          /* ========================= DAFTAR SESI AKTIVITAS ========================= */
          <>
            {/* Tab Kategori Sesi */}
            <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-3">
              {(
                [
                  ["active", "Aktif (Berlangsung & Terjadwal)", tabCounts.active],
                  ["today", "Hari Ini", tabCounts.today],
                  ["upcoming", "Mendatang", tabCounts.upcoming],
                  ["finished", "Selesai / Batal", tabCounts.finished],
                ] as const
              ).map(([key, label, count]) => {
                const active = activeTab === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveTab(key)}
                    className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition sm:text-sm ${
                      active
                        ? "bg-[#064E3B] text-white shadow-xs"
                        : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    <span>{label}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        active ? "bg-white/20 text-white" : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Filter Bar */}
            <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-xs lg:flex-row lg:items-center lg:justify-between">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Cari ID sesi, klien, kelompok, atau ruangan..."
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
                  {(["Semua", "Tatap Muka", "Online"] as const).map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setFormatFilter(item)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                        formatFilter === item
                          ? "bg-white text-[#064E3B] shadow-xs"
                          : "text-gray-600 hover:text-gray-900"
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>

                <div className="inline-flex rounded-xl border border-gray-200 bg-gray-50 p-1">
                  {(["Semua", "Individu", "Kelompok"] as const).map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setTypeFilter(item)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                        typeFilter === item
                          ? "bg-white text-[#064E3B] shadow-xs"
                          : "text-gray-600 hover:text-gray-900"
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white py-16 text-center shadow-xs">
                <Loader2 className="h-7 w-7 animate-spin text-[#064E3B]" />
                <p className="mt-3 text-sm font-medium text-gray-600">
                  Memuat daftar sesi konseling dari server...
                </p>
              </div>
            ) : filteredSessions.length === 0 ? (
              <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center shadow-xs">
                <FileText className="mx-auto h-10 w-10 text-gray-300" />
                <p className="mt-3 text-base font-bold text-gray-900">
                  Tidak ada sesi pada kategori ini
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  Sesi baru akan muncul secara otomatis setelah Anda menyetujui permintaan booking
                  klien.
                </p>
                <button
                  type="button"
                  onClick={() => navigate("/konselor/permintaan")}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#064E3B] px-4 py-2 text-xs font-semibold text-white hover:bg-[#053e2f]"
                >
                  Ke Halaman Permintaan
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredSessions.map((session) => {
                  const booking = bookingMap.get(session.booking_id);
                  const title = formatBookingClientTitle(booking);
                  const badge = getSessionStatusBadge(session.status);
                  const isOngoing = session.status === "ongoing";

                  return (
                    <div
                      key={session.id}
                      className={`rounded-2xl border bg-white p-5 shadow-xs transition ${
                        isOngoing
                          ? "border-[#064E3B] ring-2 ring-[#064E3B]/10"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
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
                                className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${badge.className}`}
                              >
                                {badge.label}
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
                              <span className="inline-flex items-center gap-1">
                                {session.format === "online" ? (
                                  <Video className="h-3.5 w-3.5 text-gray-400" />
                                ) : (
                                  <MapPin className="h-3.5 w-3.5 text-gray-400" />
                                )}
                                {session.room || "Ruang Konseling LMI"}
                              </span>
                              {session.completed_at && (
                                <span>
                                  Selesai{" "}
                                  {formatIsoShortDateId(session.completed_at)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 lg:shrink-0">
                          <button
                            type="button"
                            onClick={() => void handleOpenDetail(session.id)}
                            className="rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 sm:text-sm"
                          >
                            Detail Sesi
                          </button>

                          {session.status === "scheduled" && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setTransitionError(null);
                                  setTransitionDialog({
                                    session,
                                    targetStatus: "cancelled",
                                  });
                                }}
                                className="rounded-xl border border-red-200 bg-white px-3.5 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 sm:text-sm"
                              >
                                Batalkan
                              </button>
                              <button
                                type="button"
                                onClick={() => setConsentModalBookingId(session.booking_id)}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition sm:text-sm"
                              >
                                <FileText className="h-3.5 w-3.5 text-emerald-800" />
                                <span>Persetujuan</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setTransitionError(null);
                                  setTransitionDialog({
                                    session,
                                    targetStatus: "ongoing",
                                  });
                                }}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-[#064E3B] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#053e2f] sm:text-sm"
                              >
                                <Play className="h-3.5 w-3.5" />
                                Mulai Sesi
                              </button>
                            </>
                          )}

                          {session.status === "ongoing" && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setTransitionError(null);
                                  setTransitionDialog({
                                    session,
                                    targetStatus: "cancelled",
                                  });
                                }}
                                className="rounded-xl border border-red-200 bg-white px-3.5 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 sm:text-sm"
                              >
                                Batalkan
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setTransitionError(null);
                                  setTransitionDialog({
                                    session,
                                    targetStatus: "completed",
                                  });
                                }}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-[#064E3B] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#053e2f] sm:text-sm"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Selesaikan Sesi
                              </button>
                            </>
                          )}
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

      {/* Modal Konfirmasi Transisi Status Sesi */}
      {transitionDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0c2619]/45 p-4 backdrop-blur-[2px]"
          onClick={(event) => {
            if (event.target === event.currentTarget && !transitionSubmitting) {
              setTransitionDialog(null);
            }
          }}
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-bold text-gray-900">
                {transitionDialog.targetStatus === "ongoing"
                  ? "Mulai Sesi Konseling?"
                  : transitionDialog.targetStatus === "completed"
                    ? "Selesaikan Sesi Konseling?"
                    : "Batalkan Sesi Konseling?"}
              </h2>
              <button
                type="button"
                disabled={transitionSubmitting}
                onClick={() => setTransitionDialog(null)}
                aria-label="Tutup"
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mt-2 text-sm text-gray-600">
              {transitionDialog.targetStatus === "ongoing"
                ? `Status sesi dengan ${formatBookingClientTitle(
                    bookingMap.get(transitionDialog.session.booking_id),
                  )} akan diubah menjadi sedang berlangsung dan klien menerima notifikasi.`
                : transitionDialog.targetStatus === "completed"
                  ? "Status sesi dan booking akan ditandai selesai (completed). Klien akan menerima notifikasi bahwa sesi telah selesai dan dapat memberikan ulasan."
                  : "Sesi dan booking terkait akan dibatalkan dengan keterangan sistem 'Sesi dibatalkan oleh konselor', serta slot ketersediaan Anda akan dibuka kembali."}
            </p>

            {transitionError && (
              <div
                role="alert"
                className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 space-y-2"
              >
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                  <span>{transitionError}</span>
                </div>
                {(transitionError.toLowerCase().includes("consent") ||
                  transitionError.toLowerCase().includes("persetujuan") ||
                  transitionError.includes("CONSENT_READINESS_INCOMPLETE")) && (
                  <button
                    type="button"
                    onClick={() => {
                      const bId = transitionDialog.session.booking_id;
                      setTransitionDialog(null);
                      setConsentModalBookingId(bId);
                    }}
                    className="inline-flex items-center gap-1 font-semibold text-emerald-800 underline hover:text-emerald-950"
                  >
                    Buka Rincian Status Persetujuan Peserta
                  </button>
                )}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                disabled={transitionSubmitting}
                onClick={() => setTransitionDialog(null)}
                className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Kembali
              </button>
              <button
                type="button"
                disabled={transitionSubmitting}
                onClick={() => void handleConfirmTransition()}
                className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition disabled:opacity-50 ${
                  transitionDialog.targetStatus === "cancelled"
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-[#064E3B] hover:bg-[#053e2f]"
                }`}
              >
                {transitionSubmitting && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                {transitionDialog.targetStatus === "ongoing"
                  ? "Ya, Mulai Sesi"
                  : transitionDialog.targetStatus === "completed"
                    ? "Ya, Selesaikan Sesi"
                    : "Ya, Batalkan Sesi"}
              </button>
            </div>
          </div>
        </div>
      )}

      {consentModalBookingId && (
        <GroupConsentModal
          bookingId={consentModalBookingId}
          isOpen={Boolean(consentModalBookingId)}
          onClose={() => setConsentModalBookingId(null)}
        />
      )}
    </PageContainer>
  );
}
