import { z } from "zod";
import { HttpError, parseBody, sendData } from "../../lib/http.js";
import { slotSchema } from "../../validators/counselor.validator.js";
import { counselorAvailabilityService } from "../../services/counselor/availability.service.js";

const uuid = z.string().uuid();

export const counselorAvailabilityController = {
  async listAvailability(req, res) {
    const data = await counselorAvailabilityService.listAvailability(
      req.auth.user.id,
      req.query.status,
    );
    return sendData(res, data);
  },

  async createAvailability(req, res) {
    const input = parseBody(slotSchema, req.body);
    const data = await counselorAvailabilityService.saveSlot(req.auth.user.id, null, input);
    return sendData(res, data, 201);
  },

  async updateAvailability(req, res) {
    if (!uuid.safeParse(req.params.id).success) {
      throw new HttpError(400, "INVALID_ID", "ID jadwal tidak valid.");
    }

    const input = parseBody(slotSchema, req.body);
    const data = await counselorAvailabilityService.saveSlot(req.auth.user.id, req.params.id, input);
    return sendData(res, data);
  },

  async cancelAvailability(req, res) {
    if (!uuid.safeParse(req.params.id).success) {
      throw new HttpError(400, "INVALID_ID", "ID jadwal tidak valid.");
    }

    const data = await counselorAvailabilityService.cancelSlot(req.auth.user.id, req.params.id);
    return sendData(res, data);
  },
};

