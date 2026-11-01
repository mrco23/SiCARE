import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { PageContainer, PageHeader, AcademicPeriodFilter } from "../../components/shared";
import { adminApi } from "../../lib/adminApi";
import { mapAcademicPeriodDto, toISO } from "../../lib/academicPeriods";
import { getPublicCounselors } from "../../lib/publicApi";
import { reportingApi } from "../../lib/reportingApi";
import type {
  AdminCounselingDto,
  AdminFeedbackDto,
  AdminReportDto,
} from "../../types/api";
import {
  CalendarDays,
  CalendarX,
  CheckCircle2,
  ClipboardList,
  Download,
  Loader2,
  MessageSquareText,
  Printer,
  RefreshCw,
  Star,
  TriangleAlert,
  Users,
  UsersRound,
} from "lucide-react";

/* ========================= TIPE & DATA ========================= */

type Period = {
  id: string;
  label: string;
  start: string;
  end: string;
};

interface ReportSessionRow {
  id: string;
  shortId: string;
  date: string;
  format: "Individu" | "Kelompok";
  deliveryFormat: string;
  counselorId: string;
  counselor: string;
  outcome: "Selesai" | "Dibatalkan" | "Terjadwal";
  cancelReason: string | null;
}

const ALL_PERIOD: Period = {
  id: "all",
  label: "Semua periode",
  start: "0000-01-01",
  end: "9999-12-31",
};

const MONTH_NAMES = [
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

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

const inRange = (isoDate: string, period: Period) =>
  period.id === "all" || (isoDate >= period.start && isoDate <= period.end);

function KpiCard({
  label,
  value,
  note,
  icon,
  valueClass = "text-slate-900",
}: {
  label: string;
  value: string | number;
  note?: string;
  icon: ReactNode;
  valueClass?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
          {label}
        </p>
        <span className="rounded-xl bg-slate-50 p-2 text-slate-500">
          {icon}
        </span>
      </div>
      <h3 className={`mt-3 text-2xl font-bold sm:text-3xl ${valueClass}`}>
        {value}
      </h3>
      {note && <p className="mt-1 text-xs text-slate-500">{note}</p>}
    </div>
  );
}

function mapBookingToReportRow(
  dto: AdminCounselingDto,
  counselorMap: ReadonlyMap<string, string>,
): ReportSessionRow {
  const session = dto.counseling_sessions?.[0] ?? null;
  const isDone = session?.status === "completed";
  const isCancelled =
    session?.status === "cancelled" ||
    dto.status === "cancelled" ||
    dto.status === "rejected";

  const counselorName =
    dto.counselor?.full_name?.trim() ||
    counselorMap.get(dto.counselor_id) ||
    `Konselor #${dto.counselor_id.slice(0, 6).toUpperCase()}`;

  const deliveryFormat = "Tatap Muka";

  return {
    id: dto.id,
    shortId: `#${dto.id.slice(0, 8).toUpperCase()}`,
    date: toISO(new Date(dto.starts_at)),
    format: dto.service_type === "group" ? "Kelompok" : "Individu",
    deliveryFormat,
    counselorId: dto.counselor_id,
    counselor: counselorName,
    outcome: isDone ? "Selesai" : isCancelled ? "Dibatalkan" : "Terjadwal",
    cancelReason:
      dto.cancellation_reason?.trim() || dto.reschedule_reason?.trim() || null,
  };
}

export default function AdminLaporanPage() {
  const [report, setReport] = useState<AdminReportDto | null>(null);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [allSessions, setAllSessions] = useState<ReportSessionRow[]>([]);
  const [feedbackList, setFeedbackList] = useState<AdminFeedbackDto[]>([]);
  const [counselorMap, setCounselorMap] = useState<Map<string, string>>(
    () => new Map(),
  );

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [periodId, setPeriodId] = useState<string>("all");
  const [format, setFormat] = useState<"Semua" | "Individu" | "Kelompok">(
    "Semua",
  );
  const [counselorFilter, setCounselorFilter] = useState("Semua");

  const fetchReportData = useCallback(async () => {
    const [
      reportDto,
      counselingDtos,
      periodDtos,
      counselorAccounts,
      pubCounselors,
      feedbackDtos,
    ] = await Promise.all([
      reportingApi.getAdminReport(),
      adminApi.listCounseling(100),
      adminApi.listAcademicPeriods().catch(() => []),
      adminApi.listAccounts({ role: "counselor", limit: 100 }).catch(() => []),
      getPublicCounselors().catch(() => []),
      adminApi.listFeedback({ limit: 100 }).catch(() => []),
    ]);

    const cMap = new Map<string, string>();
    for (const c of pubCounselors) {
      if (c.public_name?.trim()) cMap.set(c.profile_id, c.public_name.trim());
    }
    for (const acc of counselorAccounts) {
      if (acc.full_name?.trim()) cMap.set(acc.id, acc.full_name.trim());
    }
    for (const b of counselingDtos) {
      if (b.counselor?.full_name?.trim()) {
        cMap.set(b.counselor_id, b.counselor.full_name.trim());
      } else if (!cMap.has(b.counselor_id)) {
        cMap.set(
          b.counselor_id,
          `Konselor #${b.counselor_id.slice(0, 6).toUpperCase()}`,
        );
      }
    }
    for (const rc of reportDto.counselors) {
      if (rc.counselor_name?.trim()) {
        cMap.set(rc.counselor_id, rc.counselor_name.trim());
      } else if (!cMap.has(rc.counselor_id)) {
        cMap.set(
          rc.counselor_id,
          `Konselor #${rc.counselor_id.slice(0, 6).toUpperCase()}`,
        );
      }
    }

    const mappedPeriods: Period[] = periodDtos
      .map(mapAcademicPeriodDto)
      .sort((a, b) => a.start.localeCompare(b.start))
      .map((p) => ({
        id: p.id,
        label: p.label,
        start: p.start,
        end: p.end,
      }));

    const mappedSessions = counselingDtos.map((dto) =>
      mapBookingToReportRow(dto, cMap),
    );

    return {
      reportDto,
      mappedPeriods,
      mappedSessions,
      feedbackDtos,
      cMap,
    };
  }, []);

  useEffect(() => {
    let active = true;
    void fetchReportData()
      .then(
        ({ reportDto, mappedPeriods, mappedSessions, feedbackDtos, cMap }) => {
          if (!active) return;
          setReport(reportDto);
          setPeriods(mappedPeriods);
          setAllSessions(mappedSessions);
          setFeedbackList(feedbackDtos);
          setCounselorMap(cMap);
          setLoadError(null);
        },
      )
      .catch((err: unknown) => {
        if (!active) return;
        setLoadError(
          err instanceof Error
            ? err.message
            : "Data laporan konseling tidak dapat dimuat.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fetchReportData]);

  const handleRefresh = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { reportDto, mappedPeriods, mappedSessions, feedbackDtos, cMap } =
        await fetchReportData();
      setReport(reportDto);
      setPeriods(mappedPeriods);
      setAllSessions(mappedSessions);
      setFeedbackList(feedbackDtos);
      setCounselorMap(cMap);
    } catch (err) {
      setLoadError(
        err instanceof Error
          ? err.message
          : "Data laporan konseling tidak dapat dimuat.",
      );
    } finally {
      setLoading(false);
    }
  };

  const counselorOptions = useMemo(
    () => [...new Set(counselorMap.values())].sort(),
    [counselorMap],
  );

  const selectedSemester = periods.find((p) => p.id === periodId) ?? ALL_PERIOD;
  const periodLabel =
    selectedSemester.id === "all"
      ? "Semua periode akademik"
      : `TA ${selectedSemester.label}`;

  const unfilteredGlobal =
    selectedSemester.id === "all" &&
    format === "Semua" &&
    counselorFilter === "Semua";

  const rows = useMemo(
    () =>
      allSessions.filter(
        (s) =>
          inRange(s.date, selectedSemester) &&
          (format === "Semua" || s.format === format) &&
          (counselorFilter === "Semua" || s.counselor === counselorFilter),
      ),
    [allSessions, selectedSemester, format, counselorFilter],
  );

  const done = useMemo(
    () => rows.filter((r) => r.outcome === "Selesai"),
    [rows],
  );
  const cancelled = useMemo(
    () => rows.filter((r) => r.outcome === "Dibatalkan"),
    [rows],
  );
  const doneIndividual = useMemo(
    () => done.filter((r) => r.format === "Individu"),
    [done],
  );
  const doneGroup = useMemo(
    () => done.filter((r) => r.format === "Kelompok"),
    [done],
  );
  const cancelledIndividual = useMemo(
    () => cancelled.filter((r) => r.format === "Individu"),
    [cancelled],
  );
  const cancelledGroup = useMemo(
    () => cancelled.filter((r) => r.format === "Kelompok"),
    [cancelled],
  );

  const totalSessionsDisplay = unfilteredGlobal
    ? (report?.totals.bookings ?? rows.length)
    : rows.length;
  const doneDisplay = unfilteredGlobal
    ? (report?.totals.completed_sessions ?? done.length)
    : done.length;
  const cancelledDisplay = unfilteredGlobal
    ? (report?.totals.cancelled_sessions ?? cancelled.length)
    : cancelled.length;

  const filteredFeedback = useMemo(() => {
    return feedbackList.filter((f) => {
      const fDate = f.created_at.slice(0, 10);
      if (!inRange(fDate, selectedSemester)) return false;
      if (counselorFilter !== "Semua") {
        const cName = counselorMap.get(f.counselor_id);
        if (cName !== counselorFilter) return false;
      }
      return true;
    });
  }, [feedbackList, selectedSemester, counselorFilter, counselorMap]);

  const ratingSummary = useMemo(() => {
    if (unfilteredGlobal && report) {
      return {
        avg: report.totals.average_rating ?? 0,
        total: report.totals.feedback,
        shown: report.totals.shown_feedback,
      };
    }
    const n = filteredFeedback.length;
    const sum = filteredFeedback.reduce((acc, f) => acc + f.rating, 0);
    const shown = filteredFeedback.filter(
      (f) => f.moderation_status === "shown",
    ).length;
    return {
      avg: n > 0 ? sum / n : 0,
      total: n,
      shown,
    };
  }, [unfilteredGlobal, report, filteredFeedback]);

  const orphanCount = useMemo(() => {
    if (periods.length === 0) return 0;
    return allSessions.filter(
      (session) => !periods.some((p) => inRange(session.date, p)),
    ).length;
  }, [allSessions, periods]);

  const monthly = useMemo(() => {
    const map = new Map<
      string,
      { done: number; cancelled: number; bookings: number }
    >();
    if (unfilteredGlobal && report) {
      for (const m of report.monthly) {
        map.set(m.month, {
          done: m.completed_sessions,
          cancelled: 0,
          bookings: m.bookings,
        });
      }
    }
    for (const r of rows) {
      const key = r.date.slice(0, 7);
      const cur = map.get(key) ?? { done: 0, cancelled: 0, bookings: 0 };
      if (!unfilteredGlobal || !report) {
        cur.bookings += 1;
        if (r.outcome === "Selesai") cur.done += 1;
      }
      if (r.outcome === "Dibatalkan") cur.cancelled += 1;
      map.set(key, cur);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => ({ key, ...val }));
  }, [unfilteredGlobal, report, rows]);

  const maxMonth = Math.max(
    1,
    ...monthly.map((month) =>
      Math.max(month.done + month.cancelled, month.bookings),
    ),
  );

  const counselorRows = useMemo(() => {
    const namesToInclude =
      counselorFilter === "Semua" ? counselorOptions : [counselorFilter];
    const reportByCounselor = new Map(
      (report?.counselors ?? []).map((c) => [c.counselor_id, c]),
    );

    return namesToInclude.map((counselorName) => {
      const cRows = rows.filter((r) => r.counselor === counselorName);
      const individualDone = cRows.filter(
        (r) => r.format === "Individu" && r.outcome === "Selesai",
      ).length;
      const groupDone = cRows.filter(
        (r) => r.format === "Kelompok" && r.outcome === "Selesai",
      ).length;
      const individualCancelled = cRows.filter(
        (r) => r.format === "Individu" && r.outcome === "Dibatalkan",
      ).length;
      const groupCancelled = cRows.filter(
        (r) => r.format === "Kelompok" && r.outcome === "Dibatalkan",
      ).length;

      let totalDone = individualDone + groupDone;
      const totalCancelled = individualCancelled + groupCancelled;

      if (unfilteredGlobal && report) {
        for (const [cId, cName] of counselorMap.entries()) {
          const rc = reportByCounselor.get(cId);
          if (cName === counselorName && rc) {
            totalDone = Math.max(totalDone, rc.completed_sessions);
          }
        }
      }

      return {
        counselor: counselorName,
        individualDone,
        groupDone,
        individualCancelled,
        groupCancelled,
        totalDone,
        totalCancelled,
      };
    });
  }, [
    counselorFilter,
    counselorOptions,
    rows,
    unfilteredGlobal,
    report,
    counselorMap,
  ]);

  const deliveryFormatRows = useMemo(() => {
    const categories = ["Tatap Muka", "Online", "Belum ditentukan"] as const;
    return categories.map((fmtName) => {
      const matching = rows.filter((r) => r.deliveryFormat === fmtName);
      return {
        formatName: fmtName,
        total: matching.length,
        completed: matching.filter((r) => r.outcome === "Selesai").length,
        cancelled: matching.filter((r) => r.outcome === "Dibatalkan").length,
      };
    });
  }, [rows]);

  const reasonCount = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of cancelled) {
      const label = r.cancelReason || "Tanpa keterangan alasan";
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count);
  }, [cancelled]);

  const handleExportCsv = () => {
    const headers = [
      "ID Booking",
      "Tanggal Sesi",
      "Jenis Sesi",
      "Format Pelaksanaan",
      "Konselor",
      "Status",
    ];
    const csvLines = [
      headers.join(","),
      ...rows.map((r) =>
        [
          r.id,
          r.date,
          r.format,
          `"${r.deliveryFormat.replace(/"/g, '""')}"`,
          `"${r.counselor.replace(/"/g, '""')}"`,
          r.outcome,
        ].join(","),
      ),
    ];
    const blob = new Blob([csvLines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `laporan-konseling-sicare-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const selectClass =
    "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 sm:w-auto";

  return (
    <PageContainer role="admin" className="report-print-page">
      {/* Header */}
      <PageHeader
        title="Laporan Konseling"
        description="Ringkasan sesi, pembatalan, distribusi layanan per konselor, dan ekspor data berdasarkan periode akademik."
        actions={
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4" />
              Periode: {periodLabel}
            </span>
            <button
              type="button"
              onClick={() => void handleRefresh()}
              disabled={loading}
              className="no-print inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm hover:bg-slate-50 disabled:opacity-50"
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
          className="no-print flex flex-col justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 sm:flex-row sm:items-center"
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

      {report?.truncated && (
        <div
          role="status"
          className="no-print flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <p>
            <strong>Batas kuota pembacaan laporan tercapai:</strong> Sebagian
            data agregasi melebihi batas 5.000 baris per tabel pada server (
            <code>truncated = true</code>). Gunakan filter periode untuk
            mempersempit cakupan analisis.
          </p>
        </div>
      )}

      {/* Filters and export actions */}
      <section className="no-print rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Jenis sesi
            </span>
            <select
              value={format}
              onChange={(event) =>
                setFormat(event.target.value as typeof format)
              }
              className={selectClass + " w-full"}
            >
              <option value="Semua">Semua jenis sesi</option>
              <option value="Individu">Konseling individu</option>
              <option value="Kelompok">Konseling kelompok</option>
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Konselor
            </span>
            <select
              value={counselorFilter}
              onChange={(event) => setCounselorFilter(event.target.value)}
              className={selectClass + " w-full"}
            >
              <option value="Semua">Semua konselor</option>
              {counselorOptions.map((counselor) => (
                <option key={counselor} value={counselor}>
                  {counselor}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <AcademicPeriodFilter
              periods={periods}
              selectedId={periodId}
              onSelect={setPeriodId}
              badgeContent={(period) =>
                `${allSessions.filter((session) => inRange(session.date, period)).length} sesi`
              }
              className="relative w-full sm:w-96"
            />
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-500">
                {periodLabel}
              </span>
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">
            Menampilkan <strong>{totalSessionsDisplay}</strong> jadwal/sesi
            sesuai filter.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={rows.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              Ekspor CSV
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-dark"
            >
              <Printer className="h-4 w-4" />
              Unduh Laporan PDF
            </button>
          </div>
        </div>
      </section>

      {/* Data quality warning */}
      {orphanCount > 0 && (
        <div className="no-print flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />
          <p>
            <strong>{orphanCount} sesi</strong> berada di luar periode akademik
            yang terdaftar. Sesi tersebut tidak masuk ke laporan semester.
            Periksa kembali rentang tanggal pada menu Periode Akademik.
          </p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-16 text-sm text-slate-500 shadow-sm">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          Memuat laporan konseling dari server...
        </div>
      ) : (
        <>
          {/* KPI summary */}
          <section className="space-y-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Ringkasan sesi
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Semua angka dihitung dari data aktual database sesuai periode,
                jenis sesi, dan konselor yang dipilih.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <KpiCard
                label="Total booking & sesi"
                value={totalSessionsDisplay}
                note="Total jadwal konseling tercatat"
                icon={<ClipboardList className="h-5 w-5" />}
              />
              <KpiCard
                label="Sesi selesai"
                value={doneDisplay}
                note={`${pct(doneDisplay, totalSessionsDisplay)}% dari total jadwal`}
                icon={<CheckCircle2 className="h-5 w-5" />}
                valueClass="text-primary"
              />
              <KpiCard
                label="Sesi dibatalkan"
                value={cancelledDisplay}
                note={`${pct(cancelledDisplay, totalSessionsDisplay)}% dari total jadwal`}
                icon={<CalendarX className="h-5 w-5" />}
                valueClass="text-red-600"
              />
              <KpiCard
                label="Individu selesai"
                value={doneIndividual.length}
                note="Sesi individu dengan status selesai"
                icon={<Users className="h-5 w-5" />}
                valueClass="text-primary"
              />
              <KpiCard
                label="Kelompok selesai"
                value={doneGroup.length}
                note="Sesi kelompok dengan status selesai"
                icon={<UsersRound className="h-5 w-5" />}
                valueClass="text-primary"
              />
              <KpiCard
                label="Rata-rata rating"
                value={ratingSummary.total ? ratingSummary.avg.toFixed(1) : "-"}
                note={`${ratingSummary.total} ulasan (${ratingSummary.shown} ditampilkan publik)`}
                icon={<Star className="h-5 w-5" />}
                valueClass="text-amber-600"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <KpiCard
                label="Individu dibatalkan"
                value={cancelledIndividual.length}
                note="Sesi individu dengan status dibatalkan"
                icon={<Users className="h-5 w-5" />}
                valueClass="text-red-600"
              />
              <KpiCard
                label="Kelompok dibatalkan"
                value={cancelledGroup.length}
                note="Sesi kelompok dengan status dibatalkan"
                icon={<UsersRound className="h-5 w-5" />}
                valueClass="text-red-600"
              />
            </div>
          </section>

          {/* Monthly chart */}
          <section className="print-break-inside rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="font-bold text-slate-900">
                  Perkembangan sesi per bulan
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Perbandingan jumlah sesi selesai dan dibatalkan dalam periode
                  terpilih.
                </p>
              </div>
              <div className="flex gap-3 text-xs font-medium text-slate-600">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-brand-accent" />{" "}
                  Selesai
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-red-400" />{" "}
                  Dibatalkan
                </span>
              </div>
            </div>

            {monthly.length === 0 ? (
              <div className="flex h-48 items-center justify-center text-sm text-slate-400">
                Tidak ada data pada filter ini.
              </div>
            ) : (
              <div className="mt-6">
                <div className="flex h-52 items-end gap-2 border-b border-slate-100 pb-1 sm:gap-3">
                  {monthly.map((month) => {
                    const total = month.done + month.cancelled;
                    const height =
                      total > 0 ? Math.max(8, (total / maxMonth) * 100) : 4;
                    const doneHeight = total ? (month.done / total) * 100 : 0;
                    return (
                      <div
                        key={month.key}
                        className="flex h-full min-w-0 flex-1 flex-col justify-end"
                        title={`${month.key}: ${month.done} selesai, ${month.cancelled} dibatalkan (${month.bookings} total booking)`}
                      >
                        <div
                          className="flex w-full flex-col overflow-hidden rounded-t-md"
                          style={{ height: `${height}%` }}
                        >
                          {total > 0 ? (
                            <>
                              <div
                                className="bg-red-400"
                                style={{ height: `${100 - doneHeight}%` }}
                              />
                              <div
                                className="bg-brand-accent"
                                style={{ height: `${doneHeight}%` }}
                              />
                            </>
                          ) : (
                            <div className="h-full bg-slate-100" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2 flex gap-2 sm:gap-3">
                  {monthly.map((month) => (
                    <div
                      key={month.key}
                      className="min-w-0 flex-1 text-center text-[10px] font-semibold text-slate-500 sm:text-xs"
                    >
                      {MONTH_NAMES[Number(month.key.slice(5, 7)) - 1] ??
                        month.key}{" "}
                      &apos;{month.key.slice(2, 4)}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Counselor and Delivery Format tables */}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <section className="print-break-inside overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 p-4 sm:p-5">
                <h2 className="font-bold text-slate-900">
                  Laporan per konselor
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Distribusi sesi selesai dan dibatalkan berdasarkan jenis
                  konseling.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Konselor</th>
                      <th className="px-4 py-3 text-right">Individu selesai</th>
                      <th className="px-4 py-3 text-right">Kelompok selesai</th>
                      <th className="px-4 py-3 text-right">Individu batal</th>
                      <th className="px-4 py-3 text-right">Kelompok batal</th>
                      <th className="px-4 py-3 text-right">Total selesai</th>
                      <th className="px-4 py-3 text-right">Total batal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {counselorRows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-4 py-8 text-center text-sm text-slate-400"
                        >
                          Tidak ada data konselor pada filter ini.
                        </td>
                      </tr>
                    ) : (
                      counselorRows.map((row) => (
                        <tr
                          key={row.counselor}
                          className="hover:bg-slate-50/70"
                        >
                          <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-800">
                            {row.counselor}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {row.individualDone}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {row.groupDone}
                          </td>
                          <td className="px-4 py-3 text-right text-red-600">
                            {row.individualCancelled}
                          </td>
                          <td className="px-4 py-3 text-right text-red-600">
                            {row.groupCancelled}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-primary">
                            {row.totalDone}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-red-600">
                            {row.totalCancelled}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="print-break-inside overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 p-4 sm:p-5">
                <h2 className="font-bold text-slate-900">
                  Distribusi format pelaksanaan & ulasan
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Ringkasan format pelaksanaan sesi (Tatap Muka vs Online) tanpa
                  menampilkan catatan klinis rahasia.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[440px] text-left text-sm">
                  <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Format Pelaksanaan</th>
                      <th className="px-4 py-3 text-right">Total</th>
                      <th className="px-4 py-3 text-right">Selesai</th>
                      <th className="px-4 py-3 text-right">Dibatalkan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {deliveryFormatRows.map((row) => (
                      <tr key={row.formatName} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3 font-medium">
                          {row.formatName}
                        </td>
                        <td className="px-4 py-3 text-right">{row.total}</td>
                        <td className="px-4 py-3 text-right font-semibold text-primary">
                          {row.completed}
                        </td>
                        <td className="px-4 py-3 text-right text-red-600">
                          {row.cancelled}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/60 px-4 py-3.5 text-xs text-slate-600 sm:px-5">
                <span className="inline-flex items-center gap-1.5 font-semibold">
                  <MessageSquareText className="h-4 w-4 text-primary" />
                  Total feedback diterima: {ratingSummary.total} ulasan
                </span>
                <span>
                  Ditampilkan ke publik:{" "}
                  <strong className="text-primary">
                    {ratingSummary.shown}
                  </strong>{" "}
                  · Rata-rata:{" "}
                  <strong className="text-amber-600">
                    {ratingSummary.total ? ratingSummary.avg.toFixed(1) : "-"}
                  </strong>
                </span>
              </div>
            </section>
          </div>

          {/* Cancellation analysis */}
          <section className="print-break-inside rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div>
              <h2 className="font-bold text-slate-900">Analisis pembatalan</h2>
              <p className="mt-1 text-xs text-slate-500">
                Ringkasan alasan pembatalan/penolakan dari data booking aktual.
              </p>
            </div>
            {cancelled.length === 0 ? (
              <p className="mt-5 text-sm text-slate-400">
                Tidak ada pembatalan pada filter ini.
              </p>
            ) : (
              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                {reasonCount.map(({ reason, count }) => (
                  <div key={reason}>
                    <div className="mb-1.5 flex items-center justify-between gap-3 text-xs font-semibold text-slate-600">
                      <span>{reason}</span>
                      <span>
                        {count} ({pct(count, cancelled.length)}%)
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-red-400 transition-all"
                        style={{ width: `${pct(count, cancelled.length)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-4 text-xs text-slate-400">
              Alasan pembatalan merupakan informasi administratif. Gunakan data
              ini untuk evaluasi proses layanan.
            </p>
          </section>

          {/* Session details */}
          <section className="print-break-inside overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-4 sm:p-5">
              <h2 className="font-bold text-slate-900">Rincian data sesi</h2>
              <p className="mt-1 text-xs text-slate-500">
                Data identitas klien tidak ditampilkan. Gunakan ekspor hanya
                sesuai kebutuhan dan kewenangan.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">ID Booking</th>
                    <th className="px-4 py-3">Tanggal</th>
                    <th className="px-4 py-3">Jenis sesi</th>
                    <th className="px-4 py-3">Format</th>
                    <th className="px-4 py-3">Konselor</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-10 text-center text-sm text-slate-400"
                      >
                        Tidak ada sesi yang sesuai dengan filter.
                      </td>
                    </tr>
                  ) : (
                    rows.slice(0, 12).map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50/70">
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-semibold">
                          {row.shortId}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                          {new Date(`${row.date}T00:00:00`).toLocaleDateString(
                            "id-ID",
                            {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            },
                          )}
                        </td>
                        <td className="px-4 py-3">{row.format}</td>
                        <td className="px-4 py-3">{row.deliveryFormat}</td>
                        <td className="px-4 py-3">{row.counselor}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                              row.outcome === "Selesai"
                                ? "bg-emerald-50 text-emerald-700"
                                : row.outcome === "Dibatalkan"
                                  ? "bg-red-50 text-red-700"
                                  : "bg-amber-50 text-amber-800"
                            }`}
                          >
                            {row.outcome}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {rows.length > 12 && (
              <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
                Menampilkan 12 dari {rows.length} sesi pada pratinjau laporan.
                Gunakan tombol Ekspor CSV untuk mengunduh seluruh baris.
              </p>
            )}
          </section>
        </>
      )}

      <p className="pb-4 text-center text-[11px] text-slate-400">
        Laporan ini bersumber langsung dari database SiCARE dengan perlindungan
        privasi data konseling.
      </p>
    </PageContainer>
  );
}
