import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

import CenteredAuthLayout from "../../components/auth/CenteredAuthLayout";
import {
  Field,
  PasswordInput,
  TextInput,
} from "../../components/auth/FormControls";
import type { LoginForm } from "../../types/auth";

type LoginErrors = Partial<Record<keyof LoginForm, string>>;

export default function Login() {
  const navigate = useNavigate();

  const [form, setForm] = useState<LoginForm>({ nim: "", password: "" });
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
    if (!form.nim.trim()) next.nim = "NIM/NIP wajib diisi";
    if (!form.password) next.password = "Kata sandi wajib diisi";
    return next;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitError("");

    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) {
      document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      return;
    }

    setSubmitting(true);
    try {
      // TODO: ganti dengan pemanggilan API login yang sebenarnya.
      await new Promise((resolve) => setTimeout(resolve, 600));
      navigate("/client");
    } catch {
      setSubmitError(
        "Gagal masuk. Periksa kembali NIM/NIP dan kata sandi Anda.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <CenteredAuthLayout
      title="Selamat datang"
      subtitle="Masuk menggunakan NIM/NIP dan kata sandi Anda."
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
        {submitError && (
          <div
            role="alert"
            className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {submitError}
          </div>
        )}

        <Field label="NIM/NIP" htmlFor="nim" error={errors.nim} required>
          <TextInput
            id="nim"
            name="nim"
            type="text"
            inputMode="text"
            autoComplete="username"
            placeholder="Masukkan NIM atau NIP"
            value={form.nim}
            error={errors.nim}
            onChange={(e) => setField("nim", e.target.value)}
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
            onChange={(e) => setField("password", e.target.value)}
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
