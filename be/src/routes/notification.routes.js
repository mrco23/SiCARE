import { Router } from "express";
import { z } from "zod";
import { getSupabaseAdminClient, isSupabaseConfigured } from "../config/supabase.js";
import { authenticate } from "../middleware/auth.js";
import { asyncHandler, HttpError, sendData, supabaseError } from "../lib/http.js";
import { writeAudit } from "../lib/audit.js";

const router = Router();
const uuid = z.string().uuid();
const notificationQuerySchema = z.object({
  unread_only: z.enum(["true", "false"]).default("false"),
  limit: z.coerce.number().int().min(1).max(100).default(30),
}).strict();

function supa() {
  if (!isSupabaseConfigured()) throw new HttpError(503, "SUPABASE_NOT_CONFIGURED", "Supabase belum dikonfigurasi pada backend.");
  return getSupabaseAdminClient();
}


router.get("/", authenticate, asyncHandler(async (request, response) => {
  const filters = notificationQuerySchema.safeParse(request.query);
  if (!filters.success) throw new HttpError(400, "VALIDATION_ERROR", "Filter notifikasi tidak valid.", filters.error.issues);
  const client = supa();
  let query = client.from("notifications")
    .select("id,type,title,body,entity_type,entity_id,created_at,read_at")
    .eq("recipient_user_id", request.auth.user.id)
    .order("created_at", { ascending: false }).limit(filters.data.limit);
  if (filters.data.unread_only === "true") query = query.is("read_at", null);
  const { data, error } = await query;
  if (error) supabaseError(error, "Notifikasi tidak dapat dibaca.");

  const { count, error: countError } = await client.from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_user_id", request.auth.user.id)
    .is("read_at", null);
  if (countError) supabaseError(countError, "Jumlah notifikasi belum dibaca tidak dapat dihitung.");
  return sendData(response, { items: data ?? [], unread_count: count ?? 0 });
}));

router.patch("/read-all", authenticate, asyncHandler(async (request, response) => {
  const { data, error } = await supa().from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_user_id", request.auth.user.id)
    .is("read_at", null)
    .select("id");
  if (error) supabaseError(error, "Notifikasi tidak dapat ditandai sudah dibaca.");
  const count = data?.length ?? 0;
  await writeAudit({ actorUserId: request.auth.user.id, action: "notification.read", entityType: "notification", metadata: { count } });
  return sendData(response, { marked_read: count });
}));

router.patch("/:id/read", authenticate, asyncHandler(async (request, response) => {
  if (!uuid.safeParse(request.params.id).success) throw new HttpError(400, "INVALID_ID", "ID notifikasi tidak valid.");
  const { data, error } = await supa().from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", request.params.id)
    .eq("recipient_user_id", request.auth.user.id)
    .select("id,type,title,body,entity_type,entity_id,created_at,read_at")
    .maybeSingle();
  if (error) supabaseError(error, "Notifikasi tidak dapat ditandai sudah dibaca.");
  if (!data) throw new HttpError(404, "NOTIFICATION_NOT_FOUND", "Notifikasi tidak ditemukan.");
  await writeAudit({ actorUserId: request.auth.user.id, action: "notification.read", entityType: "notification", entityId: data.id, metadata: { status: "read" } });
  return sendData(response, data);
}));

export default router;
