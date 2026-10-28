import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import app from "../app.js";

let server;
let baseUrl;

before(async () => {
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (server) await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
});

test("GET /api/v1/health returns service health without secrets", async () => {
  const response = await fetch(`${baseUrl}/api/v1/health`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.status, "ok");
  assert.equal(body.service, "sicare-backend");
  assert.equal(typeof body.timestamp, "string");
  assert.equal("SUPABASE_SECRET_KEY" in body, false);
});

test("unknown API route returns a consistent 404 response", async () => {
  const response = await fetch(`${baseUrl}/api/v1/not-a-route`);
  const body = await response.json();

  assert.equal(response.status, 404);
  assert.equal(body.error.code, "NOT_FOUND");
});

test("browser origins outside the allowlist are rejected", async () => {
  const response = await fetch(`${baseUrl}/api/v1/health`, {
    headers: { Origin: "https://untrusted.example" },
  });

  assert.equal(response.status, 403);
});

test("protected profile endpoint requires a bearer token", async () => {
  const response = await fetch(`${baseUrl}/api/v1/profile`);
  const body = await response.json();
  assert.equal(response.status, 401);
  assert.equal(body.error.code, "AUTH_REQUIRED");
});

test("unknown API route keeps the standard error envelope", async () => {
  const response = await fetch(`${baseUrl}/api/v1/does-not-exist`);
  const body = await response.json();
  assert.equal(response.status, 404);
  assert.equal(typeof body.error.message, "string");
});

test("public availability rejects a reversed date range before database access", async () => {
  const response = await fetch(`${baseUrl}/api/v1/public/availability?from=2026-01-10T00%3A00%3A00Z&to=2026-01-01T00%3A00%3A00Z`);
  const body = await response.json();
  assert.equal(response.status, 400);
  assert.equal(body.error.code, "INVALID_DATE_RANGE");
});

test("public availability caps query range at 90 days", async () => {
  const response = await fetch(`${baseUrl}/api/v1/public/availability?from=2026-01-01T00%3A00%3A00Z&to=2026-05-01T00%3A00%3A00Z`);
  const body = await response.json();
  assert.equal(response.status, 400);
  assert.equal(body.error.code, "DATE_RANGE_TOO_LARGE");
});

test("public feedback rejects invalid limits instead of silently accepting them", async () => {
  const response = await fetch(`${baseUrl}/api/v1/public/feedback?limit=1000`);
  const body = await response.json();
  assert.equal(response.status, 400);
  assert.equal(body.error.code, "VALIDATION_ERROR");
});

test("registration validates input before attempting external authentication", async () => {
  const response = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "not-an-email", password: "short", full_name: "Test" }),
  });
  const body = await response.json();
  assert.equal(response.status, 400);
  assert.equal(body.error.code, "VALIDATION_ERROR");
});
