import {
  Brain,
  Flower2,
  HeartHandshake,
  Leaf,
  MessageCircleHeart,
  Sparkles,
} from "lucide-react";

/*
 * Dekorasi latar halaman login: bertema konseling dan psikologi.
 * Murni dekoratif, aria-hidden, dan tidak menerima interaksi.
 */
export default function AuthBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {/* Cahaya lembut */}
      <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-secondary-dark/50 blur-3xl" />
      <div className="absolute -bottom-40 -right-32 h-[28rem] w-[28rem] rounded-full bg-secondary/80 blur-3xl" />
      <div className="absolute left-1/2 top-1/3 h-72 w-72 -translate-x-1/2 rounded-full bg-brand-gold/10 blur-3xl" />

      {/* Simbol Ψ dari logo, sebagai elemen utama */}
      <svg
        viewBox="0 0 100 100"
        className="auth-float absolute -left-10 top-1/4 h-64 w-64 text-primary opacity-[0.07] md:h-80 md:w-80"
        style={{ animationDuration: "16s" }}
      >
        <g
          fill="none"
          stroke="currentColor"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M50 14 V92" />
          <path d="M50 46 C36 46 22 40 20 14" />
          <path d="M50 46 C64 46 78 40 80 14" />
        </g>
      </svg>

      {/* Garis detak jantung */}
      <svg
        viewBox="0 0 1200 120"
        preserveAspectRatio="none"
        className="absolute inset-x-0 bottom-24 h-24 w-full text-primary-light opacity-[0.12] md:bottom-32"
      >
        <path
          d="M0 60 H300 L330 60 L345 25 L365 95 L385 40 L400 60 H700 L730 60 L745 25 L765 95 L785 40 L800 60 H1200"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/* Ikon-ikon konseling & psikologi */}
      <MessageCircleHeart
        className="auth-float absolute right-[8%] top-[12%] h-14 w-14 text-primary opacity-[0.12]"
        strokeWidth={1.4}
        style={{ animationDuration: "18s" }}
      />
      <Brain
        className="auth-float absolute bottom-[14%] left-[7%] h-16 w-16 text-primary opacity-[0.12]"
        strokeWidth={1.3}
        style={{ animationDuration: "22s", animationDelay: "-4s" }}
      />
      <HeartHandshake
        className="auth-float absolute bottom-[10%] right-[10%] h-14 w-14 text-brand-gold opacity-[0.22]"
        strokeWidth={1.4}
        style={{ animationDuration: "20s", animationDelay: "-8s" }}
      />
      <Leaf
        className="auth-float absolute left-[14%] top-[10%] h-10 w-10 text-primary-light opacity-[0.14]"
        strokeWidth={1.4}
        style={{ animationDuration: "14s", animationDelay: "-2s" }}
      />
      <Flower2
        className="auth-float absolute right-[18%] bottom-[30%] h-11 w-11 text-primary-light opacity-[0.12]"
        strokeWidth={1.3}
        style={{ animationDuration: "19s", animationDelay: "-6s" }}
      />
      <Sparkles
        className="auth-float absolute right-[30%] top-[22%] h-6 w-6 text-brand-gold opacity-30"
        strokeWidth={1.5}
        style={{ animationDuration: "12s" }}
      />
      <Sparkles
        className="auth-float absolute left-[28%] bottom-[26%] h-5 w-5 text-brand-gold opacity-25"
        strokeWidth={1.5}
        style={{ animationDuration: "15s", animationDelay: "-3s" }}
      />
    </div>
  );
}
