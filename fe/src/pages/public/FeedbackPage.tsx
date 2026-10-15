import { useMemo, useState } from "react";
import {
  CalendarDays,
  Meh,
  MessageSquareText,
  Search,
  Star,
  Stethoscope,
  VenetianMask,
} from "lucide-react";
import {
  fmtDate,
  isInPeriod,
  loadPeriods,
  periodStatus,
  sortPeriods,
  toISO,
  type AcademicPeriod,
} from "../../lib/academicPeriods";

/* ========================= TIPE & DATA ========================= */
/*
  DATA CONTOH: ganti dengan fetch('/api/admin/feedback').
  Nama klien TIDAK dikirim dari server; label anonim dibuat di sini.
*/
type Feedback = {
  id: number;
  rating: number;
  text: string;
  psikolog: string;
  date: string; // ISO datetime
};

const PSIKOLOG = ["Ma'am Giovanna Yudi, M.Psi", "Dr. Budi Santoso, Psikolog"];

const DATA: Feedback[] = [
  {
    id: 1,
    rating: 5,
    text: "Sesinya membantu, saya merasa didengarkan.",
    psikolog: PSIKOLOG[0],
    date: "2025-08-27T10:15:00",
  },
  {
    id: 2,
    rating: 4,
    text: "Penjelasannya jelas dan mudah dipahami.",
    psikolog: PSIKOLOG[1],
    date: "2025-09-12T14:00:00",
  },
  {
    id: 3,
    rating: 5,
    text: "Psikolognya ramah dan tidak menghakimi.",
    psikolog: PSIKOLOG[0],
    date: "2025-10-03T09:30:00",
  },
  {
    id: 4,
    rating: 3,
    text: "Sesi lumayan, tapi sempat mulai terlambat.",
    psikolog: PSIKOLOG[1],
    date: "2025-11-18T13:00:00",
  },
  {
    id: 5,
    rating: 2,
    text: "Saran yang diberikan terasa terlalu umum.",
    psikolog: PSIKOLOG[1],
    date: "2025-12-09T11:20:00",
  },
  {
    id: 6,
    rating: 5,
    text: "Saya punya langkah konkret untuk kecemasan presentasi.",
    psikolog: PSIKOLOG[0],
    date: "2026-01-22T15:40:00",
  },
  {
    id: 7,
    rating: 4,
    text: "Nyaman dan aman untuk bercerita.",
    psikolog: PSIKOLOG[0],
    date: "2026-02-17T10:00:00",
  },
  {
    id: 8,
    rating: 1,
    text: "Link sesi online bermasalah, waktu terbuang.",
    psikolog: PSIKOLOG[1],
    date: "2026-03-05T16:10:00",
  },
  {
    id: 9,
    rating: 5,
    text: "Recommended! Sangat profesional.",
    psikolog: PSIKOLOG[1],
    date: "2026-04-14T09:00:00",
  },
  {
    id: 10,
    rating: 4,
    text: "Cukup puas, ingin lanjut sesi berikutnya.",
    psikolog: PSIKOLOG[0],
    date: "2026-05-27T13:30:00",
  },
  {
    id: 11,
    rating: 3,
    text: "Biasa saja, tapi suasana sesinya tenang.",
    psikolog: PSIKOLOG[0],
    date: "2026-06-22T10:45:00",
  },
  {
    id: 12,
    rating: 5,
    text: "Terbantu sekali, sesinya terstruktur dan hangat.",
    psikolog: PSIKOLOG[1],
    date: "2026-07-18T14:20:00",
  },
  {
    id: 13,
    rating: 4,
    text: "Sesi pertama yang menyenangkan.",
    psikolog: PSIKOLOG[0],
    date: "2026-08-26T10:00:00",
  },
  {
    id: 14,
    rating: 5,
    text: "Jadwalnya mudah dan konselornya responsif.",
    psikolog: PSIKOLOG[1],
    date: "2026-09-30T15:00:00",
  },
];

type SortKey = "new" | "high" | "low";

/* Label anonim konsisten per id, contoh: "Klien Anonim #A3F2" */
const anon = (id: number) =>
  "Klien Anonim #" +
  ((id * 2654435761) >>> 0).toString(16).slice(-4).toUpperCase();

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

/* ========================= BINTANG ========================= */
function Stars({
  value,
  className = "h-4 w-4",
}: {
  value: number;
  className?: string;
}) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={`${className} ${
            i < Math.round(value)
              ? "fill-amber-400 text-amber-400"
              : "fill-slate-200 text-slate-200"
          }`}
        />
      ))}
    </span>
  );
}

/* ========================= PILIHAN PERIODE ========================= */
function PeriodPicker({
  groups,
  selectedId,
  onSelect,
  today,
  countOf,
  totalAll,
}: {
  groups: [string, AcademicPeriod[]][];
  selectedId: string;
  onSelect: (id: string) => void;
  today: string;
  countOf: (p: AcademicPeriod) => number;
  totalAll: number;
}) {
  const allActive = selectedId === "all";

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-[#14553a]" />
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Periode akademik
          </p>
        </div>
        <button
          type="button"
          onClick={() => onSelect("all")}
          className={`rounded-full border px-3.5 py-1.5 text-xs font-bold transition-colors ${
            allActive
              ? "border-[#14553a] bg-[#14553a] text-white"
              : "border-slate-200 bg-white text-slate-600 hover:border-[#2a8f5a]/50"
          }`}
        >
          Semua periode · {totalAll}
        </button>
      </div>

      <div className="space-y-3">
        {groups.map(([ta, list]) => (
          <div
            key={ta}
            className="grid grid-cols-1 gap-2 sm:grid-cols-[6rem_1fr] sm:items-center sm:gap-4"
          >
            <span className="text-sm font-bold text-slate-700">TA {ta}</span>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {list.map((p) => {
                const active = selectedId === p.id;
                const st = periodStatus(p, today);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onSelect(p.id)}
                    className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition-all ${
                      active
                        ? "border-[#14553a] bg-[#14553a] text-white shadow-md"
                        : "border-slate-200 bg-white hover:border-[#2a8f5a]/50 hover:bg-[#f6fcf8]"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold">{p.sem}</p>
                      <p
                        className={`truncate text-[11px] ${
                          active ? "text-emerald-100" : "text-slate-400"
                        }`}
                      >
                        {fmtDate(p.start)} – {fmtDate(p.end)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                          active
                            ? "bg-white/15 text-white"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {countOf(p)} feedback
                      </span>
                      {st === "Aktif" && (
                        <span
                          className={`flex items-center gap-1 text-[10px] font-bold ${
                            active ? "text-emerald-100" : "text-[#15803d]"
                          }`}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          Aktif
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ========================= PAGE ========================= */
export default function AdminFeedbackPage() {
  const today = useMemo(() => toISO(new Date()), []);
  const [periods] = useState<AcademicPeriod[]>(() =>
    sortPeriods(loadPeriods()),
  );

  // Default: periode yang sedang aktif, jika tidak ada pakai periode terbaru
  const [selectedId, setSelectedId] = useState<string>(() => {
    const active = periods.find((p) => isInPeriod(today, p));
    return active?.id ?? periods[periods.length - 1]?.id ?? "all";
  });
  const [star, setStar] = useState(0);
  const [psikolog, setPsikolog] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("new");

  const selected = periods.find((p) => p.id === selectedId) ?? null;

  // Kelompokkan per tahun ajaran, terbaru di atas, semester ganjil lalu genap
  const groups = useMemo(() => {
    const map = new Map<string, AcademicPeriod[]>();
    [...periods]
      .sort((a, b) => b.start.localeCompare(a.start))
      .forEach((p) => map.set(p.ta, [...(map.get(p.ta) ?? []), p]));
    return [...map.entries()].map(
      ([ta, list]) =>
        [ta, [...list].sort((a, b) => a.start.localeCompare(b.start))] as [
          string,
          AcademicPeriod[],
        ],
    );
  }, [periods]);

  const feedbackOf = (p: AcademicPeriod | null) =>
    DATA.filter((f) => !p || isInPeriod(toISO(new Date(f.date)), p));

  const countOf = (p: AcademicPeriod) => feedbackOf(p).length;

  // Data setelah filter periode dan psikolog (untuk ringkasan)
  const base = useMemo(
    () =>
      feedbackOf(selected).filter((f) => !psikolog || f.psikolog === psikolog),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedId, psikolog],
  );

  const total = base.length;
  const avg = total ? base.reduce((sum, f) => sum + f.rating, 0) / total : 0;

  const rows = useMemo(() => {
    const q = query.toLowerCase();
    const byDate = (a: Feedback, b: Feedback) =>
      new Date(b.date).getTime() - new Date(a.date).getTime();

    return base
      .filter(
        (f) => (!star || f.rating === star) && f.text.toLowerCase().includes(q),
      )
      .sort((a, b) =>
        sort === "high"
          ? b.rating - a.rating || byDate(a, b)
          : sort === "low"
            ? a.rating - b.rating || byDate(a, b)
            : byDate(a, b),
      );
  }, [base, star, query, sort]);

  const toggleStar = (n: number) => setStar((prev) => (prev === n ? 0 : n));

  // Info periode yang dipilih (header kartu)
  const selectedStatus = selected ? periodStatus(selected, today) : null;
  const progress = (() => {
    if (!selected || selectedStatus !== "Aktif") return null;
    const total =
      (Date.parse(selected.end) - Date.parse(selected.start)) / 864e5 + 1;
    const day = (Date.parse(today) - Date.parse(selected.start)) / 864e5 + 1;
    return {
      day: Math.round(day),
      total: Math.round(total),
      pct: Math.min(100, Math.round((day / total) * 100)),
    };
  })();

  const statusStyle = {
    Aktif: "bg-emerald-50 text-[#14553a] border-emerald-200",
    Mendatang: "bg-sky-50 text-sky-700 border-sky-200",
    Selesai: "bg-slate-100 text-slate-500 border-slate-200",
  } as const;

  return (
    <div className="mx-auto max-w-7xl space-y-6 font-[Inter] text-slate-800">
      {/* Judul */}
      <div>
        <h2 className="text-xl font-bold">Feedback Klien</h2>
        <p className="text-xs text-slate-500">
          Penilaian anonim dari klien untuk psikolog setelah sesi konseling.
        </p>
      </div>

      {/* Filter periode */}
      <PeriodPicker
        groups={groups}
        selectedId={selectedId}
        onSelect={setSelectedId}
        today={today}
        countOf={countOf}
        totalAll={DATA.length}
      />

      {/* Header periode terpilih */}
      <div className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Menampilkan
          </p>
          <p className="text-base font-bold">
            {selected ? `TA ${selected.label}` : "Semua periode akademik"}
          </p>
          <p className="text-xs text-slate-500">
            {selected
              ? `${fmtDate(selected.start)} sampai ${fmtDate(selected.end)}`
              : "Seluruh feedback dari semua periode"}
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          {selectedStatus && (
            <span
              className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusStyle[selectedStatus]}`}
            >
              {selectedStatus}
            </span>
          )}
          {progress && (
            <div className="w-48">
              <div className="mb-1 flex justify-between text-[10px] font-semibold text-slate-500">
                <span>Hari ke-{progress.day}</span>
                <span>dari {progress.total}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white">
                <div
                  className="h-full rounded-full bg-[#2a8f5a]"
                  style={{ width: `${progress.pct}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Ringkasan */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-400">
                Total Feedback
              </p>
              <h3 className="text-4xl font-bold">{total}</h3>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-100 bg-emerald-50 text-[#15803d]">
              <MessageSquareText className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-6 border-t border-slate-100 pt-4">
            <p className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-400">
              Rata-rata Rating
            </p>
            <div className="flex items-center gap-3">
              <span className="text-3xl font-bold">{avg.toFixed(1)}</span>
              <Stars value={avg} className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
          <h3 className="mb-1 text-base font-bold">Distribusi Bintang</h3>
          <p className="mb-4 text-xs text-slate-400">
            Klik baris untuk memfilter daftar feedback.
          </p>
          <div className="space-y-2.5">
            {[5, 4, 3, 2, 1].map((n) => {
              const count = base.filter((f) => f.rating === n).length;
              const pct = total ? Math.round((count / total) * 100) : 0;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => toggleStar(n)}
                  className={`flex w-full items-center gap-3 rounded-lg px-2 py-1 text-xs ${
                    star === n ? "bg-[#f0fdf4]" : "hover:bg-slate-50"
                  }`}
                >
                  <span className="flex w-10 items-center gap-1 text-left font-bold text-slate-600">
                    {n}{" "}
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  </span>
                  <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <span
                      className="block h-full rounded-full bg-[#15803d] transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </span>
                  <span className="w-16 text-right font-semibold text-slate-500">
                    {count} ({pct}%)
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Daftar feedback */}
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-100 p-6 lg:flex-row lg:items-center">
          <div>
            <h3 className="text-base font-bold">Daftar Feedback</h3>
            <p className="text-xs text-slate-400">
              Menampilkan {rows.length} dari {total} feedback
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari isi feedback..."
                className="w-full rounded-xl border border-slate-200 py-2 pl-8 pr-3 text-xs focus:border-[#22c55e] focus:outline-none focus:ring-2 focus:ring-[#22c55e]/30 sm:w-52"
              />
            </div>

            <select
              value={psikolog}
              onChange={(e) => setPsikolog(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#22c55e]/30"
            >
              <option value="">Semua psikolog</option>
              {PSIKOLOG.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>

            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#22c55e]/30"
            >
              <option value="new">Terbaru</option>
              <option value="high">Bintang tertinggi</option>
              <option value="low">Bintang terendah</option>
            </select>
          </div>
        </div>

        {/* Filter bintang */}
        <div className="flex flex-wrap gap-2 border-b border-slate-100 bg-slate-50/50 px-6 py-3">
          {[0, 5, 4, 3, 2, 1].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setStar(n)}
              className={`flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${
                star === n
                  ? "border-[#15803d] bg-[#15803d] text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-[#22c55e]"
              }`}
            >
              {n === 0 ? (
                "Semua"
              ) : (
                <>
                  {n} <Star className="h-2.5 w-2.5 fill-current" />
                </>
              )}
            </button>
          ))}
        </div>

        {/* List */}
        {rows.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {rows.map((f) => (
              <div
                key={f.id}
                className="flex gap-4 p-6 transition-colors hover:bg-slate-50/50"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  <VenetianMask className="h-5 w-5" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold">{anon(f.id)}</span>
                      <Stars value={f.rating} className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-[11px] font-medium text-slate-400">
                      {formatDate(f.date)}
                    </span>
                  </div>

                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                    {f.text}
                  </p>

                  <span className="mt-2.5 inline-flex items-center gap-1 rounded-full border border-emerald-100 bg-[#f0fdf4] px-2.5 py-1 text-[10px] font-bold text-[#15803d]">
                    <Stethoscope className="h-3 w-3" />
                    {f.psikolog}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center py-16 text-center text-slate-400">
            <Meh className="mb-2 h-8 w-8" />
            <p className="text-sm font-medium">
              {selected && total === 0
                ? "Belum ada feedback pada periode ini."
                : "Tidak ada feedback yang cocok."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
