import { apiRequest } from "../../../services/api/apiClient";
import type {
  ConsentDocumentDownloadDto,
  InformedConsentDto,
  SignConsentPayloadApi,
  SignConsentResultApi,
  BookingConsentReadinessDto,
  GroupConsentSummaryDto,
  ClaimGuestInvitationResultDto,
  ResendConsentInvitationResultDto,
} from "../../../types/api";

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

  /** Mengeluarkan anggota kelompok yang belum menandatangani (bukan perwakilan). */
  removeGroupParticipant(
    bookingId: string,
    participantId: string,
  ): Promise<{ success: boolean; participant_id: string; active_participants: number }> {
    return apiRequest(
      `/consents/booking/${encodeURIComponent(bookingId)}/participants/${encodeURIComponent(participantId)}/remove`,
      { method: "POST", auth: true },
    );
  },

  /**
   * Resends an invitation to an unconsented group participant.
   */
  resendConsentInvitation(bookingId: string, participantId: string): Promise<ResendConsentInvitationResultDto> {
    return apiRequest<ResendConsentInvitationResultDto>(
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

