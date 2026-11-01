import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  KeyRound,
  Loader2,
  LockKeyhole,
  Mail,
  Phone,
  Save,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import SignOutPanel from "../../features/auth/SignOutPanel";
import { useAuth } from "../../features/auth/useAuth";
import { PageContainer, PageHeader, SettingsField as Field, SettingsPanel as Panel } from "../../components/shared";
import { sicareApi } from "../../lib/sicareApi";
import {
  describeApiError,
  normalizePhoneToE164,
  validatePhoneInput,
} from "../../features/headlmi/shared/presentation";

type ProfileState = {
  displayName: string;
  email: string;
  phone: string;
};

const INITIAL_PROFILE: ProfileState = {
  displayName: "Kepala LMI",
  email: "kepala.lmi@kampus.ac.id",
  phone: "",
};

export default function KepalaLMIPengaturanPage() {
  const { user, profile: authProfile, refreshProfile } = useAuth();

  const [savedProfile, setSavedProfile] = useState<ProfileState>(() => ({
    displayName: authProfile?.full_name || INITIAL_PROFILE.displayName,
    email: user?.email || INITIAL_PROFILE.email,
    phone: authProfile?.phone_e164 || INITIAL_PROFILE.phone,
  }));

  const [profile, setProfile] = useState<ProfileState>(() => ({
    displayName: authProfile?.full_name || INITIAL_PROFILE.displayName,
    email: user?.email || INITIAL_PROFILE.email,
    phone: authProfile?.phone_e164 || INITIAL_PROFILE.phone,
  }));

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  const fetchProfileData = useCallback(async () => {
    return sicareApi.getProfile();
  }, []);

  useEffect(() => {
    let active = true;
    void fetchProfileData()
      .then((data) => {
        if (!active) return;
        const loaded: ProfileState = {
          displayName: data.full_name || "Kepala LMI",
          email: user?.email || data.identity_code || "kepala.lmi@kampus.ac.id",
          phone: data.phone_e164 || "",
        };
        setSavedProfile(loaded);
        setProfile(loaded);
      })
      .catch(() => {
        if (!active) return;
        if (authProfile) {
          const fallback: ProfileState = {
            displayName: authProfile.full_name,
            email: user?.email || "",
            phone: authProfile.phone_e164 || "",
          };
          setSavedProfile(fallback);
          setProfile(fallback);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [fetchProfileData, user, authProfile]);

  const dirty =
    profile.displayName.trim() !== savedProfile.displayName.trim() ||
    profile.phone.trim() !== savedProfile.phone.trim();

  const errors = useMemo(() => {
    const result: Record<string, string> = {};

    const trimmedName = profile.displayName.trim();
    if (!trimmedName) {
      result.displayName = "Nama lengkap wajib diisi.";
    } else if (trimmedName.length < 2) {
      result.displayName = "Nama lengkap minimal 2 karakter.";
    } else if (trimmedName.length > 160) {
      result.displayName = "Nama lengkap maksimal 160 karakter.";
    }

    const phoneErr = validatePhoneInput(profile.phone);
    if (phoneErr) {
      result.phone = phoneErr;
    }

    return result;
  }, [profile]);

  function updateField<K extends keyof ProfileState>(key: K, value: ProfileState[K]) {
    setProfile((prev) => ({ ...prev, [key]: value }));
  }

  function discardChanges() {
    setProfile(savedProfile);
    setShowErrors(false);
    setSaveError(null);
  }

  async function saveChanges() {
    if (Object.keys(errors).length > 0) {
      setShowErrors(true);
      showToast("Periksa kembali isian yang ditandai.");
      return;
    }

    setSaving(true);
    setSaveError(null);

    try {
      const normalizedPhone = normalizePhoneToE164(profile.phone);
      const updated = await sicareApi.updateProfile({
        full_name: profile.displayName.trim(),
        phone_e164: normalizedPhone,
      });

      await refreshProfile().catch(() => undefined);

      if (!mounted.current) return;
      const nextState: ProfileState = {
        displayName: updated.full_name,
        email: user?.email || profile.email,
        phone: updated.phone_e164 || "",
      };
      setSavedProfile(nextState);
      setProfile(nextState);
      setShowErrors(false);
      showToast("Profil Kepala LMI berhasil disimpan ke server.");
    } catch (err) {
      if (!mounted.current) return;
      setSaveError(describeApiError(err, "Gagal menyimpan perubahan profil ke server."));
    } finally {
      if (mounted.current) setSaving(false);
    }
  }

  return (
    <PageContainer role="headlmi" spacing="none" className="space-y-6 text-slate-800">
      {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          className="fixed left-1/2 top-20 z-50 flex max-w-md -translate-x-1/2 items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-xl"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          <span>{toast}</span>
        </div>
      )}

      <PageHeader
        title="Pengaturan"
        description="Kelola foto profil, informasi akun, dan keamanan Kepala LMI."
      />

      {/* Profile Header Card */}
      <section className="flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-emerald-50 text-primary">
            <UserRound className="h-7 w-7" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-bold text-slate-900">
              {loading ? "Memuat profil…" : savedProfile.displayName || "Kepala LMI"}
            </p>
            <p className="mt-0.5 break-all text-xs text-slate-500">
              {loading ? "…" : user?.email || savedProfile.email}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
          <LockKeyhole className="h-4 w-4 shrink-0 text-slate-400" />
          <span>Peran Akun:</span>
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-primary">
            Kepala LMI
          </span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
            Aktif
          </span>
        </div>
      </section>

      {/* Main Settings Grid */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Foto Profil Panel */}
        <Panel
          compactHeader
          icon={<Camera className="h-5 w-5" />}
          title="Foto Profil"
          description="Foto identitas akun pimpinan pada antarmuka SiCARE."
        >
          <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
            <div className="flex aspect-square w-32 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 text-slate-400">
              <UserRound className="h-12 w-12 text-slate-300" />
            </div>
            <div className="flex w-full flex-col gap-2.5 sm:pt-1">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled
                  className="inline-flex cursor-not-allowed items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-400"
                >
                  <Camera className="h-3.5 w-3.5" />
                  Unggah Foto
                </button>
                <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-semibold text-amber-700">
                  Fitur Belum Tersedia
                </span>
              </div>
              <p className="text-xs leading-relaxed text-slate-500">
                Layanan penyimpanan foto profil Kepala LMI belum didukung oleh backend API saat ini. Akun menggunakan avatar sistem default.
              </p>
            </div>
          </div>
        </Panel>

        {/* Informasi Akun Panel */}
        <Panel
          compactHeader
          icon={<UserRound className="h-5 w-5" />}
          title="Informasi Akun"
          description="Perbarui nama tampilan dan nomor kontak akun Kepala LMI."
        >
          <div className="space-y-4">
            {saveError && (
              <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {saveError}
              </div>
            )}

            <Field
              label="Nama Lengkap"
              required
              error={showErrors ? errors.displayName : ""}
            >
              <input
                autoComplete="name"
                disabled={loading || saving}
                value={profile.displayName}
                onChange={(e) => updateField("displayName", e.target.value)}
                placeholder="Masukkan nama lengkap pimpinan"
                className={inputClass}
              />
            </Field>

            <Field
              label="Alamat Email"
              required
              error=""
            >
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  disabled
                  value={user?.email || profile.email}
                  className={`${inputClass} cursor-not-allowed bg-slate-50 pl-10 text-slate-500`}
                />
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                Email terikat pada akun autentikasi Supabase dan tidak dapat diubah langsung.
              </p>
            </Field>

            <Field
              label="Nomor Telepon Kontak"
              error={showErrors ? errors.phone : ""}
            >
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="tel"
                  inputMode="tel"
                  disabled={loading || saving}
                  value={profile.phone}
                  onChange={(e) => updateField("phone", e.target.value)}
                  placeholder="Contoh: 081234567890 atau +6281234567890"
                  className={`${inputClass} pl-10`}
                />
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                Gunakan nomor seluler aktif (format 08... atau +628...).
              </p>
            </Field>
          </div>
        </Panel>

        {/* Keamanan Akun Panel */}
        <Panel
          compactHeader
          className="lg:col-span-2"
          icon={<KeyRound className="h-5 w-5" />}
          title="Keamanan & Kata Sandi"
          description="Pengelolaan keamanan kredensial akun Kepala LMI."
        >
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label="Kata Sandi Saat Ini">
                  <input
                    type="password"
                    disabled
                    placeholder="••••••••••••"
                    className={`${inputClass} cursor-not-allowed bg-slate-50 text-slate-400`}
                  />
                </Field>
              </div>

              <Field label="Kata Sandi Baru">
                <input
                  type="password"
                  disabled
                  placeholder="••••••••••••"
                  className={`${inputClass} cursor-not-allowed bg-slate-50 text-slate-400`}
                />
              </Field>

              <Field label="Ulangi Kata Sandi Baru">
                <input
                  type="password"
                  disabled
                  placeholder="••••••••••••"
                  className={`${inputClass} cursor-not-allowed bg-slate-50 text-slate-400`}
                />
              </Field>
            </div>

            <div className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-800 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <span>
                  <strong>Fitur Belum Tersedia:</strong> Endpoint pembaruan kata sandi mandiri belum didukung backend. Untuk kebutuhan reset kata sandi, silakan hubungi Administrator sistem.
                </span>
              </div>
              <button
                type="button"
                disabled
                className="cursor-not-allowed self-start whitespace-nowrap rounded-lg bg-amber-200/60 px-3 py-1.5 font-semibold text-amber-900 opacity-60 sm:self-auto"
              >
                Ubah Kata Sandi
              </button>
            </div>
          </div>
        </Panel>

        {/* Batas Akses Panel */}
        <Panel
          compactHeader
          className="lg:col-span-2"
          icon={<ShieldCheck className="h-5 w-5" />}
          title="Batas Kewenangan Akses"
          description="Ringkasan batas otorisasi pada panel Kepala LMI."
        >
          <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <p className="text-xs leading-relaxed text-slate-700">
              Akun Kepala LMI difungsikan untuk memantau ringkasan layanan konseling, laporan kinerja organisasi, dan peninjauan mutu feedback pengguna.
              Sesuai SOP, akun ini tidak memiliki hak kelola jadwal konselor, penugasan sesi, atau akses ke data konseling pribadi mahasiswa.
            </p>
          </div>
        </Panel>
      </div>

      {/* Sticky Bar for Unsaved Changes */}
      {dirty && (
        <div className="fixed inset-x-0 bottom-4 z-20 px-4 lg:left-64">
          <div className="mx-auto flex max-w-5xl flex-col gap-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur-xs sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-semibold text-slate-800">
              Ada perubahan informasi profil yang belum disimpan ke server.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={discardChanges}
                className="inline-flex flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 sm:flex-none disabled:opacity-50"
              >
                Batalkan
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveChanges()}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-primary-dark sm:flex-none disabled:opacity-60"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Menyimpan…
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Simpan Perubahan
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Logout Panel */}
      <SignOutPanel />
    </PageContainer>
  );
}

const inputClass =
  "w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-primary focus:ring-4 focus:ring-primary/15 disabled:cursor-not-allowed";
