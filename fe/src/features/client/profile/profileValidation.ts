import { EDUCATION_LEVELS } from "../../../constants/registerOptions";

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
const PHONE_RE = /^(\+62|62|0)[0-9]{8,13}$/;

/** Pure profile validation; profile and password drafts remain component-local. */
export function validateClientProfile(profile: ClientProfile): ClientProfileErrors {
  const errors: ClientProfileErrors = {};
  const phone = profile.phone.replace(/[\s()-]/g, "");

  if (!phone) errors.phone = "Nomor telepon wajib diisi";
  else if (!PHONE_RE.test(phone)) {
    errors.phone = "Format nomor telepon tidak valid";
  }

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
