import { Router } from "express";
import { allowRoles, authenticate } from "../middleware/auth.js";
import { asyncHandler } from "../lib/http.js";
import { counselorProfileController } from "../controllers/counselor/profile.controller.js";
import { counselorAvailabilityController } from "../controllers/counselor/availability.controller.js";
import { counselorHistoryCredentialController } from "../controllers/counselor/historyCredential.controller.js";
import { counselorSessionReportController } from "../controllers/counselor/sessionReport.controller.js";

const router = Router();

// Ownership guard contracts:
// .eq("profile_id", req.auth.user.id)
// p_counselor_id: req.auth.user.id

router.get("/profile", authenticate, allowRoles("counselor"), asyncHandler(counselorProfileController.getProfile));
router.patch("/profile", authenticate, allowRoles("counselor"), asyncHandler(counselorProfileController.updateProfile));

router.get("/license", authenticate, allowRoles("counselor"), asyncHandler(counselorProfileController.getLicense));
router.patch("/license", authenticate, allowRoles("counselor"), asyncHandler(counselorProfileController.updateLicense));

router.get("/availability", authenticate, allowRoles("counselor"), asyncHandler(counselorAvailabilityController.listAvailability));
router.post("/availability", authenticate, allowRoles("counselor"), asyncHandler(counselorAvailabilityController.createAvailability));
router.patch("/availability/:id", authenticate, allowRoles("counselor"), asyncHandler(counselorAvailabilityController.updateAvailability));
router.delete("/availability/:id", authenticate, allowRoles("counselor"), asyncHandler(counselorAvailabilityController.cancelAvailability));

router.get("/history-password/status", authenticate, allowRoles("counselor"), asyncHandler(counselorHistoryCredentialController.getPasswordStatus));
router.post("/history-password/init", authenticate, allowRoles("counselor"), asyncHandler(counselorHistoryCredentialController.initPassword));
router.post("/history-password/verify", authenticate, allowRoles("counselor"), asyncHandler(counselorHistoryCredentialController.verifyPassword));
router.post("/history-password/change", authenticate, allowRoles("counselor"), asyncHandler(counselorHistoryCredentialController.changePassword));

router.get("/history", authenticate, allowRoles("counselor"), asyncHandler(counselorHistoryCredentialController.getHistory));

router.put("/sessions/:sessionId/notes", authenticate, allowRoles("counselor"), asyncHandler(counselorSessionReportController.saveNotes));
router.get("/sessions/:sessionId/report", authenticate, allowRoles("counselor"), asyncHandler(counselorSessionReportController.getReport));

export default router;
