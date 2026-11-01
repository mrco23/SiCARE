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
const E164_RE = /^\+[1-9][0-9]{6,14}$/;

export interface ClientBackendProfileDraft {
  fullName: string;
  phone: string;
  whatsappOptIn: boolean;
}

export type ClientBackendProfileErrors = Partial<
  Record<"fullName" | "phone" | "whatsappOptIn", string>
>;

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

export function validateClientBackendProfile(
  draft: ClientBackendProfileDraft,
): ClientBackendProfileErrors {
  const errors: ClientBackendProfileErrors = {};
  const trimmedName = draft.fullName.trim();
  if (!trimmedName) {
    errors.fullName = "Nama lengkap wajib diisi.";
  } else if (trimmedName.length < 2) {
    errors.fullName = "Nama lengkap minimal 2 karakter.";
  } else if (trimmedName.length > 160) {
    errors.fullName = "Nama lengkap maksimal 160 karakter.";
  }

  const normalizedPhone = normalizePhoneToE164(draft.phone);
  if (normalizedPhone !== null) {
    if (
      !E164_RE.test(normalizedPhone) ||
      normalizedPhone.length < 7 ||
      normalizedPhone.length > 20
    ) {
      errors.phone =
        "Format nomor telepon tidak valid. Gunakan format 08... atau +628...";
    }
  } else if (draft.whatsappOptIn) {
    errors.phone =
      "Nomor telepon wajib diisi untuk mengaktifkan persetujuan WhatsApp.";
  }

  return errors;
}

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
