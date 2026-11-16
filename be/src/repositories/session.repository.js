import { HttpError, supabaseError } from "../lib/http.js";

const BASE_SESSION_FIELDS =
  "id,booking_id,counselor_id,starts_at,ends_at,status,format,room,started_at,completed_at,created_at,updated_at";
// Kolom missed_* dari migrasi 20261115120000 dan auto_completed_at dari 20261116120000.
// Bila migrasinya belum diterapkan, query diulang dengan kolom yang lebih sedikit.
const MISSED_SESSION_FIELDS = `${BASE_SESSION_FIELDS},missed_reason,missed_at`;
const SESSION_SELECT_FIELDS = `${MISSED_SESSION_FIELDS},auto_completed_at`;
const SESSION_FIELD_FALLBACKS = [SESSION_SELECT_FIELDS, MISSED_SESSION_FIELDS, BASE_SESSION_FIELDS];

function isMissingColumn(error) {
  return error?.code === "42703" || /missed_(reason|at)|auto_completed_at/.test(error?.message ?? "");
}

/** Menjalankan query dengan kolom terbaru, lalu mengulang dengan kolom lebih sedikit bila kolomnya belum ada. */
async function selectWithFallback(build) {
  let result;
  for (const fields of SESSION_FIELD_FALLBACKS) {
    result = await build(fields);
    if (!result.error || !isMissingColumn(result.error)) return result;
  }
  return result;
}

export const sessionRepository = {
  async findForParty(supabaseClient, sessionId, profile) {
    const { data: session, error } = await selectWithFallback((fields) =>
      supabaseClient.from("counseling_sessions").select(fields).eq("id", sessionId).maybeSingle(),
    );

    if (error) supabaseError(error, "Sesi tidak dapat dibaca.");
    if (!session) throw new HttpError(404, "SESSION_NOT_FOUND", "Sesi konseling tidak ditemukan.");

    let bookingQuery = supabaseClient
      .from("bookings")
      .select("id,client_id,counselor_id,service_type,group_name,participant_count,status")
      .eq("id", session.booking_id);

    bookingQuery = profile.app_role === "client"
      ? bookingQuery.eq("client_id", profile.id)
      : bookingQuery.eq("counselor_id", profile.id);

    const { data: booking, error: bookingError } = await bookingQuery.maybeSingle();
    if (bookingError) supabaseError(bookingError, "Booking sesi tidak dapat diverifikasi.");
    if (!booking) throw new HttpError(404, "SESSION_NOT_FOUND", "Sesi konseling tidak ditemukan.");

    return { ...session, booking };
  },

  async list(supabaseClient, { userId, role, status, limit = 50 }) {
    let bookingQuery = supabaseClient.from("bookings").select("id");
    bookingQuery = role === "client"
      ? bookingQuery.eq("client_id", userId)
      : bookingQuery.eq("counselor_id", userId);

    const { data: bookings, error: bookingError } = await bookingQuery;
    if (bookingError) supabaseError(bookingError, "Daftar booking tidak dapat dibaca.");
    const bookingIds = (bookings ?? []).map((booking) => booking.id);
    if (!bookingIds.length) return [];

    const { data, error } = await selectWithFallback((fields) => {
      let query = supabaseClient
        .from("counseling_sessions")
        .select(fields)
        .in("booking_id", bookingIds)
        .order("starts_at", { ascending: false })
        .limit(limit);
      if (status) query = query.eq("status", status);
      return query;
    });
    if (error) supabaseError(error, "Daftar sesi tidak dapat dibaca.");
    return data ?? [];
  },
};

