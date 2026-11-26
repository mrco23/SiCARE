import { z } from "zod";
import { campusEmailSchema, indonesianPhoneSchema, strongPasswordSchema } from "./shared.validator.js";

const uuid = z.string().uuid();
export const roles = ["client", "counselor", "admin", "head_lmi"];
export const adminManageableRoles = ["counselor", "head_lmi"];

const genderField = z.enum(["male", "female"]).nullable().optional();

export const accountQuerySchema = z
  .object({
    role: z.enum(roles).optional(),
    status: z.enum(["pending", "active", "disabled"]).optional(),
    search: z.string().trim().max(100).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();

export const createAccountSchema = z
  .object({
    email: campusEmailSchema,
    password: strongPasswordSchema,
    full_name: z.string().trim().min(1).max(160),
    // Admin hanya membuat akun staf/dosen (konselor, Kepala LMI): NIP wajib.
    identity_code: z
      .string({ error: "NIP wajib diisi." })
      .trim()
      .min(1, "NIP wajib diisi.")
      .max(80)
      .regex(/^[A-Za-z0-9._/-]+$/, "NIP hanya boleh berisi huruf, angka, titik, garis miring, garis bawah, dan tanda hubung."),
    member_category: z
      .enum(["student", "faculty_staff", "other"])
      .nullable()
      .optional(),
    app_role: z.enum(adminManageableRoles),
    account_status: z.enum(["pending", "active", "disabled"]).default("active"),
    gender: genderField,
    // No. SIAP dan No. SIPP/SILP diisi sendiri oleh konselor (PATCH /counselor/license), bukan admin.
  })
  .strict()
  .superRefine((input, ctx) => {
    if (!input.gender) {
      ctx.addIssue({ code: "custom", path: ["gender"], message: "Jenis kelamin wajib diisi." });
    }
  });

/**
 * Admin tidak berhak mengubah data akun (nama, NIP, role, kontak, data konselor).
 * Endpoint ubah akun hanya menerima perubahan status, misalnya mengaktifkan kembali akun.
 * Menonaktifkan akun memakai endpoint deactivate agar booking aktif ikut ditutup.
 */
export const patchAccountSchema = z
  .object({
    account_status: z.enum(["pending", "active", "disabled"]),
  })
  .strict();

export const createPeriodSchema = z
  .object({
    academic_year: z
      .string()
      .trim()
      .regex(/^\d{4}\/\d{4}$/),
    semester: z.enum(["Ganjil", "Genap"]),
    starts_on: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/),
    ends_on: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/),
    // Periode tidak punya status (is_active/is_published dihapus): setiap periode langsung berlaku.
  })
  .strict()
  .superRefine((v, c) => {
    if (v.ends_on <= v.starts_on)
      c.addIssue({
        code: "custom",
        message: "Tanggal akhir harus setelah tanggal mulai.",
        path: ["ends_on"],
      });
  });

export const patchPeriodSchema = z
  .object({
    academic_year: z
      .string()
      .trim()
      .regex(/^\d{4}\/\d{4}$/)
      .optional(),
    semester: z.enum(["Ganjil", "Genap"]).optional(),
    starts_on: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    ends_on: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  })
  .strict()
  .refine(
    (input) =>
      input.academic_year !== undefined ||
      input.semester !== undefined ||
      input.starts_on !== undefined ||
      input.ends_on !== undefined,
    { message: "Setidaknya satu field harus diisi." },
  );

export const heroMotivationSchema = z
  .object({
    content: z
      .string()
      .trim()
      .min(10, "Kalimat motivasi minimal 10 karakter.")
      .max(280, "Kalimat motivasi maksimal 280 karakter.")
      .refine((v) => !v.includes("\n") && !v.includes("\r"), {
        message: "Kalimat motivasi harus satu baris (tanpa newline).",
      }),
    is_active: z.boolean().default(true),
  })
  .strict();

export const patchHeroMotivationSchema = z
  .object({
    content: z
      .string()
      .trim()
      .min(10, "Kalimat motivasi minimal 10 karakter.")
      .max(280, "Kalimat motivasi maksimal 280 karakter.")
      .refine((v) => !v.includes("\n") && !v.includes("\r"), {
        message: "Kalimat motivasi harus satu baris (tanpa newline).",
      })
      .optional(),
    is_active: z.boolean().optional(),
  })
  .strict()
  .refine((v) => v.content !== undefined || v.is_active !== undefined, {
    message: "Setidaknya satu field (content atau is_active) harus diisi.",
  });

