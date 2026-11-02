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
import type { LoginForm } from "../../types/auth";

type LoginErrors = Partial<Record<keyof LoginForm, string>>;
type LoginLocationState = { notice?: string; from?: string };

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, resendConfirmation } = useAuth();
  const notice = (location.state as LoginLocationState | null)?.notice;

  const [form, setForm] = useState<LoginForm>({ identifier: "", password: "" });
  const [errors, setErrors] = useState<LoginErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Resend confirmation states
  const [showResend, setShowResend] = useState(false);
  const [resendEmail, setResendEmail] = useState("");
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

  const isEmailUnconfirmed =
    submitError.toLowerCase().includes("belum dikonfirmasi") ||
    submitError.toLowerCase().includes("belum diverifikasi");

  function setField(key: keyof LoginForm, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
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
    setSubmitError("");
    setResendSuccess("");

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
      const msg = error instanceof Error ? error.message : "Login gagal. Silakan coba lagi.";
      setSubmitError(msg);
      if (
        form.identifier.trim() &&
        (msg.toLowerCase().includes("belum dikonfirmasi") || msg.toLowerCase().includes("belum diverifikasi"))
      ) {
        setResendEmail(form.identifier.trim());
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend(event: FormEvent) {
    event.preventDefault();
    const targetEmail = (resendEmail || form.identifier).trim();
    if (!targetEmail) {
      setResendError("Masukkan email atau NIM/NIP Anda terlebih dahulu.");
      return;
    }

    setResending(true);
    setResendError("");
    setResendSuccess("");
    try {
      const res = await resendConfirmation(targetEmail);
      setResendSuccess(res.message || "Tautan verifikasi telah dikirimkan ke email Anda.");
      setCooldown(60);
    } catch (err) {
      setResendError(err instanceof Error ? err.message : "Gagal mengirim ulang email verifikasi.");
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
        {submitError && (
          <div
            role="alert"
            className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 space-y-2"
          >
            <p>{submitError}</p>
            {isEmailUnconfirmed && (
              <button
                type="button"
                onClick={() => {
                  setShowResend(true);
                  if (form.identifier.trim()) setResendEmail(form.identifier.trim());
                }}
                className="text-xs font-semibold text-red-800 underline hover:text-red-950 inline-block"
              >
                Kirim ulang email verifikasi
              </button>
            )}
          </div>
        )}

        {/* Resend Confirmation Panel */}
        {showResend && (
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
                id="resendEmail"
                type="text"
                placeholder="Email atau NIM/NIP"
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                className="text-xs"
              />
              <button
                type="button"
                disabled={resending || cooldown > 0}
                onClick={handleResend}
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

        {!showResend && (
          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => {
                setShowResend(true);
                if (form.identifier.trim()) setResendEmail(form.identifier.trim());
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
