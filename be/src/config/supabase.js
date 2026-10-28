import { createClient } from "@supabase/supabase-js";
import { env } from "./env.js";

let adminClient;

/**
 * Returns the server-only Supabase client.
 * Never expose this client or its key to the frontend.
 */
export function getSupabaseAdminClient() {
  if (!env.supabaseConfigured || !env.SUPABASE_URL || !env.supabaseServerKey) {
    throw new Error(
      "Supabase belum dikonfigurasi. Isi SUPABASE_URL dan SUPABASE_SECRET_KEY di be/.env.",
    );
  }

  if (!adminClient) {
    adminClient = createClient(env.SUPABASE_URL, env.supabaseServerKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: { "X-Client-Info": "sicare-backend" },
      },
    });
  }

  return adminClient;
}

export function isSupabaseConfigured() {
  return env.supabaseConfigured;
}
