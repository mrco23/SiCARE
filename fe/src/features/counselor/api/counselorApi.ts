import { apiRequest } from "../../../services/api/apiClient";
import { buildQueryString } from "../../../services/api/apiQuery";
import type {
  CounselorAvailabilitySlotDto,
  CounselorFeedbackDto,
  CounselorHistoryPasswordStatusDto,
  CounselorHistoryResponseDto,
  CounselorHistoryVerifyResultDto,
  CounselorProfileDto,
  CounselorProfilePatchApi,
  CounselorAvailabilityStatusApi,
  SaveCounselorAvailabilityApi,
} from "../../../types/api";

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

  getHistoryPasswordStatus(): Promise<CounselorHistoryPasswordStatusDto> {
    return apiRequest<CounselorHistoryPasswordStatusDto>("/counselor/history-password/status", { auth: true });
  },

  initHistoryPassword(password: string): Promise<{ success: boolean; message: string }> {
    return apiRequest<{ success: boolean; message: string }>("/counselor/history-password/init", {
      method: "POST",
      auth: true,
      body: { password },
    });
  },

  verifyHistoryPassword(password: string): Promise<CounselorHistoryVerifyResultDto> {
    return apiRequest<CounselorHistoryVerifyResultDto>("/counselor/history-password/verify", {
      method: "POST",
      auth: true,
      body: { password },
    });
  },

  changeHistoryPassword(input: {
    current_password: string;
    new_password: string;
    confirm_password: string;
  }): Promise<{ success: boolean; message: string }> {
    return apiRequest<{ success: boolean; message: string }>("/counselor/history-password/change", {
      method: "POST",
      auth: true,
      body: input,
    });
  },

  getHistory(grantToken?: string): Promise<CounselorHistoryResponseDto> {
    return apiRequest<CounselorHistoryResponseDto>("/counselor/history", {
      auth: true,
      headers: grantToken ? { "x-counselor-history-grant": grantToken } : undefined,
    });
  },
};

