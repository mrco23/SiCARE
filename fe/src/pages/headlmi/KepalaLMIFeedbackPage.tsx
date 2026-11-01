import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  FileSpreadsheet,
  Loader2,
  MessageSquareHeart,
  MessageSquareText,
  Minus,
  RefreshCw,
  Search,
  Star,
  ThumbsDown,
  ThumbsUp,
  UsersRound,
  X,
} from "lucide-react";
import { PageContainer, PageHeader } from "../../components/shared";
import { MetricCard } from "../../components/headlmi/MetricCard";
import { adminApi } from "../../lib/adminApi";
import { getPublicCounselors } from "../../lib/publicApi";
import type {
  AdminFeedbackDto,
  FeedbackReviewStatusApi,
  FeedbackStatisticsDto,
  PublicCounselorDto,
} from "../../types/api";
import {
  counselorLabel,
  describeApiError,
  formatIsoDate,
  formatIsoDateTime,
  formatRating,
  percent,
  shortRef,
} from "../../features/headlmi/shared/presentation";
import {
  groupHeadLmiFeedbackByMonth,
  selectHeadLmiFeedback,
  summarizeFeedbackByCounselor,
  summarizeHeadLmiFeedback,
  type FeedbackRatingFilter,
  type FeedbackReviewFilter,
} from "../../features/headlmi/feedback/selectors";

const REVIEW_LABEL: Record<FeedbackReviewStatusApi, string> = {
  new: "Baru",
  reviewed: "Ditinjau",
  resolved: "Selesai",
};

const REVIEW_STYLE: Record<FeedbackReviewStatusApi, string> = {
  new: "bg-amber-50 text-amber-700 border-amber-200",
  reviewed: "bg-sky-50 text-sky-700 border-sky-200",
  resolved: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const MODERATION_LABEL = {
  shown: "Ditampilkan",
  pending: "Menunggu Moderasi",
  disabled: "Dinonaktifkan",
} as const;

const MODERATION_STYLE = {
  shown: "bg-emerald-50 text-emerald-700 border-emerald-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  disabled: "bg-rose-50 text-rose-700 border-rose-200",
} as const;

function Stars({ rating, size = "h-4 w-4" }: { rating: number; size?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`Rating ${rating} dari 5`}>
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
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
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
  const [feedbackList, setFeedbackList] = useState<AdminFeedbackDto[]>([]);
  const [stats, setStats] = useState<FeedbackStatisticsDto | null>(null);
  const [counselors, setCounselors] = useState<PublicCounselorDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [ratingFilter, setRatingFilter] = useState<FeedbackRatingFilter>("Semua");
  const [reviewFilter, setReviewFilter] = useState<FeedbackReviewFilter>("Semua");
  const [search, setSearch] = useState("");

  // Review modal state
  const [selectedFeedback, setSelectedFeedback] = useState<AdminFeedbackDto | null>(null);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  const counselorNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of counselors) {
      if (c.profile_id && c.public_name) map.set(c.profile_id, c.public_name);
    }
    return map;
  }, [counselors]);

  const fetchData = useCallback(async () => {
    return Promise.all([
      adminApi.listFeedback({ limit: 100 }),
      adminApi.getFeedbackStatistics(),
      getPublicCounselors().catch(() => [] as PublicCounselorDto[]),
    ]);
  }, []);

  useEffect(() => {
    let active = true;
    void fetchData()
      .then(([listResult, statsResult, counselorsResult]) => {
        if (!active) return;
        setFeedbackList(listResult);
        setStats(statsResult);
        setCounselors(counselorsResult);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(describeApiError(err, "Gagal memuat data feedback & evaluasi dari server."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [fetchData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setError(null);
    try {
      const [listResult, statsResult, counselorsResult] = await fetchData();
      setFeedbackList(listResult);
      setStats(statsResult);
      setCounselors(counselorsResult);
    } catch (err: unknown) {
      setError(describeApiError(err, "Gagal memuat data feedback & evaluasi dari server."));
    } finally {
      setRefreshing(false);
    }
  };

  // Handle reviewing
  const handleReviewStatusChange = async (targetStatus: FeedbackReviewStatusApi) => {
    if (!selectedFeedback) return;
    setReviewSubmitting(true);
    setReviewError(null);

    try {
      const updated = await adminApi.reviewFeedback(selectedFeedback.id, {
        review_status: targetStatus,
      });

      if (!mounted.current) return;
      // Update local state list
      setFeedbackList((prev) =>
        prev.map((item) => (item.id === updated.id ? { ...item, review_status: updated.review_status } : item)),
      );
      setSelectedFeedback(updated);
      showToast(`Status peninjauan berhasil diubah menjadi "${REVIEW_LABEL[targetStatus]}".`);

      // Refresh statistics in background
      adminApi.getFeedbackStatistics().then((freshStats) => {
        if (mounted.current) setStats(freshStats);
      }).catch(() => undefined);
    } catch (err) {
      if (!mounted.current) return;
      setReviewError(describeApiError(err, "Gagal memperbarui status peninjauan."));
    } finally {
      if (mounted.current) setReviewSubmitting(false);
    }
  };

  // Filtered rows
  const filteredRows = useMemo(
    () =>
      selectHeadLmiFeedback(feedbackList, counselorNameMap, {
        rating: ratingFilter,
        review: reviewFilter,
        search,
      }),
    [feedbackList, counselorNameMap, ratingFilter, reviewFilter, search],
  );

  const summary = useMemo(() => summarizeHeadLmiFeedback(filteredRows), [filteredRows]);
  const { averageRating, positive, neutral, negative, distribution } = summary;
  const maxRatingCount = Math.max(1, ...distribution.map((item) => item.count));
  const monthly = useMemo(() => groupHeadLmiFeedbackByMonth(filteredRows), [filteredRows]);
  const counselorRows = useMemo(
    () => summarizeFeedbackByCounselor(filteredRows, counselorNameMap),
    [filteredRows, counselorNameMap],
  );

  const exportReport = () => {
    const data: (string | number)[][] = [
      ["Laporan Feedback & Evaluasi Layanan Konseling SiCARE"],
      ["Catatan", "Data mencakup maksimal 100 feedback terbaru yang dimuat pada sistem"],
      ["Waktu Ekspor", new Date().toLocaleString("id-ID")],
      [],
      ["Indikator Terpilih", "Nilai"],
      ["Total feedback termuat sesuai filter", filteredRows.length],
      ["Rata-rata rating", filteredRows.length ? averageRating.toFixed(2) : "-"],
      ["Feedback positif (4–5)", positive],
      ["Feedback netral (3)", neutral],
      ["Feedback negatif (1–2)", negative],
      [],
      ["Statistik Database Keseluruhan (Backend)", "Jumlah"],
      ["Review: Baru", stats?.review.new ?? "-"],
      ["Review: Ditinjau", stats?.review.reviewed ?? "-"],
      ["Review: Selesai", stats?.review.resolved ?? "-"],
      ["Moderasi: Ditampilkan", stats?.moderation.shown ?? "-"],
      ["Moderasi: Menunggu", stats?.moderation.pending ?? "-"],
      ["Moderasi: Dinonaktifkan", stats?.moderation.disabled ?? "-"],
      [],
      ["Rating", "Jumlah (Data Termuat)"],
      ...distribution.map((item) => [item.rating, item.count]),
      [],
      ["Konselor", "Jumlah Feedback", "Rata-rata Rating", "Positif", "Negatif"],
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
        "Tanggal Dibuat",
        "Konselor",
        "Rating",
        "Status Peninjauan LMI",
        "Status Moderasi Admin",
        "Masukan",
      ],
      ...filteredRows.map((item) => [
        item.id,
        formatIsoDate(item.created_at),
        counselorLabel(counselorNameMap, item.counselor_id),
        item.rating,
        REVIEW_LABEL[item.review_status] ?? item.review_status,
        MODERATION_LABEL[item.moderation_status] ?? item.moderation_status,
        item.comment || "-",
      ]),
    ];
    downloadCSV(`feedback-kepala-lmi-${new Date().toISOString().slice(0, 10)}.csv`, data);
  };

  if (loading) {
    return (
      <PageContainer role="headlmi" className="space-y-6 text-slate-800">
        <PageHeader
          eyebrow="Panel Pimpinan"
          title="Feedback & Evaluasi"
          description="Ringkasan pengalaman pengguna terhadap layanan konseling untuk membantu LMI mengevaluasi mutu layanan secara agregat."
        />
        <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-medium text-slate-600">Memuat data feedback & evaluasi…</p>
        </div>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer role="headlmi" className="space-y-6 text-slate-800">
        <PageHeader
          eyebrow="Panel Pimpinan"
          title="Feedback & Evaluasi"
          description="Ringkasan pengalaman pengguna terhadap layanan konseling untuk membantu LMI mengevaluasi mutu layanan secara agregat."
        />
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
          <div className="rounded-full bg-red-50 p-3 text-red-600">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Gagal Memuat Data</h3>
            <p className="mt-1 text-sm text-slate-600">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => void handleRefresh()}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark"
          >
            <RefreshCw className="h-4 w-4" />
            Coba Lagi
          </button>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer role="headlmi" className="report-print-page space-y-6 text-slate-800">
      {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          className="fixed left-1/2 top-20 z-50 flex max-w-md -translate-x-1/2 items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-xl"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          <span>{toast}</span>
        </div>
      )}

      <PageHeader
        eyebrow="Panel Pimpinan"
        title="Feedback & Evaluasi"
        description="Ringkasan pengalaman pengguna terhadap layanan konseling untuk membantu LMI mengevaluasi mutu layanan secara agregat."
        actions={
          <div className="no-print flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => void handleRefresh()}
              disabled={refreshing}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Segarkan
            </button>
            <button
              type="button"
              onClick={exportReport}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              Ekspor CSV
            </button>
          </div>
        }
      />

      {/* Scope Disclaimer Banner */}
      <section className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50/60 to-white p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-800">
              <MessageSquareText className="h-4 w-4" />
              Sumber Data Backend
            </div>
            <p className="mt-1 text-sm font-medium text-slate-700">
              Daftar menampilkan <strong>{feedbackList.length}</strong> feedback terbaru dari database.
              Kartu status peninjauan di bawah mencerminkan ringkasan agregat seluruh database.
            </p>
          </div>
          <Link
            to="/kepala-lmi"
            className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-primary transition hover:bg-emerald-50/50 sm:self-auto"
          >
            Kembali ke beranda <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Database-wide Review Status Summary */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Status Peninjauan Pimpinan (Database)</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Agregasi status review feedback di seluruh database SiCARE.
            </p>
          </div>
          <span className="text-xs font-medium text-slate-400">Diperbarui realtime</span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm">
            <div>
              <p className="text-xs font-semibold text-amber-800">Baru (Belum Ditinjau)</p>
              <p className="mt-1 text-3xl font-extrabold text-amber-900">{stats?.review.new ?? 0}</p>
              <p className="mt-1 text-xs text-amber-700">Menunggu evaluasi pimpinan</p>
            </div>
            <span className="rounded-xl bg-amber-100 p-2.5 text-amber-700">
              <Clock className="h-6 w-6" />
            </span>
          </div>
          <div className="flex items-center justify-between rounded-2xl border border-sky-200 bg-sky-50/50 p-4 shadow-sm">
            <div>
              <p className="text-xs font-semibold text-sky-800">Sedang Ditinjau</p>
              <p className="mt-1 text-3xl font-extrabold text-sky-900">{stats?.review.reviewed ?? 0}</p>
              <p className="mt-1 text-xs text-sky-700">Dalam proses pembahasan LMI</p>
            </div>
            <span className="rounded-xl bg-sky-100 p-2.5 text-sky-700">
              <Eye className="h-6 w-6" />
            </span>
          </div>
          <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm">
            <div>
              <p className="text-xs font-semibold text-emerald-800">Selesai Ditindaklanjuti</p>
              <p className="mt-1 text-3xl font-extrabold text-emerald-900">{stats?.review.resolved ?? 0}</p>
              <p className="mt-1 text-xs text-emerald-700">Telah ditutup oleh Kepala LMI</p>
            </div>
            <span className="rounded-xl bg-emerald-100 p-2.5 text-emerald-700">
              <CheckCircle2 className="h-6 w-6" />
            </span>
          </div>
        </div>
      </section>

      {/* Ringkasan Kepuasan Terhadap Data Termuat */}
      <section className="space-y-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">Ringkasan Kepuasan Klien</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Dihitung berdasarkan <strong>{filteredRows.length}</strong> feedback sesuai filter yang aktif.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Total Masukan Sesuai Filter"
            value={filteredRows.length}
            note="Jumlah ulasan dalam tampilan aktif"
            icon={MessageSquareHeart}
            tone="blue"
          />
          <MetricCard
            label="Rata-rata Rating"
            value={filteredRows.length ? averageRating.toFixed(1) : "–"}
            note="Skala penilaian 1 sampai 5"
            icon={Star}
            tone="gold"
          />
          <MetricCard
            label="Feedback Positif"
            value={positive}
            note={`${percent(positive, filteredRows.length)}% memberi rating 4–5`}
            icon={ThumbsUp}
            tone="green"
          />
          <MetricCard
            label="Feedback Negatif"
            value={negative}
            note={`${percent(negative, filteredRows.length)}% memberi rating 1–2`}
            icon={ThumbsDown}
            tone="red"
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <MetricCard
            label="Feedback Netral"
            value={neutral}
            note="Rating 3 dari 5"
            icon={Minus}
            tone="blue"
          />
          <MetricCard
            label="Belum Selesai Ditinjau (Filter)"
            value={filteredRows.filter((r) => r.review_status !== "resolved").length}
            note="Status Baru atau Ditinjau pada daftar aktif"
            icon={MessageSquareText}
            tone="gold"
          />
        </div>
      </section>

      {/* Visualisasi Distribusi Rating & Tren Bulanan */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 print-break-inside">
          <div>
            <h2 className="font-bold text-slate-900">Distribusi Rating</h2>
            <p className="mt-1 text-xs text-slate-500">
              Jumlah feedback pada tiap nilai bintang (dari data termuat).
            </p>
          </div>
          <div className="mt-5 space-y-3">
            {distribution.map((item) => (
              <div key={item.rating} className="grid grid-cols-[70px_1fr_32px] items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-slate-700">{item.rating}</span>
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${
                      item.rating >= 4 ? "bg-[#15803d]" : item.rating === 3 ? "bg-amber-400" : "bg-red-400"
                    }`}
                    style={{ width: `${(item.count / maxRatingCount) * 100}%` }}
                  />
                </div>
                <span className="text-right text-xs font-semibold text-slate-600">{item.count}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 print-break-inside">
          <div>
            <h2 className="font-bold text-slate-900">Tren Rating Bulanan</h2>
            <p className="mt-1 text-xs text-slate-500">
              Rata-rata rating dan jumlah feedback per bulan (dari data termuat).
            </p>
          </div>
          {monthly.length === 0 ? (
            <div className="flex h-44 items-center justify-center text-sm text-slate-400">
              Belum ada feedback yang tercatat pada filter ini.
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {monthly.slice(-6).map((item) => (
                <div key={item.key} className="grid grid-cols-[54px_1fr_88px] items-center gap-3">
                  <span className="text-xs font-semibold text-slate-500">{item.key}</span>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-amber-400"
                      style={{ width: `${(item.average / 5) * 100}%` }}
                    />
                  </div>
                  <div className="text-right text-xs">
                    <strong className="text-slate-700">{item.average.toFixed(1)}</strong>
                    <span className="ml-1 text-slate-400">({item.total})</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="mt-4 text-[11px] text-slate-400">
            Angka dalam tanda kurung menunjukkan total feedback pada bulan tersebut.
          </p>
        </section>
      </div>

      {/* Ringkasan Feedback per Konselor */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm print-break-inside">
        <div className="border-b border-slate-100 p-4 sm:p-5">
          <h2 className="font-bold text-slate-900">Ringkasan Feedback per Konselor</h2>
          <p className="mt-1 text-xs text-slate-500">
            Digunakan sebagai indikator kepuasan pengguna. Rating tidak boleh menjadi satu-satunya ukuran evaluasi profesional.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Konselor</th>
                <th className="px-4 py-3 text-right">Jumlah Feedback</th>
                <th className="px-4 py-3">Rata-rata Rating</th>
                <th className="px-4 py-3 text-right">Positif</th>
                <th className="px-4 py-3 text-right">Negatif</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {counselorRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-sm text-slate-400">
                    Belum ada feedback untuk konselor pada filter ini.
                  </td>
                </tr>
              ) : (
                counselorRows.map((item) => (
                  <tr key={item.counselorId} className="hover:bg-slate-50/70">
                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-800">
                      {item.counselor}
                    </td>
                    <td className="px-4 py-3 text-right">{item.count}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2">
                        <Stars rating={Math.round(item.average)} size="h-3.5 w-3.5" />
                        <strong className="text-slate-700">{formatRating(item.average)}</strong>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-primary">{item.positive}</td>
                    <td className="px-4 py-3 text-right font-semibold text-red-600">{item.negative}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Daftar Feedback Utama & Aksi Peninjauan */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-4 sm:p-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h2 className="font-bold text-slate-900">Daftar Feedback & Evaluasi Layanan</h2>
              <p className="mt-1 text-xs text-slate-500">
                Pimpinan dapat meninjau dan mengubah status peninjauan (Baru, Ditinjau, Selesai) pada setiap feedback.
              </p>
            </div>
            <div className="no-print grid grid-cols-1 gap-2 sm:grid-cols-3">
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Status Peninjauan</span>
                <select
                  value={reviewFilter}
                  onChange={(e) => setReviewFilter(e.target.value as FeedbackReviewFilter)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20"
                >
                  <option value="Semua">Semua Status Review</option>
                  <option value="new">Baru</option>
                  <option value="reviewed">Ditinjau</option>
                  <option value="resolved">Selesai</option>
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Penilaian Bintang</span>
                <select
                  value={ratingFilter}
                  onChange={(e) => setRatingFilter(e.target.value as FeedbackRatingFilter)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20"
                >
                  <option value="Semua">Semua Rating</option>
                  <option value="Positif">Positif (4–5)</option>
                  <option value="Netral">Netral (3)</option>
                  <option value="Negatif">Negatif (1–2)</option>
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Pencarian</span>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="ID, konselor, kata kunci..."
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none placeholder:text-slate-400 focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20"
                  />
                </div>
              </label>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Menampilkan <strong>{filteredRows.length}</strong> dari {feedbackList.length} feedback terbaru.
          </p>
        </div>

        <div className="divide-y divide-slate-100">
          {filteredRows.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-slate-400">
              Tidak ada feedback yang sesuai dengan kriteria filter saat ini.
            </div>
          ) : (
            filteredRows.map((feedback) => (
              <article key={feedback.id} className="p-4 transition hover:bg-slate-50/70 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-800">
                        #{shortRef(feedback.id)}
                      </span>
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${
                          REVIEW_STYLE[feedback.review_status] ?? "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {REVIEW_LABEL[feedback.review_status] ?? feedback.review_status}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                          MODERATION_STYLE[feedback.moderation_status] ?? "bg-slate-100 text-slate-600"
                        }`}
                        title="Status moderasi publik (dikelola oleh Admin)"
                      >
                        {feedback.moderation_status === "shown" ? (
                          <Eye className="h-3 w-3" />
                        ) : feedback.moderation_status === "disabled" ? (
                          <EyeOff className="h-3 w-3" />
                        ) : (
                          <Clock className="h-3 w-3" />
                        )}
                        {MODERATION_LABEL[feedback.moderation_status] ?? feedback.moderation_status}
                      </span>
                    </div>

                    <p className="mt-2 text-sm leading-6 text-slate-700">
                      {feedback.comment || <span className="italic text-slate-400">(Klien tidak menulis komentar teks)</span>}
                    </p>

                    {feedback.disabled_reason && (
                      <p className="mt-1 text-xs text-rose-600">
                        <strong>Catatan Admin:</strong> {feedback.disabled_reason}
                      </p>
                    )}

                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span className="font-medium text-slate-700">
                        Konselor: {counselorLabel(counselorNameMap, feedback.counselor_id)}
                      </span>
                      <span>Dibuat: {formatIsoDate(feedback.created_at)}</span>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center justify-between gap-3 sm:flex-col sm:items-end">
                    <div className="flex items-center gap-1.5">
                      <Stars rating={feedback.rating} />
                      <span className="text-xs font-bold text-slate-700">{feedback.rating}/5</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFeedback(feedback);
                        setReviewError(null);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-primary shadow-sm transition hover:border-brand-accent/50 hover:bg-emerald-50/50"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Tinjau Status
                    </button>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      {/* Catatan Kewenangan & Privasi */}
      <section className="rounded-2xl border border-[#d6eadc] bg-[#f5fbf6] p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-white p-2.5 text-primary shadow-sm">
            <UsersRound className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-bold text-slate-900">Kewenangan & Privasi Kepala LMI</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Kepala LMI berwenang meninjau feedback untuk tujuan evaluasi program (menandai status{" "}
              <strong>Baru</strong>, <strong>Ditinjau</strong>, atau <strong>Selesai</strong>).
              Moderasi publik (menyetujui atau menonaktifkan tampilan ulasan di halaman umum) merupakan wewenang Admin.
              Identitas pribadi mahasiswa (nama, email, NIM) dilindungi secara otomatis sesuai prinsip kerahasiaan layanan konseling.
            </p>
          </div>
        </div>
      </section>

      {/* Modal Tinjau Status Feedback */}
      {selectedFeedback && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 p-5">
              <div>
                <h3 className="font-bold text-slate-900">Tinjau Feedback Evaluasi</h3>
                <p className="text-xs text-slate-500">
                  Ref ID: <span className="font-mono">{selectedFeedback.id}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedFeedback(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              {reviewError && (
                <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  {reviewError}
                </div>
              )}

              <div className="rounded-xl bg-slate-50 p-3 text-xs space-y-1.5 text-slate-600">
                <div className="flex justify-between">
                  <span className="text-slate-500">Konselor:</span>
                  <span className="font-semibold text-slate-800">
                    {counselorLabel(counselorNameMap, selectedFeedback.counselor_id)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Waktu Kirim:</span>
                  <span className="font-medium text-slate-700">
                    {formatIsoDateTime(selectedFeedback.created_at)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Rating:</span>
                  <span className="inline-flex items-center gap-1 font-bold text-slate-800">
                    <Stars rating={selectedFeedback.rating} size="h-3.5 w-3.5" />
                    {selectedFeedback.rating}/5
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Status Moderasi Admin:</span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                      MODERATION_STYLE[selectedFeedback.moderation_status] ?? "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {MODERATION_LABEL[selectedFeedback.moderation_status] ?? selectedFeedback.moderation_status}
                  </span>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Masukan Klien</p>
                <div className="mt-1.5 max-h-40 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-sm leading-relaxed text-slate-800">
                  {selectedFeedback.comment || (
                    <span className="italic text-slate-400">Tidak ada komentar teks yang disertakan.</span>
                  )}
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <p className="text-xs font-semibold text-slate-700">Ubah Status Peninjauan LMI:</p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Status saat ini:{" "}
                  <span
                    className={`inline-block rounded-full border px-2 py-0.2 text-[10px] font-bold ${
                      REVIEW_STYLE[selectedFeedback.review_status] ?? "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {REVIEW_LABEL[selectedFeedback.review_status] ?? selectedFeedback.review_status}
                  </span>
                </p>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    disabled={reviewSubmitting || selectedFeedback.review_status === "new"}
                    onClick={() => void handleReviewStatusChange("new")}
                    className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                      selectedFeedback.review_status === "new"
                        ? "border-amber-400 bg-amber-50 text-amber-800 ring-2 ring-amber-400/20"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    } disabled:opacity-60 disabled:cursor-not-allowed`}
                  >
                    Tandai Baru
                  </button>
                  <button
                    type="button"
                    disabled={reviewSubmitting || selectedFeedback.review_status === "reviewed"}
                    onClick={() => void handleReviewStatusChange("reviewed")}
                    className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                      selectedFeedback.review_status === "reviewed"
                        ? "border-sky-400 bg-sky-50 text-sky-800 ring-2 ring-sky-400/20"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    } disabled:opacity-60 disabled:cursor-not-allowed`}
                  >
                    Tandai Ditinjau
                  </button>
                  <button
                    type="button"
                    disabled={reviewSubmitting || selectedFeedback.review_status === "resolved"}
                    onClick={() => void handleReviewStatusChange("resolved")}
                    className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                      selectedFeedback.review_status === "resolved"
                        ? "border-emerald-500 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/20"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    } disabled:opacity-60 disabled:cursor-not-allowed`}
                  >
                    Tandai Selesai
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end border-t border-slate-100 bg-slate-50 p-4">
              <button
                type="button"
                onClick={() => setSelectedFeedback(null)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
