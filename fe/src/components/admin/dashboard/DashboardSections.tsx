import type { ElementType } from "react";
import { useNavigate } from "react-router-dom";
import type {
  AdminCounselingDto,
  BookingStatusApi,
} from "../../../types/api";
import { formatIndonesianDate } from "../../../lib/dateUtils";
import {
  ArrowRight,
  ArrowUp,
  Ban,
  Circle,
  CircleCheck,
  Clock,
  Inbox,
} from "lucide-react";

/* ========================= TIPE DATA ========================= */

export interface DashboardMetricValues {
  totalRequests: number;
  completedSessions: number;
  cancelledSessions: number;
  waitingConfirmation: number;
  pendingModerationFeedback: number;
  activeClients: number;
  activeCounselors: number;
}

export interface TrendBucketItem {
  label: string;
  value: number;
}

export interface ServiceDistributionData {
  individuPct: number;
  kelompokPct: number;
  individuCount: number;
  kelompokCount: number;
  total: number;
}

export interface CounselorWorkloadRow {
  id: string;
  name: string;
  completedSessions: number;
  activeBookings: number;
  isActiveAccount: boolean;
}

type Metric = {
  label: string;
  value: number;
  note: string;
  icon: ElementType;
  noteClass: string;
  iconClass: string;
  showArrow?: boolean;
};

const initials = (n: string) =>
  n
    .replace(/[^A-Za-z ]/g, "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "KS";

const anonClient = (id: string) =>
  "Klien Anonim #" +
  (id.replace(/[^A-Fa-f0-9]/g, "").slice(-4) || "0000").toUpperCase();

/* ========================= KARTU METRIK ========================= */
export function MetricCards({ stats }: { stats: DashboardMetricValues }) {
  const metrics: Metric[] = [
    {
      label: "Total Permintaan",
      value: stats.totalRequests,
      note: `${stats.activeClients} klien aktif terdaftar`,
      icon: Inbox,
      noteClass: "text-emerald-600",
      iconClass: "bg-emerald-50 text-[#15803d] border-emerald-100",
      showArrow: true,
    },
    {
      label: "Sesi Selesai",
      value: stats.completedSessions,
      note: "Status: Completed",
      icon: CircleCheck,
      noteClass: "text-slate-500",
      iconClass: "bg-blue-50 text-blue-600 border-blue-100",
    },
    {
      label: "Dibatalkan",
      value: stats.cancelledSessions,
      note: "Status: Cancelled / Rejected",
      icon: Ban,
      noteClass: "text-red-600",
      iconClass: "bg-red-50 text-red-600 border-red-100",
    },
    {
      label: "Menunggu Konfirmasi",
      value: stats.waitingConfirmation,
      note: `${stats.pendingModerationFeedback} feedback menunggu moderasi`,
      icon: Clock,
      noteClass: "text-amber-600",
      iconClass: "bg-amber-50 text-amber-600 border-amber-100",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map(
        ({
          label,
          value,
          note,
          icon: Icon,
          noteClass,
          iconClass,
          showArrow,
        }) => (
          <div
            key={label}
            className="flex items-center justify-between rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div>
              <p className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-400">
                {label}
              </p>
              <h3 className="text-3xl font-bold text-slate-800">{value}</h3>
              <p
                className={`mt-1 flex items-center gap-0.5 text-xs font-semibold ${noteClass}`}
              >
                {showArrow && <ArrowUp className="h-3 w-3" />}
                {note}
              </p>
            </div>
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${iconClass}`}
            >
              <Icon className="h-5 w-5" />
            </div>
          </div>
        ),
      )}
    </div>
  );
}

/* ========================= TREN AKTIVITAS (BAR CHART) ========================= */
export function SessionTrend({
  buckets,
  periodLabel,
}: {
  buckets: TrendBucketItem[];
  periodLabel: string;
}) {
  const maxValue = Math.max(1, ...buckets.map((w) => w.value));
  const total = buckets.reduce((sum, w) => sum + w.value, 0);
  const scale = maxValue * 1.18;

  return (
    <div className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
      <div className="mb-6 flex items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-bold text-slate-800">
            Tren Aktivitas Konseling
          </h3>
          <p className="text-xs text-slate-400">
            Volume booking dan sesi konseling berdasarkan data aktual sistem.
          </p>
        </div>
        <span className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">
          {periodLabel}
        </span>
      </div>

      {buckets.length === 0 ? (
        <div className="flex h-64 items-center justify-center border-b border-slate-100 text-xs text-slate-400">
          Belum ada data tren pada rentang waktu ini.
        </div>
      ) : (
        <div className="flex h-64 items-end justify-between gap-4 border-b border-slate-100 px-4 pb-2 pt-8">
          {buckets.map((week) => {
            const isTop = week.value > 0 && week.value === maxValue;
            const barPct =
              week.value > 0 ? Math.max(8, (week.value / scale) * 100) : 4;
            return (
              <div
                key={week.label}
                style={{ height: `${barPct}%` }}
                className={`group relative w-full rounded-t-xl transition-all ${
                  isTop
                    ? "bg-[#15803d] shadow-sm"
                    : "bg-slate-100 hover:bg-[#22c55e]"
                }`}
              >
                <span className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                  {week.value} Sesi
                </span>
                <p
                  className={`absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] font-bold ${
                    isTop ? "text-slate-800" : "text-slate-400"
                  }`}
                >
                  {week.label}
                </p>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-6 flex items-center justify-between text-xs font-medium text-slate-400">
        <p className="flex items-center gap-1">
          <Circle className="h-2.5 w-2.5 fill-[#15803d] text-[#15803d]" />
          Dihitung otomatis dari data transaksi sistem.
        </p>
        <p>Total Rentang Ini: {total} Sesi</p>
      </div>
    </div>
  );
}

/* ========================= DISTRIBUSI LAYANAN (DONUT) ========================= */
export function ServiceDistribution({
  distribution,
}: {
  distribution: ServiceDistributionData;
}) {
  const { individuPct, kelompokPct, individuCount, kelompokCount, total } =
    distribution;
  const gradient =
    total > 0
      ? `conic-gradient(#2563eb 0% ${individuPct}%, #9333ea ${individuPct}% 100%)`
      : `conic-gradient(#e2e8f0 0% 100%)`;

  return (
    <div className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h3 className="mb-1 text-base font-bold text-slate-800">
          Distribusi Layanan
        </h3>
        <p className="mb-4 text-xs text-slate-400">
          Perbandingan jenis konseling.
        </p>
      </div>

      <div className="my-auto flex flex-col items-center justify-center py-2">
        <div
          className="relative flex h-36 w-36 items-center justify-center rounded-full shadow-inner"
          style={{ background: gradient }}
        >
          <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-white shadow-sm">
            <span className="text-[10px] font-bold uppercase text-slate-400">
              Total
            </span>
            <span className="text-base font-extrabold text-slate-800">
              {total} Sesi
            </span>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-6 text-xs font-bold text-slate-600">
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full bg-blue-600" />
            <span>
              Individu ({individuCount} · {individuPct}%)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full bg-purple-600" />
            <span>
              Kelompok ({kelompokCount} · {kelompokPct}%)
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 border-t border-slate-100 pt-3">
        <p className="text-center text-[11px] font-medium text-slate-400">
          Data menyesuaikan filter waktu di atas.
        </p>
      </div>
    </div>
  );
}

/* ========================= BEBAN KERJA KONSELOR ========================= */
export function CounselorWorkload({
  counselors,
}: {
  counselors: CounselorWorkloadRow[];
}) {
  const navigate = useNavigate();

  const openDetail = (row: CounselorWorkloadRow) =>
    navigate("/admin/konseling", {
      state: { view: "detail", counselorId: row.id, konselor: row.name },
    });

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col items-start justify-between gap-4 border-b border-slate-100 p-6 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-base font-bold text-slate-800">
            Status &amp; Beban Kerja Konselor
          </h3>
          <p className="text-xs text-slate-400">
            Monitor ketersediaan dan jumlah penanganan sesi konselor.
          </p>
        </div>
      </div>

      {counselors.length === 0 ? (
        <div className="py-12 text-center text-sm text-slate-400">
          Belum ada data konselor terdaftar.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <th className="px-6 py-4">Nama Konselor</th>
                <th className="px-6 py-4 text-center">Sesi Selesai</th>
                <th className="px-6 py-4 text-center">Jadwal Aktif</th>
                <th className="px-6 py-4 text-center">Status Akun</th>
                <th className="px-6 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm font-medium text-slate-700">
              {counselors.map((c) => (
                <tr
                  key={c.id}
                  className="transition-colors hover:bg-slate-50/50"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3 font-bold text-slate-800">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xs font-bold text-[#15803d]">
                        {initials(c.name)}
                      </div>
                      {c.name}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center font-bold text-slate-800">
                    {c.completedSessions} Sesi
                  </td>
                  <td className="px-6 py-4 text-center text-slate-600">
                    {c.activeBookings} Jadwal
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${
                        c.isActiveAccount
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-slate-100 text-slate-500"
                      }`}
                    >
                      {c.isActiveAccount ? "AKTIF" : "NONAKTIF"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => openDetail(c)}
                      className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#15803d] transition-colors hover:bg-[#f0fdf4]"
                    >
                      Lihat detail
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function RecentClientBookings({
  bookings,
}: {
  bookings: AdminCounselingDto[];
}) {
  if (bookings.length === 0) return null;

  const statusLabel: Record<BookingStatusApi, string> = {
    waiting_confirmation: "Menunggu konfirmasi",
    confirmed: "Dikonfirmasi",
    rejected: "Ditolak",
    reschedule_requested: "Perubahan jadwal",
    cancelled: "Dibatalkan",
  };

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-800">
            Booking terbaru dari Klien
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Permintaan jadwal konseling terbaru yang tercatat di sistem.
          </p>
        </div>
        <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">
          {bookings.length} booking
        </span>
      </div>
      <ul className="mt-4 divide-y divide-slate-100">
        {bookings.slice(0, 4).map((booking) => {
          const clientLabel = anonClient(
            booking.client?.id || booking.client_id || booking.id,
          );
          const counselorLabel =
            booking.counselor?.full_name?.trim() ||
            `Konselor #${booking.counselor_id.slice(0, 6).toUpperCase()}`;
          const startDate = new Date(booking.starts_at);
          const timeText = startDate.toLocaleTimeString("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
          });
          const isCompletedSession = booking.counseling_sessions?.some(
            (s) => s.status === "completed",
          );
          const displayStatusLabel = isCompletedSession
            ? "Selesai"
            : (statusLabel[booking.status] ?? booking.status);

          return (
            <li
              key={booking.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800">
                  {clientLabel}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {counselorLabel} ·{" "}
                  {booking.service_type === "group" ? "Kelompok" : "Individu"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {formatIndonesianDate(startDate, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}{" "}
                  · {timeText} WITA
                </p>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                  booking.status === "waiting_confirmation"
                    ? "bg-amber-50 text-amber-700"
                    : booking.status === "confirmed" || isCompletedSession
                      ? "bg-emerald-50 text-emerald-700"
                      : booking.status === "rejected" ||
                          booking.status === "cancelled"
                        ? "bg-red-50 text-red-700"
                        : "bg-slate-100 text-slate-600"
                }`}
              >
                {displayStatusLabel}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
