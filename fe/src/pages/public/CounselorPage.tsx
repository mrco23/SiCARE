import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, CalendarDays, ChevronDown } from "lucide-react";
import Badge from "../../components/shared/Badge";
import { Skeleton } from "../../components/shared";
import {
  getAllPublicAvailability,
  getPublicCounselors,
  getPublicPhotoUrl,
  type PublicAvailabilitySlot,
  type PublicCounselor,
} from "../../lib/publicApi";

const WITA = "Asia/Makassar";
const dateKeyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: WITA, year: "numeric", month: "2-digit", day: "2-digit" });
const weekdayFmt = new Intl.DateTimeFormat("id-ID", { timeZone: WITA, weekday: "short" });
const dayMonthFmt = new Intl.DateTimeFormat("id-ID", { timeZone: WITA, day: "numeric", month: "short" });
const longDateFmt = new Intl.DateTimeFormat("id-ID", { timeZone: WITA, weekday: "long", day: "numeric", month: "short" });
const timeFmt = new Intl.DateTimeFormat("id-ID", { timeZone: WITA, hour: "2-digit", minute: "2-digit", hour12: false });

const MAX_VISIBLE_TOPICS = 3;

type SlotDay = { key: string; date: Date; slots: PublicAvailabilitySlot[] };

/** Kelompokkan slot per tanggal WITA, urut dari yang paling dekat. */
function groupSlotsByDay(slots: PublicAvailabilitySlot[]): SlotDay[] {
  const sorted = [...slots].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const days = new Map<string, SlotDay>();
  for (const slot of sorted) {
    const date = new Date(slot.starts_at);
    const key = dateKeyFmt.format(date);
    const day = days.get(key) ?? { key, date, slots: [] };
    day.slots.push(slot);
    days.set(key, day);
  }
  return [...days.values()];
}

function formatTime(value: string) {
  return timeFmt.format(new Date(value)).replace(":", ".");
}

function CounselorPhoto({ counselor, hasSlots }: { counselor: PublicCounselor; hasSlots: boolean }) {
  const photo = getPublicPhotoUrl(counselor.photo_path);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showPhoto = Boolean(photo && failedUrl !== photo);
  const initial = counselor.public_name.trim().charAt(0).toUpperCase();

  return (
    <div className="relative h-24 w-24 shrink-0 rounded-full bg-linear-to-br from-brand-gold to-[#f6d98a] p-[3px] sm:h-32 sm:w-32 sm:p-1 lg:h-36 lg:w-36">
      <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border-2 border-white bg-primary-tint">
        {showPhoto ? (
          <img
            src={photo ?? undefined}
            alt={`Foto ${counselor.public_name}`}
            className="h-full w-full object-cover object-top"
            loading="lazy"
            onError={() => setFailedUrl(photo)}
          />
        ) : (
          <span className="text-3xl font-bold text-primary sm:text-4xl lg:text-5xl" aria-label={`Foto ${counselor.public_name} belum tersedia`}>
            {initial}
          </span>
        )}
      </div>
      {hasSlots && (
        <span
          className="absolute bottom-1.5 right-1.5 h-4 w-4 rounded-full border-2 border-white bg-emerald-500 sm:bottom-2.5 sm:right-2.5 sm:h-5 sm:w-5"
          title="Ada jadwal tersedia"
        />
      )}
    </div>
  );
}

function ScheduleSummary({ days, total }: { days: SlotDay[]; total: number }) {
  const first = days[0]?.slots[0];
  if (!first) {
    return (
      <>
        <p className="text-xs text-gray-500">Jadwal</p>
        <p className="text-sm font-semibold text-gray-400">Belum ada jadwal</p>
      </>
    );
  }
  return (
    <>
      <p className="text-xs text-gray-500">Jadwal terdekat</p>
      <p className="text-sm font-semibold text-gray-900">
        {longDateFmt.format(new Date(first.starts_at))} · {formatTime(first.starts_at)} WITA
      </p>
      <p className="mt-0.5 text-xs font-semibold text-primary">{total} ketersediaan</p>
    </>
  );
}

function ScheduleSection({ counselor, days }: { counselor: PublicCounselor; days: SlotDay[] }) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const selected = days.find((day) => day.key === selectedKey) ?? days[0];

  return (
    <div className="min-w-0 rounded-2xl bg-primary-tint p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-[Montserrat] text-sm font-bold text-gray-900 sm:text-base">
          <CalendarDays className="h-5 w-5 text-primary" />
          Jadwal tersedia
        </h3>
        <span className="text-[11px] text-gray-500">90 hari ke depan · WITA</span>
      </div>

      {selected ? (
        <>
          <p className="mt-3 text-xs font-semibold text-gray-500">Pilih tanggal</p>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="Tanggal tersedia">
            {days.map((day) => {
              const on = day.key === selected.key;
              return (
                <button
                  key={day.key}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setSelectedKey(day.key)}
                  className={`flex shrink-0 flex-col items-center rounded-xl border px-3.5 py-2 text-center transition ${
                    on ? "border-primary bg-primary text-white" : "border-gray-200 bg-white text-gray-700 hover:border-primary"
                  }`}
                >
                  <span className="text-[11px] font-semibold uppercase">{weekdayFmt.format(day.date)}</span>
                  <span className="text-sm font-bold">{dayMonthFmt.format(day.date)}</span>
                  <span className="mt-0.5 text-[10px] opacity-80">{day.slots.length} ketersediaan</span>
                </button>
              );
            })}
          </div>

          <p className="mt-4 text-xs font-semibold text-gray-500">
            Jam tersedia · <span className="text-gray-800">{longDateFmt.format(selected.date)}</span>
          </p>
          <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {selected.slots.map((slot) => (
              <li
                key={slot.id}
                className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-center text-sm font-semibold text-gray-800"
              >
                {formatTime(slot.starts_at)} – {formatTime(slot.ends_at)}
              </li>
            ))}
          </ul>

          <Link
            to="/klien/permintaan"
            state={{ counselorProfileId: counselor.profile_id }}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-primary-dark sm:w-auto"
          >
            Booking dengan konselor ini
            <ArrowRight className="h-4 w-4" strokeWidth={2.4} />
          </Link>
          <p className="mt-2 text-[11px] text-gray-500">Kamu akan diminta masuk terlebih dahulu bila belum login.</p>
        </>
      ) : (
        <div className="mt-4 rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
          Belum ada jadwal yang tersedia untuk dipublikasikan.
        </div>
      )}
    </div>
  );
}

function CounselorCard({
  counselor,
  slots,
  initiallyOpen = false,
}: {
  counselor: PublicCounselor;
  slots: PublicAvailabilitySlot[];
  /** Dibuka otomatis bila pengunjung datang dari "Kenali Lebih Lanjut" konselor ini. */
  initiallyOpen?: boolean;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const cardRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!initiallyOpen) return;
    const frame = window.requestAnimationFrame(() =>
      cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
    return () => window.cancelAnimationFrame(frame);
  }, [initiallyOpen]);
  const contentId = useId();
  const days = useMemo(() => groupSlotsByDay(slots), [slots]);
  const topics = counselor.specialties ?? [];
  const shownTopics = topics.slice(0, MAX_VISIBLE_TOPICS);
  const extraTopics = topics.length - shownTopics.length;
  const headline = counselor.headline?.trim();
  const years = typeof counselor.years_experience === "number" ? counselor.years_experience : null;
  const bio = counselor.bio?.trim() || "Informasi profil konselor belum tersedia.";
  const summary = <ScheduleSummary days={days} total={slots.length} />;

  return (
    <article
      ref={cardRef}
      className={`scroll-mt-28 overflow-hidden rounded-2xl bg-white ring-1 ring-gray-100 transition-shadow duration-300 ${
        open ? "shadow-[0_18px_40px_rgba(6,78,59,0.12)]" : "shadow-[0_12px_32px_rgba(0,0,0,0.06)]"
      }`}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen((value) => !value)}
        className="relative flex w-full cursor-pointer flex-col items-center gap-4 p-5 text-center sm:flex-row sm:items-center sm:gap-6 sm:p-6 sm:text-left"
      >
        <CounselorPhoto counselor={counselor} hasSlots={slots.length > 0} />
        <div className="min-w-0 flex-1">
          <h2 className="font-[Montserrat] text-base font-bold leading-snug text-gray-900 sm:text-lg">
            {counselor.public_name}
          </h2>
          <p className="mt-0.5 text-sm text-gray-600">
            {headline || "Konselor SiCARE"}
            {years !== null && ` · ${years} tahun pengalaman`}
          </p>
          <div className="mt-2.5 flex flex-wrap justify-center gap-1.5 sm:justify-start">
            {shownTopics.map((topic) => (
              <Badge key={topic} tone="info">
                {topic}
              </Badge>
            ))}
            {extraTopics > 0 && <Badge tone="neutral">+{extraTopics}</Badge>}
            {topics.length === 0 && <Badge className="bg-gray-100 text-gray-500">Topik belum diisi</Badge>}
          </div>
          <div className="mt-3 rounded-xl bg-primary-tint px-3 py-2 md:hidden">{summary}</div>
        </div>
        <div className="hidden w-56 shrink-0 border-l border-gray-100 pl-6 md:block">{summary}</div>
        <span className="absolute right-4 top-4 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary sm:static sm:h-10 sm:w-10">
          <ChevronDown className={`h-5 w-5 transition-transform duration-300 ${open ? "rotate-180" : ""}`} strokeWidth={2.4} />
          <span className="sr-only">{open ? "Tutup" : "Buka"} profil dan jadwal</span>
        </span>
      </button>

      {/* Animasi buka/tutup seperti FAQ Panduan; isi tetap ter-mount agar tanggal terpilih tidak hilang. */}
      <div
        id={contentId}
        inert={!open}
        className={`grid transition-all duration-400 ease-out motion-reduce:transition-none ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="grid grid-cols-1 gap-6 border-t border-gray-100 p-4 sm:p-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-8">
            <div className="min-w-0">
              <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900">
                <span className="h-2 w-2 rounded-full bg-primary" />
                Tentang konselor
              </h3>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-gray-600">{bio}</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-primary-tint p-3">
                  <p className="text-[11px] font-semibold text-gray-500">Pengalaman</p>
                  <p className="mt-0.5 text-sm font-bold text-gray-900">{years !== null ? `${years} tahun` : "Belum diisi"}</p>
                </div>
                <div className="rounded-xl bg-primary-tint p-3">
                  <p className="text-[11px] font-semibold text-gray-500">Bidang / jabatan</p>
                  <p className="mt-0.5 text-sm font-bold text-gray-900">{headline || "Belum diisi"}</p>
                </div>
              </div>
              {topics.length > 0 && (
                <>
                  <h3 className="mt-5 flex items-center gap-2 text-sm font-bold text-gray-900">
                    <span className="h-2 w-2 rounded-full bg-primary" />
                    Topik keahlian
                  </h3>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {topics.map((topic) => (
                      <Badge key={topic} tone="info">
                        {topic}
                      </Badge>
                    ))}
                  </div>
                </>
              )}
            </div>
            <ScheduleSection counselor={counselor} days={days} />
          </div>
        </div>
      </div>
    </article>
  );
}

function CounselorListSkeleton() {
  return (
    <div role="status" aria-live="polite" className="space-y-4">
      <span className="sr-only">Memuat profil konselor dan jadwal...</span>
      {Array.from({ length: 3 }, (_, index) => (
        <div
          key={index}
          aria-hidden="true"
          className="flex flex-col items-center gap-4 rounded-2xl bg-white p-5 ring-1 ring-gray-100 sm:flex-row sm:gap-6 sm:p-6"
        >
          <Skeleton className="h-24 w-24 shrink-0 rounded-full sm:h-32 sm:w-32 lg:h-36 lg:w-36" />
          <div className="flex w-full flex-1 flex-col items-center gap-2.5 sm:items-start">
            <Skeleton className="h-5 w-2/3 sm:w-1/3" />
            <Skeleton className="h-3.5 w-1/2 sm:w-1/4" />
            <div className="flex gap-2 pt-1">
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>
          </div>
          <Skeleton className="hidden h-12 w-48 rounded-xl md:block" />
        </div>
      ))}
    </div>
  );
}

export default function CounselorPage() {
  const [searchParams] = useSearchParams();
  const focusedCounselorId = searchParams.get("konselor");
  const [counselors, setCounselors] = useState<PublicCounselor[]>([]);
  const [slots, setSlots] = useState<PublicAvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    Promise.all([
      getPublicCounselors(controller.signal),
      getAllPublicAvailability({ signal: controller.signal }),
    ])
      .then(([nextCounselors, nextSlots]) => {
        if (!active) return;
        setCounselors(nextCounselors);
        setSlots(nextSlots);
        setError(null);
      })
      .catch(() => {
        if (!active || controller.signal.aborted) return;
        setError(
          "Data konselor atau jadwal belum dapat dimuat. Periksa koneksi dan coba muat ulang halaman.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  const slotsByCounselor = useMemo(() => {
    const map = new Map<string, PublicAvailabilitySlot[]>();
    for (const slot of slots)
      map.set(slot.counselor_id, [...(map.get(slot.counselor_id) ?? []), slot]);
    return map;
  }, [slots]);

  return (
    <div className="overflow-x-hidden bg-white">
      <section className="mx-auto w-[92%] pb-6 pt-20 sm:w-[88%] md:pt-28 lg:w-[86%]">
        <h1 className="font-[Montserrat] text-2xl font-extrabold text-primary sm:text-3xl lg:text-4xl">
          Profil Konselor
        </h1>
        <p className="mt-2 text-sm text-gray-600 sm:text-base">
          Kenali konselor dan lihat jadwal yang benar-benar tersedia.
        </p>
        <div className="mt-4 h-1 w-24 rounded-full bg-primary" />
        {!loading && !error && counselors.length > 0 && (
          <p className="mt-5 inline-flex items-start gap-2 rounded-2xl bg-primary-soft px-3 py-1.5 text-xs font-semibold text-primary">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            Klik kartu untuk melihat profil lengkap dan jadwal. Beberapa kartu bisa dibuka sekaligus.
          </p>
        )}
      </section>
      <main className="mx-auto w-[92%] space-y-4 pb-16 sm:w-[88%] lg:w-[86%]">
        {loading && <CounselorListSkeleton />}
        {error && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            {error}
          </div>
        )}
        {!loading && !error && counselors.length === 0 && (
          <p className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
            Belum ada konselor yang dipublikasikan.
          </p>
        )}
        {!error &&
          counselors.map((counselor) => (
            <CounselorCard
              key={counselor.profile_id}
              counselor={counselor}
              slots={slotsByCounselor.get(counselor.profile_id) ?? []}
              initiallyOpen={counselor.profile_id === focusedCounselorId}
            />
          ))}
      </main>
    </div>
  );
}
