import type { ReactNode } from "react";
import { GraduationCap, Briefcase } from "lucide-react";

type Schedule = { day: string; slots: string[] };
type Education = { school: string; year: string; major: string };
type Counselor = {
  id: number;
  name: string;
  photo: string;
  description: string;
  experience: string;
  education: Education[];
  topics: string[];
  schedule: Schedule[];
};

const counselors: Counselor[] = [
  {
    id: 1,
    name: "Giovanna Yudi, S.Psi., M.Psi., Psikolog",
    photo: "/gio.jpeg",
    description:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
    experience: "5 Tahun",
    education: [
      {
        school: "Universitas Surabaya",
        year: "2018",
        major: "Sarjana Psikologi",
      },
      {
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
      "Konflik",
      "Kesiapan Kerja",
    ],
    schedule: [
      { day: "Senin", slots: [] },
      { day: "Selasa", slots: ["14.00–15.00", "15.00–16.00"] },
      { day: "Rabu", slots: ["09.00–10.00", "10.00–11.00"] },
      { day: "Kamis", slots: ["14.00–15.00", "15.00–16.00"] },
      { day: "Jumat", slots: [] },
    ],
  },
  {
    id: 2,
    name: "Rico Kornelius Wahani, S.Psi., M.Psi., Psikolog",
    photo: "/rico.png",
    description:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
    experience: "5 Tahun",
    education: [
      {
        school: "Universitas Surabaya",
        year: "2018",
        major: "Sarjana Psikologi",
      },
      {
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
      "Konflik",
      "Kesiapan Kerja",
    ],
    schedule: [
      { day: "Senin", slots: [] },
      { day: "Selasa", slots: ["14.00–15.00", "15.00–16.00"] },
      { day: "Rabu", slots: ["09.00–10.00", "10.00–11.00"] },
      { day: "Kamis", slots: ["14.00–15.00", "15.00–16.00"] },
      { day: "Jumat", slots: [] },
    ],
  },
];

function Photo({
  src,
  alt,
  className = "",
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    <div className={`mx-auto w-full max-w-60 md:max-w-none ${className}`}>
      <div className="aspect-square overflow-hidden rounded-xl bg-[#f7fcf9]">
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-cover object-top"
        />
      </div>
    </div>
  );
}

function IconBox({ children }: { children: ReactNode }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-800">
      {children}
    </span>
  );
}

function EducationBlock({ items }: { items: Education[] }) {
  return (
    <div className="flex gap-2.5">
      <IconBox>
        <GraduationCap className="h-4 w-4" />
      </IconBox>
      <div>
        <p className="text-xs font-semibold text-gray-500">Pendidikan</p>
        <ul className="mt-1 space-y-1.5 text-xs sm:text-sm">
          {items.map((e, i) => (
            <li key={i}>
              <span className="font-semibold text-gray-900">{e.school}</span>{" "}
              <span className="text-gray-400">· {e.year}</span>
              <br />
              <span className="text-gray-500">{e.major}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ExperienceBlock({ value }: { value: string }) {
  return (
    <div className="flex gap-2.5">
      <IconBox>
        <Briefcase className="h-4 w-4" />
      </IconBox>
      <div>
        <p className="text-xs font-semibold text-gray-500">Pengalaman</p>
        <p className="mt-1 text-sm font-semibold text-gray-900">{value}</p>
      </div>
    </div>
  );
}

function Chips({ items }: { items: string[] }) {
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {items.map((t) => (
        <span
          key={t}
          className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800 sm:text-sm"
        >
          {t}
        </span>
      ))}
    </div>
  );
}

function ScheduleTable({ schedule }: { schedule: Schedule[] }) {
  return (
    <>
      {/* Desktop/tablet: tabel */}
      <div className="mt-4 hidden overflow-hidden rounded-xl border border-gray-200 bg-white sm:block">
        <table className="w-full text-left text-xs sm:text-sm">
          <thead className="bg-blue-50 text-gray-700">
            <tr>
              <th className="px-4 py-2.5 font-semibold">Hari</th>
              <th className="px-4 py-2.5 font-semibold">Waktu yang tersedia</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {schedule.map((s) => (
              <tr key={s.day}>
                <td className="px-4 py-2.5 font-medium">{s.day}</td>
                <td className="px-4 py-2.5">
                  {s.slots.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {s.slots.map((slot) => (
                        <SlotChip key={slot} label={slot} />
                      ))}
                    </div>
                  ) : (
                    <span className="text-gray-400">Tidak tersedia</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: kartu per hari */}
      <ul className="mt-4 space-y-2.5 sm:hidden">
        {schedule.map((s) => (
          <li
            key={s.day}
            className="rounded-lg border border-gray-200 bg-white p-3"
          >
            <p className="text-sm font-semibold">{s.day}</p>
            {s.slots.length ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {s.slots.map((slot) => (
                  <SlotChip key={slot} label={slot} />
                ))}
              </div>
            ) : (
              <p className="mt-1 text-xs text-gray-400">Tidak tersedia</p>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

function SlotChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center whitespace-nowrap rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-800">
      {label}
    </span>
  );
}

function CounselorCard({ c, reverse }: { c: Counselor; reverse: boolean }) {
  const info = (
    <div className={reverse ? "order-2 md:order-1" : ""}>
      <div className={`flex ${reverse ? "md:justify-end" : ""}`}>
        <span className="inline-block rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800 sm:text-sm">
          Profile Konselor
        </span>
      </div>
      <h2
        className={`mt-3 font-[Montserrat] text-xl font-bold leading-snug text-gray-900 sm:text-2xl ${
          reverse ? "md:text-right" : ""
        }`}
      >
        {c.name}
      </h2>
      <p
        className={`mt-3 text-sm leading-relaxed text-gray-600 ${reverse ? "md:text-right" : ""}`}
      >
        {c.description}
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {reverse ? (
          <>
            <ExperienceBlock value={c.experience} />
            <EducationBlock items={c.education} />
          </>
        ) : (
          <>
            <EducationBlock items={c.education} />
            <ExperienceBlock value={c.experience} />
          </>
        )}
      </div>
    </div>
  );

  const photo = (
    <Photo
      src={c.photo}
      alt={`Foto ${c.name}`}
      className={reverse ? "order-1 md:order-2" : ""}
    />
  );

  return (
    <article className="overflow-hidden rounded-2xl bg-white shadow-[0_12px_32px_rgba(0,0,0,0.06)] ring-1 ring-gray-100">
      <div
        className={`grid gap-6 p-4 sm:p-6 md:items-center md:gap-8 lg:p-8 ${
          reverse
            ? "md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]"
            : "md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]"
        }`}
      >
        {reverse ? (
          <>
            {info}
            {photo}
          </>
        ) : (
          <>
            {photo}
            {info}
          </>
        )}
      </div>

      <div className="grid gap-6 border-t border-gray-100 bg-[#f7fcf9] p-4 sm:p-6 md:grid-cols-2 md:gap-8 lg:p-8">
        {reverse ? (
          <>
            <div>
              <h3 className="font-[Montserrat] text-base font-bold text-gray-900 sm:text-lg">
                Topik Keahlian
              </h3>
              <Chips items={c.topics} />
            </div>
            <div className="md:border-l md:border-gray-200 md:pl-8">
              <h3 className="font-[Montserrat] text-base font-bold text-gray-900 sm:text-lg">
                Jadwal Konseling
              </h3>
              <p className="mt-1 text-xs text-gray-500">
                Sesi berdurasi 1 jam.
              </p>
              <ScheduleTable schedule={c.schedule} />
            </div>
          </>
        ) : (
          <>
            <div>
              <h3 className="font-[Montserrat] text-base font-bold text-gray-900 sm:text-lg">
                Jadwal Konseling
              </h3>
              <p className="mt-1 text-xs text-gray-500">
                Sesi berdurasi 1 jam.
              </p>
              <ScheduleTable schedule={c.schedule} />
            </div>
            <div className="md:border-l md:border-gray-200 md:pl-8">
              <h3 className="font-[Montserrat] text-base font-bold text-gray-900 sm:text-lg">
                Topik Keahlian
              </h3>
              <Chips items={c.topics} />
            </div>
          </>
        )}
      </div>
    </article>
  );
}

export default function CounselorPage() {
  return (
    <div className="overflow-x-hidden bg-white">
      {/* Header halaman */}
      <section className="mx-auto w-[92%] pb-8 pt-20 sm:w-[88%] md:pt-28 lg:w-[86%]">
        <h1 className="font-[Montserrat] text-2xl font-extrabold text-[#14553a] sm:text-3xl lg:text-4xl">
          Profil Konselor
        </h1>
        <p className="mt-2 text-sm text-gray-600 sm:text-base">
          Kenali lebih dekat konselor yang siap mendampingi kebutuhanmu.
        </p>
        <div className="mt-4 h-1 w-24 rounded-full bg-[#14553a]" />
      </section>

      {/* Daftar konselor */}
      <main className="mx-auto w-[92%] space-y-10 pb-12 sm:w-[88%] lg:w-[86%]">
        {counselors.map((c, i) => (
          <CounselorCard key={c.id} c={c} reverse={i % 2 === 1} />
        ))}
      </main>
    </div>
  );
}
