import crypto from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import { getSupabaseAdminClient, isSupabaseConfigured } from "../config/supabase.js";
import { asyncHandler, HttpError, parseBody, sendData, supabaseError } from "../lib/http.js";

const router = Router();

const fonnteWebhookSchema = z.object({
  id: z.coerce.string().trim().min(1),
  device: z.string().trim().optional(),
  stateid: z.string().trim().optional(),
  status: z.string().trim().optional(),
  state: z.string().trim().optional(),
  message: z.string().trim().optional(),
}).passthrough();

/**
 * Constant-time string comparison to prevent timing attacks on webhook secret verification.
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function timingSafeEqualString(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Verifies webhook secret if configured.
 * Checks header (x-fonnte-secret, x-webhook-secret, authorization) or query param ?secret=
 * @param {import("express").Request} request
 * @returns {boolean}
 */
export function verifyWebhookSecret(request) {
  const configuredSecret = env.FONNTE_WEBHOOK_SECRET;
  if (!configuredSecret) return true; // No secret configured

  const incomingSecret =
    request.headers["x-fonnte-secret"] ||
    request.headers["x-webhook-secret"] ||
    request.headers.authorization?.replace(/^Bearer\s+/i, "") ||
    request.query.secret;

  if (!incomingSecret || typeof incomingSecret !== "string") return false;
  return timingSafeEqualString(incomingSecret, configuredSecret);
}

function supa() {
  if (!isSupabaseConfigured()) {
    throw new HttpError(503, "SUPABASE_NOT_CONFIGURED", "Supabase belum dikonfigurasi.");
  }
  return getSupabaseAdminClient();
}

/**
 * POST /api/v1/webhooks/fonnte/message-status
 * Webhook endpoint for Fonnte delivery status callbacks.
 */
router.post("/fonnte/message-status", asyncHandler(async (request, response) => {
  // 1. Secret authentication
  if (!verifyWebhookSecret(request)) {
    throw new HttpError(401, "UNAUTHORIZED_WEBHOOK", "Webhook secret tidak valid.");
  }

  // 2. Validate payload structure
  const input = parseBody(fonnteWebhookSchema, request.body);

  // 3. Find matching outbox row by provider_message_id
  const client = supa();
  const { data: outboxRow, error: findError } = await client
    .from("whatsapp_outbox")
    .select("id,status,provider_message_id,attempt_count")
    .eq("provider_message_id", input.id)
    .maybeSingle();

  if (findError) {
    supabaseError(findError, "Gagal memeriksa status outbox.");
  }

  // If message ID is not in outbox, acknowledge HTTP 200 without error so provider doesn't spam retries
  if (!outboxRow) {
    return sendData(response, {
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

  // State Machine transitions based on provider delivery callback (monotonic & irreversible terminal states)
  if (outboxRow.status === "delivered") {
    // Delivered is terminal: ignore out-of-order regression to failed or intermediate states
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

  return sendData(response, {
    status: "ok",
    id: input.id,
    outbox_id: outboxRow.id,
    current_status: patch.status || outboxRow.status,
  }, 200);
}));

export default router;
