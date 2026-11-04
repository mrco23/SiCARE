import { sendData } from "../lib/http.js";
import { reportingService } from "../services/reporting.service.js";

export const reportingController = {
  async getDashboard(_req, res) {
    const data = await reportingService.getDashboard();
    return sendData(res, data);
  },

  async getReport(_req, res) {
    const data = await reportingService.getReport();
    return sendData(res, data);
  },
};

