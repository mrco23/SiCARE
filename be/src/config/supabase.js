import { createClient } from "@supabase/supabase-js";
import { env } from "./env.js";

let adminClient;
let testAdminClient = null;

/**
 * Injects or clears a mock Supabase admin client for automated tests so ownership
 * and authorization tests can execute route handlers without live credentials.
 */
export function setSupabaseAdminClientForTests(client = null) {
  testAdminClient = client;
}

/**
 * Returns the server-only Supabase client.
 * Never expose this client or its key to the frontend.
 */
export function getSupabaseAdminClient() {
  if (testAdminClient) return testAdminClient;

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
  return Boolean(testAdminClient) || env.supabaseConfigured;
}
