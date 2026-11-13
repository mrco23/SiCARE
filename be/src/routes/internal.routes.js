import { Router } from "express";
import { env } from "../config/env.js";
import { isSupabaseConfigured } from "../config/supabase.js";
import { asyncHandler, HttpError, sendData } from "../lib/http.js";
import { fonnteService } from "../services/fonnte.service.js";
import { runSchedulerPass } from "../workers/whatsapp.scheduler.js";
import { runWorkerPass } from "../workers/whatsapp.worker.js";
import { timingSafeEqualString } from "./webhook.routes.js";

// WHATSAPP_WORKER_CONCURRENCY (default 1) suits a daemon polling every 5 seconds.
// A cron run is far less frequent, so each run has to clear more of the queue.
const CRON_WORKER_BATCH_SIZE = 10;

const router = Router();

/**
 * Fails closed: without a configured secret, no request is authorized.
 * @param {string|undefined} authorizationHeader
 * @param {string|undefined} secret
 * @returns {boolean}
 */
export function isCronAuthorized(authorizationHeader, secret) {
  if (!secret) return false;
  return timingSafeEqualString(authorizationHeader, `Bearer ${secret}`);
}

function requireCronAccess(request, _response, next) {
  if (!isCronAuthorized(request.headers.authorization, env.CRON_SECRET)) {
    throw new HttpError(401, "UNAUTHORIZED_CRON", "Kredensial cron tidak valid.");
  }
  if (!isSupabaseConfigured()) {
    throw new HttpError(503, "SUPABASE_NOT_CONFIGURED", "Supabase belum dikonfigurasi.");
  }
  next();
}

router.post("/whatsapp/worker-run", requireCronAccess, asyncHandler(async (_request, response) => {
  const result = await runWorkerPass({ batchSize: CRON_WORKER_BATCH_SIZE });
  return sendData(response, result);
}));

router.post("/whatsapp/scheduler-run", requireCronAccess, asyncHandler(async (_request, response) => {
  const result = await runSchedulerPass();
  return sendData(response, result);
}));

// TEMPORARY, NO AUTH: one-off production smoke test for the Fonnte integration, requested
// 2026-11-13 to confirm real WhatsApp sending works end-to-end. Hits a hardcoded personal
// number with a fixed message. Remove this route (and this comment) once the test is done —
// anyone who finds this URL can trigger it repeatedly and burn Fonnte send quota.
router.get("/whatsapp/smoke-test", asyncHandler(async (_request, response) => {
  const result = await fonnteService.sendMessage({
    target: "085725679962",
    message: "Hore! Fitur WhatsApp berhasil pada tahap production.",
  });
  return sendData(response, {
    success: result.success,
    simulated: result.simulated ?? false,
    errorCode: result.errorCode ?? null,
    errorMessage: result.errorMessage ?? null,
  });
}));

export default router;
