import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
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
  type PeriodStatus,
} from "../../lib/academicPeriods";

/* ========================= TIPE & DATA ========================= */
/*
  DATA CONTOH: ganti dengan fetch('/api/admin/feedback?periodeId=...').
  Nama klien TIDAK dikirim dari server; label anonim dibuat di sini.
*/
type Feedback = {
  id: number;
  rating: number;
  text: string;
  psikolog: string;
  date: string; // ISO datetime
};

type SortKey = "new" | "high" | "low";

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

/* Feedback dalam satu periode (null = semua periode) */
const feedbackInPeriod = (p: AcademicPeriod | null) =>
  DATA.filter((f) => !p || isInPeriod(toISO(new Date(f.date)), p));

const STATUS_STYLE: Record<PeriodStatus, string> = {
  Aktif: "bg-emerald-50 text-[#14553a] border-emerald-200",
  Mendatang: "bg-sky-50 text-sky-700 border-sky-200",
  Selesai: "bg-slate-100 text-slate-500 border-slate-200",
};

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

/* ========================= DROPDOWN PERIODE ========================= */
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
  const [ta, setTa] = useState<string | null>(null); // tahun ajaran yang sedang dibuka
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = periods.find((p) => p.id === selectedId) ?? null;
  const years = useMemo(
    () => [...new Set(periods.map((p) => p.ta))].sort().reverse(),
    [periods],
  );
  const semestersOf = (year: string) =>
    periods
      .filter((p) => p.ta === year)
      .sort((a, b) => a.start.localeCompare(b.start));

  // Tutup saat klik di luar atau menekan Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
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
    setOpen((v) => !v);
  };

  const pick = (id: string) => {
    onSelect(id);
    setOpen(false);
  };

  const activeYear = ta ?? years[0] ?? null;
  const triggerStatus = selected ? periodStatus(selected, today) : null;

  return (
    <div ref={rootRef} className="relative">
      {/* Tombol pemicu */}
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className={`flex w-full items-center justify-between gap-4 rounded-2xl border bg-white px-4 py-3 text-left shadow-sm transition-colors sm:w-96 ${
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

      {/* Panel */}
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

          <div className="grid grid-cols-[9rem_1fr]">
            {/* Kolom tahun ajaran */}
            <div className="max-h-72 space-y-1 overflow-y-auto border-r border-slate-100 bg-slate-50/60 p-2">
              <p className="px-2 pb-1 pt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Tahun ajaran
              </p>
              {years.map((y) => (
                <button
                  key={y}
                  type="button"
                  onClick={() => setTa(y)}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm font-semibold transition-colors ${
                    activeYear === y
                      ? "bg-white text-[#14553a] shadow-sm"
                      : "text-slate-600 hover:bg-white/70"
                  }`}
                >
                  {y}
                  {selected?.ta === y && (
                    <span className="h-1.5 w-1.5 rounded-full bg-[#2a8f5a]" />
                  )}
                </button>
              ))}
            </div>

            {/* Kolom semester */}
            <div className="space-y-2 p-3">
              <p className="px-1 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Semester · TA {activeYear}
              </p>
              {(["Ganjil", "Genap"] as const).map((sem) => {
                const p = activeYear
                  ? semestersOf(activeYear).find((x) => x.sem === sem)
                  : undefined;

                if (!p) {
                  return (
                    <div
                      key={sem}
                      className="rounded-xl border border-dashed border-slate-200 px-4 py-3 text-xs text-slate-400"
                    >
                      <span className="font-semibold">{sem}</span> · belum
                      dibuat di Pengaturan
                    </div>
                  );
                }

                const active = selectedId === p.id;
                const st = periodStatus(p, today);
                return (
                  <button
                    key={sem}
                    type="button"
                    onClick={() => pick(p.id)}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                      active
                        ? "border-[#14553a] bg-[#14553a] text-white"
                        : "border-slate-200 bg-white hover:border-[#2a8f5a]/50 hover:bg-[#f6fcf8]"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold">{sem}</p>
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
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          active
                            ? "bg-white/15 text-white"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {feedbackInPeriod(p).length} feedback
                      </span>
                      <span
                        className={`text-[10px] font-bold ${
                          active
                            ? "text-emerald-100"
                            : st === "Aktif"
                              ? "text-[#15803d]"
                              : "text-slate-400"
                        }`}
                      >
                        {st}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ========================= PAGE ========================= */
export default function AdminFeedbackPage() {
  const today = useMemo(() => toISO(new Date()), []);
  const periods = useMemo(() => sortPeriods(loadPeriods()), []);

  // Default: periode yang aktif hari ini, jika tidak ada pakai periode terbaru
  const [selectedId, setSelectedId] = useState<string>(() => {
    const active = periods.find((p) => isInPeriod(today, p));
    return active?.id ?? periods[periods.length - 1]?.id ?? "all";
  });
  const [star, setStar] = useState(0);
  const [psikolog, setPsikolog] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("new");

  const selected = periods.find((p) => p.id === selectedId) ?? null;

  // Data setelah filter periode dan psikolog
  const base = useMemo(
    () =>
      feedbackInPeriod(selected).filter(
        (f) => !psikolog || f.psikolog === psikolog,
      ),
    [selected, psikolog],
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

  return (
    <div className="mx-auto max-w-7xl space-y-6 font-[Inter] text-slate-800">
      {/* Judul */}
      <div>
        <h2 className="text-xl font-bold">Feedback Klien</h2>
        <p className="text-xs text-slate-500">
          Penilaian anonim dari klien untuk psikolog setelah sesi konseling.
        </p>
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

      {/* Filter periode: tepat di atas daftar feedback */}
      <div className="relative z-20 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PeriodDropdown
          periods={periods}
          selectedId={selectedId}
          onSelect={setSelectedId}
          today={today}
        />
        <p className="text-xs text-slate-400">
          {selected
            ? `Menampilkan feedback TA ${selected.label}`
            : "Menampilkan feedback dari semua periode"}
        </p>
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
