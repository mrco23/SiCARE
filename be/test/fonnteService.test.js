import assert from "node:assert/strict";
import { test } from "node:test";
import {
  FonnteService,
  isTestRecipientAllowed,
  normalizePhoneNumber,
  normalizeProviderError,
  validateResponse,
} from "../src/services/fonnte.service.js";

test("normalizePhoneNumber converts local Indonesian numbers to E.164 without plus", () => {
  assert.equal(normalizePhoneNumber("081234567890"), "6281234567890");
  assert.equal(normalizePhoneNumber("+6281234567890"), "6281234567890");
  assert.equal(normalizePhoneNumber("6281234567890"), "6281234567890");
  assert.equal(normalizePhoneNumber("81234567890"), "6281234567890");
  assert.equal(normalizePhoneNumber("0812-3456-7890"), "6281234567890");
  assert.equal(normalizePhoneNumber(" 0812 3456 7890 "), "6281234567890");

  assert.equal(normalizePhoneNumber(""), null);
  assert.equal(normalizePhoneNumber("123"), null);
  assert.equal(normalizePhoneNumber(null), null);
  assert.equal(normalizePhoneNumber("invalid-text"), null);
});

test("validateResponse parses array and string IDs properly", () => {
  const res1 = validateResponse({ status: true, id: ["MSG-12345"], target: ["628123"], process: "processing", requestid: "REQ-1" });
  assert.equal(res1.valid, true);
  assert.equal(res1.status, true);
  assert.equal(res1.id, "MSG-12345");
  assert.equal(res1.requestId, "REQ-1");
  assert.equal(res1.process, "processing");

  const res2 = validateResponse({ status: true, id: "MSG-67890" });
  assert.equal(res2.id, "MSG-67890");

  const res3 = validateResponse({ status: false, reason: "device disconnected" });
  assert.equal(res3.status, false);
  assert.equal(res3.reason, "device disconnected");
  assert.equal(res3.id, null);
});

test("normalizeProviderError categorizes transient vs permanent vs timeout", () => {
  const timeoutErr = new Error("The operation was aborted");
  timeoutErr.name = "TimeoutError";
  const normTimeout = normalizeProviderError(timeoutErr);
  assert.equal(normTimeout.errorCategory, "unknown");
  assert.equal(normTimeout.errorCode, "FONNTE_TIMEOUT");

  const rateLimit = normalizeProviderError(null, null, 429);
  assert.equal(rateLimit.errorCategory, "temporary");
  assert.equal(rateLimit.errorCode, "FONNTE_RATE_LIMIT");

  const serverError = normalizeProviderError(null, null, 502);
  assert.equal(serverError.errorCategory, "temporary");
  assert.equal(serverError.errorCode, "FONNTE_SERVER_ERROR");

  const authError = normalizeProviderError(null, null, 401);
  assert.equal(authError.errorCategory, "permanent");
  assert.equal(authError.errorCode, "FONNTE_AUTH_ERROR");

  const disconnected = normalizeProviderError(null, { reason: "device disconnected" }, 200);
  assert.equal(disconnected.errorCategory, "temporary");
  assert.equal(disconnected.errorCode, "FONNTE_DEVICE_DISCONNECTED");

  const badToken = normalizeProviderError(null, { reason: "invalid token" }, 200);
  assert.equal(badToken.errorCategory, "permanent");
  assert.equal(badToken.errorCode, "FONNTE_AUTH_ERROR");
});

test("FonnteService in dry-run mode simulates sending without network call", async () => {
  let fetchCalled = false;
  const mockFetch = async () => {
    fetchCalled = true;
    return new Response(JSON.stringify({ status: true }));
  };

  const service = new FonnteService({
    fetchFn: mockFetch,
    token: "mock-token",
    sendEnabled: false, // disabled
    testMode: false,
  });

  const result = await service.sendMessage({
    target: "081234567890",
    message: "Test message",
  });

  assert.equal(fetchCalled, false);
  assert.equal(result.success, true);
  assert.equal(result.simulated, true);
  assert.match(result.providerMessageId, /^sim-/);
});

test("FonnteService in test mode blocks targets not in test recipients", async () => {
  const service = new FonnteService({
    token: "mock-token",
    sendEnabled: true,
    testMode: true,
  });

  const result = await service.sendMessage({
    target: "089999999999",
    message: "Test message",
  });

  assert.equal(result.success, false);
  assert.equal(result.errorCategory, "permanent");
  assert.equal(result.errorCode, "TEST_RECIPIENT_NOT_ALLOWED");
});

test("FonnteService live call sends correct headers and payload", async () => {
  let capturedUrl = "";
  let capturedHeaders = {};
  let capturedBody = {};

  const mockFetch = async (url, options) => {
    capturedUrl = url;
    capturedHeaders = options.headers;
    capturedBody = JSON.parse(options.body);
    return new Response(JSON.stringify({
      status: true,
      id: ["FONNTE-MSG-999"],
      requestid: "REQ-777",
      process: "processing",
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  const service = new FonnteService({
    fetchFn: mockFetch,
    token: "SECRET_TOKEN_XYZ",
    apiUrl: "https://api.fonnte.com",
    sendEnabled: true,
    testMode: false,
  });

  const result = await service.sendMessage({
    target: "081234567890",
    message: "Halo SiCARE",
  });

  assert.equal(capturedUrl, "https://api.fonnte.com/send");
  // CRITICAL: Authorization must be exact token string, NOT Bearer
  assert.equal(capturedHeaders.Authorization, "SECRET_TOKEN_XYZ");
  assert.equal(capturedHeaders["Content-Type"], "application/json");
  assert.equal(capturedBody.target, "6281234567890");
  assert.equal(capturedBody.message, "Halo SiCARE");

  assert.equal(result.success, true);
  assert.equal(result.providerMessageId, "FONNTE-MSG-999");
  assert.equal(result.providerRequestId, "REQ-777");
});

test("checkConfiguration does not leak secrets", () => {
  const service = new FonnteService({
    token: "super-secret-token",
    apiUrl: "https://api.fonnte.com",
    sendEnabled: false,
    testMode: true,
  });

  const config = service.checkConfiguration();
  assert.equal(config.configured, true);
  assert.equal(config.hasToken, true);
  assert.equal("super-secret-token" in config, false);
  assert.equal(JSON.stringify(config).includes("super-secret-token"), false);
});
