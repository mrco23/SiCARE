import IconLabel from "../../components/shared/IconLabel";
import {
  PageHeader,
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
import type { ProfileDto } from "../../types/api";
import {
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Camera,
  IdCard,
  LockKeyhole,
  Phone,
  ShieldCheck,
  X,
  KeyRound,
  Save,
} from "lucide-react";
import { EDUCATION_LEVELS } from "../../constants/registerOptions";
import {
  MAX_ADDRESS,
  validateClientProfile,
  type ClientProfile,
  type ClientProfileErrors as Errors,
} from "../../features/client/profile/profileValidation";

const PASSWORD_MIN = 8;

const INITIAL_PROFILE: ClientProfile = {
  phone: "081298765432",
  address: "Jl. Contoh No. 12, Manado",
  occupation: "Mahasiswa",
  education: "SMA/Sederajat",
};

const clone = (v: ClientProfile): ClientProfile =>
  JSON.parse(JSON.stringify(v));

export default function KlienPengaturanPage() {
  const { user, profile: authProfile, refreshProfile } = useAuth();
  const profileKey = `sicare_profile_photo_${authProfile?.id || "client"}`;

  const [saved, setSaved] = useState<ClientProfile>(() => clone(INITIAL_PROFILE));
  const [profile, setProfile] = useState<ClientProfile>(() => clone(INITIAL_PROFILE));

  const authAvatar = (authProfile as Record<string, unknown> | null)?.avatar_url;
  const initialPhoto: string | null = typeof authAvatar === "string" ? authAvatar : null;

  const [photo, setPhoto] = useState<string | null>(initialPhoto);
  const [savedPhoto, setSavedPhoto] = useState<string | null>(initialPhoto);

  const [serverProfile, setServerProfile] = useState<ProfileDto | null>(null);
  const [saving, setSaving] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
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

  const dirty =
    JSON.stringify(profile) !== JSON.stringify(saved) || photo !== savedPhoto;

  const errors = useMemo<Errors>(() => validateClientProfile(profile), [profile]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    sicareApi
      .getProfile()
      .then((data) => {
        if (!active) return;
        setServerProfile(data);
        const next: ClientProfile = {
          phone: data.phone_e164 || INITIAL_PROFILE.phone,
          address: INITIAL_PROFILE.address,
          occupation:
            data.member_category === "faculty_staff"
              ? "Dosen / Staf"
              : data.member_category === "other"
                ? "Umum"
                : "Mahasiswa",
          education: INITIAL_PROFILE.education,
        };
        setSaved(clone(next));
        setProfile(clone(next));
        if (data.avatar_url) {
          setPhoto(data.avatar_url);
          setSavedPhoto(data.avatar_url);
        }
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
  }, []);

  useEffect(() => {
    return () => {
      if (cropSource) URL.revokeObjectURL(cropSource);
    };
  }, [cropSource]);

  function update<K extends keyof ClientProfile>(
    key: K,
    value: ClientProfile[K],
  ) {
    setProfile((prev) => ({ ...prev, [key]: value }));
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
    setPhoto(dataUrl);
    setPhotoError("");
    closeCropper();
  }

  async function saveChanges() {
    if (Object.keys(errors).length) {
      setShowErrors(true);
      toast.error("Periksa kembali isian yang ditandai.");
      return;
    }

    setSaving(true);
    try {
      const cleanedPhone = profile.phone.replace(/[\s()-]/g, "").trim();
      await sicareApi.updateProfile({
        phone_e164: cleanedPhone || null,
      });

      let nextPhotoPath = photo;
      if (photo !== savedPhoto) {
        if (photo && photo.startsWith("data:image/")) {
          const uploadResult = await uploadProfilePhoto(photo);
          nextPhotoPath = uploadResult.storage_path;
        } else if (!photo && savedPhoto) {
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
      setSaved(clone(profile));
      setSavedPhoto(nextPhotoPath);
      setPhoto(nextPhotoPath);
      setShowErrors(false);
      toast.success("Perubahan berhasil disimpan.");
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
    setProfile(clone(saved));
    setPhoto(savedPhoto);
    setShowErrors(false);
    setPhotoError("");
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
      toast.error(issues.join(" "));
      return;
    }
    setPwdCurrent("");
    setPwdNext("");
    setPwdConfirm("");
    toast.success("Perubahan kata sandi disimpan untuk sesi browser ini.");
  }

  const activeProfile = serverProfile ?? authProfile;
  const fullName =
    activeProfile?.full_name?.trim() || "Yusli Ngongano";
  const initials = fullName
    .split(/\s+/)
    .filter((w) => /[A-Za-z]/.test(w[0] ?? ""))
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "K";

  const nim = activeProfile?.identity_code?.trim() || "2210011045";
  const email = user?.email || "yusli@mhs.unikadelasalle.ac.id";
  const memberCategoryLabel =
    activeProfile?.member_category === "faculty_staff"
      ? "Dosen / Staf"
      : activeProfile?.member_category === "other"
        ? "Staff / Umum"
        : "Mahasiswa";

  const photoPreview = getPublicPhotoUrl(photo);

  return (
    <div className="pb-28 text-gray-800">
      <PageHeader
        title="Pengaturan"
        description="Kelola data pribadi, preferensi kontak, dan keamanan akunmu."
      />

      {/* Ringkasan akun (read-only) */}
      <section className="mt-6 flex flex-col gap-5 rounded-2xl border border-gray-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-gray-200 bg-primary text-base font-bold text-white shadow-xs">
            {photoPreview ? (
              <img
                src={photoPreview}
                alt="Foto profil klien"
                className="h-full w-full object-cover"
              />
            ) : (
              <span>{initials}</span>
            )}
            <button
              type="button"
              onClick={() => photoInput.current?.click()}
              aria-label="Ubah foto profil"
              className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition hover:opacity-100"
            >
              <Camera className="h-5 w-5 text-white" />
            </button>
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900">{fullName}</p>
            <p className="text-xs text-gray-500">
              {memberCategoryLabel} · NIM {nim} · {email}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <LockKeyhole className="h-4 w-4" />
          Data akun dikelola admin
          <span className="ml-1 rounded-full bg-primary-soft px-2.5 py-1 font-semibold text-primary">
            Aktif
          </span>
        </div>
      </section>
      {photoError && (
        <p className="mt-2 text-xs font-medium text-red-600">{photoError}</p>
      )}

      {/* Hidden file input */}
      <input
        ref={photoInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handlePhoto}
      />

{loading ? (
        <SkeletonFormGrid className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:gap-6" />
      ) : (
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:gap-6">
        {/* Data pribadi dan akademik (read-only) */}
        <Panel
          icon={<IdCard className="h-5 w-5" />}
          title="Data Pribadi & Akademik"
          description="Data registrasi dan informasi akademik sesuai data kampus. Hubungi admin jika ada data yang perlu diubah."
        >
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ReadonlyField label="Nama lengkap" value={fullName} />
            <ReadonlyField label="NIM / NIP" value={nim} />
            <ReadonlyField label="Kategori anggota" value={memberCategoryLabel} />
            <ReadonlyField label="Status akun" value="Aktif" />
            <ReadonlyField label="Fakultas" value="Teknik" />
            <ReadonlyField label="Program studi" value="Teknik Informatika" />
            <ReadonlyField label="Email kampus" value={email} wide />
          </dl>
        </Panel>

        {/* Kontak & data yang bisa diubah */}
        <Panel
          icon={<Phone className="h-5 w-5" />}
          title="Kontak"
          description="Informasi ini dipakai untuk koordinasi jadwal sesi dengan konselor."
        >
          <div className="flex flex-col gap-5">
            <Field
              label="Nomor telepon (WhatsApp)"
              required
              error={showErrors ? errors.phone : ""}
            >
              <input
                className={inputClass}
                type="tel"
                inputMode="tel"
                value={profile.phone}
                onChange={(e) => update("phone", e.target.value)}
                placeholder="Contoh: 081298765432"
              />
              <p className="mt-1.5 text-[11px] text-gray-400">
                Semua klien menerima konfirmasi booking dan pengingat jadwal konseling via
                WhatsApp ke nomor ini.
              </p>
            </Field>

            <Field
              label="Alamat domisili"
              required
              error={showErrors ? errors.address : ""}
            >
              <textarea
                rows={2}
                maxLength={MAX_ADDRESS}
                className={inputClass}
                value={profile.address}
                onChange={(e) => update("address", e.target.value)}
              />
              <p className="mt-1 text-right text-xs text-gray-500">
                {profile.address.length}/{MAX_ADDRESS}
              </p>
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label="Pekerjaan saat ini"
                required
                error={showErrors ? errors.occupation : ""}
              >
                <input
                  className={inputClass}
                  type="text"
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
            </div>
          </div>
        </Panel>

        {/* Ubah kata sandi */}
        <Panel
          icon={<LockKeyhole className="h-5 w-5" />}
          title="Ubah Kata Sandi"
          description="Gunakan kata sandi yang kuat untuk menjaga keamanan akunmu."
        >
          <div className="flex flex-col gap-4">
            <Field label="Kata sandi saat ini" required>
              <input
                className={inputClass}
                type="password"
                autoComplete="current-password"
                value={pwdCurrent}
                onChange={(e) => setPwdCurrent(e.target.value)}
              />
            </Field>
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
              <IconLabel icon={KeyRound}>Ubah kata sandi</IconLabel>
            </button>
          </div>
        </Panel>

        {/* Privasi & Keamanan Data */}
        <Panel
          icon={<ShieldCheck className="h-5 w-5" />}
          title="Privasi & Perlindungan Data"
          description="Informasi mengenai perlindungan kerahasiaan sesi konseling Anda."
        >
          <div className="space-y-3 text-xs leading-relaxed text-gray-600">
            <p>
              Seluruh rekam konseling dan lembar persetujuan (informed consent) Anda dilindungi dengan standar kerahasiaan konseling universitas.
            </p>
            <p>
              Konselor hanya dapat mengakses catatan konseling Anda selama sesi aktif berlangsung atau melalui autentikasi riwayat terproteksi.
            </p>
          </div>
        </Panel>
      </div>
      )}

      {/* Modal Pemotong Foto */}
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
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"
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

            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="mb-2 flex items-center justify-between text-sm font-medium text-gray-700">
                  <span>Ukuran bingkai / zoom</span>
                  <span>{cropZoom.toFixed(1)}×</span>
                </span>
                <input
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
                className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                <IconLabel icon={X}>Batal</IconLabel>
              </button>
              <button
                type="button"
                onClick={applyCrop}
                className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark"
              >
                Gunakan foto
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Save Bar */}
      {dirty && (
        <div className="fixed inset-x-0 bottom-4 z-20 px-4 lg:left-64">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 rounded-2xl border border-gray-200 bg-white/95 p-4 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-semibold">
              Ada perubahan yang belum disimpan.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={discardChanges}
                className="inline-flex flex-1 items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 sm:flex-none disabled:opacity-50"
              >
                <IconLabel icon={X}>Batalkan</IconLabel>
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveChanges()}
                className="inline-flex flex-1 items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark sm:flex-none disabled:opacity-50"
              >
                <IconLabel icon={Save}>{saving ? "Menyimpan..." : "Simpan perubahan"}</IconLabel>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

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
