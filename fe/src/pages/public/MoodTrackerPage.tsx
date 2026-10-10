import { useMemo, useState } from "react";
import Navbar from "../../components/home/Navbar";

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
    <section className="mt-12 flex flex-col items-center gap-10 rounded-3xl bg-[#f6fbf8] p-7 md:flex-row md:p-10">
      <div className="w-48 shrink-0 md:w-56">
        <img
          src="/maskot.png"
          alt="Maskot SiCARE"
          className="mascot-happy block h-auto w-full origin-[50%_90%]"
        />
      </div>

      <div className="flex-1 text-center md:text-left">
        <span
          className="inline-block rounded-full px-4 py-1.5 text-sm font-bold"
          style={{ color: mood.color, backgroundColor: mood.bg }}
        >
          {mood.badge}
        </span>
        <h2 className="mt-4 font-[Montserrat] text-3xl font-extrabold text-[#1e5b3a] md:text-4xl">
          {mood.title}
        </h2>
        <p className="mt-3 text-base leading-relaxed text-gray-600">
          {mood.desc}
        </p>
        {mood.note && <p className="mt-3 text-sm text-gray-500">{mood.note}</p>}
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
      {/* Navbar */}
      <div className="sticky top-0 z-50">
        <Navbar />
      </div>

      <main className="mx-auto w-[92%] pb-20 pt-8 sm:w-[88%] lg:w-[86%]">
        <h1 className="font-[Montserrat] text-4xl font-extrabold leading-tight text-[#111] md:text-[44px]">
          Refleksi Mood & <span className="text-[#1e5b3a]">Kepribadian</span>
        </h1>
        <p className="mt-3 text-lg text-[#333]">
          Lacak perasaan harian Anda untuk kesehatan mental Anda
        </p>

        {/* Progress sticky di bawah navbar */}
        <div className="sticky top-16 z-40 mt-8 bg-white py-4 md:top-20">
          <div className="mb-2 flex items-center justify-between text-sm text-gray-600">
            <span>
              <strong className="text-[#1e5b3a]">{done}</strong> dari {total}{" "}
              pertanyaan terjawab
            </span>
            <span>{pct}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[#e8f5ee]">
            <div
              className="h-full bg-[#36c08f] transition-[width] duration-500 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Pertanyaan */}
        <div className="mt-6 flex flex-col gap-6">
          {questions.map((q, qi) => {
            const answered = answers[qi] !== null;
            return (
              <div
                key={qi}
                className={`rounded-[20px] border-[1.5px] bg-white p-6 transition-all duration-200 sm:p-7 ${
                  answered
                    ? "border-[#9fdcc0] shadow-[0_8px_24px_rgba(46,154,95,0.08)]"
                    : "border-[#e2eee8]"
                }`}
              >
                <span className="inline-block rounded-full bg-[#e8f5ee] px-3 py-1 text-xs font-bold text-[#1e5b3a]">
                  Pertanyaan {qi + 1}
                </span>
                <p className="mb-5 mt-3 text-xl font-bold leading-snug text-[#111] sm:text-[22px]">
                  {q.text}
                </p>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {q.options.map((opt, oi) => {
                    const selected = answers[qi] === oi;
                    return (
                      <button
                        key={oi}
                        type="button"
                        onClick={() => selectAnswer(qi, oi)}
                        className={`flex min-h-28 flex-col items-center justify-center gap-2 rounded-2xl border-[1.5px] px-3 py-4 text-center text-sm leading-snug transition-all duration-200 hover:-translate-y-0.5 hover:border-[#36c08f] hover:bg-[#f3fdf7] ${
                          selected
                            ? "border-[#14553a] bg-[#e8f5ee] font-bold shadow-[0_6px_16px_rgba(20,85,58,0.12)]"
                            : "border-[#cfe4da] bg-white text-[#1b1b1b]"
                        }`}
                      >
                        <span className="text-3xl leading-none">
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
        <div className="mt-10 flex flex-col items-center gap-3">
          <p className="text-sm text-gray-500">
            {allDone
              ? "Semua pertanyaan sudah dijawab. Klik tombol di bawah untuk melihat hasilmu."
              : `Jawab ${total - done} pertanyaan lagi untuk melihat hasilmu`}
          </p>
          <button
            type="button"
            disabled={!allDone}
            onClick={() => setShowResult(true)}
            className="w-full rounded-2xl bg-[#1e5b3a] px-10 py-4 text-base font-bold text-white transition hover:bg-[#174a2f] disabled:cursor-not-allowed disabled:opacity-35 sm:w-auto"
          >
            Cek Mood Saya
          </button>
        </div>

        {/* Hasil */}
        {showResult && mood && (
          <>
            <MascotResult mood={mood} />
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={restart}
                className="rounded-xl border-[1.5px] border-[#1e5b3a] px-6 py-3 text-sm font-semibold text-[#1e5b3a] transition hover:bg-[#e8f5ee]"
              >
                Ulangi Test
              </button>
            </div>
          </>
        )}
      </main>

      {/* Animasi maskot: bergerak sendiri, tanpa transition */}
      <style>{`
        .mascot-happy {
          animation: mascot-happy 1.6s ease-in-out infinite;
        }
        @keyframes mascot-happy {
          0%   { transform: translateY(0) rotate(0deg) scale(1); }
          15%  { transform: translateY(-14px) rotate(-4deg) scale(1.03); }
          30%  { transform: translateY(0) rotate(3deg) scale(1); }
          45%  { transform: translateY(-10px) rotate(-3deg) scale(1.02); }
          60%  { transform: translateY(0) rotate(0deg) scale(1); }
          100% { transform: translateY(0) rotate(0deg) scale(1); }
        }
      `}</style>
    </div>
  );
}
