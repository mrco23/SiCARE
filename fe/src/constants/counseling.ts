/**
 * Query string Aktivitas Saya untuk langsung membuka layar pilih jadwal pengganti,
 * mis. /klien/aktivitas?jadwal-ulang=<booking id> dari Beranda klien.
 */
export const RESCHEDULE_QUERY_KEY = "jadwal-ulang";

export interface CancelReasonOption {
  code: string;
  label: string;
}

export const CANCEL_REASONS: CancelReasonOption[] = [
  { code: "KLIEN_SAKIT", label: "Klien sakit" },
  { code: "KONSELOR_BERHALANGAN", label: "Konselor berhalangan" },
  { code: "KLIEN_TIDAK_HADIR", label: "Klien tidak hadir tanpa kabar" },
  { code: "JADWAL_BENTROK", label: "Jadwal bentrok" },
  { code: "LAINNYA", label: "Lainnya" },
];

