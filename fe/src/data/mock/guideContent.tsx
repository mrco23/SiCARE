import type { ReactNode } from "react";
import { Briefcase, GraduationCap, Presentation } from "lucide-react";

/* ========================= DATA ========================= */
export type GuideStep = {
  no: string;
  title: string;
  side: "right" | "left";
  numClass: string;
  desc?: string;
};
const LOREM =
  "lorem ipsum dolor sit amet consectetur adipiscing elit blanditiis culpa aliqua ipsum culpa quos voluptatum dolor";
export const LOREM_LONG =
  "lorem ipsum dolor sit amet consectetur adipiscing elit culpa qui occaecat molestias fugiat provident non cupiditate est dignissimos dolor iusto officia ut cumque ipsum laborum possimus sunt dolor id cillum reprehenderit adipiscing minim similique";

export const audiences: { title: string; icon: ReactNode; desc: string }[] = [
  {
    title: "Mahasiswa Aktif",
    icon: <GraduationCap className="h-9 w-9" />,
    desc: LOREM,
  },
  {
    title: "Doesn Pengajar".replace("Doesn", "Dosen"),
    icon: <Presentation className="h-9 w-9" />,
    desc: LOREM,
  },
  {
    title: "Tenaga Pendidikan dan Tenaga Penunjang ",
    icon: <Briefcase className="h-9 w-9" />,
    desc: LOREM,
  },
];

export const steps: GuideStep[] = [
  {
    no: "01",
    title: "Pengunjung Masuk ke Portal",
    side: "right",
    numClass: "right-0 -top-10 md:-right-6",
  },
  {
    no: "02",
    title: "Log In dengan Akun Kampus",
    side: "left",
    numClass: "left-0 -top-4 md:-left-24",
  },
  {
    no: "03",
    title: "Booking Sesi Konseling",
    side: "right",
    numClass: "right-0 -bottom-14 md:-right-6",
  },
  {
    no: "04",
    title: "Pelaksanaan Konseling",
    side: "left",
    numClass: "left-0 -bottom-12 md:-left-28",
  },
  {
    no: "05",
    title: "Pemberian Feedback Anonim",
    side: "right",
    numClass: "right-0 -bottom-12 md:-right-6",
  },
];

export const faqs = [
  {
    q: "Apakah dosen pembimbing atau dekanat akan tahu jika saya ikut konseling?",
    a: "lorem ipsum dolor sit amet consectetur adipiscing elit culpa qui occaecat molestias fugiat provident non cupiditate est dignissimos dolor iusto officia ut cumque ipsum laborum possimus sunt dolor id cillum reprehenderit adipiscing minim similique",
  },
  { q: "Berapa biaya yang harus saya bayar?", a: LOREM_LONG },
  {
    q: "Apakah saya bisa membatalkan atau mengubah jadwal konseling?",
    a: LOREM_LONG,
  },
];

