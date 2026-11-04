import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { ToastContext, type ToastApi, type ToastVariant } from "./useToast";

/**
 * Satu sistem toast untuk seluruh aplikasi. Pasang `ToastProvider` sekali di
 * root, lalu panggil `useToast()` di halaman. Toast tampil di atas layar,
 * tepat di bawah navbar. Jangan isi pesan dengan data sensitif, dan tampilkan
 * toast sukses hanya setelah server mengonfirmasi.
 */

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

const DURATION: Record<ToastVariant, number> = {
  success: 3500,
  info: 3500,
  error: 5000,
};

const MAX_VISIBLE = 3;

const VARIANT_STYLE: Record<ToastVariant, string> = {
  success: "border-emerald-200 bg-emerald-50 text-[#064E3B]",
  error: "border-red-200 bg-red-50 text-red-800",
  info: "border-slate-700 bg-slate-900 text-white",
};

const VARIANT_ICON = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
} as const;

export default function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const show = useCallback(
    (message: string, variant: ToastVariant = "info") => {
      const text = message.trim();
      if (!text) return;
      const id = nextId.current++;
      setItems((current) => {
        // Pesan identik menggantikan yang lama agar tidak menumpuk.
        const rest = current.filter(
          (item) => !(item.message === text && item.variant === variant),
        );
        return [...rest, { id, message: text, variant }].slice(-MAX_VISIBLE);
      });
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), DURATION[variant]),
      );
    },
    [dismiss],
  );

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((timer) => clearTimeout(timer));
      pending.clear();
    };
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (message) => show(message, "success"),
      error: (message) => show(message, "error"),
      info: (message) => show(message, "info"),
      dismiss,
    }),
    [show, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 top-20 z-[70] flex flex-col items-center gap-2 px-4 sm:top-24"
      >
        {items.map((item) => {
          const Icon = VARIANT_ICON[item.variant];
          return (
            <div
              key={item.id}
              role={item.variant === "error" ? "alert" : "status"}
              className={`toast-enter pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-xl border px-4 py-3 text-sm font-medium shadow-lg ${VARIANT_STYLE[item.variant]}`}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1 break-words">{item.message}</span>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                aria-label="Tutup notifikasi"
                className="-m-1 shrink-0 rounded-lg p-1 opacity-70 transition hover:opacity-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
