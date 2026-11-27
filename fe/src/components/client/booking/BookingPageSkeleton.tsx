import { Skeleton } from "../../shared";

/**
 * Skeleton halaman Booking Jadwal Konseling. Bentuknya mengikuti UI langkah yang akan tampil
 * (stepper, judul, lalu isi langkah) agar tata letak tidak meloncat saat data konselor dan
 * jadwal selesai dimuat.
 */
export default function BookingPageSkeleton({ step = 1, stepCount = 5 }: { step?: number; stepCount?: number }) {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Memuat konselor dan jadwal...</span>

      {/* Stepper */}
      <div
        className="mt-6 grid"
        style={{ gridTemplateColumns: `repeat(${stepCount}, minmax(0, 1fr))` }}
        aria-hidden="true"
      >
        {Array.from({ length: stepCount }, (_, i) => {
          const last = i === stepCount - 1;
          return (
            <div key={i} className="relative flex flex-col items-center">
              {!last && (
                <span className="absolute left-[calc(50%+18px)] right-[calc(-50%+18px)] top-[13px] h-0.5 bg-slate-200/80" />
              )}
              <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
              <Skeleton className="mt-2 h-3 w-14" />
            </div>
          );
        })}
      </div>

      {/* Judul langkah */}
      <div className="mt-6" aria-hidden="true">
        <Skeleton className="h-8 w-56 sm:h-9 sm:w-72" />
        <Skeleton className="mt-2 h-4 w-full max-w-sm" />
      </div>

      {step <= 1 && <ServiceStepSkeleton />}
      {step === 2 && <CounselorStepSkeleton />}
      {step >= 3 && <ScheduleStepSkeleton />}
    </div>
  );
}

function ServiceStepSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="mt-4 grid grid-cols-2 gap-3 sm:mt-6 sm:gap-5">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-2xl border-2 border-slate-200 bg-white p-3 sm:p-4">
            <Skeleton className="h-20 w-full rounded-xl sm:h-32" />
            <div className="mt-2.5 flex items-start justify-between gap-3 sm:mt-4">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-20 sm:w-40" />
                <Skeleton className="h-3.5 w-3/4" />
              </div>
              <Skeleton className="h-5 w-5 rounded-full" />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6 flex flex-col-reverse gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:w-full sm:max-w-md">
          <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
        <Skeleton className="h-10 w-full rounded-full sm:w-28 sm:self-end" />
      </div>
    </div>
  );
}

function CounselorStepSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <Skeleton className="h-11 w-full rounded-xl" />
        <Skeleton className="h-11 w-full rounded-xl sm:w-44" />
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="rounded-2xl border-2 border-slate-200 bg-white p-4">
            <div className="flex items-start gap-4">
              <Skeleton className="h-14 w-14 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
            <Skeleton className="mt-4 h-3.5 w-full" />
            <Skeleton className="mt-4 h-6 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ScheduleStepSkeleton() {
  return (
    <div aria-hidden="true" className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        <div className="flex items-start gap-5 md:w-1/2">
          <Skeleton className="h-20 w-20 shrink-0 rounded-full sm:h-24 sm:w-24" />
          <div className="flex-1 space-y-2.5">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-3.5 w-1/2" />
            <Skeleton className="h-3.5 w-2/5" />
          </div>
        </div>
        <div className="space-y-2.5 md:w-1/2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
          <div className="flex flex-wrap gap-2 pt-2">
            {["w-16", "w-20", "w-14"].map((w) => (
              <Skeleton key={w} className={`h-6 rounded-full ${w}`} />
            ))}
          </div>
        </div>
      </div>

      <Skeleton className="mt-6 h-4 w-36" />
      <Skeleton className="mt-2 h-3 w-full max-w-md" />
      <div className="mt-4 grid gap-5 md:grid-cols-[minmax(0,26rem)_1fr]">
        <div className="rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-7 w-7 rounded-full" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-7 w-7 rounded-full" />
          </div>
          <div className="mt-4 grid grid-cols-7 gap-2">
            {Array.from({ length: 35 }, (_, i) => (
              <Skeleton key={i} className="aspect-square w-full rounded-lg" />
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <Skeleton className="h-4 w-40" />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
