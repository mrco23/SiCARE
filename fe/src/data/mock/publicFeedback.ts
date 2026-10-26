/** Public-facing anonymous review fixture. Kept separate until an approved ID mapping to moderated feedback exists. */

export type Role = "Mahasiswa" | "Dosen atau Staf" | "Klien";

export type Format = "Individu" | "Kelompok";

export type Review = {
  id: number;
  rating: number;
  days: number;
  role: Role;
  name: string; // sudah dianonimkan
  topic: string;
  format: Format;
  text: string;
};

export const reviews: Review[] = [
  {
    id: 1,
    rating: 5,
    days: 1,
    role: "Mahasiswa",
    name: "G******",
    topic: "Kecemasan akademik",
    format: "Individu",
    text: "Konselornya sangat mendengarkan dan tidak menghakimi. Saya merasa lebih tenang setelah sesi selesai.",
  },
  {
    id: 2,
    rating: 5,
    days: 3,
    role: "Dosen atau Staf",
    name: "R******",
    topic: "Manajemen stres kerja",
    format: "Individu",
    text: "Prosesnya mudah dan jadwalnya fleksibel. Saran yang diberikan langsung bisa saya terapkan.",
  },
  {
    id: 3,
    rating: 4,
    days: 4,
    role: "Mahasiswa",
    name: "A******",
    topic: "Adaptasi kampus",
    format: "Kelompok",
    text: "Diskusi kelompoknya membuat saya merasa tidak sendirian. Fasilitatornya ramah dan terarah.",
  },
  {
    id: 4,
    rating: 5,
    days: 7,
    role: "Dosen atau Staf",
    name: "S******",
    topic: "Keseimbangan hidup",
    format: "Individu",
    text: "Ruang konseling nyaman dan kerahasiaannya benar-benar terjaga. Saya akan kembali jika dibutuhkan.",
  },
  {
    id: 5,
    rating: 4,
    days: 10,
    role: "Mahasiswa",
    name: "M******",
    topic: "Hubungan pertemanan",
    format: "Individu",
    text: "Sesinya membantu saya memahami pola pikir sendiri. Waktu konseling terasa cukup untuk kebutuhan saya.",
  },
  {
    id: 6,
    rating: 5,
    days: 14,
    role: "Dosen atau Staf",
    name: "D******",
    topic: "Kesehatan mental",
    format: "Individu",
    text: "Layanannya profesional dan responsif. Penjadwalannya juga jelas dan tidak membingungkan.",
  },
  {
    id: 7,
    rating: 3,
    days: 21,
    role: "Mahasiswa",
    name: "K******",
    topic: "Motivasi belajar",
    format: "Kelompok",
    text: "Materinya bagus, tetapi saya berharap sesi kelompoknya bisa lebih sering diadakan.",
  },
  {
    id: 8,
    rating: 5,
    days: 35,
    role: "Dosen atau Staf",
    name: "N******",
    topic: "Pengembangan diri",
    format: "Individu",
    text: "Konselor memberi ruang yang aman untuk bercerita. Saya merasa dihargai sepanjang sesi.",
  },
  {
    id: 9,
    rating: 4,
    days: 42,
    role: "Mahasiswa",
    name: "P******",
    topic: "Tekanan skripsi",
    format: "Individu",
    text: "Membantu saya membuat rencana kecil yang realistis untuk menyelesaikan skripsi secara bertahap.",
  },
  {
    id: 10,
    rating: 5,
    days: 60,
    role: "Dosen atau Staf",
    name: "T******",
    topic: "Work-life balance",
    format: "Kelompok",
    text: "Sesi kelompok dengan rekan dosen sangat bermanfaat. Suasananya terbuka dan saling mendukung.",
  },
];
