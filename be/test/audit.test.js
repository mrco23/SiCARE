import assert from "node:assert/strict";
import { test } from "node:test";
import { readdirSync, readFileSync } from "node:fs";
import { SAFE_ACTIONS, writeAudit } from "../src/lib/audit.js";

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

test("counselor license and session note changes are written to the audit trail", async () => {
  const inserted = [];
  const client = {
    from: () => ({
      insert: async (row) => {
        inserted.push(row);
        return { error: null };
      },
    }),
  };

  await writeAudit(
    {
      actorUserId: "counselor-1",
      action: "counselor.license.update",
      entityType: "profile",
      entityId: "counselor-1",
      metadata: { role: "counselor", sipp_silp_valid_until: "2027-12-31", note: "rahasia" },
    },
    client,
  );
  await writeAudit(
    {
      actorUserId: "counselor-1",
      action: "counselor.session_notes.update",
      entityType: "session",
      entityId: "session-1",
      metadata: { role: "counselor" },
    },
    client,
  );

  assert.equal(inserted.length, 2);
  assert.deepEqual(inserted[0].metadata, { role: "counselor", sipp_silp_valid_until: "2027-12-31" });
});

test("every audit action used in the backend is on the allow-list", () => {
  const srcDir = new URL("../src/", import.meta.url);
  const files = readdirSync(srcDir, { recursive: true }).filter((file) => String(file).endsWith(".js"));
  const used = new Set();

  for (const file of files) {
    const source = readFileSync(new URL(String(file).replaceAll("\\", "/"), srcDir), "utf8");
    for (const call of source.matchAll(/writeAudit\(\{[\s\S]*?\n\s*\}\s*\)/g)) {
      const line = call[0].match(/action:\s*([^\n]+)/)?.[1] ?? "";
      for (const literal of line.matchAll(/"([a-z_]+(?:\.[a-z_]+)+)"/g)) used.add(literal[1]);
    }
  }

  assert.ok(used.size > 20, "the scan should find the audit call sites");
  assert.deepEqual([...used].filter((action) => !SAFE_ACTIONS.has(action)).sort(), []);
});
