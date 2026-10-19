/*
 * Pilihan untuk form registrasi.
 * Daftar program studi selain Teknik perlu dicek ulang dengan data resmi kampus.
 */

export const FACULTY_PROGRAMS: Record<string, readonly string[]> = {
  Teknik: [
    "Teknik Informatika",
    "Teknik Industri",
    "Teknik Elektro",
    "Teknik Sipil",
    "Teknik Mesin",
  ],
  Ekonomi: ["Manajemen", "Akuntansi"],
  "Pendidikan Guru SD": ["Pendidikan Guru Sekolah Dasar"],
  Keperawatan: ["Ilmu Keperawatan"],
  Kedokteran: ["Pendidikan Dokter"],
};

export const FACULTIES = Object.keys(FACULTY_PROGRAMS);

export const GENDERS = ["Laki-laki", "Perempuan"] as const;

export const RELIGIONS = [
  "Islam",
  "Kristen Protestan",
  "Katolik",
  "Hindu",
  "Buddha",
  "Konghucu",
  "Lainnya",
] as const;

export const EDUCATION_LEVELS = [
  "SMA/Sederajat",
  "Diploma",
  "S1",
  "S2/S3",
  "Lainnya",
] as const;

export const MARITAL_STATUSES = [
  "Belum menikah",
  "Menikah",
  "Cerai hidup",
  "Cerai mati",
] as const;
