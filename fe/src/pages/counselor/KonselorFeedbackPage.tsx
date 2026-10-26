import { PageContainer, PageHeader } from "../../components/shared";
import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Frown,
  LockKeyhole,
  MessageSquare,
  Search,
  Star,
  UserRound,
} from "lucide-react";
import { COUNSELOR, feedbackData } from "../../data/mock/counselorFeedback";
import { CLIENT_COUNSELOR_IDENTITIES } from "../../data/mock/clientCounselors";
import { useFeedbackStore } from "../../features/feedback/store/feedbackStore";
import { LEGACY_UI_SEMESTERS as semesters } from "../../data/mock/academicPeriods";


type Period = "hari" | "minggu" | "bulan" | "semester";









const periodOptions: { value: Period; label: string }[] = [
  { value: "hari", label: "Hari" },
  { value: "minggu", label: "Minggu" },
  { value: "bulan", label: "Bulan" },
  { value: "semester", label: "Semester" },
];
const seedMine = feedbackData.filter(
  (feedback) => feedback.konselorId === COUNSELOR.id,
);
const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());
const parseDate = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
};
const formatShortDate = (date: Date) =>
  date.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
const anonymousName = (id: number) =>
  `Klien Anonim #${((id * 2654435761) >>> 0).toString(16).slice(-4).toUpperCase()}`;

function Stars({
  rating,
  size = "sm",
}: {
  rating: number;
  size?: "sm" | "lg";
}) {
  return (
    <span
      className={`inline-flex items-center gap-0.5 ${size === "lg" ? "text-lg" : "text-xs"}`}
      aria-label={`Rating ${rating} dari 5`}
    >
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          aria-hidden="true"
          className={`h-[1em] w-[1em] ${index < Math.round(rating) ? "fill-amber-400 text-amber-400" : "fill-gray-200 text-gray-200"}`}
        />
      ))}
    </span>
  );
}

export default function KonselorFeedbackPage() {
  const sharedFeedback = useFeedbackStore((state) => state.items);
  const mine = useMemo(
    () => [
      ...seedMine,
      ...sharedFeedback
        .filter((feedback) => feedback.counselorId === CLIENT_COUNSELOR_IDENTITIES.GY.entityId)
        .map((feedback) => ({
          id: feedback.id,
          konselorId: COUNSELOR.id,
          rating: feedback.rating,
          text: feedback.text,
          date: feedback.date,
        })),
    ],
    [sharedFeedback],
  );
  const today = startOfDay(new Date());
  const defaultSemesterIndex = Math.max(
    0,
    semesters.findIndex(
      (semester) =>
        today >= parseDate(semester.start) && today <= parseDate(semester.end),
    ),
  );
  const [period, setPeriod] = useState<Period>("bulan");
  const [anchor, setAnchor] = useState<Date>(today);
  const [semesterIndex, setSemesterIndex] = useState(defaultSemesterIndex);
  const [starFilter, setStarFilter] = useState(0);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"new" | "high" | "low">("new");

  const range = useMemo(() => {
    const year = anchor.getFullYear();
    const month = anchor.getMonth();
    const day = anchor.getDate();
    if (period === "hari")
      return {
        start: new Date(year, month, day),
        end: new Date(year, month, day + 1),
      };
    if (period === "minggu")
      return {
        start: new Date(year, month, day - 6),
        end: new Date(year, month, day + 1),
      };
    if (period === "bulan")
      return {
        start: new Date(year, month, 1),
        end: new Date(year, month + 1, 1),
      };
    const semester = semesters[semesterIndex];
    const end = parseDate(semester.end);
    return {
      start: parseDate(semester.start),
      end: new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1),
    };
  }, [anchor, period, semesterIndex]);

  const currentPeriodLabel = useMemo(() => {
    if (period === "hari") {
      return range.start.toLocaleDateString("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    }
    if (period === "minggu") {
      const lastDay = new Date(
        range.end.getFullYear(),
        range.end.getMonth(),
        range.end.getDate() - 1,
      );
      return `${formatShortDate(range.start)} – ${formatShortDate(lastDay)}`;
    }
    if (period === "bulan")
      return range.start.toLocaleDateString("id-ID", {
        month: "long",
        year: "numeric",
      });
    const semester = semesters[semesterIndex];
    return `TA ${semester.ta} · ${semester.sem}`;
  }, [period, range, semesterIndex]);

  const periodFeedback = useMemo(
    () =>
      mine.filter((feedback) => {
        const date = new Date(feedback.date);
        return date >= range.start && date < range.end;
      }),
    [mine, range],
  );
  const total = periodFeedback.length;
  const average = total
    ? periodFeedback.reduce((sum, feedback) => sum + feedback.rating, 0) / total
    : 0;
  const visibleFeedback = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("id-ID");
    const rows = periodFeedback.filter(
      (feedback) =>
        (!starFilter || feedback.rating === starFilter) &&
        feedback.text.toLocaleLowerCase("id-ID").includes(normalizedSearch),
    );
    rows.sort((a, b) => {
      if (sort === "high")
        return (
          b.rating - a.rating ||
          new Date(b.date).getTime() - new Date(a.date).getTime()
        );
      if (sort === "low")
        return (
          a.rating - b.rating ||
          new Date(b.date).getTime() - new Date(a.date).getTime()
        );
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
    return rows;
  }, [periodFeedback, search, sort, starFilter]);

  function stepPeriod(direction: -1 | 1) {
    if (period === "semester") {
      setSemesterIndex((current) =>
        Math.min(semesters.length - 1, Math.max(0, current + direction)),
      );
      return;
    }
    setAnchor((current) => {
      if (period === "hari")
        return new Date(
          current.getFullYear(),
          current.getMonth(),
          current.getDate() + direction,
        );
      if (period === "minggu")
        return new Date(
          current.getFullYear(),
          current.getMonth(),
          current.getDate() + 7 * direction,
        );
      return new Date(current.getFullYear(), current.getMonth() + direction, 1);
    });
  }

  const previousDisabled = period === "semester" && semesterIndex === 0;
  const nextDisabled =
    period === "semester" && semesterIndex === semesters.length - 1;

  return (
    <PageContainer role="counselor" spacing="none">
      <PageHeader
        title={
          <>
            Feedback <span className="text-primary">Saya</span>
          </>
        }
        description="Penilaian anonim dari klien setelah sesi konseling Anda. Identitas klien dirahasiakan."
      />

      <section className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div
          role="tablist"
          aria-label="Periode feedback"
          className="inline-flex w-fit flex-wrap rounded-xl border border-gray-200 bg-gray-100 p-1"
        >
          {periodOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={period === option.value}
              onClick={() => setPeriod(option.value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition sm:text-sm ${period === option.value ? "bg-white text-primary shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-label="Periode sebelumnya"
            onClick={() => stepPeriod(-1)}
            disabled={previousDisabled}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[170px] text-center text-sm font-bold capitalize text-gray-900">
            {currentPeriodLabel}
          </span>
          <button
            type="button"
            aria-label="Periode berikutnya"
            onClick={() => stepPeriod(1)}
            disabled={nextDisabled}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          {period === "semester" && (
            <select
              aria-label="Pilih semester"
              value={semesterIndex}
              onChange={(event) => setSemesterIndex(Number(event.target.value))}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 outline-none focus:border-primary"
            >
              {semesters.map((semester, index) => (
                <option key={semester.id} value={index}>
                  TA {semester.ta} · {semester.sem}
                </option>
              ))}
            </select>
          )}
        </div>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col justify-between rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
                Total Feedback
              </p>
              <p className="mt-1 text-4xl font-bold text-gray-900">{total}</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-100 bg-emerald-50 text-primary">
              <MessageSquare className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-5 border-t border-gray-100 pt-4">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Rata-rata Rating
            </p>
            <div className="mt-1 flex items-center gap-3">
              <span className="text-3xl font-bold text-gray-900">
                {average.toFixed(1)}
              </span>
              <Stars rating={average} size="lg" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm lg:col-span-2">
          <h2 className="text-base font-bold">Distribusi Bintang</h2>
          <p className="mb-4 text-xs text-gray-400">
            Klik baris untuk memfilter daftar feedback.
          </p>
          <div className="space-y-2.5">
            {[5, 4, 3, 2, 1].map((rating) => {
              const count = periodFeedback.filter(
                (feedback) => feedback.rating === rating,
              ).length;
              const percentage = total ? Math.round((count / total) * 100) : 0;
              const active = starFilter === rating;
              return (
                <button
                  key={rating}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    setStarFilter((current) =>
                      current === rating ? 0 : rating,
                    )
                  }
                  className={`flex w-full items-center gap-3 rounded-lg px-2 py-1 text-xs transition ${active ? "bg-primary-soft" : "hover:bg-gray-50"}`}
                >
                  <span className="w-10 text-left font-bold text-gray-600">
                    {rating}{" "}
                    <Star className="inline h-3 w-3 fill-amber-400 text-amber-400" />
                  </span>
                  <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                    <span
                      className="block h-full rounded-full bg-primary transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </span>
                  <span className="w-16 text-right font-semibold text-gray-500">
                    {count} ({percentage}%)
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-gray-100 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-bold">Daftar Feedback</h2>
            <p className="text-xs text-gray-400">
              Menampilkan {visibleFeedback.length} dari {total} feedback ·{" "}
              {currentPeriodLabel}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                type="search"
                placeholder="Cari isi feedback..."
                className="w-full rounded-xl border border-gray-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-[#2e9a5f] focus:ring-2 focus:ring-[#2e9a5f]/20 sm:w-56"
              />
            </div>
            <select
              aria-label="Urutkan feedback"
              value={sort}
              onChange={(event) =>
                setSort(event.target.value as "new" | "high" | "low")
              }
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#2e9a5f]/20"
            >
              <option value="new">Terbaru</option>
              <option value="high">Bintang tertinggi</option>
              <option value="low">Bintang terendah</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-gray-100 bg-gray-50/60 px-5 py-3">
          {[0, 5, 4, 3, 2, 1].map((rating) => (
            <button
              key={rating}
              type="button"
              aria-pressed={starFilter === rating}
              onClick={() => setStarFilter(rating)}
              className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${starFilter === rating ? "border-primary bg-primary text-white" : "border-gray-200 bg-white text-gray-600 hover:border-[#2e9a5f]"}`}
            >
              {rating === 0 ? (
                "Semua"
              ) : (
                <>
                  {rating}{" "}
                  <Star className="inline h-3 w-3 fill-amber-400 text-amber-400" />
                </>
              )}
            </button>
          ))}
        </div>

        {visibleFeedback.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {visibleFeedback.map((feedback) => (
              <article
                key={feedback.id}
                className="flex gap-4 p-5 transition-colors hover:bg-gray-50/60"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                  <UserRound className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-sm font-bold text-gray-800">
                        {anonymousName(feedback.id)}
                      </span>
                      <Stars rating={feedback.rating} />
                    </div>
                    <time
                      className="text-xs font-medium text-gray-400"
                      dateTime={feedback.date}
                    >
                      {new Date(feedback.date).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </time>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-gray-600">
                    {feedback.text}
                  </p>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="py-16 text-center text-gray-400">
            <Frown className="mx-auto mb-2 h-8 w-8" />
            <p className="text-sm font-medium">
              {total === 0
                ? `Tidak ada feedback pada ${currentPeriodLabel}.`
                : "Tidak ada feedback yang cocok dengan filter."}
            </p>
          </div>
        )}
      </section>

      <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-gray-400">
        <LockKeyhole className="h-3.5 w-3.5" /> Anda hanya dapat melihat
        feedback untuk sesi Anda sendiri.
      </p>
    </PageContainer>
  );
}
