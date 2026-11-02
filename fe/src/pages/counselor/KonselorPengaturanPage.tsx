import { PageContainer, PageHeader } from "../../components/shared";
import { SettingsField as Field, SettingsPanel as Panel, SettingsSwitchRow as SwitchRow } from "../../components/counselor/settings/SettingsPrimitives";
import { useAuth } from "../../features/auth/useAuth";
import { counselorApi } from "../../lib/counselorApi";
import { sicareApi } from "../../lib/sicareApi";
import {
  uploadProfilePhoto,
  deleteProfilePhoto,
  getPublicPhotoUrl,
  validatePhotoFile,
} from "../../lib/profilePhotoStorage";
import { getInitials } from "../../lib/avatarUtils";
import {
  cloneCounselorProfile as clone,
  MAX_COUNSELOR_BIO_LENGTH as MAX_BIO,
  MAX_COUNSELOR_TOPIC_LENGTH as MAX_TOPIC_LEN,
  MAX_COUNSELOR_TOPICS as MAX_TOPICS,
  MIN_ACCOUNT_PASSWORD_LENGTH as PASSWORD_MIN,
  validateCounselorProfile,
} from "../../features/counselor/profile/profileValidation";
import type {
  CounselorEducation as Education,
  CounselorProfile as Profile,
  CounselorProfileErrors as Errors,
} from "../../types/counselorProfile";
import {
  type ChangeEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Camera,
  CheckCircle2,
  GraduationCap,
  Layers3,
  LockKeyhole,
  Plus,
  Save,
  UserRound,
  X,
  Pencil,
  Trash2,
} from "lucide-react";

const EMPTY_COUNSELOR_PROFILE: Profile = {
  photo: null,
  displayName: "",
  headline: "",
  bio: "",
  topics: [],
  experienceStartYear: String(new Date().getFullYear()),
  phone: "",
  educations: [],
  services: { individual: true, group: true },
};

export default function KonselorPengaturanPage() {
  const currentYear = new Date().getFullYear();
  const { user, profile: authProfile, refreshProfile } = useAuth();
  const profileKey = `sicare_profile_photo_${authProfile?.id || "counselor"}`;

  const [saved, setSaved] = useState<Profile>(() => {
    const authAvatar = (authProfile as Record<string, unknown> | null)?.avatar_url || (authProfile as Record<string, unknown> | null)?.photo_path;
    const initialPhoto = typeof authAvatar === "string" ? authAvatar : null;
    return {
      ...EMPTY_COUNSELOR_PROFILE,
      photo: initialPhoto,
      displayName: authProfile?.full_name || "",
      experienceStartYear: String(currentYear),
    };
  });

  const [profile, setProfile] = useState<Profile>(() => clone(saved));
  const [historyPasswordConfigured, setHistoryPasswordConfigured] = useState<boolean>(false);
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
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

  // Topics & Education states
  const [topicInput, setTopicInput] = useState("");
  const [eduDraft, setEduDraft] = useState<Education | undefined>(undefined);
  const [eduError, setEduError] = useState("");

  // Password tab state
  const [passwordKind, setPasswordKind] = useState<"akun" | "riwayat">("akun");
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdCurrent, setPwdCurrent] = useState("");
  const [pwdNext, setPwdNext] = useState("");
  const [pwdConfirm, setPwdConfirm] = useState("");

  const photoInput = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = JSON.stringify(profile) !== JSON.stringify(saved);

  // Load from backend on mount
  useEffect(() => {
    let active = true;
    Promise.all([
      counselorApi.getProfile().catch(() => null),
      sicareApi.getProfile().catch(() => null),
      counselorApi.getHistoryPasswordStatus().catch(() => ({ configured: false })),
    ]).then(([couns, me, historyStatus]) => {
      if (!active) return;
      if (historyStatus) {
        setHistoryPasswordConfigured(historyStatus.configured);
      }
      setSaved((prev) => {
        const next: Profile = {
          ...prev,
          displayName: couns?.public_name || me?.full_name || prev.displayName,
          headline: couns?.headline || prev.headline,
          bio: couns?.bio || prev.bio,
          topics: couns?.specialties && couns.specialties.length > 0 ? couns.specialties : prev.topics,
          experienceStartYear: couns?.years_experience
            ? String(currentYear - couns.years_experience)
            : prev.experienceStartYear,
          photo: couns?.photo_path || (me as Record<string, unknown> | null)?.avatar_url as string || prev.photo,
          phone: me?.phone_e164 || prev.phone,
        };
        setProfile(clone(next));
        return next;
      });
    });

    return () => {
      active = false;
    };
  }, [currentYear]);

  const errors = useMemo<Errors>(
    () => validateCounselorProfile(profile, currentYear),
    [profile, currentYear],
  );

  useEffect(() => {
    if (!toast) return;
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3000);
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [toast]);

  function update<K extends keyof Profile>(key: K, value: Profile[K]) {
    setProfile((prev) => ({ ...prev, [key]: value }));
  }

  function updateToggle(group: "services", key: string, value: boolean) {
    setProfile(
      (prev) =>
        ({ ...prev, [group]: { ...prev[group], [key]: value } }) as Profile,
    );
  }

  function closeCropper() {
    if (cropSource) URL.revokeObjectURL(cropSource);
    setCropSource(null);
    setCropDimensions({ width: 0, height: 0 });
    setCropZoom(1);
    setCropX(50);
    setCropY(50);
  }

  async function handlePhoto(event: ChangeEvent<HTMLInputElement>) {
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

  function handleCropPointerDown(event: React.PointerEvent<HTMLDivElement>) {
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

  function handleCropPointerMove(event: React.PointerEvent<HTMLDivElement>) {
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

  function handleCropPointerUp(event: React.PointerEvent<HTMLDivElement>) {
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
    update("photo", dataUrl);
    setPhotoError("");
    closeCropper();
  }

  function handleDeletePhoto() {
    update("photo", null);
    setToast("Foto profil ditandai untuk dihapus. Klik Simpan perubahan.");
  }

  function addTopic() {
    const raw = topicInput.trim();
    if (!raw) return;
    if (profile.topics.length >= MAX_TOPICS) {
      setToast(`Maksimal ${MAX_TOPICS} topik keahlian.`);
      return;
    }
    if (profile.topics.some((t) => t.toLowerCase() === raw.toLowerCase())) {
      setToast("Topik tersebut sudah ada.");
      return;
    }
    update("topics", [...profile.topics, raw]);
    setTopicInput("");
  }

  function removeTopic(topic: string) {
    update(
      "topics",
      profile.topics.filter((t) => t !== topic),
    );
  }

  function openEduDraft(draft?: Education) {
    setEduDraft(
      draft ?? {
        id: Date.now(),
        school: "",
        major: "",
        year: String(currentYear),
      },
    );
    setEduError("");
  }

  function saveEdu() {
    if (!eduDraft) return;
    if (!eduDraft.major.trim()) {
      setEduError("Program studi wajib diisi.");
      return;
    }
    if (!eduDraft.school.trim()) {
      setEduError("Nama perguruan tinggi wajib diisi.");
      return;
    }
    const y = Number(eduDraft.year);
    if (!y || y < 1950 || y > currentYear + 10) {
      setEduError(`Tahun kelulusan tidak valid (1950–${currentYear + 10}).`);
      return;
    }
    const exists = profile.educations.some((e) => e.id === eduDraft.id);
    const updated = exists
      ? profile.educations.map((e) => (e.id === eduDraft.id ? eduDraft : e))
      : [...profile.educations, eduDraft];
    update("educations", updated);
    setEduDraft(undefined);
  }

  function removeEdu(id: number) {
    update(
      "educations",
      profile.educations.filter((e) => e.id !== id),
    );
  }

  async function saveChanges() {
    if (Object.keys(errors).length) {
      setShowErrors(true);
      setToast("Periksa kembali isian yang ditandai.");
      return;
    }

    setSaving(true);
    try {
      const expYears = Math.max(
        0,
        currentYear - (Number(profile.experienceStartYear) || currentYear),
      );
      const cleanedPhone = profile.phone.replace(/[\s()-]/g, "").trim();

      let nextPhotoPath = profile.photo;
      if (profile.photo !== saved.photo) {
        if (profile.photo && profile.photo.startsWith("data:image/")) {
          const uploadResult = await uploadProfilePhoto(profile.photo);
          nextPhotoPath = uploadResult.storage_path;
        } else if (!profile.photo && saved.photo) {
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

      // Update backend profile
      await Promise.all([
        counselorApi
          .updateProfile({
            public_name: profile.displayName.trim(),
            headline: profile.headline?.trim() || null,
            bio: profile.bio.trim() || null,
            specialties: profile.topics,
            years_experience: expYears,
            photo_path: nextPhotoPath,
          })
          .catch(() => null),
        sicareApi
          .updateProfile({
            full_name: profile.displayName.trim(),
            phone_e164: cleanedPhone || null,
          })
          .catch(() => null),
      ]);

      await refreshProfile().catch(() => null);
      const nextSaved: Profile = {
        ...clone(profile),
        photo: nextPhotoPath,
      };
      setSaved(nextSaved);
      setProfile(nextSaved);
      setShowErrors(false);
      setToast("Perubahan profil berhasil disimpan.");
    } catch (err) {
      setToast(
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
    setShowErrors(false);
    setPhotoError("");
  }

  function switchPasswordKind(kind: "akun" | "riwayat") {
    setPasswordKind(kind);
    setPwdCurrent("");
    setPwdNext("");
    setPwdConfirm("");
  }

  async function changePassword() {
    if (pwdSaving) return;
    const minimumLength = passwordKind === "riwayat" ? 4 : PASSWORD_MIN;

    if (passwordKind === "riwayat" && !historyPasswordConfigured) {
      if (pwdNext.length < minimumLength) {
        setToast(`Kata sandi riwayat baru minimal ${minimumLength} karakter.`);
        return;
      }
      if (pwdConfirm !== pwdNext) {
        setToast("Konfirmasi kata sandi riwayat tidak sama.");
        return;
      }

      setPwdSaving(true);
      try {
        const res = await counselorApi.initHistoryPassword(pwdNext);
        if (res.success) {
          setHistoryPasswordConfigured(true);
          setPwdCurrent("");
          setPwdNext("");
          setPwdConfirm("");
          setToast("Kata sandi riwayat konseling berhasil disimpan di database.");
        } else {
          setToast(res.message || "Gagal mengatur kata sandi riwayat.");
        }
      } catch (err: unknown) {
        setToast(err instanceof Error ? err.message : "Gagal mengatur kata sandi riwayat pada server.");
      } finally {
        setPwdSaving(false);
      }
      return;
    }

    const issues = [
      !pwdCurrent ? "Masukkan kata sandi saat ini." : "",
      pwdNext.length < minimumLength
        ? `Kata sandi baru minimal ${minimumLength} karakter.`
        : "",
      pwdConfirm !== pwdNext ? "Konfirmasi kata sandi tidak sama." : "",
    ].filter(Boolean);
    if (issues.length) {
      setToast(issues.join(" "));
      return;
    }

    if (passwordKind === "akun") {
      setPwdCurrent("");
      setPwdNext("");
      setPwdConfirm("");
      setToast("Permintaan ubah kata sandi akun diterima.");
      return;
    }

    setPwdSaving(true);
    try {
      const res = await counselorApi.changeHistoryPassword({
        current_password: pwdCurrent,
        new_password: pwdNext,
        confirm_password: pwdConfirm,
      });
      if (res.success) {
        setPwdCurrent("");
        setPwdNext("");
        setPwdConfirm("");
        setToast("Kata sandi riwayat berhasil diperbarui di database.");
      } else {
        setToast(res.message || "Kata sandi riwayat saat ini salah.");
      }
    } catch (err: unknown) {
      setToast(err instanceof Error ? err.message : "Perubahan kata sandi riwayat gagal pada server.");
    } finally {
      setPwdSaving(false);
    }
  }

  const validExperience =
    /^\d{4}$/.test(profile.experienceStartYear) &&
    Number(profile.experienceStartYear) >= 1950 &&
    Number(profile.experienceStartYear) <= currentYear;

  const initials = getInitials(profile.displayName || "Konselor");
  const photoPreview = getPublicPhotoUrl(profile.photo);

  return (
    <PageContainer role="counselor" spacing="none">
      <PageHeader
        title="Pengaturan"
        description="Kelola profil publik, keahlian, dan preferensi layananmu. Perubahan profil akan tampil di direktori konselor."
      />

      {/* Top Banner Akun */}
      <section className="mt-6 flex flex-col gap-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-gray-200 bg-[#f3faf5] text-primary shadow-xs">
            {photoPreview ? (
              <img
                src={photoPreview}
                alt="Foto profil konselor"
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="font-bold text-white bg-primary h-full w-full flex items-center justify-center text-base">
                {initials}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900">{profile.displayName}</p>
            <p className="text-xs text-gray-500">
              Konselor · {authProfile?.identity_code ? `NIP ${authProfile.identity_code}` : "SiCARE LMI"} · {user?.email || "konselor@unikadelasalle.ac.id"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <LockKeyhole className="h-4 w-4" />
          Status akun
          <span className="ml-1 rounded-full bg-primary-soft px-2.5 py-1 font-semibold text-primary">
            Aktif
          </span>
        </div>
      </section>

      {/* Grid Pengaturan */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:gap-6">
        {/* Panel Foto Profil */}
        <Panel
          icon={<Camera className="h-5 w-5" />}
          title="Foto Profil"
          description="Foto ditampilkan dalam rasio 1:1 di direktori konselor."
        >
          <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
            <div className="aspect-square w-40 shrink-0 overflow-hidden rounded-xl border border-gray-200 bg-primary-tint">
              {photoPreview ? (
                <img
                  src={photoPreview}
                  alt="Foto profil konselor"
                  className="h-full w-full object-cover object-top"
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
                Unggah foto
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
                JPG, PNG, atau WEBP. Maksimal 2 MB. Foto dipotong otomatis menjadi persegi.
              </p>
              {photoError && (
                <p className="text-xs text-red-600">{photoError}</p>
              )}
            </div>
          </div>
        </Panel>

        {/* Panel Profil Publik */}
        <Panel
          icon={<UserRound className="h-5 w-5" />}
          title="Profil Publik"
          description="Informasi yang dilihat klien sebelum memilih konselor."
        >
          <div className="flex flex-col gap-5">
            <Field
              label="Nama tampil & gelar"
              required
              error={showErrors ? errors.displayName : ""}
            >
              <input
                className="w-full min-w-0 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-primary focus:ring-4 focus:ring-primary/15"
                value={profile.displayName}
                onChange={(e) => update("displayName", e.target.value)}
                placeholder="Contoh: Giovanna Yudi, M.Psi"
              />
            </Field>

            <Field label="Headline profesi">
              <input
                className="w-full min-w-0 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-primary focus:ring-4 focus:ring-primary/15"
                value={profile.headline || ""}
                onChange={(e) => update("headline", e.target.value)}
                placeholder="Contoh: Psikolog Klinis & Konselor Mahasiswa"
              />
            </Field>

            <Field
              label="Tahun mulai praktik"
              required
              error={showErrors ? errors.experience : ""}
            >
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="1950"
                  max={currentYear}
                  className="w-36 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-primary focus:ring-4 focus:ring-primary/15"
                  value={profile.experienceStartYear}
                  onChange={(e) => update("experienceStartYear", e.target.value)}
                  placeholder="Contoh: 2018"
                />
                <span className="text-xs text-gray-500">
                  {validExperience
                    ? `${currentYear - Number(profile.experienceStartYear)} tahun pengalaman`
                    : "Masukkan tahun 4 digit"}
                </span>
              </div>
            </Field>

            <Field
              label="Topik keahlian"
              required
              error={showErrors ? errors.topics : ""}
            >
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {profile.topics.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-700"
                    >
                      {t}
                      <button
                        type="button"
                        onClick={() => removeTopic(t)}
                        className="rounded-full p-0.5 hover:bg-gray-200"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
                {profile.topics.length < MAX_TOPICS && (
                  <div className="flex gap-2">
                    <input
                      value={topicInput}
                      maxLength={MAX_TOPIC_LEN}
                      onChange={(e) => setTopicInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addTopic();
                        }
                      }}
                      placeholder="Tambah topik (mis. Manajemen Stres)"
                      className="w-full min-w-0 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-primary focus:ring-2 focus:ring-primary/15"
                    />
                    <button
                      type="button"
                      onClick={addTopic}
                      className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      Tambah
                    </button>
                  </div>
                )}
              </div>
            </Field>

            <Field
              label="Bio ringkas"
              error={showErrors ? errors.bio : ""}
            >
              <div className="relative">
                <textarea
                  rows={3}
                  maxLength={MAX_BIO}
                  value={profile.bio}
                  onChange={(e) => update("bio", e.target.value)}
                  placeholder="Tuliskan pendekatan konseling dan fokus layanan Anda."
                  className="w-full min-w-0 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-primary focus:ring-4 focus:ring-primary/15"
                />
                <span className="mt-1 block text-right text-xs text-gray-400">
                  {profile.bio.length}/{MAX_BIO}
                </span>
              </div>
            </Field>
          </div>
        </Panel>

        {/* Panel Layanan Konseling */}
        <Panel
          icon={<Layers3 className="h-5 w-5" />}
          title="Layanan Konseling"
          description="Tentukan jenis layanan konseling yang Anda sediakan untuk klien."
        >
          <div className="space-y-4">
            <SwitchRow
              title="Konseling Individu"
              description="Pendampingan tatap muka satu lawan satu dengan klien."
              checked={profile.services.individual}
              onChange={(v) => updateToggle("services", "individual", v)}
            />
            <SwitchRow
              title="Konseling Kelompok"
              description="Sesi kelompok tematik terstruktur untuk beberapa peserta."
              checked={profile.services.group}
              onChange={(v) => updateToggle("services", "group", v)}
            />
            {showErrors && errors.services && (
              <p className="text-xs text-red-600">{errors.services}</p>
            )}
          </div>
        </Panel>

        {/* Panel Riwayat Pendidikan */}
        <Panel
          icon={<GraduationCap className="h-5 w-5" />}
          title="Riwayat Pendidikan"
          description="Pendidikan formal yang mendukung kredensial profesional Anda."
          action={
            <button
              type="button"
              onClick={() => openEduDraft()}
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              <Plus className="h-3.5 w-3.5" />
              Tambah
            </button>
          }
        >
          <div className="space-y-3">
            {profile.educations.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50/70 p-3 text-xs"
              >
                <div>
                  <p className="font-bold text-gray-900">
                    {item.major}
                  </p>
                  <p className="text-gray-500">
                    {item.school} ({item.year})
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openEduDraft(item)}
                    className="rounded-lg p-1 text-gray-400 hover:text-gray-700"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeEdu(item.id)}
                    className="rounded-lg p-1 text-gray-400 hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}

            {profile.educations.length === 0 && (
              <p className="text-xs text-gray-400">
                Belum ada riwayat pendidikan yang ditambahkan.
              </p>
            )}
          </div>
        </Panel>

        {/* Panel Keamanan & Kata Sandi */}
        <Panel
          icon={<LockKeyhole className="h-5 w-5" />}
          title="Keamanan & Kata Sandi"
          description="Kelola kata sandi akun SiCARE atau kata sandi proteksi riwayat konseling."
        >
          <div className="space-y-4">
            <div className="flex rounded-xl border border-gray-200 bg-gray-50 p-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => switchPasswordKind("akun")}
                className={`flex-1 rounded-lg py-1.5 transition ${
                  passwordKind === "akun"
                    ? "bg-white text-gray-900 shadow-xs"
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                Kata Sandi Akun
              </button>
              <button
                type="button"
                onClick={() => switchPasswordKind("riwayat")}
                className={`flex-1 rounded-lg py-1.5 transition ${
                  passwordKind === "riwayat"
                    ? "bg-white text-gray-900 shadow-xs"
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                Sandi Riwayat (PIN)
              </button>
            </div>

            <p className="text-xs text-gray-500">
              {passwordKind === "akun"
                ? "Kata sandi yang digunakan saat login ke aplikasi SiCARE."
                : historyPasswordConfigured
                ? "PIN khusus tersimpan di database untuk membuka akses halaman riwayat dan catatan rekam medis konseling."
                : "PIN khusus minimal 4 karakter untuk melindungi rekam medis konseling. Belum dikonfigurasi di database."}
            </p>

            <div className="space-y-3">
              {(passwordKind === "akun" || historyPasswordConfigured) && (
                <Field
                  label={passwordKind === "akun" ? "Kata sandi akun saat ini" : "PIN riwayat saat ini"}
                  required
                >
                  <input
                    type="password"
                    value={pwdCurrent}
                    onChange={(e) => setPwdCurrent(e.target.value)}
                    placeholder={passwordKind === "riwayat" ? "Masukkan PIN riwayat saat ini" : "Masukkan kata sandi"}
                    className="w-full min-w-0 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm text-gray-800 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15"
                  />
                </Field>
              )}

              <Field
                label={passwordKind === "akun" ? "Kata sandi baru" : historyPasswordConfigured ? "PIN riwayat baru" : "PIN riwayat baru (min. 4 karakter)"}
                required
              >
                <input
                  type="password"
                  value={pwdNext}
                  onChange={(e) => setPwdNext(e.target.value)}
                  placeholder={passwordKind === "riwayat" ? "Minimal 4 karakter" : "Minimal 8 karakter"}
                  className="w-full min-w-0 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm text-gray-800 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15"
                />
              </Field>

              <Field
                label={passwordKind === "akun" ? "Ulangi kata sandi baru" : "Ulangi PIN baru"}
                required
              >
                <input
                  type="password"
                  value={pwdConfirm}
                  onChange={(e) => setPwdConfirm(e.target.value)}
                  className="w-full min-w-0 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm text-gray-800 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15"
                />
              </Field>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                disabled={pwdSaving}
                onClick={changePassword}
                className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
              >
                {pwdSaving
                  ? "Memproses..."
                  : passwordKind === "akun"
                  ? "Ubah kata sandi"
                  : historyPasswordConfigured
                  ? "Ubah PIN riwayat"
                  : "Simpan PIN riwayat"}
              </button>
            </div>
          </div>
        </Panel>
      </div>

      {/* Modal Tambah/Edit Riwayat Pendidikan */}
      {eduDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-base font-bold text-gray-900">
              Riwayat Pendidikan
            </h3>
            <div className="mt-4 space-y-3">
              <Field label="Program Studi / Gelar" required>
                <input
                  value={eduDraft.major}
                  onChange={(e) =>
                    setEduDraft({ ...eduDraft, major: e.target.value })
                  }
                  placeholder="Contoh: Sarjana Psikologi"
                  className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm text-gray-800 outline-none focus:border-primary"
                />
              </Field>

              <Field label="Perguruan Tinggi" required>
                <input
                  value={eduDraft.school}
                  onChange={(e) =>
                    setEduDraft({ ...eduDraft, school: e.target.value })
                  }
                  placeholder="Contoh: Universitas Surabaya"
                  className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm text-gray-800 outline-none focus:border-primary"
                />
              </Field>

              <Field label="Tahun Kelulusan" required>
                <input
                  type="number"
                  value={eduDraft.year}
                  onChange={(e) =>
                    setEduDraft({ ...eduDraft, year: e.target.value })
                  }
                  className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm text-gray-800 outline-none focus:border-primary"
                />
              </Field>

              {eduError && (
                <p className="text-xs text-red-600">{eduError}</p>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEduDraft(undefined)}
                className="rounded-xl border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={saveEdu}
                className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary-dark"
              >
                Simpan
              </button>
            </div>
          </div>
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
                Batal
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
              Ada perubahan profil yang belum disimpan.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={discardChanges}
                className="inline-flex flex-1 items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 sm:flex-none"
              >
                Batalkan
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveChanges()}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50 sm:flex-none"
              >
                <Save className="h-4 w-4" />
                {saving ? "Menyimpan..." : "Simpan perubahan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          className="pointer-events-none fixed left-1/2 top-20 z-50 flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-lg"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{toast}</span>
        </div>
      )}
    </PageContainer>
  );
}
