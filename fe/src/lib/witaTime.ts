/** Zona waktu operasional SiCARE (Manado). */
export const WITA_TIME_ZONE = "Asia/Makassar";

const hourMinute = new Intl.DateTimeFormat("en-GB", {
  timeZone: WITA_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Jam:menit sebuah waktu dalam WITA, apa pun zona waktu perangkat. Contoh: "09.30". */
export function formatWitaTime(date: Date, separator = "."): string {
  const parts = hourMinute.formatToParts(date);
  const hour = parts.find((part) => part.type === "hour")?.value ?? "00";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
  return `${hour}${separator}${minute}`;
}
