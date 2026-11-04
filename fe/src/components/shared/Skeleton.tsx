import type { ReactNode } from "react";

/**
 * Primitif loading skeleton bersama. Setiap varian membawa `role="status"` dan
 * label tersembunyi agar pembaca layar tetap mendengar status memuat.
 */

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`block animate-pulse rounded-md bg-slate-200/80 ${className}`}
    />
  );
}

function SkeletonStatus({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div role="status" aria-live="polite" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/**
 * Daftar kartu: ikon/avatar di kiri, dua baris teks, dan pill status.
 * `bare` dipakai di dalam panel yang sudah berbingkai (baris dipisah garis).
 */
export function SkeletonList({
  rows = 4,
  label = "Memuat data...",
  bare = false,
  className = "",
}: {
  rows?: number;
  label?: string;
  bare?: boolean;
  className?: string;
}) {
  return (
    <SkeletonStatus
      label={label}
      className={`${bare ? "divide-y divide-slate-100" : "space-y-3"} ${className}`}
    >
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className={`flex items-center gap-4 p-4 sm:p-5 ${
            bare ? "" : "rounded-2xl border border-slate-200 bg-white"
          }`}
        >
          <Skeleton className="h-12 w-12 shrink-0 rounded-2xl" />
          <div className="min-w-0 flex-1 space-y-2.5">
            <div className="flex justify-between gap-3">
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-3 w-3/5" />
            <div className="flex gap-2">
              <Skeleton className="h-5 w-24 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </SkeletonStatus>
  );
}

/** Tabel: baris header dan baris data. `bare` tanpa bingkai luar. */
export function SkeletonTable({
  rows = 5,
  columns = 4,
  label = "Memuat data...",
  bare = false,
  className = "",
}: {
  rows?: number;
  columns?: number;
  label?: string;
  bare?: boolean;
  className?: string;
}) {
  const grid = { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` };
  return (
    <SkeletonStatus
      label={label}
      className={`overflow-hidden ${
        bare ? "" : "rounded-2xl border border-slate-200 bg-white"
      } ${className}`}
    >
      <div className="grid gap-4 border-b border-slate-100 bg-slate-50 px-4 py-3" style={grid}>
        {Array.from({ length: columns }, (_, index) => (
          <Skeleton key={index} className="h-3 w-2/3" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, row) => (
        <div
          key={row}
          className="grid gap-4 border-b border-slate-100 px-4 py-4 last:border-b-0"
          style={grid}
        >
          {Array.from({ length: columns }, (_, col) => (
            <Skeleton key={col} className={`h-4 ${col === 0 ? "w-4/5" : "w-3/5"}`} />
          ))}
        </div>
      ))}
    </SkeletonStatus>
  );
}

/** Kartu statistik/KPI berjajar. */
export function SkeletonStatGrid({
  count = 4,
  label = "Memuat ringkasan...",
  className = "grid grid-cols-2 gap-3 lg:grid-cols-4",
}: {
  count?: number;
  label?: string;
  className?: string;
}) {
  return (
    <SkeletonStatus label={label} className={className}>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-7 w-1/3" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ))}
    </SkeletonStatus>
  );
}

/** Grid kartu (mis. profil konselor): gambar/avatar, judul, dan teks. */
export function SkeletonCardGrid({
  count = 6,
  label = "Memuat data...",
  className = "grid gap-4 sm:grid-cols-2 lg:grid-cols-3",
}: {
  count?: number;
  label?: string;
  className?: string;
}) {
  return (
    <SkeletonStatus label={label} className={className}>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <Skeleton className="h-14 w-14 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
          <Skeleton className="h-9 w-full rounded-xl" />
        </div>
      ))}
    </SkeletonStatus>
  );
}

/** Blok konten generik (panel/grafik/form). */
export function SkeletonBlock({
  lines = 4,
  label = "Memuat data...",
  bare = false,
  className = "",
}: {
  lines?: number;
  label?: string;
  bare?: boolean;
  className?: string;
}) {
  return (
    <SkeletonStatus
      label={label}
      className={`space-y-3 ${
        bare ? "" : "rounded-2xl border border-slate-200 bg-white p-5"
      } ${className}`}
    >
      <Skeleton className="h-4 w-1/3" />
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} className={`h-3 ${index % 3 === 2 ? "w-2/3" : "w-full"}`} />
      ))}
    </SkeletonStatus>
  );
}

/** Grid panel formulir (halaman Pengaturan): judul, label, dan isian. */
export function SkeletonFormGrid({
  panels = 4,
  label = "Memuat pengaturan...",
  className = "grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:gap-6",
}: {
  panels?: number;
  label?: string;
  className?: string;
}) {
  return (
    <SkeletonStatus label={label} className={className}>
      {Array.from({ length: panels }, (_, index) => (
        <div key={index} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-3 w-2/3" />
          {[0, 1].map((field) => (
            <div key={field} className="space-y-2">
              <Skeleton className="h-3 w-1/4" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          ))}
        </div>
      ))}
    </SkeletonStatus>
  );
}
