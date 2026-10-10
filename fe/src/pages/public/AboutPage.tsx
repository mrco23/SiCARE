import {
  ArrowUpRight,
  CalendarDays,
  CircleCheck,
  Briefcase,
  GraduationCap,
  HandHeart,
  HeartPulse,
  Shield,
  ShieldCheck,
  Target,
  User,
  Eye,
  Users,
} from "lucide-react";
import type { ElementType } from "react";
import Navbar from "../../components/home/Navbar";

// Lebar konten: sama dengan navbar dan homepage
const container = "mx-auto w-[92%] sm:w-[88%] lg:w-[86%]";

/* ============================ HERO ============================ */
function AboutHero() {
  const points = [
    "Konseling Akademik & Non-Akademik",
    "Dukungan Adaptasi Lingkungan Kampus",
    "Pengembangan Potensi & Keterampilan Diri",
  ];

  return (
    <section className="-mt-16 md:-mt-20 relative overflow-hidden bg-[#f3fdf7] pb-40 pt-32 md:pb-44 md:pt-44">

      {/* Logo besar di latar kanan atas */}
      <img
        src="/logo.png"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute -right-40 -top-0 w-130 max-w-none select-none opacity-15 md:w-160 lg:w-190"
      />

      {/* Dekorasi lingkaran biru di kiri */}
      <div className="pointer-events-none absolute -left-24 top-[62%] h-72 w-72 rounded-full bg-[#cde2fb]" />
      <div className="pointer-events-none absolute left-10 top-[52%] h-4 w-4 rounded-full bg-[#cde2fb]" />

      <div className={`relative z-10 ${container}`}>
        <h1 className="text-center font-[Montserrat] text-3xl font-bold leading-tight text-[#14553a] sm:text-4xl md:text-5xl">
          Mendampingi Langka,
          <br />
          Membantu <span className="text-[#d4b82a]">Tumbuh Bersama</span>
        </h1>

        <div className="mt-20 grid items-center gap-12 md:grid-cols-2">
          {/* Kiri: deskripsi */}
          <div className="space-y-8 font-[Poppins] text-base leading-relaxed text-[#14553a] sm:text-lg md:text-[19px]">
            <p>
              <span className="font-semibold">
                Divisi Bimbingan dan Konseling (BK)
              </span>{" "}
              Unika De La Salle Manado adalah unit layanan pendukung yang
              berfokus pada kesehatan mental, pengembangan diri, potensi serta
              kesejahteraan psikologis seluruh sivitas akademika.
            </p>
            <p>
              Kami hadir untuk menciptakan lingkungan kampus yang inklusif,
              kondusif, dan mendukung perkembangan akademik maupun non-akademik.
            </p>
          </div>

          {/* Kanan: kartu */}
          <div className="relative mx-auto w-full max-w-md rounded-3xl bg-white p-7 shadow-[0_20px_50px_rgba(46,154,95,0.22)] sm:p-8">
            {/* Garis aksen hijau tua di kiri */}
            <div className="absolute bottom-10 left-0 top-[88px] w-1.5 rounded-r-full bg-[#14553a]" />

            <div className="flex items-center gap-5">
              <div className="flex h-20 w-24 shrink-0 items-center justify-center rounded-2xl bg-[#eef9f3]">
                <HeartPulse
                  className="h-10 w-10 text-[#14553a]"
                  strokeWidth={2.2}
                />
              </div>
              <div>
                <h3 className="font-[Montserrat] text-xl font-bold text-[#1b1b1b]">
                  Kesejahteraan Mental
                </h3>
                <p className="font-[Poppins] text-xs text-[#1b1b1b]">
                  Prioritas Utama Kami di Kampus
                </p>
              </div>
            </div>

            <ul className="mt-8 space-y-5 pl-4 font-[Poppins]">
              {points.map((point) => (
                <li
                  key={point}
                  className="flex items-center gap-4 text-[15px] text-[#1b1b1b]"
                >
                  <CircleCheck
                    className="h-5 w-5 shrink-0 fill-[#36c08f] text-white"
                    strokeWidth={2.2}
                  />
                  {point}
                </li>
              ))}
            </ul>

            <div className="mt-10 flex items-center justify-between border-t border-gray-300 pt-6 font-[Poppins]">
              <span className="text-base text-[#36c08f]">Terbuka untuk :</span>
              <span className="rounded-full border border-[#36c08f] px-4 py-1.5 text-xs text-[#1b1b1b]">
                Mahasiswa &amp; Dosen / Karyawan
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Wave bawah abu-abu ke putih */}
      <svg
        className="absolute inset-x-0 -bottom-px z-10 block h-24 w-full md:h-32"
        viewBox="0 0 1440 320"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="about-hero-wave" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e9e9e9" />
            <stop offset="100%" stopColor="#ffffff" />
          </linearGradient>
        </defs>
        <path
          fill="url(#about-hero-wave)"
          d="M0,160L120,170.7C240,181,480,203,720,197.3C960,192,1200,160,1320,144L1440,128L1440,320L1320,320C1200,320,960,320,720,320C480,320,240,320,120,320L0,320Z"
        />
      </svg>
    </section>
  );
}

/* ========================= VISI & MISI ========================= */
function VisiMisi() {
  const misi = [
    {
      no: "1",
      title: "Pelayanan Konseling Profesional & Rahasia",
      text: "Memberikan pelayanan konseling yang profesional, terjaga kerahasiaannya, serta terpercaya untuk menangani berbagai permasalahan kendala.",
    },
    {
      no: "2",
      title: "Pengembangan Keterampilan Hidup (Life Skill)",
      text: "Memfasilitasi pengembangan keterampilan hidup & pemeliharaan kesehatan mental yang berkelanjutan bagi mahasiswa, dosen, & staff.",
    },
  ];

  return (
    <section className="relative overflow-hidden bg-white py-20 md:py-28">
      {/* Watermark */}
      <span className="pointer-events-none absolute right-0 top-24 select-none font-[Montserrat] text-[120px] font-black leading-none text-[#e3f5ec] md:text-[180px]">
        MISI
      </span>
      <span className="pointer-events-none absolute bottom-10 left-0 select-none font-[Montserrat] text-[120px] font-black leading-none text-[#e3f5ec] md:text-[180px]">
        VISI
      </span>

      <div className={`relative z-10 ${container}`}>
        <h2 className="text-center font-[Montserrat] text-3xl font-bold text-[#1e5b3a] sm:text-4xl">
          Visi & Misi Layanan
        </h2>

        <div className="mt-12 grid gap-8 md:grid-cols-2 md:gap-10">
          {/* Visi */}
          <div className="rounded-2xl bg-linear-to-br from-[#2a8a63] to-[#1b5e45] p-7 text-white shadow-xl sm:p-10">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15">
                <Eye className="h-5 w-5 text-white" />
              </div>
              <span className="text-sm font-semibold tracking-wide">VISI</span>
            </div>
            <h3 className="mt-6 font-[Montserrat] text-xl font-bold leading-snug sm:text-2xl">
              Menjadi penyedia Layanan Psikologis Terpercaya
            </h3>
            <p className="mt-6 pl-4 text-sm leading-relaxed text-white/90 sm:text-[15px]">
              Menjadi penyedia layanan psikologis perguruan tinggi yang
              profesional, terpercaya, & berperan aktif dalam membentuk
              ketangguhan mental mahasiswa, dosen, & staff.
            </p>
            <div className="mt-8 border-t border-white/25 pt-4">
              <p className="flex items-center gap-2 text-xs text-[#9ff0c8]">
                <Shield className="h-4 w-4" />
                Berpedoman Kode Etik Psikolog
              </p>
            </div>
          </div>

          {/* Misi */}
          <div className="rounded-2xl bg-linear-to-br from-[#f1fbf7] to-[#e2f6ee] p-7 shadow-sm sm:p-10">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#2e9a5f]">
                <Target className="h-5 w-5 text-white" />
              </div>
              <span className="text-sm font-semibold tracking-wide text-[#1e5b3a]">
                MISI
              </span>
            </div>
            <h3 className="mt-6 font-[Montserrat] text-xl font-bold text-[#1e5b3a] sm:text-2xl">
              Langkah Nyata Pelayanan Kami
            </h3>

            <ul className="mt-8 space-y-6">
              {misi.map((item) => (
                <li key={item.no} className="flex gap-4">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#2e9a5f] text-sm font-bold text-white">
                    {item.no}
                  </span>
                  <div>
                    <p className="font-semibold text-[#2e9a5f]">{item.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-gray-600">
                      {item.text}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function FokusLayanan() {
  const cards: {
    icon: ElementType;
    title: string;
    text: string;
    highlight?: boolean;
  }[] = [
    {
      icon: User,
      title: "Konseling Personal",
      text: "Lorem ipsum dolor sit amet consectetur adipiscing elit facere exercitation mollit consectetur excepteur cum quos laboris illum quo minus nihil excepturi reprehenderit quos.",
    },
    {
      icon: GraduationCap,
      title: "Konseling Edukasional",
      text: "Lorem ipsum dolor sit amet consectetur adipiscing elit facere exercitation mollit consectetur excepteur cum quos laboris illum quo minus nihil excepturi reprehenderit quos quod assumenda quibusdam.",
      highlight: true,
    },
    {
      icon: Briefcase,
      title: "Konseling Vokasional",
      text: "Lorem ipsum dolor sit amet consectetur adipiscing elit facere exercitation mollit consectetur excepteur cum quos laboris illum quo minus nihil excepturi reprehenderit quos.",
    },
  ];

  // Posisi tumpukan di desktop: kiri & kanan mundur, tengah di depan
  const stackPos = [
    "md:-mr-16 md:translate-y-10 md:z-10",
    "md:z-20 md:-translate-y-4",
    "md:-ml-16 md:translate-y-10 md:z-10",
  ];

  return (
    <section className="relative overflow-hidden bg-linear-to-b from-[#effcf5] to-[#f5fdf9] py-20 md:py-28">
      <div className={`relative z-10 ${container}`}>
        <h2 className="font-[Montserrat] text-3xl font-bold text-[#1e5b3a] sm:text-4xl">
          Fokus Layanan Utama
        </h2>

        <div className="mt-14 flex flex-col items-center gap-8 md:flex-row md:items-center md:justify-center md:gap-0">
          {cards.map((card, i) => {
            const Icon = card.icon;
            return (
              <div
                key={card.title}
                className={`group relative flex w-full max-w-sm flex-col rounded-[28px] border border-[#36c08f] bg-white p-7 shadow-[0_20px_50px_rgba(0,0,0,0.12)] transition-all duration-500 ease-out hover:z-30! hover:-translate-y-3 hover:scale-[1.03] hover:shadow-[0_30px_60px_rgba(0,0,0,0.2)] sm:p-8 md:w-80 md:max-w-none lg:w-88 ${
                  card.highlight ? "md:h-[480px] md:py-10" : "md:h-[420px]"
                } ${stackPos[i]}`}
              >
                {/* Ikon tergambar di sudut kanan bawah untuk kartu tengah */}
                {card.highlight && (
                  <Icon className="pointer-events-none absolute -bottom-6 -right-6 h-40 w-40 text-[#c8eee0]" />
                )}

                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#36c08f]">
                  <Icon className="h-8 w-8 text-white" />
                </div>

                <h3 className="mt-6 font-[Montserrat] text-2xl font-bold text-black">
                  {card.title}
                </h3>

                <p className="mt-8 font-[Poppins] text-sm leading-relaxed text-[#1b1b1b] sm:text-[15px] md:mt-10">
                  {card.text}
                </p>

                <a
                  href="#"
                  className="relative mt-auto pt-8 inline-flex items-center gap-1 text-sm font-medium text-[#36c08f] transition-all duration-300 group-hover:gap-2"
                >
                  Pelajari Selengkapnya{" "}
                  <ArrowUpRight className="h-4 w-4 rotate-45" />
                </a>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ========================= PRINSIP LAYANAN ========================= */
function PrinsipLayanan() {
  const circles = [
    { icon: HandHeart, pos: "left-0 top-0", size: "h-24 w-24 sm:h-28 sm:w-28" },
    {
      icon: ShieldCheck,
      pos: "left-12 top-16 sm:left-16 sm:top-20",
      size: "h-32 w-32 sm:h-40 sm:w-40 z-10",
    },
    {
      icon: Users,
      pos: "left-0 top-44 sm:top-52",
      size: "h-24 w-24 sm:h-28 sm:w-28",
    },
  ];

  return (
    <section className="relative overflow-hidden bg-white py-20 md:py-28">
      <div className={`relative z-10 ${container}`}>
        <h2 className="font-[Montserrat] text-3xl font-bold text-[#1e5b3a] sm:text-4xl">
          Prinsip Layanan Kami
        </h2>

        <div className="mt-14 grid items-center gap-12 md:grid-cols-2">
          {/* Lingkaran ikon */}
          <div className="relative mx-auto h-72 w-full max-w-sm sm:h-80">
            {circles.map((c, i) => {
              const Icon = c.icon;
              return (
                <div
                  key={i}
                  className={`absolute flex items-center justify-center rounded-full border-2 border-[#3ee08a] bg-linear-to-br from-[#2ecc7a] to-[#127a47] shadow-xl ${c.pos} ${c.size}`}
                >
                  <Icon className="h-1/3 w-1/3 text-white" />
                </div>
              );
            })}
          </div>

          {/* Kartu Kerahasiaan */}
          <div className="relative overflow-hidden rounded-2xl border-2 border-[#3ee08a] bg-white p-8 shadow-md sm:p-10">
            <Shield className="pointer-events-none absolute -right-6 -top-6 h-48 w-48 text-[#e3f5ec]" />
            <h3 className="relative font-[Montserrat] text-2xl font-bold text-[#1b1b1b] sm:text-3xl">
              Kerahasiaan
            </h3>
            <p className="relative mt-6 text-sm leading-relaxed text-[#1b1b1b] sm:text-base">
              Lorem ipsum dolor sit amet consectetur adipiscing elit culpa qui
              occaecat molestias fugiat provident non cupiditate est dignissimos
              dolor iusto officia ut cumque ipsum laborum possimus sunt dolor id
              cillum reprehenderit adipiscing minim similique labore id et eos
              quibusdam ut excepturi dolorem libero est in id autem ut
              assumenda.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ========================= CTA ========================= */
function CtaSection() {
  return (
    <section className="relative overflow-hidden bg-white pt-20 pb-0 text-center md:pt-28">
      <div className={`relative z-10 ${container}`}>
        <h2 className="font-[Montserrat] text-3xl font-bold text-[#1e5b3a] sm:text-4xl md:text-[44px]">
          Butuh Teman Bicara atau Bimbingan
          <span className="text-[#e0b83a]">?</span>
        </h2>
        <p className="mx-auto mt-6 max-w-3xl text-base leading-relaxed text-[#1e5b3a] sm:text-lg md:text-2xl">
          Jangan ragu untuk menghubungi kami. Tim psikolog & konselor BK Unika
          De La Salle Manado siap mendampingi anda.
        </p>
      </div>

      {/* Latar wave */}
      <div className="relative mt-16 h-64 md:h-96">
        <svg
          className="absolute inset-x-0 bottom-0 h-full w-full"
          viewBox="0 0 1440 388"
          preserveAspectRatio="none"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient
              id="paint0_linear_228_229"
              x1="874.5"
              y1="-133"
              x2="872.491"
              y2="324.077"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#D3F3DC" />
              <stop offset="1" stopColor="#0C2719" />
            </linearGradient>
            <linearGradient
              id="paint1_linear_228_229"
              x1="874.5"
              y1="-47.9982"
              x2="873.094"
              y2="334.382"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#D3F3DC" />
              <stop offset="1" stopColor="#0C2719" />
            </linearGradient>
            <linearGradient
              id="paint2_linear_228_229"
              x1="874.5"
              y1="50.0111"
              x2="873.656"
              y2="346.263"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#D3F3DC" />
              <stop offset="1" stopColor="#0C2719" />
            </linearGradient>
          </defs>

          <path
            d="M231.388 3.80176C313.055 -5.24692 394.748 13.1966 476.486 44.8936C496.922 52.8177 517.357 61.569 537.806 70.1885C558.25 78.8064 578.705 87.2924 599.163 94.6758C640.076 109.441 681.037 119.815 722.021 118.034C762.997 116.253 803.954 102.322 844.834 87.8223C885.741 73.3123 926.568 58.2334 967.383 54.0625C1008.19 49.893 1049.01 56.6245 1089.88 66.749C1110.31 71.8112 1130.75 77.7187 1151.2 83.5332C1171.64 89.3466 1192.1 95.0662 1212.56 99.7461C1294.23 118.429 1375.89 120.526 1457.5 122.592V386.621H-13.5V85.875C68.1967 49.3176 149.803 12.8392 231.388 3.80176Z"
            fill="url(#paint0_linear_228_229)"
            stroke="#4CAE6D"
          />
          <path
            d="M-14 85.5511C67.7783 48.9572 149.557 12.3632 231.332 3.30461C313.111 -5.7564 394.889 12.7155 476.668 44.4278C558.443 76.1378 640.222 121.088 722 117.534C803.778 113.98 885.557 61.922 967.332 53.5655C1049.11 45.2091 1130.89 80.5521 1212.67 99.2588C1294.44 117.966 1376.22 120.034 1458 122.104"
            stroke="#4CAE6D"
            strokeWidth="2"
          />
          <path
            d="M1212.76 67.7637C1253.52 59.6513 1294.31 67.8646 1335.15 84.2832C1375.91 100.672 1416.68 125.215 1457.5 149.802V386.621H-13.5V113.793C68.0173 156.591 149.622 199.356 231.244 213.98C313.135 228.655 395.005 215.001 476.832 186.545C497.286 179.432 517.74 171.392 538.181 163.461C558.625 155.528 579.058 147.702 599.488 141.006C640.351 127.612 681.164 118.753 721.953 122.602C762.765 126.453 803.574 143.021 844.503 157.224C885.392 171.413 926.384 183.233 967.402 177.431C1008.41 171.631 1049.38 148.226 1090.25 124.302C1131.17 100.352 1171.98 75.8821 1212.76 67.7637Z"
            fill="url(#paint1_linear_228_229)"
            stroke="#4CAE6D"
          />
          <path
            d="M-14 112.967C67.7783 155.901 149.557 198.836 231.332 213.488C313.111 228.143 394.889 214.512 476.668 186.073C558.443 157.634 640.222 114.388 722 122.104C803.778 129.821 885.557 188.503 967.332 176.935C1049.11 165.367 1130.89 83.55 1212.67 67.2732C1294.44 50.9965 1376.22 100.258 1458 149.52"
            stroke="#4CAE6D"
            strokeWidth="2"
          />
          <path
            d="M1212.84 154.56C1294.33 124.823 1375.84 139.608 1457.5 154.507V386.621H-13.5V222.998C68.166 198.059 149.796 173.148 231.417 159.151C313.153 145.134 394.866 142.064 476.565 159.147C558.286 176.236 640.002 213.484 721.815 245.939C803.582 278.375 885.512 306.058 967.471 282.508C1008.44 270.738 1049.38 246.175 1090.26 220.864C1131.17 195.535 1172.01 169.458 1212.84 154.56Z"
            fill="url(#paint2_linear_228_229)"
            stroke="#4CAE6D"
          />
          <path
            d="M-14 222.629C67.7783 197.655 149.557 172.682 231.332 158.658C313.111 144.634 394.889 141.559 476.668 158.658C558.443 175.759 640.222 213.033 722 245.474C803.778 277.915 885.557 305.525 967.332 282.027C1049.11 258.533 1130.89 183.931 1212.67 154.09C1294.44 124.249 1376.22 139.17 1458 154.09"
            stroke="#4CAE6D"
            strokeWidth="2"
          />
        </svg>

        <div className="relative z-10 flex h-full items-center justify-center">
          <button className="flex items-center gap-2 rounded-lg bg-[#2e9a5f] px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-[#268050] sm:text-[15px]">
            <CalendarDays className="h-4 w-4" />
            Mulai Konseling
          </button>
        </div>
      </div>
    </section>
  );
}

/* ========================= PAGE ========================= */
export default function AboutPage() {
  return (
    <div className="overflow-x-clip bg-white">
      {/* Navbar sticky di paling atas halaman */}
      <div className="sticky top-0 z-50">
        <Navbar />
      </div>
      <AboutHero />
      <VisiMisi />
      <FokusLayanan />
      <PrinsipLayanan />
      <CtaSection />
    </div>
  );
}
