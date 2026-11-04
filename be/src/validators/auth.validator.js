import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128),
  full_name: z.string().trim().min(1).max(160),
  identity_code: z.string().trim().min(1).max(80).regex(/^[A-Za-z0-9._/-]+$/).optional(),
  member_category: z.enum(["student", "faculty_staff", "other"]).optional(),
  phone_e164: z.string().trim().regex(/^\+[1-9]\d{6,14}$/).optional(),
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

