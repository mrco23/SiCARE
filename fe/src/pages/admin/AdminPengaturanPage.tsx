import { useAuth } from "../../features/auth/useAuth";
import { adminApi } from "../../lib/adminApi";
import { sicareApi } from "../../lib/sicareApi";
import type { HeroMotivationAdminDto } from "../../types/api";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { PageContainer, PageHeader, SettingsField as Field, SettingsPanel as Panel } from "../../components/shared";
import {
  CheckCircle2,
  FileText,
  Mail,
  Phone,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react";

type AdminProfile = {
  name: string;
  email: string;
  phone: string;
};

type HeroMotivation = Pick<HeroMotivationAdminDto, "id" | "content" | "is_active">
  & Partial<Pick<HeroMotivationAdminDto, "created_at" | "updated_at">>;

const INITIAL_PROFILE: AdminProfile = {
  name: "Administrator SiCARE",
  email: "",
  phone: "",
};

const PHONE_RE = /^(\+62|62|0)[0-9]{7,15}$/;

function makeId() {
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function AdminPengaturanPage() {
  const { user, profile: authProfile, refreshProfile } = useAuth();

  const [profile, setProfile] = useState<AdminProfile>(() => ({
    name: authProfile?.full_name || INITIAL_PROFILE.name,
    email: user?.email || INITIAL_PROFILE.email,
    phone: authProfile?.phone_e164 || INITIAL_PROFILE.phone,
  }));
  const [savedProfile, setSavedProfile] = useState<AdminProfile>(() => ({
    name: authProfile?.full_name || INITIAL_PROFILE.name,
    email: user?.email || INITIAL_PROFILE.email,
    phone: authProfile?.phone_e164 || INITIAL_PROFILE.phone,
  }));

  const [heroMotivations, setHeroMotivations] = useState<HeroMotivation[]>([]);
  const [savedHeroMotivations, setSavedHeroMotivations] = useState<HeroMotivation[]>([]);
  const [heroLoading, setHeroLoading] = useState(true);
  const [heroLoadError, setHeroLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const profileDirty = JSON.stringify(profile) !== JSON.stringify(savedProfile);
  const heroDirty =
    JSON.stringify(heroMotivations) !== JSON.stringify(savedHeroMotivations);
  const dirty = profileDirty || heroDirty;

  useEffect(() => {
    let active = true;

    void sicareApi
      .getProfile()
      .then((me) => {
        if (!active) return;
        const nextProfile: AdminProfile = {
          name: me.full_name?.trim() || "Administrator SiCARE",
          email: user?.email || "",
          phone: me.phone_e164 || "",
        };
        setProfile(nextProfile);
        setSavedProfile(nextProfile);
      })
      .catch(() => {
        // Tetap gunakan profil dari sesi auth jika endpoint gagal sementara
      });

    void adminApi.listHeroMotivations()
      .then((data) => {
        if (!active) return;
        const items = data.map((item) => ({ ...item }));
        setHeroMotivations(items);
        setSavedHeroMotivations(items);
        setHeroLoadError("");
      })
      .catch((error: unknown) => {
        if (!active) return;
        setHeroLoadError(
          error instanceof Error
            ? error.message
            : "Kalimat motivasi tidak dapat dimuat.",
        );
      })
      .finally(() => {
        if (active) setHeroLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user?.email]);

  const errors = useMemo(() => {
    const result: Record<string, string> = {};
    if (!profile.name.trim()) result.name = "Nama admin wajib diisi.";

    const phone = profile.phone.replace(/[\s()-]/g, "");
    if (phone && !PHONE_RE.test(phone)) {
      result.phone = "Format nomor telepon tidak valid (8–20 digit).";
    }

    heroMotivations.forEach((item, index) => {
      if (!item.content.trim()) {
        result[`content-${item.id}`] =
          `Kalimat motivasi ${index + 1} wajib diisi.`;
      } else if (item.content.trim().length > 180) {
        result[`content-${item.id}`] =
          "Kalimat motivasi maksimal 180 karakter.";
      }
    });

    return result;
  }, [profile, heroMotivations]);

  useEffect(() => {
    if (!toast) return;
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3200);
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [toast]);

  function updateProfile<K extends keyof AdminProfile>(
    key: K,
    value: AdminProfile[K],
  ) {
    setProfile((previous) => ({ ...previous, [key]: value }));
  }

  function updateHeroMotivation(
    id: string,
    patch: Partial<Pick<HeroMotivation, "content" | "is_active">>,
  ) {
    setHeroMotivations((previous) =>
      previous.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }

  function addHeroMotivation() {
    setHeroMotivations((previous) => [
      ...previous,
      { id: makeId(), content: "", is_active: true },
    ]);
  }

  function removeHeroMotivation(id: string) {
    setHeroMotivations((previous) => previous.filter((item) => item.id !== id));
  }

  async function saveChanges() {
    if (!heroLoadError && heroLoading) {
      setToast("Tunggu sampai kalimat motivasi selesai dimuat.");
      return;
    }
    if (heroLoadError && heroDirty) {
      setToast("Kalimat motivasi belum berhasil dimuat. Muat ulang halaman sebelum menyimpan.");
      return;
    }
    if (Object.keys(errors).length > 0) {
      setShowErrors(true);
      setToast("Periksa kembali isian yang ditandai.");
      return;
    }

    setSaving(true);
    try {
      if (profileDirty) {
        const cleanedPhone = profile.phone.replace(/[\s()-]/g, "").trim();
        const updatedMe = await sicareApi.updateProfile({
          full_name: profile.name.trim(),
          phone_e164: cleanedPhone || null,
        });
        const nextSaved: AdminProfile = {
          name: updatedMe.full_name?.trim() || profile.name.trim(),
          email: user?.email || profile.email,
          phone: updatedMe.phone_e164 || "",
        };
        setProfile(nextSaved);
        setSavedProfile(nextSaved);
        await refreshProfile().catch(() => undefined);
      }

      if (heroDirty) {
        const currentIds = new Set(
          heroMotivations.filter((item) => !item.id.startsWith("draft-")).map((item) => item.id),
        );

        for (const saved of savedHeroMotivations) {
          if (!currentIds.has(saved.id)) {
            await adminApi.deleteHeroMotivation(saved.id);
          }
        }

        for (const item of heroMotivations) {
          if (item.id.startsWith("draft-")) {
            await adminApi.createHeroMotivation({ content: item.content.trim(), is_active: item.is_active });
            continue;
          }

          const saved = savedHeroMotivations.find((entry) => entry.id === item.id);
          if (!saved) continue;
          const patch: Partial<Pick<HeroMotivation, "content" | "is_active">> = {};
          if (saved.content !== item.content.trim()) patch.content = item.content.trim();
          if (saved.is_active !== item.is_active) patch.is_active = item.is_active;
          if (Object.keys(patch).length > 0) {
            await adminApi.updateHeroMotivation(item.id, patch);
          }
        }

        const refreshed = await adminApi.listHeroMotivations();
        setHeroMotivations(refreshed);
        setSavedHeroMotivations(refreshed.map((item) => ({ ...item })));
      }

      setShowErrors(false);
      setToast("Perubahan profil dan kalimat motivasi berhasil disimpan ke database.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Pengaturan tidak dapat disimpan.";
      setToast(message);
      try {
        const refreshed = await adminApi.listHeroMotivations();
        setHeroMotivations(refreshed);
        setSavedHeroMotivations(refreshed.map((item) => ({ ...item })));
        setHeroLoadError("");
      } catch {
        setHeroLoadError("Kalimat motivasi tidak dapat dimuat ulang dari server.");
      }
    } finally {
      setSaving(false);
    }
  }

  function discardChanges() {
    setProfile({ ...savedProfile });
    setHeroMotivations(savedHeroMotivations.map((item) => ({ ...item })));
    setShowErrors(false);
  }

  return (
    <PageContainer role="admin" spacing="none">
      <PageHeader
        title="Pengaturan"
        description="Kelola informasi akun administrator dan kalimat yang tampil pada bagian Hero di halaman utama SiCARE."
      />

      <section className="mt-6 flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#d9e2dc] bg-white">
            <img
              src="/icon-512x512.png"
              alt="Logo SiCARE"
              className="h-full w-full object-contain p-1.5"
            />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900">{profile.name}</p>
            <p className="mt-1 break-all text-xs text-gray-500">
              {profile.email || "-"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          Akun administrator
          <span className="ml-1 rounded-full bg-primary-soft px-2.5 py-1 font-semibold text-primary">
            Aktif
          </span>
        </div>
      </section>

      <div className="mt-6 flex flex-col gap-4 sm:gap-5 lg:gap-6">
        <Panel
          icon={<UserRound className="h-5 w-5" />}
          title="Informasi Akun"
          description="Perbarui nama tampilan dan nomor telepon akun administrator Anda."
        >
          <div className="space-y-5">
            <Field
              label="Nama admin"
              required
              error={showErrors ? errors.name : ""}
            >
              <input
                value={profile.name}
                disabled={saving}
                onChange={(event) =>
                  updateProfile("name", event.target.value)
                }
                placeholder="Administrator SiCARE"
                className={inputClass}
              />
            </Field>

            <Field label="Email">
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  autoComplete="email"
                  value={profile.email}
                  readOnly
                  className={`${inputClass} cursor-not-allowed bg-gray-50 pl-10 text-gray-500`}
                />
              </div>
              <p className="mt-1.5 text-xs text-gray-500">
                Email autentikasi ditetapkan melalui Supabase Auth.
              </p>
            </Field>

            <Field label="Nomor telepon" error={showErrors ? errors.phone : ""}>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={profile.phone}
                  disabled={saving}
                  onChange={(event) =>
                    updateProfile("phone", event.target.value)
                  }
                  placeholder="Contoh: +6281234567890"
                  className={`${inputClass} pl-10`}
                />
              </div>
              <p className="mt-1.5 text-xs text-gray-500">
                Nomor telepon opsional.
              </p>
            </Field>
          </div>
        </Panel>

        <Panel
          icon={<FileText className="h-5 w-5" />}
          title="Kalimat Motivasi Beranda"
          description="Kelola kalimat singkat yang ditampilkan secara bergantian pada bagian Hero halaman utama. Tidak ada input paragraf."
          action={
            <button
              type="button"
              onClick={addHeroMotivation}
              disabled={heroLoading || Boolean(heroLoadError) || saving}
              className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-primary transition hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Tambah
            </button>
          }
        >
          <div className="space-y-4">
            {heroLoading && (
              <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-600">
                Memuat kalimat motivasi dari database...
              </p>
            )}

            {heroLoadError && (
              <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                Kalimat motivasi gagal dimuat: {heroLoadError}
                <p className="mt-1">Periksa koneksi backend dan akses admin, lalu muat ulang halaman ini.</p>
              </div>
            )}

            {!heroLoading && !heroLoadError && heroMotivations.length === 0 && (
              <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-600">
                Belum ada kalimat motivasi. Pilih Tambah untuk membuat kalimat pertama.
              </p>
            )}

            {!heroLoading && !heroLoadError && heroMotivations.map((item, index) => (
              <div
                key={item.id}
                className="rounded-xl border border-gray-200 p-4"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-sm font-bold text-gray-800">
                    Kalimat {index + 1}
                  </p>
                  <button
                    type="button"
                    aria-label={`Hapus kalimat ${index + 1}`}
                    disabled={saving}
                    onClick={() => removeHeroMotivation(item.id)}
                    className="rounded-lg p-2 text-gray-500 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <Field
                  label="Kalimat motivasi"
                  required
                  error={showErrors ? errors[`content-${item.id}`] : ""}
                >
                  <input
                    type="text"
                    maxLength={180}
                    value={item.content}
                    disabled={saving}
                    onChange={(event) =>
                      updateHeroMotivation(item.id, { content: event.target.value })
                    }
                    placeholder="Contoh: Kamu tidak harus menghadapi semuanya sendirian."
                    className={inputClass}
                  />
                  <p className="mt-1 text-right text-xs text-gray-400">
                    {item.content.length}/180 karakter
                  </p>
                </Field>

                <label className="mt-3 inline-flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={item.is_active}
                    disabled={saving}
                    onChange={(event) =>
                      updateHeroMotivation(item.id, { is_active: event.target.checked })
                    }
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  Aktif, boleh ditampilkan di landing page
                </label>
              </div>
            ))}

            {showErrors && errors.heroMotivations && (
              <p className="text-xs text-red-600">{errors.heroMotivations}</p>
            )}

            <div className="rounded-xl bg-primary-tint p-3 text-xs leading-relaxed text-gray-600">
              <p className="font-semibold text-primary">Cara kerja</p>
              Pengunjung akan melihat satu kalimat yang dipilih secara acak dari daftar yang aktif. Kalimat nonaktif tidak ditampilkan. Semua perubahan disimpan ke database ketika tombol Simpan perubahan digunakan.
            </div>
          </div>
        </Panel>

        <Panel
          className="lg:col-span-2"
          icon={<ShieldCheck className="h-5 w-5" />}
          title="Status Sinkronisasi"
          description="Penyimpanan terpusat di database SiCARE."
        >
          <p className="text-sm leading-relaxed text-gray-600">
            Profil akun administrator dan kalimat motivasi Hero disimpan secara
            permanen di database melalui backend SiCARE.
          </p>
        </Panel>
      </div>

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
                disabled={saving}
                className="inline-flex flex-1 items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 sm:flex-none"
              >
                Batalkan
              </button>
              <button
                type="button"
                onClick={() => void saveChanges()}
                disabled={saving || (heroDirty && (heroLoading || Boolean(heroLoadError)))}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
              >
                <Save className="h-4 w-4" />
                {saving ? "Menyimpan..." : "Simpan perubahan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          role="status"
          className="pointer-events-none fixed left-1/2 top-20 z-50 flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-lg"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      <p className="mt-8 pb-3 text-center text-[11px] leading-relaxed text-gray-400">
        Profil akun administrator dan kalimat motivasi tersinkron dengan database SiCARE.
      </p>
    </PageContainer>
  );
}

const inputClass =
  "w-full min-w-0 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-primary focus:ring-4 focus:ring-primary/15";
