import { z } from "zod";
import { HttpError, parseBody, sendData } from "../../lib/http.js";
import { sessionNotesSchema } from "../../validators/counselor.validator.js";
import { verifyHistoryGrantToken } from "../../services/counselorCredential.service.js";
import { counselorSessionReportService } from "../../services/counselor/sessionReport.service.js";

const uuid = z.string().uuid();

/** Catatan dan laporan memakai kunci yang sama dengan Riwayat Konseling. */
function requireHistoryGrant(req) {
  const grantToken = req.headers["x-counselor-history-grant"];
  if (!grantToken || !verifyHistoryGrantToken(String(grantToken), req.auth.user.id)) {
    throw new HttpError(
      403,
      "HISTORY_ACCESS_LOCKED",
      "Akses riwayat konseling terkunci. Masukkan kata sandi riwayat untuk membuka.",
    );
  }
}

function parseId(value, code, message) {
  const parsed = uuid.safeParse(value);
  if (!parsed.success) throw new HttpError(400, code, message);
  return parsed.data;
}

export const counselorSessionReportController = {
  async saveNotes(req, res) {
    requireHistoryGrant(req);
    const sessionId = parseId(req.params.sessionId, "VALIDATION_ERROR", "ID sesi tidak valid.");
    const input = parseBody(sessionNotesSchema, req.body);
    const data = await counselorSessionReportService.saveNotes(req.auth.user.id, sessionId, input);
    return sendData(res, data);
  },

  async getReport(req, res) {
    requireHistoryGrant(req);
    const sessionId = parseId(req.params.sessionId, "VALIDATION_ERROR", "ID sesi tidak valid.");
    const participantId = req.query.participant_id
      ? parseId(req.query.participant_id, "VALIDATION_ERROR", "ID peserta tidak valid.")
      : null;
    const data = await counselorSessionReportService.getReport(
      req.auth.user.id,
      sessionId,
      participantId,
    );
    return sendData(res, data);
  },
};
