import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./src/config/env.js";
import { errorHandler } from "./src/middleware/errorHandler.js";
import { notFoundHandler } from "./src/middleware/notFound.js";
import healthRoutes from "./src/routes/health.routes.js";
import authRoutes from "./src/routes/auth.routes.js";
import domainRoutes from "./src/routes/domain.routes.js";

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
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
    maxAge: 600,
  }),
);
app.use(express.json({ limit: "100kb", strict: true }));

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
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
