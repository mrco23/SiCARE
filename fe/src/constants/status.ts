/** Booking status values intended for the domain/API-shaped Booking model. */
export const BOOKING_STATUS = {
  WAITING_CONFIRMATION: "WAITING_CONFIRMATION",
  CONFIRMED: "CONFIRMED",
  REJECTED: "REJECTED",
  RESCHEDULE_REQUESTED: "RESCHEDULE_REQUESTED",
  CANCELLED: "CANCELLED",
  COMPLETED: "COMPLETED",
} as const;

export type BookingStatus = (typeof BOOKING_STATUS)[keyof typeof BOOKING_STATUS];

/** Statuses currently used by counselor request screens. */
export const COUNSELING_REQUEST_STATUS = {
  PENDING: "pending",
  ACCEPTED: "accepted",
  REJECTED: "rejected",
} as const;

export type CounselingRequestStatus =
  (typeof COUNSELING_REQUEST_STATUS)[keyof typeof COUNSELING_REQUEST_STATUS];

/** Persisted lifecycle statuses used by the counselor's session activity page. */
export const COUNSELING_SESSION_STATUS = {
  SCHEDULED: "scheduled",
  ONGOING: "ongoing",
  COMPLETED: "done",
  CANCELLED: "cancelled",
} as const;

export type CounselingSessionStatus =
  (typeof COUNSELING_SESSION_STATUS)[keyof typeof COUNSELING_SESSION_STATUS];

/** Derived time-based state used on the client's activity page, not a persisted status. */
export const CLIENT_SESSION_TIMELINE_STATUS = {
  UPCOMING: "upcoming",
  ONGOING: "ongoing",
  COMPLETED: "done",
} as const;

export type ClientSessionTimelineStatus =
  (typeof CLIENT_SESSION_TIMELINE_STATUS)[keyof typeof CLIENT_SESSION_TIMELINE_STATUS];

/** Legacy UI booking statuses retained while the mock data is migrated in a later stage. */
export const CLIENT_BOOKING_STATUS = {
  PENDING: "pending",
  SCHEDULED: "scheduled",
  COMPLETED: "done",
  CANCELLED: "cancelled",
  REJECTED: "rejected",
} as const;

export type ClientBookingStatus =
  (typeof CLIENT_BOOKING_STATUS)[keyof typeof CLIENT_BOOKING_STATUS];

export type ClientDashboardBookingStatus = ClientBookingStatus;

export type ClientHistoryBookingStatus = ClientBookingStatus;

/** Shared outcome values used by the administrative session list. */
export const SESSION_OUTCOME_STATUS = {
  COMPLETED: "selesai",
  CANCELLED: "dibatalkan",
} as const;

export type SessionOutcomeStatus =
  (typeof SESSION_OUTCOME_STATUS)[keyof typeof SESSION_OUTCOME_STATUS];

/** Display labels used by report pages; kept separate from stored status values. */
export const SESSION_OUTCOME_LABEL = {
  COMPLETED: "Selesai",
  CANCELLED: "Dibatalkan",
} as const;

export type SessionOutcomeLabel =
  (typeof SESSION_OUTCOME_LABEL)[keyof typeof SESSION_OUTCOME_LABEL];

/** Moderation lifecycle for feedback that may be shown publicly. */
export const FEEDBACK_MODERATION_STATUS = {
  PENDING: "pending",
  DISABLED: "disabled",
  SHOWN: "shown",
} as const;

export type FeedbackModerationStatus =
  (typeof FEEDBACK_MODERATION_STATUS)[keyof typeof FEEDBACK_MODERATION_STATUS];

/** Internal review lifecycle shown in the Kepala LMI feedback report. */
export const FEEDBACK_REVIEW_STATUS = {
  NEW: "Baru",
  REVIEWED: "Ditinjau",
  COMPLETED: "Selesai",
} as const;

export type FeedbackReviewStatus =
  (typeof FEEDBACK_REVIEW_STATUS)[keyof typeof FEEDBACK_REVIEW_STATUS];
