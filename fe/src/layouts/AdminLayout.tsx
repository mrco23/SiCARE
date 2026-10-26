import { useState } from "react";
import type { ReactNode } from "react";
import {
  Bell,
  CalendarDays,
  MessageSquareText,
  MoreHorizontal,
  X,
} from "lucide-react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";


/* ========================= IKON ========================= */
const svgBase = {
  viewBox: "0 0 24 24",
  fill: "none",
  xmlns: "http://www.w3.org/2000/svg",
  "aria-hidden": true,
} as const;

const IconHome = ({ className }: { className?: string }) => (
  <svg {...svgBase} className={className}>
    <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" fill="currentColor" />
  </svg>
);

const IconRequest = ({ className }: { className?: string }) => (
  <svg {...svgBase} className={className}>
    <path
      d="M21 11V4.5H3V17l3.8-3H11"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="17" cy="14.6" r="2.4" stroke="currentColor" strokeWidth="2" />
    <path
      d="M12.8 21.2c.4-2 2-3.1 4.2-3.1s3.8 1.1 4.2 3.1"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

const IconFeedback = ({ className }: { className?: string }) => (
  <svg {...svgBase} className={className}>
    <g
      stroke="currentColor"
      strokeWidth="3.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <g transform="translate(1.5 1) scale(0.52)">
        <path d="M7 10v12" />
        <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
      </g>
      <g transform="translate(10.5 10.5) scale(0.52)">
        <path d="M17 14V2" />
        <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z" />
      </g>
    </g>
  </svg>
);

const IconAccount = ({ className }: { className?: string }) => (
  <svg {...svgBase} className={className}>
    <circle cx="12" cy="8" r="4.2" fill="currentColor" />
    <path
      d="M3.8 20.5c0-3.7 3.7-6.2 8.2-6.2s8.2 2.5 8.2 6.2v.5H3.8z"
      fill="currentColor"
    />
  </svg>
);

const IconReport = ({ className }: { className?: string }) => (
  <svg {...svgBase} className={className}>
    <path
      d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
    />
    <path
      d="M14 3v5h5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
    />
    <path
      d="M9 17v-2.5M12 17v-5M15 17v-3.5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

const IconSettings = ({ className }: { className?: string }) => (
  <svg {...svgBase} className={className}>
    <path
      d="M12 2.8 20 7.4v9.2l-8 4.6-8-4.6V7.4z"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinejoin="round"
    />
    <circle cx="12" cy="12" r="3.4" stroke="currentColor" strokeWidth="2.4" />
    <circle cx="12" cy="12" r="1.1" fill="currentColor" />
  </svg>
);

type MenuItem = {
  label: string;
  short: string;
  icon: (props: { className?: string }) => ReactNode;
  to: string;
  end?: boolean;
};

/* ========================= MENU (sidebar desktop + drawer mobile) ========================= */
const menuItems: MenuItem[] = [
  {
    label: "Beranda",
    short: "Beranda",
    icon: IconHome,
    to: "/admin",
    end: true,
  },
  {
    label: "Konseling",
    short: "Konseling",
    icon: IconRequest,
    to: "/admin/konseling",
  },

  { label: "Akun", short: "Akun", icon: IconAccount, to: "/admin/akun" },
  {
    label: "Feedback",
    short: "Feedback",
    icon: IconFeedback,
    to: "/admin/feedback",
  },
  {
    label: "Laporan",
    short: "Laporan",
    icon: IconReport,
    to: "/admin/laporan",
  },
  {
    label: "Periode",
    short: "Periode",
    icon: CalendarDays,
    to: "/admin/periode",
  },
  {
    label: "Pengaturan",
    short: "Pengaturan",
    icon: IconSettings,
    to: "/admin/pengaturan",
  },
];

/* ========================= MENU NAVIGASI BAWAH (MOBILE) ========================= */
const bottomNavItems: MenuItem[] = [
  menuItems[0], // Beranda
  menuItems[1], // Konseling
  menuItems[3], // Akun
  menuItems[5], // Laporan
];

// Rute yang hanya bisa diakses lewat drawer "Lainnya"
const MORE_ROUTES = ["/admin/feedback", "/admin/pengaturan"];

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { pathname } = useLocation();
  const moreActive = MORE_ROUTES.some((p) => pathname.startsWith(p));

  return (
    <div className="min-h-screen bg-white font-[Inter]">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Navbar />

      <main
        className="layout-main-offset min-h-screen min-w-0 pb-24 lg:ml-[248px] lg:pb-0"
      >
        <div className="p-4 sm:p-6">
          <Outlet />
        </div>
      </main>

      <BottomNav onMore={() => setSidebarOpen(true)} moreActive={moreActive} />
    </div>
  );
}

/* ========================= SIDEBAR ========================= */
function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <aside
      className={`layout-sidebar fixed inset-y-0 left-0 z-40 border-r border-[#d9d9d9] bg-white font-[Inter] transition-transform duration-300 lg:translate-x-0 ${
        open ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      {/* Logo */}
      <Link
        to="/"
        onClick={onClose}
        className="absolute left-5 top-4.5 flex items-center gap-2.5"
      >
        <div className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-brand-gold bg-white">
          <img
            src="/icon-512x512.png"
            alt="Logo Universitas Katolik De La Salle Manado"
            className="h-[37px] w-[37px] rounded-full object-contain"
          />
        </div>
        <div className="flex items-start text-[22px] font-semibold leading-none tracking-tight">
          <span className="text-primary">Si</span>
          <span className="text-blue-900">CARE</span>
          <MessageSquareText
            className="-mt-1 ml-1 h-3 w-3 text-blue-900"
            strokeWidth={2.5}
          />
        </div>
      </Link>

      {/* Menu */}
      <nav className="absolute left-[20px] top-[88px] flex w-[207px] flex-col gap-[17px]">
        {menuItems.map(({ label, icon: Icon, to, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onClose}
            className={({ isActive }) =>
              `flex h-[30px] items-center gap-[10px] rounded-[6px] pl-[5px] text-[13px] font-semibold leading-none transition-colors ${
                isActive
                  ? "bg-primary-subtle text-primary"
                  : "text-[#424242] hover:bg-primary-surface hover:text-primary"
              }`
            }
          >
            <Icon className="h-[15px] w-[15px] shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Tombol tutup: hanya mobile & tablet */}
      <button
        onClick={onClose}
        className="absolute right-3 top-4 lg:hidden"
        aria-label="Tutup menu"
      >
        <X className="h-5 w-5" />
      </button>
    </aside>
  );
}

/* ========================= NAVBAR ========================= */
function Navbar() {
  return (
    <header
      className="layout-navbar fixed right-0 top-0 left-0 z-30 overflow-hidden border-b border-[#d9d9d9] bg-white shadow-[0_8px_20px_rgba(0,0,0,0.05)] lg:left-[248px]"
    >
      {/* Logo mobile (di desktop logo sudah ada di sidebar) */}
      <Link
        to="/admin"
        className="absolute left-4 top-1/2 flex -translate-y-1/2 items-center gap-2 lg:hidden"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-[1.5px] border-brand-gold bg-white">
          <img
            src="/icon-512x512.png"
            alt="Logo SiCARE"
            className="h-7 w-7 rounded-full object-contain"
          />
        </div>
        <span className="text-lg font-semibold leading-none">
          <span className="text-primary">Si</span>
          <span className="text-blue-900">CARE</span>
        </span>
      </Link>

      {/* Lonceng */}
      <button
        type="button"
        aria-label="Notifikasi"
        className="absolute right-[168px] top-[26px] text-[#333] transition-colors hover:text-primary"
      >
        <Bell
          className="h-[19px] w-[19px]"
          fill="currentColor"
          strokeWidth={1.5}
        />
      </button>

      {/* Dekorasi gunung hijau */}
      <svg
        className="pointer-events-none absolute right-0 top-0"
        width="162"
        height="72"
        viewBox="0 0 234 104"
        aria-hidden="true"
      >
        <path
          d="M0 102 L78 30 Q89 19 100 27 L130 56 L130 102 Z"
          fill="#2a8f5a"
        />
        <path
          d="M54 102 L150 14 Q163 3 176 14 L192 30 L192 102 Z"
          fill="#1f7a4d"
        />
        <path
          d="M110 102 L199 0 L234 0 L234 74 Q234 102 206 102 Z"
          fill="#14553a"
        />
      </svg>

      {/* Avatar */}
      <img
        src="/gio.jpeg"
        alt="Profil"
        className="absolute right-[14px] top-[16px] h-[40px] w-[40px] rounded-full border-[2px] border-white object-cover shadow-md ring-1 ring-gray-300"
      />
    </header>
  );
}

/* ========================= BOTTOM NAV (MOBILE) ========================= */
function BottomNav({
  onMore,
  moreActive,
}: {
  onMore: () => void;
  moreActive: boolean;
}) {
  return (
    <nav
      aria-label="Navigasi utama"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-[#d9d9d9] bg-white/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <div className="mx-auto grid max-w-md grid-cols-5">
        {bottomNavItems.map(({ short, to, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-2 text-[11px] ${
                isActive
                  ? "font-semibold text-primary"
                  : "font-medium text-gray-500"
              }`
            }
          >
            <Icon className="h-5 w-5" />
            {short}
          </NavLink>
        ))}

        <button
          type="button"
          onClick={onMore}
          className={`flex flex-col items-center gap-0.5 py-2 text-[11px] ${
            moreActive
              ? "font-semibold text-primary"
              : "font-medium text-gray-500"
          }`}
        >
          <MoreHorizontal className="h-5 w-5" strokeWidth={1.8} />
          Lainnya
        </button>
      </div>
    </nav>
  );
}
