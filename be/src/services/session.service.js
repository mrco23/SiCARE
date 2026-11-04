import { getSupabaseAdminClient, isSupabaseConfigured } from "../config/supabase.js";
import { HttpError } from "../lib/http.js";
import { callDomainRpc } from "../lib/domainRpc.js";
import { writeAudit } from "../lib/audit.js";
import { sessionRepository } from "../repositories/session.repository.js";

function getClient() {
  if (!isSupabaseConfigured()) {
    throw new HttpError(503, "SUPABASE_NOT_CONFIGURED", "Supabase belum dikonfigurasi pada backend.");
  }
  return getSupabaseAdminClient();
}

export const sessionService = {
  async listSessions({ authUser, authRole, status, limit }) {
    const client = getClient();
    return sessionRepository.list(client, {
      userId: authUser.id,
      role: authRole,
      status,
      limit,
    });
  },

  async getSessionDetail({ authProfile, sessionId }) {
    const client = getClient();
    return sessionRepository.findForParty(client, sessionId, authProfile);
  },

  async transitionSession({ authUser, authProfile, sessionId, targetStatus }) {
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
      metadata: { status: targetStatus, role: "counselor" },
    });

    return sessionRepository.findForParty(client, sessionId, authProfile);
  },
};

