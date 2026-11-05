import IconLabel from "../../components/shared/IconLabel";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CalendarClock,
  Clock,
  FileText,
  Info,
  RefreshCw,
  Search,
  Users,
  X,
  Check,
  XCircle,
} from "lucide-react";
import {
  PageContainer,
  PageHeader,
  SkeletonList,
  useToast,
} from "../../components/shared";
import {
  BookingDecisionModal,
  type BookingDecisionAction,
} from "../../components/counselor/BookingDecisionModal";
import {
  formatBookingClientTitle,
  formatBookingRepresentative,
  formatIsoDateId,
  formatIsoShortDateId,
  formatIsoTimeRangeWita,
  getCounselorInitials,
} from "../../features/counselor/shared/presentation";
import { ApiError } from "../../lib/api";
import { sicareApi } from "../../lib/sicareApi";
import type {
  BookingDetailDto,
  BookingRecordBaseDto,
  BookingStatusApi,
} from "../../types/api";

type StatusTab = "waiting_confirmation" | "reschedule_requested" | "confirmed" | "closed" | "all";
type TypeFilter = "Semua" | "Individu" | "Kelompok";
type SortOrder = "terlama" | "terbaru";

function getStatusBadge(status: BookingStatusApi) {
  switch (status) {
    case "waiting_confirmation":
      return {
        label: "Menunggu Konfirmasi",
        className: "border-amber-200 bg-amber-50 text-amber-800",
      };
    case "confirmed":
      return {
        label: "Dikonfirmasi",
        className: "border-emerald-200 bg-emerald-50 text-[#064E3B]",
      };
    case "reschedule_requested":
      return {
        label: "Jadwal Ulang Diminta",
        className: "border-blue-200 bg-blue-50 text-blue-800",
      };
    case "rejected":
      return {
        label: "Ditolak",
        className: "border-red-200 bg-red-50 text-red-700",
      };
    case "cancelled":
      return {
        label: "Dibatalkan",
        className: "border-gray-200 bg-gray-100 text-gray-700",
      };
    default:
      return {
        label: status,
        className: "border-gray-200 bg-gray-100 text-gray-700",
      };
  }
}

export default function KonselorPermintaanPage() {
  const [bookings, setBookings] = useState<BookingRecordBaseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [statusTab, setStatusTab] = useState<StatusTab>("waiting_confirmation");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("Semua");
  const [sortOrder, setSortOrder] = useState<SortOrder>("terlama");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);

  const [decisionModal, setDecisionModal] = useState<{
    booking: BookingRecordBaseDto;
    action: BookingDecisionAction;
  } | null>(null);

  const toast = useToast();

  const fetchBookingsData = useCallback(async () => {
    return sicareApi.bookings(100);
  }, []);

  useEffect(() => {
    let active = true;
    fetchBookingsData()
      .then((rows) => {
        if (!active) return;
        setBookings(rows);
        setErrorMessage(null);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setErrorMessage(
          err instanceof ApiError
            ? err.message
            : "Gagal memuat daftar permintaan konseling dari server.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [fetchBookingsData]);

  const handleManualRefresh = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const rows = await fetchBookingsData();
      setBookings(rows);
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof ApiError
          ? err.message
          : "Gagal memuat ulang daftar permintaan konseling.",
      );
    } finally {
      setLoading(false);
    }
  };

  const counts = useMemo(() => {
    return {
      waiting_confirmation: bookings.filter((b) => b.status === "waiting_confirmation").length,
      reschedule_requested: bookings.filter((b) => b.status === "reschedule_requested").length,
      confirmed: bookings.filter((b) => b.status === "confirmed").length,
      closed: bookings.filter((b) => b.status === "rejected" || b.status === "cancelled").length,
      all: bookings.length,
    };
  }, [bookings]);

  const filteredBookings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return bookings
      .filter((booking) => {
        if (statusTab === "waiting_confirmation" && booking.status !== "waiting_confirmation") {
          return false;
        }
        if (statusTab === "reschedule_requested" && booking.status !== "reschedule_requested") {
          return false;
        }
        if (statusTab === "confirmed" && booking.status !== "confirmed") {
          return false;
        }
        if (
          statusTab === "closed" &&
          booking.status !== "rejected" &&
          booking.status !== "cancelled"
        ) {
          return false;
        }

        if (typeFilter === "Individu" && booking.service_type !== "individual") {
          return false;
        }
        if (typeFilter === "Kelompok" && booking.service_type !== "group") {
          return false;
        }

        if (!q) return true;
        const clientTitle = formatBookingClientTitle(booking).toLowerCase();
        const groupName = (booking.group_name ?? "").toLowerCase();
        const participantMatch = (booking.booking_participants ?? []).some((p) =>
          p.display_name.toLowerCase().includes(q),
        );
        return (
          booking.id.toLowerCase().includes(q) ||
          booking.client_id.toLowerCase().includes(q) ||
          clientTitle.includes(q) ||
          groupName.includes(q) ||
          participantMatch
        );
      })
      .sort((a, b) => {
        const timeA = new Date(a.created_at).getTime();
        const timeB = new Date(b.created_at).getTime();
        return sortOrder === "terlama" ? timeA - timeB : timeB - timeA;
      });
  }, [bookings, searchQuery, sortOrder, statusTab, typeFilter]);

  const selectedBooking = useMemo(
    () => bookings.find((b) => b.id === selectedBookingId) ?? null,
    [bookings, selectedBookingId],
  );

  const handleDecisionSuccess = async (
    result: BookingDetailDto,
    action: BookingDecisionAction,
  ) => {
    const targetTitle = formatBookingClientTitle(decisionModal?.booking);
    setDecisionModal(null);

    setBookings((prev) =>
      prev.map((item) =>
        item.id === result.id
          ? {
              ...item,
              ...result,
              booking_participants:
                result.booking_participants ?? item.booking_participants,
            }
          : item,
      ),
    );

    if (action === "approve") {
      toast.success(`Permintaan ${targetTitle} telah dikonfirmasi dan sesi berhasil dijadwalkan.`);
    } else if (action === "reschedule") {
      toast.info(`Permintaan jadwal ulang untuk ${targetTitle} telah dikirim ke klien.`);
    } else {
      toast.info(`Permintaan ${targetTitle} telah ditolak.`);
    }

    try {
      const freshRows = await fetchBookingsData();
      setBookings(freshRows);
    } catch {
      // Optimistic reconciliation from server response is already applied above
    }
  };

  return (
    <PageContainer className="py-6 lg:py-8">
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <PageHeader
            title="Permintaan"
            description="Kelola permintaan jadwal sesi konseling aktual dari klien"
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


        {errorMessage && (
          <div
            role="alert"
            className="flex items-start justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            <div className="flex items-start gap-2.5">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              <div>
                <p className="font-semibold">Gagal Memuat Permintaan</p>
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

        {selectedBooking ? (
          /* ========================= DETAIL PERMINTAAN ========================= */
          <div className="space-y-5">
            <button
              type="button"
              onClick={() => setSelectedBookingId(null)}
              className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Kembali ke daftar permintaan
            </button>

            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-100 pb-5">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-base font-bold text-[#064E3B]">
                    {getCounselorInitials(formatBookingClientTitle(selectedBooking))}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-bold text-gray-900">
                        {formatBookingClientTitle(selectedBooking)}
                      </h2>
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                          getStatusBadge(selectedBooking.status).className
                        }`}
                      >
                        {getStatusBadge(selectedBooking.status).label}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          selectedBooking.service_type === "group"
                            ? "bg-purple-50 text-purple-700"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {selectedBooking.service_type === "group"
                          ? `Kelompok (${selectedBooking.participant_count} orang)`
                          : "Individu"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      ID Booking: <code className="font-mono">{selectedBooking.id}</code> · Diajukan{" "}
                      {formatIsoShortDateId(selectedBooking.created_at)}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {selectedBooking.status === "waiting_confirmation" && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          setDecisionModal({ booking: selectedBooking, action: "reject" })
                        }
                        className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                      >
                        <IconLabel icon={XCircle}>Tolak</IconLabel>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setDecisionModal({ booking: selectedBooking, action: "reschedule" })
                        }
                        className="rounded-xl border border-amber-300 bg-amber-50/70 px-4 py-2 text-sm font-semibold text-amber-800 transition hover:bg-amber-100"
                      >
                        Minta Jadwal Ulang
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setDecisionModal({ booking: selectedBooking, action: "approve" })
                        }
                        className="rounded-xl bg-[#064E3B] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#053e2f]"
                      >
                        <IconLabel icon={Check}>Terima Permintaan</IconLabel>
                      </button>
                    </>
                  )}
                  {selectedBooking.status === "confirmed" && (
                    <button
                      type="button"
                      onClick={() =>
                        setDecisionModal({ booking: selectedBooking, action: "reschedule" })
                      }
                      className="inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50/70 px-4 py-2 text-sm font-semibold text-amber-800 transition hover:bg-amber-100"
                    >
                      <CalendarClock className="h-4 w-4" />
                      Minta Jadwal Ulang
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold text-gray-500">
                    <Calendar className="h-4 w-4 text-[#064E3B]" />
                    Tanggal Sesi yang Diajukan
                  </div>
                  <p className="mt-1.5 text-sm font-bold text-gray-900">
                    {formatIsoDateId(selectedBooking.starts_at)}
                  </p>
                </div>

                <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold text-gray-500">
                    <Clock className="h-4 w-4 text-[#064E3B]" />
                    Rentang Waktu Sesi
                  </div>
                  <p className="mt-1.5 text-sm font-bold text-gray-900">
                    {formatIsoTimeRangeWita(selectedBooking.starts_at, selectedBooking.ends_at)}
                  </p>
                </div>

                <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold text-gray-500">
                    <Users className="h-4 w-4 text-[#064E3B]" />
                    Identitas Pemohon
                  </div>
                  <p className="mt-1.5 text-sm font-bold text-gray-900">
                    ID Klien: #{selectedBooking.client_id.slice(0, 8).toUpperCase()}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {selectedBooking.service_type === "group"
                      ? `Perwakilan: ${formatBookingRepresentative(selectedBooking) ?? "—"}`
                      : "Konseling Individu (1 peserta)"}
                  </p>
                </div>
              </div>

              {selectedBooking.service_type === "group" && (
                <div className="mt-5 rounded-xl border border-purple-100 bg-purple-50/40 p-4">
                  <h3 className="text-sm font-bold text-purple-950">
                    Daftar Anggota Kelompok ({selectedBooking.participant_count} Peserta)
                  </h3>
                  {(selectedBooking.booking_participants ?? []).length > 0 ? (
                    <ul className="mt-2.5 grid gap-2 sm:grid-cols-2">
                      {(selectedBooking.booking_participants ?? []).map((participant, idx) => (
                        <li
                          key={participant.id}
                          className="flex items-center justify-between rounded-lg border border-purple-100 bg-white px-3 py-2 text-sm"
                        >
                          <span className="font-medium text-gray-800">
                            {idx + 1}. {participant.display_name}
                          </span>
                          {participant.is_representative && (
                            <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[11px] font-semibold text-purple-800">
                              Perwakilan
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-xs text-purple-800">
                      Nama kelompok: {selectedBooking.group_name ?? "—"} (
                      {selectedBooking.participant_count} peserta terdaftar).
                    </p>
                  )}
                </div>
              )}

              {(selectedBooking.reschedule_reason || selectedBooking.cancellation_reason) && (
                <div className="mt-5 space-y-3">
                  {selectedBooking.reschedule_reason && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-900">
                      <p className="font-bold">Alasan Permintaan Jadwal Ulang:</p>
                      <p className="mt-1">{selectedBooking.reschedule_reason}</p>
                    </div>
                  )}
                  {selectedBooking.cancellation_reason && (
                    <div className="rounded-xl border border-red-200 bg-red-50/70 p-4 text-sm text-red-900">
                      <p className="font-bold">Alasan Penolakan / Pembatalan:</p>
                      <p className="mt-1">{selectedBooking.cancellation_reason}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-start gap-3">
                  <Info className="mt-0.5 h-5 w-5 shrink-0 text-[#064E3B]" />
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">
                      Formulir Intake Klinis & Privasi Data Klien
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-gray-600">
                      Sesuai skema backend `/api/v1/bookings` dan kebijakan privasi SOP saat ini,
                      jawaban kuesioner intake klinis (keluhan detail, riwayat konseling, dan kontak
                      darurat) belum disimpan atau dikirim melalui proyeksi booking. Anda dapat
                      memverifikasi detail kebutuhan klien secara langsung saat sesi konseling
                      dimulai.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ========================= DAFTAR PERMINTAAN ========================= */
          <>
            {/* Tab Status */}
            <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-3">
              {(
                [
                  ["waiting_confirmation", "Menunggu Konfirmasi", counts.waiting_confirmation],
                  ["reschedule_requested", "Jadwal Ulang Diminta", counts.reschedule_requested],
                  ["confirmed", "Dikonfirmasi", counts.confirmed],
                  ["closed", "Ditolak / Batal", counts.closed],
                  ["all", "Semua Status", counts.all],
                ] as const
              ).map(([key, label, count]) => {
                const active = statusTab === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setStatusTab(key)}
                    className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition sm:text-sm ${
                      active
                        ? "bg-[#064E3B] text-white shadow-xs"
                        : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
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
                  placeholder="Cari ID booking, ID klien, nama kelompok, atau peserta..."
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

                <select
                  aria-label="Urutan permintaan"
                  value={sortOrder}
                  onChange={(event) => setSortOrder(event.target.value as SortOrder)}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 outline-none focus:border-[#064E3B]"
                >
                  <option value="terlama">Terlama (Prioritas Antrean)</option>
                  <option value="terbaru">Terbaru Diajukan</option>
                </select>
              </div>
            </div>

            {/* Content List */}
            {loading ? (
              <SkeletonList rows={5} label="Memuat daftar permintaan booking dari server..." />
            ) : filteredBookings.length === 0 ? (
              <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center shadow-xs">
                <FileText className="mx-auto h-10 w-10 text-gray-300" />
                <p className="mt-3 text-base font-bold text-gray-900">
                  Tidak ada permintaan pada kategori ini
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  {statusTab === "waiting_confirmation"
                    ? "Seluruh permintaan konseling yang menunggu konfirmasi telah ditindaklanjuti."
                    : "Coba ubah tab status, tipe layanan, atau kata kunci pencarian."}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredBookings.map((booking) => {
                  const title = formatBookingClientTitle(booking);
                  const repName = formatBookingRepresentative(booking);
                  const badge = getStatusBadge(booking.status);

                  return (
                    <div
                      key={booking.id}
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
                                className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${badge.className}`}
                              >
                                {badge.label}
                              </span>
                              <span
                                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                  booking.service_type === "group"
                                    ? "bg-purple-50 text-purple-700"
                                    : "bg-gray-100 text-gray-700"
                                }`}
                              >
                                {booking.service_type === "group"
                                  ? `Kelompok · ${booking.participant_count} orang`
                                  : "Individu"}
                              </span>
                            </div>

                            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600">
                              <span className="inline-flex items-center gap-1.5 font-medium text-gray-800">
                                <Calendar className="h-3.5 w-3.5 text-[#064E3B]" />
                                {formatIsoDateId(booking.starts_at)}
                              </span>
                              <span className="inline-flex items-center gap-1.5 font-medium text-gray-800">
                                <Clock className="h-3.5 w-3.5 text-[#064E3B]" />
                                {formatIsoTimeRangeWita(booking.starts_at, booking.ends_at)}
                              </span>
                              <span>Diajukan {formatIsoShortDateId(booking.created_at)}</span>
                              {repName && <span>Perwakilan: {repName}</span>}
                            </div>

                            {booking.reschedule_reason && (
                              <p className="mt-2 rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-800">
                                <span className="font-semibold">Alasan jadwal ulang:</span>{" "}
                                {booking.reschedule_reason}
                              </p>
                            )}
                            {booking.cancellation_reason && (
                              <p className="mt-2 rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-700">
                                <span className="font-semibold">Alasan penolakan/batal:</span>{" "}
                                {booking.cancellation_reason}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 lg:shrink-0">
                          <button
                            type="button"
                            onClick={() => setSelectedBookingId(booking.id)}
                            className="rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 sm:text-sm"
                          >
                            Lihat Detail
                          </button>

                          {booking.status === "waiting_confirmation" && (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  setDecisionModal({ booking, action: "reject" })
                                }
                                className="rounded-xl border border-red-200 bg-white px-3.5 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 sm:text-sm"
                              >
                                <IconLabel icon={XCircle}>Tolak</IconLabel>
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setDecisionModal({ booking, action: "reschedule" })
                                }
                                className="rounded-xl border border-amber-300 bg-amber-50/70 px-3.5 py-2 text-xs font-semibold text-amber-800 transition hover:bg-amber-100 sm:text-sm"
                              >
                                Jadwal Ulang
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setDecisionModal({ booking, action: "approve" })
                                }
                                className="rounded-xl bg-[#064E3B] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#053e2f] sm:text-sm"
                              >
                                <IconLabel icon={Check}>Terima</IconLabel>
                              </button>
                            </>
                          )}

                          {booking.status === "confirmed" && (
                            <button
                              type="button"
                              onClick={() =>
                                setDecisionModal({ booking, action: "reschedule" })
                              }
                              className="rounded-xl border border-amber-300 bg-amber-50/70 px-3.5 py-2 text-xs font-semibold text-amber-800 transition hover:bg-amber-100 sm:text-sm"
                            >
                              Minta Jadwal Ulang
                            </button>
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
