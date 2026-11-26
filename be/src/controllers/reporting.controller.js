import { parseBody, sendData } from "../lib/http.js";
import { reportingService } from "../services/reporting.service.js";
import { buildCounselingReportPdf, reportPdfFilename } from "../services/reportPdf.service.js";
import { reportPdfSchema } from "../validators/reporting.validator.js";

export const reportingController = {
  async getDashboard(_req, res) {
    const data = await reportingService.getDashboard();
    return sendData(res, data);
  },

  async getReport(_req, res) {
    const data = await reportingService.getReport();
    return sendData(res, data);
  },

  /** PDF laporan untuk diunduh langsung (bukan dialog cetak browser). */
  async downloadReportPdf(req, res) {
    const input = parseBody(reportPdfSchema, req.body);
    const profile = req.auth.profile;
    const role = profile.app_role === "head_lmi" ? "headlmi" : "admin";
    const pdf = await buildCounselingReportPdf(input, {
      role,
      signer: { name: profile.full_name ?? "Kepala LMI", identityCode: profile.identity_code ?? null },
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${reportPdfFilename(input.periodLabel)}"`);
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(Buffer.from(pdf));
  },
};
