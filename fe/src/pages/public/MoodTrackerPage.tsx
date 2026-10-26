import { useMemo, useState } from "react";

type Option = { emoji: string; label: string; score: -2 | -1 | 1 | 2 };
type Question = { axis: "energy" | "valence"; text: string; options: Option[] };

const questions: Question[] = [
  {
    axis: "energy",
    text: "Setelah bangun tidur, kamu biasanya merasa...",
    options: [
      { emoji: "😄", label: "Segar dan siap beraktivitas", score: 2 },
      { emoji: "🙂", label: "Cukup siap, tinggal jalan", score: 1 },
      { emoji: "😪", label: "Masih berat, butuh waktu bangkit", score: -1 },
      { emoji: "😴", label: "Sangat lelah, ingin tidur lagi", score: -2 },
    ],
  },
  {
    axis: "energy",
    text: "Saat punya waktu luang tiba-tiba, kamu ingin...",
    options: [
      { emoji: "🏃", label: "Olahraga atau kegiatan yang seru", score: 2 },
      { emoji: "🚶", label: "Jalan santai atau ketemu teman", score: 1 },
      { emoji: "📱", label: "Rebahan sambil nonton atau scroll HP", score: -1 },
      { emoji: "🛋️", label: "Diam saja, tidak ingin apa-apa", score: -2 },
    ],
  },
  {
    axis: "energy",
    text: "Saat mengerjakan tugas, kondisimu biasanya...",
    options: [
      { emoji: "🔥", label: "Fokus penuh dan cepat selesai", score: 2 },
      { emoji: "⏳", label: "Cukup fokus, pelan tapi jalan", score: 1 },
      { emoji: "🌀", label: "Sering teralihkan dan menunda", score: -1 },
      { emoji: "🫠", label: "Sulit fokus sama sekali", score: -2 },
    ],
  },
  {
    axis: "energy",
    text: "Jika diajak kegiatan baru malam ini, kamu...",
    options: [
      { emoji: "🙌", label: "Langsung mau, ayo berangkat", score: 2 },
      { emoji: "👍", label: "Mau, asalkan tidak terlalu lama", score: 1 },
      { emoji: "🙏", label: "Kayaknya lain kali saja", score: -1 },
      { emoji: "🙅", label: "Tidak mau, ingin sendirian", score: -2 },
    ],
  },
  {
    axis: "valence",
    text: "Saat mendengar kabar baik dari teman, reaksimu...",
    options: [
      {
        emoji: "🥳",
        label: "Ikut senang dan langsung memberi selamat",
        score: 2,
      },
      { emoji: "😊", label: "Tersenyum dan ikut senang sedikit", score: 1 },
      { emoji: "😐", label: "Biasa saja, tidak terlalu terasa", score: -1 },
      { emoji: "😒", label: "Sulit ikut senang, malah tidak enak", score: -2 },
    ],
  },
  {
    axis: "valence",
    text: "Saat rencana berubah mendadak, kamu biasanya...",
    options: [
      { emoji: "😎", label: "Santai dan menerimanya", score: 2 },
      { emoji: "😅", label: "Sedikit kesal, lalu lupa", score: 1 },
      { emoji: "😟", label: "Terus kepikiran sampai lama", score: -1 },
      { emoji: "😣", label: "Merasa tertekan dan ingin menyerah", score: -2 },
    ],
  },
  {
    axis: "valence",
    text: "Pilih kata yang paling menggambarkan perasaanmu sekarang:",
    options: [
      { emoji: "😁", label: "Bahagia", score: 2 },
      { emoji: "😌", label: "Biasa saja", score: 1 },
      { emoji: "😰", label: "Cemas", score: -1 },
      { emoji: "😢", label: "Sedih", score: -2 },
    ],
  },
  {
    axis: "valence",
    text: 'Kalau ada yang bertanya "Gimana kabarmu?", jawabanmu...',
    options: [
      { emoji: "🤩", label: "Baik banget!", score: 2 },
      { emoji: "👌", label: "Oke, lumayan", score: 1 },
      { emoji: "🥺", label: "Agak berat akhir-akhir ini", score: -1 },
      { emoji: "💔", label: "Lagi nggak baik-baik saja", score: -2 },
    ],
  },
];

const moodResults = {
  ceria: {
    title: "Ceria & Bersemangat",
    badge: "🌞 Energi tinggi, perasaan positif",
    desc: "Energimu sedang tinggi dan perasaanmu cerah. Nikmati harimu!",
    note: "",
    color: "#b45309",
    bg: "#fef3c7",
  },
  tenang: {
    title: "Tenang & Damai",
    badge: "🌿 Energi rendah, perasaan positif",
    desc: "Kamu sedang santai dan nyaman. Momen seperti ini layak dinikmati.",
    note: "",
    color: "#14553a",
    bg: "#e8f5ee",
  },
  tegang: {
    title: "Tegang & Gelisah",
    badge: "🌪️ Energi tinggi, perasaan tidak nyaman",
    desc: "Banyak yang sedang berputar di kepalamu. Coba tarik napas sebentar.",
    note: "Kalau perasaan ini sering muncul, ngobrol dengan konselor BK di SiCARE bisa jadi pilihan.",
    color: "#1d4ed8",
    bg: "#e0ecff",
  },
  lelah: {
    title: "Lelah & Sendu",
    badge: "🌧️ Energi rendah, perasaan tidak nyaman",
    desc: "Tenagamu sedang rendah. Istirahat dan jangan terlalu keras pada diri sendiri.",
    note: "Kalau rasa berat ini bertahan lama, jangan ragu menghubungi konselor BK di SiCARE.",
    color: "#475569",
    bg: "#eef2f7",
  },
  seimbang: {
    title: "Seimbang",
    badge: "⚖️ Energi dan perasaan stabil",
    desc: "Tidak terlalu tinggi, tidak terlalu rendah. Kamu sedang stabil.",
    note: "",
    color: "#0f766e",
    bg: "#ccfbf1",
  },
};

function calculateMood(answers: (number | null)[]) {
  let energy = 0;
  let valence = 0;

  questions.forEach((q, i) => {
    const idx = answers[i];
    if (idx === null) return;
    const score = q.options[idx].score;
    if (q.axis === "energy") energy += score;
    else valence += score;
  });

  if (Math.abs(energy) <= 2 && Math.abs(valence) <= 2)
    return moodResults.seimbang;
  if (energy >= 0 && valence >= 0) return moodResults.ceria;
  if (energy < 0 && valence >= 0) return moodResults.tenang;
  if (energy >= 0 && valence < 0) return moodResults.tegang;
  return moodResults.lelah;
}

function MascotResult({
  mood,
}: {
  mood: (typeof moodResults)[keyof typeof moodResults];
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
