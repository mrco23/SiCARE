import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";

import AuthLayout from "../../components/auth/AuthLayout";
import {
  Field,
  PasswordInput,
  RadioGroup,
  SelectInput,
  TextArea,
  TextInput,
} from "../../components/auth/FormControls";
import {
  EDUCATION_LEVELS,
  FACULTIES,
  FACULTY_PROGRAMS,
  GENDERS,
  MARITAL_STATUSES,
  RELIGIONS,
} from "../../constants/registerOptions";

/* ========================= KONFIGURASI ========================= */
const CAMPUS_DOMAIN = "unikadelasalle.ac.id";
const STAFF_EMAIL_RE = new RegExp(
  `^[^\\s@]+@${CAMPUS_DOMAIN.replace(/\./g, "\\.")}$`,
  "i",
);
const STUDENT_NIM_RE = /^\d{8}$/; // sesuaikan dengan format NIM kampus
const STAFF_NIP_RE = /^\d{8,18}$/; // sesuaikan dengan format NIP kampus
const STEP_COUNT = 5;

/* ========================= TIPE ========================= */
type Role = "mahasiswa" | "dosen";

type RegisterForm = {
  role: Role | "";
  nim: string; // NIM untuk mahasiswa, NIP untuk dosen/staff
  email: string;
  password: string;
  confirmPassword: string;
  fullName: string;
  gender: string;
  birthDate: string;
  phone: string;
  ethnicity: string;
  religion: string;
  address: string;
  maritalStatus: string;
  occupation: string;
  faculty: string;
  studyProgram: string; // khusus mahasiswa
  unit: string; // khusus dosen/staff: jabatan atau unit kerja
  education: string;
  childOrder: string; // khusus mahasiswa
  siblingsCount: string; // khusus mahasiswa
};

type RegisterErrors = Partial<Record<keyof RegisterForm, string>>;

const INITIAL_FORM: RegisterForm = {
  role: "",
  nim: "",
  email: "",
  password: "",
  confirmPassword: "",
  fullName: "",
  gender: "",
  birthDate: "",
  phone: "",
  ethnicity: "",
  religion: "",
  address: "",
  maritalStatus: "",
  occupation: "",
  faculty: "",
  studyProgram: "",
  unit: "",
  education: "",
  childOrder: "",
  siblingsCount: "",
};

const ROLE_OPTIONS: ReadonlyArray<{ value: Role; label: string }> = [
  { value: "mahasiswa", label: "Mahasiswa" },
  { value: "dosen", label: "Dosen / Staff" },
];

/* ========================= HELPER EMAIL ========================= */
// Email mahasiswa dibentuk otomatis dari NIM.
function deriveStudentEmail(nim: string): string {
  const clean = nim.trim();
  return STUDENT_NIM_RE.test(clean) ? `${clean}@${CAMPUS_DOMAIN}` : "";
}

function stepTitles(role: RegisterForm["role"]): string[] {
  return [
    "Peran",
    "Akun",
    "Data pribadi",
    role === "dosen" ? "Kepegawaian" : "Akademik & keluarga",
    "Tinjau & kirim",
  ];
}

/* ========================= VALIDASI PER STEP ========================= */
function validateRole(f: RegisterForm): RegisterErrors {
  const e: RegisterErrors = {};
  if (!f.role) e.role = "Pilih peran Anda terlebih dahulu";
  return e;
}

function validateAccount(f: RegisterForm): RegisterErrors {
  const e: RegisterErrors = {};
  const nim = f.nim.trim();

  if (f.role === "mahasiswa") {
    if (!nim) e.nim = "NIM wajib diisi";
    else if (!STUDENT_NIM_RE.test(nim))
      e.nim = "NIM harus berupa 8 digit angka";
  } else {
    if (!nim) e.nim = "NIP wajib diisi";
    else if (!STAFF_NIP_RE.test(nim))
      e.nim = "NIP harus berupa 8–18 digit angka";

    const email = f.email.trim();
    if (!email) e.email = "Email kampus wajib diisi";
    else if (!STAFF_EMAIL_RE.test(email))
      e.email = `Gunakan email resmi kampus (@${CAMPUS_DOMAIN})`;
  }

  if (f.password.length < 8) e.password = "Kata sandi minimal 8 karakter";
  if (f.confirmPassword !== f.password)
    e.confirmPassword = "Konfirmasi kata sandi tidak sama";

  return e;
}

function validatePersonal(f: RegisterForm): RegisterErrors {
  const e: RegisterErrors = {};

  if (!f.fullName.trim()) e.fullName = "Nama lengkap wajib diisi";
  if (!f.gender) e.gender = "Pilih jenis kelamin";

  if (!f.birthDate) {
    e.birthDate = "Tanggal lahir wajib diisi";
  } else {
    const parts = f.birthDate.split("-").map(Number);
    const [year, month, day] = parts;
    const birthDate = new Date(year, month - 1, day);
    const today = new Date();
    const validDate =
      parts.length === 3 &&
      /^\d{4}-\d{2}-\d{2}$/.test(f.birthDate) &&
      birthDate.getFullYear() === year &&
      birthDate.getMonth() === month - 1 &&
      birthDate.getDate() === day;

    if (!validDate || birthDate > today) {
      e.birthDate = "Masukkan tanggal lahir yang valid";
    } else {
      let age = today.getFullYear() - year;
      if (
        today.getMonth() + 1 < month ||
        (today.getMonth() + 1 === month && today.getDate() < day)
      ) {
        age--;
      }
      if (age < 15 || age > 100) {
        e.birthDate = "Usia harus antara 15–100 tahun";
      }
    }
  }

  const phone = f.phone.replace(/[\s()-]/g, "");
  if (!phone) e.phone = "Nomor telepon wajib diisi";
  else if (!/^(\+62|62|0)[0-9]{8,13}$/.test(phone))
    e.phone = "Format nomor telepon tidak valid";

  if (!f.ethnicity.trim()) e.ethnicity = "Suku bangsa wajib diisi";
  if (!f.religion) e.religion = "Pilih agama";
  if (!f.address.trim()) e.address = "Alamat wajib diisi";
  if (!f.maritalStatus) e.maritalStatus = "Pilih status perkawinan";
  if (!f.occupation.trim()) e.occupation = "Pekerjaan wajib diisi";

  return e;
}

function validateAcademic(f: RegisterForm): RegisterErrors {
  const e: RegisterErrors = {};

  if (!f.faculty)
    e.faculty =
      f.role === "dosen" ? "Pilih fakultas atau unit" : "Pilih fakultas";

  if (f.role === "mahasiswa") {
    if (!f.studyProgram) e.studyProgram = "Pilih program studi";

    const order = Number(f.childOrder);
    const total = Number(f.siblingsCount);
    if (!f.childOrder || !Number.isInteger(order) || order < 1)
      e.childOrder = "Isi nomor urut anak";
    if (!f.siblingsCount || !Number.isInteger(total) || total < 1)
      e.siblingsCount = "Isi jumlah bersaudara";
    else if (Number.isInteger(order) && order > total)
      e.childOrder = "Nomor urut tidak boleh melebihi jumlah bersaudara";
  } else {
    if (!f.unit.trim()) e.unit = "Isi jabatan atau unit kerja";
  }

  if (!f.education) e.education = "Pilih pendidikan terakhir";

  return e;
}

function validateStep(step: number, f: RegisterForm): RegisterErrors {
  switch (step) {
    case 0:
      return validateRole(f);
    case 1:
      return validateAccount(f);
    case 2:
      return validatePersonal(f);
    case 3:
      return validateAcademic(f);
    default:
      return {};
  }
}

/* ========================= KOMPONEN KECIL ========================= */
const FULL = "md:col-span-2";

function StepHeading({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="space-y-1">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-primary">
        {title}
      </h2>
      {description && <p className="text-xs text-text-muted">{description}</p>}
    </div>
  );
}

function Grid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 md:grid-cols-2">{children}</div>;
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 py-3 sm:flex-row sm:gap-4">
      <dt className="text-xs font-medium text-text-muted sm:w-48 sm:shrink-0">
        {label}
      </dt>
      <dd className="text-sm text-text-base break-words">{value || "-"}</dd>
    </div>
  );
}

function RoleSelector({
  value,
  error,
  onChange,
}: {
  value: Role | "";
  error?: string;
  onChange: (v: Role) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {ROLE_OPTIONS.map((opt) => {
        const checked = value === opt.value;
        return (
          <label
            key={opt.value}
            className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 text-sm font-medium transition ${
              checked
                ? "border-primary bg-primary/5 text-primary"
                : "border-gray-300 text-text-base hover:bg-gray-50"
            } ${error ? "border-red-400" : ""}`}
          >
            <input
              type="radio"
              name="role"
              value={opt.value}
              checked={checked}
              onChange={() => onChange(opt.value)}
              aria-invalid={!!error}
              className="h-4 w-4 accent-primary"
            />
            {opt.label}
          </label>
        );
      })}
    </div>
  );
}

/* ========================= HALAMAN ========================= */
export default function Register() {
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<RegisterForm>(INITIAL_FORM);
  const [errors, setErrors] = useState<RegisterErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const isStudent = form.role === "mahasiswa";
  const isStaff = form.role === "dosen";
  const titles = stepTitles(form.role);
  const programs = form.faculty ? (FACULTY_PROGRAMS[form.faculty] ?? []) : [];
  const errorCount = Object.keys(errors).length;
  const isLastStep = step === STEP_COUNT - 1;

  /* ---------- state helpers ---------- */
  function clearError(...keys: (keyof RegisterForm)[]) {
    setErrors((prev) => {
      if (!keys.some((k) => prev[k])) return prev;
      const next = { ...prev };
      keys.forEach((k) => delete next[k]);
      return next;
    });
  }

  function setField(key: keyof RegisterForm, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    clearError(key);
  }

  function setRole(role: Role) {
    // Ganti peran: reset field yang berbeda antar peran.
    setForm((prev) => ({
      ...prev,
      role,
      nim: "",
      email: "",
      studyProgram: "",
      unit: "",
      childOrder: "",
      siblingsCount: "",
    }));
    setErrors({});
  }

  function setNim(value: string) {
    setForm((prev) => ({
      ...prev,
      nim: value,
      email: prev.role === "mahasiswa" ? deriveStudentEmail(value) : prev.email,
    }));
    clearError("nim", "email");
  }

  function setFaculty(value: string) {
    // Program studi bergantung pada fakultas, jadi direset saat fakultas berubah.
    setForm((prev) => ({ ...prev, faculty: value, studyProgram: "" }));
    clearError("faculty", "studyProgram");
  }

  function focusFirstError() {
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    });
  }

  /* ---------- navigasi step ---------- */
  function handleNext() {
    const found = validateStep(step, form);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      focusFirstError();
      return;
    }
    setStep((s) => s + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleBack() {
    setErrors({});
    setSubmitError("");
    setStep((s) => Math.max(0, s - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitError("");

    // Enter di step sebelum terakhir cukup berfungsi sebagai "Lanjut".
    if (!isLastStep) {
      handleNext();
      return;
    }

    // Validasi ulang semua step, lalu arahkan ke step pertama yang bermasalah.
    for (let i = 0; i < STEP_COUNT - 1; i++) {
      const found = validateStep(i, form);
      if (Object.keys(found).length > 0) {
        setStep(i);
        setErrors(found);
        focusFirstError();
        return;
      }
    }

    setSubmitting(true);
    try {
      // TODO: kirim data registrasi ke API backend.
      await new Promise((resolve) => setTimeout(resolve, 800));
      navigate("/login");
    } catch {
      setSubmitError("Pendaftaran gagal. Silakan coba lagi.");
    } finally {
      setSubmitting(false);
    }
  }

  /* ========================= RENDER STEP ========================= */
  function renderStep() {
    switch (step) {
      /* ---------- 1. Peran ---------- */
      case 0:
        return (
          <div className="space-y-4">
            <StepHeading
              title="Pilih peran Anda"
              description="Peran ini menentukan data yang perlu Anda isi selanjutnya."
            />
            <Field
              label="Saya adalah"
              htmlFor="role"
              error={errors.role}
              required
            >
              <RoleSelector
                value={form.role}
                error={errors.role}
                onChange={setRole}
              />
            </Field>
          </div>
        );

      /* ---------- 2. Akun ---------- */
      case 1:
        return (
          <div className="space-y-4">
            <StepHeading title="Akun" />
            <Grid>
              <Field
                label={isStudent ? "NIM" : "NIP"}
                htmlFor="nim"
                error={errors.nim}
                required
                className={FULL}
                hint={
                  isStudent
                    ? "Email kampus akan dibuat otomatis dari NIM"
                    : undefined
                }
              >
                <TextInput
                  id="nim"
                  name="nim"
                  inputMode="numeric"
                  autoComplete="username"
                  placeholder={isStudent ? "Contoh: 24013037" : "Masukkan NIP"}
                  value={form.nim}
                  error={errors.nim}
                  onChange={(e) => setNim(e.target.value)}
                />
              </Field>

              <Field
                label="Email kampus"
                htmlFor="email"
                error={errors.email}
                required
                className={FULL}
                hint={
                  isStudent
                    ? form.email
                      ? "Dibuat otomatis dari NIM Anda"
                      : "Isi NIM terlebih dahulu"
                    : `Gunakan email resmi kampus (@${CAMPUS_DOMAIN})`
                }
              >
                <TextInput
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  placeholder={
                    isStudent ? "Otomatis dari NIM" : `nama@${CAMPUS_DOMAIN}`
                  }
                  value={form.email}
                  error={errors.email}
                  readOnly={isStudent}
                  onChange={(e) => setField("email", e.target.value)}
                />
              </Field>

              <Field
                label="Kata sandi"
                htmlFor="password"
                error={errors.password}
                required
                hint="Minimal 8 karakter"
              >
                <PasswordInput
                  id="password"
                  name="password"
                  autoComplete="new-password"
                  placeholder="Buat kata sandi"
                  value={form.password}
                  error={errors.password}
                  onChange={(e) => setField("password", e.target.value)}
                />
              </Field>

              <Field
                label="Konfirmasi kata sandi"
                htmlFor="confirmPassword"
                error={errors.confirmPassword}
                required
              >
                <PasswordInput
                  id="confirmPassword"
                  name="confirmPassword"
                  autoComplete="new-password"
                  placeholder="Ulangi kata sandi"
                  value={form.confirmPassword}
                  error={errors.confirmPassword}
                  onChange={(e) => setField("confirmPassword", e.target.value)}
                />
              </Field>
            </Grid>
          </div>
        );

      /* ---------- 3. Data pribadi ---------- */
      case 2:
        return (
          <div className="space-y-4">
            <StepHeading title="Data pribadi" />
            <Grid>
              <Field
                label="Nama lengkap"
                htmlFor="fullName"
                error={errors.fullName}
                required
                className={FULL}
              >
                <TextInput
                  id="fullName"
                  name="fullName"
                  autoComplete="name"
                  placeholder="Nama sesuai identitas"
                  value={form.fullName}
                  error={errors.fullName}
                  onChange={(e) => setField("fullName", e.target.value)}
                />
              </Field>

              <Field
                label="Jenis kelamin"
                htmlFor="gender"
                error={errors.gender}
                required
                className={FULL}
              >
                <RadioGroup
                  name="gender"
                  options={GENDERS}
                  value={form.gender}
                  error={errors.gender}
                  onChange={(v) => setField("gender", v)}
                />
              </Field>

              <Field
                label="Tanggal lahir"
                htmlFor="birthDate"
                error={errors.birthDate}
                required
              >
                <TextInput
                  id="birthDate"
                  name="birthDate"
                  type="date"
                  autoComplete="bday"
                  value={form.birthDate}
                  error={errors.birthDate}
                  onChange={(e) => setField("birthDate", e.target.value)}
                />
              </Field>

              <Field
                label="Nomor telepon"
                htmlFor="phone"
                error={errors.phone}
                required
              >
                <TextInput
                  id="phone"
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="Contoh: 081234567890"
                  value={form.phone}
                  error={errors.phone}
                  onChange={(e) => setField("phone", e.target.value)}
                />
              </Field>

              <Field
                label="Suku bangsa"
                htmlFor="ethnicity"
                error={errors.ethnicity}
                required
              >
                <TextInput
                  id="ethnicity"
                  name="ethnicity"
                  placeholder="Contoh: Minahasa"
                  value={form.ethnicity}
                  error={errors.ethnicity}
                  onChange={(e) => setField("ethnicity", e.target.value)}
                />
              </Field>

              <Field
                label="Agama"
                htmlFor="religion"
                error={errors.religion}
                required
              >
                <SelectInput
                  id="religion"
                  name="religion"
                  placeholder="Pilih agama"
                  options={RELIGIONS}
                  value={form.religion}
                  error={errors.religion}
                  onChange={(e) => setField("religion", e.target.value)}
                />
              </Field>

              <Field
                label="Alamat tempat tinggal"
                htmlFor="address"
                error={errors.address}
                required
                className={FULL}
              >
                <TextArea
                  id="address"
                  name="address"
                  autoComplete="street-address"
                  placeholder="Alamat lengkap tempat tinggal saat ini"
                  value={form.address}
                  error={errors.address}
                  onChange={(e) => setField("address", e.target.value)}
                />
              </Field>

              <Field
                label="Status perkawinan"
                htmlFor="maritalStatus"
                error={errors.maritalStatus}
                required
              >
                <SelectInput
                  id="maritalStatus"
                  name="maritalStatus"
                  placeholder="Pilih status perkawinan"
                  options={MARITAL_STATUSES}
                  value={form.maritalStatus}
                  error={errors.maritalStatus}
                  onChange={(e) => setField("maritalStatus", e.target.value)}
                />
              </Field>

              <Field
                label="Pekerjaan"
                htmlFor="occupation"
                error={errors.occupation}
                required
              >
                <TextInput
                  id="occupation"
                  name="occupation"
                  placeholder={
                    isStudent ? "Contoh: Mahasiswa" : "Contoh: Dosen"
                  }
                  value={form.occupation}
                  error={errors.occupation}
                  onChange={(e) => setField("occupation", e.target.value)}
                />
              </Field>
            </Grid>
          </div>
        );

      /* ---------- 4. Akademik / Kepegawaian ---------- */
      case 3:
        return (
          <div className="space-y-4">
            <StepHeading
              title={isStaff ? "Kepegawaian" : "Akademik & keluarga"}
            />
            <Grid>
              <Field
                label="Fakultas"
                htmlFor="faculty"
                error={errors.faculty}
                required
                className={isStaff ? FULL : undefined}
              >
                <SelectInput
                  id="faculty"
                  name="faculty"
                  placeholder="Pilih fakultas"
                  options={FACULTIES}
                  value={form.faculty}
                  error={errors.faculty}
                  onChange={(e) => setFaculty(e.target.value)}
                />
              </Field>

              {isStudent && (
                <Field
                  label="Program studi"
                  htmlFor="studyProgram"
                  error={errors.studyProgram}
                  required
                  hint={
                    form.faculty ? undefined : "Pilih fakultas terlebih dahulu"
                  }
                >
                  <SelectInput
                    id="studyProgram"
                    name="studyProgram"
                    placeholder={
                      form.faculty
                        ? "Pilih program studi"
                        : "Pilih fakultas dahulu"
                    }
                    options={programs}
                    disabled={!form.faculty}
                    value={form.studyProgram}
                    error={errors.studyProgram}
                    onChange={(e) => setField("studyProgram", e.target.value)}
                  />
                </Field>
              )}

              {isStaff && (
                <Field
                  label="Jabatan / unit kerja"
                  htmlFor="unit"
                  error={errors.unit}
                  required
                >
                  <TextInput
                    id="unit"
                    name="unit"
                    placeholder="Contoh: Dosen Teknik Informatika"
                    value={form.unit}
                    error={errors.unit}
                    onChange={(e) => setField("unit", e.target.value)}
                  />
                </Field>
              )}

              <Field
                label="Pendidikan terakhir"
                htmlFor="education"
                error={errors.education}
                required
                className={isStudent ? FULL : undefined}
              >
                <SelectInput
                  id="education"
                  name="education"
                  placeholder="Pilih pendidikan terakhir"
                  options={EDUCATION_LEVELS}
                  value={form.education}
                  error={errors.education}
                  onChange={(e) => setField("education", e.target.value)}
                />
              </Field>

              {isStudent && (
                <div className={`${FULL} space-y-2`}>
                  <p className="text-sm font-medium text-text-base">
                    Anda merupakan anak keberapa dalam keluarga Anda?{" "}
                    <span className="text-red-500">*</span>
                  </p>
                  <p className="text-xs text-text-muted">
                    Contoh: Anak ke-1, dari 2 bersaudara
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      label="Anak ke-"
                      htmlFor="childOrder"
                      error={errors.childOrder}
                    >
                      <TextInput
                        id="childOrder"
                        name="childOrder"
                        type="number"
                        inputMode="numeric"
                        min={1}
                        placeholder="Contoh: 1"
                        value={form.childOrder}
                        error={errors.childOrder}
                        onChange={(e) => setField("childOrder", e.target.value)}
                      />
                    </Field>
                    <Field
                      label="Dari (jumlah) bersaudara"
                      htmlFor="siblingsCount"
                      error={errors.siblingsCount}
                    >
                      <TextInput
                        id="siblingsCount"
                        name="siblingsCount"
                        type="number"
                        inputMode="numeric"
                        min={1}
                        placeholder="Contoh: 2"
                        value={form.siblingsCount}
                        error={errors.siblingsCount}
                        onChange={(e) =>
                          setField("siblingsCount", e.target.value)
                        }
                      />
                    </Field>
                  </div>
                </div>
              )}
            </Grid>
          </div>
        );

      /* ---------- 5. Tinjau & kirim ---------- */
      case 4:
        return (
          <div className="space-y-4">
            <StepHeading
              title="Tinjau data Anda"
              description="Pastikan data di bawah ini sudah benar sebelum mendaftar."
            />
            <dl className="divide-y divide-gray-200 rounded-xl border border-gray-200 px-4">
              <ReviewRow
                label="Peran"
                value={isStudent ? "Mahasiswa" : "Dosen / Staff"}
              />
              <ReviewRow label={isStudent ? "NIM" : "NIP"} value={form.nim} />
              <ReviewRow label="Email kampus" value={form.email} />
              <ReviewRow label="Nama lengkap" value={form.fullName} />
              <ReviewRow label="Jenis kelamin" value={form.gender} />
              <ReviewRow label="Tanggal lahir" value={form.birthDate} />
              <ReviewRow label="Nomor telepon" value={form.phone} />
              <ReviewRow label="Suku bangsa" value={form.ethnicity} />
              <ReviewRow label="Agama" value={form.religion} />
              <ReviewRow label="Alamat" value={form.address} />
              <ReviewRow label="Status perkawinan" value={form.maritalStatus} />
              <ReviewRow label="Pekerjaan" value={form.occupation} />
              <ReviewRow label="Fakultas" value={form.faculty} />
              {isStudent ? (
                <>
                  <ReviewRow label="Program studi" value={form.studyProgram} />
                  <ReviewRow
                    label="Urutan anak"
                    value={`Anak ke-${form.childOrder} dari ${form.siblingsCount} bersaudara`}
                  />
                </>
              ) : (
                <ReviewRow label="Jabatan / unit kerja" value={form.unit} />
              )}
              <ReviewRow label="Pendidikan terakhir" value={form.education} />
            </dl>
          </div>
        );

      default:
        return null;
    }
  }

  return (
    <AuthLayout
      wide
      title="Buat akun baru"
      subtitle="Lengkapi data berikut untuk mendaftar ke SiCARE."
      footer={
        <>
          Sudah punya akun?{" "}
          <Link
            to="/login"
            className="font-semibold text-primary hover:underline"
          >
            Masuk
          </Link>
        </>
      }
    >
      <form noValidate onSubmit={handleSubmit} className="space-y-8">
        {/* Indikator langkah */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-text-muted">
            <span>
              Langkah {step + 1} dari {STEP_COUNT}
            </span>
            <span>{titles[step]}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${((step + 1) / STEP_COUNT) * 100}%` }}
            />
          </div>
        </div>

        {submitError && (
          <div
            role="alert"
            className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {submitError}
          </div>
        )}

        {errorCount > 0 && (
          <div
            role="alert"
            className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            Ada {errorCount} isian yang perlu diperbaiki sebelum melanjutkan.
          </div>
        )}

        {renderStep()}

        {/* Tombol navigasi */}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          {step > 0 ? (
            <button
              type="button"
              onClick={handleBack}
              disabled={submitting}
              className="flex items-center justify-center gap-2 rounded-button border border-gray-300 px-6 py-3 text-sm font-semibold text-text-base transition hover:bg-gray-50 disabled:opacity-70"
            >
              <ArrowLeft className="h-4 w-4" />
              Kembali
            </button>
          ) : (
            <span />
          )}

          {isLastStep ? (
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center justify-center gap-2 rounded-button bg-primary px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Memproses...
                </>
              ) : (
                "Daftar"
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleNext}
              className="flex items-center justify-center gap-2 rounded-button bg-primary px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-primary-dark"
            >
              Lanjut
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </form>
    </AuthLayout>
  );
}
