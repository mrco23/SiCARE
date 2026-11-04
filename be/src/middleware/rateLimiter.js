import rateLimit from "express-rate-limit";
import { env } from "../config/env.js";
import { HttpError } from "../lib/http.js";

/**
 * Creates an express-rate-limit middleware that integrates with SiCARE's HttpError and errorHandler.
 *
 * @param {object} options
 * @param {number} [options.windowMs] Time window in milliseconds
 * @param {number} [options.max] Maximum requests per window
 * @param {string} [options.message] User-facing message in Indonesian
 * @param {string} [options.code="TOO_MANY_REQUESTS"] Error code for API response
 * @param {boolean} [options.skipFailedRequests=false]
 * @param {Function} [options.skip] Custom skip function
 * @returns {import("express").RequestHandler}
 */
export function createRateLimiter(options = {}) {
  const {
    windowMs = 15 * 60 * 1000,
    max = 10,
    message = "Terlalu banyak permintaan. Silakan coba beberapa saat lagi.",
    code = "TOO_MANY_REQUESTS",
    skipFailedRequests = false,
    skip,
  } = options;

  return rateLimit({
    windowMs,
    limit: max,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skipFailedRequests,
    skip,
    validate: {
      trustProxy: false,
      xForwardedForHeader: false,
    },
    handler: (_req, _res, next) => {
      next(new HttpError(429, code, message));
    },
  });
}

// 1. Login rate limiter (e.g. 10 attempts per 15 minutes by default)
export const loginRateLimiter = createRateLimiter({
  windowMs: env.authRateLimitWindowMs,
  max: env.authLoginRateLimitMax,
  code: "TOO_MANY_REQUESTS",
  message: "Terlalu banyak percobaan masuk. Silakan tunggu beberapa menit sebelum mencoba kembali.",
});

// 2. Register rate limiter (e.g. 5 attempts per 15 minutes by default)
export const registerRateLimiter = createRateLimiter({
  windowMs: env.authRateLimitWindowMs,
  max: env.authRegisterRateLimitMax,
  code: "TOO_MANY_REQUESTS",
  message: "Terlalu banyak percobaan registrasi dari perangkat ini. Silakan coba lagi nanti.",
});

// 3. Resend confirmation rate limiter (e.g. 5 attempts per 15 minutes by default)
export const resendConfirmationRateLimiter = createRateLimiter({
  windowMs: env.authRateLimitWindowMs,
  max: env.authResendRateLimitMax,
  code: "TOO_MANY_REQUESTS",
  message: "Terlalu banyak permintaan kirim ulang konfirmasi. Silakan tunggu beberapa saat.",
});

// 4. Webhook rate limiter (e.g. 120 per minute by default, protects from DOS without blocking legitimate Fonnte bursts)
export const webhookRateLimiter = createRateLimiter({
  windowMs: env.webhookRateLimitWindowMs,
  max: env.webhookRateLimitMax,
  code: "TOO_MANY_REQUESTS",
  message: "Terlalu banyak permintaan webhook. Permintaan dibatasi sementara.",
});

