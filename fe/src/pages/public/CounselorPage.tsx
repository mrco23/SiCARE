import { useEffect, useMemo, useState } from "react";
import { BriefcaseBusiness, CalendarDays, GraduationCap } from "lucide-react";
import {
  getPublicAcademicPeriods,
  getPublicAvailability,
  getPublicCounselors,
  getPublicPhotoUrl,
  type PublicAcademicPeriod,
  type PublicAvailabilitySlot,
  type PublicCounselor,
} from "../../lib/publicApi";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  }).format(new Date(value));
}

function CounselorCard({ counselor, slots }: { counselor: PublicCounselor; slots: PublicAvailabilitySlot[] }) {
  const description = counselor.bio?.trim() || counselor.headline?.trim() || "Informasi profil konselor belum tersedia.";
  const photo = getPublicPhotoUrl(counselor.photo_path);
  return (
    <article className="overflow-hidden rounded-2xl bg-white shadow-[0_12px_32px_rgba(0,0,0,0.06)] ring-1 ring-gray-100">
      <div className="grid gap-6 p-4 sm:p-6 md:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] md:items-center md:gap-8 lg:p-8">
        <div className="flex aspect-square w-full max-w-60 items-center justify-center overflow-hidden rounded-xl bg-primary-tint md:max-w-none">
          {photo ? <img src={photo} alt={`Foto ${counselor.public_name}`} className="h-full w-full object-cover object-top" loading="lazy" /> : <span className="text-6xl font-bold text-primary" aria-label={`Foto ${counselor.public_name} belum tersedia`}>{counselor.public_name.trim().charAt(0).toUpperCase()}</span>}
        </div>
        <div>
          <span className="inline-block rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800 sm:text-sm">Profil Konselor</span>
          <h2 className="mt-3 font-[Montserrat] text-xl font-bold leading-snug text-gray-900 sm:text-2xl">{counselor.public_name}</h2>
          <p className="mt-3 text-sm leading-relaxed text-gray-600">{description}</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="flex gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-800"><BriefcaseBusiness className="h-4 w-4" /></span>
              <div><p className="text-xs font-semibold text-gray-500">Pengalaman</p><p className="mt-1 text-sm font-semibold text-gray-900">{typeof counselor.years_experience === "number" ? `${counselor.years_experience} tahun` : "Belum diisi"}</p></div>
            </div>
            <div className="flex gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-800"><GraduationCap className="h-4 w-4" /></span>
              <div><p className="text-xs font-semibold text-gray-500">Bidang / jabatan</p><p className="mt-1 text-sm font-semibold text-gray-900">{counselor.headline?.trim() || "Belum diisi"}</p></div>
            </div>
          </div>
          {(counselor.specialties ?? []).length > 0 && <div className="mt-5"><h3 className="text-sm font-bold text-gray-900">Topik keahlian</h3><div className="mt-2 flex flex-wrap gap-2">{(counselor.specialties ?? []).map((topic) => <span key={topic} className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">{topic}</span>)}</div></div>}
        </div>
      </div>
      <div className="border-t border-gray-100 bg-primary-tint p-4 sm:p-6 lg:p-8">
        <div className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-primary"/><h3 className="font-[Montserrat] text-base font-bold text-gray-900 sm:text-lg">Jadwal tersedia (90 hari ke depan)</h3></div>
        {slots.length ? <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{slots.map((slot) => <li key={slot.id} className="rounded-lg border border-gray-200 bg-white p-3 text-sm"><p className="font-semibold text-gray-900">{formatDateTime(slot.starts_at)}</p><p className="mt-1 text-xs text-gray-500">Sampai {new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit" }).format(new Date(slot.ends_at))}</p></li>)}</ul> : <p className="mt-3 text-sm text-gray-500">Belum ada jadwal yang tersedia untuk dipublikasikan.</p>}
      </div>
    </article>
  );
}

export default function CounselorPage() {
  const [counselors, setCounselors] = useState<PublicCounselor[]>([]);
  const [slots, setSlots] = useState<PublicAvailabilitySlot[]>([]);
  const [periods, setPeriods] = useState<PublicAcademicPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    Promise.all([
      getPublicCounselors(controller.signal),
      getPublicAvailability({ signal: controller.signal, limit: 100 }),
      getPublicAcademicPeriods(controller.signal),
    ]).then(([nextCounselors, nextSlots, nextPeriods]) => {
      if (!active) return;
      setCounselors(nextCounselors);
      setSlots(nextSlots);
      setPeriods(nextPeriods);
      setError(null);
    }).catch(() => {
      if (!active || controller.signal.aborted) return;
      setError("Data konselor atau jadwal belum dapat dimuat. Periksa koneksi dan coba muat ulang halaman.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, []);

  const slotsByCounselor = useMemo(() => {
    const map = new Map<string, PublicAvailabilitySlot[]>();
    for (const slot of slots) map.set(slot.counselor_id, [...(map.get(slot.counselor_id) ?? []), slot]);
    return map;
  }, [slots]);

  return (
    <div className="overflow-x-hidden bg-white">
      <section className="mx-auto w-[92%] pb-8 pt-20 sm:w-[88%] md:pt-28 lg:w-[86%]">
        <h1 className="font-[Montserrat] text-2xl font-extrabold text-primary sm:text-3xl lg:text-4xl">Profil Konselor</h1>
        <p className="mt-2 text-sm text-gray-600 sm:text-base">Kenali konselor dan lihat jadwal yang benar-benar tersedia.</p>
        {periods.length > 0 && <p className="mt-3 text-sm text-gray-600">Periode akademik dipublikasikan: {periods.map((period) => `${period.academic_year} · ${period.semester}`).join(", ")}</p>}
        <div className="mt-4 h-1 w-24 rounded-full bg-primary" />
      </section>
      <main className="mx-auto w-[92%] space-y-10 pb-12 sm:w-[88%] lg:w-[86%]">
        {loading && <p role="status" className="text-sm text-gray-500">Memuat profil konselor dan jadwal...</p>}
        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
        {!loading && !error && counselors.length === 0 && <p className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">Belum ada konselor yang dipublikasikan.</p>}
        {!error && counselors.map((counselor) => <CounselorCard key={counselor.profile_id} counselor={counselor} slots={slotsByCounselor.get(counselor.profile_id) ?? []} />)}
      </main>
    </div>
  );
}
