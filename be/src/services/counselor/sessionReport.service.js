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

/** Hanya konselor yang menangani sesi, dan hanya sesi yang sudah selesai. */
async function loadOwnCompletedSession(counselorId, sessionId) {
  const { data, error } = await supa()
    .from("counseling_sessions")
    .select("id,booking_id,counselor_id,starts_at,ends_at,status,format,room,completed_at")
    .eq("id", sessionId)
    .maybeSingle();

  if (error) supabaseError(error, "Sesi konseling tidak dapat dibaca.");
  if (!data || data.counselor_id !== counselorId) {
    throw new HttpError(404, "SESSION_NOT_FOUND", "Sesi konseling tidak ditemukan.");
  }
  if (data.status !== "completed") {
    throw new HttpError(409, "SESSION_NOT_COMPLETED", "Sesi konseling belum selesai.");
  }
  return data;
}

export const counselorSessionReportService = {
  async saveNotes(counselorId, sessionId, input) {
    await loadOwnCompletedSession(counselorId, sessionId);

    const { data, error } = await supa()
      .from("session_notes")
      .upsert(
        {
          session_id: sessionId,
          counselor_id: counselorId,
          counselor_note: input.counselor_note,
          client_note: input.client_note,
          follow_up: input.follow_up,
        },
        { onConflict: "session_id" },
      )
      .select("session_id,counselor_note,client_note,follow_up")
      .single();

    if (error) supabaseError(error, "Catatan sesi tidak dapat disimpan.");

    await writeAudit({
      actorUserId: counselorId,
      action: "counselor.session_notes.update",
      entityType: "session",
      entityId: sessionId,
      metadata: { role: "counselor" },
    });

    return data;
  },

  /** Data laporan satu sesi. `counselor_note` sengaja tidak pernah dipilih. */
  async getReport(counselorId, sessionId, participantId) {
    const session = await loadOwnCompletedSession(counselorId, sessionId);
    const client = supa();

    const { data: booking, error: bookingError } = await client
      .from("bookings")
      .select("id,service_type,booking_participants(id,display_name,is_primary,is_representative)")
      .eq("id", session.booking_id)
      .maybeSingle();

    if (bookingError) supabaseError(bookingError, "Data booking tidak dapat dibaca.");
    if (!booking) throw new HttpError(404, "BOOKING_NOT_FOUND", "Booking tidak ditemukan.");

    const participants = booking.booking_participants ?? [];
    const participant = participantId
      ? participants.find((p) => p.id === participantId)
      : (participants.find((p) => p.is_primary || p.is_representative) ?? participants[0]);
    if (!participant && participantId) {
      throw new HttpError(404, "PARTICIPANT_NOT_FOUND", "Peserta tidak ditemukan pada sesi ini.");
    }
    // Booking lama baru memiliki baris peserta setelah alur consent dibuka.
    if (!participant) {
      throw new HttpError(
        409,
        "CONSENT_NOT_SIGNED",
        "Informed consent peserta ini belum ditandatangani, sehingga laporan belum dapat dicetak.",
      );
    }

    const { data: consent, error: consentError } = await client
      .from("informed_consents")
      .select("id,status,identity_snapshot,signed_at")
      .eq("booking_id", booking.id)
      .eq("booking_participant_id", participant.id)
      .eq("status", "signed")
      .order("signed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (consentError) supabaseError(consentError, "Informed consent tidak dapat dibaca.");
    if (!consent) {
      throw new HttpError(
        409,
        "CONSENT_NOT_SIGNED",
        "Informed consent peserta ini belum ditandatangani, sehingga laporan belum dapat dicetak.",
      );
    }

    const { data: notes, error: notesError } = await client
      .from("session_notes")
      .select("client_note,follow_up")
      .eq("session_id", sessionId)
      .maybeSingle();

    if (notesError) supabaseError(notesError, "Catatan sesi tidak dapat dibaca.");

    const { data: counselor, error: counselorError } = await client
      .from("profiles")
      .select("full_name,sipp_silp_number,sipp_silp_valid_until")
      .eq("id", counselorId)
      .maybeSingle();

    if (counselorError) supabaseError(counselorError, "Data konselor tidak dapat dibaca.");

    const identity = /** @type {Record<string, any>} */ (consent.identity_snapshot ?? {});
    return {
      session: {
        id: session.id,
        starts_at: session.starts_at,
        ends_at: session.ends_at,
        completed_at: session.completed_at,
        format: session.format,
        room: session.room,
        service_type: booking.service_type,
      },
      participants: participants.map((p) => ({ id: p.id, display_name: p.display_name })),
      participant_id: participant.id,
      client: {
        full_name: identity.full_name ?? participant.display_name,
        faculty: identity.faculty ?? null,
        study_program: identity.study_program ?? null,
        nim: identity.nim ?? null,
        birthplace: identity.birthplace ?? null,
        date_of_birth: identity.date_of_birth ?? null,
        gender: identity.gender ?? null,
        religion: identity.religion ?? null,
        education: identity.education ?? null,
        address: identity.address ?? null,
        phone_e164: identity.phone_e164 ?? null,
      },
      notes: {
        client_note: notes?.client_note ?? null,
        follow_up: notes?.follow_up ?? null,
      },
      counselor: {
        full_name: counselor?.full_name ?? null,
        sipp_silp_number: counselor?.sipp_silp_number ?? null,
        sipp_silp_valid_until: counselor?.sipp_silp_valid_until ?? null,
      },
    };
  },
};
