import { parseBody, sendData } from "../lib/http.js";
import {
  registerSchema,
  loginSchema,
  resendConfirmationSchema,
} from "../validators/auth.validator.js";
import {
  registerUser,
  resendConfirmation,
  loginUser,
} from "../services/auth.service.js";

export const authController = {
  async register(req, res) {
    const input = parseBody(registerSchema, req.body);
    const result = await registerUser(input, req);
    return sendData(res, result, 201);
  },

  async resendConfirmation(req, res) {
    const input = parseBody(resendConfirmationSchema, req.body);
    const result = await resendConfirmation(input, req);
    return sendData(res, result);
  },

  async login(req, res) {
    const input = parseBody(loginSchema, req.body);
    const result = await loginUser(input);
    return sendData(res, result);
  },

  getMe(req, res) {
    return sendData(res, {
      user: { id: req.auth.user.id, email: req.auth.user.email },
      profile: req.auth.profile,
    });
  },

  logout(_req, res) {
    return res.status(200).json({
      data: { logged_out: true },
      message: "Hapus session lokal di client.",
    });
  },
};

