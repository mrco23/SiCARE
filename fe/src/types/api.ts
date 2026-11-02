/**
 * Canonical DTOs for the SiCARE /api/v1 contract.
 * Keep these shapes aligned with the SELECT projections and response bodies in be/src/routes.
 * UI-only view models belong in feature/page modules, not in this file.
 */

export type AppRoleApi = "client" | "counselor" | "admin" | "head_lmi";
export type AccountStatusApi = "pending" | "active" | "disabled";
export type MemberCategoryApi = "student" | "faculty_staff" | "other";

export type BookingStatusApi =
  | "waiting_confirmation"
  | "confirmed"
  | "rejected"
  | "reschedule_requested"
  | "cancelled";

export type SessionStatusApi = "scheduled" | "ongoing" | "completed" | "cancelled";
export type FeedbackModerationStatusApi = "pending" | "shown" | "disabled";
export type FeedbackReviewStatusApi = "new" | "reviewed" | "resolved";
export type AcademicSemesterApi = "Ganjil" | "Genap";
export type CounselorAvailabilityStatusApi = "available" | "blocked" | "cancelled";

// Public directory DTOs
export interface PublicCounselorDto {
  profile_id: string;
  public_name: string;
  headline: string | null;
  bio: string | null;
  specialties: string[] | null;
  years_experience: number | null;
  photo_path: string | null;
}

export interface PublicAcademicPeriodDto {
  id: string;
  academic_year: string;
  semester: string;
  starts_on: string;
  ends_on: string;
}

/** Public availability is filtered by the backend to status=available. */
export interface PublicAvailabilitySlotDto {
  id: string;
  counselor_id: string;
  academic_period_id: string | null;
  starts_at: string;
  ends_at: string;
  status: "available";
}

export interface PublicFeedbackDto {
  id: string;
  rating: number;
  comment: string | null;
  counselor_id: string;
  created_at: string;
}

export interface PublicHeroMotivationDto {
  id: string;
  content: string;
}

// Authenticated profile DTOs
export interface ProfileDto {
  id: string;
  identity_code: string | null;
  full_name: string;
  app_role: AppRoleApi;
  member_category: MemberCategoryApi | null;
  account_status: AccountStatusApi;
  phone_e164: string | null;
  whatsapp_opt_in: boolean;
  avatar_url?: string | null;
  photo_path?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProfilePhotoResultDto {
  storage_path: string;
  photo_url: string;
}

export interface ProfilePatchApi {
  full_name?: string;
  phone_e164?: string | null;
}

export interface WhatsAppConsentApi {
  opted_in: boolean;
}

export interface WhatsAppConsentResultApi {
  id: string;
  whatsapp_opt_in: boolean;
  whatsapp_opt_in_at: string | null;
  updated_at: string;
}

// Counselor profile and availability DTOs
export interface CounselorProfileDto {
  profile_id: string;
  public_name: string;
  headline: string | null;
  bio: string | null;
  specialties: string[] | null;
  years_experience: number | null;
  photo_path: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface CounselorProfilePatchApi {
  public_name?: string;
  headline?: string | null;
  bio?: string | null;
  specialties?: string[];
  years_experience?: number | null;
  photo_path?: string | null;
}

export interface CounselorAvailabilitySlotDto {
  id: string;
  counselor_id: string;
  academic_period_id: string | null;
  starts_at: string;
  ends_at: string;
  status: CounselorAvailabilityStatusApi;
  created_at: string;
  updated_at: string;
}

export interface SaveCounselorAvailabilityApi {
  starts_at: string;
  ends_at: string;
  academic_period_id?: string | null;
}

export interface CounselorPublicationDto {
  profile_id: string;
  public_name: string;
  is_public: boolean;
  updated_at: string;
}

export interface CounselorHistoryPasswordStatusDto {
  configured: boolean;
}

export interface CounselorHistoryVerifyResultDto {
  success: boolean;
  grant_token: string;
  token: string;
  expires_in_seconds: number;
  expires_at: string;
}

export interface CounselorHistoryResponseDto {
  configured: boolean;
  sessions: SessionListItemDto[];
  bookings: BookingRecordBaseDto[];
  clients: Array<{
    id: string;
    full_name: string;
    student_id?: string | null;
    faculty?: string | null;
    study_program?: string | null;
    phone_e164?: string | null;
  }>;
  message?: string;
}

// Booking DTOs. List and detail currently share the same projection. They remain
// separate semantic names so a future endpoint expansion can be explicit.
export interface BookingParticipantDto {
  id: string;
  display_name: string;
  full_name?: string | null;
  phone_e164?: string | null;
  is_representative: boolean;
  participant_status?: string;
}

export interface BookingRecordBaseDto {
  id: string;
  client_id: string;
  counselor_id: string;
  availability_slot_id: string | null;
  service_type: "individual" | "group";
  group_name: string | null;
  participant_count: number;
  starts_at: string;
  ends_at: string;
  status: BookingStatusApi;
  cancellation_reason: string | null;
  reschedule_reason: string | null;
  created_at: string;
  updated_at: string;
  booking_participants: BookingParticipantDto[];
}

export type BookingListItemDto = BookingRecordBaseDto;
export type BookingDetailDto = BookingRecordBaseDto;

export interface CreateBookingApi {
  counselor_id: string;
  availability_slot_id: string;
  service_type: "individual" | "group";
  group_name?: string | null;
  participants: Array<{
    display_name: string;
    full_name?: string;
    phone_e164?: string | null;
    is_representative: boolean;
  }>;
}

export interface BookingTransitionApi {
  status: "confirmed" | "rejected" | "reschedule_requested" | "cancelled";
  reason?: string;
  session_format?: "online" | "offline";
  room?: string | null;
}

// Session list response has no nested booking. The detail/status endpoints include
// the booking context selected by session.routes.js.
export interface SessionListItemDto {
  id: string;
  booking_id: string;
  counselor_id: string;
  starts_at: string;
  ends_at: string;
  status: SessionStatusApi;
  format: "online" | "offline" | null;
  room: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SessionBookingContextDto {
  id: string;
  client_id: string;
  counselor_id: string;
  service_type: "individual" | "group";
  group_name: string | null;
  participant_count: number;
  status: BookingStatusApi;
}

export interface SessionDetailDto extends SessionListItemDto {
  booking: SessionBookingContextDto;
}

export interface SessionStatusTransitionApi {
  status: "ongoing" | "completed" | "cancelled";
}

// Feedback DTOs differ by endpoint projection. Do not use one permissive interface
// for client, counselor, public, and admin responses.
export interface ClientFeedbackDto {
  id: string;
  session_id: string;
  counselor_id: string;
  rating: number;
  comment: string | null;
  moderation_status: FeedbackModerationStatusApi;
  review_status: FeedbackReviewStatusApi;
  created_at: string;
  updated_at: string;
}

export interface SubmitFeedbackApi {
  rating: number;
  comment: string | null;
}

export interface SubmittedFeedbackDto extends ClientFeedbackDto {
  client_id: string;
}

export interface CounselorFeedbackDto {
  id: string;
  session_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  counselor_id: string;
}

export interface AdminFeedbackDto extends SubmittedFeedbackDto {
  disabled_reason: string | null;
}

export type FeedbackModerationApi =
  | { moderation_status: "disabled"; disabled_reason: string }
  | { moderation_status: "pending" | "shown"; disabled_reason?: never };

export interface FeedbackReviewApi {
  review_status: FeedbackReviewStatusApi;
}

export interface FeedbackStatisticsDto {
  moderation: Record<FeedbackModerationStatusApi, number>;
  review: Record<FeedbackReviewStatusApi, number>;
}

// Notifications
export interface NotificationDto {
  id: string;
  type: string;
  title: string;
  body: string;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string;
  read_at: string | null;
}

export interface NotificationListDto {
  items: NotificationDto[];
  unread_count: number;
}

export interface MarkAllNotificationsReadDto {
  marked_read: number;
}

// Admin account and data-management DTOs
export interface AdminAccountRecordDto {
  id: string;
  identity_code: string | null;
  full_name: string;
  app_role: AppRoleApi;
  member_category: MemberCategoryApi | null;
  account_status: AccountStatusApi;
  phone_e164: string | null;
  whatsapp_opt_in?: boolean;
  created_at: string;
  updated_at: string;
}

/** List/detail/create responses add email after reading Supabase Auth metadata. */
export interface AdminAccountDto extends AdminAccountRecordDto {
  email: string | null;
}

/** PATCH account response contains the profile projection but not email. */
export type UpdatedAdminAccountDto = AdminAccountRecordDto;

/** DELETE account is a soft-disable operation with a deliberately smaller response. */
export interface DeactivatedAdminAccountDto {
  id: string;
  app_role: AppRoleApi;
  account_status: "disabled";
  deactivated: true;
}

export interface CreateAdminAccountApi {
  email: string;
  password: string;
  full_name: string;
  identity_code?: string | null;
  member_category?: MemberCategoryApi | null;
  app_role?: AppRoleApi;
  account_status?: AccountStatusApi;
}

export interface UpdateAdminAccountApi {
  full_name?: string;
  identity_code?: string | null;
  member_category?: MemberCategoryApi | null;
  phone_e164?: string | null;
  app_role?: AppRoleApi;
  account_status?: AccountStatusApi;
}

export interface AdminAccountQueryApi {
  role?: AppRoleApi;
  status?: AccountStatusApi;
  search?: string;
  limit?: number;
}

export interface AcademicPeriodRecordDto {
  id: string;
  academic_year: string;
  semester: AcademicSemesterApi;
  starts_on: string;
  ends_on: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateAcademicPeriodApi {
  academic_year: string;
  semester: AcademicSemesterApi;
  starts_on: string;
  ends_on: string;
  is_published?: boolean;
}

export type UpdateAcademicPeriodApi = Partial<CreateAcademicPeriodApi>;

export interface DeleteRecordResultDto {
  deleted: boolean;
  id: string;
}

export interface HeroMotivationAdminDto {
  id: string;
  content: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateHeroMotivationApi {
  content: string;
  is_active?: boolean;
}

export interface UpdateHeroMotivationApi {
  content?: string;
  is_active?: boolean;
}

export interface AdminActivityDto {
  id: string;
  entity_type: "booking" | "session" | "feedback";
  status: string;
  created_at: string;
  updated_at: string;
  entity_id: string;
  review_status?: FeedbackReviewStatusApi;
}

export interface AdminCounselingDto extends BookingRecordBaseDto {
  client: { id: string; full_name: string } | null;
  counselor: { id: string; full_name: string } | null;
  counseling_sessions: Array<{
    id: string;
    status: SessionStatusApi;
    format: "online" | "offline" | null;
    room: string | null;
    started_at: string | null;
    completed_at: string | null;
  }>;
}

export interface AdminDashboardDto {
  users: { active_clients: number; active_counselors: number };
  bookings: { total: number; waiting_confirmation: number; confirmed: number };
  sessions: { total: number; completed: number };
  feedback: { pending_moderation: number };
}

export interface AdminReportDto {
  period: { from: string; to: string };
  totals: {
    bookings: number;
    completed_sessions: number;
    cancelled_sessions: number;
    feedback: number;
    shown_feedback: number;
    average_rating: number | null;
  };
  monthly: Array<{
    month: string;
    bookings: number;
    completed_sessions: number;
    feedback_count: number;
  }>;
  counselors: Array<{
    counselor_id: string;
    counselor_name: string;
    bookings: number;
    completed_sessions: number;
    feedback_count: number;
    average_rating: number | null;
  }>;
  truncated: boolean;
}

export interface ConsentIdentityDto {
  full_name: string;
  faculty: string;
  study_program: string;
  nim: string;
  birthplace: string;
  date_of_birth: string;
  gender: "Laki-laki" | "Perempuan";
  phone_e164: string;
}

export type ConsentStatusApi = "pending" | "viewed" | "signed" | "revoked" | "expired";

export interface InformedConsentDto {
  id: string;
  booking_id: string;
  session_id: string | null;
  booking_participant_id: string;
  consent_template_id: string;
  status: ConsentStatusApi;
  signer_user_id: string | null;
  signer_name_snapshot: string | null;
  identity_snapshot: Partial<ConsentIdentityDto>;
  consent_statement_version: string;
  viewed_at: string | null;
  signed_at: string | null;
  revoked_at: string | null;
  signature_method: string | null;
  signature_storage_path: string | null;
  signed_document_storage_path: string | null;
  signed_document_sha256: string | null;
  signed_document_size_bytes: number | null;
  created_at: string;
  updated_at: string;
  booking_participants?: {
    id: string;
    full_name: string | null;
    display_name: string;
    faculty: string | null;
    study_program: string | null;
    nim: string | null;
    birthplace: string | null;
    date_of_birth: string | null;
    gender: string | null;
    phone_e164: string | null;
    is_primary: boolean;
    participant_status: string;
  };
  consent_templates?: {
    id: string;
    template_code: string;
    version: string;
    title: string;
    file_sha256: string;
  };
}

export interface SignConsentPayloadApi {
  signature_base64: string;
  agreement_accepted: true;
  identity?: Partial<ConsentIdentityDto>;
  idempotency_key?: string;
}

export interface SignConsentResultApi {
  success: boolean;
  alreadySigned?: boolean;
  consent: InformedConsentDto;
  pdfSha256: string;
  pdfPath: string;
  signaturePath: string;
}

export interface ConsentDocumentDownloadDto {
  downloadUrl: string;
  storagePath: string;
  sha256: string;
}

export interface BookingConsentReadinessDto {
  booking_id: string;
  service_type: "individual" | "group";
  active_template_version: string;
  total_participants: number;
  signed_participants: number;
  pending_participants: number;
  template_compliant: boolean;
  is_fully_consented: boolean;
  participants: Array<{
    participant_id: string;
    full_name: string;
    is_primary: boolean;
    participant_status: string;
    consent_status: ConsentStatusApi;
    consent_id?: string;
    signed_at?: string;
  }>;
}

export interface GroupConsentSummaryParticipantDto {
  participant_id: string;
  display_name: string;
  is_primary: boolean;
  consent_status: ConsentStatusApi;
  consent_id: string | null;
  invitation_status: "pending" | "sent" | "claimed" | "completed" | "expired" | "revoked" | null;
  invitation_id: string | null;
  signed_at: string | null;
}

export interface GroupConsentSummaryDto {
  booking_id: string;
  service_type: "individual" | "group";
  group_name: string | null;
  total_participants: number;
  signed_count: number;
  pending_count: number;
  ready_for_session: boolean;
  participants: GroupConsentSummaryParticipantDto[];
}

export interface ClaimGuestInvitationResultDto {
  success: boolean;
  guest_token: string;
  invitation: {
    id: string;
    status: string;
    invitation_type: string;
    booking_id: string;
    booking_participant_id: string;
    consent_id: string;
    expires_at: string;
  };
  consent: InformedConsentDto;
  participant: {
    id: string;
    display_name: string;
    full_name: string | null;
    phone_e164: string | null;
  };
}
