import { Link } from "react-router-dom";
import { ArrowRight, Briefcase, GraduationCap } from "lucide-react";
import type { ClientDirectoryCounselor } from "../../../types/clientCounselor";

const VISIBLE_TOPICS = 3;
const VISIBLE_SLOTS = 3;

export function CounselorAvatar({
  counselor,
  className = "h-16 w-16 text-lg",
}: {
  counselor: ClientDirectoryCounselor;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary font-bold text-white shadow-sm ${className}`}
    >
      {counselor.photoUrl ? (
        <img
          src={counselor.photoUrl}
          alt=""
          className="h-full w-full object-cover object-top"
          loading="lazy"
        />
      ) : (
        counselor.initials
      )}
    </div>
  );
}

export function AvailabilityBadge({ count }: { count: number }) {
  if (count === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-500">
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-gray-400" />
        Belum ada jadwal
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-100">
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      {count} jadwal tersedia
    </span>
  );
}

export function TopicChips({ topics, max }: { topics: string[]; max?: number }) {
  if (topics.length === 0) {
    return <span className="text-xs text-gray-400">Topik keahlian belum dicantumkan</span>;
  }
  const shown = max ? topics.slice(0, max) : topics;
  const rest = topics.length - shown.length;
  return (
    <>
      {shown.map((topic) => (
        <span
          key={topic}
          className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-900"
        >
          {topic}
        </span>
      ))}
      {rest > 0 && (
        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">
          +{rest} topik
        </span>
      )}
    </>
  );
}

export function BookCounselorButton({
  counselor,
  className = "",
}: {
  counselor: ClientDirectoryCounselor;
  className?: string;
}) {
  if (counselor.upcomingSlots.length === 0) {
    return (
      <span
        aria-disabled="true"
        className={`inline-flex cursor-not-allowed items-center justify-center rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-semibold text-gray-400 ${className}`}
      >
        Belum ada jadwal
      </span>
    );
  }
  return (
    <Link
      to="/klien/permintaan"
      state={{ counselorProfileId: counselor.entityId }}
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark focus:outline-none focus:ring-4 focus:ring-primary/20 ${className}`}
    >
      Buat janji
      <ArrowRight className="h-4 w-4" strokeWidth={2.2} />
    </Link>
  );
}

export function CounselorCard({
  counselor,
  onOpenProfile,
}: {
  counselor: ClientDirectoryCounselor;
  onOpenProfile: (counselor: ClientDirectoryCounselor) => void;
}) {
  const subtitle = counselor.headline || counselor.bio;
  const latestEducation = counselor.education[0];
  const slots = counselor.upcomingSlots;
  const hiddenSlots = slots.length - VISIBLE_SLOTS;

  return (
    <article className="flex h-full flex-col rounded-3xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start gap-4">
        <CounselorAvatar counselor={counselor} />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-[15px] font-bold leading-snug text-gray-900">
            {counselor.name}
          </h2>
          {subtitle && (
            <p className="mt-0.5 line-clamp-2 text-sm font-medium text-emerald-800">
              {subtitle}
            </p>
          )}
          <div className="mt-2">
            <AvailabilityBadge count={slots.length} />
          </div>
        </div>
      </div>

      {(counselor.experience || latestEducation) && (
        <div className="mt-4 flex flex-col gap-1.5 text-xs text-gray-600">
          {counselor.experience && (
            <span className="flex items-center gap-2">
              <Briefcase aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={2} />
              {counselor.experience} pengalaman
            </span>
          )}
          {latestEducation && (
            <span className="flex min-w-0 items-center gap-2" title={`${latestEducation.degree} · ${latestEducation.school}`}>
              <GraduationCap aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={2} />
              <span className="truncate">
                {latestEducation.degree} · {latestEducation.school}
              </span>
            </span>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-1.5">
        <TopicChips topics={counselor.topics} max={VISIBLE_TOPICS} />
      </div>

      <div className="mt-5 flex-1 rounded-2xl bg-gray-50 p-3">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Jadwal terdekat</p>
          <p className="text-[11px] text-gray-400">Sesi 1 jam · WITA</p>
        </div>
        {slots.length > 0 ? (
          <>
            <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-2 2xl:grid-cols-3">
              {slots.slice(0, VISIBLE_SLOTS).map((slot) => (
                <li
                  key={slot.id}
                  className="flex flex-col rounded-xl border border-emerald-200 bg-white px-3 py-2"
                >
                  <span className="text-[11px] font-semibold text-gray-500">{slot.dateLabel}</span>
                  <span className="text-sm font-bold text-primary">{slot.timeLabel}</span>
                </li>
              ))}
            </ul>
            {hiddenSlots > 0 && (
              <button
                type="button"
                onClick={() => onOpenProfile(counselor)}
                className="mt-2 text-xs font-semibold text-primary hover:underline"
              >
                Lihat {hiddenSlots} jadwal lainnya
              </button>
            )}
          </>
        ) : (
          <p className="mt-1.5 text-sm leading-relaxed text-gray-500">
            Konselor belum membuka jadwal. Coba cek lagi nanti atau pilih konselor lain.
          </p>
        )}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onOpenProfile(counselor)}
          className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-4 focus:ring-primary/15"
        >
          Lihat profil
        </button>
        <BookCounselorButton counselor={counselor} />
      </div>
    </article>
  );
}
