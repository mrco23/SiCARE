import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import {
  OFFICIAL_CONSENT_TEMPLATE,
  OFFICIAL_TEMPLATE_SHA256,
  OFFICIAL_TEMPLATE_VERSION,
} from "../src/services/consentPdf.service.js";

const migrationsDir = new URL("../../supabase/migrations/", import.meta.url);
const dropMigration = readFileSync(
  new URL("20261119120000_sicare_drop_consent_templates.sql", migrationsDir),
  "utf8",
);

test("drop migration aborts when a consent version differs from its template", () => {
  assert.match(dropMigration, /CONSENT_VERSION_MISMATCH/);
  const guard = dropMigration.indexOf("CONSENT_VERSION_MISMATCH");
  assert.ok(guard < dropMigration.indexOf("drop column if exists consent_template_id"));
  assert.ok(guard < dropMigration.indexOf("drop table if exists public.consent_templates"));
});

test("drop migration removes consent_templates and the FK column", () => {
  assert.match(dropMigration, /drop table if exists public\.consent_templates;/);
  assert.match(dropMigration, /alter table public\.informed_consents\s+drop column if exists consent_template_id;/);
  assert.match(dropMigration, /alter column consent_statement_version drop default/);
});

test("drop migration keeps one active consent per participant per version", () => {
  assert.match(
    dropMigration,
    /create unique index if not exists informed_consents_participant_version_uq\s+on public\.informed_consents \(booking_participant_id, consent_statement_version\)\s+where status in \('pending', 'viewed', 'signed'\);/,
  );
});

test("signed consent evidence stays immutable, including the version", () => {
  const fn = dropMigration.slice(
    dropMigration.indexOf("create or replace function public.prohibit_signed_consent_tampering"),
    dropMigration.indexOf("create or replace function public.sicare_check_booking_consent_readiness"),
  );
  assert.match(fn, /old\.consent_statement_version is distinct from new\.consent_statement_version/);
  assert.match(fn, /SIGNED_CONSENT_EVIDENCE_IMMUTABLE/);
  assert.match(fn, /SIGNED_CONSENT_CANNOT_BE_DELETED/);
  assert.match(fn, /REVOKED_CONSENT_IS_FINAL/);
  assert.doesNotMatch(fn, /consent_template_id/);
});

test("readiness RPC no longer reads consent_templates but keeps its authorization", () => {
  const fn = dropMigration.slice(dropMigration.indexOf("create or replace function public.sicare_check_booking_consent_readiness"));
  assert.doesNotMatch(fn.slice(0, fn.indexOf("-- 3. Index")), /consent_templates|consent_template_id/);
  assert.match(fn, /BOOKING_ACCESS_FORBIDDEN/);
  assert.match(fn, /'consent_statement_version', ic\.consent_statement_version/);
  assert.match(fn, /grant execute on function public\.sicare_check_booking_consent_readiness\(uuid\) to authenticated, service_role;/);
});

test("drop migration is the latest migration touching consent_templates", () => {
  const later = readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql") && name > "20261119120000_sicare_drop_consent_templates.sql")
    .filter((name) => /consent_templates/.test(readFileSync(new URL(name, migrationsDir), "utf8")));
  assert.deepEqual(later, []);
});

test("backend constant is the template source of truth", () => {
  assert.equal(OFFICIAL_CONSENT_TEMPLATE.version, OFFICIAL_TEMPLATE_VERSION);
  assert.equal(OFFICIAL_CONSENT_TEMPLATE.file_sha256, OFFICIAL_TEMPLATE_SHA256);
  assert.ok(Object.isFrozen(OFFICIAL_CONSENT_TEMPLATE));

  const source = readFileSync(new URL("../src/services/consent.service.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /from\("consent_templates"\)|consent_templates\(\*\)|consent_template_id/);
});
