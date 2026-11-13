import { env } from "../config/env.js";
import { getSupabaseAdminClient, isSupabaseConfigured } from "../config/supabase.js";
import { fonnteService, normalizePhoneNumber } from "../services/fonnte.service.js";
import { decryptInvitationToken } from "../services/tokenEncryption.service.js";
import { calculateRetryDelayMs } from "../services/whatsappOutbox.service.js";
import { renderWhatsAppTemplate } from "../templates/whatsapp/index.js";

/**
 * Claims eligible WhatsApp outbox jobs atomically.
 * Uses sicare_claim_whatsapp_jobs RPC (FOR UPDATE SKIP LOCKED) with query fallback.
 *
 * @param {object} params
 * @param {object} [params.supabaseClient]
 * @param {string} params.workerId
 * @param {number} [params.batchSize=5]
 * @param {number} [params.leaseSeconds=60]
 * @returns {Promise<any[]>}
 */
export async function claimEligibleJobs({
  supabaseClient,
  workerId,
  batchSize = 5,
  leaseSeconds = 60,
}) {
  const supa = supabaseClient || getSupabaseAdminClient();
  const cappedBatch = Math.max(1, Math.min(batchSize, 50));

  // 1. Try atomic PostgreSQL RPC first
  try {
    const { data: rpcData, error: rpcError } = await supa.rpc("sicare_claim_whatsapp_jobs", {
      p_worker_id: workerId,
      p_batch_size: cappedBatch,
      p_lease_seconds: leaseSeconds,
    });

    if (!rpcError && Array.isArray(rpcData)) {
      return rpcData;
    }
  } catch {
    // Fall back to query-based claiming if RPC is not present or mocked in tests
  }

  // 2. Query fallback (e.g. for mock clients in unit tests)
  const now = new Date();
  const nowIso = now.toISOString();
  const leaseExpiryIso = new Date(now.getTime() + leaseSeconds * 1000).toISOString();

  // Find candidates
  const { data: candidates, error: selectError } = await supa
    .from("whatsapp_outbox")
    .select("*")
    .or(
      `status.in.(pending,queued),status.eq.retry_wait,and(status.in.(processing,sending),lease_expires_at.lt.${nowIso})`,
    )
    .limit(cappedBatch);

  if (selectError || !candidates || candidates.length === 0) {
    return [];
  }

  const claimed = [];
  for (const job of candidates) {
    // Double check eligibility
    const isDue = !job.scheduled_at || new Date(job.scheduled_at) <= now;
    const isRetryDue = job.status !== "retry_wait" || (!job.next_attempt_at || new Date(job.next_attempt_at) <= now);
    const isLeaseExpired = !job.lease_expires_at || new Date(job.lease_expires_at) < now;
    const isUnderMaxAttempts = (job.attempt_count ?? 0) < (job.max_attempts ?? 5);

    // Reap expired jobs that exhausted all attempts
    if (isLeaseExpired && !isUnderMaxAttempts && ["processing", "sending"].includes(job.status)) {
      await supa
        .from("whatsapp_outbox")
        .update({
          status: "failed",
          last_error_code: "LEASE_EXPIRED_MAX_ATTEMPTS",
          last_error_message: "Worker crashed or timed out on final attempt without releasing lease",
          error_category: "permanent",
          locked_by: null,
          lease_expires_at: null,
          updated_at: nowIso,
        })
        .eq("id", job.id);
      continue;
    }

    if (isDue && isRetryDue && isLeaseExpired && isUnderMaxAttempts) {
      const { data: updated, error: updateError } = await supa
        .from("whatsapp_outbox")
        .update({
          status: "processing",
          locked_by: workerId,
          locked_at: nowIso,
          lease_expires_at: leaseExpiryIso,
          last_attempt_at: nowIso,
          attempt_count: (job.attempt_count || 0) + 1,
          updated_at: nowIso,
        })
        .eq("id", job.id)
        .select("*")
        .maybeSingle();

      if (!updateError && updated) {
        claimed.push(updated);
      }
    }
  }

  return claimed;
}

/**
 * Processes a single claimed outbox job.
 * Enforces recipient opt-in, phone validation, template rendering, and delivery dispatch.
 *
 * @param {object} params
 * @param {object} [params.supabaseClient]
 * @param {object} params.job
 * @param {typeof fonnteService} [params.service]
 * @returns {Promise<{ success: boolean, status: string, error?: string }>}
 */
export async function processOutboxJob({
  supabaseClient,
  job,
  service = fonnteService,
}) {
  const supa = supabaseClient || getSupabaseAdminClient();
  const nowIso = new Date().toISOString();

  // Step 1: Resolve recipient identity, phone number, and authorization
  const isConsentInvitation = ["consent_invitation", "consent_reminder"].includes(job.message_type);
  let recipientName = "Peserta Konseling";
  let targetPhone = "";

  if (job.recipient_user_id) {
    const { data: profile, error: profileError } = await supa
      .from("profiles")
      .select("id,full_name,phone_e164,account_status")
      .eq("id", job.recipient_user_id)
      .maybeSingle();

    if (profileError || !profile) {
      await supa.from("whatsapp_outbox").update({
        status: "failed",
        last_error_code: "RECIPIENT_NOT_FOUND",
        last_error_message: "Profil penerima tidak ditemukan dalam database",
        error_category: "permanent",
        locked_by: null,
        lease_expires_at: null,
        updated_at: nowIso,
      }).eq("id", job.id);
      return { success: false, status: "failed", error: "RECIPIENT_NOT_FOUND" };
    }

    if (profile.account_status !== "active") {
      await supa.from("whatsapp_outbox").update({
        status: "failed",
        last_error_code: "RECIPIENT_INACTIVE",
        last_error_message: `Akun penerima tidak aktif (${profile.account_status})`,
        error_category: "permanent",
        locked_by: null,
        lease_expires_at: null,
        updated_at: nowIso,
      }).eq("id", job.id);
      return { success: false, status: "failed", error: "RECIPIENT_INACTIVE" };
    }

    // Notifikasi WhatsApp bersifat wajib untuk semua klien dan konselor (keputusan
    // pengguna, 2026-11-13) — tidak lagi digerbang oleh `profiles.whatsapp_opt_in`.
    // Kolom itu masih ada di database untuk riwayat/tampilan admin, tapi worker tidak
    // membacanya lagi untuk memutuskan boleh/tidaknya pengiriman.
    recipientName = profile.full_name;
    targetPhone = normalizePhoneNumber(profile.phone_e164 || job.phone_e164);
  } else {
    // Guest participant without a user profile
    const participantId = job.booking_participant_id || job.payload?.booking_participant_id;
    const { data: participant } = await supa
      .from("booking_participants")
      .select("id,full_name,display_name,phone_e164,participant_status")
      .eq("id", participantId)
      .maybeSingle();

    if (!participant || participant.participant_status === "removed") {
      await supa.from("whatsapp_outbox").update({
        status: "failed",
        last_error_code: "PARTICIPANT_NOT_FOUND_OR_REMOVED",
        last_error_message: "Peserta tidak ditemukan atau telah dihapus",
        error_category: "permanent",
        locked_by: null,
        lease_expires_at: null,
        updated_at: nowIso,
      }).eq("id", job.id);
      return { success: false, status: "failed", error: "PARTICIPANT_NOT_FOUND_OR_REMOVED" };
    }

    recipientName = participant.full_name || participant.display_name || "Peserta";
    targetPhone = normalizePhoneNumber(participant.phone_e164 || job.phone_e164);
  }

  if (!targetPhone) {
    await supa.from("whatsapp_outbox").update({
      status: "failed",
      last_error_code: "INVALID_PHONE_NUMBER",
      last_error_message: `Nomor telepon penerima tidak valid: '${job.phone_e164}'`,
      error_category: "validation",
      locked_by: null,
      lease_expires_at: null,
      updated_at: nowIso,
    }).eq("id", job.id);
    return { success: false, status: "failed", error: "INVALID_PHONE_NUMBER" };
  }

  // Step 2: Render message template
  let message = "";
  try {
    const vars = {
      ...(job.payload || {}),
      recipient_name: recipientName,
    };

    if (isConsentInvitation) {
      const invitationId = job.payload?.invitation_id;
      if (invitationId) {
        // Check invitation validity
        const { data: inv } = await supa
          .from("consent_invitations")
          .select("id,status,expires_at")
          .eq("id", invitationId)
          .maybeSingle();

        if (inv?.status === "revoked") {
          await supa.from("whatsapp_outbox").update({
            status: "cancelled",
            last_error_code: "INVITATION_REVOKED",
            last_error_message: "Undangan consent telah dicabut",
            error_category: "permanent",
            locked_by: null,
            lease_expires_at: null,
            updated_at: nowIso,
          }).eq("id", job.id);
          return { success: false, status: "cancelled", error: "INVITATION_REVOKED" };
        }

        if (inv?.status === "expired" || (inv?.expires_at && new Date(inv.expires_at) <= new Date())) {
          await supa.from("whatsapp_outbox").update({
            status: "cancelled",
            last_error_code: "INVITATION_EXPIRED",
            last_error_message: "Undangan consent telah kedaluwarsa",
            error_category: "permanent",
            locked_by: null,
            lease_expires_at: null,
            updated_at: nowIso,
          }).eq("id", job.id);
          return { success: false, status: "cancelled", error: "INVITATION_EXPIRED" };
        }

        // Final eligibility check: Consent must not already be signed
        const participantId = job.booking_participant_id || job.payload?.booking_participant_id;
        if (participantId) {
          const { data: consentRecord } = await supa
            .from("informed_consents")
            .select("id,status")
            .eq("booking_participant_id", participantId)
            .maybeSingle();

          if (consentRecord?.status === "signed") {
            await supa.from("whatsapp_outbox").update({
              status: "cancelled",
              last_error_code: "CONSENT_ALREADY_SIGNED",
              last_error_message: "Peserta telah menandatangani informed consent. Pengiriman dibatalkan.",
              error_category: "permanent",
              locked_by: null,
              lease_expires_at: null,
              updated_at: nowIso,
            }).eq("id", job.id);
            return { success: false, status: "cancelled", error: "CONSENT_ALREADY_SIGNED" };
          }
        }

        // Final eligibility check: Booking must not be cancelled or rejected
        const bookingId = job.booking_id || job.payload?.booking_id;
        if (bookingId) {
          const { data: bookingRecord } = await supa
            .from("bookings")
            .select("id,status")
            .eq("id", bookingId)
            .maybeSingle();

          if (["cancelled", "rejected"].includes(bookingRecord?.status)) {
            await supa.from("whatsapp_outbox").update({
              status: "cancelled",
              last_error_code: "BOOKING_CANCELLED",
              last_error_message: `Booking konseling berstatus ${bookingRecord.status}. Pengiriman dibatalkan.`,
              error_category: "permanent",
              locked_by: null,
              lease_expires_at: null,
              updated_at: nowIso,
            }).eq("id", job.id);
            return { success: false, status: "cancelled", error: "BOOKING_CANCELLED" };
          }
        }

        // Decrypt token in memory
        const { data: secret } = await supa
          .from("consent_invitation_secrets")
          .select("encrypted_token,iv,auth_tag,key_version")
          .eq("invitation_id", invitationId)
          .maybeSingle();

        if (secret?.encrypted_token && secret?.iv && secret?.auth_tag) {
          try {
            const rawToken = decryptInvitationToken({
              ciphertext: secret.encrypted_token,
              iv: secret.iv,
              tag: secret.auth_tag,
              keyVersion: secret.key_version,
            });
            const appBase = env.appBaseUrl || "http://localhost:5173";
            vars.invitation_link = `${appBase.replace(/\/$/, "")}/consent/invite?token=${rawToken}`;
          } catch (decryptErr) {
            console.error("Token decryption failed for invitation:", invitationId);
          }
        }
      }
    }

    message = renderWhatsAppTemplate(job.message_type, vars);
  } catch (renderError) {
    await supa.from("whatsapp_outbox").update({
      status: "failed",
      last_error_code: "TEMPLATE_RENDER_ERROR",
      last_error_message: renderError.message,
      error_category: "permanent",
      locked_by: null,
      lease_expires_at: null,
      updated_at: nowIso,
    }).eq("id", job.id);
    return { success: false, status: "failed", error: "TEMPLATE_RENDER_ERROR" };
  }

  // Step 3: Dispatch via Fonnte
  const sendResult = await service.sendMessage({
    target: targetPhone,
    message,
  });

  // Step 4: Handle Result
  // Dry-run: nothing left the server, so it must not be recorded as sent. Cancelling is terminal,
  // so old messages do not go out once live sending is enabled. The invitation stays pending and
  // its token stays usable, so a later reminder or resend can still carry a valid link.
  if (sendResult.simulated) {
    await supa.from("whatsapp_outbox").update({
      status: "cancelled",
      provider_status: "simulated",
      provider_state: "simulated",
      last_error_code: "DRY_RUN_NOT_SENT",
      last_error_message: "Mode simulasi aktif (WHATSAPP_SEND_ENABLED=false atau token kosong). Pesan tidak dikirim.",
      error_category: "permanent",
      locked_by: null,
      lease_expires_at: null,
      updated_at: nowIso,
    }).eq("id", job.id);
    return { success: false, status: "cancelled", error: "DRY_RUN_NOT_SENT" };
  }

  if (sendResult.success) {
    await supa.from("whatsapp_outbox").update({
      status: "accepted", // API accepted
      provider_message_id: sendResult.providerMessageId,
      provider_request_id: sendResult.providerRequestId,
      provider_status: "accepted",
      provider_state: sendResult.providerProcess || "processing",
      provider_response: sendResult.rawResponse || null,
      sent_at: nowIso,
      phone_e164: targetPhone,
      locked_by: null,
      lease_expires_at: null,
      updated_at: nowIso,
    }).eq("id", job.id);

    // If this was an invitation, update invitation status and clear plaintext-sensitive token ciphertext
    if (isConsentInvitation && job.payload?.invitation_id) {
      await supa
        .from("consent_invitations")
        .update({
          status: "sent",
          sent_at: nowIso,
          updated_at: nowIso,
        })
        .eq("id", job.payload.invitation_id)
        .in("status", ["pending"]);

      await supa
        .from("consent_invitation_secrets")
        .update({
          cleared_at: nowIso,
        })
        .eq("invitation_id", job.payload.invitation_id);
    }

    return { success: true, status: "accepted" };
  }

  // Ambiguous timeout (unknown state)
  if (sendResult.isTimeout || sendResult.errorCategory === "unknown") {
    await supa.from("whatsapp_outbox").update({
      status: "unknown",
      last_error_code: sendResult.errorCode || "FONNTE_TIMEOUT",
      last_error_message: sendResult.errorMessage || "Timeout saat menghubungi Fonnte",
      error_category: "unknown",
      locked_by: null,
      lease_expires_at: null,
      updated_at: nowIso,
    }).eq("id", job.id);
    return { success: false, status: "unknown", error: "FONNTE_TIMEOUT" };
  }

  const currentAttempts = job.attempt_count || 1;
  const maxAttempts = job.max_attempts || 5;

  // Temporary failure & attempts remain: schedule retry
  if (sendResult.errorCategory === "temporary" && currentAttempts < maxAttempts) {
    const delayMs = calculateRetryDelayMs(currentAttempts);
    const nextAttemptAt = new Date(Date.now() + delayMs).toISOString();

    await supa.from("whatsapp_outbox").update({
      status: "retry_wait",
      next_attempt_at: nextAttemptAt,
      last_error_code: sendResult.errorCode || "TEMPORARY_ERROR",
      last_error_message: sendResult.errorMessage || "Terjadi kesalahan sementara",
      error_category: "temporary",
      provider_response: sendResult.rawResponse || null,
      locked_by: null,
      lease_expires_at: null,
      updated_at: nowIso,
    }).eq("id", job.id);
    return { success: false, status: "retry_wait", error: sendResult.errorCode };
  }

  // Permanent failure or max attempts exhausted
  await supa.from("whatsapp_outbox").update({
    status: "failed",
    last_error_code: sendResult.errorCode || "SEND_FAILED",
    last_error_message: sendResult.errorMessage || "Pengiriman gagal",
    error_category: sendResult.errorCategory || "permanent",
    provider_response: sendResult.rawResponse || null,
    locked_by: null,
    lease_expires_at: null,
    updated_at: nowIso,
  }).eq("id", job.id);
  return { success: false, status: "failed", error: sendResult.errorCode };
}

/**
 * Jobs in a batch are claimed together but sent one at a time, so the lease must outlast the whole
 * batch. Otherwise an overlapping run could reclaim a job still waiting its turn and send it twice.
 * @param {number} batchSize
 * @returns {number}
 */
export function calculateLeaseSeconds(batchSize) {
  const secondsPerJob = env.FONNTE_TIMEOUT_MS / 1000 + 5; // provider timeout plus database calls
  return Math.max(60, Math.ceil(batchSize * secondsPerJob) + 30);
}

/**
 * Runs a single worker pass.
 * @param {object} [options]
 * @param {object} [options.supabaseClient]
 * @param {string} [options.workerId]
 * @param {number} [options.batchSize]
 * @returns {Promise<{ claimed: number, processed: number }>}
 */
export async function runWorkerPass(options = {}) {
  const workerId = options.workerId || `worker-${process.pid}-${Math.random().toString(36).slice(2, 6)}`;
  const batchSize = options.batchSize || env.WHATSAPP_WORKER_CONCURRENCY || 5;

  const jobs = await claimEligibleJobs({
    supabaseClient: options.supabaseClient,
    workerId,
    batchSize,
    leaseSeconds: calculateLeaseSeconds(batchSize),
  });

  let processed = 0;
  for (const job of jobs) {
    try {
      await processOutboxJob({
        supabaseClient: options.supabaseClient,
        job,
      });
      processed++;
    } catch (err) {
      console.error(`[WhatsApp Worker] Gagal memproses job ${job.id}:`, err);
    }
  }

  return { claimed: jobs.length, processed };
}

// Standalone execution support
if (process.argv[1] && process.argv[1].endsWith("whatsapp.worker.js")) {
  const isOnce = process.argv.includes("--once");
  console.log(`[WhatsApp Worker] Memulai worker (pid: ${process.pid}, once: ${isOnce})...`);

  async function loop() {
    try {
      const { claimed, processed } = await runWorkerPass();
      if (claimed > 0) {
        console.log(`[WhatsApp Worker] Memproses ${processed}/${claimed} pesan.`);
      }
    } catch (err) {
      console.error("[WhatsApp Worker] Error pada pass worker:", err);
    }

    if (!isOnce) {
      setTimeout(loop, env.WHATSAPP_POLL_INTERVAL_MS || 5000);
    }
  }

  loop();
}
