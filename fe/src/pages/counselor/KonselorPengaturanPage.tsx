import { PageContainer, PageHeader } from "../../components/shared";
import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  BriefcaseBusiness,
  Camera,
  CheckCircle2,
  GraduationCap,
  Layers3,
  LockKeyhole,
  Mail,
  Phone,
  Plus,
  ShieldCheck,
  UserRound,
  X,
  Pencil,
  Trash2,
} from "lucide-react";

type Education = { id: number; school: string; year: string; major: string };
type Profile = {
  photo: string | null;
  displayName: string;
  bio: string;
  experienceStartYear: string;
  educations: Education[];
  topics: string[];
  phone: string;
  services: { individual: boolean; group: boolean };
};
type Errors = Record<string, string>;

const INITIAL: Profile = {
  photo: "/gio.jpeg",
  displayName: "Giovanna Yudi, S.Psi., M.Psi., Psikolog",
  bio: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
  experienceStartYear: "2021",
  educations: [
    {
      id: 1,
      school: "Universitas Surabaya",
      year: "2018",
      major: "Sarjana Psikologi",
    },
    {
      id: 2,
      school: "Universitas Surabaya",
      year: "2021",
      major: "Magister Psikologi Profesi",
    },
  ],
  topics: [
    "Karir",
    "Pengembangan Diri",
    "Motivasi",
    "Stres",
    "Relasi",
    "Keluarga",
  ],
  phone: "081234567890",
  services: { individual: true, group: true },
};
const clone = (v: Profile): Profile => JSON.parse(JSON.stringify(v));
const MAX_TOPICS = 6;
const MAX_TOPIC_LEN = 40;
const MAX_BIO = 500;
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const PHONE_RE = /^(\+62|62|0)[0-9]{8,13}$/;
const PASSWORD_MIN = 8;
const HISTORY_PASSWORD_KEY = "sicare:konselor:riwayat-password-digest";
const HISTORY_ACCESS_KEY = "sicare:konselor:riwayat-access";
const HISTORY_ATTEMPTS_KEY = "sicare:konselor:riwayat-attempts";

// Hanya untuk prototipe frontend. Verifikasi sebenarnya harus dilakukan server.
async function passwordDigest(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export default function KonselorPengaturanPage() {
  const currentYear = new Date().getFullYear();
  const [saved, setSaved] = useState<Profile>(() => clone(INITIAL));
  const [profile, setProfile] = useState<Profile>(() => clone(INITIAL));
  const [showErrors, setShowErrors] = useState(false);
  const [toast, setToast] = useState("");
  const [photoError, setPhotoError] = useState("");
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
  const [topicInput, setTopicInput] = useState("");
  const [eduDraft, setEduDraft] = useState<Education | undefined>(undefined);
  const [eduError, setEduError] = useState("");
  const [passwordKind, setPasswordKind] = useState<"akun" | "riwayat">("akun");
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdCurrent, setPwdCurrent] = useState("");
  const [pwdNext, setPwdNext] = useState("");
  const [pwdConfirm, setPwdConfirm] = useState("");
  const photoInput = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = JSON.stringify(profile) !== JSON.stringify(saved);

  const errors = useMemo<Errors>(() => {
    const e: Errors = {};
    if (!profile.displayName.trim()) e.displayName = "Nama tampil wajib diisi";
    if (profile.bio.length > MAX_BIO) e.bio = `Maksimal ${MAX_BIO} karakter`;
    const y = profile.experienceStartYear.trim();
    if (!/^\d{4}$/.test(y) || Number(y) < 1950 || Number(y) > currentYear)
      e.experience = `Isi tahun mulai berpraktik (1950–${currentYear})`;
    if (!profile.topics.length) e.topics = "Pilih minimal satu topik";
    const phone = profile.phone.replace(/[\s()-]/g, "");
    if (!phone) e.phone = "Nomor telepon wajib diisi";
    else if (!PHONE_RE.test(phone))
      e.phone = "Format nomor telepon tidak valid";
    if (!profile.services.individual && !profile.services.group)
      e.services = "Pilih minimal satu jenis layanan";
    return e;
  }, [profile, currentYear]);

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
    if (cropDragRef.current?.pointerId === event.pointerId)
      cropDragRef.current = null;
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
    update("photo", canvas.toDataURL("image/jpeg", 0.9));
    setPhotoError("");
    closeCropper();
  }
  function addTopic() {
    const topic = topicInput.replace(/\s+/g, " ").replace(/,/g, "").trim();
    if (!topic) return;
    if (topic.length > MAX_TOPIC_LEN) {
      setToast(`Maksimal ${MAX_TOPIC_LEN} karakter per topik.`);
      return;
    }
    if (profile.topics.length >= MAX_TOPICS) {
      setToast(`Maksimal ${MAX_TOPICS} topik.`);
      return;
    }
    if (profile.topics.some((t) => t.toLowerCase() === topic.toLowerCase())) {
      setToast("Topik itu sudah ada.");
      return;
    }
    update("topics", [...profile.topics, topic]);
    setTopicInput("");
  }
  function openEducation(education?: Education) {
    setEduDraft(
      education
        ? { ...education }
        : { id: Date.now(), school: "", year: "", major: "" },
    );
    setEduError("");
  }
  function saveEducation(event: FormEvent) {
    event.preventDefault();
    if (!eduDraft) return;
    const school = eduDraft.school.trim(),
      year = eduDraft.year.trim();
    if (!school || !/^\d{4}$/.test(year)) {
      setEduError("Isi nama institusi dan tahun lulus (4 digit).");
      return;
    }
    const exists = profile.educations.some((e) => e.id === eduDraft.id);
    update(
      "educations",
      exists
        ? profile.educations.map((e) =>
            e.id === eduDraft.id ? { ...eduDraft, school, year } : e,
          )
        : [...profile.educations, { ...eduDraft, school, year }],
    );
    setEduDraft(undefined);
    setEduError("");
  }
  function saveChanges() {
    if (Object.keys(errors).length) {
      setShowErrors(true);
      setToast("Periksa kembali isian yang ditandai.");
      return;
    }
    // Integrasi produksi: PUT /api/konselor/me/profil
    setSaved(clone(profile));
    setShowErrors(false);
    setToast("Perubahan profil berhasil disimpan.");
  }
  function discardChanges() {
    setProfile(clone(saved));
    setShowErrors(false);
    setEduDraft(undefined);
    setEduError("");
    setPhotoError("");
    setTopicInput("");
  }
  function selectPasswordKind(kind: "akun" | "riwayat") {
    setPasswordKind(kind);
    setPwdCurrent("");
    setPwdNext("");
    setPwdConfirm("");
  }

  async function changePassword() {
    if (pwdSaving) return;
    const minimumLength = passwordKind === "riwayat" ? 4 : PASSWORD_MIN;
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
      // Integrasi produksi: PUT /api/konselor/me/password.
      setPwdCurrent("");
      setPwdNext("");
      setPwdConfirm("");
      setToast(
        "Simulasi perubahan kata sandi akun berhasil. Hubungkan ke backend untuk menyimpan secara nyata.",
      );
      return;
    }

    setPwdSaving(true);
    try {
      const currentDigest = await passwordDigest(pwdCurrent);
      const savedDigest = sessionStorage.getItem(HISTORY_PASSWORD_KEY);
      const defaultDigest = await passwordDigest("1234");
      if (currentDigest !== (savedDigest ?? defaultDigest)) {
        setToast("Kata sandi riwayat saat ini salah.");
        return;
      }
      sessionStorage.setItem(
        HISTORY_PASSWORD_KEY,
        await passwordDigest(pwdNext),
      );
      // Paksa verifikasi ulang agar sesi yang memakai password lama tidak berlaku.
      sessionStorage.removeItem(HISTORY_ACCESS_KEY);
      sessionStorage.removeItem(HISTORY_ATTEMPTS_KEY);
      setPwdCurrent("");
      setPwdNext("");
      setPwdConfirm("");
      setToast(
        "Kata sandi riwayat berhasil diubah untuk sesi browser ini. Akses riwayat sebelumnya dicabut.",
      );
    } catch {
      setToast(
        "Perubahan kata sandi gagal. Periksa dukungan penyimpanan browser.",
      );
    } finally {
      setPwdSaving(false);
    }
  }

  const validExperience =
    /^\d{4}$/.test(profile.experienceStartYear) &&
    Number(profile.experienceStartYear) >= 1950 &&
    Number(profile.experienceStartYear) <= currentYear;

  return (
    <PageContainer role="counselor" spacing="none">
      <PageHeader
        title="Pengaturan"
        description="Kelola profil publik, keahlian, dan preferensi layananmu. Perubahan profil akan tampil di halaman konselor."
      />

      <section className="mt-6 flex flex-col gap-5 rounded-2xl border border-gray-200 bg-white p-5 sm:flex-row sm:items-center sm:p-6">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
            GY
          </span>
          <div className="min-w-0">
            <p className="font-semibold">Giovanna Yudi, M.Psi</p>
            <p className="text-xs text-gray-500">
              Konselor · NIP 198705122014 · giovanna@unikadelasalle.ac.id
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

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:gap-6">
        <Panel
          icon={<Camera className="h-5 w-5" />}
          title="Foto Profil"
          description="Foto ditampilkan dalam rasio 1:1 di halaman konselor."
        >
          <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
            <div className="aspect-square w-40 shrink-0 overflow-hidden rounded-xl border border-gray-200 bg-primary-tint">
              {profile.photo ? (
                <img
                  src={profile.photo}
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
                className="inline-flex items-center justify-center gap-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => photoInput.current?.click()}
              >
                Unggah foto
              </button>
              {profile.photo && (
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 hover:border-red-300 hover:text-red-600"
                  onClick={() => {
                    update("photo", null);
                    setPhotoError("");
                  }}
                >
                  Hapus foto
                </button>
              )}
              <p className="text-xs leading-relaxed text-gray-500">
                JPG, PNG, atau WEBP. Maksimal 2 MB. Foto dipotong otomatis di
                tengah menjadi persegi.
              </p>
              {photoError && (
                <p className="text-xs text-red-600">{photoError}</p>
              )}
            </div>
          </div>
        </Panel>

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
                className="w-full min-w-0 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-800 outline-none placeholder:text-gray-500 focus:border-primary focus:ring-4 focus:ring-primary/15 disabled:cursor-not-allowed disabled:bg-gray-100"
                value={profile.displayName}
                onChange={(e) => update("displayName", e.target.value)}
                placeholder="Contoh: Giovanna Yudi, S.Psi., M.Psi., Psikolog"
              />
            </Field>
            <Field
              label="Deskripsi singkat"
              error={showErrors ? errors.bio : ""}
            >
              <textarea
                rows={5}
                className="w-full min-w-0 resize-none rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-800 outline-none placeholder:text-gray-500 focus:border-primary focus:ring-4 focus:ring-primary/15 disabled:cursor-not-allowed disabled:bg-gray-100"
                value={profile.bio}
                onChange={(e) => update("bio", e.target.value)}
              />
              <p className="mt-1 text-right text-xs text-gray-500">
                {profile.bio.length}/{MAX_BIO} karakter
              </p>
            </Field>
            <Field
              label="Tahun mulai berpraktik"
              required
              error={showErrors ? errors.experience : ""}
            >
              <input
                className="w-full min-w-0 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-800 outline-none placeholder:text-gray-500 focus:border-primary focus:ring-4 focus:ring-primary/15 disabled:cursor-not-allowed disabled:bg-gray-100"
                inputMode="numeric"
                maxLength={4}
                value={profile.experienceStartYear}
                onChange={(e) =>
                  update(
                    "experienceStartYear",
                    e.target.value.replace(/\D/g, "").slice(0, 4),
                  )
                }
                placeholder="Contoh: 2021"
              />
              {validExperience && (
                <p className="mt-1.5 text-xs text-gray-500">
                  Tampil di profil publik sebagai “
                  {currentYear - Number(profile.experienceStartYear)} Tahun”
                  (dihitung dari tahun {currentYear}).
                </p>
              )}
            </Field>
          </div>
        </Panel>

        <Panel
          icon={<GraduationCap className="h-5 w-5" />}
          title="Riwayat Pendidikan"
          description="Ditampilkan di profil publik sebagai riwayat pendidikan."
          action={
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-primary transition hover:bg-primary-soft"
              onClick={() => openEducation()}
            >
              <Plus className="h-3.5 w-3.5" /> Tambah
            </button>
          }
        >
          <ul className="space-y-3">
            {profile.educations.length ? (
              profile.educations.map((edu) => (
                <li
                  key={edu.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-gray-200 p-4"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">
                      {edu.school}{" "}
                      <span className="font-normal text-gray-500">
                        · {edu.year}
                      </span>
                    </p>
                    <p className="text-xs text-gray-500">{edu.major || "—"}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      aria-label="Ubah pendidikan"
                      className="rounded-lg p-2 text-gray-500 transition hover:bg-primary-soft hover:text-primary"
                      onClick={() => openEducation(edu)}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="Hapus pendidikan"
                      className="rounded-lg p-2 text-gray-500 transition hover:bg-red-50 hover:text-red-600"
                      onClick={() =>
                        update(
                          "educations",
                          profile.educations.filter((e) => e.id !== edu.id),
                        )
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))
            ) : (
              <li className="rounded-xl border border-dashed border-gray-300 p-4 text-center text-sm text-gray-500">
                Belum ada riwayat pendidikan.
              </li>
            )}
          </ul>
          {eduDraft !== undefined && (
            <form
              className="mt-4 rounded-xl border border-primary/20 bg-primary-tint p-4"
              onSubmit={saveEducation}
            >
              <p className="mb-3 text-sm font-semibold">
                {profile.educations.some((e) => e.id === eduDraft.id)
                  ? "Ubah pendidikan"
                  : "Tambah pendidikan"}
              </p>
              <div className="grid gap-4">
                <Field label="Institusi" required>
                  <input
                    className="w-full min-w-0 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-800 outline-none placeholder:text-gray-500 focus:border-primary focus:ring-4 focus:ring-primary/15 disabled:cursor-not-allowed disabled:bg-gray-100"
                    value={eduDraft.school}
                    onChange={(e) =>
                      setEduDraft({ ...eduDraft, school: e.target.value })
                    }
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Tahun lulus" required>
                    <input
                      className="w-full min-w-0 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-800 outline-none placeholder:text-gray-500 focus:border-primary focus:ring-4 focus:ring-primary/15 disabled:cursor-not-allowed disabled:bg-gray-100"
                      inputMode="numeric"
                      maxLength={4}
                      value={eduDraft.year}
                      onChange={(e) =>
                        setEduDraft({
                          ...eduDraft,
                          year: e.target.value.replace(/\D/g, "").slice(0, 4),
                        })
                      }
                    />
                  </Field>
                  <Field label="Jurusan / gelar">
                    <input
                      className="w-full min-w-0 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-800 outline-none placeholder:text-gray-500 focus:border-primary focus:ring-4 focus:ring-primary/15 disabled:cursor-not-allowed disabled:bg-gray-100"
                      value={eduDraft.major}
                      onChange={(e) =>
                        setEduDraft({ ...eduDraft, major: e.target.value })
                      }
                    />
                  </Field>
                </div>
              </div>
              {eduError && (
                <p className="mt-2 text-xs text-red-600">{eduError}</p>
              )}
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 sm:w-auto"
                  onClick={() => {
                    setEduDraft(undefined);
                    setEduError("");
                  }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  Simpan
                </button>
              </div>
            </form>
          )}
        </Panel>

        <Panel
          icon={<BriefcaseBusiness className="h-5 w-5" />}
          title="Topik Keahlian"
          description={`Ketik topik keahlianmu lalu tekan Enter. Maksimal ${MAX_TOPICS} topik.`}
          action={
            <span className="text-xs font-semibold text-gray-500">
              {profile.topics.length}/{MAX_TOPICS}
            </span>
          }
        >
          <div className="flex flex-wrap gap-2">
            {profile.topics.map((topic, i) => (
              <span
                key={`${topic}-${i}`}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary py-1 pl-3 pr-1.5 text-xs font-semibold text-white sm:text-sm"
              >
                {topic}
                <button
                  type="button"
                  aria-label={`Hapus ${topic}`}
                  className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-white/20"
                  onClick={() =>
                    update(
                      "topics",
                      profile.topics.filter((_, index) => index !== i),
                    )
                  }
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          <form
            className="mt-4 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              addTopic();
            }}
          >
            <input
              className="w-full min-w-0 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-800 outline-none placeholder:text-gray-500 focus:border-primary focus:ring-4 focus:ring-primary/15 disabled:cursor-not-allowed disabled:bg-gray-100 min-w-0"
              value={topicInput}
              maxLength={MAX_TOPIC_LEN}
              disabled={profile.topics.length >= MAX_TOPICS}
              onChange={(e) => setTopicInput(e.target.value)}
              placeholder={
                profile.topics.length >= MAX_TOPICS
                  ? "Batas topik sudah tercapai"
                  : "Ketik topik, lalu tekan Enter"
              }
            />
            <button
              type="submit"
              disabled={profile.topics.length >= MAX_TOPICS}
              className="inline-flex items-center gap-1 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-primary transition hover:bg-primary-soft shrink-0 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" /> Tambah
            </button>
          </form>
          {showErrors && errors.topics && (
            <p className="mt-2 text-xs text-red-600">{errors.topics}</p>
          )}
        </Panel>

        <Panel
          icon={<Phone className="h-5 w-5" />}
          title="Kontak"
          description="Nomor ini hanya dipakai untuk koordinasi sesi."
        >
          <Field
            label="Nomor telepon"
            required
            error={showErrors ? errors.phone : ""}
          >
            <input
              className="w-full min-w-0 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-800 outline-none placeholder:text-gray-500 focus:border-primary focus:ring-4 focus:ring-primary/15 disabled:cursor-not-allowed disabled:bg-gray-100"
              type="tel"
              inputMode="tel"
              value={profile.phone}
              onChange={(e) => update("phone", e.target.value)}
            />
          </Field>
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-gray-50 px-4 py-3 text-xs text-gray-500">
            <Mail className="h-4 w-4 shrink-0" />
            giovanna@unikadelasalle.ac.id (email kampus, diubah oleh admin)
          </div>
        </Panel>

        <Panel
          icon={<Layers3 className="h-5 w-5" />}
          title="Layanan yang Diterima"
          description="Jenis sesi yang ingin kamu tangani."
        >
          <div className="divide-y divide-gray-100">
            <SwitchRow
              title="Konseling Individu"
              description="Sesi satu-satu dengan klien."
              checked={profile.services.individual}
              onChange={(v) => updateToggle("services", "individual", v)}
            />
            <SwitchRow
              title="Konseling Kelompok"
              description="Sesi bersama beberapa peserta dengan permasalahan serupa."
              checked={profile.services.group}
              onChange={(v) => updateToggle("services", "group", v)}
            />
          </div>
          {showErrors && errors.services && (
            <p className="mt-2 text-xs text-red-600">{errors.services}</p>
          )}
        </Panel>

        <Panel
          className="lg:col-span-2"
          icon={<ShieldCheck className="h-5 w-5" />}
          title="Keamanan"
          description="Atur kata sandi akun dan akses riwayat konseling."
        >
          <div
            className="mb-5 inline-flex w-full rounded-xl border border-gray-200 bg-gray-100 p-1 sm:w-auto"
            role="tablist"
            aria-label="Jenis kata sandi"
          >
            <button
              type="button"
              role="tab"
              aria-selected={passwordKind === "akun"}
              onClick={() => selectPasswordKind("akun")}
              className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition sm:flex-none ${passwordKind === "akun" ? "bg-white text-primary shadow-sm" : "text-gray-500 hover:text-gray-900"}`}
            >
              Kata Sandi Akun
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={passwordKind === "riwayat"}
              onClick={() => selectPasswordKind("riwayat")}
              className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition sm:flex-none ${passwordKind === "riwayat" ? "bg-white text-primary shadow-sm" : "text-gray-500 hover:text-gray-900"}`}
            >
              Kata Sandi Riwayat
            </button>
          </div>
          {passwordKind === "riwayat" && (
            <p className="mb-4 text-xs text-gray-500">
              Kata sandi awal prototipe: 1234. Perubahan berlaku dalam sesi tab
              browser ini dan akses riwayat aktif akan dicabut.
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Kata sandi saat ini" required>
                <input
                  className="w-full min-w-0 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-800 outline-none placeholder:text-gray-500 focus:border-primary focus:ring-4 focus:ring-primary/15 disabled:cursor-not-allowed disabled:bg-gray-100"
                  type="password"
                  autoComplete="current-password"
                  value={pwdCurrent}
                  onChange={(e) => setPwdCurrent(e.target.value)}
                />
              </Field>
            </div>
            <Field label="Kata sandi baru" required>
              <input
                className="w-full min-w-0 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-800 outline-none placeholder:text-gray-500 focus:border-primary focus:ring-4 focus:ring-primary/15 disabled:cursor-not-allowed disabled:bg-gray-100"
                type="password"
                autoComplete="new-password"
                value={pwdNext}
                onChange={(e) => setPwdNext(e.target.value)}
              />
              <p className="mt-1 text-xs text-gray-500">
                Minimal {passwordKind === "riwayat" ? 4 : PASSWORD_MIN} karakter
              </p>
            </Field>
            <Field label="Ulangi kata sandi baru" required>
              <input
                className="w-full min-w-0 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-800 outline-none placeholder:text-gray-500 focus:border-primary focus:ring-4 focus:ring-primary/15 disabled:cursor-not-allowed disabled:bg-gray-100"
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
              className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 sm:w-auto"
              onClick={changePassword}
            >
              Ubah kata sandi
            </button>
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
                        src={cropSource ?? undefined}
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

      {dirty && (
        <div className="fixed inset-x-0 bottom-4 z-20 px-4 lg:left-64">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 rounded-2xl border border-gray-200 bg-white/95 p-4 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-semibold">
              Ada perubahan yang belum disimpan.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 flex-1 sm:flex-none"
                onClick={discardChanges}
              >
                Batalkan
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center gap-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50 flex-1 sm:w-auto sm:flex-none"
                onClick={saveChanges}
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
          className="pointer-events-none fixed left-1/2 top-20 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-lg"
        >
          <CheckCircle2 className="h-4 w-4" />
          {toast}
        </div>
      )}
    </PageContainer>
  );
}

function Panel({
  icon,
  title,
  description,
  action,
  className = "",
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6 ${className}`}
    >
      <div
        className={`mb-5 flex items-start gap-3 ${action ? "justify-between" : ""}`}
      >
        <div className="flex min-w-0 items-start gap-3">
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
        {action}
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
  children: React.ReactNode;
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
        className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${checked ? "bg-primary" : "bg-gray-300"}`}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <span
          className={`pointer-events-none absolute left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${checked ? "translate-x-5" : "translate-x-0"}`}
        />
      </span>
    </label>
  );
}
