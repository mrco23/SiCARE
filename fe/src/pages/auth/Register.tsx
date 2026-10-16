import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

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
import type { RegisterErrors, RegisterForm } from "../../types/auth";

const INITIAL_FORM: RegisterForm = {
  nim: "",
  password: "",
  confirmPassword: "",
  fullName: "",
  gender: "",
  age: "",
  phone: "",
  ethnicity: "",
  religion: "",
  address: "",
  maritalStatus: "",
  occupation: "",
  faculty: "",
  studyProgram: "",
  education: "",
  childOrder: "",
  siblingsCount: "",
};

function validateRegister(f: RegisterForm): RegisterErrors {
  const e: RegisterErrors = {};

  // Akun
  if (!f.nim.trim()) e.nim = "NIM/NIP wajib diisi";
  if (f.password.length < 8) e.password = "Kata sandi minimal 8 karakter";
  if (f.confirmPassword !== f.password)
    e.confirmPassword = "Konfirmasi kata sandi tidak sama";

  // Data pribadi
  if (!f.fullName.trim()) e.fullName = "Nama lengkap wajib diisi";
  if (!f.gender) e.gender = "Pilih jenis kelamin";

  const age = Number(f.age);
  if (!f.age) e.age = "Usia wajib diisi";
  else if (!Number.isInteger(age) || age < 15 || age > 100)
    e.age = "Masukkan usia yang valid (15–100 tahun)";

  const phone = f.phone.replace(/[\s()-]/g, "");
  if (!phone) e.phone = "Nomor telepon wajib diisi";
  else if (!/^(\+62|62|0)[0-9]{8,13}$/.test(phone))
    e.phone = "Format nomor telepon tidak valid";

  if (!f.ethnicity.trim()) e.ethnicity = "Suku bangsa wajib diisi";
  if (!f.religion) e.religion = "Pilih agama";
  if (!f.address.trim()) e.address = "Alamat wajib diisi";
  if (!f.maritalStatus) e.maritalStatus = "Pilih status perkawinan";
  if (!f.occupation.trim()) e.occupation = "Pekerjaan wajib diisi";

  // Akademik
  if (!f.faculty) e.faculty = "Pilih fakultas";
  if (!f.studyProgram) e.studyProgram = "Pilih program studi";
  if (!f.education) e.education = "Pilih pendidikan terakhir";

  // Keluarga
  const order = Number(f.childOrder);
  const total = Number(f.siblingsCount);
  if (!f.childOrder || !Number.isInteger(order) || order < 1)
    e.childOrder = "Isi nomor urut anak";
  if (!f.siblingsCount || !Number.isInteger(total) || total < 1)
    e.siblingsCount = "Isi jumlah bersaudara";
  else if (Number.isInteger(order) && order > total)
    e.childOrder = "Nomor urut tidak boleh melebihi jumlah bersaudara";

  return e;
}

function FormSection({
  step,
  title,
  children,
}: {
  step: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold text-primary">
          {step}
        </span>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-primary">
          {title}
        </h2>
      </div>
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </section>
  );
}

const FULL = "md:col-span-2";

export default function Register() {
  const navigate = useNavigate();

  const [form, setForm] = useState<RegisterForm>(INITIAL_FORM);
  const [errors, setErrors] = useState<RegisterErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const programs = form.faculty ? FACULTY_PROGRAMS[form.faculty] ?? [] : [];
  const errorCount = Object.keys(errors).length;

  function setField(key: keyof RegisterForm, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function setFaculty(value: string) {
    // Program studi bergantung pada fakultas, jadi direset saat fakultas berubah.
    setForm((prev) => ({ ...prev, faculty: value, studyProgram: "" }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next.faculty;
      delete next.studyProgram;
      return next;
    });
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitError("");

    const found = validateRegister(form);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      return;
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

  return (
    <AuthLayout
      wide
      title="Buat akun baru"
      subtitle="Lengkapi data berikut untuk mendaftar ke SiCARE."
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
        {submitError && (
          <div role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {submitError}
          </div>
        )}

        {errorCount > 0 && (
          <div role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            Ada {errorCount} isian yang perlu diperbaiki sebelum mendaftar.
          </div>
        )}

        {/* 1. Akun */}
        <FormSection step={1} title="Akun">
          <Field label="NIM/NIP" htmlFor="nim" error={errors.nim} required className={FULL}>
            <TextInput
              id="nim"
              name="nim"
              autoComplete="username"
              placeholder="Masukkan NIM atau NIP"
              value={form.nim}
              error={errors.nim}
              onChange={(e) => setField("nim", e.target.value)}
            />
          </Field>

          <Field label="Kata sandi" htmlFor="password" error={errors.password} required hint="Minimal 8 karakter">
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

          <Field label="Konfirmasi kata sandi" htmlFor="confirmPassword" error={errors.confirmPassword} required>
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
        </FormSection>

        {/* 2. Data pribadi */}
        <FormSection step={2} title="Data pribadi">
          <Field label="Nama lengkap" htmlFor="fullName" error={errors.fullName} required className={FULL}>
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

          <Field label="Jenis kelamin" htmlFor="gender" error={errors.gender} required className={FULL}>
            <RadioGroup
              name="gender"
              options={GENDERS}
              value={form.gender}
              error={errors.gender}
              onChange={(v) => setField("gender", v)}
            />
          </Field>

          <Field label="Usia" htmlFor="age" error={errors.age} required>
            <TextInput
              id="age"
              name="age"
              type="number"
              inputMode="numeric"
              min={15}
              max={100}
              placeholder="Contoh: 20"
              value={form.age}
              error={errors.age}
              onChange={(e) => setField("age", e.target.value)}
            />
          </Field>

          <Field label="Nomor telepon" htmlFor="phone" error={errors.phone} required>
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

          <Field label="Suku bangsa" htmlFor="ethnicity" error={errors.ethnicity} required>
            <TextInput
              id="ethnicity"
              name="ethnicity"
              placeholder="Contoh: Minahasa"
              value={form.ethnicity}
              error={errors.ethnicity}
              onChange={(e) => setField("ethnicity", e.target.value)}
            />
          </Field>

          <Field label="Agama" htmlFor="religion" error={errors.religion} required>
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

          <Field label="Alamat tempat tinggal" htmlFor="address" error={errors.address} required className={FULL}>
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

          <Field label="Status perkawinan" htmlFor="maritalStatus" error={errors.maritalStatus} required>
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

          <Field label="Pekerjaan" htmlFor="occupation" error={errors.occupation} required>
            <TextInput
              id="occupation"
              name="occupation"
              placeholder="Contoh: Mahasiswa"
              value={form.occupation}
              error={errors.occupation}
              onChange={(e) => setField("occupation", e.target.value)}
            />
          </Field>
        </FormSection>

        {/* 3. Akademik & keluarga */}
        <FormSection step={3} title="Akademik & keluarga">
          <Field label="Fakultas" htmlFor="faculty" error={errors.faculty} required>
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

          <Field
            label="Program studi"
            htmlFor="studyProgram"
            error={errors.studyProgram}
            required
            hint={form.faculty ? undefined : "Pilih fakultas terlebih dahulu"}
          >
            <SelectInput
              id="studyProgram"
              name="studyProgram"
              placeholder={form.faculty ? "Pilih program studi" : "Pilih fakultas dahulu"}
              options={programs}
              disabled={!form.faculty}
              value={form.studyProgram}
              error={errors.studyProgram}
              onChange={(e) => setField("studyProgram", e.target.value)}
            />
          </Field>

          <Field label="Pendidikan terakhir" htmlFor="education" error={errors.education} required className={FULL}>
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

          <div className={`${FULL} space-y-2`}>
            <p className="text-sm font-medium text-text-base">
              Anda merupakan anak keberapa dalam keluarga Anda? <span className="text-red-500">*</span>
            </p>
            <p className="text-xs text-text-muted">Contoh: Anak ke-1, dari 2 bersaudara</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Anak ke-" htmlFor="childOrder" error={errors.childOrder}>
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
              <Field label="Dari (jumlah) bersaudara" htmlFor="siblingsCount" error={errors.siblingsCount}>
                <TextInput
                  id="siblingsCount"
                  name="siblingsCount"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  placeholder="Contoh: 2"
                  value={form.siblingsCount}
                  error={errors.siblingsCount}
                  onChange={(e) => setField("siblingsCount", e.target.value)}
                />
              </Field>
            </div>
          </div>
        </FormSection>

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
            "Daftar"
          )}
        </button>
      </form>
    </AuthLayout>
  );
}
