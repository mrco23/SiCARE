import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, Loader2 } from "lucide-react";
import { useAuth } from "./useAuth";

export default function SignOutPanel() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSignOut() {
    setSubmitting(true);
    setError("");
    try {
      await signOut();
      navigate("/login", { replace: true });
    } catch {
      setError("Sesi lokal tidak dapat ditutup. Silakan muat ulang halaman dan coba lagi.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mt-8 flex flex-col gap-4 rounded-2xl border border-red-100 bg-white p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div>
        <h2 className="text-base font-semibold text-gray-900">Keluar dari SiCARE</h2>
        <p className="mt-1 text-sm text-gray-500">Tutup sesi pada perangkat ini dengan aman.</p>
        {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
      </div>
      <button
        type="button"
        onClick={() => void handleSignOut()}
        disabled={submitting}
        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
        {submitting ? "Keluar..." : "Keluar"}
      </button>
    </section>
  );
}
