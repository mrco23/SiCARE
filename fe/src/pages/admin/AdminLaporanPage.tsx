import { useMemo, useState } from "react";
import {
  FileSpreadsheet,
  Printer,
  Star,
  Table2,
  TriangleAlert,
} from "lucide-react";

/* ========================= TIPE & DATA ========================= */
type Period = { id: string; label: string; start: string; end: string };
type Session = {
  id: string;
  clientId: string;
  date: string; // YYYY-MM-DD
  format: "Individu" | "Kelompok";
  topic: string;
  status: "Selesai" | "Dibatalkan";
  rating: number | null;
  reason: string;
};

/* ===== DATA CONTOH =====
   Ganti dengan data dari backend, mis. fetch('/api/admin/laporan?periode=...').
   PERIODS berasal dari menu Pengaturan > Periode Akademik.
   Sesi dikaitkan ke periode lewat tanggal, bukan disimpan di tiap sesi. */
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

// Data sesi contoh (anonim: hanya ID klien). Sebagian sengaja di luar periode untuk menguji peringatan.
const SESSIONS: Session[] = Array.from({ length: 90 }, (_, i) => {
  const d = new Date(Date.UTC(2024, 7, 26) + i * 5 * 864e5 + (i % 3) * 864e5);
  const cancelled = i % 7 === 0;
  return {
    id: "S" + String(i + 1).padStart(3, "0"),
    clientId: "K" + String((i % 23) + 1).padStart(2, "0"),
    date: d.toISOString().slice(0, 10),
    format: i % 4 === 0 ? "Kelompok" : "Individu",
    topic: TOPICS[i % TOPICS.length],
    status: cancelled ? "Dibatalkan" : "Selesai",
    rating: cancelled ? null : [5, 4, 5, 3, 4, 5, 2, 4][i % 8],
    reason: cancelled ? REASONS[i % REASONS.length] : "",
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
  start: "0000",
  end: "9999",
};

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const inRange = (date: string, p: Period) => date >= p.start && date <= p.end;
const average = (rows: Session[]) => {
  const rated = rows.filter((r) => r.rating != null);
  return {
    n: rated.length,
    value: rated.length
      ? rated.reduce((a, r) => a + (r.rating as number), 0) / rated.length
      : 0,
  };
};

function downloadCSV(name: string, rows: (string | number | null)[][]) {
  const csv = rows
    .map((r) =>
      r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","),
    )
    .join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ========================= KOMPONEN ========================= */
function KpiCard({
  label,
  value,
  note,
  valueClass = "",
}: {
  label: string;
  value: string | number;
  note?: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <h3 className={`mt-2 text-3xl font-bold ${valueClass}`}>{value}</h3>
      {note !== undefined && (
        <p className="mt-1 text-xs text-slate-400">{note}</p>
      )}
    </div>
  );
}

export default function AdminReportPage() {
  const [periodId, setPeriodId] = useState<string>(
    PERIODS[PERIODS.length - 1].id,
  );
  const [format, setFormat] = useState<string>("Semua");

  const period =
    periodId === "all" ? ALL_PERIOD : PERIODS.find((p) => p.id === periodId)!;

  const rows = useMemo(
    () =>
      SESSIONS.filter(
        (s) =>
          inRange(s.date, period) &&
          (format === "Semua" || s.format === format),
      ),
    [period, format],
  );

  const done = rows.filter((r) => r.status === "Selesai");
  const cancel = rows.filter((r) => r.status === "Dibatalkan");
  const rating = average(done);

  // Sesi yang tidak masuk periode mana pun
  const orphanCount = useMemo(
    () =>
      SESSIONS.filter((s) => !PERIODS.some((p) => inRange(s.date, p))).length,
    [],
  );

  // Data grafik per bulan
  const monthly = useMemo(() => {
    const map: Record<string, { done: number; cancel: number }> = {};
    rows.forEach((r) => {
      const key = r.date.slice(0, 7);
      map[key] ??= { done: 0, cancel: 0 };
      if (r.status === "Selesai") map[key].done++;
      else map[key].cancel++;
    });
    return Object.keys(map)
      .sort()
      .map((k) => ({ key: k, ...map[k] }));
  }, [rows]);
  const maxMonth = Math.max(1, ...monthly.map((m) => m.done + m.cancel));

  // Alasan pembatalan
  const reasonCount = REASONS.map((rs) => ({
    rs,
    n: cancel.filter((x) => x.reason === rs).length,
  })).sort((a, b) => b.n - a.n);

  /* ===== EKSPOR ===== */
  const exportSummary = () => {
    const out: (string | number)[][] = [
      ["Topik", "Total Sesi", "Selesai", "Dibatalkan", "Rata-rata Rating"],
    ];
    TOPICS.forEach((t) => {
      const r = rows.filter((x) => x.topic === t);
      const d = r.filter((x) => x.status === "Selesai");
      const a = average(d);
      out.push([
        t,
        r.length,
        d.length,
        r.length - d.length,
        a.n ? a.value.toFixed(2) : "",
      ]);
    });
    downloadCSV(`ringkasan-konseling-${periodId}.csv`, out);
  };

  const exportData = () => {
    const out: (string | number | null)[][] = [
      [
        "ID Sesi",
        "ID Klien (anonim)",
        "Tanggal",
        "Format",
        "Topik",
        "Status",
        "Rating",
        "Alasan Pembatalan",
      ],
    ];
    rows.forEach((r) =>
      out.push([
        r.id,
        r.clientId,
        r.date,
        r.format,
        r.topic,
        r.status,
        r.rating ?? "",
        r.reason,
      ]),
    );
    downloadCSV(`data-sesi-anonim-${periodId}.csv`, out);
  };

  const selectClass =
    "rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#2a8f5a]/30";
  const outlineBtn =
    "flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50";

  return (
    <div className="mx-auto max-w-7xl space-y-6 font-[Inter] text-slate-800">
      {/* Sembunyikan sidebar & navbar admin saat cetak / PDF */}
      <style>{`
        @media print {
          aside, header, .no-print { display: none !important; }
          main { margin-left: 0 !important; padding-top: 0 !important; }
          body { background: #fff !important; }
        }
      `}</style>

      {/* Judul halaman */}
      <div>
        <h2 className="text-xl font-bold">Laporan &amp; Ekspor</h2>
        <p className="text-xs text-slate-500">
          Ringkasan agregat layanan konseling per tahun ajaran dan semester.
        </p>
      </div>

      {/* Filter & ekspor */}
      <div className="no-print flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            value={periodId}
            onChange={(e) => setPeriodId(e.target.value)}
            className={selectClass}
          >
            <option value="all">Semua periode</option>
            {[...PERIODS].reverse().map((p) => (
              <option key={p.id} value={p.id}>
                TA {p.label}
              </option>
            ))}
          </select>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            className={selectClass}
          >
            <option value="Semua">Semua format</option>
            <option value="Individu">Individu</option>
            <option value="Kelompok">Kelompok</option>
          </select>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={exportSummary} className={outlineBtn}>
            <FileSpreadsheet className="h-4 w-4 text-[#14553a]" /> Ringkasan CSV
          </button>
          <button type="button" onClick={exportData} className={outlineBtn}>
            <Table2 className="h-4 w-4 text-[#14553a]" /> Data Sesi CSV
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-xl bg-[#14553a] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#0f4430]"
          >
            <Printer className="h-4 w-4" /> Cetak / PDF
          </button>
        </div>
      </div>

      {/* Peringatan sesi di luar periode */}
      {orphanCount > 0 && (
        <div className="no-print flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            {orphanCount} sesi memiliki tanggal di luar periode akademik yang
            terdaftar. Sesi ini tidak ikut dihitung pada periode mana pun.
            Periksa menu Pengaturan &gt; Periode Akademik.
          </p>
        </div>
      )}

      {/* Label periode */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-600">
          Periode: {period.label}
          {format !== "Semua" && ` · ${format}`}
        </p>
        <p className="text-xs text-slate-400">
          Diperbarui{" "}
          {new Date().toLocaleDateString("id-ID", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Total Sesi" value={rows.length} />
        <KpiCard
          label="Selesai"
          value={done.length}
          note={`${pct(done.length, rows.length)}% dari total`}
          valueClass="text-[#14553a]"
        />
        <KpiCard
          label="Dibatalkan"
          value={cancel.length}
          note={`${pct(cancel.length, rows.length)}% dari total`}
          valueClass="text-red-600"
        />
        <KpiCard
          label="Rata-rata Rating"
          value={rating.value.toFixed(1)}
          note={`Dari ${rating.n} penilaian`}
        />
      </div>

      {/* Grafik bulanan */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4">
          <h3 className="text-base font-bold">Sesi per Bulan</h3>
          <p className="text-xs text-slate-400">
            Hijau = selesai, merah = dibatalkan.
          </p>
        </div>

        {monthly.length === 0 ? (
          <div className="flex h-56 items-center justify-center border-b border-slate-100">
            <p className="text-sm text-slate-400">
              Tidak ada data pada periode ini.
            </p>
          </div>
        ) : (
          <>
            <div className="flex h-56 items-end gap-2 border-b border-slate-100 pb-1">
              {monthly.map((m) => {
                const total = m.done + m.cancel;
                return (
                  <div
                    key={m.key}
                    className="flex h-full min-w-[24px] flex-1 flex-col justify-end"
                    title={`${m.key}: ${m.done} selesai, ${m.cancel} dibatalkan`}
                  >
                    <div
                      className="flex w-full flex-col-reverse overflow-hidden rounded-t-lg"
                      style={{ height: `${(total / maxMonth) * 100}%` }}
                    >
                      <div
                        className="bg-[#2a8f5a]"
                        style={{ height: `${pct(m.done, total)}%` }}
                      />
                      <div
                        className="bg-red-400"
                        style={{ height: `${pct(m.cancel, total)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex gap-2 text-[10px] font-semibold text-slate-400">
              {monthly.map((m) => (
                <div key={m.key} className="min-w-[24px] flex-1 text-center">
                  {MONTHS[+m.key.slice(5, 7) - 1]}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Per topik */}
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-6">
            <h3 className="text-base font-bold">Sesi per Topik</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-6 py-3">Topik</th>
                  <th className="px-6 py-3 text-right">Sesi</th>
                  <th className="px-6 py-3 text-right">Selesai</th>
                  <th className="px-6 py-3 text-right">Rating</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {TOPICS.map((t) => {
                  const r = rows.filter((x) => x.topic === t);
                  const d = r.filter((x) => x.status === "Selesai");
                  const a = average(d);
                  return (
                    <tr key={t} className="hover:bg-slate-50/60">
                      <td className="px-6 py-3 font-semibold">{t}</td>
                      <td className="px-6 py-3 text-right">{r.length}</td>
                      <td className="px-6 py-3 text-right font-semibold text-[#14553a]">
                        {d.length}
                      </td>
                      <td className="px-6 py-3 text-right">
                        <span className="inline-flex items-center gap-1">
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                          {a.n ? a.value.toFixed(1) : "-"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Alasan pembatalan */}
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-6">
            <h3 className="text-base font-bold">Alasan Pembatalan</h3>
            <p className="text-xs text-slate-400">
              Agregat tanpa identitas klien.
            </p>
          </div>
          <div className="space-y-3 p-6 text-sm">
            {cancel.length === 0 ? (
              <p className="text-slate-400">
                Tidak ada pembatalan pada periode ini.
              </p>
            ) : (
              reasonCount.map(({ rs, n }) => (
                <div key={rs}>
                  <div className="mb-1 flex justify-between text-xs font-semibold text-slate-600">
                    <span>{rs}</span>
                    <span>
                      {n} ({pct(n, cancel.length)}%)
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-red-400"
                      style={{ width: `${pct(n, cancel.length)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <p className="no-print pb-4 text-center text-[11px] text-slate-400">
        Laporan hanya memuat data agregat. Nama dan identitas klien tidak
        ditampilkan maupun diekspor.
      </p>
    </div>
  );
}
