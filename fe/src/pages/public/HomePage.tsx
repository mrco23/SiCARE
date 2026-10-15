import {
  ArrowUpRight,
  CalendarDays,
  ClipboardList,
  Heart,
  HeartHandshake,
  Lock,
  SquarePen,
  UserRoundSearch,
  Star,
} from "lucide-react";
import { motion } from "framer-motion";
import type { ElementType } from "react";
import { useEffect, useRef } from "react";

// Lebar konten: lebih sempit dari sebelumnya agar lebih terpusat
const container = "mx-auto w-[84%] sm:w-[76%] md:w-[72%] lg:w-[66%] xl:w-[80%]";

const reasons = [
  {
    icon: Heart,
    title: "Mengurangi beban & Temukan solusi",
    text: "Lorem ipsum dolor sit amet consectetur adipiscing elit odio esse temporibus id sit non possimus facilis aliquip libero officia occaecat et qui non atque.",
  },
  {
    icon: Lock,
    title: "Kerahasiaan terjaga",
    text: "Lorem ipsum dolor sit amet consectetur adipiscing elit odio esse temporibus id sit non possimus facilis aliquip libero officia occaecat et qui.",
  },
  {
    icon: Lock,
    title: "Kerahasiaan terjaga",
    text: "Lorem ipsum dolor sit amet consectetur adipiscing elit odio esse temporibus id sit non possimus facilis aliquip libero officia occaecat et qui.",
  },
];

const steps = [
  {
    no: "01",
    title: "Memilih Layanan Konseling",
    icon: SquarePen,
    text: "Lorem ipsum dolor sit amet consectetur adipiscing elit anim enim ipsum similique distinctio consectetur nisi q cupiditate quidem libero",
  },
  {
    no: "02",
    title: "Memilih Konselor",
    icon: UserRoundSearch,
    text: "Lorem ipsum dolor sit amet consectetur adipiscing elit anim enim ipsum similique distinctio consectetur nisi q cupiditate quidem libero",
  },
  {
    no: "03",
    title: "Memilih Jadwal Tersedia",
    icon: CalendarDays,
    text: "Lorem ipsum dolor sit amet consectetur adipiscing elit anim enim ipsum similique distinctio consectetur nisi q cupiditate quidem libero",
  },
  {
    no: "04",
    title: "Mengisi Informasi",
    icon: ClipboardList,
    text: "Lorem ipsum dolor sit amet consectetur adipiscing elit anim enim ipsum similique distinctio consectetur nisi q cupiditate quidem libero",
  },
];

function Polaroid({
  src,
  className,
  rotate,
}: {
  src: string;
  className: string;
  rotate: number;
}) {
  return (
    <div
      className={`absolute bg-white p-1.5 pb-6 shadow-[0_10px_24px_rgba(0,0,0,0.18)] ${className}`}
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      <img
        src={src}
        alt=""
        className="h-full w-full object-contain"
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
      />
    </div>
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
      <div className="absolute bottom-5 left-0 top-5 w-1 rounded-r-full bg-[#1e5b3a]" />

      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#eef8f3]">
          <Icon className="h-5 w-5 text-[#1e5b3a]" strokeWidth={1.8} />
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

const testimonials = [
  {
    name: "G******",
    text: "lorem ipsum dolor sit amet consectetur adipiscing elit odio esse temporibus id",
  },
  {
    name: "G******",
    text: "lorem banget ipsum dolor sit amet consectetur adipiscing elit odio esse temporibus id",
  },
  {
    name: "G******",
    text: "lorem ipsum dolor sit amet consectetur adipiscing elit odio esse temporibus id",
  },
  {
    name: "G******",
    text: "lorem ipsum dolor sit amet consectetur adipiscing elit odio esse temporibus id",
  },
  {
    name: "G******",
    text: "lorem ipsum dolor sit amet consectetur adipiscing elit odio esse temporibus id",
  },
];

function TestimonialCard({ name, text }: { name: string; text: string }) {
  return (
    <div className="flex w-56 shrink-0 flex-col rounded-xl border border-[#d3e0dc] bg-white px-4 py-4 sm:w-64 sm:px-5 sm:py-5 md:w-72 lg:w-80">
      <p className="font-[Inter] text-sm font-semibold leading-none text-black sm:text-base">
        {name}
      </p>

      <div className="mt-2 flex gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className="h-2.5 w-2.5 fill-[#f3c95a] text-[#f3c95a] sm:h-3 sm:w-3"
            strokeWidth={0}
          />
        ))}
      </div>

      <p className="mt-3 font-[Inter] text-xs leading-relaxed text-[#333] sm:mt-4 sm:text-sm">
        {text}
      </p>
    </div>
  );
}

function Testimonials() {
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
          Identitas klien selalu dianonimkan demi menjaga privasi dan rasa aman
          100%.
        </p>
      </div>

      {/* Marquee: bisa di-swipe di mobile, auto-scroll ke kanan */}
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
              {testimonials.map((item, i) => (
                <TestimonialCard
                  key={`${setIndex}-${i}`}
                  name={item.name}
                  text={item.text}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function HomePage() {
  return (
    <>
      <div className="overflow-x-clip bg-white">
        {/* ================= HERO ================= */}
        <section className="relative isolate min-h-[420px] overflow-hidden md:min-h-[460px] lg:min-h-[520px]">
          {/* Foto latar */}
          <img
            src="/hero.png"
            alt=""
            className="absolute inset-0 -z-10 h-full w-full object-cover object-[70%_30%] md:object-center"
          />

          {/* Overlay: bawah gelap di mobile, kiri di desktop */}
          <div className="absolute inset-0 -z-10 bg-gradient-to from-white via-white/70 to-transparent md:bg-gradient-to-b md:from-white/40 md:via-white/60 md:to-white/80 lg:bg-gradient-to-r lg:from-white/60 lg:via-white/20 lg:to-transparent" />

          {/* Konten */}
          <div
            className={`relative z-10 flex min-h-[inherit] flex-col justify-end pb-12 pt-24 text-center md:justify-center md:pb-20 md:pt-36 lg:items-start lg:pb-28 lg:text-left ${container}`}
          >
            <div className="mx-auto flex max-w-xl flex-col items-center lg:mx-0 lg:items-start">
              <h1 className="text-2xl font-bold leading-[1.2] text-[#1b1b1b] sm:text-3xl lg:max-w-[18ch] lg:text-[38px]">
                Lorem ipsum dolor <span className="text-[#2e9a5f]">sit</span>{" "}
                amet, <span className="text-[#2e9a5f]">consectetur</span>{" "}
                <span className="text-[#2e9a5f]">adipiscing elit.</span>
              </h1>

              <p className="mt-3 max-w-sm text-justify text-xs leading-relaxed text-[#1b1b1b] text-balance sm:text-sm md:mt-4 md:max-w-md lg:max-w-md lg:text-left">
                Lorem ipsum dolor sit amet consectetur adipiscing elit odio esse
                temporibus id sit non possimus facilis aliquip libero officia
                occaecat et qui.
              </p>

              <button className="mt-5 flex w-fit items-center gap-2 rounded-md bg-[#1e5b3a] px-4 py-2.5 text-xs font-semibold text-white shadow-md transition hover:bg-[#174a2f] md:mt-6 sm:px-5 sm:text-sm">
                <CalendarDays className="h-3.5 w-3.5" />
                Mulai Konseling
              </button>
            </div>

            {/* Badge: mobile saja */}
            <div className="mx-auto mt-5 inline-flex w-fit items-center gap-2 rounded-lg bg-white/95 px-2.5 py-1.5 shadow md:hidden">
              <HeartHandshake className="h-4 w-4 text-primary" />
              <div className="text-left">
                <p className="text-[11px] font-semibold text-[#1b1b1b]">
                  Dampingan Humanis
                </p>
                <p className="text-[9px] text-gray-500">
                  Dukungan akademik & personal
                </p>
              </div>
            </div>
          </div>

          {/* Polaroid mobile: kecil di kanan atas */}
          <div className="pointer-events-none absolute right-6 top-32 z-0 h-20 w-24 md:hidden">
            <Polaroid
              src="/maskot.png"
              className="right-0 top-0 h-16 w-14"
              rotate={6}
            />
            <Polaroid
              src="/maskot.png"
              className="bottom-0 left-0 h-12 w-12"
              rotate={-6}
            />
          </div>

          {/* Polaroid desktop */}
          <div className="pointer-events-none absolute right-[10%] top-1/2 z-0 hidden h-52 w-72 -translate-y-1/2 lg:block">
            <Polaroid
              src="/maskot.png"
              className="right-0 top-0 h-36 w-44"
              rotate={6}
            />
            <Polaroid
              src="/maskot.png"
              className="bottom-0 left-0 h-24 w-24"
              rotate={-8}
            />
            {/* Kartu Dampingan Humanis: desktop */}
            <div className="pointer-events-none absolute right-[18%] top-[-20%] z-20 hidden lg:block">
              <div className="flex items-center gap-2.5 rounded-lg bg-white/95 px-3 py-2 shadow-lg backdrop-blur">
                <HeartHandshake className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-[12px] font-semibold text-[#1b1b1b]">
                    Dampingan Humanis
                  </p>
                  <p className="text-[10px] text-gray-500">
                    Dukungan akademik & personal
                  </p>
                </div>
              </div>
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
                  Lorem ipsum dolor sit amet consectetur adipiscing elit odio
                  esse temporibus id sit non possimus facilis aliquip libero
                  officia occaecat et qui
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
      </div>
      <Testimonials />
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

        <button className="mx-auto mt-10 flex items-center gap-2 rounded-full bg-white py-2 pl-5 pr-1.5 text-xs font-medium text-[#1b1b1b] shadow-[0_8px_20px_rgba(0,0,0,0.12)] transition hover:shadow-lg sm:text-sm">
          Lihat Selengkapnya
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1d3a86] text-white">
            <ArrowUpRight className="h-3.5 w-3.5" />
          </span>
        </button>
      </div>
    </section>
  );
}
