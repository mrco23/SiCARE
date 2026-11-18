import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/**
 * Kartu section halaman pengaturan yang dapat dilipat (pola akordeon seperti FAQ Panduan).
 * Default tertutup: hanya ikon, judul, subjudul, dan panah. Isi tetap ter-mount saat tertutup
 * sehingga isian form tidak hilang. `forceOpen` membuka panel, misalnya saat ada error validasi.
 */
export function SettingsPanel({
  icon,
  title,
  description,
  action,
  className = "",
  defaultOpen = false,
  forceOpen = false,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
  /** Diterima demi kompatibilitas; header kini selalu ringkas. */
  compactHeader?: boolean;
  defaultOpen?: boolean;
  forceOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();

  // Buka panel saat forceOpen berubah menjadi true (pola "sesuaikan state saat prop berubah").
  const [prevForceOpen, setPrevForceOpen] = useState(forceOpen);
  if (forceOpen !== prevForceOpen) {
    setPrevForceOpen(forceOpen);
    if (forceOpen) setOpen(true);
  }

  return (
    <section className={`rounded-2xl border border-gray-200 bg-white shadow-sm ${className}`}>
      <div className="flex items-center gap-2 p-5 sm:p-6">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={contentId}
          onClick={() => setOpen((value) => !value)}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">{icon}</span>
          <span className="min-w-0 flex-1">
            <span className="block text-base font-bold text-gray-900">{title}</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-gray-500">{description}</span>
          </span>
        </button>
        {open && action}
        <button
          type="button"
          aria-label={open ? `Tutup ${title}` : `Buka ${title}`}
          aria-expanded={open}
          aria-controls={contentId}
          onClick={() => setOpen((value) => !value)}
          className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100"
        >
          <ChevronDown className={`h-5 w-5 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
        </button>
      </div>

      <div
        id={contentId}
        inert={!open}
        className={`grid transition-all duration-300 ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="px-5 pb-5 sm:px-6 sm:pb-6">{children}</div>
        </div>
      </div>
    </section>
  );
}

export function SettingsField({
  label,
  required = false,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <label className="mb-1.5 block text-sm font-medium text-gray-800">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
    </div>
  );
}
