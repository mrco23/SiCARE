import Badge from "../../components/shared/Badge";
import IconLabel from "../../components/shared/IconLabel";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Calendar,
  CalendarClock,
  Clock,
  FileText,
  Info,
  Search,
  SlidersHorizontal,
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
import { ClientIntakeView } from "../../components/counselor/ClientIntakeView";
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
import { EXPIRED_BOOKING_LABEL } from "../../lib/sessionStatus";
import { formatWitaTime } from "../../lib/witaTime";
import { hasUrgentIntake, URGENT_INTAKE_LABEL, urgentIntakeMessage } from "../../lib/intakeRisk";

/** Kolom tanggal kartu ringkas di layar kecil: hari, tanggal, bulan (WITA). */
function witaDateParts(iso: string) {
  const date = new Date(iso);
  const part = (options: Intl.DateTimeFormatOptions) =>
    date.toLocaleDateString("id-ID", { timeZone: "Asia/Makassar", ...options });
  return {
    weekday: part({ weekday: "short" }),
    day: part({ day: "numeric" }),
    month: part({ month: "short" }),
  };
}

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
        label: "Tidak Diterima",
        className: "border-red-200 bg-red-50 text-red-700",
      };
    case "cancelled":
      return {
        label: "Dibatalkan",
        className: "border-gray-200 bg-gray-100 text-gray-700",
      };
    case "expired":
      return {
        label: EXPIRED_BOOKING_LABEL,
        className: "border-slate-200 bg-slate-100 text-slate-700",
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
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  // Layar kecil: jenis dan urutan dipilih lewat lembar bawah.
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);

  const [decisionModal, setDecisionModal] = useState<{
    booking: BookingRecordBaseDto;
    action: BookingDecisionAction;
  } | null>(null);

  const toast = useToast();

  const fetchBookingsData = useCallback(async () => {
    return sicareApi.allBookings();
  }, []);

  useEffect(() => {
    let active = true;
    fetchBookingsData()
      .then((rows) => {
        if (!active) return;
        setBookings(rows);
        setLastSyncedAt(Date.now());
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
      setLastSyncedAt(Date.now());
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
      closed: bookings.filter(
        (b) => b.status === "rejected" || b.status === "cancelled" || b.status === "expired",
      ).length,
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
          booking.status !== "cancelled" &&
          booking.status !== "expired"
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
        // Permintaan menunggu dengan penanda keselamatan selalu di atas.
        const urgentA = a.status === "waiting_confirmation" && hasUrgentIntake(a.intake_answers) ? 1 : 0;
        const urgentB = b.status === "waiting_confirmation" && hasUrgentIntake(b.intake_answers) ? 1 : 0;
        if (urgentA !== urgentB) return urgentB - urgentA;
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
      toast.info(`Permintaan ${targetTitle} tidak diterima. Alasannya sudah dikirim ke klien.`);
    }

    try {
      const freshRows = await fetchBookingsData();
      setBookings(freshRows);
    } catch {
      // Optimistic reconciliation from server response is already applied above
    }
  };

  return (
    <PageContainer>
      <div className="space-y-4 sm:space-y-6">
        {/* Layar kecil: judul lebih kecil dan deskripsi diganti waktu pembaruan agar daftar naik. */}
        <PageHeader
          title="Permintaan"
          titleClassName="max-sm:text-xl"
          descriptionClassName="max-sm:mt-0 max-sm:text-[11px] max-sm:text-gray-500"
          description={
            <>
              <span className="hidden sm:inline">
                Kelola permintaan jadwal sesi konseling aktual dari klien
              </span>
              <span className="sm:hidden">
                {lastSyncedAt
                  ? `Diperbarui pukul ${formatWitaTime(new Date(lastSyncedAt))} WITA`
                  : "Permintaan jadwal konseling dari klien"}
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
                      <Badge size="md" weight="semibold" bordered className={getStatusBadge(selectedBooking.status).className}>
                        {getStatusBadge(selectedBooking.status).label}
                      </Badge>
                      <Badge size="md" weight="semibold" className={selectedBooking.service_type === "group" ? "bg-purple-50 text-purple-700" : "bg-gray-100 text-gray-700"}>
                        {selectedBooking.service_type === "group"
                          ? `Kelompok (${selectedBooking.participant_count} orang)`
                          : "Individu"}
                      </Badge>
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
                        <IconLabel icon={XCircle}>Tidak Dapat Menerima</IconLabel>
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
                            <Badge weight="semibold" className="bg-purple-100 text-purple-800">
                              Perwakilan
                            </Badge>
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
                      <p className="font-bold">Alasan Tidak Diterima / Pembatalan:</p>
                      <p className="mt-1">{selectedBooking.cancellation_reason}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-start gap-3">
                  <Info className="mt-0.5 h-5 w-5 shrink-0 text-[#064E3B]" />
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-bold text-gray-900">
                      Formulir Klien
                    </h3>
                    {selectedBooking.intake_answers === undefined ? (
                      <p className="mt-1 text-xs leading-relaxed text-gray-600">
                        Jawaban formulir klien belum dapat ditampilkan di halaman ini. Silakan
                        gali kebutuhan klien secara langsung saat sesi dimulai.
                      </p>
                    ) : (
                      <>
                        <p className="mt-1 text-xs leading-relaxed text-gray-600">
                          Diisi klien saat mengajukan permintaan ini. Jaga kerahasiaan isi formulir ini.
                        </p>
                        <div className="mt-3">
                          {hasUrgentIntake(selectedBooking.intake_answers) && (
                        <div role="alert" className="mb-3 flex items-start gap-2 rounded-xl border border-red-300 bg-red-50 p-3 text-xs leading-relaxed text-red-800">
                          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                          <span>
                            <strong>{URGENT_INTAKE_LABEL}.</strong> {urgentIntakeMessage(selectedBooking.intake_answers)}
                          </span>
                        </div>
                          )}
                          <ClientIntakeView
                            intake={selectedBooking.intake_answers}
                            emptyText="Klien tidak mengisi formulir saat mengajukan permintaan ini."
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ========================= DAFTAR PERMINTAAN ========================= */
          <>
            {/* Layar kecil: tab + cari menempel di bawah navbar saat daftar digulir (pola Aktivitas). */}
            <div className="sticky top-[72px] z-10 -mx-4 space-y-2 border-b border-gray-200 bg-white/95 px-4 pb-2 pt-2 backdrop-blur sm:static sm:mx-0 sm:space-y-6 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
            {/* Tab Status */}
            <div
              role="tablist"
              aria-label="Status permintaan"
              className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:gap-2 sm:overflow-visible sm:border-b sm:border-gray-200 sm:px-0 sm:pb-3"
            >
              {(
                [
                  ["waiting_confirmation", "Menunggu Konfirmasi", "Menunggu", counts.waiting_confirmation],
                  ["reschedule_requested", "Jadwal Ulang Diminta", "Jadwal Ulang", counts.reschedule_requested],
                  ["confirmed", "Dikonfirmasi", "Dikonfirmasi", counts.confirmed],
                  ["closed", "Tidak Diterima / Batal", "Ditolak/Batal", counts.closed],
                  ["all", "Semua Status", "Semua", counts.all],
                ] as const
              ).map(([key, label, shortLabel, count]) => {
                const active = statusTab === key;
                return (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setStatusTab(key)}
                    className={`inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-xs font-semibold transition sm:h-auto sm:gap-2 sm:rounded-xl sm:py-2 sm:text-sm ${
                      active
                        ? "bg-[#064E3B] text-white shadow-xs"
                        : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
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

              {/* Layar kecil: jenis dan urutan dipilih lewat lembar bawah agar bar tetap satu baris. */}
              <button
                type="button"
                onClick={() => setFilterSheetOpen(true)}
                aria-haspopup="dialog"
                className="relative inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 sm:hidden"
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filter
                {(typeFilter !== "Semua" || sortOrder !== "terlama") && (
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

            <p className="text-[11px] text-gray-500 sm:hidden">
              {typeFilter === "Semua" ? "Semua jenis" : typeFilter} ·{" "}
              {sortOrder === "terlama" ? "Terlama dulu (prioritas antrean)" : "Terbaru diajukan dulu"}
            </p>
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
              <div className="space-y-2 sm:space-y-3">
                {filteredBookings.map((booking) => {
                  const title = formatBookingClientTitle(booking);
                  const repName = formatBookingRepresentative(booking);
                  const badge = getStatusBadge(booking.status);
                  const urgent = hasUrgentIntake(booking.intake_answers);
                  const dateParts = witaDateParts(booking.starts_at);

                  return (
                    <Fragment key={booking.id}>
                    {/* ===== Layar kecil: kartu ringkas (ketuk kartu = Lihat Detail) ===== */}
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedBookingId(booking.id)}
                      onKeyDown={(event) => {
                        if (event.target !== event.currentTarget) return;
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedBookingId(booking.id);
                        }
                      }}
                      aria-label={`Detail permintaan ${title}`}
                      className={`rounded-2xl border bg-white p-3 shadow-xs sm:hidden ${
                        urgent ? "border-red-200" : "border-gray-200"
                      }`}
                    >
                      <div className="flex gap-3">
                        <div className="w-12 shrink-0 text-center">
                          <p className="text-[11px] font-semibold uppercase text-gray-500">
                            {dateParts.weekday}
                          </p>
                          <p className="text-lg font-bold leading-tight text-gray-900">{dateParts.day}</p>
                          <p className="text-[11px] text-gray-500">{dateParts.month}</p>
                        </div>
                        <div className="min-w-0 flex-1 border-l border-gray-100 pl-3">
                          <div className="flex items-start justify-between gap-2">
                            <p className="truncate text-sm font-bold text-gray-900">{title}</p>
                            <span className="shrink-0 text-sm font-bold tabular-nums text-[#064E3B]">
                              {formatWitaTime(new Date(booking.starts_at))}
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <Badge weight="semibold" bordered className={badge.className}>
                              {badge.label}
                            </Badge>
                            <Badge
                              weight="semibold"
                              className={booking.service_type === "group" ? "bg-purple-50 text-purple-700" : "bg-gray-100 text-gray-700"}
                            >
                              {booking.service_type === "group"
                                ? `Kelompok · ${booking.participant_count} orang`
                                : "Individu"}
                            </Badge>
                            {urgent && (
                              <Badge weight="semibold" bordered className="border-red-300 bg-red-50 text-red-700">
                                <AlertCircle className="h-3 w-3" />
                                {URGENT_INTAKE_LABEL}
                              </Badge>
                            )}
                          </div>
                          <p className="mt-1 text-[11px] text-gray-500">
                            {formatIsoTimeRangeWita(booking.starts_at, booking.ends_at)} · Diajukan{" "}
                            {formatIsoShortDateId(booking.created_at)}
                            {repName ? ` · Perwakilan ${repName}` : ""}
                          </p>
                          {booking.reschedule_reason && (
                            <p className="mt-1.5 line-clamp-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-800">
                              <span className="font-semibold">Alasan jadwal ulang:</span>{" "}
                              {booking.reschedule_reason}
                            </p>
                          )}
                          {booking.cancellation_reason && (
                            <p className="mt-1.5 line-clamp-2 rounded-lg bg-red-50 px-2.5 py-1.5 text-[11px] text-red-700">
                              <span className="font-semibold">Alasan tidak diterima/batal:</span>{" "}
                              {booking.cancellation_reason}
                            </p>
                          )}
                          {booking.status === "waiting_confirmation" && (
                            <div className="mt-2.5 grid grid-cols-[3fr_2fr] gap-2">
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setDecisionModal({ booking, action: "reject" });
                                }}
                                className="h-9 whitespace-nowrap rounded-xl border border-red-200 bg-white px-2 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                              >
                                Tidak Dapat Menerima
                              </button>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setDecisionModal({ booking, action: "approve" });
                                }}
                                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-[#064E3B] text-xs font-semibold text-white transition hover:bg-[#053e2f]"
                              >
                                <Check className="h-3.5 w-3.5" />
                                Terima
                              </button>
                            </div>
                          )}
                          {booking.status === "confirmed" && (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setDecisionModal({ booking, action: "reschedule" });
                              }}
                              className="mt-2.5 h-9 w-full rounded-xl border border-amber-300 bg-amber-50/70 text-xs font-semibold text-amber-800 transition hover:bg-amber-100"
                            >
                              Minta Jadwal Ulang
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* ===== Tablet & desktop: kartu seperti sebelumnya ===== */}
                    <div
                      className="hidden rounded-2xl border border-gray-200 bg-white p-5 shadow-xs transition hover:border-gray-300 sm:block"
                    >
                      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                        <div className="flex items-start gap-4">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-sm font-bold text-[#064E3B]">
                            {getCounselorInitials(title)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-bold text-gray-900">{title}</p>
                              <Badge size="md" weight="semibold" bordered className={badge.className}>
                                {badge.label}
                              </Badge>
                              {hasUrgentIntake(booking.intake_answers) && (
                                <Badge size="md" weight="semibold" bordered className="border-red-300 bg-red-50 text-red-700">
                                  <AlertCircle className="h-3.5 w-3.5" />
                                  {URGENT_INTAKE_LABEL}
                                </Badge>
                              )}
                              <Badge size="md" weight="semibold" className={booking.service_type === "group" ? "bg-purple-50 text-purple-700" : "bg-gray-100 text-gray-700"}>
                                {booking.service_type === "group"
                                  ? `Kelompok · ${booking.participant_count} orang`
                                  : "Individu"}
                              </Badge>
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
                                <span className="font-semibold">Alasan tidak diterima/batal:</span>{" "}
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
                                <IconLabel icon={XCircle}>Tidak Dapat Menerima</IconLabel>
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
                    </Fragment>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* ==================== LAYAR KECIL: LEMBAR FILTER (JENIS & URUTAN) ==================== */}
      {filterSheetOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-[#0c2619]/45 sm:hidden"
          onClick={(e) => {
            if (e.target === e.currentTarget) setFilterSheetOpen(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setFilterSheetOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Filter permintaan"
            className="max-h-[85vh] w-full overflow-y-auto rounded-t-3xl bg-white px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-3 shadow-2xl"
          >
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-gray-300" />
            <p className="text-base font-bold text-gray-900">Filter permintaan</p>

            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Jenis konseling
            </p>
            <div className="mt-2 space-y-2">
              {(["Semua", "Individu", "Kelompok"] as const).map((item) => {
                const selected = typeFilter === item;
                return (
                  <button
                    key={item}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setTypeFilter(item)}
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

            <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-gray-500">Urutan</p>
            <div className="mt-2 space-y-2">
              {(
                [
                  ["terlama", "Terlama (Prioritas Antrean)"],
                  ["terbaru", "Terbaru Diajukan"],
                ] as const
              ).map(([value, label]) => {
                const selected = sortOrder === value;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setSortOrder(value)}
                    className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-sm font-semibold ${
                      selected
                        ? "border-[#064E3B] bg-emerald-50 text-[#064E3B]"
                        : "border-gray-200 text-gray-700"
                    }`}
                  >
                    {label}
                    {selected && <CheckCircle2 className="h-4 w-4" />}
                  </button>
                );
              })}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setTypeFilter("Semua");
                  setSortOrder("terlama");
                }}
                className="rounded-xl border border-gray-300 py-3 text-sm font-semibold text-gray-700"
              >
                Atur ulang
              </button>
              <button
                type="button"
                onClick={() => setFilterSheetOpen(false)}
                className="rounded-xl bg-[#064E3B] py-3 text-sm font-semibold text-white"
              >
                Terapkan
              </button>
            </div>
          </div>
        </div>
      )}

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
