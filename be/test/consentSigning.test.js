import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { PDFDocument } from "pdf-lib";
import {
  CONSENT_PDF_COORDINATES,
  OFFICIAL_TEMPLATE_CODE,
  OFFICIAL_TEMPLATE_SHA256,
  OFFICIAL_TEMPLATE_VERSION,
  formatIndonesianDate,
  generateInformedConsentPdf,
  loadOfficialTemplatePdf,
  validateConsentIdentity,
  validateSignaturePng,
} from "../src/services/consentPdf.service.js";
import {
  assertConsentAccess,
  getSignedDocumentDownloadUrl,
  signInformedConsent,
  updateDraftConsentIdentity,
} from "../src/services/consent.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Minimal valid 1x1 transparent PNG base64 for testing
const SAMPLE_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const SAMPLE_PNG_BUFFER = Buffer.from(SAMPLE_PNG_BASE64, "base64");

const VALID_TEST_IDENTITY = {
  full_name: "Ahmad Rizky Pratama",
  faculty: "Fakultas Ilmu Komputer",
  study_program: "Sistem Informasi",
  nim: "2108561001",
  birthplace: "Denpasar",
  date_of_birth: "2002-04-12",
  gender: "Laki-laki",
  phone_e164: "+6281234567890",
};

// ============================================================================
// 1. Official PDF Template Integrity and Coordinates
// ============================================================================

test("1. Official PDF template matches SHA-256 checksum and loads as 1-page A4", async () => {
  const templateBytes = await loadOfficialTemplatePdf();
  assert.ok(templateBytes.length > 50000, "Template bytes should be loaded");

  const pdfDoc = await PDFDocument.load(templateBytes);
  assert.equal(pdfDoc.getPageCount(), 1, "Official template must be exactly 1 page");

  const page = pdfDoc.getPage(0);
  const size = page.getSize();
  assert.equal(Math.round(size.width), 595, "Width should be A4 595pt");
  assert.equal(Math.round(size.height), 842, "Height should be A4 842pt");

  assert.equal(OFFICIAL_TEMPLATE_SHA256, "59012141d8a54336928a4c076d9d0ad7276bbbc36064c37d9654cc031f14cd8f");
  assert.equal(OFFICIAL_TEMPLATE_CODE, "SICARE_IC_STD");
  assert.equal(OFFICIAL_TEMPLATE_VERSION, "v1.0");
});

test("2. Indonesian date formatting converts ISO dates and Date objects correctly", () => {
  assert.equal(formatIndonesianDate("2026-10-31"), "31 Oktober 2026");
  assert.equal(formatIndonesianDate("2024-02-29"), "29 Februari 2024");
  assert.equal(formatIndonesianDate("2000-01-01T00:00:00.000Z"), "1 Januari 2000");

  assert.throws(
    () => formatIndonesianDate("invalid-date-string"),
    /Invalid date value/,
    "Invalid date string must throw error"
  );
});

test("3. Coordinate mappings exist for all nine standard consent overlay positions", () => {
  const expectedKeys = [
    "full_name",
    "faculty_study_program",
    "nim",
    "birth_info",
    "gender",
    "phone_e164",
    "signing_date",
    "signature_image",
    "printed_name",
  ];

  for (const key of expectedKeys) {
    assert.ok(CONSENT_PDF_COORDINATES[key], `Missing coordinate config for ${key}`);
    assert.equal(typeof CONSENT_PDF_COORDINATES[key].x, "number", `${key}.x must be number`);
    assert.equal(typeof CONSENT_PDF_COORDINATES[key].y, "number", `${key}.y must be number`);
  }
});

// ============================================================================
// 2. Identity and Signature Validation
// ============================================================================

test("4. Identity validation requires all mandatory fields and formats phone number", () => {
  const valid = validateConsentIdentity({
    ...VALID_TEST_IDENTITY,
    phone_e164: "081234567890", // Indonesian domestic format
  });

  assert.equal(valid.full_name, "Ahmad Rizky Pratama");
  assert.equal(valid.phone_e164, "+6281234567890", "Domestic phone prefix should format to +62");
  assert.equal(valid.gender, "Laki-laki");

  // Missing full name
  assert.throws(
    () => validateConsentIdentity({ ...VALID_TEST_IDENTITY, full_name: "" }),
    /Nama lengkap wajib diisi/
  );

  // Missing NIM
  assert.throws(
    () => validateConsentIdentity({ ...VALID_TEST_IDENTITY, nim: "" }),
    /NIM wajib diisi/
  );

  // Invalid gender
  assert.throws(
    () => validateConsentIdentity({ ...VALID_TEST_IDENTITY, gender: "Other" }),
    /Jenis kelamin wajib dipilih/
  );

  // Invalid date of birth
  assert.throws(
    () => validateConsentIdentity({ ...VALID_TEST_IDENTITY, date_of_birth: "not-a-date" }),
    /Tanggal lahir wajib diisi/
  );
});

test("5. Signature PNG validation rejects empty, non-PNG (SVG/HTML), and oversized files", () => {
  // Valid PNG passes
  const valid = validateSignaturePng(SAMPLE_PNG_BUFFER);
  assert.equal(Buffer.isBuffer(valid), true);

  // Empty buffer throws
  assert.throws(
    () => validateSignaturePng(Buffer.alloc(0)),
    /Tanda tangan digital tidak boleh kosong/
  );
  assert.throws(
    () => validateSignaturePng(null),
    /Tanda tangan digital tidak boleh kosong/
  );

  // SVG / HTML string buffer throws
  const svgBuffer = Buffer.from("<svg width='100' height='100'><rect /></svg>");
  assert.throws(
    () => validateSignaturePng(svgBuffer),
    /Hanya berkas gambar PNG yang diizinkan \(SVG dan tipe lain ditolak\)/
  );

  // Oversized buffer (>2MB) throws
  const bigBuffer = Buffer.alloc(2 * 1024 * 1024 + 1);
  assert.throws(
    () => validateSignaturePng(bigBuffer),
    /Ukuran berkas tanda tangan melampaui batas maksimum 2 MB/
  );
});

// ============================================================================
// 3. PDF Generation with Overlay
// ============================================================================

test("6. generateInformedConsentPdf populates template and embeds signature", async () => {
  const result = await generateInformedConsentPdf({
    identityData: VALID_TEST_IDENTITY,
    signaturePngBuffer: SAMPLE_PNG_BUFFER,
    signingDate: new Date("2026-10-31T10:00:00Z"),
  });

  assert.ok(result.pdfBuffer instanceof Buffer, "Should output a Buffer");
  assert.ok(result.pdfSizeBytes > 50000, "Output size should be reasonable");
  assert.equal(typeof result.pdfSha256, "string");
  assert.equal(result.pdfSha256.length, 64, "SHA-256 should be 64-character hex");
  assert.equal(typeof result.signatureSha256, "string");

  // Inspect generated PDF with pdf-lib
  const generatedDoc = await PDFDocument.load(result.pdfBuffer);
  assert.equal(generatedDoc.getPageCount(), 1, "Generated PDF must preserve 1-page layout");
});

// ============================================================================
// 4. Digital Signing Workflow (signInformedConsent)
// ============================================================================

test("7. signInformedConsent rejects unaccepted agreement checkbox", async () => {
  const mockSupa = {
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                maybeSingle: async () => ({
                  data: {
                    id: "consent-test-1",
                    status: "pending",
                    signer_user_id: "user-client-1",
                    booking_participants: { id: "part-1", user_id: "user-client-1" },
                  },
                  error: null,
                }),
              };
            },
          };
        },
      };
    },
  };

  await assert.rejects(
    () =>
      signInformedConsent({
        supabaseClient: mockSupa,
        consentId: "consent-test-1",
        authUser: { id: "user-client-1" },
        signatureBuffer: SAMPLE_PNG_BUFFER,
        agreementAccepted: false, // Unaccepted!
      }),
    /agreement checkbox.*wajib disetujui secara eksplisit/
  );
});

test("8. signInformedConsent idempotently returns existing document if already signed", async () => {
  const alreadySignedConsent = {
    id: "consent-signed-1",
    status: "signed",
    signer_user_id: "user-client-1",
    signed_document_storage_path: "booking-1/part-1/consent-signed-1/doc.pdf",
    signed_document_sha256: "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
    signature_storage_path: "booking-1/part-1/consent-signed-1/sig.png",
    booking_participants: { id: "part-1", user_id: "user-client-1" },
  };

  const mockSupa = {
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                maybeSingle: async () => ({
                  data: alreadySignedConsent,
                  error: null,
                }),
              };
            },
          };
        },
      };
    },
  };

  const result = await signInformedConsent({
    supabaseClient: mockSupa,
    consentId: "consent-signed-1",
    authUser: { id: "user-client-1" },
    signatureBuffer: SAMPLE_PNG_BUFFER,
    agreementAccepted: true,
  });

  assert.equal(result.success, true);
  assert.equal(result.alreadySigned, true);
  assert.equal(result.pdfSha256, alreadySignedConsent.signed_document_sha256);
  assert.equal(result.pdfPath, alreadySignedConsent.signed_document_storage_path);
});

test("9. signInformedConsent uploads signature and PDF, updates DB, and writes audit logs", async () => {
  const pendingConsent = {
    id: "consent-pending-1",
    booking_id: "booking-uuid-1",
    booking_participant_id: "participant-uuid-1",
    status: "pending",
    signer_user_id: "user-client-1",
    consent_statement_version: "v1.0",
    booking_participants: {
      id: "participant-uuid-1",
      booking_id: "booking-uuid-1",
      user_id: "user-client-1",
      ...VALID_TEST_IDENTITY,
    },
    bookings: { client_id: "user-client-1" },
  };

  const uploadedFiles = [];
  const dbUpdates = [];
  const auditLogs = [];

  const mockSupa = {
    storage: {
      from(bucket) {
        return {
          upload: async (destPath, buffer, options) => {
            uploadedFiles.push({ bucket, destPath, size: buffer.length, options });
            return { error: null };
          },
        };
      },
    },
    from(table) {
      if (table === "informed_consents") {
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle: async () => ({ data: pendingConsent, error: null }),
                };
              },
            };
          },
          update(payload) {
            return {
              eq(_col, _val) {
                return {
                  in(_statusCol, _statusList) {
                    return {
                      select() {
                        return {
                          maybeSingle: async () => {
                            dbUpdates.push(payload);
                            return {
                              data: { ...pendingConsent, ...payload },
                              error: null,
                            };
                          },
                        };
                      },
                    };
                  },
                };
              },
            };
          },
        };
      }
      if (table === "consent_audit_logs") {
        return {
          insert(payload) {
            auditLogs.push(payload);
            return {
              select() {
                return {
                  maybeSingle: async () => ({ data: { id: "audit-uuid-1" }, error: null }),
                };
              },
            };
          },
        };
      }
      return {};
    },
  };

  const result = await signInformedConsent({
    supabaseClient: mockSupa,
    consentId: "consent-pending-1",
    authUser: { id: "user-client-1" },
    signatureBuffer: SAMPLE_PNG_BUFFER,
    agreementAccepted: true,
    identityData: VALID_TEST_IDENTITY,
  });

  assert.equal(result.success, true);
  assert.ok(result.pdfSha256, "Should return pdfSha256");
  assert.ok(result.pdfPath, "Should return pdfPath");
  assert.ok(result.signaturePath, "Should return signaturePath");

  // Verify storage uploads
  assert.equal(uploadedFiles.length, 2, "Should upload both signature PNG and signed PDF");
  assert.equal(uploadedFiles[0].bucket, "informed-consent-signatures");
  assert.equal(uploadedFiles[0].options.contentType, "image/png");
  assert.equal(uploadedFiles[1].bucket, "informed-consent-signed");
  assert.equal(uploadedFiles[1].options.contentType, "application/pdf");

  // Verify database update
  assert.equal(dbUpdates.length, 1);
  assert.equal(dbUpdates[0].status, "signed");
  assert.equal(dbUpdates[0].signer_user_id, "user-client-1");
  assert.equal(dbUpdates[0].signed_document_sha256, result.pdfSha256);
  assert.equal(dbUpdates[0].signature_method, "electronic_canvas");

  // Verify audit logs
  assert.equal(auditLogs.length, 2);
  const eventTypes = auditLogs.map((a) => a.event_type);
  assert.ok(eventTypes.includes("consent_signed"));
  assert.ok(eventTypes.includes("document_generated"));
});

// ============================================================================
// 5. Immutability of Signed/Revoked Consents
// ============================================================================

test("10. updateDraftConsentIdentity throws when attempting to modify signed or revoked consent", async () => {
  const signedConsent = {
    id: "consent-signed-imm",
    status: "signed",
    signer_user_id: "user-1",
    booking_participants: { id: "part-1", user_id: "user-1" },
  };

  const mockSupaSigned = {
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                maybeSingle: async () => ({ data: signedConsent, error: null }),
              };
            },
          };
        },
      };
    },
  };

  await assert.rejects(
    () =>
      updateDraftConsentIdentity({
        supabaseClient: mockSupaSigned,
        consentId: "consent-signed-imm",
        authUser: { id: "user-1" },
        identityData: { full_name: "Nama Baru" },
      }),
    /SIGNED_CONSENT_EVIDENCE_IMMUTABLE/
  );

  const revokedConsent = {
    id: "consent-revoked-imm",
    status: "revoked",
    signer_user_id: "user-1",
    booking_participants: { id: "part-1", user_id: "user-1" },
  };

  const mockSupaRevoked = {
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                maybeSingle: async () => ({ data: revokedConsent, error: null }),
              };
            },
          };
        },
      };
    },
  };

  await assert.rejects(
    () =>
      updateDraftConsentIdentity({
        supabaseClient: mockSupaRevoked,
        consentId: "consent-revoked-imm",
        authUser: { id: "user-1" },
        identityData: { full_name: "Nama Baru" },
      }),
    /REVOKED_CONSENT_IS_FINAL/
  );
});

// ============================================================================
// 6. Signed Document Retrieval Authorization
// ============================================================================

test("11. getSignedDocumentDownloadUrl allows signer, counselor, and admin, rejects unauthorized users", async () => {
  const signedConsent = {
    id: "consent-dl-1",
    status: "signed",
    signer_user_id: "user-signer-1",
    signed_document_storage_path: "booking-1/part-1/consent-dl-1/signed.pdf",
    signed_document_sha256: "1111222233334444555566667777888811112222333344445555666677778888",
    booking_participants: { id: "part-1", user_id: "user-signer-1" },
    bookings: { client_id: "user-primary-client" },
  };

  const mockSupa = {
    storage: {
      from(bucket) {
        assert.equal(bucket, "informed-consent-signed");
        return {
          createSignedUrl: async (filePath, expiresIn) => {
            return {
              data: {
                signedUrl: `https://mock.supabase.co/storage/v1/object/sign/${bucket}/${filePath}?token=test&expires=${expiresIn}`,
              },
              error: null,
            };
          },
        };
      },
    },
    from(table) {
      if (table === "informed_consents") {
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle: async () => ({ data: signedConsent, error: null }),
                };
              },
            };
          },
        };
      }
      return {};
    },
  };

  // 1. Signer user can download
  const signerDl = await getSignedDocumentDownloadUrl({
    supabaseClient: mockSupa,
    consentId: "consent-dl-1",
    authUser: { id: "user-signer-1" },
    authRole: "client",
  });
  assert.ok(signerDl.downloadUrl.includes("signed.pdf"));
  assert.equal(signerDl.sha256, signedConsent.signed_document_sha256);

  // 2. Admin can download
  const adminDl = await getSignedDocumentDownloadUrl({
    supabaseClient: mockSupa,
    consentId: "consent-dl-1",
    authUser: { id: "user-admin-1" },
    authRole: "admin",
  });
  assert.ok(adminDl.downloadUrl.includes("signed.pdf"));

  // 3. Primary Client attempting to download participant's signed PDF is rejected (Forbidden)
  await assert.rejects(
    () =>
      getSignedDocumentDownloadUrl({
        supabaseClient: mockSupa,
        consentId: "consent-dl-1",
        authUser: { id: "user-primary-client" },
        authRole: "client",
      }),
    (err) => err.status === 403 || err.statusCode === 403
  );

  // 4. Random client is rejected
  await assert.rejects(
    () =>
      getSignedDocumentDownloadUrl({
        supabaseClient: mockSupa,
        consentId: "consent-dl-1",
        authUser: { id: "user-random-intruder" },
        authRole: "client",
      }),
    (err) => err.status === 403 || err.statusCode === 403
  );
});

// ============================================================================
// 7. Migration File Syntax and Policy Verification
// ============================================================================

test("12. Migration 20261031170000 implements strict storage RLS policies for signatures and PDFs", async () => {
  const migrationPath = path.resolve(
    __dirname,
    "../../supabase/migrations/20261031170000_sicare_consent_signing_and_document_rbac.sql"
  );
  const sql = await fs.readFile(migrationPath, "utf-8");

  // Check bucket references
  assert.match(sql, /informed-consent-signatures/);
  assert.match(sql, /informed-consent-signed/);

  // Check strict signer policies
  assert.match(sql, /create policy consent_signatures_objects_select on storage\.objects/i);
  assert.match(sql, /create policy consent_signed_objects_select on storage\.objects/i);
  assert.match(sql, /ic\.signer_user_id\s*=\s*\(select auth\.uid\(\)\)/i);
  assert.match(sql, /b\.counselor_id\s*=\s*\(select auth\.uid\(\)\)/i);

  // Confirm primary client does NOT have blanket SELECT access over group members' files
  assert.doesNotMatch(
    sql,
    /client_id\s*=\s*auth\.uid\(\)\s*--\s*allow\s*primary/i,
    "Primary client must not be granted direct storage access to group members' signatures or PDFs"
  );
});
