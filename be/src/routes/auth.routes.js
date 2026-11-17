import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { asyncHandler } from "../lib/http.js";
import { authController } from "../controllers/auth.controller.js";
import { setPublicAuthClientForTests } from "../services/auth.service.js";

export { setPublicAuthClientForTests };

const router = Router();

router.post("/register", asyncHandler(authController.register));
router.post("/resend-confirmation", asyncHandler(authController.resendConfirmation));
router.post("/login", asyncHandler(authController.login));
router.get("/me", authenticate, authController.getMe);
router.post("/change-password", authenticate, asyncHandler(authController.changePassword));
router.post("/forgot-password", asyncHandler(authController.forgotPassword));
// Hanya untuk sesi yang dibuka dari tautan email reset (diperiksa lewat klaim `amr`).
router.post("/reset-password", authenticate, asyncHandler(authController.resetPassword));
router.post("/logout", authenticate, authController.logout);

export default router;
