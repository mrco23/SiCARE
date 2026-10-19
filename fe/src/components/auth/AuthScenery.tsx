import { Star } from "lucide-react";

/*
 * Latar panel brand untuk halaman auth (desktop).
 * Gunung berlapis dari Navbar dan bintang emas dari logo SiCARE.
 */
export default function AuthScenery() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <svg
        viewBox="0 0 400 200"
        preserveAspectRatio="xMidYMax slice"
        className="absolute inset-x-0 bottom-0 h-[45%] w-full"
      >
        <path
          d="M0 200 L0 120 Q40 80 90 110 L170 60 Q200 40 230 62 L320 130 Q350 100 400 120 L400 200 Z"
          fill="#185032"
        />
        <path
          d="M0 200 L0 150 Q60 110 120 150 L200 110 Q250 85 300 130 L400 160 L400 200 Z"
          fill="#236C44"
        />
        <path
          d="M0 200 L0 170 Q80 140 160 175 Q240 150 320 180 Q360 165 400 175 L400 200 Z"
          fill="#288754"
        />
      </svg>

      <Star
        className="absolute right-10 top-10 h-6 w-6 fill-[#d4a84b] text-[#d4a84b] drop-shadow-[0_0_10px_rgba(212,168,75,0.5)]"
        strokeWidth={1}
      />
    </div>
  );
}
