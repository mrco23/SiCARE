import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";

// env is read once at import time, so the secret must be set before loading the app.
const CRON_SECRET = "test-cron-secret-0123456789";
process.env.CRON_SECRET = CRON_SECRET;

const { default: app } = await import("../app.js");
const { setSupabaseAdminClientForTests } = await import("../src/config/supabase.js");
const { isCronAuthorized } = await import("../src/routes/internal.routes.js");
const { calculateLeaseSeconds } = await import("../src/workers/whatsapp.worker.js");

let server;
let baseUrl;
let rpcCalls;

function emptyQuery() {
  const query = {
    select: () => query,
    eq: () => query,
    in: () => query,
    gt: () => query,
    gte: () => query,
    lte: () => query,
    order: () => query,
    then: (resolve) => resolve({ data: [], error: null }),
  };
  return query;
}

before(async () => {
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}/api/v1/internal/whatsapp`;
});

after(async () => {
  setSupabaseAdminClientForTests(null);
  await new Promise((resolve) => server.close(resolve));
});

beforeEach(() => {
  rpcCalls = [];
  setSupabaseAdminClientForTests({
    rpc: async (name, params) => {
      rpcCalls.push({ name, params });
      return { data: [], error: null };
    },
    from: () => emptyQuery(),
  });
});

test("isCronAuthorized fails closed and requires the exact bearer secret", () => {
  assert.equal(isCronAuthorized(`Bearer ${CRON_SECRET}`, CRON_SECRET), true);
  assert.equal(isCronAuthorized(CRON_SECRET, CRON_SECRET), false);
  assert.equal(isCronAuthorized("Bearer wrong", CRON_SECRET), false);
  assert.equal(isCronAuthorized(undefined, CRON_SECRET), false);
  assert.equal(isCronAuthorized("Bearer undefined", undefined), false);
  assert.equal(isCronAuthorized("Bearer ", ""), false);
});

for (const path of ["worker-run", "scheduler-run"]) {
  test(`${path} rejects missing and wrong credentials without running`, async () => {
    const missing = await fetch(`${baseUrl}/${path}`, { method: "POST" });
    const wrong = await fetch(`${baseUrl}/${path}`, {
      method: "POST",
      headers: { Authorization: "Bearer wrong" },
    });

    assert.equal(missing.status, 401);
    assert.equal(wrong.status, 401);
    assert.equal(rpcCalls.length, 0);
  });

  test(`${path} does not accept GET`, async () => {
    const response = await fetch(`${baseUrl}/${path}`, {
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    });
    assert.equal(response.status, 404);
  });
}

test("worker-run claims a cron batch with a lease covering the whole batch", async () => {
  const response = await fetch(`${baseUrl}/worker-run`, {
    method: "POST",
    headers: { Authorization: `Bearer ${CRON_SECRET}` },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { data: { claimed: 0, processed: 0 } });
  assert.equal(rpcCalls.length, 1);
  assert.equal(rpcCalls[0].name, "sicare_claim_whatsapp_jobs");
  assert.equal(rpcCalls[0].params.p_batch_size, 10);
  assert.equal(rpcCalls[0].params.p_lease_seconds, calculateLeaseSeconds(10));
});

test("scheduler-run returns only aggregate counts", async () => {
  const response = await fetch(`${baseUrl}/scheduler-run`, {
    method: "POST",
    headers: { Authorization: `Bearer ${CRON_SECRET}` },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    data: {
      scannedSessions: 0,
      enqueuedReminders: 0,
      cleanedReminders: 0,
      scannedInvitations: 0,
      enqueuedConsentReminders: 0,
    },
  });
});

test("calculateLeaseSeconds outlasts sequential provider timeouts and stays within the function limit", () => {
  assert.equal(calculateLeaseSeconds(1), 60);
  const lease = calculateLeaseSeconds(10);
  assert.ok(lease >= 150, "must cover 10 sends at the 15s provider timeout");
  assert.ok(lease < 300, "must stay below the 300s Vercel Hobby function limit");
});
