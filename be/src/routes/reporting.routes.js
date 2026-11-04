import { Router } from "express";
import { allowRoles, authenticate } from "../middleware/auth.js";
import { asyncHandler } from "../lib/http.js";
import { reportingController } from "../controllers/reporting.controller.js";

const router = Router();

router.get(
  "/admin/dashboard",
  authenticate,
  allowRoles("admin"),
  asyncHandler(reportingController.getDashboard),
);

router.get(
  "/head-lmi/dashboard",
  authenticate,
  allowRoles("head_lmi"),
  asyncHandler(reportingController.getDashboard),
);

router.get(
  "/admin/reports",
  authenticate,
  allowRoles("admin"),
  asyncHandler(reportingController.getReport),
);

router.get(
  "/head-lmi/reports",
  authenticate,
  allowRoles("head_lmi"),
  asyncHandler(reportingController.getReport),
);

export default router;
