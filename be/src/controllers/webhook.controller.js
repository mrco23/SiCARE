import { getSupabaseAdminClient, isSupabaseConfigured } from "../config/supabase.js";
import { HttpError, parseBody, sendData, supabaseError } from "../lib/http.js";
import { z } from "zod";
import { verifyWebhookSecret } from "../routes/webhook.routes.js";

const fonnteWebhookSchema = z.object({
  id: z.coerce.string().trim().min(1),
  device: z.string().trim().optional(),
  stateid: z.string().trim().optional(),
  status: z.string().trim().optional(),
  state: z.string().trim().optional(),
  message: z.string().trim().optional(),
}).passthrough();

function supa() {
  if (!isSupabaseConfigured()) {
    throw new HttpError(503, "SUPABASE_NOT_CONFIGURED", "Supabase belum dikonfigurasi.");
  }
  return getSupabaseAdminClient();
}

export const webhookController = {
  async handleFonnteStatus(req, res) {
    if (!verifyWebhookSecret(req)) {
      throw new HttpError(401, "UNAUTHORIZED_WEBHOOK", "Webhook secret tidak valid.");
    }

    const input = parseBody(fonnteWebhookSchema, req.body);
    const client = supa();

    const { data: outboxRow, error: findError } = await client
      .from("whatsapp_outbox")
      .select("id,status,provider_message_id,attempt_count")
      .eq("provider_message_id", input.id)
      .maybeSingle();

    if (findError) {
      supabaseError(findError, "Gagal memeriksa status outbox.");
    }

    if (!outboxRow) {
      return sendData(res, {
        status: "ignored",
        id: input.id,
        reason: "Message ID not tracked in outbox",
      }, 200);
    }

    const rawStatus = (input.status || input.state || "").toLowerCase().trim();
    const nowIso = new Date().toISOString();

    const patch = {
      provider_status: input.status || null,
      provider_state: input.state || null,
      provider_state_id: input.stateid || null,
      updated_at: nowIso,
    };

    if (outboxRow.status === "delivered") {
      // Delivered is terminal: ignore out-of-order regression
    } else if (outboxRow.status === "cancelled") {
      // Cancelled is terminal: ignore external delivery callbacks
    } else if (["delivered", "read"].includes(rawStatus)) {
      if (outboxRow.status !== "failed") {
        patch.status = "delivered";
        patch.delivered_at = nowIso;
      }
    } else if (["failed", "rejected", "error", "undelivered"].includes(rawStatus)) {
      patch.status = "failed";
      patch.last_error_code = "PROVIDER_DELIVERY_FAILED";
      patch.last_error_message = input.message || `Provider callback status: ${rawStatus}`;
      patch.error_category = "permanent";
    }

    const { error: updateError } = await client
      .from("whatsapp_outbox")
      .update(patch)
      .eq("id", outboxRow.id);

    if (updateError) {
      supabaseError(updateError, "Gagal memperbarui status pengiriman pesan.");
    }

    return sendData(res, {
      status: "ok",
      id: input.id,
      outbox_id: outboxRow.id,
      current_status: patch.status || outboxRow.status,
    }, 200);
  },
};

