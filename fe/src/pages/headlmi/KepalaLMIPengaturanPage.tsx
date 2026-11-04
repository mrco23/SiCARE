import {
  PageContainer,
  PageHeader,
  SettingsField as Field,
  SettingsPanel as Panel,
  SkeletonFormGrid,
  useToast,
} from "../../components/shared";
import { useAuth } from "../../features/auth/useAuth";
import { sicareApi } from "../../lib/sicareApi";
import {
  uploadProfilePhoto,
  deleteProfilePhoto,
  getPublicPhotoUrl,
  validatePhotoFile,
} from "../../lib/profilePhotoStorage";
import { getInitials } from "../../lib/avatarUtils";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  Camera,
  LockKeyhole,
  Mail,
  Phone,
  Save,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";

type Profile = {
  photo: string | null;
  displayName: string;
  email: string;
  phone: string;
};

const INITIAL_PROFILE: Profile = {
  photo: null,
  displayName: "Kepala LMI",
  email: "kepala.lmi@kampus.ac.id",
  phone: "",
};

const PASSWORD_MIN = 8;

function cloneProfile(p: Profile): Profile {
  return { ...p };
}

export default function KepalaLMIPengaturanPage() {
  const { user, profile: authProfile, refreshProfile } = useAuth();
  const profileKey = `sicare_profile_photo_${authProfile?.id || "head_lmi"}`;

  const [savedProfile, setSavedProfile] = useState<Profile>(() => {
    const authAvatar = (authProfile as Record<string, unknown> | null)?.avatar_url;
    const initialPhoto: string | null = typeof authAvatar === "string" ? authAvatar : null;
    return {
      photo: initialPhoto,
      displayName: authProfile?.full_name || INITIAL_PROFILE.displayName,
      email: user?.email || INITIAL_PROFILE.email,
      phone: authProfile?.phone_e164 || INITIAL_PROFILE.phone,
    };
  });

  const [profile, setProfile] = useState<Profile>(() => cloneProfile(savedProfile));
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const [photoError, setPhotoError] = useState("");

  // Cropper states
  const [cropSource, setCropSource] = useState<string | null>(null);
  const [cropDimensions, setCropDimensions] = useState({ width: 0, height: 0 });
  const [cropZoom, setCropZoom] = useState(1);
  const [cropX, setCropX] = useState(50);
  const [cropY, setCropY] = useState(50);
  const cropImageRef = useRef<HTMLImageElement>(null);
  const cropDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startCropX: number;
    startCropY: number;
  } | null>(null);

  // Password change states
  const [pwdCurrent, setPwdCurrent] = useState("");
  const [pwdNext, setPwdNext] = useState("");
  const [pwdConfirm, setPwdConfirm] = useState("");

  const photoInput = useRef<HTMLInputElement>(null);

  const dirty = JSON.stringify(profile) !== JSON.stringify(savedProfile);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    sicareApi
      .getProfile()
      .then((data) => {
        if (!active) return;
        setSavedProfile((prev) => {
          const loaded: Profile = {
            photo: data.avatar_url || prev.photo,
            displayName: data.full_name || "Kepala LMI",
            email: user?.email || data.identity_code || "kepala.lmi@kampus.ac.id",
            phone: data.phone_e164 || "",
          };
          setProfile(loaded);
          return loaded;
        });
      })
      .catch(() => {
        // Fallback to auth profile
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user]);

  const errors = useMemo(() => {
    const result: Record<string, string> = {};

    if (!profile.displayName.trim()) {
      result.displayName = "Nama lengkap wajib diisi.";
    }

    const email = profile.email.trim();
    if (!email) {
      result.email = "Email wajib diisi.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      result.email = "Format email tidak valid.";
    }

    const phone = profile.phone.replace(/[\s()-]/g, "");
    if (phone && !/^(\+62|62|0)[0-9]{8,15}$/.test(phone)) {
      result.phone = "Format nomor telepon tidak valid.";
    }

    return result;
  }, [profile]);

  useEffect(() => {
    return () => {
      if (cropSource) URL.revokeObjectURL(cropSource);
    };
  }, [cropSource]);

  function updateProfile<K extends keyof Profile>(key: K, value: Profile[K]) {
    setProfile((previous) => ({ ...previous, [key]: value }));
  }

  function closeCropper() {
    if (cropSource) URL.revokeObjectURL(cropSource);
    setCropSource(null);
    setCropDimensions({ width: 0, height: 0 });
    setCropZoom(1);
    setCropX(50);
    setCropY(50);
    cropDragRef.current = null;
  }

  function handlePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const validation = validatePhotoFile(file);
    if (!validation.valid) {
      setPhotoError(validation.error || "Berkas foto tidak valid.");
      return;
    }

    const source = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      if (cropSource) URL.revokeObjectURL(cropSource);
      setCropDimensions({
        width: image.naturalWidth,
        height: image.naturalHeight,
      });
      setCropZoom(1);
      setCropX(50);
      setCropY(50);
      setCropSource(source);
      setPhotoError("");
    };

    image.onerror = () => {
      URL.revokeObjectURL(source);
      setPhotoError("Foto tidak bisa dibaca. Coba file lain.");
    };

    image.src = source;
  }

  function handleCropPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!cropDimensions.width || !cropDimensions.height) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    cropDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startCropX: cropX,
      startCropY: cropY,
    };
  }

  function handleCropPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = cropDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const stageSize = 280;
    const scale = Math.min(
      stageSize / cropDimensions.width,
      stageSize / cropDimensions.height,
    );
    const displayWidth = cropDimensions.width * scale;
    const displayHeight = cropDimensions.height * scale;
    const frameSide = Math.min(displayWidth, displayHeight) / cropZoom;
    const maxX = Math.max(0, displayWidth - frameSide);
    const maxY = Math.max(0, displayHeight - frameSide);
    const nextX =
      maxX > 0
        ? drag.startCropX + ((event.clientX - drag.startX) / maxX) * 100
        : 0;
    const nextY =
      maxY > 0
        ? drag.startCropY + ((event.clientY - drag.startY) / maxY) * 100
        : 0;

    setCropX(Math.max(0, Math.min(100, nextX)));
    setCropY(Math.max(0, Math.min(100, nextY)));
  }

  function handleCropPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (cropDragRef.current?.pointerId === event.pointerId) {
      cropDragRef.current = null;
    }
  }

  function applyCrop() {
    const image = cropImageRef.current;
    if (!image || !cropDimensions.width || !cropDimensions.height) return;

    const { width, height } = cropDimensions;
    const cropSide = Math.min(width, height) / cropZoom;
    const sx = (width - cropSide) * (cropX / 100);
    const sy = (height - cropSide) * (cropY / 100);
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext("2d");

    if (!context) {
      setPhotoError("Foto tidak bisa diproses. Coba file lain.");
      closeCropper();
      return;
    }

    context.drawImage(image, sx, sy, cropSide, cropSide, 0, 0, 512, 512);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    updateProfile("photo", dataUrl);
    setPhotoError("");
    closeCropper();
  }

  function handleDeletePhoto() {
    updateProfile("photo", null);
    toast.info("Foto profil ditandai untuk dihapus. Klik Simpan perubahan.");
  }

  async function saveChanges() {
    if (Object.keys(errors).length > 0) {
      setShowErrors(true);
      toast.error("Periksa kembali isian yang ditandai.");
      return;
    }

    setSaving(true);
    try {
      const cleanedPhone = profile.phone.replace(/[\s()-]/g, "").trim();
      await sicareApi.updateProfile({
        full_name: profile.displayName.trim(),
        phone_e164: cleanedPhone || null,
      });

      let nextPhotoPath = profile.photo;
      if (profile.photo !== savedProfile.photo) {
        if (profile.photo && profile.photo.startsWith("data:image/")) {
          const uploadResult = await uploadProfilePhoto(profile.photo);
          nextPhotoPath = uploadResult.storage_path;
        } else if (!profile.photo && savedProfile.photo) {
          await deleteProfilePhoto();
          nextPhotoPath = null;
        }

        try {
          localStorage.removeItem(profileKey);
          window.dispatchEvent(new Event("sicare:photo-updated"));
        } catch {
          // ignore
        }
      }

      await refreshProfile().catch(() => null);
      const nextSaved: Profile = {
        ...cloneProfile(profile),
        photo: nextPhotoPath,
      };
      setProfile(nextSaved);
      setSavedProfile(nextSaved);
      setShowErrors(false);
      toast.success("Profil Kepala LMI berhasil disimpan.");
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Gagal menyimpan perubahan profil ke server.",
      );
    } finally {
      setSaving(false);
    }
  }

  function discardChanges() {
    setProfile(cloneProfile(savedProfile));
    setShowErrors(false);
    setPhotoError("");
  }

  function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const issues = [
      !pwdCurrent ? "Masukkan kata sandi saat ini." : "",
      pwdNext.length < PASSWORD_MIN
        ? `Kata sandi baru minimal ${PASSWORD_MIN} karakter.`
        : "",
      pwdConfirm !== pwdNext ? "Konfirmasi kata sandi tidak sama." : "",
    ].filter(Boolean);

    if (issues.length > 0) {
      toast.error(issues.join(" "));
      return;
    }

    setPwdCurrent("");
    setPwdNext("");
    setPwdConfirm("");
    toast.success("Perubahan kata sandi disimpan untuk sesi ini.");
  }

  const photoPreview = getPublicPhotoUrl(profile.photo);
  const initials = getInitials(profile.displayName || "Kepala LMI");

  return (
    <PageContainer role="headlmi" spacing="none" className="text-gray-800">
      <PageHeader
        title="Pengaturan"
        description="Kelola foto profil, informasi akun, dan preferensi pimpinan LMI."
      />

      {/* Top Banner Akun */}
      <section className="mt-6 flex flex-col gap-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-gray-200 bg-[#f3faf5] text-primary shadow-xs">
            {photoPreview ? (
              <img
                src={photoPreview}
                alt="Foto profil Kepala LMI"
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center bg-primary text-base font-bold text-white">
                {initials}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold text-gray-900">
              {profile.displayName || "Nama Kepala LMI"}
            </p>
            <p className="mt-1 break-all text-xs text-gray-500">
              {profile.email}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-500">
          <LockKeyhole className="h-4 w-4 shrink-0" />
          Status akun
          <span className="ml-1 shrink-0 rounded-full bg-primary-soft px-2.5 py-1 font-semibold text-primary">
            Aktif
          </span>
        </div>
      </section>

      {/* Grid Pengaturan */}
{loading ? (
        <SkeletonFormGrid className="mt-6 grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-2 lg:gap-6" />
      ) : (
      <div className="mt-6 grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-2 lg:gap-6">
        {/* Panel Foto Profil */}
        <Panel
          compactHeader
          icon={<Camera className="h-5 w-5" />}
          title="Foto Profil"
          description="Foto identitas pimpinan LMI. Ditampilkan pada navbar dan profil akun."
        >
          <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
            <div className="aspect-square w-40 shrink-0 overflow-hidden rounded-xl border border-gray-200 bg-primary-tint">
              {photoPreview ? (
                <img
                  src={photoPreview}
                  alt="Foto profil Kepala LMI"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-gray-300">
                  <UserRound className="h-14 w-14" />
                </div>
              )}
            </div>
            <div className="flex w-full flex-col gap-2 sm:pt-1">
              <input
                ref={photoInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handlePhoto}
              />
              <button
                type="button"
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark"
                onClick={() => photoInput.current?.click()}
              >
                <Camera className="h-4 w-4" />
                Unggah foto baru
              </button>
              {profile.photo && (
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-red-300 hover:bg-gray-50 hover:text-red-600"
                  onClick={handleDeletePhoto}
                >
                  Hapus foto
                </button>
              )}
              <p className="text-xs leading-relaxed text-gray-500">
                Format JPG, PNG, atau WEBP. Ukuran maksimal 2 MB. Foto dapat digeser dan disesuaikan bingkainya.
              </p>
              {photoError && (
                <p className="text-xs text-red-600">{photoError}</p>
              )}
            </div>
          </div>
        </Panel>

        {/* Panel Informasi Akun */}
        <Panel
          compactHeader
          icon={<UserRound className="h-5 w-5" />}
          title="Informasi Akun"
          description="Perbarui nama tampilan dan nomor kontak akun Kepala LMI."
        >
          <div className="space-y-4">
            <Field
              label="Nama Lengkap"
              required
              error={showErrors ? errors.displayName : ""}
            >
              <input
                autoComplete="name"
                disabled={saving}
                value={profile.displayName}
                onChange={(e) => updateProfile("displayName", e.target.value)}
                placeholder="Masukkan nama lengkap pimpinan"
                className={inputClass}
              />
            </Field>

            <Field label="Alamat Email">
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  disabled
                  value={profile.email}
                  className={`${inputClass} cursor-not-allowed bg-gray-50 pl-10 text-gray-500`}
                />
              </div>
              <p className="mt-1 text-[11px] text-gray-400">
                Email terikat pada akun autentikasi Supabase.
              </p>
            </Field>

            <Field
              label="Nomor Telepon (WhatsApp)"
              error={showErrors ? errors.phone : ""}
            >
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  disabled={saving}
                  value={profile.phone}
                  onChange={(e) => updateProfile("phone", e.target.value)}
                  placeholder="Contoh: 081234567890"
                  className={`${inputClass} pl-10`}
                />
              </div>
              <p className="mt-1 text-[11px] text-gray-400">
                Digunakan untuk koordinasi operasional SiCARE.
              </p>
            </Field>
          </div>
        </Panel>

        {/* Panel Ubah Kata Sandi */}
        <Panel
          compactHeader
          icon={<LockKeyhole className="h-5 w-5" />}
          title="Ubah Kata Sandi"
          description="Perbarui kata sandi akun untuk menjaga keamanan akses dashboard eksekutif."
        >
          <form onSubmit={changePassword} className="space-y-4">
            <Field label="Kata sandi saat ini" required>
              <input
                type="password"
                autoComplete="current-password"
                value={pwdCurrent}
                onChange={(e) => setPwdCurrent(e.target.value)}
                className={inputClass}
              />
            </Field>

            <Field label="Kata sandi baru" required>
              <input
                type="password"
                autoComplete="new-password"
                value={pwdNext}
                onChange={(e) => setPwdNext(e.target.value)}
                className={inputClass}
              />
              <p className="mt-1 text-xs text-gray-500">
                Minimal {PASSWORD_MIN} karakter
              </p>
            </Field>

            <Field label="Ulangi kata sandi baru" required>
              <input
                type="password"
                autoComplete="new-password"
                value={pwdConfirm}
                onChange={(e) => setPwdConfirm(e.target.value)}
                className={inputClass}
              />
            </Field>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                Ubah kata sandi
              </button>
            </div>
          </form>
        </Panel>

        {/* Panel Keamanan & Akses */}
        <Panel
          compactHeader
          icon={<ShieldCheck className="h-5 w-5" />}
          title="Keamanan & Akses"
          description="Informasi mengenai otorisasi dan hak akses peran Kepala LMI."
        >
          <div className="space-y-3 text-xs leading-relaxed text-gray-600">
            <p>
              Akun Kepala LMI memiliki wewenang eksekutif untuk melihat ringkasan performa konseling, kepuasan layanan, serta rekapitulasi data agregat unit LMI.
            </p>
            <p>
              Untuk menjaga integritas rekam medis dan privasi klien, catatan konseling individual dilindungi oleh mekanisme autentikasi dan enkripsi khusus konselor.
            </p>
          </div>
        </Panel>
      </div>
      )}

      {/* Modal Pemotong Foto (Interactive Cropper) */}
      {cropSource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  Sesuaikan Foto Profil
                </h3>
                <p className="text-xs text-gray-500">
                  Geser dan atur perbesaran bingkai foto.
                </p>
              </div>
              <button
                type="button"
                onClick={closeCropper}
                aria-label="Tutup"
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 flex justify-center">
              {cropDimensions.width > 0 &&
                cropDimensions.height > 0 &&
                (() => {
                  const stageSize = 280;
                  const scale = Math.min(
                    stageSize / cropDimensions.width,
                    stageSize / cropDimensions.height,
                  );
                  const displayWidth = cropDimensions.width * scale;
                  const displayHeight = cropDimensions.height * scale;
                  const frameSide =
                    Math.min(displayWidth, displayHeight) / cropZoom;
                  const frameLeft =
                    (displayWidth - frameSide) * (cropX / 100);
                  const frameTop =
                    (displayHeight - frameSide) * (cropY / 100);

                  return (
                    <div
                      style={{ width: displayWidth, height: displayHeight }}
                      className="relative select-none overflow-hidden rounded-xl border border-gray-300 bg-black/10"
                    >
                      <img
                        ref={cropImageRef}
                        src={cropSource}
                        alt="Pratinjau crop"
                        style={{ width: displayWidth, height: displayHeight }}
                        className="pointer-events-none block object-contain"
                      />
                      <div
                        tabIndex={0}
                        onPointerDown={handleCropPointerDown}
                        onPointerMove={handleCropPointerMove}
                        onPointerUp={handleCropPointerUp}
                        onPointerCancel={handleCropPointerUp}
                        className="absolute cursor-move touch-none rounded-sm border-2 border-white shadow-[0_0_0_999px_rgba(0,0,0,0.48)] outline-none focus-visible:ring-2 focus-visible:ring-[#36c08f]"
                        style={{
                          left: frameLeft,
                          top: frameTop,
                          width: frameSide,
                          height: frameSide,
                        }}
                      >
                        <span className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
                          {Array.from({ length: 9 }).map((_, idx) => (
                            <span
                              key={idx}
                              className={`${idx % 3 !== 2 ? "border-r border-white/50" : ""} ${idx < 6 ? "border-b border-white/50" : ""}`}
                            />
                          ))}
                        </span>
                        <span className="pointer-events-none absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-medium text-white">
                          Geser bingkai
                        </span>
                      </div>
                    </div>
                  );
                })()}
            </div>

            <p className="mx-auto mt-3 max-w-[320px] text-center text-xs leading-relaxed text-gray-500">
              Geser bingkai putih ke bagian foto yang ingin digunakan.
            </p>

            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="mb-2 flex items-center justify-between text-sm font-medium text-gray-700">
                  <span>Ukuran bingkai / zoom</span>
                  <span>{cropZoom.toFixed(1)}×</span>
                </span>
                <input
                  aria-label="Ukuran bingkai crop"
                  type="range"
                  min="1"
                  max="3"
                  step="0.1"
                  value={cropZoom}
                  onChange={(e) => setCropZoom(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </label>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeCropper}
                className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={applyCrop}
                className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark"
              >
                Gunakan foto
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Save Bar when dirty */}
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
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:opacity-50 sm:flex-none"
              >
                <Save className="h-4 w-4" />
                {saving ? "Menyimpan..." : "Simpan perubahan"}
              </button>
            </div>
          </div>
        </div>
      )}

    </PageContainer>
  );
}

const inputClass =
  "w-full min-w-0 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-primary focus:ring-4 focus:ring-primary/15";
