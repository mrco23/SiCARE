import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { AlurSistem, JenisLayanan, SectionTitle, StarShape } from "../../components/public/guide/GuideSections";
import { audiences, faqs } from "../../data/mock/guideContent";

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
