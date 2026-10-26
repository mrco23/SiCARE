import { Link } from "react-router-dom";
import { ArrowRight, Briefcase, GraduationCap } from "lucide-react";
import type { ClientDirectoryCounselor } from "../../../data/mock/clientCounselors";

const DAYS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"] as const;






function CounselorSchedule({
  schedule,
}: {
  schedule: Record<string, string[]>;
}) {
  return (
    <div className="mt-3 divide-y divide-gray-100 rounded-2xl border border-gray-200 px-4">
      {DAYS.map((day) => {
        const slots = schedule[day] || [];

        return (
          <div
            key={day}
            className="flex items-start justify-between gap-3 py-3 sm:items-center"
          >
            <span className="w-16 shrink-0 text-sm font-medium text-gray-800">
              {day}
            </span>
            <div className="flex min-w-0 flex-1 flex-wrap justify-end gap-1.5 sm:justify-start">
              {slots.length > 0 ? (
                slots.map((slot) => (
                  <span
                    key={slot}
                    className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700"
                  >
                    {slot}
                  </span>
                ))
              ) : (
                <span className="text-xs text-gray-400">Tidak tersedia</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function CounselorCard({ counselor }: { counselor: ClientDirectoryCounselor }) {
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md">
      <div className="flex items-center gap-4 border-b border-gray-100 p-5">
        <div
          aria-hidden="true"
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary text-lg font-bold text-white"
        >
          {counselor.initials}
        </div>
        <div className="min-w-0">
          <span className="inline-block rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700">
            Profil Konselor
          </span>
          <h2 className="mt-1.5 font-display text-base font-bold leading-snug text-gray-900">
            {counselor.name}
          </h2>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-5 p-5">
        <p className="text-sm leading-relaxed text-gray-600">
          {counselor.about}
        </p>

        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
              <GraduationCap className="h-4 w-4" strokeWidth={1.8} />
            </span>
            <div className="min-w-0 space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                Pendidikan
              </p>
              {counselor.education.map((item) => (
                <div key={`${item.school}-${item.year}-${item.degree}`}>
                  <p className="text-sm font-semibold text-gray-900">
                    {item.school}{" "}
                    <span className="font-normal text-gray-400">
                      · {item.year}
                    </span>
                  </p>
                  <p className="text-sm text-gray-500">{item.degree}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-start gap-3 sm:pl-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
              <Briefcase className="h-4 w-4" strokeWidth={1.8} />
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                Pengalaman
              </p>
              <p className="text-sm font-semibold text-gray-900">
                {counselor.experience}
              </p>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-bold text-gray-900">Topik Keahlian</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {counselor.topics.map((topic) => (
              <span
                key={topic}
                className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800"
              >
                {topic}
              </span>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-bold text-gray-900">Jadwal Konseling</h3>
          <p className="mt-0.5 text-xs text-gray-400">Sesi berdurasi 1 jam</p>
          <CounselorSchedule schedule={counselor.schedule} />
        </div>
      </div>

      <div className="border-t border-gray-100 p-5">
        <Link
          to="/klien/pesanan"
          className="flex w-full items-center justify-center gap-2 rounded-full border border-primary px-5 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary-soft focus:outline-none focus:ring-4 focus:ring-primary/15"
        >
          Buat janji konseling
          <ArrowRight className="h-4 w-4" strokeWidth={2.2} />
        </Link>
      </div>
    </article>
  );
}

