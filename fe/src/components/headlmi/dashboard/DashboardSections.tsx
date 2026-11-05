import { SkeletonBlock } from "../../shared/Skeleton";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Inbox,
  RefreshCw,
  Star,
  UserCheck,
  Users,
} from "lucide-react";
import type { AdminDashboardDto, AdminReportDto } from "../../../types/api";
import { fillMonthlyRange, formatMonthKey, formatRating } from "../../../features/headlmi/shared/presentation";

type Metric = {
  label: string;
  value: number;
  note: string;
  icon: typeof Inbox;
  iconClass: string;
};

function SectionState({
  loading,
  error,
  onRetry,
  minHeight = "h-28",
  children,
}: {
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  minHeight?: string;
  children: ReactNode;
}) {
  if (loading) {
    return (
      <SkeletonBlock bare lines={4} label="Memuat data…" className={minHeight} />
    );
  }
  if (error) {
    return (
      <div className={`flex ${minHeight} flex-col items-center justify-center gap-3 text-center`}>
        <p className="flex items-center gap-2 text-sm text-red-600">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Coba lagi
        </button>
      </div>
    );
  }
  return <>{children}</>;
}

// Beranda hanya menampilkan ringkasan utama; rincian status ada di halaman Laporan.
function buildMetrics(dashboard: AdminDashboardDto): Metric[] {
  return [
    {
      label: "Total Booking",
      value: dashboard.bookings.total,
      note: "Seluruh booking tercatat",
      icon: Inbox,
      iconClass: "bg-emerald-50 text-emerald-700",
    },
    {
      label: "Sesi Selesai",
      value: dashboard.sessions.completed,
      note: `Dari ${dashboard.sessions.total} sesi`,
      icon: CheckCircle2,
      iconClass: "bg-blue-50 text-blue-700",
    },
    {
      label: "Klien Aktif",
      value: dashboard.users.active_clients,
      note: "Akun klien aktif",
      icon: Users,
      iconClass: "bg-amber-50 text-amber-700",
    },
    {
      label: "Konselor Aktif",
      value: dashboard.users.active_counselors,
      note: "Akun konselor aktif",
      icon: UserCheck,
      iconClass: "bg-violet-50 text-violet-700",
    },
  ];
}

function MetricTile({ label, value, note, icon: Icon, iconClass }: Metric) {
  return (
    <article className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
        <p className="mt-1 text-xs text-slate-400">{note}</p>
      </div>
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconClass}`}>
        <Icon className="h-5 w-5" />
      </span>
    </article>
  );
}

export function MetricCards({
  dashboard,
  loading,
  error,
  onRetry,
}: {
  dashboard: AdminDashboardDto | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  if (loading || error || !dashboard) {
    return (
      <section
        aria-label="Ringkasan statistik"
        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <SectionState
          loading={loading}
          error={error ?? (!dashboard ? "Ringkasan statistik belum tersedia." : null)}
          onRetry={onRetry}
        >
          {null}
        </SectionState>
      </section>
    );
  }

  return (
    <section
      aria-label="Ringkasan statistik"
      className="grid grid-cols-2 gap-3 xl:grid-cols-4"
    >
      {buildMetrics(dashboard).map((metric) => (
        <MetricTile key={metric.label} {...metric} />
      ))}
    </section>
  );
}

export function ActivitySummary({
  report,
  loading,
  error,
  onRetry,
}: {
  report: AdminReportDto | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  const months = report ? fillMonthlyRange(report).slice(-6) : [];
  const total = months.reduce((sum, month) => sum + month.completed_sessions, 0);
  const maxValue = Math.max(1, ...months.map((month) => month.completed_sessions));
  const hasActivity = months.some(
    (month) => month.completed_sessions > 0 || month.bookings > 0 || month.feedback_count > 0,
  );

  return (
    <section className="h-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Aktivitas konseling</h2>
          <p className="mt-1 text-xs text-slate-500">
            Sesi selesai per bulan pada 6 bulan terakhir rentang laporan.
          </p>
        </div>
        {report && !loading && !error && (
          <div className="text-right">
            <p className="text-xl font-bold text-slate-900">{total}</p>
            <p className="text-[11px] text-slate-400">sesi selesai</p>
          </div>
        )}
      </div>

      <SectionState
        loading={loading}
        error={error ?? (!report ? "Data aktivitas belum tersedia." : null)}
        onRetry={onRetry}
        minHeight="h-40"
      >
        {!hasActivity ? (
          <div className="flex h-40 items-center justify-center text-center text-sm text-slate-400">
            Belum ada aktivitas booking, sesi, atau feedback pada 6 bulan terakhir.
          </div>
        ) : (
          <>
            <div
              className="mt-5 grid gap-3"
              style={{ gridTemplateColumns: `repeat(${Math.max(months.length, 1)}, minmax(0, 1fr))` }}
            >
              {months.map((month) => (
                <div key={month.month} className="min-w-0">
                  <div className="flex h-20 items-end rounded-lg bg-slate-50 p-1">
                    <div
                      title={`${formatMonthKey(month.month)}: ${month.completed_sessions} sesi selesai, ${month.bookings} booking, ${month.feedback_count} feedback`}
                      className={`w-full rounded-md ${month.completed_sessions === maxValue && month.completed_sessions > 0 ? "bg-[#15803d]" : "bg-emerald-200"}`}
                      style={{
                        height: `${month.completed_sessions > 0 ? Math.max((month.completed_sessions / maxValue) * 100, 8) : 4}%`,
                      }}
                    />
                  </div>
                  <p className="mt-2 truncate text-center text-[10px] font-medium text-slate-500 sm:text-xs">
                    {formatMonthKey(month.month, false)}
                  </p>
                  <p className="text-center text-xs font-bold text-slate-700">{month.completed_sessions}</p>
                  <p className="truncate text-center text-[10px] text-slate-400">
                    {month.bookings} booking
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-[11px] text-slate-400">
              Arahkan kursor ke batang untuk melihat jumlah booking dan feedback per bulan.
            </p>
          </>
        )}
      </SectionState>
    </section>
  );
}

export function CounselorSummary({
  report,
  loading,
  error,
  onRetry,
}: {
  report: AdminReportDto | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  const counselors = report
    ? [...report.counselors]
        .sort((a, b) => b.completed_sessions - a.completed_sessions || b.bookings - a.bookings)
        .slice(0, 5)
    : [];

  return (
    <section className="h-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Ringkasan konselor</h2>
          <p className="mt-1 text-xs text-slate-500">
            Aktivitas konselor aktif pada rentang laporan.
          </p>
        </div>
        <Users className="h-5 w-5 text-slate-400" />
      </div>

      <SectionState
        loading={loading}
        error={error ?? (!report ? "Data konselor belum tersedia." : null)}
        onRetry={onRetry}
        minHeight="h-40"
      >
        {counselors.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-center text-sm text-slate-400">
            Belum ada konselor aktif yang tercatat.
          </div>
        ) : (
          <div className="mt-4 divide-y divide-slate-100">
            {counselors.map((counselor) => (
              <div
                key={counselor.counselor_id}
                className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">
                    {counselor.counselor_name || "Konselor"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {counselor.completed_sessions} sesi selesai · {counselor.bookings} booking
                  </p>
                </div>
                <span
                  className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                    counselor.average_rating !== null
                      ? "bg-amber-50 text-amber-700"
                      : "bg-slate-100 text-slate-500"
                  }`}
                  title={`${counselor.feedback_count} feedback`}
                >
                  {counselor.average_rating !== null ? (
                    <>
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                      {formatRating(counselor.average_rating)}
                    </>
                  ) : (
                    "Belum ada rating"
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </SectionState>
    </section>
  );
}
