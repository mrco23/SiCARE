import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  AcademicPeriodFilter,
  PageContainer,
  PageHeader,
} from "../../components/shared";
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
  Printer,
  RefreshCw,
  Star,
  TriangleAlert,
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

const TITLE_WORDS = new Set([
  "dr",
  "prof",
  "drs",
  "ir",
  "m",
  "psi",
  "msi",
  "mpsi",
  "s",
  "pd",
]);

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

const inRange = (isoDate: string, period: Period) =>
  period.id === "all" || (isoDate >= period.start && isoDate <= period.end);

/** Variabel CSS dinamis (nilai dari data), sesuai pola di design system. */
const cssVar = (name: string, value: string) =>
  ({ [name]: value }) as CSSProperties;

/** Daftar kunci "YYYY-MM" dari bulan awal sampai bulan akhir, termasuk bulan kosong. */
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

function initialsOf(name: string) {
  const words = name
    .replace(/[.,]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !TITLE_WORDS.has(w.toLowerCase()));
  return ((words[0]?.[0] ?? "?") + (words[1]?.[0] ?? "")).toUpperCase();
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

/* ========================= KOMPONEN KECIL ========================= */

type MetricTone = "default" | "done" | "cancel" | "amber";

const METRIC_TONE_CLASS: Record<MetricTone, string> = {
  default: "text-slate-900",
  done: "text-emerald-600",
  cancel: "text-red-500",
  amber: "text-amber-600",
};

function MetricRow({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  tone?: MetricTone;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-t border-slate-100 py-2 first:border-t-0 first:pt-0">
      <span className="text-sm text-slate-600">{label}</span>
      <span className={`text-lg font-bold ${METRIC_TONE_CLASS[tone]}`}>
        {value}
      </span>
    </div>
  );
}

function MetricGroup({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-slate-200 p-4 ${className}`}>
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">
        {title}
      </p>
      {children}
    </div>
  );
}

/** Donut ringkasan: sapuan searah jarum jam dari jam 12 (lihat .report-donut di index.css). */
function SummaryDonut({
  total,
  done,
  cancelled,
}: {
  total: number;
  done: number;
  cancelled: number;
}) {
  const scheduled = Math.max(0, total - done - cancelled);
  const doneEnd = total ? Math.min(100, (done / total) * 100) : 0;
  const cancelEnd = total
    ? Math.min(100, ((done + cancelled) / total) * 100)
    : 0;

  return (
    <div className="flex flex-col items-center gap-5">
      <div
        className="report-donut report-sweep relative h-48 w-48 rounded-full sm:h-52 sm:w-52"
        style={{
          ...cssVar("--pa", `${doneEnd}%`),
          ...cssVar("--pb", `${cancelEnd}%`),
        }}
        role="img"
        aria-label={`Total ${total} sesi: ${done} selesai, ${cancelled} dibatalkan, ${scheduled} terjadwal`}
      >
        <div className="absolute inset-6 flex flex-col items-center justify-center rounded-full bg-white report-fade-in">
          <span className="text-3xl font-extrabold leading-none text-slate-900">
            {total}
          </span>
          <span className="mt-1 text-xs text-slate-500">total sesi</span>
        </div>
      </div>
      <ul className="w-full max-w-60 space-y-2 text-sm text-slate-700">
        <li className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-600" />
          Selesai
          <b className="ml-auto">
            {done} ({pct(done, total)}%)
          </b>
        </li>
        <li className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-red-500" />
          Dibatalkan
          <b className="ml-auto">
            {cancelled} ({pct(cancelled, total)}%)
          </b>
        </li>
        <li className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-slate-200" />
          Terjadwal
          <b className="ml-auto">
            {scheduled} ({pct(scheduled, total)}%)
          </b>
        </li>
      </ul>
    </div>
  );
}

/** Grafik batang per bulan: semua bulan dalam semester ditampilkan, termasuk yang kosong. */
function MonthlyChart({
  months,
}: {
  months: { key: string; done: number; cancelled: number }[];
}) {
  if (months.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-slate-400">
        Belum ada periode akademik untuk ditampilkan.
      </div>
    );
  }

  const maxTotal = Math.max(1, ...months.map((m) => m.done + m.cancelled));

  return (
    <div>
      <div className="flex h-56 items-end gap-2 border-b border-slate-200 sm:gap-4">
        {months.map((month, index) => {
          const total = month.done + month.cancelled;
          const heightPct = total ? Math.max(10, (total / maxTotal) * 88) : 0;
          const cancelPct = total ? (month.cancelled / total) * 100 : 0;
          const delay = `${index * 0.1}s`;

          return (
            <div
              key={month.key}
              className="flex h-full min-w-0 flex-1 flex-col justify-end"
              title={`${month.key}: ${month.done} selesai, ${month.cancelled} dibatalkan`}
            >
              {total > 0 ? (
                <div className="flex w-full flex-col items-center">
                  <span
                    className="report-fade-in mb-1 text-xs font-bold text-slate-700"
                    style={cssVar("--report-delay", `${index * 0.1 + 0.7}s`)}
                  >
                    {total}
                  </span>
                  <div
                    className="report-col-grow flex w-full max-w-14 flex-col overflow-hidden rounded-t-lg"
                    style={{
                      ...cssVar("--report-h", `${heightPct}%`),
                      ...cssVar("--report-delay", delay),
                    }}
                  >
                    <div
                      className="report-stack-cancel bg-red-500"
                      style={cssVar("--report-cancel", `${cancelPct}%`)}
                    />
                    <div className="flex-1 bg-emerald-600" />
                  </div>
                </div>
              ) : (
                <div className="report-fade-in relative flex h-full w-full flex-col items-center justify-end">
                  <div className="w-full max-w-14 border-t-2 border-dashed border-slate-200" />
                  <span className="mt-2 text-[10px] font-semibold text-slate-400">
                    Tidak ada sesi
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-2 sm:gap-4">
        {months.map((month) => (
          <div
            key={month.key}
            className="min-w-0 flex-1 text-center text-[11px] font-semibold text-slate-600 sm:text-xs"
          >
            {MONTH_NAMES[Number(month.key.slice(5, 7)) - 1] ?? month.key}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ========================= HALAMAN ========================= */

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

  const applyReportData = useCallback(
    ({
      reportDto,
      mappedPeriods,
      mappedSessions,
      feedbackDtos,
      cMap,
    }: Awaited<ReturnType<typeof fetchReportData>>) => {
      setReport(reportDto);
      setPeriods(mappedPeriods);
      setAllSessions(mappedSessions);
      setFeedbackList(feedbackDtos);
      setCounselorMap(cMap);
    },
    [],
  );

  useEffect(() => {
    let active = true;
    void fetchReportData()
      .then((data) => {
        if (!active) return;
        applyReportData(data);
        setLoadError(null);
      })
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
  }, [fetchReportData, applyReportData]);

  const handleRefresh = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      applyReportData(await fetchReportData());
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

  const selectedSemester = periods.find((p) => p.id === periodId) ?? ALL_PERIOD;
  const isAllPeriod = selectedSemester.id === "all";
  const periodLabel = isAllPeriod
    ? "Semua periode akademik"
    : `TA ${selectedSemester.label}`;

  const rows = useMemo(
    () => allSessions.filter((s) => inRange(s.date, selectedSemester)),
    [allSessions, selectedSemester],
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

  const totalSessionsDisplay = isAllPeriod
    ? (report?.totals?.bookings ?? rows.length)
    : rows.length;
  const doneDisplay = isAllPeriod
    ? (report?.totals?.completed_sessions ?? done.length)
    : done.length;
  const cancelledDisplay = isAllPeriod
    ? (report?.totals?.cancelled_sessions ?? cancelled.length)
    : cancelled.length;

  const ratingSummary = useMemo(() => {
    if (isAllPeriod && report?.totals) {
      return {
        avg: report.totals.average_rating ?? 0,
        total: report.totals.feedback,
        shown: report.totals.shown_feedback,
      };
    }
    const filtered = feedbackList.filter((f) =>
      inRange(f.created_at.slice(0, 10), selectedSemester),
    );
    const n = filtered.length;
    const sum = filtered.reduce((acc, f) => acc + f.rating, 0);
    const shown = filtered.filter(
      (f) => f.moderation_status === "shown",
    ).length;
    return {
      avg: n > 0 ? sum / n : 0,
      total: n,
      shown,
    };
  }, [isAllPeriod, report, feedbackList, selectedSemester]);

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
    if (isAllPeriod && report?.monthly) {
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
      if (!isAllPeriod || !report) {
        cur.bookings += 1;
        if (r.outcome === "Selesai") cur.done += 1;
      }
      if (r.outcome === "Dibatalkan") cur.cancelled += 1;
      map.set(key, cur);
    }

    // Rentang bulan: dari periode terpilih, atau dari data bila "Semua periode".
    let keys: string[];
    if (!isAllPeriod) {
      keys = monthKeysBetween(
        selectedSemester.start.slice(0, 7),
        selectedSemester.end.slice(0, 7),
      );
    } else {
      const sorted = [...map.keys()].sort();
      keys = sorted.length
        ? monthKeysBetween(sorted[0], sorted[sorted.length - 1])
        : [];
    }

    return keys.map((key) => {
      const val = map.get(key) ?? { done: 0, cancelled: 0, bookings: 0 };
      return { key, done: val.done, cancelled: val.cancelled };
    });
  }, [isAllPeriod, report, rows, selectedSemester]);

  const counselorRows = useMemo(() => {
    const reportByCounselor = new Map(
      (report?.counselors ?? []).map((c) => [c.counselor_id, c]),
    );

    return [...new Set(counselorMap.values())].sort().map((counselorName) => {
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

      if (isAllPeriod && report?.counselors) {
        for (const [cId, cName] of counselorMap.entries()) {
          const rc = reportByCounselor.get(cId);
          if (cName === counselorName && rc) {
            totalDone = Math.max(totalDone, rc.completed_sessions);
          }
        }
      }

      const totalSessions = totalDone + totalCancelled;

      return {
        counselor: counselorName,
        individualDone,
        groupDone,
        individualCancelled,
        groupCancelled,
        totalDone,
        totalCancelled,
        totalSessions,
        donePct: pct(totalDone, totalSessions),
      };
    });
  }, [counselorMap, rows, isAllPeriod, report]);

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

  return (
    <PageContainer role="admin" className="report-print-page">
      {/* 1. Identitas halaman */}
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

      {/* 2. Filter akademik & unduh PDF */}
      <section className="no-print flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 lg:flex-row lg:items-center lg:justify-between">
        <AcademicPeriodFilter
          periods={periods}
          selectedId={periodId}
          onSelect={setPeriodId}
          badgeContent={(period) =>
            `${allSessions.filter((session) => inRange(session.date, period)).length} sesi`
          }
          className="relative w-full sm:w-96"
        />
        <div className="flex flex-col items-stretch gap-2 lg:items-end">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-dark"
          >
            <Printer className="h-4 w-4" />
            Unduh Laporan PDF
          </button>
          <span className="text-center text-xs text-slate-500 lg:text-right">
            Laporan sesuai periode: {periodLabel}
          </span>
        </div>
      </section>

      {/* Peringatan kualitas data */}
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

      {/* 3. Ringkasan konseling */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
            Ringkasan
          </p>
          <h2 className="mt-1 text-lg font-extrabold text-slate-900">
            Ringkasan Konseling
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Angka dihitung dari data aktual sesuai periode yang dipilih.
          </p>
        </div>

        {loading ? (
          <div className="mt-6 grid animate-pulse grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]">
            <div className="mx-auto h-48 w-48 rounded-full bg-slate-100 sm:h-52 sm:w-52" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-28 rounded-2xl bg-slate-100" />
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 items-center gap-8 lg:grid-cols-[300px_1fr] lg:gap-10">
            <SummaryDonut
              key={`donut-${periodId}`}
              total={totalSessionsDisplay}
              done={doneDisplay}
              cancelled={cancelledDisplay}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <MetricGroup title="Keseluruhan">
                <MetricRow
                  label="Total booking & sesi"
                  value={totalSessionsDisplay}
                />
                <MetricRow
                  label="Sesi selesai"
                  value={doneDisplay}
                  tone="done"
                />
                <MetricRow
                  label="Sesi dibatalkan"
                  value={cancelledDisplay}
                  tone="cancel"
                />
              </MetricGroup>

              <div className="flex flex-col justify-between rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-amber-800">
                  Rata-rata rating
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-3xl font-extrabold text-amber-600">
                    {ratingSummary.total ? ratingSummary.avg.toFixed(1) : "-"}
                  </span>
                  {ratingSummary.total > 0 && (
                    <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
                  )}
                </div>
                <p className="mt-2 text-xs text-amber-800">
                  {ratingSummary.total} ulasan ({ratingSummary.shown}{" "}
                  ditampilkan publik)
                </p>
              </div>

              <MetricGroup title="Konseling individu">
                <MetricRow
                  label="Individu selesai"
                  value={doneIndividual.length}
                  tone="done"
                />
                <MetricRow
                  label="Individu dibatalkan"
                  value={cancelledIndividual.length}
                  tone="cancel"
                />
              </MetricGroup>

              <MetricGroup title="Konseling kelompok">
                <MetricRow
                  label="Kelompok selesai"
                  value={doneGroup.length}
                  tone="done"
                />
                <MetricRow
                  label="Kelompok dibatalkan"
                  value={cancelledGroup.length}
                  tone="cancel"
                />
              </MetricGroup>
            </div>
          </div>
        )}
      </section>

      {/* 4. Perkembangan sesi per bulan (semua bulan dalam semester) */}
      <section className="print-break-inside rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-bold text-slate-900">
              Perkembangan sesi per bulan
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Jumlah sesi selesai dan dibatalkan dalam satu semester. Bulan
              tanpa sesi tetap ditampilkan.
            </p>
          </div>
          <div className="flex gap-4 text-xs font-medium text-slate-600">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-emerald-600" />
              Selesai
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-red-500" />
              Dibatalkan
            </span>
          </div>
        </div>

        <div className="mt-6">
          {loading ? (
            <div className="flex h-56 animate-pulse items-end gap-3 rounded-xl bg-slate-50 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-24 flex-1 rounded bg-slate-200" />
              ))}
            </div>
          ) : (
            <MonthlyChart key={`chart-${periodId}`} months={monthly} />
          )}
        </div>
      </section>

      {/* 5. Laporan per konselor (bar) */}
      <section className="print-break-inside rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div>
          <h2 className="font-bold text-slate-900">Laporan per konselor</h2>
          <p className="mt-1 text-xs text-slate-500">
            Distribusi sesi selesai dan dibatalkan berdasarkan jenis konseling.
          </p>
        </div>

        {loading ? (
          <div className="mt-6 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-16 animate-pulse rounded-xl bg-slate-100"
              />
            ))}
          </div>
        ) : counselorRows.length === 0 ? (
          <p className="mt-6 py-8 text-center text-sm text-slate-400">
            Belum ada data layanan konselor pada periode ini.
          </p>
        ) : (
          <div className="mt-6 flex flex-col gap-5">
            {counselorRows.map((row, index) => {
              const cancelPct = 100 - row.donePct;
              const delay = `${index * 0.12}s`;
              return (
                <div
                  key={row.counselor}
                  className="grid grid-cols-1 gap-3 lg:grid-cols-[240px_1fr_240px] lg:items-center lg:gap-5"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-xs font-extrabold text-primary">
                      {initialsOf(row.counselor)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-800">
                        {row.counselor}
                      </p>
                      <p className="text-xs text-slate-500">
                        {row.totalSessions} sesi
                      </p>
                    </div>
                  </div>

                  <div className="flex h-9 overflow-hidden rounded-lg bg-slate-100">
                    {row.totalDone > 0 && (
                      <div
                        className="report-bar-grow flex items-center justify-center bg-emerald-600 text-xs font-bold text-white"
                        style={{
                          ...cssVar("--report-w", `${row.donePct}%`),
                          ...cssVar("--report-delay", delay),
                        }}
                      >
                        {row.totalDone}
                      </div>
                    )}
                    {row.totalCancelled > 0 && (
                      <div
                        className="report-bar-grow report-bar-grow-late flex items-center justify-center bg-red-500 text-xs font-bold text-white"
                        style={{
                          ...cssVar("--report-w", `${cancelPct}%`),
                          ...cssVar("--report-delay", delay),
                        }}
                      >
                        {row.totalCancelled}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                    <span>
                      Individu{" "}
                      <b className="text-emerald-600">{row.individualDone}</b> /{" "}
                      <b className="text-red-500">{row.individualCancelled}</b>
                    </span>
                    <span>
                      Kelompok{" "}
                      <b className="text-emerald-600">{row.groupDone}</b> /{" "}
                      <b className="text-red-500">{row.groupCancelled}</b>
                    </span>
                  </div>
                </div>
              );
            })}
            <p className="flex flex-wrap items-center gap-1 text-xs text-slate-500">
              <span className="mr-2 inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-emerald-600" />{" "}
                Selesai
              </span>
              <span className="mr-2 inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-red-500" />{" "}
                Dibatalkan
              </span>
              · Detail: individu &amp; kelompok (selesai / batal)
            </p>
          </div>
        )}
      </section>

      {/* 6. Analisis pembatalan */}
      <section className="print-break-inside rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div>
          <h2 className="font-bold text-slate-900">Analisis pembatalan</h2>
          <p className="mt-1 text-xs text-slate-500">
            Ringkasan alasan pembatalan/penolakan dari data booking aktual.
          </p>
        </div>
        {loading ? (
          <div className="mt-4 space-y-2">
            <div className="h-6 w-full animate-pulse rounded bg-slate-100" />
            <div className="h-6 w-3/4 animate-pulse rounded bg-slate-100" />
          </div>
        ) : cancelled.length === 0 ? (
          <p className="mt-5 text-sm text-slate-400">
            Belum ada pembatalan sesi yang tercatat pada periode ini.
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
                    className="report-fill-grow h-full rounded-full bg-red-400"
                    style={cssVar(
                      "--report-w",
                      `${pct(count, cancelled.length)}%`,
                    )}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="mt-4 text-xs text-slate-400">
          Alasan pembatalan merupakan informasi administratif. Gunakan data ini
          untuk evaluasi proses layanan.
        </p>
      </section>

      {/* 7. Rincian data sesi */}
      <section className="print-break-inside overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-4 sm:p-5">
          <h2 className="font-bold text-slate-900">Rincian data sesi</h2>
          <p className="mt-1 text-xs text-slate-500">
            Data identitas klien tidak ditampilkan. Gunakan dokumen cetak/PDF
            hanya sesuai kebutuhan dan kewenangan.
          </p>
        </div>
        {loading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-10 animate-pulse rounded-lg bg-slate-100"
              />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-slate-100 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 hover:[&::-webkit-scrollbar-thumb]:bg-slate-400">
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
                      Belum ada riwayat sesi konseling untuk periode ini.
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
                          { day: "2-digit", month: "short", year: "numeric" },
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
        )}
        {rows.length > 12 && (
          <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
            Menampilkan 12 dari {rows.length} sesi pada pratinjau laporan.
            Gunakan tombol Unduh Laporan PDF untuk mencetak atau menyimpan
            seluruh baris.
          </p>
        )}
      </section>

      <p className="pb-4 text-center text-[11px] text-slate-400">
        Laporan ini bersumber langsung dari database SiCARE dengan perlindungan
        privasi data konseling.
      </p>
    </PageContainer>
  );
}
