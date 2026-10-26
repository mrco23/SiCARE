import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
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

const ADMIN_PROFILE_KEY = "sicare_admin_profile_v1";
export const HERO_CONTENT_KEY = "sicare_home_hero_content_v1";

type AdminProfile = {
  name: string;
  email: string;
  phone: string;
};

export type HeroCopy = {
  id: string;
  heading: string;
  paragraph: string;
};

const INITIAL_PROFILE: AdminProfile = {
  name: "Administrator SiCARE",
  email: "admin@unikadelasalle.ac.id",
  phone: "",
};

const INITIAL_HERO_COPY: HeroCopy[] = [
  {
    id: "hero-1",
    heading:
      "Temukan dukungan untuk perjalanan akademik dan kehidupan personalmu.",
    paragraph:
      "SiCARE menyediakan ruang konseling yang aman dan suportif untuk membantu mahasiswa menghadapi tantangan akademik maupun personal.",
  },
  {
    id: "hero-2",
    heading: "Tidak harus menghadapi semuanya sendirian.",
    paragraph:
      "Bicarakan tantanganmu bersama konselor kampus dan temukan langkah yang sesuai dengan kebutuhanmu.",
  },
  {
    id: "hero-3",
    heading: "Jaga keseimbangan diri, tumbuh bersama SiCARE.",
    paragraph:
      "Dapatkan pendampingan untuk mengenali potensi diri, mengelola tekanan, dan menjalani kehidupan kampus dengan lebih baik.",
  },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^(\+62|62|0)[0-9]{8,13}$/;

function readStoredValue<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function makeId() {
  return `hero-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function AdminPengaturanPage() {
  const [profile, setProfile] = useState<AdminProfile>(() =>
    readStoredValue(ADMIN_PROFILE_KEY, INITIAL_PROFILE),
  );
  const [savedProfile, setSavedProfile] = useState<AdminProfile>(() =>
    readStoredValue(ADMIN_PROFILE_KEY, INITIAL_PROFILE),
  );
  const [heroCopies, setHeroCopies] = useState<HeroCopy[]>(() =>
    readStoredValue(HERO_CONTENT_KEY, INITIAL_HERO_COPY),
  );
  const [savedHeroCopies, setSavedHeroCopies] = useState<HeroCopy[]>(() =>
    readStoredValue(HERO_CONTENT_KEY, INITIAL_HERO_COPY),
  );
  const [showErrors, setShowErrors] = useState(false);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const profileDirty = JSON.stringify(profile) !== JSON.stringify(savedProfile);
  const heroDirty =
    JSON.stringify(heroCopies) !== JSON.stringify(savedHeroCopies);
  const dirty = profileDirty || heroDirty;

  const errors = useMemo(() => {
    const result: Record<string, string> = {};
    if (!profile.name.trim()) result.name = "Nama admin wajib diisi.";

    const email = profile.email.trim();
    if (!email) result.email = "Email wajib diisi.";
    else if (!EMAIL_RE.test(email)) result.email = "Format email tidak valid.";

    const phone = profile.phone.replace(/[\s()-]/g, "");
    if (phone && !PHONE_RE.test(phone)) {
      result.phone = "Format nomor telepon tidak valid.";
    }

    heroCopies.forEach((item, index) => {
      if (!item.heading.trim()) {
        result[`heading-${item.id}`] =
          `Judul motivasi ${index + 1} wajib diisi.`;
      }
      if (!item.paragraph.trim()) {
        result[`paragraph-${item.id}`] =
          `Paragraf motivasi ${index + 1} wajib diisi.`;
      }
      if (item.heading.length > 180) {
        result[`heading-${item.id}`] = "H1 maksimal 180 karakter.";
      }
      if (item.paragraph.length > 600) {
        result[`paragraph-${item.id}`] = "Paragraf maksimal 600 karakter.";
      }
    });

    if (!heroCopies.length) {
      result.heroCopies = "Tambahkan minimal satu pasangan H1 dan paragraf.";
    }

    return result;
  }, [profile, heroCopies]);

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

  function updateHeroCopy(
    id: string,
    field: "heading" | "paragraph",
    value: string,
  ) {
    setHeroCopies((previous) =>
      previous.map((item) =>
        item.id === id ? { ...item, [field]: value } : item,
      ),
    );
  }

  function addHeroCopy() {
    setHeroCopies((previous) => [
      ...previous,
      { id: makeId(), heading: "", paragraph: "" },
    ]);
  }

  function removeHeroCopy(id: string) {
    setHeroCopies((previous) => previous.filter((item) => item.id !== id));
  }

  function saveChanges() {
    if (Object.keys(errors).length > 0) {
      setShowErrors(true);
      setToast("Periksa kembali isian yang ditandai.");
      return;
    }

    try {
      localStorage.setItem(ADMIN_PROFILE_KEY, JSON.stringify(profile));
      localStorage.setItem(HERO_CONTENT_KEY, JSON.stringify(heroCopies));
      setSavedProfile({ ...profile });
      setSavedHeroCopies(heroCopies.map((item) => ({ ...item })));
      setShowErrors(false);
      setToast(
        "Pengaturan disimpan di browser ini. Hubungkan backend agar perubahan berlaku untuk semua pengguna.",
      );
    } catch {
      setToast("Pengaturan tidak dapat disimpan di browser. Coba lagi.");
    }
  }

  function discardChanges() {
    setProfile({ ...savedProfile });
    setHeroCopies(savedHeroCopies.map((item) => ({ ...item })));
    setShowErrors(false);
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 text-gray-800 sm:px-6 sm:py-8 lg:px-8">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          Pengaturan
        </h1>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-gray-500 sm:text-base">
          Kelola informasi akun administrator dan kalimat yang tampil pada
          bagian Hero di halaman utama SiCARE.
        </p>
      </header>

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
            <p className="font-semibold text-gray-900">Administrator SiCARE</p>
            <p className="mt-1 break-all text-xs text-gray-500">
              {profile.email}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          Akun administrator
          <span className="ml-1 rounded-full bg-[#e8f9f0] px-2.5 py-1 font-semibold text-[#1e5b3a]">
            Aktif
          </span>
        </div>
      </section>

      <div className="mt-6 flex flex-col gap-4 sm:gap-5 lg:gap-6">
        <Panel
          icon={<UserRound className="h-5 w-5" />}
          title="Informasi Akun"
          description="Admin menggunakan logo website dan nama Administrator SiCARE."
        >
          <div className="space-y-5">
            <Field label="Nama admin">
              <input
                value="Administrator SiCARE"
                readOnly
                className={`${inputClass} cursor-not-allowed bg-gray-50 text-gray-500`}
              />
              <p className="mt-1.5 text-xs text-gray-500">
                Nama akun ditetapkan oleh sistem.
              </p>
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
                  placeholder="admin@kampus.ac.id"
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
              <p className="mt-1.5 text-xs text-gray-500">
                Nomor telepon opsional.
              </p>
            </Field>
          </div>
        </Panel>

        <Panel
          icon={<FileText className="h-5 w-5" />}
          title="Kalimat Motivasi Beranda"
          description="Kelola beberapa kalimat motivasi yang akan ditampilkan bergantian pada bagian Hero halaman utama. Setiap kalimat terdiri dari judul dan paragraf pendukung."
          action={
            <button
              type="button"
              onClick={addHeroCopy}
              className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-[#1e5b3a] transition hover:bg-[#e8f9f0]"
            >
              <Plus className="h-4 w-4" />
              Tambah
            </button>
          }
        >
          <div className="space-y-4">
            {heroCopies.map((item, index) => (
              <div
                key={item.id}
                className="rounded-xl border border-gray-200 p-4"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-sm font-bold text-gray-800">
                    Motivasi {index + 1}
                  </p>
                  <button
                    type="button"
                    aria-label={`Hapus kalimat ${index + 1}`}
                    onClick={() => removeHeroCopy(item.id)}
                    className="rounded-lg p-2 text-gray-500 transition hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <Field
                  label="Judul H1"
                  required
                  error={showErrors ? errors[`heading-${item.id}`] : ""}
                >
                  <textarea
                    rows={2}
                    maxLength={180}
                    value={item.heading}
                    onChange={(event) =>
                      updateHeroCopy(item.id, "heading", event.target.value)
                    }
                    placeholder="Contoh: Kamu tidak harus menghadapi semuanya sendirian."
                    className={`${inputClass} resize-y`}
                  />
                  <p className="mt-1 text-right text-xs text-gray-400">
                    {item.heading.length}/180
                  </p>
                </Field>

                <div className="mt-4">
                  <Field
                    label="Paragraf"
                    required
                    error={showErrors ? errors[`paragraph-${item.id}`] : ""}
                  >
                    <textarea
                      rows={4}
                      maxLength={600}
                      value={item.paragraph}
                      onChange={(event) =>
                        updateHeroCopy(item.id, "paragraph", event.target.value)
                      }
                      placeholder="Tulis pesan motivasi yang mendukung judul di atas."
                      className={`${inputClass} resize-y`}
                    />
                    <p className="mt-1 text-right text-xs text-gray-400">
                      {item.paragraph.length}/600
                    </p>
                  </Field>
                </div>
              </div>
            ))}

            {showErrors && errors.heroCopies && (
              <p className="text-xs text-red-600">{errors.heroCopies}</p>
            )}
            <div className="rounded-xl bg-[#f7fcf9] p-3 text-xs leading-relaxed text-gray-600">
              <p className="font-semibold text-[#1e5b3a]">Cara kerja</p>
              Setiap entri adalah satu kalimat motivasi yang terdiri dari judul
              utama dan paragraf pendukung. HomePage perlu membaca daftar ini
              dan memilih salah satu entri secara acak setiap kali halaman
              dimuat ulang. Kunci penyimpanan frontend:{" "}
              <code className="break-all rounded bg-white px-1 py-0.5">
                {HERO_CONTENT_KEY}
              </code>
              .
            </div>
          </div>
        </Panel>

        <Panel
          className="lg:col-span-2"
          icon={<ShieldCheck className="h-5 w-5" />}
          title="Catatan Implementasi"
          description="Batasan penyimpanan versi frontend."
        >
          <p className="text-sm leading-relaxed text-gray-600">
            Data akun dan konten Hero saat ini disimpan di localStorage browser.
            Artinya, perubahan hanya tersedia di browser dan perangkat yang
            digunakan untuk menyimpan. Untuk menerapkan perubahan secara
            konsisten kepada seluruh pengunjung, simpan konten melalui backend
            dan ambil data tersebut dari HomePage.
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
                className="inline-flex flex-1 items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 sm:flex-none"
              >
                Batalkan
              </button>
              <button
                type="button"
                onClick={saveChanges}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#1e5b3a] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#174a2f] sm:flex-none"
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
          className="pointer-events-none fixed left-1/2 top-20 z-50 flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-2 rounded-full bg-[#1e5b3a] px-4 py-2 text-sm font-semibold text-white shadow-lg"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      <p className="mt-8 pb-3 text-center text-[11px] leading-relaxed text-gray-400">
        Rancangan frontend. Data disimpan lokal dan belum tersinkron dengan
        server.
      </p>
    </div>
  );
}

const inputClass =
  "w-full min-w-0 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-[#1e5b3a] focus:ring-4 focus:ring-[#1e5b3a]/15";

function Panel({
  icon,
  title,
  description,
  action,
  className = "",
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={`rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6 ${className}`}
    >
      <div
        className={`mb-5 flex items-start gap-3 ${action ? "justify-between" : ""}`}
      >
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#e8f9f0] text-[#1e5b3a]">
            {icon}
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-gray-900">{title}</h2>
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
