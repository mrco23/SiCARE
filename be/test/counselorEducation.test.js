import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { counselorEducationService } from "../src/services/counselor/education.service.js";
import {
  MAX_COUNSELOR_EDUCATIONS,
  educationCreateSchema,
  educationPatchSchema,
} from "../src/validators/counselor.validator.js";

/** Tabel counselor_educations di memori; meniru rantai query Supabase yang dipakai service. */
function memoryClient(rows = []) {
  let seq = rows.length;
  return {
    rows,
    from() {
      const filters = {};
      let op = "select";
      let payload;
      let headCount = false;
      const matches = () => rows.filter((r) => Object.entries(filters).every(([k, v]) => r[k] === v));
      const run = () => {
        if (op === "insert") {
          const row = { id: `e-${++seq}`, ...payload };
          rows.push(row);
          return { data: row, error: null };
        }
        if (op === "update") {
          const [row] = matches();
          if (row) Object.assign(row, payload);
          return { data: row ?? null, error: null };
        }
        if (op === "delete") {
          const [row] = matches();
          if (row) rows.splice(rows.indexOf(row), 1);
          return { data: row ? { id: row.id } : null, error: null };
        }
        if (headCount) return { count: matches().length, error: null };
        return { data: matches(), error: null };
      };
      const q = {
        select(_f, opts) { if (opts?.head) headCount = true; return q; },
        insert(v) { op = "insert"; payload = v; return q; },
        update(v) { op = "update"; payload = v; return q; },
        delete() { op = "delete"; return q; },
        eq(k, v) { filters[k] = v; return q; },
        order() { return q; },
        single: async () => run(),
        maybeSingle: async () => run(),
        then(resolve, reject) { return Promise.resolve(run()).then(resolve, reject); },
      };
      return q;
    },
  };
}

const sample = { institution: "Universitas Sam Ratulangi", degree: "Sarjana Psikologi", graduation_year: 2015 };

test("education schemas validate fields strictly", () => {
  assert.equal(educationCreateSchema.safeParse(sample).success, true);
  assert.equal(educationCreateSchema.safeParse({ ...sample, counselor_profile_id: "x" }).success, false);
  assert.equal(educationCreateSchema.safeParse({ ...sample, degree: "  " }).success, false);
  assert.equal(educationCreateSchema.safeParse({ ...sample, graduation_year: 1900 }).success, false);
  assert.equal(educationPatchSchema.safeParse({}).success, false);
  assert.equal(educationPatchSchema.safeParse({ degree: "Magister Psikologi" }).success, true);
});

test("counselor can create, list, update, and delete only their own educations", async () => {
  const client = memoryClient([{ id: "other", counselor_profile_id: "c-2", ...sample }]);
  const created = await counselorEducationService.create("c-1", sample, client);
  assert.equal(created.counselor_profile_id, "c-1");

  const list = await counselorEducationService.list("c-1", client);
  assert.deepEqual(list.map((r) => r.id), [created.id]);

  const updated = await counselorEducationService.update("c-1", created.id, { degree: "Magister Psikologi" }, client);
  assert.equal(updated.degree, "Magister Psikologi");

  // Milik konselor lain: tidak ditemukan.
  await assert.rejects(
    counselorEducationService.update("c-1", "other", { degree: "X" }, client),
    (e) => e.status === 404 && e.code === "EDUCATION_NOT_FOUND",
  );
  await assert.rejects(counselorEducationService.remove("c-1", "other", client), (e) => e.status === 404);
  assert.equal(client.rows.find((r) => r.id === "other").degree, sample.degree);

  await counselorEducationService.remove("c-1", created.id, client);
  assert.equal((await counselorEducationService.list("c-1", client)).length, 0);
});

test("education entries are capped per counselor", async () => {
  const rows = Array.from({ length: MAX_COUNSELOR_EDUCATIONS }, (_, i) => ({ id: `r${i}`, counselor_profile_id: "c-1", ...sample }));
  await assert.rejects(
    counselorEducationService.create("c-1", sample, memoryClient(rows)),
    (e) => e.status === 409 && e.code === "EDUCATION_LIMIT_REACHED",
  );
});

test("counselor_educations migration is one-to-many from counselor_profiles and server-only", () => {
  const sql = readFileSync(
    new URL("../../supabase/migrations/20261126120000_sicare_counselor_educations.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /references public\.counselor_profiles \(profile_id\) on delete cascade/);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /revoke all on table public\.counselor_educations from public, anon, authenticated/);
});

test("counselor topics are unlimited in count but must be unique", async () => {
  const { profilePatchSchema } = await import("../src/validators/counselor.validator.js");
  const many = Array.from({ length: 50 }, (_, i) => `Topik ${i + 1}`);
  assert.equal(profilePatchSchema.safeParse({ specialties: many }).success, true);
  assert.equal(profilePatchSchema.safeParse({ specialties: ["Karier", "karier"] }).success, false);
  assert.equal(profilePatchSchema.safeParse({ specialties: ["x".repeat(101)] }).success, false);
});
