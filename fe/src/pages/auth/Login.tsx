import { useState, useEffect, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Loader2, MailCheck } from "lucide-react";

import CenteredAuthLayout from "../../components/auth/CenteredAuthLayout";
import {
  Field,
  PasswordInput,
  TextInput,
} from "../../components/auth/FormControls";
import { getRoleHomePath } from "../../features/auth/auth-helpers";
import { useAuth } from "../../features/auth/useAuth";
import { ApiError } from "../../lib/api";
import type { LoginForm } from "../../types/auth";

type LoginErrors = Partial<Record<keyof LoginForm, string>>;
type LoginLocationState = { notice?: string; from?: string };

type LoginErrorKind =
  | "INVALID_CREDENTIALS"
  | "EMAIL_NOT_CONFIRMED"
  | "ACCOUNT_INACTIVE"
  | "NETWORK_ERROR"
  | "GENERAL_ERROR"
  | null;

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, resendConfirmation } = useAuth();
  const notice = (location.state as LoginLocationState | null)?.notice;

  const [form, setForm] = useState<LoginForm>({ identifier: "", password: "" });
  const [errors, setErrors] = useState<LoginErrors>({});
  const [submitting, setSubmitting] = useState(false);

  // Structured login error state
  const [errorKind, setErrorKind] = useState<LoginErrorKind>(null);
  const [errorMessage, setErrorMessage] = useState("");

  // Resend confirmation states
  const [showManualResend, setShowManualResend] = useState(false);
  const [resendIdentifier, setResendIdentifier] = useState("");
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState("");
  const [resendError, setResendError] = useState("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  function setField(key: keyof LoginForm, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    // Clear errors and verification panels when user edits form input
    setErrorKind(null);
    setErrorMessage("");
    setResendSuccess("");
    setResendError("");
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function validate(): LoginErrors {
    const next: LoginErrors = {};
    if (!form.identifier.trim()) next.identifier = "Email atau kode identitas wajib diisi";
    if (!form.password) next.password = "Kata sandi wajib diisi";
    return next;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Clear previous error state on submit
    setErrorKind(null);
    setErrorMessage("");
    setResendSuccess("");
    setResendError("");

    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) {
      document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      return;
    }

    setSubmitting(true);
    try {
      const profile = await signIn(form.identifier, form.password);
      navigate(getRoleHomePath(profile.app_role), { replace: true });
    } catch (error) {
      if (error instanceof ApiError) {
        if (
          error.code === "EMAIL_NOT_CONFIRMED" ||
          (error.status === 403 && error.code === "EMAIL_NOT_CONFIRMED")
        ) {
          setErrorKind("EMAIL_NOT_CONFIRMED");
          setErrorMessage(
            error.message ||
              "Email akun Anda belum diverifikasi. Silakan periksa kotak masuk atau spam email Anda.",
          );
          setResendIdentifier(form.identifier.trim());
        } else if (error.code === "INVALID_CREDENTIALS" || error.status === 401) {
          setErrorKind("INVALID_CREDENTIALS");
          setErrorMessage(error.message || "NIM/NIP/email atau kata sandi tidak benar.");
        } else if (
          error.code === "ACCOUNT_INACTIVE" ||
          (error.status === 403 && error.code === "ACCOUNT_INACTIVE")
        ) {
          setErrorKind("ACCOUNT_INACTIVE");
          setErrorMessage(
            error.message || "Akun belum aktif atau telah dinonaktifkan.",
          );
        } else if (
          error.code === "API_UNREACHABLE" ||
          error.code === "API_TIMEOUT" ||
          error.status === 0 ||
          error.status === 503
        ) {
          setErrorKind("NETWORK_ERROR");
          setErrorMessage(
            error.message ||
              "Layanan SiCARE sedang tidak dapat dijangkau. Periksa koneksi internet Anda lalu coba lagi.",
          );
        } else {
          setErrorKind("GENERAL_ERROR");
          setErrorMessage(error.message || "Login tidak dapat diproses. Silakan coba lagi.");
        }
      } else if (error instanceof Error) {
        setErrorKind("GENERAL_ERROR");
        setErrorMessage(error.message || "Login gagal. Silakan coba lagi.");
      } else {
        setErrorKind("GENERAL_ERROR");
        setErrorMessage("Login gagal. Silakan coba lagi.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend(targetInput?: string) {
    const target = (targetInput ?? resendIdentifier ?? form.identifier).trim();
    if (!target) {
      setResendError("Masukkan email atau NIM/NIP Anda terlebih dahulu.");
      return;
    }

    setResending(true);
    setResendError("");
    setResendSuccess("");
    try {
      const res = await resendConfirmation(target);
      setResendSuccess(
        res.message ||
          "Jika email terdaftar dan belum dikonfirmasi, tautan verifikasi telah dikirimkan ke kotak masuk Anda.",
      );
      setCooldown(60);
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        const match = err.message.match(/(\d+)\s*detik/i);
        const sec = match ? parseInt(match[1], 10) : 60;
        setCooldown(sec);
        setResendError(
          err.message ||
            `Mohon tunggu ${sec} detik sebelum meminta pengiriman ulang email verifikasi.`,
        );
      } else {
        setResendError(
          err instanceof Error
            ? err.message
            : "Gagal meminta pengiriman ulang email verifikasi.",
        );
      }
    } finally {
      setResending(false);
    }
  }

  return (
    <CenteredAuthLayout
      title="Selamat datang"
      subtitle="Masuk menggunakan NIM, NIP, atau email dan kata sandi Anda."
      footer={
        <>
          Belum punya akun?{" "}
          <Link
            to="/register"
            className="font-semibold text-primary hover:underline"
          >
            Daftar sekarang
          </Link>
        </>
      }
    >
      <form noValidate onSubmit={handleSubmit} className="space-y-5">
        {notice && (
          <div role="status" className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800">
            {notice}
          </div>
        )}

        {/* 1. Invalid credentials: pure credential error below form, NO resend button */}
        {errorKind === "INVALID_CREDENTIALS" && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            <p className="font-medium">{errorMessage}</p>
          </div>
        )}

        {/* 2. Unconfirmed email: educational info panel (NOT red error), password is correct */}
        {errorKind === "EMAIL_NOT_CONFIRMED" && (
          <div
            role="region"
            aria-label="Informasi verifikasi email"
            className="rounded-2xl border border-primary/25 bg-emerald-50/70 p-4.5 text-xs text-slate-800 shadow-sm space-y-3"
          >
            <div className="flex items-start gap-2.5">
              <div className="rounded-full bg-primary/10 p-1.5 text-primary shrink-0 mt-0.5">
                <MailCheck className="h-4 w-4" />
              </div>
              <div className="space-y-1">
                <h4 className="font-semibold text-primary text-sm">
                  Verifikasi Email Diperlukan
                </h4>
                <p className="text-slate-600 leading-relaxed">
                  Kata sandi Anda sudah benar, namun alamat email akun ini belum diverifikasi.
                </p>
                <p className="text-slate-600 leading-relaxed">
                  Silakan periksa <strong>kotak masuk (inbox)</strong> atau folder{" "}
                  <strong>spam/junk</strong> email Anda untuk mengonfirmasi akun sebelum masuk.
                </p>
              </div>
            </div>

            {resendSuccess && (
              <div className="rounded-xl bg-emerald-100/90 border border-emerald-300/60 p-3 text-emerald-950 leading-relaxed">
                {resendSuccess}
              </div>
            )}
            {resendError && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-amber-900 leading-relaxed">
                {resendError}
              </div>
            )}

            <div className="pt-1">
              <button
                type="button"
                disabled={resending || cooldown > 0}
                onClick={() => void handleResend(resendIdentifier || form.identifier)}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 font-semibold text-white shadow-sm transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60 text-xs"
              >
                {resending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Mengirimkan...
                  </>
                ) : cooldown > 0 ? (
                  `Kirim ulang dalam ${cooldown}d`
                ) : (
                  <>
                    <MailCheck className="h-3.5 w-3.5" />
                    Kirim ulang email verifikasi
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* 3. Inactive account: directed to admin, NO resend button */}
        {errorKind === "ACCOUNT_INACTIVE" && (
          <div
            role="alert"
            className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 space-y-1"
          >
            <p className="font-semibold">{errorMessage}</p>
            <p className="text-xs text-amber-800">
              Silakan hubungi administrator Lembaga Misi &amp; Identitas (LMI) untuk mengaktifkan kembali akun Anda.
            </p>
          </div>
        )}

        {/* 4. Network error / 503 */}
        {errorKind === "NETWORK_ERROR" && (
          <div
            role="alert"
            className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 space-y-1"
          >
            <p className="font-medium">{errorMessage}</p>
            <p className="text-xs text-slate-500">
              Pastikan koneksi internet Anda stabil atau server SiCARE sedang berjalan.
            </p>
          </div>
        )}

        {/* 5. General error */}
        {errorKind === "GENERAL_ERROR" && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            <p>{errorMessage}</p>
          </div>
        )}

        {/* Manual Resend Panel (Accessible independently via bottom link) */}
        {showManualResend && errorKind !== "EMAIL_NOT_CONFIRMED" && (
          <div className="rounded-xl border border-primary/20 bg-primary-soft/30 p-4 text-xs text-text-base space-y-3">
            <div className="flex items-center gap-2 font-semibold text-primary">
              <MailCheck className="h-4 w-4" />
              <span>Kirim Ulang Email Verifikasi</span>
            </div>
            <p className="text-text-muted">
              Masukkan email kampus atau NIM/NIP Anda untuk menerima tautan konfirmasi akun baru.
            </p>
            {resendSuccess && (
              <div className="rounded-lg bg-green-50 p-2 text-green-800">
                {resendSuccess}
              </div>
            )}
            {resendError && (
              <div className="rounded-lg bg-red-50 p-2 text-red-700">
                {resendError}
              </div>
            )}
            <div className="flex gap-2">
              <TextInput
                id="resendIdentifierInput"
                type="text"
                placeholder="Email atau NIM/NIP"
                value={resendIdentifier}
                onChange={(e) => setResendIdentifier(e.target.value)}
                className="text-xs"
              />
              <button
                type="button"
                disabled={resending || cooldown > 0}
                onClick={() => void handleResend(resendIdentifier)}
                className="shrink-0 rounded-lg bg-primary px-3 py-2 font-medium text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
              >
                {resending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : cooldown > 0 ? (
                  `${cooldown}d`
                ) : (
                  "Kirim"
                )}
              </button>
            </div>
          </div>
        )}

        <Field
          label="NIM/NIP atau email"
          htmlFor="identifier"
          error={errors.identifier}
          required
          hint="Gunakan kode identitas yang terdaftar atau alamat email akun Anda."
        >
          <TextInput
            id="identifier"
            name="identifier"
            type="text"
            inputMode="text"
            autoComplete="username"
            placeholder="NIM, NIP, atau nama@kampus.ac.id"
            value={form.identifier}
            error={errors.identifier}
            onChange={(event) => setField("identifier", event.target.value)}
          />
        </Field>

        <Field
          label="Kata sandi"
          htmlFor="password"
          error={errors.password}
          required
        >
          <PasswordInput
            id="password"
            name="password"
            autoComplete="current-password"
            placeholder="Masukkan kata sandi"
            value={form.password}
            error={errors.password}
            onChange={(event) => setField("password", event.target.value)}
          />
        </Field>

        <button
          type="submit"
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded-button bg-primary px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Memproses...
            </>
          ) : (
            "Masuk"
          )}
        </button>

        {!showManualResend && errorKind !== "EMAIL_NOT_CONFIRMED" && (
          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => {
                setShowManualResend(true);
                if (form.identifier.trim()) setResendIdentifier(form.identifier.trim());
              }}
              className="text-xs text-text-muted hover:text-primary transition underline"
            >
              Belum menerima email verifikasi? Kirim ulang
            </button>
          </div>
        )}
      </form>
    </CenteredAuthLayout>
  );
}
