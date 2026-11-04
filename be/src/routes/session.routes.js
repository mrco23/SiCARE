import { Router } from "express";
import { allowRoles, authenticate } from "../middleware/auth.js";
import { asyncHandler } from "../lib/http.js";
import { sessionController } from "../controllers/session.controller.js";

const router = Router();

// Ownership guard contracts:
// bookingQuery.eq("client_id", request.auth.user.id)
// bookingQuery.eq("counselor_id", request.auth.user.id)

router.get(
  "/",
  authenticate,
  allowRoles("client", "counselor"),
  asyncHandler(sessionController.listSessions),
);

router.get(
  "/:id",
  authenticate,
  allowRoles("client", "counselor"),
  asyncHandler(sessionController.getSession),
);

router.patch(
  "/:id/status",
  authenticate,
  allowRoles("counselor"),
  asyncHandler(sessionController.transitionSession),
);

export default router;
