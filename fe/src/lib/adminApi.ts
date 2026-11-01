import { apiRequest } from "./api";
import { buildQueryString } from "./apiQuery";
import type {
  AcademicPeriodRecordDto,
  AdminAccountDto,
  UpdatedAdminAccountDto,
  DeactivatedAdminAccountDto,
  AdminAccountQueryApi,
  AdminActivityDto,
  AdminCounselingDto,
  AdminFeedbackDto,
  CounselorPublicationDto,
  CreateAcademicPeriodApi,
  CreateAdminAccountApi,
  CreateHeroMotivationApi,
  DeleteRecordResultDto,
  FeedbackModerationApi,
  FeedbackReviewApi,
  FeedbackReviewStatusApi,
  FeedbackModerationStatusApi,
  FeedbackStatisticsDto,
  HeroMotivationAdminDto,
  UpdateAcademicPeriodApi,
  UpdateAdminAccountApi,
  UpdateHeroMotivationApi,
  AppRoleApi,
} from "../types/api";

/** Admin and review-queue API operations. Backend authorization remains authoritative. */
export const adminApi = {
  listAccounts(filters: AdminAccountQueryApi = {}): Promise<AdminAccountDto[]> {
    return apiRequest<AdminAccountDto[]>(`/admin/accounts${buildQueryString({
      role: filters.role,
      status: filters.status,
      search: filters.search,
      limit: filters.limit,
    })}`, { auth: true });
  },

  getAccount(accountId: string): Promise<AdminAccountDto> {
    return apiRequest<AdminAccountDto>(`/admin/accounts/${encodeURIComponent(accountId)}`, { auth: true });
  },

  createAccount(input: CreateAdminAccountApi): Promise<AdminAccountDto> {
    return apiRequest<AdminAccountDto>("/admin/accounts", { method: "POST", auth: true, body: input });
  },

  updateAccount(accountId: string, input: UpdateAdminAccountApi): Promise<UpdatedAdminAccountDto> {
    return apiRequest<UpdatedAdminAccountDto>(`/admin/accounts/${encodeURIComponent(accountId)}`, {
      method: "PATCH",
      auth: true,
      body: input,
    });
  },

  deactivateAccount(accountId: string): Promise<DeactivatedAdminAccountDto> {
    return apiRequest<DeactivatedAdminAccountDto>(`/admin/accounts/${encodeURIComponent(accountId)}`, {
      method: "DELETE",
      auth: true,
    });
  },

  setCounselorPublication(counselorId: string, isPublic: boolean): Promise<CounselorPublicationDto> {
    return apiRequest<CounselorPublicationDto>(`/admin/counselors/${encodeURIComponent(counselorId)}/publication`, {
      method: "PATCH",
      auth: true,
      body: { is_public: isPublic },
    });
  },

  listAcademicPeriods(): Promise<AcademicPeriodRecordDto[]> {
    return apiRequest<AcademicPeriodRecordDto[]>("/admin/periods", { auth: true });
  },

  createAcademicPeriod(input: CreateAcademicPeriodApi): Promise<AcademicPeriodRecordDto> {
    return apiRequest<AcademicPeriodRecordDto>("/admin/periods", { method: "POST", auth: true, body: input });
  },

  updateAcademicPeriod(periodId: string, input: UpdateAcademicPeriodApi): Promise<AcademicPeriodRecordDto> {
    return apiRequest<AcademicPeriodRecordDto>(`/admin/periods/${encodeURIComponent(periodId)}`, {
      method: "PATCH",
      auth: true,
      body: input,
    });
  },

  deleteAcademicPeriod(periodId: string): Promise<DeleteRecordResultDto> {
    return apiRequest<DeleteRecordResultDto>(`/admin/periods/${encodeURIComponent(periodId)}`, {
      method: "DELETE",
      auth: true,
    });
  },

  listCounseling(limit = 50): Promise<AdminCounselingDto[]> {
    return apiRequest<AdminCounselingDto[]>(`/admin/counseling${buildQueryString({ limit })}`, { auth: true });
  },

  listActivity(limit = 50): Promise<AdminActivityDto[]> {
    return apiRequest<AdminActivityDto[]>(`/admin/activity${buildQueryString({ limit })}`, { auth: true });
  },

  listHeroMotivations(): Promise<HeroMotivationAdminDto[]> {
    return apiRequest<HeroMotivationAdminDto[]>("/admin/hero-motivations", { auth: true });
  },

  createHeroMotivation(input: CreateHeroMotivationApi): Promise<HeroMotivationAdminDto> {
    return apiRequest<HeroMotivationAdminDto>("/admin/hero-motivations", { method: "POST", auth: true, body: input });
  },

  updateHeroMotivation(id: string, input: UpdateHeroMotivationApi): Promise<HeroMotivationAdminDto> {
    return apiRequest<HeroMotivationAdminDto>(`/admin/hero-motivations/${encodeURIComponent(id)}`, {
      method: "PATCH",
      auth: true,
      body: input,
    });
  },

  deleteHeroMotivation(id: string): Promise<{ deleted: true; id: string }> {
    return apiRequest<{ deleted: true; id: string }>(`/admin/hero-motivations/${encodeURIComponent(id)}`, {
      method: "DELETE",
      auth: true,
    });
  },

  listFeedback(filters: {
    moderation_status?: FeedbackModerationStatusApi;
    review_status?: FeedbackReviewStatusApi;
    limit?: number;
  } = {}): Promise<AdminFeedbackDto[]> {
    return apiRequest<AdminFeedbackDto[]>(`/admin/feedback${buildQueryString({
      moderation_status: filters.moderation_status,
      review_status: filters.review_status,
      limit: filters.limit,
    })}`, { auth: true });
  },

  getFeedback(feedbackId: string): Promise<AdminFeedbackDto> {
    return apiRequest<AdminFeedbackDto>(`/admin/feedback/${encodeURIComponent(feedbackId)}`, { auth: true });
  },

  getFeedbackStatistics(): Promise<FeedbackStatisticsDto> {
    return apiRequest<FeedbackStatisticsDto>("/admin/feedback/statistics", { auth: true });
  },

  moderateFeedback(feedbackId: string, input: FeedbackModerationApi): Promise<AdminFeedbackDto> {
    return apiRequest<AdminFeedbackDto>(`/admin/feedback/${encodeURIComponent(feedbackId)}/moderation`, {
      method: "PATCH",
      auth: true,
      body: input,
    });
  },

  reviewFeedback(feedbackId: string, input: FeedbackReviewApi): Promise<AdminFeedbackDto> {
    return apiRequest<AdminFeedbackDto>(`/admin/feedback/${encodeURIComponent(feedbackId)}/review`, {
      method: "PATCH",
      auth: true,
      body: input,
    });
  },
};

// Re-export role type so callers can build filter UIs without duplicating string unions.
export type AdminRoleFilter = AppRoleApi;
