export type Option = { emoji: string; label: string; score: -2 | -1 | 1 | 2 };
export type Question = { axis: "energy" | "valence"; text: string; options: Option[] };

export const questions: Question[] = [
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

export const moodResults = {
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
