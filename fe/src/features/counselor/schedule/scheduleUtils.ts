import { CANCEL_REASONS } from "../../../data/mock/counselorActivity";

export { CANCEL_REASONS };

export const START = 8 * 60;
export const END = 16 * 60;
export const SESSION = 60;
export const LAST_START = END - SESSION;
export const SNAP = 15;
export const PX = 1.2;
export const H = (END - START) * PX;

export const MONTHS = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];
export const WEEKDAYS = [
  "Minggu",
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
];

export const pad = (value: number) => String(value).padStart(2, "0");
export const fmt = (minutes: number) =>
  `${pad(Math.floor(minutes / 60))}.${pad(minutes % 60)}`;
export const yOf = (minutes: number) => (minutes - START) * PX;
export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));
export const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());
export const addDays = (date: Date, amount: number) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount);
export const keyOf = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const parseKey = (key: string) => {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
};

export const dateLabel = (key: string) => {
  const date = parseKey(key);
  return `${WEEKDAYS[date.getDay()]}, ${pad(date.getDate())} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
};

/** Accepts HH.MM or HH:MM and returns minutes after midnight, or null for invalid input. */
export function parseTime(text: string): number | null {
  const match = /^(\d{1,2})[.:](\d{2})$/.exec(text.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}
