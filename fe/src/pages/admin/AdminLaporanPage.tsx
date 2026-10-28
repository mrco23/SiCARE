import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { PageContainer, PageHeader } from "../../components/shared";
import { SESSION_OUTCOME_LABEL } from "../../constants/status";
import { DEFAULT_PERIODS } from "../../lib/academicPeriods";
import {
  CalendarDays,
  ChevronDown,
  Check,
  Printer,
  Star,
  TriangleAlert,
  Users,
  UsersRound,
  CalendarX,
  CheckCircle2,
  ClipboardList,
} from "lucide-react";
import { SESSIONS, TOPICS, REASONS } from "../../data/mock/adminReports";
import { calculateAdminReportAverage, countAdminCancellationReasons, groupAdminReportByMonth, isAdminReportDateInPeriod, selectAdminReportRows, summarizeAdminReportByCounselor, summarizeAdminReportSessions, summarizeAdminReportTopics } from "../../features/admin/reports/selectors";
import { REPORT_COUNSELORS as COUNSELORS, REPORT_MONTHS as MONTHS } from "../../data/mock/reportCommon";

/* ========================= TIPE & DATA ========================= */

type Period = {
  id: string;
  label: string;
  start: string;
  end: string;
};

/*
 * DATA CONTOH FRONTEND
 * Ganti PERIODS dengan data dari pengaturan periode akademik dan SESSIONS
 * dengan data API ketika backend sudah tersedia.
 *
 * Sesi masuk ke periode berdasarkan tanggal sesi. Untuk sesi yang dibatalkan,
 * implementasi backend perlu menetapkan apakah periode dihitung dari tanggal
 * jadwal awal atau tanggal pembatalan. Di halaman ini digunakan tanggal sesi.
 */
const PERIODS: Period[] = DEFAULT_PERIODS;

/* Data sintetis untuk menampilkan rancangan halaman sebelum backend tersedia. */

/* ========================= HELPER ========================= */

const ALL_PERIOD: Period = {
  id: "all",
  label: "Semua periode",
  start: "0000-01-01",
  end: "9999-12-31",
};

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const inRange = isAdminReportDateInPeriod;
const average = calculateAdminReportAverage;

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

type PeriodKey = "hari" | "minggu" | "bulan" | "semester";
const DAY_MS = 864e5;
type DateRange = { start: Date; end: Date };
const parseISODate = (iso: string) => {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
};
const getDateRange = (
  key: PeriodKey,
  anchor: Date,
  semester: Period,
): DateRange => {
  const y = anchor.getFullYear();
  const m = anchor.getMonth();
  const d = anchor.getDate();
  if (key === "hari")
    return { start: new Date(y, m, d), end: new Date(y, m, d + 1) };
  if (key === "minggu")
    return { start: new Date(y, m, d - 6), end: new Date(y, m, d + 1) };
  if (key === "bulan")
    return { start: new Date(y, m, 1), end: new Date(y, m + 1, 1) };
  return {
    start: parseISODate(semester.start),
    end: new Date(parseISODate(semester.end).getTime() + DAY_MS),
  };
};
const formatRangeLabel = (
  key: PeriodKey,
  range: DateRange,
  semester: Period,
) => {
  if (key === "hari")
    return range.start.toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  if (key === "minggu") {
    const end = new Date(range.end.getTime() - DAY_MS);
    return `${range.start.toLocaleDateString("id-ID", { day: "numeric", month: "short" })} – ${end.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}`;
  }
  if (key === "bulan")
    return range.start.toLocaleDateString("id-ID", {
      month: "long",
      year: "numeric",
    });
  return semester.id === "all"
    ? "Semua periode akademik"
    : `TA ${semester.label}`;
};

function SemesterPeriodDropdown({
  periods,
  selectedId,
  onSelect,
}: {
  periods: Period[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [activeYear, setActiveYear] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = periods.find((period) => period.id === selectedId) ?? null;
  const years = useMemo(
    () =>
      [...new Set(periods.map((period) => period.label.split(" ")[0]))]
        .sort()
        .reverse(),
    [periods],
  );
  const semestersOf = (year: string) =>
    periods.filter((period) => period.label.startsWith(year + " "));

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = () => {
    if (!open) setActiveYear(selected?.label.split(" ")[0] ?? years[0] ?? null);
    setOpen((value) => !value);
  };
  const pick = (id: string) => {
    onSelect(id);
    setOpen(false);
  };
  const year = activeYear ?? years[0] ?? null;
  const statusFor = (period: Period) => {
    const today = new Date().toISOString().slice(0, 10);
    if (today < period.start) return "Mendatang";
    if (today > period.end) return "Selesai";
    return "Aktif";
  };

  return (
    <div ref={rootRef} className="relative w-full sm:w-96">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className={`flex w-full items-center justify-between gap-4 rounded-2xl border bg-white px-4 py-3 text-left shadow-sm transition-colors ${
          open
            ? "border-brand-accent ring-4 ring-brand-accent/15"
            : "border-slate-200 hover:border-brand-accent/50"
        }`}
      >
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Periode akademik
          </p>
          <p className="truncate text-sm font-bold text-slate-800">
            {selected ? `TA ${selected.label}` : "Semua periode"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {selected && (
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                statusFor(selected) === "Aktif"
                  ? "bg-emerald-50 text-primary border-emerald-200"
                  : statusFor(selected) === "Mendatang"
                    ? "bg-sky-50 text-sky-700 border-sky-200"
                    : "bg-slate-100 text-slate-500 border-slate-200"
              }`}
            >
              {statusFor(selected)}
            </span>
          )}
          <ChevronDown
            className={`h-4 w-4 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-2 w-[min(560px,92vw)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-100 p-3">
            <button
              type="button"
              onClick={() => pick("all")}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-colors ${
                selectedId === "all"
                  ? "bg-[#f0fdf4] text-primary"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              Semua periode
              {selectedId === "all" && <Check className="h-4 w-4" />}
            </button>
          </div>
          {periods.length === 0 ? (
            <div className="p-5 text-sm text-slate-500">
              Belum ada periode akademik. Tambahkan periode melalui Pengaturan
              Periode.
            </div>
          ) : (
            <div className="grid grid-cols-[9rem_1fr]">
              <div className="max-h-72 space-y-1 overflow-y-auto border-r border-slate-100 bg-slate-50/60 p-2">
                <p className="px-2 pb-1 pt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Tahun ajaran
                </p>
                {years.map((itemYear) => (
                  <button
                    key={itemYear}
                    type="button"
                    onClick={() => setActiveYear(itemYear)}
                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm font-semibold transition-colors ${
                      year === itemYear
                        ? "bg-white text-primary shadow-sm"
                        : "text-slate-600 hover:bg-white/70"
                    }`}
                  >
                    {itemYear}
                    {selected?.label.startsWith(itemYear + " ") && (
                      <span className="h-1.5 w-1.5 rounded-full bg-brand-accent" />
                    )}
                  </button>
                ))}
              </div>
              <div className="space-y-2 p-3">
                <p className="px-1 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Semester · TA {year}
                </p>
                {(["Ganjil", "Genap"] as const).map((semesterName) => {
                  const item = year
                    ? semestersOf(year).find((period) =>
                        period.label.endsWith(semesterName),
                      )
                    : undefined;
                  if (!item) {
                    return (
                      <div
                        key={semesterName}
                        className="rounded-xl border border-dashed border-slate-200 px-4 py-3 text-xs text-slate-400"
                      >
                        <span className="font-semibold">{semesterName}</span> ·
                        belum tersedia
                      </div>
                    );
                  }
                  const active = selectedId === item.id;
                  const status = statusFor(item);
                  const count = SESSIONS.filter((session) =>
                    inRange(session.date, item),
                  ).length;
                  const fmt = (date: string) =>
                    new Date(`${date}T00:00:00`).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    });
                  return (
                    <button
                      key={semesterName}
                      type="button"
                      onClick={() => pick(item.id)}
                      className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                        active
                          ? "border-primary bg-primary text-white"
                          : "border-slate-200 bg-white hover:border-brand-accent/50 hover:bg-[#f6fcf8]"
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-bold">{semesterName}</p>
                        <p
                          className={`truncate text-[11px] ${active ? "text-emerald-100" : "text-slate-400"}`}
                        >
                          {fmt(item.start)} – {fmt(item.end)}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${active ? "bg-white/15 text-white" : "bg-slate-100 text-slate-600"}`}
                        >
                          {count} sesi
                        </span>
                        <span
                          className={`text-[10px] font-bold ${active ? "text-emerald-100" : status === "Aktif" ? "text-[#15803d]" : "text-slate-400"}`}
                        >
                          {status}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminLaporanPage() {
  const periodKey: PeriodKey = "semester";
  const [periodId, setPeriodId] = useState<string>(
    PERIODS[PERIODS.length - 1].id,
  );
  const [format, setFormat] = useState<"Semua" | "Individu" | "Kelompok">(
    "Semua",
  );
  const [counselorFilter, setCounselorFilter] = useState("Semua");

  const selectedSemester = PERIODS.find((p) => p.id === periodId) ?? ALL_PERIOD;
  const range = useMemo(
    () => getDateRange("semester", new Date(), selectedSemester),
    [selectedSemester],
  );
  const periodLabel = formatRangeLabel("semester", range, selectedSemester);

  const rows = useMemo(
    () => selectAdminReportRows(SESSIONS, selectedSemester, format, counselorFilter),
    [selectedSemester, format, counselorFilter],
  );

  const {
    completed: done,
    cancelled,
    completedIndividual: doneIndividual,
    completedGroup: doneGroup,
    cancelledIndividual,
    cancelledGroup,
  } = summarizeAdminReportSessions(rows);
  const rating = average(done);

  const orphanCount = useMemo(
    () =>
      SESSIONS.filter(
        (session) => !PERIODS.some((p) => inRange(session.date, p)),
      ).length,
    [],
  );

  const monthly = useMemo(() => groupAdminReportByMonth(rows), [rows]);

  const maxMonth = Math.max(
    1,
    ...monthly.map((month) => month.done + month.cancelled),
  );

  const counselorRows = useMemo(
    () => summarizeAdminReportByCounselor(rows, COUNSELORS),
    [rows],
  );

  const reasonCount = useMemo(() => countAdminCancellationReasons(rows, REASONS), [rows]);
  const topicRows = useMemo(() => summarizeAdminReportTopics(rows, TOPICS), [rows]);

  const selectClass =
    "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 sm:w-auto";

  return (
    <PageContainer role="admin" className="report-print-page">
      {/* Header */}
      <PageHeader
        title="Laporan Konseling"
        description="Ringkasan sesi, pembatalan, distribusi layanan per konselor, dan ekspor data berdasarkan periode akademik."
        actions={
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <CalendarDays className="h-4 w-4" />
            <span>Periode: {periodLabel}</span>
          </div>
        }
      />

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
              {COUNSELORS.map((counselor) => (
                <option key={counselor} value={counselor}>
                  {counselor}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <SemesterPeriodDropdown
              periods={PERIODS}
              selectedId={periodId}
              onSelect={setPeriodId}
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
            Menampilkan <strong>{rows.length}</strong> sesi sesuai filter.
          </p>
          <div className="flex flex-wrap gap-2">
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
      {periodKey === "semester" && orphanCount > 0 && (
        <div className="no-print flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />
          <p>
            <strong>{orphanCount} sesi</strong> berada di luar periode akademik
            yang terdaftar. Sesi tersebut tidak masuk ke laporan semester.
            Periksa kembali rentang tanggal pada menu Periode Akademik.
          </p>
        </div>
      )}

      {/* KPI summary */}
      <section className="space-y-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">Ringkasan sesi</h2>
          <p className="mt-1 text-xs text-slate-500">
            Semua angka mengikuti periode, jenis sesi, konselor, dan pencarian
            yang dipilih.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <KpiCard
            label="Total sesi"
            value={rows.length}
            note="Sesi selesai dan dibatalkan"
            icon={<ClipboardList className="h-5 w-5" />}
          />
          <KpiCard
            label="Sesi selesai"
            value={done.length}
            note={`${pct(done.length, rows.length)}% dari total sesi`}
            icon={<CheckCircle2 className="h-5 w-5" />}
            valueClass="text-primary"
          />
          <KpiCard
            label="Sesi dibatalkan"
            value={cancelled.length}
            note={`${pct(cancelled.length, rows.length)}% dari total sesi`}
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
            value={rating.n ? rating.value.toFixed(1) : "-"}
            note={`Berdasarkan ${rating.n} penilaian sesi selesai`}
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
              <span className="h-2.5 w-2.5 rounded-sm bg-brand-accent" /> Selesai
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-red-400" /> Dibatalkan
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
                const height = (total / maxMonth) * 100;
                const doneHeight = total ? (month.done / total) * 100 : 0;
                return (
                  <div
                    key={month.key}
                    className="flex h-full min-w-0 flex-1 flex-col justify-end"
                    title={`${month.key}: ${month.done} selesai, ${month.cancelled} dibatalkan`}
                  >
                    <div
                      className="flex w-full flex-col overflow-hidden rounded-t-md"
                      style={{ height: `${height}%` }}
                    >
                      <div
                        className="bg-red-400"
                        style={{ height: `${100 - doneHeight}%` }}
                      />
                      <div
                        className="bg-brand-accent"
                        style={{ height: `${doneHeight}%` }}
                      />
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
                  {MONTHS[Number(month.key.slice(5, 7)) - 1]}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Counselor and topic tables */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className="print-break-inside overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-4 sm:p-5">
            <h2 className="font-bold text-slate-900">Laporan per konselor</h2>
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
                    <tr key={row.counselor} className="hover:bg-slate-50/70">
                      <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-800">
                        {row.counselor}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {row.individualDone}
                      </td>
                      <td className="px-4 py-3 text-right">{row.groupDone}</td>
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
            <h2 className="font-bold text-slate-900">Sesi per topik</h2>
            <p className="mt-1 text-xs text-slate-500">
              Ringkasan topik tanpa menampilkan isi catatan atau cerita pribadi
              klien.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Topik</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Selesai</th>
                  <th className="px-4 py-3 text-right">Dibatalkan</th>
                  <th className="px-4 py-3 text-right">Rating</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {topicRows.map((row) => (
                  <tr key={row.topic} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-medium">{row.topic}</td>
                    <td className="px-4 py-3 text-right">{row.total}</td>
                    <td className="px-4 py-3 text-right font-semibold text-primary">
                      {row.completed}
                    </td>
                    <td className="px-4 py-3 text-right text-red-600">
                      {row.cancelled}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-flex items-center justify-end gap-1">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                        {row.rating}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Cancellation analysis */}
      <section className="print-break-inside rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div>
          <h2 className="font-bold text-slate-900">Analisis pembatalan</h2>
          <p className="mt-1 text-xs text-slate-500">
            Ringkasan alasan pembatalan berdasarkan data contoh yang tersedia.
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
          Alasan pembatalan merupakan informasi administratif. Gunakan data ini
          untuk evaluasi proses, bukan sebagai satu-satunya ukuran kinerja
          konselor.
        </p>
      </section>

      {/* Session details */}
      <section className="print-break-inside overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-4 sm:p-5">
          <h2 className="font-bold text-slate-900">Rincian data sesi</h2>
          <p className="mt-1 text-xs text-slate-500">
            Data identitas klien disamarkan. Gunakan ekspor hanya sesuai
            kebutuhan dan kewenangan.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">ID sesi</th>
                <th className="px-4 py-3">Tanggal</th>
                <th className="px-4 py-3">Jenis sesi</th>
                <th className="px-4 py-3">Topik</th>
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
                    <td className="whitespace-nowrap px-4 py-3 font-semibold">
                      {row.id}
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
                    <td className="px-4 py-3">{row.topic}</td>
                    <td className="px-4 py-3">{row.counselor}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                          row.status === SESSION_OUTCOME_LABEL.COMPLETED
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-red-50 text-red-700"
                        }`}
                      >
                        {row.status}
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
          </p>
        )}
      </section>

      <p className="pb-4 text-center text-[11px] text-slate-400">
        Laporan frontend menggunakan data sintetis. Data produksi harus berasal
        dari backend dengan kontrol akses dan pembatasan informasi konseling.
      </p>
    </PageContainer>
  );
}
