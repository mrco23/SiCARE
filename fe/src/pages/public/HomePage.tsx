import {
  ArrowUpRight,
  CalendarDays,
  ClipboardList,
  Heart,
  Lock,
  ShieldCheck,
  SquarePen,
  UserRoundSearch,
  Star,
} from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import type { ElementType } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  getPublicAcademicPeriods,
  getPublicCounselors,
  getPublicFeedback,
  getPublicHeroMotivations,
  type PublicAcademicPeriod,
  type PublicCounselor,
  type PublicFeedback,
  getPublicPhotoUrl,
} from "../../lib/publicApi";

// Lebar konten: lebih sempit dari sebelumnya agar lebih terpusat
const container = "mx-auto w-[84%] sm:w-[76%] md:w-[72%] lg:w-[66%] xl:w-[80%]";

const DEFAULT_HERO_MOTIVATION =
  "Kamu tidak harus menghadapi semuanya sendirian.";

const reasons = [
  {
    icon: Heart,
    title: "Mengurangi beban & Temukan solusi",
    text: "Dapatkan ruang refleksi dan bimbingan terarah bersama konselor untuk mengurai tantangan akademik, relasi sosial, maupun penyesuaian diri di kampus.",
  },
  {
    icon: Lock,
    title: "Privasi & Kerahasiaan Terjamin",
    text: "Setiap sesi konseling berpedoman pada kode etik profesional dan dilindungi persetujuan Digital Informed Consent demi menjaga kerahasiaan data Anda.",
  },
  {
    icon: ShieldCheck,
    title: "Pendampingan Inklusif & Terbuka",
    text: "Layanan konseling terbuka bagi seluruh mahasiswa dan sivitas akademika Unika De La Salle Manado dengan pendekatan empati tanpa diskriminasi.",
  },
];

const steps = [
  {
    no: "01",
    title: "Memilih Layanan Konseling",
    icon: SquarePen,
    text: "Tentukan bentuk pendampingan yang dibutuhkan, baik konseling individu personal maupun konseling kelompok bersama rekan.",
  },
  {
    no: "02",
    title: "Memilih Konselor",
    icon: UserRoundSearch,
    text: "Pelajari fokus keahlian dan profil konselor berwenang yang siap mendampingi kebutuhan perkembangan Anda.",
  },
  {
    no: "03",
    title: "Memilih Jadwal Tersedia",
    icon: CalendarDays,
    text: "Pilih waktu sesi yang paling sesuai dari jadwal yang telah dibuka konselor pada periode akademik aktif.",
  },
  {
    no: "04",
    title: "Mengisi Informasi",
    icon: ClipboardList,
    text: "Lengkapi data pengajuan secara ringkas serta tanda tangani persetujuan informed consent sebelum sesi dimulai.",
  },
];

function getSentenceSplit(text: string): { prefix: string; highlight: string } {
  const trimmed = text.trim();
  const words = trimmed.split(/\s+/);
  if (words.length <= 1) {
    return { prefix: "", highlight: text };
  }

  const highlightWordCount =
    words.length <= 3
      ? 1
      : words.length <= 6
        ? 2
        : Math.min(4, Math.max(2, Math.floor(words.length * 0.35)));

  const targetWords = words.slice(words.length - highlightWordCount);
  const targetSubstring = targetWords.join(" ");
  const cutoffIndex = text.lastIndexOf(targetSubstring);

  if (cutoffIndex <= 0) {
    const spaceIndices: number[] = [];
    for (let i = 0; i < text.length; i++) {
      if (text[i] === " ") spaceIndices.push(i);
    }
    const splitSpaceIndex =
      spaceIndices[Math.max(0, spaceIndices.length - highlightWordCount)];
    if (splitSpaceIndex !== undefined && splitSpaceIndex > 0) {
      return {
        prefix: text.slice(0, splitSpaceIndex + 1),
        highlight: text.slice(splitSpaceIndex + 1),
      };
    }
    return { prefix: text, highlight: "" };
  }

  return {
    prefix: text.slice(0, cutoffIndex),
    highlight: text.slice(cutoffIndex),
  };
}

function MotivationalTyping({ text }: { text: string }) {
  const [displayedCount, setDisplayedCount] = useState(0);
  const [prevText, setPrevText] = useState(text);
  const containerRef = useRef<HTMLSpanElement>(null);
  const [hasStarted, setHasStarted] = useState(
    () => typeof window === "undefined" || !("IntersectionObserver" in window),
  );

  // Reset displayed count cleanly when prop changes
  if (text !== prevText) {
    setPrevText(text);
    setDisplayedCount(0);
  }

  const prefersReducedMotion =
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;

  const { prefix, highlight } = useMemo(() => getSentenceSplit(text), [text]);

  // Trigger when visible in viewport or first rendered
  useEffect(() => {
    if (prefersReducedMotion || hasStarted) return;

    const element = containerRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setHasStarted(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [prefersReducedMotion, hasStarted]);

  // Character reveal animation (approx 50ms per character)
  useEffect(() => {
    if (prefersReducedMotion || !hasStarted) return;

    let current = 0;
    const interval = 50;
    const targetLength = text.length;

    const timer = window.setInterval(() => {
      current += 1;
      setDisplayedCount(current);
      if (current >= targetLength) {
        window.clearInterval(timer);
      }
    }, interval);

    return () => {
      window.clearInterval(timer);
    };
  }, [text, hasStarted, prefersReducedMotion]);

  const effectiveCount = prefersReducedMotion ? text.length : displayedCount;
  const displayedPrefix = prefix.slice(
    0,
    Math.min(effectiveCount, prefix.length),
  );
  const remainingForHighlight = Math.max(0, effectiveCount - prefix.length);
  const displayedHighlight = highlight.slice(0, remainingForHighlight);
  const isTyping = effectiveCount < text.length && !prefersReducedMotion;

  return (
    <span ref={containerRef} className="relative inline-block w-full">
      {/* Accessible alternative for screen readers */}
      <span className="sr-only">{text}</span>

      {/* Visual presentation hidden from screen readers to prevent character-by-character reading */}
      <span aria-hidden="true" className="grid place-items-center">
        {/* Invisible full text reserving dimensions to prevent layout shifts */}
        <span className="invisible col-start-1 row-start-1 select-none pointer-events-none">
          <span>{prefix}</span>
          <span className="text-primary">{highlight}</span>
        </span>

        {/* Sequentially typed text */}
        <span className="col-start-1 row-start-1">
          <span className="text-[#1b1b1b]">{displayedPrefix}</span>
          <span className="text-primary">{displayedHighlight}</span>
          {isTyping && (
            <span
              className="inline-block h-[0.85em] w-[2.5px] translate-y-[2px] bg-primary ml-1 motion-safe:animate-pulse"
              aria-hidden="true"
            />
          )}
        </span>
      </span>
    </span>
  );
}

function ReasonCard({
  icon: Icon,
  title,
  text,
}: {
  icon: ElementType;
  title: string;
  text: string;
}) {
  return (
    <div className="relative rounded-xl border border-gray-300 bg-white p-5 sm:p-6">
      {/* Garis aksen hijau di sisi kiri */}
      <div className="absolute bottom-5 left-0 top-5 w-1 rounded-r-full bg-primary" />

      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#eef8f3]">
          <Icon className="h-5 w-5 text-primary" strokeWidth={1.8} />
        </div>
        <h3 className="font-[Montserrat] text-base font-semibold leading-snug text-[#1b1b1b] sm:text-lg">
          {title}
        </h3>
      </div>

      <motion.div
        initial={{ height: 0, opacity: 0 }}
        whileInView={{ height: "auto", opacity: 1 }}
        viewport={{ once: true, amount: 0.8 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="overflow-hidden"
      >
        <p className="mt-3 pl-14 font-[Montserrat] text-xs leading-relaxed text-gray-500 sm:text-sm">
          {text}
        </p>
      </motion.div>
    </div>
  );
}

function TestimonialCard({
  name,
  text,
  rating,
}: {
  name: string;
  text: string;
  rating: number;
}) {
  return (
    <div className="flex w-56 shrink-0 flex-col rounded-xl border border-[#d3e0dc] bg-white px-4 py-4 sm:w-64 sm:px-5 sm:py-5 md:w-72 lg:w-80">
      <p className="font-[Inter] text-sm font-semibold leading-none text-black sm:text-base">
        {name}
      </p>

      <div className="mt-2 flex gap-0.5" aria-label={`Rating ${rating} dari 5`}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            aria-hidden="true"
            className={`h-2.5 w-2.5 sm:h-3 sm:w-3 ${i < Math.round(rating) ? "fill-[#f3c95a] text-[#f3c95a]" : "fill-none text-gray-300"}`}
            strokeWidth={1.5}
          />
        ))}
      </div>

      <p className="mt-3 font-[Inter] text-xs leading-relaxed text-[#333] sm:mt-4 sm:text-sm">
        {text}
      </p>
    </div>
  );
}

function Testimonials({ testimonials }: { testimonials: PublicFeedback[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const hoverRef = useRef(false);
  const touchRef = useRef(false);
  const resumeTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduceMotion) return;

    const speed = 0.3; // px per frame, arah ke kanan
    let pos = el.scrollLeft;
    let frame = 0;

    const tick = () => {
      const half = el.scrollWidth / 2; // satu set kartu
      const paused = hoverRef.current || touchRef.current;

      if (paused) {
        // Ikuti posisi scroll dari user (swipe / momentum)
        pos = el.scrollLeft;
        if (pos >= half) {
          pos -= half;
          el.scrollLeft = pos;
        }
      } else {
        // Auto-scroll ke kanan (scrollLeft berkurang)
        pos -= speed;
        if (pos < 0) pos += half;
        el.scrollLeft = pos;
      }

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(resumeTimer.current);
    };
  }, []);

  // Sentuhan: jeda saat jari menyentuh, lanjut 1.5 detik setelah dilepas
  const handleTouchStart = () => {
    touchRef.current = true;
    window.clearTimeout(resumeTimer.current);
  };

  const handleTouchEnd = () => {
    window.clearTimeout(resumeTimer.current);
    resumeTimer.current = window.setTimeout(() => {
      touchRef.current = false;
    }, 1500);
  };

  // Mouse: jeda saat kursor di atas marquee
  const handlePointerEnter = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse") hoverRef.current = true;
  };

  const handlePointerLeave = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse") hoverRef.current = false;
  };

  return (
    <section className="overflow-hidden bg-white py-12 md:py-16">
      {/* Judul */}
      <div className={`${container} text-center`}>
        <h2 className="text-2xl font-bold leading-tight text-black sm:text-3xl md:text-4xl">
          Suara dari Mereka yang Telah Melangkah
        </h2>
        <p className="mt-3 text-xs text-[#1b1b1b] sm:text-sm md:text-base">
          Feedback yang ditampilkan telah disetujui untuk publikasi. Identitas
          klien tidak ditampilkan.
        </p>
      </div>

      {testimonials.length === 0 ? (
        <p className="mx-auto mt-8 max-w-xl text-center text-sm text-gray-500">
          Belum ada feedback yang disetujui untuk ditampilkan.
        </p>
      ) : (
        /* Marquee: bisa di-swipe di mobile, auto-scroll ke kanan */
        <div
          ref={scrollRef}
          className="mt-8 touch-pan-x overflow-x-auto overscroll-x-contain md:mt-12 [&::-webkit-scrollbar]:hidden"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          onPointerEnter={handlePointerEnter}
          onPointerLeave={handlePointerLeave}
        >
          <div className="flex w-max">
            {/* Dua set identik agar loop mulus */}
            {[0, 1].map((setIndex) => (
              <div
                key={setIndex}
                className="flex shrink-0 gap-3 pr-3 sm:gap-4 sm:pr-4 md:gap-5 md:pr-5 lg:gap-8 lg:pr-8"
                aria-hidden={setIndex === 1}
              >
                {testimonials.map((item) => (
                  <TestimonialCard
                    key={`${setIndex}-${item.id}`}
                    name="Klien SiCARE"
                    rating={item.rating}
                    text={
                      item.comment?.trim() ||
                      `Memberikan penilaian ${item.rating} dari 5 untuk layanan konseling.`
                    }
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function Counselors({
  counselors,
  periods,
}: {
  counselors: PublicCounselor[];
  periods: PublicAcademicPeriod[];
}) {
  return (
    <section className="bg-[#f5fdf9] py-12 md:py-16">
      <div className="mx-auto w-[90%] md:w-[84%] lg:w-[76%] xl:w-[80%]">
        <div className="text-center">
          <h2 className="text-2xl font-bold leading-tight text-[#1b1b1b] sm:text-3xl md:text-4xl">
            Ayo Bertemu dengan Konselor Anda!
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-xs leading-relaxed text-[#1b1b1b] sm:text-sm md:text-base">
            Lihat bagaimana proses booking konseling di SiCARE dan temukan
            langkah yang sesuai untukmu.
          </p>
        </div>

        {periods.length > 0 && (
          <p className="mt-4 text-center text-xs text-gray-600 sm:text-sm">
            Periode akademik:{" "}
            {periods
              .map((period) => `${period.academic_year} · ${period.semester}`)
              .join(", ")}
          </p>
        )}
        {counselors.length === 0 ? (
          <p className="mt-8 text-center text-sm text-gray-500">
            Belum ada profil konselor yang dipublikasikan.
          </p>
        ) : (
          <div className="mt-8 flex flex-wrap justify-center gap-6 md:mt-12 md:gap-5 lg:gap-7">
            {counselors.slice(0, 3).map((counselor) => (
              <article
                key={counselor.profile_id}
                tabIndex={0}
                className={`group relative isolate w-full max-w-sm overflow-hidden rounded-2xl border border-[#dcebe2] bg-white shadow-[0_8px_24px_rgba(0,0,0,0.06)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_32px_rgba(0,0,0,0.12)] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  counselors.slice(0, 3).length === 2
                    ? "md:w-[calc(50%_-_0.625rem)]"
                    : counselors.slice(0, 3).length === 3
                      ? "md:w-[calc(33.333%_-_0.84rem)]"
                      : "md:w-full"
                }`}
              >
                <div className="flex aspect-square items-center justify-center overflow-hidden bg-[#e8f4ec]">
                  {getPublicPhotoUrl(counselor.photo_path) ? (
                    <img
                      src={getPublicPhotoUrl(counselor.photo_path) ?? undefined}
                      alt={`Foto ${counselor.public_name}`}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 group-focus-within:scale-105"
                    />
                  ) : (
                    <span
                      className="font-[Montserrat] text-5xl font-bold text-primary"
                      aria-label={`Foto ${counselor.public_name} belum tersedia`}
                    >
                      {counselor.public_name.trim().charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>

                <div className="min-h-[142px] p-5">
                  <h3 className="font-[Montserrat] text-base font-bold text-[#1b1b1b] sm:text-lg">
                    {counselor.public_name}
                  </h3>
                  <p className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-gray-500 sm:text-xs">
                    Topik Keahlian
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(counselor.specialties ?? []).slice(0, 3).map((topic) => (
                      <span
                        key={topic}
                        className="rounded-full bg-[#eef8f3] px-2.5 py-1 font-[Montserrat] text-[10px] font-medium text-primary sm:text-xs"
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pointer-events-none absolute inset-0 flex flex-col justify-end bg-gradient-to-b from-[#163c2c]/90 via-[#174a32]/95 to-[#123b29] p-5 text-white opacity-0 transition-opacity duration-300 group-hover:pointer-events-auto group-hover:opacity-100 group-focus:pointer-events-auto group-focus:opacity-100 sm:p-6">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#b9e4cc]">
                      Tentang Konselor
                    </p>
                    <h3 className="mt-2 font-[Montserrat] text-lg font-bold sm:text-xl">
                      {counselor.public_name}
                    </h3>
                    <p className="mt-3 text-xs leading-relaxed text-white/90 sm:text-sm">
                      {counselor.bio?.trim() ||
                        counselor.headline?.trim() ||
                        "Informasi profil konselor belum tersedia."}
                    </p>
                    <div className="mt-4 space-y-3">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#b9e4cc] sm:text-xs">
                          Pengalaman
                        </p>
                        <p className="mt-1 text-xs leading-relaxed sm:text-sm">
                          {typeof counselor.years_experience === "number"
                            ? `${counselor.years_experience} tahun`
                            : "Informasi belum tersedia"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#b9e4cc] sm:text-xs">
                          Jabatan / Headline
                        </p>
                        <p className="mt-1 text-xs leading-relaxed sm:text-sm">
                          {counselor.headline?.trim() ||
                            "Informasi belum tersedia"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <Link
                    to="/profil-konselor"
                    className="mt-5 flex w-fit items-center gap-2 rounded-full bg-white py-2 pl-4 pr-1.5 text-xs font-medium text-[#1b1b1b] shadow-[0_8px_20px_rgba(0,0,0,0.12)] transition hover:shadow-lg sm:text-sm"
                  >
                    Kenali Lebih Lanjut
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1d3a86] text-white">
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </span>
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default function HomePage() {
  const [heroMotivation, setHeroMotivation] = useState(DEFAULT_HERO_MOTIVATION);
  const [publicCounselors, setPublicCounselors] = useState<PublicCounselor[]>(
    [],
  );
  const [publicPeriods, setPublicPeriods] = useState<PublicAcademicPeriod[]>(
    [],
  );
  const [publicFeedback, setPublicFeedback] = useState<PublicFeedback[]>([]);

  useEffect(() => {
    let active = true;
    void getPublicCounselors()
      .then((items) => {
        if (active) setPublicCounselors(items);
      })
      .catch(() => {
        if (active) setPublicCounselors([]);
      });
    void getPublicAcademicPeriods()
      .then((items) => {
        if (active) setPublicPeriods(items);
      })
      .catch(() => {
        if (active) setPublicPeriods([]);
      });
    void getPublicFeedback(10)
      .then((items) => {
        if (active) setPublicFeedback(items);
      })
      .catch(() => {
        if (active) setPublicFeedback([]);
      });

    void getPublicHeroMotivations()
      .then((items) => {
        const available = items.filter(
          (item) =>
            typeof item.content === "string" && item.content.trim().length > 0,
        );
        if (active && available.length > 0) {
          const selected =
            available[Math.floor(Math.random() * available.length)];
          setHeroMotivation(selected.content);
        }
      })
      .catch(() => {
        // The default sentence remains visible if the public API is unavailable.
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <div className="overflow-x-clip bg-white">
        {/* ================= HERO ================= */}
        <section className="relative isolate min-h-[420px] overflow-hidden md:min-h-[460px] lg:min-h-[520px]">
          {/* Foto latar */}
          <img
            src="/hero/hero-2.webp"
            alt=""
            className="absolute inset-0 -z-20 h-full w-full object-cover object-[70%_30%] md:object-center"
          />

          {/* White overlay */}
          <div className="pointer-events-none absolute inset-0 -z-10 bg-white/40" />

          {/* Konten: selalu di tengah */}
          <div
            className={`relative z-10 flex min-h-[inherit] flex-col items-center justify-center pb-16 pt-24 text-center md:pb-20 md:pt-36 lg:pb-28 ${container}`}
          >
            <div className="mx-auto flex max-w-xl flex-col items-center lg:max-w-2xl">
              <h1 className="text-2xl font-bold leading-[1.2] text-[#1b1b1b] text-balance sm:text-3xl lg:text-[38px]">
                <MotivationalTyping text={heroMotivation} />
              </h1>

              <Link
                to="/klien/pesanan"
                className="mt-5 flex w-fit items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-xs font-semibold text-white shadow-md transition hover:bg-primary-dark sm:px-5 sm:text-sm md:mt-6"
              >
                <CalendarDays className="h-3.5 w-3.5" />
                Mulai Konseling
              </Link>
            </div>
          </div>

          {/* Wave bawah */}
          <svg
            className="absolute -bottom-px left-0 z-10 block h-6 w-full md:h-10 lg:h-14"
            viewBox="0 0 1440 320"
            preserveAspectRatio="none"
          >
            <path
              fill="#f5fdf9"
              d="M0,128L120,154.7C240,181,480,235,720,234.7C960,235,1200,181,1320,154.7L1440,128L1440,320L1320,320C1200,320,960,320,720,320C480,320,240,320,120,320L0,320Z"
            />
          </svg>
        </section>

        {/* ================= KENAPA LAYANAN KONSELING HADIR ================= */}
        <section className="bg-linear-to-b from-[#f5fdf9] to-white py-12 md:py-16">
          <div className={container}>
            <div className="grid items-center gap-8 md:grid-cols-2">
              {/* Kiri: logo, judul, deskripsi */}
              <div>
                <div className="flex items-center gap-4">
                  <img
                    src="/kampus.png"
                    alt="Logo Universitas Katolik De La Salle Manado"
                    className="h-14 w-auto object-contain md:h-16"
                  />
                  <img
                    src="/himsi.png"
                    alt="Logo HIMPSI"
                    className="h-14 w-auto object-contain md:h-16"
                  />
                </div>

                <h2 className="mt-6 text-2xl font-bold leading-[1.25] text-[#1b1b1b] sm:text-3xl lg:text-4xl">
                  Kenapa Layanan
                  <br />
                  Konseling <span className="text-[#2e9a5f]">Hadir</span>
                  <br />
                  <span className="text-[#2e9a5f]">Untuk Anda?</span>
                </h2>

                <p className="mt-3 max-w-md text-xs leading-relaxed text-gray-600 sm:text-sm">
                  Lembaga Misi &amp; Identitas (LMI) menyediakan layanan
                  bimbingan konseling yang aman, empatik, dan profesional guna
                  mendampingi perkembangan akademik serta kesehatan mental
                  sivitas akademika Unika De La Salle Manado.
                </p>
              </div>

              {/* Kanan: maskot */}
              <div className="flex justify-center md:justify-end">
                <img
                  src="/thinking.png"
                  alt="Maskot SiCARE"
                  className="w-full max-w-48 object-contain sm:max-w-56 lg:max-w-64"
                />
              </div>
            </div>

            {/* Kartu keunggulan */}
            <div className="mt-12 grid gap-4 md:mt-14 md:grid-cols-3">
              {reasons.map((item, i) => (
                <ReasonCard
                  key={i}
                  icon={item.icon}
                  title={item.title}
                  text={item.text}
                />
              ))}
            </div>
          </div>
        </section>
        <Panduan />
        <Counselors counselors={publicCounselors} periods={publicPeriods} />
      </div>
      <Testimonials testimonials={publicFeedback} />
    </>
  );
}

function Panduan() {
  return (
    <section className="bg-white py-12 md:py-16">
      {/* ================= SEMUA DIMULAI DARI SINI ================= */}
      <div className={`${container} text-center`}>
        <h2 className="text-2xl font-bold text-[#1b1b1b] sm:text-3xl md:text-4xl">
          Semua Dimulai dari Sini
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-xs text-[#1b1b1b] sm:text-sm md:text-base">
          Lihat bagaimana proses booking konseling di SiCARE dan temukan langkah
          yang sesuai untukmu.
        </p>

        <div className="mt-10 grid gap-8 sm:grid-cols-2 md:mt-12 md:gap-6 lg:grid-cols-4">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <div key={step.no} className="group relative pt-12 md:pt-14">
                {/* Angka besar di belakang: naik & lebih terlihat saat card di-hover */}
                <span className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 text-[72px] font-black leading-none text-[#b9e4cc]/50 transition-all duration-500 ease-out group-hover:-translate-y-2 group-hover:text-[#b9e4cc]/90 sm:text-[88px] xl:text-[100px]">
                  {step.no}
                </span>

                {/* Card: membesar sedikit saat di-hover */}
                <div className="relative flex h-full origin-center flex-col items-center rounded-lg bg-white px-5 pb-6 pt-5 shadow-[0_8px_24px_rgba(0,0,0,0.08)] transition-all duration-500 ease-out group-hover:scale-105 group-hover:shadow-[0_16px_32px_rgba(0,0,0,0.14)]">
                  <h3 className="text-xs font-bold uppercase leading-snug tracking-wide text-[#2b2b2b] md:text-sm">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-xs leading-relaxed text-gray-600 md:text-[13px]">
                    {step.text}
                  </p>
                  <Icon className="mt-4 h-5 w-5 text-gray-500" />
                </div>
              </div>
            );
          })}
        </div>

        <Link
          to="/panduan"
          className="mx-auto mt-10 flex w-fit items-center gap-2 rounded-full bg-white py-2 pl-5 pr-1.5 text-xs font-medium text-[#1b1b1b] shadow-[0_8px_20px_rgba(0,0,0,0.12)] transition hover:shadow-lg sm:text-sm"
        >
          Lihat Selengkapnya
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1d3a86] text-white">
            <ArrowUpRight className="h-3.5 w-3.5" />
          </span>
        </Link>
      </div>
    </section>
  );
}
