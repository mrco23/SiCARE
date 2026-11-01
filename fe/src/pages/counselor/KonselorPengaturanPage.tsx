import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Award,
  CheckCircle2,
  Globe,
  Info,
  Loader2,
  Lock,
  Phone,
  Plus,
  RefreshCw,
  Save,
  ShieldAlert,
  Sparkles,
  User,
  X,
} from "lucide-react";
import { PageContainer, PageHeader } from "../../components/shared";
import { getCounselorInitials } from "../../features/counselor/shared/presentation";
import { useAuth } from "../../features/auth/useAuth";
import { ApiError } from "../../lib/api";
import { counselorApi } from "../../lib/counselorApi";
import { sicareApi } from "../../lib/sicareApi";
import type { CounselorProfileDto, ProfileDto } from "../../types/api";

const SPECIALTY_PRESETS = [
  "Kecemasan & Stres Akademik",
  "Adaptasi Perkuliahan",
  "Regulasi Emosi",
  "Karier & Rencana Masa Depan",
  "Relasi Interpersonal",
  "Motivasi & Prokrastinasi",
  "Keluarga & Pengasuhan",
  "Burnout & Kelelahan Mental",
] as const;

function normalizePhoneE164(raw: string): string | null {
  const trimmed = raw.trim().replace(/[\s()-]/g, "");
  if (!trimmed) return null;
  if (trimmed.startsWith("08")) {
    return `+62${trimmed.slice(1)}`;
  }
  if (trimmed.startsWith("628")) {
    return `+${trimmed}`;
  }
  return trimmed;
}

export default function KonselorPengaturanPage() {
  const { user, refreshProfile } = useAuth();
  const currentYear = useMemo(() => new Date().getFullYear(), []);

  const [accountProfile, setAccountProfile] = useState<ProfileDto | null>(null);
  const [counselorProfile, setCounselorProfile] =
    useState<CounselorProfileDto | null>(null);
  const [counselorRowMissing, setCounselorRowMissing] = useState(false);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Form states for /api/v1/profile
  const [fullName, setFullName] = useState("");
  const [phoneInput, setPhoneInput] = useState("");

  // Form states for /api/v1/counselor/profile
  const [publicName, setPublicName] = useState("");
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [newSpecialty, setNewSpecialty] = useState("");
  const [practiceStartYear, setPracticeStartYear] = useState<string>(
    String(currentYear),
  );

  const [saving, setSaving] = useState(false);
  const [saveBanner, setSaveBanner] = useState<{
    type: "success" | "warning" | "error";
    message: string;
  } | null>(null);

  const populateForm = useCallback(
    (acc: ProfileDto, couns: CounselorProfileDto | null) => {
      setFullName(acc.full_name ?? "");
      setPhoneInput(acc.phone_e164 ?? "");

      if (couns) {
        setPublicName(couns.public_name ?? acc.full_name ?? "");
        setHeadline(couns.headline ?? "");
        setBio(couns.bio ?? "");
        setSpecialties(couns.specialties ?? []);
        const startYr = Math.max(
          currentYear - 80,
          Math.min(currentYear, currentYear - (couns.years_experience ?? 0)),
        );
        setPracticeStartYear(String(startYr));
      } else {
        setPublicName(acc.full_name ?? "");
        setHeadline("");
        setBio("");
        setSpecialties([]);
        setPracticeStartYear(String(currentYear));
      }
    },
    [currentYear],
  );

  const fetchSettingsData = useCallback(async () => {
    const accRes = await sicareApi.getProfile();
    let counsRes: CounselorProfileDto | null = null;
    let missing = false;

    try {
      counsRes = await counselorApi.getProfile();
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 404) {
        missing = true;
      } else {
        throw err;
      }
    }

    return {
      account: accRes,
      counselor: counsRes,
      missing,
    };
  }, []);

  useEffect(() => {
    let active = true;
    fetchSettingsData()
      .then((data) => {
        if (!active) return;
        setAccountProfile(data.account);
        setCounselorProfile(data.counselor);
        setCounselorRowMissing(data.missing);
        populateForm(data.account, data.counselor);
        setLoadError(null);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setLoadError(
          err instanceof ApiError
            ? err.message
            : "Gagal memuat profil konselor dari server.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [fetchSettingsData, populateForm]);

  const handleManualRefresh = async () => {
    setLoading(true);
    setLoadError(null);
    setSaveBanner(null);
    try {
      const data = await fetchSettingsData();
      setAccountProfile(data.account);
      setCounselorProfile(data.counselor);
      setCounselorRowMissing(data.missing);
      populateForm(data.account, data.counselor);
    } catch (err: unknown) {
      setLoadError(
        err instanceof ApiError
          ? err.message
          : "Gagal memuat ulang profil konselor.",
      );
    } finally {
      setLoading(false);
    }
  };

  const calculatedYearsExperience = useMemo(() => {
    const parsed = Number(practiceStartYear);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, Math.min(80, currentYear - Math.round(parsed)));
  }, [currentYear, practiceStartYear]);

  const validationError = useMemo(() => {
    if (fullName.trim().length < 2 || fullName.trim().length > 120) {
      return "Nama lengkap akun wajib 2–120 karakter.";
    }
    const normalizedPhone = normalizePhoneE164(phoneInput);
    if (normalizedPhone && !/^\+[1-9]\d{7,14}$/.test(normalizedPhone)) {
      return "Format nomor telepon harus E.164 (contoh: +6281234567890 atau 081234567890).";
    }
    if (!counselorRowMissing) {
      if (publicName.trim().length < 2 || publicName.trim().length > 120) {
        return "Nama publik konselor wajib 2–120 karakter.";
      }
      if (
        headline.trim().length > 0 &&
        (headline.trim().length < 3 || headline.trim().length > 160)
      ) {
        return "Headline/Gelar singkat harus 3–160 karakter (atau kosongkan).";
      }
      if (
        bio.trim().length > 0 &&
        (bio.trim().length < 20 || bio.trim().length > 2000)
      ) {
        return "Bio singkat harus minimal 20 karakter dan maksimal 2000 karakter (atau kosongkan).";
      }
      if (specialties.length > 12) {
        return "Maksimal 12 spesialisasi konseling.";
      }
      const parsedStartYear = Number(practiceStartYear);
      if (
        !Number.isInteger(parsedStartYear) ||
        parsedStartYear < currentYear - 80 ||
        parsedStartYear > currentYear
      ) {
        return `Tahun mulai praktik harus antara ${currentYear - 80} dan ${currentYear}.`;
      }
    }
    return null;
  }, [
    bio,
    counselorRowMissing,
    currentYear,
    fullName,
    headline,
    phoneInput,
    practiceStartYear,
    publicName,
    specialties.length,
  ]);

  const handleAddSpecialty = (value: string) => {
    const trimmed = value.trim();
    if (trimmed.length < 2 || trimmed.length > 60) return;
    if (specialties.length >= 12) return;
    if (specialties.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      setNewSpecialty("");
      return;
    }
    setSpecialties((prev) => [...prev, trimmed]);
    setNewSpecialty("");
  };

  const handleRemoveSpecialty = (target: string) => {
    setSpecialties((prev) => prev.filter((item) => item !== target));
  };

  const handleSave = async () => {
    if (validationError || saving) return;
    setSaving(true);
    setSaveBanner(null);

    const normalizedPhone = normalizePhoneE164(phoneInput);
    let accountSaved = false;

    try {
      const updatedAccount = await sicareApi.updateProfile({
        full_name: fullName.trim(),
        phone_e164: normalizedPhone,
      });
      setAccountProfile(updatedAccount);
      setPhoneInput(updatedAccount.phone_e164 ?? "");
      accountSaved = true;

      if (!counselorRowMissing) {
        const updatedCounselor = await counselorApi.updateProfile({
          public_name: publicName.trim(),
          headline: headline.trim() ? headline.trim() : null,
          bio: bio.trim() ? bio.trim() : null,
          specialties,
          years_experience: calculatedYearsExperience,
        });
        setCounselorProfile(updatedCounselor);
      }

      await refreshProfile();

      setSaveBanner({
        type: "success",
        message: counselorRowMissing
          ? "Profil akun berhasil disimpan ke server."
          : "Profil akun dan profil publik konselor berhasil disimpan ke server.",
      });
    } catch (err: unknown) {
      const errMsg =
        err instanceof ApiError
          ? err.message
          : "Terjadi kesalahan saat menyimpan perubahan profil.";

      if (accountSaved) {
        await refreshProfile().catch(() => undefined);
        setSaveBanner({
          type: "warning",
          message: `Profil akun dasar berhasil disimpan, tetapi pembaruan profil publik konselor gagal: ${errMsg}`,
        });
      } else {
        setSaveBanner({
          type: "error",
          message: errMsg,
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const displayTitle =
    publicName.trim() || fullName.trim() || accountProfile?.full_name || "Konselor";

  return (
    <PageContainer className="py-6 lg:py-8">
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <PageHeader
            title="Pengaturan"
            description="Kelola informasi akun dan profil direktori konselor Anda"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleManualRefresh()}
              disabled={loading || saving}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-xs transition hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Muat Ulang
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={loading || saving || Boolean(validationError)}
              className="inline-flex items-center gap-2 rounded-xl bg-[#064E3B] px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-[#053e2f] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Simpan Perubahan
            </button>
          </div>
        </div>

        {saveBanner && (
          <div
            role="status"
            className={`flex items-start justify-between gap-3 rounded-2xl border p-4 text-sm ${
              saveBanner.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-[#064E3B]"
                : saveBanner.type === "warning"
                  ? "border-amber-200 bg-amber-50 text-amber-900"
                  : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            <div className="flex items-start gap-2.5">
              {saveBanner.type === "success" ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <span className="font-medium">{saveBanner.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setSaveBanner(null)}
              aria-label="Tutup pesan"
              className="rounded-lg p-1 hover:bg-black/5"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {loadError && (
          <div
            role="alert"
            className="flex items-start justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            <div className="flex items-start gap-2.5">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              <div>
                <p className="font-semibold">Gagal Memuat Profil</p>
                <p className="mt-0.5">{loadError}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void handleManualRefresh()}
              className="shrink-0 rounded-xl border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
            >
              Coba Lagi
            </button>
          </div>
        )}

        {validationError && !loading && (
          <div
            role="alert"
            className="flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-900"
          >
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
            <span>{validationError}</span>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white py-16 text-center shadow-xs">
            <Loader2 className="h-7 w-7 animate-spin text-[#064E3B]" />
            <p className="mt-3 text-sm font-medium text-gray-600">
              Memuat pengaturan profil konselor dari server...
            </p>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-12">
            {/* Kolom Kiri (4 col): Ringkasan Kartu Profil & Status Publikasi */}
            <div className="space-y-6 lg:col-span-4">
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs">
                <div className="flex flex-col items-center text-center">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-2xl font-bold text-[#064E3B] ring-4 ring-emerald-50/50">
                    {getCounselorInitials(displayTitle)}
                  </div>
                  <h2 className="mt-3.5 text-lg font-bold text-gray-900">
                    {displayTitle}
                  </h2>
                  <p className="mt-0.5 text-xs font-medium text-gray-500">
                    {headline.trim() || "Konselor SiCARE LMI"}
                  </p>

                  <div className="mt-3 flex flex-wrap justify-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
                        counselorProfile?.is_public
                          ? "border-emerald-200 bg-emerald-50 text-[#064E3B]"
                          : "border-amber-200 bg-amber-50 text-amber-800"
                      }`}
                    >
                      <Globe className="h-3.5 w-3.5" />
                      {counselorProfile?.is_public
                        ? "Dipublikasikan di Direktori"
                        : "Belum Dipublikasikan Admin"}
                    </span>
                  </div>
                </div>

                <div className="mt-6 space-y-3 border-t border-gray-100 pt-5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Email Login</span>
                    <span className="font-semibold text-gray-900">
                      {user?.email ?? "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">NIP / Kode Identitas</span>
                    <span className="font-mono font-semibold text-gray-900">
                      {accountProfile?.identity_code ?? "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Status Akun</span>
                    <span className="rounded-md bg-emerald-50 px-2 py-0.5 font-semibold text-[#064E3B]">
                      {accountProfile?.account_status ?? "active"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Pengalaman Praktik</span>
                    <span className="font-semibold text-gray-900">
                      {calculatedYearsExperience} tahun
                    </span>
                  </div>
                </div>

                <div className="mt-5 rounded-xl border border-gray-100 bg-gray-50 p-3.5 text-xs text-gray-600">
                  <p className="font-semibold text-gray-800">
                    Catatan Foto Profil & Publikasi:
                  </p>
                  <p className="mt-1 leading-relaxed">
                    Status publikasi direktori (`is_public`) dikelola oleh Admin LMI.
                    Unggah foto profil ke layanan penyimpanan belum tersedia pada
                    endpoint backend saat ini.
                  </p>
                </div>
              </div>

              {/* Batas Kontrak Keamanan & Preferensi */}
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs">
                <div className="flex items-center gap-2.5">
                  <Lock className="h-5 w-5 text-[#064E3B]" />
                  <h3 className="text-sm font-bold text-gray-900">
                    Keamanan Akun & Kontrak Backend
                  </h3>
                </div>
                <div className="mt-3 space-y-3 text-xs leading-relaxed text-gray-600">
                  <p>
                    Autentikasi akun konselor dikelola secara terpusat melalui{" "}
                    <strong className="text-gray-800">Supabase Auth</strong> dan
                    provisioning Admin LMI.
                  </p>
                  <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-amber-900">
                    <p className="font-semibold">
                      Fitur yang Belum Memiliki Endpoint Backend:
                    </p>
                    <ul className="mt-1.5 list-disc space-y-1 pl-4">
                      <li>Ubah kata sandi mandiri & PIN pengunci riwayat lokal.</li>
                      <li>Daftar riwayat pendidikan terstruktur (`educations`).</li>
                      <li>Toggle pembatasan layanan Individu/Kelompok per konselor.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Kolom Kanan (8 col): Form Edit Profil Akun & Profil Publik Konselor */}
            <div className="space-y-6 lg:col-span-8">
              {counselorRowMissing && (
                <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                  <div>
                    <p className="font-bold">
                      Baris Profil Direktori Konselor Belum Disiapkan Admin
                    </p>
                    <p className="mt-1 text-xs leading-relaxed">
                      Endpoint `/api/v1/counselor/profile` mengembalikan status `404`
                      (`COUNSELOR_PROFILE_NOT_FOUND`). Anda tetap dapat memperbarui Nama
                      Lengkap dan Nomor Telepon akun di bawah ini, namun hubungi Admin LMI
                      untuk mengaktifkan baris `counselor_profiles` Anda.
                    </p>
                  </div>
                </div>
              )}

              {/* Bagian 1: Informasi Akun Dasar (/api/v1/profile) */}
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs">
                <div className="flex items-center gap-2.5 border-b border-gray-100 pb-4">
                  <User className="h-5 w-5 text-[#064E3B]" />
                  <div>
                    <h2 className="text-base font-bold text-gray-900">
                      Informasi Akun Dasar
                    </h2>
                    <p className="text-xs text-gray-500">
                      Tersimpan pada tabel `profiles` (`PATCH /api/v1/profile`)
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="fullNameInput"
                      className="block text-sm font-semibold text-gray-800"
                    >
                      Nama Lengkap Akun <span className="text-red-600">*</span>
                    </label>
                    <input
                      id="fullNameInput"
                      type="text"
                      maxLength={120}
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      placeholder="Nama lengkap beserta gelar"
                      className="mt-1.5 w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 outline-none focus:border-[#064E3B] focus:ring-4 focus:ring-[#064E3B]/15"
                    />
                    <p className="mt-1 text-xs text-gray-400">
                      2–120 karakter ({fullName.trim().length}/120).
                    </p>
                  </div>

                  <div>
                    <label
                      htmlFor="phoneE164Input"
                      className="block text-sm font-semibold text-gray-800"
                    >
                      Nomor WhatsApp / Telepon (E.164)
                    </label>
                    <div className="relative mt-1.5">
                      <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <input
                        id="phoneE164Input"
                        type="tel"
                        value={phoneInput}
                        onChange={(event) => setPhoneInput(event.target.value)}
                        placeholder="+6281234567890"
                        className="w-full rounded-xl border border-gray-300 py-2.5 pl-10 pr-3.5 text-sm text-gray-900 outline-none focus:border-[#064E3B] focus:ring-4 focus:ring-[#064E3B]/15"
                      />
                    </div>
                    <p className="mt-1 text-xs text-gray-400">
                      Awali dengan `+62` atau `08` (otomatis dikonversi ke `+62`).
                    </p>
                  </div>
                </div>
              </div>

              {/* Bagian 2: Profil Publik Konselor (/api/v1/counselor/profile) */}
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs">
                <div className="flex items-center gap-2.5 border-b border-gray-100 pb-4">
                  <Award className="h-5 w-5 text-[#064E3B]" />
                  <div>
                    <h2 className="text-base font-bold text-gray-900">
                      Profil Direktori Konselor
                    </h2>
                    <p className="text-xs text-gray-500">
                      Tersimpan pada tabel `counselor_profiles` (`PATCH /api/v1/counselor/profile`)
                    </p>
                  </div>
                </div>

                <div className="mt-5 space-y-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="publicNameInput"
                        className="block text-sm font-semibold text-gray-800"
                      >
                        Nama Publik di Direktori Klien{" "}
                        <span className="text-red-600">*</span>
                      </label>
                      <input
                        id="publicNameInput"
                        type="text"
                        disabled={counselorRowMissing}
                        maxLength={120}
                        value={publicName}
                        onChange={(event) => setPublicName(event.target.value)}
                        placeholder="Contoh: Dr. Giovanna, M.Psi., Psikolog"
                        className="mt-1.5 w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 outline-none focus:border-[#064E3B] focus:ring-4 focus:ring-[#064E3B]/15 disabled:bg-gray-100"
                      />
                      <p className="mt-1 text-xs text-gray-400">
                        Nama yang ditampilkan kepada klien saat memilih konselor.
                      </p>
                    </div>

                    <div>
                      <label
                        htmlFor="practiceStartYearInput"
                        className="block text-sm font-semibold text-gray-800"
                      >
                        Tahun Mulai Praktik <span className="text-red-600">*</span>
                      </label>
                      <div className="mt-1.5 flex items-center gap-3">
                        <input
                          id="practiceStartYearInput"
                          type="number"
                          disabled={counselorRowMissing}
                          min={currentYear - 80}
                          max={currentYear}
                          value={practiceStartYear}
                          onChange={(event) =>
                            setPracticeStartYear(event.target.value)
                          }
                          className="w-36 rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm font-semibold tabular-nums text-gray-900 outline-none focus:border-[#064E3B] focus:ring-4 focus:ring-[#064E3B]/15 disabled:bg-gray-100"
                        />
                        <span className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-[#064E3B]">
                          = {calculatedYearsExperience} tahun pengalaman
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-gray-400">
                        Dikonversi otomatis ke kolom `years_experience` (0–80 tahun).
                      </p>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="headlineInput"
                      className="block text-sm font-semibold text-gray-800"
                    >
                      Headline / Peran & Fokus Praktik
                    </label>
                    <input
                      id="headlineInput"
                      type="text"
                      disabled={counselorRowMissing}
                      maxLength={160}
                      value={headline}
                      onChange={(event) => setHeadline(event.target.value)}
                      placeholder="Contoh: Psikolog Klinis Dewasa & Konselor Akademik LMI"
                      className="mt-1.5 w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 outline-none focus:border-[#064E3B] focus:ring-4 focus:ring-[#064E3B]/15 disabled:bg-gray-100"
                    />
                    <p className="mt-1 text-xs text-gray-400">
                      Opsional, 3–160 karakter ({headline.trim().length}/160).
                    </p>
                  </div>

                  <div>
                    <label
                      htmlFor="bioTextarea"
                      className="block text-sm font-semibold text-gray-800"
                    >
                      Bio Singkat & Pendekatan Konseling
                    </label>
                    <textarea
                      id="bioTextarea"
                      rows={4}
                      disabled={counselorRowMissing}
                      maxLength={2000}
                      value={bio}
                      onChange={(event) => setBio(event.target.value)}
                      placeholder="Ceritakan pengalaman, latar belakang pendidikan, dan pendekatan konseling Anda (minimal 20 karakter bila diisi)..."
                      className="mt-1.5 w-full rounded-xl border border-gray-300 p-3.5 text-sm text-gray-900 outline-none focus:border-[#064E3B] focus:ring-4 focus:ring-[#064E3B]/15 disabled:bg-gray-100"
                    />
                    <p className="mt-1 text-xs text-gray-400">
                      Opsional, 20–2000 karakter ({bio.trim().length}/2000). Anda juga
                      dapat mencantumkan ringkasan latar belakang pendidikan di sini.
                    </p>
                  </div>

                  {/* Spesialisasi Konseling */}
                  <div>
                    <div className="flex items-center justify-between">
                      <label
                        htmlFor="newSpecialtyInput"
                        className="block text-sm font-semibold text-gray-800"
                      >
                        Topik Spesialisasi Konseling ({specialties.length}/12)
                      </label>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-2">
                      {specialties.length === 0 ? (
                        <span className="text-xs italic text-gray-400">
                          Belum ada topik spesialisasi yang ditambahkan.
                        </span>
                      ) : (
                        specialties.map((item) => (
                          <span
                            key={item}
                            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-[#064E3B]"
                          >
                            {item}
                            {!counselorRowMissing && (
                              <button
                                type="button"
                                onClick={() => handleRemoveSpecialty(item)}
                                aria-label={`Hapus spesialisasi ${item}`}
                                className="rounded-full p-0.5 hover:bg-emerald-200/60"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            )}
                          </span>
                        ))
                      )}
                    </div>

                    <div className="mt-3 flex gap-2">
                      <input
                        id="newSpecialtyInput"
                        type="text"
                        disabled={counselorRowMissing || specialties.length >= 12}
                        maxLength={60}
                        value={newSpecialty}
                        onChange={(event) => setNewSpecialty(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            handleAddSpecialty(newSpecialty);
                          }
                        }}
                        placeholder="Ketik spesialisasi baru (2–60 karakter)..."
                        className="flex-1 rounded-xl border border-gray-300 px-3.5 py-2 text-sm outline-none focus:border-[#064E3B] disabled:bg-gray-100"
                      />
                      <button
                        type="button"
                        disabled={
                          counselorRowMissing ||
                          specialties.length >= 12 ||
                          newSpecialty.trim().length < 2
                        }
                        onClick={() => handleAddSpecialty(newSpecialty)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-45"
                      >
                        <Plus className="h-4 w-4" />
                        Tambah
                      </button>
                    </div>

                    {/* Pilihan Cepat Spesialisasi */}
                    <div className="mt-3">
                      <p className="flex items-center gap-1 text-xs font-medium text-gray-500">
                        <Sparkles className="h-3.5 w-3.5 text-[#064E3B]" />
                        Pilihan cepat topik spesialisasi:
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {SPECIALTY_PRESETS.map((preset) => {
                          const exists = specialties.some(
                            (s) => s.toLowerCase() === preset.toLowerCase(),
                          );
                          return (
                            <button
                              key={preset}
                              type="button"
                              disabled={
                                counselorRowMissing ||
                                exists ||
                                specialties.length >= 12
                              }
                              onClick={() => handleAddSpecialty(preset)}
                              className="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-700 transition hover:border-emerald-300 hover:bg-emerald-50/50 disabled:opacity-40"
                            >
                              + {preset}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-between gap-3 border-t border-gray-100 pt-5">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Info className="h-4 w-4 shrink-0 text-[#064E3B]" />
                    <span>
                      Perubahan akan langsung diperbarui pada direktori publik setelah
                      disimpan.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={loading || saving || Boolean(validationError)}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#064E3B] px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-[#053e2f] disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Simpan Perubahan
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
