import { z } from "zod";

export const submitFeedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(5000).optional().nullable(),
}).strict();

export const counselorFeedbackQuerySchema = z.object({
  rating: z.coerce.number().int().min(1).max(5).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
}).strict();

export const adminFeedbackQuerySchema = z.object({
  moderation_status: z.enum(["pending", "shown", "disabled"]).optional(),
  review_status: z.enum(["new", "reviewed", "resolved"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
}).strict();

export const moderationSchema = z.object({
  moderation_status: z.enum(["pending", "shown", "disabled"]),
  disabled_reason: z.string().trim().min(1).max(1000).optional(),
}).strict().superRefine((input, context) => {
  if (input.moderation_status === "disabled" && !input.disabled_reason) {
    context.addIssue({ code: "custom", message: "Alasan wajib diisi saat feedback dinonaktifkan.", path: ["disabled_reason"] });
  }
});

export const reviewSchema = z.object({
  review_status: z.enum(["new", "reviewed", "resolved"]),
}).strict();

