import { PageHeader } from "../../components/shared";
import { useMemo, useState } from "react";
import {
  Search,
  UsersRound,
} from "lucide-react";
import { CLIENT_DIRECTORY_COUNSELORS as COUNSELORS } from "../../data/mock/clientCounselors";
import { CounselorCard } from "../../components/client/counselors/CounselorCard";
import { filterClientDirectoryCounselors } from "../../features/client/counselors/filterClientCounselors";


export default function KlienKonselorPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredCounselors = useMemo(
    () => filterClientDirectoryCounselors(COUNSELORS, searchQuery),
    [searchQuery],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Konselor"
        description="Kenali konselor yang siap mendampingi kebutuhanmu."
      />

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
              className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15"
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
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-primary-soft text-primary">
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
            className="mt-4 rounded-full border border-primary px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary-soft"
          >
            Hapus pencarian
          </button>
        </section>
      )}
    </div>
  );
}
