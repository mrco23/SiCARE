import type {
  CounselorProfile,
  CounselorProfileErrors,
} from "../../../types/counselorProfile";

export const MAX_COUNSELOR_TOPICS = 6;
export const MAX_COUNSELOR_TOPIC_LENGTH = 40;
export const MAX_COUNSELOR_BIO_LENGTH = 500;
export const MAX_COUNSELOR_PHOTO_BYTES = 2 * 1024 * 1024;
export const COUNSELOR_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const COUNSELOR_PHONE_PATTERN = /^(\+62|62|0)[0-9]{8,13}$/;
export const MIN_ACCOUNT_PASSWORD_LENGTH = 8;

export function cloneCounselorProfile(profile: CounselorProfile): CounselorProfile {
  return JSON.parse(JSON.stringify(profile)) as CounselorProfile;
}

export function validateCounselorProfile(
  profile: CounselorProfile,
  currentYear: number,
): CounselorProfileErrors {
  const errors: CounselorProfileErrors = {};
  if (!profile.displayName.trim()) {
    errors.displayName = "Nama tampil wajib diisi";
  }
  if (profile.bio.length > MAX_COUNSELOR_BIO_LENGTH) {
    errors.bio = `Maksimal ${MAX_COUNSELOR_BIO_LENGTH} karakter`;
  }
  const experienceYear = profile.experienceStartYear.trim();
  if (
    !/^\d{4}$/.test(experienceYear) ||
    Number(experienceYear) < 1950 ||
    Number(experienceYear) > currentYear
  ) {
    errors.experience = `Isi tahun mulai berpraktik (1950–${currentYear})`;
  }
  if (!profile.topics.length) errors.topics = "Pilih minimal satu topik";
  const phone = profile.phone.replace(/[\s()-]/g, "");
  if (!phone) errors.phone = "Nomor telepon wajib diisi";
  else if (!COUNSELOR_PHONE_PATTERN.test(phone)) {
    errors.phone = "Format nomor telepon tidak valid";
  }
  if (!profile.services.individual && !profile.services.group) {
    errors.services = "Pilih minimal satu jenis layanan";
  }
  return errors;
}
