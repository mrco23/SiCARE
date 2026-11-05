import { z } from "zod";
import { HttpError, sendData } from "../../lib/http.js";
import { adminCounselingService } from "../../services/admin/counseling.service.js";

const limitSchema = z
  .object({ limit: z.coerce.number().int().min(1).max(100).default(50) })
  .strict();

// Laporan per periode dihitung dari daftar ini, jadi batasnya lebih longgar.
const counselingLimitSchema = z
  .object({ limit: z.coerce.number().int().min(1).max(1000).default(50) })
  .strict();

export const adminCounselingController = {
  async listCounseling(req, res) {
    const parsed = counselingLimitSchema.safeParse(req.query);
    if (!parsed.success) {
      throw new HttpError(400, "VALIDATION_ERROR", "Limit tidak valid.", parsed.error.issues);
    }

    const data = await adminCounselingService.listCounseling(parsed.data.limit, {
      redactClient: req.auth.profile.app_role !== "admin",
    });
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

