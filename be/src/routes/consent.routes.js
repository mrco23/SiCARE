import { Router } from "express";
import { authenticate, allowRoles, optionalAuthenticate } from "../middleware/auth.js";
import { asyncHandler } from "../lib/http.js";
import { consentController } from "../controllers/consent.controller.js";

const router = Router();

const authenticateGuest = asyncHandler(consentController.authenticateGuestMiddleware);

/**
 * GET /api/v1/consents/booking/:bookingId/my-consent
 * Resolves or initializes current authenticated user's consent record for a booking.
 */
router.get(
  "/booking/:bookingId/my-consent",
  authenticate,
  allowRoles("client", "counselor"),
  asyncHandler(consentController.getMyConsent)
);

/**
 * GET /api/v1/consents/booking/:bookingId/readiness
 * Retrieves sanitized operational consent readiness for a booking.
 */
router.get(
  "/booking/:bookingId/readiness",
  authenticate,
  allowRoles("client", "counselor", "admin", "head_lmi"),
  asyncHandler(consentController.getReadiness)
);

/**
 * GET /api/v1/consents/:id
 * Retrieves a consent record. Enforces owner/signer authorization.
 */
router.get(
  "/:id",
  authenticate,
  allowRoles("client", "counselor", "admin", "head_lmi"),
  asyncHandler(consentController.getConsent)
);

/**
 * PATCH /api/v1/consents/:id/identity
 * Updates draft identity information before signing.
 */
router.patch(
  "/:id/identity",
  authenticate,
  allowRoles("client"),
  asyncHandler(consentController.updateDraftIdentity)
);

/**
 * POST /api/v1/consents/:id/sign
 * Submits the digital signature, generates the official PDF, and finalizes consent.
 */
router.post(
  "/:id/sign",
  authenticate,
  allowRoles("client"),
  asyncHandler(consentController.signConsent)
);

/**
 * GET /api/v1/consents/:id/document
 * Retrieves an authorized, short-lived download URL for the signed PDF document.
 */
router.get(
  "/:id/document",
  authenticate,
  allowRoles("client", "counselor", "admin", "head_lmi"),
  asyncHandler(consentController.getDocumentUrl)
);

// ============================================================================
// Group Consent & Invitation Management Endpoints
// ============================================================================

/**
 * GET /api/v1/consents/booking/:bookingId/group-summary
 * Retrieves privacy-respecting Group Consent summary for Primary Client, Counselor, or Admin.
 */
router.get(
  "/booking/:bookingId/group-summary",
  authenticate,
  allowRoles("client", "counselor", "admin", "head_lmi"),
  asyncHandler(consentController.getGroupSummary)
);

/**
 * POST /api/v1/consents/booking/:bookingId/participants/:participantId/resend-invitation
 * Resends an invitation to an unconsented group participant.
 */
router.post(
  "/booking/:bookingId/participants/:participantId/resend-invitation",
  authenticate,
  allowRoles("client", "counselor", "admin"),
  asyncHandler(consentController.resendInvitation)
);

// ============================================================================
// Guest Participant Capability & Signing Endpoints
// ============================================================================

/**
 * POST /api/v1/consents/invitations/claim
 * Public endpoint to atomically validate & claim an invitation token and establish a guest session.
 */
router.post(
  "/invitations/claim",
  optionalAuthenticate,
  asyncHandler(consentController.claimGuestInvitation)
);

/**
 * GET /api/v1/consents/guest/me
 * Retrieves the guest's own draft consent record, participant data, and active template.
 */
router.get(
  "/guest/me",
  authenticateGuest,
  asyncHandler(consentController.getGuestConsent)
);

/**
 * PATCH /api/v1/consents/guest/me/identity
 * Updates draft participant identity attributes for a guest before signing.
 */
router.patch(
  "/guest/me/identity",
  authenticateGuest,
  asyncHandler(consentController.updateGuestDraftIdentity)
);

/**
 * POST /api/v1/consents/guest/me/sign
 * Submits the digital signature for a guest participant, compiles official PDF, and finalizes consent.
 */
router.post(
  "/guest/me/sign",
  authenticateGuest,
  asyncHandler(consentController.signGuestConsent)
);

/**
 * GET /api/v1/consents/guest/me/document
 * Retrieves an authorized short-lived download URL for the guest's own signed PDF.
 */
router.get(
  "/guest/me/document",
  authenticateGuest,
  asyncHandler(consentController.getGuestDocumentUrl)
);

export default router;
