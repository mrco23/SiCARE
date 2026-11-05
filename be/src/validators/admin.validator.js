import { z } from "zod";

const uuid = z.string().uuid();
export const roles = ["client", "counselor", "admin", "head_lmi"];
export const adminManageableRoles = ["counselor", "head_lmi"];

const genderField = z.enum(["male", "female"]).nullable().optional();
const licenseNumberField = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[A-Za-z0-9./_\- ]+$/)
  .nullable()
  .optional();

const validUntilField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)))
  .nullable()
  .optional();

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
    email: z.string().trim().email().max(254),
    password: z.string().min(8).max(128),
    full_name: z.string().trim().min(1).max(160),
    identity_code: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .regex(/^[A-Za-z0-9._/-]+$/)
      .nullable()
      .optional(),
    member_category: z
      .enum(["student", "faculty_staff", "other"])
      .nullable()
      .optional(),
    app_role: z.enum(adminManageableRoles),
    account_status: z.enum(["pending", "active", "disabled"]).default("active"),
    gender: genderField,
    siap_number: licenseNumberField,
    sipp_silp_number: licenseNumberField,
    sipp_silp_valid_until: validUntilField,
  })
  .strict()
  .superRefine((input, ctx) => {
    if (!input.gender) {
      ctx.addIssue({ code: "custom", path: ["gender"], message: "Jenis kelamin wajib diisi." });
    }
    if (input.app_role !== "counselor") return;
    for (const field of ["siap_number", "sipp_silp_number"]) {
      if (!input[field]) {
        ctx.addIssue({ code: "custom", path: [field], message: "Wajib diisi untuk akun konselor." });
      }
    }
  });

export const patchAccountSchema = z
  .object({
    full_name: z.string().trim().min(1).max(160).optional(),
    identity_code: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .regex(/^[A-Za-z0-9._/-]+$/)
      .nullable()
      .optional(),
    member_category: z
      .enum(["student", "faculty_staff", "other"])
      .nullable()
      .optional(),
    phone_e164: z.string().trim().min(8).max(20).nullable().optional(),
    app_role: z.enum(adminManageableRoles).optional(),
    account_status: z.enum(["pending", "active", "disabled"]).optional(),
    gender: genderField,
    siap_number: licenseNumberField,
    sipp_silp_number: licenseNumberField,
    sipp_silp_valid_until: validUntilField,
  })
  .strict()
  .refine(
    (input) =>
      input.full_name !== undefined ||
      input.identity_code !== undefined ||
      input.member_category !== undefined ||
      input.phone_e164 !== undefined ||
      input.app_role !== undefined ||
      input.account_status !== undefined ||
      input.gender !== undefined ||
      input.siap_number !== undefined ||
      input.sipp_silp_number !== undefined ||
      input.sipp_silp_valid_until !== undefined,
    { message: "Setidaknya satu field harus diisi." },
  );

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
    is_active: z.boolean().default(false),
    is_published: z.boolean().default(false),
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
    is_active: z.boolean().optional(),
    is_published: z.boolean().optional(),
  })
  .strict()
  .refine(
    (input) =>
      input.academic_year !== undefined ||
      input.semester !== undefined ||
      input.starts_on !== undefined ||
      input.ends_on !== undefined ||
      input.is_active !== undefined ||
      input.is_published !== undefined,
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

