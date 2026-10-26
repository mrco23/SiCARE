/**
 * Static marketing showcases are intentionally separate from the public feedback
 * listing and moderation records. Names/content differ across legacy sections;
 * no cross-source identity mapping is inferred here.
 */

export const HOME_PAGE_TESTIMONIALS = [
  {
    name: "G******",
    text: "lorem ipsum dolor sit amet consectetur adipiscing elit odio esse temporibus id",
  },
  {
    name: "G******",
    text: "lorem banget ipsum dolor sit amet consectetur adipiscing elit odio esse temporibus id",
  },
  {
    name: "G******",
    text: "lorem ipsum dolor sit amet consectetur adipiscing elit odio esse temporibus id",
  },
  {
    name: "G******",
    text: "lorem ipsum dolor sit amet consectetur adipiscing elit odio esse temporibus id",
  },
  {
    name: "G******",
    text: "lorem ipsum dolor sit amet consectetur adipiscing elit odio esse temporibus id",
  },
];

export const HOME_PAGE_COUNSELORS = [
  {
    id: 1,
    name: "Giovanna Yusi, S.Psi., M.Psi., Psikolog",
    image: "/gio.jpeg",
    topics: ["Konseling Akademik", "Manajemen Stres", "Pengembangan Diri"],
    description:
      "Mendampingi mahasiswa dalam menghadapi tantangan akademik, mengelola stres, dan mengembangkan potensi diri.",
    experience: "3 tahun pengalaman konseling",
    education: "S2 Psikologi",
  },
  {
    id: 2,
    name: "Rico Kornelius Wahani, S.Psi., M.Psi., Psikolog.",
    image: "/rico.png",
    topics: ["Kesehatan Mental", "Relasi Sosial", "Kecemasan"],
    description:
      "Membantu mahasiswa memahami emosi, membangun relasi yang sehat, dan menghadapi kecemasan.",
    experience: "4 tahun pengalaman konseling",
    education: "S2 Psikologi Profesi",
  },
];
/**
 * Static marketing showcases are intentionally separate from the public feedback
 * listing and moderation records. Names/content differ across legacy sections;
 * no cross-source identity mapping is inferred here.
 */

export interface Testimonial {
  id: string;
  anonymous: string;
  role: string;
  rating: number;
  text: string;
  category: string;
}

export const TESTIMONIALS: Testimonial[] = [
  {
    id: 't1',
    anonymous: 'G*****a',
    role: 'Mahasiswa Semester 6',
    rating: 5,
    text: 'Awalnya saya ragu untuk mencoba konseling. Tapi setelah sesi pertama, saya merasa jauh lebih lega. Konselor sangat sabar mendengarkan dan tidak menghakimi sama sekali. Terima kasih SiCARE!',
    category: 'Kesehatan Mental',
  },
  {
    id: 't2',
    anonymous: 'R*****n',
    role: 'Mahasiswa Baru',
    rating: 5,
    text: 'Saya mengalami culture shock saat pertama kuliah. Dengan bantuan konselor, saya belajar cara beradaptasi dan membangun rasa percaya diri. Prosesnya mudah dan tidak menyulitkan sama sekali.',
    category: 'Adaptasi & Akademik',
  },
  {
    id: 't3',
    anonymous: 'F*****i',
    role: 'Mahasiswa Tingkat Akhir',
    rating: 5,
    text: 'Tekanan skripsi hampir membuatku menyerah. Layanan konseling karir di SiCARE membantu saya menemukan kembali motivasi dan strategi yang tepat. Sangat direkomendasikan!',
    category: 'Karir & Akademik',
  },
  {
    id: 't4',
    anonymous: 'A*****s',
    role: 'Mahasiswa Semester 4',
    rating: 4,
    text: 'Sistem booking sangat mudah digunakan. Konselor saya sangat profesional dan selalu menepati waktu. Sesi konseling online juga nyaman dan terasa personal.',
    category: 'Pengalaman Layanan',
  },
  {
    id: 't5',
    anonymous: 'D*****a',
    role: 'Mahasiswi Semester 3',
    rating: 5,
    text: 'Masalah hubungan yang sudah lama saya pendam akhirnya bisa saya hadapi dengan lebih bijak berkat bimbingan konselor di sini. Privasi terjaga dan tidak perlu khawatir.',
    category: 'Hubungan Sosial',
  },
  {
    id: 't6',
    anonymous: 'H*****o',
    role: 'Mahasiswa Pasca Sarjana',
    rating: 5,
    text: 'Konseling manajemen stres benar-benar mengubah cara saya menghadapi deadline dan tekanan akademik. Kini saya lebih produktif dan bahagia. Platform ini luar biasa!',
    category: 'Manajemen Stres',
  },
];
/**
 * Static marketing showcases are intentionally separate from the public feedback
 * listing and moderation records. Names/content differ across legacy sections;
 * no cross-source identity mapping is inferred here.
 */

export const COUNSELOR_SECTION_SHOWCASE = [
  {
    name: "Giovanna Yusi, S.Psi., M.Psi.",
    role: "Psikolog",
    image: "/assets/counselor-1.png",
  },

  {
    name: "Rico Kornelius Wahani, S.Psi., M.Psi.",
    role: "Psikolog",
    image: "/assets/counselor-2.png",
  },
];
