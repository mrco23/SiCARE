import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarClock, FileText, RefreshCw, Users, XCircle } from "lucide-react";
import { PageHeader } from "../../components/shared";
import { InformedConsentModal } from "../../components/consent/InformedConsentModal";
import { GroupConsentModal } from "../../components/consent/GroupConsentModal";
import { sicareApi, type BookingRecordApi } from "../../lib/sicareApi";
import {
  getPublicAvailability,
  getPublicCounselors,
  type PublicAvailabilitySlot,
} from "../../lib/publicApi";
import { ApiError } from "../../lib/api";
import type { BookingStatusApi } from "../../types/api";

const dateTime = (value: string) =>
  new Date(value).toLocaleString("id-ID", {
    dateStyle: "full",
    timeStyle: "short",
  });

const labels: Record<BookingStatusApi, string> = {
  waiting_confirmation: "Menunggu konfirmasi",
  confirmed: "Dikonfirmasi",
  rejected: "Ditolak",
  reschedule_requested: "Perlu penjadwalan ulang",
  cancelled: "Dibatalkan",
};

const statusBadgeStyles: Record<BookingStatusApi, string> = {
  waiting_confirmation: "bg-amber-50 text-amber-800",
  confirmed: "bg-primary-soft text-primary",
  reschedule_requested: "bg-amber-100 text-amber-900",
  rejected: "bg-red-50 text-red-700",
  cancelled: "bg-slate-100 text-slate-700",
};

type StatusFilter = "all" | BookingStatusApi;

const filterOptions: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "Semua status" },
  { value: "waiting_confirmation", label: "Menunggu konfirmasi" },
  { value: "confirmed", label: "Dikonfirmasi" },
  { value: "reschedule_requested", label: "Perlu penjadwalan ulang" },
  { value: "rejected", label: "Ditolak" },
  { value: "cancelled", label: "Dibatalkan" },
];

function formatActionError(cause: unknown, fallback: string): string {
  if (cause instanceof ApiError) {
    if (cause.status === 401) {
      return "Sesi login berakhir. Silakan masuk kembali.";
    }
    if (cause.status === 403) {
      return cause.message || "Anda tidak memiliki izin untuk mengubah booking ini.";
    }
    if (cause.status === 404) {
      return cause.message || "Data booking tidak ditemukan.";
    }
    if (cause.status === 409) {
      return (
        cause.message ||
        "Status booking atau ketersediaan jadwal telah berubah. Silakan muat ulang halaman."
      );
    }
    return cause.message;
  }
  if (cause instanceof Error) return cause.message;
  return fallback;
}

export default function KlienAktivitasPage() {
  const [bookings, setBookings] = useState<BookingRecordApi[]>([]);
  const [counselorNames, setCounselorNames] = useState<Record<string, string>>({});
  const [availableSlots, setAvailableSlots] = useState<PublicAvailabilitySlot[]>([]);
  const [replacementByBooking, setReplacementByBooking] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const [activeConsentBookingId, setActiveConsentBookingId] = useState<string | null>(null);
  const [activeGroupConsentBookingId, setActiveGroupConsentBookingId] = useState<string | null>(null);

  const fetchActivity = useCallback(async () => {
    const from = new Date();
    const to = new Date(from.getTime() + 90 * 24 * 60 * 60 * 1000);
    const [bookingRows, slots, counselors] = await Promise.all([
      sicareApi.bookings(100),
      getPublicAvailability({ from, to, limit: 100 }).catch(
        () => [] as PublicAvailabilitySlot[],
      ),
      getPublicCounselors().catch(() => []),
    ]);
    const currentTime = Date.now();
    return {
      bookingRows,
      currentTime,
      slots: slots.filter(
        (slot) =>
          slot.status === "available" && Date.parse(slot.starts_at) > currentTime,
      ),
      counselors: Object.fromEntries(
        counselors.map((counselor) => [
          counselor.profile_id,
          counselor.public_name,
        ]),
      ),
    };
  }, []);

  const applyActivity = useCallback(
    (result: Awaited<ReturnType<typeof fetchActivity>>) => {
      setBookings(result.bookingRows);
      setNow(result.currentTime);
      setAvailableSlots(result.slots);
      setCounselorNames(result.counselors);
      setError("");
    },
    [],
  );

  const reportLoadError = useCallback((cause: unknown) => {
    setError(formatActionError(cause, "Aktivitas booking tidak dapat dimuat."));
  }, []);

  useEffect(() => {
    let active = true;
    void fetchActivity()
      .then((result) => {
        if (active) applyActivity(result);
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
  }, [fetchActivity, applyActivity, reportLoadError]);

  const cancel = async (booking: BookingRecordApi) => {
    const reason = reasons[booking.id]?.trim() ?? "";
    if (!reason) {
      setError("Alasan pembatalan wajib diisi.");
      return;
    }
    if (reason.length < 3) {
      setError("Alasan pembatalan minimal 3 karakter.");
      return;
    }
    if (reason.length > 1000) {
      setError("Alasan pembatalan maksimal 1000 karakter.");
      return;
    }
    setBusyId(booking.id);
    setError("");
    try {
      const updated = await sicareApi.transitionBooking(booking.id, {
        status: "cancelled",
        reason,
      });
      setBookings((previous) =>
        previous.map((item) => (item.id === updated.id ? updated : item)),
      );
      setReasons((previous) => ({ ...previous, [booking.id]: "" }));
      const refreshedActivity = await fetchActivity();
      applyActivity(refreshedActivity);
    } catch (cause) {
      setError(formatActionError(cause, "Booking tidak dapat dibatalkan."));
    } finally {
      setBusyId(null);
    }
  };

  const reschedule = async (booking: BookingRecordApi) => {
    const slotId = replacementByBooking[booking.id];
    if (!slotId) {
      setError("Pilih jadwal pengganti terlebih dahulu.");
      return;
    }
    setBusyId(booking.id);
    setError("");
    try {
      const updated = await sicareApi.rescheduleBooking(booking.id, slotId);
      setBookings((previous) =>
        previous.map((item) => (item.id === updated.id ? updated : item)),
      );
      setReplacementByBooking((previous) => ({ ...previous, [booking.id]: "" }));
      const refreshedActivity = await fetchActivity();
      applyActivity(refreshedActivity);
    } catch (cause) {
      setError(
        formatActionError(
          cause,
          "Permintaan jadwal ulang tidak dapat dikirim.",
        ),
      );
    } finally {
      setBusyId(null);
    }
  };

  const refresh = () => {
    setLoading(true);
    setError("");
    void fetchActivity()
      .then(applyActivity)
      .catch(reportLoadError)
      .finally(() => setLoading(false));
  };

  const filteredBookings = useMemo(
    () =>
      statusFilter === "all"
        ? bookings
        : bookings.filter((booking) => booking.status === statusFilter),
    [bookings, statusFilter],
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Aktivitas Saya"
        description="Pantau permintaan konseling dan status terbaru dari backend SiCARE."
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

      {bookings.length > 0 && (
        <div
          role="group"
          aria-label="Filter status booking"
          className="flex flex-wrap gap-2"
        >
          {filterOptions.map((option) => {
            const selected = statusFilter === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setStatusFilter(option.value)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                  selected
                    ? "bg-primary text-white"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      {loading && (
        <p
          role="status"
          className="rounded-xl bg-white p-4 text-sm text-slate-600"
        >
          Memuat aktivitas...
        </p>
      )}

      {!loading && filteredBookings.length > 0 ? (
        <div className="space-y-4">
          {filteredBookings.map((booking) => {
            const counselorName =
              counselorNames[booking.counselor_id] ?? "Konselor";
            return (
              <article
                key={booking.id}
                className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-bold text-slate-900">{counselorName}</h2>
                    <p className="mt-1 text-sm text-slate-600">
                      <CalendarClock className="mr-1 inline h-4 w-4" />
                      {dateTime(booking.starts_at)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {booking.service_type === "group"
                        ? `Kelompok: ${booking.group_name ?? "-"} · ${booking.participant_count} peserta`
                        : "Konseling individu"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {["waiting_confirmation", "confirmed"].includes(booking.status) && (
                      <>
                        <button
                          type="button"
                          onClick={() => setActiveConsentBookingId(booking.id)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-900 transition hover:bg-emerald-100"
                        >
                          <FileText className="h-3.5 w-3.5 text-emerald-800" />
                          <span>Informed Consent</span>
                        </button>
                        {booking.service_type === "group" && (
                          <button
                            type="button"
                            onClick={() => setActiveGroupConsentBookingId(booking.id)}
                            className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-900 transition hover:bg-blue-100"
                          >
                            <Users className="h-3.5 w-3.5 text-blue-700" />
                            <span>Status Kelompok</span>
                          </button>
                        )}
                      </>
                    )}
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${
                        statusBadgeStyles[booking.status] ??
                        "bg-primary-soft text-primary"
                      }`}
                    >
                      {labels[booking.status] ?? booking.status}
                    </span>
                  </div>
                </div>

                {booking.status === "rejected" && booking.cancellation_reason && (
                  <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-800">
                    <p className="font-semibold">Permintaan ditolak oleh konselor</p>
                    <p className="mt-0.5 text-xs">
                      Alasan: {booking.cancellation_reason}
                    </p>
                  </div>
                )}

                {booking.status === "cancelled" && booking.cancellation_reason && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                    <p className="font-semibold">Booking dibatalkan</p>
                    <p className="mt-0.5 text-xs">
                      Alasan: {booking.cancellation_reason}
                    </p>
                  </div>
                )}

                {booking.status === "reschedule_requested" && (
                  <div className="space-y-2 rounded-xl bg-amber-50 p-3">
                    <p className="text-sm font-semibold text-amber-900">
                      Konselor meminta penjadwalan ulang.
                    </p>
                    {booking.reschedule_reason && (
                      <p className="text-sm text-amber-800">
                        Alasan: {booking.reschedule_reason}
                      </p>
                    )}
                    <label className="block text-xs font-semibold text-amber-900">
                      Pilih jadwal pengganti
                      <select
                        value={replacementByBooking[booking.id] ?? ""}
                        onChange={(event) =>
                          setReplacementByBooking((previous) => ({
                            ...previous,
                            [booking.id]: event.target.value,
                          }))
                        }
                        className="mt-1 w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm text-slate-800"
                      >
                        <option value="">Pilih jadwal tersedia</option>
                        {availableSlots
                          .filter(
                            (candidate) =>
                              candidate.counselor_id === booking.counselor_id &&
                              candidate.id !== booking.availability_slot_id &&
                              Date.parse(candidate.starts_at) > now,
                          )
                          .map((candidate) => (
                            <option key={candidate.id} value={candidate.id}>
                              {new Date(candidate.starts_at).toLocaleString(
                                "id-ID",
                                { dateStyle: "medium", timeStyle: "short" },
                              )}
                            </option>
                          ))}
                      </select>
                    </label>
                    {!availableSlots.some(
                      (candidate) =>
                        candidate.counselor_id === booking.counselor_id &&
                        candidate.id !== booking.availability_slot_id &&
                        Date.parse(candidate.starts_at) > now,
                    ) && (
                      <p className="text-xs text-amber-800">
                        Belum ada jadwal pengganti yang tersedia dalam 90 hari ke
                        depan. Silakan coba lagi nanti.
                      </p>
                    )}
                    <button
                      type="button"
                      disabled={
                        busyId === booking.id || !replacementByBooking[booking.id]
                      }
                      onClick={() => void reschedule(booking)}
                      className="rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      {busyId === booking.id
                        ? "Mengirim..."
                        : "Kirim permintaan jadwal ulang"}
                    </button>
                  </div>
                )}

                {["waiting_confirmation", "confirmed", "reschedule_requested"].includes(
                  booking.status,
                ) && (
                  <div className="space-y-2 border-t border-slate-100 pt-3">
                    <label className="block text-xs font-semibold text-slate-600">
                      Alasan pembatalan
                      <input
                        value={reasons[booking.id] ?? ""}
                        onChange={(event) =>
                          setReasons((previous) => ({
                            ...previous,
                            [booking.id]: event.target.value,
                          }))
                        }
                        maxLength={1000}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        placeholder="Jelaskan alasan jika ingin membatalkan"
                      />
                    </label>
                    <button
                      type="button"
                      disabled={busyId === booking.id}
                      onClick={() => void cancel(booking)}
                      className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                    >
                      <XCircle className="h-4 w-4" />{" "}
                      {busyId === booking.id
                        ? "Membatalkan..."
                        : "Batalkan booking"}
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        !loading && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <p className="font-semibold text-slate-700">
              {bookings.length === 0
                ? "Belum ada aktivitas booking."
                : "Tidak ada booking untuk filter status ini."}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {bookings.length === 0
                ? "Jika ingin membuat janji, lihat daftar konselor dan pilih jadwal yang tersedia."
                : "Pilih filter Semua status untuk melihat seluruh riwayat permintaan konseling."}
            </p>
            {bookings.length === 0 ? (
              <Link
                to="/klien/pesanan"
                className="mt-4 inline-flex rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white"
              >
                Buat booking
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                className="mt-4 inline-flex rounded-xl border border-primary px-4 py-2 text-sm font-semibold text-primary"
              >
                Tampilkan semua status
              </button>
            )}
          </div>
        )
      )}

      {activeConsentBookingId && (
        <InformedConsentModal
          bookingId={activeConsentBookingId}
          isOpen={Boolean(activeConsentBookingId)}
          onClose={() => setActiveConsentBookingId(null)}
          onSuccess={refresh}
        />
      )}

      {activeGroupConsentBookingId && (
        <GroupConsentModal
          bookingId={activeGroupConsentBookingId}
          isOpen={Boolean(activeGroupConsentBookingId)}
          onClose={() => setActiveGroupConsentBookingId(null)}
        />
      )}
    </div>
  );
}
