import { getSupabaseAdminClient, isSupabaseConfigured } from "../config/supabase.js";
import { HttpError } from "../lib/http.js";
import { callDomainRpc } from "../lib/domainRpc.js";
import { writeAudit } from "../lib/audit.js";
import { sessionRepository } from "../repositories/session.repository.js";
import { applyBookingClosureSideEffects } from "./bookingClosure.service.js";
import { enqueueOutboxMessage } from "./whatsappOutbox.service.js";

function getClient() {
  if (!isSupabaseConfigured()) {
    throw new HttpError(503, "SUPABASE_NOT_CONFIGURED", "Supabase belum dikonfigurasi pada server.");
  }
  return getSupabaseAdminClient();
}

/**
 * WhatsApp ke klien setelah sesi selesai: ajakan mengisi feedback. Gagal antre tidak
 * membatalkan penyelesaian sesi (hanya dicatat); notifikasi in-app tetap dibuat RPC.
 */
export async function enqueueFeedbackRequest(client, session) {
  try {
    const clientId = session.booking.client_id;
    const [{ data: clientProfile }, { data: counselorProfile }] = await Promise.all([
      client.from("profiles").select("full_name,phone_e164").eq("id", clientId).maybeSingle(),
      client.from("counselor_profiles").select("public_name").eq("profile_id", session.counselor_id).maybeSingle(),
    ]);
    const result = await enqueueOutboxMessage({
      supabaseClient: client,
      bookingId: session.booking.id,
      recipientUserId: clientId,
      messageType: "feedback_request",
      phoneE164: clientProfile?.phone_e164 ?? null,
      qualifier: session.id,
      payload: {
        booking_id: session.booking.id,
        starts_at: session.starts_at,
        ends_at: session.ends_at,
        recipient_name: clientProfile?.full_name || "Klien",
        counselor_name: counselorProfile?.public_name || "Konselor",
      },
    });
    if (!result.success) console.warn("[Session] WhatsApp ajakan feedback gagal diantrekan:", result.error?.code ?? "unknown");
  } catch (error) {
    console.warn("[Session] WhatsApp ajakan feedback gagal diantrekan:", error?.code ?? "unknown");
  }
}

export const sessionService = {
  async listSessions({ authUser, authRole, status, limit, offset }) {
    const client = getClient();
    // Penanda otomatis dijalankan cron worker tiap menit (internal/worker-run), tidak lagi
    // menahan respons daftar: tiap panggilan RPC menambah waktu tunggu halaman.
    return sessionRepository.list(client, {
      userId: authUser.id,
      role: authRole,
      status,
      limit,
      offset,
    });
  },

  async getSessionDetail({ authProfile, sessionId }) {
    const client = getClient();
    return sessionRepository.findForParty(client, sessionId, authProfile);
  },

  async transitionSession({ authUser, authProfile, sessionId, targetStatus, reason = null, notes = null }) {
    const client = getClient();

    if (targetStatus === "completed") {
      if (!notes?.counselor_note || !notes?.client_note) {
        throw new HttpError(400, "SESSION_NOTES_REQUIRED", "Catatan konselor dan catatan untuk klien wajib diisi sebelum menyelesaikan sesi.");
      }
      // Simpan catatan dulu (hanya untuk sesi berlangsung milik konselor ini). Bila RPC
      // penyelesaian gagal, catatan tetap tersimpan dan ditimpa saat konselor mencoba lagi.
      const { data: own, error: ownError } = await client
        .from("counseling_sessions")
        .select("id,counselor_id,status")
        .eq("id", sessionId)
        .maybeSingle();
      if (ownError) throw new HttpError(500, "SESSION_READ_FAILED", "Sesi tidak dapat dibaca.");
      if (!own || own.counselor_id !== authUser.id) {
        throw new HttpError(404, "SESSION_NOT_FOUND", "Sesi tidak ditemukan.");
      }
      if (own.status !== "ongoing") {
        throw new HttpError(409, "SESSION_TRANSITION_NOT_ALLOWED", "Hanya sesi yang sedang berlangsung yang dapat diselesaikan.");
      }
      const { error: notesError } = await client.from("session_notes").upsert(
        {
          session_id: sessionId,
          counselor_id: authUser.id,
          counselor_note: notes.counselor_note,
          client_note: notes.client_note,
          follow_up: notes.follow_up ?? null,
        },
        { onConflict: "session_id" },
      );
      if (notesError) {
        throw new HttpError(500, "SESSION_NOTES_SAVE_FAILED", "Catatan sesi tidak dapat disimpan. Sesi belum diselesaikan; coba lagi.");
      }
    }

    await callDomainRpc(
      client,
      "sicare_transition_session",
      {
        p_actor_id: authUser.id,
        p_session_id: sessionId,
        p_target_status: targetStatus,
      },
      "Status sesi tidak dapat diperbarui.",
    );

    await writeAudit({
      actorUserId: authUser.id,
      action: "session.status",
      entityType: "session",
      entityId: sessionId,
      // Alasan dan isi catatan tidak disalin ke audit (bisa memuat informasi sensitif).
      metadata: { status: targetStatus, role: "counselor" },
    });

    const session = await sessionRepository.findForParty(client, sessionId, authProfile);

    if (targetStatus === "completed" && session?.booking?.client_id) {
      await enqueueFeedbackRequest(client, session);
    }

    if (targetStatus === "cancelled" && session?.booking) {
      // The RPC already cancelled the session and booking. Store the counselor's reason and
      // tell the client; failures here are logged but do not undo the cancellation.
      if (reason) {
        const { error: reasonError } = await client
          .from("bookings")
          .update({ cancellation_reason: reason })
          .eq("id", session.booking.id);
        if (reasonError) console.warn("[Session] Alasan pembatalan gagal disimpan:", reasonError.code);
        else session.booking.cancellation_reason = reason;
      }
      const { errors } = await applyBookingClosureSideEffects({
        supabaseClient: client,
        booking: { ...session.booking, starts_at: session.starts_at, ends_at: session.ends_at },
        actorRole: "counselor",
        reason,
        actorUserId: authUser.id,
      });
      if (errors.length) console.warn("[Session] Efek lanjutan pembatalan sebagian gagal:", errors.join(","));
    }

    return session;
  },
};

