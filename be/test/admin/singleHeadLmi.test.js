import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { activateHeadLmi } from "../../src/services/admin/accounts.service.js";

function profilesClient(rows, { rpcMissing = false } = {}) {
  return {
    rows,
    async rpc(name, { p_profile_id }) {
      assert.equal(name, "sicare_activate_head_lmi");
      if (rpcMissing) return { data: null, error: { code: "PGRST202" } };
      const target = rows.find((r) => r.id === p_profile_id);
      if (target?.app_role !== "head_lmi") return { data: null, error: { code: "22023", message: "NOT_HEAD_LMI" } };
      const off = rows.filter((r) => r.app_role === "head_lmi" && r.account_status === "active" && r.id !== p_profile_id);
      off.forEach((r) => { r.account_status = "disabled"; });
      target.account_status = "active";
      return { data: [{ activated_id: target.id, deactivated_ids: off.map((r) => r.id) }], error: null };
    },
    from() {
      const eq = {};
      const neq = {};
      let patch;
      const match = () => rows.filter((r) =>
        Object.entries(eq).every(([k, v]) => r[k] === v) && Object.entries(neq).every(([k, v]) => r[k] !== v));
      const apply = () => { const hit = match(); hit.forEach((r) => Object.assign(r, patch)); return hit; };
      const q = {
        update(v) { patch = v; return q; },
        eq(k, v) { eq[k] = v; return q; },
        neq(k, v) { neq[k] = v; return q; },
        async select() { return { data: apply().map((r) => ({ id: r.id })), error: null }; },
        then(resolve, reject) { apply(); return Promise.resolve({ error: null }).then(resolve, reject); },
      };
      return q;
    },
  };
}

const heads = () => [
  { id: "old", app_role: "head_lmi", account_status: "active" },
  { id: "new", app_role: "head_lmi", account_status: "disabled" },
  { id: "c1", app_role: "counselor", account_status: "active" },
];

for (const rpcMissing of [false, true]) {
  test(`activating a Kepala LMI disables the active one (${rpcMissing ? "fallback" : "rpc"})`, async () => {
    const client = profilesClient(heads(), { rpcMissing });
    const deactivated = await activateHeadLmi("new", "admin-1", client);
    assert.deepEqual(deactivated, ["old"]);
    const status = Object.fromEntries(client.rows.map((r) => [r.id, r.account_status]));
    assert.deepEqual(status, { old: "disabled", new: "active", c1: "active" });
  });
}

test("activating a non Kepala LMI account through the swap is rejected", async () => {
  await assert.rejects(activateHeadLmi("c1", "admin-1", profilesClient(heads())));
});

test("migration keeps at most one active Kepala LMI", () => {
  const sql = readFileSync(
    new URL("../../../supabase/migrations/20261126130000_sicare_single_active_head_lmi.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /create unique index if not exists profiles_single_active_head_lmi/);
  assert.match(sql, /where app_role = 'head_lmi' and account_status = 'active'/);
  assert.match(sql, /revoke all on function public\.sicare_activate_head_lmi\(uuid\) from public, anon, authenticated/);
});
