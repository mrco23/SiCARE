import { useMemo, useState, type ReactNode } from "react";
import {
  CalendarDays,
  FileSpreadsheet,
  Printer,
  Star,
  Table2,
  TriangleAlert,
  Users,
  UsersRound,
  CalendarX,
  CheckCircle2,
  ClipboardList,
} from "lucide-react";

/* ========================= TIPE & DATA ========================= */

type Period = {
  id: string;
  label: string;
  start: string;
  end: string;
};

type SessionStatus = "Selesai" | "Dibatalkan";

type Session = {
  id: string;
  clientId: string; // ID anonim untuk data contoh
  date: string; // YYYY-MM-DD
  format: "Individu" | "Kelompok";
  topic: string;
  status: SessionStatus;
  rating: number | null;
  reason: string;
  cancelledBy: "Klien" | "Konselor" | "Administrasi" | "";
  counselor: string;
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
const PERIODS: Period[] = [
  {
    id: "2024-2025-ganjil",
    label: "2024/2025 Ganjil",
    start: "2024-08-19",
    end: "2025-01-31",
  },
  {
    id: "2024-2025-genap",
    label: "2024/2025 Genap",
    start: "2025-02-01",
    end: "2025-07-31",
  },
  {
    id: "2025-2026-ganjil",
    label: "2025/2026 Ganjil",
    start: "2025-08-18",
    end: "2026-01-31",
  },
  {
    id: "2025-2026-genap",
    label: "2025/2026 Genap",
    start: "2026-02-01",
    end: "2026-07-31",
  },
  {
    id: "2026-2027-ganjil",
    label: "2026/2027 Ganjil",
    start: "2026-08-17",
    end: "2027-01-31",
  },
];

const TOPICS = [
  "Pengembangan Diri",
  "Motivasi",
  "Stres kerja",
  "Kecemasan",
  "Relasi keluarga",
];

const REASONS = [
  "Klien sakit",
  "Konselor berhalangan",
  "Klien tidak hadir tanpa kabar",
  "Jadwal bentrok",
];

const COUNSELORS = [
  "Konselor A",
  "Konselor B",
  "Konselor C",
  "Konselor D",
  "Konselor E",
];

/* Data sintetis untuk menampilkan rancangan halaman sebelum backend tersedia. */
const SESSIONS: Session[] = Array.from({ length: 220 }, (_, i) => {
  const date = new Date(
    Date.UTC(2024, 7, 26) + i * 4 * 864e5 + (i % 3) * 864e5,
  );
  const cancelled = i % 7 === 0 || i % 19 === 0;
  const format = i % 4 === 0 ? "Kelompok" : "Individu";

  return {
    id: `S${String(i + 1).padStart(3, "0")}`,
    clientId: `K${String((i % 23) + 1).padStart(2, "0")}`,
    date: date.toISOString().slice(0, 10),
    format,
    topic: TOPICS[i % TOPICS.length],
    status: cancelled ? "Dibatalkan" : "Selesai",
    rating: cancelled ? null : [5, 4, 5, 3, 4, 5, 2, 4][i % 8],
    reason: cancelled ? REASONS[i % REASONS.length] : "",
    cancelledBy: cancelled
      ? (["Klien", "Konselor", "Administrasi"][i % 3] as Session["cancelledBy"])
      : "",
    counselor: COUNSELORS[i % COUNSELORS.length],
  };
});

/* ========================= HELPER ========================= */

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

const ALL_PERIOD: Period = {
  id: "all",
  label: "Semua periode",
  start: "0000-01-01",
  end: "9999-12-31",
};

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const inRange = (date: string, period: Period) =>
  date >= period.start && date <= period.end;

const average = (rows: Session[]) => {
  const rated = rows.filter((row) => row.rating !== null);
  return {
    n: rated.length,
    value: rated.length
      ? rated.reduce((sum, row) => sum + (row.rating ?? 0), 0) / rated.length
      : 0,
  };
};

function downloadCSV(filename: string, rows: (string | number | null)[][]) {
  const csv = rows
    .map((row) =>
      row
        .map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`)
        .join(","),
    )
    .join("\r\n");

  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

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

export default function AdminLaporanPage() {
  const [periodId, setPeriodId] = useState<string>(
    PERIODS[PERIODS.length - 1].id,
  );
  const [format, setFormat] = useState<"Semua" | "Individu" | "Kelompok">(
    "Semua",
  );
  const [counselorFilter, setCounselorFilter] = useState("Semua");
  const [searchTerm, setSearchTerm] = useState("");

  const period = useMemo(
    () =>
      periodId === "all"
        ? ALL_PERIOD
        : (PERIODS.find((p) => p.id === periodId) ?? ALL_PERIOD),
    [periodId],
  );

  const periodRows = useMemo(
    () => SESSIONS.filter((session) => inRange(session.date, period)),
    [period],
  );

  const rows = useMemo(
    () =>
      periodRows.filter(
        (session) =>
          (format === "Semua" || session.format === format) &&
          (counselorFilter === "Semua" ||
            session.counselor === counselorFilter) &&
          (searchTerm.trim() === "" ||
            session.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            session.counselor
              .toLowerCase()
              .includes(searchTerm.toLowerCase()) ||
            session.topic.toLowerCase().includes(searchTerm.toLowerCase())),
      ),
    [periodRows, format, counselorFilter, searchTerm],
  );

  const done = rows.filter((row) => row.status === "Selesai");
  const cancelled = rows.filter((row) => row.status === "Dibatalkan");
  const doneIndividual = done.filter((row) => row.format === "Individu");
  const doneGroup = done.filter((row) => row.format === "Kelompok");
  const cancelledIndividual = cancelled.filter(
    (row) => row.format === "Individu",
  );
  const cancelledGroup = cancelled.filter((row) => row.format === "Kelompok");
  const rating = average(done);

  const orphanCount = useMemo(
    () =>
      SESSIONS.filter(
        (session) => !PERIODS.some((p) => inRange(session.date, p)),
      ).length,
    [],
  );

  const monthly = useMemo(() => {
    const map: Record<string, { done: number; cancelled: number }> = {};

    rows.forEach((row) => {
      const key = row.date.slice(0, 7);
      map[key] ??= { done: 0, cancelled: 0 };
      if (row.status === "Selesai") map[key].done += 1;
      else map[key].cancelled += 1;
    });

    return Object.keys(map)
      .sort()
      .map((key) => ({ key, ...map[key] }));
  }, [rows]);

  const maxMonth = Math.max(
    1,
    ...monthly.map((month) => month.done + month.cancelled),
  );

  const counselorRows = useMemo(
    () =>
      COUNSELORS.map((counselor) => {
        const counselorSessions = rows.filter(
          (row) => row.counselor === counselor,
        );
        const completed = counselorSessions.filter(
          (row) => row.status === "Selesai",
        );
        const canceled = counselorSessions.filter(
          (row) => row.status === "Dibatalkan",
        );
        return {
          counselor,
          individualDone: completed.filter((row) => row.format === "Individu")
            .length,
          groupDone: completed.filter((row) => row.format === "Kelompok")
            .length,
          individualCancelled: canceled.filter(
            (row) => row.format === "Individu",
          ).length,
          groupCancelled: canceled.filter((row) => row.format === "Kelompok")
            .length,
          totalDone: completed.length,
          totalCancelled: canceled.length,
        };
      }).filter((row) => row.totalDone + row.totalCancelled > 0),
    [rows],
  );

  const reasonCount = useMemo(
    () =>
      REASONS.map((reason) => ({
        reason,
        count: cancelled.filter((row) => row.reason === reason).length,
      })).sort((a, b) => b.count - a.count),
    [cancelled],
  );

  const topicRows = useMemo(
    () =>
      TOPICS.map((topic) => {
        const topicSessions = rows.filter((row) => row.topic === topic);
        const completed = topicSessions.filter(
          (row) => row.status === "Selesai",
        );
        const avg = average(completed);
        return {
          topic,
          total: topicSessions.length,
          completed: completed.length,
          cancelled: topicSessions.filter((row) => row.status === "Dibatalkan")
            .length,
          rating: avg.n ? avg.value.toFixed(1) : "-",
        };
      }),
    [rows],
  );

  const exportSummary = () => {
    const output: (string | number | null)[][] = [
      ["Laporan SiCARE", period.label],
      ["Filter jenis sesi", format],
      ["Total sesi", rows.length],
      ["Sesi selesai", done.length],
      ["Selesai individu", doneIndividual.length],
      ["Selesai kelompok", doneGroup.length],
      ["Sesi dibatalkan", cancelled.length],
      ["Dibatalkan individu", cancelledIndividual.length],
      ["Dibatalkan kelompok", cancelledGroup.length],
      [
        "Rata-rata rating sesi selesai",
        rating.n ? rating.value.toFixed(2) : "",
      ],
      [],
      [
        "Konselor",
        "Individu selesai",
        "Kelompok selesai",
        "Individu dibatalkan",
        "Kelompok dibatalkan",
        "Total selesai",
        "Total dibatalkan",
      ],
      ...counselorRows.map((row) => [
        row.counselor,
        row.individualDone,
        row.groupDone,
        row.individualCancelled,
        row.groupCancelled,
        row.totalDone,
        row.totalCancelled,
      ]),
      [],
      ["Topik", "Total sesi", "Selesai", "Dibatalkan", "Rata-rata rating"],
      ...topicRows.map((row) => [
        row.topic,
        row.total,
        row.completed,
        row.cancelled,
        row.rating === "-" ? "" : row.rating,
      ]),
    ];

    downloadCSV(`laporan-sicare-${periodId}.csv`, output);
  };

  const exportData = () => {
    const output: (string | number | null)[][] = [
      [
        "ID Sesi",
        "ID Klien (anonim)",
        "Tanggal",
        "Jenis Sesi",
        "Topik",
        "Konselor",
        "Status",
        "Rating",
        "Pihak Pembatal",
        "Alasan Pembatalan",
      ],
      ...rows.map((row) => [
        row.id,
        row.clientId,
        row.date,
        row.format,
        row.topic,
        row.counselor,
        row.status,
        row.rating,
        row.cancelledBy,
        row.reason,
      ]),
    ];
    downloadCSV(`data-sesi-anonim-${periodId}.csv`, output);
  };

  const selectClass =
    "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition focus:border-[#2a8f5a] focus:ring-2 focus:ring-[#2a8f5a]/20 sm:w-auto";
  const outlineButtonClass =
    "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50";

  return (
    <div className="mx-auto max-w-7xl space-y-6 font-[Inter] text-slate-800">
      <style>{`
        @media print {
          aside, header, nav, .no-print { display: none !important; }
          main { margin-left: 0 !important; padding: 0 !important; }
          body { background: #fff !important; }
          .print-break-inside { break-inside: avoid; }
          .print-shadow-none { box-shadow: none !important; }
        }
      `}</style>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#2a8f5a]">
            Administrasi SiCARE
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Laporan Konseling
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Ringkasan sesi, pembatalan, distribusi layanan per konselor, dan
            ekspor data berdasarkan periode akademik.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <CalendarDays className="h-4 w-4" />
          <span>Periode: {period.label}</span>
        </div>
      </div>

      {/* Filters and export actions */}
      <section className="no-print rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Tahun akademik / semester
            </span>
            <select
              value={periodId}
              onChange={(event) => setPeriodId(event.target.value)}
              className={selectClass + " w-full"}
            >
              <option value="all">Semua periode</option>
              {[...PERIODS].reverse().map((item) => (
                <option key={item.id} value={item.id}>
                  TA {item.label}
                </option>
              ))}
            </select>
          </label>

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

          <label className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Cari laporan
            </span>
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="ID sesi, konselor, topik..."
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#2a8f5a] focus:ring-2 focus:ring-[#2a8f5a]/20"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">
            Menampilkan <strong>{rows.length}</strong> sesi sesuai filter.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={exportSummary}
              className={outlineButtonClass}
            >
              <FileSpreadsheet className="h-4 w-4 text-[#14553a]" />
              Ekspor ringkasan CSV
            </button>
            <button
              type="button"
              onClick={exportData}
              className={outlineButtonClass}
            >
              <Table2 className="h-4 w-4 text-[#14553a]" />
              Ekspor data sesi
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#14553a] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0f4430]"
            >
              <Printer className="h-4 w-4" />
              Cetak / PDF
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
            valueClass="text-[#14553a]"
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
            valueClass="text-[#14553a]"
          />
          <KpiCard
            label="Kelompok selesai"
            value={doneGroup.length}
            note="Sesi kelompok dengan status selesai"
            icon={<UsersRound className="h-5 w-5" />}
            valueClass="text-[#14553a]"
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
              <span className="h-2.5 w-2.5 rounded-sm bg-[#2a8f5a]" /> Selesai
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
                      <td className="px-4 py-3 text-right font-semibold text-[#14553a]">
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
                    <td className="px-4 py-3 text-right font-semibold text-[#14553a]">
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
                          row.status === "Selesai"
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
            Menampilkan 12 dari {rows.length} sesi. Gunakan tombol Ekspor Data
            Sesi untuk mengambil seluruh data sesuai filter.
          </p>
        )}
      </section>

      <p className="pb-4 text-center text-[11px] text-slate-400">
        Laporan frontend menggunakan data sintetis. Data produksi harus berasal
        dari backend dengan kontrol akses dan pembatasan informasi konseling.
      </p>
    </div>
  );
}
