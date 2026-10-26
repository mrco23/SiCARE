import { PageContainer, PageHeader } from "../../components/shared";
import { COUNSELOR_WORKLOAD, DASHBOARD_COUNTS, WEEKLY_SESSIONS } from "../../data/mock/dashboardOverview";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Ban,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  Inbox,
  Users,
} from "lucide-react";

type Metric = {
  label: string;
  value: number;
  note: string;
  icon: typeof Inbox;
  iconClass: string;
};

const metrics: Metric[] = [
  {
    label: "Total Permintaan",
    value: DASHBOARD_COUNTS.totalRequests,
    note: "Permintaan konseling",
    icon: Inbox,
    iconClass: "bg-emerald-50 text-emerald-700",
  },
  {
    label: "Sesi Selesai",
    value: DASHBOARD_COUNTS.completedSessions,
    note: "Sudah terlaksana",
    icon: CheckCircle2,
    iconClass: "bg-blue-50 text-blue-700",
  },
  {
    label: "Menunggu Konfirmasi",
    value: DASHBOARD_COUNTS.pending,
    note: "Perlu ditindaklanjuti",
    icon: Clock3,
    iconClass: "bg-amber-50 text-amber-700",
  },
  {
    label: "Dibatalkan",
    value: DASHBOARD_COUNTS.cancelled,
    note: "Permintaan dibatalkan",
    icon: Ban,
    iconClass: "bg-red-50 text-red-700",
  },
];

const weeklySessions = WEEKLY_SESSIONS;

const counselors = COUNSELOR_WORKLOAD.map((counselor) => ({
  name: counselor.name,
  sessions: counselor.sessions,
  status: counselor.availability === "available" ? "Tersedia" : "Jadwal penuh",
  statusClass:
    counselor.availability === "available"
      ? "bg-emerald-50 text-emerald-700"
      : "bg-amber-50 text-amber-700",
}));

function MetricCards() {
  return (
    <section
      aria-label="Ringkasan statistik"
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
    >
      {metrics.map(({ label, value, note, icon: Icon, iconClass }) => (
        <article
          key={label}
          className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
              {value}
            </p>
            <p className="mt-1 text-xs text-slate-400">{note}</p>
          </div>
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconClass}`}
          >
            <Icon className="h-5 w-5" />
          </span>
        </article>
      ))}
    </section>
  );
}

function ActivitySummary() {
  const total = weeklySessions.reduce((sum, week) => sum + week.value, 0);
  const maxValue = Math.max(...weeklySessions.map((week) => week.value));

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900">
            Aktivitas konseling
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Ringkasan sesi per minggu pada bulan ini.
          </p>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold text-slate-900">{total}</p>
          <p className="text-[11px] text-slate-400">total sesi</p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-4 gap-3">
        {weeklySessions.map((week) => (
          <div key={week.label} className="min-w-0">
            <div className="flex h-20 items-end rounded-lg bg-slate-50 p-1">
              <div
                title={`${week.value} sesi`}
                className={`w-full rounded-md ${week.value === maxValue ? "bg-[#15803d]" : "bg-emerald-200"}`}
                style={{
                  height: `${Math.max((week.value / maxValue) * 100, 8)}%`,
                }}
              />
            </div>
            <p className="mt-2 truncate text-center text-[10px] font-medium text-slate-500 sm:text-xs">
              {week.label}
            </p>
            <p className="text-center text-xs font-bold text-slate-700">
              {week.value}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function CounselorSummary() {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Status konselor</h2>
          <p className="mt-1 text-xs text-slate-500">
            Ikhtisar singkat ketersediaan dan sesi.
          </p>
        </div>
        <Users className="h-5 w-5 text-slate-400" />
      </div>

      <div className="mt-4 divide-y divide-slate-100">
        {counselors.map((counselor) => (
          <div
            key={counselor.name}
            className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-800">
                {counselor.name}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {counselor.sessions} sesi selesai bulan ini
              </p>
            </div>
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${counselor.statusClass}`}
            >
              {counselor.status}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function AdminBerandaPage() {
  const navigate = useNavigate();

  return (
    <PageContainer role="headlmi" spacing="none" className="space-y-5 text-slate-800">
      <PageHeader
        eyebrow="Beranda Kepala LMI"
        title="Ringkasan Konseling"
        description="Pantau kondisi layanan dan tindak lanjut utama."
        actions={
          <button
            type="button"
            onClick={() => navigate("/admin/laporan")}
            className="inline-flex items-center justify-center gap-2 self-start rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark sm:self-auto"
          >
            Lihat laporan lengkap
            <ArrowRight className="h-4 w-4" />
          </button>
        }
      />

      <MetricCards />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <ActivitySummary />
        </div>
        <div className="xl:col-span-2">
          <CounselorSummary />
        </div>
      </div>

      <p className="flex items-center gap-2 px-1 text-xs text-slate-400">
        <CalendarCheck className="h-3.5 w-3.5 shrink-0" />
        Data yang ditampilkan merupakan data contoh dan dapat dihubungkan ke
        API.
      </p>
    </PageContainer>
  );
}
