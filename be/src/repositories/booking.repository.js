import { HttpError, supabaseError } from "../lib/http.js";

const BOOKING_SELECT_FIELDS =
  "id,client_id,counselor_id,availability_slot_id,service_type,group_name,participant_count,starts_at,ends_at,status,cancellation_reason,reschedule_reason,created_at,updated_at,booking_participants(id,display_name,is_representative)";

export const bookingRepository = {
  async findById(supabaseClient, bookingId, profile) {
    let query = supabaseClient
      .from("bookings")
      .select(BOOKING_SELECT_FIELDS)
      .eq("id", bookingId);

    query = profile.app_role === "client"
      ? query.eq("client_id", profile.id)
      : query.eq("counselor_id", profile.id);

    const { data, error } = await query.maybeSingle();
    if (error) supabaseError(error, "Booking tidak dapat dibaca.");
    if (!data) throw new HttpError(404, "BOOKING_NOT_FOUND", "Booking tidak ditemukan.");
    return data;
  },

  async list(supabaseClient, { userId, role, status, limit = 50 }) {
    let query = supabaseClient
      .from("bookings")
      .select(BOOKING_SELECT_FIELDS)
      .order("created_at", { ascending: false })
      .limit(limit);

    query = role === "client"
      ? query.eq("client_id", userId)
      : query.eq("counselor_id", userId);

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) supabaseError(error, "Daftar booking tidak dapat dibaca.");
    return data ?? [];
  },
};

