import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  decryptInvitationToken,
  encryptInvitationToken,
  getEncryptionKey,
} from "../src/services/tokenEncryption.service.js";
import {
  createGuestCapabilityToken,
  enqueueConsentInvitationWhatsApp,
  getGroupConsentSummary,
  initializeGroupConsentInvitations,
  resendConsentInvitation,
  signGuestInformedConsent,
  verifyGuestCapabilityToken,
} from "../src/services/consent.service.js";
import { renderWhatsAppTemplate, WHATSAPP_TEMPLATES } from "../src/templates/whatsapp/index.js";
import { callDomainRpc, DOMAIN_ERRORS } from "../src/lib/domainRpc.js";
import { processOutboxJob } from "../src/workers/whatsapp.worker.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MIGRATION_PATH = path.resolve(
  __dirname,
  "../../supabase/migrations/20261031180000_sicare_group_consent_workflow.sql"
);

// Sample transparent PNG base64 for digital signature
const SAMPLE_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const SAMPLE_PNG_BUFFER = Buffer.from(SAMPLE_PNG_BASE64, "base64");

// ============================================================================
// 1. Database Migration & Schema Verification
// ============================================================================

test("1. Group consent migration alters outbox, creates secrets table, and updates RPCs", async () => {
  const sql = await fs.readFile(MIGRATION_PATH, "utf8");

  // Outbox alterations
  assert.match(
    sql,
    /alter table public\.whatsapp_outbox\s+alter column recipient_user_id drop not null;/i,
    "whatsapp_outbox.recipient_user_id must be nullable for guest participants"
  );
  assert.match(
    sql,
    /add column if not exists booking_participant_id uuid\s+references public\.booking_participants\(id\)/i,
    "whatsapp_outbox must have booking_participant_id foreign key"
  );
  assert.match(
    sql,
    /'consent_invitation'/i,
    "whatsapp_outbox must allow consent_invitation message type"
  );
  assert.match(
    sql,
    /'consent_reminder'/i,
    "whatsapp_outbox must allow consent_reminder message type"
  );

  // Invitation secrets table
  assert.match(
    sql,
    /create table if not exists public\.consent_invitation_secrets/i,
    "consent_invitation_secrets table must exist"
  );
  assert.match(
    sql,
    /encrypted_token text not null/i,
    "encrypted_token column must exist"
  );
  assert.match(
    sql,
    /cleared_at timestamptz/i,
    "cleared_at column must exist"
  );
  assert.match(
    sql,
    /alter table public\.consent_invitation_secrets enable row level security;/i,
    "RLS must be enabled on consent_invitation_secrets"
  );

  // Domain functions
  assert.match(
    sql,
    /create or replace function public\.sicare_create_booking/i,
    "sicare_create_booking must be updated"
  );
  assert.match(
    sql,
    /item\.value\s*->>\s*'phone_e164'/i,
    "sicare_create_booking must extract phone_e164"
  );
  assert.match(
    sql,
    /create or replace function public\.sicare_transition_booking/i,
    "sicare_transition_booking must be updated"
  );
  assert.match(
    sql,
    /message_type in \('reminder_h1', 'reminder_day_of', 'consent_invitation', 'consent_reminder'\)/i,
    "sicare_transition_booking must cancel consent invitations on cancellation"
  );
  assert.match(
    sql,
    /create or replace function public\.sicare_transition_session/i,
    "sicare_transition_session must enforce consent readiness"
  );
  assert.match(
    sql,
    /CONSENT_READINESS_INCOMPLETE/i,
    "sicare_transition_session must raise CONSENT_READINESS_INCOMPLETE"
  );
});

// ============================================================================
// 2. AES-256-GCM Token Encryption Service
// ============================================================================

test("2. Token encryption key resolution and AES-256-GCM encrypt/decrypt lifecycle", () => {
  const key = getEncryptionKey();
  assert.ok(Buffer.isBuffer(key), "Key must be a Buffer");
  assert.equal(key.length, 32, "Key must be 32 bytes (256-bit)");

  const rawToken = "a1b2c3d4e5f678901234567890abcdef1234567890abcdef1234567890abcdef";
  const encrypted = encryptInvitationToken(rawToken);

  assert.equal(typeof encrypted, "object", "Encrypted token must be object");
  assert.equal(typeof encrypted.ciphertext, "string");
  assert.equal(typeof encrypted.iv, "string");
  assert.equal(typeof encrypted.tag, "string");
  assert.equal(Buffer.from(encrypted.iv, "hex").length, 12, "IV must be 12 bytes");
  assert.equal(Buffer.from(encrypted.tag, "hex").length, 16, "Auth tag must be 16 bytes");

  // Decrypt reproduces original token
  const decrypted = decryptInvitationToken(encrypted);
  assert.equal(decrypted, rawToken, "Decrypted token must exactly match raw token");

  // Tampered ciphertext throws error
  assert.throws(
    () => decryptInvitationToken({ ...encrypted, ciphertext: "badc194e" }),
    /Gagal mendekripsi token undangan|Unsupported state/i,
    "Tampered ciphertext must fail authentication"
  );

  // Tampered auth tag throws error
  const fakeAuthTag = Buffer.alloc(16, 0xaa).toString("hex");
  assert.throws(
    () => decryptInvitationToken({ ...encrypted, tag: fakeAuthTag }),
    /Gagal mendekripsi token undangan|Unsupported state/i,
    "Tampered auth tag must fail authentication"
  );
});

// ============================================================================
// 3. Stateless Guest Capability Token (HMAC-SHA256)
// ============================================================================

test("3. Stateless guest capability token generation, verification, and tamper detection", () => {
  const payload = {
    consentId: "11111111-1111-1111-1111-111111111111",
    participantId: "22222222-2222-2222-2222-222222222222",
    bookingId: "33333333-3333-3333-3333-333333333333",
  };

  const token = createGuestCapabilityToken({ ...payload, expiresInSeconds: 3600 });
  assert.ok(token.includes("."), "Token must contain body and signature separated by dot");

  const verified = verifyGuestCapabilityToken(token);
  assert.ok(verified, "Valid token must verify");
  assert.equal(verified.consentId, payload.consentId);
  assert.equal(verified.participantId, payload.participantId);
  assert.equal(verified.bookingId, payload.bookingId);
  assert.equal(verified.role, "guest_participant");

  // Tampered payload
  const [bodyB64, sigHex] = token.split(".");
  const decodedBody = JSON.parse(Buffer.from(bodyB64, "base64url").toString("utf8"));
  decodedBody.consentId = "99999999-9999-9999-9999-999999999999";
  const tamperedBodyB64 = Buffer.from(JSON.stringify(decodedBody)).toString("base64url");
  const tamperedToken = `${tamperedBodyB64}.${sigHex}`;
  assert.equal(verifyGuestCapabilityToken(tamperedToken), null, "Tampered payload must return null");

  // Expired token
  const expiredToken = createGuestCapabilityToken({ ...payload, expiresInSeconds: -10 });
  assert.equal(verifyGuestCapabilityToken(expiredToken), null, "Expired token must return null");
});

// ============================================================================
// 4. WhatsApp Consent Templates
// ============================================================================

test("4. WhatsApp templates for consent invitation and reminder compile and render properly", () => {
  assert.ok(WHATSAPP_TEMPLATES["consent-invitation"]);
  assert.ok(WHATSAPP_TEMPLATES["consent-reminder"]);

  const inviteVars = {
    recipient_name: "Siti Rahma",
    counselor_name: "Dr. Maria Grace",
    booking_id: "book-123",
    invitation_link: "https://sicare.example/consent/invite?token=secret123",
    expiration_hours: 48,
  };

  const renderedInvite = renderWhatsAppTemplate("consent_invitation", inviteVars);
  assert.match(renderedInvite, /Siti Rahma/);
  assert.match(renderedInvite, /https:\/\/sicare\.example\/consent\/invite\?token=secret123/);
  assert.match(renderedInvite, /Informed Consent/i);

  const reminderVars = {
    client_name: "Siti Rahma",
    counselor_name: "Dr. Maria Grace",
    session_date: "Senin, 2 November 2026",
    session_time: "10.00 WITA",
    invitation_link: "https://sicare.example/consent/invite?token=secret123",
  };

  const renderedReminder = renderWhatsAppTemplate("consent_reminder", reminderVars);
  assert.match(renderedReminder, /Pengingat/i);
  assert.match(renderedReminder, /https:\/\/sicare\.example\/consent\/invite\?token=secret123/);

  // Missing invitation link falls back to default link
  const renderedDefault = renderWhatsAppTemplate("consent_invitation", { client_name: "Budi" });
  assert.match(renderedDefault, /consent\/invite/);
});

// ============================================================================
// 5. Outbox Worker: Decrypting Secret and Link Construction Without Raw Storage
// ============================================================================

test("5. Outbox worker decrypts token in-memory and dispatches consent invitation without storing raw token", async () => {
  const rawToken = "tok_raw_test_1234567890abcdef1234567890abcdef1234567890abcdef1234";
  const enc = encryptInvitationToken(rawToken);

  let invitationUpdated = false;
  let secretCleared = false;
  let sentTarget = null;
  let sentMessage = null;

  const mockClient = {
    from(table) {
      if (table === "consent_invitations") {
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle: async () => ({
                    data: {
                      id: "inv-1",
                      status: "pending",
                      expires_at: new Date(Date.now() + 86400000).toISOString(),
                    },
                    error: null,
                  }),
                };
              },
            };
          },
          update(patch) {
            if (patch.status === "sent") invitationUpdated = true;
            const res = Promise.resolve({ data: null, error: null });
            res.in = () => Promise.resolve({ data: null, error: null });
            return {
              eq() {
                return res;
              },
            };
          },
        };
      }
      if (table === "consent_invitation_secrets") {
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle: async () => ({
                    data: {
                      id: "sec-1",
                      invitation_id: "inv-1",
                      encrypted_token: enc.ciphertext,
                      iv: enc.iv,
                      auth_tag: enc.tag,
                      key_version: enc.keyVersion,
                      cleared_at: null,
                    },
                    error: null,
                  }),
                };
              },
            };
          },
          update(patch) {
            if (patch.cleared_at) secretCleared = true;
            return {
              eq: async () => ({ data: null, error: null }),
            };
          },
        };
      }
      if (table === "booking_participants") {
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle: async () => ({
                    data: {
                      id: "part-1",
                      display_name: "Budi Santoso",
                      phone_e164: "+6281234567890",
                      participant_status: "active",
                    },
                    error: null,
                  }),
                };
              },
            };
          },
        };
      }
      if (table === "whatsapp_outbox") {
        return {
          update() {
            return { eq: async () => ({ data: null, error: null }) };
          },
        };
      }
      return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }),
      };
    },
  };

  const mockFonnteService = {
    async sendMessage(params) {
      sentTarget = params.target;
      sentMessage = params.message;
      return {
        success: true,
        providerMessageId: "FONNTE-INV-001",
        providerProcess: "processing",
      };
    },
  };

  const job = {
    id: "job-inv-1",
    booking_id: "book-1",
    booking_participant_id: "part-1",
    recipient_user_id: null, // Guest participant!
    message_type: "consent_invitation",
    phone_e164: "+6281234567890",
    attempt_count: 0,
    max_attempts: 5,
    payload: {
      invitation_id: "inv-1",
      participant_id: "part-1",
      client_name: "Budi Santoso",
      counselor_name: "Konselor SiCARE",
      booking_id: "book-1",
      expiration_hours: 48,
    },
  };

  const result = await processOutboxJob({
    job,
    supabaseClient: mockClient,
    service: mockFonnteService,
  });

  assert.equal(result.success, true);
  assert.equal(invitationUpdated, true, "Invitation status must be marked as sent");
  assert.equal(secretCleared, true, "Secret cleared_at must be updated");
  assert.equal(sentTarget, "6281234567890");
  assert.match(
    sentMessage,
    /consent\/invite\?token=tok_raw_test_1234567890abcdef/,
    "Dispatched message must contain the constructed invitation link"
  );
  // Ensure raw token was not written to outbox payload
  assert.equal("token" in job.payload, false, "Raw token must not be in outbox payload");
  assert.equal("raw_token" in job.payload, false, "Raw token must not be in outbox payload");
});

// ============================================================================
// 6. Privacy-Respecting Group Consent Summary
// ============================================================================

test("6. Group consent summary enforces privacy and prevents data leakage across members", async () => {
  const bookingId = "book-group-1";
  const primaryClientId = "client-primary-1";
  const otherClientId = "client-other-2";

  const participants = [
    {
      id: "part-1",
      display_name: "Primary Client",
      full_name: "Primary Client Full",
      is_primary: true,
      participant_status: "active",
      informed_consents: [
        {
          id: "consent-1",
          status: "signed",
          signed_at: "2026-10-31T10:00:00.000Z",
          consent_statement_version: "v1.0",
        },
      ],
      consent_invitations: [],
    },
    {
      id: "part-2",
      display_name: "Member B",
      full_name: "Member B Private Name",
      is_primary: false,
      participant_status: "active",
      informed_consents: [
        {
          id: "consent-2",
          status: "pending",
          signed_at: null,
          consent_statement_version: "v1.0",
        },
      ],
      consent_invitations: [
        {
          id: "inv-2",
          status: "sent",
          created_at: "2026-10-31T09:00:00.000Z",
        },
      ],
    },
  ];

  const mockClient = {
    from(table) {
      if (table === "bookings") {
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle: async () => ({
                    data: {
                      id: bookingId,
                      client_id: primaryClientId,
                      counselor_id: "counselor-1",
                      service_type: "group",
                      group_name: "Kelompok Belajar",
                      participant_count: 2,
                      status: "confirmed",
                    },
                    error: null,
                  }),
                };
              },
            };
          },
        };
      }
      if (table === "booking_participants") {
        return {
          select() {
            return {
              eq: async () => ({ data: participants, error: null }),
            };
          },
        };
      }
      return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) };
    },
  };

  // Primary Client authorized access
  const summary = await getGroupConsentSummary({
    supabaseClient: mockClient,
    bookingId,
    authUser: { id: primaryClientId },
    authRole: "client",
  });

  assert.equal(summary.booking_id, bookingId);
  assert.equal(summary.service_type, "group");
  assert.equal(summary.total_participants, 2);
  assert.equal(summary.signed_count, 1);
  assert.equal(summary.pending_count, 1);
  assert.equal(summary.ready_for_session, false);
  assert.equal(summary.participants.length, 2);

  const memberSummary = summary.participants.find((p) => p.participant_id === "part-2");
  assert.equal(memberSummary.display_name, "Member B");
  assert.equal(memberSummary.consent_status, "pending");
  assert.equal(memberSummary.invitation_status, "sent");

  // STRICT PRIVACY: ensure clinical / sensitive fields are NOT in the participant summary
  assert.equal("nim" in memberSummary, false, "NIM must not be disclosed in group summary");
  assert.equal("birthplace" in memberSummary, false, "Birthplace must not be disclosed");
  assert.equal("date_of_birth" in memberSummary, false, "Date of birth must not be disclosed");
  assert.equal("signature_storage_path" in memberSummary, false, "Signature path must not be disclosed");
  assert.equal("signed_document_storage_path" in memberSummary, false, "Signed document path must not be disclosed");

  // Unauthorized client access rejected
  await assert.rejects(
    async () => {
      await getGroupConsentSummary({
        supabaseClient: mockClient,
        bookingId,
        authUser: { id: otherClientId },
        authRole: "client",
      });
    },
    /Anda tidak memiliki izin/,
    "Access to other booking group summary must be rejected with 403"
  );
});

// ============================================================================
// 7. Resend Invitation Workflow
// ============================================================================

test("7. Resending invitation revokes old invitation, cancels outbox, and enqueues fresh invite", async () => {
  const bookingId = "book-resend-1";
  const participantId = "part-resend-2";
  const clientId = "client-primary-1";

  let invitationRevoked = false;
  let outboxCancelled = false;
  let secretCreated = false;
  let outboxInserted = false;

  const mockClient = {
    from(table) {
      if (table === "bookings") {
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle: async () => ({
                    data: {
                      id: bookingId,
                      client_id: clientId,
                      counselor_id: "counselor-1",
                      service_type: "group",
                      status: "confirmed",
                    },
                    error: null,
                  }),
                };
              },
            };
          },
        };
      }
      if (table === "booking_participants") {
        return {
          select() {
            return {
              eq() {
                return {
                  eq() {
                    return {
                      maybeSingle: async () => ({
                        data: {
                          id: participantId,
                          booking_id: bookingId,
                          display_name: "Participant Two",
                          phone_e164: "+6281987654321",
                          participant_status: "active",
                          informed_consents: [{ id: "cons-2", status: "pending" }],
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
      }
      if (table === "consent_invitations") {
        return {
          update(patch) {
            if (patch.status === "revoked") invitationRevoked = true;
            return {
              eq() {
                return { in: async () => ({ data: null, error: null }) };
              },
            };
          },
          insert() {
            return {
              select() {
                const ret = async () => ({
                  data: {
                    id: "new-inv-99",
                    status: "pending",
                    expires_at: new Date(Date.now() + 86400000).toISOString(),
                  },
                  error: null,
                });
                return {
                  single: ret,
                  maybeSingle: ret,
                };
              },
            };
          },
        };
      }
      if (table === "consent_invitation_secrets") {
        return {
          insert(row) {
            if (row.encrypted_token) secretCreated = true;
            return { select: () => ({ single: async () => ({ data: { id: "sec-99" }, error: null }) }) };
          },
        };
      }
      if (table === "whatsapp_outbox") {
        return {
          update(patch) {
            if (patch.status === "cancelled") outboxCancelled = true;
            return {
              eq() {
                return {
                  eq() {
                    return {
                      in() {
                        return { in: async () => ({ data: null, error: null }) };
                      },
                    };
                  },
                };
              },
            };
          },
          insert() {
            outboxInserted = true;
            return {
              select: () => ({
                maybeSingle: async () => ({ data: { id: "outbox-new" }, error: null }),
                single: async () => ({ data: { id: "outbox-new" }, error: null }),
              }),
            };
          },
        };
      }
      if (table === "consent_templates") {
        return {
          select() {
            return {
              eq() {
                return {
                  eq() {
                    return {
                      maybeSingle: async () => ({
                        data: { id: "tmpl-1", template_code: "SICARE_IC_STD", version: "v1.0", is_active: true },
                        error: null,
                      }),
                    };
                  },
                };
              },
            };
          },
        };
      }
      if (table === "informed_consents") {
        return {
          select() {
            return {
              eq() {
                return {
                  eq() {
                    return {
                      in() {
                        return {
                          maybeSingle: async () => ({
                            data: { id: "cons-2", status: "pending" },
                            error: null,
                          }),
                        };
                      },
                      maybeSingle: async () => ({
                        data: { id: "cons-2", status: "pending" },
                        error: null,
                      }),
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
          insert() {
            return {
              select() {
                return {
                  maybeSingle: async () => ({ data: { id: "audit-1" }, error: null }),
                  single: async () => ({ data: { id: "audit-1" }, error: null }),
                };
              },
            };
          },
        };
      }
      return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) };
    },
  };

  const result = await resendConsentInvitation({
    supabaseClient: mockClient,
    bookingId,
    participantId,
    authUser: { id: clientId },
    authRole: "client",
  });

  assert.equal(result.success, true);
  assert.equal(invitationRevoked, true, "Previous invitation must be marked as revoked");
  assert.equal(outboxCancelled, true, "Previous outbox messages must be marked as cancelled");
  assert.equal(secretCreated, true, "New encrypted token secret must be created");
  assert.equal(outboxInserted, true, "New WhatsApp outbox message must be enqueued");
});

// ============================================================================
// 8. Session Transition Blocking for Incomplete Consent
// ============================================================================

test("8. Domain RPC maps CONSENT_READINESS_INCOMPLETE to HTTP 409 conflict", () => {
  assert.ok(DOMAIN_ERRORS["CONSENT_READINESS_INCOMPLETE"]);
  const [status, code, message] = DOMAIN_ERRORS["CONSENT_READINESS_INCOMPLETE"];

  assert.equal(status, 409, "Must return HTTP 409 Conflict");
  assert.equal(code, "CONSENT_READINESS_INCOMPLETE");
  assert.match(message, /informed consent belum dilengkapi oleh seluruh peserta/i);
});

test("9. Booking cancellation cleans up pending invitations and outbox reminders", async () => {
  const sql = await fs.readFile(MIGRATION_PATH, "utf8");

  // Ensure cancellation section in sicare_transition_booking
  assert.match(
    sql,
    /where booking_id = v_booking\.id\s+and message_type in \('reminder_h1', 'reminder_day_of', 'consent_invitation', 'consent_reminder'\)/i,
    "Cancellation must update reminder and consent messages to cancelled"
  );
  assert.match(
    sql,
    /update public\.consent_invitations\s+set status = 'revoked'/i,
    "Cancellation must revoke consent invitations"
  );
});

// ============================================================================
// 10. Guest Participant Identity, Signing, and Individual PDF Generation
// ============================================================================

test("10. Guest participant updates identity and signs consent with independent PDF generation", async () => {
  const consentId = "cons-guest-100";
  const participantId = "part-guest-200";
  const bookingId = "book-group-300";

  let updatedIdentitySnapshot = null;
  let uploadCalled = false;
  let finalStatusUpdated = false;

  const mockClient = {
    from(table) {
      if (table === "informed_consents") {
        return {
          select() {
            return {
              eq(col1, val1) {
                return {
                  maybeSingle: async () => ({
                    data: {
                      id: consentId,
                      booking_id: bookingId,
                      booking_participant_id: participantId,
                      consent_template_id: "tmpl-1",
                      status: "pending",
                      identity_snapshot: {
                        full_name: "Guest Participant",
                        faculty: "Teknik",
                        study_program: "Informatika",
                        nim: "210111999",
                        birthplace: "Manado",
                        date_of_birth: "2003-05-15",
                        gender: "Perempuan",
                        phone_e164: "+6281234567890",
                      },
                      booking_participants: {
                        id: participantId,
                        display_name: "Guest Participant",
                        full_name: "Guest Participant",
                        phone_e164: "+6281234567890",
                        user_id: null, // Guest!
                        is_primary: false,
                        participant_status: "active",
                      },
                      consent_templates: {
                        id: "tmpl-1",
                        template_code: "SICARE_IC_STD",
                        version: "v1.0",
                        file_sha256: "59012141d8a54336928a4c076d9d0ad7276bbbc36064c37d9654cc031f14cd8f",
                      },
                      bookings: {
                        id: bookingId,
                        service_type: "group",
                        status: "confirmed",
                      },
                    },
                    error: null,
                  }),
                };
              },
            };
          },
          update(patch) {
            if (patch.identity_snapshot) updatedIdentitySnapshot = patch.identity_snapshot;
            if (patch.status === "signed") finalStatusUpdated = true;
            const returnData = async () => ({
              data: {
                id: consentId,
                status: patch.status || "pending",
                identity_snapshot: updatedIdentitySnapshot,
                signed_at: patch.signed_at,
                signed_document_storage_path: patch.signed_document_storage_path,
                signed_document_sha256: patch.signed_document_sha256,
              },
              error: null,
            });
            const chain = {
              eq: () => chain,
              in: () => chain,
              select: () => chain,
              single: returnData,
              maybeSingle: returnData,
            };
            return chain;
          },
        };
      }
      if (table === "consent_invitations") {
        return {
          update() {
            const chain = {
              eq: () => chain,
              in: async () => ({ data: null, error: null }),
            };
            return chain;
          },
        };
      }
      if (table === "consent_audit_logs") {
        return {
          insert() {
            return {
              select: () => ({
                maybeSingle: async () => ({ data: { id: "audit-1" }, error: null }),
                single: async () => ({ data: { id: "audit-1" }, error: null }),
              }),
            };
          },
        };
      }
      return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) };
    },
    storage: {
      from(bucket) {
        return {
          upload: async (storagePath, fileBuffer) => {
            uploadCalled = true;
            assert.ok(fileBuffer.length > 0, "Uploaded file must not be empty");
            return { data: { path: storagePath }, error: null };
          },
        };
      },
    },
  };

  const guestCapability = {
    consentId,
    participantId,
    bookingId,
    role: "guest_participant",
  };

  const signResult = await signGuestInformedConsent({
    supabaseClient: mockClient,
    guestCapability,
    signatureBuffer: SAMPLE_PNG_BUFFER,
    agreementAccepted: true,
    identityData: {
      full_name: "Guest Participant",
      faculty: "Teknik",
      study_program: "Informatika",
      nim: "210111999",
      birthplace: "Manado",
      date_of_birth: "2003-05-15",
      gender: "Perempuan",
      phone_e164: "+6281234567890",
    },
  });

  assert.equal(signResult.success, true);
  assert.equal(uploadCalled, true, "Signature and PDF must be uploaded to storage");
  assert.equal(finalStatusUpdated, true, "Consent record must be transitioned to signed");
  assert.ok(signResult.pdfSha256, "Individual signed PDF must have SHA-256 integrity hash");
  assert.match(signResult.pdfPath, new RegExp(consentId), "PDF storage path must be isolated per consent record");
});

// ============================================================================
// 11. Backend Session Transition Enforcement (SQL RPC Level)
// ============================================================================

test("11. Session transition blocking is enforced in PostgreSQL transition function", async () => {
  const sql = await fs.readFile(MIGRATION_PATH, "utf8");

  // Check sicare_transition_session definition
  assert.match(
    sql,
    /if p_target_status = 'ongoing' then/i,
    "Readiness check must execute during scheduled -> ongoing transition"
  );
  assert.match(
    sql,
    /from public\.sicare_check_booking_consent_readiness\(v_session\.booking_id\)/i,
    "sicare_transition_session must call sicare_check_booking_consent_readiness"
  );
  assert.match(
    sql,
    /if not coalesce\(v_readiness\.is_fully_consented, false\) then\s+raise exception using errcode = 'P0001', message = 'CONSENT_READINESS_INCOMPLETE';/i,
    "Incomplete consent must raise CONSENT_READINESS_INCOMPLETE exception at database level"
  );
});
