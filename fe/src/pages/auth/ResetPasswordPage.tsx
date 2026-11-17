import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertCircle, CheckCircle2, Loader2, MailCheck } from "lucide-react";
import CenteredAuthLayout from "../../components/auth/CenteredAuthLayout";
import { Field, PasswordInput, TextInput } from "../../components/auth/FormControls";
import { getSupabaseClient, isSupabaseConfigured } from "../../lib/supabase";
import { apiRequest, ApiError } from "../../lib/api";
import { validateStrongPassword } from "../../lib/accountRules";

type Mode = "checking" | "request" | "reset" | "done";

/** True when the access token comes from a recovery (reset email) sign-in. */
function isRecoveryToken(token: string): boolean {
  try {
    const part = token.split(".")[1] ?? "";
    const payload = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/"))) as {
      amr?: Array<{ method?: string }>;
    };
    return Array.isArray(payload.amr) && payload.amr.some((item) => item?.method === "recovery");
  } catch {
    return false;
  }
}

/**
 * Lupa kata sandi dalam satu halaman:
 * - tanpa tautan email: minta tautan reset (email/NIM/NIP);
 * - dibuka dari tautan email Supabase (token pemulihan di URL): atur kata sandi baru.
 * Token pemulihan hanya disimpan di memori halaman, lalu sesi lokal dibersihkan.
 */
export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("checking");
  const [recoveryToken, setRecoveryToken] = useState<string | null>(null);
  const [linkError, setLinkError] = useState("");

  const [identifier, setIdentifier] = useState("");
  const [requestMessage, setRequestMessage] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    async function readRecoveryLink() {
      const searchParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const errorDescription =
        searchParams.get("error_description") || hashParams.get("error_description");
      const accessToken = hashParams.get("access_token");
      const tokenHash = searchParams.get("token_hash");

      if (errorDescription) {
        window.history.replaceState(null, "", window.location.pathname);
        if (!active) return;
        setLinkError("Tautan atur ulang kata sandi tidak valid atau sudah kedaluwarsa. Minta tautan baru di bawah.");
        setMode("request");
        return;
      }

      try {
        if (accessToken && hashParams.get("type") === "recovery") {
          window.history.replaceState(null, "", window.location.pathname);
          if (!active) return;
          setRecoveryToken(accessToken);
          setMode("reset");
          return;
        }
        if (tokenHash && isSupabaseConfigured()) {
          const { data, error } = await getSupabaseClient().auth.verifyOtp({
            token_hash: tokenHash,
            type: "recovery",
          });
          window.history.replaceState(null, "", window.location.pathname);
          if (error || !data.session) throw error ?? new Error("no session");
          if (!active) return;
          setRecoveryToken(data.session.access_token);
          setMode("reset");
          return;
        }
        // Supabase client may already have read (and cleared) the recovery link from the URL.
        if (isSupabaseConfigured()) {
          const { data } = await getSupabaseClient().auth.getSession();
          const token = data.session?.access_token;
          if (token && isRecoveryToken(token)) {
            if (!active) return;
            setRecoveryToken(token);
            setMode("reset");
            return;
          }
        }
      } catch {
        if (!active) return;
        setLinkError("Tautan atur ulang kata sandi tidak valid atau sudah kedaluwarsa. Minta tautan baru di bawah.");
      }
      if (active) setMode("request");
    }

    void readRecoveryLink();
    return () => {
      active = false;
    };
  }, []);

  const handleRequest = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    if (!identifier.trim()) {
      setFieldError("Email, NIM, atau NIP wajib diisi.");
      return;
    }
    setFieldError("");
    setSubmitError("");
    setSubmitting(true);
    try {
      const result = await apiRequest<{ sent: boolean; message: string }>("/auth/forgot-password", {
        method: "POST",
        body: { identifier: identifier.trim() },
      });
      setRequestMessage(result.message);
    } catch (error) {
      setSubmitError(
        error instanceof ApiError || error instanceof Error
          ? error.message
          : "Permintaan tidak dapat diproses. Silakan coba lagi.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting || !recoveryToken) return;
    const passwordError = validateStrongPassword(password);
    if (passwordError) {
      setFieldError(passwordError);
      return;
    }
    if (password !== confirmPassword) {
      setFieldError("Konfirmasi kata sandi tidak sama.");
      return;
    }
    setFieldError("");
    setSubmitError("");
    setSubmitting(true);
    try {
      await apiRequest<{ updated: boolean }>("/auth/reset-password", {
        method: "POST",
        accessToken: recoveryToken,
        body: { new_password: password },
      });
      setRecoveryToken(null);
      setPassword("");
      setConfirmPassword("");
      if (isSupabaseConfigured()) {
        await getSupabaseClient().auth.signOut({ scope: "local" }).catch(() => null);
      }
      setMode("done");
    } catch (error) {
      setSubmitError(
        error instanceof ApiError || error instanceof Error
          ? error.message
          : "Kata sandi belum dapat diperbarui. Silakan coba lagi.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const backToLogin = (
    <Link to="/login" className="font-semibold text-primary hover:underline">
      Kembali ke halaman masuk
    </Link>
  );

  if (mode === "checking") {
    return (
      <CenteredAuthLayout title="Atur ulang kata sandi" subtitle="Memeriksa tautan..." footer={backToLogin}>
        <div className="flex justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </CenteredAuthLayout>
    );
  }

  if (mode === "done") {
    return (
      <CenteredAuthLayout title="Kata sandi diperbarui" subtitle="Silakan masuk dengan kata sandi baru Anda." footer={backToLogin}>
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-700" />
          <p>Kata sandi berhasil diperbarui.</p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/login", { replace: true, state: { notice: "Kata sandi berhasil diperbarui. Silakan masuk." } })}
          className="mt-6 flex w-full items-center justify-center rounded-button bg-primary px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-primary-dark"
        >
          Masuk
        </button>
      </CenteredAuthLayout>
    );
  }

  if (mode === "reset") {
    return (
      <CenteredAuthLayout title="Buat kata sandi baru" subtitle="Gunakan kata sandi yang kuat dan belum pernah dipakai." footer={backToLogin}>
        <form onSubmit={handleReset} className="space-y-4" noValidate>
          <Field label="Kata sandi baru" htmlFor="new-password" error={fieldError} required>
            <PasswordInput
              id="new-password"
              autoComplete="new-password"
              value={password}
              error={fieldError}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Huruf besar, kecil, angka, dan simbol"
            />
          </Field>
          <Field label="Ulangi kata sandi baru" htmlFor="confirm-password" required>
            <PasswordInput
              id="confirm-password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Ketik ulang kata sandi baru"
            />
          </Field>
          {submitError && (
            <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-button bg-primary px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Simpan kata sandi baru
          </button>
        </form>
      </CenteredAuthLayout>
    );
  }

  return (
    <CenteredAuthLayout
      title="Lupa kata sandi"
      subtitle="Masukkan email, NIM, atau NIP akun Anda. Kami akan mengirim tautan untuk mengatur ulang kata sandi."
      footer={
        <>
          Ingat kata sandi?{" "}
          <Link to="/login" className="font-semibold text-primary hover:underline">
            Kembali masuk
          </Link>
        </>
      }
    >
      {linkError && (
        <div role="alert" className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{linkError}</span>
        </div>
      )}
      {requestMessage ? (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <MailCheck className="h-5 w-5 shrink-0 text-emerald-700" />
          <p>{requestMessage}</p>
        </div>
      ) : (
        <form onSubmit={handleRequest} className="space-y-4" noValidate>
          <Field label="Email, NIM, atau NIP" htmlFor="reset-identifier" error={fieldError} required>
            <TextInput
              id="reset-identifier"
              autoComplete="username"
              value={identifier}
              error={fieldError}
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder="nama@unikadelasalle.ac.id atau NIM"
            />
          </Field>
          {submitError && (
            <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-button bg-primary px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Kirim tautan atur ulang
          </button>
        </form>
      )}
    </CenteredAuthLayout>
  );
}
