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

export async function validatePeriodOverlap(client, startsOn, endsOn, excludeId = null) {
  let query = client
    .from("academic_periods")
    .select("id,academic_year,semester,starts_on,ends_on")
    .lte("starts_on", endsOn)
    .gte("ends_on", startsOn);

  if (excludeId) {
    query = query.neq("id", excludeId);
  }

  const { data: overlapping, error } = await query;
  if (error) {
    supabaseError(error, "Gagal memverifikasi benturan periode akademik.");
  }

  if (overlapping && overlapping.length > 0) {
    const conflict = overlapping[0];
    throw new HttpError(
      409,
      "PERIOD_OVERLAP",
      `Rentang tanggal bertabrakan dengan periode akademik yang sudah ada (${conflict.academic_year} ${conflict.semester}: ${conflict.starts_on} s/d ${conflict.ends_on}).`,
      { overlapping: conflict },
    );
  }
}

export const adminPeriodsService = {
  async listPeriods() {
    const { data, error } = await supa()
      .from("academic_periods")
      .select(
        "id,academic_year,semester,starts_on,ends_on,is_published,created_at,updated_at",
      )
      .order("starts_on", { ascending: false });

    if (error) supabaseError(error, "Daftar periode akademik tidak dapat dibaca.");
    return data ?? [];
  },

  async createPeriod(input, actorUserId) {
    await validatePeriodOverlap(supa(), input.starts_on, input.ends_on);

    const { data, error } = await supa()
      .from("academic_periods")
      .insert(input)
      .select(
        "id,academic_year,semester,starts_on,ends_on,is_published,created_at,updated_at",
      )
      .single();

    if (error) supabaseError(error, "Periode akademik tidak dapat dibuat.");

    await writeAudit({
      actorUserId,
      action: "admin.period.create",
      entityType: "academic_period",
      entityId: data.id,
      metadata: {
        status: input.is_published ? "published" : "draft",
        role: "admin",
      },
    });

    return data;
  },

  async updatePeriod(id, input, actorUserId) {
    if (!Object.keys(input).length) {
      throw new HttpError(400, "VALIDATION_ERROR", "Minimal satu field harus dikirim.");
    }

    const { data: current, error: currentError } = await supa()
      .from("academic_periods")
      .select("starts_on,ends_on")
      .eq("id", id)
      .maybeSingle();

    if (currentError) supabaseError(currentError);
    if (!current) throw new HttpError(404, "PERIOD_NOT_FOUND", "Periode akademik tidak ditemukan.");

    const starts = input.starts_on ?? current.starts_on;
    const ends = input.ends_on ?? current.ends_on;
    if (ends < starts) {
      throw new HttpError(
        400,
        "INVALID_DATE_RANGE",
        "Tanggal akhir harus sama dengan atau setelah tanggal mulai.",
      );
    }

    await validatePeriodOverlap(supa(), starts, ends, id);

    const { data, error } = await supa()
      .from("academic_periods")
      .update(input)
      .eq("id", id)
      .select(
        "id,academic_year,semester,starts_on,ends_on,is_published,created_at,updated_at",
      )
      .maybeSingle();

    if (error) supabaseError(error, "Periode akademik tidak dapat diperbarui.");
    if (!data) throw new HttpError(404, "PERIOD_NOT_FOUND", "Periode akademik tidak ditemukan.");

    await writeAudit({
      actorUserId,
      action: "admin.period.update",
      entityType: "academic_period",
      entityId: data.id,
      metadata: {
        status: data.is_published ? "published" : "draft",
        role: "admin",
      },
    });

    return data;
  },

  async deletePeriod() {
    throw new HttpError(
      405,
      "METHOD_NOT_ALLOWED",
      "Periode akademik tidak dapat dihapus untuk menjaga integritas data historis konseling.",
    );
  },
};
