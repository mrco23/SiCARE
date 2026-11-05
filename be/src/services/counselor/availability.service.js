// @ts-check
import { getSupabaseAdminClient, isSupabaseConfigured } from "../../config/supabase.js";
import { HttpError, supabaseError } from "../../lib/http.js";
import { writeAudit } from "../../lib/audit.js";

const supa = () => {
  if (!isSupabaseConfigured())
    throw new HttpError(
      503,
      "SUPABASE_NOT_CONFIGURED",
      "Supabase belum dikonfigurasi pada backend.",
    );
  return getSupabaseAdminClient();
};

export const counselorAvailabilityService = {
  async listAvailability(counselorId, status) {
    if (status !== undefined && !["available", "blocked", "cancelled"].includes(status)) {
      throw new HttpError(400, "VALIDATION_ERROR", "Filter status jadwal tidak valid.");
    }

    let query = supa()
      .from("availability_slots")
      .select("id,counselor_id,academic_period_id,starts_at,ends_at,status,created_at,updated_at")
      .eq("counselor_id", counselorId)
      .order("starts_at", { ascending: true })
      .limit(200);

    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    if (error) supabaseError(error, "Jadwal konselor tidak dapat dibaca.");
    return data ?? [];
  },

  async saveSlot(counselorId, slotId, input) {
    const { data, error } = await supa().rpc("sicare_save_availability_slot", {
      p_counselor_id: counselorId,
      p_slot_id: slotId,
      p_starts_at: input.starts_at,
      p_ends_at: input.ends_at,
      p_academic_period_id: input.academic_period_id ?? null,
    });

    if (error) {
      const message = error.message ?? "";
      if (message.includes("AVAILABILITY_OVERLAP"))
        throw new HttpError(409, "AVAILABILITY_OVERLAP", "Jadwal bertabrakan dengan jadwal atau booking lain.");
      if (message.includes("AVAILABILITY_NOT_FOUND"))
        throw new HttpError(404, "AVAILABILITY_NOT_FOUND", "Jadwal tidak ditemukan.");
      if (message.includes("AVAILABILITY_BOOKED"))
        throw new HttpError(409, "AVAILABILITY_BOOKED", "Jadwal sudah memiliki booking aktif dan tidak dapat diubah.");
      if (message.includes("AVAILABILITY_PERIOD_INVALID"))
        throw new HttpError(400, "AVAILABILITY_PERIOD_INVALID", "Periode akademik tidak valid atau tanggal jadwal di luar periode.");
      if (message.includes("AVAILABILITY_TIME_INVALID"))
        throw new HttpError(400, "AVAILABILITY_TIME_INVALID", "Jadwal harus berada di masa depan dan waktu akhir setelah waktu mulai.");
      if (message.includes("AVAILABILITY_FORBIDDEN"))
        throw new HttpError(403, "AVAILABILITY_FORBIDDEN", "Akun tidak berhak mengelola jadwal ini.");
      supabaseError(error, "Jadwal tidak dapat disimpan.");
    }

    const { data: slot, error: slotError } = await supa()
      .from("availability_slots")
      .select("id,counselor_id,academic_period_id,starts_at,ends_at,status,created_at,updated_at")
      .eq("id", data)
      .single();

    if (slotError) supabaseError(slotError, "Jadwal tersimpan tetapi tidak dapat dibaca.");

    await writeAudit({
      actorUserId: counselorId,
      action: slotId ? "counselor.availability.update" : "counselor.availability.create",
      entityType: "availability_slot",
      entityId: data,
      metadata: { status: "available", role: "counselor" },
    });

    return slot;
  },

  async cancelSlot(counselorId, slotId) {
    const { data, error } = await supa().rpc("sicare_cancel_availability_slot", {
      p_counselor_id: counselorId,
      p_slot_id: slotId,
    });

    if (error) {
      if ((error.message ?? "").includes("AVAILABILITY_NOT_FOUND"))
        throw new HttpError(404, "AVAILABILITY_NOT_FOUND", "Jadwal tidak ditemukan.");
      if ((error.message ?? "").includes("AVAILABILITY_BOOKED"))
        throw new HttpError(409, "AVAILABILITY_BOOKED", "Jadwal memiliki booking aktif dan tidak dapat dibatalkan.");
      if ((error.message ?? "").includes("AVAILABILITY_FORBIDDEN"))
        throw new HttpError(403, "AVAILABILITY_FORBIDDEN", "Akun tidak berhak mengelola jadwal ini.");
      supabaseError(error, "Jadwal tidak dapat dibatalkan.");
    }

    await writeAudit({
      actorUserId: counselorId,
      action: "counselor.availability.cancel",
      entityType: "availability_slot",
      entityId: slotId,
      metadata: { status: "cancelled", role: "counselor" },
    });

    return { id: slotId, status: data ?? "cancelled" };
  },
};

