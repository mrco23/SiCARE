import { useMemo, useState } from "react";
import { calculateMood, questions, type MoodResult } from "../../features/public/mood/moodAssessment";


function MascotResult({
  mood,
}: {
  mood: MoodResult;
}) {
  return (
    <section className="mt-8 flex flex-col items-center gap-6 rounded-2xl bg-[#f6fbf8] p-5 md:flex-row md:p-7">
      <div className="w-36 shrink-0 md:w-44">
        <img
          src="/maskot.png"
          alt="Maskot SiCARE"
          className="mascot-happy block h-auto w-full origin-[50%_90%]"
        />
      </div>

      <div className="flex-1 text-center md:text-left">
        <span
          className="inline-block rounded-full px-3 py-1 text-xs font-bold sm:text-sm"
          style={{ color: mood.color, backgroundColor: mood.bg }}
        >
          {mood.badge}
        </span>
        <h2 className="mt-3 font-[Montserrat] text-2xl font-extrabold text-primary md:text-3xl">
          {mood.title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-gray-600 sm:text-base">
          {mood.desc}
        </p>
        {mood.note && (
          <p className="mt-2 text-xs text-gray-500 sm:text-sm">{mood.note}</p>
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
      <div className="mx-auto w-[92%] pb-16 pt-20 sm:w-[88%] md:pt-28 lg:w-[86%]">
        <h1 className="font-[Montserrat] text-2xl font-extrabold leading-tight text-[#111] sm:text-3xl lg:text-4xl">
          Refleksi Mood & <span className="text-primary">Kepribadian</span>
        </h1>
        <p className="mt-2 text-sm text-[#333] sm:text-base">
          Lacak perasaan harian Anda untuk kesehatan mental Anda
        </p>

        {/* Progress sticky di bawah navbar */}
        <div className="sticky top-16 z-40 mt-6 bg-white py-3 md:top-20">
          <div className="mb-2 flex items-center justify-between text-xs text-gray-600 sm:text-sm">
            <span>
              <strong className="text-primary">{done}</strong> dari {total}{" "}
              pertanyaan terjawab
            </span>
            <span>{pct}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[#e8f5ee]">
            <div
              className="h-full bg-[#36c08f] transition-[width] duration-500 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Pertanyaan */}
        <div className="mt-5 flex flex-col gap-4">
          {questions.map((q, qi) => {
            const answered = answers[qi] !== null;
            return (
              <div
                key={qi}
                className={`rounded-2xl border-[1.5px] bg-white p-4 transition-all duration-200 sm:p-5 ${
                  answered
                    ? "border-[#9fdcc0] shadow-[0_6px_18px_rgba(46,154,95,0.08)]"
                    : "border-[#e2eee8]"
                }`}
              >
                <span className="inline-block rounded-full bg-[#e8f5ee] px-2.5 py-0.5 text-[11px] font-bold text-primary sm:text-xs">
                  Pertanyaan {qi + 1}
                </span>
                <p className="mb-4 mt-2 text-base font-bold leading-snug text-[#111] sm:text-lg">
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
                        className={`flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-xl border-[1.5px] px-2.5 py-3 text-center text-xs leading-snug transition-all duration-200 hover:-translate-y-0.5 hover:border-[#36c08f] hover:bg-primary-surface sm:text-sm ${
                          selected
                            ? "border-primary bg-[#e8f5ee] font-bold shadow-[0_4px_12px_rgba(20,85,58,0.12)]"
                            : "border-[#cfe4da] bg-white text-[#1b1b1b]"
                        }`}
                      >
                        <span className="text-2xl leading-none">
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
        <div className="mt-8 flex flex-col items-center gap-2.5">
          <p className="text-xs text-gray-500 sm:text-sm">
            {allDone
              ? "Semua pertanyaan sudah dijawab. Klik tombol di bawah untuk melihat hasilmu."
              : `Jawab ${total - done} pertanyaan lagi untuk melihat hasilmu`}
          </p>
          <button
            type="button"
            disabled={!allDone}
            onClick={() => setShowResult(true)}
            className="w-full rounded-xl bg-primary px-8 py-3 text-sm font-bold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-35 sm:w-auto sm:text-base"
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
                className="rounded-lg border-[1.5px] border-primary px-5 py-2.5 text-xs font-semibold text-primary transition hover:bg-[#e8f5ee] sm:text-sm"
              >
                Ulangi Test
              </button>
            </div>
          </>
        )}
      </div>

      {/* Animasi maskot: bergerak sendiri, tanpa transition */}
    </div>
  );
}
