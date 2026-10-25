"use client";

import {
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
import { useState, type CSSProperties, type ElementType } from "react";

// Lebar konten: sama dengan homepage
const container = "mx-auto w-[88%] sm:w-[82%] md:w-[78%] lg:w-[72%] xl:w-[78%]";

/* ============================ HERO ============================ */
function AboutHero() {
  const points = [
    "Konseling Akademik & Non-Akademik",
    "Dukungan Adaptasi Lingkungan Kampus",
    "Pengembangan Potensi & Keterampilan Diri",
  ];

  return (
    <section className="relative overflow-hidden bg-[#f3fdf7] pb-20 pt-20 md:pb-24 md:pt-24">
      {/* Logo besar di latar kanan atas */}
      <img
        src="/logo.png"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute -right-[100px] top-16 w-[320px] max-w-none select-none opacity-15 md:w-[400px] lg:w-[460px]"
      />

      {/* Dekorasi lingkaran biru di kiri */}
      <div className="pointer-events-none absolute -left-[60px] top-[62%] h-[180px] w-[180px] rounded-full bg-[#cde2fb]" />
      <div className="pointer-events-none absolute left-[24px] top-[52%] h-[10px] w-[10px] rounded-full bg-[#cde2fb]" />

      <div className={`relative z-10 ${container}`}>
        <h1 className="text-center text-[20px] font-bold leading-tight text-[#14553a] sm:text-[26px] md:text-[30px]">
          Mendampingi Langka,
          <br />
          Membantu <span className="text-[#d4b82a]">Tumbuh Bersama</span>
        </h1>

        <div className="mt-10 grid gap-8 md:grid-cols-2">
          {/* Kiri: deskripsi */}
          <div className="flex flex-col justify-center space-y-4 text-[13px] leading-relaxed text-[#14553a] sm:text-[14px] md:text-[17px]">
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
          <div className="relative mx-auto flex h-full w-full max-w-[320px] flex-col rounded-[16px] bg-white p-5 shadow-[0_12px_30px_rgba(46,154,95,0.2)] sm:p-6">
            {/* Garis aksen hijau tua di kiri */}
            <div className="absolute bottom-6 left-0 top-16 w-[4px] rounded-r-full bg-[#14553a]" />

            <div className="flex items-center gap-3">
              <div className="flex h-[56px] w-[64px] shrink-0 items-center justify-center rounded-[12px] bg-[#eef9f3]">
                <HeartPulse
                  className="h-[26px] w-[26px] text-[#14553a]"
                  strokeWidth={2.2}
                />
              </div>
              <div>
                <h3 className="text-[15px] font-bold text-[#1b1b1b]">
                  Kesejahteraan Mental
                </h3>
                <p className="text-[10px] text-[#1b1b1b]">
                  Prioritas Utama Kami di Kampus
                </p>
              </div>
            </div>

            <ul className="mt-5 space-y-3 pl-2">
              {points.map((point) => (
                <li
                  key={point}
                  className="flex items-center gap-2.5 text-[12px] text-[#1b1b1b]"
                >
                  <CircleCheck
                    className="h-[16px] w-[16px] shrink-0 fill-[#36c08f] text-white"
                    strokeWidth={2.2}
                  />
                  {point}
                </li>
              ))}
            </ul>

            <div className="mt-auto flex items-center justify-between border-t border-gray-300 pt-4 pt-6">
              <span className="text-[12px] text-primary font-semibold">
                Terbuka untuk :
              </span>
              <span className="rounded-full border border-primary px-2.5 py-1 text-[10px] text-[#1b1b1b]">
                Mahasiswa &amp; Dosen atau Staff
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Wave bawah abu-abu ke putih */}
      <svg
        className="absolute inset-x-0 -bottom-px z-10 block h-[60px] w-full md:h-[80px]"
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
    <section className="relative overflow-hidden bg-white py-14 md:py-[4.5rem]">
      {/* Watermark */}
      <span className="pointer-events-none absolute right-0 top-12 select-none font-[Montserrat] text-[56px] font-black leading-none text-[#e3f5ec] md:text-[84px]">
        MISI
      </span>
      <span className="pointer-events-none absolute bottom-5 left-0 select-none font-[Montserrat] text-[56px] font-black leading-none text-[#e3f5ec] md:text-[84px]">
        VISI
      </span>

      <div className={`relative z-10 ${container}`}>
        <h2 className="text-center font-[Montserrat] text-[22px] font-bold text-[#1e5b3a] sm:text-[26px]">
          Visi & Misi Layanan
        </h2>

        <div className="mx-auto mt-7 grid max-w-[960px] gap-5 md:grid-cols-2 md:gap-6">
          {/* Visi */}
          <div className="rounded-[16px] bg-linear-to-br from-[#2a8a63] to-[#1b5e45] p-6 text-white shadow-xl sm:p-7">
            <div className="flex items-center gap-2.5">
              <div className="flex h-[26px] w-[26px] items-center justify-center rounded-[6px] bg-white/15">
                <Eye className="h-[14px] w-[14px] text-white" />
              </div>
              <span className="text-[11px] font-semibold tracking-wide">
                VISI
              </span>
            </div>
            <h3 className="mt-3 font-[Montserrat] text-[16px] font-bold leading-snug sm:text-[18px]">
              Menjadi penyedia Layanan Psikologis Terpercaya
            </h3>
            <p className="mt-3 pl-2.5 text-[13px] leading-relaxed text-white/90 sm:text-[14px]">
              Menjadi penyedia layanan psikologis perguruan tinggi yang
              profesional, terpercaya, & berperan aktif dalam membentuk
              ketangguhan mental mahasiswa, dosen, & staff.
            </p>
            <div className="mt-4 border-t border-white/25 pt-3">
              <p className="flex items-center gap-2 text-[10px] text-[#9ff0c8]">
                <Shield className="h-[12px] w-[12px]" />
                Berpedoman Kode Etik Psikolog
              </p>
            </div>
          </div>

          {/* Misi */}
          <div className="rounded-[16px] bg-linear-to-br from-[#f1fbf7] to-[#e2f6ee] p-6 shadow-sm sm:p-7">
            <div className="flex items-center gap-2.5">
              <div className="flex h-[26px] w-[26px] items-center justify-center rounded-[6px] bg-[#2e9a5f]">
                <Target className="h-[14px] w-[14px] text-white" />
              </div>
              <span className="text-[11px] font-semibold tracking-wide text-[#1e5b3a]">
                MISI
              </span>
            </div>
            <h3 className="mt-3 font-[Montserrat] text-[16px] font-bold text-[#1e5b3a] sm:text-[18px]">
              Langkah Nyata Pelayanan Kami
            </h3>

            <ul className="mt-4 space-y-3">
              {misi.map((item) => (
                <li key={item.no} className="flex gap-2.5">
                  <span className="flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-full bg-[#2e9a5f] text-[10px] font-bold text-white">
                    {item.no}
                  </span>
                  <div>
                    <p className="text-[13px] font-semibold text-[#2e9a5f]">
                      {item.title}
                    </p>
                    <p className="mt-1 text-[12px] leading-relaxed text-gray-600">
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

/* ========================= FOKUS LAYANAN ========================= */
function FokusLayanan() {
  const cards: {
    icon: ElementType;
    title: string;
    text: string;
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
    },
    {
      icon: Briefcase,
      title: "Konseling Vokasional",
      text: "Lorem ipsum dolor sit amet consectetur adipiscing elit facere exercitation mollit consectetur excepteur cum quos laboris illum quo minus nihil excepturi reprehenderit quos.",
    },
  ];

  // Index kartu yang sedang di-hover (null = posisi awal)
  const [hovered, setHovered] = useState<number | null>(null);

  // Slot posisi (0 = kiri, 1 = tengah, 2 = kanan)
  const slotOf = (i: number) => {
    if (hovered === null || hovered === 1) return i;
    if (i === hovered) return 1;
    if (i === 1) return hovered;
    return i;
  };

  return (
    <section className="relative overflow-hidden bg-white py-14 md:py-20">
      <div className={`relative z-10 ${container}`}>
        <h2 className="font-[Montserrat] text-2xl font-bold text-[#064e3b] sm:text-3xl">
          Fokus Layanan Utama
        </h2>

        <div
          className="mt-10 flex flex-col items-center gap-6 md:flex-row md:items-start md:justify-center md:gap-0 md:[--step:15rem] lg:[--step:16rem]"
          onMouseLeave={() => setHovered(null)}
        >
          {cards.map((card, i) => {
            const Icon = card.icon;
            const slot = slotOf(i);
            const isCenter = slot === 1;
            const isHovered = hovered === i;

            return (
              // Wrapper statis = area hover (tidak ikut bergeser, supaya tidak berkedip)
              <div
                key={card.title}
                onMouseEnter={() => setHovered(i)}
                className={`relative w-full max-w-sm md:h-[460px] md:w-[18rem] md:max-w-none lg:w-[20rem] ${
                  i === 0 ? "md:-mr-12" : i === 2 ? "md:-ml-12" : ""
                }`}
              >
                <div
                  style={
                    {
                      "--tx": `calc(var(--step) * ${slot - i})`,
                    } as CSSProperties
                  }
                  className={`group relative flex flex-col overflow-hidden rounded-[28px] border border-[#36c08f] bg-white p-7 sm:p-8 md:pointer-events-none md:absolute md:inset-x-0 md:top-0 md:translate-x-[var(--tx)] md:transition-[translate,scale,transform,height,box-shadow,padding] md:duration-700 md:ease-[cubic-bezier(0.22,1,0.36,1)] md:will-change-transform ${
                    isCenter
                      ? "md:z-30 md:h-[430px] md:translate-y-0 md:shadow-[0_24px_48px_rgba(0,0,0,0.20)]"
                      : "md:z-10 md:h-[375px] md:translate-y-[64px] md:shadow-[0_20px_40px_rgba(0,0,0,0.14)]"
                  } ${isHovered ? "md:scale-[1.03]" : ""}`}
                >
                  {/* Ikon besar transparan di sudut kanan bawah */}
                  <Icon
                    fill="currentColor"
                    strokeWidth={1}
                    className="pointer-events-none absolute -bottom-6 -right-6 h-36 w-36 -rotate-12 text-[#36c08f]/25"
                  />

                  {/* Kotak ikon hijau (1:1) */}
                  <div className="relative flex aspect-square w-16 items-center justify-center rounded-xl bg-[#36c08f]">
                    <Icon className="h-8 w-8 text-white" />
                  </div>

                  <h3 className="relative mt-6 font-[Montserrat] text-xl font-bold leading-tight text-black md:text-[22px]">
                    {card.title}
                  </h3>

                  <p className="relative mt-6 text-[13px] leading-relaxed text-[#1b1b1b] md:mt-8 md:text-sm">
                    {card.text}
                  </p>
                </div>
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
  const [activePrinciple, setActivePrinciple] = useState(1);

  const principles = [
    {
      icon: HandHeart,
      title: "Inklusif",
      text: "Kami menyediakan ruang konseling yang terbuka dan menghargai setiap individu. Setiap mahasiswa, dosen, dan staf dapat mencari dukungan tanpa merasa dihakimi atau dibedakan.",
    },
    {
      icon: ShieldCheck,
      title: "Kerahasiaan",
      text: "Informasi dan cerita yang disampaikan selama proses konseling dijaga sesuai prinsip kerahasiaan dan kode etik yang berlaku. Konseli dapat berbicara dengan lebih nyaman dalam ruang yang aman.",
    },
    {
      icon: Users,
      title: "Profesional",
      text: "Layanan diberikan dengan sikap profesional, empati, dan tanggung jawab. Proses pendampingan disesuaikan dengan kebutuhan konseli serta mengacu pada etika dan kompetensi layanan.",
    },
  ];

  // Susunan awal tetap: kiri atas, tengah, kiri bawah.
  // Ikon aktif bertukar posisi dengan ikon tengah agar selalu berpindah ke tengah.
  const positions = [
    "left-0 top-0",
    "left-10 top-12 sm:left-12 sm:top-16",
    "left-0 top-36 sm:top-44",
  ];

  const active = principles[activePrinciple];
  const ActiveIcon = active.icon;

  return (
    <section className="relative overflow-hidden bg-white py-14 md:py-20">
      <div className={`relative z-10 ${container}`}>
        <h2 className="font-[Montserrat] text-2xl font-bold text-[#1e5b3a] sm:text-3xl">
          Prinsip Layanan Kami
        </h2>

        <div className="mt-10 grid items-center gap-8 md:grid-cols-2 md:gap-10">
          {/* Layout ikon asli dipertahankan; ikon aktif berpindah ke posisi tengah. */}
          <div className="relative mx-auto h-60 w-full max-w-xs sm:h-64">
            {principles.map((principle, i) => {
              const Icon = principle.icon;
              const isActive = activePrinciple === i;
              const slot = isActive ? 1 : i === 1 ? activePrinciple : i;
              const position = positions[slot];

              return (
                <button
                  key={principle.title}
                  type="button"
                  onClick={() => setActivePrinciple(i)}
                  aria-label={`Tampilkan prinsip ${principle.title}`}
                  aria-pressed={isActive}
                  className={`absolute ${position} flex items-center justify-center rounded-full border transition-all duration-500 ease-in-out focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2e9a5f]/25 ${
                    isActive
                      ? "z-20 h-28 w-28 border-[#14553a] bg-gradient-to-br from-[#2ecc7a] to-[#127a47] shadow-[0_12px_26px_rgba(20,85,58,0.22)] sm:h-32 sm:w-32"
                      : "z-10 h-20 w-20 border-[#D4E1D7] bg-gradient-to-br from-[#E5F0E8] to-[#C9DDCF] shadow-[0_4px_12px_rgba(20,85,58,0.08)] hover:scale-105 hover:border-[#B9D0C0] sm:h-24 sm:w-24"
                  }`}
                >
                  <Icon
                    className={`h-1/3 w-1/3 transition-colors duration-300 ${
                      isActive ? "text-white" : "text-[#276344]"
                    }`}
                    strokeWidth={isActive ? 2 : 1.8}
                  />
                </button>
              );
            })}
          </div>

          {/* Card informasi: hanya judul dan deskripsi prinsip yang dipilih. */}
          <article
            key={active.title}
            className="relative overflow-hidden rounded-2xl border border-[#E3EAE5] bg-white p-6 shadow-[0_3px_12px_rgba(20,85,58,0.04)] transition-all duration-300 sm:p-8"
          >
            <div className="pointer-events-none absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#F0F5F1] text-[#276344]">
              <ActiveIcon className="h-5 w-5" strokeWidth={1.8} />
            </div>
            <h3 className="relative pr-12 font-[Montserrat] text-xl font-bold text-[#1b1b1b] sm:text-2xl">
              {active.title}
            </h3>
            <p className="relative mt-4 text-sm leading-relaxed text-[#35433B] sm:text-base">
              {active.text}
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}

/* ========================= CTA ========================= */
function CtaSection() {
  return (
    <section className="relative overflow-hidden bg-white pt-14 pb-0 text-center md:pt-20">
      <div className={`relative z-10 ${container}`}>
        <h2 className="font-[Montserrat] text-2xl font-bold text-[#1e5b3a] sm:text-3xl md:text-4xl">
          Butuh Teman Bicara atau Bimbingan
          <span className="text-[#e0b83a]">?</span>
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-[#1e5b3a] sm:text-base md:text-lg">
          Jangan ragu untuk menghubungi kami. Tim psikolog & konselor BK Unika
          De La Salle Manado siap mendampingi anda.
        </p>
      </div>

      {/* Latar wave */}
      <div className="relative mt-12 h-48 md:h-72">
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
          <button className="flex items-center gap-2 rounded-md bg-[#2e9a5f] px-5 py-2.5 text-xs font-semibold text-white shadow-lg transition hover:bg-[#268050] sm:text-sm">
            <CalendarDays className="h-3.5 w-3.5" />
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
      <AboutHero />
      <VisiMisi />
      <FokusLayanan />
      <PrinsipLayanan />
      <CtaSection />
    </div>
  );
}
