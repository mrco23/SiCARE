// @ts-check
import { getSupabaseAdminClient, isSupabaseConfigured } from "../config/supabase.js";
import { HttpError, supabaseError } from "../lib/http.js";
import { callDomainRpc } from "../lib/domainRpc.js";
import { writeAudit } from "../lib/audit.js";
import { feedbackRepository } from "../repositories/feedback.repository.js";

function getClient() {
  if (!isSupabaseConfigured()) {
    throw new HttpError(503, "SUPABASE_NOT_CONFIGURED", "Supabase belum dikonfigurasi pada backend.");
  }
  return getSupabaseAdminClient();
}

export const feedbackService = {
  async submitFeedback({ authUser, sessionId, input }) {
    const client = getClient();
    const feedbackId = await callDomainRpc(
      client,
      "sicare_submit_feedback",
      {
        p_client_id: authUser.id,
        p_session_id: sessionId,
        p_rating: input.rating,
        p_comment: input.comment ?? null,
      },
      "Feedback tidak dapat dikirim.",
    );

    await writeAudit({
      actorUserId: authUser.id,
      action: "feedback.submit",
      entityType: "feedback",
      entityId: feedbackId,
      metadata: { status: "pending", role: "client" },
    });

    const { data, error } = await client
      .from("feedback")
      .select("id,session_id,client_id,counselor_id,rating,comment,moderation_status,review_status,created_at,updated_at")
      .eq("id", feedbackId)
      .single();

    if (error) supabaseError(error, "Feedback tersimpan tetapi tidak dapat dibaca.");
    return data;
  },

  async getCounselorFeedback({ counselorId, rating, limit }) {
    const client = getClient();
    return feedbackRepository.listCounselor(client, { counselorId, rating, limit });
  },

  async getMyFeedback(clientId) {
    const client = getClient();
    return feedbackRepository.listClient(client, clientId);
  },

  async listAdminFeedback(filters) {
    const client = getClient();
    return feedbackRepository.listAdmin(client, {
      moderationStatus: filters.moderation_status,
      reviewStatus: filters.review_status,
      limit: filters.limit,
    });
  },

  async getAdminFeedbackDetail(feedbackId) {
    const client = getClient();
    const item = await feedbackRepository.findById(client, feedbackId);
    if (!item) throw new HttpError(404, "FEEDBACK_NOT_FOUND", "Feedback tidak ditemukan.");
    return item;
  },

  async getFeedbackStatistics() {
    const client = getClient();
    const [total, pending, shown, disabled, rNew, reviewed, resolved, ratingsResult] = await Promise.all([
      client.from("feedback").select("id", { count: "exact", head: true }),
      client.from("feedback").select("id", { count: "exact", head: true }).eq("moderation_status", "pending"),
      client.from("feedback").select("id", { count: "exact", head: true }).eq("moderation_status", "shown"),
      client.from("feedback").select("id", { count: "exact", head: true }).eq("moderation_status", "disabled"),
      client.from("feedback").select("id", { count: "exact", head: true }).eq("review_status", "new"),
      client.from("feedback").select("id", { count: "exact", head: true }).eq("review_status", "reviewed"),
      client.from("feedback").select("id", { count: "exact", head: true }).eq("review_status", "resolved"),
      client.from("feedback").select("rating").limit(10000),
    ]);

    for (const r of [total, pending, shown, disabled, rNew, reviewed, resolved, ratingsResult]) {
      if (r.error) supabaseError(r.error, "Statistik feedback tidak dapat dihitung.");
    }

    const rows = ratingsResult.data ?? [];
    const averageRating = rows.length ? Number((rows.reduce((sum, item) => sum + item.rating, 0) / rows.length).toFixed(2)) : 0;
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const item of rows) {
      if (distribution[item.rating] !== undefined) distribution[item.rating] += 1;
    }

    return {
      total: total.count ?? 0,
      moderation: {
        pending: pending.count ?? 0,
        shown: shown.count ?? 0,
        disabled: disabled.count ?? 0,
      },
      review: {
        new: rNew.count ?? 0,
        reviewed: reviewed.count ?? 0,
        resolved: resolved.count ?? 0,
      },
      average_rating: averageRating,
      rating_distribution: distribution,
    };
  },

  async moderateFeedback({ feedbackId, input, actorId }) {
    const client = getClient();
    const patch = {
      moderation_status: input.moderation_status,
      disabled_reason: input.moderation_status === "disabled" ? input.disabled_reason : null,
    };

    const { data, error } = await client
      .from("feedback")
      .update(patch)
      .eq("id", feedbackId)
      .select("id,session_id,client_id,counselor_id,rating,comment,moderation_status,disabled_reason,review_status,created_at,updated_at")
      .maybeSingle();

    if (error) supabaseError(error, "Status moderasi feedback tidak dapat diperbarui.");
    if (!data) throw new HttpError(404, "FEEDBACK_NOT_FOUND", "Feedback tidak ditemukan.");

    await writeAudit({
      actorUserId: actorId,
      action: "feedback.moderate",
      entityType: "feedback",
      entityId: feedbackId,
      metadata: { moderation_status: input.moderation_status },
    });

    return data;
  },

  async reviewFeedback({ feedbackId, input, actorId }) {
    const client = getClient();
    const { data, error } = await client
      .from("feedback")
      .update({ review_status: input.review_status })
      .eq("id", feedbackId)
      .select("id,session_id,client_id,counselor_id,rating,comment,moderation_status,disabled_reason,review_status,created_at,updated_at")
      .maybeSingle();

    if (error) supabaseError(error, "Status telaah feedback tidak dapat diperbarui.");
    if (!data) throw new HttpError(404, "FEEDBACK_NOT_FOUND", "Feedback tidak ditemukan.");

    await writeAudit({
      actorUserId: actorId,
      action: "feedback.review",
      entityType: "feedback",
      entityId: feedbackId,
      metadata: { review_status: input.review_status },
    });

    return data;
  },
};

