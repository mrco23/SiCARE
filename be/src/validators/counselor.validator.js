import { z } from "zod";

const uuid = z.string().uuid();

export const profilePatchSchema = z.object({
  public_name: z.string().trim().min(1).max(160).optional(),
  headline: z.string().trim().max(240).nullable().optional(),
  bio: z.string().trim().max(5000).nullable().optional(),
  // Jumlah topik keahlian tidak dibatasi (keputusan pengguna 2026-11-26); panjang per topik tetap dibatasi.
  specialties: z
    .array(z.string().trim().min(1).max(100))
    .refine(
      (list) => new Set(list.map((topic) => topic.toLowerCase())).size === list.length,
      { message: "Topik keahlian tidak boleh ganda." },
    )
    .optional(),
  years_experience: z.number().int().min(0).max(80).nullable().optional(),
  photo_path: z.string().trim().max(1000).nullable().optional(),
}).strict();

// No. SIAP dan No. SIPP/SILP diisi dan diperbarui sendiri oleh konselor (sejak 2026-11-26).
const licenseNumber = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[A-Za-z0-9./_\- ]+$/, "Hanya boleh berisi huruf, angka, spasi, titik, garis miring, garis bawah, dan tanda hubung.");
export const licensePatchSchema = z.object({
  siap_number: licenseNumber,
  sipp_silp_number: licenseNumber,
}).strict();

// Riwayat pendidikan konselor (tabel counselor_educations, one-to-many dari counselor_profiles).
export const MAX_COUNSELOR_EDUCATIONS = 20;
const educationFields = {
  institution: z.string().trim().min(1, "Nama perguruan tinggi wajib diisi.").max(160),
  degree: z.string().trim().min(1, "Gelar wajib diisi.").max(160),
  graduation_year: z.number().int().min(1950, "Tahun kelulusan tidak valid.").max(2100, "Tahun kelulusan tidak valid."),
};
export const educationCreateSchema = z.object(educationFields).strict();
export const educationPatchSchema = z
  .object(educationFields)
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, { message: "Minimal satu field pendidikan harus dikirim." });
export const educationIdSchema = z.object({ id: uuid }).strict();

const noteField = (max) => z.string().trim().max(max).transform((value) => value || null).nullable();

export const sessionNotesSchema = z.object({
  counselor_note: noteField(10000),
  client_note: noteField(10000),
  follow_up: noteField(5000),
}).strict();

// Konseling hanya dilayani pada hari kerja (Senin–Jumat) menurut waktu operasional WITA.
// Aturan ini hanya berlaku untuk jadwal yang dibuat/diubah konselor lewat API; data uji
// akhir pekan yang dimasukkan langsung ke database oleh pengelola tidak terpengaruh.
const OPERATIONAL_TIME_ZONE = "Asia/Makassar";

// Sakelar aturan hari kerja (2026-11-27, untuk uji alur konseling di akhir pekan):
// WEEKDAY_ONLY=true|false memaksa; tanpa itu aturan aktif kecuali NODE_ENV development/test.
// Sengaja aktif bila NODE_ENV kosong, agar deployment tanpa NODE_ENV tetap menolak akhir pekan.
// Dibaca setiap validasi agar mengikuti environment proses saat itu.
export function isWeekdayOnlyEnforced(env = process.env) {
  const override = env.WEEKDAY_ONLY?.trim().toLowerCase();
  if (override === "true" || override === "1") return true;
  if (override === "false" || override === "0") return false;
  return env.NODE_ENV !== "development" && env.NODE_ENV !== "test";
}
export function isWeekendInOperationalZone(isoString) {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: OPERATIONAL_TIME_ZONE, weekday: "short" })
    .format(new Date(isoString));
  return weekday === "Sat" || weekday === "Sun";
}

export const slotSchema = z.object({
  starts_at: z.string().datetime({ offset: true }),
  ends_at: z.string().datetime({ offset: true }),
  academic_period_id: uuid.nullable().optional(),
}).strict().superRefine((v, c) => {
  if (Date.parse(v.ends_at) <= Date.parse(v.starts_at)) {
    c.addIssue({ code: "custom", message: "Waktu akhir harus setelah waktu mulai.", path: ["ends_at"] });
  }
  if (Date.parse(v.starts_at) <= Date.now()) {
    c.addIssue({ code: "custom", message: "Jadwal harus berada di masa depan.", path: ["starts_at"] });
  }
  if (isWeekdayOnlyEnforced()
      && (isWeekendInOperationalZone(v.starts_at) || isWeekendInOperationalZone(v.ends_at))) {
    c.addIssue({
      code: "custom",
      message: "Jadwal konseling hanya dapat dibuat pada hari kerja (Senin–Jumat).",
      path: ["starts_at"],
    });
  }
});

export const initPasswordSchema = z.object({
  password: z.string().trim().min(4, "Kata sandi minimal 4 karakter.").max(100),
}).strict();

export const verifyPasswordSchema = z.object({
  password: z.string().trim().min(1, "Kata sandi wajib diisi.").max(100),
}).strict();

export const changePasswordSchema = z.object({
  current_password: z.string().trim().min(1, "Kata sandi saat ini wajib diisi.").max(100),
  new_password: z.string().trim().min(4, "Kata sandi baru minimal 4 karakter.").max(100),
  confirm_password: z.string().trim().min(4, "Konfirmasi kata sandi minimal 4 karakter.").max(100),
}).strict().superRefine((val, ctx) => {
  if (val.new_password !== val.confirm_password) {
    ctx.addIssue({ code: "custom", message: "Konfirmasi kata sandi tidak cocok.", path: ["confirm_password"] });
  }
});

