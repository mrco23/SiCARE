/** Canonical and explicitly namespaced demo fixtures. */
export {
  DEFAULT_ACADEMIC_PERIODS,
  LEGACY_UI_SEMESTERS,
  type LegacyUISemester,
} from "./academicPeriods";
export {
  CLIENT_COUNSELOR_IDENTITIES,
  CLIENT_DIRECTORY_COUNSELORS,
  CLIENT_BOOKING_COUNSELORS,
  PUBLIC_COUNSELOR_PROFILES,
  CLIENT_HISTORY_COUNSELORS,
  CLIENT_ACTIVITY_COUNSELOR_SCHEDULE,
  type ClientCounselorKey,
  type ClientCounselorIdentity,
  type ClientDirectoryCounselor,
  type BookingCounselor,
  type PublicCounselorProfile,
  type PublicCounselorEducation,
  type PublicCounselorSchedule,
} from "./clientCounselors";
export {
  INTAKE_TOPICS,
  INTAKE_YESNO_OPTIONS,
  INTAKE_SCALE_OPTIONS,
  INTAKE_ESSAY_OPTIONS,
  type IntakeAnswerKey,
  type IntakeScaleKey,
  type IntakeEssayKey,
} from "./intakeOptions";
export { DASHBOARD_COUNTS, WEEKLY_SESSIONS, COUNSELOR_WORKLOAD } from "./dashboardOverview";
export {
  SEMESTERS as CLIENT_HISTORY_SEMESTERS,
  SESSIONS as CLIENT_HISTORY_SESSIONS,
  BOOKINGS as CLIENT_HISTORY_BOOKINGS,
  ESSAY_POOL as CLIENT_HISTORY_ESSAY_POOL,
  type Session as ClientHistorySession,
  type Booking as ClientHistoryBooking,
} from "./clientHistory";
export {
  RESCHEDULE_REASONS,
  createInitialSessions as createInitialClientActivitySessions,
  type Session as ClientActivitySession,
  type PendingSlot as ClientActivityPendingSlot,
} from "./clientActivity";
export {
  initialRequests as COUNSELOR_REQUEST_QUEUE,
  intakes as COUNSELOR_REQUEST_INTAKES,
  type CounselingRequest as CounselorRequestQueueItem,
  type IntakeData as CounselorRequestIntake,
} from "./counselorRequests";
export {
  initialRequests as COUNSELOR_DASHBOARD_REQUESTS,
  initialSessions as COUNSELOR_DASHBOARD_SESSIONS,
  SESSIONS_THIS_WEEK as COUNSELOR_DASHBOARD_SESSION_COUNT,
  RATINGS as COUNSELOR_DASHBOARD_RATINGS,
  type Request as CounselorDashboardRequest,
  type Session as CounselorDashboardSession,
} from "./counselorDashboard";
export {
  CANCEL_REASONS as COUNSELOR_ACTIVITY_CANCEL_REASONS,
  buildDummySessions as buildCounselorActivitySessions,
  getCounselorActivityIntake,
  type CounselingSession as CounselorActivitySession,
} from "./counselorActivity";
export {
  clients as COUNSELOR_HISTORY_CLIENTS,
  type Client as CounselorHistoryClient,
  type Session as CounselorHistorySession,
} from "./counselorHistory";
export {
  INITIAL_ACCOUNTS as ADMIN_ACCOUNT_SEED,
  type Account as AdminAccount,
  type Role as AdminAccountRole,
} from "./adminAccounts";
export {
  DATA as ADMIN_FEEDBACK_SEED,
  PSIKOLOG as ADMIN_FEEDBACK_COUNSELORS,
  type Feedback as AdminFeedbackRecord,
} from "./adminFeedback";
export {
  COUNSELOR as COUNSELOR_FEEDBACK_OWNER,
  feedbackData as COUNSELOR_FEEDBACK_SEED,
  type Feedback as CounselorFeedbackRecord,
} from "./counselorFeedback";
export {
  reviews as PUBLIC_FEEDBACK_REVIEWS,
  type Review as PublicFeedbackReview,
} from "./publicFeedback";
export {
  COUNSELORS as ADMIN_COUNSELING_COUNSELORS,
  RATING as ADMIN_COUNSELING_RATINGS,
  SESI as ADMIN_COUNSELING_SESSIONS,
  type Session as AdminCounselingSession,
} from "./adminCounseling";
export {
  SESSIONS as ADMIN_REPORT_SESSIONS,
  type Session as AdminReportSession,
} from "./adminReports";
export {
  SESSIONS as HEADLMI_REPORT_SESSIONS,
  type Session as HeadLmiReportSession,
} from "./headlmiReports";
export {
  FEEDBACKS as HEADLMI_FEEDBACK_SEED,
  type Feedback as HeadLmiFeedbackRecord,
} from "./headlmiFeedback";
export {
  REPORT_COUNSELORS,
  REPORT_MONTHS,
} from "./reportCommon";
export {
  HOME_PAGE_TESTIMONIALS,
  HOME_PAGE_COUNSELORS,
  TESTIMONIALS as HOME_TESTIMONIAL_SECTION,
  COUNSELOR_SECTION_SHOWCASE,
  type Testimonial as HomeTestimonial,
} from "./publicShowcases";
export { INITIAL_COUNSELOR_PROFILE } from "./counselorProfile";
export { createCounselorScheduleSeed } from "./counselorSchedule";
