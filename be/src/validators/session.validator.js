import { z } from "zod";

export const sessionListQuerySchema = z.object({
  status: z.enum(["scheduled", "ongoing", "completed", "cancelled", "missed"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(100000).default(0),
}).strict();

export const sessionStatusSchema = z.object({
  status: z.enum(["ongoing", "completed", "cancelled"]),
  // Alasan wajib saat konselor membatalkan sesi; dikirim ke klien (in-app dan WhatsApp).
  reason: z.string().trim().min(3).max(1000).optional(),
}).strict().superRefine((input, context) => {
  if (input.status === "cancelled" && !input.reason) {
    context.addIssue({ code: "custom", message: "Alasan pembatalan wajib diisi.", path: ["reason"] });
  }
});

