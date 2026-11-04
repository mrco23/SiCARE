import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  MessageSquareQuote,
  RefreshCw,
  Search,
  Star,
  X,
} from "lucide-react";
import {
  PageContainer,
  PageHeader,
  AcademicPeriodFilter,
  SkeletonList,
} from "../../components/shared";
import {
  formatAcademicPeriodLabel,
  formatIsoShortDateId,
  getCounselorInitials,
  toLocalDateKey,
} from "../../features/counselor/shared/presentation";
import { useAuth } from "../../features/auth/useAuth";
import { ApiError } from "../../lib/api";
import { counselorApi } from "../../lib/counselorApi";
import {
  getPublicAcademicPeriods,
  type PublicAcademicPeriod,
} from "../../lib/publicApi";
import type {
  CounselorFeedbackDto,
  CounselorProfileDto,
} from "../../types/api";

type PeriodFilter = "semua" | "hari" | "minggu" | "bulan" | "semester";
type SortOrder = "new" | "high" | "low";

const DAY_MS = 86_400_000;

function parseDateOnly(isoDate: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function getDateRange(
  period: PeriodFilter,
  anchor: Date,
  semester: PublicAcademicPeriod | null,
): { start: Date; end: Date } | null {
  if (period === "semua") return null;
  const y = anchor.getFullYear();
  const m = anchor.getMonth();
  const d = anchor.getDate();

  if (period === "hari") {
    return { start: new Date(y, m, d), end: new Date(y, m, d + 1) };
  }
  if (period === "minggu") {
    return { start: new Date(y, m, d - 6), end: new Date(y, m, d + 1) };
  }
  if (period === "bulan") {
    return { start: new Date(y, m, 1), end: new Date(y, m + 1, 1) };
  }
  if (!semester) return null;
  return {
    start: parseDateOnly(semester.starts_on),
    end: new Date(parseDateOnly(semester.ends_on).getTime() + DAY_MS),
  };
}

function formatRangeLabel(
  period: PeriodFilter,
  range: { start: Date; end: Date } | null,
  semester: PublicAcademicPeriod | null,
): string {
  if (period === "semua") return "Semua Waktu";
  if (period === "semester") {
    return semester
      ? formatAcademicPeriodLabel(semester)
      : "Belum ada periode akademik";
  }
  if (!range) return "Semua Waktu";
  if (period === "hari") {
    return range.start.toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }
  if (period === "minggu") {
    const endInclusive = new Date(range.end.getTime() - DAY_MS);
    return `${range.start.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
    })} – ${endInclusive.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })}`;
  }
  return range.start.toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });
}

function StarsRow({ rating, size = "sm" }: { rating: number; size?: "sm" | "md" }) {
  const dim = size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";
  return (
    <div className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`${dim} ${
            star <= rating
              ? "fill-amber-400 text-amber-400"
              : "fill-gray-200 text-gray-200"
          }`}
        />
      ))}
    </div>
  );
}

export default function KonselorFeedbackPage() {
  const { profile: authProfile } = useAuth();

  const [counselorProfile, setCounselorProfile] =
    useState<CounselorProfileDto | null>(null);
  const [feedbackList, setFeedbackList] = useState<CounselorFeedbackDto[]>([]);
  const [periods, setPeriods] = useState<PublicAcademicPeriod[]>([]);

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("semua");
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("");

  const [starFilter, setStarFilter] = useState<number | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>("new");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchFeedbackData = useCallback(async () => {
    const [feedbackRes, periodsRes, cpRes] = await Promise.all([
      counselorApi.getFeedback({ limit: 100 }),
      getPublicAcademicPeriods().catch(() => [] as PublicAcademicPeriod[]),
      counselorApi.getProfile().catch(() => null),
    ]);

    return {
      feedback: feedbackRes,
      periods: periodsRes,
      counselorProfile: cpRes,
    };
  }, []);

  useEffect(() => {
    let active = true;
    fetchFeedbackData()
      .then((data) => {
        if (!active) return;
        setFeedbackList(data.feedback);
        setPeriods(data.periods);
        setCounselorProfile(data.counselorProfile);
        if (data.periods.length > 0) {
          const todayKey = toLocalDateKey(new Date());
          const current =
            data.periods.find(
              (p) => todayKey >= p.starts_on && todayKey <= p.ends_on,
            ) ?? data.periods[0];
          setSelectedPeriodId(current.id);
        }
        setErrorMessage(null);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setErrorMessage(
          err instanceof ApiError
            ? err.message
            : "Gagal memuat daftar ulasan klien dari server.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [fetchFeedbackData]);

  const handleManualRefresh = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const data = await fetchFeedbackData();
      setFeedbackList(data.feedback);
      setPeriods(data.periods);
      setCounselorProfile(data.counselorProfile);
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof ApiError
          ? err.message
          : "Gagal memuat ulang daftar ulasan klien.",
      );
    } finally {
      setLoading(false);
    }
  };

  const counselorName =
    counselorProfile?.public_name?.trim() ||
    authProfile?.full_name?.trim() ||
    "Konselor SiCARE";

  const counselorRole =
    counselorProfile?.headline?.trim() || "Konselor Layanan Mahasiswa & Staf LMI";

  const activeSemester = useMemo(
    () =>
      periods.find((p) => p.id === selectedPeriodId) ?? periods[0] ?? null,
    [periods, selectedPeriodId],
  );

  const dateRange = useMemo(
    () => getDateRange(periodFilter, anchorDate, activeSemester),
    [activeSemester, anchorDate, periodFilter],
  );

  // Filter by period first so star distribution reflects the selected period
  const periodFilteredFeedback = useMemo(() => {
    if (!dateRange) return feedbackList;
    return feedbackList.filter((item) => {
      const t = new Date(item.created_at).getTime();
      return t >= dateRange.start.getTime() && t < dateRange.end.getTime();
    });
  }, [dateRange, feedbackList]);

  const ratingStats = useMemo(() => {
    const counts: Record<1 | 2 | 3 | 4 | 5, number> = {
      5: 0,
      4: 0,
      3: 0,
      2: 0,
      1: 0,
    };
    let sum = 0;
    for (const item of periodFilteredFeedback) {
      const r = Math.min(5, Math.max(1, Math.round(item.rating))) as
        | 1
        | 2
        | 3
        | 4
        | 5;
      counts[r] += 1;
      sum += item.rating;
    }
    const total = periodFilteredFeedback.length;
    const avg = total > 0 ? (sum / total).toFixed(1) : "0.0";
    return { counts, total, avg };
  }, [periodFilteredFeedback]);

  const visibleFeedback = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return periodFilteredFeedback
      .filter((item) => {
        if (starFilter !== null && Math.round(item.rating) !== starFilter) {
          return false;
        }
        if (!q) return true;
        const commentText = (item.comment ?? "").toLowerCase();
        return (
          commentText.includes(q) ||
          item.session_id.toLowerCase().includes(q) ||
          item.id.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (sortOrder === "high") {
          return (
            b.rating - a.rating ||
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
        }
        if (sortOrder === "low") {
          return (
            a.rating - b.rating ||
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
        }
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      });
  }, [periodFilteredFeedback, searchQuery, sortOrder, starFilter]);

  const shiftAnchor = (dir: -1 | 1) => {
    setAnchorDate((prev) => {
      const y = prev.getFullYear();
      const m = prev.getMonth();
      const d = prev.getDate();
      if (periodFilter === "hari") return new Date(y, m, d + dir);
      if (periodFilter === "minggu") return new Date(y, m, d + dir * 7);
      if (periodFilter === "bulan") return new Date(y, m + dir, 1);
      return prev;
    });
  };

  return (
    <PageContainer className="py-6 lg:py-8">
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <PageHeader
            title="Feedback"
            description="Penilaian dan ulasan terverifikasi dari klien yang telah menyelesaikan sesi"
          />
          <button
            type="button"
            onClick={() => void handleManualRefresh()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-xs transition hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Muat Ulang
          </button>
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="flex items-start justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            <div className="flex items-start gap-2.5">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              <div>
                <p className="font-semibold">Gagal Memuat Feedback</p>
                <p className="mt-0.5">{errorMessage}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void handleManualRefresh()}
              className="shrink-0 rounded-xl border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
            >
              Coba Lagi
            </button>
          </div>
        )}

        {/* Filter Periode */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-xs">
          <div className="inline-flex flex-wrap rounded-xl border border-gray-200 bg-gray-50 p-1">
            {(
              [
                ["semua", "Semua Waktu"],
                ["hari", "Hari"],
                ["minggu", "Minggu"],
                ["bulan", "Bulan"],
                ["semester", "Semester"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setPeriodFilter(key)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  periodFilter === key
                    ? "bg-white text-[#064E3B] shadow-xs"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {periodFilter === "semester" ? (
            <AcademicPeriodFilter
              periods={periods}
              selectedId={selectedPeriodId}
              onSelect={setSelectedPeriodId}
              showAllOption={false}
              className="relative w-full sm:w-80"
            />
          ) : periodFilter !== "semua" ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Periode sebelumnya"
                onClick={() => shiftAnchor(-1)}
                className="rounded-lg border border-gray-200 p-1.5 hover:bg-gray-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-[160px] text-center text-xs font-bold text-gray-800">
                {formatRangeLabel(periodFilter, dateRange, activeSemester)}
              </span>
              <button
                type="button"
                aria-label="Periode berikutnya"
                onClick={() => shiftAnchor(1)}
                className="rounded-lg border border-gray-200 p-1.5 hover:bg-gray-50"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <span className="text-xs font-medium text-gray-500">
              Menampilkan seluruh ulasan yang tercatat ({feedbackList.length} ulasan)
            </span>
          )}
        </div>

        {/* Kartu Ringkasan Rating & Distribusi Bintang */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs">
          <div className="grid gap-6 lg:grid-cols-12 lg:items-center">
            <div className="flex items-center gap-4 lg:col-span-5">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xl font-bold text-[#064E3B]">
                {getCounselorInitials(counselorName)}
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {counselorName}
                </h2>
                <p className="text-xs text-gray-500">{counselorRole}</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-2xl font-bold text-gray-900">
                    {loading ? "—" : ratingStats.avg}
                  </span>
                  <StarsRow
                    rating={Math.round(Number(ratingStats.avg))}
                    size="md"
                  />
                  <span className="text-xs text-gray-500">
                    ({ratingStats.total} ulasan)
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-2 lg:col-span-7">
              {([5, 4, 3, 2, 1] as const).map((star) => {
                const count = ratingStats.counts[star];
                const pct =
                  ratingStats.total > 0
                    ? Math.round((count / ratingStats.total) * 100)
                    : 0;
                const active = starFilter === star;
                return (
                  <button
                    key={star}
                    type="button"
                    onClick={() =>
                      setStarFilter((prev) => (prev === star ? null : star))
                    }
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-1.5 text-xs transition ${
                      active
                        ? "bg-amber-50 ring-1 ring-amber-300"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    <span className="w-12 text-left font-semibold text-gray-700">
                      {star} Bintang
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-amber-400 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-16 text-right tabular-nums text-gray-500">
                      {count} ({pct}%)
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bar Pencarian, Filter Bintang & Urutan */}
        <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-xs lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari isi komentar ulasan atau ID sesi..."
              className="w-full rounded-xl border border-gray-200 py-2.5 pl-10 pr-9 text-sm outline-none focus:border-[#064E3B] focus:ring-2 focus:ring-[#064E3B]/15"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Hapus pencarian"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex flex-wrap rounded-xl border border-gray-200 bg-gray-50 p-1">
              <button
                type="button"
                onClick={() => setStarFilter(null)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                  starFilter === null
                    ? "bg-white text-[#064E3B] shadow-xs"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Semua
              </button>
              {[5, 4, 3, 2, 1].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() =>
                    setStarFilter((prev) => (prev === s ? null : s))
                  }
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                    starFilter === s
                      ? "bg-white text-amber-700 shadow-xs"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {s} ★
                </button>
              ))}
            </div>

            <select
              aria-label="Urutkan ulasan"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as SortOrder)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 outline-none focus:border-[#064E3B]"
            >
              <option value="new">Terbaru</option>
              <option value="high">Rating Tertinggi</option>
              <option value="low">Rating Terendah</option>
            </select>
          </div>
        </div>

        {/* Daftar Ulasan */}
        {loading ? (
          <SkeletonList rows={5} label="Memuat ulasan klien dari server..." />
        ) : visibleFeedback.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center shadow-xs">
            <MessageSquareQuote className="mx-auto h-10 w-10 text-gray-300" />
            <p className="mt-3 text-base font-bold text-gray-900">
              Belum ada ulasan pada filter ini
            </p>
            <p className="mt-1 text-sm text-gray-500">
              Ulasan baru akan muncul secara otomatis setelah klien mengirimkan
              penilaian pada sesi yang telah selesai.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {visibleFeedback.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs transition hover:border-gray-300"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xs font-bold text-[#064E3B]">
                      KL
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-gray-900">
                          Klien Terverifikasi (Anonim)
                        </p>
                        <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-medium text-gray-600">
                          Sesi #{item.session_id.slice(0, 8).toUpperCase()}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <StarsRow rating={Math.round(item.rating)} />
                        <span className="text-xs font-bold text-amber-700">
                          {item.rating}.0
                        </span>
                      </div>
                    </div>
                  </div>

                  <span className="text-xs font-medium text-gray-400">
                    {formatIsoShortDateId(item.created_at)}
                  </span>
                </div>

                {item.comment?.trim() ? (
                  <p className="mt-3.5 rounded-xl bg-gray-50/80 p-3.5 text-sm leading-relaxed text-gray-700">
                    "{item.comment.trim()}"
                  </p>
                ) : (
                  <p className="mt-3 text-xs italic text-gray-400">
                    Klien memberikan penilaian bintang tanpa komentar tertulis.
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
