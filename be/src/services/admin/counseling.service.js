// @ts-check
import { getSupabaseAdminClient, isSupabaseConfigured } from "../../config/supabase.js";
import { HttpError, supabaseError } from "../../lib/http.js";

const supa = () => {
  if (!isSupabaseConfigured())
    throw new HttpError(
      503,
      "SUPABASE_NOT_CONFIGURED",
      "Supabase belum dikonfigurasi pada backend.",
    );
  return getSupabaseAdminClient();
};

/** Kepala LMI hanya melihat data agregat; identitas klien dan teks bebas tidak dikirim. */
export function redactClientIdentity(booking) {
  return {
    ...booking,
    client_id: null,
    client: null,
    group_name: null,
    cancellation_reason: null,
    reschedule_reason: null,
    booking_participants: [],
  };
}

export const adminCounselingService = {
  async listCounseling(limit = 50, { redactClient = false } = {}) {
    const { data, error } = await supa()
      .from("bookings")
      .select(
        "id,client_id,counselor_id,availability_slot_id,service_type,group_name,participant_count,starts_at,ends_at,status,cancellation_reason,reschedule_reason,created_at,updated_at,client:profiles!bookings_client_id_fkey(id,full_name),counselor:profiles!bookings_counselor_id_fkey(id,full_name),booking_participants(id,display_name,is_representative),counseling_sessions(id,status,format,room,started_at,completed_at)",
      )
      .order("starts_at", { ascending: false })
      .limit(limit);

    if (error) supabaseError(error, "Data konseling tidak dapat dibaca.");

    const normalized = (data ?? []).map((booking) => {
      let sessions = [];
      if (Array.isArray(booking.counseling_sessions)) {
        sessions = booking.counseling_sessions;
      } else if (
        booking.counseling_sessions &&
        typeof booking.counseling_sessions === "object"
      ) {
        sessions = [booking.counseling_sessions];
      }
      return {
        ...booking,
        counseling_sessions: sessions,
      };
    });

    return redactClient ? normalized.map(redactClientIdentity) : normalized;
  },

  async listActivity(limit = 50) {
    const [bookings, sessions, feedback] = await Promise.all([
      supa()
        .from("bookings")
        .select("id,status,client_id,counselor_id,created_at,updated_at")
        .order("updated_at", { ascending: false })
        .limit(limit),
      supa()
        .from("counseling_sessions")
        .select("id,booking_id,status,counselor_id,created_at,updated_at")
        .order("updated_at", { ascending: false })
        .limit(limit),
      supa()
        .from("feedback")
        .select(
          "id,session_id,moderation_status,review_status,created_at,updated_at",
        )
        .order("updated_at", { ascending: false })
        .limit(limit),
    ]);

    for (const result of [bookings, sessions, feedback]) {
      if (result.error) supabaseError(result.error, "Aktivitas admin tidak dapat dibaca.");
    }

    const items = [
      ...(bookings.data ?? []).map((x) => ({
        id: x.id,
        entity_type: "booking",
        status: x.status,
        created_at: x.created_at,
        updated_at: x.updated_at,
        entity_id: x.id,
      })),
      ...(sessions.data ?? []).map((x) => ({
        id: x.id,
        entity_type: "session",
        status: x.status,
        created_at: x.created_at,
        updated_at: x.updated_at,
        entity_id: x.id,
      })),
      ...(feedback.data ?? []).map((x) => ({
        id: x.id,
        entity_type: "feedback",
        status: x.moderation_status,
        review_status: x.review_status,
        created_at: x.created_at,
        updated_at: x.updated_at,
        entity_id: x.id,
      })),
    ]
      .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at))
      .slice(0, limit);

    return items;
  },
};

