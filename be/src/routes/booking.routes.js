import { Router } from "express";
import { allowRoles, authenticate } from "../middleware/auth.js";
import { asyncHandler } from "../lib/http.js";
import { bookingController } from "../controllers/booking.controller.js";

const router = Router();

// Ownership guard contracts:
// query = profile.app_role === "client" ? query.eq("client_id", profile.id) : query.eq("counselor_id", profile.id)
// query.eq("client_id", request.auth.user.id)
// query.eq("counselor_id", request.auth.user.id)

router.get("/", authenticate, allowRoles("client", "counselor"), asyncHandler(bookingController.listBookings));
router.post("/", authenticate, allowRoles("client"), asyncHandler(bookingController.createBooking));

/**
 * Delegates to bookingController.rescheduleBooking:
 * callDomainRpc(supa(), "sicare_reschedule_booking", { ... })
 * action: "booking.reschedule", reschedule_reason
 * ["cancelled", "rejected", "reschedule_requested"].includes(input.status)
 */
router.patch("/:id/reschedule", authenticate, allowRoles("client"), asyncHandler(bookingController.rescheduleBooking));

/**
 * "Ajukan jadwal baru": klien pemilik booking yang batal/ditolak/kedaluwarsa/terlewat membuat
 * booking baru dengan konselor yang sama lewat sicare_create_booking; layanan, anggota kelompok,
 * dan jawaban form awal disalin dari booking asal. action: "booking.rebook".
 */
router.post("/:id/rebook", authenticate, allowRoles("client"), asyncHandler(bookingController.rebookBooking));

router.get("/:id", authenticate, allowRoles("client", "counselor"), asyncHandler(bookingController.getBooking));
router.patch("/:id/status", authenticate, allowRoles("client", "counselor"), asyncHandler(bookingController.transitionBooking));
router.get("/:id/consent-summary", authenticate, allowRoles("client", "counselor"), asyncHandler(bookingController.getConsentSummary));

export default router;
