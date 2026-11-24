import AuthBackground from "../components/auth/AuthBackground";
import { useLayoutEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import BrandMark from "../components/brand/BrandMark";
import NotificationBell from "../components/shared/NotificationBell";
import NavbarProfileDropdown from "../components/shared/NavbarProfileDropdown";
import {
  Activity,
  CalendarDays,
  History,
  Home,
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
    to: "/klien/permintaan",
    label: "Permintaan Konseling",
    short: "Permintaan",
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
    <div className="relative isolate min-h-screen bg-bg pb-24 font-sans text-gray-900 antialiased lg:pb-0">
      {/* Latar dekoratif sama dengan halaman login; tetap di tempat saat halaman digulir. */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10">
        <AuthBackground />
        {/* Lapisan putih tipis agar latar lebih terang di halaman yang padat konten */}
        <div className="absolute inset-0 bg-white/55" />
      </div>

      {/* ================= NAVBAR ================= */}
      <header className="sticky top-0 z-50 px-3 pt-2 sm:px-5">
        <div className="relative mx-auto flex h-14 w-full max-w-7xl items-center justify-between rounded-full bg-white/90 px-4 shadow-[0_18px_40px_rgba(0,0,0,0.12)] backdrop-blur sm:h-16 sm:px-5 lg:px-6">
          <NavLink to="/" className="flex min-w-0 items-center gap-2 sm:gap-3">
            <BrandMark />
          </NavLink>

          <DesktopNav />

          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <NotificationBell
              role="client"
              wrapperClassName="relative shrink-0"
              buttonClassName="flex h-10 w-10 items-center justify-center rounded-full text-slate-700 transition-colors hover:bg-gray-100 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            />
            <NavbarProfileDropdown role="client" wrapperClassName="shrink-0" />
          </div>
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
                      ? "font-semibold text-primary"
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
      <main className="mx-auto w-[92%] max-w-6xl pb-12 pt-6 sm:w-[88%] sm:pt-8 lg:w-[84%]">
        <Outlet />
      </main>
    </div>
  );
}

/**
 * Navigasi desktop: bobot huruf tetap sama saat aktif (tidak "membesar"), dan garis bawah
 * meluncur ke menu yang aktif saat diklik.
 */
function DesktopNav() {
  const { pathname } = useLocation();
  const navRef = useRef<HTMLElement>(null);
  const [bar, setBar] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const measure = () => {
      const active = nav.querySelector<HTMLElement>('a[aria-current="page"]');
      setBar(active ? { left: active.offsetLeft, width: active.offsetWidth } : null);
    };
    measure();
    window.addEventListener("resize", measure);
    void document.fonts?.ready.then(measure);
    return () => window.removeEventListener("resize", measure);
  }, [pathname]);

  return (
    <nav
      ref={navRef}
      className="relative hidden items-center gap-6 font-display text-[13px] font-medium text-gray-900 lg:flex xl:gap-10"
    >
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === "/klien"}
          className={({ isActive }) =>
            `py-1 transition-colors duration-200 ${isActive ? "text-primary" : "hover:text-primary"}`
          }
        >
          {item.label}
        </NavLink>
      ))}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute -bottom-0.5 h-0.5 rounded-full bg-primary transition-all duration-300 ease-out ${bar ? "opacity-100" : "opacity-0"}`}
        style={{ left: bar?.left ?? 0, width: bar?.width ?? 0 }}
      />
    </nav>
  );
}
