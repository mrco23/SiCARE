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

const LICENSE_FIELDS = "siap_number,sipp_silp_number,sipp_silp_valid_until,sipp_silp_updated_at";

export const counselorProfileService = {
  async getLicense(counselorId) {
    const { data, error } = await supa()
      .from("profiles")
      .select(LICENSE_FIELDS)
      .eq("id", counselorId)
      .maybeSingle();

    if (error) supabaseError(error, "Data izin praktik tidak dapat dibaca.");
    if (!data) throw new HttpError(404, "ACCOUNT_NOT_FOUND", "Akun tidak ditemukan.");
    return data;
  },

  async updateLicense(counselorId, input) {
    const { data, error } = await supa()
      .from("profiles")
      .update({ ...input, sipp_silp_updated_at: new Date().toISOString() })
      .eq("id", counselorId)
      .eq("app_role", "counselor")
      .select(LICENSE_FIELDS)
      .maybeSingle();

    if (error) supabaseError(error, "Data izin praktik tidak dapat diperbarui.");
    if (!data) throw new HttpError(404, "ACCOUNT_NOT_FOUND", "Akun tidak ditemukan.");

    await writeAudit({
      actorUserId: counselorId,
      action: "counselor.license.update",
      entityType: "profile",
      entityId: counselorId,
      metadata: { role: "counselor", sipp_silp_valid_until: input.sipp_silp_valid_until },
    });

    return data;
  },

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

