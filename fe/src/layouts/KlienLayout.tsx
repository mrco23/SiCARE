import { NavLink, Outlet } from "react-router-dom";
import {
  Activity,
  CalendarDays,
  History,
  Home,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";

/* ========================= MENU ========================= */
const NAV_ITEMS: {
  to: string;
  label: string;
  short: string;
  icon: LucideIcon;
}[] = [
  { to: "/klien", label: "Beranda", short: "Beranda", icon: Home },
  {
    to: "/klien/pesanan",
    label: "Pesanan Konseling",
    short: "Pesanan",
    icon: CalendarDays,
  },
  { to: "/klien/konselor", label: "Konselor", short: "Konselor", icon: Users },
  {
    to: "/klien/aktivitas",
    label: "Aktivitas Saya",
    short: "Aktivitas",
    icon: Activity,
  },
  { to: "/klien/riwayat", label: "Riwayat", short: "Riwayat", icon: History },
];

export default function KlienLayout() {
  return (
    <div className="min-h-screen bg-gray-50 pb-24 font-sans text-gray-900 antialiased lg:pb-0">
      {/* ================= NAVBAR ================= */}
      <header className="sticky top-0 z-50 px-3 pt-2 sm:px-5">
        <div className="relative mx-auto flex h-14 w-full max-w-7xl items-center justify-between rounded-full bg-white/90 px-4 shadow-[0_18px_40px_rgba(0,0,0,0.12)] backdrop-blur sm:h-16 sm:px-5 lg:px-6">
          <NavLink
            to="/klien/beranda"
            className="flex min-w-0 items-center gap-2 sm:gap-3"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-[1.5px] border-[#c9a54a] bg-white sm:h-10 sm:w-10">
              <img
                src="/icon-512x512.png"
                alt="Logo Unika De La Salle Manado"
                className="h-6 w-6 rounded-full object-contain sm:h-7 sm:w-7"
              />
            </div>
            <div className="min-w-0">
              <div className="text-lg font-semibold leading-none sm:text-xl">
                <span className="text-[#2d6a1f]">Si</span>
                <span className="text-blue-900">CARE</span>
              </div>
              <p className="mt-1 truncate text-[10px] font-semibold text-[#2b2b2b] sm:text-[11px]">
                Universitas Katolik De La Salle Manado
              </p>
            </div>
          </NavLink>

          <nav className="hidden items-center gap-6 font-display text-[15px] text-gray-900 lg:flex xl:gap-10">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/klien"}
                className={({ isActive }) =>
                  isActive
                    ? "border-b-2 border-[#1e5b3a] pb-1 font-semibold text-[#1e5b3a]"
                    : "hover:text-[#1e5b3a]"
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <NavLink
            to="/klien/profil"
            aria-label="Profil"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-200 text-gray-700 ring-2 ring-white sm:h-10 sm:w-10"
          >
            <UserRound className="h-5 w-5" strokeWidth={1.6} />
          </NavLink>
        </div>
      </header>

      {/* ================= NAVIGASI BAWAH (MOBILE) ================= */}
      <nav
        aria-label="Navigasi utama"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-gray-200 bg-white/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        <div className="mx-auto grid max-w-md grid-cols-5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/klien"}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-0.5 py-2 text-[11px] ${
                    isActive
                      ? "font-semibold text-[#1e5b3a]"
                      : "font-medium text-gray-500"
                  }`
                }
              >
                <Icon className="h-5 w-5" strokeWidth={1.8} />
                {item.short}
              </NavLink>
            );
          })}
        </div>
      </nav>

      {/* ================= KONTEN HALAMAN ================= */}
      <main className="mx-auto w-[92%] max-w-7xl pb-12 pt-6 sm:w-[88%] sm:pt-8 lg:w-[86%]">
        <Outlet />
      </main>
    </div>
  );
}
