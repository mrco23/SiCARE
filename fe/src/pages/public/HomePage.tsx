import {
  ArrowUpRight,
  CalendarDays,
  ClipboardList,
  Heart,
  HeartHandshake,
  Lock,
  SquarePen,
  UserRoundSearch,
} from "lucide-react";
import { motion } from "framer-motion";
import type { ElementType } from "react";
import Navbar from "../../components/home/Navbar";

// Lebar konten: sama persis dengan lebar Navbar di setiap breakpoint
const container = "mx-auto w-[92%] sm:w-[88%] lg:w-[86%]";

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

function Polaroid({ src, className }: { src: string; className: string }) {
  return (
    <div
      className={`absolute bg-white p-2 pb-8 shadow-[0_12px_30px_rgba(0,0,0,0.18)] ${className}`}
    >
      <img
        src={src}
        alt=""
        className="h-full w-full object-cover"
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
      />
    </div>
  );
}

function CounselingIllustration() {
  return (
    <svg
      width="311"
      height="245"
      viewBox="0 0 311 245"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="mx-auto h-auto w-full max-w-[260px] sm:max-w-[311px]"
    >
      <path
        d="M309.002 169C309.002 203.518 277.662 231.5 238.992 231.5C227.777 231.5 217.177 228.697 207.753 223.734C190.394 235.642 172.07 240.402 162.162 242.118C160.056 242.482 158.114 240.45 158.641 238.375C162.178 224.435 167.244 211.351 174.435 200.037C164.396 191.03 158.992 180.445 158.992 169C158.992 134.482 194.814 106.5 238.992 106.5C283.171 106.5 309.002 134.482 309.002 169Z"
        fill="#135C43"
        stroke="#0F4733"
        strokeWidth="4"
      />
      <path
        d="M238.992 189L237.263 187.22C220.998 172.468 210.442 162.887 210.442 151C210.442 141.32 218.052 133.75 227.785 133.75C233.288 133.75 238.571 136.336 241.992 140.417C245.413 136.336 250.696 133.75 256.199 133.75C265.932 133.75 273.542 141.32 273.542 151C273.542 162.887 262.986 172.468 246.721 187.237L238.992 189Z"
        fill="#4ADE80"
      />
      <path
        d="M284.002 129L289.002 119L294.002 129L304.002 134L294.002 139L289.002 149L284.002 139L274.002 134L284.002 129Z"
        fill="#FEF08A"
      />
      <path
        d="M194.002 119L197.002 112L200.002 119L207.002 122L200.002 125L197.002 132L194.002 125L187.002 122L194.002 119Z"
        fill="#FEF08A"
      />
      <path
        d="M174.507 71C174.507 109.66 138.69 141 94.5072 141C80.2408 141 66.8464 137.403 55.1057 131.155C36.2838 143.775 16.6056 148.669 6.0911 150.349C3.68366 150.734 1.57814 148.587 2.07566 146.204C5.2496 131.012 11.106 116.539 19.6124 103.955C10.0441 94.518 4.5072 83.261 4.5072 71C4.5072 32.3401 42.563 1 94.5072 1C146.451 1 174.507 32.3401 174.507 71Z"
        fill="#F1F5F9"
        stroke="#E2E8F0"
        strokeWidth="4"
      />
      <path
        d="M79.5071 56C79.5071 47.7157 86.2228 41 94.5071 41C102.791 41 109.507 47.7157 109.507 56C109.507 63.2657 104.559 69.3756 97.9071 70.6585V76M94.5071 96H94.5171"
        stroke="#94A3B8"
        strokeWidth="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M90.0022 163C92.2113 163 94.0022 161.209 94.0022 159C94.0022 156.791 92.2113 155 90.0022 155C87.7931 155 86.0022 156.791 86.0022 159C86.0022 161.209 87.7931 163 90.0022 163Z"
        fill="#CBD5E1"
      />
      <path
        d="M110.002 175C113.316 175 116.002 172.314 116.002 169C116.002 165.686 113.316 163 110.002 163C106.688 163 104.002 165.686 104.002 169C104.002 172.314 106.688 175 110.002 175Z"
        fill="#94A3B8"
      />
      <path
        d="M135.002 182C139.42 182 143.002 178.418 143.002 174C143.002 169.582 139.42 166 135.002 166C130.584 166 127.002 169.582 127.002 174C127.002 178.418 130.584 182 135.002 182Z"
        fill="#64748B"
      />
    </svg>
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
    <div className="relative rounded-2xl border border-gray-200 bg-white p-5 pl-6 shadow-sm sm:p-7 sm:pl-8">
      <div className="absolute bottom-6 left-0 top-6 w-1 rounded-r-full bg-[#1e5b3a]" />

      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#e8f5ee]">
          <Icon className="h-5 w-5 text-[#1e5b3a]" />
        </div>
        <h3 className="font-[Montserrat] text-base font-semibold leading-snug text-[#1b1b1b] sm:text-[18px]">
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
        <p className="mt-4 text-sm leading-relaxed text-gray-500 sm:text-[14px]">
          {text}
        </p>
      </motion.div>
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="overflow-x-hidden bg-white">
      {/* ================= HERO ================= */}
      <section className="relative min-h-160 overflow-hidden md:min-h-190">
        <img
          src="/hero.png"
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-[65%_center] md:object-center"
        />
        <div className="absolute inset-0 bg-linear-to-r from-white/50 via-white/15 to-transparent" />

        <div className="absolute inset-x-0 top-0 z-50">
          <Navbar />
        </div>

        <div
          className={`relative z-10 flex flex-col justify-center pb-24 pt-24 md:pb-40 md:pt-44 ${container}`}
        >
          <h1 className="max-w-130 text-3xl font-bold leading-[1.15] text-[#1b1b1b] sm:text-5xl">
            Lorem ipsum dolor <span className="text-[#2e9a5f]">sit</span> amet,{" "}
            <span className="text-[#2e9a5f]">consectetur</span>{" "}
            <span className="text-[#2e9a5f]">adipiscing elit.</span>
          </h1>

          <p className="mt-5 max-w-118 text-sm leading-relaxed text-[#1b1b1b] sm:text-base">
            Lorem ipsum dolor sit amet consectetur adipiscing elit odio esse
            temporibus id sit non possimus facilis aliquip libero officia
            occaecat et qui non atque adipiscing excepturi deserunt ipsum qui.
          </p>

          <button className="mt-8 flex w-fit items-center gap-2 rounded-lg bg-[#1e5b3a] px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-[#174a2f] sm:px-6 sm:text-[15px]">
            <CalendarDays className="h-4 w-4" />
            Mulai Konseling
          </button>
        </div>

        {/* Kartu melayang & polaroid (tablet ke atas), sejajar tepi kanan navbar */}
        <div className="absolute right-4 top-37.5 z-10 hidden origin-top-right scale-[0.7] md:right-[6%] md:block md:scale-[0.8] lg:right-[7%] lg:top-47.5 lg:scale-100">
          <div className="absolute -top-16 right-10 flex items-center gap-3 rounded-xl bg-white/95 px-4 py-3 shadow-lg backdrop-blur">
            <HeartHandshake className="h-6 w-6 text-primary" />
            <div>
              <p className="text-[14px] font-semibold text-[#1b1b1b]">
                Dampingan Humanis
              </p>
              <p className="text-[11px] text-gray-500">
                Dukungan akademik & personal
              </p>
            </div>
          </div>

          <div className="relative h-60 w-93">
            <Polaroid
              src="/maskot.png"
              className="right-0 top-0 h-48 w-60 rotate-[6deg]"
            />
            <Polaroid
              src="/maskot.png"
              className="bottom-0 left-0 h-36 w-36 -rotate-[8deg]"
            />
          </div>
        </div>

        <div className="absolute -bottom-px left-0 right-0 z-10 h-14 rounded-t-[50%] bg-linear-to-b from-[#effcf5] to-[#f5fdf9] md:h-20" />
      </section>

      {/* ================= KENAPA LAYANAN KONSELING HADIR ================= */}
      <section className="bg-linear-to-b from-[#f5fdf9] to-white py-16 md:py-24">
        <div className={container}>
          <div className="grid items-center gap-10 md:grid-cols-2">
            <div className="text-center md:text-left">
              <h2 className="font-[Montserrat] text-3xl font-bold leading-[1.2] text-[#1b1b1b] sm:text-4xl lg:text-[44px]">
                Kenapa Layanan
                <br />
                Konseling <span className="text-[#2e9a5f]">Hadir</span>
                <br />
                <span className="text-[#2e9a5f]">Untuk Anda?</span>
              </h2>
              <p className="mx-auto mt-4 max-w-[400px] text-sm leading-relaxed text-gray-600 sm:text-[15px] md:mx-0">
                Lorem ipsum dolor sit amet consectetur adipiscing elit odio esse
                temporibus id sit non possimus facilis aliquip libero officia
                occaecat et qui
              </p>
            </div>

            <CounselingIllustration />
          </div>

          <div className="mt-12 grid gap-9 md:mt-20 md:grid-cols-3">
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

      {/* ================= SEMUA DIMULAI DARI SINI ================= */}
      <section className="bg-white py-16 md:py-24">
        <div className={`${container} text-center`}>
          <h2 className="font-[Montserrat] text-3xl font-bold text-[#1b1b1b] sm:text-4xl md:text-[40px]">
            Semua Dimulai dari Sini
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-[#1b1b1b] sm:text-base md:text-[17px]">
            Lihat bagaimana proses booking konseling di SiCARE dan temukan
            langkah yang sesuai untukmu.
          </p>

          <div className="mt-12 grid gap-10 sm:grid-cols-2 md:mt-16 md:gap-8 lg:grid-cols-4">
            {steps.map((step) => {
              const Icon = step.icon;
              return (
                <div key={step.no} className="relative pt-16 md:pt-20">
                  <span className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 font-[Montserrat] text-[96px] font-black leading-none text-[#b9e4cc]/70 sm:text-[120px] xl:text-[150px]">
                    {step.no}
                  </span>

                  <div className="relative flex h-full flex-col items-center rounded-xl bg-white px-6 pb-8 pt-7 shadow-[0_10px_30px_rgba(0,0,0,0.08)]">
                    <h3 className="font-[Montserrat] text-sm font-bold uppercase leading-snug tracking-wide text-[#2b2b2b] md:text-[15px]">
                      {step.title}
                    </h3>
                    <p className="mt-4 text-sm leading-relaxed text-gray-600 md:text-[14px]">
                      {step.text}
                    </p>
                    <Icon className="mt-6 h-6 w-6 text-gray-500" />
                  </div>
                </div>
              );
            })}
          </div>

          <button className="mx-auto mt-14 flex items-center gap-3 rounded-full bg-white py-2.5 pl-6 pr-2 text-sm font-medium text-[#1b1b1b] shadow-[0_10px_25px_rgba(0,0,0,0.12)] transition hover:shadow-lg sm:text-[15px]">
            Lihat Selengkapnya
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1d3a86] text-white">
              <ArrowUpRight className="h-4 w-4" />
            </span>
          </button>
        </div>
      </section>
    </div>
  );
}
