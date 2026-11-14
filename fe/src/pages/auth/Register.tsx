import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import AuthLayout from "../../components/auth/AuthLayout";
import { Field, PasswordInput, TextInput } from "../../components/auth/FormControls";
import { CampusEmailInput, PasswordRuleList, PhoneE164Input } from "../../components/shared/AccountInputs";
import {
  CAMPUS_EMAIL_DOMAIN,
  buildCampusEmail,
  getCampusEmailLocalPart,
  toIndonesianE164,
  validateCampusEmailLocalPart,
  validateIndonesianPhone,
  validateStrongPassword,
} from "../../lib/accountRules";
import { useAuth } from "../../features/auth/useAuth";
import type { MemberCategory, RegisterRequest } from "../../types/auth";

const STUDENT_NIM_RE = /^\d{8}$/;
const STAFF_NIP_RE = /^\d{8,18}$/;
const STEPS = ["Kategori", "Akun", "Profil", "Tinjau & kirim"] as const;

type RegistrationCategory = "student" | "faculty_staff";
type RegisterForm = {
  category: RegistrationCategory | "";
  identityCode: string;
  email: string;
  password: string;
  confirmPassword: string;
  fullName: string;
  phone: string;
};
type RegisterErrors = Partial<Record<keyof RegisterForm, string>>;

const INITIAL_FORM: RegisterForm = {
  category: "",
  identityCode: "",
  email: "",
  password: "",
  confirmPassword: "",
  fullName: "",
  phone: "",
};

function deriveStudentEmail(identityCode: string): string {
  const clean = identityCode.trim();
  return STUDENT_NIM_RE.test(clean) ? buildCampusEmail(clean) : "";
}

function validateCategory(form: RegisterForm): RegisterErrors {
  return form.category ? {} : { category: "Pilih kategori keanggotaan Anda." };
}

function validateAccount(form: RegisterForm): RegisterErrors {
  const errors: RegisterErrors = {};
  const code = form.identityCode.trim();

  if (form.category === "student") {
    if (!code) errors.identityCode = "NIM wajib diisi.";
    else if (!STUDENT_NIM_RE.test(code)) errors.identityCode = "NIM harus berupa 8 digit angka.";
    if (form.email !== deriveStudentEmail(code)) errors.email = "Email mahasiswa harus sesuai dengan NIM.";
  } else if (form.category === "faculty_staff") {
    if (!code) errors.identityCode = "NIP wajib diisi.";
    else if (!STAFF_NIP_RE.test(code)) errors.identityCode = "NIP harus berupa 8–18 digit angka.";
    const emailError = validateCampusEmailLocalPart(getCampusEmailLocalPart(form.email));
    if (emailError) errors.email = emailError;
  }

  const passwordError = validateStrongPassword(form.password);
  if (passwordError) errors.password = passwordError;
  if (form.confirmPassword !== form.password) errors.confirmPassword = "Konfirmasi kata sandi tidak sama.";
  return errors;
}

function validateProfile(form: RegisterForm): RegisterErrors {
  const errors: RegisterErrors = {};
  if (!form.fullName.trim()) errors.fullName = "Nama lengkap wajib diisi.";
  else if (form.fullName.trim().length > 160) errors.fullName = "Nama maksimal 160 karakter.";

  const phoneError = validateIndonesianPhone(form.phone, { required: true });
  if (phoneError) errors.phone = phoneError;
  return errors;
}

function validateStep(step: number, form: RegisterForm): RegisterErrors {
  if (step === 0) return validateCategory(form);
  if (step === 1) return validateAccount(form);
  if (step === 2) return validateProfile(form);
  return {};
}

function FieldGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}

export default function Register() {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<RegisterForm>(INITIAL_FORM);
  const [errors, setErrors] = useState<RegisterErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const isStudent = form.category === "student";
  const isLastStep = step === STEPS.length - 1;

  function setField(key: keyof RegisterForm, value: string) {
    setForm((previous) => {
      const next = { ...previous, [key]: value } as RegisterForm;
      if (key === "identityCode" && previous.category === "student") {
        next.email = deriveStudentEmail(value);
      }
      if (key === "category") {
        const category = value as RegistrationCategory | "";
        next.category = category;
        next.identityCode = "";
        next.email = "";
      }
      return next;
    });
    setErrors((previous) => {
      const next = { ...previous };
      delete next[key];
      if (key === "identityCode" && form.category === "student") delete next.email;
      return next;
    });
  }

  function focusFirstError() {
    window.setTimeout(() => {
      document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }, 0);
  }

  function handleNext() {
    const nextErrors = validateStep(step, form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      focusFirstError();
      return;
    }
    setSubmitError("");
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleBack() {
    setErrors({});
    setSubmitError("");
    setStep((current) => Math.max(current - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError("");

    if (!isLastStep) {
      handleNext();
      return;
    }

    for (let index = 0; index < STEPS.length - 1; index += 1) {
      const stepErrors = validateStep(index, form);
      if (Object.keys(stepErrors).length) {
        setStep(index);
        setErrors(stepErrors);
        focusFirstError();
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload: RegisterRequest = {
        email: form.email.trim().toLowerCase(),
        password: form.password,
        full_name: form.fullName.trim(),
        identity_code: form.identityCode.trim(),
        member_category: form.category as MemberCategory,
        phone_e164: toIndonesianE164(form.phone),
      };
      const result = await signUp(payload);

      if (result.profile) {
        navigate("/klien", { replace: true });
        return;
      }

      navigate("/login", {
        replace: true,
        state: {
          notice: "Silakan periksa email untuk melakukan verifikasi akun",
        },
      });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Pendaftaran gagal. Silakan coba lagi.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      wide
      title="Buat akun baru"
      subtitle="Daftarkan akun SiCARE menggunakan data akun yang akan disimpan oleh sistem."
      footer={
        <>
          Sudah punya akun?{" "}
          <Link to="/login" className="font-semibold text-primary hover:underline">
            Masuk
          </Link>
        </>
      }
    >
      <form noValidate onSubmit={handleSubmit} className="space-y-8">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-text-muted">
            <span>Langkah {step + 1} dari {STEPS.length}</span>
            <span>{STEPS[step]}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
            <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
          </div>
        </div>

        {submitError && (
          <div role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {submitError}
          </div>
        )}

        {step === 0 && (
          <section className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-primary">Kategori keanggotaan</h2>
              <p className="mt-1 text-xs text-text-muted">Semua pendaftaran mandiri membuat akun klien. Hak akses konselor, admin, dan Kepala LMI ditetapkan oleh admin.</p>
            </div>
            {errors.category && <p role="alert" className="text-xs text-red-600">{errors.category}</p>}
            <div className="grid gap-3 sm:grid-cols-2">
              {([
                { value: "student", label: "Mahasiswa", description: "Akun mahasiswa Universitas Katolik De La Salle Manado" },
                { value: "faculty_staff", label: "Dosen / Staff", description: "Akun dosen atau tenaga kependidikan" },
              ] as const).map((option) => (
                <label key={option.value} className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition ${form.category === option.value ? "border-primary bg-primary/5" : "border-gray-200 hover:border-primary-light"}`}>
                  <input
                    type="radio"
                    name="category"
                    value={option.value}
                    checked={form.category === option.value}
                    onChange={() => setField("category", option.value)}
                    aria-invalid={Boolean(errors.category)}
                    className="mt-1 h-4 w-4 accent-primary"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-text-base">{option.label}</span>
                    <span className="mt-1 block text-xs text-text-muted">{option.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </section>
        )}

        {step === 1 && (
          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-primary">Informasi akun</h2>
            <FieldGrid>
              <Field label={isStudent ? "NIM" : "NIP"} htmlFor="identityCode" error={errors.identityCode} required>
                <TextInput
                  id="identityCode"
                  name="identityCode"
                  inputMode="numeric"
                  autoComplete="username"
                  placeholder={isStudent ? "Contoh: 24013037" : "Masukkan NIP"}
                  value={form.identityCode}
                  error={errors.identityCode}
                  onChange={(event) => setField("identityCode", event.target.value)}
                />
              </Field>
              <Field
                label="Email kampus"
                htmlFor="email"
                error={errors.email}
                required
                hint={isStudent ? "Email dibuat otomatis berdasarkan NIM." : `Cukup isi nama email Anda; akhiran @${CAMPUS_EMAIL_DOMAIN} ditambahkan otomatis.`}
              >
                <CampusEmailInput
                  id="email"
                  name="email"
                  autoComplete="email"
                  placeholder={isStudent ? "Otomatis dari NIM" : "nama.anda"}
                  value={getCampusEmailLocalPart(form.email)}
                  invalid={Boolean(errors.email)}
                  readOnly={isStudent}
                  inputClassName="py-3"
                  onChange={(localPart) => setField("email", buildCampusEmail(localPart))}
                />
              </Field>
              <Field label="Kata sandi" htmlFor="password" error={errors.password} required>
                <PasswordInput
                  id="password"
                  name="password"
                  autoComplete="new-password"
                  placeholder="Buat kata sandi"
                  value={form.password}
                  error={errors.password}
                  onChange={(event) => setField("password", event.target.value)}
                />
                <PasswordRuleList password={form.password} className="mt-1" />
              </Field>
              <Field label="Konfirmasi kata sandi" htmlFor="confirmPassword" error={errors.confirmPassword} required>
                <PasswordInput
                  id="confirmPassword"
                  name="confirmPassword"
                  autoComplete="new-password"
                  placeholder="Ulangi kata sandi"
                  value={form.confirmPassword}
                  error={errors.confirmPassword}
                  onChange={(event) => setField("confirmPassword", event.target.value)}
                />
              </Field>
            </FieldGrid>
          </section>
        )}

        {step === 2 && (
          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-primary">Informasi profil</h2>
            <p className="text-xs text-text-muted">Tahap ini hanya meminta data yang sudah didukung tabel profil. Data konseling atau demografi tambahan tidak dikumpulkan pada formulir pendaftaran ini.</p>
            <FieldGrid>
              <Field label="Nama lengkap" htmlFor="fullName" error={errors.fullName} required>
                <TextInput
                  id="fullName"
                  name="fullName"
                  autoComplete="name"
                  placeholder="Nama sesuai identitas"
                  maxLength={160}
                  value={form.fullName}
                  error={errors.fullName}
                  onChange={(event) => setField("fullName", event.target.value)}
                />
              </Field>
              <Field label="Nomor telepon" htmlFor="phone" error={errors.phone} required hint="Isi nomor tanpa angka 0 di depan, misalnya 81234567890.">
                <PhoneE164Input
                  id="phone"
                  name="phone"
                  value={form.phone}
                  invalid={Boolean(errors.phone)}
                  inputClassName="py-3"
                  onChange={(e164) => setField("phone", e164)}
                />
              </Field>
            </FieldGrid>
          </section>
        )}

        {step === 3 && (
          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-primary">Tinjau data pendaftaran</h2>
            <dl className="divide-y divide-gray-100 rounded-xl border border-gray-200 px-4">
              <div className="flex flex-col gap-1 py-3 sm:flex-row sm:gap-4"><dt className="text-xs font-medium text-text-muted sm:w-44">Kategori</dt><dd className="text-sm text-text-base">{form.category === "student" ? "Mahasiswa" : "Dosen / Staff"}</dd></div>
              <div className="flex flex-col gap-1 py-3 sm:flex-row sm:gap-4"><dt className="text-xs font-medium text-text-muted sm:w-44">NIM/NIP</dt><dd className="break-words text-sm text-text-base">{form.identityCode || "-"}</dd></div>
              <div className="flex flex-col gap-1 py-3 sm:flex-row sm:gap-4"><dt className="text-xs font-medium text-text-muted sm:w-44">Email</dt><dd className="break-words text-sm text-text-base">{form.email || "-"}</dd></div>
              <div className="flex flex-col gap-1 py-3 sm:flex-row sm:gap-4"><dt className="text-xs font-medium text-text-muted sm:w-44">Nama lengkap</dt><dd className="break-words text-sm text-text-base">{form.fullName || "-"}</dd></div>
              <div className="flex flex-col gap-1 py-3 sm:flex-row sm:gap-4"><dt className="text-xs font-medium text-text-muted sm:w-44">Nomor telepon</dt><dd className="break-words text-sm text-text-base">{toIndonesianE164(form.phone) || "-"}</dd></div>
            </dl>
            <p className="rounded-xl bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">Pendaftaran mandiri tidak dapat menentukan role aplikasi. Akun baru dibuat sebagai klien. Peran konselor, admin, dan Kepala LMI harus diberikan melalui proses administrasi.</p>
          </section>
        )}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          {step > 0 ? (
            <button type="button" onClick={handleBack} disabled={submitting} className="flex items-center justify-center gap-2 rounded-button border border-gray-300 px-6 py-3 text-sm font-semibold text-text-base transition hover:bg-gray-50 disabled:opacity-70">
              <ArrowLeft className="h-4 w-4" /> Kembali
            </button>
          ) : <span />}
          {isLastStep ? (
            <button key="submit" type="submit" disabled={submitting} className="flex items-center justify-center gap-2 rounded-button bg-primary px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-70">
              {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Memproses...</> : "Daftar"}
            </button>
          ) : (
            <button key="next" type="button" onClick={handleNext} className="flex items-center justify-center gap-2 rounded-button bg-primary px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-primary-dark">
              Lanjut <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </form>
    </AuthLayout>
  );
}
