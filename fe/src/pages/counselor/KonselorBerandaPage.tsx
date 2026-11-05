import IconLabel from "../../components/shared/IconLabel";
import { Link } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  Inbox,
  MapPin,
  RefreshCw,
  Star,
  Check,
  XCircle,
} from "lucide-react";
import {
  PageContainer,
  Skeleton,
  SkeletonList,
  useToast,
} from "../../components/shared";
import {
  BookingDecisionModal,
  type BookingDecisionAction,
} from "../../components/counselor/BookingDecisionModal";
import {
  formatBookingClientTitle,
  formatIsoDateId,
  formatIsoShortDateId,
  formatIsoTimeRangeWita,
  formatSessionFormatLabel,
  getCounselorInitials,
  toLocalDateKey,
} from "../../features/counselor/shared/presentation";
import { getLicenseExpiry } from "../../features/counselor/profile/licenseStatus";
import { useAuth } from "../../features/auth/useAuth";
import { ApiError } from "../../lib/api";
import { counselorApi } from "../../lib/counselorApi";
import { sicareApi } from "../../lib/sicareApi";
import type {
  BookingDetailDto,
  BookingRecordBaseDto,
  CounselorFeedbackDto,
  CounselorProfileDto,
  ProfileDto,
  SessionListItemDto,
} from "../../types/api";

function getWeekBounds(now: Date): { start: Date; end: Date } {
  const day = now.getDay(); // 0 = Sun, 1 = Mon, ...
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday);
  const nextMonday = new Date(
    monday.getFullYear(),
    monday.getMonth(),
    monday.getDate() + 7,
  );
  return { start: monday, end: nextMonday };
}

export default function KonselorBerandaPage() {
  const navigate = useNavigate();
  const { profile: authProfile } = useAuth();

  const [profile, setProfile] = useState<ProfileDto | null>(null);
  const [licenseValidUntil, setLicenseValidUntil] = useState<string | null>(null);
  const [counselorProfile, setCounselorProfile] = useState<CounselorProfileDto | null>(null);
  const [bookings, setBookings] = useState<BookingRecordBaseDto[]>([]);
  const [sessions, setSessions] = useState<SessionListItemDto[]>([]);
  const [feedbackList, setFeedbackList] = useState<CounselorFeedbackDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [decisionModal, setDecisionModal] = useState<{
    booking: BookingRecordBaseDto;
    action: BookingDecisionAction;
  } | null>(null);

  const toast = useToast();

  const fetchDashboardData = useCallback(async () => {
    const [profileRes, counselorProfileRes, bookingsRes, sessionsRes, feedbackRes] =
      await Promise.all([
        sicareApi.getProfile(),
        counselorApi.getProfile().catch(() => null),
        sicareApi.bookings(100),
        sicareApi.sessions(100),
        counselorApi.getFeedback({ limit: 100 }).catch(() => [] as CounselorFeedbackDto[]),
      ]);

    return {
      profile: profileRes,
      counselorProfile: counselorProfileRes,
      bookings: bookingsRes,
      sessions: sessionsRes,
      feedback: feedbackRes,
    };
  }, []);

  useEffect(() => {
    let active = true;
    void counselorApi
      .getLicense()
      .then((license) => {
        if (active) setLicenseValidUntil(license.sipp_silp_valid_until);
      })
      .catch(() => {
        // Pengingat izin tidak boleh mengganggu beranda.
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    fetchDashboardData()
      .then((data) => {
        if (!active) return;
        setProfile(data.profile);
        setCounselorProfile(data.counselorProfile);
        setBookings(data.bookings);
        setSessions(data.sessions);
        setFeedbackList(data.feedback);
        setErrorMessage(null);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setErrorMessage(
          err instanceof ApiError
            ? err.message
            : "Gagal memuat data beranda konselor dari server.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [fetchDashboardData]);

  const handleManualRefresh = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const data = await fetchDashboardData();
      setProfile(data.profile);
      setCounselorProfile(data.counselorProfile);
      setBookings(data.bookings);
      setSessions(data.sessions);
      setFeedbackList(data.feedback);
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof ApiError
          ? err.message
          : "Gagal memuat ulang data beranda konselor.",
      );
    } finally {
      setLoading(false);
    }
  };

  const counselorName =
    counselorProfile?.public_name?.trim() ||
    profile?.full_name?.trim() ||
    authProfile?.full_name?.trim() ||
    "Konselor";

  const licenseExpiry = getLicenseExpiry(licenseValidUntil);
  const showLicenseReminder =
    licenseExpiry?.state === "expiring" || licenseExpiry?.state === "expired";

  // Akun lama bisa belum punya jenis kelamin; gunakan sapaan netral.
  const greeting =
    profile?.gender === "female"
      ? "Halo ma'am"
      : profile?.gender === "male"
        ? "Halo Sir"
        : "Halo";

  const bookingMap = useMemo(() => {
    const map = new Map<string, BookingRecordBaseDto>();
    for (const b of bookings) {
      map.set(b.id, b);
    }
    return map;
  }, [bookings]);

  const todayKey = useMemo(() => toLocalDateKey(new Date()), []);
  const todayLabel = useMemo(
    () =>
      new Date().toLocaleDateString("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    [],
  );

  const pendingRequests = useMemo(
    () =>
      bookings
        .filter((b) => b.status === "waiting_confirmation")
        .sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        ),
    [bookings],
  );

  const todaySessions = useMemo(
    () =>
      sessions
        .filter(
          (s) =>
            s.status !== "cancelled" && toLocalDateKey(s.starts_at) === todayKey,
        )
        .sort(
          (a, b) =>
            new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
        ),
    [sessions, todayKey],
  );

  const ongoingSession = useMemo(
    () => sessions.find((s) => s.status === "ongoing") ?? null,
    [sessions],
  );

  const sessionsThisWeek = useMemo(() => {
    const { start, end } = getWeekBounds(new Date());
    return sessions.filter((s) => {
      if (s.status === "cancelled") return false;
      const t = new Date(s.starts_at).getTime();
      return t >= start.getTime() && t < end.getTime();
    }).length;
  }, [sessions]);

  const ratingStats = useMemo(() => {
    const counts: Record<1 | 2 | 3 | 4 | 5, number> = {
      5: 0,
      4: 0,
      3: 0,
      2: 0,
      1: 0,
    };
    let sum = 0;
    for (const item of feedbackList) {
      const r = Math.min(5, Math.max(1, Math.round(item.rating))) as
        | 1
        | 2
        | 3
        | 4
        | 5;
      counts[r] += 1;
      sum += item.rating;
    }
    const total = feedbackList.length;
    const avg = total > 0 ? (sum / total).toFixed(1) : "0.0";
    return { counts, total, avg };
  }, [feedbackList]);

  const handleDecisionSuccess = async (
    result: BookingDetailDto,
    action: BookingDecisionAction,
  ) => {
    const title = formatBookingClientTitle(decisionModal?.booking);
    setDecisionModal(null);

    if (action === "approve") {
      toast.success(`Permintaan ${title} diterima dan sesi baru telah dijadwalkan.`);
    } else if (action === "reschedule") {
      toast.info(`Permintaan jadwal ulang untuk ${title} telah dikirim ke klien.`);
    } else {
      toast.info(`Permintaan ${title} telah ditolak.`);
    }

    try {
      const fresh = await fetchDashboardData();
      setProfile(fresh.profile);
      setCounselorProfile(fresh.counselorProfile);
      setBookings(fresh.bookings);
      setSessions(fresh.sessions);
      setFeedbackList(fresh.feedback);
    } catch {
      setBookings((prev) =>
        prev.map((item) =>
          item.id === result.id ? { ...item, ...result } : item,
        ),
      );
    }
  };

  return (
    <PageContainer className="py-6 lg:py-8">
      <div className="space-y-6">
        {/* Header Sambutan */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-gray-500">{todayLabel}</p>
            <h1 className="mt-0.5 text-2xl font-bold text-gray-900">
              {greeting}, {counselorName}{" "}
              <span aria-hidden="true" className="wave-hand">
                👋
              </span>
            </h1>
          </div>
          <button
            type="button"
            onClick={() => void handleManualRefresh()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-xs transition hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Muat Ulang
          </button>
        </div>

        {showLicenseReminder && licenseExpiry && (
          <div
            role="status"
            className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm ${
              licenseExpiry.state === "expired"
                ? "border-red-200 bg-red-50 text-red-800"
                : "border-amber-200 bg-amber-50 text-amber-900"
            }`}
          >
            <p className="font-semibold">{licenseExpiry.label}</p>
            <Link to="/konselor/pengaturan" className="font-semibold underline">
              Perbarui di Pengaturan
            </Link>
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
                <p className="font-semibold">Gagal Memuat Data Beranda</p>
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

        {/* Banner Sesi Sedang Berlangsung */}
        {ongoingSession && (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-emerald-200 bg-[#064E3B] p-5 text-white shadow-xs">
            <div className="flex items-center gap-3.5">
              <span className="h-3 w-3 shrink-0 animate-pulse rounded-full bg-emerald-300" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-200">
                  Sesi Sedang Berlangsung
                </p>
                <p className="mt-0.5 text-base font-bold">
                  {formatBookingClientTitle(
                    bookingMap.get(ongoingSession.booking_id),
                  )}{" "}
                  ·{" "}
                  {formatIsoTimeRangeWita(
                    ongoingSession.starts_at,
                    ongoingSession.ends_at,
                  )}
                </p>
                <p className="mt-0.5 text-xs text-emerald-100">
                  {formatSessionFormatLabel(ongoingSession.format)} ·{" "}
                  {ongoingSession.room || "Ruang Konseling LMI"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate("/konselor/aktivitas")}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#064E3B] transition hover:bg-emerald-50"
            >
              Buka Sesi <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* 4 Kartu Statistik Aktual */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <button
            type="button"
            onClick={() => navigate("/konselor/permintaan")}
            className="rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-xs transition hover:border-amber-300"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500">
                Permintaan Baru
              </span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                <Inbox className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-3 text-3xl font-bold text-gray-900">
              {loading ? <Skeleton className="h-9 w-12" /> : pendingRequests.length}
            </p>
            <p className="mt-1 text-xs font-medium text-amber-600">
              {pendingRequests.length > 0
                ? "Perlu konfirmasi"
                : "Semua sudah ditangani"}
            </p>
          </button>

          <button
            type="button"
            onClick={() => navigate("/konselor/aktivitas")}
            className="rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-xs transition hover:border-emerald-300"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500">
                Sesi Hari Ini
              </span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-[#064E3B]">
                <Clock className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-3 text-3xl font-bold text-gray-900">
              {loading ? <Skeleton className="h-9 w-12" /> : todaySessions.length}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              {ongoingSession ? "1 sedang berlangsung" : "Terjadwal hari ini"}
            </p>
          </button>

          <button
            type="button"
            onClick={() => navigate("/konselor/jadwal")}
            className="rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-xs transition hover:border-emerald-300"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500">
                Sesi Minggu Ini
              </span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-[#064E3B]">
                <Calendar className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-3 text-3xl font-bold text-gray-900">
              {loading ? <Skeleton className="h-9 w-12" /> : sessionsThisWeek}
            </p>
            <p className="mt-1 text-xs text-gray-500">Senin – Minggu ini</p>
          </button>

          <button
            type="button"
            onClick={() => navigate("/konselor/feedback")}
            className="rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-xs transition hover:border-amber-300"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500">
                Rating Klien
              </span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-500">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-1.5">
              <p className="text-3xl font-bold text-gray-900">
                {loading ? <Skeleton className="h-9 w-12" /> : ratingStats.avg}
              </p>
              <span className="text-xs text-gray-400">/ 5.0</span>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Dari {ratingStats.total} ulasan
            </p>
          </button>
        </div>

        {/* Konten Utama: Permintaan Terlama + Ringkasan Hari Ini */}
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Kolom Kiri (7 col): Permintaan Menunggu Konfirmasi */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs lg:col-span-7">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-gray-900">
                  Permintaan Menunggu Konfirmasi
                </h2>
                <p className="text-xs text-gray-500">
                  Diurutkan dari permintaan yang paling lama diajukan
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate("/konselor/permintaan")}
                className="text-xs font-semibold text-[#064E3B] hover:underline"
              >
                Lihat semua
              </button>
            </div>

            {loading ? (
              <SkeletonList bare rows={3} label="Memuat antrean permintaan konseling..." className="mt-4" />
            ) : pendingRequests.length === 0 ? (
              <div className="mt-5 rounded-xl border border-dashed border-gray-200 p-8 text-center">
                <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" />
                <p className="mt-2 text-sm font-semibold text-gray-800">
                  Tidak ada permintaan yang menunggu
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Semua permintaan konseling sudah ditindaklanjuti.
                </p>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {pendingRequests.slice(0, 4).map((booking) => {
                  const title = formatBookingClientTitle(booking);
                  return (
                    <div
                      key={booking.id}
                      className="rounded-xl border border-gray-200 p-4 transition hover:border-gray-300"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-sm font-bold text-[#064E3B]">
                          {getCounselorInitials(title)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-bold text-gray-900">{title}</p>
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                booking.service_type === "group"
                                  ? "bg-purple-50 text-purple-700"
                                  : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              {booking.service_type === "group"
                                ? `Kelompok · ${booking.participant_count} orang`
                                : "Individu"}
                            </span>
                            <span className="ml-auto text-xs font-semibold text-amber-600">
                              Diajukan {formatIsoShortDateId(booking.created_at)}
                            </span>
                          </div>
                          <p className="mt-1 text-xs font-medium text-gray-700">
                            Jadwal diminta: {formatIsoDateId(booking.starts_at)} ·{" "}
                            {formatIsoTimeRangeWita(booking.starts_at, booking.ends_at)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3">
                        <button
                          type="button"
                          onClick={() => navigate("/konselor/permintaan")}
                          className="text-xs font-semibold text-[#064E3B] hover:underline"
                        >
                          Lihat detail →
                        </button>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setDecisionModal({ booking, action: "reject" })
                            }
                            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                          >
                            <IconLabel icon={XCircle}>Tolak</IconLabel>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setDecisionModal({ booking, action: "reschedule" })
                            }
                            className="rounded-lg border border-amber-300 bg-amber-50/70 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                          >
                            Jadwal Ulang
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setDecisionModal({ booking, action: "approve" })
                            }
                            className="rounded-lg bg-[#064E3B] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#053e2f]"
                          >
                            <IconLabel icon={Check}>Terima</IconLabel>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Kolom Kanan (5 col): Jadwal Sesi Hari Ini + Rating */}
          <div className="space-y-6 lg:col-span-5">
            {/* Jadwal Hari Ini */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-gray-900">
                    Jadwal Hari Ini
                  </h2>
                  <p className="text-xs text-gray-500">
                    {todaySessions.length} sesi terjadwal
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate("/konselor/aktivitas")}
                  className="text-xs font-semibold text-[#064E3B] hover:underline"
                >
                  Ke aktivitas
                </button>
              </div>

              {loading ? (
                <SkeletonList bare rows={2} label="Memuat sesi hari ini..." className="mt-4" />
              ) : todaySessions.length === 0 ? (
                <div className="mt-4 rounded-xl border border-dashed border-gray-200 p-6 text-center text-xs text-gray-500">
                  Belum ada sesi konseling terjadwal untuk hari ini.
                </div>
              ) : (
                <div className="mt-4 space-y-2.5">
                  {todaySessions.map((session) => {
                    const booking = bookingMap.get(session.booking_id);
                    const title = formatBookingClientTitle(booking);
                    const isOngoing = session.status === "ongoing";
                    const isCompleted = session.status === "completed";
                    const startDate = new Date(session.starts_at);
                    const timeStr = `${String(startDate.getHours()).padStart(2, "0")}.${String(startDate.getMinutes()).padStart(2, "0")}`;

                    return (
                      <button
                        key={session.id}
                        type="button"
                        onClick={() => navigate("/konselor/aktivitas")}
                        className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
                          isOngoing
                            ? "border-[#064E3B] bg-emerald-50/60"
                            : "border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        <div className="w-16 shrink-0 text-center">
                          <p className="text-xs font-bold tabular-nums text-gray-900">
                            {timeStr}
                          </p>
                          <p className="text-[11px] text-gray-400">60 mnt</p>
                        </div>
                        <div className="h-8 w-px bg-gray-200" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-gray-900">
                            {title}
                          </p>
                          <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500">
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {session.room || "Ruang Konseling LMI"}
                            </span>
                            <span>·</span>
                            <span>
                              {booking?.service_type === "group"
                                ? "Kelompok"
                                : "Individu"}
                            </span>
                          </div>
                        </div>
                        {isOngoing ? (
                          <span className="rounded-full bg-[#064E3B] px-2.5 py-0.5 text-[11px] font-semibold text-white">
                            Berlangsung
                          </span>
                        ) : isCompleted ? (
                          <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-[11px] font-semibold text-teal-700">
                            Selesai
                          </span>
                        ) : (
                          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-semibold text-gray-600">
                            Mendatang
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Ringkasan Rating */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-gray-900">
                    Penilaian Klien
                  </h2>
                  <p className="text-xs text-gray-500">
                    Berdasarkan {ratingStats.total} ulasan terverifikasi
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate("/konselor/feedback")}
                  className="text-xs font-semibold text-[#064E3B] hover:underline"
                >
                  Lihat ulasan
                </button>
              </div>

              <div className="mt-4 flex items-center gap-5">
                <div className="text-center">
                  <p className="text-3xl font-bold text-gray-900">
                    {ratingStats.avg}
                  </p>
                  <div className="mt-1 flex justify-center gap-0.5 text-amber-400">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`h-3.5 w-3.5 ${
                          star <= Math.round(Number(ratingStats.avg))
                            ? "fill-amber-400 text-amber-400"
                            : "text-gray-200"
                        }`}
                      />
                    ))}
                  </div>
                  <p className="mt-1 text-[11px] text-gray-400">dari 5.0</p>
                </div>

                <div className="flex-1 space-y-1.5">
                  {([5, 4, 3, 2, 1] as const).map((star) => {
                    const count = ratingStats.counts[star];
                    const pct =
                      ratingStats.total > 0
                        ? Math.round((count / ratingStats.total) * 100)
                        : 0;
                    return (
                      <div
                        key={star}
                        className="flex items-center gap-2 text-xs"
                      >
                        <span className="w-3 font-semibold text-gray-600">
                          {star}
                        </span>
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                          <div
                            className="h-full rounded-full bg-amber-400"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-6 text-right tabular-nums text-gray-500">
                          {count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {decisionModal && (
        <BookingDecisionModal
          booking={decisionModal.booking}
          action={decisionModal.action}
          onClose={() => setDecisionModal(null)}
          onSuccess={(result, action) => void handleDecisionSuccess(result, action)}
        />
      )}
    </PageContainer>
  );
}
