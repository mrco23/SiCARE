/**
 * Aturan Pembangkitan Inisial Avatar (Task B):
 * 1. Trim spasi depan dan belakang.
 * 2. Abaikan spasi berulang di antara kata.
 * 3. Ambil karakter pertama dari kata pertama.
 * 4. Ambil karakter pertama dari kata kedua jika tersedia.
 * 5. Ubah menjadi huruf kapital (uppercase).
 * 6. Jika nama hanya terdiri dari satu kata, gunakan satu karakter.
 * Contoh:
 * - "Marco Makalew" -> "MM"
 * - "Gio" -> "G"
 * - "Alvin Pramudita" -> "AP"
 * - "Muhammad Alvin Pramudita" -> "MA"
 */
export function getInitials(name?: string | null): string {
  if (!name) return "U";
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "U";
  if (words.length === 1) {
    return Array.from(words[0])[0]?.toUpperCase() ?? "U";
  }
  const first = Array.from(words[0])[0]?.toUpperCase() ?? "";
  const second = Array.from(words[1])[0]?.toUpperCase() ?? "";
  return first + second;
}
