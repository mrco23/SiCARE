import { z } from "zod";
import { HttpError, parseBody, sendData } from "../lib/http.js";
import { env } from "../config/env.js";
import {
  identitySchema,
  signPayloadSchema,
} from "../validators/consent.validator.js";
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

const uuidSchema = z.string().uuid();
const claimSchema = z.object({
  token: z.string().trim().min(10).max(128),
});

function parseSignatureBase64(dataOrBase64) {
  let base64 = dataOrBase64;
  if (base64.includes(",")) {
    base64 = base64.split(",")[1];
  }
  return Buffer.from(base64, "base64");
}

export const consentController = {
  async getMyConsent(req, res) {
    const bookingId = uuidSchema.parse(req.params.bookingId);
    const authUser = req.auth.user;

    const participants = await ensureBookingParticipants({ bookingId });
    const myParticipant = participants.find((p) => p.user_id === authUser.id);

    if (!myParticipant) {
      throw new HttpError(404, "PARTICIPANT_NOT_FOUND", "Anda tidak terdaftar sebagai peserta dalam booking ini.");
    }

    const { consent } = await initializeConsentForParticipant({
      bookingId,
      participantId: myParticipant.id,
    });

    const fullConsent = await getConsentById({
      consentId: consent.id,
      authUser,
      authRole: req.auth.profile.app_role,
    });

    return sendData(res, fullConsent);
  },

  async getReadiness(req, res) {
    const bookingId = uuidSchema.parse(req.params.bookingId);
    const status = await getBookingConsentStatus({ bookingId });
    return sendData(res, status);
  },

  async getConsent(req, res) {
    const consentId = uuidSchema.parse(req.params.id);
    const consent = await getConsentById({
      consentId,
      authUser: req.auth.user,
      authRole: req.auth.profile.app_role,
    });

    return sendData(res, consent);
  },

  async updateDraftIdentity(req, res) {
    const consentId = uuidSchema.parse(req.params.id);
    const body = parseBody(identitySchema, req.body);

    const updated = await updateDraftConsentIdentity({
      consentId,
      authUser: req.auth.user,
      identityData: body,
    });

    return sendData(res, updated);
  },

  async signConsent(req, res) {
    const consentId = uuidSchema.parse(req.params.id);
    const body = parseBody(signPayloadSchema, req.body);
    const signatureBuffer = parseSignatureBase64(body.signature_base64);

    const result = await signInformedConsent({
      consentId,
      authUser: req.auth.user,
      authRole: req.auth.profile.app_role,
      signatureBuffer,
      agreementAccepted: body.agreement_accepted,
      identityData: body.identity || {},
      idempotencyKey: body.idempotency_key,
    });

    return sendData(res, result, 200);
  },

  async getDocumentUrl(req, res) {
    const consentId = uuidSchema.parse(req.params.id);
    const expiresIn = req.query.expires_in ? parseInt(req.query.expires_in, 10) : 60;

    const doc = await getSignedDocumentDownloadUrl({
      consentId,
      authUser: req.auth.user,
      authRole: req.auth.profile.app_role,
      expiresInSeconds: Math.min(Math.max(expiresIn, 30), 300),
    });

    return sendData(res, doc);
  },

  async getGroupSummary(req, res) {
    const bookingId = uuidSchema.parse(req.params.bookingId);
    const summary = await getGroupConsentSummary({
      bookingId,
      authUser: req.auth.user,
      authRole: req.auth.profile.app_role,
    });
    return sendData(res, summary);
  },

  async resendInvitation(req, res) {
    const bookingId = uuidSchema.parse(req.params.bookingId);
    const participantId = uuidSchema.parse(req.params.participantId);

    const result = await resendConsentInvitation({
      bookingId,
      participantId,
      authUser: req.auth.user,
      authRole: req.auth.profile.app_role,
    });

    return sendData(res, result);
  },

  async authenticateGuestMiddleware(req, res, next) {
    res.setHeader("Referrer-Policy", "no-referrer");

    let token = null;
    if (req.headers.cookie) {
      const match = req.headers.cookie.match(/(?:^|;\s*)sicare_guest_token=([^;]*)/);
      if (match) token = decodeURIComponent(match[1]);
    }
    if (!token && req.headers["x-guest-capability-token"]) {
      token = req.headers["x-guest-capability-token"];
    }
    if (!token && req.headers["x-guest-token"]) {
      token = req.headers["x-guest-token"];
    }
    if (!token && req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.slice(7);
    }

    const verified = verifyGuestCapabilityToken(token);
    if (!verified) {
      throw new HttpError(
        401,
        "GUEST_SESSION_EXPIRED",
        "Sesi akses tamu tidak valid atau telah kedaluwarsa. Silakan buka kembali tautan undangan WhatsApp Anda."
      );
    }

    let requiredOp = "read";
    if (req.path.endsWith("/sign")) requiredOp = "sign";
    else if (req.path.endsWith("/identity")) requiredOp = "identity";
    else if (req.path.endsWith("/document")) requiredOp = "document";

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

    req.guest = verified;
    next();
  },

  async claimGuestInvitation(req, res) {
    res.setHeader("Referrer-Policy", "no-referrer");
    const body = parseBody(claimSchema, req.body);
    const claimerUserId = req.auth?.user?.id || null;
    const claimerProfile = req.auth?.profile || null;

    const result = await claimGuestInvitation({
      rawToken: body.token,
      claimerUserId,
      claimerProfile,
    });

    res.cookie("sicare_guest_token", result.guestToken, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 4 * 3600 * 1000,
    });

    return sendData(res, {
      success: true,
      guest_token: result.guestToken,
      consent_id: result.consentId,
      participant_id: result.participantId,
      booking_id: result.bookingId,
      linked_user_id: result.linkedUserId,
      consent: result.consent,
      participant: result.participant,
    });
  },

  async getGuestConsent(req, res) {
    const result = await getGuestConsent({ guestCapability: req.guest });
    return sendData(res, result);
  },

  async updateGuestDraftIdentity(req, res) {
    const body = parseBody(identitySchema, req.body);
    const updated = await updateGuestDraftIdentity({
      guestCapability: req.guest,
      identityData: body,
    });
    return sendData(res, updated);
  },

  async signGuestConsent(req, res) {
    const body = parseBody(signPayloadSchema, req.body);
    const signatureBuffer = parseSignatureBase64(body.signature_base64);

    const result = await signGuestInformedConsent({
      guestCapability: req.guest,
      signatureBuffer,
      agreementAccepted: body.agreement_accepted,
      identityData: body.identity || {},
    });

    return sendData(res, result, 200);
  },

  async getGuestDocumentUrl(req, res) {
    const expiresIn = req.query.expires_in ? parseInt(req.query.expires_in, 10) : 60;
    const doc = await getGuestSignedDocumentDownloadUrl({
      guestCapability: req.guest,
      expiresInSeconds: Math.min(Math.max(expiresIn, 30), 300),
    });
    return sendData(res, doc);
  },
};

