import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlarmClock,
  ArrowRight,
  ArrowUpRight,
  CalendarCheck,
  CalendarDays,
  CalendarPlus,
  Activity,
  ChevronsRight,
  ClipboardList,
  Clock,
  History,
  MapPin,
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

type BookingStatus = "pending" | "scheduled" | "done" | "cancelled";

type NextSession = {
  date: Date;
  time: string;
  counselor: string;
  service: string;
  room: string;
};

type LastBooking = {
  service: string;
  counselor: string;
  status: BookingStatus;
  requestedDate: Date;
};

const STATUS_STYLE: Record<BookingStatus, { cls: string; label: string }> = {
  pending: { cls: "bg-amber-50 text-amber-700", label: "Menunggu Konfirmasi" },
  scheduled: { cls: "bg-[#e8f9f0] text-[#1e5b3a]", label: "Terjadwal" },
  done: { cls: "bg-gray-100 text-gray-700", label: "Selesai" },
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
    to: "/klien/pesanan",
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

const addDays = (d: Date, n: number) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
const fmtDateLong = (d: Date) =>
  d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
const formatClock = (d: Date) =>
  `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

export default function BerandaKlienPage() {
  const { profile } = useAuth();
  const [bookings, setBookings] = useState<BookingListItemDto[]>([]);
  const [sessions, setSessions] = useState<SessionListItemDto[]>([]);
  const [counselorNames, setCounselorNames] = useState<Record<string, string>>({});

  const today = useMemo(() => new Date(), []);
  const tomorrow = useMemo(() => addDays(today, 1), [today]);

  const userName = useMemo(() => {
    const full = profile?.full_name?.trim();
    if (!full) return "Klien";
    return full.split(" ")[0];
  }, [profile?.full_name]);

  const fetchDashboard = useCallback(async () => {
    try {
      const [bookingRows, sessionRows, counselorRows] = await Promise.all([
        sicareApi.bookings(100).catch(() => [] as BookingListItemDto[]),
        sicareApi.sessions(100).catch(() => [] as SessionListItemDto[]),
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
    void fetchDashboard().then((res) => {
      if (!active || !res) return;
      setBookings(res.bookingRows);
      setSessions(res.sessionRows);
      setCounselorNames(res.counselorNameMap);
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

      const room =
        s.room ||
        (s.format === "online" ? "Online Meeting" : "Ruang Konseling 01");

      const startDate = new Date(s.starts_at);

      return {
        date: startDate,
        time: formatClock(startDate),
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
        : b.status === "confirmed"
          ? "scheduled"
          : b.status === "cancelled" || b.status === "rejected"
            ? "cancelled"
            : "pending";

    return {
      service,
      counselor,
      status,
      requestedDate: new Date(b.starts_at || b.created_at),
    };
  }, [bookings, sessions, counselorNames]);

  const showTomorrowBanner = !!upcoming && sameDay(upcoming.date, tomorrow);

  return (
    <div className="space-y-6">
      <section>
        <h1 className="font-display text-2xl font-extrabold leading-tight text-gray-900 sm:text-3xl">
          Selamat datang kembali,{" "}
          <span className="text-[#1e5b3a]">{userName}!</span>{" "}
          <span className="inline-block">👋</span>
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-gray-600 sm:text-base">
          Jaga kesehatan mentalmu, karena kamu juga penting.
        </p>
        <p className="text-sm leading-relaxed text-gray-600 sm:text-base">
          Disini tempat kamu bisa berbagi, bercerita, didengar, dan mendapatkan
          dukungan.
        </p>
        <Link
          to="/klien/pesanan"
          className="mt-5 inline-flex items-center gap-2 rounded-full border border-[#1e5b3a]/40 bg-white px-5 py-2.5 text-sm font-semibold text-[#1e5b3a] shadow-sm transition hover:bg-[#e8f9f0] sm:text-[15px]"
        >
          Buat janji konseling
          <ArrowRight className="h-4 w-4" strokeWidth={2.2} />
        </Link>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_20px_50px_rgba(0,0,0,0.06)] sm:p-6">
          <div className="flex items-center gap-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e8f9f0] text-[#1e5b3a]">
              <CalendarDays className="h-5 w-5" strokeWidth={1.8} />
            </span>
            <h2 className="font-display text-lg font-bold sm:text-xl">
              Jadwal konseling berikutnya
            </h2>
          </div>

          {!upcoming ? (
            <div className="mt-5 rounded-2xl border border-dashed border-gray-300 p-6 text-center">
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
                    <div>
                      <p className="text-base text-gray-800">
                        {upcoming.date.toLocaleDateString("id-ID", {
                          weekday: "long",
                        })}
                      </p>
                      <p className="text-lg font-semibold text-gray-900">
                        {fmtDateLong(upcoming.date)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-3 text-gray-600">
                    <Clock className="h-5 w-5 shrink-0" strokeWidth={1.8} />
                    <span className="text-base">{upcoming.time} WITA</span>
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

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_20px_50px_rgba(0,0,0,0.06)] sm:p-6">
          <div className="flex items-center gap-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e8f9f0] text-[#1e5b3a]">
              <CalendarCheck className="h-5 w-5" strokeWidth={1.8} />
            </span>
            <h2 className="font-display text-lg font-bold sm:text-xl">
              Status Booking Terakhir
            </h2>
          </div>

          {!lastBooking ? (
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

              <div className="mt-4">
                <p className="text-sm text-gray-500">Tanggal diminta</p>
                <p className="mt-0.5 font-semibold text-gray-900">
                  {fmtDateLong(lastBooking.requestedDate)}
                </p>
              </div>

              <div className="mt-5 flex justify-end">
                <Link
                  to="/klien/riwayat"
                  className="inline-flex items-center gap-2 rounded-full border border-[#1e5b3a] px-4 py-1.5 text-sm font-semibold text-[#1e5b3a] transition hover:bg-[#e8f9f0]"
                >
                  Lihat Detail
                  <ChevronsRight className="h-4 w-4" strokeWidth={2} />
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>

      {showTomorrowBanner && upcoming && (
        <div className="flex items-center gap-3 rounded-2xl border border-[#36c08f]/40 bg-[#e8f9f0] p-3 sm:p-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#1e5b3a]">
            <AlarmClock className="h-5 w-5" strokeWidth={1.8} />
          </span>
          <div>
            <p className="text-base font-semibold text-gray-900">
              Besok <span className="mx-1 text-gray-400">•</span>{" "}
              {upcoming.time} WITA
            </p>
            <p className="text-sm text-gray-600">
              Jangan lupa hadir sesuai jadwal!
            </p>
          </div>
        </div>
      )}

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
