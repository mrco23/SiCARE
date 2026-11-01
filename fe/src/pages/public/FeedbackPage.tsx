import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Star } from "lucide-react";
import { getPublicFeedback, type PublicFeedback } from "../../lib/publicApi";

type SortMode = "terbaru" | "tertinggi" | "terendah";
const PAGE_SIZE = 4;

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Tanggal tidak tersedia";
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(date);
}

function Stars({ value }: { value: number }) {
  return <div className="flex items-center gap-0.5" aria-label={`Rating ${value} dari 5`}>{Array.from({ length: 5 }).map((_, i) => <Star key={i} className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${i < value ? "fill-amber-400 text-amber-400" : "text-gray-300"}`} />)}</div>;
}

function ReviewCard({ review }: { review: PublicFeedback }) {
  return <article className="relative flex flex-col overflow-hidden rounded-2xl border border-[#E3EAE5] bg-white p-4 shadow-[0_3px_12px_rgba(20,85,58,0.04)] transition duration-300 hover:-translate-y-1 hover:border-[#D4E1D7] hover:shadow-[0_12px_28px_rgba(20,85,58,0.09)] sm:p-5">
    <div className="flex items-center justify-between gap-3"><Stars value={review.rating} /><span className="shrink-0 text-[11px] text-gray-500 sm:text-xs">{formatDate(review.created_at)}</span></div>
    {review.comment?.trim() ? <p className="mt-3 text-sm leading-relaxed text-gray-800">“{review.comment.trim()}”</p> : <p className="mt-3 text-sm italic text-gray-500">Klien memberikan rating tanpa komentar tertulis.</p>}
    <div className="mt-auto border-t border-[#E8EDE9] pt-3 mt-5"><p className="text-sm font-bold text-gray-900">Klien SiCARE</p><p className="text-xs text-gray-500">Feedback konseling yang disetujui untuk publikasi</p></div>
  </article>;
}

export default function FeedbackPage() {
  const [reviews, setReviews] = useState<PublicFeedback[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>("terbaru");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    getPublicFeedback(100, controller.signal).then((data) => {
      if (!active) return;
      setReviews(data.filter((review) => Number.isInteger(review.rating) && review.rating >= 1 && review.rating <= 5));
      setError(null);
    }).catch(() => {
      if (active && !controller.signal.aborted) setError("Feedback publik belum dapat dimuat. Periksa koneksi dan coba lagi.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, []);

  const sorted = useMemo(() => [...reviews].sort((a, b) => {
    if (sortMode === "tertinggi") return b.rating - a.rating || Date.parse(b.created_at) - Date.parse(a.created_at);
    if (sortMode === "terendah") return a.rating - b.rating || Date.parse(b.created_at) - Date.parse(a.created_at);
    return Date.parse(b.created_at) - Date.parse(a.created_at);
  }), [reviews, sortMode]);
  const shown = sorted.slice(0, visible);
  const average = reviews.length ? (reviews.reduce((sum, item) => sum + item.rating, 0) / reviews.length).toFixed(1) : "–";

  return <div className="overflow-x-hidden bg-white">
    <section className="mx-auto w-[92%] pb-10 pt-20 sm:w-[88%] md:pt-28 lg:w-[86%]">
      <h1 className="font-[Montserrat] text-2xl font-extrabold leading-tight text-primary sm:text-3xl lg:text-4xl">Feedback &amp; Ulasan Publik</h1>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-gray-600 sm:text-base">Ulasan yang tampil telah disetujui untuk publikasi. Identitas klien tidak ditampilkan.</p>
    </section>
    <section className="bg-[#F7FAF8] py-10 sm:py-12"><div className="mx-auto w-[92%] sm:w-[88%] lg:w-[86%]">
      <div className="flex flex-col gap-5 rounded-2xl border border-[#E3EAE5] bg-white p-5 shadow-[0_3px_12px_rgba(20,85,58,0.04)] sm:p-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4"><div className="text-center"><div className="flex items-center gap-1.5"><span className="font-[Montserrat] text-4xl font-extrabold text-primary sm:text-5xl">{average}</span><Star className="h-7 w-7 fill-amber-400 text-amber-400 sm:h-8 sm:w-8" /></div><p className="mt-1 text-xs font-semibold text-primary">Rata-rata rating</p></div><div className="hidden h-12 w-px bg-gray-200 sm:block"/><div><h2 className="text-base font-bold text-primary sm:text-lg">Kualitas Layanan</h2><p className="mt-1 max-w-md text-xs text-gray-500 sm:text-sm">{reviews.length} feedback yang disetujui untuk publikasi.</p></div></div>
        <div className="flex items-center gap-2.5 md:shrink-0"><label htmlFor="sortSelect" className="text-xs text-gray-500 sm:text-sm">Urutkan:</label><div className="relative"><select id="sortSelect" value={sortMode} onChange={(event) => { setSortMode(event.target.value as SortMode); setVisible(PAGE_SIZE); }} className="appearance-none rounded-full border border-[#E0E7E2] bg-white py-2 pl-4 pr-9 text-xs font-semibold text-[#355444] shadow-sm outline-none transition hover:border-[#C8D8CD] hover:bg-[#F7FAF8] focus-visible:ring-4 focus-visible:ring-[#2e9a5f]/25 sm:text-sm"><option value="terbaru">Terbaru</option><option value="tertinggi">Rating tertinggi</option><option value="terendah">Rating terendah</option></select><ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#52715E]"/></div></div>
      </div>
      {loading && <p role="status" className="mt-6 text-center text-sm text-gray-500">Memuat feedback publik...</p>}
      {error && <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      {!loading && !error && <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">{shown.map((review) => <ReviewCard key={review.id} review={review}/>)}</div>}
      {!loading && !error && sorted.length === 0 && <div className="mt-5 rounded-2xl border border-dashed border-[#D6E1D9] bg-white p-8 text-center text-sm text-gray-500">Belum ada feedback yang disetujui untuk publikasi.</div>}
      {!error && shown.length < sorted.length && <div className="mt-8 flex justify-center"><button type="button" onClick={() => setVisible((value) => value + PAGE_SIZE)} className="rounded-full bg-primary px-6 py-2.5 text-xs font-semibold text-white shadow-md transition hover:bg-[#0c2619] sm:text-sm">Muat lebih banyak</button></div>}
      <p className="mt-8 text-center text-xs text-gray-500 sm:text-sm">Feedback yang tampil mengikuti status moderasi dari admin SiCARE.</p>
    </div></section>
  </div>;
}
