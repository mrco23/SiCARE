import assert from "node:assert/strict";
import { test } from "node:test";
import { writeAudit } from "../src/lib/audit.js";

function createFakeClient(result = { error: null }) {
  const calls = [];
  return {
    calls,
    from(table) {
      return {
        insert(row) {
          calls.push({ table, row });
          return Promise.resolve(result);
        },
      };
    },
  };
}

test("writeAudit checks Supabase's returned error and does not throw", async () => {
  const client = createFakeClient({ error: { code: "42501", message: "private database detail" } });
  const originalError = console.error;
  const logged = [];
  console.error = (...args) => logged.push(args);
  try {
    await assert.doesNotReject(() => writeAudit({
      actorUserId: "user-id",
      action: "profile.update",
      entityType: "profile",
      entityId: "user-id",
      metadata: { field: "full_name", secret: "must-not-be-logged" },
    }, client));
  } finally {
    console.error = originalError;
  }

  assert.equal(client.calls.length, 1);
  assert.equal(client.calls[0].table, "audit_events");
  assert.deepEqual(client.calls[0].row.metadata, { field: "full_name" });
  assert.equal(logged.length, 1);
  assert.deepEqual(logged[0][1], { action: "profile.update", entityType: "profile", code: "42501" });
  assert.equal(JSON.stringify(logged).includes("private database detail"), false);
});

test("writeAudit catches thrown database errors without changing the main flow", async () => {
  const client = {
    from() {
      return { insert: async () => { throw Object.assign(new Error("sensitive detail"), { code: "NETWORK_ERROR" }); } };
    },
  };
  const originalError = console.error;
  const logged = [];
  console.error = (...args) => logged.push(args);
  try {
    await assert.doesNotReject(() => writeAudit({
      action: "auth.register",
      entityType: "profile",
      metadata: { role: "client" },
    }, client));
  } finally {
    console.error = originalError;
  }

  assert.equal(logged.length, 1);
  assert.deepEqual(logged[0][1], { action: "auth.register", entityType: "profile", code: "NETWORK_ERROR" });
  assert.equal(JSON.stringify(logged).includes("sensitive detail"), false);
});

test("writeAudit ignores actions outside the allowlist", async () => {
  const client = createFakeClient();
  await writeAudit({ action: "unapproved.action", entityType: "profile" }, client);
  assert.equal(client.calls.length, 0);
});
