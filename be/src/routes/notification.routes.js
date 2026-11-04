import { Router } from "express";
import { allowRoles, authenticate } from "../middleware/auth.js";
import { asyncHandler } from "../lib/http.js";
import { notificationController } from "../controllers/notification.controller.js";

const router = Router();

// Ownership guard contracts:
// .eq("recipient_user_id", request.auth.user.id)
// .eq("id", request.params.id).eq("recipient_user_id", request.auth.user.id)

router.get(
  "/",
  authenticate,
  allowRoles("client", "counselor", "admin", "head_lmi"),
  asyncHandler(notificationController.listNotifications),
);

router.patch(
  "/read-all",
  authenticate,
  allowRoles("client", "counselor", "admin", "head_lmi"),
  asyncHandler(notificationController.markAllRead),
);

router.patch(
  "/:id/read",
  authenticate,
  allowRoles("client", "counselor", "admin", "head_lmi"),
  asyncHandler(notificationController.markOneRead),
);

export default router;
