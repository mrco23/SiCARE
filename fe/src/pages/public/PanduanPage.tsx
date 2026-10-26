import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Briefcase,
  ChevronDown,
  ChevronUp,
  GraduationCap,
  Presentation,
  User,
  Users,
} from "lucide-react";

type Step = {
  no: string;
  title: string;
  side: "right" | "left";
  numClass: string;
  desc?: string;
};

// Hook: true saat elemen masuk viewport (hanya sekali)
function useInView<T extends HTMLElement = HTMLDivElement>(threshold = 0.3) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);

  return [ref, inView] as const;
}

/* ============ SATU LANGKAH ============ */
function StepItem({ s }: { s: Step }) {
  const [ref, inView] = useInView<HTMLLIElement>();
  const isRight = s.side === "right";

  return (
    <li ref={ref} className="relative md:grid md:grid-cols-2">
      {/* node */}
      <div className="absolute left-4 top-7 z-10 -translate-x-1/2 md:left-1/2">
        <span
          className={`relative block h-5 w-5 rounded-full border-[3px] border-primary motion-safe:transition-colors motion-safe:duration-500 ${
            inView ? "bg-primary" : "bg-[#DCE8DE]"
          }`}
        >
          {/* konektor horizontal (desktop) */}
          <span
            className={`absolute top-1/2 hidden h-[3px] w-10 origin-left -translate-y-1/2 bg-[#B8C9BC] motion-safe:transition-transform motion-safe:duration-700 md:block ${
              isRight ? "left-full" : "right-full"
            } ${inView ? "scale-x-100" : "scale-x-0"}`}
          />
        </span>
      </div>

      {/* ghost number */}
      <span
        className={`pointer-events-none absolute select-none text-[110px] font-bold leading-none text-[#C4E2CE] md:text-[150px] ${s.numClass}`}
      >
        {s.no}
      </span>

      {/* konten: masuk dari samping sesuai sisi */}
      <div
        className={`relative z-10 pl-12 motion-safe:transition-all motion-safe:duration-700 motion-safe:ease-out md:pl-0 ${
          isRight
            ? "md:col-start-2 md:pl-14"
            : "md:col-start-1 md:pr-14 md:text-right"
        } ${
          inView
            ? "translate-x-0 translate-y-0 opacity-100"
            : `translate-y-6 opacity-0 md:translate-y-0 ${
                isRight ? "md:translate-x-10" : "md:-translate-x-10"
              }`
        }`}
      >
        <div
          className={`max-w-[420px] rounded-2xl border border-[#DCE8DE] bg-white p-6 shadow-sm backdrop-blur-sm md:p-7 ${
            isRight ? "" : "md:ml-auto"
          }`}
        >
          <h3 className="font-[Montserrat] text-lg font-semibold text-primary md:text-xl">
            {s.title}
          </h3>
          <p className="mt-3 text-[13px] leading-relaxed text-[#3b4a44] md:text-[14px]">
            {s.desc ?? LOREM_LONG}
          </p>
        </div>
      </div>
    </li>
  );
}

/* ============ ALUR SISTEM ============ */
function AlurSistem() {
  const [listRef, listInView] = useInView<HTMLDivElement>(0.15);

  return (
    <>
      <section className="relative mt-16 bg-[#E3F2E7] pb-28 pt-20 md:mt-24 md:pb-32">
        {/* gelombang atas */}
        <svg
          className="absolute -top-[59px] left-0 h-[60px] w-full"
          viewBox="0 0 1440 60"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            d="M0,60 L0,30 C200,0 400,50 720,25 C1040,0 1240,45 1440,20 L1440,60 Z"
            fill="#E3F2E7"
          />
        </svg>
        {/* gelombang bawah */}
        <svg
          className="absolute -bottom-[59px] left-0 h-[60px] w-full"
          viewBox="0 0 1440 60"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            d="M0,0 L1440,0 L1440,25 C1200,60 1000,5 720,35 C440,65 240,10 0,40 Z"
            fill="#E3F2E7"
          />
        </svg>

        {/* garis putus-putus dekoratif */}
        <svg
          className="pointer-events-none absolute inset-0 hidden h-full w-full md:block"
          viewBox="0 0 1440 1000"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            d="M20,70 C120,190 300,230 560,215 C800,200 900,80 1200,50 L1420,40"
            fill="none"
            stroke="#B8D8C2"
            strokeWidth="3"
            strokeDasharray="18 22"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M1420,640 C1250,680 1150,760 1000,860 C850,960 600,990 300,960 C200,950 120,900 60,860"
            fill="none"
            stroke="#B8D8C2"
            strokeWidth="3"
            strokeDasharray="18 22"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        <div className="relative mx-auto w-[92%] sm:w-[88%] lg:w-[86%]">
          <SectionTitle>
            Alur Sistem dari Pengunjung hingga Selesai
          </SectionTitle>

          <div className="relative mt-24" ref={listRef}>
            {/* garis tengah: tergambar dari atas ke bawah */}
            <div
              className={`absolute bottom-0 top-0 left-4 w-[3px] origin-top -translate-x-1/2 bg-[#B8C9BC] motion-safe:transition-transform motion-safe:duration-1000 md:left-1/2 ${
                listInView ? "scale-y-100" : "scale-y-0"
              }`}
            />

            <ol className="space-y-20 md:space-y-28">
              {steps.map((s) => (
                <StepItem key={s.no} s={s} />
              ))}
            </ol>
          </div>
        </div>
      </section>
    </>
  );
}

/* ============ JENIS LAYANAN ============ */
function JenisLayanan() {
  const services = [
    {
      icon: User,
      title: "Konseling Individu",
      label: "Layanan Personal",
      desc: "Layanan konseling yang dilakukan secara personal antara konselor dan mahasiswa atau staf untuk membahas permasalahan, kebutuhan, dan pengembangan diri secara lebih mendalam dan rahasia.",
      variant: "individu" as const,
    },
    {
      icon: Users,
      title: "Konseling Kelompok",
      label: "Layanan Bersama",
      desc: "Layanan konseling yang dilakukan bersama beberapa peserta dengan permasalahan serupa. Kegiatan ini mendorong saling berbagi pengalaman, dukungan sosial, dan pembelajaran bersama.",
      variant: "kelompok" as const,
    },
  ];

  return (
    <section className="mx-auto w-[92%] pb-20 pt-10 sm:w-[88%] md:pb-28 md:pt-20 lg:w-[86%]">
      <div className="mb-16 flex flex-col gap-3 md:mb-24">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#36c08f]">
          Layanan Kami
        </span>
        <h2 className="font-[Montserrat] text-[28px] font-bold leading-tight text-primary md:text-[36px]">
          Jenis Layanan Konseling
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-12 md:grid-cols-2 md:gap-28 lg:gap-36">
        {services.map((s) => {
          const Icon = s.icon;
          const isIndividu = s.variant === "individu";

          return (
            <article key={s.title} className="group relative">
              {/* Dekorasi SVG di belakang card (desktop), naik lebih jauh saat hover */}
              <div className="pointer-events-none absolute inset-0 hidden md:block">
                {isIndividu ? (
                  <svg
                    className="absolute -left-10 -top-14 h-40 w-40 text-[#DCE8DE] transition duration-500 ease-out group-hover:-translate-y-10"
                    viewBox="0 0 100 100"
                    fill="none"
                  >
                    <circle
                      cx="50"
                      cy="50"
                      r="38"
                      stroke="currentColor"
                      strokeWidth="14"
                    />
                  </svg>
                ) : (
                  <svg
                    className="absolute -top-16 left-6 h-44 w-72 text-[#DCE8DE] transition duration-500 ease-out group-hover:-translate-y-10"
                    viewBox="0 0 280 120"
                    fill="currentColor"
                  >
                    <circle cx="30" cy="40" r="26" />
                    <circle cx="140" cy="30" r="36" />
                    <circle cx="250" cy="40" r="26" />
                  </svg>
                )}
              </div>

              {/* Card */}
              <div className="relative z-10 flex min-h-[340px] flex-col overflow-hidden rounded-[32px] border border-[#DCE8DE] bg-gradient-to-br from-white via-[#F7F9F6] to-[#DCE8DE] p-8 shadow-[0_12px_32px_-12px_rgba(20,85,58,0.18)] transition duration-300 group-hover:shadow-[0_20px_40px_-12px_rgba(20,85,58,0.25)] md:p-10">
                <div className="flex items-start justify-between">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-md">
                    <Icon className="h-7 w-7 text-white" strokeWidth={2} />
                  </div>
                  <span className="rounded-full bg-[#F7F9F6] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#236c44] backdrop-blur">
                    {s.label}
                  </span>
                </div>

                <h3 className="mt-8 font-[Montserrat] text-[22px] font-semibold text-primary md:text-[24px]">
                  {s.title}
                </h3>

                <p className="mt-4 max-w-md text-[15px] leading-relaxed text-[#3b4a44]">
                  {s.desc}
                </p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
/* ========================= DATA ========================= */
const LOREM =
  "lorem ipsum dolor sit amet consectetur adipiscing elit blanditiis culpa aliqua ipsum culpa quos voluptatum dolor";
const LOREM_LONG =
  "lorem ipsum dolor sit amet consectetur adipiscing elit culpa qui occaecat molestias fugiat provident non cupiditate est dignissimos dolor iusto officia ut cumque ipsum laborum possimus sunt dolor id cillum reprehenderit adipiscing minim similique";

const audiences: { title: string; icon: ReactNode; desc: string }[] = [
  {
    title: "Mahasiswa Aktif",
    icon: <GraduationCap className="h-9 w-9" />,
    desc: LOREM,
  },
  {
    title: "Doesn Pengajar".replace("Doesn", "Dosen"),
    icon: <Presentation className="h-9 w-9" />,
    desc: LOREM,
  },
  {
    title: "Tenaga Pendidikan dan Tenaga Penunjang ",
    icon: <Briefcase className="h-9 w-9" />,
    desc: LOREM,
  },
];

const steps: Step[] = [
  {
    no: "01",
    title: "Pengunjung Masuk ke Portal",
    side: "right",
    numClass: "right-0 -top-10 md:-right-6",
  },
  {
    no: "02",
    title: "Log In dengan Akun Kampus",
    side: "left",
    numClass: "left-0 -top-4 md:-left-24",
  },
  {
    no: "03",
    title: "Booking Sesi Konseling",
    side: "right",
    numClass: "right-0 -bottom-14 md:-right-6",
  },
  {
    no: "04",
    title: "Pelaksanaan Konseling",
    side: "left",
    numClass: "left-0 -bottom-12 md:-left-28",
  },
  {
    no: "05",
    title: "Pemberian Feedback Anonim",
    side: "right",
    numClass: "right-0 -bottom-12 md:-right-6",
  },
];

const faqs = [
  {
    q: "Apakah dosen pembimbing atau dekanat akan tahu jika saya ikut konseling?",
    a: "lorem ipsum dolor sit amet consectetur adipiscing elit culpa qui occaecat molestias fugiat provident non cupiditate est dignissimos dolor iusto officia ut cumque ipsum laborum possimus sunt dolor id cillum reprehenderit adipiscing minim similique",
  },
  { q: "Berapa biaya yang harus saya bayar?", a: LOREM_LONG },
  {
    q: "Apakah saya bisa membatalkan atau mengubah jadwal konseling?",
    a: LOREM_LONG,
  },
];

/* ========================= KOMPONEN KECIL ========================= */
const StarShape = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
    <polygon
      points="50,2 61,36 97,36 68,57 79,92 50,71 21,92 32,57 3,36 39,36"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="6"
      strokeLinejoin="round"
    />
  </svg>
);

const SectionTitle = ({ children }: { children: ReactNode }) => (
  <h2 className="font-[Montserrat] text-2xl font-extrabold leading-tight text-primary md:text-[30px]">
    {children}
  </h2>
);

/* ========================= HALAMAN ========================= */
export default function PanduanPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="overflow-x-clip bg-white font-[Inter] text-slate-800">
      {/* ============ HERO ============ */}
      <section className="relative isolate overflow-hidden bg-[#E5F3E8] pb-20 pt-20 md:pb-24 md:pt-28">
        {/* dekorasi bintang */}
        <StarShape className="pointer-events-none absolute right-6 top-24 z-0 h-8 w-8 text-[#B8DCC3] md:right-10" />
        <StarShape className="pointer-events-none absolute -right-8 top-36 z-0 h-28 w-28 text-[#B8DCC3] md:top-44 md:h-36 md:w-36" />

        <div className="relative z-20 mx-auto w-[92%] sm:w-[88%] lg:w-[86%]">
          <h1 className="font-[Montserrat] text-2xl font-extrabold leading-tight text-primary sm:text-3xl lg:text-4xl">
            Panduan Lengkap Konseling
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-relaxed text-slate-800">
            Informasi lengkap mengenai siapa yang berhak mengakses layanan,
            ragam jenis konseling yang tersedia, serta alur reservasi jadwal
            melalui{" "}
            <span className="whitespace-nowrap  text-2xl font-bold">
              <span className="text-brand-accent">Si</span>
              <span className="font-semibold text-blue-900">CARE</span>
              <sup className="text-[10px] text-blue-900">®</sup>
            </span>
          </p>
        </div>

        {/* gelombang bawah */}
        <svg
          className="absolute bottom-[-1px] left-0 z-10 h-[70px] w-full md:h-[110px]"
          viewBox="0 0 1440 120"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            d="M0,60 C240,110 480,10 720,50 C960,90 1200,100 1440,40 L1440,120 L0,120 Z"
            fill="#ffffff"
          />
        </svg>
      </section>

      {/* ============ SIAPA SAJA ============ */}
      <section className="mx-auto w-full max-w-7xl px-6 py-16 lg:px-12 md:py-20">
        <SectionTitle>Siapa Saja yang Dapat Menggunakan Layanan?</SectionTitle>

        <div className="mt-16 grid grid-cols-1 justify-items-center gap-8 md:mt-24 md:grid-cols-3 md:gap-10">
          {audiences.map((a) => (
            <div
              key={a.title}
              className="flex aspect-[1.2/1] min-h-[280px] w-full max-w-[320px] flex-col items-center justify-center rounded-[48px] bg-gradient-to-br from-[#35c493] via-[#25694a] to-[#23663f] px-10 py-10 text-center text-white"
            >
              <div className="mb-4 flex h-14 items-center justify-center [&_svg]:h-12 [&_svg]:w-12">
                {a.icon}
              </div>
              <h3 className="text-[22px] font-medium leading-tight">
                {a.title}
              </h3>
              <p className="mt-6 text-[14px] leading-relaxed text-white/90">
                {a.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ============ JENIS LAYANAN ============ */}
      <JenisLayanan />

      <AlurSistem />

      {/* ============ FAQ ============ */}
      <section className="mx-auto w-[92%] pb-24 pt-32 sm:w-[88%] md:pt-40 lg:w-[86%]">
        <SectionTitle>Pertanyaan yang Sering Diajukan (FAQ)</SectionTitle>

        <div className="mx-auto mt-14 max-w-4xl space-y-6">
          {faqs.map((f, i) => {
            const open = openFaq === i;
            return (
              <div
                key={f.q}
                className="rounded-xl border border-slate-800 bg-white"
              >
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setOpenFaq(open ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                >
                  <span className="font-semibold text-slate-900">{f.q}</span>
                  {!open && <ChevronDown className="h-5 w-5 shrink-0" />}
                </button>

                <div
                  className={`grid transition-all duration-300 ${
                    open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                  }`}
                >
                  <div className="overflow-hidden">
                    <p className="px-6 pb-2 text-sm leading-relaxed text-slate-700">
                      {f.a}
                    </p>
                    <div className="flex justify-end px-6 pb-4">
                      <button
                        type="button"
                        aria-label="Tutup jawaban"
                        onClick={() => setOpenFaq(null)}
                      >
                        <ChevronUp className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
