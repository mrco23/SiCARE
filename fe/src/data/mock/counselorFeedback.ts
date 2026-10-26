/** Counselor-specific feedback fixture; it is not mapped to public/admin feedback without stable shared IDs. */

export type Feedback = {
  id: number;
  konselorId: string;
  rating: number;
  text: string;
  date: string;
};

export const COUNSELOR = { id: "KNS-001", name: "Ma'am Giovanna Yudi, M.Psi" };

const DAY_MS = 86_400_000;

const daysAgo = (days: number) =>
  new Date(Date.now() - days * DAY_MS).toISOString();

export const feedbackData: Feedback[] = [
  {
    id: 1,
    konselorId: "KNS-001",
    rating: 5,
    text: "Sangat membantu, saya merasa didengarkan dan lebih tenang setelah sesi.",
    date: daysAgo(0),
  },
  {
    id: 2,
    konselorId: "KNS-002",
    rating: 4,
    text: "Penjelasannya jelas dan mudah dipahami. Semoga durasi sesi bisa sedikit lebih panjang.",
    date: daysAgo(1),
  },
  {
    id: 3,
    konselorId: "KNS-001",
    rating: 5,
    text: "Psikolognya ramah dan tidak menghakimi. Terima kasih banyak.",
    date: daysAgo(2),
  },
  {
    id: 4,
    konselorId: "KNS-002",
    rating: 3,
    text: "Sesi lumayan, tapi sempat mulai terlambat dari jadwal.",
    date: daysAgo(4),
  },
  {
    id: 5,
    konselorId: "KNS-001",
    rating: 2,
    text: "Kurang merasa nyambung, saran yang diberikan terasa terlalu umum.",
    date: daysAgo(6),
  },
  {
    id: 6,
    konselorId: "KNS-001",
    rating: 5,
    text: "Saya jadi punya langkah konkret untuk mengatasi kecemasan saat presentasi.",
    date: daysAgo(9),
  },
  {
    id: 7,
    konselorId: "KNS-001",
    rating: 4,
    text: "Nyaman dan aman untuk bercerita. Proses booking juga mudah.",
    date: daysAgo(12),
  },
  {
    id: 8,
    konselorId: "KNS-002",
    rating: 1,
    text: "Link sesi online bermasalah dan waktu terbuang cukup banyak.",
    date: daysAgo(15),
  },
  {
    id: 9,
    konselorId: "KNS-001",
    rating: 4,
    text: "Cukup puas, ingin lanjut sesi berikutnya.",
    date: daysAgo(28),
  },
  {
    id: 10,
    konselorId: "KNS-001",
    rating: 3,
    text: "Biasa saja, tapi suasana sesinya tenang.",
    date: daysAgo(40),
  },
  {
    id: 11,
    konselorId: "KNS-002",
    rating: 5,
    text: "Recommended! Sangat profesional.",
    date: daysAgo(21),
  },
  {
    id: 12,
    konselorId: "KNS-001",
    rating: 5,
    text: "Terbantu sekali, sesinya terstruktur dan hangat.",
    date: daysAgo(55),
  },
];
