import Badge from "../../components/shared/Badge";
import IconLabel from "../../components/shared/IconLabel";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CalendarClock,
  CheckCircle2,
  Clock,
  FileText,
  Info,
  Loader2,
  MapPin,
  MoreHorizontal,
  Play,
  Search,
  SlidersHorizontal,
  Users,
  X,
  XCircle,
} from "lucide-react";
import {
  PageContainer,
  PageHeader,
  SkeletonList,
  useToast,
} from "../../components/shared";
import {
  formatBookingClientTitle,
  formatBookingRepresentative,
  formatIsoDateId,
  formatIsoShortDateId,
  formatIsoTimeRangeWita,
  getCounselorInitials,
  toLocalDateKey,
} from "../../features/counselor/shared/presentation";
import { ApiError } from "../../lib/api";
import { formatWitaTime } from "../../lib/witaTime";
import { sicareApi } from "../../lib/sicareApi";
import { consentApi } from "../../lib/consentApi";
import { GroupConsentModal } from "../../components/consent/GroupConsentModal";
import { BookingDecisionModal } from "../../components/counselor/BookingDecisionModal";
import { ClientIntakeView } from "../../components/counselor/ClientIntakeView";
import { hasUrgentIntake, URGENT_INTAKE_LABEL, urgentIntakeMessage } from "../../lib/intakeRisk";
import type {
  BookingConsentReadinessDto,
  BookingRecordBaseDto,
  SessionListItemDto,
  SessionStatusApi,
} from "../../types/api";
import {
  AUTO_COMPLETED_NOTE,
  MISSED_SESSION_LABEL,
  missedReasonText,
  sessionStartTimeBlockReason,
} from "../../lib/sessionStatus";

/**
 * Why a session may not be started yet, read from previously-fetched consent readiness.
 * Returns null when consent is complete or readiness has not loaded (fail-open: an
 * unknown state never blocks the button, it only loses the proactive warning).
 */
function consentBlockReason(
  bookingId: string,
  readinessByBooking: Record<string, BookingConsentReadinessDto>,
): string | null {
  const readiness = readinessByBooking[bookingId];
  if (!readiness || readiness.is_fully_consented) return null;
  return readiness.pending_participants > 0
    ? `Menunggu ${readiness.pending_participants} peserta menandatangani informed consent.`
    : "Menunggu peserta menandatangani informed consent.";
}

type ActivityTab = "active" | "today" | "upcoming" | "finished";
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
    case "missed":
      return {
        label: MISSED_SESSION_LABEL,
        className: "border-slate-200 bg-slate-100 text-slate-700",
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
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("Semua");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  // Layar kecil: waktu data terakhir dimuat, lembar filter jenis, dan lembar aksi kartu.
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [typeSheetOpen, setTypeSheetOpen] = useState(false);
  const [actionSheetSessionId, setActionSheetSessionId] = useState<string | null>(null);
  // "Minta Jadwal Ulang" untuk sesi terjadwal: booking tidak dibatalkan, klien memilih jam pengganti.
  const [rescheduleBooking, setRescheduleBooking] = useState<BookingRecordBaseDto | null>(null);

  const [transitionDialog, setTransitionDialog] = useState<{
    session: SessionListItemDto;
    targetStatus: "ongoing" | "completed" | "cancelled";
  } | null>(null);
  const [transitionSubmitting, setTransitionSubmitting] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  // Catatan wajib diisi sebelum menyelesaikan sesi (disimpan bersama penyelesaian sesi).
  const [completionNotes, setCompletionNotes] = useState({ counselor: "", client: "", followUp: "" });
  const [transitionError, setTransitionError] = useState<string | null>(null);
  const [consentModalBookingId, setConsentModalBookingId] = useState<string | null>(null);
  const [consentReadiness, setConsentReadiness] = useState<
    Record<string, BookingConsentReadinessDto>
  >({});
  // Jam berjalan untuk jendela "Mulai Sesi" (15 menit sebelum jadwal sampai jadwal selesai).
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  /** Alasan tombol "Mulai Sesi" dinonaktifkan: waktu dulu, lalu consent. */
  const startBlockReason = (session: SessionListItemDto): string | null =>
    sessionStartTimeBlockReason(session.starts_at, session.ends_at, now) ??
    consentBlockReason(session.booking_id, consentReadiness);

  const toast = useToast();

  // Proactively check consent readiness for scheduled sessions so "Mulai Sesi" can be
  // disabled before the counselor clicks it, instead of only failing after the fact.
  // Fetch failures are swallowed: an unknown readiness never blocks the button (fail-open).
  useEffect(() => {
    const scheduledBookingIds = Array.from(
      new Set(
        sessions
          .filter((s) => s.status === "scheduled")
          .map((s) => s.booking_id),
      ),
    );
    if (scheduledBookingIds.length === 0) return;

    let active = true;
    void Promise.all(
      scheduledBookingIds.map(async (bookingId) => {
        try {
          const readiness = await consentApi.getBookingConsentReadiness(bookingId);
          return [bookingId, readiness] as const;
        } catch {
          return null;
        }
      }),
    ).then((results) => {
      if (!active) return;
      setConsentReadiness((prev) => {
        const next = { ...prev };
        for (const result of results) {
          if (result) next[result[0]] = result[1];
        }
        return next;
      });
    });

    return () => {
      active = false;
    };
  }, [sessions]);

  const fetchActivityData = useCallback(async () => {
    const [sessionsRes, bookingsRes] = await Promise.all([
      sicareApi.allSessions(),
      sicareApi.allBookings(),
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
        setLastSyncedAt(Date.now());
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

  const handleManualRefresh = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const data = await fetchActivityData();
      setSessions(data.sessions);
      setBookings(data.bookings);
      setLastSyncedAt(Date.now());
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

  // Ikut berganti setelah tengah malam (jam `now` diperbarui tiap 30 detik).
  const todayKey = useMemo(() => toLocalDateKey(new Date(now)), [now]);
  const tomorrowKey = useMemo(() => {
    const d = new Date(now);
    return toLocalDateKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1));
  }, [now]);
  /** Judul grup hari pada daftar layar kecil: "Hari ini · …", "Besok · …", atau tanggal. */
  const mobileDayLabel = (iso: string, dayKey: string) => {
    const date = formatIsoDateId(iso);
    if (dayKey === todayKey) return `Hari ini · ${date}`;
    if (dayKey === tomorrowKey) return `Besok · ${date}`;
    return date;
  };
  const actionSheetSession = actionSheetSessionId
    ? sessions.find((s) => s.id === actionSheetSessionId) ?? null
    : null;

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
        (s) => s.status === "completed" || s.status === "cancelled" || s.status === "missed",
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
          session.status !== "cancelled" &&
          session.status !== "missed"
        ) {
          return false;
        }

        const booking = bookingMap.get(session.booking_id);
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
  }, [activeTab, bookingMap, searchQuery, sessions, todayKey, typeFilter]);

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
      const reason = cancelReason.trim();
      if (targetStatus === "cancelled" && reason.length < 3) {
        setTransitionError("Tuliskan alasan pembatalan (minimal 3 karakter) agar klien mengetahuinya.");
        return;
      }
      const counselorNote = completionNotes.counselor.trim();
      const clientNote = completionNotes.client.trim();
      const followUp = completionNotes.followUp.trim();
      if (targetStatus === "completed" && (!counselorNote || !clientNote)) {
        setTransitionError("Isi catatan konselor dan catatan untuk klien sebelum menyelesaikan sesi.");
        return;
      }
      const result = await sicareApi.transitionSession(session.id, {
        status: targetStatus,
        ...(targetStatus === "cancelled" ? { reason } : {}),
        ...(targetStatus === "completed"
          ? { counselor_note: counselorNote, client_note: clientNote, ...(followUp ? { follow_up: followUp } : {}) }
          : {}),
      });
      setCancelReason("");
      if (targetStatus === "completed") setCompletionNotes({ counselor: "", client: "", followUp: "" });

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
        toast.success(`Sesi dengan ${clientTitle} telah dimulai.`);
        setSelectedSessionId(result.id);
      } else if (targetStatus === "completed") {
        toast.success(`Sesi dengan ${clientTitle} telah diselesaikan.`);
      } else {
        toast.info(`Sesi dengan ${clientTitle} telah dibatalkan dan ketersediaan jadwal dibuka kembali.`);
      }

      const fresh = await fetchActivityData();
      setSessions(fresh.sessions);
      setBookings(fresh.bookings);
      setLastSyncedAt(Date.now());
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
    <PageContainer>
      <div className="space-y-4 sm:space-y-6">
        {/* Layar kecil: judul lebih kecil dan deskripsi diganti waktu pembaruan agar daftar sesi naik. */}
        <PageHeader
          title="Aktivitas"
          titleClassName="max-sm:text-xl"
          descriptionClassName="max-sm:mt-0 max-sm:text-[11px] max-sm:text-gray-500"
          description={
            <>
              <span className="hidden sm:inline">
                Kelola jalannya sesi konseling yang terjadwal dan sedang berlangsung
              </span>
              <span className="sm:hidden">
                {lastSyncedAt
                  ? `Diperbarui pukul ${formatWitaTime(new Date(lastSyncedAt))} WITA`
                  : "Sesi terjadwal dan sedang berlangsung"}
              </span>
            </>
          }
          refresh={{ onClick: () => void handleManualRefresh(), loading }}
        />


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
                          <Badge size="md" weight="semibold" bordered className={`gap-1.5 ${badge.className}`}>
                            {selectedSession.status === "ongoing" && (
                              <span className="relative flex h-2 w-2 shrink-0">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />
                                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-300" />
                              </span>
                            )}
                            {badge.label}
                          </Badge>
                          <Badge size="md" weight="semibold" className={booking?.service_type === "group" ? "bg-purple-50 text-purple-700" : "bg-gray-100 text-gray-700"}>
                            {booking?.service_type === "group"
                              ? `Kelompok (${booking.participant_count} orang)`
                              : "Individu"}
                          </Badge>
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
                          {/* Jadwal ulang adalah aksi utama bila konselor berhalangan (2026-11-28). */}
                          {bookingMap.get(selectedSession.booking_id) && (
                            <button
                              type="button"
                              onClick={() => setRescheduleBooking(bookingMap.get(selectedSession.booking_id) ?? null)}
                              className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 transition hover:bg-amber-100"
                            >
                              <IconLabel icon={CalendarClock}>Jadwal Ulang</IconLabel>
                            </button>
                          )}
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
                            disabled={Boolean(
                              startBlockReason(selectedSession),
                            )}
                            title={
                              startBlockReason(selectedSession) ??
                              undefined
                            }
                            onClick={() => {
                              setTransitionError(null);
                              setTransitionDialog({
                                session: selectedSession,
                                targetStatus: "ongoing",
                              });
                            }}
                            className="inline-flex items-center gap-2 rounded-xl bg-[#064E3B] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#053e2f] disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 disabled:hover:bg-gray-300"
                          >
                            <Play className="h-4 w-4" />
                            Mulai Sesi
                          </button>
                        </>
                      )}
                      {selectedSession.status === "scheduled" &&
                        startBlockReason(selectedSession) && (
                          <p className="mt-1 w-full text-xs font-medium text-amber-700">
                            {startBlockReason(selectedSession)}
                          </p>
                        )}
                      {selectedSession.status === "scheduled" && (
                        <button
                          type="button"
                          onClick={() => {
                            setTransitionError(null);
                            setTransitionDialog({
                              session: selectedSession,
                              targetStatus: "cancelled",
                            });
                          }}
                          className="w-full text-left text-xs font-semibold text-red-600 underline-offset-2 hover:underline sm:w-auto"
                        >
                          Batalkan tanpa jadwal ulang
                        </button>
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
                            <IconLabel icon={XCircle}>Hentikan Sesi</IconLabel>
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
                        <MapPin className="h-4 w-4 text-[#064E3B]" />
                        Lokasi Ruangan
                      </div>
                      <p className="mt-1.5 text-sm font-bold text-gray-900">
                        {selectedSession.room?.trim() || "Ruang Konseling LMI"}
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
                    selectedSession.status === "cancelled" ||
                    selectedSession.status === "missed") && (
                    <div className="mt-4 flex flex-wrap gap-4 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-xs text-gray-600">
                      {selectedSession.started_at && (
                        <span>
                          <strong className="text-gray-800">Dimulai:</strong>{" "}
                          {new Date(selectedSession.started_at).toLocaleString("id-ID", { timeZone: "Asia/Makassar" })}
                        </span>
                      )}
                      {selectedSession.completed_at && (
                        <span>
                          <strong className="text-gray-800">Diselesaikan:</strong>{" "}
                          {new Date(selectedSession.completed_at).toLocaleString("id-ID", { timeZone: "Asia/Makassar" })}
                        </span>
                      )}
                      {selectedSession.status === "cancelled" && (
                        <span>
                          <strong className="text-red-700">Diperbarui (Batal):</strong>{" "}
                          {new Date(selectedSession.updated_at).toLocaleString("id-ID", { timeZone: "Asia/Makassar" })}
                        </span>
                      )}
                      {selectedSession.status === "missed" && (
                        <span>
                          <strong className="text-slate-800">{MISSED_SESSION_LABEL}:</strong>{" "}
                          {missedReasonText(selectedSession.missed_reason)}
                        </span>
                      )}
                      {selectedSession.status === "completed" && selectedSession.auto_completed_at && (
                        <span>
                          <strong className="text-amber-700">Ditutup otomatis:</strong>{" "}
                          {AUTO_COMPLETED_NOTE}
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
                                <Badge weight="semibold" className="bg-purple-100 text-purple-800">
                                  Perwakilan
                                </Badge>
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

                  {/* Formulir Klien */}
                  <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <div className="flex items-start gap-3">
                      <Info className="mt-0.5 h-5 w-5 shrink-0 text-[#064E3B]" />
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-bold text-gray-900">
                          Formulir Klien
                        </h3>
                        {booking?.intake_answers === undefined ? (
                          <p className="mt-1 text-xs leading-relaxed text-gray-600">
                            Jawaban formulir klien belum dapat ditampilkan di halaman ini.
                          </p>
                        ) : (
                          <>
                            <p className="mt-1 text-xs leading-relaxed text-gray-600">
                              Diisi klien saat mengajukan permintaan ini. Jaga kerahasiaan isi formulir ini.
                            </p>
                            <div className="mt-3">
                              {hasUrgentIntake(booking.intake_answers) && (
                        <div role="alert" className="mb-3 flex items-start gap-2 rounded-xl border border-red-300 bg-red-50 p-3 text-xs leading-relaxed text-red-800">
                          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                          <span>
                            <strong>{URGENT_INTAKE_LABEL}.</strong> {urgentIntakeMessage(booking.intake_answers)}
                          </span>
                        </div>
                              )}
                              <ClientIntakeView
                                intake={booking.intake_answers}
                                emptyText="Klien tidak mengisi formulir saat mengajukan permintaan ini."
                              />
                            </div>
                          </>
                        )}
                        <p className="mt-4 border-t border-gray-200 pt-3 text-xs leading-relaxed text-gray-500">
                          Catatan konseling (catatan konselor, catatan untuk klien, dan rencana
                          tindak lanjut) ditambahkan dari halaman Riwayat Konseling setelah sesi
                          ini selesai.
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
            {/* Layar kecil: tab + cari menempel di bawah navbar saat daftar digulir. */}
            <div className="sticky top-[72px] z-10 -mx-4 space-y-2 border-b border-gray-200 bg-white/95 px-4 pb-2 pt-2 backdrop-blur sm:static sm:mx-0 sm:space-y-6 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
            {/* Tab Kategori Sesi */}
            <div
              role="tablist"
              aria-label="Kategori sesi"
              className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:gap-2 sm:overflow-visible sm:border-b sm:border-gray-200 sm:px-0 sm:pb-3"
            >
              {(
                [
                  ["active", "Aktif (Berlangsung & Terjadwal)", "Aktif", tabCounts.active],
                  ["today", "Hari Ini", "Hari Ini", tabCounts.today],
                  ["upcoming", "Mendatang", "Mendatang", tabCounts.upcoming],
                  ["finished", "Selesai / Batal", "Selesai / Batal", tabCounts.finished],
                ] as const
              ).map(([key, label, shortLabel, count]) => {
                const active = activeTab === key;
                return (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setActiveTab(key)}
                    className={`inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-xs font-semibold transition sm:h-auto sm:gap-2 sm:rounded-xl sm:py-2 sm:text-sm ${
                      active
                        ? "bg-[#064E3B] text-white shadow-xs"
                        : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    <span className="sm:hidden">{shortLabel}</span>
                    <span className="hidden sm:inline">{label}</span>
                    <Badge className={active ? "bg-white/20 text-white" : "bg-gray-100 text-gray-700"}>
                      {count}
                    </Badge>
                  </button>
                );
              })}
            </div>

            {/* Filter Bar */}
            <div className="flex items-center gap-2 sm:flex-col sm:items-stretch sm:gap-3 sm:rounded-2xl sm:border sm:border-gray-200 sm:bg-white sm:p-4 sm:shadow-xs lg:flex-row lg:items-center lg:justify-between">
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

              {/* Layar kecil: jenis dipilih lewat lembar bawah agar bar tetap satu baris. */}
              <button
                type="button"
                onClick={() => setTypeSheetOpen(true)}
                aria-haspopup="dialog"
                className="relative inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 sm:hidden"
              >
                <SlidersHorizontal className="h-4 w-4" />
                {typeFilter === "Semua" ? "Jenis" : typeFilter}
                {typeFilter !== "Semua" && (
                  <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-[#064E3B] ring-2 ring-white" />
                )}
              </button>

              <div className="hidden flex-wrap items-center gap-2 sm:flex">
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

            {activeTab === "active" && (
              <p className="text-[11px] text-gray-500 sm:hidden">
                Aktif = sesi yang sedang berlangsung dan terjadwal.
              </p>
            )}
            </div>

            {loading ? (
              <SkeletonList rows={5} label="Memuat daftar sesi konseling dari server..." />
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
              <div className="space-y-2 sm:space-y-3">
                {filteredSessions.map((session, index) => {
                  const booking = bookingMap.get(session.booking_id);
                  const title = formatBookingClientTitle(booking);
                  const badge = getSessionStatusBadge(session.status);
                  const isOngoing = session.status === "ongoing";
                  const isScheduled = session.status === "scheduled";
                  const blockReason = isScheduled ? startBlockReason(session) : null;
                  const dayKey = toLocalDateKey(session.starts_at);
                  const showDayHeader =
                    index === 0 || toLocalDateKey(filteredSessions[index - 1].starts_at) !== dayKey;
                  const openTransition = (targetStatus: "ongoing" | "completed") => {
                    setTransitionError(null);
                    setTransitionDialog({ session, targetStatus });
                  };

                  return (
                    <Fragment key={session.id}>
                    {/* ===== Layar kecil: judul hari + kartu ringkas (ketuk kartu = Detail Sesi) ===== */}
                    {showDayHeader && (
                      <p className="pt-1 text-[11px] font-bold uppercase tracking-wide text-gray-500 sm:hidden">
                        {mobileDayLabel(session.starts_at, dayKey)}
                      </p>
                    )}
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => void handleOpenDetail(session.id)}
                      onKeyDown={(event) => {
                        if (event.target !== event.currentTarget) return;
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          void handleOpenDetail(session.id);
                        }
                      }}
                      aria-label={`Detail sesi ${title}`}
                      className={`rounded-2xl border bg-white p-3 shadow-xs sm:hidden ${
                        isOngoing ? "border-[#064E3B] ring-2 ring-[#064E3B]/10" : "border-gray-200"
                      }`}
                    >
                      <div className="flex gap-3">
                        <div className="w-12 shrink-0 text-center">
                          <p className="text-sm font-bold text-gray-900">
                            {formatWitaTime(new Date(session.starts_at))}
                          </p>
                          <p className="text-[11px] text-gray-500">
                            {formatWitaTime(new Date(session.ends_at))}
                          </p>
                        </div>
                        <div className="min-w-0 flex-1 border-l border-gray-100 pl-3">
                          <div className="flex items-start justify-between gap-2">
                            <p className="truncate text-sm font-bold text-gray-900">{title}</p>
                            {(isOngoing || isScheduled) && (
                              <button
                                type="button"
                                aria-label="Aksi lain"
                                aria-haspopup="dialog"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setActionSheetSessionId(session.id);
                                }}
                                className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <Badge weight="semibold" bordered className={`gap-1 ${badge.className}`}>
                              {isOngoing && (
                                <span className="relative flex h-1.5 w-1.5 shrink-0">
                                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />
                                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-300" />
                                </span>
                              )}
                              {badge.label}
                            </Badge>
                            <Badge weight="semibold" className={booking?.service_type === "group" ? "bg-purple-50 text-purple-700" : "bg-gray-100 text-gray-700"}>
                              {booking?.service_type === "group"
                                ? `Kelompok · ${booking.participant_count} orang`
                                : "Individu"}
                            </Badge>
                            <span className="truncate text-[11px] text-gray-500">
                              {session.room || "Ruang Konseling LMI"}
                            </span>
                          </div>
                          {session.completed_at && (
                            <p className="mt-1 text-[11px] text-gray-500">
                              Selesai {formatIsoShortDateId(session.completed_at)}
                            </p>
                          )}
                          {blockReason && (
                            <p className="mt-1.5 text-[11px] font-medium text-amber-700">{blockReason}</p>
                          )}
                          {(isOngoing || isScheduled) && (
                            <div className={`mt-2.5 grid gap-2 ${isScheduled && booking ? "grid-cols-2" : "grid-cols-1"}`}>
                            {isScheduled && booking && (
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setRescheduleBooking(booking);
                                }}
                                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 text-xs font-semibold text-amber-800 transition hover:bg-amber-100"
                              >
                                <CalendarClock className="h-3.5 w-3.5" />
                                Jadwal Ulang
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={isScheduled && Boolean(blockReason)}
                              onClick={(event) => {
                                event.stopPropagation();
                                openTransition(isOngoing ? "completed" : "ongoing");
                              }}
                              className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-[#064E3B] text-xs font-semibold text-white transition hover:bg-[#053e2f] disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 disabled:hover:bg-gray-300"
                            >
                              {isOngoing ? (
                                <>
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  Selesaikan Sesi
                                </>
                              ) : (
                                <>
                                  <Play className="h-3.5 w-3.5" />
                                  Mulai Sesi
                                </>
                              )}
                            </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* ===== Layar sedang ke atas: kartu seperti sebelumnya ===== */}
                    <div
                      className={`hidden rounded-2xl border bg-white p-5 shadow-xs transition sm:block ${
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
                              <Badge size="md" weight="semibold" bordered className={`gap-1.5 ${badge.className}`}>
                                {session.status === "ongoing" && (
                                  <span className="relative flex h-2 w-2 shrink-0">
                                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />
                                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-300" />
                                  </span>
                                )}
                                {badge.label}
                              </Badge>
                              <Badge size="md" weight="semibold" className={booking?.service_type === "group" ? "bg-purple-50 text-purple-700" : "bg-gray-100 text-gray-700"}>
                                {booking?.service_type === "group"
                                  ? `Kelompok · ${booking.participant_count} orang`
                                  : "Individu"}
                              </Badge>
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
                                <MapPin className="h-3.5 w-3.5 text-gray-400" />
                                {session.room || "Ruang Konseling LMI"}
                              </span>
                              {session.completed_at && (
                                <span>
                                  Selesai{" "}
                                  {formatIsoShortDateId(session.completed_at)}
                                </span>
                              )}
                            </div>
                            {session.status === "scheduled" &&
                              startBlockReason(session) && (
                                <p className="mt-1.5 text-xs font-medium text-amber-700">
                                  {startBlockReason(session)}
                                </p>
                              )}
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
                              {/* "Batalkan tanpa jadwal ulang" dipindah ke Detail Sesi (desktop) dan menu ⋯ (mobile). */}
                              {booking && (
                                <button
                                  type="button"
                                  onClick={() => setRescheduleBooking(booking)}
                                  className="rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-800 transition hover:bg-amber-100 sm:text-sm"
                                >
                                  <IconLabel icon={CalendarClock}>Jadwal Ulang</IconLabel>
                                </button>
                              )}
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
                                disabled={Boolean(
                                  startBlockReason(session),
                                )}
                                title={
                                  startBlockReason(session) ??
                                  undefined
                                }
                                onClick={() => {
                                  setTransitionError(null);
                                  setTransitionDialog({
                                    session,
                                    targetStatus: "ongoing",
                                  });
                                }}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-[#064E3B] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#053e2f] sm:text-sm disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 disabled:hover:bg-gray-300"
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
                                <IconLabel icon={X}>Hentikan</IconLabel>
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
                    </Fragment>
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
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-bold text-gray-900">
                {transitionDialog.targetStatus === "ongoing"
                  ? "Mulai Sesi Konseling?"
                  : transitionDialog.targetStatus === "completed"
                    ? "Selesaikan Sesi Konseling?"
                    : transitionDialog.session.status === "ongoing"
                      ? "Hentikan Sesi Konseling?"
                      : "Batalkan Tanpa Jadwal Ulang?"}
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
                  ? "Isi catatan sesi terlebih dahulu. Setelah disimpan, sesi ditandai selesai dan klien menerima notifikasi untuk memberikan ulasan."
                  : transitionDialog.session.status === "ongoing"
                    ? "Sesi dan booking terkait akan dihentikan dan ketersediaan Anda dibuka kembali. Klien menerima notifikasi beserta alasan di bawah, dan pengingat yang belum terkirim dibatalkan."
                    : "Sesi dan booking terkait akan dibatalkan dan ketersediaan Anda dibuka kembali. Klien menerima notifikasi beserta alasan di bawah, dan pengingat yang belum terkirim dibatalkan."}
            </p>
            {transitionDialog.targetStatus === "cancelled" &&
              transitionDialog.session.status === "scheduled" && (
                <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                  Klien <b>tidak</b> ditawari jadwal pengganti dengan Anda. Gunakan{" "}
                  <b>Jadwal Ulang</b> bila Anda hanya berhalangan pada jam ini.
                </div>
              )}

            {transitionDialog.targetStatus === "completed" && (
              <div className="mt-4 space-y-4">
                <label className="block text-sm font-semibold text-gray-900">
                  Catatan konselor <span className="text-red-600">*</span>
                  <textarea
                    value={completionNotes.counselor}
                    onChange={(event) => setCompletionNotes((prev) => ({ ...prev, counselor: event.target.value }))}
                    maxLength={10000}
                    rows={4}
                    disabled={transitionSubmitting}
                    placeholder="Ringkasan proses dan temuan sesi."
                    className="mt-2 w-full rounded-xl border border-gray-300 p-3 text-sm font-normal outline-none focus:border-[#064E3B] focus:ring-4 focus:ring-[#064E3B]/15"
                  />
                  <span className="mt-1 block text-xs font-normal text-gray-500">
                    Hanya dapat dibaca konselor yang menangani. Tidak tercetak di laporan.
                  </span>
                </label>
                <label className="block text-sm font-semibold text-gray-900">
                  Catatan untuk klien <span className="text-red-600">*</span>
                  <textarea
                    value={completionNotes.client}
                    onChange={(event) => setCompletionNotes((prev) => ({ ...prev, client: event.target.value }))}
                    maxLength={10000}
                    rows={3}
                    disabled={transitionSubmitting}
                    placeholder="Saran atau ringkasan yang ditujukan untuk klien."
                    className="mt-2 w-full rounded-xl border border-gray-300 p-3 text-sm font-normal outline-none focus:border-[#064E3B] focus:ring-4 focus:ring-[#064E3B]/15"
                  />
                  <span className="mt-1 block text-xs font-normal text-gray-500">
                    Ditujukan untuk klien dan tercetak di laporan sesi.
                  </span>
                </label>
                <label className="block text-sm font-semibold text-gray-900">
                  Tindak lanjut <span className="font-normal text-gray-500">(opsional)</span>
                  <textarea
                    value={completionNotes.followUp}
                    onChange={(event) => setCompletionNotes((prev) => ({ ...prev, followUp: event.target.value }))}
                    maxLength={5000}
                    rows={2}
                    disabled={transitionSubmitting}
                    placeholder="Rencana sesi berikutnya atau rujukan."
                    className="mt-2 w-full rounded-xl border border-gray-300 p-3 text-sm font-normal outline-none focus:border-[#064E3B] focus:ring-4 focus:ring-[#064E3B]/15"
                  />
                </label>
              </div>
            )}

            {transitionDialog.targetStatus === "cancelled" && (
              <label className="mt-4 block text-sm font-semibold text-gray-900">
                Alasan pembatalan <span className="text-red-600">*</span>
                <textarea
                  value={cancelReason}
                  onChange={(event) => setCancelReason(event.target.value)}
                  maxLength={1000}
                  rows={3}
                  disabled={transitionSubmitting}
                  placeholder={
                    transitionDialog.session.status === "ongoing"
                      ? "Contoh: Klien tidak hadir sampai 15 menit setelah jadwal dimulai."
                      : "Contoh: Kasus ini kami rujuk ke psikolog klinis untuk penanganan lanjutan."
                  }
                  className="mt-2 w-full rounded-xl border border-gray-300 p-3 text-sm font-normal outline-none focus:border-[#064E3B] focus:ring-4 focus:ring-[#064E3B]/15"
                />
                <span className="mt-1 block text-xs font-normal text-gray-500">
                  Alasan ini dikirim ke klien. Jangan tuliskan isi konseling.
                </span>
              </label>
            )}

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
                {transitionSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : transitionDialog.targetStatus === "ongoing" ? (
                  <Play className="h-4 w-4" />
                ) : transitionDialog.targetStatus === "completed" ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                {transitionDialog.targetStatus === "ongoing"
                  ? "Ya, Mulai Sesi"
                  : transitionDialog.targetStatus === "completed"
                    ? "Ya, Selesaikan Sesi"
                    : transitionDialog.session.status === "ongoing"
                      ? "Ya, Hentikan Sesi"
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

      {rescheduleBooking && (
        <BookingDecisionModal
          booking={rescheduleBooking}
          action="reschedule"
          onClose={() => setRescheduleBooking(null)}
          onSuccess={() => {
            const clientTitle = formatBookingClientTitle(rescheduleBooking);
            setRescheduleBooking(null);
            toast.info(
              `Permintaan jadwal ulang dikirim ke ${clientTitle}. Klien memilih jam pengganti dari ketersediaan Anda.`,
            );
            void handleManualRefresh();
          }}
        />
      )}

      {/* ==================== LAYAR KECIL: LEMBAR FILTER JENIS ==================== */}
      {typeSheetOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-[#0c2619]/45 sm:hidden"
          onClick={(e) => {
            if (e.target === e.currentTarget) setTypeSheetOpen(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setTypeSheetOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Jenis konseling"
            className="w-full rounded-t-3xl bg-white px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-3 shadow-2xl"
          >
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-gray-300" />
            <p className="text-base font-bold text-gray-900">Jenis konseling</p>
            <div className="mt-3 space-y-2">
              {(["Semua", "Individu", "Kelompok"] as const).map((item) => {
                const selected = typeFilter === item;
                return (
                  <button
                    key={item}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      setTypeFilter(item);
                      setTypeSheetOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-sm font-semibold ${
                      selected
                        ? "border-[#064E3B] bg-emerald-50 text-[#064E3B]"
                        : "border-gray-200 text-gray-700"
                    }`}
                  >
                    {item}
                    {selected && <CheckCircle2 className="h-4 w-4" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ==================== LAYAR KECIL: LEMBAR AKSI KARTU SESI ==================== */}
      {actionSheetSession && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-[#0c2619]/45 sm:hidden"
          onClick={(e) => {
            if (e.target === e.currentTarget) setActionSheetSessionId(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setActionSheetSessionId(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Aksi sesi"
            className="w-full rounded-t-3xl bg-white px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-3 shadow-2xl"
          >
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-gray-300" />
            <p className="truncate text-base font-bold text-gray-900">
              {formatBookingClientTitle(bookingMap.get(actionSheetSession.booking_id))}
            </p>
            <p className="text-xs text-gray-500">
              {formatIsoDateId(actionSheetSession.starts_at)} ·{" "}
              {formatIsoTimeRangeWita(actionSheetSession.starts_at, actionSheetSession.ends_at)}
            </p>
            <div className="mt-3 divide-y divide-gray-100">
              <button
                type="button"
                onClick={() => {
                  setActionSheetSessionId(null);
                  void handleOpenDetail(actionSheetSession.id);
                }}
                className="flex w-full items-center gap-3 py-3 text-left text-sm font-semibold text-gray-800"
              >
                <Info className="h-4 w-4 text-gray-500" />
                Detail Sesi
              </button>
              {actionSheetSession.status === "scheduled" && (
                <button
                  type="button"
                  onClick={() => {
                    setActionSheetSessionId(null);
                    setConsentModalBookingId(actionSheetSession.booking_id);
                  }}
                  className="flex w-full items-center gap-3 py-3 text-left text-sm font-semibold text-gray-800"
                >
                  <FileText className="h-4 w-4 text-emerald-800" />
                  Persetujuan
                </button>
              )}
              {(actionSheetSession.status === "scheduled" ||
                actionSheetSession.status === "ongoing") && (
                <button
                  type="button"
                  onClick={() => {
                    setActionSheetSessionId(null);
                    setTransitionError(null);
                    setTransitionDialog({ session: actionSheetSession, targetStatus: "cancelled" });
                  }}
                  className="flex w-full items-start gap-3 py-3 text-left text-sm font-semibold text-red-600"
                >
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  {actionSheetSession.status === "ongoing" ? (
                    "Hentikan Sesi"
                  ) : (
                    <span>
                      Batalkan tanpa jadwal ulang
                      <span className="mt-0.5 block text-[11px] font-normal text-gray-500">
                        Hanya untuk rujukan, di luar kompetensi, klien tidak lagi berhak, atau cuti
                        panjang. Bila hanya berhalangan, gunakan Jadwal Ulang.
                      </span>
                    </span>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
