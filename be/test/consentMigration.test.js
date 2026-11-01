import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const migration = new URL("../../supabase/migrations/20261031150000_sicare_informed_consent_foundation.sql", import.meta.url);
const hardeningMigration = new URL("../../supabase/migrations/20261031160000_sicare_consent_security_hardening.sql", import.meta.url);

test("informed consent migration defines templates, participant identity, consents, invitations, and audit logs", async () => {
  const sql = await readFile(migration, "utf8");

  // 1. Consent Templates
  assert.match(sql, /create table if not exists public\.consent_templates/);
  assert.match(sql, /template_code text not null default 'SICARE_IC_STD'/);
  assert.match(sql, /version text not null default 'v1\.0'/);
  assert.match(sql, /file_sha256 text not null check \(file_sha256 ~ '\^\[0-9a-fA-F\]\{64\}\$'\)/);
  assert.match(sql, /storage_bucket text not null default 'informed-consent-templates'/);
  assert.match(sql, /constraint consent_templates_code_ver_uq unique \(template_code, version\)/);
  assert.match(sql, /create unique index if not exists consent_templates_active_uq/);

  // Official PDF SHA-256 hash
  assert.match(sql, /59012141d8a54336928a4c076d9d0ad7276bbbc36064c37d9654cc031f14cd8f/i);

  // 2. Booking Participants Extension
  assert.match(sql, /alter table public\.booking_participants/);
  assert.match(sql, /add column if not exists user_id uuid references public\.profiles\(id\)/);
  assert.match(sql, /add column if not exists participant_type text not null default 'client'/);
  assert.match(sql, /add column if not exists faculty text/);
  assert.match(sql, /add column if not exists study_program text/);
  assert.match(sql, /add column if not exists nim text/);
  assert.match(sql, /add column if not exists birthplace text/);
  assert.match(sql, /add column if not exists date_of_birth date/);
  assert.match(sql, /add column if not exists gender text/);
  assert.match(sql, /add column if not exists phone_e164 text/);
  assert.match(sql, /add column if not exists is_primary boolean not null default false/);
  assert.match(sql, /create unique index if not exists booking_participants_one_primary_uq/);

  // 3. Informed Consents
  assert.match(sql, /create table if not exists public\.informed_consents/);
  assert.match(sql, /booking_participant_id uuid not null references public\.booking_participants\(id\)/);
  assert.match(sql, /consent_template_id uuid not null references public\.consent_templates\(id\)/);
  assert.match(sql, /check \(status in \('pending', 'viewed', 'signed', 'revoked', 'expired'\)\)/);
  assert.match(sql, /identity_snapshot jsonb not null default '{}'::jsonb/);
  assert.match(sql, /signature_method text/);
  assert.match(sql, /signed_document_storage_path text/);
  assert.match(sql, /signed_document_sha256 text/);
  assert.match(sql, /create unique index if not exists informed_consents_participant_template_uq/);

  // 4. Consent Invitations (One-Time Cryptographic Tokens)
  assert.match(sql, /create table if not exists public\.consent_invitations/);
  assert.match(sql, /token_hash text not null unique/);
  assert.match(sql, /check \(invitation_type in \('authenticated_participant', 'guest_participant'\)\)/);
  assert.match(sql, /check \(status in \('pending', 'sent', 'claimed', 'completed', 'expired', 'revoked', 'failed'\)\)/);
  assert.match(sql, /expires_at timestamptz not null/);

  // 5. Consent Audit Logs (Append-Only)
  assert.match(sql, /create table if not exists public\.consent_audit_logs/);
  assert.match(sql, /event_type text not null check \(event_type in \(/);
  assert.match(sql, /create or replace function public\.prohibit_consent_audit_mutation/);
  assert.match(sql, /CONSENT_AUDIT_LOG_IS_APPEND_ONLY/);
  assert.match(sql, /create trigger consent_audit_logs_append_only/);

  // 6. Private Storage Buckets
  assert.match(sql, /informed-consent-templates/);
  assert.match(sql, /informed-consent-signed/);
  assert.match(sql, /informed-consent-signatures/);

  // 7. Security & RLS
  assert.match(sql, /alter table public\.consent_templates enable row level security/);
  assert.match(sql, /alter table public\.informed_consents enable row level security/);
  assert.match(sql, /alter table public\.consent_invitations enable row level security/);
  assert.match(sql, /alter table public\.consent_audit_logs enable row level security/);

  // 8. Consent Readiness RPC
  assert.match(sql, /create or replace function public\.sicare_check_booking_consent_readiness/);
  assert.match(sql, /grant execute on function public\.sicare_check_booking_consent_readiness\(uuid\) to authenticated, service_role/);
});

test("informed consent hardening migration defines strict RLS, immutability triggers, atomic claim RPC, and sanitized readiness", async () => {
  const sql = await readFile(hardeningMigration, "utf8");

  // 1. Storage bucket restriction: PNG and JPEG only, no SVG
  assert.match(sql, /update storage\.buckets\s+set allowed_mime_types = array\['image\/png', 'image\/jpeg'\]/);
  assert.match(sql, /informed-consent-signatures/);

  // Storage object policies
  assert.match(sql, /create policy consent_templates_objects_select on storage\.objects/);
  assert.match(sql, /create policy consent_signatures_objects_select on storage\.objects/);
  assert.match(sql, /create policy consent_signed_objects_select on storage\.objects/);

  // 2. Strict RLS on informed_consents: removes client_id access
  assert.match(sql, /drop policy if exists informed_consents_select_parties on public\.informed_consents/);
  assert.match(sql, /create policy informed_consents_select_strict on public\.informed_consents/);
  assert.match(sql, /signer_user_id = \(select auth\.uid\(\)\)/);
  const strictPolicy = sql.match(/create policy informed_consents_select_strict[\s\S]*?;/);
  assert.ok(strictPolicy);
  assert.doesNotMatch(strictPolicy[0], /client_id/);

  // 3. Strict RLS on booking_participants: protects clinical PII
  assert.match(sql, /drop policy if exists booking_participants_select_parties on public\.booking_participants/);
  assert.match(sql, /create policy booking_participants_select_strict on public\.booking_participants/);

  // 4. Operational consent summary function without PII
  assert.match(sql, /create or replace function public\.sicare_get_booking_consent_summaries/);
  assert.match(sql, /BOOKING_ACCESS_FORBIDDEN/);

  // 5. Signed consent tampering guard trigger
  assert.match(sql, /create or replace function public\.prohibit_signed_consent_tampering/);
  assert.match(sql, /SIGNED_CONSENT_CANNOT_BE_DELETED/);
  assert.match(sql, /SIGNED_CONSENT_INVALID_STATUS_TRANSITION/);
  assert.match(sql, /SIGNED_CONSENT_EVIDENCE_IMMUTABLE/);
  assert.match(sql, /REVOKED_CONSENT_IS_FINAL/);
  assert.match(sql, /create trigger informed_consents_tampering_guard/);

  // 6. Atomic invitation claim RPC
  assert.match(sql, /create or replace function public\.sicare_claim_consent_invitation/);
  assert.match(sql, /INVITATION_ALREADY_USED/);
  assert.match(sql, /INVITATION_EXPIRED/);
  assert.match(sql, /INVITATION_ACCOUNT_MISMATCH/);
  assert.match(sql, /INVITATION_CLAIM_RACE_OR_ALREADY_USED/);

  // 7. Hardened readiness RPC
  assert.match(sql, /create or replace function public\.sicare_check_booking_consent_readiness/);
  assert.match(sql, /participant_status != 'removed'/);
  assert.match(sql, /template_code = 'SICARE_IC_STD'/);
  assert.match(sql, /v_template_compliant/);
});
