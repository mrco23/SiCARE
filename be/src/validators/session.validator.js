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
  // Catatan wajib saat konselor menyelesaikan sesi (keputusan pengguna 2026-11-25), diisi di
  // Aktivitas Konselor. Batas panjang sama dengan sessionNotesSchema.
  counselor_note: z.string().trim().min(1).max(10000).optional(),
  client_note: z.string().trim().min(1).max(10000).optional(),
  follow_up: z.string().trim().max(5000).optional(),
}).strict().superRefine((input, context) => {
  if (input.status === "cancelled" && !input.reason) {
    context.addIssue({ code: "custom", message: "Alasan pembatalan wajib diisi.", path: ["reason"] });
  }
  if (input.status === "completed") {
    if (!input.counselor_note) {
      context.addIssue({ code: "custom", message: "Catatan konselor wajib diisi sebelum menyelesaikan sesi.", path: ["counselor_note"] });
    }
    if (!input.client_note) {
      context.addIssue({ code: "custom", message: "Catatan untuk klien wajib diisi sebelum menyelesaikan sesi.", path: ["client_note"] });
    }
  } else if (input.counselor_note || input.client_note || input.follow_up) {
    context.addIssue({ code: "custom", message: "Catatan hanya dikirim saat menyelesaikan sesi.", path: ["counselor_note"] });
  }
});

