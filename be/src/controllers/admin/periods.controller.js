import { z } from "zod";
import { HttpError, parseBody, sendData } from "../../lib/http.js";
import {
  createPeriodSchema,
  patchPeriodSchema,
} from "../../validators/admin.validator.js";
import { adminPeriodsService } from "../../services/admin/periods.service.js";

const uuid = z.string().uuid();

export const adminPeriodsController = {
  async listPeriods(_req, res) {
    const data = await adminPeriodsService.listPeriods();
    return sendData(res, data);
  },

  async createPeriod(req, res) {
    const input = parseBody(createPeriodSchema, req.body);
    const data = await adminPeriodsService.createPeriod(input, req.auth.user.id);
    return sendData(res, data, 201);
  },

  async updatePeriod(req, res) {
    if (!uuid.safeParse(req.params.id).success) {
      throw new HttpError(400, "INVALID_ID", "ID periode tidak valid.");
    }

    const input = parseBody(patchPeriodSchema, req.body);
    const data = await adminPeriodsService.updatePeriod(req.params.id, input, req.auth.user.id);
    return sendData(res, data);
  },

  async deletePeriod(_req, _res) {
    await adminPeriodsService.deletePeriod();
  },
};

