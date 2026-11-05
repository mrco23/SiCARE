const DAY_MS = 86_400_000;

/** Batas hari sebelum tanggal berlaku saat pengingat mulai tampil. */
export const LICENSE_REMINDER_DAYS = 30;

export type LicenseExpiryState = "valid" | "expiring" | "expired";

export interface LicenseExpiry {
  state: LicenseExpiryState;
  daysLeft: number;
  label: string;
}

/** Status masa berlaku SIPP/SILP; `null` bila tanggal belum diisi. */
export function getLicenseExpiry(
  validUntil: string | null | undefined,
  now: Date = new Date(),
): LicenseExpiry | null {
  if (!validUntil) return null;
  const [year, month, day] = validUntil.split("-").map(Number);
  const end = Date.UTC(year, month - 1, day);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  if (Number.isNaN(end)) return null;

  const daysLeft = Math.round((end - today) / DAY_MS);
  if (daysLeft < 0) {
    return { state: "expired", daysLeft, label: "SIPP/SILP kedaluwarsa" };
  }
  if (daysLeft <= LICENSE_REMINDER_DAYS) {
    return {
      state: "expiring",
      daysLeft,
      label:
        daysLeft === 0
          ? "SIPP/SILP berakhir hari ini"
          : `SIPP/SILP berakhir ${daysLeft} hari lagi`,
    };
  }
  return { state: "valid", daysLeft, label: "SIPP/SILP berlaku" };
}
