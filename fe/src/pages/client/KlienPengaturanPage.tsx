import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Bell,
  CheckCircle2,
  GraduationCap,
  IdCard,
  LockKeyhole,
  Mail,
  Phone,
  ShieldCheck,
} from "lucide-react";
import { EDUCATION_LEVELS } from "../../constants/registerOptions";

/* ========================= TIPE ========================= */

type ClientProfile = {
  phone: string;
  address: string;
  occupation: string;
  education: string;
  notify: {
    bookingConfirmed: boolean;
    sessionReminder: boolean;
    scheduleChanged: boolean;
    feedbackRequest: boolean;
  };
};

type Errors = Partial<
  Record<"phone" | "address" | "occupation" | "education", string>
>;

/* ========================= KONSTANTA ========================= */

// Data dari registrasi dan dikelola admin. Klien tidak bisa mengubahnya di halaman ini.
// Di produksi, ambil dari API, misalnya GET /api/klien/me.
const ACCOUNT = {
  fullName: "Yusli Ngongano",
  nim: "2210011045",
  email: "yusli@mhs.unikadelasalle.ac.id",
  faculty: "Teknik",
  studyProgram: "Teknik Informatika",
  gender: "Laki-laki",
  age: "21",
  ethnicity: "Minahasa",
  religion: "Kristen Protestan",
  maritalStatus: "Belum menikah",
  childOrder: "2",
  siblingsCount: "3",
  active: true,
};

const INITIAL: ClientProfile = {
  phone: "081298765432",
  address: "Jl. Contoh No. 12, Manado",
  occupation: "Mahasiswa",
  education: "SMA/Sederajat",
  notify: {
    bookingConfirmed: true,
    sessionReminder: true,
    scheduleChanged: true,
    feedbackRequest: false,
  },
};

const clone = (v: ClientProfile): ClientProfile =>
  JSON.parse(JSON.stringify(v));
const MAX_ADDRESS = 200;
const MAX_OCCUPATION = 60;
const PHONE_RE = /^(\+62|62|0)[0-9]{8,13}$/;
const PASSWORD_MIN = 8;

/* ========================= HALAMAN ========================= */

export default function KlienPengaturanPage() {
  const [saved, setSaved] = useState<ClientProfile>(() => clone(INITIAL));
  const [profile, setProfile] = useState<ClientProfile>(() => clone(INITIAL));
  const [showErrors, setShowErrors] = useState(false);
  const [toast, setToast] = useState("");
  const [pwdCurrent, setPwdCurrent] = useState("");
  const [pwdNext, setPwdNext] = useState("");
  const [pwdConfirm, setPwdConfirm] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dirty = JSON.stringify(profile) !== JSON.stringify(saved);

  const errors = useMemo<Errors>(() => {
    const e: Errors = {};
    const phone = profile.phone.replace(/[\s()-]/g, "");
    if (!phone) e.phone = "Nomor telepon wajib diisi";
    else if (!PHONE_RE.test(phone))
      e.phone = "Format nomor telepon tidak valid";

    if (!profile.address.trim()) e.address = "Alamat wajib diisi";
    else if (profile.address.length > MAX_ADDRESS)
      e.address = `Maksimal ${MAX_ADDRESS} karakter`;

    if (profile.occupation.length > MAX_OCCUPATION)
      e.occupation = `Maksimal ${MAX_OCCUPATION} karakter`;

    if (!(EDUCATION_LEVELS as readonly string[]).includes(profile.education))
      e.education = "Pilih pendidikan terakhir";
    return e;
  }, [profile]);

  useEffect(() => {
    if (!toast) return;
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3000);
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [toast]);

  function update<K extends keyof ClientProfile>(
    key: K,
    value: ClientProfile[K],
  ) {
    setProfile((prev) => ({ ...prev, [key]: value }));
  }

  function updateNotify(key: keyof ClientProfile["notify"], value: boolean) {
    setProfile((prev) => ({
      ...prev,
      notify: { ...prev.notify, [key]: value },
    }));
  }

  function saveChanges() {
    if (Object.keys(errors).length) {
      setShowErrors(true);
      setToast("Periksa kembali isian yang ditandai.");
      return;
    }
    // Integrasi produksi: PUT /api/klien/me/profil
    setSaved(clone(profile));
    setShowErrors(false);
    setToast("Perubahan berhasil disimpan.");
  }

  function discardChanges() {
    setProfile(clone(saved));
    setShowErrors(false);
  }

  function changePassword() {
    const issues = [
      !pwdCurrent ? "Masukkan kata sandi saat ini." : "",
      pwdNext.length < PASSWORD_MIN
        ? `Kata sandi baru minimal ${PASSWORD_MIN} karakter.`
        : "",
      pwdConfirm !== pwdNext ? "Konfirmasi kata sandi tidak sama." : "",
    ].filter(Boolean);
    if (issues.length) {
      setToast(issues.join(" "));
      return;
    }
    // Integrasi produksi: PUT /api/klien/me/password (server memverifikasi kata sandi lama)
    setPwdCurrent("");
    setPwdNext("");
    setPwdConfirm("");
    setToast(
      "Simulasi perubahan kata sandi berhasil. Hubungkan ke backend untuk menyimpan secara nyata.",
    );
  }

  const initials = ACCOUNT.fullName
    .split(" ")
    .filter((w) => /[A-Za-z]/.test(w[0]))
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 pb-28 sm:px-6 sm:py-8 lg:px-8">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          Pengaturan
        </h1>
        <p className="mt-1 text-sm text-gray-500 sm:text-base">
          Kelola data pribadi, notifikasi, dan keamanan akunmu.
        </p>
      </header>

      {/* Ringkasan akun (read-only) */}
      <section className="mt-6 flex flex-col gap-5 rounded-2xl border border-gray-200 bg-white p-5 sm:flex-row sm:items-center sm:p-6">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#1e5b3a] text-sm font-bold text-white">
            {initials}
          </span>
          <div className="min-w-0">
            <p className="font-semibold">{ACCOUNT.fullName}</p>
            <p className="text-xs text-gray-500">
              Mahasiswa · NIM {ACCOUNT.nim} · {ACCOUNT.email}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <LockKeyhole className="h-4 w-4" />
          Data akun dikelola admin
          <span
            className={`ml-1 rounded-full px-2.5 py-1 font-semibold ${
              ACCOUNT.active
                ? "bg-[#e8f9f0] text-[#1e5b3a]"
                : "bg-red-50 text-red-700"
            }`}
          >
            {ACCOUNT.active ? "Aktif" : "Nonaktif"}
          </span>
        </div>
      </section>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:gap-6">
        {/* Data pribadi (read-only, dari registrasi) */}
        <Panel
          icon={<IdCard className="h-5 w-5" />}
          title="Data Pribadi"
          description="Data dari saat registrasi. Hubungi admin bila ada yang perlu diubah."
        >
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ReadonlyField label="Nama lengkap" value={ACCOUNT.fullName} />
            <ReadonlyField label="NIM" value={ACCOUNT.nim} />
            <ReadonlyField label="Jenis kelamin" value={ACCOUNT.gender} />
            <ReadonlyField label="Usia" value={`${ACCOUNT.age} tahun`} />
            <ReadonlyField label="Suku" value={ACCOUNT.ethnicity} />
            <ReadonlyField label="Agama" value={ACCOUNT.religion} />
            <ReadonlyField
              label="Status pernikahan"
              value={ACCOUNT.maritalStatus}
            />
            <ReadonlyField
              label="Urutan anak dalam keluarga"
              value={`Anak ke-${ACCOUNT.childOrder} dari ${ACCOUNT.siblingsCount} bersaudara`}
            />
          </dl>
        </Panel>

        {/* Akademik (read-only) */}
        <Panel
          icon={<GraduationCap className="h-5 w-5" />}
          title="Akademik"
          description="Fakultas dan program studi sesuai data kampus."
        >
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ReadonlyField label="Fakultas" value={ACCOUNT.faculty} />
            <ReadonlyField label="Program studi" value={ACCOUNT.studyProgram} />
            <ReadonlyField label="Email kampus" value={ACCOUNT.email} wide />
          </dl>
        </Panel>

        {/* Kontak & data yang bisa diubah */}
        <Panel
          icon={<Phone className="h-5 w-5" />}
          title="Kontak & Data Diri"
          description="Informasi ini dipakai untuk koordinasi sesi dengan konselor."
        >
          <div className="flex flex-col gap-5">
            <Field
              label="Nomor telepon"
              required
              error={showErrors ? errors.phone : ""}
            >
              <input
                className={inputClass}
                type="tel"
                inputMode="tel"
                value={profile.phone}
                onChange={(e) => update("phone", e.target.value)}
              />
            </Field>

            <Field
              label="Alamat"
              required
              error={showErrors ? errors.address : ""}
            >
              <textarea
                rows={3}
                className={`${inputClass} resize-none`}
                value={profile.address}
                onChange={(e) => update("address", e.target.value)}
              />
              <p className="mt-1 text-right text-xs text-gray-500">
                {profile.address.length}/{MAX_ADDRESS} karakter
              </p>
            </Field>

            <Field
              label="Pekerjaan"
              error={showErrors ? errors.occupation : ""}
            >
              <input
                className={inputClass}
                value={profile.occupation}
                onChange={(e) => update("occupation", e.target.value)}
              />
            </Field>

            <Field
              label="Pendidikan terakhir"
              required
              error={showErrors ? errors.education : ""}
            >
              <select
                className={inputClass}
                value={profile.education}
                onChange={(e) => update("education", e.target.value)}
              >
                {EDUCATION_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </Field>

            <div className="flex items-center gap-2 rounded-xl bg-gray-50 px-4 py-3 text-xs text-gray-500">
              <Mail className="h-4 w-4 shrink-0" />
              Email kampus tidak dapat diubah. Hubungi admin bila perlu
              perubahan.
            </div>
          </div>
        </Panel>

        {/* Notifikasi */}
        <Panel
          icon={<Bell className="h-5 w-5" />}
          title="Notifikasi"
          description="Pilih kejadian yang ingin kamu terima pemberitahuannya."
        >
          <div className="divide-y divide-gray-100">
            <SwitchRow
              title="Booking dikonfirmasi konselor"
              checked={profile.notify.bookingConfirmed}
              onChange={(v) => updateNotify("bookingConfirmed", v)}
            />
            <SwitchRow
              title="Pengingat sebelum sesi"
              description="Dikirim 1 jam sebelum sesi dimulai."
              checked={profile.notify.sessionReminder}
              onChange={(v) => updateNotify("sessionReminder", v)}
            />
            <SwitchRow
              title="Jadwal diubah atau dibatalkan konselor"
              checked={profile.notify.scheduleChanged}
              onChange={(v) => updateNotify("scheduleChanged", v)}
            />
            <SwitchRow
              title="Ajakan mengisi feedback"
              description="Dikirim setelah sesi selesai."
              checked={profile.notify.feedbackRequest}
              onChange={(v) => updateNotify("feedbackRequest", v)}
            />
          </div>
        </Panel>

        {/* Keamanan */}
        <Panel
          className="lg:col-span-2"
          icon={<ShieldCheck className="h-5 w-5" />}
          title="Keamanan"
          description="Ubah kata sandi akunmu."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Kata sandi saat ini" required>
                <input
                  className={inputClass}
                  type="password"
                  autoComplete="current-password"
                  value={pwdCurrent}
                  onChange={(e) => setPwdCurrent(e.target.value)}
                />
              </Field>
            </div>
            <Field label="Kata sandi baru" required>
              <input
                className={inputClass}
                type="password"
                autoComplete="new-password"
                value={pwdNext}
                onChange={(e) => setPwdNext(e.target.value)}
              />
              <p className="mt-1 text-xs text-gray-500">
                Minimal {PASSWORD_MIN} karakter
              </p>
            </Field>
            <Field label="Ulangi kata sandi baru" required>
              <input
                className={inputClass}
                type="password"
                autoComplete="new-password"
                value={pwdConfirm}
                onChange={(e) => setPwdConfirm(e.target.value)}
              />
            </Field>
          </div>
          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={changePassword}
              className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 sm:w-auto"
            >
              Ubah kata sandi
            </button>
          </div>
        </Panel>
      </div>

      {/* Bar simpan */}
      {dirty && (
        <div className="fixed inset-x-0 bottom-4 z-20 px-4 lg:left-64">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 rounded-2xl border border-gray-200 bg-white/95 p-4 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-semibold">
              Ada perubahan yang belum disimpan.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={discardChanges}
                className="inline-flex flex-1 items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 sm:flex-none"
              >
                Batalkan
              </button>
              <button
                type="button"
                onClick={saveChanges}
                className="inline-flex flex-1 items-center justify-center rounded-xl bg-[#1e5b3a] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#174a2f] sm:flex-none"
              >
                Simpan perubahan
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          role="status"
          className="pointer-events-none fixed left-1/2 top-20 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-[#1e5b3a] px-4 py-2 text-sm font-semibold text-white shadow-lg"
        >
          <CheckCircle2 className="h-4 w-4" />
          {toast}
        </div>
      )}
    </div>
  );
}

/* ========================= KOMPONEN PENDUKUNG ========================= */

const inputClass =
  "w-full min-w-0 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-800 outline-none placeholder:text-gray-500 focus:border-[#1e5b3a] focus:ring-4 focus:ring-[#1e5b3a]/15 disabled:cursor-not-allowed disabled:bg-gray-100";

function Panel({
  icon,
  title,
  description,
  className = "",
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={`rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6 ${className}`}
    >
      <div className="mb-5 flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#e8f9f0] text-[#1e5b3a]">
          {icon}
        </span>
        <div>
          <h2 className="text-base font-bold">{title}</h2>
          <p className="mt-0.5 text-xs leading-relaxed text-gray-500">
            {description}
          </p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  required = false,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function ReadonlyField({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <dt className="text-xs font-medium text-gray-500">{label}</dt>
      <dd className="mt-1 rounded-xl bg-gray-50 px-3.5 py-2.5 text-sm text-gray-800">
        {value}
      </dd>
    </div>
  );
}

function SwitchRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-3">
      <span>
        <span className="block text-sm font-semibold">{title}</span>
        {description && (
          <span className="mt-0.5 block text-xs leading-relaxed text-gray-500">
            {description}
          </span>
        )}
      </span>
      <span
        className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
          checked ? "bg-[#1e5b3a]" : "bg-gray-300"
        }`}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <span
          className={`pointer-events-none absolute left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </span>
    </label>
  );
}
