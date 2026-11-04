export const healthController = {
  getHealth(_req, res) {
    res.status(200).json({
      status: "ok",
      service: "sicare-backend",
      timestamp: new Date().toISOString(),
    });
  },
};

