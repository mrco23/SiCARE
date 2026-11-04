import { Router } from "express";
import { allowRoles, authenticate } from "../middleware/auth.js";
import { asyncHandler } from "../lib/http.js";
import { feedbackController } from "../controllers/feedback.controller.js";

const router = Router();

// Ownership guard contracts:
// .eq("client_id", _request.auth.user.id)
// .eq("counselor_id", request.auth.user.id)

router.post(
  "/sessions/:sessionId/feedback",
  authenticate,
  allowRoles("client"),
  asyncHandler(feedbackController.submitFeedback),
);

router.get(
  "/feedback/counselor",
  authenticate,
  allowRoles("counselor"),
  asyncHandler(feedbackController.getCounselorFeedback),
);

router.get(
  "/feedback/mine",
  authenticate,
  allowRoles("client"),
  asyncHandler(feedbackController.getMyFeedback),
);

router.get(
  "/admin/feedback",
  authenticate,
  allowRoles("admin", "head_lmi"),
  asyncHandler(feedbackController.listAdminFeedback),
);

router.get(
  "/admin/feedback/statistics",
  authenticate,
  allowRoles("admin", "head_lmi"),
  asyncHandler(feedbackController.getFeedbackStatistics),
);

router.get(
  "/admin/feedback/:id",
  authenticate,
  allowRoles("admin", "head_lmi"),
  asyncHandler(feedbackController.getAdminFeedback),
);

router.patch(
  "/admin/feedback/:id/moderation",
  authenticate,
  allowRoles("admin"),
  asyncHandler(feedbackController.moderateFeedback),
);

router.patch(
  "/admin/feedback/:id/review",
  authenticate,
  allowRoles("head_lmi"),
  asyncHandler(feedbackController.reviewFeedback),
);

export default router;
