import { supabaseError } from "../lib/http.js";

export const feedbackRepository = {
  async findById(supabaseClient, feedbackId) {
    const { data, error } = await supabaseClient
      .from("feedback")
      .select("id,session_id,client_id,counselor_id,rating,comment,moderation_status,disabled_reason,review_status,created_at,updated_at")
      .eq("id", feedbackId)
      .maybeSingle();

    if (error) supabaseError(error, "Feedback tidak dapat dibaca.");
    return data;
  },

  async listCounselor(supabaseClient, { counselorId, rating, limit = 50 }) {
    let query = supabaseClient
      .from("feedback")
      .select("id,session_id,rating,comment,created_at,counselor_id")
      .eq("counselor_id", counselorId)
      .eq("moderation_status", "shown")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (rating) query = query.eq("rating", rating);
    const { data, error } = await query;
    if (error) supabaseError(error, "Feedback konselor tidak dapat dibaca.");
    return data ?? [];
  },

  async listClient(supabaseClient, clientId) {
    const { data, error } = await supabaseClient
      .from("feedback")
      .select("id,session_id,rating,comment,created_at")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });

    if (error) supabaseError(error, "Feedback klien tidak dapat dibaca.");
    return data ?? [];
  },

  async listAdmin(supabaseClient, { moderationStatus, reviewStatus, limit = 50 }) {
    let query = supabaseClient
      .from("feedback")
      .select("id,session_id,client_id,counselor_id,rating,comment,moderation_status,disabled_reason,review_status,created_at,updated_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (moderationStatus) query = query.eq("moderation_status", moderationStatus);
    if (reviewStatus) query = query.eq("review_status", reviewStatus);

    const { data, error } = await query;
    if (error) supabaseError(error, "Daftar feedback admin tidak dapat dibaca.");
    return data ?? [];
  },
};

