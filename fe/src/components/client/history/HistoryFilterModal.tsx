import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

export interface HistoryFilterValue<S extends string, T extends string> {
  service: S;
  status: T;
}

interface Option<K extends string> {
  key: K;
  label: string;
  hint?: string;
}

/**
 * Modal filter Riwayat: jenis layanan + status. Pilihan baru berlaku setelah "Terapkan".
 * Desktop: dialog di tengah; ponsel: bottom sheet.
 */
export function HistoryFilterModal<S extends string, T extends string>({
  value,
  defaultValue,
  serviceOptions,
  statusOptions,
  countFor,
  onApply,
  onClose,
}: {
  value: HistoryFilterValue<S, T>;
  defaultValue: HistoryFilterValue<S, T>;
  serviceOptions: Option<S>[];
  statusOptions: Option<T>[];
  /** Jumlah riwayat untuk kombinasi filter (pencarian dan periode yang aktif ikut dihitung). */
  countFor: (filter: HistoryFilterValue<S, T>) => number;
  onApply: (filter: HistoryFilterValue<S, T>) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(value);
  const closeButton = useRef<HTMLButtonElement>(null);
  const resultCount = countFor(draft);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-labelledby="history-filter-title">
      <div className="absolute inset-0 bg-gray-900/40" onClick={onClose} aria-hidden="true" />
      <div className="sheet-modal-enter absolute inset-x-0 bottom-0 flex max-h-[90vh] flex-col rounded-t-3xl bg-white shadow-2xl sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[520px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl">
        <div aria-hidden="true" className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-gray-200 sm:hidden" />
        <div className="flex items-center justify-between px-5 pb-3 pt-4 sm:pt-5">
          <h2 id="history-filter-title" className="font-display text-lg font-bold text-gray-900">
            Filter riwayat
          </h2>
          <button
            ref={closeButton}
            type="button"
            onClick={onClose}
            aria-label="Tutup filter"
            className="rounded-full p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus:ring-4 focus:ring-primary/15"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 pb-5">
          <fieldset>
            <legend className="text-xs font-bold uppercase tracking-wider text-gray-500">Jenis layanan</legend>
            <div role="radiogroup" aria-label="Jenis layanan" className="mt-2 grid grid-cols-2 gap-2">
              {serviceOptions.map((option) => {
                const active = draft.service === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setDraft((current) => ({ ...current, service: option.key }))}
                    className={`rounded-2xl border px-4 py-3 text-left transition focus:outline-none focus:ring-4 focus:ring-primary/15 ${
                      active ? "border-primary bg-primary-soft ring-2 ring-primary/20" : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <span className={`block text-sm font-bold ${active ? "text-primary" : "text-gray-800"}`}>
                      {option.label}
                    </span>
                    {option.hint && <span className="block text-xs text-gray-500">{option.hint}</span>}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-xs font-bold uppercase tracking-wider text-gray-500">Status</legend>
            <div role="radiogroup" aria-label="Status riwayat" className="mt-2 grid grid-cols-2 gap-2">
              {statusOptions.map((option) => {
                const active = draft.status === option.key;
                const count = countFor({ ...draft, status: option.key });
                return (
                  <button
                    key={option.key}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setDraft((current) => ({ ...current, status: option.key }))}
                    className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition focus:outline-none focus:ring-4 focus:ring-primary/15 ${
                      active
                        ? "border-primary bg-primary-soft font-semibold text-primary"
                        : "border-gray-200 text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    {/* Zero-width space setelah "/" agar label panjang (Terlewat/Kedaluwarsa) bisa turun baris. */}
                    <span className="min-w-0">{option.label.replaceAll("/", "/​")}</span>
                    <span
                      className={`shrink-0 rounded-full px-2 text-xs font-bold ${
                        active ? "bg-primary text-white" : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        </div>

        <div className="flex gap-2 border-t border-gray-100 p-4">
          <button
            type="button"
            onClick={() => setDraft(defaultValue)}
            className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            Atur ulang
          </button>
          <button
            type="button"
            onClick={() => onApply(draft)}
            className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark focus:outline-none focus:ring-4 focus:ring-primary/20"
          >
            Terapkan · {resultCount} hasil
          </button>
        </div>
      </div>
    </div>
  );
}
