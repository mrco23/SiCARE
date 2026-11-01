import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

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
  const { signIn } = useAuth();
  const notice = (location.state as LoginLocationState | null)?.notice;

  const [form, setForm] = useState<LoginForm>({ identifier: "", password: "" });
  const [errors, setErrors] = useState<LoginErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

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
      setSubmitError(error instanceof Error ? error.message : "Login gagal. Silakan coba lagi.");
    } finally {
      setSubmitting(false);
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
            className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {submitError}
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
      </form>
    </CenteredAuthLayout>
  );
}
