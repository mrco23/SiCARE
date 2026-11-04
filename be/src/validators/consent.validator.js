import { z } from "zod";

export const identitySchema = z.object({
  full_name: z.string().trim().min(2).max(160),
  faculty: z.string().trim().min(2).max(100),
  study_program: z.string().trim().min(2).max(100),
  nim: z.string().trim().min(2).max(50),
  birthplace: z.string().trim().min(2).max(100),
  date_of_birth: z.string().trim().min(8).max(30),
  gender: z.enum(["Laki-laki", "Perempuan"]),
  phone_e164: z.string().trim().min(8).max(25),
}).partial();

export const signPayloadSchema = z.object({
  signature_base64: z.string().min(10),
  agreement_accepted: z.literal(true),
  identity: identitySchema.optional(),
  idempotency_key: z.string().trim().max(128).optional(),
});

