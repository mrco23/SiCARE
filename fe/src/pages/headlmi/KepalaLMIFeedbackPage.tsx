import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  MessageSquareHeart,
  MessageSquareText,
  Minus,
  Star,
  ThumbsDown,
  ThumbsUp,
  UsersRound,
} from "lucide-react";
import { Link } from "react-router-dom";
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

type Feedback = {
  id: string;
  date: string;
  counselor: string;
  rating: number;
  category: "Individu" | "Kelompok";
  comment: string;
  status: "Baru" | "Ditinjau" | "Selesai";
};

/* Data sintetis untuk desain frontend. Ganti dengan data dari backend saat integrasi. */
const COUNSELORS = [
  "Konselor A",
  "Konselor B",
  "Konselor C",
  "Konselor D",
  "Konselor E",
];

const SAMPLE_COMMENTS = [
  "Konselor menjelaskan dengan jelas dan membantu saya memahami langkah berikutnya.",
  "Sesi terasa nyaman dan saya diberi ruang untuk menyampaikan pendapat.",
  "Jadwal perlu lebih fleksibel agar mudah disesuaikan dengan kegiatan kuliah.",
  "Saya berharap tersedia informasi lanjutan setelah sesi selesai.",
  "Pelaksanaan sesi berjalan tertib dan sesuai jadwal.",
  "Durasi sesi terasa kurang untuk membahas kebutuhan saya.",
  "Konselor mendengarkan dengan baik dan tidak menghakimi.",
  "Informasi pendaftaran dan konfirmasi jadwal cukup mudah dipahami.",
];

const FEEDBACKS: Feedback[] = Array.from({ length: 150 }, (_, index) => {
  const date = new Date(Date.UTC(2024, 7, 25) + index * 3.1 * 864e5);
  const ratings = [5, 4, 5, 4, 3, 5, 2, 4, 5, 1, 4, 5];

  return {
    id: `FB${String(index + 1).padStart(3, "0")}`,
    date: date.toISOString().slice(0, 10),
    counselor: COUNSELORS[index % COUNSELORS.length],
    rating: ratings[index % ratings.length],
    category: index % 4 === 0 ? "Kelompok" : "Individu",
    comment: SAMPLE_COMMENTS[index % SAMPLE_COMMENTS.length],
    status: index % 5 === 0 ? "Baru" : index % 5 === 1 ? "Ditinjau" : "Selesai",
  };
});

const STATUS_STYLE: Record<PeriodStatus, string> = {
  Aktif: "border-emerald-200 bg-emerald-50 text-[#14553a]",
  Mendatang: "border-sky-200 bg-sky-50 text-sky-700",
  Selesai: "border-slate-200 bg-slate-100 text-slate-500",
};

const REVIEW_STYLE: Record<Feedback["status"], string> = {
  Baru: "bg-amber-50 text-amber-700",
  Ditinjau: "bg-sky-50 text-sky-700",
  Selesai: "bg-emerald-50 text-emerald-700",
};

const percent = (value: number, total: number) =>
  total > 0 ? Math.round((value / total) * 100) : 0;

const feedbackInPeriod = (period: AcademicPeriod | null) =>
  FEEDBACKS.filter(
    (feedback) =>
      !period ||
      isInPeriod(toISO(new Date(`${feedback.date}T00:00:00`)), period),
  );

function MetricCard({
  label,
  value,
  note,
  icon: Icon,
  tone = "green",
}: {
  label: string;
  value: string | number;
  note: string;
  icon: typeof Star;
  tone?: "green" | "red" | "blue" | "gold";
}) {
  const tones = {
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
        <span className={`rounded-xl p-2 ${tones[tone]}`}>
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
  feedbackCount,
}: {
  periods: AcademicPeriod[];
  selectedId: string;
  onSelect: (id: string) => void;
  today: string;
  feedbackCount: (period: AcademicPeriod) => number;
}) {
  const [open, setOpen] = useState(false);
  const [activeYear, setActiveYear] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = periods.find((period) => period.id === selectedId) ?? null;

  const years = useMemo(
    () => [...new Set(periods.map((period) => period.ta))].sort().reverse(),
    [periods],
  );

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const toggle = () => {
    if (!open) setActiveYear(selected?.ta ?? years[0] ?? null);
    setOpen((value) => !value);
  };

  const selectPeriod = (id: string) => {
    onSelect(id);
    setOpen(false);
  };

  const year = activeYear ?? years[0] ?? null;
  const selectedStatus = selected ? periodStatus(selected, today) : null;

  return (
    <div ref={rootRef} className="relative w-full sm:w-[390px]">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className={`flex w-full items-center justify-between gap-4 rounded-2xl border bg-white px-4 py-3 text-left shadow-sm transition ${
          open
            ? "border-[#2a8f5a] ring-4 ring-[#2a8f5a]/15"
            : "border-slate-200 hover:border-[#2a8f5a]/50"
        }`}
      >
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Periode evaluasi
          </p>
          <p className="truncate text-sm font-bold text-slate-800">
            {selected ? `TA ${selected.ta} · ${selected.sem}` : "Semua periode"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {selectedStatus && (
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${STATUS_STYLE[selectedStatus]}`}
            >
              {selectedStatus}
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
              onClick={() => selectPeriod("all")}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${
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
              Belum ada periode akademik. Tambahkan periode melalui menu
              Periode.
            </div>
          ) : (
            <div className="grid grid-cols-[9rem_1fr]">
              <div className="max-h-72 space-y-1 overflow-y-auto border-r border-slate-100 bg-slate-50/60 p-2">
                <p className="px-2 pb-1 pt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Tahun akademik
                </p>
                {years.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setActiveYear(item)}
                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm font-semibold transition ${
                      year === item
                        ? "bg-white text-[#14553a] shadow-sm"
                        : "text-slate-600 hover:bg-white/70"
                    }`}
                  >
                    {item}
                    {selected?.ta === item && (
                      <span className="h-1.5 w-1.5 rounded-full bg-[#2a8f5a]" />
                    )}
                  </button>
                ))}
              </div>

              <div className="space-y-2 p-3">
                <p className="px-1 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Semester · TA {year}
                </p>
                {(["Ganjil", "Genap"] as const).map((semester) => {
                  const period = periods
                    .filter((item) => item.ta === year)
                    .find((item) => item.sem === semester);

                  if (!period) {
                    return (
                      <div
                        key={semester}
                        className="rounded-xl border border-dashed border-slate-200 px-4 py-3 text-xs text-slate-400"
                      >
                        <span className="font-semibold">{semester}</span> ·
                        belum tersedia
                      </div>
                    );
                  }

                  const active = selectedId === period.id;
                  const status = periodStatus(period, today);

                  return (
                    <button
                      key={semester}
                      type="button"
                      onClick={() => selectPeriod(period.id)}
                      className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition ${
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
                          {feedbackCount(period)} feedback
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

function Stars({
  rating,
  size = "h-4 w-4",
}: {
  rating: number;
  size?: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-0.5"
      aria-label={`Rating ${rating} dari 5`}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`${size} ${star <= rating ? "fill-amber-400 text-amber-400" : "text-slate-200"}`}
        />
      ))}
    </span>
  );
}

function downloadCSV(filename: string, data: (string | number)[][]) {
  const csv = data
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
    )
    .join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function KepalaLMIFeedbackPage() {
  const today = useMemo(() => toISO(new Date()), []);
  const periods = useMemo(() => sortPeriods(loadPeriods()), []);
  const [periodId, setPeriodId] = useState<string>(() => {
    const active = periods.find((period) => isInPeriod(today, period));
    return active?.id ?? periods[periods.length - 1]?.id ?? "all";
  });
  const [ratingFilter, setRatingFilter] = useState<
    "Semua" | "Positif" | "Netral" | "Negatif"
  >("Semua");
  const [categoryFilter, setCategoryFilter] = useState<
    "Semua" | "Individu" | "Kelompok"
  >("Semua");
  const [search, setSearch] = useState("");

  const period = periods.find((item) => item.id === periodId) ?? null;
  const periodRows = useMemo(() => feedbackInPeriod(period), [period]);

  const rows = useMemo(
    () =>
      periodRows.filter((feedback) => {
        const matchesRating =
          ratingFilter === "Semua" ||
          (ratingFilter === "Positif" && feedback.rating >= 4) ||
          (ratingFilter === "Netral" && feedback.rating === 3) ||
          (ratingFilter === "Negatif" && feedback.rating <= 2);
        const matchesCategory =
          categoryFilter === "Semua" || feedback.category === categoryFilter;
        const matchesSearch =
          search.trim() === "" ||
          feedback.id.toLowerCase().includes(search.toLowerCase()) ||
          feedback.counselor.toLowerCase().includes(search.toLowerCase()) ||
          feedback.comment.toLowerCase().includes(search.toLowerCase());
        return matchesRating && matchesCategory && matchesSearch;
      }),
    [periodRows, ratingFilter, categoryFilter, search],
  );

  const averageRating = rows.length
    ? rows.reduce((sum, feedback) => sum + feedback.rating, 0) / rows.length
    : 0;
  const positive = rows.filter((feedback) => feedback.rating >= 4).length;
  const neutral = rows.filter((feedback) => feedback.rating === 3).length;
  const negative = rows.filter((feedback) => feedback.rating <= 2).length;
  const pendingReview = rows.filter(
    (feedback) => feedback.status !== "Selesai",
  ).length;

  const distribution = [5, 4, 3, 2, 1].map((rating) => ({
    rating,
    count: rows.filter((feedback) => feedback.rating === rating).length,
  }));
  const maxRatingCount = Math.max(1, ...distribution.map((item) => item.count));

  const monthly = useMemo(() => {
    const map: Record<string, { total: number; ratingSum: number }> = {};
    rows.forEach((feedback) => {
      const month = feedback.date.slice(0, 7);
      map[month] ??= { total: 0, ratingSum: 0 };
      map[month].total += 1;
      map[month].ratingSum += feedback.rating;
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => ({
        key,
        total: value.total,
        average: value.total ? value.ratingSum / value.total : 0,
      }));
  }, [rows]);

  const counselorRows = useMemo(
    () =>
      COUNSELORS.map((counselor) => {
        const feedbacks = rows.filter(
          (feedback) => feedback.counselor === counselor,
        );
        const avg = feedbacks.length
          ? feedbacks.reduce((sum, feedback) => sum + feedback.rating, 0) /
            feedbacks.length
          : 0;
        const positiveCount = feedbacks.filter(
          (feedback) => feedback.rating >= 4,
        ).length;
        const negativeCount = feedbacks.filter(
          (feedback) => feedback.rating <= 2,
        ).length;
        return {
          counselor,
          count: feedbacks.length,
          average: avg,
          positive: positiveCount,
          negative: negativeCount,
        };
      }).filter((item) => item.count > 0),
    [rows],
  );

  const exportReport = () => {
    const data: (string | number)[][] = [
      ["Ringkasan Feedback SiCARE"],
      [
        "Periode",
        period ? `TA ${period.ta} Semester ${period.sem}` : "Semua periode",
      ],
      [],
      ["Indikator", "Nilai"],
      ["Total feedback", rows.length],
      ["Rata-rata rating", rows.length ? averageRating.toFixed(2) : "-"],
      ["Feedback positif (4–5)", positive],
      ["Feedback netral (3)", neutral],
      ["Feedback negatif (1–2)", negative],
      ["Feedback belum selesai ditinjau", pendingReview],
      [],
      ["Rating", "Jumlah"],
      ...distribution.map((item) => [item.rating, item.count]),
      [],
      ["Konselor", "Jumlah feedback", "Rata-rata rating", "Positif", "Negatif"],
      ...counselorRows.map((item) => [
        item.counselor,
        item.count,
        item.count ? item.average.toFixed(2) : "-",
        item.positive,
        item.negative,
      ]),
      [],
      [
        "ID Feedback",
        "Tanggal",
        "Konselor",
        "Jenis layanan",
        "Rating",
        "Status tinjauan",
        "Masukan",
      ],
      ...rows.map((item) => [
        item.id,
        item.date,
        item.counselor,
        item.category,
        item.rating,
        item.status,
        item.comment,
      ]),
    ];
    downloadCSV(`feedback-kepala-lmi-${periodId}.csv`, data);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 font-[Inter] text-slate-800">
      <style>{`
        @media print {
          aside, header, nav, .no-print { display: none !important; }
          main { margin-left: 0 !important; padding: 0 !important; }
          body { background: #fff !important; }
          .print-break-inside { break-inside: avoid; }
        }
      `}</style>

      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#2a8f5a]">
            Panel Pimpinan
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Feedback & Evaluasi
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Ringkasan pengalaman pengguna terhadap layanan konseling untuk
            membantu LMI mengevaluasi mutu layanan secara agregat.
          </p>
        </div>
        <div className="no-print flex flex-col gap-2 sm:flex-row sm:items-center">
          <PeriodDropdown
            periods={periods}
            selectedId={periodId}
            onSelect={setPeriodId}
            today={today}
            feedbackCount={(item) => feedbackInPeriod(item).length}
          />
          <button
            type="button"
            onClick={exportReport}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <MessageSquareText className="h-4 w-4 text-[#14553a]" />
            Ekspor CSV
          </button>
        </div>
      </div>

      <section className="rounded-2xl border border-[#d6eadc] bg-gradient-to-r from-[#f0faf3] to-white p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#32734f]">
              Periode evaluasi
            </p>
            <h2 className="mt-1 text-lg font-bold text-slate-900">
              {period
                ? `TA ${period.ta} · Semester ${period.sem}`
                : "Semua periode akademik"}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {period
                ? `${fmtDate(period.start)} – ${fmtDate(period.end)}`
                : "Seluruh rentang data yang tersedia"}
            </p>
          </div>
          <Link
            to="/kepala-lmi"
            className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-[#cce3d3] bg-white px-4 py-2.5 text-sm font-semibold text-[#14553a] transition hover:bg-[#f6fcf8] sm:self-auto"
          >
            Kembali ke beranda <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Ringkasan kepuasan
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Statistik berubah mengikuti periode dan filter yang dipilih.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Total feedback"
            value={rows.length}
            note="Masukan yang tercatat pada filter aktif"
            icon={MessageSquareHeart}
            tone="blue"
          />
          <MetricCard
            label="Rata-rata rating"
            value={rows.length ? averageRating.toFixed(1) : "–"}
            note="Skala penilaian 1 sampai 5"
            icon={Star}
            tone="gold"
          />
          <MetricCard
            label="Feedback positif"
            value={positive}
            note={`${percent(positive, rows.length)}% memberi rating 4–5`}
            icon={ThumbsUp}
          />
          <MetricCard
            label="Feedback negatif"
            value={negative}
            note={`${percent(negative, rows.length)}% memberi rating 1–2`}
            icon={ThumbsDown}
            tone="red"
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <MetricCard
            label="Feedback netral"
            value={neutral}
            note="Rating 3 dari 5"
            icon={Minus}
            tone="blue"
          />
          <MetricCard
            label="Perlu ditinjau"
            value={pendingReview}
            note="Feedback berstatus Baru atau Ditinjau pada data contoh"
            icon={MessageSquareText}
            tone="gold"
          />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 print-break-inside">
          <div>
            <h2 className="font-bold text-slate-900">Distribusi rating</h2>
            <p className="mt-1 text-xs text-slate-500">
              Jumlah feedback pada setiap nilai penilaian.
            </p>
          </div>
          <div className="mt-5 space-y-3">
            {distribution.map((item) => (
              <div
                key={item.rating}
                className="grid grid-cols-[70px_1fr_32px] items-center gap-3"
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-slate-700">
                    {item.rating}
                  </span>
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${item.rating >= 4 ? "bg-[#2a8f5a]" : item.rating === 3 ? "bg-amber-400" : "bg-red-400"}`}
                    style={{ width: `${(item.count / maxRatingCount) * 100}%` }}
                  />
                </div>
                <span className="text-right text-xs font-semibold text-slate-600">
                  {item.count}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 print-break-inside">
          <div>
            <h2 className="font-bold text-slate-900">Tren rating bulanan</h2>
            <p className="mt-1 text-xs text-slate-500">
              Rata-rata rating dan jumlah feedback per bulan.
            </p>
          </div>
          {monthly.length === 0 ? (
            <div className="flex h-44 items-center justify-center text-sm text-slate-400">
              Belum ada feedback pada periode ini.
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {monthly.map((item) => (
                <div
                  key={item.key}
                  className="grid grid-cols-[42px_1fr_88px] items-center gap-3"
                >
                  <span className="text-xs font-semibold text-slate-500">
                    {MONTHS[Number(item.key.slice(5, 7)) - 1]}
                  </span>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-amber-400"
                      style={{ width: `${(item.average / 5) * 100}%` }}
                    />
                  </div>
                  <div className="text-right text-xs">
                    <strong className="text-slate-700">
                      {item.average.toFixed(1)}
                    </strong>
                    <span className="ml-1 text-slate-400">({item.total})</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="mt-4 text-[11px] text-slate-400">
            Angka dalam tanda kurung menunjukkan jumlah feedback pada bulan
            tersebut.
          </p>
        </section>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm print-break-inside">
        <div className="border-b border-slate-100 p-4 sm:p-5">
          <h2 className="font-bold text-slate-900">
            Ringkasan feedback per konselor
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Gunakan sebagai indikator pengalaman pengguna. Rating tidak boleh
            dijadikan satu-satunya ukuran kualitas konselor.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Konselor</th>
                <th className="px-4 py-3 text-right">Jumlah feedback</th>
                <th className="px-4 py-3">Rata-rata rating</th>
                <th className="px-4 py-3 text-right">Positif</th>
                <th className="px-4 py-3 text-right">Negatif</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {counselorRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-8 text-center text-sm text-slate-400"
                  >
                    Belum ada feedback pada periode ini.
                  </td>
                </tr>
              ) : (
                counselorRows.map((item) => (
                  <tr key={item.counselor} className="hover:bg-slate-50/70">
                    <td className="whitespace-nowrap px-4 py-3 font-semibold">
                      {item.counselor}
                    </td>
                    <td className="px-4 py-3 text-right">{item.count}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2">
                        <Stars
                          rating={Math.round(item.average)}
                          size="h-3.5 w-3.5"
                        />
                        <strong className="text-slate-700">
                          {item.average.toFixed(1)}
                        </strong>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-[#14553a]">
                      {item.positive}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-red-600">
                      {item.negative}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-4 sm:p-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h2 className="font-bold text-slate-900">Daftar feedback</h2>
              <p className="mt-1 text-xs text-slate-500">
                Masukan ditampilkan untuk evaluasi layanan. Hindari menampilkan
                identitas mahasiswa.
              </p>
            </div>
            <div className="no-print grid grid-cols-1 gap-2 sm:grid-cols-3">
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  Penilaian
                </span>
                <select
                  value={ratingFilter}
                  onChange={(event) =>
                    setRatingFilter(event.target.value as typeof ratingFilter)
                  }
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#2a8f5a] focus:ring-2 focus:ring-[#2a8f5a]/20"
                >
                  <option value="Semua">Semua rating</option>
                  <option value="Positif">Positif (4–5)</option>
                  <option value="Netral">Netral (3)</option>
                  <option value="Negatif">Negatif (1–2)</option>
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  Jenis layanan
                </span>
                <select
                  value={categoryFilter}
                  onChange={(event) =>
                    setCategoryFilter(
                      event.target.value as typeof categoryFilter,
                    )
                  }
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#2a8f5a] focus:ring-2 focus:ring-[#2a8f5a]/20"
                >
                  <option value="Semua">Semua jenis</option>
                  <option value="Individu">Individu</option>
                  <option value="Kelompok">Kelompok</option>
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  Cari
                </span>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="ID, konselor, masukan..."
                  className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-[#2a8f5a] focus:ring-2 focus:ring-[#2a8f5a]/20"
                />
              </label>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Menampilkan <strong>{rows.length}</strong> feedback sesuai filter.
          </p>
        </div>

        <div className="divide-y divide-slate-100">
          {rows.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-slate-400">
              Tidak ada feedback yang sesuai dengan filter.
            </div>
          ) : (
            rows.slice(0, 10).map((feedback) => (
              <article
                key={feedback.id}
                className="p-4 transition hover:bg-slate-50/70 sm:p-5"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-slate-800">
                        {feedback.id}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600">
                        {feedback.category}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${REVIEW_STYLE[feedback.status]}`}
                      >
                        {feedback.status}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-700">
                      {feedback.comment}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
                      <span>{feedback.counselor}</span>
                      <span>
                        {new Date(
                          `${feedback.date}T00:00:00`,
                        ).toLocaleDateString("id-ID", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end">
                    <Stars rating={feedback.rating} />
                    <span className="text-xs font-bold text-slate-700">
                      {feedback.rating}/5
                    </span>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
        {rows.length > 10 && (
          <div className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500 sm:px-5">
            Menampilkan 10 dari {rows.length} feedback. Ekspor CSV untuk
            mengambil seluruh data sesuai filter.
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-[#d6eadc] bg-[#f5fbf6] p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-white p-2.5 text-[#14553a]">
            <UsersRound className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-bold text-slate-900">
              Catatan penggunaan data
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Feedback merupakan salah satu indikator evaluasi layanan, bukan
              satu-satunya ukuran kinerja konselor. Pada implementasi backend,
              pertimbangkan penyamaran identitas, pembatasan akses, dan
              penyembunyian komentar yang berpotensi mengungkap informasi
              sensitif.
            </p>
          </div>
        </div>
      </section>

      <p className="pb-3 text-center text-[11px] text-slate-400">
        Halaman ini menggunakan data simulasi frontend. Data produksi harus
        berasal dari backend dan mengikuti kewenangan akses Kepala LMI.
      </p>
    </div>
  );
}
