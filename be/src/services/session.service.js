import { getSupabaseAdminClient, isSupabaseConfigured } from "../config/supabase.js";
import { HttpError } from "../lib/http.js";
import { callDomainRpc } from "../lib/domainRpc.js";
import { writeAudit } from "../lib/audit.js";
import { sessionRepository } from "../repositories/session.repository.js";
import { applyBookingClosureSideEffects } from "./bookingClosure.service.js";

function getClient() {
  if (!isSupabaseConfigured()) {
    throw new HttpError(503, "SUPABASE_NOT_CONFIGURED", "Supabase belum dikonfigurasi pada backend.");
  }
  return getSupabaseAdminClient();
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

  async transitionSession({ authUser, authProfile, sessionId, targetStatus, reason = null }) {
    const client = getClient();
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
      // Alasan tidak disalin ke audit (bisa memuat informasi sensitif).
      metadata: { status: targetStatus, role: "counselor" },
    });

    const session = await sessionRepository.findForParty(client, sessionId, authProfile);

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

