import { useMemo, useState } from "react";
import {
  calculateMood,
  questions,
  type MoodResult,
} from "../../features/public/mood/moodAssessment";

function MascotResult({ mood }: { mood: MoodResult }) {
  return (
    <section
      className="mt-7 flex flex-col items-center gap-6 overflow-hidden rounded-3xl border border-[#e2eee8] p-6 shadow-[0_12px_30px_-18px_rgba(6,78,59,0.3)] md:flex-row md:gap-8 md:p-9"
      style={{
        background: `linear-gradient(160deg, ${mood.bg} 0%, #ffffff 75%)`,
      }}
    >
      <div className="relative w-36 shrink-0 md:w-44">
        <img
          src="/maskot.png"
          alt="Maskot SiCARE"
          className="mascot-happy block h-auto w-full origin-[50%_90%]"
        />
        <div className="mx-auto -mt-1.5 h-2.5 w-[70%] rounded-full bg-primary/10 blur-[2px]" />
      </div>

      <div className="flex-1 text-center md:text-left">
        <span
          className="inline-block rounded-full px-3 py-1 text-xs font-bold shadow-sm sm:text-sm"
          style={{ color: mood.color, backgroundColor: "#ffffff" }}
        >
          {mood.badge}
        </span>
        <h2 className="mt-3 font-[Montserrat] text-2xl font-extrabold leading-tight text-[#111] md:text-3xl">
          {mood.title}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-[#3b4a44] sm:text-base">
          {mood.desc}
        </p>
        {mood.note && (
          <p className="mt-3 rounded-xl bg-white/70 px-4 py-3 text-xs leading-relaxed text-gray-600 sm:text-sm">
            {mood.note}
          </p>
        )}
      </div>
    </section>
  );
}

export default function MoodTrackerPage() {
  const [answers, setAnswers] = useState<(number | null)[]>(() =>
    new Array(questions.length).fill(null),
  );
  const [showResult, setShowResult] = useState(false);

  const total = questions.length;
  const done = answers.filter((a) => a !== null).length;
  const pct = Math.round((done / total) * 100);
  const allDone = done === total;

  const mood = useMemo(
    () => (showResult ? calculateMood(answers) : null),
    [showResult, answers],
  );

  const selectAnswer = (qi: number, oi: number) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[qi] = oi;
      return next;
    });
    // Ubah jawaban setelah hasil tampil: sembunyikan hasil lama
    setShowResult(false);
  };

  const restart = () => {
    setAnswers(new Array(total).fill(null));
    setShowResult(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="overflow-x-clip bg-white">
      <div className="mx-auto w-[92%] pb-20 pt-16 sm:w-[88%] md:pt-24 lg:w-[86%]">
        {/* Header */}
        <div className="flex flex-col gap-3">
          <span className="inline-flex w-fit items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-brand-accent">
            <span className="h-0.5 w-5 rounded-full bg-brand-gold" />
            SiCARE Mood Check
          </span>
          <h1 className="font-[Montserrat] text-2xl font-extrabold leading-tight text-[#111] sm:text-3xl lg:text-4xl">
            Refleksi Mood & <span className="text-primary">Kepribadian</span>
          </h1>
          <p className="text-sm text-[#3b4a44] sm:text-base">
            Lacak perasaan harian Anda untuk kesehatan mental Anda
          </p>
        </div>

        {/* Progress sticky di bawah navbar */}
        <div className="sticky top-16 z-40 mt-6 rounded-2xl border border-[#e2eee8] bg-white/95 px-4 py-3.5 shadow-[0_6px_18px_-12px_rgba(6,78,59,0.25)] backdrop-blur md:top-20">
          <div className="flex items-center justify-between text-xs text-gray-600 sm:text-sm">
            <span>
              <strong className="font-bold text-primary">{done}</strong> dari{" "}
              {total} pertanyaan terjawab
            </span>
            <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-[11px] font-bold text-primary sm:text-xs">
              {pct}%
            </span>
          </div>
          <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-primary-soft">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#36c08f] to-[#2a8f5a] transition-[width] duration-500 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-2.5 flex gap-1.5">
            {questions.map((_, i) => (
              <span
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                  answers[i] !== null ? "bg-[#36c08f]" : "bg-[#e2eee8]"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Pertanyaan */}
        <div className="mt-5 flex flex-col gap-4">
          {questions.map((q, qi) => {
            const answered = answers[qi] !== null;
            return (
              <div
                key={qi}
                className={`relative overflow-hidden rounded-2xl border-[1.5px] bg-white py-4 pl-6 pr-4 transition-all duration-200 sm:py-5 sm:pl-7 sm:pr-5 ${
                  answered
                    ? "border-[#bfe6d3] shadow-[0_8px_20px_-14px_rgba(6,78,59,0.35)]"
                    : "border-[#e2eee8]"
                }`}
              >
                {/* garis aksen kiri */}
                <span
                  className={`absolute bottom-0 left-0 top-0 w-1 transition-colors duration-200 ${
                    answered ? "bg-[#36c08f]" : "bg-[#e2eee8]"
                  }`}
                />

                <div className="flex items-center justify-between gap-3">
                  <span className="inline-block rounded-full bg-primary-soft px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-primary sm:text-xs">
                    Pertanyaan {qi + 1}
                  </span>
                  {answered && (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#36c08f]">
                      <svg
                        viewBox="0 0 24 24"
                        className="h-3 w-3 fill-none stroke-white stroke-[3] [stroke-linecap:round] [stroke-linejoin:round]"
                        aria-hidden="true"
                      >
                        <path d="M5 12l5 5 9-10" />
                      </svg>
                    </span>
                  )}
                </div>

                <p className="mb-4 mt-3 text-base font-bold leading-snug text-[#111] sm:text-lg">
                  {q.text}
                </p>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                  {q.options.map((opt, oi) => {
                    const selected = answers[qi] === oi;
                    return (
                      <button
                        key={oi}
                        type="button"
                        onClick={() => selectAnswer(qi, oi)}
                        className={`group relative flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border-[1.5px] px-2.5 py-3 text-center text-xs leading-snug transition-all duration-200 hover:-translate-y-0.5 hover:border-[#36c08f] hover:bg-primary-surface sm:text-sm ${
                          selected
                            ? "border-primary bg-primary font-bold text-white shadow-[0_10px_20px_-12px_rgba(6,78,59,0.6)] hover:bg-primary"
                            : "border-[#cfe4da] bg-white text-[#1b1b1b]"
                        }`}
                      >
                        <span
                          className={`flex h-11 w-11 items-center justify-center rounded-full text-2xl leading-none transition-transform duration-200 group-hover:scale-110 ${
                            selected ? "bg-white/15" : "bg-primary-soft"
                          }`}
                        >
                          {opt.emoji}
                        </span>
                        <span>{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Tombol cek */}
        <div className="mt-8 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[#cfe4da] bg-primary-tint p-5 text-center">
          <p className="text-xs text-gray-500 sm:text-sm">
            {allDone
              ? "Semua pertanyaan sudah dijawab. Klik tombol di bawah untuk melihat hasilmu."
              : `Jawab ${total - done} pertanyaan lagi untuk melihat hasilmu`}
          </p>
          <button
            type="button"
            disabled={!allDone}
            onClick={() => setShowResult(true)}
            className="w-full max-w-xs rounded-xl bg-primary px-8 py-3 text-sm font-bold text-white shadow-[0_12px_22px_-12px_rgba(6,78,59,0.6)] transition hover:-translate-y-px hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-35 disabled:shadow-none sm:text-base"
          >
            Cek Mood Saya
          </button>
        </div>

        {/* Hasil */}
        {showResult && mood && (
          <>
            <MascotResult mood={mood} />
            <div className="mt-5 flex justify-center">
              <button
                type="button"
                onClick={restart}
                className="rounded-xl border-[1.5px] border-primary px-5 py-2.5 text-xs font-semibold text-primary transition hover:bg-primary-soft sm:text-sm"
              >
                Ulangi Test
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
