/**
 * Aturan akun bersama (kata sandi, email kampus, nomor telepon).
 * Cermin dari `be/src/validators/shared.validator.js`; backend tetap menjadi penentu akhir.
 */

export const CAMPUS_EMAIL_DOMAIN = "unikadelasalle.ac.id";

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export interface PasswordRuleCheck {
  id: string;
  label: string;
  ok: boolean;
}

export function getPasswordRuleChecks(password: string): PasswordRuleCheck[] {
  return [
    {
      id: "length",
      label: `${PASSWORD_MIN_LENGTH}–${PASSWORD_MAX_LENGTH} karakter`,
      ok: password.length >= PASSWORD_MIN_LENGTH && password.length <= PASSWORD_MAX_LENGTH,
    },
    { id: "lower", label: "Minimal satu huruf kecil", ok: /[a-z]/.test(password) },
    { id: "upper", label: "Minimal satu huruf besar", ok: /[A-Z]/.test(password) },
    { id: "digit", label: "Minimal satu angka", ok: /\d/.test(password) },
    { id: "symbol", label: "Minimal satu simbol", ok: /[^A-Za-z0-9]/.test(password) },
  ];
}

/** Mengembalikan pesan galat pertama, atau string kosong jika kata sandi memenuhi aturan. */
export function validateStrongPassword(password: string): string {
  if (!password) return "Kata sandi wajib diisi.";
  if (password.length < PASSWORD_MIN_LENGTH) return `Kata sandi minimal ${PASSWORD_MIN_LENGTH} karakter.`;
  if (password.length > PASSWORD_MAX_LENGTH) return `Kata sandi maksimal ${PASSWORD_MAX_LENGTH} karakter.`;
  if (!/[a-z]/.test(password)) return "Kata sandi harus memuat minimal satu huruf kecil.";
  if (!/[A-Z]/.test(password)) return "Kata sandi harus memuat minimal satu huruf besar.";
  if (!/\d/.test(password)) return "Kata sandi harus memuat minimal satu angka.";
  if (!/[^A-Za-z0-9]/.test(password)) return "Kata sandi harus memuat minimal satu simbol.";
  return "";
}

/* ---------- Email kampus ---------- */

const EMAIL_LOCAL_PART_RE = /^[A-Za-z0-9](?:[A-Za-z0-9._%+-]{0,62}[A-Za-z0-9])?$/;

/** Ambil bagian sebelum "@" dan buang karakter spasi. */
export function sanitizeEmailLocalPart(raw: string): string {
  return raw.replace(/\s/g, "").split("@")[0];
}

export function buildCampusEmail(localPart: string): string {
  const clean = sanitizeEmailLocalPart(localPart).toLowerCase();
  return clean ? `${clean}@${CAMPUS_EMAIL_DOMAIN}` : "";
}

export function getCampusEmailLocalPart(email: string): string {
  const suffix = `@${CAMPUS_EMAIL_DOMAIN}`;
  return email.toLowerCase().endsWith(suffix) ? email.slice(0, -suffix.length) : sanitizeEmailLocalPart(email);
}

export function validateCampusEmailLocalPart(localPart: string): string {
  const clean = sanitizeEmailLocalPart(localPart);
  if (!clean) return "Nama email wajib diisi.";
  if (!EMAIL_LOCAL_PART_RE.test(clean) || clean.includes("..")) {
    return "Nama email hanya boleh berisi huruf, angka, titik, garis bawah, atau tanda hubung.";
  }
  return "";
}

/* ---------- Nomor telepon +62 ---------- */

export const PHONE_COUNTRY_PREFIX = "+62";
export const INDONESIAN_PHONE_E164_RE = /^\+62[1-9]\d{7,12}$/;

const MAX_NATIONAL_DIGITS = 13;

/**
 * Digit nasional (tanpa +62) dari nilai tersimpan/umum: "+62812...", "0812...", "62812...".
 */
export function nationalDigitsFromStored(raw: string): string {
  const text = (raw ?? "").trim();
  let digits = text.replace(/\D/g, "");
  if (text.startsWith("+")) {
    if (digits.startsWith("62")) digits = digits.slice(2);
  } else if (digits.startsWith("62")) {
    digits = digits.slice(2);
  }
  return digits.replace(/^0+/, "").slice(0, MAX_NATIONAL_DIGITS);
}

/**
 * Digit nasional dari teks yang diketik/ditempel di samping awalan +62.
 * Angka seperti "6281..." atau "+6281..." yang ditempel dianggap sudah memuat kode negara.
 */
export function nationalDigitsFromTyped(raw: string): string {
  const text = (raw ?? "").trim();
  let digits = text.replace(/\D/g, "");
  if (text.startsWith("+") && digits.startsWith("62")) digits = digits.slice(2);
  else if (/^628/.test(digits)) digits = digits.slice(2);
  return digits.replace(/^0+/, "").slice(0, MAX_NATIONAL_DIGITS);
}

/** Bentuk E.164 Indonesia dari nilai apa pun, atau string kosong jika tidak ada digit. */
export function toIndonesianE164(raw: string): string {
  const digits = nationalDigitsFromStored(raw);
  return digits ? `${PHONE_COUNTRY_PREFIX}${digits}` : "";
}

export function validateIndonesianPhone(raw: string, { required = false } = {}): string {
  const e164 = toIndonesianE164(raw);
  if (!e164) return required ? "Nomor telepon wajib diisi." : "";
  if (!INDONESIAN_PHONE_E164_RE.test(e164)) {
    return "Nomor telepon tidak valid. Isi 8–13 digit setelah +62, misalnya +62 81234567890.";
  }
  return "";
}
