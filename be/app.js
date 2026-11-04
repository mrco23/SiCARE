import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./src/config/env.js";
import { errorHandler } from "./src/middleware/errorHandler.js";
import { notFoundHandler } from "./src/middleware/notFound.js";
import healthRoutes from "./src/routes/health.routes.js";
import authRoutes from "./src/routes/auth.routes.js";
import domainRoutes from "./src/routes/domain.routes.js";
import bookingRoutes from "./src/routes/booking.routes.js";
import sessionRoutes from "./src/routes/session.routes.js";
import feedbackRoutes from "./src/routes/feedback.routes.js";
import notificationRoutes from "./src/routes/notification.routes.js";
import adminRoutes from "./src/routes/admin.routes.js";
import counselorRoutes from "./src/routes/counselor.routes.js";
import reportingRoutes from "./src/routes/reporting.routes.js";
import webhookRoutes from "./src/routes/webhook.routes.js";
import consentRoutes from "./src/routes/consent.routes.js";

const app = express();
const allowedOrigins = new Set(env.frontendOrigins);

app.disable("x-powered-by");
app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      // Requests without Origin (e.g. local health checks) are not browser CORS requests.
      if (!origin || allowedOrigins.has(origin)) return callback(null, true);
      const error = new Error("Origin tidak diizinkan oleh kebijakan CORS.");
      error.status = 403;
      error.code = "ORIGIN_NOT_ALLOWED";
      callback(error);
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id", "X-Counselor-History-Grant"],
    maxAge: 600,
  })
);
app.use(express.json({ limit: "5mb", strict: true }));

app.get("/", (_request, response) => {
  response.status(200).json({
    name: "SiCARE API",
    apiVersion: "v1",
    health: "/api/v1/health",
  });
});

app.use("/api/v1", healthRoutes);
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1", domainRoutes);
app.use("/api/v1/bookings", bookingRoutes);
app.use("/api/v1/sessions", sessionRoutes);
app.use("/api/v1", feedbackRoutes);
app.use("/api/v1/notifications", notificationRoutes);
app.use("/api/v1/counselor", counselorRoutes);
app.use("/api/v1/admin", adminRoutes);
app.use("/api/v1", reportingRoutes);
app.use("/api/v1/webhooks", webhookRoutes);
app.use("/api/v1/consents", consentRoutes);
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
