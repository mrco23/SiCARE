import { z } from "zod";

export const CAMPUS_EMAIL_DOMAIN = "unikadelasalle.ac.id";

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

/**
 * Account password policy (Supabase Auth login password).
 * Not used for the counselor history lock password, which has its own rules.
 */
export const strongPasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Kata sandi minimal ${PASSWORD_MIN_LENGTH} karakter.`)
  .max(PASSWORD_MAX_LENGTH, `Kata sandi maksimal ${PASSWORD_MAX_LENGTH} karakter.`)
  .regex(/[a-z]/, "Kata sandi harus memuat minimal satu huruf kecil.")
  .regex(/[A-Z]/, "Kata sandi harus memuat minimal satu huruf besar.")
  .regex(/\d/, "Kata sandi harus memuat minimal satu angka.")
  .regex(/[^A-Za-z0-9]/, "Kata sandi harus memuat minimal satu simbol.");

const campusEmailPattern = new RegExp(`^[^\\s@]+@${CAMPUS_EMAIL_DOMAIN.replace(/\./g, "\\.")}$`, "i");

export const campusEmailSchema = z
  .string()
  .trim()
  .email()
  .max(254)
  .regex(campusEmailPattern, `Gunakan email resmi kampus (@${CAMPUS_EMAIL_DOMAIN}).`);

/** Indonesian phone number in E.164 form: +62 followed by 8-13 digits (no leading 0). */
export const INDONESIAN_PHONE_E164_RE = /^\+62[1-9]\d{7,12}$/;

export const indonesianPhoneSchema = z
  .string()
  .trim()
  .regex(INDONESIAN_PHONE_E164_RE, "Nomor telepon harus berformat +62, misalnya +6281234567890.");
