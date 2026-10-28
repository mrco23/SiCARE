import app from "./app.js";
import { env } from "./src/config/env.js";

const server = app.listen(env.PORT, env.HOST, () => {
  console.info(`SiCARE API aktif di http://${env.HOST}:${env.PORT}`);
  console.info(`Environment: ${env.NODE_ENV}`);
  console.info(`Supabase server key: ${env.supabaseConfigured ? "configured" : "not configured (local setup mode)"}`);
});

function shutdown(signal) {
  console.info(`Menerima ${signal}; menutup server...`);
  server.close((error) => {
    if (error) {
      console.error("Server gagal ditutup dengan bersih.");
      process.exitCode = 1;
    }
  });
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
