import { PageHeader } from "../../components/shared";
import SignOutPanel from "../../features/auth/SignOutPanel";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AlertCircle,
  CheckCircle2,
  IdCard,
  LockKeyhole,
  Mail,
  Phone,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import {
  normalizePhoneToE164,
  validateClientBackendProfile,
  type ClientBackendProfileDraft,
  type ClientBackendProfileErrors,
} from "../../features/client/profile/profileValidation";
import { sicareApi } from "../../lib/sicareApi";
import { ApiError } from "../../lib/api";
import { useAuth } from "../../features/auth/useAuth";
import type { AuthProfile } from "../../types/auth";
import type { ProfileDto } from "../../types/api";

const PASSWORD_MIN = 8;

const EMPTY_DRAFT: ClientBackendProfileDraft = {
  fullName: "",
  phone: "",
  whatsappOptIn: false,
};

function toDraft(profile: ProfileDto | AuthProfile): ClientBackendProfileDraft {
  return {
    fullName: profile.full_name ?? "",
    phone: profile.phone_e164 ?? "",
    whatsappOptIn: Boolean(profile.whatsapp_opt_in),
  };
}

function formatMemberCategory(
  category: ProfileDto["member_category"] | undefined,
): string {
  if (category === "student") return "Mahasiswa";
  if (category === "faculty_staff") return "Dosen / Staf";
  if (category === "other") return "Umum";
  return "Belum ditentukan";
}

function formatAccountStatus(
  status: ProfileDto["account_status"] | undefined,
): string {
  if (status === "active") return "Aktif";
  if (status === "pending") return "Menunggu Aktivasi";
  if (status === "disabled") return "Nonaktif";
  return "Belum diketahui";
}

export default function KlienPengaturanPage() {
  const { user, profile: authProfile, refreshProfile } = useAuth();
  const [serverProfile, setServerProfile] = useState<ProfileDto | null>(null);
  const [saved, setSaved] = useState<ClientBackendProfileDraft>(() =>
    authProfile ? toDraft(authProfile) : EMPTY_DRAFT,
  );
  const [draft, setDraft] = useState<ClientBackendProfileDraft>(() =>
    authProfile ? toDraft(authProfile) : EMPTY_DRAFT,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const [toast, setToast] = useState("");
  const [pwdCurrent, setPwdCurrent] = useState("");
  const [pwdNext, setPwdNext] = useState("");
  const [pwdConfirm, setPwdConfirm] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchProfile = useCallback(async () => {
    return sicareApi.getProfile();
  }, []);

  const applyProfile = useCallback((fresh: ProfileDto) => {
    const nextDraft = toDraft(fresh);
    setServerProfile(fresh);
    setSaved(nextDraft);
    setDraft(nextDraft);
    setShowErrors(false);
    setLoadError("");
  }, []);

  const reportLoadError = useCallback((cause: unknown) => {
    setLoadError(
      cause instanceof ApiError || cause instanceof Error
        ? cause.message
        : "Profil pengguna tidak dapat dimuat dari backend.",
    );
  }, []);

  useEffect(() => {
    let active = true;
    void fetchProfile()
      .then((fresh) => {
        if (active) applyProfile(fresh);
      })
      .catch((cause: unknown) => {
        if (active) reportLoadError(cause);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fetchProfile, applyProfile, reportLoadError]);

  const reloadProfile = () => {
    setLoading(true);
    setLoadError("");
    void fetchProfile()
      .then(applyProfile)
      .catch(reportLoadError)
      .finally(() => setLoading(false));
  };

  const dirty =
    draft.fullName.trim() !== saved.fullName.trim() ||
    normalizePhoneToE164(draft.phone) !== normalizePhoneToE164(saved.phone) ||
    draft.whatsappOptIn !== saved.whatsappOptIn;

  const errors = useMemo<ClientBackendProfileErrors>(
    () => validateClientBackendProfile(draft),
    [draft],
  );

  useEffect(() => {
    if (!toast) return;
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3000);
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [toast]);

  function update<K extends keyof ClientBackendProfileDraft>(
    key: K,
    value: ClientBackendProfileDraft[K],
  ) {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setSaveError("");
  }

  async function saveChanges() {
    if (saving) return;
    if (Object.keys(errors).length) {
      setShowErrors(true);
      setToast("Periksa kembali isian yang ditandai.");
      return;
    }

    const nextFullName = draft.fullName.trim();
    const nextPhoneE164 = normalizePhoneToE164(draft.phone);
    const savedPhoneE164 = normalizePhoneToE164(saved.phone);
    const profileChanged =
      nextFullName !== saved.fullName.trim() ||
      nextPhoneE164 !== savedPhoneE164;
    const consentChanged = draft.whatsappOptIn !== saved.whatsappOptIn;

    if (!profileChanged && !consentChanged) {
      return;
    }

    setSaving(true);
    setSaveError("");

    let currentSaved = { ...saved };

    try {
      if (profileChanged) {
        const updatedProfile = await sicareApi.updateProfile({
          full_name: nextFullName,
          phone_e164: nextPhoneE164,
        });
        setServerProfile(updatedProfile);
        currentSaved = {
          ...currentSaved,
          fullName: updatedProfile.full_name,
          phone: updatedProfile.phone_e164 ?? "",
        };
        setSaved(currentSaved);
      }

      if (consentChanged) {
        const consentResult = await sicareApi.setWhatsAppConsent({
          opted_in: draft.whatsappOptIn,
        });
        setServerProfile((prev) =>
          prev
            ? {
                ...prev,
                whatsapp_opt_in: consentResult.whatsapp_opt_in,
                updated_at: consentResult.updated_at,
              }
            : prev,
        );
        currentSaved = {
          ...currentSaved,
          whatsappOptIn: consentResult.whatsapp_opt_in,
        };
        setSaved(currentSaved);
      }

      setDraft(currentSaved);
      setShowErrors(false);
      await refreshProfile().catch(() => null);
      setToast("Perubahan profil berhasil disimpan ke server.");
    } catch (cause) {
      const message =
        cause instanceof ApiError || cause instanceof Error
          ? cause.message
          : "Perubahan profil tidak dapat disimpan.";
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  }

  function discardChanges() {
    setDraft({ ...saved });
    setShowErrors(false);
    setSaveError("");
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
    setPwdCurrent("");
    setPwdNext("");
    setPwdConfirm("");
    setToast(
      "Perubahan kata sandi mandiri belum tersedia pada endpoint backend saat ini. Hubungi admin bila perlu reset kata sandi.",
    );
  }

  const activeProfile = serverProfile ?? authProfile;
  const displayName =
    activeProfile?.full_name?.trim() || draft.fullName.trim() || "Pengguna SiCARE";
  const initials =
    displayName
      .split(/\s+/)
      .filter((w) => /[A-Za-z]/.test(w[0] ?? ""))
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "K";
  const emailDisplay = user?.email ?? "Email akun tidak tersedia";
  const identityCodeDisplay =
    activeProfile?.identity_code?.trim() || "Belum diatur oleh admin";
  const categoryDisplay = formatMemberCategory(activeProfile?.member_category);
  const statusDisplay = formatAccountStatus(activeProfile?.account_status);
  const isActive = (activeProfile?.account_status ?? "active") === "active";

  return (
    <div className="pb-28 text-gray-800">
      <PageHeader
        title="Pengaturan"
        description="Kelola data pribadi, notifikasi WhatsApp, dan keamanan akunmu."
        actions={
          <button
            type="button"
            onClick={reloadProfile}
            disabled={loading || saving}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className="h-4 w-4" /> Muat ulang
          </button>
        }
      />

      {loadError && (
        <div
          role="alert"
          className="mt-4 flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
            <span>{loadError}</span>
          </div>
          <button
            type="button"
            onClick={reloadProfile}
            className="inline-flex shrink-0 items-center justify-center rounded-xl border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
          >
            Coba lagi
          </button>
        </div>
      )}

      {saveError && (
        <div
          role="alert"
          className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {saveError}
        </div>
      )}

      {loading && !serverProfile && (
        <p
          role="status"
          className="mt-4 rounded-2xl border border-gray-200 bg-white p-5 text-sm text-gray-500"
        >
          Memuat profil akun dari server...
        </p>
      )}

      {/* Ringkasan akun (read-only) */}
      <section className="mt-6 flex flex-col gap-5 rounded-2xl border border-gray-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
            {initials}
          </span>
          <div className="min-w-0">
            <p className="font-semibold">{displayName}</p>
            <p className="text-xs text-gray-500">
              {categoryDisplay} · ID/NIM {identityCodeDisplay} · {emailDisplay}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <LockKeyhole className="h-4 w-4" />
          Status akun dikelola admin
          <span
            className={`ml-1 rounded-full px-2.5 py-1 font-semibold ${
              isActive
                ? "bg-primary-soft text-primary"
                : "bg-red-50 text-red-700"
            }`}
          >
            {statusDisplay}
          </span>
        </div>
      </section>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:gap-6">
        {/* Data pribadi dan akademik (read-only dari backend) */}
        <Panel
          icon={<IdCard className="h-5 w-5" />}
          title="Data Pribadi & Akademik"
          description="Data identitas akun yang tersimpan di server SiCARE. Hubungi admin jika NIM/NIP atau kategori anggota perlu diperbarui."
        >
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ReadonlyField label="Nama lengkap" value={displayName} />
            <ReadonlyField
              label="NIM / Kode identitas"
              value={identityCodeDisplay}
            />
            <ReadonlyField label="Kategori anggota" value={categoryDisplay} />
            <ReadonlyField label="Status akun" value={statusDisplay} />
            <ReadonlyField
              label="Persetujuan WhatsApp"
              value={
                saved.whatsappOptIn
                  ? "Aktif (Disetujui)"
                  : "Tidak aktif"
              }
            />
            <ReadonlyField
              label="Nomor telepon tersimpan"
              value={saved.phone || "Belum diisi"}
            />
            <ReadonlyField label="Email akun" value={emailDisplay} wide />
          </dl>
          <p className="mt-4 rounded-xl bg-gray-50 px-3.5 py-2.5 text-xs leading-relaxed text-gray-500">
            Data demografis tambahan (fakultas, program studi, alamat, dan
            pendidikan) dikelola terpisah oleh administrasi kampus dan belum
            disimpan pada endpoint profil akun ini.
          </p>
        </Panel>

        {/* Kontak & data yang bisa diubah melalui PATCH /api/v1/profile & whatsapp-consent */}
        <Panel
          icon={<Phone className="h-5 w-5" />}
          title="Kontak & Data Diri"
          description="Perubahan nama lengkap, nomor telepon, dan persetujuan WhatsApp disimpan langsung ke database SiCARE."
        >
          <div className="flex flex-col gap-5">
            <Field
              label="Nama lengkap"
              required
              error={showErrors ? errors.fullName : ""}
            >
              <input
                className={inputClass}
                type="text"
                maxLength={160}
                disabled={loading || saving}
                value={draft.fullName}
                onChange={(e) => update("fullName", e.target.value)}
                placeholder="Masukkan nama lengkap"
              />
            </Field>

            <Field
              label="Nomor telepon (WhatsApp)"
              required={draft.whatsappOptIn}
              error={showErrors ? errors.phone : ""}
            >
              <input
                className={inputClass}
                type="tel"
                inputMode="tel"
                disabled={loading || saving}
                value={draft.phone}
                onChange={(e) => update("phone", e.target.value)}
                placeholder="Contoh: 081234567890 atau +6281234567890"
              />
              <p className="mt-1 text-xs text-gray-500">
                Disimpan dalam format internasional E.164 (contoh:{" "}
                {normalizePhoneToE164(draft.phone) || "+62812..."}).
              </p>
            </Field>

            <div className="rounded-xl border border-gray-200 p-4">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={draft.whatsappOptIn}
                  disabled={loading || saving}
                  onChange={(e) => update("whatsappOptIn", e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span className="text-sm">
                  <span className="block font-semibold text-gray-900">
                    Setujui notifikasi melalui WhatsApp
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-gray-500">
                    Menyimpan persetujuan opt-in WhatsApp pada profil Anda.
                    Pengiriman pesan keluar bergantung pada layanan worker
                    notifikasi server.
                  </span>
                </span>
              </label>
            </div>

            <div className="flex items-center gap-2 rounded-xl bg-gray-50 px-4 py-3 text-xs text-gray-500">
              <Mail className="h-4 w-4 shrink-0" />
              Email akun ({emailDisplay}) dikelola oleh sistem autentikasi dan
              admin.
            </div>
          </div>
        </Panel>

        {/* Keamanan */}
        <Panel
          className="lg:col-span-2"
          icon={<ShieldCheck className="h-5 w-5" />}
          title="Keamanan"
          description="Pengaturan kata sandi akun SiCARE."
        >
          <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">
            Catatan: Endpoint perubahan kata sandi mandiri belum diaktifkan pada
            API profil saat ini. Formulir di bawah ini tidak mengubah kata sandi
            di server; hubungi admin bila memerlukan reset kata sandi.
          </p>
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
              Ada perubahan profil yang belum disimpan.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={discardChanges}
                className="inline-flex flex-1 items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 sm:flex-none"
              >
                Batalkan
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveChanges()}
                className="inline-flex flex-1 items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:opacity-50 sm:flex-none"
              >
                {saving ? "Menyimpan..." : "Simpan perubahan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          role="status"
          className="pointer-events-none fixed left-1/2 top-20 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-lg"
        >
          <CheckCircle2 className="h-4 w-4" />
          {toast}
        </div>
      )}
      <SignOutPanel />
    </div>
  );
}

/* ========================= KOMPONEN PENDUKUNG ========================= */

const inputClass =
  "w-full min-w-0 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-800 outline-none placeholder:text-gray-500 focus:border-primary focus:ring-4 focus:ring-primary/15 disabled:cursor-not-allowed disabled:bg-gray-100";

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
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
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
