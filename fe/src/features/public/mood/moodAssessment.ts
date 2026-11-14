import type { MoodAnswerIconId, MoodResultIconId } from "../../../components/mood/MoodIcons";

export type Option = { icon: MoodAnswerIconId; label: string; score: -2 | -1 | 1 | 2 };
export type Question = { axis: "energy" | "valence"; text: string; options: Option[] };

export const questions: Question[] = [
  {
    axis: "energy",
    text: "Setelah bangun tidur, kamu biasanya merasa...",
    options: [
      { icon: "wake-fresh", label: "Segar dan siap beraktivitas", score: 2 },
      { icon: "wake-ready", label: "Cukup siap, tinggal jalan", score: 1 },
      { icon: "wake-heavy", label: "Masih berat, butuh waktu bangkit", score: -1 },
      { icon: "wake-exhausted", label: "Sangat lelah, ingin tidur lagi", score: -2 },
    ],
  },
  {
    axis: "energy",
    text: "Saat punya waktu luang tiba-tiba, kamu ingin...",
    options: [
      { icon: "free-sport", label: "Olahraga atau kegiatan yang seru", score: 2 },
      { icon: "free-walk", label: "Jalan santai atau ketemu teman", score: 1 },
      { icon: "free-scroll", label: "Rebahan sambil nonton atau scroll HP", score: -1 },
      { icon: "free-idle", label: "Diam saja, tidak ingin apa-apa", score: -2 },
    ],
  },
  {
    axis: "energy",
    text: "Saat mengerjakan tugas, kondisimu biasanya...",
    options: [
      { icon: "task-focus", label: "Fokus penuh dan cepat selesai", score: 2 },
      { icon: "task-steady", label: "Cukup fokus, pelan tapi jalan", score: 1 },
      { icon: "task-distracted", label: "Sering teralihkan dan menunda", score: -1 },
      { icon: "task-stuck", label: "Sulit fokus sama sekali", score: -2 },
    ],
  },
  {
    axis: "energy",
    text: "Jika diajak kegiatan baru malam ini, kamu...",
    options: [
      { icon: "invite-yes", label: "Langsung mau, ayo berangkat", score: 2 },
      { icon: "invite-short", label: "Mau, asalkan tidak terlalu lama", score: 1 },
      { icon: "invite-later", label: "Kayaknya lain kali saja", score: -1 },
      { icon: "invite-no", label: "Tidak mau, ingin sendirian", score: -2 },
    ],
  },
  {
    axis: "valence",
    text: "Saat mendengar kabar baik dari teman, reaksimu...",
    options: [
      {
        icon: "news-cheer",
        label: "Ikut senang dan langsung memberi selamat",
        score: 2,
      },
      { icon: "news-smile", label: "Tersenyum dan ikut senang sedikit", score: 1 },
      { icon: "news-flat", label: "Biasa saja, tidak terlalu terasa", score: -1 },
      { icon: "news-uneasy", label: "Sulit ikut senang, malah tidak enak", score: -2 },
    ],
  },
  {
    axis: "valence",
    text: "Saat rencana berubah mendadak, kamu biasanya...",
    options: [
      { icon: "change-chill", label: "Santai dan menerimanya", score: 2 },
      { icon: "change-ok", label: "Sedikit kesal, lalu lupa", score: 1 },
      { icon: "change-worry", label: "Terus kepikiran sampai lama", score: -1 },
      { icon: "change-pressure", label: "Merasa tertekan dan ingin menyerah", score: -2 },
    ],
  },
  {
    axis: "valence",
    text: "Pilih kata yang paling menggambarkan perasaanmu sekarang:",
    options: [
      { icon: "feel-happy", label: "Bahagia", score: 2 },
      { icon: "feel-okay", label: "Biasa saja", score: 1 },
      { icon: "feel-anxious", label: "Cemas", score: -1 },
      { icon: "feel-sad", label: "Sedih", score: -2 },
    ],
  },
  {
    axis: "valence",
    text: 'Kalau ada yang bertanya "Gimana kabarmu?", jawabanmu...',
    options: [
      { icon: "status-great", label: "Baik banget!", score: 2 },
      { icon: "status-fine", label: "Oke, lumayan", score: 1 },
      { icon: "status-heavy", label: "Agak berat akhir-akhir ini", score: -1 },
      { icon: "status-notok", label: "Lagi nggak baik-baik saja", score: -2 },
    ],
  },
];

export const moodResults = {
  ceria: {
    id: "ceria" as MoodResultIconId,
    title: "Ceria & Bersemangat",
    badge: "Energi tinggi, perasaan positif",
    desc: "Energimu sedang tinggi dan perasaanmu cerah. Nikmati harimu!",
    note: "",
    color: "#b45309",
    bg: "#fef3c7",
  },
  tenang: {
    id: "tenang" as MoodResultIconId,
    title: "Tenang & Damai",
    badge: "Energi rendah, perasaan positif",
    desc: "Kamu sedang santai dan nyaman. Momen seperti ini layak dinikmati.",
    note: "",
    color: "#14553a",
    bg: "#e8f5ee",
  },
  tegang: {
    id: "tegang" as MoodResultIconId,
    title: "Tegang & Gelisah",
    badge: "Energi tinggi, perasaan tidak nyaman",
    desc: "Banyak yang sedang berputar di kepalamu. Coba tarik napas sebentar.",
    note: "Kalau perasaan ini sering muncul, ngobrol dengan konselor BK di SiCARE bisa jadi pilihan.",
    color: "#1d4ed8",
    bg: "#e0ecff",
  },
  lelah: {
    id: "lelah" as MoodResultIconId,
    title: "Lelah & Sendu",
    badge: "Energi rendah, perasaan tidak nyaman",
    desc: "Tenagamu sedang rendah. Istirahat dan jangan terlalu keras pada diri sendiri.",
    note: "Kalau rasa berat ini bertahan lama, jangan ragu menghubungi konselor BK di SiCARE.",
    color: "#475569",
    bg: "#eef2f7",
  },
  seimbang: {
    id: "seimbang" as MoodResultIconId,
    title: "Seimbang",
    badge: "Energi dan perasaan stabil",
    desc: "Tidak terlalu tinggi, tidak terlalu rendah. Kamu sedang stabil.",
    note: "",
    color: "#0f766e",
    bg: "#ccfbf1",
  },
};

export function calculateMood(answers: (number | null)[]) {
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


export type MoodResult = (typeof moodResults)[keyof typeof moodResults];
