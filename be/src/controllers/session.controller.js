import { z } from "zod";
import { HttpError, parseBody, sendData } from "../lib/http.js";
import {
  sessionListQuerySchema,
  sessionStatusSchema,
} from "../validators/session.validator.js";
import { sessionService } from "../services/session.service.js";

const uuid = z.string().uuid();

export const sessionController = {
  async listSessions(req, res) {
    const filters = sessionListQuerySchema.safeParse(req.query);
    if (!filters.success) {
      throw new HttpError(400, "VALIDATION_ERROR", "Filter sesi tidak valid.", filters.error.issues);
    }

    const data = await sessionService.listSessions({
      authUser: req.auth.user,
      authRole: req.auth.profile.app_role,
      status: filters.data.status,
      limit: filters.data.limit,
    });

    return sendData(res, data);
  },

  async getSession(req, res) {
    if (!uuid.safeParse(req.params.id).success) {
      throw new HttpError(400, "INVALID_ID", "ID sesi tidak valid.");
    }

    const data = await sessionService.getSessionDetail({
      authProfile: req.auth.profile,
      sessionId: req.params.id,
    });

    return sendData(res, data);
  },

  async transitionSession(req, res) {
    if (!uuid.safeParse(req.params.id).success) {
      throw new HttpError(400, "INVALID_ID", "ID sesi tidak valid.");
    }

    const input = parseBody(sessionStatusSchema, req.body);
    const data = await sessionService.transitionSession({
      authUser: req.auth.user,
      authProfile: req.auth.profile,
      sessionId: req.params.id,
      targetStatus: input.status,
    });

    return sendData(res, data);
  },
};

