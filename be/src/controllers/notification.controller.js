import { z } from "zod";
import { HttpError, sendData } from "../lib/http.js";
import { notificationService } from "../services/notification.service.js";

const uuid = z.string().uuid();
const notificationQuerySchema = z.object({
  unread_only: z.enum(["true", "false"]).default("false"),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  offset: z.coerce.number().int().min(0).default(0),
}).strict();

export const notificationController = {
  async listNotifications(req, res) {
    const filters = notificationQuerySchema.safeParse(req.query);
    if (!filters.success) {
      throw new HttpError(400, "VALIDATION_ERROR", "Filter notifikasi tidak valid.", filters.error.issues);
    }

    const data = await notificationService.listNotifications({
      userId: req.auth.user.id,
      unreadOnly: filters.data.unread_only,
      limit: filters.data.limit,
      offset: filters.data.offset,
    });

    return sendData(res, data);
  },

  async markAllRead(req, res) {
    const result = await notificationService.markAllRead(req.auth.user.id);
    return sendData(res, result);
  },

  async markOneRead(req, res) {
    if (!uuid.safeParse(req.params.id).success) {
      throw new HttpError(400, "INVALID_ID", "ID notifikasi tidak valid.");
    }

    const data = await notificationService.markOneRead({
      notificationId: req.params.id,
      userId: req.auth.user.id,
    });

    return sendData(res, data);
  },
};

