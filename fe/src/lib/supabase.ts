import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabasePublicKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

let client: SupabaseClient | null = null;

/** True when the public Supabase URL and key are configured in the frontend environment. */
export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabasePublicKey);
}

/**
 * Lazily creates the browser Supabase client so the existing mock UI can continue to run
 * when local Supabase credentials have not been configured yet.
 *
 * The browser client uses sessionStorage for auth state to avoid persistent auth tokens in
 * localStorage. This is not a substitute for server authorization or database RLS.
 */
export function getSupabaseClient(): SupabaseClient {
  if (!supabaseUrl || !supabasePublicKey) {
    throw new Error(
      "Supabase frontend belum dikonfigurasi. Salin fe/.env.example menjadi fe/.env.local dan isi URL serta publishable key.",
    );
  }

  if (typeof window === "undefined") {
    throw new Error("Supabase browser client hanya dapat dibuat di lingkungan browser.");
  }

  if (!client) {
    client = createClient(supabaseUrl, supabasePublicKey, {
      auth: {
        storage: window.sessionStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }

  return client;
}
