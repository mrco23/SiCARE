import { z } from "zod";

const uuid = z.string().uuid();

export const participantSchema = z.object({
  display_name: z.string().trim().min(1).max(160),
  full_name: z.string().trim().min(1).max(160).optional(),
  phone_e164: z.string().trim().min(8).max(25).optional().nullable(),
  is_representative: z.boolean().default(false),
}).strict();

export const createBookingSchema = z.object({
  counselor_id: uuid,
  availability_slot_id: uuid,
  service_type: z.enum(["individual", "group"]),
  group_name: z.string().trim().min(1).max(160).nullable().optional(),
  participants: z.array(participantSchema).max(10).default([]),
}).strict().superRefine((input, context) => {
  if (input.service_type === "individual") {
    if (input.group_name != null || input.participants.length !== 0) {
      context.addIssue({ code: "custom", message: "Booking individual tidak boleh memiliki data kelompok.", path: ["participants"] });
    }
  } else {
    if (!input.group_name) context.addIssue({ code: "custom", message: "Nama kelompok wajib diisi.", path: ["group_name"] });
    if (input.participants.length < 2 || input.participants.length > 10) {
      context.addIssue({ code: "custom", message: "Kelompok harus memiliki 2 sampai 10 peserta.", path: ["participants"] });
    }
    if (input.participants.filter((participant) => participant.is_representative).length !== 1) {
      context.addIssue({ code: "custom", message: "Tepat satu peserta harus ditandai sebagai perwakilan.", path: ["participants"] });
    }
  }
});

export const bookingListQuerySchema = z.object({
  status: z.enum(["waiting_confirmation", "confirmed", "rejected", "reschedule_requested", "cancelled"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
}).strict();

export const bookingTransitionSchema = z.object({
  status: z.enum(["confirmed", "rejected", "reschedule_requested", "cancelled"]),
  reason: z.string().trim().min(1).max(1000).optional(),
  session_format: z.enum(["online", "offline"]).optional(),
  room: z.string().trim().max(240).nullable().optional(),
}).strict().superRefine((input, context) => {
  if (input.status === "confirmed" && !input.session_format) {
    context.addIssue({ code: "custom", message: "Format sesi wajib dipilih saat menerima booking.", path: ["session_format"] });
  }
  if (["cancelled", "rejected", "reschedule_requested"].includes(input.status) && !input.reason) {
    context.addIssue({ code: "custom", message: "Alasan wajib diisi untuk pembatalan, penolakan, atau permintaan penjadwalan ulang.", path: ["reason"] });
  }
});

export const rescheduleBookingSchema = z.object({
  availability_slot_id: uuid,
}).strict();

