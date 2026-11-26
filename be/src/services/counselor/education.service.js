// @ts-check
import { getSupabaseAdminClient, isSupabaseConfigured } from "../../config/supabase.js";
import { HttpError, supabaseError } from "../../lib/http.js";
import { writeAudit } from "../../lib/audit.js";
import { MAX_COUNSELOR_EDUCATIONS } from "../../validators/counselor.validator.js";

export const EDUCATION_FIELDS = "id,institution,degree,graduation_year,created_at,updated_at";

const supa = () => {
  if (!isSupabaseConfigured())
    throw new HttpError(503, "SUPABASE_NOT_CONFIGURED", "Supabase belum dikonfigurasi pada server.");
  return getSupabaseAdminClient();
};

/** Riwayat pendidikan milik konselor sendiri; kepemilikan selalu dicek lewat counselor_profile_id. */
export const counselorEducationService = {
  async list(counselorId, client = supa()) {
    const { data, error } = await client
      .from("counselor_educations")
      .select(EDUCATION_FIELDS)
      .eq("counselor_profile_id", counselorId)
      .order("graduation_year", { ascending: false })
      .order("created_at", { ascending: true });
    if (error) supabaseError(error, "Riwayat pendidikan tidak dapat dibaca.");
    return data ?? [];
  },

  async create(counselorId, input, client = supa()) {
    const { count, error: countError } = await client
      .from("counselor_educations")
      .select("id", { count: "exact", head: true })
      .eq("counselor_profile_id", counselorId);
    if (countError) supabaseError(countError, "Riwayat pendidikan tidak dapat dibaca.");
    if ((count ?? 0) >= MAX_COUNSELOR_EDUCATIONS) {
      throw new HttpError(
        409,
        "EDUCATION_LIMIT_REACHED",
        `Riwayat pendidikan maksimal ${MAX_COUNSELOR_EDUCATIONS} entri.`,
      );
    }

    const { data, error } = await client
      .from("counselor_educations")
      .insert({ ...input, counselor_profile_id: counselorId })
      .select(EDUCATION_FIELDS)
      .single();
    if (error) {
      // Foreign key: profil konselor belum dibuat admin.
      if (error.code === "23503") {
        throw new HttpError(404, "COUNSELOR_PROFILE_NOT_FOUND", "Profil konselor belum disiapkan oleh admin.");
      }
      supabaseError(error, "Riwayat pendidikan tidak dapat disimpan.");
    }

    await writeAudit({
      actorUserId: counselorId,
      action: "counselor.education.create",
      entityType: "counselor_education",
      entityId: data.id,
      metadata: { role: "counselor" },
    });
    return data;
  },

  async update(counselorId, educationId, input, client = supa()) {
    const { data, error } = await client
      .from("counselor_educations")
      .update(input)
      .eq("id", educationId)
      .eq("counselor_profile_id", counselorId)
      .select(EDUCATION_FIELDS)
      .maybeSingle();
    if (error) supabaseError(error, "Riwayat pendidikan tidak dapat diperbarui.");
    if (!data) throw new HttpError(404, "EDUCATION_NOT_FOUND", "Riwayat pendidikan tidak ditemukan.");

    await writeAudit({
      actorUserId: counselorId,
      action: "counselor.education.update",
      entityType: "counselor_education",
      entityId: educationId,
      metadata: { role: "counselor" },
    });
    return data;
  },

  async remove(counselorId, educationId, client = supa()) {
    const { data, error } = await client
      .from("counselor_educations")
      .delete()
      .eq("id", educationId)
      .eq("counselor_profile_id", counselorId)
      .select("id")
      .maybeSingle();
    if (error) supabaseError(error, "Riwayat pendidikan tidak dapat dihapus.");
    if (!data) throw new HttpError(404, "EDUCATION_NOT_FOUND", "Riwayat pendidikan tidak ditemukan.");

    await writeAudit({
      actorUserId: counselorId,
      action: "counselor.education.delete",
      entityType: "counselor_education",
      entityId: educationId,
      metadata: { role: "counselor" },
    });
    return { id: data.id };
  },
};
