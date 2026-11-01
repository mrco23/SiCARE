import { PageHeader } from "../../components/shared";
import {
  BackButton,
  CheckRow,
  ErrorText,
  Field,
  Kv,
  LayananCard,
  ArtIndividu,
  ArtKelompok,
  NavButton,
  Pill,
  ScalePill,
  Stepper,
} from "../../components/client/booking/BookingFormControls";
import type { CounselingFormat, IntakeAnswer } from "../../types/counseling";
import {
  CalendarPicker,
  TimePanel,
} from "../../components/client/booking/BookingCalendar";
import {
  firstOfMonth,
  formatBookingSlot as fmtSlot,
  minBookingDate as minDate,
  MAX_AHEAD_DAYS,
  type BookingSlot as Slot,
} from "../../features/booking/utils/clientBookingCalendar";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  ArrowRight,
  Check,
  GraduationCap,
  Lock,
  MapPin,
  Search,
} from "lucide-react";
import type { BookingCounselor } from "../../data/mock/clientCounselors";
import { sicareApi } from "../../lib/sicareApi";
import {
  getPublicAvailability,
  getPublicCounselors,
  type PublicAvailabilitySlot,
  type PublicCounselor,
} from "../../lib/publicApi";
import { ApiError } from "../../lib/api";
import { useAuth } from "../../features/auth/useAuth";
import {
  INTAKE_TOPICS as TOPICS,
  INTAKE_YESNO_OPTIONS as YESNO,
  INTAKE_SCALE_OPTIONS as SCALES,
  INTAKE_ESSAY_OPTIONS as ESSAYS,
} from "../../data/mock/intakeOptions";
import {
  createEmptyClientIntakeForm,
  validateClientIntakeForm,
  type ClientIntakeForm as IntakeForm,
} from "../../features/booking/utils/clientIntakeForm";
import { normalizePhoneToE164 } from "../../features/client/profile/profileValidation";

/* ========================= TIPE ========================= */
type Step = 1 | 2 | 3 | 4 | 5 | 6; // 6 = selesai

/* ========================= DATA (contoh) ========================= */
// Di produksi, ambil dari API. Jadwal dan keahlian berasal dari profil konselor.
const STEPS = [
  "Jenis Layanan",
  "Pilih Konselor",
  "Pilih Jadwal",
  "Form Awal",
  "Persetujuan",
];

const ANSWER_STYLE: Record<IntakeAnswer, string> = {
  Ya: "bg-red-100 text-red-800",
  Mungkin: "bg-amber-100 text-amber-800",
  Tidak: "bg-primary-soft text-primary",
};

/* ========================= HALAMAN ========================= */
function localDateISO(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function localTime(value: string) {
  return new Date(value).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
function mapBookingCounselors(
  profiles: PublicCounselor[],
  slots: PublicAvailabilitySlot[],
): BookingCounselor[] {
  return profiles.map((profile, index) => {
    const availabilityByDate: Record<string, string[]> = {};
    slots
      .filter((slot) => slot.counselor_id === profile.profile_id)
      .forEach((slot) => {
        const date = localDateISO(slot.starts_at);
        const time = localTime(slot.starts_at);
        availabilityByDate[date] = [...(availabilityByDate[date] ?? []), time];
      });
    const specialties = profile.specialties ?? [];
    return {
      id: index + 1,
      entityId: profile.profile_id,
      key: index === 0 ? "GY" : "RW",
      name: profile.public_name,
      historyName: profile.public_name,
      initials: profile.public_name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase(),
      profileId: profile.profile_id,
      availabilityByDate,
      short: profile.public_name,
      gender: "Tidak dicantumkan",
      degree: profile.headline ?? "Belum dicantumkan",
      experience:
        profile.years_experience == null
          ? "Pengalaman belum dicantumkan"
          : `${profile.years_experience} tahun pengalaman`,
      room: "Ditentukan saat konfirmasi",
      focus: profile.headline ?? "",
      about: profile.bio ?? "Informasi profil belum tersedia.",
      skills: specialties,
      schedule: {},
    };
  });
}

export default function KlienPesananPage() {
  const { profile } = useAuth();
  const location = useLocation();
  const preselectedProfileId =
    (location.state as { counselorProfileId?: string } | null)
      ?.counselorProfileId ?? null;
  const submissionLock = useRef(false);
  const [counselors, setCounselors] = useState<BookingCounselor[]>([]);
  const [availabilitySlots, setAvailabilitySlots] = useState<
    PublicAvailabilitySlot[]
  >([]);
  const [directoryLoading, setDirectoryLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [step, setStep] = useState<Step>(1);
  const [layanan, setLayanan] = useState<CounselingFormat | null>(null);
  const [konselorId, setKonselorId] = useState<number | null>(null);
  const [q, setQ] = useState("");
  const [spesialis, setSpesialis] = useState("");
  const [calMonth, setCalMonth] = useState<Date>(() => firstOfMonth(minDate()));
  const [selDate, setSelDate] = useState<string | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [form, setForm] = useState<IntakeForm>(createEmptyClientIntakeForm);
  const [missing, setMissing] = useState<string[]>([]);
  const [formError, setFormError] = useState(false);

  useEffect(() => {
    let active = true;
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() + 1);
    fromDate.setHours(0, 0, 0, 0);
    const toDate = new Date();
    toDate.setDate(toDate.getDate() + MAX_AHEAD_DAYS);
    Promise.all([
      getPublicCounselors(),
      getPublicAvailability({ from: fromDate, to: toDate, limit: 100 }),
    ])
      .then(([profiles, slots]) => {
        if (!active) return;
        const mapped = mapBookingCounselors(profiles, slots);
        setAvailabilitySlots(slots);
        setCounselors(mapped);
        if (preselectedProfileId) {
          const matched = mapped.find(
            (c) => c.entityId === preselectedProfileId,
          );
          if (matched) {
            setKonselorId((prev) => prev ?? matched.id);
          }
        }
      })
      .catch((cause: unknown) => {
        if (active)
          setRequestError(
            cause instanceof ApiError || cause instanceof Error
              ? cause.message
              : "Jadwal konselor tidak dapat dimuat.",
          );
      })
      .finally(() => {
        if (active) setDirectoryLoading(false);
      });
    return () => {
      active = false;
    };
  }, [preselectedProfileId]);

  const COUNSELORS = counselors;
  const counselor = COUNSELORS.find((c) => c.id === konselorId) ?? null;
  const specialtyOptions = [
    ...new Set(COUNSELORS.flatMap((item) => item.skills)),
  ].sort((a, b) => a.localeCompare(b));

  const filteredCounselors = useMemo(() => {
    const term = q.trim().toLowerCase();
    return COUNSELORS.filter(
      (c) =>
        (!term || c.name.toLowerCase().includes(term)) &&
        (!spesialis || c.skills.includes(spesialis)),
    );
  }, [COUNSELORS, q, spesialis]);

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

  // Jawaban intake tetap lokal; helper hanya memvalidasi dan tidak menyimpan datanya.
  const validate = (): string[] => validateClientIntakeForm(form, layanan);

  const handleNextFromForm = () => {
    const miss = validate();
    if (layanan === "Kelompok") {
      const memberLines = form.groupMembers
        .split(/\r?\n/)
        .map((name) => name.trim())
        .filter(Boolean);
      if (memberLines.length !== Number(form.groupSize) - 1) {
        miss.push("groupMembers");
      } else {
        const hasInvalidPhone = memberLines.some((line) => {
          const parts = line
            .split(/[,;\t]|\s+-\s+/)
            .map((p) => p.trim())
            .filter(Boolean);
          let phone = parts.length > 1 ? parts[1] : null;
          if (!phone) {
            const match = line.match(
              /^(.*?)\s+((?:\+62|62|08)[0-9\s-]{7,15})$/,
            );
            if (match) phone = match[2].trim();
          }
          return !phone || !normalizePhoneToE164(phone);
        });
        if (hasInvalidPhone) miss.push("groupMembers");
      }
    }
    setMissing([...new Set(miss)]);
    setFormError(miss.length > 0);
    if (miss.length === 0) goTo(5);
  };

  const handleSubmit = async () => {
    if (!counselor || !slot || !layanan || submissionLock.current) return;
    const selectedAvailability = availabilitySlots.find(
      (candidate) =>
        candidate.counselor_id === counselor.entityId &&
        localDateISO(candidate.starts_at) === slot.date &&
        localTime(candidate.starts_at) === slot.time &&
        candidate.status === "available",
    );
    if (!selectedAvailability) {
      setRequestError(
        "Jadwal yang dipilih sudah tidak tersedia. Muat ulang halaman dan pilih jadwal lain.",
      );
      return;
    }
    const groupMemberLines = form.groupMembers
      .split(/\r?\n/)
      .map((name) => name.trim())
      .filter(Boolean);
    if (
      layanan === "Kelompok" &&
      groupMemberLines.length !== Number(form.groupSize) - 1
    ) {
      setMissing((previous) => [...new Set([...previous, "groupMembers"])]);
      setRequestError(
        "Jumlah nama anggota harus sama dengan jumlah peserta dikurangi satu, karena jumlah peserta sudah termasuk kamu.",
      );
      return;
    }

    let parsedGroupParticipants: Array<{
      display_name: string;
      full_name: string;
      phone_e164: string | null;
      is_representative: boolean;
    }> = [];

    if (layanan === "Kelompok") {
      parsedGroupParticipants = groupMemberLines.map((line) => {
        const parts = line
          .split(/[,;\t]|\s+-\s+/)
          .map((p) => p.trim())
          .filter(Boolean);
        let name = parts[0] || line.trim();
        let phone = parts.length > 1 ? parts[1] : null;
        if (!phone) {
          const match = line.match(/^(.*?)\s+((?:\+62|62|08)[0-9\s-]{7,15})$/);
          if (match) {
            name = match[1].trim();
            phone = match[2].trim();
          }
        }
        const phoneE164 = phone ? normalizePhoneToE164(phone) : null;
        return {
          display_name: name,
          full_name: name,
          phone_e164: phoneE164,
          is_representative: false,
        };
      });

      const invalidMember = parsedGroupParticipants.find((p) => !p.phone_e164);
      if (invalidMember) {
        setMissing((previous) => [...new Set([...previous, "groupMembers"])]);
        setRequestError(
          `Nomor WhatsApp untuk anggota "${invalidMember.display_name}" tidak valid atau belum diisi. Format per baris: Nama Lengkap, Nomor WhatsApp (contoh: ${invalidMember.display_name}, 081234567890).`,
        );
        return;
      }
    }

    const representativeParticipant = {
      display_name: profile?.full_name?.trim() || "Perwakilan klien",
      full_name: profile?.full_name?.trim() || "Perwakilan klien",
      phone_e164: profile?.phone_e164
        ? normalizePhoneToE164(profile.phone_e164)
        : null,
      is_representative: true,
    };

    submissionLock.current = true;
    setIsSubmitting(true);
    setRequestError("");
    try {
      await sicareApi.createBooking({
        counselor_id: counselor.entityId,
        availability_slot_id: selectedAvailability.id,
        service_type: layanan === "Kelompok" ? "group" : "individual",
        ...(layanan === "Kelompok"
          ? {
              group_name: form.groupName.trim(),
              participants: [
                representativeParticipant,
                ...parsedGroupParticipants,
              ],
            }
          : { group_name: null, participants: [] }),
      });
      goTo(6);
    } catch (cause) {
      submissionLock.current = false;
      setRequestError(
        cause instanceof ApiError || cause instanceof Error
          ? cause.message
          : "Permintaan booking tidak dapat dikirim.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRestart = () => {
    submissionLock.current = false;
    setIsSubmitting(false);
    setStep(1);
    setLayanan(null);
    setKonselorId(null);
    setSlot(null);
    setSelDate(null);
    setCalMonth(firstOfMonth(minDate()));
    setForm(createEmptyClientIntakeForm());
    setMissing([]);
    setFormError(false);
    setRequestError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div>
      <PageHeader
        title="Booking Jadwal Konseling"
        description="Langkah mudah untuk mendapatkan dukungan yang kamu butuhkan."
      />
      {requestError && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {requestError}
        </p>
      )}
      {directoryLoading && (
        <p className="mt-4 rounded-xl bg-white p-3 text-sm text-slate-600">
          Memuat konselor dan jadwal dari backend...
        </p>
      )}

      {step <= 5 && <Stepper step={step} steps={STEPS} />}

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
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                <Lock className="h-5 w-5" strokeWidth={2} />
              </span>
              <div>
                <p className="font-semibold text-gray-900">Privasi Terjaga</p>
                <p className="text-sm text-gray-600">
                  Formulir awal belum terhubung ke penyimpanan backend. Jawaban
                  tidak dikirim kepada konselor dan hanya tersedia sementara di
                  halaman ini.
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
                className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-12 pr-4 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/15"
              />
            </div>
            <select
              value={spesialis}
              onChange={(e) => setSpesialis(e.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary"
            >
              <option value="">Semua Spesialis</option>
              {specialtyOptions.map((s) => (
                <option key={s}>{s}</option>
              ))}
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
                  className={`flex flex-col rounded-2xl border-2 bg-white p-4 text-left transition hover:shadow-md ${on ? "border-primary" : "border-gray-200"}`}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary-soft font-bold text-primary">
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
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-white">
                        <Check className="h-3.5 w-3.5" strokeWidth={3} />
                      </span>
                    )}
                  </div>
                  <p className="mt-4 text-sm text-gray-600">{c.focus}</p>
                  <span
                    className={`mt-4 inline-flex w-fit rounded-full px-4 py-1 text-xs font-semibold ${
                      on
                        ? "bg-primary text-white"
                        : "border border-primary text-primary"
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
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-primary-soft text-2xl font-bold text-primary sm:h-24 sm:w-24">
                  {counselor.initials}
                </div>
                <div className="min-w-0">
                  <p className="whitespace-pre-line font-display text-lg font-bold leading-snug">
                    {counselor.short}
                  </p>
                  <p className="mt-2 flex items-center gap-2 text-sm text-gray-600">
                    <GraduationCap
                      className="h-4 w-4 text-primary"
                      strokeWidth={2}
                    />
                    {counselor.degree}
                  </p>
                  <p className="mt-1 flex items-center gap-2 text-sm text-gray-600">
                    <MapPin className="h-4 w-4 text-primary" strokeWidth={2} />
                    {counselor.room}
                  </p>
                </div>
              </div>
              <div className="md:w-1/2">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  Tentang Konselor
                </div>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">
                  {counselor.about}
                </p>
                <div className="mt-5 flex items-center gap-2 text-sm font-semibold text-gray-900">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  Keahlian
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {counselor.skills.map((s) => (
                    <span
                      key={s}
                      className="rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary"
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
            Formulir ini membantu kamu merangkum kebutuhan sebelum sesi. Saat
            ini jawaban belum disimpan atau dikirim kepada konselor melalui
            sistem SiCARE.
          </p>
          <div
            role="note"
            className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900"
          >
            Demi privasi, jawaban formulir awal hanya berada sementara di
            halaman ini. Jawaban akan hilang saat alur direset atau halaman
            ditutup. Jangan mengandalkan formulir ini untuk menyampaikan
            informasi yang membutuhkan tindak lanjut segera. Sampaikan kebutuhan
            penting secara langsung kepada konselor.
          </div>

          <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
            {[
              `Konseling ${layanan}`,
              counselor.short.replace(/\n/g, " "),
              fmtSlot(slot),
            ].map((t) => (
              <span
                key={t}
                className="rounded-full bg-primary-soft px-3 py-1 text-primary"
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
                  label="Daftar Anggota Kelompok & No. WhatsApp"
                  error={missing.includes("groupMembers")}
                  errorText="Wajib diisi sesuai jumlah anggota dengan format: Nama Lengkap, Nomor WhatsApp."
                >
                  <p className="mb-2 text-xs text-gray-500">
                    Tuliskan satu anggota per baris dengan format:{" "}
                    <strong>Nama Lengkap, Nomor WhatsApp</strong>. Setiap
                    anggota akan menerima tautan persetujuan digital via
                    WhatsApp.
                  </p>
                  <textarea
                    rows={4}
                    maxLength={800}
                    value={form.groupMembers}
                    onChange={(e) => setField("groupMembers", e.target.value)}
                    placeholder="Contoh:&#10;Budi Santoso, 081234567890&#10;Siti Rahma, 089876543210"
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
                      {(["Ya", "Mungkin", "Tidak"] as IntakeAnswer[]).map(
                        (v) => (
                          <Pill
                            key={v}
                            selected={form[key] === v}
                            onClick={() => setField(key, v)}
                          >
                            {v}
                          </Pill>
                        ),
                      )}
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
                <Kv label="Ruangan" value="Ditentukan saat konfirmasi" />
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
                  className="text-sm font-semibold text-primary hover:underline"
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
              label="Saya memahami jawaban formulir awal belum disimpan atau dikirim kepada konselor melalui sistem ini."
            />
          </div>

          <div className="mt-6 flex justify-between gap-3">
            <BackButton onClick={() => goTo(4)} />
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={
                !(form.declared && form.consent) ||
                isSubmitting ||
                directoryLoading ||
                !counselor ||
                !slot ||
                !layanan
              }
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isSubmitting ? "Mengirim..." : "Kirim Janji Temu"}{" "}
              <ArrowRight className="h-4 w-4" strokeWidth={2.2} />
            </button>
          </div>
        </section>
      )}

      {/* ===== 6. SELESAI ===== */}
      {step === 6 && counselor && slot && layanan && (
        <section className="mt-6">
          <div className="mx-auto max-w-xl rounded-2xl border border-[#36c08f]/40 bg-primary-tint p-6 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white">
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
            <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-left text-xs leading-relaxed text-amber-900">
              Catatan: jawaban formulir awal tidak ikut dikirim bersama booking
              dan tidak tersedia bagi konselor. Sampaikan informasi yang
              diperlukan secara langsung kepada konselor saat sesi.
            </p>
            <button
              type="button"
              onClick={handleRestart}
              className="mt-6 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary-dark"
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
  "mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/15";
