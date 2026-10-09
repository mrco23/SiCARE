import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { CircleUserRound, Menu, MessageSquareText, X } from "lucide-react";

const navLinks = [
  { label: "Tentang kami", to: "/tentang-kami" },
  { label: "Panduan", to: "/panduan" },
  { label: "Konselor", to: "/konselor" },
  { label: "Mood Tracker", to: "/mood-tracker" },
  { label: "Feedback", to: "/feedback" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="relative z-50 w-full">
      <div
        className="relative mx-auto flex h-16 w-[92%] items-center justify-between rounded-b-[22px] px-4 shadow-[0_18px_40px_rgba(0,0,0,0.12)] sm:w-[88%] sm:px-6 md:h-20 lg:w-[86%] lg:px-8"
        style={{
          background:
            "linear-gradient(90deg, #f6f1ec 0%, #f3e9e2 50%, #efe4dd 100%)",
        }}
      >
        {/* Latar: blur blobs & gunung (dipotong sesuai sudut bar) */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-b-[22px]">
          <div className="absolute -left-10 -top-10 h-24 w-40 rounded-full bg-white/60 blur-2xl" />
          <div className="absolute left-1/3 top-0 h-16 w-40 rounded-full bg-white/60 blur-2xl" />
          <div className="absolute right-1/3 top-0 h-16 w-48 rounded-full bg-white/60 blur-2xl" />

          {/* Gunung: hanya tampil di desktop */}
          <svg
            width="170"
            height="95"
            viewBox="0 0 170 76"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="absolute -top-1 right-0 hidden h-auto w-42.5 lg:block"
          >
            <path
              d="M59.5569 18.6848C62.4072 16.5369 66.3356 16.5369 69.186 18.6848L125.542 61.1524C131.674 65.7737 128.406 75.5415 120.727 75.5415H8.01556C0.336674 75.5415 -2.93159 65.7737 3.20101 61.1524L59.5569 18.6848Z"
              fill="#288754"
            />
            <path
              d="M107.137 11.3889C112.403 7.38146 119.981 11.1375 119.981 17.7554V67.5415C119.981 71.9598 116.399 75.5415 111.981 75.5415H46.5499C38.8899 75.5415 35.6096 65.8133 41.7056 61.1749L107.137 11.3889Z"
              fill="#236C44"
            />
            <path
              d="M169.198 54.4917C169.181 54.6467 169.17 54.8046 169.169 54.965C169.116 55.3788 169.087 55.7003 168.903 56.7078C168.873 56.8707 168.847 57.0215 168.825 57.149C168.801 57.2841 168.785 57.3806 168.768 57.4721C168.733 57.6688 168.724 57.6863 168.738 57.639C168.625 58.0348 168.558 58.4308 168.531 58.5761C168.496 58.7695 168.464 58.937 168.411 59.1588C168.326 59.5168 168.188 60.1677 168.07 60.7285C167.977 61.1694 167.843 61.6003 167.691 62.0242C167.59 62.3044 167.502 62.5663 167.422 62.8071C167.378 62.9398 167.316 63.0659 167.24 63.1831C167.137 63.3406 167.017 63.5277 166.891 63.7317C166.755 63.9531 166.617 64.1807 166.531 64.3217C166.483 64.3999 166.447 64.4584 166.418 64.504C166.398 64.5366 166.387 64.5534 166.383 64.5586C166.302 64.6783 166.233 64.7886 166.183 64.8686C166.158 64.909 166.133 64.9488 166.114 64.9801C166.093 65.014 166.078 65.04 166.062 65.0662C166.002 65.1625 165.968 65.214 165.933 65.2616C165.812 65.4271 165.708 65.5844 165.665 65.6496C165.615 65.7242 165.588 65.7637 165.554 65.8107C165.514 65.8641 165.452 65.9477 165.093 66.3664C165.039 66.4291 164.969 66.5068 164.825 66.6668C164.72 66.7831 164.533 66.9905 164.374 67.1919C164.325 67.2542 164.26 67.3297 164.119 67.4945C163.992 67.6417 163.821 67.8416 163.635 68.0735C163.6 68.1169 163.571 68.1535 163.547 68.1829C163.522 68.2146 163.509 68.231 163.498 68.2456C163.477 68.2714 163.496 68.2468 163.527 68.2113C163.393 68.3637 163.272 68.5044 163.014 68.8049C162.9 68.9384 162.807 69.0499 162.689 69.1841C162.569 69.3216 162.5 69.3952 162.477 69.4175C161.815 70.0695 161.893 70.0097 161.71 70.1853C161.66 70.2327 161.606 70.2832 161.523 70.3596C161.455 70.4213 161.34 70.5263 161.233 70.6309C160.992 70.8662 160.827 71.0148 160.76 71.0655C160.577 71.2045 160.514 71.2498 160.272 71.4214C159.986 71.6236 159.952 71.6652 159.654 71.8531C159.466 71.9712 159.136 72.1723 158.958 72.276C158.949 72.2812 158.94 72.285 158.93 72.2883C158.825 72.324 158.657 72.3859 158.458 72.4831C158.418 72.4969 158.37 72.5117 158.323 72.5298C158.236 72.5628 158.118 72.6125 157.98 72.6822C157.87 72.7225 157.695 72.7921 157.497 72.8944C157.488 72.8978 157.476 72.9027 157.46 72.909C157.42 72.9242 157.324 72.9601 157.229 72.9994C157.179 73.0198 157.118 73.046 157.049 73.0774L156.822 73.189C156.734 73.2355 156.649 73.2835 156.595 73.3144C156.526 73.3539 156.49 73.374 156.435 73.4049C156.338 73.4596 156.276 73.4924 156.231 73.5135C156.208 73.5242 156.184 73.5348 156.138 73.5558C156.098 73.5734 156.031 73.6035 155.961 73.6368C155.833 73.6975 155.619 73.804 155.378 73.9643C155.364 73.9734 155.35 73.9817 155.335 73.9882C155.284 74.0103 155.244 74.028 155.205 74.0444C155.167 74.0605 155.138 74.0726 155.115 74.0816C155.104 74.0859 155.096 74.0888 155.089 74.0911C155.084 74.093 155.081 74.0947 155.081 74.0947C154.966 74.1335 154.871 74.1692 154.806 74.1939C154.728 74.2238 154.721 74.2265 154.706 74.2318C154.706 74.2318 154.697 74.2353 154.673 74.2435C154.653 74.2503 154.607 74.2655 154.565 74.2799C154.47 74.3122 154.342 74.3576 154.191 74.4185C154.167 74.4281 154.144 74.4391 154.121 74.4491C153.768 74.5647 153.47 74.7301 153.23 74.8985C153.185 74.9301 153.135 74.9556 153.081 74.969C152.828 75.0326 152.769 75.043 152.682 75.0544C152.528 75.0744 152.309 75.0924 151.722 75.1382C150.873 75.2046 149.439 75.3179 148.325 75.4066C139.305 75.4861 111.526 75.6846 86.9344 75.3668C79.988 75.277 76.5873 66.9817 81.411 61.9825L155.441 -14.7423C160.438 -19.921 169.198 -16.3838 169.198 -9.18741V54.4917Z"
              fill="#185032"
            />
          </svg>
        </div>

        {/* Logo + nama */}
        <Link
          to="/"
          className="relative z-10 flex min-w-0 items-center gap-2 sm:gap-3"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-[1.5px] border-[#c9a54a] bg-white sm:h-13 sm:w-13">
            <img
              src="/icon-192x192.png"
              alt="Logo Universitas Katolik De La Salle Manado"
              className="h-8 w-8 rounded-full object-contain sm:h-10.5 sm:w-10.5"
            />
          </div>

          <div className="flex min-w-0 flex-col">
            <div className="flex items-start text-lg font-semibold leading-none tracking-tight sm:text-2xl">
              <span className="text-primary">Si</span>
              <span className="text-blue-900">CARE</span>
              <MessageSquareText
                className="ml-2 -mt-1 h-3.5 w-3.5 text-blue-900"
                strokeWidth={2.5}
              />
            </div>
            <span className="mt-1 truncate text-[10px] font-semibold text-[#2b2b2b] sm:text-[11px] md:text-[13px]">
              Universitas Katolik De La Salle Manado
            </span>
          </div>
        </Link>

        {/* Menu desktop */}
        <nav className="relative z-10 hidden items-center gap-8 pr-36 lg:flex xl:gap-17 xl:pr-17">
          {navLinks.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `text-xs text-black transition-colors hover:text-[#1f5f3a] ${
                  isActive
                    ? "font-bold underline underline-offset-4"
                    : "font-medium"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Akun: hanya tampil di desktop. Pill melebar sebagai overlay (absolute) agar menu tidak bergeser */}
        {/* Kanan: akun (desktop) + hamburger (tablet & mobile) */}
        <div className="relative z-20 flex items-center gap-2">
          {/* Akun: hanya tampil di desktop */}
          <div className="group relative hidden h-9 w-9 lg:block">
            <div className="absolute right-0 top-0 flex h-9 max-w-9 flex-row-reverse items-center overflow-hidden rounded-full bg-transparent transition-all duration-300 ease-out group-hover:max-w-28 group-hover:bg-[#185032] group-focus-within:max-w-28 group-focus-within:bg-[#185032]">
              <Link
                to="/profile"
                aria-label="Profil"
                className="flex h-9 w-9 shrink-0 items-center justify-center text-white"
              >
                <CircleUserRound
                  className="h-9 w-9 text-white"
                  strokeWidth={1.6}
                />
              </Link>

              <Link
                to="/login"
                className="whitespace-nowrap py-1 pl-4 pr-1 text-sm font-semibold text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100"
              >
                Masuk
              </Link>
            </div>
          </div>

          {/* Hamburger: hanya tampil di tablet & mobile */}
          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            aria-label={open ? "Tutup menu" : "Buka menu"}
            aria-expanded={open}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#185032] text-white lg:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Menu mobile & tablet */}
      {open && (
        <nav className="absolute inset-x-0 top-full z-50 mx-auto mt-2 flex w-[92%] flex-col gap-1 rounded-2xl bg-[#f6f1ec]/95 p-3 shadow-[0_18px_40px_rgba(0,0,0,0.15)] backdrop-blur sm:w-[88%] lg:hidden">
          {navLinks.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `rounded-lg px-4 py-3 text-sm text-black transition-colors hover:bg-white hover:text-[#1f5f3a] ${
                  isActive
                    ? "font-bold underline underline-offset-4"
                    : "font-medium"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
          <Link
            to="/login"
            onClick={() => setOpen(false)}
            className="mt-2 rounded-lg bg-[#185032] px-4 py-3 text-center text-sm font-semibold text-white"
          >
            Masuk
          </Link>
        </nav>
      )}
    </header>
  );
}
