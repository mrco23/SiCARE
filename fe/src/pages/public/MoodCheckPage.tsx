import Badge from "../../components/shared/Badge";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, RotateCcw } from "lucide-react";
import AuthBackground from "../../components/auth/AuthBackground";
import AnimatedMascot from "../../components/mood/AnimatedMascot";
import { MoodAnswerIcon, MoodResultIcon } from "../../components/mood/MoodIcons";
import {
  calculateMood,
  questions,
  type MoodResult,
} from "../../features/public/mood/moodAssessment";

/** Kartu hasil di bagian atas formulir, dengan ekspresi maskot sesuai mood. */
function MoodResultCard({ mood, onRestart }: { mood: MoodResult; onRestart: () => void }) {
  return (
    <section
      aria-live="polite"
      aria-labelledby="mood-result-title"
      className="mt-6 overflow-hidden rounded-3xl border border-[#e2eee8] shadow-[0_18px_40px_-24px_rgba(6,78,59,0.45)]"
      style={{ background: `linear-gradient(160deg, ${mood.bg} 0%, #ffffff 78%)` }}
    >
      <div className="flex flex-col items-center gap-6 p-6 md:flex-row md:gap-8 md:p-9">
        <div className="w-40 shrink-0 sm:w-48 md:w-56" role="img" aria-label={`Maskot SiCARE dengan ekspresi ${mood.title}`}>
          <AnimatedMascot pose={mood.id} />
        </div>

        <div className="flex-1 text-center md:text-left">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold shadow-sm sm:text-sm"
            style={{ color: mood.color, backgroundColor: "#ffffff" }}
          >
            <MoodResultIcon id={mood.id} className="shrink-0" />
            {mood.badge}
          </span>
          <p className="mt-3 text-xs font-bold uppercase tracking-[0.16em] text-gray-500">Mood kamu saat ini</p>
          <h2
            id="mood-result-title"
            className="mt-1 font-[Montserrat] text-2xl font-extrabold leading-tight text-[#111] md:text-3xl"
          >
            {mood.title}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[#3b4a44] sm:text-base">{mood.desc}</p>
          {mood.note && (
            <p className="mt-3 rounded-xl bg-white/70 px-4 py-3 text-xs leading-relaxed text-gray-600 sm:text-sm">
              {mood.note}
            </p>
          )}
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center md:justify-start">
            <button
              type="button"
              onClick={onRestart}
              className="inline-flex items-center justify-center gap-2 rounded-xl border-[1.5px] border-primary bg-white px-5 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary-soft"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Ulangi tes
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function MoodCheckPage() {
  const [answers, setAnswers] = useState<(number | null)[]>(() => new Array(questions.length).fill(null));
  const [showResult, setShowResult] = useState(false);

  const total = questions.length;
  const done = answers.filter((a) => a !== null).length;
  const pct = Math.round((done / total) * 100);
  const allDone = done === total;

  const mood = useMemo(() => (showResult ? calculateMood(answers) : null), [showResult, answers]);

  const selectAnswer = (qi: number, oi: number) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[qi] = oi;
      return next;
    });
    // Mengubah jawaban setelah hasil tampil menyembunyikan hasil lama.
    setShowResult(false);
  };

  const checkMood = () => {
    if (!allDone) return;
    setShowResult(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const restart = () => {
    setAnswers(new Array(total).fill(null));
    setShowResult(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="relative min-h-dvh overflow-hidden bg-bg">
      <AuthBackground />

      <div className="relative z-10 mx-auto w-[92%] max-w-5xl pb-20 pt-24 md:pt-28">
        {/* Kepala halaman */}
        <div className="flex flex-col gap-3">
          <Link
            to="/mood-tracker"
            className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Kembali
          </Link>
          <span className="inline-flex w-fit items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-brand-accent">
            <span className="h-0.5 w-5 rounded-full bg-brand-gold" />
            SiCARE Mood Check
          </span>
          <h1 className="font-[Montserrat] text-2xl font-extrabold leading-tight text-[#111] sm:text-3xl">
            Cek <span className="text-primary">mood kamu</span> sekarang
          </h1>
          <p className="text-sm text-[#3b4a44] sm:text-base">
            Pilih jawaban yang paling sesuai dengan kondisimu saat ini. Tidak ada jawaban benar atau salah.
          </p>
        </div>

        {/* Hasil di atas formulir */}
        {showResult && mood && <MoodResultCard mood={mood} onRestart={restart} />}

        {/* Progress sticky di bawah navbar */}
        <div className="sticky top-16 z-40 mt-6 rounded-2xl border border-[#e2eee8] bg-white/95 px-4 py-3.5 shadow-[0_6px_18px_-12px_rgba(6,78,59,0.25)] backdrop-blur md:top-20">
          <div className="flex items-center justify-between text-xs text-gray-600 sm:text-sm">
            <span>
              <strong className="font-bold text-primary">{done}</strong> dari {total} pertanyaan terjawab
            </span>
            <Badge className="bg-primary-soft text-primary sm:text-xs">
              {pct}%
            </Badge>
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
                  answered ? "border-[#bfe6d3] shadow-[0_8px_20px_-14px_rgba(6,78,59,0.35)]" : "border-[#e2eee8]"
                }`}
              >
                <span
                  className={`absolute bottom-0 left-0 top-0 w-1 transition-colors duration-200 ${
                    answered ? "bg-[#36c08f]" : "bg-[#e2eee8]"
                  }`}
                />

                <div className="flex items-center justify-between gap-3">
                  <Badge className="bg-primary-soft uppercase tracking-wide text-primary sm:text-xs">
                    Pertanyaan {qi + 1}
                  </Badge>
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

                <p className="mb-4 mt-3 text-base font-bold leading-snug text-[#111] sm:text-lg">{q.text}</p>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                  {q.options.map((opt, oi) => {
                    const selected = answers[qi] === oi;
                    return (
                      <button
                        key={oi}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => selectAnswer(qi, oi)}
                        className={`group relative flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border-[1.5px] px-2.5 py-3 text-center text-xs leading-snug transition-all duration-200 hover:-translate-y-0.5 hover:border-[#36c08f] hover:bg-primary-surface sm:text-sm ${
                          selected
                            ? "border-primary bg-primary font-bold text-white shadow-[0_10px_20px_-12px_rgba(6,78,59,0.6)] hover:bg-primary"
                            : "border-[#cfe4da] bg-white text-[#1b1b1b]"
                        }`}
                      >
                        <span
                          className={`flex h-14 w-14 items-center justify-center rounded-full transition-transform duration-200 group-hover:scale-110 ${
                            selected ? "bg-white" : "bg-primary-soft"
                          }`}
                        >
                          <MoodAnswerIcon id={opt.icon} size={48} />
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
        <div className="mt-8 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[#cfe4da] bg-white/80 p-5 text-center backdrop-blur">
          <p className="text-xs text-gray-500 sm:text-sm">
            {allDone
              ? "Semua pertanyaan sudah dijawab. Klik tombol di bawah untuk melihat hasilmu."
              : `Jawab ${total - done} pertanyaan lagi untuk melihat hasilmu`}
          </p>
          <button
            type="button"
            disabled={!allDone}
            onClick={checkMood}
            className="w-full max-w-xs rounded-xl bg-primary px-8 py-3 text-sm font-bold text-white shadow-[0_12px_22px_-12px_rgba(6,78,59,0.6)] transition hover:-translate-y-px hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-35 disabled:shadow-none sm:text-base"
          >
            Cek Mood Saya
          </button>
        </div>
      </div>
    </div>
  );
}
