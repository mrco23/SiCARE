import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";
import {
  fmtDate,
  periodStatus,
  toISO,
  type AcademicPeriod,
  type PeriodStatus,
  type Semester,
} from "../../lib/academicPeriods";

export interface AcademicPeriodLike {
  id: string;
  ta?: string;
  academic_year?: string;
  sem?: "Ganjil" | "Genap" | string;
  semester?: "Ganjil" | "Genap" | string;
  label?: string;
  start?: string;
  starts_on?: string;
  end?: string;
  ends_on?: string;
  isPublished?: boolean;
  is_published?: boolean;
  is_active?: boolean;
}

export interface AcademicPeriodFilterProps<T extends AcademicPeriodLike = AcademicPeriodLike> {
  periods: T[];
  selectedId: string;
  onSelect: (id: string) => void;
  badgeContent?: (period: T) => ReactNode;
  showAllOption?: boolean;
  allLabel?: string;
  label?: string;
  today?: string;
  className?: string;
  triggerClassName?: string;
}

interface NormalizedPeriod<T> extends AcademicPeriod {
  original: T;
}

const STATUS_STYLE: Record<PeriodStatus, string> = {
  Aktif: "bg-emerald-50 text-primary border-emerald-200",
  Mendatang: "bg-sky-50 text-sky-700 border-sky-200",
  Selesai: "bg-slate-100 text-slate-500 border-slate-200",
};

export default function AcademicPeriodFilter<T extends AcademicPeriodLike>({
  periods,
  selectedId,
  onSelect,
  badgeContent,
  showAllOption = true,
  allLabel = "Semua periode",
  label = "Periode akademik",
  today,
  className = "relative w-full sm:w-80",
  triggerClassName = "",
}: AcademicPeriodFilterProps<T>) {
  const [open, setOpen] = useState(false);
  const [ta, setTa] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const todayDate = useMemo(() => today ?? toISO(new Date()), [today]);

  // Normalisasi aneka bentuk data periode dari backend / public / admin API
  const normalizedPeriods = useMemo<NormalizedPeriod<T>[]>(() => {
    return periods.map((p) => {
      const id = p.id;
      let year = p.ta || p.academic_year || "";
      let sem = (p.sem || p.semester || "") as string;
      if (!year && p.label) {
        const parts = p.label.trim().split(/\s+/);
        year = parts[0] || "";
        if (!sem && parts.length > 1) {
          sem = parts[1];
        }
      }
      const start = p.start || p.starts_on || "";
      const end = p.end || p.ends_on || "";
      const validSem: Semester = sem.toLowerCase() === "genap" ? "Genap" : "Ganjil";

      return {
        id,
        ta: year,
        sem: validSem,
        label: `${year} ${validSem}`,
        start,
        end,
        original: p,
      };
    });
  }, [periods]);

  const selected = useMemo(
    () => normalizedPeriods.find((p) => p.id === selectedId) ?? null,
    [normalizedPeriods, selectedId],
  );

  const years = useMemo(
    () =>
      [...new Set(normalizedPeriods.map((p) => p.ta).filter(Boolean))]
        .sort()
        .reverse(),
    [normalizedPeriods],
  );

  const semestersOf = (year: string) =>
    normalizedPeriods
      .filter((p) => p.ta === year)
      .sort((a, b) => a.start.localeCompare(b.start));

  useEffect(() => {
    if (!open) return;

    const onDown = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = () => {
    if (!open) setTa(selected?.ta ?? years[0] ?? null);
    setOpen((v) => !v);
  };

  const pick = (id: string) => {
    onSelect(id);
    setOpen(false);
  };

  const activeYear = ta ?? years[0] ?? null;
  const triggerStatus = selected ? periodStatus(selected, todayDate) : null;

  return (
    <div ref={rootRef} className={className}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`flex w-full items-center justify-between gap-3 rounded-2xl border bg-white px-4 py-2.5 text-left shadow-xs transition-colors ${
          open
            ? "border-brand-accent ring-4 ring-brand-accent/15"
            : "border-slate-200 hover:border-brand-accent/50"
        } ${triggerClassName}`}
      >
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {label}
          </p>
          <p className="truncate text-xs sm:text-sm font-bold text-slate-800">
            {selected ? `TA ${selected.ta} · ${selected.sem}` : allLabel}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {triggerStatus && (
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${STATUS_STYLE[triggerStatus]}`}
            >
              {triggerStatus}
            </span>
          )}
          <ChevronDown
            className={`h-4 w-4 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-40 mt-2 w-[min(560px,94vw)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-100">
          {showAllOption && (
            <div className="border-b border-slate-100 p-2.5">
              <button
                type="button"
                onClick={() => pick("all")}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs sm:text-sm font-semibold transition-colors ${
                  selectedId === "all"
                    ? "bg-[#f0fdf4] text-primary"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <span>{allLabel}</span>
                {selectedId === "all" && <Check className="h-4 w-4 text-primary" />}
              </button>
            </div>
          )}

          {normalizedPeriods.length === 0 ? (
            <div className="p-5 text-xs text-slate-500">
              Belum ada periode akademik di database.
            </div>
          ) : (
            <div className="grid grid-cols-[8.5rem_1fr] sm:grid-cols-[9rem_1fr]">
              {/* Kolom Kiri: Daftar Tahun Ajaran */}
              <div className="max-h-72 space-y-1 overflow-y-auto border-r border-slate-100 bg-slate-50/70 p-2">
                <p className="px-2 pb-1 pt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Tahun ajaran
                </p>
                {years.map((y) => (
                  <button
                    key={y}
                    type="button"
                    onClick={() => setTa(y)}
                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs sm:text-sm font-semibold transition-colors ${
                      activeYear === y
                        ? "bg-white text-primary shadow-xs ring-1 ring-slate-200/50"
                        : "text-slate-600 hover:bg-white/70"
                    }`}
                  >
                    <span>{y}</span>
                    {selected?.ta === y && (
                      <span className="h-1.5 w-1.5 rounded-full bg-brand-accent" />
                    )}
                  </button>
                ))}
              </div>

              {/* Kolom Kanan: Daftar Semester */}
              <div className="max-h-72 space-y-2 overflow-y-auto p-3">
                <p className="px-1 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Semester · TA {activeYear}
                </p>
                {activeYear &&
                  (["Ganjil", "Genap"] as const).map((sem) => {
                    const p = semestersOf(activeYear).find(
                      (x) => x.sem.toLowerCase() === sem.toLowerCase(),
                    );

                    if (!p) {
                      return (
                        <div
                          key={sem}
                          className="rounded-xl border border-dashed border-slate-200 px-3.5 py-2.5 text-xs text-slate-400"
                        >
                          <span className="font-semibold">{sem}</span> · Belum dibuat di Periode Akademik
                        </div>
                      );
                    }

                    const active = selectedId === p.id;
                    const st = periodStatus(p, todayDate);
                    return (
                      <button
                        key={sem}
                        type="button"
                        onClick={() => pick(p.id)}
                        className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-colors ${
                          active
                            ? "border-primary bg-primary text-white shadow-xs"
                            : "border-slate-200 bg-white hover:border-brand-accent/50 hover:bg-[#f6fcf8]"
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm font-bold">{sem}</p>
                          <p
                            className={`truncate text-[10px] sm:text-[11px] ${
                              active ? "text-emerald-100" : "text-slate-400"
                            }`}
                          >
                            {p.start ? fmtDate(p.start) : "-"} –{" "}
                            {p.end ? fmtDate(p.end) : "-"}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          {badgeContent && (
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                active
                                  ? "bg-white/20 text-white"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {badgeContent(p.original)}
                            </span>
                          )}
                          <span
                            className={`text-[10px] font-bold ${
                              active
                                ? "text-emerald-100"
                                : st === "Aktif"
                                  ? "text-[#15803d]"
                                  : "text-slate-400"
                            }`}
                          >
                            {st}
                          </span>
                        </div>
                      </button>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
