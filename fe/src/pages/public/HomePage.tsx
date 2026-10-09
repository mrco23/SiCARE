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
import Navbar from "../../components/home/Navbar";
import Footer from "../../components/home/Footer";

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
    <div className="relative rounded-2xl border border-gray-300 bg-white p-6 sm:p-7">
      {/* Garis aksen hijau di sisi kiri */}
      <div className="absolute bottom-6 left-0 top-6 w-1 rounded-r-full bg-[#1e5b3a]" />

      <div className="flex items-center gap-5">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#eef8f3]">
          <Icon className="h-6 w-6 text-[#1e5b3a]" strokeWidth={1.8} />
        </div>
        <h3 className="font-[Montserrat] text-lg font-semibold leading-snug text-[#1b1b1b] sm:text-xl">
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
        <p className="mt-4 pl-[68px] font-[Montserrat] text-sm leading-relaxed text-gray-500 sm:text-[15px]">
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
    <div className="flex w-65 shrink-0 flex-col rounded-card border border-[#d3e0dc] bg-white px-5 py-5 sm:w-75 sm:px-6 sm:py-6 md:w-85 lg:w-100 lg:px-7">
      <p className="font-[Inter] text-base font-semibold leading-none text-black sm:text-lg">
        {name}
      </p>

      <div className="mt-2 flex gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className="h-3 w-3 fill-[#f3c95a] text-[#f3c95a] sm:h-3.5 sm:w-3.5"
            strokeWidth={0}
          />
        ))}
      </div>

      <p className="mt-4 font-[Inter] text-sm leading-relaxed text-[#333] sm:mt-5 sm:text-[15px]">
        {text}
      </p>
    </div>
  );
}

function Testimonials() {
  return (
    <section className="overflow-hidden bg-white py-16 md:py-24">
      {/* Judul */}
      <div className="mx-auto w-[92%] text-center sm:w-[88%] lg:w-[86%]">
        <h2 className="text-3xl font-bold leading-tight text-black sm:text-4xl md:text-[44px]">
          Suara dari Mereka yang Telah Melangkah
        </h2>
        <p className="mt-4 text-sm text-[#1b1b1b] sm:text-base md:text-[18px]">
          Identitas klien selalu dianonimkan demi menjaga privasi dan rasa aman
          100%.
        </p>
      </div>

      {/* Marquee: lebar penuh layar, bergerak ke kanan */}
      <div className="testimonial-marquee mt-10 md:mt-16">
        <div className="testimonial-track flex w-max">
          {/* Dua set identik agar loop mulus */}
          {[0, 1].map((setIndex) => (
            <div
              key={setIndex}
              className="flex shrink-0 gap-4 pr-4 sm:gap-6 sm:pr-6 md:gap-8 md:pr-8 lg:gap-14 lg:pr-14"
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
      <div className="overflow-x-hidden bg-white">
        {/* ================= HERO ================= */}
        <section className="relative min-h-150 overflow-hidden md:min-h-175">
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
            <h1 className="max-w-140 text-3xl font-bold leading-[1.15] text-[#1b1b1b] sm:text-5xl">
              Lorem ipsum dolor <span className="text-[#2e9a5f]">sit</span>{" "}
              amet, <span className="text-[#2e9a5f]">consectetur</span>{" "}
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
                className="right-0 top-0 h-48 w-60 rotate-6"
              />
              <Polaroid
                src="/maskot.png"
                className="bottom-0 left-0 h-36 w-36 -rotate-8"
              />
            </div>
          </div>

          <svg
            className="absolute -bottom-px left-0 z-10 block h-14 w-full md:h-20"
            viewBox="0 0 1440 320"
            preserveAspectRatio="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fill="#f5fdf9"
              fillOpacity="1"
              d="M0,128L120,154.7C240,181,480,235,720,234.7C960,235,1200,181,1320,154.7L1440,128L1440,320L1320,320C1200,320,960,320,720,320C480,320,240,320,120,320L0,320Z"
            />
          </svg>
        </section>

        {/* ================= KENAPA LAYANAN KONSELING HADIR ================= */}
        <section className="bg-linear-to-b from-[#f5fdf9] to-white py-16 md:py-24">
          <div className={container}>
            <div className="grid items-center gap-10 md:grid-cols-2">
              {/* Kiri: logo, judul, deskripsi */}
              <div>
                <div className="flex items-center gap-6">
                  <img
                    src="/kampus.png"
                    alt="Logo Universitas Katolik De La Salle Manado"
                    className="h-20 w-auto object-contain md:h-24"
                  />
                  <img
                    src="/himsi.png"
                    alt="Logo HIMPSI"
                    className="h-20 w-auto object-contain md:h-24"
                  />
                </div>

                <h2 className="mt-8 font-[Montserrat] text-3xl font-bold leading-[1.2] text-[#1b1b1b] sm:text-4xl lg:text-[44px]">
                  Kenapa Layanan
                  <br />
                  Konseling <span className="text-[#2e9a5f]">Hadir</span>
                  <br />
                  <span className="text-[#2e9a5f]">Untuk Anda?</span>
                </h2>

                <p className="mt-3 max-w-xl font-[Montserrat] text-sm leading-relaxed text-gray-600 sm:text-[15px]">
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
                  className="w-full max-w-65 object-contain sm:max-w-80 lg:max-w-90"
                />
              </div>
            </div>

            {/* Kartu keunggulan */}
            <div className="mt-16 grid gap-6 md:mt-20 md:grid-cols-3">
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
      <Footer />
    </>
  );
}

function Panduan() {
  return (
    <>
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
                <div key={step.no} className="group relative pt-16 md:pt-20">
                  {/* Angka besar di belakang: naik & lebih terlihat saat card di-hover */}
                  <span className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 font-[Montserrat] text-[96px] font-black leading-none text-[#b9e4cc]/50 transition-all duration-500 ease-out group-hover:-translate-y-3 group-hover:text-[#b9e4cc]/90 sm:text-[120px] xl:text-[150px]">
                    {step.no}
                  </span>

                  {/* Card: membesar sedikit saat di-hover */}
                  <div className="relative flex h-full origin-center flex-col items-center rounded-xl bg-white px-6 pb-8 pt-7 shadow-[0_10px_30px_rgba(0,0,0,0.08)] transition-all duration-500 ease-out group-hover:scale-105 group-hover:shadow-[0_20px_40px_rgba(0,0,0,0.14)]">
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
    </>
  );
}
