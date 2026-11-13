import { z } from "zod";
import { HttpError, parseBody, sendData } from "../lib/http.js";
import {
  bookingListQuerySchema,
  createBookingSchema,
  rescheduleBookingSchema,
  bookingTransitionSchema,
} from "../validators/booking.validator.js";
import { bookingService } from "../services/booking.service.js";

const uuid = z.string().uuid();

export const bookingController = {
  async listBookings(req, res) {
    const filters = bookingListQuerySchema.safeParse(req.query);
    if (!filters.success) {
      throw new HttpError(400, "VALIDATION_ERROR", "Filter booking tidak valid.", filters.error.issues);
    }

    const data = await bookingService.listBookings({
      authUser: req.auth.user,
      authProfile: req.auth.profile,
      authRole: req.auth.profile.app_role,
      status: filters.data.status,
      limit: filters.data.limit,
    });

    return sendData(res, data);
  },

  async getBooking(req, res) {
    if (!uuid.safeParse(req.params.id).success) {
      throw new HttpError(400, "INVALID_ID", "ID booking tidak valid.");
    }

    const data = await bookingService.getBookingDetail({
      authProfile: req.auth.profile,
      bookingId: req.params.id,
    });

    return sendData(res, data);
  },

  async createBooking(req, res) {
    const input = parseBody(createBookingSchema, req.body);
    const booking = await bookingService.createBooking({
      authUser: req.auth.user,
      authProfile: req.auth.profile,
      input,
    });

    return sendData(res, booking, 201);
  },

  async rescheduleBooking(req, res) {
    if (!uuid.safeParse(req.params.id).success) {
      throw new HttpError(400, "INVALID_ID", "ID booking tidak valid.");
    }

    const input = parseBody(rescheduleBookingSchema, req.body);
    const booking = await bookingService.rescheduleBooking({
      authUser: req.auth.user,
      authProfile: req.auth.profile,
      bookingId: req.params.id,
      availabilitySlotId: input.availability_slot_id,
    });

    return sendData(res, booking);
  },

  async transitionBooking(req, res) {
    if (!uuid.safeParse(req.params.id).success) {
      throw new HttpError(400, "INVALID_ID", "ID booking tidak valid.");
    }

    const input = parseBody(bookingTransitionSchema, req.body);
    const booking = await bookingService.transitionBooking({
      authUser: req.auth.user,
      authProfile: req.auth.profile,
      bookingId: req.params.id,
      input,
    });

    return sendData(res, booking);
  },

  async getConsentSummary(req, res) {
    if (!uuid.safeParse(req.params.id).success) {
      throw new HttpError(400, "INVALID_ID", "ID booking tidak valid.");
    }

    const summary = await bookingService.getConsentSummary({
      authUser: req.auth.user,
      authRole: req.auth.profile.app_role,
      bookingId: req.params.id,
    });

    return sendData(res, summary);
  },
};

