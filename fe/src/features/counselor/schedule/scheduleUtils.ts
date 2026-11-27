import { CANCEL_REASONS } from "../../../constants/counseling";
import { isClosedWeekday } from "../../../lib/operationalRules";

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

/** Konseling hanya dilayani pada hari kerja; Sabtu dan Minggu tidak bisa dibuatkan jadwal baru. */
export const WEEKEND_MESSAGE =
  "Jadwal konseling hanya dapat dibuat pada hari kerja (Senin–Jumat).";

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

/**
 * True bila tanggal adalah akhir pekan DAN aturan hari kerja aktif (production). Saat
 * pengembangan (WEEKDAY_ONLY mati) selalu false agar jadwal akhir pekan bisa dibuat untuk uji.
 */
export const isWeekendKey = (key: string) => isClosedWeekday(parseKey(key).getDay());

export const dateLabel = (key: string) => {
  const date = parseKey(key);
  return `${WEEKDAYS[date.getDay()]}, ${pad(date.getDate())} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
};

/** Accepts HH.MM or HH:MM and returns minutes after midnight, or null for invalid input. */
/**
 * Merapikan ketikan jam "HH.MM" untuk keyboard ponsel yang hanya berisi angka:
 * setelah dua digit jam, titik ditambahkan otomatis ("0930" -> "09.30").
 * Bila pengguna mengetik titik/titik dua sendiri ("9.30"), susunannya dipertahankan.
 * Saat menghapus, titik di ujung tidak ditambahkan lagi agar backspace tetap berjalan.
 */
export function formatTimeInput(raw: string, previous = ""): string {
  const deleting = raw.length < previous.length;
  const separator = raw.search(/[.:]/);
  if (separator !== -1) {
    const hours = raw.slice(0, separator).replace(/\D/g, "").slice(0, 2);
    const minutes = raw.slice(separator + 1).replace(/\D/g, "").slice(0, 2);
    if (!hours) return minutes ? `${minutes}` : "";
    return `${hours}.${minutes}`;
  }
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  if (digits.length > 2) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length === 2 && !deleting) return `${digits}.`;
  return digits;
}

export function parseTime(text: string): number | null {
  const match = /^(\d{1,2})[.:](\d{2})$/.exec(text.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}
