import { GraduationCap, Briefcase } from "lucide-react";
import Navbar from "../../components/home/Navbar";
import Footer from "../../components/home/Footer";

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
    photo: "/maskot.png",
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
    photo: "/maskot.png",
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
    <div className={`mx-auto w-full max-w-xs md:max-w-none ${className}`}>
      <div className="aspect-square overflow-hidden rounded-2xl bg-[#f7fcf9]">
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-cover object-top"
        />
      </div>
    </div>
  );
}

function IconBox({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-800">
      {children}
    </span>
  );
}

function EducationBlock({ items }: { items: Education[] }) {
  return (
    <div className="flex gap-3">
      <IconBox>
        <GraduationCap className="h-5 w-5" />
      </IconBox>
      <div>
        <p className="text-sm font-semibold text-gray-500">Pendidikan</p>
        <ul className="mt-1 space-y-2 text-sm">
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
    <div className="flex gap-3">
      <IconBox>
        <Briefcase className="h-5 w-5" />
      </IconBox>
      <div>
        <p className="text-sm font-semibold text-gray-500">Pengalaman</p>
        <p className="mt-1 font-semibold text-gray-900">{value}</p>
      </div>
    </div>
  );
}

function Chips({ items }: { items: string[] }) {
  return (
    <div className="mt-5 flex flex-wrap gap-2.5">
      {items.map((t) => (
        <span
          key={t}
          className="inline-flex items-center rounded-full bg-blue-100 px-4 py-2 text-sm font-semibold text-blue-800"
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
      <div className="mt-5 hidden overflow-hidden rounded-2xl border border-gray-200 bg-white sm:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-blue-50 text-gray-700">
            <tr>
              <th className="px-5 py-3 font-semibold">Hari</th>
              <th className="px-5 py-3 font-semibold">Waktu yang tersedia</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {schedule.map((s) => (
              <tr key={s.day}>
                <td className="px-5 py-3 font-medium">{s.day}</td>
                <td className="px-5 py-3">
                  {s.slots.length ? (
                    <div className="flex flex-wrap gap-2">
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
      <ul className="mt-5 space-y-3 sm:hidden">
        {schedule.map((s) => (
          <li
            key={s.day}
            className="rounded-xl border border-gray-200 bg-white p-4"
          >
            <p className="font-semibold">{s.day}</p>
            {s.slots.length ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {s.slots.map((slot) => (
                  <SlotChip key={slot} label={slot} />
                ))}
              </div>
            ) : (
              <p className="mt-1 text-sm text-gray-400">Tidak tersedia</p>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

function SlotChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center whitespace-nowrap rounded-full bg-blue-100 px-3.5 py-1.5 text-[13px] font-semibold text-blue-800">
      {label}
    </span>
  );
}

function CounselorCard({ c, reverse }: { c: Counselor; reverse: boolean }) {
  const info = (
    <div className={reverse ? "order-2 md:order-1" : ""}>
      <div className={`flex ${reverse ? "md:justify-end" : ""}`}>
        <span className="inline-block rounded-full bg-blue-100 px-4 py-1.5 text-sm font-semibold text-blue-800">
          Profile Konselor
        </span>
      </div>
      <h2
        className={`mt-4 font-[Montserrat] text-2xl font-bold leading-snug text-gray-900 sm:text-3xl ${
          reverse ? "md:text-right" : ""
        }`}
      >
        {c.name}
      </h2>
      <p
        className={`mt-4 text-[15px] leading-relaxed text-gray-600 sm:text-base ${reverse ? "md:text-right" : ""}`}
      >
        {c.description}
      </p>
      <div className="mt-8 grid gap-6 sm:grid-cols-2">
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
    <article className="overflow-hidden rounded-3xl bg-white shadow-[0_20px_50px_rgba(0,0,0,0.08)] ring-1 ring-gray-100">
      <div
        className={`grid gap-8 p-6 sm:p-8 md:items-center md:gap-10 lg:p-12 ${
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

      <div className="grid gap-8 border-t border-gray-100 bg-[#f7fcf9] p-6 sm:p-8 md:grid-cols-2 md:gap-10 lg:p-12">
        {reverse ? (
          <>
            <div>
              <h3 className="font-[Montserrat] text-xl font-bold text-gray-900 sm:text-2xl">
                Topik Keahlian
              </h3>
              <Chips items={c.topics} />
            </div>
            <div className="md:border-l md:border-gray-200 md:pl-10">
              <h3 className="font-[Montserrat] text-xl font-bold text-gray-900 sm:text-2xl">
                Jadwal Konseling
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Sesi berdurasi 1 jam.
              </p>
              <ScheduleTable schedule={c.schedule} />
            </div>
          </>
        ) : (
          <>
            <div>
              <h3 className="font-[Montserrat] text-xl font-bold text-gray-900 sm:text-2xl">
                Jadwal Konseling
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Sesi berdurasi 1 jam.
              </p>
              <ScheduleTable schedule={c.schedule} />
            </div>
            <div className="md:border-l md:border-gray-200 md:pl-10">
              <h3 className="font-[Montserrat] text-xl font-bold text-gray-900 sm:text-2xl">
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
      {/* Navbar */}
      <div className="absolute inset-x-0 top-0 z-50">
        <Navbar />
      </div>

      {/* Header halaman */}
      <section className="mx-auto w-[92%] pb-10 pt-40 sm:w-[88%] md:pt-44 lg:w-[86%]">
        <h1 className="font-[Montserrat] text-3xl font-extrabold text-[#14553a] sm:text-4xl">
          Profil Konselor
        </h1>
        <p className="mt-2 text-base text-gray-600 sm:text-lg">
          Kenali lebih dekat konselor yang siap mendampingi kebutuhanmu.
        </p>
        <div className="mt-5 h-1 w-32 rounded-full bg-[#14553a]" />
      </section>

      {/* Daftar konselor */}
      <main className="mx-auto w-[92%] space-y-16 pb-16 sm:w-[88%] lg:w-[86%]">
        {counselors.map((c, i) => (
          <CounselorCard key={c.id} c={c} reverse={i % 2 === 1} />
        ))}
      </main>

      <Footer />
    </div>
  );
}
