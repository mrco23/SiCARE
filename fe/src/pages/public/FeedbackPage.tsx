import { useMemo, useState } from "react";
import { ChevronDown, Star, Users, User } from "lucide-react";

type Role = "Mahasiswa" | "Dosen atau Staf";
type Format = "Individu" | "Kelompok";
type SortMode = "terbaru" | "tertinggi" | "terendah";

type Review = {
  id: number;
  rating: number;
  days: number;
  role: Role;
  name: string; // sudah dianonimkan
  topic: string;
  format: Format;
  text: string;
};

// Data contoh. Saat terhubung ke API, ganti dengan hasil fetch.
const reviews: Review[] = [
  {
    id: 1,
    rating: 5,
    days: 1,
    role: "Mahasiswa",
    name: "G******",
    topic: "Kecemasan akademik",
    format: "Individu",
    text: "Konselornya sangat mendengarkan dan tidak menghakimi. Saya merasa lebih tenang setelah sesi selesai.",
  },
  {
    id: 2,
    rating: 5,
    days: 3,
    role: "Dosen atau Staf",
    name: "R******",
    topic: "Manajemen stres kerja",
    format: "Individu",
    text: "Prosesnya mudah dan jadwalnya fleksibel. Saran yang diberikan langsung bisa saya terapkan.",
  },
  {
    id: 3,
    rating: 4,
    days: 4,
    role: "Mahasiswa",
    name: "A******",
    topic: "Adaptasi kampus",
    format: "Kelompok",
    text: "Diskusi kelompoknya membuat saya merasa tidak sendirian. Fasilitatornya ramah dan terarah.",
  },
  {
    id: 4,
    rating: 5,
    days: 7,
    role: "Dosen atau Staf",
    name: "S******",
    topic: "Keseimbangan hidup",
    format: "Individu",
    text: "Ruang konseling nyaman dan kerahasiaannya benar-benar terjaga. Saya akan kembali jika dibutuhkan.",
  },
  {
    id: 5,
    rating: 4,
    days: 10,
    role: "Mahasiswa",
    name: "M******",
    topic: "Hubungan pertemanan",
    format: "Individu",
    text: "Sesinya membantu saya memahami pola pikir sendiri. Waktu konseling terasa cukup untuk kebutuhan saya.",
  },
  {
    id: 6,
    rating: 5,
    days: 14,
    role: "Dosen atau Staf",
    name: "D******",
    topic: "Kesehatan mental",
    format: "Individu",
    text: "Layanannya profesional dan responsif. Penjadwalannya juga jelas dan tidak membingungkan.",
  },
  {
    id: 7,
    rating: 3,
    days: 21,
    role: "Mahasiswa",
    name: "K******",
    topic: "Motivasi belajar",
    format: "Kelompok",
    text: "Materinya bagus, tetapi saya berharap sesi kelompoknya bisa lebih sering diadakan.",
  },
  {
    id: 8,
    rating: 5,
    days: 35,
    role: "Dosen atau Staf",
    name: "N******",
    topic: "Pengembangan diri",
    format: "Individu",
    text: "Konselor memberi ruang yang aman untuk bercerita. Saya merasa dihargai sepanjang sesi.",
  },
  {
    id: 9,
    rating: 4,
    days: 42,
    role: "Mahasiswa",
    name: "P******",
    topic: "Tekanan skripsi",
    format: "Individu",
    text: "Membantu saya membuat rencana kecil yang realistis untuk menyelesaikan skripsi secara bertahap.",
  },
  {
    id: 10,
    rating: 5,
    days: 60,
    role: "Dosen atau Staf",
    name: "T******",
    topic: "Work-life balance",
    format: "Kelompok",
    text: "Sesi kelompok dengan rekan dosen sangat bermanfaat. Suasananya terbuka dan saling mendukung.",
  },
];

const PAGE_SIZE = 4;
const ROLE_FILTERS: { value: Role | "semua"; label: string }[] = [
  { value: "semua", label: "Semua" },
  { value: "Mahasiswa", label: "Mahasiswa" },
  { value: "Dosen atau Staf", label: "Dosen atau Staf" },
];

function timeAgo(days: number) {
  if (days < 7) return `${days} Hari yang lalu`;
  if (days < 30) return `${Math.floor(days / 7)} Minggu yang lalu`;
  return `${Math.floor(days / 30)} Bulan yang lalu`;
}

function Stars({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${i < value ? "fill-amber-400 text-amber-400" : "text-gray-300"}`}
        />
      ))}
    </div>
  );
}

function FormatChip({ format }: { format: Format }) {
  return format === "Kelompok" ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-yellow-300 px-2.5 py-0.5 text-[11px] font-semibold text-[#0c2619] sm:text-xs">
      <Users className="h-3 w-3" />
      Kelompok
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-2.5 py-0.5 text-[11px] font-semibold text-white sm:text-xs">
      <User className="h-3 w-3" />
      Individu
    </span>
  );
}

function ReviewCard({ r }: { r: Review }) {
  return (
    <article className="flex flex-col rounded-2xl border-2 border-[#14553a] bg-white p-4 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <Stars value={r.rating} />
        <span className="shrink-0 text-[11px] text-gray-500 sm:text-xs">
          {timeAgo(r.days)}
        </span>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-gray-800">“{r.text}”</p>

      <div className="mt-auto pt-5">
        <div className="flex items-end justify-between gap-3 border-t border-gray-200 pt-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-gray-900">{r.name}</p>
            <p className="text-xs text-gray-500">{r.role}</p>
            <p className="mt-1 text-xs text-gray-700">
              Topik: <span className="font-medium">{r.topic}</span>
            </p>
          </div>
          <div className="shrink-0">
            <FormatChip format={r.format} />
          </div>
        </div>
      </div>
    </article>
  );
}

export default function FeedbackPage() {
  const [roleFilter, setRoleFilter] = useState<Role | "semua">("semua");
  const [sortMode, setSortMode] = useState<SortMode>("terbaru");
  const [visible, setVisible] = useState(PAGE_SIZE);

  const list = useMemo(() => {
    const filtered = reviews.filter(
      (r) => roleFilter === "semua" || r.role === roleFilter,
    );
    const sorted = [...filtered];
    if (sortMode === "terbaru") sorted.sort((a, b) => a.days - b.days);
    if (sortMode === "tertinggi")
      sorted.sort((a, b) => b.rating - a.rating || a.days - b.days);
    if (sortMode === "terendah")
      sorted.sort((a, b) => a.rating - b.rating || a.days - b.days);
    return sorted;
  }, [roleFilter, sortMode]);

  const shown = list.slice(0, visible);

  const changeRole = (value: Role | "semua") => {
    setRoleFilter(value);
    setVisible(PAGE_SIZE);
  };

  const changeSort = (value: SortMode) => {
    setSortMode(value);
    setVisible(PAGE_SIZE);
  };

  return (
    <div className="overflow-x-hidden bg-white">
      {/* Hero */}
      <section className="mx-auto w-[92%] pb-10 pt-20 sm:w-[88%] md:pt-28 lg:w-[86%]">
        <h1 className="font-[Montserrat] text-2xl font-extrabold leading-tight text-[#14553a] sm:text-3xl lg:text-4xl">
          Feedback &amp; Ulasan Publik
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-gray-600 sm:text-base">
          Pengalaman klien yang telah menyelesaikan sesi konseling. Identitas
          klien selalu dianonimkan demi menjaga privasi dan rasa aman.
        </p>
      </section>

      {/* Konten */}
      <section className="bg-[#f7fcf9] py-10 sm:py-12">
        <div className="mx-auto w-[92%] sm:w-[88%] lg:w-[86%]">
          {/* Ringkasan rating */}
          <div className="flex flex-col gap-5 rounded-2xl border-2 border-[#14553a] bg-white p-5 sm:p-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="flex items-center gap-1.5">
                  <span className="font-[Montserrat] text-4xl font-extrabold text-[#14553a] sm:text-5xl">
                    4.9
                  </span>
                  <Star className="h-7 w-7 fill-amber-400 text-amber-400 sm:h-8 sm:w-8" />
                </div>
                <p className="mt-1 text-xs font-semibold text-[#14553a]">
                  Rata-rata rating
                </p>
              </div>
              <div className="hidden h-12 w-px bg-gray-200 sm:block" />
              <div>
                <h2 className="text-base font-bold text-[#14553a] sm:text-lg">
                  Kualitas Layanan
                </h2>
                <p className="mt-1 max-w-md text-xs text-gray-500 sm:text-sm">
                  Berdasarkan 180+ tanggapan klien sejak peluncuran sistem
                  SiCARE.
                </p>
              </div>
            </div>

            {/* Urutkan */}
            <div className="flex items-center gap-2.5 md:shrink-0">
              <label
                htmlFor="sortSelect"
                className="text-xs text-gray-500 sm:text-sm"
              >
                Urutkan:
              </label>
              <div className="relative">
                <select
                  id="sortSelect"
                  value={sortMode}
                  onChange={(e) => changeSort(e.target.value as SortMode)}
                  className="appearance-none rounded-full bg-[#14553a] py-2 pl-4 pr-9 text-xs font-semibold text-white shadow-md outline-none transition hover:bg-[#0c2619] focus-visible:ring-4 focus-visible:ring-[#2e9a5f]/40 sm:text-sm"
                >
                  <option value="terbaru">Terbaru</option>
                  <option value="tertinggi">Rating tertinggi</option>
                  <option value="terendah">Rating terendah</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white" />
              </div>
            </div>
          </div>

          {/* Filter peran */}
          <div className="no-scrollbar mt-6 flex gap-2 overflow-x-auto pb-1">
            {ROLE_FILTERS.map((f) => {
              const active = roleFilter === f.value;
              return (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => changeRole(f.value)}
                  className={`shrink-0 rounded-full border border-[#14553a] px-4 py-1.5 text-xs font-semibold transition sm:text-sm ${
                    active
                      ? "bg-[#14553a] text-white"
                      : "bg-white text-[#14553a] hover:bg-[#f7fcf9]"
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          {/* Daftar ulasan */}
          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
            {shown.map((r) => (
              <ReviewCard key={r.id} r={r} />
            ))}
          </div>

          {list.length === 0 && (
            <div className="rounded-2xl border border-dashed border-[#14553a]/40 bg-white p-8 text-center text-sm text-gray-500">
              Belum ada ulasan untuk filter ini.
            </div>
          )}

          {shown.length < list.length && (
            <div className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={() => setVisible((v) => v + PAGE_SIZE)}
                className="rounded-full bg-[#14553a] px-6 py-2.5 text-xs font-semibold text-white shadow-md transition hover:bg-[#0c2619] sm:text-sm"
              >
                Muat lebih banyak
              </button>
            </div>
          )}

          <p className="mt-8 text-center text-xs text-gray-500 sm:text-sm">
            *Klien yang telah menyelesaikan sesi konseling akan menerima tautan
            evaluasi khusus melalui email kampus.
          </p>
        </div>
      </section>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
