import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createAccountSchema, patchAccountSchema } from "../src/validators/admin.validator.js";
import { licensePatchSchema, sessionNotesSchema } from "../src/validators/counselor.validator.js";
import { redactClientIdentity } from "../src/services/admin/counseling.service.js";

const migrationSql = readFileSync(
  new URL("../../supabase/migrations/20261105000000_sicare_profile_gender_counselor_license.sql", import.meta.url),
  "utf8",
);

const baseAccount = {
  email: "konselor@example.test",
  password: "password123",
  full_name: "Konselor Uji",
  app_role: "counselor",
};

test("migration stores gender and license numbers on private profiles, not the public counselor table", () => {
  assert.match(migrationSql, /alter table public\.profiles/);
  assert.match(migrationSql, /add column if not exists gender text/);
  assert.match(migrationSql, /add column if not exists siap_number text/);
  assert.match(migrationSql, /add column if not exists sipp_silp_number text/);
  assert.match(migrationSql, /gender in \('male', 'female'\)/);
  assert.doesNotMatch(migrationSql, /alter table public\.counselor_profiles/);
});

test("counselor account creation requires gender, SIAP, and SIPP/SILP", () => {
  const missing = createAccountSchema.safeParse(baseAccount);
  assert.equal(missing.success, false);
  assert.deepEqual(
    missing.error.issues.map((issue) => issue.path[0]).sort(),
    ["gender", "siap_number", "sipp_silp_number"],
  );

  const complete = createAccountSchema.safeParse({
    ...baseAccount,
    gender: "female",
    siap_number: "SIAP/123-45",
    sipp_silp_number: "SIPP 678.90",
  });
  assert.equal(complete.success, true);
});

test("head LMI account creation requires gender but not license numbers", () => {
  const headLmi = { ...baseAccount, app_role: "head_lmi" };
  assert.equal(createAccountSchema.safeParse(headLmi).success, false);
  assert.equal(createAccountSchema.safeParse({ ...headLmi, gender: "male" }).success, true);
});

test("account schemas reject invalid gender and license characters", () => {
  assert.equal(patchAccountSchema.safeParse({ gender: "other" }).success, false);
  assert.equal(patchAccountSchema.safeParse({ siap_number: "<script>" }).success, false);
  assert.equal(patchAccountSchema.safeParse({ gender: "male" }).success, true);
});

test("redactClientIdentity removes client identity but keeps reporting fields", () => {
  const redacted = redactClientIdentity({
    id: "booking-1",
    client_id: "client-1",
    counselor_id: "counselor-1",
    service_type: "group",
    group_name: "Kelompok A",
    status: "cancelled",
    cancellation_reason: "Jadwal bentrok",
    client: { id: "client-1", full_name: "Nama Klien" },
    counselor: { id: "counselor-1", full_name: "Nama Konselor" },
    booking_participants: [{ id: "p1", display_name: "Peserta" }],
    counseling_sessions: [{ id: "session-1", status: "cancelled" }],
  });

  assert.equal(redacted.client, null);
  assert.equal(redacted.client_id, null);
  assert.equal(redacted.group_name, null);
  assert.equal(redacted.cancellation_reason, null);
  assert.deepEqual(redacted.booking_participants, []);
  assert.equal(JSON.stringify(redacted).includes("Nama Klien"), false);
  assert.equal(redacted.counselor.full_name, "Nama Konselor");
  assert.equal(redacted.counseling_sessions.length, 1);
});

test("counselor license patch cannot touch SIAP and needs a valid future date", () => {
  const body = { sipp_silp_number: "SIPP-002", sipp_silp_valid_until: "2999-12-31" };
  assert.equal(licensePatchSchema.safeParse(body).success, true);
  assert.equal(licensePatchSchema.safeParse({ ...body, siap_number: "X" }).success, false);
  assert.equal(licensePatchSchema.safeParse({ sipp_silp_number: "SIPP-002" }).success, false);

  const past = licensePatchSchema.safeParse({ ...body, sipp_silp_valid_until: "2000-01-01" });
  assert.equal(past.success, false);
  assert.equal(past.error.issues[0].message, "Tanggal berlaku sudah lewat.");

  const invalid = licensePatchSchema.safeParse({ ...body, sipp_silp_valid_until: "2999-13-45" });
  assert.equal(invalid.success, false);
});

test("license validity migration stays on the private profiles table", () => {
  const sql = readFileSync(
    new URL("../../supabase/migrations/20261105120000_sicare_counselor_license_validity.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /add column if not exists sipp_silp_valid_until date/);
  assert.match(sql, /add column if not exists sipp_silp_updated_at timestamptz/);
  assert.doesNotMatch(sql, /counselor_profiles\s+add/);
});

test("session notes migration keeps notes server-only and adds participant identity fields", () => {
  const sql = readFileSync(
    new URL("../../supabase/migrations/20261105140000_sicare_session_notes_client_identity.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /create table if not exists public\.session_notes/);
  assert.match(sql, /alter table public\.session_notes enable row level security/);
  assert.match(sql, /revoke all on public\.session_notes from anon, authenticated/);
  assert.match(sql, /execute function public\.set_updated_at\(\)/);
  assert.match(sql, /add column if not exists religion text/);
  assert.match(sql, /add column if not exists education text/);
  assert.match(sql, /add column if not exists address text/);
});

test("session notes schema normalizes blank notes and rejects unknown fields", () => {
  const parsed = sessionNotesSchema.parse({ counselor_note: "  ", client_note: "Catatan", follow_up: null });
  assert.equal(parsed.counselor_note, null);
  assert.equal(parsed.client_note, "Catatan");
  assert.equal(
    sessionNotesSchema.safeParse({ counselor_note: null, client_note: null, follow_up: null, x: 1 }).success,
    false,
  );
});

test("session report service never selects the private counselor note", () => {
  const source = readFileSync(new URL("../src/services/counselor/sessionReport.service.js", import.meta.url), "utf8");
  const reportPart = source.slice(source.indexOf("async getReport"));
  assert.doesNotMatch(reportPart, /counselor_note/);
  assert.match(reportPart, /\.eq\("status", "signed"\)/);
});
