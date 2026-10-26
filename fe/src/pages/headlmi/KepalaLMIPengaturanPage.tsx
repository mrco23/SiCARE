import { PageContainer, PageHeader } from "../../components/shared";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  Camera,
  CheckCircle2,
  KeyRound,
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
  photo: "/gio.jpeg",
  displayName: "Kepala LMI",
  email: "kepala.lmi@kampus.ac.id",
  phone: "",
};

const PASSWORD_MIN = 8;
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

function cloneProfile(profile: Profile): Profile {
  return { ...profile };
}

export default function KepalaLMIPengaturanPage() {
  const [savedProfile, setSavedProfile] = useState<Profile>(() =>
    cloneProfile(INITIAL_PROFILE),
  );
  const [profile, setProfile] = useState<Profile>(() =>
    cloneProfile(INITIAL_PROFILE),
  );
  const [showErrors, setShowErrors] = useState(false);
  const [toast, setToast] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [cropSource, setCropSource] = useState<string | null>(null);
  const [cropDimensions, setCropDimensions] = useState({ width: 0, height: 0 });
  const [cropZoom, setCropZoom] = useState(1);
  const [cropX, setCropX] = useState(50);
  const [cropY, setCropY] = useState(50);
  const [pwdCurrent, setPwdCurrent] = useState("");
  const [pwdNext, setPwdNext] = useState("");
  const [pwdConfirm, setPwdConfirm] = useState("");
  const photoInput = useRef<HTMLInputElement>(null);
  const cropImageRef = useRef<HTMLImageElement>(null);
  const cropDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startCropX: number;
    startCropY: number;
  } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dirty = JSON.stringify(profile) !== JSON.stringify(savedProfile);

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
    if (phone && !/^(\+62|62|0)[0-9]{8,13}$/.test(phone)) {
      result.phone = "Format nomor telepon tidak valid.";
    }

    return result;
  }, [profile]);

  useEffect(() => {
    if (!toast) return;

    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3000);

    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [toast]);

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

    if (!PHOTO_TYPES.includes(file.type)) {
      setPhotoError("Format harus JPG, PNG, atau WEBP.");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setPhotoError("Ukuran foto maksimal 2 MB.");
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
    updateProfile("photo", canvas.toDataURL("image/jpeg", 0.9));
    setPhotoError("");
    closeCropper();
  }

  function saveChanges() {
    if (Object.keys(errors).length > 0) {
      setShowErrors(true);
      setToast("Periksa kembali isian yang ditandai.");
      return;
    }

    // Integrasi produksi: simpan profil melalui endpoint backend.
    setSavedProfile(cloneProfile(profile));
    setShowErrors(false);
    setToast(
      "Simulasi frontend: perubahan profil siap disimpan, tetapi belum dikirim ke server.",
    );
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
      setToast(issues.join(" "));
      return;
    }

    // Integrasi produksi: validasi dan ubah kata sandi melalui backend.
    setPwdCurrent("");
    setPwdNext("");
    setPwdConfirm("");
    setToast(
      "Validasi frontend berhasil. Hubungkan backend untuk mengubah kata sandi secara nyata.",
    );
  }

  return (
    <PageContainer role="headlmi" spacing="none" className="text-gray-800">
      <PageHeader
        title="Pengaturan"
        description="Kelola foto profil, informasi akun, dan keamanan Kepala LMI."
      />

      <section className="mt-6 flex flex-col gap-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-gray-200 bg-[#f3faf5] text-primary">
            {profile.photo ? (
              <img
                src={profile.photo}
                alt="Foto profil Kepala LMI"
                className="h-full w-full object-cover"
              />
            ) : (
              <UserRound className="h-7 w-7" />
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

      <div className="mt-6 grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-2 lg:gap-6">
        <Panel
          icon={<Camera className="h-5 w-5" />}
          title="Foto Profil"
          description="Foto ditampilkan dalam rasio 1:1. Geser bingkai untuk memilih bagian foto."
        >
          <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
            <div className="aspect-square w-40 shrink-0 overflow-hidden rounded-xl border border-gray-200 bg-primary-tint">
              {profile.photo ? (
                <img
                  src={profile.photo}
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
                className="inline-flex items-center justify-center gap-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark"
                onClick={() => photoInput.current?.click()}
              >
                <Camera className="h-4 w-4" />
                Unggah foto
              </button>
              {profile.photo && (
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-red-300 hover:bg-gray-50 hover:text-red-600"
                  onClick={() => {
                    updateProfile("photo", null);
                    setPhotoError("");
                  }}
                >
                  Hapus foto
                </button>
              )}
              <p className="text-xs leading-relaxed text-gray-500">
                JPG, PNG, atau WEBP. Maksimal 2 MB. Foto akan dipotong menjadi
                persegi 512 × 512 piksel.
              </p>
              {photoError && (
                <p role="alert" className="text-xs text-red-600">
                  {photoError}
                </p>
              )}
            </div>
          </div>
        </Panel>

        <Panel
          icon={<UserRound className="h-5 w-5" />}
          title="Informasi Akun"
          description="Perbarui nama tampilan, email, dan nomor kontak akun Kepala LMI."
        >
          <div className="flex flex-col gap-5">
            <Field
              label="Nama lengkap"
              required
              error={showErrors ? errors.displayName : ""}
            >
              <input
                autoComplete="name"
                value={profile.displayName}
                onChange={(event) =>
                  updateProfile("displayName", event.target.value)
                }
                placeholder="Masukkan nama lengkap"
                className={inputClass}
              />
            </Field>

            <Field
              label="Email"
              required
              error={showErrors ? errors.email : ""}
            >
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  autoComplete="email"
                  value={profile.email}
                  onChange={(event) =>
                    updateProfile("email", event.target.value)
                  }
                  placeholder="nama@contoh.com"
                  className={`${inputClass} pl-10`}
                />
              </div>
            </Field>

            <Field label="Nomor telepon" error={showErrors ? errors.phone : ""}>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={profile.phone}
                  onChange={(event) =>
                    updateProfile("phone", event.target.value)
                  }
                  placeholder="Contoh: 081234567890"
                  className={`${inputClass} pl-10`}
                />
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-gray-500">
                Nomor telepon bersifat opsional.
              </p>
            </Field>
          </div>
        </Panel>

        <Panel
          className="lg:col-span-2"
          icon={<ShieldCheck className="h-5 w-5" />}
          title="Keamanan Akun"
          description="Gunakan kata sandi yang kuat untuk melindungi akun."
        >
          <form onSubmit={changePassword} className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label="Kata sandi saat ini" required>
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={pwdCurrent}
                    onChange={(event) => setPwdCurrent(event.target.value)}
                    placeholder="Masukkan kata sandi saat ini"
                    className={inputClass}
                  />
                </Field>
              </div>

              <Field label="Kata sandi baru" required>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={pwdNext}
                  onChange={(event) => setPwdNext(event.target.value)}
                  placeholder="Minimal 8 karakter"
                  className={inputClass}
                />
                <p className="mt-1.5 text-xs text-gray-500">
                  Minimal {PASSWORD_MIN} karakter.
                </p>
              </Field>

              <Field label="Ulangi kata sandi baru" required>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={pwdConfirm}
                  onChange={(event) => setPwdConfirm(event.target.value)}
                  placeholder="Masukkan ulang kata sandi baru"
                  className={inputClass}
                />
              </Field>
            </div>

            <div className="flex justify-end border-t border-gray-100 pt-4">
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark sm:w-auto"
              >
                <KeyRound className="h-4 w-4" />
                Ubah kata sandi
              </button>
            </div>
            <p className="text-xs leading-relaxed text-gray-500">
              Perubahan kata sandi masih berupa simulasi frontend. Verifikasi
              kata sandi saat ini dan penyimpanan sebenarnya harus dilakukan
              oleh backend.
            </p>
          </form>
        </Panel>

        <Panel
          className="lg:col-span-2"
          icon={<LockKeyhole className="h-5 w-5" />}
          title="Batas Akses"
          description="Ringkasan hak akses pada panel pimpinan."
        >
          <div className="flex items-start gap-3 rounded-xl bg-primary-tint p-4">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <p className="text-sm leading-relaxed text-gray-600">
              Akun Kepala LMI digunakan untuk memantau ringkasan layanan,
              laporan organisasi, dan feedback. Halaman ini tidak menyediakan
              pengelolaan jadwal konseling, penugasan konselor, atau akses ke
              catatan konseling pribadi mahasiswa. Pembatasan akses tetap harus
              diterapkan di backend.
            </p>
          </div>
        </Panel>
      </div>

      {cropSource && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0c2619]/55 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="crop-title"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="crop-title" className="text-lg font-bold text-gray-900">
                  Sesuaikan foto profil
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Atur bagian foto yang ingin ditampilkan dalam bingkai persegi.
                </p>
              </div>
              <button
                type="button"
                aria-label="Tutup crop foto"
                onClick={closeCropper}
                className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mx-auto mt-5 flex aspect-square w-full max-w-[320px] items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-gray-950">
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
                  const frameLeft = (displayWidth - frameSide) * (cropX / 100);
                  const frameTop = (displayHeight - frameSide) * (cropY / 100);

                  return (
                    <div
                      className="relative shrink-0 select-none"
                      style={{ width: displayWidth, height: displayHeight }}
                    >
                      <img
                        ref={cropImageRef}
                        src={cropSource}
                        alt="Pratinjau pemotongan foto"
                        draggable={false}
                        className="pointer-events-none absolute inset-0 h-full w-full select-none object-fill"
                      />
                      <div
                        role="slider"
                        aria-label="Geser bingkai crop foto"
                        aria-valuetext={`Posisi horizontal ${Math.round(cropX)} persen, vertikal ${Math.round(cropY)} persen`}
                        tabIndex={0}
                        onPointerDown={handleCropPointerDown}
                        onPointerMove={handleCropPointerMove}
                        onPointerUp={handleCropPointerUp}
                        onPointerCancel={handleCropPointerUp}
                        onKeyDown={(event) => {
                          const step = event.shiftKey ? 10 : 2;
                          if (event.key === "ArrowLeft") {
                            event.preventDefault();
                            setCropX((value) => Math.max(0, value - step));
                          }
                          if (event.key === "ArrowRight") {
                            event.preventDefault();
                            setCropX((value) => Math.min(100, value + step));
                          }
                          if (event.key === "ArrowUp") {
                            event.preventDefault();
                            setCropY((value) => Math.max(0, value - step));
                          }
                          if (event.key === "ArrowDown") {
                            event.preventDefault();
                            setCropY((value) => Math.min(100, value + step));
                          }
                        }}
                        className="absolute cursor-move touch-none rounded-sm border-2 border-white shadow-[0_0_0_999px_rgba(0,0,0,0.48)] outline-none focus-visible:ring-2 focus-visible:ring-[#36c08f]"
                        style={{
                          left: frameLeft,
                          top: frameTop,
                          width: frameSide,
                          height: frameSide,
                        }}
                      >
                        <span className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
                          {Array.from({ length: 9 }).map((_, index) => (
                            <span
                              key={index}
                              className={`${index % 3 !== 2 ? "border-r border-white/50" : ""} ${index < 6 ? "border-b border-white/50" : ""}`}
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

            <p className="mx-auto mt-2 max-w-[320px] text-center text-xs leading-relaxed text-gray-500">
              Geser bingkai putih ke bagian foto yang ingin digunakan. Kamu juga
              bisa menggesernya dengan tombol panah pada keyboard.
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
                  onChange={(event) => setCropZoom(Number(event.target.value))}
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

      {dirty && (
        <div className="fixed inset-x-0 bottom-4 z-20 px-4 lg:left-64">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 rounded-2xl border border-gray-200 bg-white/95 p-4 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-semibold">
              Ada perubahan profil yang belum disimpan.
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
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark sm:flex-none"
              >
                <Save className="h-4 w-4" />
                Simpan perubahan
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
        Rancangan frontend. Profil dan keamanan akun belum terhubung ke backend.
      </p>
    </PageContainer>
  );
}

const inputClass =
  "w-full min-w-0 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-primary focus:ring-4 focus:ring-primary/15";

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
        <div className="min-w-0">
          <h2 className="text-base font-bold text-gray-900">{title}</h2>
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
    <div className="min-w-0">
      <label className="mb-1.5 block text-sm font-medium text-gray-800">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
    </div>
  );
}
