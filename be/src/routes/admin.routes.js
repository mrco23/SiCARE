import { Router } from "express";
import { allowRoles, authenticate } from "../middleware/auth.js";
import { asyncHandler } from "../lib/http.js";
import { adminAccountsController } from "../controllers/admin/accounts.controller.js";
import { adminPeriodsController } from "../controllers/admin/periods.controller.js";
import { adminCounselingController } from "../controllers/admin/counseling.controller.js";
import { adminHeroController } from "../controllers/admin/hero.controller.js";
import { adminWhatsAppController } from "../controllers/admin/whatsapp.controller.js";

const router = Router();

// Accounts Management
router.get("/accounts", authenticate, allowRoles("admin"), asyncHandler(adminAccountsController.listAccounts));
router.get("/accounts/:id", authenticate, allowRoles("admin"), asyncHandler(adminAccountsController.getAccount));
router.post("/accounts", authenticate, allowRoles("admin"), asyncHandler(adminAccountsController.createAccount));
router.patch("/accounts/:id", authenticate, allowRoles("admin"), asyncHandler(adminAccountsController.updateAccount));
router.delete("/accounts/:id", authenticate, allowRoles("admin"), asyncHandler(adminAccountsController.deactivateAccount));

// Counselor Publication
router.patch("/counselors/:counselorId/publication", authenticate, allowRoles("admin"), asyncHandler(adminAccountsController.setCounselorPublication));

// Academic Periods
router.get("/periods", authenticate, allowRoles("admin"), asyncHandler(adminPeriodsController.listPeriods));
router.post("/periods", authenticate, allowRoles("admin"), asyncHandler(adminPeriodsController.createPeriod));
router.patch("/periods/:id", authenticate, allowRoles("admin"), asyncHandler(adminPeriodsController.updatePeriod));
router.delete("/periods/:id", authenticate, allowRoles("admin"), asyncHandler(adminPeriodsController.deletePeriod));

// Counseling & Activity Overviews
router.get("/counseling", authenticate, allowRoles("admin", "head_lmi"), asyncHandler(adminCounselingController.listCounseling));
router.get("/activity", authenticate, allowRoles("admin"), asyncHandler(adminCounselingController.listActivity));

// Hero Motivations Management
// Validation: content: z.string().trim().min(1).max(180)
router.get("/hero-motivations", authenticate, allowRoles("admin"), asyncHandler(adminHeroController.listHeroMotivations));
router.post("/hero-motivations", authenticate, allowRoles("admin"), asyncHandler(adminHeroController.createHeroMotivation));
router.patch("/hero-motivations/:id", authenticate, allowRoles("admin"), asyncHandler(adminHeroController.updateHeroMotivation));
router.delete("/hero-motivations/:id", authenticate, allowRoles("admin"), asyncHandler(adminHeroController.deleteHeroMotivation));

// WhatsApp Diagnostics
router.get("/whatsapp/health", authenticate, allowRoles("admin"), asyncHandler(adminWhatsAppController.getWhatsAppHealth));

export default router;
