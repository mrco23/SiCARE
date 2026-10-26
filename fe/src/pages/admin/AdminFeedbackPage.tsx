import { useEffect, useMemo, useRef, useState } from "react";
import { PageContainer, PageHeader } from "../../components/shared";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Eye,
  EyeOff,
  Ban,
  X,
  RotateCcw,
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

  Alur moderasi:
  - Feedback baru dari klien masuk dengan status "pending".
  - Admin memeriksa isinya, lalu menekan "Tampilkan" -> status "shown".
  - Admin dapat menonaktifkan feedback dengan alasan wajib.
  - Feedback yang dinonaktifkan dapat diperiksa ulang atau ditampilkan.
  Hanya feedback berstatus "shown" yang boleh ditampilkan ke publik.
*/
type FeedbackStatus = "pending" | "disabled" | "shown";

type Feedback = {
  id: number;
  rating: number;
  text: string;
  psikolog: string;
  date: string; // ISO datetime
  status: FeedbackStatus;
  disabledReason?: string;
};

type SortKey = "new" | "high" | "low";
type StatusFilter = "all" | FeedbackStatus;

const MODERATION_STORAGE_KEY = "sicare:admin:feedback-moderation";
type FeedbackModeration = { status: FeedbackStatus; disabledReason?: string };

function loadModeration(): Record<string, FeedbackModeration> {
  try {
    const raw = localStorage.getItem(MODERATION_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return {};
    const result: Record<string, FeedbackModeration> = {};
    for (const [id, value] of Object.entries(parsed)) {
      if (!value || typeof value !== "object" || Array.isArray(value)) continue;
      const record = value as Record<string, unknown>;
      if (
        record.status !== "pending" &&
        record.status !== "disabled" &&
        record.status !== "shown"
      )
        continue;
      const reason =
        typeof record.disabledReason === "string"
          ? record.disabledReason.trim()
          : "";
      if (record.status === "disabled" && !reason) continue;
      result[id] = {
        status: record.status,
        disabledReason: record.status === "disabled" ? reason : undefined,
      };
    }
    return result;
  } catch {
    return {};
  }
}

const PSIKOLOG = ["Ma'am Giovanna Yudi, M.Psi", "Dr. Budi Santoso, Psikolog"];

const DATA: Feedback[] = [
  {
    id: 1,
    rating: 5,
    text: "Sesinya membantu, saya merasa didengarkan.",
    psikolog: PSIKOLOG[0],
    date: "2025-08-27T10:15:00",
    status: "shown",
  },
  {
    id: 2,
    rating: 4,
    text: "Penjelasannya jelas dan mudah dipahami.",
    psikolog: PSIKOLOG[1],
    date: "2025-09-12T14:00:00",
    status: "shown",
  },
  {
    id: 3,
    rating: 5,
    text: "Psikolognya ramah dan tidak menghakimi.",
    psikolog: PSIKOLOG[0],
    date: "2025-10-03T09:30:00",
    status: "shown",
  },
  {
    id: 4,
    rating: 3,
    text: "Sesi lumayan, tapi sempat mulai terlambat.",
    psikolog: PSIKOLOG[1],
    date: "2025-11-18T13:00:00",
    status: "shown",
  },
  {
    id: 5,
    rating: 2,
    text: "Saran yang diberikan terasa terlalu umum.",
    psikolog: PSIKOLOG[1],
    date: "2025-12-09T11:20:00",
    status: "shown",
  },
  {
    id: 6,
    rating: 5,
    text: "Saya punya langkah konkret untuk kecemasan presentasi.",
    psikolog: PSIKOLOG[0],
    date: "2026-01-22T15:40:00",
    status: "shown",
  },
  {
    id: 7,
    rating: 4,
    text: "Nyaman dan aman untuk bercerita.",
    psikolog: PSIKOLOG[0],
    date: "2026-02-17T10:00:00",
    status: "shown",
  },
  {
    id: 8,
    rating: 1,
    text: "Link sesi online bermasalah, waktu terbuang.",
    psikolog: PSIKOLOG[1],
    date: "2026-03-05T16:10:00",
    status: "shown",
  },
  {
    id: 9,
    rating: 5,
    text: "Recommended! Sangat profesional.",
    psikolog: PSIKOLOG[1],
    date: "2026-04-14T09:00:00",
    status: "shown",
  },
  {
    id: 10,
    rating: 4,
    text: "Cukup puas, ingin lanjut sesi berikutnya.",
    psikolog: PSIKOLOG[0],
    date: "2026-05-27T13:30:00",
    status: "shown",
  },
  {
    id: 11,
    rating: 3,
    text: "Biasa saja, tapi suasana sesinya tenang.",
    psikolog: PSIKOLOG[0],
    date: "2026-06-22T10:45:00",
    status: "shown",
  },
  {
    id: 12,
    rating: 5,
    text: "Terbantu sekali, sesinya terstruktur dan hangat.",
    psikolog: PSIKOLOG[1],
    date: "2026-07-18T14:20:00",
    status: "pending",
  },
  {
    id: 13,
    rating: 4,
    text: "Sesi pertama yang menyenangkan.",
    psikolog: PSIKOLOG[0],
    date: "2026-08-26T10:00:00",
    status: "pending",
  },
  {
    id: 14,
    rating: 5,
    text: "Jadwalnya mudah dan konselornya responsif.",
    psikolog: PSIKOLOG[1],
    date: "2026-09-30T15:00:00",
    status: "pending",
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
const feedbackInPeriod = (items: Feedback[], p: AcademicPeriod | null) =>
  items.filter((f) => !p || isInPeriod(toISO(new Date(f.date)), p));

const STATUS_STYLE: Record<PeriodStatus, string> = {
  Aktif: "bg-emerald-50 text-primary border-emerald-200",
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
  items,
  selectedId,
  onSelect,
  today,
}: {
  periods: AcademicPeriod[];
  items: Feedback[];
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
            ? "border-brand-accent ring-4 ring-brand-accent/15"
            : "border-slate-200 hover:border-brand-accent/50"
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
                  ? "bg-[#f0fdf4] text-primary"
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
                      ? "bg-white text-primary shadow-sm"
                      : "text-slate-600 hover:bg-white/70"
                  }`}
                >
                  {y}
                  {selected?.ta === y && (
                    <span className="h-1.5 w-1.5 rounded-full bg-brand-accent" />
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
                        ? "border-primary bg-primary text-white"
                        : "border-slate-200 bg-white hover:border-brand-accent/50 hover:bg-[#f6fcf8]"
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
                        {feedbackInPeriod(items, p).length} feedback
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

  const [items, setItems] = useState<Feedback[]>(() => {
    const saved = loadModeration();
    return DATA.map((item) => ({ ...item, ...(saved[String(item.id)] ?? {}) }));
  });
  const [disableId, setDisableId] = useState<number | null>(null);
  const [disableReason, setDisableReason] = useState("");
  const [disableError, setDisableError] = useState("");

  // Default: periode yang aktif hari ini, jika tidak ada pakai periode terbaru
  const [selectedId, setSelectedId] = useState<string>(() => {
    const active = periods.find((p) => isInPeriod(today, p));
    return active?.id ?? periods[periods.length - 1]?.id ?? "all";
  });
  const [star, setStar] = useState(0);
  const [psikolog, setPsikolog] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("new");
  // Default membuka antrean feedback yang belum diperiksa
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [toast, setToast] = useState("");
  const toastTimeout = useRef<ReturnType<typeof window.setTimeout> | null>(
    null,
  );

  useEffect(
    () => () => {
      if (toastTimeout.current !== null)
        window.clearTimeout(toastTimeout.current);
    },
    [],
  );

  useEffect(() => {
    try {
      const moderation: Record<string, FeedbackModeration> = {};
      for (const item of items) {
        moderation[String(item.id)] = {
          status: item.status,
          disabledReason:
            item.status === "disabled" ? item.disabledReason : undefined,
        };
      }
      localStorage.setItem(MODERATION_STORAGE_KEY, JSON.stringify(moderation));
    } catch {
      // Penyimpanan browser tidak tersedia, moderasi tetap berjalan dalam state React.
    }
  }, [items]);

  useEffect(() => {
    if (disableId === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDisableId(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [disableId]);

  const showToast = (message: string) => {
    setToast(message);
    if (toastTimeout.current !== null)
      window.clearTimeout(toastTimeout.current);
    toastTimeout.current = window.setTimeout(() => setToast(""), 2400);
  };

  const selected = periods.find((p) => p.id === selectedId) ?? null;

  // Data setelah filter periode dan psikolog
  const base = useMemo(
    () =>
      feedbackInPeriod(items, selected).filter(
        (f) => !psikolog || f.psikolog === psikolog,
      ),
    [items, selected, psikolog],
  );

  const total = base.length;
  const avg = total ? base.reduce((sum, f) => sum + f.rating, 0) / total : 0;
  const pendingCount = base.filter((f) => f.status === "pending").length;
  const shownCount = base.filter((f) => f.status === "shown").length;
  const disabledCount = base.filter((f) => f.status === "disabled").length;

  const rows = useMemo(() => {
    const q = query.toLowerCase();
    const byDate = (a: Feedback, b: Feedback) =>
      new Date(b.date).getTime() - new Date(a.date).getTime();

    return base
      .filter(
        (f) =>
          (statusFilter === "all" || f.status === statusFilter) &&
          (!star || f.rating === star) &&
          f.text.toLowerCase().includes(q),
      )
      .sort((a, b) =>
        sort === "high"
          ? b.rating - a.rating || byDate(a, b)
          : sort === "low"
            ? a.rating - b.rating || byDate(a, b)
            : byDate(a, b),
      );
  }, [base, star, query, sort, statusFilter]);

  const toggleStar = (n: number) => setStar((prev) => (prev === n ? 0 : n));

  // Prototype: nantinya kirim PATCH /api/admin/feedback/:id melalui backend.
  const setFeedbackStatus = (
    id: number,
    status: FeedbackStatus,
    reason = "",
  ) => {
    setItems((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              status,
              disabledReason: status === "disabled" ? reason : undefined,
            }
          : item,
      ),
    );
    showToast(
      status === "shown"
        ? "Feedback ditampilkan."
        : status === "disabled"
          ? "Feedback dinonaktifkan beserta alasannya."
          : "Feedback dikembalikan ke antrean pemeriksaan.",
    );
  };

  const openDisableModal = (item: Feedback) => {
    setDisableId(item.id);
    setDisableReason(item.disabledReason ?? "");
    setDisableError("");
  };

  const confirmDisable = () => {
    if (disableId === null) return;
    const reason = disableReason.trim();
    if (!reason) {
      setDisableError("Alasan penonaktifan wajib diisi.");
      return;
    }
    setFeedbackStatus(disableId, "disabled", reason);
    setDisableId(null);
    setDisableReason("");
    setDisableError("");
  };

  const STATUS_TABS: { key: StatusFilter; label: string; count: number }[] = [
    { key: "pending", label: "Menunggu pemeriksaan", count: pendingCount },
    { key: "disabled", label: "Dinonaktifkan", count: disabledCount },
    { key: "shown", label: "Ditampilkan", count: shownCount },
    { key: "all", label: "Semua", count: total },
  ];

  const emptyMessage =
    total === 0
      ? "Belum ada feedback pada periode ini."
      : statusFilter === "pending" && pendingCount === 0
        ? "Semua feedback sudah diperiksa. Tidak ada yang menunggu."
        : statusFilter === "disabled" && disabledCount === 0
          ? "Tidak ada feedback yang dinonaktifkan."
          : "Tidak ada feedback yang cocok.";

  return (
    <PageContainer role="admin">
      {/* Judul */}
      <PageHeader
        title="Feedback Klien"
        description="Penilaian anonim dari klien untuk psikolog setelah sesi konseling. Periksa feedback baru, lalu tampilkan yang sesuai."
      />

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

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800">
              <Clock className="h-3 w-3" />
              {pendingCount} menunggu
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-primary">
              <Eye className="h-3 w-3" />
              {shownCount} ditampilkan
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700">
              <Ban className="h-3 w-3" />
              {disabledCount} dinonaktifkan
            </span>
          </div>

          <div className="mt-5 border-t border-slate-100 pt-4">
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
          items={items}
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

        {/* Tab status moderasi */}
        <div
          className="flex flex-wrap gap-2 border-b border-slate-100 px-6 py-3"
          role="tablist"
          aria-label="Status feedback"
        >
          {STATUS_TABS.map((tab) => {
            const active = statusFilter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setStatusFilter(tab.key)}
                className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-bold transition-colors ${
                  active
                    ? "border-primary bg-primary text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-[#22c55e]"
                }`}
              >
                {tab.label}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                    active
                      ? "bg-white/20 text-white"
                      : tab.key === "pending" && tab.count > 0
                        ? "bg-amber-100 text-amber-800"
                        : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
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
            {rows.map((f) => {
              const isPending = f.status === "pending";
              const isDisabled = f.status === "disabled";
              return (
                <div
                  key={f.id}
                  className={`flex gap-4 p-6 transition-colors hover:bg-slate-50/50 ${
                    isPending
                      ? "bg-amber-50/30"
                      : isDisabled
                        ? "bg-rose-50/30"
                        : ""
                  }`}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                    <VenetianMask className="h-5 w-5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-sm font-bold">{anon(f.id)}</span>
                        <Stars value={f.rating} className="h-3.5 w-3.5" />
                        {isPending ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                            <Clock className="h-3 w-3" />
                            Menunggu pemeriksaan
                          </span>
                        ) : isDisabled ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                            <Ban className="h-3 w-3" />
                            Dinonaktifkan
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-primary">
                            <CheckCircle2 className="h-3 w-3" />
                            Ditampilkan
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-medium text-slate-400">
                        {formatDate(f.date)}
                      </span>
                    </div>

                    <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                      {f.text}
                    </p>

                    {isDisabled && (
                      <div className="mt-3 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                        <span className="font-bold">Alasan penonaktifan: </span>
                        {f.disabledReason}
                      </div>
                    )}
                    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-100 bg-[#f0fdf4] px-2.5 py-1 text-[10px] font-bold text-[#15803d]">
                        <Stethoscope className="h-3 w-3" />
                        {f.psikolog}
                      </span>

                      <div className="flex flex-wrap items-center gap-2">
                        {f.status !== "shown" && (
                          <button
                            type="button"
                            onClick={() => setFeedbackStatus(f.id, "shown")}
                            className="inline-flex items-center gap-1.5 rounded-full bg-[#15803d] px-4 py-1.5 text-xs font-bold text-white transition hover:bg-primary"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Tampilkan
                          </button>
                        )}
                        {f.status !== "disabled" && (
                          <button
                            type="button"
                            onClick={() => openDisableModal(f)}
                            className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-4 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50"
                          >
                            <EyeOff className="h-3.5 w-3.5" />
                            Nonaktifkan
                          </button>
                        )}
                        {isDisabled && (
                          <button
                            type="button"
                            onClick={() => setFeedbackStatus(f.id, "pending")}
                            className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-4 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            Periksa ulang
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center py-16 text-center text-slate-400">
            <Meh className="mb-2 h-8 w-8" />
            <p className="text-sm font-medium">{emptyMessage}</p>
          </div>
        )}
      </div>

      {disableId !== null && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4"
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="disable-feedback-title"
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3
                  id="disable-feedback-title"
                  className="text-lg font-bold text-slate-800"
                >
                  Nonaktifkan feedback
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Feedback tidak akan ditampilkan. Berikan alasan untuk
                  pencatatan moderasi.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDisableId(null)}
                aria-label="Tutup"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <label
              htmlFor="feedback-disable-reason"
              className="mt-5 block text-sm font-semibold text-slate-700"
            >
              Alasan penonaktifan <span className="text-red-600">*</span>
            </label>
            <textarea
              id="feedback-disable-reason"
              rows={4}
              maxLength={500}
              autoFocus
              value={disableReason}
              onChange={(e) => {
                setDisableReason(e.target.value);
                setDisableError("");
              }}
              placeholder="Jelaskan alasan feedback tidak dapat ditampilkan..."
              className="mt-2 w-full resize-none rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-[#15803d] focus:ring-2 focus:ring-[#15803d]/15"
            />
            {disableError && (
              <p role="alert" className="mt-1 text-xs text-red-600">
                {disableError}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDisableId(null)}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmDisable}
                className="rounded-xl bg-[#15803d] px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary"
              >
                Simpan alasan & nonaktifkan
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          role="status"
          className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-lg"
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
            {toast}
          </span>
        </div>
      )}
    </PageContainer>
  );
}
