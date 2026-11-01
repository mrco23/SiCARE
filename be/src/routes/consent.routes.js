import { Router } from "express";
import { z } from "zod";
import { authenticate, allowRoles, optionalAuthenticate } from "../middleware/auth.js";
import { asyncHandler, HttpError, parseBody, sendData } from "../lib/http.js";
import { env } from "../config/env.js";
import {
  claimGuestInvitation,
  ensureBookingParticipants,
  getBookingConsentStatus,
  getConsentById,
  getGroupConsentSummary,
  getGuestConsent,
  getGuestSignedDocumentDownloadUrl,
  getSignedDocumentDownloadUrl,
  initializeConsentForParticipant,
  resendConsentInvitation,
  signGuestInformedConsent,
  signInformedConsent,
  updateDraftConsentIdentity,
  updateGuestDraftIdentity,
  validateGuestCapabilityState,
  verifyGuestCapabilityToken,
} from "../services/consent.service.js";

const router = Router();
const uuidSchema = z.string().uuid();

const identitySchema = z.object({
  full_name: z.string().trim().min(2).max(160),
  faculty: z.string().trim().min(2).max(100),
  study_program: z.string().trim().min(2).max(100),
  nim: z.string().trim().min(2).max(50),
  birthplace: z.string().trim().min(2).max(100),
  date_of_birth: z.string().trim().min(8).max(30),
  gender: z.enum(["Laki-laki", "Perempuan"]),
  phone_e164: z.string().trim().min(8).max(25),
}).partial();

const signPayloadSchema = z.object({
  signature_base64: z.string().min(10),
  agreement_accepted: z.literal(true),
  identity: identitySchema.optional(),
  idempotency_key: z.string().trim().max(128).optional(),
});

// Helper to convert dataURL or base64 to Buffer
function parseSignatureBase64(dataOrBase64) {
  let base64 = dataOrBase64;
  if (base64.includes(",")) {
    base64 = base64.split(",")[1];
  }
  return Buffer.from(base64, "base64");
}

/**
 * GET /api/v1/consents/booking/:bookingId/my-consent
 * Resolves or initializes the current authenticated user's consent record for a booking.
 */
router.get(
  "/booking/:bookingId/my-consent",
  authenticate,
  allowRoles("client", "counselor"),
  asyncHandler(async (request, response) => {
    const bookingId = uuidSchema.parse(request.params.bookingId);
    const authUser = request.auth.user;

    // Ensure participants exist for this booking
    const participants = await ensureBookingParticipants({ bookingId });
    const myParticipant = participants.find((p) => p.user_id === authUser.id);

    if (!myParticipant) {
      throw new HttpError(404, "PARTICIPANT_NOT_FOUND", "Anda tidak terdaftar sebagai peserta dalam booking ini.");
    }

    // Initialize or retrieve existing consent
    const { consent } = await initializeConsentForParticipant({
      bookingId,
      participantId: myParticipant.id,
    });

    const fullConsent = await getConsentById({
      consentId: consent.id,
      authUser,
      authRole: request.auth.profile.app_role,
    });

    return sendData(response, fullConsent);
  })
);

/**
 * GET /api/v1/consents/booking/:bookingId/readiness
 * Retrieves sanitized operational consent readiness for a booking.
 */
router.get(
  "/booking/:bookingId/readiness",
  authenticate,
  allowRoles("client", "counselor", "admin", "head_lmi"),
  asyncHandler(async (request, response) => {
    const bookingId = uuidSchema.parse(request.params.bookingId);
    const status = await getBookingConsentStatus({ bookingId });
    return sendData(response, status);
  })
);

/**
 * GET /api/v1/consents/:id
 * Retrieves a consent record. Enforces owner/signer authorization.
 */
router.get(
  "/:id",
  authenticate,
  allowRoles("client", "counselor", "admin", "head_lmi"),
  asyncHandler(async (request, response) => {
    const consentId = uuidSchema.parse(request.params.id);
    const consent = await getConsentById({
      consentId,
      authUser: request.auth.user,
      authRole: request.auth.profile.app_role,
    });

    return sendData(response, consent);
  })
);

/**
 * PATCH /api/v1/consents/:id/identity
 * Updates draft identity information before signing.
 */
router.patch(
  "/:id/identity",
  authenticate,
  allowRoles("client"),
  asyncHandler(async (request, response) => {
    const consentId = uuidSchema.parse(request.params.id);
    const body = parseBody(identitySchema, request.body);

    const updated = await updateDraftConsentIdentity({
      consentId,
      authUser: request.auth.user,
      identityData: body,
    });

    return sendData(response, updated);
  })
);

/**
 * POST /api/v1/consents/:id/sign
 * Submits the digital signature, generates the official PDF, and finalizes consent.
 */
router.post(
  "/:id/sign",
  authenticate,
  allowRoles("client"),
  asyncHandler(async (request, response) => {
    const consentId = uuidSchema.parse(request.params.id);
    const body = parseBody(signPayloadSchema, request.body);
    const signatureBuffer = parseSignatureBase64(body.signature_base64);

    const result = await signInformedConsent({
      consentId,
      authUser: request.auth.user,
      authRole: request.auth.profile.app_role,
      signatureBuffer,
      agreementAccepted: body.agreement_accepted,
      identityData: body.identity || {},
      idempotencyKey: body.idempotency_key,
    });

    return sendData(response, result, 200);
  })
);

/**
 * GET /api/v1/consents/:id/document
 * Retrieves an authorized, short-lived download URL for the signed PDF document.
 */
router.get(
  "/:id/document",
  authenticate,
  allowRoles("client", "counselor", "admin", "head_lmi"),
  asyncHandler(async (request, response) => {
    const consentId = uuidSchema.parse(request.params.id);
    const expiresIn = request.query.expires_in ? parseInt(request.query.expires_in, 10) : 60;

    const doc = await getSignedDocumentDownloadUrl({
      consentId,
      authUser: request.auth.user,
      authRole: request.auth.profile.app_role,
      expiresInSeconds: Math.min(Math.max(expiresIn, 30), 300),
    });

    return sendData(response, doc);
  })
);

// ============================================================================
// Group Consent & Invitation Management Endpoints
// ============================================================================

/**
 * GET /api/v1/consents/booking/:bookingId/group-summary
 * Retrieves privacy-respecting Group Consent summary for the Primary Client, Counselor, or Admin.
 */
router.get(
  "/booking/:bookingId/group-summary",
  authenticate,
  allowRoles("client", "counselor", "admin", "head_lmi"),
  asyncHandler(async (request, response) => {
    const bookingId = uuidSchema.parse(request.params.bookingId);
    const summary = await getGroupConsentSummary({
      bookingId,
      authUser: request.auth.user,
      authRole: request.auth.profile.app_role,
    });
    return sendData(response, summary);
  })
);

/**
 * POST /api/v1/consents/booking/:bookingId/participants/:participantId/resend-invitation
 * Resends an invitation to an unconsented group participant.
 */
router.post(
  "/booking/:bookingId/participants/:participantId/resend-invitation",
  authenticate,
  allowRoles("client", "counselor", "admin"),
  asyncHandler(async (request, response) => {
    const bookingId = uuidSchema.parse(request.params.bookingId);
    const participantId = uuidSchema.parse(request.params.participantId);

    const result = await resendConsentInvitation({
      bookingId,
      participantId,
      authUser: request.auth.user,
      authRole: request.auth.profile.app_role,
    });

    return sendData(response, result);
  })
);

// ============================================================================
// Guest Participant Capability & Signing Endpoints
// ============================================================================

const claimSchema = z.object({
  token: z.string().trim().min(10).max(128),
});

/**
 * Helper middleware to authenticate guest capability tokens and validate database-backed session state.
 */
const authenticateGuest = asyncHandler(async (request, response, next) => {
  response.setHeader("Referrer-Policy", "no-referrer");

  let token = null;
  if (request.headers.cookie) {
    const match = request.headers.cookie.match(/(?:^|;\s*)sicare_guest_token=([^;]*)/);
    if (match) token = decodeURIComponent(match[1]);
  }
  if (!token && request.headers["x-guest-capability-token"]) {
    token = request.headers["x-guest-capability-token"];
  }
  if (!token && request.headers["x-guest-token"]) {
    token = request.headers["x-guest-token"];
  }
  if (!token && request.headers.authorization?.startsWith("Bearer ")) {
    token = request.headers.authorization.slice(7);
  }

  const verified = verifyGuestCapabilityToken(token);
  if (!verified) {
    throw new HttpError(
      401,
      "GUEST_SESSION_EXPIRED",
      "Sesi akses tamu tidak valid atau telah kedaluwarsa. Silakan buka kembali tautan undangan WhatsApp Anda."
    );
  }

  // Database-backed state validation
  let requiredOp = "read";
  if (request.path.endsWith("/sign")) requiredOp = "sign";
  else if (request.path.endsWith("/identity")) requiredOp = "identity";
  else if (request.path.endsWith("/document")) requiredOp = "document";

  try {
    await validateGuestCapabilityState({
      guestCapability: verified,
      requiredOperation: requiredOp,
    });
  } catch (err) {
    const status = err.status || 403;
    const code = err.code || "GUEST_ACCESS_DENIED";
    throw new HttpError(status, code, err.message);
  }

  request.guest = verified;
  next();
});

/**
 * POST /api/v1/consents/invitations/claim
 * Public endpoint to atomically validate & claim an invitation token and establish a guest session.
 * Supports authenticated account linking with phone verification.
 */
router.post(
  "/invitations/claim",
  optionalAuthenticate,
  asyncHandler(async (request, response) => {
    response.setHeader("Referrer-Policy", "no-referrer");
    const body = parseBody(claimSchema, request.body);
    const claimerUserId = request.auth?.user?.id || null;
    const claimerProfile = request.auth?.profile || null;

    const result = await claimGuestInvitation({
      rawToken: body.token,
      claimerUserId,
      claimerProfile,
    });

    response.cookie("sicare_guest_token", result.guestToken, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 4 * 3600 * 1000,
    });

    return sendData(response, {
      success: true,
      guest_token: result.guestToken,
      consent_id: result.consentId,
      participant_id: result.participantId,
      booking_id: result.bookingId,
      linked_user_id: result.linkedUserId,
      consent: result.consent,
      participant: result.participant,
    });
  })
);

/**
 * GET /api/v1/consents/guest/me
 * Retrieves the guest's own draft consent record, participant data, and active template.
 */
router.get(
  "/guest/me",
  authenticateGuest,
  asyncHandler(async (request, response) => {
    const result = await getGuestConsent({ guestCapability: request.guest });
    return sendData(response, result);
  })
);

/**
 * PATCH /api/v1/consents/guest/me/identity
 * Updates draft participant identity attributes for a guest before signing.
 */
router.patch(
  "/guest/me/identity",
  authenticateGuest,
  asyncHandler(async (request, response) => {
    const body = parseBody(identitySchema, request.body);
    const updated = await updateGuestDraftIdentity({
      guestCapability: request.guest,
      identityData: body,
    });
    return sendData(response, updated);
  })
);

/**
 * POST /api/v1/consents/guest/me/sign
 * Submits the digital signature for a guest participant, compiles official PDF, and finalizes consent.
 */
router.post(
  "/guest/me/sign",
  authenticateGuest,
  asyncHandler(async (request, response) => {
    const body = parseBody(signPayloadSchema, request.body);
    const signatureBuffer = parseSignatureBase64(body.signature_base64);

    const result = await signGuestInformedConsent({
      guestCapability: request.guest,
      signatureBuffer,
      agreementAccepted: body.agreement_accepted,
      identityData: body.identity || {},
    });

    return sendData(response, result, 200);
  })
);

/**
 * GET /api/v1/consents/guest/me/document
 * Retrieves an authorized short-lived download URL for the guest's own signed PDF.
 */
router.get(
  "/guest/me/document",
  authenticateGuest,
  asyncHandler(async (request, response) => {
    const expiresIn = request.query.expires_in ? parseInt(request.query.expires_in, 10) : 60;
    const doc = await getGuestSignedDocumentDownloadUrl({
      guestCapability: request.guest,
      expiresInSeconds: Math.min(Math.max(expiresIn, 30), 300),
    });
    return sendData(response, doc);
  })
);

export default router;
