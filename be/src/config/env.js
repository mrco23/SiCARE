import "dotenv/config";
import { z } from "zod";

const emptyToUndefined = (value) => (value === "" ? undefined : value);
const optionalSecret = z.preprocess(emptyToUndefined, z.string().trim().min(1).optional());

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    HOST: z.string().trim().min(1).default("127.0.0.1"),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    FRONTEND_ORIGINS: z.string().trim().min(1).default("http://localhost:5173"),
    SUPABASE_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
    SUPABASE_PUBLISHABLE_KEY: optionalSecret,
    SUPABASE_ANON_KEY: optionalSecret,
    SUPABASE_SECRET_KEY: optionalSecret,
    SUPABASE_SERVICE_ROLE_KEY: optionalSecret,
    FONNTE_TOKEN: optionalSecret,
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
});
