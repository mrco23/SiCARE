import { env } from "../config/env.js";

/**
 * Normalizes phone numbers to standard E.164 / Indonesian dial format.
 * Transforms 08xx -> 628xx, +628xx -> 628xx, strips non-digits.
 * @param {string|null|undefined} raw
 * @returns {string|null}
 */
export function normalizePhoneNumber(raw) {
  if (!raw || typeof raw !== "string") return null;
  const digits = raw.trim().replace(/[^0-9]/g, "");
  if (digits.length < 7 || digits.length > 16) return null;

  if (digits.startsWith("0")) {
    return `62${digits.slice(1)}`;
  }
  if (digits.startsWith("62")) {
    return digits;
  }
  if (digits.startsWith("8")) {
    return `62${digits}`;
  }
  return digits;
}

/**
 * Checks if target phone number is allowed in test mode.
 * @param {string} normalizedPhone
 * @returns {boolean}
 */
export function isTestRecipientAllowed(normalizedPhone) {
  if (!env.WHATSAPP_TEST_MODE) return true;
  if (!env.whatsappTestRecipients || env.whatsappTestRecipients.length === 0) {
    return false;
  }
  const target = normalizePhoneNumber(normalizedPhone);
  if (!target) return false;
  return env.whatsappTestRecipients.some((allowed) => {
    const normAllowed = normalizePhoneNumber(allowed);
    return normAllowed === target;
  });
}

/**
 * Validates Fonnte API response structure.
 * @param {unknown} body
 * @returns {{ valid: boolean, status: boolean, id: string|null, reason: string|null, requestId: string|null, process: string|null }}
 */
export function validateResponse(body) {
  if (!body || typeof body !== "object") {
    return {
      valid: false,
      status: false,
      id: null,
      reason: "Invalid response format (not an object)",
      requestId: null,
      process: null,
    };
  }

  const status = Boolean(body.status);
  let id = null;
  if (Array.isArray(body.id) && body.id.length > 0) {
    id = String(body.id[0]);
  } else if (body.id != null) {
    id = String(body.id);
  }

  const reason = body.reason ? String(body.reason) : null;
  const requestId = body.requestid ? String(body.requestid) : null;
  const process = body.process ? String(body.process) : null;

  return {
    valid: true,
    status,
    id,
    reason,
    requestId,
    process,
  };
}

/**
 * Maps error to standardized category and code.
 * @param {Error|null} error
 * @param {unknown} responseBody
 * @param {number|null} httpStatus
 * @returns {{ errorCategory: 'temporary'|'permanent'|'unknown', errorCode: string, errorMessage: string }}
 */
export function normalizeProviderError(error, responseBody = null, httpStatus = null) {
  if (error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      return {
        errorCategory: "unknown",
        errorCode: "FONNTE_TIMEOUT",
        errorMessage: "Request to Fonnte timed out after configured deadline",
      };
    }
    if (error.code === "ECONNRESET" || error.code === "ETIMEDOUT" || error.code === "ENOTFOUND") {
      return {
        errorCategory: "temporary",
        errorCode: "FONNTE_NETWORK_ERROR",
        errorMessage: `Network error connecting to Fonnte: ${error.message}`,
      };
    }
  }

  if (httpStatus) {
    if (httpStatus === 429) {
      return {
        errorCategory: "temporary",
        errorCode: "FONNTE_RATE_LIMIT",
        errorMessage: "Fonnte rate limit exceeded (HTTP 429)",
      };
    }
    if (httpStatus >= 500) {
      return {
        errorCategory: "temporary",
        errorCode: "FONNTE_SERVER_ERROR",
        errorMessage: `Fonnte server error (HTTP ${httpStatus})`,
      };
    }
    if (httpStatus === 401 || httpStatus === 403) {
      return {
        errorCategory: "permanent",
        errorCode: "FONNTE_AUTH_ERROR",
        errorMessage: `Fonnte authentication failure (HTTP ${httpStatus})`,
      };
    }
  }

  if (responseBody && typeof responseBody === "object") {
    const reason = String(responseBody.reason || "").toLowerCase();
    if (reason.includes("token") || reason.includes("unauthorized") || reason.includes("permission")) {
      return {
        errorCategory: "permanent",
        errorCode: "FONNTE_AUTH_ERROR",
        errorMessage: responseBody.reason,
      };
    }
    if (reason.includes("disconnected") || reason.includes("busy") || reason.includes("reach")) {
      return {
        errorCategory: "temporary",
        errorCode: "FONNTE_DEVICE_DISCONNECTED",
        errorMessage: responseBody.reason,
      };
    }
    if (reason.includes("target") || reason.includes("not registered") || reason.includes("invalid number")) {
      return {
        errorCategory: "permanent",
        errorCode: "FONNTE_INVALID_TARGET",
        errorMessage: responseBody.reason,
      };
    }
    if (responseBody.reason) {
      return {
        errorCategory: "temporary",
        errorCode: "FONNTE_PROVIDER_ERROR",
        errorMessage: responseBody.reason,
      };
    }
  }

  return {
    errorCategory: "temporary",
    errorCode: "FONNTE_GENERIC_ERROR",
    errorMessage: error?.message || "Unknown error during Fonnte communication",
  };
}

export class FonnteService {
  /**
   * @param {object} [options]
   * @param {typeof fetch} [options.fetchFn]
   * @param {string} [options.token]
   * @param {string} [options.apiUrl]
   * @param {boolean} [options.sendEnabled]
   * @param {boolean} [options.testMode]
   * @param {number} [options.timeoutMs]
   */
  constructor(options = {}) {
    this.fetchFn = options.fetchFn || globalThis.fetch;
    this.token = options.token ?? env.FONNTE_TOKEN;
    this.apiUrl = options.apiUrl || env.FONNTE_API_URL;
    this.sendEnabled = options.sendEnabled ?? env.WHATSAPP_SEND_ENABLED;
    this.testMode = options.testMode ?? env.WHATSAPP_TEST_MODE;
    this.timeoutMs = options.timeoutMs ?? env.FONNTE_TIMEOUT_MS;
  }

  /**
   * Inspects configuration status. Never reveals token value.
   */
  checkConfiguration() {
    return {
      configured: Boolean(this.token && this.apiUrl),
      hasToken: Boolean(this.token),
      apiUrl: this.apiUrl,
      sendEnabled: Boolean(this.sendEnabled),
      testMode: Boolean(this.testMode),
      timeoutMs: this.timeoutMs,
      testRecipientsCount: env.whatsappTestRecipients.length,
    };
  }

  /**
   * Sends a message through Fonnte.
   * If WHATSAPP_SEND_ENABLED is false, simulates success safely without hitting the network.
   * If WHATSAPP_TEST_MODE is true, strictly restricts recipients to WHATSAPP_TEST_RECIPIENTS.
   *
   * @param {object} params
   * @param {string} params.target
   * @param {string} params.message
   * @param {string} [params.countryCode='0']
   * @param {boolean} [params.preview=false]
   * @returns {Promise<{
   *   success: boolean,
   *   simulated?: boolean,
   *   providerMessageId: string|null,
   *   providerRequestId: string|null,
   *   providerProcess?: string|null,
   *   errorCategory?: 'permanent'|'temporary'|'unknown'|'validation',
   *   errorCode?: string,
   *   errorMessage?: string,
   *   rawResponse?: unknown
   * }>}
   */
  async sendMessage({ target, message, countryCode = "0", preview = false }) {
    const normalizedTarget = normalizePhoneNumber(target);
    if (!normalizedTarget) {
      return {
        success: false,
        providerMessageId: null,
        providerRequestId: null,
        errorCategory: "permanent",
        errorCode: "INVALID_PHONE_NUMBER",
        errorMessage: `Format nomor telepon tidak valid: '${target}'`,
      };
    }

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return {
        success: false,
        providerMessageId: null,
        providerRequestId: null,
        errorCategory: "permanent",
        errorCode: "EMPTY_MESSAGE",
        errorMessage: "Pesan WhatsApp tidak boleh kosong",
      };
    }

    // Safety Gate 1: Check test mode recipient whitelist
    if (this.testMode && !isTestRecipientAllowed(normalizedTarget)) {
      return {
        success: false,
        providerMessageId: null,
        providerRequestId: null,
        errorCategory: "permanent",
        errorCode: "TEST_RECIPIENT_NOT_ALLOWED",
        errorMessage: `Nomor penerima '${normalizedTarget}' tidak terdaftar pada WHATSAPP_TEST_RECIPIENTS dalam test mode`,
      };
    }

    // Safety Gate 2: Simulated dry-run mode when sending is not enabled
    if (!this.sendEnabled || !this.token) {
      const simulatedId = `sim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const simulatedRequestId = `sim-req-${Date.now()}`;
      return {
        success: true,
        simulated: true,
        providerMessageId: simulatedId,
        providerRequestId: simulatedRequestId,
        providerProcess: "simulated",
        rawResponse: {
          status: true,
          target: [normalizedTarget],
          id: [simulatedId],
          process: "simulated",
          requestid: simulatedRequestId,
        },
      };
    }

    // Live call to Fonnte API
    const url = `${this.apiUrl.replace(/\/+$/, "")}/send`;
    const payload = {
      target: normalizedTarget,
      message,
      countryCode,
      preview: Boolean(preview),
    };

    let response;
    let responseText = "";
    try {
      response = await this.fetchFn(url, {
        method: "POST",
        headers: {
          Authorization: this.token, // Fonnte requires exact token string without Bearer
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      responseText = await response.text();
    } catch (networkError) {
      const errorDetails = normalizeProviderError(networkError, null, response?.status ?? null);
      return {
        success: false,
        providerMessageId: null,
        providerRequestId: null,
        ...errorDetails,
      };
    }

    let parsedBody = null;
    try {
      parsedBody = JSON.parse(responseText);
    } catch {
      return {
        success: false,
        providerMessageId: null,
        providerRequestId: null,
        errorCategory: response.status >= 500 ? "temporary" : "permanent",
        errorCode: "INVALID_JSON_RESPONSE",
        errorMessage: `Fonnte returned non-JSON response (HTTP ${response.status})`,
        rawResponse: responseText.slice(0, 500),
      };
    }

    const validation = validateResponse(parsedBody);
    if (!response.ok || !validation.status) {
      const errorDetails = normalizeProviderError(null, parsedBody, response.status);
      return {
        success: false,
        providerMessageId: validation.id,
        providerRequestId: validation.requestId,
        ...errorDetails,
        rawResponse: parsedBody,
      };
    }

    return {
      success: true,
      providerMessageId: validation.id,
      providerRequestId: validation.requestId,
      providerProcess: validation.process,
      rawResponse: parsedBody,
    };
  }
}

export const fonnteService = new FonnteService();
