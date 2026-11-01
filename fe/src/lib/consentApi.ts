import { apiRequest } from "./api";
import type {
  ConsentDocumentDownloadDto,
  ConsentIdentityDto,
  InformedConsentDto,
  SignConsentPayloadApi,
  SignConsentResultApi,
  BookingConsentReadinessDto,
  GroupConsentSummaryDto,
  ClaimGuestInvitationResultDto,
} from "../types/api";

export const consentApi = {
  /**
   * Retrieves or initializes the current authenticated user's consent record for a booking.
   */
  getMyConsentForBooking(bookingId: string): Promise<InformedConsentDto> {
    return apiRequest<InformedConsentDto>(`/consents/booking/${encodeURIComponent(bookingId)}/my-consent`, {
      auth: true,
    });
  },

  /**
   * Retrieves operational consent readiness status for a booking.
   */
  getBookingConsentReadiness(bookingId: string): Promise<BookingConsentReadinessDto> {
    return apiRequest<BookingConsentReadinessDto>(`/consents/booking/${encodeURIComponent(bookingId)}/readiness`, {
      auth: true,
    });
  },

  /**
   * Retrieves a consent record by ID.
   */
  getConsent(consentId: string): Promise<InformedConsentDto> {
    return apiRequest<InformedConsentDto>(`/consents/${encodeURIComponent(consentId)}`, {
      auth: true,
    });
  },

  /**
   * Updates draft participant identity attributes before signing.
   */
  updateDraftIdentity(consentId: string, identity: Partial<ConsentIdentityDto>): Promise<InformedConsentDto> {
    return apiRequest<InformedConsentDto>(`/consents/${encodeURIComponent(consentId)}/identity`, {
      method: "PATCH",
      auth: true,
      body: identity,
    });
  },

  /**
   * Submits the digital signature and finalizes the Informed Consent document.
   */
  signConsent(consentId: string, payload: SignConsentPayloadApi): Promise<SignConsentResultApi> {
    return apiRequest<SignConsentResultApi>(`/consents/${encodeURIComponent(consentId)}/sign`, {
      method: "POST",
      auth: true,
      body: payload,
    });
  },

  /**
   * Retrieves an authorized short-lived download URL for the signed PDF document.
   */
  getSignedDocumentUrl(consentId: string, expiresIn = 60): Promise<ConsentDocumentDownloadDto> {
    return apiRequest<ConsentDocumentDownloadDto>(
      `/consents/${encodeURIComponent(consentId)}/document?expires_in=${expiresIn}`,
      { auth: true }
    );
  },

  /**
   * Retrieves privacy-respecting Group Consent summary for the Primary Client, Counselor, or Admin.
   */
  getGroupConsentSummary(bookingId: string): Promise<GroupConsentSummaryDto> {
    return apiRequest<GroupConsentSummaryDto>(
      `/consents/booking/${encodeURIComponent(bookingId)}/group-summary`,
      { auth: true }
    );
  },

  /**
   * Resends an invitation to an unconsented group participant.
   */
  resendConsentInvitation(bookingId: string, participantId: string): Promise<{ success: boolean; invitationId: string }> {
    return apiRequest<{ success: boolean; invitationId: string }>(
      `/consents/booking/${encodeURIComponent(bookingId)}/participants/${encodeURIComponent(participantId)}/resend-invitation`,
      {
        method: "POST",
        auth: true,
      }
    );
  },

  /**
   * Claims a guest invitation token and initializes session capability.
   */
  claimGuestInvitation(token: string): Promise<ClaimGuestInvitationResultDto> {
    return apiRequest<ClaimGuestInvitationResultDto>("/consents/invitations/claim", {
      method: "POST",
      body: { token },
      credentials: "include",
    });
  },

  /**
   * Retrieves guest participant's consent record using capability token or cookie.
   */
  getGuestConsent(guestToken?: string): Promise<InformedConsentDto> {
    return apiRequest<InformedConsentDto>("/consents/guest/me", {
      headers: guestToken ? { "x-guest-token": guestToken } : undefined,
      credentials: "include",
    });
  },

  /**
   * Updates guest participant's draft identity attributes.
   */
  updateGuestDraftIdentity(
    identity: Partial<ConsentIdentityDto>,
    guestToken?: string
  ): Promise<InformedConsentDto> {
    return apiRequest<InformedConsentDto>("/consents/guest/me/identity", {
      method: "PATCH",
      body: identity,
      headers: guestToken ? { "x-guest-token": guestToken } : undefined,
      credentials: "include",
    });
  },

  /**
   * Submits the digital signature and finalizes the Informed Consent for a guest participant.
   */
  signGuestConsent(
    payload: SignConsentPayloadApi,
    guestToken?: string
  ): Promise<SignConsentResultApi> {
    return apiRequest<SignConsentResultApi>("/consents/guest/me/sign", {
      method: "POST",
      body: payload,
      headers: guestToken ? { "x-guest-token": guestToken } : undefined,
      credentials: "include",
    });
  },

  /**
   * Retrieves an authorized download URL for the guest participant's signed PDF document.
   */
  getGuestSignedDocumentUrl(
    expiresIn = 60,
    guestToken?: string
  ): Promise<ConsentDocumentDownloadDto> {
    return apiRequest<ConsentDocumentDownloadDto>(
      `/consents/guest/me/document?expires_in=${expiresIn}`,
      {
        headers: guestToken ? { "x-guest-token": guestToken } : undefined,
        credentials: "include",
      }
    );
  },
};
