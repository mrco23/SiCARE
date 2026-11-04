import { apiRequest } from "../../../services/api/apiClient";
import { buildQueryString } from "../../../services/api/apiQuery";
import type * as ApiTypes from "../../../types/api";

// Backward-compatible aliases retained while pages migrate to canonical DTO names.
export type BookingRecordApi = ApiTypes.BookingListItemDto;
export type SessionRecordApi = ApiTypes.SessionListItemDto;
export type FeedbackRecordApi = ApiTypes.ClientFeedbackDto;
export type PublicCounselor = ApiTypes.PublicCounselorDto;
export type AvailabilitySlot = ApiTypes.PublicAvailabilitySlotDto;
export type NotificationRecordApi = ApiTypes.NotificationDto;
export type NotificationListApi = ApiTypes.NotificationListDto;
export type CreateBookingInputApi = ApiTypes.CreateBookingApi;
export type {
  BookingStatusApi,
  SessionStatusApi,
  FeedbackModerationStatusApi,
  FeedbackReviewStatusApi,
} from "../../../types/api";

/** Authenticated API operations shared by client and counselor workflows. */
export const sicareApi = {
  getProfile(): Promise<ApiTypes.ProfileDto> {
    return apiRequest<ApiTypes.ProfileDto>("/profile", { auth: true });
  },

  updateProfile(input: ApiTypes.ProfilePatchApi): Promise<ApiTypes.ProfileDto> {
    return apiRequest<ApiTypes.ProfileDto>("/profile", { method: "PATCH", auth: true, body: input });
  },

  uploadPhoto(imageData: string): Promise<ApiTypes.ProfilePhotoResultDto> {
    return apiRequest<ApiTypes.ProfilePhotoResultDto>("/profile/photo", {
      method: "POST",
      auth: true,
      body: { image_data: imageData },
    });
  },

  deletePhoto(): Promise<{ success: boolean; message: string }> {
    return apiRequest<{ success: boolean; message: string }>("/profile/photo", {
      method: "DELETE",
      auth: true,
    });
  },

  setWhatsAppConsent(input: ApiTypes.WhatsAppConsentApi): Promise<ApiTypes.WhatsAppConsentResultApi> {
    return apiRequest<ApiTypes.WhatsAppConsentResultApi>("/profile/whatsapp-consent", {
      method: "PATCH",
      auth: true,
      body: input,
    });
  },

  bookings(limit = 50, status?: ApiTypes.BookingStatusApi): Promise<ApiTypes.BookingListItemDto[]> {
    return apiRequest<ApiTypes.BookingListItemDto[]>(`/bookings${buildQueryString({ limit, status })}`, { auth: true });
  },

  booking(bookingId: string): Promise<ApiTypes.BookingDetailDto> {
    return apiRequest<ApiTypes.BookingDetailDto>(`/bookings/${encodeURIComponent(bookingId)}`, { auth: true });
  },

  createBooking(input: ApiTypes.CreateBookingApi): Promise<ApiTypes.BookingDetailDto> {
    return apiRequest<ApiTypes.BookingDetailDto>("/bookings", { method: "POST", auth: true, body: input });
  },

  transitionBooking(bookingId: string, input: ApiTypes.BookingTransitionApi): Promise<ApiTypes.BookingDetailDto> {
    return apiRequest<ApiTypes.BookingDetailDto>(`/bookings/${encodeURIComponent(bookingId)}/status`, {
      method: "PATCH",
      auth: true,
      body: input,
    });
  },

  rescheduleBooking(bookingId: string, availabilitySlotId: string): Promise<ApiTypes.BookingDetailDto> {
    return apiRequest<ApiTypes.BookingDetailDto>(`/bookings/${encodeURIComponent(bookingId)}/reschedule`, {
      method: "PATCH",
      auth: true,
      body: { availability_slot_id: availabilitySlotId },
    });
  },

  sessions(limit = 50, status?: ApiTypes.SessionStatusApi): Promise<ApiTypes.SessionListItemDto[]> {
    return apiRequest<ApiTypes.SessionListItemDto[]>(`/sessions${buildQueryString({ limit, status })}`, { auth: true });
  },

  session(sessionId: string): Promise<ApiTypes.SessionDetailDto> {
    return apiRequest<ApiTypes.SessionDetailDto>(`/sessions/${encodeURIComponent(sessionId)}`, { auth: true });
  },

  transitionSession(sessionId: string, input: ApiTypes.SessionStatusTransitionApi): Promise<ApiTypes.SessionDetailDto> {
    return apiRequest<ApiTypes.SessionDetailDto>(`/sessions/${encodeURIComponent(sessionId)}/status`, {
      method: "PATCH",
      auth: true,
      body: input,
    });
  },

  myFeedback(): Promise<ApiTypes.ClientFeedbackDto[]> {
    return apiRequest<ApiTypes.ClientFeedbackDto[]>("/feedback/mine", { auth: true });
  },

  submitFeedback(sessionId: string, input: ApiTypes.SubmitFeedbackApi): Promise<ApiTypes.SubmittedFeedbackDto> {
    return apiRequest<ApiTypes.SubmittedFeedbackDto>(`/sessions/${encodeURIComponent(sessionId)}/feedback`, {
      method: "POST",
      auth: true,
      body: input,
    });
  },

  notifications(unreadOnly = false, limit = 30): Promise<ApiTypes.NotificationListDto> {
    return apiRequest<ApiTypes.NotificationListDto>(`/notifications${buildQueryString({ unread_only: unreadOnly, limit })}`, {
      auth: true,
    });
  },

  markNotificationRead(notificationId: string): Promise<ApiTypes.NotificationDto> {
    return apiRequest<ApiTypes.NotificationDto>(`/notifications/${encodeURIComponent(notificationId)}/read`, {
      method: "PATCH",
      auth: true,
      body: {},
    });
  },

  markAllNotificationsRead(): Promise<ApiTypes.MarkAllNotificationsReadDto> {
    return apiRequest<ApiTypes.MarkAllNotificationsReadDto>("/notifications/read-all", {
      method: "PATCH",
      auth: true,
      body: {},
    });
  },
};

export const bookingApi = sicareApi;

