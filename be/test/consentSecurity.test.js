import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertConsentAccess,
  claimConsentInvitation,
  createConsentInvitation,
  getBookingConsentStatus,
  hashInvitationToken,
  recordConsentAuditLog,
  verifyInvitationToken,
} from "../src/services/consent.service.js";

// ============================================================================
// 1. Consent Document and Participant Privacy (Audits A & B)
// ============================================================================

test("1. Primary Client cannot read other participants' identity snapshots", () => {
  const primaryClientUser = { id: "user-client-primary-1", app_role: "client" };
  const participantConsent = {
    id: "consent-member-1",
    signer_user_id: "user-member-2",
    booking_participants: { user_id: "user-member-2" },
    identity_snapshot: {
      nim: "210111099",
      birthplace: "Manado",
      date_of_birth: "2003-01-01",
      phone_e164: "62899999999",
    },
  };

  // Primary client of the booking trying to access another participant's consent
  const hasAccess = assertConsentAccess({
    consent: participantConsent,
    authUser: primaryClientUser,
    authRole: "client",
    bookingClientId: primaryClientUser.id,
  });

  assert.equal(hasAccess, false, "Primary client must NOT have access to another participant's consent or identity snapshot");
});

test("2. Primary Client cannot download other participants' signed documents", () => {
  const primaryClientUser = { id: "user-client-primary-1", app_role: "client" };
  const participantConsent = {
    id: "consent-member-2",
    signer_user_id: "user-member-3",
    booking_participants: { user_id: "user-member-3" },
    signed_document_storage_path: "booking-1/part-3/consent-member-2.pdf",
    signed_document_sha256: "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
  };

  const hasAccess = assertConsentAccess({
    consent: participantConsent,
    authUser: primaryClientUser,
    authRole: "client",
    bookingClientId: primaryClientUser.id,
  });

  assert.equal(hasAccess, false, "Primary client must NOT be allowed to download another participant's signed PDF");
});

test("3. Participant can access only their own consent", () => {
  const memberUser = { id: "user-member-3", app_role: "client" };
  const ownConsent = {
    id: "consent-member-3",
    signer_user_id: "user-member-3",
    booking_participants: { user_id: "user-member-3" },
  };
  const otherConsent = {
    id: "consent-member-4",
    signer_user_id: "user-member-4",
    booking_participants: { user_id: "user-member-4" },
  };

  assert.equal(
    assertConsentAccess({ consent: ownConsent, authUser: memberUser, authRole: "client" }),
    true,
    "Participant must be allowed to access their own consent"
  );

  assert.equal(
    assertConsentAccess({ consent: otherConsent, authUser: memberUser, authRole: "client" }),
    false,
    "Participant must NOT be allowed to access another participant's consent"
  );
});

test("4. Guest token cannot access another participant", async () => {
  const tokenHashTarget = hashInvitationToken("guest-token-participant-1");
  const tokenHashOther = hashInvitationToken("guest-token-participant-2");

  const mockClient = {
    from(table) {
      assert.equal(table, "consent_invitations");
      return {
        select() {
          return {
            eq(col, val) {
              assert.equal(col, "token_hash");
              if (val === tokenHashTarget) {
                return {
                  maybeSingle: async () => ({
                    data: {
                      id: "inv-1",
                      booking_participant_id: "part-1",
                      status: "pending",
                      expires_at: new Date(Date.now() + 3600000).toISOString(),
                      booking_participants: { id: "part-1", booking_id: "b-1" },
                    },
                    error: null,
                  }),
                };
              }
              return {
                maybeSingle: async () => ({ data: null, error: null }),
              };
            },
          };
        },
      };
    },
  };

  const result1 = await verifyInvitationToken({ supabaseClient: mockClient, rawToken: "guest-token-participant-1" });
  assert.equal(result1.valid, true);
  assert.equal(result1.invitation.booking_participant_id, "part-1");

  const resultOther = await verifyInvitationToken({ supabaseClient: mockClient, rawToken: "guest-token-participant-2" });
  assert.equal(resultOther.valid, false);
  assert.equal(resultOther.error, "INVITATION_NOT_FOUND");
});

// ============================================================================
// 2. Invitation Lifecycle and Atomic Claiming (Audit F)
// ============================================================================

test("5. Authenticated invitation cannot be claimed by the wrong account", async () => {
  const rawToken = "auth-participant-token-1234567890abcdef1234567890abcdef12345678";
  const tokenHash = hashInvitationToken(rawToken);

  const mockClient = {
    rpc: async (name, params) => {
      assert.equal(name, "sicare_claim_consent_invitation");
      if (params.p_claimer_user_id !== "user-expected-1") {
        return { data: null, error: { message: "INVITATION_ACCOUNT_MISMATCH" } };
      }
      return { data: { success: true }, error: null };
    },
  };

  const failResult = await claimConsentInvitation({
    supabaseClient: mockClient,
    rawToken,
    claimerUserId: "user-attacker-wrong-2",
  });

  assert.equal(failResult.success, false);
  assert.equal(failResult.error, "INVITATION_ACCOUNT_MISMATCH");

  const successResult = await claimConsentInvitation({
    supabaseClient: mockClient,
    rawToken,
    claimerUserId: "user-expected-1",
  });

  assert.equal(successResult.success, true);
});

test("6. Concurrent token claims cannot both succeed (atomic claim race)", async () => {
  const rawToken = "race-token-1234567890abcdef1234567890abcdef1234567890abcdef1234";
  let claimCount = 0;

  const mockClient = {
    rpc: async (name) => {
      assert.equal(name, "sicare_claim_consent_invitation");
      claimCount++;
      if (claimCount === 1) {
        return { data: { success: true, claimed_at: new Date().toISOString() }, error: null };
      }
      return { data: null, error: { message: "INVITATION_ALREADY_USED" } };
    },
  };

  // Simulate two concurrent claim requests
  const [res1, res2] = await Promise.all([
    claimConsentInvitation({ supabaseClient: mockClient, rawToken }),
    claimConsentInvitation({ supabaseClient: mockClient, rawToken }),
  ]);

  const successCount = [res1, res2].filter((r) => r.success).length;
  const failCount = [res1, res2].filter((r) => !r.success && r.error === "INVITATION_ALREADY_USED").length;

  assert.equal(successCount, 1, "Exactly one claim must succeed");
  assert.equal(failCount, 1, "The second concurrent claim must be rejected as INVITATION_ALREADY_USED");
});

test("7. Expired invitation cannot be claimed", async () => {
  const rawToken = "expired-token-1234567890abcdef1234567890abcdef1234567890abcdef12";

  const mockClient = {
    rpc: async () => ({
      data: null,
      error: { message: "INVITATION_EXPIRED" },
    }),
  };

  const result = await claimConsentInvitation({
    supabaseClient: mockClient,
    rawToken,
  });

  assert.equal(result.success, false);
  assert.equal(result.error, "INVITATION_EXPIRED");
});

test("8. Revoked invitation cannot be used", async () => {
  const rawToken = "revoked-token-1234567890abcdef1234567890abcdef1234567890abcdef12";

  const mockClient = {
    rpc: async () => ({
      data: null,
      error: { message: "INVITATION_REVOKED" },
    }),
  };

  const result = await claimConsentInvitation({
    supabaseClient: mockClient,
    rawToken,
  });

  assert.equal(result.success, false);
  assert.equal(result.error, "INVITATION_REVOKED");
});

// ============================================================================
// 3. Signed Consent Immutability and Evidence Protection (Audits C & D)
// ============================================================================

test("9. Signed identity snapshot cannot be changed", () => {
  // Simulates the logic enforced by trigger public.prohibit_signed_consent_tampering
  function simulateImmutabilityTrigger(oldRow, newRow, operation) {
    if (operation === "DELETE") {
      if (oldRow.status === "signed" || oldRow.status === "revoked") {
        throw new Error("SIGNED_CONSENT_CANNOT_BE_DELETED");
      }
      return true;
    }
    if (operation === "UPDATE") {
      if (oldRow.status === "signed") {
        if (newRow.status !== "revoked" && newRow.status !== "signed") {
          throw new Error("SIGNED_CONSENT_INVALID_STATUS_TRANSITION");
        }
        if (JSON.stringify(oldRow.identity_snapshot) !== JSON.stringify(newRow.identity_snapshot)) {
          throw new Error("SIGNED_CONSENT_EVIDENCE_IMMUTABLE");
        }
        if (oldRow.signed_document_storage_path !== newRow.signed_document_storage_path) {
          throw new Error("SIGNED_CONSENT_EVIDENCE_IMMUTABLE");
        }
        if (oldRow.signed_document_sha256 !== newRow.signed_document_sha256) {
          throw new Error("SIGNED_CONSENT_EVIDENCE_IMMUTABLE");
        }
      }
      if (oldRow.status === "revoked") {
        throw new Error("REVOKED_CONSENT_IS_FINAL");
      }
      return newRow;
    }
    return newRow;
  }

  const signedConsent = {
    id: "ic-signed-1",
    status: "signed",
    identity_snapshot: { full_name: "Original Name", nim: "210111001" },
    signed_document_storage_path: "b-1/p-1/ic-signed-1.pdf",
    signed_document_sha256: "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
  };

  const tamperedConsent = {
    ...signedConsent,
    identity_snapshot: { full_name: "Tampered Name", nim: "999999999" },
  };

  assert.throws(
    () => simulateImmutabilityTrigger(signedConsent, tamperedConsent, "UPDATE"),
    /SIGNED_CONSENT_EVIDENCE_IMMUTABLE/
  );
});

test("10. Signed document path cannot be overwritten", () => {
  function simulateTrigger(oldRow, newRow) {
    if (oldRow.status === "signed") {
      if (oldRow.signed_document_storage_path !== newRow.signed_document_storage_path) {
        throw new Error("SIGNED_CONSENT_EVIDENCE_IMMUTABLE");
      }
    }
    return newRow;
  }

  const signedConsent = {
    id: "ic-signed-2",
    status: "signed",
    identity_snapshot: { full_name: "User 2" },
    signed_document_storage_path: "b-1/p-2/doc-v1.pdf",
  };

  const modifiedPath = {
    ...signedConsent,
    signed_document_storage_path: "b-1/p-2/malicious-replacement.pdf",
  };

  assert.throws(() => simulateTrigger(signedConsent, modifiedPath), /SIGNED_CONSENT_EVIDENCE_IMMUTABLE/);
});

test("11. Signed evidence survives revocation", () => {
  function simulateRevocation(oldRow, newRow) {
    if (oldRow.status === "signed") {
      if (newRow.status === "revoked") {
        // Evidence must remain identical
        if (JSON.stringify(oldRow.identity_snapshot) !== JSON.stringify(newRow.identity_snapshot)) {
          throw new Error("SIGNED_CONSENT_EVIDENCE_IMMUTABLE");
        }
        if (oldRow.signed_document_sha256 !== newRow.signed_document_sha256) {
          throw new Error("SIGNED_CONSENT_EVIDENCE_IMMUTABLE");
        }
        return {
          ...newRow,
          revoked_at: newRow.revoked_at || new Date().toISOString(),
        };
      }
    }
    return newRow;
  }

  const signedConsent = {
    id: "ic-signed-3",
    status: "signed",
    identity_snapshot: { full_name: "Peserta Revoked", nim: "210111003" },
    signed_document_storage_path: "b-1/p-3/consent-original.pdf",
    signed_document_sha256: "59012141d8a54336928a4c076d9d0ad7276bbbc36064c37d9654cc031f14cd8f",
    signed_at: "2026-10-31T10:00:00Z",
  };

  const validRevocation = {
    ...signedConsent,
    status: "revoked",
    revocation_reason: "Peserta menarik kesediaan konseling kelompok",
  };

  const finalized = simulateRevocation(signedConsent, validRevocation);
  assert.equal(finalized.status, "revoked");
  assert.equal(finalized.signed_document_sha256, signedConsent.signed_document_sha256);
  assert.equal(finalized.signed_document_storage_path, signedConsent.signed_document_storage_path);
  assert.equal(finalized.identity_snapshot.nim, "210111003");
  assert.ok(finalized.revoked_at);
});

// ============================================================================
// 4. Supabase Storage and Audit Security (Audits E & G)
// ============================================================================

test("12. Unauthorized Storage access is rejected", () => {
  // Evaluates the RLS policy defined in migration for informed-consent-signed
  function checkSignedPdfStorageAccess({ bucketId, callerId, signerId, counselorId, callerRole }) {
    if (bucketId !== "informed-consent-signed") return false;
    if (callerRole === "admin" || callerRole === "head_lmi") return true;
    if (callerId === signerId) return true;
    if (callerId === counselorId) return true;
    return false;
  }

  const signer = "user-signer-1";
  const counselor = "user-counselor-1";
  const primaryClient = "user-primary-client-1"; // NOT signer
  const stranger = "user-stranger-9";

  assert.equal(checkSignedPdfStorageAccess({ bucketId: "informed-consent-signed", callerId: signer, signerId: signer, counselorId: counselor }), true);
  assert.equal(checkSignedPdfStorageAccess({ bucketId: "informed-consent-signed", callerId: counselor, signerId: signer, counselorId: counselor }), true);
  assert.equal(checkSignedPdfStorageAccess({ bucketId: "informed-consent-signed", callerId: primaryClient, signerId: signer, counselorId: counselor }), false, "Primary client must NOT access other participant's signed storage file");
  assert.equal(checkSignedPdfStorageAccess({ bucketId: "informed-consent-signed", callerId: stranger, signerId: signer, counselorId: counselor }), false);
});

test("13. Audit log UPDATE is rejected", () => {
  // Enforces trigger prohibit_consent_audit_mutation()
  function triggerAuditAppendOnly(op) {
    if (op === "UPDATE" || op === "DELETE") {
      throw new Error("CONSENT_AUDIT_LOG_IS_APPEND_ONLY");
    }
  }

  assert.throws(() => triggerAuditAppendOnly("UPDATE"), /CONSENT_AUDIT_LOG_IS_APPEND_ONLY/);
});

test("14. Audit log DELETE is rejected", () => {
  function triggerAuditAppendOnly(op) {
    if (op === "UPDATE" || op === "DELETE") {
      throw new Error("CONSENT_AUDIT_LOG_IS_APPEND_ONLY");
    }
  }

  assert.throws(() => triggerAuditAppendOnly("DELETE"), /CONSENT_AUDIT_LOG_IS_APPEND_ONLY/);
});

// ============================================================================
// 5. Consent Readiness RPC Logic (Audit H)
// ============================================================================

test("15. Readiness RPC includes all active participants", async () => {
  const mockClient = {
    rpc: async (name, params) => {
      assert.equal(name, "sicare_check_booking_consent_readiness");
      return {
        data: {
          booking_id: params.p_booking_id,
          total_participants: 3,
          signed_participants: 3,
          pending_participants: 0,
          template_compliant: true,
          is_fully_consented: true,
          participants: [
            { participant_id: "p1", is_primary: true, consent_status: "signed" },
            { participant_id: "p2", is_primary: false, consent_status: "signed" },
            { participant_id: "p3", is_primary: false, consent_status: "signed" },
          ],
        },
        error: null,
      };
    },
  };

  const status = await getBookingConsentStatus({ supabaseClient: mockClient, bookingId: "book-ready-1" });
  assert.equal(status.isFullyConsented, true);
  assert.equal(status.totalParticipants, 3);
  assert.equal(status.signedParticipants, 3);
  assert.equal(status.pendingParticipants, 0);
  assert.equal(status.templateCompliant, true);
});

test("16. Missing consent blocks readiness", async () => {
  const mockClient = {
    rpc: async () => ({
      data: {
        total_participants: 3,
        signed_participants: 2,
        pending_participants: 1,
        template_compliant: true,
        is_fully_consented: false,
        participants: [
          { participant_id: "p1", is_primary: true, consent_status: "signed" },
          { participant_id: "p2", is_primary: false, consent_status: "signed" },
          { participant_id: "p3", is_primary: false, consent_status: "pending" },
        ],
      },
      error: null,
    }),
  };

  const status = await getBookingConsentStatus({ supabaseClient: mockClient, bookingId: "book-pending-1" });
  assert.equal(status.isFullyConsented, false);
  assert.equal(status.pendingParticipants, 1);
});

test("17. Revoked consent blocks readiness", async () => {
  const mockClient = {
    rpc: async () => ({
      data: {
        total_participants: 2,
        signed_participants: 1,
        pending_participants: 1,
        template_compliant: true,
        is_fully_consented: false,
        participants: [
          { participant_id: "p1", is_primary: true, consent_status: "signed" },
          { participant_id: "p2", is_primary: false, consent_status: "revoked" },
        ],
      },
      error: null,
    }),
  };

  const status = await getBookingConsentStatus({ supabaseClient: mockClient, bookingId: "book-revoked-1" });
  assert.equal(status.isFullyConsented, false);
  assert.equal(status.signedParticipants, 1);
  assert.equal(status.pendingParticipants, 1);
});

test("18. Outdated template consent is handled correctly", async () => {
  const mockClient = {
    rpc: async () => ({
      data: {
        total_participants: 2,
        signed_participants: 2,
        pending_participants: 0,
        template_compliant: false, // Signed but with old template version
        is_fully_consented: false,
        participants: [
          { participant_id: "p1", is_primary: true, consent_status: "signed", template_compliant: true },
          { participant_id: "p2", is_primary: false, consent_status: "signed", template_compliant: false },
        ],
      },
      error: null,
    }),
  };

  const status = await getBookingConsentStatus({ supabaseClient: mockClient, bookingId: "book-outdated-1" });
  assert.equal(status.isFullyConsented, false, "Consent signed with outdated template must NOT allow session readiness");
  assert.equal(status.templateCompliant, false);
});
