import { useMemo, useState, type ReactNode } from "react";
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  GraduationCap,
  Lock,
  MapPin,
  Search,
} from "lucide-react";

/* ========================= TIPE ========================= */
type Layanan = "Individu" | "Kelompok";
type YesNo = "Ya" | "Mungkin" | "Tidak";
type Step = 1 | 2 | 3 | 4 | 5 | 6; // 6 = selesai

type Counselor = {
  id: number;
  name: string;
  short: string; // baris nama (pakai \n)
  gender: "Perempuan" | "Laki-laki";
  initials: string;
  degree: string;
  experience: string;
  room: string;
  focus: string;
  about: string;
  skills: string[];
  schedule: Record<string, string[]>; // key: nama hari
};

type Slot = { date: string; time: string }; // date: YYYY-MM-DD

type IntakeForm = {
  selfHarm: YesNo | null;
  distress: YesNo | null;
  abuse: YesNo | null;
  substance: YesNo | null;
  sleep: number | null;
  finance: number | null;
  topics: string[];
  otherOn: boolean;
  other: string;
  complaint: string;
  history: string;
  reason: string;
  efforts: string;
  goal: string;
  strengths: string;
  weaknesses: string;
  groupName: string;
  groupSize: string;
  groupMembers: string;
  declared: boolean;
  consent: boolean;
};

type EssayKey =
  | "complaint"
  | "history"
  | "reason"
  | "efforts"
  | "goal"
  | "strengths"
  | "weaknesses";
type YesNoKey = "selfHarm" | "distress" | "abuse" | "substance";
type ScaleKey = "sleep" | "finance";

/* ========================= DATA (contoh) ========================= */
// Di produksi, ambil dari API. Jadwal dan keahlian berasal dari profil konselor.
const STEPS = [
  "Jenis Layanan",
  "Pilih Konselor",
  "Pilih Jadwal",
  "Form Awal",
  "Persetujuan",
];
const DAYS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"];
const MIN_LEAD_DAYS = 1; // paling cepat besok
const MAX_AHEAD_DAYS = 60; // paling jauh 60 hari ke depan
const SPESIALIS = [
  "Kecemasan",
  "Stres",
  "Masalah Hubungan",
  "Pengembangan Diri",
];

const COUNSELORS: Counselor[] = [
  {
    id: 1,
    name: "Giovanna Yudi, S.Psi., M.Psi., Psikolog",
    short: "Giovanna Yudi,\nS.Psi., M.Psi.",
    gender: "Perempuan",
    initials: "GY",
    degree: "S2 Psikolog",
    experience: "5 tahun pengalaman",
    room: "Ruang Konseling 01",
    focus:
      "Fokus pada pengembangan diri, manajemen stres, dan penanganan kecemasan.",
    about:
      "Berpengalaman dalam konseling individu dan kelompok dengan fokus pada pengelolaan stres, kecemasan, masalah hubungan, dan pengembangan diri.",
    skills: [
      "Kecemasan",
      "Stres",
      "Masalah Hubungan",
      "Manajemen Emosi",
      "Pengembangan Diri",
    ],
    schedule: {
      Senin: ["08:00 - 10:00", "14:00 - 15:00"],
      Selasa: ["08:00 - 10:00", "13:00 - 14:00"],
      Rabu: [],
      Kamis: ["08:00 - 10:00", "14:00 - 15:00"],
      Jumat: ["08:00 - 10:00"],
    },
  },
  {
    id: 2,
    name: "Rico Kornelius Wahani, S.Psi., M.Psi., Psikolog",
    short: "Rico Kornelius\nWahani, S.Psi.,\nM.Psi., Psikolog",
    gender: "Laki-laki",
    initials: "RW",
    degree: "S2 Psikolog",
    experience: "5 tahun pengalaman",
    room: "Ruang Konseling 02",
    focus: "Fokus pada pengembangan diri, manajemen stres, dan kecemasan.",
    about:
      "Berpengalaman mendampingi mahasiswa dan staf dalam mengelola stres kerja, kecemasan akademik, dan pengembangan diri.",
    skills: ["Kecemasan", "Stres", "Pengembangan Diri"],
    schedule: {
      Senin: ["09:00 - 10:00"],
      Selasa: [],
      Rabu: ["10:00 - 11:00"],
      Kamis: ["13:00 - 14:00"],
      Jumat: ["08:00 - 10:00", "14:00 - 15:00"],
    },
  },
];

const YESNO: { key: YesNoKey; label: string }[] = [
  { key: "selfHarm", label: "Apakah Anda sedang merasa ingin bunuh diri?" },
  {
    key: "distress",
    label:
      "Apakah Anda sedang merasakan kesedihan, kehilangan, atau depresi yang luar biasa?",
  },
  {
    key: "abuse",
    label:
      "Apakah Anda pernah mengalami pelecehan? (fisik, seksual, dan/atau emosional)",
  },
  {
    key: "substance",
    label: "Apakah saat ini Anda sedang menggunakan obat-obatan?",
  },
];

const SCALES: { key: ScaleKey; label: string }[] = [
  { key: "sleep", label: "Kualitas tidur" },
  { key: "finance", label: "Keadaan finansial" },
];

const TOPICS = [
  "Karir, pendidikan, dan pekerjaan",
  "Motivasi",
  "Stres atau tekanan kerja",
  "Emosi, mood, kepribadian",
  "Kecemasan",
  "Hubungan dan keluarga",
  "Pengembangan diri",
  "Kesehatan dan kebiasaan sehari-hari",
];

const ESSAYS: { key: EssayKey; label: string }[] = [
  { key: "complaint", label: "Deskripsikan keluhan yang Anda rasakan" },
  {
    key: "history",
    label: "Deskripsikan riwayat terjadinya keluhan secara jelas dan rinci",
  },
  { key: "reason", label: "Keluhan dan alasan ingin memulai konseling" },
  {
    key: "efforts",
    label: "Apa yang sudah dilakukan untuk menangani masalah ini?",
  },
  {
    key: "goal",
    label: "Solusi apa yang diinginkan dari bantuan yang diterima?",
  },
  { key: "strengths", label: "Apa kelebihan diri Anda?" },
  { key: "weaknesses", label: "Apa kekurangan diri Anda?" },
];

const ANSWER_STYLE: Record<YesNo, string> = {
  Ya: "bg-red-100 text-red-800",
  Mungkin: "bg-amber-100 text-amber-800",
  Tidak: "bg-[#e8f9f0] text-[#1e5b3a]",
};

const newForm = (): IntakeForm => ({
  selfHarm: null,
  distress: null,
  abuse: null,
  substance: null,
  sleep: null,
  finance: null,
  topics: [],
  otherOn: false,
  other: "",
  complaint: "",
  history: "",
  reason: "",
  efforts: "",
  goal: "",
  strengths: "",
  weaknesses: "",
  groupName: "",
  groupSize: "",
  groupMembers: "",
  declared: false,
  consent: false,
});

/* ========================= HELPER TANGGAL ========================= */
const pad = (n: number) => String(n).padStart(2, "0");
const toISO = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromISO = (iso: string) => new Date(`${iso}T00:00:00`);
const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const minDate = () => addDays(startOfToday(), MIN_LEAD_DAYS);
const firstOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const fmtLong = (iso: string) =>
  fromISO(iso).toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
const fmtSlot = (s: Slot) => `${fmtLong(s.date)}, ${s.time} WITA`;

// Jam yang tersedia pada tanggal tertentu (weekend & di luar rentang: kosong)
function slotsFor(c: Counselor, iso: string): string[] {
  const d = fromISO(iso);
  const today = startOfToday();
  if (d < addDays(today, MIN_LEAD_DAYS) || d > addDays(today, MAX_AHEAD_DAYS))
    return [];
  const dow = d.getDay(); // 0 = Minggu, 6 = Sabtu
  if (dow === 0 || dow === 6) return [];
  return c.schedule[DAYS[dow - 1]] ?? [];
}

/* ========================= HALAMAN ========================= */
export default function KlienPesananPage() {
  const [step, setStep] = useState<Step>(1);
  const [layanan, setLayanan] = useState<Layanan | null>(null);
  const [konselorId, setKonselorId] = useState<number | null>(null);
  const [q, setQ] = useState("");
  const [spesialis, setSpesialis] = useState("");
  const [gender, setGender] = useState("");
  const [calMonth, setCalMonth] = useState<Date>(() => firstOfMonth(minDate()));
  const [selDate, setSelDate] = useState<string | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [form, setForm] = useState<IntakeForm>(newForm);
  const [missing, setMissing] = useState<string[]>([]);
  const [formError, setFormError] = useState(false);

  const counselor = COUNSELORS.find((c) => c.id === konselorId) ?? null;

  const filteredCounselors = useMemo(() => {
    const term = q.trim().toLowerCase();
    return COUNSELORS.filter(
      (c) =>
        (!term || c.name.toLowerCase().includes(term)) &&
        (!spesialis || c.skills.includes(spesialis)) &&
        (!gender || c.gender === gender),
    );
  }, [q, spesialis, gender]);

  const goTo = (n: Step) => {
    setStep(n);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const selectCounselor = (id: number) => {
    setKonselorId(id);
    setSlot(null);
    setSelDate(null);
    setCalMonth(firstOfMonth(minDate()));
  };

  const setField = <K extends keyof IntakeForm>(
    key: K,
    value: IntakeForm[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setMissing((m) => m.filter((x) => x !== key));
  };

  const toggleTopic = (t: string) =>
    setForm((prev) => ({
      ...prev,
      topics: prev.topics.includes(t)
        ? prev.topics.filter((x) => x !== t)
        : [...prev.topics, t],
    }));

  // Validasi form awal; mengembalikan daftar field yang belum lengkap
  const validate = (): string[] => {
    const miss: string[] = [];
    YESNO.forEach(({ key }) => {
      if (!form[key]) miss.push(key);
    });
    SCALES.forEach(({ key }) => {
      if (!form[key]) miss.push(key);
    });
    const hasOther = form.otherOn && form.other.trim();
    if (!form.topics.length && !hasOther) miss.push("topics");
    ESSAYS.forEach(({ key }) => {
      if (!form[key].trim()) miss.push(key);
    });
    if (layanan === "Kelompok") {
      const size = Number(form.groupSize);
      if (!form.groupName.trim()) miss.push("groupName");
      if (!Number.isInteger(size) || size < 2 || size > 10)
        miss.push("groupSize");
      if (!form.groupMembers.trim()) miss.push("groupMembers");
    }
    return miss;
  };

  const handleNextFromForm = () => {
    const miss = validate();
    setMissing(miss);
    setFormError(miss.length > 0);
    if (miss.length === 0) goTo(5);
  };

  const handleSubmit = () => {
    if (!counselor || !slot || !layanan) return;
    // Di produksi: kirim { layanan, konselorId, slot, form } ke API di sini.
    goTo(6);
  };

  const handleRestart = () => {
    setStep(1);
    setLayanan(null);
    setKonselorId(null);
    setSlot(null);
    setSelDate(null);
    setCalMonth(firstOfMonth(minDate()));
    setForm(newForm());
    setMissing([]);
    setFormError(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div>
      <h1 className="font-display text-2xl font-extrabold text-gray-900 sm:text-3xl">
        Booking Jadwal Konseling
      </h1>
      <p className="mt-2 text-sm text-gray-600 sm:text-base">
        Langkah mudah untuk mendapatkan dukungan yang kamu butuhkan.
      </p>

      {step <= 5 && <Stepper step={step} />}

      {/* ===== 1. JENIS LAYANAN ===== */}
      {step === 1 && (
        <section className="mt-6">
          <h2 className="font-display text-2xl font-bold sm:text-3xl">
            Pilih Jenis Layanan
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Pilih layanan yang paling sesuai dengan kebutuhanmu.
          </p>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <LayananCard
              selected={layanan === "Individu"}
              onClick={() => setLayanan("Individu")}
              title="Konseling Individu"
              desc="Sesi pribadi bersama konselor secara rahasia."
              art={<ArtIndividu />}
            />
            <LayananCard
              selected={layanan === "Kelompok"}
              onClick={() => setLayanan("Kelompok")}
              title="Konseling Kelompok"
              desc="Sesi bersama beberapa peserta dengan satu konselor."
              art={<ArtKelompok />}
            />
          </div>

          {layanan === "Kelompok" && (
            <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
              Jika memilih konseling kelompok, kamu akan diminta untuk mengisi
              informasi kelompok pada langkah Form Awal.
            </div>
          )}

          <div className="mt-6 flex flex-col-reverse gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:max-w-md">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e8f9f0] text-[#1e5b3a]">
                <Lock className="h-5 w-5" strokeWidth={2} />
              </span>
              <div>
                <p className="font-semibold text-gray-900">Privasi Terjaga</p>
                <p className="text-sm text-gray-600">
                  Informasi awal hanya digunakan untuk membantu konselor
                  mempersiapkan sesi.
                </p>
              </div>
            </div>
            <NavButton
              disabled={!layanan}
              onClick={() => goTo(2)}
              className="sm:self-end"
            >
              Lanjut <ArrowRight className="h-4 w-4" strokeWidth={2} />
            </NavButton>
          </div>
        </section>
      )}

      {/* ===== 2. PILIH KONSELOR ===== */}
      {step === 2 && (
        <section className="mt-6">
          <h2 className="font-display text-2xl font-bold sm:text-3xl">
            Pilih Konselor
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Pilih konselor yang sesuai dengan kebutuhan dan preferensi anda.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
                strokeWidth={2}
              />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cari nama konselor..."
                className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-12 pr-4 text-sm outline-none focus:border-[#1e5b3a] focus:ring-4 focus:ring-[#1e5b3a]/15"
              />
            </div>
            <select
              value={spesialis}
              onChange={(e) => setSpesialis(e.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-[#1e5b3a]"
            >
              <option value="">Semua Spesialis</option>
              {SPESIALIS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-[#1e5b3a]"
            >
              <option value="">Semua Jenis Kelamin</option>
              <option>Perempuan</option>
              <option>Laki-laki</option>
            </select>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filteredCounselors.map((c) => {
              const on = konselorId === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => selectCounselor(c.id)}
                  className={`flex flex-col rounded-2xl border-2 bg-white p-4 text-left transition hover:shadow-md ${on ? "border-[#1e5b3a]" : "border-gray-200"}`}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#e8f9f0] font-bold text-[#1e5b3a]">
                      {c.initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="whitespace-pre-line font-semibold leading-snug text-gray-900">
                        {c.short}
                      </p>
                      <p className="mt-2 text-xs text-gray-500">{c.degree}</p>
                      <p className="text-xs text-gray-500">{c.experience}</p>
                    </div>
                    {on && (
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1e5b3a] text-white">
                        <Check className="h-3.5 w-3.5" strokeWidth={3} />
                      </span>
                    )}
                  </div>
                  <p className="mt-4 text-sm text-gray-600">{c.focus}</p>
                  <span
                    className={`mt-4 inline-flex w-fit rounded-full px-4 py-1 text-xs font-semibold ${
                      on
                        ? "bg-[#1e5b3a] text-white"
                        : "border border-[#1e5b3a] text-[#1e5b3a]"
                    }`}
                  >
                    {on ? "Dipilih" : "Pilih"}
                  </span>
                </button>
              );
            })}
          </div>
          {filteredCounselors.length === 0 && (
            <p className="mt-6 text-sm text-gray-500">
              Tidak ada konselor yang cocok dengan filter.
            </p>
          )}

          <div className="mt-6 flex justify-between gap-3">
            <BackButton onClick={() => goTo(1)} />
            <NavButton disabled={!counselor} onClick={() => goTo(3)}>
              Lanjut <span aria-hidden>›</span>
            </NavButton>
          </div>
        </section>
      )}

      {/* ===== 3. PILIH JADWAL ===== */}
      {step === 3 && counselor && (
        <section className="mt-6">
          <h2 className="font-display text-2xl font-bold sm:text-3xl">
            Daftar Konselor
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Lihat profil, keahlian, dan jadwal tersedia sebelum melakukan janji
            temu.
          </p>

          <article className="mt-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="flex flex-col gap-6 md:flex-row md:items-start">
              <div className="flex items-start gap-5 md:w-1/2">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-[#e8f9f0] text-2xl font-bold text-[#1e5b3a] sm:h-24 sm:w-24">
                  {counselor.initials}
                </div>
                <div className="min-w-0">
                  <p className="whitespace-pre-line font-display text-lg font-bold leading-snug">
                    {counselor.short}
                  </p>
                  <p className="mt-2 flex items-center gap-2 text-sm text-gray-600">
                    <GraduationCap
                      className="h-4 w-4 text-[#1e5b3a]"
                      strokeWidth={2}
                    />
                    {counselor.degree}
                  </p>
                  <p className="mt-1 flex items-center gap-2 text-sm text-gray-600">
                    <MapPin
                      className="h-4 w-4 text-[#1e5b3a]"
                      strokeWidth={2}
                    />
                    {counselor.room}
                  </p>
                </div>
              </div>
              <div className="md:w-1/2">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                  <span className="h-2 w-2 rounded-full bg-[#1e5b3a]" />
                  Tentang Konselor
                </div>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">
                  {counselor.about}
                </p>
                <div className="mt-5 flex items-center gap-2 text-sm font-semibold text-gray-900">
                  <span className="h-2 w-2 rounded-full bg-[#1e5b3a]" />
                  Keahlian
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {counselor.skills.map((s) => (
                    <span
                      key={s}
                      className="rounded-full bg-[#e8f9f0] px-3 py-1 text-xs font-semibold text-[#1e5b3a]"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6">
              <p className="text-sm font-semibold text-gray-900">
                Pilih Tanggal &amp; Jam
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Tanggal berwarna hijau tersedia. Janji dapat dibuat mulai besok
                sampai {MAX_AHEAD_DAYS} hari ke depan.
              </p>
              <div className="mt-4 grid gap-5 md:grid-cols-[minmax(0,26rem)_1fr]">
                <CalendarPicker
                  counselor={counselor}
                  calMonth={calMonth}
                  setCalMonth={setCalMonth}
                  selDate={selDate}
                  onSelectDate={(iso) => {
                    setSelDate(iso);
                    setSlot(null);
                  }}
                />
                <TimePanel
                  counselor={counselor}
                  selDate={selDate}
                  slot={slot}
                  onSelectSlot={(time) =>
                    selDate && setSlot({ date: selDate, time })
                  }
                />
              </div>
            </div>

            <div className="mt-6 flex flex-col items-end gap-2">
              <p className="text-xs text-gray-500">
                {slot
                  ? `Dipilih: ${fmtSlot(slot)}`
                  : "Belum ada jadwal dipilih."}
              </p>
              <NavButton
                disabled={!slot}
                onClick={() => goTo(4)}
                variant="solid"
              >
                Lanjut ke Form Awal{" "}
                <ArrowRight className="h-4 w-4" strokeWidth={2.2} />
              </NavButton>
            </div>
          </article>

          <div className="mt-6 flex justify-between gap-3">
            <BackButton onClick={() => goTo(2)} />
          </div>
        </section>
      )}

      {/* ===== 4. FORM AWAL ===== */}
      {step === 4 && counselor && slot && layanan && (
        <section className="mt-6">
          <h2 className="font-display text-2xl font-bold sm:text-3xl">
            Form Awal
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Isi informasi berikut agar konselor dapat mempersiapkan sesi.
            Jawabanmu hanya dapat dilihat oleh konselor yang kamu pilih.
          </p>

          <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
            {[
              `Konseling ${layanan}`,
              counselor.short.replace(/\n/g, " "),
              fmtSlot(slot),
            ].map((t) => (
              <span
                key={t}
                className="rounded-full bg-[#e8f9f0] px-3 py-1 text-[#1e5b3a]"
              >
                {t}
              </span>
            ))}
          </div>

          <form
            className="mt-6 space-y-4"
            noValidate
            onSubmit={(e) => e.preventDefault()}
          >
            {layanan === "Kelompok" && (
              <section className={CARD}>
                <h3 className="text-base font-bold">Informasi Kelompok</h3>
                <p className="mt-1 text-xs text-gray-500">
                  Isi data kelompok yang akan mengikuti sesi bersama.
                </p>

                <Field
                  label="Nama kelompok"
                  error={missing.includes("groupName")}
                  errorText="Wajib diisi."
                >
                  <input
                    type="text"
                    maxLength={80}
                    value={form.groupName}
                    onChange={(e) => setField("groupName", e.target.value)}
                    placeholder="Contoh: Kelompok Belajar Psikologi"
                    className={INPUT}
                  />
                </Field>

                <Field
                  label="Jumlah peserta (termasuk kamu)"
                  error={missing.includes("groupSize")}
                  errorText="Isi jumlah peserta antara 2 sampai 10."
                >
                  <input
                    type="number"
                    min={2}
                    max={10}
                    value={form.groupSize}
                    onChange={(e) => setField("groupSize", e.target.value)}
                    placeholder="2 - 10"
                    className={`${INPUT} sm:max-w-[12rem]`}
                  />
                </Field>

                <Field
                  label="Nama anggota kelompok"
                  error={missing.includes("groupMembers")}
                  errorText="Wajib diisi."
                >
                  <textarea
                    rows={4}
                    maxLength={800}
                    value={form.groupMembers}
                    onChange={(e) => setField("groupMembers", e.target.value)}
                    placeholder="Tulis satu nama per baris"
                    className={INPUT}
                  />
                </Field>
              </section>
            )}

            <section className={CARD}>
              <h3 className="text-base font-bold">Kondisi Saat Ini</h3>
              <div className="mt-2 divide-y divide-gray-100">
                {YESNO.map(({ key, label }) => (
                  <div key={key} className="py-4">
                    <p className="text-sm text-gray-700">{label}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(["Ya", "Mungkin", "Tidak"] as YesNo[]).map((v) => (
                        <Pill
                          key={v}
                          selected={form[key] === v}
                          onClick={() => setField(key, v)}
                        >
                          {v}
                        </Pill>
                      ))}
                    </div>
                    {key === "selfHarm" &&
                      (form.selfHarm === "Ya" ||
                        form.selfHarm === "Mungkin") && (
                        <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                          Terima kasih sudah jujur. Konselor akan melihat
                          jawabanmu sebelum sesi. Jika kamu merasa tidak aman
                          saat ini, segera hubungi layanan darurat 112 atau
                          minta orang terdekat untuk menemanimu.
                        </div>
                      )}
                    {missing.includes(key) && (
                      <ErrorText>Wajib diisi.</ErrorText>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-4 grid gap-5 sm:grid-cols-2">
                {SCALES.map(({ key, label }) => (
                  <div key={key}>
                    <p className="text-sm font-semibold text-gray-700">
                      {label}
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <ScalePill
                          key={n}
                          selected={form[key] === n}
                          onClick={() => setField(key, n)}
                        >
                          {n}
                        </ScalePill>
                      ))}
                    </div>
                    <div className="mt-2 flex w-[232px] justify-between text-[11px] text-gray-500">
                      <span>Sangat buruk</span>
                      <span>Sangat baik</span>
                    </div>
                    {missing.includes(key) && (
                      <ErrorText>Wajib diisi.</ErrorText>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <section className={CARD}>
              <h3 className="text-base font-bold">
                Masalah yang ingin dibahas
              </h3>
              <p className="mt-1 text-xs text-gray-500">
                Boleh pilih lebih dari satu.
              </p>
              <div className="mt-3">
                <div className="flex flex-wrap gap-2">
                  {TOPICS.map((t) => (
                    <Pill
                      key={t}
                      selected={form.topics.includes(t)}
                      onClick={() => toggleTopic(t)}
                    >
                      {t}
                    </Pill>
                  ))}
                  <Pill
                    selected={form.otherOn}
                    onClick={() => setField("otherOn", !form.otherOn)}
                  >
                    Lainnya
                  </Pill>
                </div>
                {form.otherOn && (
                  <input
                    type="text"
                    maxLength={80}
                    value={form.other}
                    onChange={(e) => setField("other", e.target.value)}
                    placeholder="Tulis topik lain"
                    className={`${INPUT} sm:max-w-md`}
                  />
                )}
                {missing.includes("topics") && (
                  <ErrorText>Pilih minimal satu topik.</ErrorText>
                )}
              </div>
            </section>

            {ESSAYS.map(({ key, label }) => (
              <section key={key} className={CARD}>
                <label className="text-sm font-semibold text-gray-700">
                  {label}
                </label>
                <textarea
                  rows={4}
                  maxLength={1500}
                  value={form[key]}
                  onChange={(e) => setField(key, e.target.value)}
                  placeholder="Tulis dengan bebas, sebisa dan sejujurmu."
                  className={INPUT}
                />
                {missing.includes(key) && <ErrorText>Wajib diisi.</ErrorText>}
              </section>
            ))}
          </form>

          {formError && (
            <p className="mt-4 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800">
              Beberapa isian wajib belum lengkap. Silakan periksa bagian yang
              ditandai.
            </p>
          )}

          <div className="mt-6 flex justify-between gap-3">
            <BackButton onClick={() => goTo(3)} />
            <NavButton onClick={handleNextFromForm}>
              Lanjut <span aria-hidden>›</span>
            </NavButton>
          </div>
        </section>
      )}

      {/* ===== 5. PERSETUJUAN ===== */}
      {step === 5 && counselor && slot && layanan && (
        <section className="mt-6">
          <h2 className="font-display text-2xl font-bold sm:text-3xl">
            Konfirmasi Janji Temu
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Periksa kembali ringkasan di bawah sebelum mengirim permintaan.
          </p>

          <div className="mt-6 space-y-4">
            <section className={CARD}>
              <h3 className="text-base font-bold">Detail Janji Temu</h3>
              <dl className="mt-4 grid gap-4 sm:grid-cols-3">
                <Kv label="Jenis layanan" value={`Konseling ${layanan}`} />
                <Kv
                  label="Konselor"
                  value={counselor.short.replace(/\n/g, " ")}
                />
                <Kv label="Jadwal" value={fmtSlot(slot)} />
                <Kv label="Ruangan" value={counselor.room} />
                <Kv label="Durasi" value="60 menit" />
              </dl>
            </section>

            {layanan === "Kelompok" && (
              <section className={CARD}>
                <h3 className="text-base font-bold">Informasi Kelompok</h3>
                <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Kv label="Nama kelompok" value={form.groupName} />
                  <Kv label="Jumlah peserta" value={form.groupSize} />
                </dl>
                <p className="mt-4 text-xs text-gray-500">Anggota</p>
                <p className="mt-0.5 whitespace-pre-line text-sm text-gray-800">
                  {form.groupMembers}
                </p>
              </section>
            )}

            <section className={CARD}>
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold">Ringkasan Form Awal</h3>
                <button
                  type="button"
                  onClick={() => goTo(4)}
                  className="text-sm font-semibold text-[#1e5b3a] hover:underline"
                >
                  Ubah
                </button>
              </div>
              <div className="mt-3 divide-y divide-gray-100">
                {YESNO.map(({ key, label }) => {
                  const v = form[key];
                  return (
                    <div
                      key={key}
                      className="flex flex-wrap items-start justify-between gap-3 py-3"
                    >
                      <p className="text-sm text-gray-700">{label}</p>
                      {v && (
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${ANSWER_STYLE[v]}`}
                        >
                          {v}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                <Kv
                  label="Kualitas tidur"
                  value={`${form.sleep ?? "-"} dari 5`}
                />
                <Kv
                  label="Keadaan finansial"
                  value={`${form.finance ?? "-"} dari 5`}
                />
              </dl>
              <p className="mt-5 text-xs text-gray-500">
                Masalah yang ingin dibahas
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {[
                  ...form.topics,
                  ...(form.otherOn && form.other.trim()
                    ? [`Lainnya: ${form.other.trim()}`]
                    : []),
                ].map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800"
                  >
                    {t}
                  </span>
                ))}
              </div>

              <details className="mt-5 rounded-xl border border-gray-200 p-4">
                <summary className="cursor-pointer text-sm font-semibold text-gray-800">
                  Lihat jawaban uraian
                </summary>
                <div className="mt-3 space-y-4">
                  {ESSAYS.map(({ key, label }) => (
                    <div key={key}>
                      <p className="text-xs font-semibold text-gray-500">
                        {label}
                      </p>
                      <p className="mt-1 whitespace-pre-line text-sm text-gray-800">
                        {form[key]}
                      </p>
                    </div>
                  ))}
                </div>
              </details>
            </section>
          </div>

          <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
            <p className="text-sm text-gray-600">
              Pengisi formulir menyatakan bahwa isian dalam formulir ini benar.
            </p>
            <CheckRow
              checked={form.declared}
              onChange={(v) => setField("declared", v)}
              label="Ya, saya telah mengisi data sebenar-benarnya."
            />
            <CheckRow
              checked={form.consent}
              onChange={(v) => setField("consent", v)}
              label="Saya setuju informasi ini dibagikan kepada konselor yang saya pilih untuk persiapan sesi."
            />
          </div>

          <div className="mt-6 flex justify-between gap-3">
            <BackButton onClick={() => goTo(4)} />
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!(form.declared && form.consent)}
              className="inline-flex items-center gap-2 rounded-full bg-[#1e5b3a] px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-[#174a2f] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Kirim Janji Temu{" "}
              <ArrowRight className="h-4 w-4" strokeWidth={2.2} />
            </button>
          </div>
        </section>
      )}

      {/* ===== 6. SELESAI ===== */}
      {step === 6 && counselor && slot && layanan && (
        <section className="mt-6">
          <div className="mx-auto max-w-xl rounded-2xl border border-[#36c08f]/40 bg-[#f7fcf9] p-6 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#1e5b3a] text-white">
              <Check className="h-7 w-7" strokeWidth={2.4} />
            </span>
            <h2 className="mt-5 font-display text-2xl font-bold">
              Janji temu dikirim
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Janji temu dengan {counselor.short.replace(/\n/g, " ")} pada{" "}
              {fmtSlot(slot)} ({layanan}) telah dikirim.
            </p>
            <p className="mt-2 text-sm text-gray-500">
              Status: menunggu konfirmasi konselor.
            </p>
            <button
              type="button"
              onClick={handleRestart}
              className="mt-6 rounded-full bg-[#1e5b3a] px-5 py-2 text-sm font-semibold text-white hover:bg-[#174a2f]"
            >
              Buat janji lain
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

/* ========================= STYLE ========================= */
const CARD = "rounded-2xl border border-gray-200 bg-white p-4 sm:p-5";
const INPUT =
  "mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-[#1e5b3a] focus:ring-4 focus:ring-[#1e5b3a]/15";
const PILL_BASE =
  "inline-flex items-center justify-center rounded-full border px-4 py-1.5 text-sm font-semibold transition";
const PILL_ON = "border-[#1e5b3a] bg-[#1e5b3a] text-white";
const PILL_OFF =
  "border-gray-300 bg-white text-gray-700 hover:border-[#1e5b3a]";

/* ========================= KOMPONEN KECIL ========================= */
function Stepper({ step }: { step: Step }) {
  return (
    <ol className="mt-6 flex items-start overflow-x-auto pb-2">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const done = n < step;
        const active = n === step;
        const last = i === STEPS.length - 1;
        return (
          <li
            key={label}
            className={`flex min-w-[88px] flex-col items-center ${i === 0 ? "items-start" : ""} ${last ? "flex-none" : "flex-1"}`}
          >
            <div className="flex w-full items-center">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  active || done
                    ? "bg-[#1e5b3a] text-white"
                    : "bg-gray-200 text-gray-500"
                }`}
              >
                {done ? "✓" : n}
              </span>
              {!last && (
                <span
                  className={`mt-0 h-0.5 flex-1 ${done ? "bg-[#1e5b3a]" : "bg-gray-200"}`}
                />
              )}
            </div>
            <span
              className={`mt-2 text-center text-[11px] font-semibold sm:text-xs ${active ? "text-[#1e5b3a]" : "text-gray-500"}`}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function LayananCard({
  selected,
  onClick,
  title,
  desc,
  art,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  desc: string;
  art: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex flex-col rounded-2xl border-2 bg-white p-4 text-left transition hover:shadow-md ${
        selected ? "border-[#1e5b3a]" : "border-gray-200"
      }`}
    >
      <div className="flex h-32 items-center justify-center rounded-xl bg-[#f7fcf9]">
        {art}
      </div>
      <div className="mt-4 flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-gray-900">{title}</p>
          <p className="mt-1 text-sm text-gray-600">{desc}</p>
        </div>
        <span
          className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
            selected ? "border-[#1e5b3a] bg-[#1e5b3a]" : "border-gray-300"
          }`}
        >
          {selected && <span className="h-2 w-2 rounded-full bg-white" />}
        </span>
      </div>
      <span className="mt-4 inline-flex w-fit items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
        <Clock className="h-3.5 w-3.5" strokeWidth={2} /> 60 menit
      </span>
    </button>
  );
}

function ArtIndividu() {
  return (
    <svg
      viewBox="0 0 120 80"
      className="h-24 w-auto"
      fill="none"
      strokeWidth={2}
    >
      <rect
        x="12"
        y="46"
        width="34"
        height="18"
        rx="6"
        fill="#a7e3c7"
        stroke="#2e9a5f"
      />
      <rect
        x="74"
        y="46"
        width="34"
        height="18"
        rx="6"
        fill="#a7e3c7"
        stroke="#2e9a5f"
      />
      <circle cx="38" cy="26" r="9" fill="#fde2c4" stroke="#1e5b3a" />
      <circle cx="86" cy="26" r="9" fill="#dbeafe" stroke="#1d4ed8" />
      <path d="M28 44c0-8 4-12 10-12s10 4 10 12" stroke="#1e5b3a" />
      <path d="M76 44c0-8 4-12 10-12s10 4 10 12" stroke="#1d4ed8" />
    </svg>
  );
}

function ArtKelompok() {
  return (
    <svg
      viewBox="0 0 120 80"
      className="h-24 w-auto"
      fill="none"
      strokeWidth={2}
    >
      <circle cx="40" cy="28" r="8" fill="#fde2c4" stroke="#1e5b3a" />
      <circle cx="60" cy="24" r="8" fill="#dbeafe" stroke="#1d4ed8" />
      <circle cx="80" cy="28" r="8" fill="#fde2c4" stroke="#1e5b3a" />
      <path
        d="M28 52c0-8 5-12 12-12s12 4 12 12M48 52c0-8 5-12 12-12s12 4 12 12M68 52c0-8 5-12 12-12s12 4 12 12"
        stroke="#2e9a5f"
      />
    </svg>
  );
}

function CalendarPicker({
  counselor,
  calMonth,
  setCalMonth,
  selDate,
  onSelectDate,
}: {
  counselor: Counselor;
  calMonth: Date;
  setCalMonth: (d: Date) => void;
  selDate: string | null;
  onSelectDate: (iso: string) => void;
}) {
  const first = firstOfMonth(calMonth);
  const daysInMonth = new Date(
    calMonth.getFullYear(),
    calMonth.getMonth() + 1,
    0,
  ).getDate();
  const offset = (first.getDay() + 6) % 7; // minggu dimulai Senin
  const minFirst = firstOfMonth(minDate());
  const maxDate = addDays(startOfToday(), MAX_AHEAD_DAYS);
  const canPrev = first.getTime() > minFirst.getTime();
  const canNext =
    new Date(first.getFullYear(), first.getMonth() + 1, 1) <= maxDate;
  const todayISO = toISO(startOfToday());
  const monthLabel = first.toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="rounded-2xl border border-gray-200 p-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() =>
            setCalMonth(new Date(first.getFullYear(), first.getMonth() - 1, 1))
          }
          disabled={!canPrev}
          aria-label="Bulan sebelumnya"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={2} />
        </button>
        <p className="font-display text-sm font-bold capitalize text-gray-900">
          {monthLabel}
        </p>
        <button
          type="button"
          onClick={() =>
            setCalMonth(new Date(first.getFullYear(), first.getMonth() + 1, 1))
          }
          disabled={!canNext}
          aria-label="Bulan berikutnya"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronRight className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-gray-500">
        {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((h) => (
          <span key={h}>{h}</span>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: offset }).map((_, i) => (
          <span key={`e${i}`} />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const iso = toISO(
            new Date(first.getFullYear(), first.getMonth(), day),
          );
          const has = slotsFor(counselor, iso).length > 0;
          const sel = selDate === iso;
          const isToday = iso === todayISO;
          return (
            <button
              key={iso}
              type="button"
              disabled={!has}
              onClick={() => onSelectDate(iso)}
              aria-label={`${fmtLong(iso)}${has ? "" : " (tidak tersedia)"}`}
              className={`relative flex h-9 items-center justify-center rounded-xl border text-sm font-semibold transition sm:h-10 ${
                sel
                  ? "border-[#1e5b3a] bg-[#1e5b3a] text-white"
                  : has
                    ? "border-[#1e5b3a]/30 bg-[#e8f9f0] text-[#1e5b3a] hover:border-[#1e5b3a]"
                    : "cursor-not-allowed border-transparent text-gray-300"
              }`}
            >
              {day}
              {isToday && (
                <span
                  className={`absolute bottom-1 h-1 w-1 rounded-full ${sel ? "bg-white" : "bg-[#1e5b3a]"}`}
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border border-[#1e5b3a]/30 bg-[#e8f9f0]" />
          Tersedia
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-[#1e5b3a]" />
          Dipilih
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1 w-1 rounded-full bg-[#1e5b3a]" />
          Hari ini
        </span>
      </div>
    </div>
  );
}

function TimePanel({
  counselor,
  selDate,
  slot,
  onSelectSlot,
}: {
  counselor: Counselor;
  selDate: string | null;
  slot: Slot | null;
  onSelectSlot: (time: string) => void;
}) {
  if (!selDate) {
    return (
      <div className="rounded-2xl border border-gray-200 p-4 md:p-5">
        <p className="text-sm text-gray-500">
          Pilih tanggal pada kalender terlebih dahulu.
        </p>
      </div>
    );
  }
  const slots = slotsFor(counselor, selDate);
  return (
    <div className="rounded-2xl border border-gray-200 p-4 md:p-5">
      <p className="text-sm font-semibold text-gray-900">{fmtLong(selDate)}</p>
      <p className="mt-1 text-xs text-gray-500">
        Pilih salah satu jam yang tersedia.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {slots.length === 0 && (
          <p className="text-sm text-gray-500">Tidak ada jam tersedia.</p>
        )}
        {slots.map((t) => {
          const on = slot?.date === selDate && slot?.time === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => onSelectSlot(t)}
              className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition ${
                on
                  ? "border-[#1e5b3a] bg-[#1e5b3a] text-white"
                  : "border-[#1e5b3a]/40 bg-[#e8f9f0] text-[#1e5b3a] hover:border-[#1e5b3a]"
              }`}
            >
              {t}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Pill({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${PILL_BASE} px-4 py-1.5 ${selected ? PILL_ON : PILL_OFF}`}
    >
      {children}
    </button>
  );
}

function ScalePill({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold transition ${
        selected ? PILL_ON : PILL_OFF
      }`}
    >
      {children}
    </button>
  );
}

function Field({
  label,
  error,
  errorText,
  children,
}: {
  label: string;
  error: boolean;
  errorText: string;
  children: ReactNode;
}) {
  return (
    <div className="mt-4">
      <label className="text-sm font-semibold text-gray-700">{label}</label>
      {children}
      {error && <ErrorText>{errorText}</ErrorText>}
    </div>
  );
}

function ErrorText({ children }: { children: ReactNode }) {
  return <p className="mt-2 text-xs font-semibold text-red-600">{children}</p>;
}

function Kv({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-gray-900">{value}</dd>
    </div>
  );
}

function CheckRow({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="mt-3 flex cursor-pointer items-start gap-3 text-sm text-gray-800">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[#1e5b3a]"
      />
      <span>{label}</span>
    </label>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-5 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
    >
      <ChevronLeft className="h-4 w-4" strokeWidth={2} /> Kembali
    </button>
  );
}

function NavButton({
  onClick,
  disabled,
  children,
  variant = "outline",
  className = "",
}: {
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
  variant?: "outline" | "solid";
  className?: string;
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40";
  const style =
    variant === "solid"
      ? "bg-[#1e5b3a] px-5 py-2.5 text-white shadow-md hover:bg-[#174a2f]"
      : "border border-[#1e5b3a] text-[#1e5b3a] hover:bg-[#e8f9f0]";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${style} ${className}`}
    >
      {children}
    </button>
  );
}
