import { formatIndonesianDate, parseLocalISODate } from "../../../lib/dateUtils";
import type { BookingCounselor } from "../../../data/mock/clientCounselors";

export interface BookingSlot {
  date: string;
  time: string;
}

const DAYS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"] as const;
const MIN_LEAD_DAYS = 1;
export const MAX_AHEAD_DAYS = 60;

export const startOfToday = (): Date => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
};

export const addDays = (date: Date, amount: number): Date => {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
};

export const minBookingDate = (): Date =>
  addDays(startOfToday(), MIN_LEAD_DAYS);

export const firstOfMonth = (date: Date): Date =>
  new Date(date.getFullYear(), date.getMonth(), 1);

export const formatBookingDate = (iso: string): string =>
  formatIndonesianDate(parseLocalISODate(iso), {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

export const formatBookingSlot = (slot: BookingSlot): string =>
  `${formatBookingDate(slot.date)}, ${slot.time} WITA`;

/** Returns the same schedule choices and lead-time limits used by the original booking page. */
export function slotsForCounselor(
  counselor: BookingCounselor,
  iso: string,
): string[] {
  const date = parseLocalISODate(iso);
  const today = startOfToday();
  if (
    date < addDays(today, MIN_LEAD_DAYS) ||
    date > addDays(today, MAX_AHEAD_DAYS)
  ) {
    return [];
  }

  const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
  if (dayOfWeek === 0 || dayOfWeek === 6) return [];
  return counselor.schedule[DAYS[dayOfWeek - 1]] ?? [];
}
