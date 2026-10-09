import { Link, useNavigate } from "react-router-dom";
import { Mail, Phone, MapPin } from "lucide-react";

// Brand icons removed from lucide-react v0.277+ due to trademark policy
const InstagramIcon = ({ size = 18 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
  </svg>
);

const TwitterIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const LinkedInIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
    <rect x="2" y="9" width="4" height="12" />
    <circle cx="4" cy="4" r="2" />
  </svg>
);

const NAV_LINKS = [
  { label: "Beranda", href: "#hero" },
  { label: "Tentang Kami", href: "#about" },
  { label: "Panduan", href: "#process" },
  { label: "Konselor", href: "#counselors" },
  { label: "Mood Tracker", href: "/mood" },
  { label: "Feedback", href: "/feedback" },
];

const LEGAL_LINKS = [
  { label: "Kebijakan Privasi", href: "/privacy" },
  { label: "Kode Etik", href: "/ethics" },
  { label: "Syarat Penggunaan", href: "/terms" },
];

export default function Footer() {
  const navigate = useNavigate();

  const handleNavClick = (href: string) => {
    if (href.startsWith("#")) {
      const el = document.querySelector(href);
      el?.scrollIntoView({ behavior: "smooth" });
    } else {
      navigate(href);
    }
  };

  return (
    <footer id="footer" className="bg-primary text-white">
      {/* Top section */}
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="lg:col-span-2">
            {/* Logo */}
            <div className="flex items-center gap-2 mb-5">
              <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm">
                <span className="text-[#064E3B] font-black text-sm tracking-tight">
                  Si
                </span>
              </div>
              <span className="font-black text-2xl text-white tracking-tight">
                Si<span className="text-[#DFF5E8]">CARE</span>
              </span>
            </div>

            <p className="text-green-200 text-sm leading-relaxed mb-6 max-w-xs font-medium">
              Sistem Informasi Konseling Universitas. Platform konseling digital
              yang aman, profesional, dan mudah diakses oleh seluruh mahasiswa.
            </p>

            {/* Social links */}
            <div className="flex gap-3">
              {[
                {
                  icon: <InstagramIcon size={18} />,
                  label: "Instagram",
                  href: "#",
                },
                {
                  icon: <TwitterIcon size={18} />,
                  label: "Twitter",
                  href: "#",
                },
                {
                  icon: <LinkedInIcon size={18} />,
                  label: "LinkedIn",
                  href: "#",
                },
              ].map(({ icon, label, href }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center text-green-200 hover:text-white transition-all duration-200 hover:-translate-y-0.5"
                >
                  {icon}
                </a>
              ))}
            </div>
          </div>

          {/* Navigation */}
          <div>
            <h4 className="font-bold text-sm text-white mb-5 tracking-wide uppercase">
              Navigasi
            </h4>
            <ul className="space-y-3">
              {NAV_LINKS.map((link) => (
                <li key={link.label}>
                  <button
                    onClick={() => handleNavClick(link.href)}
                    className="text-sm text-green-200 hover:text-white font-medium transition-colors duration-200 hover:translate-x-1 inline-block transition-transform cursor-pointer"
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-bold text-sm text-white mb-5 tracking-wide uppercase">
              Kontak & Pusat Bantuan
            </h4>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Mail size={14} className="text-green-200" />
                </div>
                <div>
                  <p className="text-xs text-green-300 mb-0.5">Email</p>
                  <a
                    href="mailto:sicare@university.ac.id"
                    className="text-sm text-green-100 hover:text-white transition-colors font-medium"
                  >
                    sicare@university.ac.id
                  </a>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Phone size={14} className="text-green-200" />
                </div>
                <div>
                  <p className="text-xs text-green-300 mb-0.5">Telepon</p>
                  <a
                    href="tel:+6282100000000"
                    className="text-sm text-green-100 hover:text-white transition-colors font-medium"
                  >
                    +62 821 0000 0000
                  </a>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
                  <MapPin size={14} className="text-green-200" />
                </div>
                <div>
                  <p className="text-xs text-green-300 mb-0.5">Lokasi</p>
                  <p className="text-sm text-green-100 font-medium leading-snug">
                    Gedung Biro Kemahasiswaan, Lantai 2
                  </p>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* CTA Banner */}
      <div className="border-t border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="font-bold text-lg text-white mb-1">
              Siap Memulai Perjalananmu?
            </h3>
            <p className="text-green-200 text-sm font-medium">
              Langkah pertama selalu yang paling berarti.
            </p>
          </div>
          <button
            id="footer-cta-btn"
            onClick={() => navigate("/login")}
            className="shrink-0 bg-white hover:bg-[#DFF5E8] text-[#064E3B] font-bold px-8 py-3.5 rounded-2xl transition-all duration-200 hover:-translate-y-0.5 shadow-lg cursor-pointer"
          >
            Mulai Konseling Sekarang
          </button>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-green-300 font-medium">
            © {new Date().getFullYear()} SiCARE – Sistem Informasi Konseling.
            Hak Cipta Dilindungi.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            {LEGAL_LINKS.map((link) => (
              <Link
                key={link.label}
                to={link.href}
                className="text-xs text-green-300 hover:text-white font-medium transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
