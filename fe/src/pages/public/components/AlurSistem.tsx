import { useEffect, useRef, useState, type ReactNode } from "react";

type Step = {
  no: string;
  title: string;
  side: "right" | "left";
  numClass: string;
  desc?: string;
};

const LOREM_LONG =
  "lorem ipsum dolor sit amet consectetur adipiscing elit culpa qui occaecat molestias fugiat provident non cupiditate est dignissimos dolor iusto officia ut cumque ipsum laborum possimus sunt dolor id cillum reprehenderit adipiscing minim similique";

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

const SectionTitle = ({ children }: { children: ReactNode }) => (
  <h2 className="font-[Montserrat] text-2xl font-extrabold leading-tight text-[#14553a] md:text-[30px]">
    {children}
  </h2>
);

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
          className={`relative block h-5 w-5 rounded-full border-[3px] border-black motion-safe:transition-colors motion-safe:duration-500 ${
            inView ? "bg-[#14553a]" : "bg-[#d9fbe8]"
          }`}
        >
          {/* konektor horizontal (desktop) */}
          <span
            className={`absolute top-1/2 hidden h-[3px] w-10 origin-left -translate-y-1/2 bg-black motion-safe:transition-transform motion-safe:duration-700 md:block ${
              isRight ? "left-full" : "right-full"
            } ${inView ? "scale-x-100" : "scale-x-0"}`}
          />
        </span>
      </div>

      {/* ghost number */}
      <span
        className={`pointer-events-none absolute select-none text-[110px] font-bold leading-none text-[#a6f4d2] md:text-[150px] ${s.numClass}`}
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
          className={`max-w-[420px] rounded-2xl border border-[#bdeed7] bg-white/80 p-6 shadow-sm backdrop-blur-sm md:p-7 ${
            isRight ? "" : "md:ml-auto"
          }`}
        >
          <h3 className="font-[Montserrat] text-lg font-semibold text-[#14553a] md:text-xl">
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
export default function AlurSistem() {
  const [listRef, listInView] = useInView<HTMLDivElement>(0.15);

  return (
    <>
      <section className="relative mt-16 bg-[#d9fbe8] pb-28 pt-20 md:mt-24 md:pb-32">
        {/* gelombang atas */}
        <svg
          className="absolute -top-[59px] left-0 h-[60px] w-full"
          viewBox="0 0 1440 60"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            d="M0,60 L0,30 C200,0 400,50 720,25 C1040,0 1240,45 1440,20 L1440,60 Z"
            fill="#d9fbe8"
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
            fill="#d9fbe8"
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
            stroke="#a9d9c2"
            strokeWidth="3"
            strokeDasharray="18 22"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M1420,640 C1250,680 1150,760 1000,860 C850,960 600,990 300,960 C200,950 120,900 60,860"
            fill="none"
            stroke="#a9d9c2"
            strokeWidth="3"
            strokeDasharray="18 22"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        <div className="relative mx-auto w-full max-w-7xl px-6 lg:px-12">
          <SectionTitle>
            Alur Sistem dari Pengunjung hingga Selesai
          </SectionTitle>

          <div className="relative mt-24" ref={listRef}>
            {/* garis tengah: tergambar dari atas ke bawah */}
            <div
              className={`absolute bottom-0 top-0 left-4 w-[3px] origin-top -translate-x-1/2 bg-black motion-safe:transition-transform motion-safe:duration-1000 md:left-1/2 ${
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
