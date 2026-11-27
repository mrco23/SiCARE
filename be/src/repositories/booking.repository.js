import { HttpError, supabaseError } from "../lib/http.js";

const BASE_BOOKING_FIELDS =
  "id,client_id,counselor_id,availability_slot_id,service_type,group_name,participant_count,starts_at,ends_at,status,cancellation_reason,reschedule_reason,created_at,updated_at";
const PARTICIPANT_FIELDS = "booking_participants(id,display_name,is_representative)";
// expired_at dari migrasi 20261115140000 dan expired_reason dari 20261116120000. Bila migrasinya
// belum diterapkan, query diulang dengan kolom yang lebih sedikit.
const BOOKING_FIELD_FALLBACKS = [
  `${BASE_BOOKING_FIELDS},expired_at,expired_reason,${PARTICIPANT_FIELDS}`,
  `${BASE_BOOKING_FIELDS},expired_at,${PARTICIPANT_FIELDS}`,
  `${BASE_BOOKING_FIELDS},${PARTICIPANT_FIELDS}`,
];

function isMissingColumn(error) {
  return error?.code === "42703" || /expired_(at|reason)/.test(error?.message ?? "");
}

async function selectWithFallback(build) {
  let result;
  for (const fields of BOOKING_FIELD_FALLBACKS) {
    result = await build(fields);
    if (!result.error || !isMissingColumn(result.error)) return result;
  }
  return result;
}

export const bookingRepository = {
  async findById(supabaseClient, bookingId, profile) {
    const { data, error } = await selectWithFallback((fields) => {
      const query = supabaseClient.from("bookings").select(fields).eq("id", bookingId);
      return (profile.app_role === "client"
        ? query.eq("client_id", profile.id)
        : query.eq("counselor_id", profile.id)
      ).maybeSingle();
    });
    if (error) supabaseError(error, "Booking tidak dapat dibaca.");
    if (!data) throw new HttpError(404, "BOOKING_NOT_FOUND", "Booking tidak ditemukan.");
    return data;
  },

  async list(supabaseClient, { userId, role, status, limit = 50, offset = 0 }) {
    const { data, error } = await selectWithFallback((fields) => {
      let query = supabaseClient
        .from("bookings")
        .select(fields)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(offset, offset + limit - 1);

      query = role === "client"
        ? query.eq("client_id", userId)
        : query.eq("counselor_id", userId);

      if (status) {
        query = query.eq("status", status);
      }
      return query;
    });
    if (error) supabaseError(error, "Daftar booking tidak dapat dibaca.");
    return data ?? [];
  },

  /**
   * Reads stored intake answers for the given booking ids, keyed by booking_id.
   * Callers are responsible for only requesting ids the caller is allowed to see
   * (booking.service.js only calls this for the counselor who owns the booking).
   */
  async findIntakeAnswersByBookingIds(supabaseClient, bookingIds) {
    if (!bookingIds.length) return new Map();
    const { data, error } = await supabaseClient
      .from("booking_intakes")
      .select("booking_id,answers")
      .in("booking_id", bookingIds);
    if (error) supabaseError(error, "Jawaban formulir klien tidak dapat dibaca.");
    return new Map((data ?? []).map((row) => [row.booking_id, row.answers]));
  },

  /**
   * Booking asal untuk "Ajukan jadwal baru", hanya milik klien tersebut, beserta peserta dan
   * status sesinya. Mengembalikan null bila tidak ada (atau bukan milik klien).
   */
  async findRebookSource(supabaseClient, bookingId, clientId) {
    const { data, error } = await supabaseClient
      .from("bookings")
      .select(
        "id,client_id,counselor_id,service_type,group_name,status,starts_at,"
          + "booking_participants(display_name,full_name,phone_e164,is_representative,participant_status),"
          + "counseling_sessions(status)",
      )
      .eq("id", bookingId)
      .eq("client_id", clientId)
      .maybeSingle();
    if (error) supabaseError(error, "Booking asal tidak dapat dibaca.");
    return data ?? null;
  },

  /**
   * Peta booking asal -> booking baru untuk semua "Ajukan jadwal baru" milik klien, dibaca dari
   * audit_events (action booking.rebook, metadata.source_booking_id). Tanpa migrasi kolom baru.
   */
  async findRebookedMap(supabaseClient, clientId) {
    const { data, error } = await supabaseClient
      .from("audit_events")
      .select("entity_id,metadata")
      .eq("action", "booking.rebook")
      .eq("actor_user_id", clientId);
    if (error) supabaseError(error, "Riwayat pengajuan ulang tidak dapat dibaca.");
    const map = new Map();
    for (const row of data ?? []) {
      const source = row.metadata?.source_booking_id;
      if (typeof source === "string" && row.entity_id) map.set(source, row.entity_id);
    }
    return map;
  },

  async saveIntakeAnswers(supabaseClient, { bookingId, clientId, answers }) {
    const { error } = await supabaseClient
      .from("booking_intakes")
      .upsert({ booking_id: bookingId, client_id: clientId, answers }, { onConflict: "booking_id" });
    if (error) supabaseError(error, "Jawaban formulir klien tidak dapat disimpan.");
  },
};

