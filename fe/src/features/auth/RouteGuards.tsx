import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { getRoleHomePath } from "./auth-helpers";
import { useAuth } from "./useAuth";
import type { AppRole } from "../../types/auth";

function AuthLoadingScreen() {
  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-6 text-text-base">
      <div className="flex items-center gap-3 text-sm text-text-muted" role="status">
        <Loader2 className="h-5 w-5 animate-spin" />
        Memeriksa sesi SiCARE...
      </div>
    </main>
  );
}

function AuthErrorScreen({ onRetry, message }: { onRetry: () => void; message: string }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-6 text-text-base">
      <section className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold">Sesi belum dapat diverifikasi</h1>
        <p className="mt-2 text-sm text-text-muted">{message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark"
        >
          Coba lagi
        </button>
      </section>
    </main>
  );
}

export function ProtectedRoute({
  allowedRoles,
  children,
}: {
  allowedRoles: readonly AppRole[];
  children: ReactNode;
}) {
  const { profile, loading, authError, refreshProfile } = useAuth();
  const location = useLocation();

  if (loading) return <AuthLoadingScreen />;
  if (!profile && authError) {
    return <AuthErrorScreen message={authError} onRetry={() => void refreshProfile().catch(() => undefined)} />;
  }
  if (!profile) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (!allowedRoles.includes(profile.app_role)) {
    return <Navigate to={getRoleHomePath(profile.app_role)} replace />;
  }

  return children;
}

export function GuestOnlyRoute({ children }: { children: ReactNode }) {
  const { profile, loading } = useAuth();
  if (loading) return <AuthLoadingScreen />;
  if (profile) return <Navigate to={getRoleHomePath(profile.app_role)} replace />;
  return children;
}
