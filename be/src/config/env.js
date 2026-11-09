import "dotenv/config";
import { z } from "zod";

const emptyToUndefined = (value) => (value === "" ? undefined : value);
const optionalSecret = z.preprocess(emptyToUndefined, z.string().trim().min(1).optional());
const booleanFromEnv = (defaultValue) =>
  z.preprocess((val) => {
    if (typeof val === "boolean") return val;
    if (typeof val === "string") {
      const lower = val.trim().toLowerCase();
      if (lower === "true" || lower === "1") return true;
      if (lower === "false" || lower === "0") return false;
    }
    return defaultValue;
  }, z.boolean());

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    HOST: z.string().trim().min(1).default("127.0.0.1"),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    FRONTEND_ORIGINS: z.string().trim().min(1).default("http://localhost:5173,http://127.0.0.1:5173"),
    SUPABASE_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
    SUPABASE_PUBLISHABLE_KEY: optionalSecret,
    SUPABASE_ANON_KEY: optionalSecret,
    SUPABASE_SECRET_KEY: optionalSecret,
    SUPABASE_SERVICE_ROLE_KEY: optionalSecret,
    FONNTE_TOKEN: optionalSecret,
    FONNTE_API_URL: z.string().trim().url().default("https://api.fonnte.com"),
    FONNTE_ENABLED: booleanFromEnv(false),
    FONNTE_WEBHOOK_SECRET: optionalSecret,
    FONNTE_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
    CRON_SECRET: optionalSecret,
    WHATSAPP_SEND_ENABLED: booleanFromEnv(false),
    WHATSAPP_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(20).default(5),
    WHATSAPP_WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(10).default(1),
    WHATSAPP_POLL_INTERVAL_MS: z.coerce.number().int().min(500).default(5000),
    WHATSAPP_TEST_MODE: booleanFromEnv(true),
    WHATSAPP_TEST_RECIPIENTS: z.preprocess(emptyToUndefined, z.string().trim().optional()),
    CONSENT_ENCRYPTION_KEY: optionalSecret,
    APP_BASE_URL: z.string().trim().url().default("http://localhost:5173"),
  })
  .superRefine((value, context) => {
    const hasSupabaseUrl = Boolean(value.SUPABASE_URL);
    const hasSecretKey = Boolean(value.SUPABASE_SECRET_KEY);
    const hasLegacyKey = Boolean(value.SUPABASE_SERVICE_ROLE_KEY);
    const hasAnySupabaseKey = hasSecretKey || hasLegacyKey;

    if (hasSupabaseUrl !== hasAnySupabaseKey) {
      context.addIssue({
        code: "custom",
        path: [hasSupabaseUrl ? "SUPABASE_SECRET_KEY" : "SUPABASE_URL"],
        message: "SUPABASE_URL dan tepat satu kunci server Supabase harus dikonfigurasi bersama.",
      });
    }

    if (hasSecretKey && hasLegacyKey) {
      context.addIssue({
        code: "custom",
        path: ["SUPABASE_SERVICE_ROLE_KEY"],
        message: "Isi SUPABASE_SECRET_KEY atau SUPABASE_SERVICE_ROLE_KEY, bukan keduanya.",
      });
    }

    if (value.NODE_ENV === "production" && (!hasSupabaseUrl || !hasAnySupabaseKey)) {
      context.addIssue({
        code: "custom",
        path: ["SUPABASE_URL"],
        message: "Konfigurasi Supabase wajib tersedia pada environment production.",
      });
    }

    if (value.NODE_ENV === "production" && !value.CONSENT_ENCRYPTION_KEY) {
      context.addIssue({
        code: "custom",
        path: ["CONSENT_ENCRYPTION_KEY"],
        message: "CONSENT_ENCRYPTION_KEY wajib dikonfigurasi pada environment production.",
      });
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join(".") || "environment"}: ${issue.message}`)
    .join("\n");

  throw new Error(`Konfigurasi environment SiCARE tidak valid:\n${details}`);
}

const validated = parsed.data;

export const env = Object.freeze({
  ...validated,
  frontendOrigins: validated.FRONTEND_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  supabaseServerKey: validated.SUPABASE_SECRET_KEY ?? validated.SUPABASE_SERVICE_ROLE_KEY,
  supabaseConfigured: Boolean(
    validated.SUPABASE_URL &&
      (validated.SUPABASE_SECRET_KEY || validated.SUPABASE_SERVICE_ROLE_KEY),
  ),
  whatsappTestRecipients: (validated.WHATSAPP_TEST_RECIPIENTS ?? "")
    .split(",")
    .map((s) => s.trim().replace(/[^0-9]/g, ""))
    .filter(Boolean),
  consentEncryptionKey: validated.CONSENT_ENCRYPTION_KEY,
  appBaseUrl: validated.APP_BASE_URL,
});
