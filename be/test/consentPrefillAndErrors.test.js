import assert from "node:assert/strict";
import { test } from "node:test";
import { HttpError } from "../src/lib/http.js";
import { validateConsentIdentity, validateSignaturePng } from "../src/services/consentPdf.service.js";
import { prefillParticipantFromProfile } from "../src/controllers/consent.controller.js";

test("incomplete consent identity is a 400 client error with readable issues", () => {
  assert.throws(
    () => validateConsentIdentity({ full_name: "Klien Uji" }),
    (error) =>
      error instanceof HttpError &&
      error.status === 400 &&
      error.code === "CONSENT_IDENTITY_INVALID" &&
      Array.isArray(error.details) &&
      error.details.includes("Fakultas wajib diisi."),
  );
});

test("invalid signature image is a 400 client error", () => {
  assert.throws(
    () => validateSignaturePng(Buffer.from("<svg></svg>")),
    (error) => error instanceof HttpError && error.status === 400 && error.code === "CONSENT_SIGNATURE_INVALID",
  );
});

test("consent participant is pre-filled from the signer's own profile without overwriting entered data", () => {
  const participant = { user_id: "u1", full_name: "Nama Peserta", nim: null, gender: "", phone_e164: null, faculty: null };
  const profile = { full_name: "Nama Profil", identity_code: "22013001", gender: "female", phone_e164: "+6281200000000" };

  const result = prefillParticipantFromProfile(participant, profile);

  assert.equal(result.full_name, "Nama Peserta");
  assert.equal(result.nim, "22013001");
  assert.equal(result.gender, "Perempuan");
  assert.equal(result.phone_e164, "+6281200000000");
  assert.equal(result.faculty, null);
  assert.equal(participant.nim, null, "input object is not mutated");
});

test("unknown profile gender is not guessed", () => {
  const result = prefillParticipantFromProfile({ gender: null }, { gender: "other" });
  assert.equal(result.gender, null);
});
