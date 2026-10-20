import { useState, type ReactNode } from "react";
import {
  Bell,
  FileChartColumnIncreasing,
  LayoutDashboard,
  MessageSquareHeart,
  MessageSquareText,
  MoreHorizontal,
  Settings,
  X,
} from "lucide-react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";

const SIDEBAR_W = 248;
const NAVBAR_H = 72;

type MenuItem = {
  label: string;
  short: string;
  icon: (props: { className?: string }) => ReactNode;
  to: string;
  end?: boolean;
};

const menuItems: MenuItem[] = [
  {
    label: "Beranda",
    short: "Beranda",
    icon: LayoutDashboard,
    to: "/kepala-lmi",
    end: true,
  },
  {
    label: "Laporan",
    short: "Laporan",
    icon: FileChartColumnIncreasing,
    to: "/kepala-lmi/laporan",
  },
  {
    label: "Feedback",
    short: "Feedback",
    icon: MessageSquareHeart,
    to: "/kepala-lmi/feedback",
  },
  {
    label: "Pengaturan",
    short: "Pengaturan",
    icon: Settings,
    to: "/kepala-lmi/pengaturan",
  },
];

/* Navigasi yang tampil langsung di bagian bawah pada mobile dan tablet. */
const bottomNavItems: MenuItem[] = [
  menuItems[0], // Beranda
  menuItems[1], // Laporan
  menuItems[2], // Feedback
];

const MORE_ROUTES = ["/kepala-lmi/pengaturan"];

export default function KepalaLMILayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { pathname } = useLocation();
  const moreActive = MORE_ROUTES.some((route) => pathname.startsWith(route));

  return (
    <div className="min-h-screen bg-white font-[Inter]">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {sidebarOpen && (
        <button
          type="button"
          aria-label="Tutup menu"
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Navbar />

      <main
        className="min-h-screen min-w-0 pb-24 lg:ml-[248px] lg:pb-0"
        style={{ paddingTop: NAVBAR_H }}
      >
        <div className="p-4 sm:p-6">
          <Outlet />
        </div>
      </main>

      <BottomNav onMore={() => setSidebarOpen(true)} moreActive={moreActive} />
    </div>
  );
}

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <aside
      style={{ width: SIDEBAR_W }}
      aria-label="Sidebar Kepala LMI"
      className={`fixed inset-y-0 left-0 z-40 border-r border-[#d9d9d9] bg-white font-[Inter] transition-transform duration-300 lg:translate-x-0 ${
        open ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <Link
        to="/"
        onClick={onClose}
        className="absolute left-5 top-4.5 flex items-center gap-2.5"
        aria-label="SiCARE, ke halaman utama"
      >
        <div className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-[#c9a54a] bg-white">
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

      <nav
        aria-label="Menu Kepala LMI"
        className="absolute left-[20px] right-5 top-[88px] flex flex-col gap-[17px]"
      >
        {menuItems.map(({ label, icon: Icon, to, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onClose}
            className={({ isActive }) =>
              `flex min-h-[34px] items-center gap-[10px] rounded-[6px] px-2 text-[13px] font-semibold leading-none transition-colors ${
                isActive
                  ? "bg-[#e6fdee] text-[#14553a]"
                  : "text-[#424242] hover:bg-[#f3fdf7] hover:text-[#14553a]"
              }`
            }
          >
            <Icon className="h-[16px] w-[16px] shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      <button
        type="button"
        onClick={onClose}
        className="absolute right-3 top-4 rounded-lg p-1 text-slate-600 hover:bg-slate-100 lg:hidden"
        aria-label="Tutup menu"
      >
        <X className="h-5 w-5" />
      </button>
    </aside>
  );
}

/* Navbar disamakan dengan AdminLayout, termasuk dekorasi tiga gunung hijau. */
function Navbar() {
  return (
    <header
      style={{ height: NAVBAR_H }}
      className="fixed left-0 right-0 top-0 z-30 overflow-hidden border-b border-[#d9d9d9] bg-white shadow-[0_8px_20px_rgba(0,0,0,0.05)] lg:left-[248px]"
    >
      <Link
        to="/kepala-lmi"
        className="absolute left-4 top-1/2 flex -translate-y-1/2 items-center gap-2 lg:hidden"
        aria-label="SiCARE, ke beranda Kepala LMI"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-[1.5px] border-[#c9a54a] bg-white">
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

      <button
        type="button"
        aria-label="Notifikasi"
        className="absolute right-[168px] top-[26px] text-[#333] transition-colors hover:text-[#14553a]"
      >
        <Bell
          className="h-[19px] w-[19px]"
          fill="currentColor"
          strokeWidth={1.5}
        />
      </button>

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

      <img
        src="/gio.jpeg"
        alt="Profil"
        className="absolute right-[14px] top-[16px] h-[40px] w-[40px] rounded-full border-[2px] border-white object-cover shadow-md ring-1 ring-gray-300"
      />
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
      <div className="mx-auto grid max-w-md grid-cols-4">
        {bottomNavItems.map(({ short, to, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-2 text-[11px] ${
                isActive
                  ? "font-semibold text-[#14553a]"
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
          aria-expanded={moreActive}
          className={`flex flex-col items-center gap-0.5 py-2 text-[11px] ${
            moreActive
              ? "font-semibold text-[#14553a]"
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
