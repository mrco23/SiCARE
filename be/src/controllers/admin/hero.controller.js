import { z } from "zod";
import { HttpError, parseBody, sendData } from "../../lib/http.js";
import {
  heroMotivationSchema,
  patchHeroMotivationSchema,
} from "../../validators/admin.validator.js";
import { adminHeroService } from "../../services/admin/hero.service.js";

const uuid = z.string().uuid();

export const adminHeroController = {
  async listHeroMotivations(_req, res) {
    const data = await adminHeroService.listHeroMotivations();
    return sendData(res, data);
  },

  async createHeroMotivation(req, res) {
    const input = parseBody(heroMotivationSchema, req.body);
    const data = await adminHeroService.createHeroMotivation(input, req.auth.user.id);
    return sendData(res, data, 201);
  },

  async updateHeroMotivation(req, res) {
    if (!uuid.safeParse(req.params.id).success) {
      throw new HttpError(400, "INVALID_ID", "ID kalimat motivasi tidak valid.");
    }

    const input = parseBody(patchHeroMotivationSchema, req.body);
    const data = await adminHeroService.updateHeroMotivation(req.params.id, input, req.auth.user.id);
    return sendData(res, data);
  },

  async deleteHeroMotivation(req, res) {
    if (!uuid.safeParse(req.params.id).success) {
      throw new HttpError(400, "INVALID_ID", "ID kalimat motivasi tidak valid.");
    }

    const data = await adminHeroService.deleteHeroMotivation(req.params.id, req.auth.user.id);
    return sendData(res, data);
  },
};

