import { z } from "zod";

const uuid = z.string().uuid();

export const profilePatchSchema = z.object({
  public_name: z.string().trim().min(1).max(160).optional(),
  headline: z.string().trim().max(240).nullable().optional(),
  bio: z.string().trim().max(5000).nullable().optional(),
  specialties: z.array(z.string().trim().min(1).max(100)).max(20).optional(),
  years_experience: z.number().int().min(0).max(80).nullable().optional(),
  photo_path: z.string().trim().max(1000).nullable().optional(),
}).strict();

// SIAP sengaja tidak ada: nomor itu hanya dikelola Admin.
export const licensePatchSchema = z.object({
  sipp_silp_number: z.string().trim().min(1).max(80).regex(/^[A-Za-z0-9./_\- ]+$/),
  sipp_silp_valid_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).strict().superRefine((value, ctx) => {
  const date = value.sipp_silp_valid_until;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Makassar" }).format(new Date());
  if (Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    ctx.addIssue({ code: "custom", message: "Tanggal berlaku tidak valid.", path: ["sipp_silp_valid_until"] });
  } else if (date < today) {
    ctx.addIssue({ code: "custom", message: "Tanggal berlaku sudah lewat.", path: ["sipp_silp_valid_until"] });
  }
});

const noteField = (max) => z.string().trim().max(max).transform((value) => value || null).nullable();

export const sessionNotesSchema = z.object({
  counselor_note: noteField(10000),
  client_note: noteField(10000),
  follow_up: noteField(5000),
}).strict();

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

