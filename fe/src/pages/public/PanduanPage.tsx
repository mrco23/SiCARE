import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import {
  AlurSistem,
  JenisLayanan,
  SectionTitle,
  StarShape,
} from "../../components/public/guide/GuideSections";
import { audiences, faqs } from "../../data/mock/guideContent";

const audienceTags: Record<string, string> = {
  "Mahasiswa Aktif": "Mahasiswa",
  "Dosen Pengajar": "Tenaga Pengajar",
  "Tenaga Kependidikan & Staf Penunjang": "Staf Kampus",
};

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
      <section className="relative mx-auto w-full max-w-7xl px-6 pb-16 pt-20 lg:px-12 md:pb-20 md:pt-24">
        <div className="mx-auto mb-16 flex max-w-2xl flex-col items-center gap-3 text-center md:mb-20">
          <span className="inline-flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-brand-accent">
            <span className="h-0.5 w-7 rounded-full bg-brand-gold" />
            Siapa Saja
            <span className="h-0.5 w-7 rounded-full bg-brand-gold" />
          </span>
          <SectionTitle>
            Siapa Saja yang Dapat Menggunakan Layanan?
          </SectionTitle>
          <p className="mt-2 text-[15px] leading-relaxed text-slate-500">
            Layanan SiCARE terbuka bagi seluruh civitas akademika Unika De La
            Salle Manado sesuai kebutuhan masing-masing.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-7 md:grid-cols-3 md:gap-7">
          {audiences.map((a, i) => (
            <article
              key={a.title}
              className="group relative flex flex-col overflow-hidden rounded-[28px] border border-primary-soft bg-white shadow-[0_10px_30px_-18px_rgba(6,78,59,0.28)] transition duration-500 ease-out hover:-translate-y-2 hover:border-[#C4E2CE] hover:shadow-[0_26px_44px_-20px_rgba(6,78,59,0.35)]"
            >
              {/* area visual */}
              <div className="relative flex h-[170px] items-center justify-center overflow-hidden bg-gradient-to-br from-[#E5F3E8] to-[#DCE8DE]">
                <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-brand-gold/15 blur-2xl" />
                <span className="absolute left-5 top-3 select-none font-[Montserrat] text-[64px] font-extrabold leading-none text-primary/10">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="relative z-10 flex h-[84px] w-[84px] items-center justify-center rounded-[26px] bg-primary shadow-[0_14px_28px_-10px_rgba(6,78,59,0.55)] transition duration-500 group-hover:-rotate-6 group-hover:scale-105 [&_svg]:h-[38px] [&_svg]:w-[38px] [&_svg]:text-white">
                  {a.icon}
                </div>
              </div>

              {/* konten */}
              <div className="flex flex-1 flex-col px-7 pb-2 pt-7">
                <span className="w-fit rounded-full border border-[#DCE8DE] bg-primary-surface px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#236c44]">
                  {audienceTags[a.title] ?? "Pengguna"}
                </span>
                <h3 className="mt-4 font-[Montserrat] text-xl font-bold leading-snug text-primary">
                  {a.title}
                </h3>
                <span className="mb-4 mt-3.5 h-[3px] w-9 rounded-full bg-brand-gold transition-all duration-500 group-hover:w-16" />
                <p className="text-[14.5px] leading-[1.75] text-[#3b4a44]">
                  {a.desc}
                </p>
              </div>
            </article>
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
