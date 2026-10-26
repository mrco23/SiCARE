import { useState } from "react";
import { Outlet, Link, NavLink, useLocation } from "react-router-dom";
import NotificationBell from "../components/shared/NotificationBell";
import { DEMO_NOTIFICATION_RECIPIENTS } from "../features/notification/notificationStore";

import {
  CalendarDays,
  Clock,
  Home,
  MessageSquareText,
  MessagesSquare,
  MoreHorizontal,
  Settings,
  SquarePen,
  X,
  Star,
  CircleUserRound,
  type LucideIcon,
} from "lucide-react";


/* ========================= MENU (sidebar desktop + drawer mobile) ========================= */
const menuItems = [
  { label: "Beranda", to: "/konselor", icon: Home, end: true },
  { label: "Aktivitas Saya", to: "/konselor/aktivitas", icon: Clock },
  { label: "Permintaan", to: "/konselor/permintaan", icon: MessagesSquare },
  {
    label: "Jadwal & Ketersediaan",
    to: "/konselor/jadwal",
    icon: CalendarDays,
  },
  { label: "Riwayat Konseling", to: "/konselor/riwayat", icon: SquarePen },
  { label: "Feedback", to: "/konselor/feedback", icon: Star },
  { label: "Pengaturan", to: "/konselor/pengaturan", icon: Settings },
];

/* ========================= MENU NAVIGASI BAWAH (MOBILE) ========================= */
const bottomNavItems: {
  label: string;
  short: string;
  to: string;
  icon: LucideIcon;
  end?: boolean;
}[] = [
  {
    label: "Beranda",
    short: "Beranda",
    to: "/konselor",
    icon: Home,
    end: true,
  },
  {
    label: "Aktivitas Saya",
    short: "Aktivitas",
    to: "/konselor/aktivitas",
    icon: Clock,
  },
  {
    label: "Permintaan",
    short: "Permintaan",
    to: "/konselor/permintaan",
    icon: MessagesSquare,
  },
  {
    label: "Jadwal & Ketersediaan",
    short: "Jadwal",
    to: "/konselor/jadwal",
    icon: CalendarDays,
  },
];

// Rute yang hanya bisa diakses lewat drawer "Lainnya"
const MORE_ROUTES = [
  "/konselor/riwayat",
  "/konselor/feedback",
  "/konselor/pengaturan",
];

export default function KonselorLayout() {
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

function Navbar() {
  return (
    <header
      className="layout-navbar fixed right-0 top-0 left-0 z-30 overflow-visible border-b border-[#d9d9d9] bg-white shadow-[0_8px_20px_rgba(0,0,0,0.05)] lg:left-[248px]"
    >
      {/* logo mobile (di desktop logo sudah ada di sidebar) */}
      <Link
        to="/konselor"
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
          <span className="text-brand-mark">Si</span>
          <span className="text-blue-900">CARE</span>
        </span>
      </Link>

      {/* notification */}
      <NotificationBell
        role="counselor"
        recipientId={DEMO_NOTIFICATION_RECIPIENTS.counselor}
        wrapperClassName="absolute right-[168px] top-[16px] z-50"
        buttonClassName="h-10 w-10"
      />

      {/* mountain */}
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

      {/* profile */}
      <Link
        to="/konselor/pengaturan"
        className="absolute right-[14px] top-[16px] flex h-[40px] w-[40px] items-center justify-center rounded-full border-[2px] border-white bg-primary text-white shadow-md ring-1 ring-gray-300"
      >
        <CircleUserRound className="h-6 w-6" strokeWidth={1.6} />
      </Link>
    </header>
  );
}

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
            <Icon className="h-5 w-5" strokeWidth={1.8} />
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

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <aside
      className={`layout-sidebar fixed inset-y-0 left-0 z-40 border-r border-[#d9d9d9] bg-white font-[Inter] transition-transform duration-300 lg:translate-x-0 ${
        open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      }`}
    >
      {/* Logo */}
      <Link
        to="/"
        onClick={onClose}
        className="absolute left-[20px] top-[18px] flex items-center gap-2.5"
      >
        <div className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-brand-gold bg-white">
          <img
            src="/icon-512x512.png"
            alt="Logo SiCARE"
            className="h-[37px] w-[37px] rounded-full object-contain"
          />
        </div>
        <div className="flex items-start text-[22px] font-semibold leading-none tracking-tight">
          <span className="text-brand-mark">Si</span>
          <span className="text-blue-900">CARE</span>
          <MessageSquareText
            className="ml-1 -mt-1 h-3 w-3 text-blue-900"
            strokeWidth={2.5}
          />
        </div>
      </Link>

      <nav className="absolute left-[20px] top-[88px] flex w-[207px] flex-col gap-[17px]">
        {menuItems.map(({ label, icon: Icon, to, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onClose}
            className={({ isActive }) =>
              `flex h-[30px] items-center gap-[10px] rounded-[6px] pl-[5px] text-[13px] font-semibold ${
                isActive
                  ? "bg-primary-subtle text-primary"
                  : "text-[#424242] hover:bg-primary-surface"
              }`
            }
          >
            <Icon className="h-[15px] w-[15px] shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

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
