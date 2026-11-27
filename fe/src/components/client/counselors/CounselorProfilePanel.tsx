import { useEffect, useMemo, useRef } from "react";
import { X } from "lucide-react";
import type { ClientDirectoryCounselor, CounselorUpcomingSlot } from "../../../types/clientCounselor";
import { AvailabilityBadge, BookCounselorButton, CounselorAvatar, TopicChips } from "./CounselorCard";

const MAX_PANEL_SLOTS = 12;

/**
 * Profil lengkap konselor: panel samping di desktop, bottom sheet di ponsel.
 * Ditutup dengan tombol tutup, klik latar, atau tombol Escape.
 */
export function CounselorProfilePanel({
  counselor,
  onClose,
}: {
  counselor: ClientDirectoryCounselor;
  onClose: () => void;
}) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const subtitle = counselor.headline || counselor.bio;
  const showBio = Boolean(counselor.bio) && counselor.bio !== subtitle;
  const slots = counselor.upcomingSlots;
  const hiddenSlots = slots.length - MAX_PANEL_SLOTS;

  const slotGroups = useMemo(() => {
    const groups: { dateKey: string; dateLabel: string; slots: CounselorUpcomingSlot[] }[] = [];
    for (const slot of slots.slice(0, MAX_PANEL_SLOTS)) {
      const last = groups[groups.length - 1];
      if (last && last.dateKey === slot.dateKey) last.slots.push(slot);
      else groups.push({ dateKey: slot.dateKey, dateLabel: slot.dateLabel, slots: [slot] });
    }
    return groups;
  }, [slots]);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-labelledby="counselor-profile-title">
      <div className="absolute inset-0 bg-gray-900/40" onClick={onClose} aria-hidden="true" />
      <aside className="counselor-panel-enter absolute inset-x-0 bottom-0 flex max-h-[90vh] flex-col rounded-t-3xl bg-white shadow-2xl md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[440px] md:rounded-none md:rounded-l-3xl">
        <div aria-hidden="true" className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-gray-200 md:hidden" />

        <div className="flex-1 overflow-y-auto">
          <div className="flex items-start gap-4 p-5 pb-4">
            <CounselorAvatar counselor={counselor} className="h-20 w-20 text-2xl" />
            <div className="min-w-0 flex-1">
              <h2 id="counselor-profile-title" className="font-display text-lg font-bold leading-snug text-gray-900">
                {counselor.name}
              </h2>
              {subtitle && <p className="mt-0.5 text-sm font-medium text-emerald-800">{subtitle}</p>}
              <div className="mt-2">
                <AvailabilityBadge count={slots.length} />
              </div>
            </div>
            <button
              ref={closeButton}
              type="button"
              onClick={onClose}
              aria-label="Tutup profil konselor"
              className="-mr-1 rounded-full p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus:ring-4 focus:ring-primary/15"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-6 px-5 pb-6">
            {showBio && (
              <section>
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Tentang</h3>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-gray-700">{counselor.bio}</p>
              </section>
            )}

            {(counselor.experience || counselor.education.length > 0) && (
              <section>
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Latar belakang</h3>
                <ol className="mt-3 space-y-3 border-l-2 border-emerald-100 pl-4">
                  {counselor.experience && (
                    <li className="relative">
                      <span aria-hidden="true" className="absolute -left-[23px] top-1.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-4 ring-white" />
                      <p className="text-sm font-semibold text-gray-900">{counselor.experience} pengalaman praktik</p>
                    </li>
                  )}
                  {counselor.education.map((item) => (
                    <li key={`${item.school}-${item.year}-${item.degree}`} className="relative">
                      <span aria-hidden="true" className="absolute -left-[23px] top-1.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-4 ring-white" />
                      <p className="text-sm font-semibold text-gray-900">{item.degree}</p>
                      <p className="text-sm text-gray-500">
                        {item.school}
                        {item.year ? ` · ${item.year}` : ""}
                      </p>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            <section>
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Topik keahlian</h3>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <TopicChips topics={counselor.topics} />
              </div>
            </section>

            <section>
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Jadwal terdekat</h3>
                <p className="text-[11px] text-gray-400">Sesi 1 jam · WITA</p>
              </div>
              {slotGroups.length > 0 ? (
                <>
                  {slotGroups.map((group) => (
                    <div key={group.dateKey} className="mt-3">
                      <p className="text-sm font-semibold text-gray-800">{group.dateLabel}</p>
                      <ul className="mt-1.5 flex flex-wrap gap-2">
                        {group.slots.map((slot) => (
                          <li
                            key={slot.id}
                            className="rounded-xl border border-emerald-200 px-3 py-1.5 text-sm font-semibold text-primary"
                          >
                            {slot.timeLabel}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                  {hiddenSlots > 0 && (
                    <p className="mt-3 text-xs text-gray-500">
                      +{hiddenSlots} jadwal lain dapat dipilih di halaman pemesanan.
                    </p>
                  )}
                </>
              ) : (
                <p className="mt-2 rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-500">
                  Belum ada jadwal terbuka. Konselor menambah jadwal secara berkala.
                </p>
              )}
            </section>
          </div>
        </div>

        <div className="border-t border-gray-100 p-4">
          <BookCounselorButton counselor={counselor} className="w-full" />
        </div>
      </aside>
    </div>
  );
}
