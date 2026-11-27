import { SkeletonBlock } from "../../components/shared";
import AnimatedMascot from "../../components/mood/AnimatedMascot";
import TypingGreeting from "../../components/mood/TypingGreeting";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlarmClock,
  ArrowRight,
  ArrowUpRight,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  Activity,
  ChevronsRight,
  ClipboardList,
  Clock,
  History,
  MapPin,
  PenLine,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "../../features/auth/useAuth";
import { sicareApi } from "../../lib/sicareApi";
import { getPublicCounselors } from "../../lib/publicApi";
import type {
  BookingListItemDto,
  SessionListItemDto,
} from "../../types/api";
import { EXPIRED_BOOKING_LABEL, MISSED_SESSION_LABEL } from "../../lib/sessionStatus";
import { formatWitaTime } from "../../lib/witaTime";
import { RESCHEDULE_QUERY_KEY } from "../../constants/counseling";

type BookingStatus =
  | "pending"
  | "reschedule"
  | "scheduled"
  | "done"
  | "missed"
  | "expired"
  | "cancelled";

type NextSession = {
  date: Date;
  time: string;
  endTime: string;
  counselor: string;
  service: string;
  room: string;
};

type LastBooking = {
  service: string;
  counselor: string;
  status: BookingStatus;
  bookingId: string;
  startsAt: Date;
  rescheduleReason: string | null;
};

/** Booking yang konselornya meminta jadwal ulang dan jadwal barunya masih bisa dipilih. */
type RescheduleNotice = {
  bookingId: string;
  service: string;
  deadline: Date;
};

/** Aktivitas Saya langsung di layar pilih jadwal pengganti untuk booking ini. */
const rescheduleLink = (bookingId: string) =>
  `/klien/aktivitas?${new URLSearchParams({ [RESCHEDULE_QUERY_KEY]: bookingId })}`;

const STATUS_STYLE: Record<BookingStatus, { cls: string; label: string }> = {
  pending: { cls: "bg-amber-50 text-amber-700", label: "Menunggu Konfirmasi" },
  reschedule: { cls: "bg-amber-100 text-amber-800", label: "Perlu Pilih Jadwal Baru" },
  scheduled: { cls: "bg-[#e8f9f0] text-[#1e5b3a]", label: "Terjadwal" },
  done: { cls: "bg-gray-100 text-gray-700", label: "Selesai" },
  missed: { cls: "bg-slate-100 text-slate-700", label: MISSED_SESSION_LABEL },
  expired: { cls: "bg-slate-100 text-slate-700", label: EXPIRED_BOOKING_LABEL },
  cancelled: { cls: "bg-red-50 text-red-700", label: "Dibatalkan" },
};

const ACCESS_CARDS: {
  to: string;
  title: string;
  desc: string;
  icon: LucideIcon;
  highlight?: boolean;
}[] = [
  {
    to: "/klien/permintaan",
    title: "Booking Jadwal",
    desc: "Atur jadwal konseling sesuai kebutuhan.",
    icon: CalendarPlus,
    highlight: true,
  },
  {
    to: "/klien/konselor",
    title: "Profile Konselor",
    desc: "Lihat data konselor dan keahliannya.",
    icon: UserRound,
  },
  {
    to: "/klien/aktivitas",
    title: "Aktivitas Saya",
    desc: "Lihat aktivitas dan booking yang sedang berjalan.",
    icon: Activity,
  },
  {
    to: "/klien/riwayat",
    title: "Riwayat",
    desc: "Lihat riwayat konseling dan booking kamu.",
    icon: History,
  },
];

/** Aturan backend yang ditampilkan sebagai info (consent.service.js dan booking.service.js). */
const CONSENT_SIGN_LEAD_MINUTES = 15;
const CLIENT_CANCEL_CUTOFF_HOURS = 2;
/** Booking yang masih berjalan, dihitung sebagai badge Aktivitas Saya di Akses Cepat. */
const ACTIVE_BOOKING_STATUSES = new Set<string>([
  "waiting_confirmation",
  "confirmed",
  "reschedule_requested",
]);

/** Progres booking: jumlah langkah selesai per status; null = tidak ditampilkan. */
const PROGRESS_STEPS = ["Diajukan", "Konfirmasi", "Sesi", "Selesai"] as const;
const PROGRESS_DONE: Record<BookingStatus, number | null> = {
  pending: 1,
  reschedule: 1,
  scheduled: 2,
  done: 4,
  missed: null,
  expired: null,
  cancelled: null,
};

const witaDayKey = (d: Date) =>
  d.toLocaleDateString("en-CA", { timeZone: "Asia/Makassar" });
/** Selisih hari kalender WITA dari `from` ke `to`. */
const witaDayDiff = (from: Date, to: Date) =>
  Math.round(
    (Date.parse(witaDayKey(to)) - Date.parse(witaDayKey(from))) / 86_400_000,
  );
const countdownLabel = (days: number) =>
  days <= 0 ? "Hari ini" : days === 1 ? "Besok" : `${days} hari lagi`;
const fmtDateLong = (d: Date) =>
  d.toLocaleDateString("id-ID", {
    timeZone: "Asia/Makassar",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
const formatClock = (d: Date) =>
  formatWitaTime(d, ".");
const fmtDayDateTime = (d: Date) =>
  `${d.toLocaleDateString("id-ID", {
    timeZone: "Asia/Makassar",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  })} · ${formatClock(d)} WITA`;
/** Jam saja bila di hari WITA yang sama dengan sesi; selain itu disertai hari dan tanggal. */
const fmtRelativeToSession = (d: Date, sessionStart: Date) =>
  witaDayKey(d) === witaDayKey(sessionStart)
    ? `${formatClock(d)} WITA`
    : fmtDayDateTime(d);

export default function BerandaKlienPage() {
  const { profile, loading: authLoading } = useAuth();
  const [bookings, setBookings] = useState<BookingListItemDto[]>([]);
  const [sessions, setSessions] = useState<SessionListItemDto[]>([]);
  const [counselorNames, setCounselorNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const today = useMemo(() => new Date(), []);

  const userName = useMemo(() => {
    const full = profile?.full_name?.trim();
    if (!full) return "Klien";
    return full.split(" ")[0];
  }, [profile?.full_name]);

  const fetchDashboard = useCallback(async () => {
    try {
      const [bookingRows, sessionRows, counselorRows] = await Promise.all([
        sicareApi.allBookings().catch(() => [] as BookingListItemDto[]),
        sicareApi.allSessions().catch(() => [] as SessionListItemDto[]),
        getPublicCounselors().catch(() => []),
      ]);

      const counselorNameMap = Object.fromEntries(
        counselorRows.map((c) => [c.profile_id, c.public_name]),
      );

      return {
        bookingRows,
        sessionRows,
        counselorNameMap,
      };
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    let active = true;
    void fetchDashboard()
      .then((res) => {
        if (!active || !res) return;
        setBookings(res.bookingRows);
        setSessions(res.sessionRows);
        setCounselorNames(res.counselorNameMap);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fetchDashboard]);

  const upcoming: NextSession | null = useMemo(() => {
    const nowTime = today.getTime();

    const validSessions = sessions
      .filter((s) => ["scheduled", "ongoing"].includes(s.status))
      .filter((s) => new Date(s.ends_at).getTime() > nowTime)
      .sort(
        (a, b) =>
          new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
      );

    if (validSessions.length > 0) {
      const s = validSessions[0];
      const matchingBooking = bookings.find((b) => b.id === s.booking_id);
      const counselor =
        counselorNames[s.counselor_id] ||
        (matchingBooking ? counselorNames[matchingBooking.counselor_id] : "") ||
        "Konselor LMI";

      const service =
        matchingBooking?.service_type === "group"
          ? matchingBooking.group_name
            ? `Konseling Kelompok (${matchingBooking.group_name})`
            : "Konseling Kelompok"
          : "Konseling Individu";

      const room = s.room || "Ruang Konseling 01";

      const startDate = new Date(s.starts_at);

      return {
        date: startDate,
        time: formatClock(startDate),
        endTime: formatClock(new Date(s.ends_at)),
        counselor,
        service,
        room,
      };
    }

    const validBookings = bookings
      .filter((b) => b.status === "confirmed")
      .filter((b) => new Date(b.ends_at).getTime() > nowTime)
      .sort(
        (a, b) =>
          new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
      );

    if (validBookings.length > 0) {
      const b = validBookings[0];
      const counselor = counselorNames[b.counselor_id] || "Konselor LMI";
      const service =
        b.service_type === "group"
          ? b.group_name
            ? `Konseling Kelompok (${b.group_name})`
            : "Konseling Kelompok"
          : "Konseling Individu";
      const startDate = new Date(b.starts_at);

      return {
        date: startDate,
        time: formatClock(startDate),
        endTime: formatClock(new Date(b.ends_at)),
        counselor,
        service,
        room: "Ruang Konseling 01",
      };
    }

    return null;
  }, [sessions, bookings, counselorNames, today]);

  const lastBooking: LastBooking | null = useMemo(() => {
    if (!bookings.length) return null;

    const sortedBookings = [...bookings].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

    const b = sortedBookings[0];
    const counselor = counselorNames[b.counselor_id] || "Konselor LMI";
    const service =
      b.service_type === "group"
        ? b.group_name
          ? `Konseling Kelompok (${b.group_name})`
          : "Konseling Kelompok"
        : "Konseling Individu";

    const matchingSession = sessions.find((s) => s.booking_id === b.id);
    const status: BookingStatus =
      matchingSession?.status === "completed"
        ? "done"
        : matchingSession?.status === "missed"
          ? "missed"
          : matchingSession?.status === "cancelled"
            ? "cancelled"
            : b.status === "expired"
              ? "expired"
            : b.status === "reschedule_requested"
              ? "reschedule"
            : b.status === "confirmed"
          ? "scheduled"
          : b.status === "cancelled" || b.status === "rejected"
            ? "cancelled"
            : "pending";

    return {
      service,
      counselor,
      status,
      bookingId: b.id,
      startsAt: new Date(b.starts_at || b.created_at),
      rescheduleReason: b.reschedule_reason,
    };
  }, [bookings, sessions, counselorNames]);

  // Jadwal ulang paling mendesak: jadwal baru harus dipilih sebelum jadwal semula dimulai,
  // setelah itu booking kedaluwarsa (reschedule_not_selected).
  const rescheduleNotice: RescheduleNotice | null = useMemo(() => {
    const nowTime = today.getTime();
    const b = bookings
      .filter((item) => item.status === "reschedule_requested")
      .filter((item) => Date.parse(item.starts_at) > nowTime)
      .sort((x, y) => Date.parse(x.starts_at) - Date.parse(y.starts_at))[0];
    if (!b) return null;
    return {
      bookingId: b.id,
      service: b.service_type === "group" ? "Konseling Kelompok" : "Konseling Individu",
      deadline: new Date(b.starts_at),
    };
  }, [bookings, today]);

  const activeBookingCount = useMemo(() => {
    const nowTime = today.getTime();
    return bookings.filter(
      (b) => ACTIVE_BOOKING_STATUSES.has(b.status) && Date.parse(b.ends_at) > nowTime,
    ).length;
  }, [bookings, today]);

  const daysUntilUpcoming = upcoming ? witaDayDiff(today, upcoming.date) : null;
  // Baris pemberitahuan sesi hanya untuk hari ini/besok, dan kalah prioritas dari jadwal ulang.
  const showSoonBanner =
    !rescheduleNotice && daysUntilUpcoming !== null && daysUntilUpcoming <= 1;
  const consentOpensAt = upcoming
    ? new Date(upcoming.date.getTime() - CONSENT_SIGN_LEAD_MINUTES * 60_000)
    : null;
  const cancelCutoffAt = upcoming
    ? new Date(upcoming.date.getTime() - CLIENT_CANCEL_CUTOFF_HOURS * 3_600_000)
    : null;
  const lastBookingProgress = lastBooking ? PROGRESS_DONE[lastBooking.status] : null;

  return (
    <div className="space-y-4 sm:space-y-6">
      <section>
        {/* Satu baris dua kolom: sapaan di kiri, maskot melambai di kanan. */}
        <div className="flex items-center justify-between gap-3 sm:justify-start sm:gap-4">
          <h1 className="min-w-0 font-display text-[26px] font-extrabold leading-tight text-gray-900 sm:text-3xl">
            <TypingGreeting
              mascot={false}
              ready={Boolean(profile) || !authLoading}
              segments={[
                { text: "Selamat datang kembali, " },
                { text: `${userName}!`, className: "block break-words text-[#1e5b3a] sm:inline" },
              ]}
            />
          </h1>
          <div aria-hidden="true" className="w-[72px] shrink-0 sm:w-[96px]">
            <AnimatedMascot pose="wave" />
          </div>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-gray-600 sm:mt-3 sm:text-base">
          Jaga kesehatan mentalmu, karena kamu juga penting.
        </p>
        {/* Kalimat kedua hanya mulai tablet agar hero di ponsel tidak terlalu tinggi. */}
        <p className="hidden text-sm leading-relaxed text-gray-600 sm:block sm:text-base">
          Disini tempat kamu bisa berbagi, bercerita, didengar, dan mendapatkan
          dukungan.
        </p>
        <Link
          to="/klien/permintaan"
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border border-[#1e5b3a]/40 bg-white px-5 py-2.5 text-sm font-semibold text-[#1e5b3a] shadow-sm transition hover:bg-[#e8f9f0] sm:mt-5 sm:inline-flex sm:w-auto sm:text-[15px]"
        >
          Buat janji konseling
          <ArrowRight className="h-4 w-4" strokeWidth={2.2} />
        </Link>
      </section>

      {/* Satu baris pemberitahuan di bawah hero, hanya bila ada yang perlu diperhatikan. */}
      {!loading && rescheduleNotice && (
        <Link
          to={rescheduleLink(rescheduleNotice.bookingId)}
          className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm transition hover:bg-amber-100/70 sm:p-4"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white">
            <CalendarClock className="h-5 w-5" strokeWidth={1.8} />
          </span>
          <span className="min-w-0 flex-1 text-gray-800">
            <span className="font-semibold">Konselor meminta jadwal ulang.</span>{" "}
            Pilih jadwal baru untuk {rescheduleNotice.service} sebelum{" "}
            {fmtDayDateTime(rescheduleNotice.deadline)}.
          </span>
          <span className="hidden shrink-0 font-semibold text-amber-800 sm:inline">
            Pilih →
          </span>
        </Link>
      )}
      {!loading && showSoonBanner && upcoming && (
        <div className="flex items-center gap-3 rounded-2xl border border-[#36c08f]/40 bg-[#e8f9f0] p-3 sm:p-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#1e5b3a]">
            <AlarmClock className="h-5 w-5" strokeWidth={1.8} />
          </span>
          <div className="min-w-0">
            <p className="text-base font-semibold text-gray-900">
              {countdownLabel(daysUntilUpcoming ?? 0)}
              <span className="mx-1 text-gray-400">•</span> {upcoming.time} WITA
            </p>
            <p className="text-sm text-gray-600">
              {upcoming.room}. Jangan lupa hadir sesuai jadwal!
            </p>
          </div>
        </div>
      )}

      <section className="grid grid-cols-1 gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="min-w-0 rounded-2xl border border-gray-200 bg-white p-4 shadow-[0_20px_50px_rgba(0,0,0,0.06)] sm:p-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e8f9f0] text-[#1e5b3a]">
              <CalendarDays className="h-5 w-5" strokeWidth={1.8} />
            </span>
            <h2 className="font-display text-lg font-bold sm:text-xl">
              Jadwal konseling berikutnya
            </h2>
          </div>

          {loading ? (
            <SkeletonBlock bare lines={4} label="Memuat jadwal konseling..." className="mt-5" />
          ) : !upcoming ? (
            <div className="mt-4 rounded-2xl border border-dashed border-gray-300 p-4 text-center sm:mt-5 sm:p-6">
              <p className="text-sm font-semibold text-gray-700">
                Belum ada jadwal konseling
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Buat janji konseling untuk memulainya.
              </p>
            </div>
          ) : (
            <>
              <div className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,240px)_1fr] sm:items-start">
                <div className="rounded-2xl bg-[#f3f8ff] p-4">
                  <div className="flex items-start gap-3">
                    <CalendarDays
                      className="mt-1 h-6 w-6 shrink-0 text-gray-800"
                      strokeWidth={1.8}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                        <p className="text-base text-gray-800">
                          {upcoming.date.toLocaleDateString("id-ID", {
                            timeZone: "Asia/Makassar",
                            weekday: "long",
                          })}
                        </p>
                        {daysUntilUpcoming !== null && (
                          <span className="whitespace-nowrap rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-amber-700">
                            {countdownLabel(daysUntilUpcoming)}
                          </span>
                        )}
                      </div>
                      <p className="text-lg font-semibold text-gray-900">
                        {fmtDateLong(upcoming.date)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-3 text-gray-600">
                    <Clock className="h-5 w-5 shrink-0" strokeWidth={1.8} />
                    <span className="whitespace-nowrap text-base">
                      {upcoming.time}–{upcoming.endTime} WITA
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  <DetailRow
                    icon={UserRound}
                    label="Konselor"
                    value={upcoming.counselor}
                  />
                  <DetailRow
                    icon={ClipboardList}
                    label="Layanan"
                    value={upcoming.service}
                  />
                  <DetailRow
                    icon={MapPin}
                    label="Lokasi"
                    value={upcoming.room}
                  />
                </div>
              </div>

              {consentOpensAt && cancelCutoffAt && (
                <p className="mt-4 flex items-start gap-2 rounded-xl bg-gray-50 px-3 py-2 text-xs leading-relaxed text-gray-600">
                  <PenLine className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                  <span>
                    {consentOpensAt.getTime() <= today.getTime()
                      ? "Informed consent sudah dapat ditandatangani."
                      : `Tanda tangan informed consent dibuka ${fmtRelativeToSession(consentOpensAt, upcoming.date)}.`}{" "}
                    {cancelCutoffAt.getTime() <= today.getTime()
                      ? "Batas pembatalan sudah lewat."
                      : `Pembatalan paling lambat ${fmtRelativeToSession(cancelCutoffAt, upcoming.date)}.`}
                  </span>
                </p>
              )}

              <div className="mt-5 flex justify-end">
                <Link
                  to="/klien/aktivitas"
                  className="inline-flex items-center gap-2 rounded-full border border-[#1e5b3a] px-4 py-1.5 text-sm font-semibold text-[#1e5b3a] transition hover:bg-[#e8f9f0]"
                >
                  Lihat Detail
                  <ChevronsRight className="h-4 w-4" strokeWidth={2} />
                </Link>
              </div>
            </>
          )}
        </div>

        <div className="min-w-0 rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_20px_50px_rgba(0,0,0,0.06)] sm:p-6">
          <div className="flex items-center gap-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e8f9f0] text-[#1e5b3a]">
              <CalendarCheck className="h-5 w-5" strokeWidth={1.8} />
            </span>
            <h2 className="font-display text-lg font-bold sm:text-xl">
              Status Booking Terakhir
            </h2>
          </div>

          {loading ? (
            <SkeletonBlock bare lines={3} label="Memuat status booking..." className="mt-5" />
          ) : !lastBooking ? (
            <div className="mt-5 rounded-2xl border border-dashed border-gray-300 p-5 text-center text-sm text-gray-500">
              Belum ada booking.
            </div>
          ) : (
            <div className="mt-5">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e8f9f0] text-[#1e5b3a]">
                  <UserRound className="h-5 w-5" strokeWidth={1.8} />
                </span>
                <div>
                  <p className="font-semibold text-gray-700">
                    {lastBooking.service}
                  </p>
                  <p className="text-sm font-semibold text-gray-900">
                    {lastBooking.counselor}
                  </p>
                </div>
              </div>

              <span
                className={`mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ${STATUS_STYLE[lastBooking.status].cls}`}
              >
                {STATUS_STYLE[lastBooking.status].label}
              </span>

              {lastBookingProgress !== null && (
                <ol className="mt-4 grid grid-cols-4 gap-1" aria-label="Progres booking">
                  {PROGRESS_STEPS.map((label, i) => {
                    const done = i < lastBookingProgress;
                    // Langkah Konfirmasi yang sedang ditunggu diberi kuning; langkah lain yang belum abu-abu.
                    const waiting = i === 1 && lastBookingProgress === 1;
                    return (
                      <li key={label} aria-current={i === lastBookingProgress ? "step" : undefined}>
                        <div
                          className={`h-1.5 rounded-full ${
                            done ? "bg-[#1e5b3a]" : waiting ? "bg-amber-300" : "bg-gray-200"
                          }`}
                        />
                        <p
                          className={`mt-1 text-[10px] font-semibold sm:text-[11px] ${
                            done ? "text-[#1e5b3a]" : waiting ? "text-amber-700" : "text-gray-500"
                          }`}
                        >
                          {label}
                        </p>
                      </li>
                    );
                  })}
                </ol>
              )}

              <div className="mt-4">
                <p className="text-sm text-gray-500">Jadwal</p>
                <p
                  className={`mt-0.5 font-semibold ${
                    lastBooking.status === "reschedule"
                      ? "text-gray-400 line-through"
                      : "text-gray-900"
                  }`}
                >
                  {fmtDayDateTime(lastBooking.startsAt)}
                </p>
              </div>

              {lastBooking.status === "reschedule" && lastBooking.rescheduleReason && (
                <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-gray-700">
                  <span className="font-semibold">Alasan konselor:</span>{" "}
                  {lastBooking.rescheduleReason}
                </p>
              )}

              <div className="mt-5 flex justify-end">
                {lastBooking.status === "reschedule" ? (
                  <Link
                    to={rescheduleLink(lastBooking.bookingId)}
                    className="inline-flex items-center gap-2 rounded-full bg-amber-600 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-amber-700"
                  >
                    Pilih jadwal baru
                    <ChevronsRight className="h-4 w-4" strokeWidth={2} />
                  </Link>
                ) : (
                  <Link
                    to="/klien/riwayat"
                    className="inline-flex items-center gap-2 rounded-full border border-[#1e5b3a] px-4 py-1.5 text-sm font-semibold text-[#1e5b3a] transition hover:bg-[#e8f9f0]"
                  >
                    Lihat Detail
                    <ChevronsRight className="h-4 w-4" strokeWidth={2} />
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl bg-gray-100/60 p-4 sm:p-6">
        <div className="flex items-center justify-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e8f9f0] text-[#1e5b3a]">
            <ChevronsRight className="h-5 w-5" strokeWidth={1.8} />
          </span>
          <h2 className="font-display text-xl font-bold text-[#1e5b3a] sm:text-2xl">
            Akses Cepat
          </h2>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {ACCESS_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.to}
                to={card.to}
                className="group flex min-h-[130px] flex-col rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <span className="inline-flex w-fit items-center gap-2 rounded-full bg-[#e8f9f0] px-3 py-1 text-sm font-semibold text-[#1e5b3a]">
                  <Icon className="h-4 w-4" strokeWidth={1.8} />
                  {card.title}
                  {card.to === "/klien/aktivitas" && activeBookingCount > 0 && (
                    <span
                      className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[11px] font-bold text-white"
                      aria-label={`${activeBookingCount} booking berjalan`}
                    >
                      {activeBookingCount}
                    </span>
                  )}
                </span>
                <p className="mt-3 flex-1 text-sm text-gray-600">{card.desc}</p>
                <span
                  className={`ml-auto flex h-7 w-7 items-center justify-center rounded-full text-white transition group-hover:translate-x-0.5 ${
                    card.highlight
                      ? "bg-[#1e5b3a]"
                      : "bg-gray-300 group-hover:bg-[#1e5b3a]"
                  }`}
                >
                  {card.highlight ? (
                    <ArrowRight className="h-4 w-4" strokeWidth={2} />
                  ) : (
                    <ArrowUpRight className="h-4 w-4" strokeWidth={2} />
                  )}
                </span>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e8f9f0] text-[#1e5b3a]">
        <Icon className="h-5 w-5" strokeWidth={1.8} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-gray-500">{label}</p>
        <p className="font-semibold text-gray-900">{value}</p>
      </div>
    </div>
  );
}
