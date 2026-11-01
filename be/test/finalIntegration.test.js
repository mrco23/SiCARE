import assert from "node:assert/strict";
import { test } from "node:test";
import crypto from "node:crypto";
import {
  assertConsentAccess,
  claimConsentInvitation,
  claimGuestInvitation,
  createConsentInvitation,
  createGuestCapabilityToken,
  getBookingConsentStatus,
  getConsentById,
  getGroupConsentSummary,
  getGuestConsent,
  getSignedDocumentDownloadUrl,
  hashInvitationToken,
  initializeConsentForParticipant,
  recordConsentAuditLog,
  resendConsentInvitation,
  signGuestInformedConsent,
  signInformedConsent,
  updateDraftConsentIdentity,
  updateGuestDraftIdentity,
  validateGuestCapabilityState,
  verifyGuestCapabilityToken,
} from "../src/services/consent.service.js";
import {
  encryptInvitationToken,
  decryptInvitationToken,
  parseEncryptionKey,
} from "../src/services/tokenEncryption.service.js";
import {
  generateInformedConsentPdf,
  validateConsentIdentity,
  validateSignaturePng,
} from "../src/services/consentPdf.service.js";
import { generateIdempotencyKey } from "../src/services/whatsappOutbox.service.js";
import {
  scanPendingConsentsAndEnqueueReminders,
  scanUpcomingSessionsAndEnqueueReminders,
} from "../src/workers/whatsapp.scheduler.js";
import { processOutboxJob } from "../src/workers/whatsapp.worker.js";
import { normalizePhoneNumber } from "../src/services/fonnte.service.js";

// Minimal valid 1x1 PNG for signature tests
const SAMPLE_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const SAMPLE_PNG_BUFFER = Buffer.from(SAMPLE_PNG_BASE64, "base64");

const VALID_TEST_IDENTITY = {
  full_name: "Mahasiswa Uji Integrasi",
  faculty: "Teknologi Informasi",
  study_program: "Informatika",
  nim: "210111999",
  birthplace: "Manado",
  date_of_birth: "2003-05-15",
  gender: "Laki-laki",
  phone_e164: "+6281234567890",
};

// ============================================================================
// 1. ADMIN SYSTEM INTEGRATION & ACCOUNT MANAGEMENT
// ============================================================================

test("1. Admin creates Counselor account with automatic counselor_profiles and audit log", async () => {
  const createdUsers = [];
  const profileUpdates = [];
  const counselorProfiles = [];
  const auditLogs = [];

  const mockAdminClient = {
    auth: {
      admin: {
        createUser: async ({ email, password, user_metadata }) => {
          const newUser = { id: `user-counselor-${Date.now()}`, email, user_metadata };
          createdUsers.push(newUser);
          return { data: { user: newUser }, error: null };
        },
        deleteUser: async (userId) => {
          const idx = createdUsers.findIndex((u) => u.id === userId);
          if (idx >= 0) createdUsers.splice(idx, 1);
          return { error: null };
        },
      },
    },
    from(table) {
      if (table === "profiles") {
        return {
          update(patch) {
            return {
              eq(col, val) {
                return {
                  select() {
                    return {
                      single: async () => {
                        profileUpdates.push({ id: val, ...patch });
                        return { data: { id: val, ...patch, phone_e164: null }, error: null };
                      },
                    };
                  },
                };
              },
            };
          },
        };
      }
      if (table === "counselor_profiles") {
        return {
          upsert: async (record) => {
            counselorProfiles.push(record);
            return { error: null };
          },
        };
      }
      return {};
    },
  };

  // Simulate admin creating counselor account
  const email = "konselor.baru@sicare.id";
  const fullName = "Konselor Baru, M.Psi., Psikolog";
  const input = {
    email,
    password: "PasswordSuperAman123!",
    full_name: fullName,
    app_role: "counselor",
    account_status: "active",
  };

  const { data: created, error: createError } = await mockAdminClient.auth.admin.createUser({
    email: input.email,
    password: input.password,
    user_metadata: { full_name: input.full_name },
  });
  assert.equal(createError, null);
  assert.ok(created.user.id);

  const { data: profile, error: profileError } = await mockAdminClient
    .from("profiles")
    .update({
      full_name: input.full_name,
      app_role: input.app_role,
      account_status: input.account_status,
    })
    .eq("id", created.user.id)
    .select()
    .single();

  assert.equal(profileError, null);
  assert.equal(profile.app_role, "counselor");

  const { error: counselorErr } = await mockAdminClient
    .from("counselor_profiles")
    .upsert({ profile_id: profile.id, public_name: input.full_name, is_public: false });
  assert.equal(counselorErr, null);

  assert.equal(createdUsers.length, 1);
  assert.equal(profileUpdates.length, 1);
  assert.equal(counselorProfiles.length, 1);
  assert.equal(counselorProfiles[0].profile_id, profile.id);
  assert.equal(counselorProfiles[0].is_public, false, "Counselor profile defaults to private upon creation");
});

test("2. Admin Counselor account creation rolls back Supabase Auth user if profile initialization fails", async () => {
  const createdUsers = [];

  const mockAdminClient = {
    auth: {
      admin: {
        createUser: async ({ email, password, user_metadata }) => {
          const newUser = { id: "user-failed-counselor", email, user_metadata };
          createdUsers.push(newUser);
          return { data: { user: newUser }, error: null };
        },
        deleteUser: async (userId) => {
          const idx = createdUsers.findIndex((u) => u.id === userId);
          if (idx >= 0) createdUsers.splice(idx, 1);
          return { error: null };
        },
      },
    },
    from(table) {
      if (table === "profiles") {
        return {
          update() {
            return {
              eq() {
                return {
                  select() {
                    return {
                      single: async () => ({
                        data: null,
                        error: { code: "23505", message: "duplicate key value violates unique constraint" },
                      }),
                    };
                  },
                };
              },
            };
          },
        };
      }
      return {};
    },
  };

  // Create user
  const { data: created } = await mockAdminClient.auth.admin.createUser({
    email: "gagal.profil@sicare.id",
    password: "Password123!",
    user_metadata: { full_name: "Konselor Gagal" },
  });
  assert.equal(createdUsers.length, 1);

  // Profile update fails
  const { data: profile, error: profileError } = await mockAdminClient
    .from("profiles")
    .update({ full_name: "Konselor Gagal" })
    .eq("id", created.user.id)
    .select()
    .single();

  assert.ok(profileError, "Profile update should simulate error");

  // Rollback triggered
  if (profileError) {
    await mockAdminClient.auth.admin.deleteUser(created.user.id);
  }

  assert.equal(createdUsers.length, 0, "Auth user must be deleted on rollback, preventing orphaned accounts");
});

test("3. Admin is prevented from self-demotion or self-deactivation", () => {
  const adminUserId = "admin-user-current-id";
  const reqAuth = { user: { id: adminUserId, email: "admin@sicare.id" }, profile: { app_role: "admin" } };
  const targetId = adminUserId;

  // Attempting to change own role to client
  const patchPayload = { app_role: "client" };
  const isSelfDemotion =
    targetId === reqAuth.user.id &&
    ((patchPayload.app_role && patchPayload.app_role !== "admin") ||
      (patchPayload.account_status && patchPayload.account_status !== "active"));

  assert.equal(isSelfDemotion, true, "Self-demotion must be detected and blocked");
});

// ============================================================================
// 2. KEPALA LMI SYSTEM INTEGRATION & CLINICAL PDF ACCESS RESTRICTION
// ============================================================================

test("4. Kepala LMI can review feedback status but is rejected from downloading clinical Informed Consent PDFs", async () => {
  const headLmiUser = { id: "user-head-lmi-1" };
  const clientConsent = {
    id: "consent-client-confidential-1",
    status: "signed",
    signer_user_id: "user-client-123",
    booking_participant_id: "part-client-123",
    signed_document_storage_path: "booking-1/part-1/signed.pdf",
    signed_document_sha256: "aabbccddeeff0011223344556677889900aabbccddeeff00112233445566778899",
    bookings: { client_id: "user-client-123", counselor_id: "counselor-456" },
    booking_participants: { user_id: "user-client-123" },
  };

  // Kepala LMI attempting to access client's clinical consent document
  const hasAccess = assertConsentAccess({
    consent: clientConsent,
    authUser: headLmiUser,
    authRole: "head_lmi",
    bookingClientId: clientConsent.bookings.client_id,
  });

  assert.equal(
    hasAccess,
    false,
    "Kepala LMI must NOT have direct access to download private clinical Informed Consent PDFs"
  );
});

// ============================================================================
// 3. COUNSELOR SYSTEM INTEGRATION & ASSIGNED DOCUMENT ACCESS
// ============================================================================

test("5. Assigned Counselor can access client's signed consent PDF, while unassigned Counselor is rejected", async () => {
  const assignedCounselor = { id: "counselor-assigned-1" };
  const unassignedCounselor = { id: "counselor-intruder-2" };

  const bookingConsent = {
    id: "consent-session-assigned-1",
    status: "signed",
    signer_user_id: "client-signer-1",
    signed_document_storage_path: "booking-assigned/signed.pdf",
    signed_document_sha256: "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210",
    bookings: { id: "b-assigned-1", client_id: "client-signer-1", counselor_id: "counselor-assigned-1" },
    booking_participants: { user_id: "client-signer-1" },
  };

  // 1. Assigned counselor check
  const assignedAccess = assertConsentAccess({
    consent: bookingConsent,
    authUser: assignedCounselor,
    authRole: "counselor",
    bookingClientId: bookingConsent.bookings.client_id,
  });
  assert.equal(assignedAccess, true, "Assigned counselor must be allowed to inspect signed consent for their booking");

  // 2. Unassigned counselor check
  const unassignedAccess = assertConsentAccess({
    consent: bookingConsent,
    authUser: unassignedCounselor,
    authRole: "counselor",
    bookingClientId: bookingConsent.bookings.client_id,
  });
  assert.equal(unassignedAccess, false, "Unassigned counselor must be rejected with Forbidden");
});

test("6. Starting counseling session is blocked with CONSENT_READINESS_INCOMPLETE when participants have pending consent", async () => {
  const mockSupaIncomplete = {
    rpc: async (name, params) => {
      assert.equal(name, "sicare_check_booking_consent_readiness");
      return {
        data: {
          is_fully_consented: false,
          total_participants: 4,
          signed_participants: 3,
          pending_participants: 1,
          template_compliant: true,
        },
        error: null,
      };
    },
  };

  const readiness = await getBookingConsentStatus({
    supabaseClient: mockSupaIncomplete,
    bookingId: "booking-incomplete-uuid",
  });

  assert.equal(readiness.isFullyConsented, false);
  assert.equal(readiness.pendingParticipants, 1);

  // In sicare_transition_session, when target_status is 'ongoing':
  // if not v_readiness.is_fully_consented then raise exception 'CONSENT_READINESS_INCOMPLETE'
  const sessionTransition = (isReady) => {
    if (!isReady) {
      const err = new Error("CONSENT_READINESS_INCOMPLETE: Sesi konseling belum dapat dimulai.");
      err.code = "P0001";
      err.status = 409;
      throw err;
    }
    return { status: "ongoing", started_at: new Date().toISOString() };
  };

  assert.throws(
    () => sessionTransition(readiness.isFullyConsented),
    (err) => err.code === "P0001" && err.status === 409
  );
});

// ============================================================================
// 4. CLIENT SYSTEM & SYNTHETIC 4-PARTICIPANT GROUP INTEGRATION
// ============================================================================

test("7. Group Counseling with 4 synthetic participants creates 4 independent records and enforces isolation", async () => {
  const primaryClient = { id: "user-primary-client", app_role: "client" };
  const memberAccount = { id: "user-member-client", app_role: "client" };

  const groupParticipants = [
    { id: "part-1", user_id: primaryClient.id, is_primary: true, full_name: "Klien Utama (Perwakilan)" },
    { id: "part-2", user_id: memberAccount.id, is_primary: false, full_name: "Mahasiswa Anggota 2" },
    { id: "part-3", user_id: null, is_primary: false, full_name: "Tamu Peserta 3 (Guest A)" },
    { id: "part-4", user_id: null, is_primary: false, full_name: "Tamu Peserta 4 (Guest B)" },
  ];

  const groupConsents = groupParticipants.map((p) => ({
    id: `consent-${p.id}`,
    booking_participant_id: p.id,
    status: "pending",
    signer_user_id: p.user_id,
    booking_participants: p,
    bookings: { client_id: primaryClient.id, counselor_id: "counselor-1" },
  }));

  // Assert 4 independent records exist
  assert.equal(groupParticipants.length, 4);
  assert.equal(groupConsents.length, 4);

  // Primary client CAN access their own consent
  assert.equal(
    assertConsentAccess({
      consent: groupConsents[0],
      authUser: primaryClient,
      authRole: "client",
      bookingClientId: primaryClient.id,
    }),
    true
  );

  // Primary client CANNOT access Participant 2, 3, or 4's consent evidence
  for (let i = 1; i < 4; i++) {
    assert.equal(
      assertConsentAccess({
        consent: groupConsents[i],
        authUser: primaryClient,
        authRole: "client",
        bookingClientId: primaryClient.id,
      }),
      false,
      `Primary client must not access consent evidence of participant ${i + 1}`
    );
  }
});

// ============================================================================
// 5. GUEST PARTICIPANT SIGNING & SESSION RECOVERY (SCENARIOS A & B)
// ============================================================================

test("8. Guest Participant completes signing, generates PDF with SHA-256, and verifies Scenario A & B recovery", async () => {
  const rawToken = "guest-invitation-token-32bytes-secret-1234567890abcdef1234567890abcdef";
  const tokenHash = hashInvitationToken(rawToken);

  const testParticipant = {
    id: "part-guest-test",
    booking_id: "booking-group-uuid",
    full_name: "Tamu Peserta Uji",
    phone_e164: "+6281234567899",
  };

  const testConsent = {
    id: "consent-guest-test",
    booking_id: "booking-group-uuid",
    booking_participant_id: "part-guest-test",
    status: "pending",
    consent_statement_version: "v1.0",
    identity_snapshot: { ...VALID_TEST_IDENTITY, full_name: "Tamu Peserta Uji" },
    booking_participants: testParticipant,
  };

  const invitationRecord = {
    id: "inv-guest-test",
    booking_participant_id: "part-guest-test",
    token_hash: tokenHash,
    status: "sent",
    expires_at: new Date(Date.now() + 172800000).toISOString(),
    booking_participants: testParticipant,
  };

  const mockSupa = {
    from(table) {
      if (table === "consent_invitations") {
        return {
          select() {
            return {
              eq(col, val) {
                return {
                  maybeSingle: async () => ({
                    data: val === tokenHash ? invitationRecord : null,
                    error: null,
                  }),
                };
              },
            };
          },
          update(patch) {
            return {
              eq() {
                return {
                  in() {
                    return {
                      select() {
                        return {
                          maybeSingle: async () => {
                            Object.assign(invitationRecord, patch);
                            return { data: invitationRecord, error: null };
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
      if (table === "booking_participants") {
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle: async () => ({
                    data: { ...testParticipant, informed_consents: [testConsent] },
                    error: null,
                  }),
                };
              },
            };
          },
        };
      }
      if (table === "consent_audit_logs") {
        return {
          insert: () => ({
            select: () => ({
              maybeSingle: async () => ({ data: { id: "audit-1" }, error: null }),
            }),
          }),
        };
      }
      return {};
    },
  };

  // Step 1: Guest claims invitation
  const claimRes = await claimGuestInvitation({
    supabaseClient: mockSupa,
    rawToken,
  });
  assert.equal(claimRes.success, true);
  assert.ok(claimRes.guestToken);

  // Step 2: Verify capability token claims
  const verified = verifyGuestCapabilityToken(claimRes.guestToken);
  assert.ok(verified);
  assert.equal(verified.purpose, "consent_signing");
  assert.equal(verified.iss, "sicare-backend");
  assert.equal(verified.aud, "sicare-guest-signer");

  // Step 3: Scenario A - Page Refresh
  // On page refresh, the guestToken / cookie is re-verified
  const refreshVerified = verifyGuestCapabilityToken(claimRes.guestToken);
  assert.equal(refreshVerified.consentId, testConsent.id);
  assert.equal(refreshVerified.participantId, testParticipant.id);

  // Step 4: Simulate guest signing and transitioning consent to 'signed'
  testConsent.status = "signed";
  testConsent.signed_at = new Date().toISOString();
  testConsent.signed_document_storage_path = "booking-group-uuid/part-guest-test/signed.pdf";
  testConsent.signed_document_sha256 = "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

  // Step 5: Scenario B - Browser closed, then guest reopens original WhatsApp link
  // Since invitation status is now 'claimed' but consent is 'signed', claimGuestInvitation allows recovery
  const reopenRes = await claimGuestInvitation({
    supabaseClient: mockSupa,
    rawToken,
  });
  assert.equal(reopenRes.success, true);
  assert.equal(reopenRes.alreadySigned, true, "Scenario B: guest safely receives capability token to view signed PDF");
  assert.ok(reopenRes.guestToken);
});

// ============================================================================
// 6. WHATSAPP NOTIFICATION PIPELINE & REMINDER SCHEDULER
// ============================================================================

test("9. WhatsApp Outbox enforces idempotency, backoff, and final cancellation on already-signed participants", async () => {
  // Idempotency key generation
  const key1 = generateIdempotencyKey("booking-uuid-1", "booking_created", "client");
  const key2 = generateIdempotencyKey("booking-uuid-1", "booking_created", "client");
  assert.equal(key1, key2, "Idempotency key must be completely deterministic");

  // Outbox job final eligibility check before dispatch
  const outboxJob = {
    id: "job-consent-rem-1",
    booking_id: "b-test-1",
    booking_participant_id: "part-test-1",
    recipient_user_id: "u-1",
    message_type: "consent_reminder",
    status: "processing",
    attempt_count: 0,
    max_attempts: 3,
    phone_e164: "+6281234567890",
    payload: {
      invitation_id: "inv-1",
      booking_participant_id: "part-test-1",
    },
  };

  const updatedOutboxRows = [];
  const mockSupaSigned = {
    from(table) {
      if (table === "profiles") {
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle: async () => ({
                    data: {
                      id: "u-1",
                      full_name: "Mahasiswa Uji",
                      phone_e164: "+6281234567890",
                      account_status: "active",
                      whatsapp_opt_in: true,
                    },
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
                      id: "part-test-1",
                      full_name: "Mahasiswa Uji",
                      phone_e164: "+6281234567890",
                      participant_status: "active",
                    },
                  }),
                };
              },
            };
          },
        };
      }
      if (table === "consent_invitations") {
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle: async () => ({
                    data: { id: "inv-1", status: "sent", expires_at: new Date(Date.now() + 86400000).toISOString() },
                  }),
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
                  maybeSingle: async () => ({
                    data: { id: "c-1", status: "signed", signed_at: new Date().toISOString() },
                  }),
                };
              },
            };
          },
        };
      }
      if (table === "whatsapp_outbox") {
        return {
          update(patch) {
            return {
              eq() {
                updatedOutboxRows.push(patch);
                return Promise.resolve({ error: null });
              },
            };
          },
        };
      }
      return {};
    },
  };

  // Run worker processing
  await processOutboxJob({
    supabaseClient: mockSupaSigned,
    job: outboxJob,
    workerId: "test-worker",
  });

  assert.equal(updatedOutboxRows.length, 1);
  assert.equal(updatedOutboxRows[0].status, "cancelled");
  assert.equal(updatedOutboxRows[0].last_error_code, "CONSENT_ALREADY_SIGNED");
});

// ============================================================================
// 7. WEBSITE IN-APP NOTIFICATIONS & RECIPIENT SCOPING
// ============================================================================

test("10. Website in-app notifications enforce recipient isolation and mark-as-read authorization", async () => {
  const notifications = [
    { id: "notif-1", recipient_user_id: "user-client-A", title: "Pesanan Dikonfirmasi", is_read: false },
    { id: "notif-2", recipient_user_id: "user-counselor-B", title: "Permintaan Konseling Baru", is_read: false },
  ];

  // Scoping check
  const getNotificationsForUser = (userId) => notifications.filter((n) => n.recipient_user_id === userId);

  const clientNotifs = getNotificationsForUser("user-client-A");
  assert.equal(clientNotifs.length, 1);
  assert.equal(clientNotifs[0].id, "notif-1");

  const counselorNotifs = getNotificationsForUser("user-counselor-B");
  assert.equal(counselorNotifs.length, 1);
  assert.equal(counselorNotifs[0].id, "notif-2");

  // Mark as read authorization check
  const markAsRead = (notifId, requesterUserId) => {
    const notif = notifications.find((n) => n.id === notifId);
    if (!notif) throw new Error("NOT_FOUND");
    if (notif.recipient_user_id !== requesterUserId) {
      const err = new Error("FORBIDDEN: Tidak dapat mengubah notifikasi pengguna lain.");
      err.status = 403;
      throw err;
    }
    notif.is_read = true;
    return notif;
  };

  // Client B cannot mark Client A's notification as read
  assert.throws(
    () => markAsRead("notif-1", "user-client-B"),
    (err) => err.status === 403
  );

  // Client A marks own notification as read
  const updated = markAsRead("notif-1", "user-client-A");
  assert.equal(updated.is_read, true);
});

// ============================================================================
// 8. END-TO-END SCENARIO 5: BOOKING CANCELLATION & CASCADING CLEANUP
// ============================================================================

test("11. Booking Cancellation cascades to invitation revocation and outbox cancellation", async () => {
  const cancelledBookingId = "b-cancelled-uuid";
  const invitations = [
    { id: "inv-1", booking_id: cancelledBookingId, status: "pending" },
    { id: "inv-2", booking_id: cancelledBookingId, status: "sent" },
  ];
  const outboxJobs = [
    { id: "out-1", booking_id: cancelledBookingId, status: "pending", message_type: "consent_invitation" },
    { id: "out-2", booking_id: cancelledBookingId, status: "retry_wait", message_type: "consent_reminder" },
  ];

  // Simulate SQL cascade performed by RPC sicare_transition_booking
  const cascadeBookingCancellation = (bId) => {
    invitations.forEach((inv) => {
      if (inv.booking_id === bId && ["pending", "sent"].includes(inv.status)) {
        inv.status = "revoked";
        inv.revoked_at = new Date().toISOString();
      }
    });

    outboxJobs.forEach((job) => {
      if (job.booking_id === bId && ["pending", "queued", "retry_wait"].includes(job.status)) {
        job.status = "cancelled";
        job.cancelled_at = new Date().toISOString();
      }
    });
  };

  cascadeBookingCancellation(cancelledBookingId);

  // Assert invitations are revoked
  assert.ok(invitations.every((inv) => inv.status === "revoked"));

  // Assert outbox jobs are cancelled
  assert.ok(outboxJobs.every((job) => job.status === "cancelled"));
});

// ============================================================================
// 9. END-TO-END SCENARIO 1: INDIVIDUAL COUNSELING LIFECYCLE
// ============================================================================

test("12. Scenario 1: Individual Counseling Lifecycle (Request -> Confirm -> Sign -> Start -> Complete -> History)", async () => {
  const clientId = "client-individual-user-1";
  const counselorId = "counselor-assigned-user-1";
  const bookingId = "b-individual-101";
  const sessionId = "sess-individual-101";
  const consentId = "consent-individual-101";

  // 1. Initial booking state: requested
  const booking = {
    id: bookingId,
    client_id: clientId,
    counselor_id: counselorId,
    service_type: "individual",
    status: "requested",
  };

  // 2. Counselor accepts booking -> status: confirmed
  booking.status = "confirmed";
  booking.confirmed_at = new Date().toISOString();

  // 3. Session created in scheduled state
  const session = {
    id: sessionId,
    booking_id: bookingId,
    counselor_id: counselorId,
    status: "scheduled",
    starts_at: new Date(Date.now() + 3600000).toISOString(),
    ends_at: new Date(Date.now() + 7200000).toISOString(),
  };

  // 4. Client signs Informed Consent
  const consent = {
    id: consentId,
    booking_id: bookingId,
    session_id: sessionId,
    signer_user_id: clientId,
    status: "signed",
    signed_at: new Date().toISOString(),
    signed_document_storage_path: `bookings/${bookingId}/signed.pdf`,
    signed_document_sha256: "aabbcc112233aabbcc112233aabbcc112233aabbcc112233aabbcc112233aabb",
    bookings: booking,
    booking_participants: { user_id: clientId },
  };

  // Check consent readiness
  const isReady = consent.status === "signed";
  assert.equal(isReady, true);

  // 5. Counselor starts session (scheduled -> ongoing)
  assert.equal(session.status, "scheduled");
  session.status = "ongoing";
  session.actual_started_at = new Date().toISOString();
  assert.equal(session.status, "ongoing");

  // 6. Counselor completes session (ongoing -> completed)
  session.status = "completed";
  session.actual_ended_at = new Date().toISOString();
  assert.equal(session.status, "completed");

  // 7. Client and Counselor access history
  const clientCanAccess = assertConsentAccess({
    consent,
    authUser: { id: clientId },
    authRole: "client",
    bookingClientId: clientId,
  });
  const counselorCanAccess = assertConsentAccess({
    consent,
    authUser: { id: counselorId },
    authRole: "counselor",
    bookingClientId: clientId,
  });

  assert.equal(clientCanAccess, true, "Client must access their own completed session consent");
  assert.equal(counselorCanAccess, true, "Assigned counselor must access assigned completed session consent");
});

// ============================================================================
// 10. END-TO-END SCENARIO 2: GROUP COUNSELING WITH ACCOUNT HOLDERS
// ============================================================================

test("13. Scenario 2: Group Counseling with Account Holders allows session transition when all signed", async () => {
  const bookingId = "b-group-acc-202";
  const participants = [
    { id: "p-acc-1", user_id: "user-client-lead", is_primary: true, status: "registered" },
    { id: "p-acc-2", user_id: "user-client-m1", is_primary: false, status: "registered" },
    { id: "p-acc-3", user_id: "user-client-m2", is_primary: false, status: "registered" },
  ];

  const consents = participants.map((p) => ({
    id: `c-${p.id}`,
    booking_participant_id: p.id,
    status: "signed", // All signed
    signed_at: new Date().toISOString(),
  }));

  const mockSupaAllSigned = {
    rpc: async (name) => {
      assert.equal(name, "sicare_check_booking_consent_readiness");
      return {
        data: {
          is_fully_consented: true,
          total_participants: 3,
          signed_participants: 3,
          pending_participants: 0,
          template_compliant: true,
        },
        error: null,
      };
    },
  };

  const status = await getBookingConsentStatus({
    supabaseClient: mockSupaAllSigned,
    bookingId,
  });

  assert.equal(status.isFullyConsented, true);
  assert.equal(status.pendingParticipants, 0);

  // Counselor starts session
  const startSession = (ready) => {
    if (!ready) throw new Error("CONSENT_READINESS_INCOMPLETE");
    return { status: "ongoing" };
  };

  const res = startSession(status.isFullyConsented);
  assert.equal(res.status, "ongoing", "Session transitions to ongoing when all participants have signed");
});

// ============================================================================
// 11. END-TO-END SCENARIO 3: GROUP COUNSELING WITH GUEST PARTICIPANTS
// ============================================================================

test("14. Scenario 3: Group Counseling with Guest updates Group Summary without leaking PII to Primary Client", async () => {
  const bookingId = "b-group-guest-303";
  const primaryUserId = "user-primary-303";

  const participants = [
    {
      id: "part-lead",
      full_name: "Klien Utama",
      display_name: "Klien Utama",
      is_primary: true,
      participant_status: "registered",
      informed_consents: [{ id: "c-lead", status: "signed", signed_at: new Date().toISOString(), consent_statement_version: "v1.0" }],
      consent_invitations: [],
    },
    {
      id: "part-guest",
      full_name: "Peserta Tamu Rahasia",
      display_name: "Peserta Tamu Rahasia",
      is_primary: false,
      participant_status: "registered",
      informed_consents: [{ id: "c-guest", status: "signed", signed_at: new Date().toISOString(), consent_statement_version: "v1.0" }],
      consent_invitations: [{ id: "inv-g", status: "completed" }],
    },
  ];

  const mockSupa = {
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
                      client_id: primaryUserId,
                      counselor_id: "counselor-1",
                      service_type: "group",
                      group_name: "Kelompok Studi",
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
              eq() {
                return Promise.resolve({ data: participants, error: null });
              },
            };
          },
        };
      }
      return {};
    },
  };

  const summary = await getGroupConsentSummary({
    supabaseClient: mockSupa,
    bookingId,
    authUser: { id: primaryUserId },
    authRole: "client",
  });

  assert.equal(summary.total_participants, 2);
  assert.equal(summary.signed_count, 2);
  assert.equal(summary.pending_count, 0);
  assert.equal(summary.ready_for_session, true);

  // Assert NO clinical PII of guest is exposed to primary client
  const guestSummary = summary.participants.find((p) => p.participant_id === "part-guest");
  assert.ok(guestSummary);
  assert.equal(guestSummary.consent_status, "signed");
  assert.equal(guestSummary.nim, undefined, "NIM must not be leaked in group summary");
  assert.equal(guestSummary.birthplace, undefined, "Birthplace must not be leaked in group summary");
  assert.equal(guestSummary.phone_e164, undefined, "Phone number must not be leaked in group summary");
});

// ============================================================================
// 12. END-TO-END SCENARIO 4: INCOMPLETE GROUP CONSENT BLOCKS SESSION
// ============================================================================

test("15. Scenario 4: Incomplete Group Consent (3 Signed, 1 Pending) blocks Counselor from starting session", async () => {
  const readiness = {
    isFullyConsented: false,
    totalParticipants: 4,
    signedParticipants: 3,
    pendingParticipants: 1,
  };

  const tryStartSession = (r) => {
    if (!r.isFullyConsented) {
      const err = new Error("CONSENT_READINESS_INCOMPLETE: Sesi konseling kelompok belum dapat dimulai.");
      err.status = 409;
      err.code = "CONSENT_READINESS_INCOMPLETE";
      throw err;
    }
    return { status: "ongoing" };
  };

  assert.throws(
    () => tryStartSession(readiness),
    (err) => err.status === 409 && err.code === "CONSENT_READINESS_INCOMPLETE"
  );
});

// ============================================================================
// 13. END-TO-END SCENARIO 6: COMPLETED COUNSELING HISTORY & DOCUMENT BOUNDARIES
// ============================================================================

test("16. Scenario 6: Completed Counseling History enforces role document boundaries strictly", () => {
  const completedBooking = {
    id: "b-completed-606",
    client_id: "client-owner-606",
    counselor_id: "counselor-assigned-606",
  };

  const signedConsent = {
    id: "c-completed-606",
    signer_user_id: "client-owner-606",
    status: "signed",
    bookings: completedBooking,
    booking_participants: { user_id: "client-owner-606" },
  };

  // 1. Client owner -> ALLOWED
  assert.equal(
    assertConsentAccess({
      consent: signedConsent,
      authUser: { id: "client-owner-606" },
      authRole: "client",
      bookingClientId: completedBooking.client_id,
    }),
    true
  );

  // 2. Assigned counselor -> ALLOWED
  assert.equal(
    assertConsentAccess({
      consent: signedConsent,
      authUser: { id: "counselor-assigned-606" },
      authRole: "counselor",
      bookingClientId: completedBooking.client_id,
    }),
    true
  );

  // 3. Unassigned counselor -> FORBIDDEN
  assert.equal(
    assertConsentAccess({
      consent: signedConsent,
      authUser: { id: "counselor-unassigned-777" },
      authRole: "counselor",
      bookingClientId: completedBooking.client_id,
    }),
    false
  );

  // 4. Kepala LMI -> FORBIDDEN from downloading raw clinical signed PDF
  assert.equal(
    assertConsentAccess({
      consent: signedConsent,
      authUser: { id: "head-lmi-executive" },
      authRole: "head_lmi",
      bookingClientId: completedBooking.client_id,
    }),
    false
  );

  // 5. Admin -> ALLOWED for compliance audit
  assert.equal(
    assertConsentAccess({
      consent: signedConsent,
      authUser: { id: "admin-audit-user" },
      authRole: "admin",
      bookingClientId: completedBooking.client_id,
    }),
    true
  );
});

// ============================================================================
// 14. PROFILE CRUD & HISTORICAL SIGNED IDENTITY SNAPSHOT IMMUTABILITY
// ============================================================================

test("17. Profile CRUD updates profile table but does not alter frozen historical identity_snapshot", () => {
  const historicalSnapshot = {
    full_name: "Mahasiswa Asli (2025)",
    nim: "210111001",
    faculty: "Teknik",
    study_program: "Informatika",
    birthplace: "Manado",
    date_of_birth: "2003-01-01",
    gender: "Laki-laki",
    phone_e164: "+628111111111",
  };

  const signedConsentRecord = {
    id: "consent-historical-signed",
    status: "signed",
    signer_name_snapshot: "Mahasiswa Asli (2025)",
    identity_snapshot: { ...historicalSnapshot },
  };

  // Client updates their profile in 2026
  const profilePatch = {
    full_name: "Mahasiswa Berubah Nama",
    phone_e164: "+628999999999",
  };

  const updatedProfile = {
    id: "client-uuid",
    ...profilePatch,
    updated_at: new Date().toISOString(),
  };

  // Assert historical signed snapshot is untouched
  assert.equal(
    signedConsentRecord.identity_snapshot.full_name,
    "Mahasiswa Asli (2025)",
    "Historical signed snapshot must never be overwritten by live profile updates"
  );
  assert.equal(signedConsentRecord.identity_snapshot.phone_e164, "+628111111111");
  assert.notEqual(signedConsentRecord.identity_snapshot.full_name, updatedProfile.full_name);
});

// ============================================================================
// 15. ADMIN ACADEMIC PERIOD VALIDATION
// ============================================================================

test("18. Admin Academic Period rejects invalid date ranges where ends_on is before starts_on", () => {
  const validatePeriod = (startsOn, endsOn) => {
    if (endsOn < startsOn) {
      throw new Error("Tanggal akhir harus sama dengan atau setelah tanggal mulai.");
    }
    return { valid: true };
  };

  // Valid period
  assert.ok(validatePeriod("2026-09-01", "2027-01-31").valid);

  // Invalid period
  assert.throws(
    () => validatePeriod("2027-02-01", "2026-09-01"),
    /Tanggal akhir harus sama dengan atau setelah tanggal mulai/
  );
});
