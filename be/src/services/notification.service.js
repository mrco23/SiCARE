import { getSupabaseAdminClient, isSupabaseConfigured } from "../config/supabase.js";
import { HttpError, supabaseError } from "../lib/http.js";
import { writeAudit } from "../lib/audit.js";

function getClient() {
  if (!isSupabaseConfigured()) {
    throw new HttpError(503, "SUPABASE_NOT_CONFIGURED", "Supabase belum dikonfigurasi pada backend.");
  }
  return getSupabaseAdminClient();
}

export const notificationService = {
  async listNotifications({ userId, unreadOnly, limit }) {
    const client = getClient();
    let query = client
      .from("notifications")
      .select("id,type,title,body,entity_type,entity_id,created_at,read_at")
      .eq("recipient_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (unreadOnly === "true") query = query.is("read_at", null);
    const { data, error } = await query;
    if (error) supabaseError(error, "Notifikasi tidak dapat dibaca.");

    const { count, error: countError } = await client
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_user_id", userId)
      .is("read_at", null);

    if (countError) supabaseError(countError, "Jumlah notifikasi belum dibaca tidak dapat dihitung.");
    return { items: data ?? [], unread_count: count ?? 0 };
  },

  async markAllRead(userId) {
    const client = getClient();
    const { data, error } = await client
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("recipient_user_id", userId)
      .is("read_at", null)
      .select("id");

    if (error) supabaseError(error, "Notifikasi tidak dapat ditandai sudah dibaca.");
    const count = data?.length ?? 0;
    await writeAudit({
      actorUserId: userId,
      action: "notification.read",
      entityType: "notification",
      metadata: { count },
    });
    return { marked_read: count };
  },

  async markOneRead({ notificationId, userId }) {
    const client = getClient();
    const { data, error } = await client
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", notificationId)
      .eq("recipient_user_id", userId)
      .select("id,type,title,body,entity_type,entity_id,created_at,read_at")
      .maybeSingle();

    if (error) supabaseError(error, "Notifikasi tidak dapat diperbarui.");
    if (!data) throw new HttpError(404, "NOTIFICATION_NOT_FOUND", "Notifikasi tidak ditemukan.");

    await writeAudit({
      actorUserId: userId,
      action: "notification.read",
      entityType: "notification",
      entityId: notificationId,
      metadata: { count: 1 },
    });
    return data;
  },
};

