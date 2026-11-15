import { z } from "zod";
import { campusEmailSchema, indonesianPhoneSchema, strongPasswordSchema } from "./shared.validator.js";

export const registerSchema = z.object({
  email: campusEmailSchema,
  password: strongPasswordSchema,
  full_name: z.string().trim().min(1).max(160),
  identity_code: z.string().trim().min(1).max(80).regex(/^[A-Za-z0-9._/-]+$/).optional(),
  member_category: z.enum(["student", "faculty_staff", "other"]).optional(),
  phone_e164: indonesianPhoneSchema.optional(),
}).strict();

export const loginSchema = z.object({
  identifier: z.string().trim().min(1).max(254).optional(),
  email: z.string().trim().email().max(254).optional(),
  password: z.string().min(1).max(128),
}).strict().refine((input) => Boolean(input.identifier || input.email), {
  path: ["identifier"],
  message: "Email atau kode identitas wajib diisi.",
});

export const resendConfirmationSchema = z.object({
  identifier: z.string().trim().min(1).max(254).optional(),
  email: z.string().trim().email().max(254).optional(),
}).strict().refine((input) => Boolean(input.identifier || input.email), {
  path: ["email"],
  message: "Email atau kode identitas wajib diisi.",
});


export const changePasswordSchema = z.object({
  current_password: z.string().min(1, "Kata sandi saat ini wajib diisi.").max(128),
  new_password: strongPasswordSchema,
}).strict().refine((input) => input.current_password !== input.new_password, {
  path: ["new_password"],
  message: "Kata sandi baru harus berbeda dari kata sandi saat ini.",
});
