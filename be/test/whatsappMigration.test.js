import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const migration = new URL("../../supabase/migrations/20261031120000_sicare_whatsapp_outbox_fonnte.sql", import.meta.url);

test("whatsapp outbox migration defines message types, state machine, worker RPCs and security grants", async () => {
  const sql = await readFile(migration, "utf8");

  // Check constraints
  assert.match(sql, /booking_requested/);
  assert.match(sql, /booking_received/);
  assert.match(sql, /booking_accepted/);
  assert.match(sql, /booking_rejected/);
  assert.match(sql, /reschedule_requested/);
  assert.match(sql, /booking_cancelled/);
  assert.match(sql, /reminder_h1/);
  assert.match(sql, /reminder_day_of/);

  // Status lifecycle
  assert.match(sql, /pending/);
  assert.match(sql, /processing/);
  assert.match(sql, /accepted/);
  assert.match(sql, /delivered/);
  assert.match(sql, /retry_wait/);
  assert.match(sql, /failed/);
  assert.match(sql, /unknown/);

  // Operational columns
  assert.match(sql, /next_attempt_at/);
  assert.match(sql, /locked_by/);
  assert.match(sql, /lease_expires_at/);
  assert.match(sql, /payload jsonb/);
  assert.match(sql, /provider_message_id/);
  assert.match(sql, /provider_status/);

  // Atomic claiming RPC with FOR UPDATE SKIP LOCKED
  assert.match(sql, /create or replace function public\.sicare_claim_whatsapp_jobs/i);
  assert.match(sql, /for update skip locked/i);
  assert.match(sql, /revoke all on function public\.sicare_claim_whatsapp_jobs[\s\S]*from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.sicare_claim_whatsapp_jobs[\s\S]*to service_role/i);

  // Health and stats RPC
  assert.match(sql, /create or replace function public\.sicare_get_whatsapp_stats/i);
  assert.match(sql, /revoke all on function public\.sicare_get_whatsapp_stats[\s\S]*from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.sicare_get_whatsapp_stats[\s\S]*to service_role/i);

  // Transactional booking RPCs with atomic outbox insertion
  assert.match(sql, /create or replace function public\.sicare_create_booking/i);
  assert.match(sql, /insert into public\.whatsapp_outbox[\s\S]*booking_requested[\s\S]*booking_received/i);
  assert.match(sql, /revoke all on function public\.sicare_create_booking[\s\S]*to service_role/i);

  assert.match(sql, /create or replace function public\.sicare_reschedule_booking/i);
  assert.match(sql, /update public\.whatsapp_outbox\s+set status = 'cancelled'/i);
  assert.match(sql, /insert into public\.whatsapp_outbox[\s\S]*reschedule_requested/i);
  assert.match(sql, /revoke all on function public\.sicare_reschedule_booking[\s\S]*to service_role/i);

  assert.match(sql, /create or replace function public\.sicare_transition_booking/i);
  assert.match(sql, /insert into public\.whatsapp_outbox[\s\S]*booking_accepted/i);
  assert.match(sql, /insert into public\.whatsapp_outbox[\s\S]*booking_rejected/i);
  assert.match(sql, /insert into public\.whatsapp_outbox[\s\S]*booking_cancelled/i);
  assert.match(sql, /revoke all on function public\.sicare_transition_booking[\s\S]*to service_role/i);
});
