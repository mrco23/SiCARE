import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Clock3, ShieldCheck, Sparkles } from "lucide-react";
import { moodResults } from "../../features/public/mood/moodAssessment";
import AnimatedMascot from "../../components/mood/AnimatedMascot";
import { MoodResultIcon } from "../../components/mood/MoodIcons";

/** Halaman pembuka Mood Tracker. Pertanyaan dan hasil ada di halaman /mood-tracker/cek. */
export default function MoodTrackerPage() {
  const navigate = useNavigate();
  const [ctaActive, setCtaActive] = useState(false);

  return (
    <div className="overflow-x-clip bg-white">
      <div className="mx-auto w-[92%] pb-20 pt-16 sm:w-[88%] md:pt-24 lg:w-[86%]">
        <section
          aria-labelledby="mood-intro-title"
          className="grid items-center gap-6 overflow-hidden rounded-3xl border border-[#e2eee8] bg-primary-tint p-6 sm:p-8 md:grid-cols-[1.3fr_1fr] md:gap-10 lg:p-10"
        >
          <div className="flex flex-col gap-4">
            <span className="inline-flex w-fit items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-brand-accent">
              <span className="h-0.5 w-5 rounded-full bg-brand-gold" />
              SiCARE Mood Check
            </span>
            <h1
              id="mood-intro-title"
              className="font-[Montserrat] text-2xl font-extrabold leading-tight text-[#111] sm:text-3xl lg:text-4xl"
            >
              Refleksi Mood & <span className="text-primary">Kepribadian</span>
            </h1>
            <p className="text-sm leading-relaxed text-[#3b4a44] sm:text-base">
              Mood Tracker membantu kamu mengenali suasana hatimu saat ini. Jawab 8 pertanyaan
              singkat tentang energi dan perasaanmu, lalu SiCARE memperkirakan mood kamu sekarang
              ke salah satu dari lima mood berikut:
            </p>

            <ul className="flex flex-wrap gap-2" aria-label="Mood yang dapat terdeteksi">
              {Object.values(moodResults).map((item) => (
                <li
                  key={item.id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/80 px-3 py-1.5 text-xs font-bold shadow-sm sm:text-sm"
                  style={{ color: item.color, backgroundColor: item.bg }}
                >
                  <MoodResultIcon id={item.id} className="shrink-0" />
                  {item.title}
                </li>
              ))}
            </ul>

            <ul className="grid gap-2 text-xs text-[#3b4a44] sm:grid-cols-3 sm:text-sm">
              <li className="flex items-center gap-2">
                <Clock3 className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                Sekitar 1–2 menit
              </li>
              <li className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                Tanpa login, tidak disimpan
              </li>
              <li className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                Untuk refleksi, bukan diagnosis
              </li>
            </ul>

            <div>
              <button
                type="button"
                onClick={() => navigate("/mood-tracker/cek")}
                onMouseEnter={() => setCtaActive(true)}
                onMouseLeave={() => setCtaActive(false)}
                onFocus={() => setCtaActive(true)}
                onBlur={() => setCtaActive(false)}
                className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-bold text-white shadow-[0_12px_24px_-12px_rgba(6,78,59,0.7)] transition hover:-translate-y-0.5 hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/25 sm:w-auto sm:text-base"
              >
                Ayo cek mood kamu sekarang
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="relative order-first mx-auto w-44 sm:w-52 md:order-last md:w-full md:max-w-[280px]">
            <div className="absolute left-1/2 top-0 z-10 w-max max-w-[220px] -translate-x-1/2 rounded-2xl border border-[#e2eee8] bg-white px-3.5 py-2 text-center text-xs font-bold text-primary shadow-md sm:text-sm md:-left-6 md:-top-1 md:-translate-y-full md:translate-x-0">
              {ctaActive ? "Yuk, mulai sekarang!" : "Hai! Gimana mood kamu hari ini?"}
              <span className="absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-b border-r border-[#e2eee8] bg-white" />
            </div>
            <AnimatedMascot excited={ctaActive} className="mt-16 md:mt-10" />
          </div>
        </section>
      </div>
    </div>
  );
}
