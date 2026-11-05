import { parseBody, sendData } from "../../lib/http.js";
import { licensePatchSchema, profilePatchSchema } from "../../validators/counselor.validator.js";
import { counselorProfileService } from "../../services/counselor/profile.service.js";

export const counselorProfileController = {
  async getLicense(req, res) {
    const data = await counselorProfileService.getLicense(req.auth.user.id);
    return sendData(res, data);
  },

  async updateLicense(req, res) {
    const input = parseBody(licensePatchSchema, req.body);
    const data = await counselorProfileService.updateLicense(req.auth.user.id, input);
    return sendData(res, data);
  },

  async getProfile(req, res) {
    const data = await counselorProfileService.getProfile(req.auth.user.id);
    return sendData(res, data);
  },

  async updateProfile(req, res) {
    const input = parseBody(profilePatchSchema, req.body);
    const data = await counselorProfileService.updateProfile(req.auth.user.id, input);
    return sendData(res, data);
  },
};

