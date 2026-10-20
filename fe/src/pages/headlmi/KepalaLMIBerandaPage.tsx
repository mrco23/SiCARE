import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CalendarX,
  CheckCircle2,
  ChevronDown,
  Check,
  FileChartColumnIncreasing,
  Info,
  Users,
  UsersRound,
} from "lucide-react";
import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  fmtDate,
  isInPeriod,
  loadPeriods,
  periodStatus,
  sortPeriods,
  toISO,
  type AcademicPeriod,
  type PeriodStatus,
} from "../../lib/academicPeriods";

type Session = {
  id: string;
  date: string;
  format: "Individu" | "Kelompok";
  status: "Selesai" | "Dibatalkan";
  counselor: string;
};

const COUNSELORS = [
  "Konselor A",
  "Konselor B",
  "Konselor C",
  "Konselor D",
  "Konselor E",
];

/* Data contoh untuk desain. Ganti dengan data agregat dari backend saat integrasi. */
const SESSIONS: Session[] = Array.from({ length: 100 }, (_, index) => {
  const date = new Date(Date.UTC(2026, 7, 20) + (index % 150) * 864e5);
  const cancelled = index % 8 === 0 || index % 17 === 0;

  return {
    id: `S${String(index + 1).padStart(3, "0")}`,
    date: date.toISOString().slice(0, 10),
    format: index % 4 === 0 ? "Kelompok" : "Individu",
    status: cancelled ? "Dibatalkan" : "Selesai",
    counselor: COUNSELORS[index % COUNSELORS.length],
  };
});

const MONTHS = [
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
const STATUS_STYLE: Record<PeriodStatus, string> = {
  Aktif: "bg-emerald-50 text-[#14553a] border-emerald-200",
  Mendatang: "bg-sky-50 text-sky-700 border-sky-200",
  Selesai: "bg-slate-100 text-slate-500 border-slate-200",
};

const sessionsInPeriod = (period: AcademicPeriod | null) =>
  SESSIONS.filter(
    (session) => !period || isInPeriod(toISO(new Date(session.date)), period),
  );

const percent = (value: number, total: number) =>
  total ? Math.round((value / total) * 100) : 0;

function MetricCard({
  label,
  value,
  note,
  icon: Icon,
  accent = "green",
}: {
  label: string;
  value: number | string;
  note: string;
  icon: LucideIcon;
  accent?: "green" | "red" | "blue" | "gold";
}) {
  const accentClasses = {
    green: "bg-emerald-50 text-emerald-700",
    red: "bg-red-50 text-red-600",
    blue: "bg-blue-50 text-blue-700",
    gold: "bg-amber-50 text-amber-700",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold leading-5 text-slate-500">
          {label}
        </p>
        <span className={`rounded-xl p-2 ${accentClasses[accent]}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
        {value}
      </p>
      <p className="mt-1 text-xs text-slate-500">{note}</p>
    </div>
  );
}

function PeriodDropdown({
  periods,
  selectedId,
  onSelect,
  today,
}: {
  periods: AcademicPeriod[];
  selectedId: string;
  onSelect: (id: string) => void;
  today: string;
}) {
  const [open, setOpen] = useState(false);
  const [ta, setTa] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = periods.find((period) => period.id === selectedId) ?? null;

  const years = useMemo(
    () => [...new Set(periods.map((period) => period.ta))].sort().reverse(),
    [periods],
  );

  const semestersOf = (year: string) =>
    periods
      .filter((period) => period.ta === year)
      .sort((a, b) => a.start.localeCompare(b.start));

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
    if (!open) setTa(selected?.ta ?? years[0] ?? null);
    setOpen((value) => !value);
  };

  const pick = (id: string) => {
    onSelect(id);
    setOpen(false);
  };

  const activeYear = ta ?? years[0] ?? null;
  const triggerStatus = selected ? periodStatus(selected, today) : null;

  return (
    <div ref={rootRef} className="relative w-full sm:w-96">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className={`flex w-full items-center justify-between gap-4 rounded-2xl border bg-white px-4 py-3 text-left shadow-sm transition-colors ${
          open
            ? "border-[#2a8f5a] ring-4 ring-[#2a8f5a]/15"
            : "border-slate-200 hover:border-[#2a8f5a]/50"
        }`}
      >
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Periode akademik
          </p>
          <p className="truncate text-sm font-bold text-slate-800">
            {selected ? `TA ${selected.ta} · ${selected.sem}` : "Semua periode"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {triggerStatus && (
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${STATUS_STYLE[triggerStatus]}`}
            >
              {triggerStatus}
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
                  ? "bg-[#f0fdf4] text-[#14553a]"
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
                {years.map((year) => (
                  <button
                    key={year}
                    type="button"
                    onClick={() => setTa(year)}
                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm font-semibold transition-colors ${
                      activeYear === year
                        ? "bg-white text-[#14553a] shadow-sm"
                        : "text-slate-600 hover:bg-white/70"
                    }`}
                  >
                    {year}
                    {selected?.ta === year && (
                      <span className="h-1.5 w-1.5 rounded-full bg-[#2a8f5a]" />
                    )}
                  </button>
                ))}
              </div>

              <div className="space-y-2 p-3">
                <p className="px-1 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Semester · TA {activeYear}
                </p>
                {(["Ganjil", "Genap"] as const).map((semester) => {
                  const period = activeYear
                    ? semestersOf(activeYear).find(
                        (item) => item.sem === semester,
                      )
                    : undefined;

                  if (!period) {
                    return (
                      <div
                        key={semester}
                        className="rounded-xl border border-dashed border-slate-200 px-4 py-3 text-xs text-slate-400"
                      >
                        <span className="font-semibold">{semester}</span> ·
                        belum dibuat di Pengaturan
                      </div>
                    );
                  }

                  const active = selectedId === period.id;
                  const status = periodStatus(period, today);
                  const count = sessionsInPeriod(period).length;

                  return (
                    <button
                      key={semester}
                      type="button"
                      onClick={() => pick(period.id)}
                      className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                        active
                          ? "border-[#14553a] bg-[#14553a] text-white"
                          : "border-slate-200 bg-white hover:border-[#2a8f5a]/50 hover:bg-[#f6fcf8]"
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-bold">{semester}</p>
                        <p
                          className={`truncate text-[11px] ${active ? "text-emerald-100" : "text-slate-400"}`}
                        >
                          {fmtDate(period.start)} – {fmtDate(period.end)}
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

export default function KepalaLMIBerandaPage() {
  const today = useMemo(() => toISO(new Date()), []);
  const periods = useMemo(() => sortPeriods(loadPeriods()), []);

  const [periodId, setPeriodId] = useState<string>(() => {
    const active = periods.find((period) => isInPeriod(today, period));
    return active?.id ?? periods[periods.length - 1]?.id ?? "all";
  });

  const period = periods.find((item) => item.id === periodId) ?? null;

  const rows = useMemo(() => sessionsInPeriod(period), [period]);

  const completed = rows.filter((session) => session.status === "Selesai");
  const cancelled = rows.filter((session) => session.status === "Dibatalkan");
  const individualCompleted = completed.filter(
    (session) => session.format === "Individu",
  );
  const groupCompleted = completed.filter(
    (session) => session.format === "Kelompok",
  );
  const individualCancelled = cancelled.filter(
    (session) => session.format === "Individu",
  );
  const groupCancelled = cancelled.filter(
    (session) => session.format === "Kelompok",
  );

  const monthly = useMemo(() => {
    const map: Record<string, { done: number; cancelled: number }> = {};
    rows.forEach((session) => {
      const month = session.date.slice(0, 7);
      map[month] ??= { done: 0, cancelled: 0 };
      if (session.status === "Selesai") map[month].done += 1;
      else map[month].cancelled += 1;
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => ({ key, ...value }));
  }, [rows]);

  const counselorSummary = useMemo(
    () =>
      COUNSELORS.map((counselor) => {
        const sessions = rows.filter(
          (session) => session.counselor === counselor,
        );
        const done = sessions.filter(
          (session) => session.status === "Selesai",
        ).length;
        const cancelledCount = sessions.filter(
          (session) => session.status === "Dibatalkan",
        ).length;
        return {
          counselor,
          done,
          cancelled: cancelledCount,
          total: sessions.length,
        };
      })
        .filter((row) => row.total > 0)
        .sort((a, b) => b.done - a.done),
    [rows],
  );

  const maxMonth = Math.max(
    1,
    ...monthly.map((month) => month.done + month.cancelled),
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6 font-[Inter] text-slate-800">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#2a8f5a]">
            Panel Pimpinan
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Beranda Kepala LMI
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Ringkasan pemanfaatan layanan konseling, pelaksanaan sesi, dan
            distribusi layanan berdasarkan periode akademik.
          </p>
        </div>

        <PeriodDropdown
          periods={periods}
          selectedId={periodId}
          onSelect={setPeriodId}
          today={today}
        />
      </div>

      <section className="rounded-2xl border border-[#d6eadc] bg-gradient-to-r from-[#f0faf3] to-white p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#32734f]">
              Periode yang ditinjau
            </p>
            <h2 className="mt-1 text-lg font-bold text-slate-900">
              {period
                ? `TA ${period.ta} · Semester ${period.sem}`
                : "Semua periode akademik"}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {period
                ? `${fmtDate(period.start)} – ${fmtDate(period.end)}`
                : "Ringkasan mencakup seluruh data sesi yang tersedia."}
            </p>
          </div>
          <Link
            to="/kepala-lmi/laporan"
            className="inline-flex items-center justify-center gap-2 self-start rounded-xl bg-[#14553a] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0f4430] sm:self-auto"
          >
            Lihat laporan lengkap <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Ringkasan layanan
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Statistik agregat untuk membantu pemantauan layanan. Tidak
            menampilkan isi konseling atau identitas klien.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Total sesi selesai"
            value={completed.length}
            note={`${percent(completed.length, rows.length)}% dari sesi pada periode`}
            icon={CheckCircle2}
            accent="green"
          />
          <MetricCard
            label="Sesi dibatalkan"
            value={cancelled.length}
            note={`${percent(cancelled.length, rows.length)}% dari sesi pada periode`}
            icon={CalendarX}
            accent="red"
          />
          <MetricCard
            label="Sesi individu selesai"
            value={individualCompleted.length}
            note="Layanan konseling individu"
            icon={Users}
            accent="blue"
          />
          <MetricCard
            label="Sesi kelompok selesai"
            value={groupCompleted.length}
            note="Layanan konseling kelompok"
            icon={UsersRound}
            accent="gold"
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <MetricCard
            label="Individu dibatalkan"
            value={individualCancelled.length}
            note="Sesi individu dengan status dibatalkan"
            icon={Users}
            accent="red"
          />
          <MetricCard
            label="Kelompok dibatalkan"
            value={groupCancelled.length}
            note="Sesi kelompok dengan status dibatalkan"
            icon={UsersRound}
            accent="red"
          />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.35fr_1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="font-bold text-slate-900">Perkembangan layanan</h2>
              <p className="mt-1 text-xs text-slate-500">
                Jumlah sesi selesai dan dibatalkan setiap bulan.
              </p>
            </div>
            <div className="flex gap-3 text-[11px] font-medium text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-[#2a8f5a]" />
                Selesai
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-red-400" />
                Dibatalkan
              </span>
            </div>
          </div>

          {monthly.length === 0 ? (
            <div className="flex h-48 items-center justify-center text-sm text-slate-400">
              Belum ada data pada periode ini.
            </div>
          ) : (
            <>
              <div className="mt-6 flex h-48 items-end gap-2 border-b border-slate-100 pb-1 sm:gap-3">
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
                          className="bg-[#2a8f5a]"
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
                    className="min-w-0 flex-1 text-center text-[10px] font-semibold text-slate-500"
                  >
                    {MONTHS[Number(month.key.slice(5, 7)) - 1]}
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-bold text-slate-900">
                Jenis layanan selesai
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Komposisi sesi yang berhasil terlaksana.
              </p>
            </div>
            <span className="rounded-xl bg-slate-50 p-2 text-slate-500">
              <UsersRound className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-6 space-y-5">
            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-medium text-slate-600">Individu</span>
                <strong className="text-slate-900">
                  {individualCompleted.length}{" "}
                  <span className="text-xs font-normal text-slate-400">
                    ({percent(individualCompleted.length, completed.length)}%)
                  </span>
                </strong>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-[#2a8f5a]"
                  style={{
                    width: `${percent(individualCompleted.length, completed.length)}%`,
                  }}
                />
              </div>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-medium text-slate-600">Kelompok</span>
                <strong className="text-slate-900">
                  {groupCompleted.length}{" "}
                  <span className="text-xs font-normal text-slate-400">
                    ({percent(groupCompleted.length, completed.length)}%)
                  </span>
                </strong>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-[#7eb89a]"
                  style={{
                    width: `${percent(groupCompleted.length, completed.length)}%`,
                  }}
                />
              </div>
            </div>
          </div>
          <div className="mt-6 rounded-xl bg-[#f7faf8] p-3">
            <div className="flex items-start gap-2">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#32734f]" />
              <p className="text-xs leading-5 text-slate-600">
                Angka ini menghitung sesi, bukan jumlah mahasiswa atau peserta
                yang mengikuti sesi kelompok.
              </p>
            </div>
          </div>
        </section>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <h2 className="font-bold text-slate-900">Ringkasan per konselor</h2>
            <p className="mt-1 text-xs text-slate-500">
              Gambaran distribusi sesi, bukan penilaian kinerja individual
              secara langsung.
            </p>
          </div>
          <Link
            to="/kepala-lmi/laporan"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#14553a] hover:underline"
          >
            Laporan terperinci <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[540px] text-left text-sm">
            <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 sm:px-5">Konselor</th>
                <th className="px-4 py-3 text-right">Sesi selesai</th>
                <th className="px-4 py-3 text-right">Dibatalkan</th>
                <th className="px-4 py-3 text-right">Total sesi</th>
                <th className="px-4 py-3 text-right">Proporsi selesai</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {counselorSummary.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-8 text-center text-sm text-slate-400"
                  >
                    Belum ada data konselor pada periode ini.
                  </td>
                </tr>
              ) : (
                counselorSummary.map((row) => (
                  <tr key={row.counselor} className="hover:bg-slate-50/70">
                    <td className="whitespace-nowrap px-4 py-3 font-semibold sm:px-5">
                      {row.counselor}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-[#14553a]">
                      {row.done}
                    </td>
                    <td className="px-4 py-3 text-right text-red-600">
                      {row.cancelled}
                    </td>
                    <td className="px-4 py-3 text-right">{row.total}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-flex items-center justify-end gap-1">
                        {percent(row.done, row.total)}%
                        {row.done >= row.cancelled ? (
                          <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />
                        )}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-[#edf7f0] p-2.5 text-[#14553a]">
            <FileChartColumnIncreasing className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-bold text-slate-900">Butuh rincian laporan?</h2>
            <p className="mt-1 text-sm text-slate-500">
              Buka laporan untuk melihat rincian jenis sesi, pembatalan, topik,
              dan data per konselor.
            </p>
          </div>
        </div>
        <Link
          to="/kepala-lmi/laporan"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#14553a] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0f4430]"
        >
          Buka laporan <ArrowRight className="h-4 w-4" />
        </Link>
      </section>

      <p className="pb-3 text-center text-[11px] text-slate-400">
        Dashboard menampilkan data agregat. Data saat ini merupakan simulasi
        desain frontend.
      </p>
    </div>
  );
}
