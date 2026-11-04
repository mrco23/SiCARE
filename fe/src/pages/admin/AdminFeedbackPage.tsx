import { useCallback, useEffect, useMemo, useState } from "react";
import {
  PageContainer,
  PageHeader,
  AcademicPeriodFilter,
  SkeletonList,
  useToast,
} from "../../components/shared";
import {
  FEEDBACK_MODERATION_STATUS,
  type FeedbackModerationStatus,
} from "../../constants/status";
import { adminApi } from "../../lib/adminApi";
import { getPublicCounselors } from "../../lib/publicApi";
import type {
  AdminFeedbackDto,
  FeedbackReviewStatusApi,
  FeedbackStatisticsDto,
} from "../../types/api";
import { formatIndonesianDate } from "../../lib/dateUtils";
import {
  Ban,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  Loader2,
  Meh,
  MessageSquareText,
  RefreshCw,
  RotateCcw,
  Search,
  Star,
  Stethoscope,
  VenetianMask,
  X,
} from "lucide-react";
import {
  mapAcademicPeriodDto,
  sortPeriods,
  toISO,
  type AcademicPeriod,
} from "../../lib/academicPeriods";
import {
  countModerationStatuses,
  selectFeedbackInPeriod,
  selectModerationRows,
  type FeedbackSortKey,
  type FeedbackStatusFilter,
} from "../../features/admin/feedback/feedbackSelectors";

/* ========================= TIPE & DATA ========================= */
type SortKey = FeedbackSortKey;
type StatusFilter = FeedbackStatusFilter;

interface ManagedFeedback {
  id: string;
  sessionId: string;
  counselorId: string;
  psikolog: string;
  rating: number;
  text: string;
  date: string;
  status: FeedbackModerationStatus;
  reviewStatus: FeedbackReviewStatusApi;
  disabledReason: string | null;
}

const REVIEW_LABEL: Record<FeedbackReviewStatusApi, string> = {
  new: "Baru",
  reviewed: "Ditinjau LMI",
  resolved: "Ditindaklanjuti LMI",
};

const anon = (id: string) =>
  "Klien Anonim #" +
  (id.replace(/[^A-Fa-f0-9]/g, "").slice(-4) || "0000").toUpperCase();

const formatDate = (iso: string) => {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "-";
  return formatIndonesianDate(parsed, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
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

function mapFeedbackDto(
  dto: AdminFeedbackDto,
  counselorMap: ReadonlyMap<string, string>,
): ManagedFeedback {
  const status: FeedbackModerationStatus =
    dto.moderation_status === FEEDBACK_MODERATION_STATUS.SHOWN ||
    dto.moderation_status === FEEDBACK_MODERATION_STATUS.DISABLED
      ? dto.moderation_status
      : FEEDBACK_MODERATION_STATUS.PENDING;

  const reviewStatus: FeedbackReviewStatusApi =
    dto.review_status === "reviewed" || dto.review_status === "resolved"
      ? dto.review_status
      : "new";

  return {
    id: dto.id,
    sessionId: dto.session_id,
    counselorId: dto.counselor_id,
    psikolog:
      counselorMap.get(dto.counselor_id) ??
      `Konselor #${dto.counselor_id.slice(0, 6).toUpperCase()}`,
    rating: dto.rating,
    text: dto.comment?.trim() || "(Tanpa komentar tertulis)",
    date: dto.created_at,
    status,
    reviewStatus,
    disabledReason: dto.disabled_reason ?? null,
  };
}

/* ========================= PAGE ========================= */
export default function AdminFeedbackPage() {
  const today = useMemo(() => toISO(new Date()), []);
  const [periods, setPeriods] = useState<AcademicPeriod[]>([]);
  const [items, setItems] = useState<ManagedFeedback[]>([]);
  const [counselorMap, setCounselorMap] = useState<Map<string, string>>(
    () => new Map(),
  );
  const [stats, setStats] = useState<FeedbackStatisticsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [disableId, setDisableId] = useState<string | null>(null);
  const [disableReason, setDisableReason] = useState("");
  const [disableError, setDisableError] = useState("");
  const [moderatingId, setModeratingId] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string>("all");
  const [star, setStar] = useState(0);
  const [psikolog, setPsikolog] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("new");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(
    FEEDBACK_MODERATION_STATUS.PENDING,
  );
  const toast = useToast();

  useEffect(() => {
    if (disableId === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !moderatingId) setDisableId(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [disableId, moderatingId]);


  const fetchData = useCallback(async () => {
    const [
      feedbackDtos,
      statisticsDto,
      periodDtos,
      counselorAccounts,
      publicCounselors,
    ] = await Promise.all([
      adminApi.listFeedback({ limit: 100 }),
      adminApi.getFeedbackStatistics(),
      adminApi.listAcademicPeriods().catch(() => []),
      adminApi.listAccounts({ role: "counselor", limit: 100 }).catch(() => []),
      getPublicCounselors().catch(() => []),
    ]);

    const cMap = new Map<string, string>();
    for (const c of publicCounselors) {
      if (c.public_name?.trim()) cMap.set(c.profile_id, c.public_name.trim());
    }
    for (const acc of counselorAccounts) {
      if (acc.full_name?.trim()) cMap.set(acc.id, acc.full_name.trim());
    }

    const sortedPeriods = sortPeriods(periodDtos.map(mapAcademicPeriodDto));
    const mappedItems = feedbackDtos.map((dto) => mapFeedbackDto(dto, cMap));

    return {
      sortedPeriods,
      cMap,
      mappedItems,
      statisticsDto,
    };
  }, []);

  useEffect(() => {
    let active = true;
    void fetchData()
      .then(({ sortedPeriods, cMap, mappedItems, statisticsDto }) => {
        if (!active) return;
        setPeriods(sortedPeriods);
        setCounselorMap(cMap);
        setItems(mappedItems);
        setStats(statisticsDto);
        setLoadError(null);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setLoadError(
          err instanceof Error
            ? err.message
            : "Data feedback tidak dapat dimuat.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fetchData]);

  const handleRefresh = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { sortedPeriods, cMap, mappedItems, statisticsDto } =
        await fetchData();
      setPeriods(sortedPeriods);
      setCounselorMap(cMap);
      setItems(mappedItems);
      setStats(statisticsDto);
    } catch (err) {
      setLoadError(
        err instanceof Error
          ? err.message
          : "Data feedback tidak dapat dimuat.",
      );
    } finally {
      setLoading(false);
    }
  };

  const counselorOptions = useMemo(() => {
    const names = new Set<string>();
    counselorMap.forEach((name) => names.add(name));
    items.forEach((item) => names.add(item.psikolog));
    return [...names].sort();
  }, [counselorMap, items]);

  const selected = periods.find((p) => p.id === selectedId) ?? null;

  // Data setelah filter periode dan psikolog
  const base = useMemo(
    () =>
      selectFeedbackInPeriod(items, selected).filter(
        (f) => !psikolog || f.psikolog === psikolog,
      ),
    [items, selected, psikolog],
  );

  const {
    total,
    pending: pendingCount,
    shown: shownCount,
    disabled: disabledCount,
  } = countModerationStatuses(base);
  const avg = total ? base.reduce((sum, f) => sum + f.rating, 0) / total : 0;

  const rows = useMemo(
    () =>
      selectModerationRows(base, {
        status: statusFilter,
        rating: star,
        query,
        sort,
      }),
    [base, star, query, sort, statusFilter],
  );

  const toggleStar = (n: number) => setStar((prev) => (prev === n ? 0 : n));

  const setFeedbackModerationStatus = async (
    id: string,
    status: FeedbackModerationStatus,
    reason?: string,
  ): Promise<boolean> => {
    setModeratingId(id);
    try {
      const updated = await adminApi.moderateFeedback(
        id,
        status === FEEDBACK_MODERATION_STATUS.DISABLED
          ? {
              moderation_status: "disabled",
              disabled_reason: (reason ?? "").trim(),
            }
          : { moderation_status: status },
      );
      const mapped = mapFeedbackDto(updated, counselorMap);
      setItems((prev) => prev.map((item) => (item.id === id ? mapped : item)));
      const nextStats = await adminApi
        .getFeedbackStatistics()
        .catch(() => null);
      if (nextStats) setStats(nextStats);
      toast.success(
        status === FEEDBACK_MODERATION_STATUS.SHOWN
          ? "Feedback ditampilkan."
          : status === FEEDBACK_MODERATION_STATUS.DISABLED
            ? "Feedback dinonaktifkan beserta alasannya."
            : "Feedback dikembalikan ke antrean pemeriksaan.",
      );
      return true;
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Moderasi feedback tidak dapat disimpan.",
      );
      return false;
    } finally {
      setModeratingId(null);
    }
  };

  const openDisableModal = async (item: ManagedFeedback) => {
    setDisableId(item.id);
    setDisableReason(item.disabledReason ?? "");
    setDisableError("");
    try {
      const latest = await adminApi.getFeedback(item.id);
      if (latest.disabled_reason) {
        setDisableReason(latest.disabled_reason);
      }
    } catch {
      // Gunakan alasan yang sudah ada di memori
    }
  };

  const confirmDisable = async () => {
    if (disableId === null) return;
    const reason = disableReason.trim();
    if (!reason) {
      setDisableError("Alasan penonaktifan wajib diisi.");
      return;
    }
    const ok = await setFeedbackModerationStatus(
      disableId,
      FEEDBACK_MODERATION_STATUS.DISABLED,
      reason,
    );
    if (ok) {
      setDisableId(null);
      setDisableReason("");
      setDisableError("");
    }
  };

  const STATUS_TABS: { key: StatusFilter; label: string; count: number }[] = [
    {
      key: FEEDBACK_MODERATION_STATUS.PENDING,
      label: "Menunggu pemeriksaan",
      count: pendingCount,
    },
    {
      key: FEEDBACK_MODERATION_STATUS.DISABLED,
      label: "Dinonaktifkan",
      count: disabledCount,
    },
    {
      key: FEEDBACK_MODERATION_STATUS.SHOWN,
      label: "Ditampilkan",
      count: shownCount,
    },
    { key: "all", label: "Semua", count: total },
  ];

  const emptyMessage =
    total === 0
      ? "Belum ada feedback pada periode ini."
      : statusFilter === FEEDBACK_MODERATION_STATUS.PENDING &&
          pendingCount === 0
        ? "Semua feedback sudah diperiksa. Tidak ada yang menunggu."
        : statusFilter === FEEDBACK_MODERATION_STATUS.DISABLED &&
            disabledCount === 0
          ? "Tidak ada feedback yang dinonaktifkan."
          : "Tidak ada feedback yang cocok.";

  return (
    <PageContainer role="admin">
      {/* Judul */}
      <PageHeader
        title="Feedback Klien"
        description="Penilaian anonim dari klien untuk psikolog setelah sesi konseling. Periksa feedback baru, lalu tampilkan yang sesuai."
        actions={
          <button
            type="button"
            onClick={() => void handleRefresh()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
            />
            Muat ulang
          </button>
        }
      />

      {loadError && (
        <div
          role="alert"
          className="flex flex-col justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 sm:flex-row sm:items-center"
        >
          <p>{loadError}</p>
          <button
            type="button"
            onClick={() => void handleRefresh()}
            className="shrink-0 rounded-xl bg-red-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
          >
            Coba lagi
          </button>
        </div>
      )}

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
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-3xl font-bold">{avg.toFixed(1)}</span>
                <Stars value={avg} className="h-5 w-5" />
              </div>
              {stats && (
                <span className="text-[11px] font-medium text-slate-400">
                  Total sistem:{" "}
                  {(stats.moderation.pending ?? 0) +
                    (stats.moderation.shown ?? 0) +
                    (stats.moderation.disabled ?? 0)}
                </span>
              )}
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
        <AcademicPeriodFilter
          periods={periods}
          selectedId={selectedId}
          onSelect={setSelectedId}
          today={today}
          badgeContent={(p) => `${selectFeedbackInPeriod(items, p).length} feedback`}
          className="relative w-full sm:w-96"
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
              {counselorOptions.map((p) => (
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
                      : tab.key === FEEDBACK_MODERATION_STATUS.PENDING &&
                          tab.count > 0
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
        {loading ? (
          <SkeletonList bare rows={5} label="Memuat feedback dari server..." />
        ) : rows.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {rows.map((f) => {
              const isPending = f.status === FEEDBACK_MODERATION_STATUS.PENDING;
              const isDisabled =
                f.status === FEEDBACK_MODERATION_STATUS.DISABLED;
              const isModerating = moderatingId === f.id;
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
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                          {REVIEW_LABEL[f.reviewStatus]}
                        </span>
                      </div>
                      <span className="text-[11px] font-medium text-slate-400">
                        {formatDate(f.date)}
                      </span>
                    </div>

                    <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                      {f.text}
                    </p>

                    {isDisabled && f.disabledReason && (
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
                        {f.status !== FEEDBACK_MODERATION_STATUS.SHOWN && (
                          <button
                            type="button"
                            disabled={isModerating}
                            onClick={() =>
                              void setFeedbackModerationStatus(
                                f.id,
                                FEEDBACK_MODERATION_STATUS.SHOWN,
                              )
                            }
                            className="inline-flex items-center gap-1.5 rounded-full bg-[#15803d] px-4 py-1.5 text-xs font-bold text-white transition hover:bg-primary disabled:opacity-50"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Tampilkan
                          </button>
                        )}
                        {f.status !== FEEDBACK_MODERATION_STATUS.DISABLED && (
                          <button
                            type="button"
                            disabled={isModerating}
                            onClick={() => void openDisableModal(f)}
                            className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-4 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                          >
                            <EyeOff className="h-3.5 w-3.5" />
                            Nonaktifkan
                          </button>
                        )}
                        {isDisabled && (
                          <button
                            type="button"
                            disabled={isModerating}
                            onClick={() =>
                              void setFeedbackModerationStatus(
                                f.id,
                                FEEDBACK_MODERATION_STATUS.PENDING,
                              )
                            }
                            className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-4 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
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
                disabled={Boolean(moderatingId)}
                onClick={() => setDisableId(null)}
                aria-label="Tutup"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
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
              maxLength={1000}
              autoFocus
              disabled={Boolean(moderatingId)}
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
                disabled={Boolean(moderatingId)}
                onClick={() => setDisableId(null)}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={Boolean(moderatingId)}
                onClick={() => void confirmDisable()}
                className="inline-flex items-center gap-2 rounded-xl bg-[#15803d] px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary disabled:opacity-50"
              >
                {moderatingId && <Loader2 className="h-4 w-4 animate-spin" />}
                Simpan alasan & nonaktifkan
              </button>
            </div>
          </div>
        </div>
      )}

    </PageContainer>
  );
}
