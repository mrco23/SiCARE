import pino from "pino";
import { env } from "../config/env.js";

/**
 * List of sensitive key paths that must never appear in raw log output.
 * Pino will censor these values with [REDACTED].
 */
export const SENSITIVE_LOG_KEYS = [
  "phone",
  "phone_e164",
  "targetPhone",
  "recipientPhone",
  "phoneNumber",
  "nomor_telepon",
  "token",
  "rawToken",
  "invitationToken",
  "secret",
  "password",
  "kata_sandi",
  "credential",
  "message",
  "body",
  "isi_pesan",
  "clientName",
  "participantName",
  "full_name",
  "nama_lengkap",
  "identity_code",
  "identitySnapshot",
  "notes",
  "catatan",
];

const defaultRedactPaths = [
  ...SENSITIVE_LOG_KEYS,
  ...SENSITIVE_LOG_KEYS.map((key) => `*.${key}`),
  ...SENSITIVE_LOG_KEYS.map((key) => `*.*.${key}`),
  ...SENSITIVE_LOG_KEYS.map((key) => `*.*.*.${key}`),
];

/**
 * Creates a configured Pino logger instance.
 *
 * @param {object} [options]
 * @param {string} [options.level]
 * @param {string[]} [options.redactPaths]
 * @param {import("node:stream").DestinationStream} [options.destination]
 * @returns {import("pino").Logger}
 */
export function createLogger(options = {}) {
  const level =
    options.level ||
    env?.logLevel ||
    env?.LOG_LEVEL ||
    process.env.LOG_LEVEL ||
    (process.env.NODE_ENV === "test" ? "silent" : "info");

  const redactPaths = options.redactPaths || defaultRedactPaths;

  return pino(
    {
      level,
      redact: {
        paths: redactPaths,
        censor: "[REDACTED]",
      },
      formatters: {
        level(label) {
          return { level: label };
        },
      },
      timestamp: pino.stdTimeFunctions.isoTime,
      ...options,
    },
    options.destination,
  );
}

export const logger = createLogger();

