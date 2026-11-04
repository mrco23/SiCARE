import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  PageContainer,
  PageHeader,
  SectionErrorBoundary,
  SkeletonBlock,
  SkeletonStatGrid,
} from "../../components/shared";
import {
  CounselorWorkload,
  MetricCards,
  RecentClientBookings,
  ServiceDistribution,
  SessionTrend,
  type CounselorWorkloadRow,
  type DashboardMetricValues,
  type ServiceDistributionData,
  type TrendBucketItem,
} from "../../components/admin/dashboard/DashboardSections";
import { periodFilters } from "../../features/admin/dashboard/dashboardConstants";
import {
  fmtDate,
  isInPeriod,
  mapAcademicPeriodDto,
  sortPeriods,
  toISO,
  type AcademicPeriod,
} from "../../lib/academicPeriods";
import { adminApi } from "../../lib/adminApi";
import { getPublicCounselors } from "../../lib/publicApi";
import { reportingApi } from "../../lib/reportingApi";
import type {
  AdminAccountDto,
  AdminCounselingDto,
  AdminDashboardDto,
  AdminReportDto,
} from "../../types/api";
import { Calendar, RefreshCw } from "lucide-react";

type PeriodFilter = (typeof periodFilters)[number];

const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

/** Semua bulan dari startKey sampai endKey (format "YYYY-MM"), termasuk bulan tanpa data. */
function monthKeysBetween(startKey: string, endKey: string): string[] {
  const keys: string[] = [];
  let [year, month] = startKey.split("-").map(Number);
  const [endYear, endMonth] = endKey.split("-").map(Number);
  while (year < endYear || (year === endYear && month <= endMonth)) {
    keys.push(`${year}-${String(month).padStart(2, "0")}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return keys;
}

/** `count` bulan terakhir, berakhir pada bulan dari todayIso. */
function recentMonthKeys(todayIso: string, count: number): string[] {
  const [year, month] = todayIso.slice(0, 7).split("-").map(Number);
  const keys: string[] = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const d = new Date(year, month - 1 - offset, 1);
    keys.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    );
  }
  return keys;
}

function isBookingInFilter(
  startsAtIso: string,
  filter: PeriodFilter,
  todayIso: string,
): boolean {
  if (filter === "Semua") return true;
  const sessionDate = toISO(new Date(startsAtIso));
  if (filter === "Hari Ini") return sessionDate === todayIso;
  if (filter === "Bulan Ini") {
    return sessionDate.slice(0, 7) === todayIso.slice(0, 7);
  }
  const target = new Date(`${sessionDate}T00:00:00`).getTime();
  const base = new Date(`${todayIso}T00:00:00`).getTime();
  const diffDays = (target - base) / 86400000;
  return diffDays >= -6 && diffDays <= 0;
}

export default function AdminBerandaPage() {
  const today = useMemo(() => toISO(new Date()), []);
  const [period, setPeriod] = useState<PeriodFilter>("Semua");

  const [dashboard, setDashboard] = useState<AdminDashboardDto | null>(null);
  const [report, setReport] = useState<AdminReportDto | null>(null);
  const [bookings, setBookings] = useState<AdminCounselingDto[]>([]);
  const [periods, setPeriods] = useState<AcademicPeriod[]>([]);
  const [counselorAccounts, setCounselorAccounts] = useState<AdminAccountDto[]>(
    [],
  );
  const [publicNames, setPublicNames] = useState<Map<string, string>>(
    () => new Map(),
  );

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const currentSemester = useMemo(
    () => periods.find((p) => isInPeriod(today, p)) ?? null,
    [periods, today],
  );

  const fetchDashboardData = useCallback(async () => {
    const [
      dashboardDto,
      reportDto,
      counselingDtos,
      periodDtos,
      counselorsDto,
      pubCounselors,
    ] = await Promise.all([
      reportingApi.getAdminDashboard(),
      reportingApi.getAdminReport(),
      adminApi.listCounseling(100),
      adminApi.listAcademicPeriods().catch(() => []),
      adminApi.listAccounts({ role: "counselor", limit: 100 }).catch(() => []),
      getPublicCounselors().catch(() => []),
    ]);

    const pMap = new Map<string, string>();
    for (const c of pubCounselors) {
      if (c.public_name?.trim()) pMap.set(c.profile_id, c.public_name.trim());
    }

    return {
      dashboardDto,
      reportDto,
      counselingDtos,
      sortedPeriods: sortPeriods(periodDtos.map(mapAcademicPeriodDto)),
      counselorsDto,
      pMap,
    };
  }, []);

  useEffect(() => {
    let active = true;
    void fetchDashboardData()
      .then(
        ({
          dashboardDto,
          reportDto,
          counselingDtos,
          sortedPeriods,
          counselorsDto,
          pMap,
        }) => {
          if (!active) return;
          setDashboard(dashboardDto);
          setReport(reportDto);
          setBookings(counselingDtos);
          setPeriods(sortedPeriods);
          setCounselorAccounts(counselorsDto);
          setPublicNames(pMap);
          setLoadError(null);
        },
      )
      .catch((err: unknown) => {
        if (!active) return;
        setLoadError(
          err instanceof Error
            ? err.message
            : "Data dashboard admin tidak dapat dimuat.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fetchDashboardData]);

  const handleRefresh = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const {
        dashboardDto,
        reportDto,
        counselingDtos,
        sortedPeriods,
        counselorsDto,
        pMap,
      } = await fetchDashboardData();
      setDashboard(dashboardDto);
      setReport(reportDto);
      setBookings(counselingDtos);
      setPeriods(sortedPeriods);
      setCounselorAccounts(counselorsDto);
      setPublicNames(pMap);
    } catch (err) {
      setLoadError(
        err instanceof Error
          ? err.message
          : "Data dashboard admin tidak dapat dimuat.",
      );
    } finally {
      setLoading(false);
    }
  };

  const activePeriod = useMemo(
    () => periods.find((p) => isInPeriod(today, p)) ?? null,
    [periods, today],
  );

  const filteredBookings = useMemo(
    () => bookings.filter((b) => isBookingInFilter(b.starts_at, period, today)),
    [bookings, period, today],
  );

  const stats: DashboardMetricValues = useMemo(() => {
    if (period === "Semua" && dashboard) {
      return {
        totalRequests: dashboard.bookings?.total ?? 0,
        completedSessions: dashboard.sessions?.completed ?? 0,
        cancelledSessions: report?.totals?.cancelled_sessions ?? 0,
        waitingConfirmation: dashboard.bookings?.waiting_confirmation ?? 0,
        pendingModerationFeedback: dashboard.feedback?.pending_moderation ?? 0,
        activeClients: dashboard.users?.active_clients ?? 0,
        activeCounselors: dashboard.users?.active_counselors ?? 0,
      };
    }

    const completed = filteredBookings.filter((b) =>
      b.counseling_sessions?.some((s) => s.status === "completed"),
    ).length;
    const cancelled = filteredBookings.filter(
      (b) =>
        b.status === "cancelled" ||
        b.status === "rejected" ||
        b.counseling_sessions?.some((s) => s.status === "cancelled"),
    ).length;
    const waiting = filteredBookings.filter(
      (b) => b.status === "waiting_confirmation",
    ).length;

    return {
      totalRequests: filteredBookings.length,
      completedSessions: completed,
      cancelledSessions: cancelled,
      waitingConfirmation: waiting,
      pendingModerationFeedback: dashboard?.feedback.pending_moderation ?? 0,
      activeClients: dashboard?.users.active_clients ?? 0,
      activeCounselors: dashboard?.users.active_counselors ?? 0,
    };
  }, [period, dashboard, report, filteredBookings]);

  const distribution: ServiceDistributionData = useMemo(() => {
    const total = filteredBookings.length;
    const kelompokCount = filteredBookings.filter(
      (b) => b.service_type === "group",
    ).length;
    const individuCount = total - kelompokCount;
    const individuPct =
      total > 0 ? Math.round((individuCount / total) * 100) : 0;
    const kelompokPct = total > 0 ? 100 - individuPct : 0;

    return {
      individuPct,
      kelompokPct,
      individuCount,
      kelompokCount,
      total,
    };
  }, [filteredBookings]);

  const trendBuckets: TrendBucketItem[] = useMemo(() => {
    if (period === "Semua" && report?.monthly) {
      // Backend hanya mengirim bulan yang punya data, jadi bulan kosong diisi 0 di sini.
      const bookingsByMonth = new Map(
        report.monthly.map((m) => [m.month, m.bookings]),
      );
      const monthKeys = currentSemester
        ? monthKeysBetween(
            currentSemester.start.slice(0, 7),
            currentSemester.end.slice(0, 7),
          )
        : recentMonthKeys(today, 6);

      return monthKeys.map((key) => {
        const monthIdx = Number(key.slice(5, 7)) - 1;
        return {
          label: MONTH_SHORT[monthIdx] ?? key,
          value: bookingsByMonth.get(key) ?? 0,
        };
      });
    }

    const grouped = new Map<string, number>();
    for (const b of filteredBookings) {
      const startDate = new Date(b.starts_at);
      const key =
        period === "Hari Ini"
          ? `${String(startDate.getHours()).padStart(2, "0")}:00`
          : toISO(startDate).slice(5);
      grouped.set(key, (grouped.get(key) ?? 0) + 1);
    }

    return [...grouped.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-7)
      .map(([label, value]) => ({ label, value }));
  }, [period, report, filteredBookings, currentSemester, today]);

  const counselorWorkloadRows: CounselorWorkloadRow[] = useMemo(() => {
    const map = new Map<string, CounselorWorkloadRow>();
    const reportByCounselor = new Map(
      (report?.counselors ?? []).map((c) => [c.counselor_id, c]),
    );

    for (const acc of counselorAccounts) {
      const name =
        acc.full_name?.trim() ||
        publicNames.get(acc.id) ||
        (acc.email ? acc.email.split("@")[0] : "") ||
        `Konselor #${acc.id.slice(0, 6).toUpperCase()}`;
      map.set(acc.id, {
        id: acc.id,
        name,
        completedSessions:
          reportByCounselor.get(acc.id)?.completed_sessions ?? 0,
        activeBookings: 0,
        isActiveAccount: acc.account_status === "active",
      });
    }

    for (const b of filteredBookings) {
      const existing = map.get(b.counselor_id) ?? {
        id: b.counselor_id,
        name:
          b.counselor?.full_name?.trim() ||
          publicNames.get(b.counselor_id) ||
          reportByCounselor.get(b.counselor_id)?.counselor_name ||
          `Konselor #${b.counselor_id.slice(0, 6).toUpperCase()}`,
        completedSessions:
          period === "Semua"
            ? (reportByCounselor.get(b.counselor_id)?.completed_sessions ?? 0)
            : 0,
        activeBookings: 0,
        isActiveAccount: true,
      };

      if (period !== "Semua") {
        const isDone = b.counseling_sessions?.some(
          (s) => s.status === "completed",
        );
        if (isDone) existing.completedSessions += 1;
      }

      if (
        b.status === "waiting_confirmation" ||
        b.status === "confirmed" ||
        b.status === "reschedule_requested"
      ) {
        existing.activeBookings += 1;
      }

      map.set(b.counselor_id, existing);
    }

    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [counselorAccounts, publicNames, report, filteredBookings, period]);

  return (
    <PageContainer role="admin">
      <PageHeader
        title="Dashboard Monitoring Konseling"
        description="Ringkasan statistik dan operasional layanan konseling kampus."
        actions={
          <div className="flex flex-wrap items-center gap-2">
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
            <button
              type="button"
              onClick={() => void handleRefresh()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
              />
              Muat ulang
            </button>
          </div>
        }
      />

      {loadError && (
        <div
          role="alert"
          className="flex flex-col justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 sm:flex-row sm:items-center"
        >
          <p>{loadError}</p>
          <button
            type="button"
            onClick={() => void handleRefresh()}
            className="shrink-0 rounded-xl bg-red-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
          >
            Coba lagi
          </button>
        </div>
      )}

      {/* Info Periode Akademik Aktif */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-primary-subtle px-5 py-3.5 text-xs">
        <div className="flex items-center gap-2.5 font-semibold text-slate-700">
          <Calendar className="h-4 w-4 text-primary" />
          {activePeriod ? (
            <span>
              Periode Akademik Aktif:{" "}
              <strong className="text-primary">TA {activePeriod.label}</strong>{" "}
              ({fmtDate(activePeriod.start)} – {fmtDate(activePeriod.end)})
            </span>
          ) : (
            <span>
              Belum ada periode akademik yang mencakup tanggal hari ini (
              {fmtDate(today)}).
            </span>
          )}
        </div>
        <Link
          to="/admin/periode"
          className="font-bold text-primary underline underline-offset-2 hover:text-primary-dark"
        >
          Kelola Periode
        </Link>
      </div>

      {loading ? (
        <div className="space-y-5">
          <SkeletonStatGrid label="Memuat ringkasan dashboard dari server..." />
          <div className="grid gap-5 lg:grid-cols-2">
            <SkeletonBlock lines={6} />
            <SkeletonBlock lines={6} />
          </div>
        </div>
      ) : (
        <>
          <SectionErrorBoundary
            title="Metrik Utama"
            onReset={() => void handleRefresh()}
          >
            <MetricCards stats={stats} />
          </SectionErrorBoundary>

          <SectionErrorBoundary
            title="Permintaan Konseling Terbaru"
            onReset={() => void handleRefresh()}
          >
            <RecentClientBookings bookings={filteredBookings} />
          </SectionErrorBoundary>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <SectionErrorBoundary
              title="Tren Sesi Konseling"
              onReset={() => void handleRefresh()}
            >
              <SessionTrend
                buckets={trendBuckets}
                periodLabel={
                  period === "Semua" && currentSemester
                    ? `TA ${currentSemester.ta} ${currentSemester.sem}`
                    : period
                }
              />
            </SectionErrorBoundary>
            <SectionErrorBoundary
              title="Distribusi Layanan"
              onReset={() => void handleRefresh()}
            >
              <ServiceDistribution distribution={distribution} />
            </SectionErrorBoundary>
          </div>

          <SectionErrorBoundary
            title="Beban Kerja Konselor"
            onReset={() => void handleRefresh()}
          >
            <CounselorWorkload counselors={counselorWorkloadRows} />
          </SectionErrorBoundary>
        </>
      )}
    </PageContainer>
  );
}
