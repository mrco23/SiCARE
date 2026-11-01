import assert from "node:assert/strict";
import { test, beforeEach } from "node:test";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  parseEncryptionKey,
  getEncryptionKey,
  getKeyByVersion,
  setEncryptionKeyRingForTests,
  resetEncryptionKeyRing,
  encryptInvitationToken,
  decryptInvitationToken,
  reencryptInvitationToken,
} from "../src/services/tokenEncryption.service.js";
import {
  createGuestCapabilityToken,
  verifyGuestCapabilityToken,
  validateGuestCapabilityState,
  claimGuestInvitation,
  assertConsentAccess,
} from "../src/services/consent.service.js";
import {
  scanPendingConsentsAndEnqueueReminders,
} from "../src/workers/whatsapp.scheduler.js";
import {
  processOutboxJob,
} from "../src/workers/whatsapp.worker.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MIGRATION_PATH = path.resolve(__dirname, "../../supabase/migrations/20261031180000_sicare_group_consent_workflow.sql");

// Sample 64-character hexadecimal keys (32 bytes)
const TEST_KEY_HEX_1 = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const TEST_KEY_HEX_2 = "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210";

// ============================================================================
// A. Dedicated Encryption Key Tests
// ============================================================================

test("A1. parseEncryptionKey accepts valid 32-byte key (64 hex or 32 raw utf8)", () => {
  const bufHex = parseEncryptionKey(TEST_KEY_HEX_1);
  assert.equal(bufHex.length, 32);

  const raw32 = "12345678901234567890123456789012"; // 32 bytes
  const bufRaw = parseEncryptionKey(raw32);
  assert.equal(bufRaw.length, 32);
});

test("A2. parseEncryptionKey rejects invalid or malformed keys", () => {
  assert.throws(() => parseEncryptionKey(""), /non-empty string/);
  assert.throws(() => parseEncryptionKey(null), /non-empty string/);
  assert.throws(() => parseEncryptionKey("too-short"), /must be exactly 32 bytes/);
  assert.throws(() => parseEncryptionKey("zzzz".repeat(16)), /must be exactly 32 bytes/); // not hex
});

test("A3. AES-256-GCM round trip encrypts and decrypts token with 12-byte IV and 16-byte tag", () => {
  const rawToken = "raw_invitation_token_1234567890abcdef1234567890";
  const encrypted = encryptInvitationToken(rawToken);

  assert.ok(encrypted.ciphertext, "Ciphertext must be present");
  assert.equal(encrypted.iv.length, 24, "IV must be 12 bytes (24 hex chars)");
  assert.equal(encrypted.tag.length, 32, "Tag must be 16 bytes (32 hex chars)");
  assert.equal(encrypted.keyVersion, "v1");

  const decrypted = decryptInvitationToken(encrypted);
  assert.equal(decrypted, rawToken, "Decrypted token must exactly match raw plaintext");
});

test("A4. Decryption rejects altered ciphertext", () => {
  const encrypted = encryptInvitationToken("secret_token_123");
  // Alter ciphertext
  const alteredCiphertext = encrypted.ciphertext.slice(0, -2) + (encrypted.ciphertext.endsWith("00") ? "11" : "00");

  assert.throws(
    () => decryptInvitationToken({ ...encrypted, ciphertext: alteredCiphertext }),
    /Gagal mendekripsi token undangan/
  );
});

test("A5. Decryption rejects altered authentication tag", () => {
  const encrypted = encryptInvitationToken("secret_token_123");
  // Alter auth tag
  const alteredTag = "00" + encrypted.tag.slice(2);

  assert.throws(
    () => decryptInvitationToken({ ...encrypted, tag: alteredTag }),
    /Gagal mendekripsi token undangan/
  );
});

test("A6. Decryption rejects wrong key", () => {
  setEncryptionKeyRingForTests({
    currentVersion: "v1",
    keys: { v1: TEST_KEY_HEX_1, v2: TEST_KEY_HEX_2 },
  });

  const encryptedWithKey1 = encryptInvitationToken("secret_token_123", "v1");

  // Attempting decrypt with v2 fails authentication
  assert.throws(
    () => decryptInvitationToken({ ...encryptedWithKey1, keyVersion: "v2" }),
    /Gagal mendekripsi token undangan/
  );

  resetEncryptionKeyRing();
});

test("A7. Key versioning preserves older keys during controlled rotation and re-encrypts safely", () => {
  // Setup key rotation: v1 (old), v2 (current)
  setEncryptionKeyRingForTests({
    currentVersion: "v2",
    keys: {
      v1: TEST_KEY_HEX_1,
      v2: TEST_KEY_HEX_2,
    },
  });

  const originalToken = "rotate_me_safely_1234567890";
  // Token encrypted under v1
  const v1Encrypted = encryptInvitationToken(originalToken, "v1");
  assert.equal(v1Encrypted.keyVersion, "v1");

  // Old key can still decrypt
  const decryptedUnderV1 = decryptInvitationToken(v1Encrypted);
  assert.equal(decryptedUnderV1, originalToken);

  // Re-encrypt under current version (v2)
  const v2Reencrypted = reencryptInvitationToken({
    ciphertext: v1Encrypted.ciphertext,
    iv: v1Encrypted.iv,
    tag: v1Encrypted.tag,
    keyVersion: "v1",
    targetKeyVersion: "v2",
  });

  assert.equal(v2Reencrypted.keyVersion, "v2");
  const decryptedUnderV2 = decryptInvitationToken(v2Reencrypted);
  assert.equal(decryptedUnderV2, originalToken);

  resetEncryptionKeyRing();
});

// ============================================================================
// B. Guest Capability Security Tests
// ============================================================================

test("B1. Valid capability token is created with standard claims and verified", () => {
  const token = createGuestCapabilityToken({
    consentId: "cons-101",
    participantId: "part-101",
    bookingId: "book-101",
    invitationId: "inv-101",
    expiresInSeconds: 3600,
  });

  const verified = verifyGuestCapabilityToken(token);
  assert.ok(verified, "Token must be valid");
  assert.equal(verified.sub, "part-101");
  assert.equal(verified.consentId, "cons-101");
  assert.equal(verified.participantId, "part-101");
  assert.equal(verified.bookingId, "book-101");
  assert.equal(verified.invitationId, "inv-101");
  assert.equal(verified.purpose, "consent_signing");
  assert.equal(verified.iss, "sicare-backend");
  assert.equal(verified.aud, "sicare-guest-signer");
  assert.ok(verified.jti, "JTI must be present");
});

test("B2. Expired capability token is rejected", () => {
  // Create token with -10 seconds expiry
  const expiredToken = createGuestCapabilityToken({
    consentId: "cons-101",
    participantId: "part-101",
    bookingId: "book-101",
    expiresInSeconds: -10,
  });

  const verified = verifyGuestCapabilityToken(expiredToken);
  assert.equal(verified, null, "Expired token must be rejected");
});

test("B3. Tampered capability token is rejected", () => {
  const token = createGuestCapabilityToken({
    consentId: "cons-101",
    participantId: "part-101",
    bookingId: "book-101",
  });

  const [payloadB64, sig] = token.split(".");
  // Tamper payload to escalate to another participant
  const parsed = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  parsed.participantId = "part-victim-999";
  const tamperedPayloadB64 = Buffer.from(JSON.stringify(parsed)).toString("base64url");
  const tamperedToken = `${tamperedPayloadB64}.${sig}`;

  const verified = verifyGuestCapabilityToken(tamperedToken);
  assert.equal(verified, null, "Tampered payload must fail cryptographic signature verification");
});

test("B4. Database-backed state validation rejects revoked invitation", async () => {
  const mockClient = {
    from(table) {
      if (table === "booking_participants") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { id: "part-1", booking_id: "book-1", participant_status: "active" },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      if (table === "bookings") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { id: "book-1", status: "confirmed" }, error: null }),
            }),
          }),
        };
      }
      if (table === "consent_invitations") {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () => ({
                  maybeSingle: async () => ({ data: { id: "inv-1", status: "revoked" }, error: null }),
                }),
              }),
            }),
          }),
        };
      }
      return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) };
    },
  };

  await assert.rejects(
    async () => {
      await validateGuestCapabilityState({
        guestCapability: { consentId: "c-1", participantId: "part-1", bookingId: "book-1" },
        supabaseClient: mockClient,
      });
    },
    /Undangan persetujuan telah dicabut/i,
    "Revoked invitation must fail database check"
  );
});

test("B5. Database-backed state validation rejects removed participant and cancelled booking", async () => {
  // Test 1: Removed participant
  const mockRemovedClient = {
    from(table) {
      if (table === "booking_participants") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { id: "part-1", booking_id: "book-1", participant_status: "removed" },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) };
    },
  };

  await assert.rejects(
    async () => {
      await validateGuestCapabilityState({
        guestCapability: { consentId: "c-1", participantId: "part-1", bookingId: "book-1" },
        supabaseClient: mockRemovedClient,
      });
    },
    /Peserta telah dihapus dari kelompok/i,
    "Removed participant must be rejected"
  );

  // Test 2: Cancelled booking
  const mockCancelledClient = {
    from(table) {
      if (table === "booking_participants") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { id: "part-1", booking_id: "book-1", participant_status: "active" },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      if (table === "bookings") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { id: "book-1", status: "cancelled" }, error: null }),
            }),
          }),
        };
      }
      return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) };
    },
  };

  await assert.rejects(
    async () => {
      await validateGuestCapabilityState({
        guestCapability: { consentId: "c-1", participantId: "part-1", bookingId: "book-1" },
        supabaseClient: mockCancelledClient,
      });
    },
    /Booking konseling telah dibatalkan/i,
    "Cancelled booking must reject guest capability session"
  );
});

test("B6. Guest isolation: Guest A cannot access Guest B's consent or signed document", () => {
  const consentB = {
    id: "cons-B",
    signer_user_id: "user-B",
    booking_participant_id: "part-B",
    bookings: { client_id: "client-primary-1" },
    booking_participants: { id: "part-B", user_id: "user-B" },
  };

  const guestA = { id: "part-A" };

  const access = assertConsentAccess({
    consent: consentB,
    authUser: guestA,
    authRole: "guest",
    bookingClientId: "client-primary-1",
  });

  assert.equal(access, false, "Guest A must not be granted access to Guest B's consent");
});

// ============================================================================
// C. Authenticated Account Linking Tests
// ============================================================================

test("C1. Correct authenticated participant can link their account matching verified phone", async () => {
  const rawToken = "link_test_tok_1234567890abcdef";
  const claimerUserId = "user-auth-123";
  const verifiedPhone = "+6281234567890";
  let participantUpdatedWithUser = false;

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
                      booking_participant_id: "part-1",
                      recipient_phone_e164: verifiedPhone,
                      status: "pending",
                      expires_at: new Date(Date.now() + 86400000).toISOString(),
                    },
                    error: null,
                  }),
                };
              },
            };
          },
          update() {
            return {
              eq() {
                return {
                  in: () => ({
                    select: () => ({
                      maybeSingle: async () => ({
                        data: {
                          id: "inv-1",
                          booking_participant_id: "part-1",
                          status: "claimed",
                          claimed_by_user_id: claimerUserId,
                        },
                        error: null,
                      }),
                    }),
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
                  maybeSingle: async () => ({
                    data: {
                      id: "part-1",
                      booking_id: "book-1",
                      phone_e164: verifiedPhone,
                      participant_status: "active",
                      informed_consents: [{ id: "cons-1", status: "pending" }],
                    },
                    error: null,
                  }),
                };
              },
            };
          },
          update(patch) {
            if (patch.user_id === claimerUserId) participantUpdatedWithUser = true;
            return { eq: async () => ({ data: null, error: null }) };
          },
        };
      }
      if (table === "informed_consents") {
        return {
          update: () => ({ eq: async () => ({ data: null, error: null }) }),
        };
      }
      if (table === "consent_audit_logs") {
        return {
          insert: () => ({ select: () => ({ maybeSingle: async () => ({ data: { id: "a1" } }) }) }),
        };
      }
      return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) };
    },
  };

  const result = await claimGuestInvitation({
    supabaseClient: mockClient,
    rawToken,
    claimerUserId,
    claimerProfile: {
      id: claimerUserId,
      full_name: "Mahasiswa Terotentikasi",
      identity_code: "210111001",
      phone_e164: verifiedPhone,
    },
  });

  assert.equal(result.success, true);
  assert.equal(participantUpdatedWithUser, true, "Participant record must be linked with verified user_id");
  assert.equal(result.linkedUserId, claimerUserId);
});

test("C2. Authenticated user with mismatched phone number is rejected from linking", async () => {
  const rawToken = "link_test_tok_mismatch_123456";
  const claimerUserId = "user-attacker-666";

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
                      booking_participant_id: "part-1",
                      recipient_phone_e164: "+6281234567890", // Participant's phone
                      status: "pending",
                      expires_at: new Date(Date.now() + 86400000).toISOString(),
                    },
                    error: null,
                  }),
                };
              },
            };
          },
        };
      }
      return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) };
    },
  };

  await assert.rejects(
    async () => {
      await claimGuestInvitation({
        supabaseClient: mockClient,
        rawToken,
        claimerUserId,
        claimerProfile: {
          id: claimerUserId,
          full_name: "Attacker User",
          identity_code: "999999999",
          phone_e164: "+6289999999999", // Different phone!
        },
      });
    },
    /ACCOUNT_PHONE_MISMATCH/i,
    "Mismatched phone number must be rejected from linking"
  );
});

// ============================================================================
// D. Consent Reminder Scheduler & Worker Tests
// ============================================================================

test("D1. scanPendingConsentsAndEnqueueReminders enqueues reminder for eligible unsigned participant", async () => {
  const now = Date.now();
  // Invitation created 26 hours ago (eligible for 24h interval 1)
  const createdAt26h = new Date(now - 26 * 3600 * 1000).toISOString();
  const expiresAt = new Date(now + 48 * 3600 * 1000).toISOString();

  const invitations = [
    {
      id: "inv-rem-1",
      booking_participant_id: "part-rem-1",
      consent_id: "cons-rem-1",
      recipient_phone_e164: "+6281234567890",
      status: "sent",
      created_at: createdAt26h,
      expires_at: expiresAt,
      booking_participants: {
        id: "part-rem-1",
        booking_id: "book-rem-1",
        display_name: "Participant Pending",
        full_name: "Participant Pending",
        phone_e164: "+6281234567890",
        participant_status: "active",
        bookings: {
          id: "book-rem-1",
          status: "confirmed",
          service_type: "group",
          client_id: "client-1",
          counselor_id: "counselor-1",
        },
        informed_consents: [{ id: "cons-rem-1", status: "pending" }],
      },
    },
  ];

  let enqueuedRow = null;
  const mockClient = {
    from(table) {
      if (table === "consent_invitations") {
        return {
          select() {
            return {
              in() {
                return {
                  gt: async () => ({ data: invitations, error: null }),
                };
              },
            };
          },
        };
      }
      if (table === "counselor_profiles") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { public_name: "Konselor SiCARE" }, error: null }),
            }),
          }),
        };
      }
      if (table === "whatsapp_outbox") {
        return {
          insert(row) {
            enqueuedRow = row;
            return { select: () => ({ maybeSingle: async () => ({ data: { id: "outbox-rem-1" }, error: null }) }) };
          },
        };
      }
      return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) };
    },
  };

  const result = await scanPendingConsentsAndEnqueueReminders({
    supabaseClient: mockClient,
    firstReminderHours: 24,
    secondReminderHours: 72,
    maxReminders: 2,
  });

  assert.equal(result.scannedInvitations, 1);
  assert.equal(result.enqueuedReminders, 1);
  assert.ok(enqueuedRow);
  assert.equal(enqueuedRow.message_type, "consent_reminder");
  assert.equal(enqueuedRow.idempotency_key, "invitation:inv-rem-1:consent_reminder:interval_1");
  assert.equal(enqueuedRow.payload.reminder_interval, 1);
});

test("D2. Signed participant is excluded from reminders", async () => {
  const now = Date.now();
  const createdAt26h = new Date(now - 26 * 3600 * 1000).toISOString();

  const invitations = [
    {
      id: "inv-signed",
      booking_participant_id: "part-signed",
      status: "sent",
      created_at: createdAt26h,
      expires_at: new Date(now + 48 * 3600 * 1000).toISOString(),
      booking_participants: {
        id: "part-signed",
        booking_id: "book-1",
        participant_status: "active",
        bookings: { id: "book-1", status: "confirmed" },
        informed_consents: [{ id: "cons-signed", status: "signed" }], // ALREADY SIGNED!
      },
    },
  ];

  const mockClient = {
    from(table) {
      if (table === "consent_invitations") {
        return {
          select: () => ({
            in: () => ({
              gt: async () => ({ data: invitations, error: null }),
            }),
          }),
        };
      }
      return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) };
    },
  };

  const result = await scanPendingConsentsAndEnqueueReminders({ supabaseClient: mockClient });
  assert.equal(result.enqueuedReminders, 0, "Signed participant must receive no reminders");
});

test("D3. Worker skips and cancels queued reminder if participant signs before dispatch", async () => {
  let outboxUpdatedToCancelled = false;

  const mockClient = {
    from(table) {
      if (table === "consent_invitations") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { id: "inv-1", status: "sent", expires_at: new Date(Date.now() + 86400000).toISOString() },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "informed_consents") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { id: "cons-1", status: "signed" }, // Signed between scheduling and worker execution!
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "booking_participants") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { id: "part-1", display_name: "Participant One", phone_e164: "+6281234567890", participant_status: "active" },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "whatsapp_outbox") {
        return {
          update(patch) {
            if (patch.status === "cancelled" && patch.last_error_code === "CONSENT_ALREADY_SIGNED") {
              outboxUpdatedToCancelled = true;
            }
            return { eq: async () => ({ data: null, error: null }) };
          },
        };
      }
      return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) };
    },
  };

  const job = {
    id: "job-rem-late",
    booking_id: "book-1",
    booking_participant_id: "part-1",
    recipient_user_id: null,
    message_type: "consent_reminder",
    phone_e164: "+6281234567890",
    attempt_count: 0,
    max_attempts: 5,
    payload: { invitation_id: "inv-1", booking_participant_id: "part-1" },
  };

  const result = await processOutboxJob({
    job,
    supabaseClient: mockClient,
    service: { sendMessage: async () => { throw new Error("Should not be called!"); } },
  });

  assert.equal(result.success, false);
  assert.equal(result.status, "cancelled");
  assert.equal(outboxUpdatedToCancelled, true, "Worker must cancel job when consent is already signed");
});

test("D4. Worker cancels queued reminder if booking is cancelled", async () => {
  let outboxUpdatedToCancelled = false;

  const mockClient = {
    from(table) {
      if (table === "consent_invitations") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { id: "inv-1", status: "sent", expires_at: new Date(Date.now() + 86400000).toISOString() },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "informed_consents") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { id: "cons-1", status: "pending" }, error: null }),
            }),
          }),
        };
      }
      if (table === "bookings") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { id: "book-1", status: "cancelled" }, error: null }),
            }),
          }),
        };
      }
      if (table === "booking_participants") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { id: "part-1", display_name: "Participant One", phone_e164: "+6281234567890", participant_status: "active" },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "whatsapp_outbox") {
        return {
          update(patch) {
            if (patch.status === "cancelled" && patch.last_error_code === "BOOKING_CANCELLED") {
              outboxUpdatedToCancelled = true;
            }
            return { eq: async () => ({ data: null, error: null }) };
          },
        };
      }
      return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) };
    },
  };

  const job = {
    id: "job-rem-cancelled",
    booking_id: "book-1",
    booking_participant_id: "part-1",
    recipient_user_id: null,
    message_type: "consent_reminder",
    phone_e164: "+6281234567890",
    attempt_count: 0,
    max_attempts: 5,
    payload: { invitation_id: "inv-1", booking_participant_id: "part-1", booking_id: "book-1" },
  };

  const result = await processOutboxJob({
    job,
    supabaseClient: mockClient,
    service: { sendMessage: async () => { throw new Error("Should not be called!"); } },
  });

  assert.equal(result.success, false);
  assert.equal(result.status, "cancelled");
  assert.equal(outboxUpdatedToCancelled, true, "Worker must cancel job when booking is cancelled");
});
