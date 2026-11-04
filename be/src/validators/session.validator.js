import { z } from "zod";

export const sessionListQuerySchema = z.object({
  status: z.enum(["scheduled", "ongoing", "completed", "cancelled"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
}).strict();

export const sessionStatusSchema = z.object({
  status: z.enum(["ongoing", "completed", "cancelled"]),
}).strict();

