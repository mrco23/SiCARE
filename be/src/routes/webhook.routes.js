import crypto from "node:crypto";
import { Router } from "express";
import { env } from "../config/env.js";
import { asyncHandler } from "../lib/http.js";
import { webhookController } from "../controllers/webhook.controller.js";

const router = Router();

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

router.post("/fonnte/message-status", asyncHandler(webhookController.handleFonnteStatus));

export default router;
