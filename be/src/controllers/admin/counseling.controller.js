import { z } from "zod";
import { HttpError, sendData } from "../../lib/http.js";
import { adminCounselingService } from "../../services/admin/counseling.service.js";

const limitSchema = z
  .object({ limit: z.coerce.number().int().min(1).max(100).default(50) })
  .strict();

export const adminCounselingController = {
  async listCounseling(req, res) {
    const parsed = limitSchema.safeParse(req.query);
    if (!parsed.success) {
      throw new HttpError(400, "VALIDATION_ERROR", "Limit tidak valid.", parsed.error.issues);
    }

    const data = await adminCounselingService.listCounseling(parsed.data.limit);
    return sendData(res, data);
  },

  async listActivity(req, res) {
    const parsed = limitSchema.safeParse(req.query);
    if (!parsed.success) {
      throw new HttpError(400, "VALIDATION_ERROR", "Limit tidak valid.", parsed.error.issues);
    }

    const data = await adminCounselingService.listActivity(parsed.data.limit);
    return sendData(res, data);
  },
};

