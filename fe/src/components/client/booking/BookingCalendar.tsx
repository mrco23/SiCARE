import { ChevronLeft, ChevronRight } from "lucide-react";
import type { BookingCounselor } from "../../../data/mock/clientCounselors";
import { toISODate } from "../../../lib/dateUtils";
import {
  addDays,
  firstOfMonth,
  formatBookingDate,
  minBookingDate,
  MAX_AHEAD_DAYS,
  slotsForCounselor,
  startOfToday,
  type BookingSlot,
} from "../../../features/booking/utils/clientBookingCalendar";

export function CalendarPicker({
  counselor,
  calMonth,
  setCalMonth,
  selDate,
  onSelectDate,
}: {
  counselor: BookingCounselor;
  calMonth: Date;
  setCalMonth: (date: Date) => void;
  selDate: string | null;
  onSelectDate: (iso: string) => void;
}) {
  const first = firstOfMonth(calMonth);
  const daysInMonth = new Date(
    calMonth.getFullYear(),
    calMonth.getMonth() + 1,
    0,
  ).getDate();
  const offset = (first.getDay() + 6) % 7; // Monday is the first column
  const minFirst = firstOfMonth(minBookingDate());
  const maxDate = addDays(startOfToday(), MAX_AHEAD_DAYS);
  const canPrev = first.getTime() > minFirst.getTime();
  const canNext =
    new Date(first.getFullYear(), first.getMonth() + 1, 1) <= maxDate;
  const todayISO = toISODate(startOfToday());
  const monthLabel = first.toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="rounded-2xl border border-gray-200 p-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() =>
            setCalMonth(new Date(first.getFullYear(), first.getMonth() - 1, 1))
          }
          disabled={!canPrev}
          aria-label="Bulan sebelumnya"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={2} />
        </button>
        <p className="font-display text-sm font-bold capitalize text-gray-900">
          {monthLabel}
        </p>
        <button
          type="button"
          onClick={() =>
            setCalMonth(new Date(first.getFullYear(), first.getMonth() + 1, 1))
          }
          disabled={!canNext}
          aria-label="Bulan berikutnya"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronRight className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-gray-500">
        {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: offset }).map((_, index) => (
          <span key={`empty-${index}`} />
        ))}
        {Array.from({ length: daysInMonth }).map((_, index) => {
          const day = index + 1;
          const iso = toISODate(
            new Date(first.getFullYear(), first.getMonth(), day),
          );
          const hasSlots = slotsForCounselor(counselor, iso).length > 0;
          const selected = selDate === iso;
          const isToday = iso === todayISO;

          return (
            <button
              key={iso}
              type="button"
              disabled={!hasSlots}
              onClick={() => onSelectDate(iso)}
              aria-label={`${formatBookingDate(iso)}${hasSlots ? "" : " (tidak tersedia)"}`}
              className={`relative flex h-9 items-center justify-center rounded-xl border text-sm font-semibold transition sm:h-10 ${
                selected
                  ? "border-primary bg-primary text-white"
                  : hasSlots
                    ? "border-primary/30 bg-primary-soft text-primary hover:border-primary"
                    : "cursor-not-allowed border-transparent text-gray-300"
              }`}
            >
              {day}
              {isToday && (
                <span
                  className={`absolute bottom-1 h-1 w-1 rounded-full ${selected ? "bg-white" : "bg-primary"}`}
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border border-primary/30 bg-primary-soft" />
          Tersedia
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-primary" />
          Dipilih
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1 w-1 rounded-full bg-primary" />
          Hari ini
        </span>
      </div>
    </div>
  );
}

export function TimePanel({
  counselor,
  selDate,
  slot,
  onSelectSlot,
}: {
  counselor: BookingCounselor;
  selDate: string | null;
  slot: BookingSlot | null;
  onSelectSlot: (time: string) => void;
}) {
  if (!selDate) {
    return (
      <div className="rounded-2xl border border-gray-200 p-4 md:p-5">
        <p className="text-sm text-gray-500">
          Pilih tanggal pada kalender terlebih dahulu.
        </p>
      </div>
    );
  }

  const slots = slotsForCounselor(counselor, selDate);
  return (
    <div className="rounded-2xl border border-gray-200 p-4 md:p-5">
      <p className="text-sm font-semibold text-gray-900">
        {formatBookingDate(selDate)}
      </p>
      <p className="mt-1 text-xs text-gray-500">
        Pilih salah satu jam yang tersedia.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {slots.length === 0 && (
          <p className="text-sm text-gray-500">Tidak ada jam tersedia.</p>
        )}
        {slots.map((time) => {
          const selected = slot?.date === selDate && slot?.time === time;
          return (
            <button
              key={time}
              type="button"
              onClick={() => onSelectSlot(time)}
              className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition ${
                selected
                  ? "border-primary bg-primary text-white"
                  : "border-primary/40 bg-primary-soft text-primary hover:border-primary"
              }`}
            >
              {time}
            </button>
          );
        })}
      </div>
    </div>
  );
}
