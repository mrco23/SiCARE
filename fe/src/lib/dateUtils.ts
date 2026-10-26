/** Shared date helpers for the Indonesian-language SiCARE interface. */

const DAY_MS = 86_400_000;

const pad2 = (value: number): string => String(value).padStart(2, "0");

/** Formats a Date using its local calendar date as YYYY-MM-DD. */
export const toISODate = (date: Date): string =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

/** Parses a date-only ISO string as local midnight, avoiding UTC date shifts. */
export const parseLocalISODate = (iso: string): Date =>
  new Date(`${iso}T00:00:00`);

/** Shared locale wrapper; callers choose options to preserve each screen's format. */
export const formatIndonesianDate = (
  date: Date,
  options: Intl.DateTimeFormatOptions,
): string => date.toLocaleDateString("id-ID", options);

/** Returns the number of calendar days from startISO to endISO (end - start). */
export const differenceInCalendarDaysISO = (
  startISO: string,
  endISO: string,
): number => {
  const utcDay = (iso: string) =>
    Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));

  return Math.round((utcDay(endISO) - utcDay(startISO)) / DAY_MS);
};
