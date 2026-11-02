import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { apiRequest, ApiError } from "../../lib/api";
import { AuthContext } from "./auth-context";
import type { AuthContextValue } from "./auth-context";
import { getSupabaseClient, isSupabaseConfigured } from "../../lib/supabase";
import type {
  AuthLoginResponse,
  AuthMeResponse,
  AuthProfile,
  AuthRegisterResponse,
  AuthUser,
  RegisterRequest,
} from "../../types/auth";

function mapAuthUser(user: { id: string; email?: string | null }): AuthUser {
  return { id: user.id, email: user.email ?? "" };
}

function missingConfigurationMessage(): string {
  return "Autentikasi frontend belum dikonfigurasi. Isi VITE_SUPABASE_URL dan VITE_SUPABASE_PUBLISHABLE_KEY di fe/.env.local.";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [loading, setLoading] = useState(() => isSupabaseConfigured());
  const [authError, setAuthError] = useState<string | null>(() =>
    isSupabaseConfigured() ? null : missingConfigurationMessage(),
  );

  const loadProfile = useCallback(async (accessToken: string): Promise<AuthProfile> => {
    const result = await apiRequest<AuthMeResponse>("/auth/me", { accessToken });
    setUser(result.user);
    setProfile(result.profile);
    setAuthError(null);
    return result.profile;
  }, []);

  const refreshProfile = useCallback(async (): Promise<AuthProfile | null> => {
    if (!isSupabaseConfigured()) {
      setAuthError(missingConfigurationMessage());
      return null;
    }

    const client = getSupabaseClient();
    const { data, error } = await client.auth.getSession();
    if (error) {
      setAuthError("Sesi autentikasi tidak dapat dibaca. Silakan masuk kembali.");
      throw error;
    }
    if (!data.session) {
      setUser(null);
      setProfile(null);
      setAuthError(null);
      return null;
    }

    try {
      return await loadProfile(data.session.access_token);
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        await client.auth.signOut({ scope: "local" });
        setUser(null);
        setProfile(null);
      }
      setAuthError(error instanceof Error ? error.message : "Profil tidak dapat diverifikasi.");
      throw error;
    }
  }, [loadProfile]);

  useEffect(() => {
    let active = true;

    if (!isSupabaseConfigured()) {
      return () => {
        active = false;
      };
    }

    const client = getSupabaseClient();
    const { data: authListener } = client.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (!session) {
        setUser(null);
        setProfile(null);
        setAuthError(null);
        return;
      }
      setUser(mapAuthUser(session.user));

      // Supabase may restore a session from an email-confirmation callback after
      // the initial bootstrap. Fetch the server-verified profile outside its auth lock.
      if (event === "SIGNED_IN") {
        window.setTimeout(() => {
          void apiRequest<AuthMeResponse>("/auth/me", {
            accessToken: session.access_token,
          }).then((result) => {
            if (!active) return;
            setUser(result.user);
            setProfile(result.profile);
            setAuthError(null);
          }).catch(async (error: unknown) => {
            if (!active) return;
            if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
              await client.auth.signOut({ scope: "local" });
              setUser(null);
              setProfile(null);
            }
            setAuthError(error instanceof Error ? error.message : "Profil tidak dapat diverifikasi.");
          });
        }, 0);
      }
    });

    async function initializeSession() {
      try {
        const { data, error } = await client.auth.getSession();
        if (error) throw error;
        if (!data.session) {
          if (active) {
            setUser(null);
            setProfile(null);
            setAuthError(null);
          }
          return;
        }
        if (active) setUser(mapAuthUser(data.session.user));
        const result = await apiRequest<AuthMeResponse>("/auth/me", {
          accessToken: data.session.access_token,
        });
        if (active) {
          setUser(result.user);
          setProfile(result.profile);
          setAuthError(null);
        }
      } catch (error) {
        if (!active) return;
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          await client.auth.signOut({ scope: "local" });
          setUser(null);
          setProfile(null);
        }
        setAuthError(error instanceof Error ? error.message : "Sesi tidak dapat diverifikasi.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void initializeSession();

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (identifier: string, password: string) => {
    if (!isSupabaseConfigured()) throw new Error(missingConfigurationMessage());

    const result = await apiRequest<AuthLoginResponse>("/auth/login", {
      method: "POST",
      auth: false,
      body: { identifier: identifier.trim(), password },
    });

    const client = getSupabaseClient();
    const { data, error } = await client.auth.setSession({
      access_token: result.session.access_token,
      refresh_token: result.session.refresh_token,
    });
    if (error || !data.session) {
      await client.auth.signOut({ scope: "local" });
      throw new Error("Login berhasil diverifikasi backend, tetapi sesi browser gagal disimpan. Periksa konfigurasi Supabase frontend.");
    }

    setUser(result.user);
    setProfile(result.profile);
    setAuthError(null);
    setLoading(false);
    return result.profile;
  }, []);

  const signUp = useCallback(async (input: RegisterRequest) => {
    if (!isSupabaseConfigured()) throw new Error(missingConfigurationMessage());

    const result = await apiRequest<AuthRegisterResponse>("/auth/register", {
      method: "POST",
      auth: false,
      body: input,
    });
    setAuthError(null);

    let registeredProfile: AuthProfile | null = null;
    if (result.session?.access_token && result.session.refresh_token) {
      const client = getSupabaseClient();
      const { data, error } = await client.auth.setSession({
        access_token: result.session.access_token,
        refresh_token: result.session.refresh_token,
      });
      if (error || !data.session) {
        throw new Error("Akun sudah dibuat, tetapi sesi browser gagal disimpan. Silakan masuk dari halaman login.");
      }
      try {
        registeredProfile = await loadProfile(data.session.access_token);
      } catch {
        await client.auth.signOut({ scope: "local" });
        throw new Error("Akun sudah dibuat, tetapi profil belum dapat diverifikasi. Jangan mendaftar ulang; coba masuk kembali setelah backend tersedia.");
      }
    }

    return {
      emailConfirmationRequired: result.email_confirmation_required,
      profile: registeredProfile,
    };
  }, [loadProfile]);

  const signOut = useCallback(async () => {
    if (isSupabaseConfigured()) {
      const client = getSupabaseClient();
      try {
        const { data } = await client.auth.getSession();
        if (data.session?.access_token) {
          await apiRequest("/auth/logout", {
            method: "POST",
            accessToken: data.session.access_token,
          });
        }
      } catch {
        // Logout lokal tetap harus berjalan jika backend sedang tidak tersedia.
      } finally {
        await client.auth.signOut({ scope: "local" });
      }
    }
    setUser(null);
    setProfile(null);
    setAuthError(null);
    setLoading(false);
  }, []);

  const resendConfirmation = useCallback(async (email: string) => {
    return await apiRequest<{ sent: boolean; message: string }>("/auth/resend-confirmation", {
      method: "POST",
      auth: false,
      body: { email: email.trim().toLowerCase() },
    });
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    profile,
    loading,
    authError,
    signIn,
    signUp,
    signOut,
    refreshProfile,
    resendConfirmation,
  }), [user, profile, loading, authError, signIn, signUp, signOut, refreshProfile, resendConfirmation]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
