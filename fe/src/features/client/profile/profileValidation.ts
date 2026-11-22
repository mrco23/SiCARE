import { EDUCATION_LEVELS } from "../../../constants/registerOptions";
import { validateIndonesianPhone } from "../../../lib/accountRules";

export interface ClientProfile {
  phone: string;
  address: string;
  occupation: string;
  education: string;
}

export type ClientProfileErrors = Partial<
  Record<"phone" | "address" | "occupation" | "education", string>
>;

export const MAX_ADDRESS = 200;
const MAX_OCCUPATION = 60;

export function normalizePhoneToE164(raw: string): string | null {
  const cleaned = raw.replace(/[\s()-]/g, "").trim();
  if (!cleaned) return null;
  if (cleaned.startsWith("0")) {
    return `+62${cleaned.slice(1)}`;
  }
  if (cleaned.startsWith("62")) {
    return `+${cleaned}`;
  }
  return cleaned;
}

/** Pure profile validation; profile and password drafts remain component-local. */
export function validateClientProfile(profile: ClientProfile): ClientProfileErrors {
  const errors: ClientProfileErrors = {};
  const phoneError = validateIndonesianPhone(profile.phone, { required: true });
  if (phoneError) errors.phone = phoneError;

  if (!profile.address.trim()) errors.address = "Alamat wajib diisi";
  else if (profile.address.length > MAX_ADDRESS) {
    errors.address = `Maksimal ${MAX_ADDRESS} karakter`;
  }

  if (profile.occupation.length > MAX_OCCUPATION) {
    errors.occupation = `Maksimal ${MAX_OCCUPATION} karakter`;
  }

  if (!(EDUCATION_LEVELS as readonly string[]).includes(profile.education)) {
    errors.education = "Pilih pendidikan terakhir";
  }

  return errors;
}
