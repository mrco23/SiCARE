import { parseBody, sendData } from "../../lib/http.js";
import {
  educationCreateSchema,
  educationIdSchema,
  educationPatchSchema,
} from "../../validators/counselor.validator.js";
import { counselorEducationService } from "../../services/counselor/education.service.js";

export const counselorEducationController = {
  async list(req, res) {
    return sendData(res, await counselorEducationService.list(req.auth.user.id));
  },

  async create(req, res) {
    const input = parseBody(educationCreateSchema, req.body);
    return sendData(res, await counselorEducationService.create(req.auth.user.id, input), 201);
  },

  async update(req, res) {
    const { id } = parseBody(educationIdSchema, req.params);
    const input = parseBody(educationPatchSchema, req.body);
    return sendData(res, await counselorEducationService.update(req.auth.user.id, id, input));
  },

  async remove(req, res) {
    const { id } = parseBody(educationIdSchema, req.params);
    return sendData(res, await counselorEducationService.remove(req.auth.user.id, id));
  },
};
