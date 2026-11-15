import { sicareApi } from "../../lib/sicareApi";
import { validateStrongPassword } from "../../lib/accountRules";

export interface AccountPasswordDraft {
  current: string;
  next: string;
  confirm: string;
}

/** Validasi lokal sebelum mengirim; mengembalikan pesan galat pertama atau string kosong. */
export function validateAccountPasswordChange(draft: AccountPasswordDraft): string {
  if (!draft.current) return "Masukkan kata sandi saat ini.";
  const strength = validateStrongPassword(draft.next);
  if (strength) return strength;
  if (draft.confirm !== draft.next) return "Konfirmasi kata sandi tidak sama.";
  if (draft.current === draft.next) return "Kata sandi baru harus berbeda dari kata sandi saat ini.";
  return "";
}

/**
 * Mengirim perubahan kata sandi akun ke server. Sukses hanya dilaporkan setelah
 * backend mengonfirmasi; galat validasi/server dilempar sebagai Error berpesan.
 */
export async function submitAccountPasswordChange(draft: AccountPasswordDraft): Promise<void> {
  const issue = validateAccountPasswordChange(draft);
  if (issue) throw new Error(issue);
  const result = await sicareApi.changePassword({
    current_password: draft.current,
    new_password: draft.next,
  });
  if (!result?.password_changed) {
    throw new Error("Server tidak mengonfirmasi perubahan kata sandi.");
  }
}
