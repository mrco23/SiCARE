import { z } from "zod";
import { HttpError, parseBody, sendData } from "../../lib/http.js";
import {
  accountQuerySchema,
  createAccountSchema,
  patchAccountSchema,
} from "../../validators/admin.validator.js";
import { adminAccountsService } from "../../services/admin/accounts.service.js";

const uuid = z.string().uuid();

export const adminAccountsController = {
  async listAccounts(req, res) {
    const parsed = accountQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new HttpError(400, "VALIDATION_ERROR", "Filter akun tidak valid.", parsed.error.issues);
    }

    const data = await adminAccountsService.listAccounts(parsed.data);
    return sendData(res, data);
  },

  async getAccount(req, res) {
    if (!uuid.safeParse(req.params.id).success) {
      throw new HttpError(400, "INVALID_ID", "ID akun tidak valid.");
    }

    const data = await adminAccountsService.getAccount(req.params.id);
    return sendData(res, data);
  },

  async createAccount(req, res) {
    const input = parseBody(createAccountSchema, req.body);
    const data = await adminAccountsService.createAccount(input, req.auth.user.id);
    return sendData(res, data, 201);
  },

  async updateAccount(req, res) {
    if (!uuid.safeParse(req.params.id).success) {
      throw new HttpError(400, "INVALID_ID", "ID akun tidak valid.");
    }

    const input = parseBody(patchAccountSchema, req.body);
    const data = await adminAccountsService.updateAccount(req.params.id, input, req.auth.user.id);
    return sendData(res, data);
  },

  async deactivateAccount(req, res) {
    if (!uuid.safeParse(req.params.id).success) {
      throw new HttpError(400, "INVALID_ID", "ID akun tidak valid.");
    }

    const data = await adminAccountsService.deactivateAccount(req.params.id, req.auth.user.id);
    return sendData(res, data);
  },

  async setCounselorPublication(req, res) {
    if (!uuid.safeParse(req.params.counselorId).success) {
      throw new HttpError(400, "INVALID_ID", "ID konselor tidak valid.");
    }

    const input = parseBody(z.object({ is_public: z.boolean() }).strict(), req.body);
    const data = await adminAccountsService.setCounselorPublication(
      req.params.counselorId,
      input.is_public,
      req.auth.user.id,
    );
    return sendData(res, data);
  },
};

