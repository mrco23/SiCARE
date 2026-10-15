import { useState, type ElementType } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  ArrowUp,
  Ban,
  CircleCheck,
  Circle,
  Clock,
  FileSpreadsheet,
  Inbox,
} from "lucide-react";

/* ========================= DATA (ganti dengan data dari API) ========================= */
const periodFilters = ["Hari Ini", "Minggu Ini", "Bulan Ini", "Semua"] as const;

type Metric = {
  label: string;
  value: number;
  note: string;
  icon: ElementType;
  noteClass: string;
  iconClass: string;
  showArrow?: boolean;
};

const metrics: Metric[] = [
  {
    label: "Total Permintaan",
    value: 124,
    note: "Keseluruhan booking",
    icon: Inbox,
    noteClass: "text-emerald-600",
    iconClass: "bg-emerald-50 text-[#15803d] border-emerald-100",
    showArrow: true,
  },
  {
    label: "Sesi Selesai",
    value: 98,
    note: "Status: Completed",
    icon: CircleCheck,
    noteClass: "text-slate-500",
    iconClass: "bg-blue-50 text-blue-600 border-blue-100",
  },
  {
    label: "Dibatalkan",
    value: 8,
    note: "Status: Cancelled",
    icon: Ban,
    noteClass: "text-red-600",
    iconClass: "bg-red-50 text-red-600 border-red-100",
  },
  {
    label: "Menunggu Konfirmasi",
    value: 5,
    note: "Status: Waiting",
    icon: Clock,
    noteClass: "text-amber-600",
    iconClass: "bg-amber-50 text-amber-600 border-amber-100",
  },
];

const weeklySessions = [
  { label: "Minggu 1", value: 14 },
  { label: "Minggu 2", value: 30 },
  { label: "Minggu 3", value: 20 },
  { label: "Minggu 4", value: 16 },
];

const serviceDistribution = { individu: 78, kelompok: 22, total: 124 };

const counselors = [
  {
    name: "Ma'am Giovanna Yudi, M.Psi",
    avatar:
      "https://ui-avatars.com/api/?name=Giovanna+Yudi&background=15803d&color=fff",
    sessions: 24,
    status: "AVAILABLE",
    statusClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  {
    name: "Dr. Budi Santoso, Psikolog",
    avatar:
      "https://ui-avatars.com/api/?name=Budi+Santoso&background=475569&color=fff",
    sessions: 19,
    status: "FULLY BOOKED",
    statusClass: "bg-amber-50 text-amber-700 border-amber-200",
  },
];

/* ========================= KARTU METRIK ========================= */
function MetricCards() {
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
function SessionTrend() {
  const maxValue = Math.max(...weeklySessions.map((w) => w.value));
  const total = weeklySessions.reduce((sum, w) => sum + w.value, 0);
  // Skala sedikit di atas nilai tertinggi supaya bar tertinggi tidak penuh
  const scale = maxValue * 1.18;

  return (
    <div className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-800">
            Tren Aktivitas Konseling
          </h3>
          <p className="text-xs text-slate-400">
            Volume sesi berdasarkan akumulasi mingguan bulan ini.
          </p>
        </div>
        <span className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">
          Bulan Oktober
        </span>
      </div>

      <div className="flex h-64 items-end justify-between gap-4 border-b border-slate-100 px-4 pb-2 pt-8">
        {weeklySessions.map((week) => {
          const isTop = week.value === maxValue;
          return (
            <div
              key={week.label}
              style={{ height: `${(week.value / scale) * 100}%` }}
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

      <div className="mt-6 flex items-center justify-between text-xs font-medium text-slate-400">
        <p className="flex items-center gap-1">
          <Circle className="h-2.5 w-2.5 fill-[#15803d] text-[#15803d]" />
          Dihitung otomatis dari data transaksi sistem.
        </p>
        <p>Total Bulan Ini: {total} Sesi</p>
      </div>
    </div>
  );
}

/* ========================= DISTRIBUSI LAYANAN (DONUT) ========================= */
function ServiceDistribution() {
  const { individu, kelompok, total } = serviceDistribution;

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
          style={{
            background: `conic-gradient(#2563eb 0% ${individu}%, #9333ea ${individu}% 100%)`,
          }}
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
            <span>Individu ({individu}%)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full bg-purple-600" />
            <span>Kelompok ({kelompok}%)</span>
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
function CounselorWorkload() {
  const navigate = useNavigate();

  // Buka halaman konseling langsung di tampilan Detail Konselor untuk konselor ini
  const openDetail = (konselor: string) =>
    navigate("/admin/konseling", {
      state: { view: "detail", konselor },
    });

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col items-start justify-between gap-4 border-b border-slate-100 p-6 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-base font-bold text-slate-800">
            Status &amp; Beban Kerja Konselor
          </h3>
          <p className="text-xs text-slate-400">
            Monitor ketersediaan dan jumlah penanganan sesi aktif.
          </p>
        </div>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-xl bg-[#f0fdf4] px-4 py-2 text-xs font-bold text-[#15803d] transition-colors hover:bg-[#dcfce7]"
        >
          <FileSpreadsheet className="h-4 w-4" />
          Unduh Rekap Laporan
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <th className="px-6 py-4">Nama Konselor</th>
              <th className="px-6 py-4 text-center">
                Sesi Selesai (Bulan Ini)
              </th>
              <th className="px-6 py-4 text-center">Status Jadwal</th>
              <th className="px-6 py-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm font-medium text-slate-700">
            {counselors.map((c) => (
              <tr
                key={c.name}
                className="transition-colors hover:bg-slate-50/50"
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3 font-bold text-slate-800">
                    <img
                      src={c.avatar}
                      alt={c.name}
                      className="h-8 w-8 rounded-full"
                    />
                    {c.name}
                  </div>
                </td>
                <td className="px-6 py-4 text-center font-bold text-slate-800">
                  {c.sessions} Sesi
                </td>
                <td className="px-6 py-4 text-center">
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${c.statusClass}`}
                  >
                    {c.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <button
                    type="button"
                    onClick={() => openDetail(c.name)}
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
    </div>
  );
}

/* ========================= PAGE ========================= */
export default function AdminBerandaPage() {
  const [period, setPeriod] =
    useState<(typeof periodFilters)[number]>("Hari Ini");

  return (
    <div className="mx-auto max-w-7xl space-y-6 font-[Inter] text-slate-800">
      {/* Judul halaman + filter waktu */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-800">
            Dashboard Monitoring Konseling
          </h2>
          <p className="text-xs text-slate-500">
            Ringkasan statistik dan operasional layanan konseling kampus.
          </p>
        </div>

        <div className="flex items-center rounded-xl border border-slate-200 bg-slate-100 p-1 text-xs font-semibold text-slate-600">
          {periodFilters.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setPeriod(item)}
              className={`rounded-lg px-3 py-1.5 transition-colors ${
                period === item
                  ? "bg-white text-slate-800 shadow-sm"
                  : "hover:text-slate-900"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <MetricCards />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <SessionTrend />
        <ServiceDistribution />
      </div>

      <CounselorWorkload />
    </div>
  );
}
