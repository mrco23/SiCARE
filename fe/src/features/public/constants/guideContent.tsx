/* eslint-disable react-refresh/only-export-components */
import type { ReactNode } from "react";
import { Briefcase, GraduationCap, Presentation } from "lucide-react";

export type GuideStep = {
  no: string;
  title: string;
  side: "right" | "left";
  numClass: string;
  desc: string;
};

export const DEFAULT_GUIDE_DESC =
  "Informasi tahapan prosedur bimbingan konseling di SiCARE untuk kenyamanan dan kejelasan proses konseli.";

export const LOREM_LONG = DEFAULT_GUIDE_DESC;

export const audiences: { title: string; icon: ReactNode; desc: string }[] = [
  {
    title: "Mahasiswa Aktif",
    icon: <GraduationCap className="h-9 w-9" />,
    desc: "Seluruh mahasiswa aktif Unika De La Salle Manado dari berbagai program studi yang memerlukan pendampingan akademik, adaptasi kampus, maupun kesehatan mental.",
  },
  {
    title: "Dosen Pengajar",
    icon: <Presentation className="h-9 w-9" />,
    desc: "Tenaga pendidik yang ingin berkonsultasi mengenai dinamika pengajaran, pengelolaan stres kerja, dan pemeliharaan kesejahteraan psikologis.",
  },
  {
    title: "Tenaga Kependidikan & Staf Penunjang",
    icon: <Briefcase className="h-9 w-9" />,
    desc: "Seluruh staf administratif dan tenaga penunjang kampus yang membutuhkan ruang konsultasi pengembangan diri serta keharmonisan lingkungan kerja.",
  },
];

export const steps: GuideStep[] = [
  {
    no: "01",
    title: "Pengunjung Masuk ke Portal",
    side: "right",
    numClass: "right-0 -top-10 md:-right-6",
    desc: "Kunjungi portal SiCARE untuk melihat informasi layanan bimbingan konseling, profil konselor, dan jadwal yang tersedia pada periode aktif.",
  },
  {
    no: "02",
    title: "Log In dengan Akun Kampus",
    side: "left",
    numClass: "left-0 -top-4 md:-left-24",
    desc: "Masuk menggunakan kredensial akun kampus Anda untuk mengakses formulir reservasi dan riwayat aktivitas konseling.",
  },
  {
    no: "03",
    title: "Booking Sesi Konseling",
    side: "right",
    numClass: "right-0 -bottom-14 md:-right-6",
    desc: "Tentukan konselor yang sesuai, pilih slot waktu yang tersedia, dan ajukan permohonan sesi individu maupun kelompok.",
  },
  {
    no: "04",
    title: "Pelaksanaan Konseling",
    side: "left",
    numClass: "left-0 -bottom-12 md:-left-28",
    desc: "Lengkapi lembar Informed Consent secara digital, lalu ikuti sesi konseling bersama konselor sesuai jadwal yang dikonfirmasi.",
  },
  {
    no: "05",
    title: "Pemberian Feedback Anonim",
    side: "right",
    numClass: "right-0 -bottom-12 md:-right-6",
    desc: "Setelah sesi selesai, sampaikan evaluasi dan umpan balik secara aman dan anonim untuk peningkatan kualitas layanan berkelanjutan.",
  },
];

export const faqs = [
  {
    q: "Apakah dosen pembimbing atau dekanat akan tahu jika saya ikut konseling?",
    a: "Tidak. Sesi konseling di SiCARE diselenggarakan dengan prinsip kerahasiaan dan berpegang pada kode etik bimbingan konseling. Data dan percakapan Anda tidak dibagikan kepada dosen pembimbing, dekanat, maupun pihak luar, kecuali pada situasi darurat yang menyangkut keselamatan jiwa sesuai kesepakatan Informed Consent.",
  },
  {
    q: "Berapa biaya yang harus saya bayar?",
    a: "Layanan bimbingan dan konseling di SiCARE disediakan oleh Lembaga Misi & Identitas (LMI) sebagai wujud kepedulian kampus terhadap kesejahteraan mental mahasiswa dan staf, sehingga seluruh layanan dapat diakses tanpa biaya tambahan (gratis).",
  },
  {
    q: "Apakah saya bisa membatalkan atau mengubah jadwal konseling?",
    a: "Ya. Anda dapat mengajukan perubahan jadwal (reschedule) atau pembatalan melalui portal SiCARE sebelum jadwal sesi tiba, sehingga jadwal yang ditinggalkan dapat dimanfaatkan oleh peserta lain yang membutuhkan.",
  },
];

