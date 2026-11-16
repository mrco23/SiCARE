import { z } from "zod";
import { HttpError, parseBody, sendData } from "../../lib/http.js";
import { slotSchema } from "../../validators/counselor.validator.js";
import { counselorAvailabilityService } from "../../services/counselor/availability.service.js";

const uuid = z.string().uuid();
const availabilityPageSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(200),
  offset: z.coerce.number().int().min(0).max(100000).default(0),
});

export const counselorAvailabilityController = {
  async listAvailability(req, res) {
    const page = availabilityPageSchema.safeParse(req.query);
    if (!page.success) {
      throw new HttpError(400, "VALIDATION_ERROR", "Parameter halaman jadwal tidak valid.", page.error.issues);
    }
    const data = await counselorAvailabilityService.listAvailability(
      req.auth.user.id,
      req.query.status,
      { limit: page.data.limit, offset: page.data.offset },
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

