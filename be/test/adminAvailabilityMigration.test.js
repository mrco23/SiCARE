import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const migration = new URL("../../supabase/migrations/20261028130000_sicare_admin_availability_management.sql", import.meta.url);

test("admin and counselor-management migration defines transactional availability RPCs", async () => {
  const sql = await readFile(migration, "utf8");
  assert.match(sql, /create or replace function public\.sicare_save_availability_slot/i);
  assert.match(sql, /create or replace function public\.sicare_cancel_availability_slot/i);
  assert.match(sql, /for update/i);
  assert.match(sql, /AVAILABILITY_OVERLAP/);
  assert.match(sql, /AVAILABILITY_BOOKED/);
  assert.match(sql, /revoke all on function public\.sicare_save_availability_slot[\s\S]*from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.sicare_save_availability_slot[\s\S]*to service_role/i);
  assert.match(sql, /No hero quote\/content table is introduced/i);
});
