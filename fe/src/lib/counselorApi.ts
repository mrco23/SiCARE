import { apiRequest } from "./api";
import { buildQueryString } from "./apiQuery";
import type {
  CounselorAvailabilitySlotDto,
  CounselorFeedbackDto,
  CounselorProfileDto,
  CounselorProfilePatchApi,
  CounselorAvailabilityStatusApi,
  SaveCounselorAvailabilityApi,
} from "../types/api";

/** API operations owned by the counselor workspace. */
export const counselorApi = {
  getProfile(): Promise<CounselorProfileDto> {
    return apiRequest<CounselorProfileDto>("/counselor/profile", { auth: true });
  },

  updateProfile(input: CounselorProfilePatchApi): Promise<CounselorProfileDto> {
    return apiRequest<CounselorProfileDto>("/counselor/profile", {
      method: "PATCH",
      auth: true,
      body: input,
    });
  },

  getAvailability(status?: CounselorAvailabilityStatusApi): Promise<CounselorAvailabilitySlotDto[]> {
    return apiRequest<CounselorAvailabilitySlotDto[]>(`/counselor/availability${buildQueryString({ status })}`, {
      auth: true,
    });
  },

  createAvailability(input: SaveCounselorAvailabilityApi): Promise<CounselorAvailabilitySlotDto> {
    return apiRequest<CounselorAvailabilitySlotDto>("/counselor/availability", {
      method: "POST",
      auth: true,
      body: input,
    });
  },

  updateAvailability(slotId: string, input: SaveCounselorAvailabilityApi): Promise<CounselorAvailabilitySlotDto> {
    return apiRequest<CounselorAvailabilitySlotDto>(`/counselor/availability/${encodeURIComponent(slotId)}`, {
      method: "PATCH",
      auth: true,
      body: input,
    });
  },

  cancelAvailability(slotId: string): Promise<{ id: string; status: "cancelled" }> {
    return apiRequest<{ id: string; status: "cancelled" }>(`/counselor/availability/${encodeURIComponent(slotId)}`, {
      method: "DELETE",
      auth: true,
    });
  },

  getFeedback(options: { rating?: number; limit?: number } = {}): Promise<CounselorFeedbackDto[]> {
    return apiRequest<CounselorFeedbackDto[]>(`/feedback/counselor${buildQueryString({
      rating: options.rating,
      limit: options.limit,
    })}`, { auth: true });
  },
};
