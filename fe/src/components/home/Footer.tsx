import { Link, NavLink } from "react-router-dom";

const navigasi = [
  { label: "Beranda", to: "/" },
  { label: "Tentang Kami", to: "/tentang-kami" },
  { label: "Panduan", to: "/panduan" },
  { label: "Konselor", to: "/konselor" },
  { label: "Mood Tracker", to: "/mood-tracker" },
  { label: "Feedback", to: "/feedback" },
];

const informasi = [
  { label: "Beranda", to: "/" },
  { label: "Tentang Kami", to: "/tentang-kami" },
  { label: "Panduan", to: "/panduan" },
  { label: "Konselor", to: "/konselor" },
  { label: "Mood Tracker", to: "/mood-tracker" },
  { label: "Feedback", to: "/feedback" },
];

const bawah = [
  { label: "Kode Etik Psikologi HIMPSI", to: "/kode-etik" },
  { label: "Pedoman Privasi Sivitas", to: "/pedoman-privasi" },
  { label: "Fase: Portal Publik", to: "/" },
];

export default function Footer() {
  return (
    <footer className="bg-[#0c2619] text-white/85">
      {/* Bagian atas */}
      <div className="mx-auto w-[92%] pt-14 pb-12 sm:w-[90%] md:pt-20 lg:w-[90%] lg:pt-24">
        <div className="grid gap-12 text-center sm:grid-cols-2 lg:grid-cols-[1.25fr_1fr_1fr_1.2fr] lg:gap-10 lg:text-left">
          {/* Brand */}
          <div className="flex flex-col items-center lg:items-start">
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5"
            >
              <span className="text-2xl font-medium tracking-tight">
                <span className="font-semibold text-[#2d6a1f]">Si</span>
                <span className="text-[#1d3a86]">CARE</span>
              </span>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#1d3a86"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" />
                <path d="M8 10h8M8 13h5" />
              </svg>
            </Link>

            <p className="mt-6 text-base font-semibold text-[#d4a84b] sm:text-[17px]">
              Digital Counseling Information System
            </p>
            <p className="mt-2 text-[15px] text-white/85">
              Universitas Katolik De La Salle Manado
            </p>
            <p className="mt-6 max-w-[360px] text-[15px] leading-relaxed text-white/85">
              Layanan konseling psikologis berbasis nilai Lasallian yang
              mengutamakan rasa aman, kerahasiaan, empati, serta pertumbuhan
              pribadi bagi sivitas akademika.
            </p>
          </div>

          {/* Navigasi halaman */}
          <div>
            <h3 className="text-base font-bold uppercase tracking-wide text-[#d4a84b] sm:text-[17px]">
              Navigasi Halaman
            </h3>
            <ul className="mt-7 flex flex-col gap-5">
              {navigasi.map((item) => (
                <li key={item.label}>
                  <NavLink
                    to={item.to}
                    end={item.to === "/"}
                    className={({ isActive }) =>
                      `text-[15px] text-white/85 transition hover:text-white ${
                        isActive
                          ? "font-bold underline underline-offset-4 text-white"
                          : "font-normal"
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>

          {/* Informasi */}
          <div>
            <h3 className="text-base font-bold uppercase tracking-wide text-[#d4a84b] sm:text-[17px]">
              Informasi
            </h3>
            <ul className="mt-7 flex flex-col gap-5">
              {informasi.map((item) => (
                <li key={item.label}>
                  <NavLink
                    to={item.to}
                    end={item.to === "/"}
                    className={({ isActive }) =>
                      `text-[15px] text-white/85 transition hover:text-white ${
                        isActive
                          ? "font-bold underline underline-offset-4 text-white"
                          : "font-normal"
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>

          {/* Kontak */}
          <div className="flex flex-col items-center lg:items-start">
            <h3 className="text-base font-bold uppercase tracking-wide text-[#d4a84b] sm:text-[17px]">
              Kontak &amp; Pusat Bantuan
            </h3>
            <address className="mt-7 not-italic text-[15px] leading-relaxed text-white/85">
              Kairagi I, Kombos, Kec.
              <br />
              Mapanget, Kota Manado,
              <br />
              Sulawesi Utara 95254
            </address>
            <a
              href="mailto:konseling@unikadelasalle.ac.id"
              className="mt-6 text-[15px] text-white/85 transition hover:text-white"
            >
              konseling@unikadelasalle.ac.id
            </a>
            <a
              href="tel:+62431815250"
              className="mt-8 text-[15px] text-white/85 transition hover:text-white"
            >
              (0431) 815250 / Ext. LMI 204
            </a>
          </div>
        </div>
      </div>

      {/* Garis pemisah & bagian bawah */}
      <div className="mx-auto w-[95%] border-t border-white/80 pb-10 pt-8 sm:w-[95%]">
        <div className="flex flex-col gap-4 text-center text-[15px] text-white/85 lg:flex-row lg:items-center lg:justify-between lg:text-left">
          <p>
            © 2025 Universitas Katolik De La Salle Manado. Hak Cipta Dilindungi
            Undang-Undang.
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-10 lg:justify-end">
            {bawah.map((item) => (
              <Link
                key={item.label}
                to={item.to}
                className="transition hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
