import { z } from "zod";
import { INDONESIAN_PHONE_E164_RE } from "./shared.validator.js";

const uuid = z.string().uuid();

/** 08…/62…/+62…/8… → +62… (nomor WhatsApp anggota kelompok disimpan seragam). */
export function normalizeParticipantPhone(raw) {
  if (typeof raw !== "string") return raw;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/[^0-9]/g, "");
  if (digits.startsWith("0")) return `+62${digits.slice(1)}`;
  if (digits.startsWith("62")) return `+${digits}`;
  if (digits.startsWith("8")) return `+62${digits}`;
  return trimmed;
}

/** Nama untuk mendeteksi anggota ganda: huruf kecil, spasi dirapikan. */
function participantNameKey(name) {
  return String(name ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export const participantSchema = z.object({
  display_name: z.string().trim().min(1).max(160),
  full_name: z.string().trim().min(1).max(160).optional(),
  phone_e164: z
    .preprocess(
      normalizeParticipantPhone,
      z.string().regex(INDONESIAN_PHONE_E164_RE, "Nomor WhatsApp anggota tidak valid. Contoh: 081234567890.").nullable(),
    )
    .optional(),
  is_representative: z.boolean().default(false),
}).strict();

// Mirrors ClientIntake (fe/src/types/counseling.ts) and the booking form's field limits
// (fe/src/pages/client/KlienPesananPage.tsx). One set of answers per booking, filled by
// the client/representative who creates it — not per group participant (SOP decision,
// 2026-11-13; see supabase/migrations/20261113130000_sicare_booking_intakes.sql).
const intakeAnswerEnum = z.enum(["Ya", "Mungkin", "Tidak"]);
const intakeEssayField = z.string().trim().min(1).max(1500);

// Sejak 2026-11-24 mengikuti Google Form LMI: pertanyaan bunuh diri hanya Ya/Tidak, dan
// "Masalah yang ingin dibahas" tepat satu pilihan dari daftar ini, atau "Yang lain" (field other).
// Jawaban lama yang sudah tersimpan tidak divalidasi ulang.
export const INTAKE_TOPIC_OPTIONS = [
  "Relasi keluarga",
  "Relasi bersama pasangan",
  "Relasi di lingkungan sosial (teman, rekan kerja)",
  "Emosi, mood, kepribadian",
  "Karir, pendidikan, dan pekerjaan",
  "Motivasi",
];

export const clientIntakeAnswersSchema = z.object({
  selfHarm: z.enum(["Ya", "Tidak"]),
  distress: intakeAnswerEnum,
  abuse: intakeAnswerEnum,
  substance: intakeAnswerEnum,
  sleep: z.number().int().min(1).max(5),
  finance: z.number().int().min(1).max(5),
  topics: z.array(z.enum(INTAKE_TOPIC_OPTIONS)).max(1).default([]),
  other: z.string().trim().max(80).optional().default(""),
  complaint: intakeEssayField,
  history: intakeEssayField,
  reason: intakeEssayField,
  efforts: intakeEssayField,
  goal: intakeEssayField,
  strengths: intakeEssayField,
  weaknesses: intakeEssayField,
}).strict().superRefine((input, context) => {
  const choices = input.topics.length + (input.other.trim() ? 1 : 0);
  if (choices !== 1) {
    context.addIssue({
      code: "custom",
      message: "Pilih tepat satu masalah, atau isi \"Yang lain\".",
      path: ["topics"],
    });
  }
});

export const createBookingSchema = z.object({
  counselor_id: uuid,
  availability_slot_id: uuid,
  service_type: z.enum(["individual", "group"]),
  group_name: z.string().trim().min(1).max(160).nullable().optional(),
  participants: z.array(participantSchema).max(10).default([]),
  intake_answers: clientIntakeAnswersSchema.optional(),
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
    // Anggota (selain perwakilan) wajib punya nomor WhatsApp untuk menerima tautan consent,
    // dan tidak boleh ganda (nama atau nomor sama) dalam satu kelompok.
    const seenNames = new Set();
    const seenPhones = new Set();
    input.participants.forEach((participant, index) => {
      if (!participant.is_representative && !participant.phone_e164) {
        context.addIssue({
          code: "custom",
          message: `Nomor WhatsApp anggota "${participant.display_name}" wajib diisi.`,
          path: ["participants", index, "phone_e164"],
        });
      }
      const nameKey = participantNameKey(participant.full_name ?? participant.display_name);
      if (seenNames.has(nameKey)) {
        context.addIssue({
          code: "custom",
          message: `Anggota "${participant.display_name}" tercantum lebih dari sekali.`,
          path: ["participants", index, "display_name"],
        });
      }
      seenNames.add(nameKey);
      if (participant.phone_e164) {
        if (seenPhones.has(participant.phone_e164)) {
          context.addIssue({
            code: "custom",
            message: `Nomor WhatsApp ${participant.phone_e164} dipakai lebih dari satu anggota.`,
            path: ["participants", index, "phone_e164"],
          });
        }
        seenPhones.add(participant.phone_e164);
      }
    });
  }
});

export const bookingListQuerySchema = z.object({
  status: z.enum(["waiting_confirmation", "confirmed", "rejected", "reschedule_requested", "cancelled", "expired"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(100000).default(0),
}).strict();

export const bookingTransitionSchema = z.object({
  status: z.enum(["confirmed", "rejected", "reschedule_requested", "cancelled"]),
  reason: z.string().trim().min(1).max(1000).optional(),
  room: z.string().trim().max(240).nullable().optional(),
}).strict().superRefine((input, context) => {
  if (["cancelled", "rejected", "reschedule_requested"].includes(input.status) && !input.reason) {
    context.addIssue({ code: "custom", message: "Alasan wajib diisi untuk pembatalan, penolakan, atau permintaan penjadwalan ulang.", path: ["reason"] });
  }
});

export const rescheduleBookingSchema = z.object({
  availability_slot_id: uuid,
}).strict();

