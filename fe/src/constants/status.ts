/** Moderation lifecycle for feedback that may be shown publicly. */
export const FEEDBACK_MODERATION_STATUS = {
  PENDING: "pending",
  DISABLED: "disabled",
  SHOWN: "shown",
} as const;

export type FeedbackModerationStatus =
  (typeof FEEDBACK_MODERATION_STATUS)[keyof typeof FEEDBACK_MODERATION_STATUS];
