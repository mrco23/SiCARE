import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight, CalendarCheck, Loader2, RefreshCw } from "lucide-react";
import { PageContainer, PageHeader } from "../../components/shared";
import { ActivitySummary, CounselorSummary, MetricCards } from "../../components/headlmi/dashboard/DashboardSections";
import { reportingApi } from "../../lib/reportingApi";
import type { AdminDashboardDto, AdminReportDto } from "../../types/api";
import { describeApiError, formatIsoDate, formatIsoDateTime } from "../../features/headlmi/shared/presentation";

export default function KepalaLMIBerandaPage() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<AdminDashboardDto | null>(null);
  const [report, setReport] = useState<AdminReportDto | null>(null);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(true);
  const [loadedAt, setLoadedAt] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    return reportingApi.getHeadLmiDashboard();
  }, []);

  const fetchReport = useCallback(async () => {
    return reportingApi.getHeadLmiReport();
  }, []);

  useEffect(() => {
    let active = true;
    void fetchDashboard()
      .then((data) => {
        if (!active) return;
        setDashboard(data);
        setDashboardError(null);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setDashboard(null);
        setDashboardError(describeApiError(error, "Ringkasan statistik gagal dimuat."));
      })
      .finally(() => {
        if (active) setDashboardLoading(false);
      });

    void fetchReport()
      .then((data) => {
        if (!active) return;
        setReport(data);
        setReportError(null);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setReport(null);
        setReportError(describeApiError(error, "Data laporan aktivitas gagal dimuat."));
      })
      .finally(() => {
        if (active) {
          setReportLoading(false);
          setLoadedAt(new Date().toISOString());
        }
      });

    return () => {
      active = false;
    };
  }, [fetchDashboard, fetchReport]);

  const refreshAll = async () => {
    setDashboardLoading(true);
    setReportLoading(true);
    setDashboardError(null);
    setReportError(null);

    const [dRes, rRes] = await Promise.allSettled([fetchDashboard(), fetchReport()]);

    if (dRes.status === "fulfilled") {
      setDashboard(dRes.value);
    } else {
      setDashboard(null);
      setDashboardError(describeApiError(dRes.reason, "Ringkasan statistik gagal dimuat."));
    }

    if (rRes.status === "fulfilled") {
      setReport(rRes.value);
      setLoadedAt(new Date().toISOString());
    } else {
      setReport(null);
      setReportError(describeApiError(rRes.reason, "Data laporan aktivitas gagal dimuat."));
    }

    setDashboardLoading(false);
    setReportLoading(false);
  };

  const refreshing = dashboardLoading || reportLoading;

  return (
    <PageContainer role="headlmi" spacing="none" className="space-y-5 text-slate-800">
      <PageHeader
        eyebrow="Beranda Kepala LMI"
        title="Ringkasan Konseling"
        description="Pantau kondisi layanan dan tindak lanjut utama."
        actions={
          <div className="flex flex-col gap-2 self-start sm:flex-row sm:self-auto">
            <button
              type="button"
              onClick={refreshAll}
              disabled={refreshing}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Muat ulang
            </button>
            <button
              type="button"
              onClick={() => navigate("/kepala-lmi/laporan")}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark"
            >
              Lihat laporan lengkap
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        }
      />

      {report?.truncated && (
        <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          Sebagian sumber data laporan mencapai batas 1.000 record. Grafik aktivitas dan ringkasan konselor
          mungkin belum mencakup seluruh record pada rentang laporan.
        </div>
      )}

      <MetricCards dashboard={dashboard} loading={dashboardLoading} error={dashboardError} onRetry={() => void refreshAll()} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <ActivitySummary report={report} loading={reportLoading} error={reportError} onRetry={() => void refreshAll()} />
        </div>
        <div className="xl:col-span-2">
          <CounselorSummary report={report} loading={reportLoading} error={reportError} onRetry={() => void refreshAll()} />
        </div>
      </div>
      <p className="flex items-start gap-2 px-1 text-xs leading-relaxed text-slate-400">
        <CalendarCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          Statistik ringkasan dihitung langsung dari database SiCARE. Grafik dan ringkasan konselor memakai laporan
          {report
            ? ` periode ${formatIsoDate(report.period.from)} – ${formatIsoDate(report.period.to)}`
            : " 12 bulan terakhir"}
          .{loadedAt ? ` Terakhir dimuat ${formatIsoDateTime(loadedAt)}.` : ""}
        </span>
      </p>
    </PageContainer>
  );
}
