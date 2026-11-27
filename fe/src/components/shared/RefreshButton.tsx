import { RefreshCw } from "lucide-react";

export interface RefreshButtonProps {
  onClick: () => void;
  /** Ikon berputar selama data dimuat; tombol juga nonaktif kecuali `disabled` diberikan. */
  loading?: boolean;
  disabled?: boolean;
  /** Label aksesibilitas dan tooltip. */
  label?: string;
  className?: string;
}

/** Tombol muat ulang berbentuk ikon bulat, dipakai di samping kanan judul halaman. */
export default function RefreshButton({
  onClick,
  loading = false,
  disabled,
  label = "Muat ulang",
  className = "",
}: RefreshButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled ?? loading}
      aria-label={label}
      aria-busy={loading}
      title={label}
      className={`no-print inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-xs transition hover:bg-gray-50 hover:text-[#064E3B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#064E3B]/30 disabled:cursor-not-allowed disabled:opacity-50 ${className}`.trim()}
    >
      <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
    </button>
  );
}
