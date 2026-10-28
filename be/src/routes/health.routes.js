import { Router } from "express";

const router = Router();

router.get("/health", (_request, response) => {
  response.status(200).json({
    status: "ok",
    service: "sicare-backend",
    timestamp: new Date().toISOString(),
  });
});

export default router;
