import { useState } from "react";
import { Outlet, Link, NavLink } from "react-router-dom";

import {
  Bell,
  CalendarDays,
  Clock,
  Home,
  Menu,
  MessageSquareText,
  MessagesSquare,
  Settings,
  SquarePen,
  X,
  Star,
  CircleUserRound,
} from "lucide-react";

const SIDEBAR_W = 248;
const NAVBAR_H = 72;

const menuItems = [
  { label: "Beranda", to: "/konselor", icon: Home, end: true },
  { label: "Aktivitas Saya", to: "/konselor/aktivitas", icon: Clock },
  { label: "Permintaan", to: "/konselor/permintaan", icon: MessagesSquare },
  {
    label: "Jadwal & Ketersediaan",
    to: "/konselor/jadwal",
    icon: CalendarDays,
  },
  {
    label: "Riwayat Konseling",
    to: "/konselor/riwayat",
    icon: SquarePen,
  },
  {
    label: "Feedback",
    to: "/konselor/feedback",
    icon: Star,
  },
  {
    label: "Pengaturan",
    to: "/konselor/pengaturan",
    icon: Settings,
  },
];

export default function CounselorLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white font-[Inter]">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {sidebarOpen && (
        <div
          className="
          fixed inset-0 
          z-30 
          bg-black/30 
          lg:hidden
          "
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Navbar onMenuClick={() => setSidebarOpen(true)} />

      <main
        className="min-h-screen min-w-0 lg:ml-[248px]"
        style={{ paddingTop: NAVBAR_H }}
      >
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function Navbar({ onMenuClick }: { onMenuClick: () => void }) {
  return (
    <header
      style={{ height: NAVBAR_H }}
      className="
fixed right-0 top-0
left-0 lg:left-[248px]
z-30
overflow-hidden
border-b
border-[#d9d9d9]
bg-white
shadow-[0_8px_20px_rgba(0,0,0,0.05)]
"
    >
      {/* mobile menu */}

      <button
        onClick={onMenuClick}
        className="
absolute left-4 top-[16px]
flex h-10 w-10
items-center justify-center
rounded-lg
lg:hidden
"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* notification */}

      <button
        type="button"
        className="
absolute
right-[168px]
top-[26px]
text-[#333]
transition-colors
hover:text-[#14553a]
"
      >
        <Bell
          className="
h-[19px]
w-[19px]
"
          fill="currentColor"
          strokeWidth={1.5}
        />
      </button>

      {/* mountain */}

      <svg
        className="
pointer-events-none
absolute
right-0
top-0
"
        width="162"
        height="72"
        viewBox="0 0 234 104"
        aria-hidden="true"
      >
        <path
          d="
M0 102
L78 30
Q89 19 100 27
L130 56
L130 102
Z
"
          fill="#2a8f5a"
        />

        <path
          d="
M54 102
L150 14
Q163 3 176 14
L192 30
L192 102
Z
"
          fill="#1f7a4d"
        />

        <path
          d="
M110 102
L199 0
L234 0
L234 74
Q234 102 206 102
Z
"
          fill="#14553a"
        />
      </svg>

      {/* profile */}

      <Link
        to="/konselor/profil"
        className="
absolute
right-[14px]
top-[16px]
flex
h-[40px]
w-[40px]
items-center
justify-center
rounded-full
bg-[#185032]
text-white
border-[2px]
border-white
shadow-md
ring-1
ring-gray-300
"
      >
        <CircleUserRound className="h-6 w-6" strokeWidth={1.6} />
      </Link>
    </header>
  );
}

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <aside
      style={{
        width: SIDEBAR_W,
      }}
      className={`
fixed inset-y-0 left-0
z-40
border-r
border-[#d9d9d9]
bg-white
transition-transform
duration-300

font-[Inter]

lg:translate-x-0

${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}

`}
    >
      {/* Logo */}

      <Link
        to="/"
        onClick={onClose}
        className="
absolute
left-[20px]
top-[18px]
flex
items-center
gap-2.5
"
      >
        <div
          className="
flex
h-[46px]
w-[46px]
shrink-0
items-center
justify-center
rounded-full
border-[1.5px]
border-[#c9a54a]
bg-white
"
        >
          <img
            src="/android-192x192.png"
            className="
h-[37px]
w-[37px]
rounded-full
object-contain
"
          />
        </div>

        <div
          className="
flex
items-start
text-[22px]
font-semibold
leading-none
tracking-tight
"
        >
          <span className="text-[#2d6a1f]">Si</span>

          <span className="text-blue-900">CARE</span>

          <MessageSquareText
            className="
ml-1
-mt-1
h-3
w-3
text-blue-900
"
            strokeWidth={2.5}
          />
        </div>
      </Link>

      <nav
        className="
absolute
left-[20px]
top-[88px]
flex
w-[207px]
flex-col
gap-[17px]
"
      >
        {menuItems.map(({ label, icon: Icon, to, end }) => (
          <NavLink
            key={label}
            to={to}
            end={end}
            onClick={onClose}
            className={({ isActive }) =>
              `
flex
h-[30px]
items-center
gap-[10px]
rounded-[6px]
pl-[5px]
text-[13px]
font-semibold

${
  isActive ? "bg-[#e6fdee] text-[#14553a]" : "text-[#424242] hover:bg-[#f3fdf7]"
}

`
            }
          >
            <Icon
              className="
h-[15px]
w-[15px]
shrink-0
"
            />

            {label}
          </NavLink>
        ))}
      </nav>

      <button
        onClick={onClose}
        className="
absolute
right-3
top-4
lg:hidden
"
      >
        <X className="h-5 w-5" />
      </button>
    </aside>
  );
}
