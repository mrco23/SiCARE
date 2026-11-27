import IconLabel from "../../components/shared/IconLabel";
import {
  PageHeader,
  SkeletonCardGrid,
} from "../../components/shared";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  RefreshCw,
  Search,
  UsersRound,
  X,
} from "lucide-react";
import type {
  ClientDirectoryCounselor,
  CounselorUpcomingSlot,
} from "../../types/clientCounselor";
import { CounselorCard } from "../../components/client/counselors/CounselorCard";
import { CounselorProfilePanel } from "../../components/client/counselors/CounselorProfilePanel";
import { filterClientDirectoryCounselors } from "../../features/client/counselors/filterClientCounselors";
import {
  getAllPublicAvailability,
  getPublicCounselors,
  getPublicPhotoUrl,
} from "../../lib/publicApi";
import { ApiError } from "../../lib/api";
import { serviceDayName } from "../../lib/operationalRules";
import type {
  PublicAvailabilitySlotDto,
  PublicCounselorDto,
} from "../../types/api";

const MAX_AHEAD_DAYS = 60;
const OPERATIONAL_TIME_ZONE = "Asia/Makassar";

const timeFormatter = new Intl.DateTimeFormat("id-ID", {
  timeZone: OPERATIONAL_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const dateLabelFormatter = new Intl.DateTimeFormat("id-ID", {
  timeZone: OPERATIONAL_TIME_ZONE,
  weekday: "short",
  day: "numeric",
  month: "short",
});
const dateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: OPERATIONAL_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function formatSlotRange(startsAt: string, endsAt: string): string {
  return `${timeFormatter.format(new Date(startsAt))}–${timeFormatter.format(new Date(endsAt))}`;
}

function formatSlotDate(startsAt: string): string {
  // "Sen, 30 Nov" — Intl menghasilkan "Sen, 30 Nov" atau "Sen 30 Nov" tergantung engine.
  const parts = dateLabelFormatter.formatToParts(new Date(startsAt));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("weekday")}, ${part("day")} ${part("month")}`.replace(/\.$/, "");
}

function mapUpcomingSlots(
  profileId: string,
  slots: PublicAvailabilitySlotDto[],
): CounselorUpcomingSlot[] {
  const now = Date.now();
  const seen = new Set<string>();
  return slots
    .filter(
      (slot) =>
        slot.counselor_id === profileId &&
        slot.status === "available" &&
        new Date(slot.starts_at).getTime() > now &&
        // Sabtu/Minggu hanya ikut saat aturan hari kerja mati (pengembangan).
        serviceDayName(new Date(slot.starts_at).getDay()) !== null,
    )
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    .filter((slot) => {
      const key = `${slot.starts_at}|${slot.ends_at}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((slot) => ({
      id: slot.id,
      startsAt: slot.starts_at,
      dateKey: dateKeyFormatter.format(new Date(slot.starts_at)),
      dateLabel: formatSlotDate(slot.starts_at),
      timeLabel: formatSlotRange(slot.starts_at, slot.ends_at),
    }));
}

function mapDirectoryCounselors(
  profiles: PublicCounselorDto[],
  slots: PublicAvailabilitySlotDto[],
): ClientDirectoryCounselor[] {
  return profiles.map((profile, index) => {
    const trimmedName = profile.public_name.trim();
    const initials = trimmedName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();

    return {
      entityId: profile.profile_id,
      id: index + 1,
      key: index === 0 ? "GY" : "RW",
      name: trimmedName,
      historyName: trimmedName,
      initials: initials || "K",
      photoUrl: getPublicPhotoUrl(profile.photo_path),
      headline: profile.headline?.trim() ?? "",
      bio: profile.bio?.trim() ?? "",
      // Riwayat pendidikan dari counselor_educations (diisi konselor di Pengaturan).
      education: (profile.educations ?? []).map((item) => ({
        school: item.institution,
        year: String(item.graduation_year),
        degree: item.degree,
      })),
      // 0 tahun atau kosong tidak ditampilkan.
      experience:
        typeof profile.years_experience === "number" && profile.years_experience > 0
          ? `${profile.years_experience} Tahun`
          : null,
      topics: profile.specialties ?? [],
      upcomingSlots: mapUpcomingSlots(profile.profile_id, slots),
    };
  });
}

export default function KlienKonselorPage() {
  const [counselors, setCounselors] = useState<ClientDirectoryCounselor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [profileCounselorId, setProfileCounselorId] = useState<string | null>(null);

  const fetchDirectory = useCallback(async (signal?: AbortSignal) => {
    const fromDate = new Date();
    const toDate = new Date();
    toDate.setDate(toDate.getDate() + MAX_AHEAD_DAYS);

    const [profiles, slots] = await Promise.all([
      getPublicCounselors(signal),
      getAllPublicAvailability({
        from: fromDate,
        to: toDate,
        signal,
      }).catch(() => [] as PublicAvailabilitySlotDto[]),
    ]);
    return mapDirectoryCounselors(profiles, slots);
  }, []);

  const applyDirectory = useCallback((rows: ClientDirectoryCounselor[]) => {
    setCounselors(rows);
    setError(null);
  }, []);

  const reportLoadError = useCallback((cause: unknown) => {
    setError(
      cause instanceof ApiError || cause instanceof Error
        ? cause.message
        : "Daftar konselor tidak dapat dimuat. Periksa koneksi dan coba lagi.",
    );
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    void fetchDirectory(controller.signal)
      .then((rows) => {
        if (active && !controller.signal.aborted) {
          applyDirectory(rows);
        }
      })
      .catch((cause: unknown) => {
        if (active && !controller.signal.aborted) {
          reportLoadError(cause);
        }
      })
      .finally(() => {
        if (active && !controller.signal.aborted) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [fetchDirectory, applyDirectory, reportLoadError]);

  const reloadCounselors = () => {
    setLoading(true);
    setError(null);
    void fetchDirectory()
      .then(applyDirectory)
      .catch(reportLoadError)
      .finally(() => setLoading(false));
  };

  // Konselor yang punya jadwal tampil lebih dulu; urutan asli dipertahankan di dalam tiap kelompok.
  const filteredCounselors = useMemo(() => {
    const matches = filterClientDirectoryCounselors(counselors, searchQuery);
    return [
      ...matches.filter((counselor) => counselor.upcomingSlots.length > 0),
      ...matches.filter((counselor) => counselor.upcomingSlots.length === 0),
    ];
  }, [counselors, searchQuery]);

  const profileCounselor =
    counselors.find((counselor) => counselor.entityId === profileCounselorId) ?? null;
  const closeProfile = useCallback(() => setProfileCounselorId(null), []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Konselor"
        description="Kenali konselor yang siap mendampingi kebutuhanmu."
      />

      <section aria-label="Pencarian konselor">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-gray-500" aria-live="polite">
            {loading
              ? "Memuat daftar konselor..."
              : `Menampilkan ${filteredCounselors.length} dari ${counselors.length} konselor`}
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

      {error && (
        <section
          role="alert"
          className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            <div>
              <p className="font-semibold">Gagal memuat data konselor</p>
              <p className="mt-0.5 text-xs text-red-700">{error}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={reloadCounselors}
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full border border-red-300 bg-white px-4 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Muat ulang
          </button>
        </section>
      )}

      {loading ? (
        <SkeletonCardGrid label="Memuat daftar konselor dan jadwal tersedia..." />
      ) : filteredCounselors.length > 0 ? (
        <section
          aria-label="Daftar konselor"
          className="grid gap-5 md:grid-cols-2 xl:grid-cols-3"
        >
          {filteredCounselors.map((counselor) => (
            <CounselorCard
              key={counselor.entityId}
              counselor={counselor}
              onOpenProfile={(item) => setProfileCounselorId(item.entityId)}
            />
          ))}
        </section>
      ) : !error && counselors.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center">
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-primary-soft text-primary">
            <UsersRound className="h-5 w-5" strokeWidth={1.8} />
          </span>
          <p className="mt-3 text-sm font-semibold text-gray-700">
            Belum ada konselor yang dipublikasikan
          </p>
          <p className="mt-1 text-xs leading-relaxed text-gray-500">
            Saat ini belum ada profil konselor aktif yang tersedia untuk ditampilkan.
          </p>
        </section>
      ) : !error ? (
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
            <IconLabel icon={X}>Hapus pencarian</IconLabel>
          </button>
        </section>
      ) : null}

      {profileCounselor && (
        <CounselorProfilePanel counselor={profileCounselor} onClose={closeProfile} />
      )}
    </div>
  );
}
