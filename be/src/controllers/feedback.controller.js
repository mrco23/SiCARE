import { z } from "zod";
import { HttpError, parseBody, sendData } from "../lib/http.js";
import {
  submitFeedbackSchema,
  counselorFeedbackQuerySchema,
  adminFeedbackQuerySchema,
  moderationSchema,
  reviewSchema,
} from "../validators/feedback.validator.js";
import { feedbackService } from "../services/feedback.service.js";

const uuid = z.string().uuid();

export const feedbackController = {
  async submitFeedback(req, res) {
    if (!uuid.safeParse(req.params.sessionId).success) {
      throw new HttpError(400, "INVALID_ID", "ID sesi tidak valid.");
    }

    const input = parseBody(submitFeedbackSchema, req.body);
    const data = await feedbackService.submitFeedback({
      authUser: req.auth.user,
      sessionId: req.params.sessionId,
      input,
    });

    return sendData(res, data, 201);
  },

  async getCounselorFeedback(req, res) {
    const parsed = counselorFeedbackQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new HttpError(400, "VALIDATION_ERROR", "Filter feedback konselor tidak valid.", parsed.error.issues);
    }

    const data = await feedbackService.getCounselorFeedback({
      counselorId: req.auth.user.id,
      rating: parsed.data.rating,
      limit: parsed.data.limit,
    });

    return sendData(res, data);
  },

  async getMyFeedback(req, res) {
    const data = await feedbackService.getMyFeedback(req.auth.user.id);
    return sendData(res, data);
  },

  async listAdminFeedback(req, res) {
    const parsed = adminFeedbackQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new HttpError(400, "VALIDATION_ERROR", "Filter feedback admin tidak valid.", parsed.error.issues);
    }

    const data = await feedbackService.listAdminFeedback(parsed.data);
    return sendData(res, data);
  },

  async getAdminFeedback(req, res) {
    if (!uuid.safeParse(req.params.id).success) {
      throw new HttpError(400, "INVALID_ID", "ID feedback tidak valid.");
    }

    const data = await feedbackService.getAdminFeedbackDetail(req.params.id);
    return sendData(res, data);
  },

  async getFeedbackStatistics(_req, res) {
    const data = await feedbackService.getFeedbackStatistics();
    return sendData(res, data);
  },

  async moderateFeedback(req, res) {
    if (!uuid.safeParse(req.params.id).success) {
      throw new HttpError(400, "INVALID_ID", "ID feedback tidak valid.");
    }

    const input = parseBody(moderationSchema, req.body);
    const data = await feedbackService.moderateFeedback({
      feedbackId: req.params.id,
      input,
      actorId: req.auth.user.id,
    });

    return sendData(res, data);
  },

  async reviewFeedback(req, res) {
    if (!uuid.safeParse(req.params.id).success) {
      throw new HttpError(400, "INVALID_ID", "ID feedback tidak valid.");
    }

    const input = parseBody(reviewSchema, req.body);
    const data = await feedbackService.reviewFeedback({
      feedbackId: req.params.id,
      input,
      actorId: req.auth.user.id,
    });

    return sendData(res, data);
  },
};

