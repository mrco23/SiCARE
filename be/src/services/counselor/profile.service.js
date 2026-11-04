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

export const counselorProfileService = {
  async getProfile(counselorId) {
    const { data, error } = await supa()
      .from("counselor_profiles")
      .select("profile_id,public_name,headline,bio,specialties,years_experience,photo_path,is_public,created_at,updated_at")
      .eq("profile_id", counselorId)
      .maybeSingle();

    if (error) supabaseError(error, "Profil konselor tidak dapat dibaca.");
    if (!data) throw new HttpError(404, "COUNSELOR_PROFILE_NOT_FOUND", "Profil konselor belum disiapkan oleh admin.");
    return data;
  },

  async updateProfile(counselorId, input) {
    if (!Object.keys(input).length) {
      throw new HttpError(400, "VALIDATION_ERROR", "Minimal satu field profil harus dikirim.");
    }

    const { data, error } = await supa()
      .from("counselor_profiles")
      .update(input)
      .eq("profile_id", counselorId)
      .select("profile_id,public_name,headline,bio,specialties,years_experience,photo_path,is_public,created_at,updated_at")
      .maybeSingle();

    if (error) supabaseError(error, "Profil konselor tidak dapat diperbarui.");
    if (!data) throw new HttpError(404, "COUNSELOR_PROFILE_NOT_FOUND", "Profil konselor belum disiapkan oleh admin.");

    await writeAudit({
      actorUserId: counselorId,
      action: "counselor.profile.update",
      entityType: "counselor_profile",
      entityId: data.profile_id,
      metadata: { role: "counselor" },
    });

    return data;
  },
};

