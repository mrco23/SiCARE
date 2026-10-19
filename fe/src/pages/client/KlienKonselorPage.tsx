import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Briefcase,
  GraduationCap,
  Search,
  UsersRound,
} from "lucide-react";

const DAYS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"] as const;

type CounselorEducation = {
  school: string;
  year: string;
  degree: string;
};

type Counselor = {
  id: number;
  name: string;
  initials: string;
  about: string;
  education: CounselorEducation[];
  experience: string;
  topics: string[];
  schedule: Record<string, string[]>;
};

// Data contoh. Pada produksi, data konselor dapat diambil dari API.
const COUNSELORS: Counselor[] = [
  {
    id: 1,
    name: "Giovanna Yudi, S.Psi., M.Psi., Psikolog",
    initials: "GY",
    about:
      "Informasi singkat mengenai konselor belum tersedia. Silakan lihat pendidikan, pengalaman, topik keahlian, dan jadwal konseling berikut.",
    education: [
      {
        school: "Universitas Surabaya",
        year: "2018",
        degree: "Sarjana Psikologi",
      },
      {
        school: "Universitas Surabaya",
        year: "2021",
        degree: "Magister Psikologi Profesi",
      },
    ],
    experience: "5 Tahun",
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
    schedule: {
      Senin: [],
      Selasa: ["14.00–15.00", "15.00–16.00"],
      Rabu: ["09.00–10.00", "10.00–11.00"],
      Kamis: ["14.00–15.00", "15.00–16.00"],
      Jumat: [],
    },
  },
  {
    id: 2,
    name: "Rico Kornelius Wahani, S.Psi., M.Psi., Psikolog",
    initials: "RW",
    about:
      "Informasi singkat mengenai konselor belum tersedia. Silakan lihat pendidikan, pengalaman, topik keahlian, dan jadwal konseling berikut.",
    education: [
      {
        school: "Universitas Surabaya",
        year: "2018",
        degree: "Sarjana Psikologi",
      },
      {
        school: "Universitas Surabaya",
        year: "2021",
        degree: "Magister Psikologi Profesi",
      },
    ],
    experience: "5 Tahun",
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
    schedule: {
      Senin: [],
      Selasa: ["14.00–15.00", "15.00–16.00"],
      Rabu: ["09.00–10.00", "10.00–11.00"],
      Kamis: ["14.00–15.00", "15.00–16.00"],
      Jumat: [],
    },
  },
];

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

function CounselorCard({ counselor }: { counselor: Counselor }) {
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md">
      <div className="flex items-center gap-4 border-b border-gray-100 p-5">
        <div
          aria-hidden="true"
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#1e5b3a] text-lg font-bold text-white"
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
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#e8f9f0] text-[#1e5b3a]">
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
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#e8f9f0] text-[#1e5b3a]">
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
          className="flex w-full items-center justify-center gap-2 rounded-full border border-[#1e5b3a] px-5 py-2.5 text-sm font-semibold text-[#1e5b3a] transition hover:bg-[#e8f9f0] focus:outline-none focus:ring-4 focus:ring-[#1e5b3a]/15"
        >
          Buat janji konseling
          <ArrowRight className="h-4 w-4" strokeWidth={2.2} />
        </Link>
      </div>
    </article>
  );
}

export default function KlienKonselorPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredCounselors = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase("id-ID");

    if (!query) return COUNSELORS;

    return COUNSELORS.filter((counselor) => {
      const matchesName = counselor.name
        .toLocaleLowerCase("id-ID")
        .includes(query);
      const matchesTopic = counselor.topics.some((topic) =>
        topic.toLocaleLowerCase("id-ID").includes(query),
      );
      return matchesName || matchesTopic;
    });
  }, [searchQuery]);

  return (
    <div className="space-y-6">
      <section>
        <h1 className="font-display text-2xl font-extrabold text-gray-900 sm:text-3xl">
          Konselor
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-gray-600 sm:text-base">
          Kenali konselor yang siap mendampingi kebutuhanmu.
        </p>
      </section>

      <section aria-label="Pencarian konselor">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-gray-500" aria-live="polite">
            Menampilkan {filteredCounselors.length} dari {COUNSELORS.length}{" "}
            konselor
          </p>
          <label className="relative block w-full sm:w-80">
            <span className="sr-only">
              Cari konselor berdasarkan nama atau topik keahlian
            </span>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              strokeWidth={2}
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Cari nama atau topik keahlian..."
              className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-[#1e5b3a] focus:ring-4 focus:ring-[#1e5b3a]/15"
            />
          </label>
        </div>
      </section>

      {filteredCounselors.length > 0 ? (
        <section
          aria-label="Daftar konselor"
          className="grid gap-5 md:grid-cols-2 xl:grid-cols-3"
        >
          {filteredCounselors.map((counselor) => (
            <CounselorCard key={counselor.id} counselor={counselor} />
          ))}
        </section>
      ) : (
        <section className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center">
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#e8f9f0] text-[#1e5b3a]">
            <UsersRound className="h-5 w-5" strokeWidth={1.8} />
          </span>
          <p className="mt-3 text-sm font-semibold text-gray-700">
            Konselor tidak ditemukan
          </p>
          <p className="mt-1 text-xs leading-relaxed text-gray-500">
            Coba kata kunci lain, misalnya nama konselor atau topik keahlian.
          </p>
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="mt-4 rounded-full border border-[#1e5b3a] px-4 py-2 text-sm font-semibold text-[#1e5b3a] transition hover:bg-[#e8f9f0]"
          >
            Hapus pencarian
          </button>
        </section>
      )}
    </div>
  );
}
