import type { ReactNode } from "react";

/**
 * Badge/pill SiCARE yang dipakai bersama (status, role, kategori, label kecil).
 *
 * - `size` mengatur ukuran teks dan padding: `xs` (10px), `sm` (11px, default), `md` (12px).
 * - `tone` memilih warna bawaan yang konsisten. Warna khusus halaman tetap bisa diberikan
 *   lewat `className` (mis. peta status yang sudah ada), dan menimpa warna bawaan.
 * - `weight` default tebal (`bold`); gunakan `semibold` untuk badge yang lebih ringan.
 */
export type BadgeTone =
  | "neutral"
  | "slate"
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "sky"
  | "indigo"
  | "violet"
  | "purple"
  | "teal"
  | "gold"
  | "solid";

export type BadgeSize = "xs" | "sm" | "md";

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: "border-gray-200 bg-gray-100 text-gray-700",
  slate: "border-slate-200 bg-slate-50 text-slate-600",
  primary: "border-emerald-100 bg-primary-subtle text-primary",
  success: "border-emerald-200 bg-emerald-50 text-[#15803d]",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  danger: "border-rose-200 bg-rose-50 text-rose-700",
  info: "border-blue-100 bg-blue-50 text-blue-700",
  sky: "border-sky-100 bg-sky-50 text-sky-700",
  indigo: "border-indigo-100 bg-indigo-50 text-indigo-700",
  violet: "border-violet-100 bg-violet-50 text-violet-700",
  purple: "border-purple-200 bg-purple-100 text-purple-800",
  teal: "border-teal-100 bg-teal-50 text-teal-700",
  // Emas Lasallian, untuk peran pimpinan (Kepala LMI).
  gold: "border-[#ecd9a4] bg-[#fdf7e7] text-[#8a6116]",
  solid: "border-primary bg-primary text-white",
};

const SIZES: Record<BadgeSize, string> = {
  xs: "px-2 py-0.5 text-[10px]",
  sm: "px-2.5 py-1 text-[11px]",
  md: "px-2.5 py-0.5 text-xs",
};

export default function Badge({
  children,
  tone,
  size = "sm",
  weight = "bold",
  bordered = false,
  icon,
  className = "",
  title,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  size?: BadgeSize;
  weight?: "bold" | "semibold";
  /** Tampilkan garis tepi (warnanya dari `tone` atau `className`). */
  bordered?: boolean;
  icon?: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full ${SIZES[size]} ${
        weight === "bold" ? "font-bold" : "font-semibold"
      } ${bordered ? "border" : ""} ${tone ? BADGE_TONES[tone] : ""} ${className}`}
    >
      {icon}
      {children}
    </span>
  );
}
