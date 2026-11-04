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

export const adminHeroService = {
  async listHeroMotivations() {
    const { data, error } = await supa()
      .from("hero_motivations")
      .select("id,content,is_active,created_at,updated_at")
      .order("created_at", { ascending: true });

    if (error) supabaseError(error, "Daftar kalimat motivasi tidak dapat dibaca.");
    return data ?? [];
  },

  async createHeroMotivation(input, actorUserId) {
    const { data, error } = await supa()
      .from("hero_motivations")
      .insert(input)
      .select("id,content,is_active,created_at,updated_at")
      .single();

    if (error) supabaseError(error, "Kalimat motivasi tidak dapat dibuat.");

    await writeAudit({
      actorUserId,
      action: "admin.hero_motivation.create",
      entityType: "hero_motivation",
      entityId: data.id,
      metadata: { status: data.is_active ? "active" : "inactive" },
    });

    return data;
  },

  async updateHeroMotivation(id, input, actorUserId) {
    if (!Object.keys(input).length) {
      throw new HttpError(400, "VALIDATION_ERROR", "Minimal satu field harus dikirim.");
    }

    const { data, error } = await supa()
      .from("hero_motivations")
      .update(input)
      .eq("id", id)
      .select("id,content,is_active,created_at,updated_at")
      .maybeSingle();

    if (error) supabaseError(error, "Kalimat motivasi tidak dapat diperbarui.");
    if (!data) throw new HttpError(404, "HERO_MOTIVATION_NOT_FOUND", "Kalimat motivasi tidak ditemukan.");

    await writeAudit({
      actorUserId,
      action: "admin.hero_motivation.update",
      entityType: "hero_motivation",
      entityId: data.id,
      metadata: { status: data.is_active ? "active" : "inactive" },
    });

    return data;
  },

  async deleteHeroMotivation(id, actorUserId) {
    const { data, error } = await supa()
      .from("hero_motivations")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) supabaseError(error, "Kalimat motivasi tidak dapat dihapus.");
    if (!data) throw new HttpError(404, "HERO_MOTIVATION_NOT_FOUND", "Kalimat motivasi tidak ditemukan.");

    await writeAudit({
      actorUserId,
      action: "admin.hero_motivation.delete",
      entityType: "hero_motivation",
      entityId: data.id,
      metadata: { role: "admin" },
    });

    return { deleted: true, id: data.id };
  },
};

