import { PageHeader } from "../../components/shared";
import {
  CLIENT_BOOKING_STATUS,
  type ClientDashboardBookingStatus,
} from "../../constants/status";
import { useMemo } from "react";
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

/* ========================= TIPE & DATA (contoh) ========================= */
// Di produksi, ambil dari API sesuai akun klien yang sedang login.
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
  status: ClientDashboardBookingStatus;
  requestedDate: Date;
};

const USER_NAME = "Marco";

const STATUS_STYLE: Record<
  ClientDashboardBookingStatus,
  { cls: string; label: string }
> = {
  [CLIENT_BOOKING_STATUS.PENDING]: {
    cls: "bg-amber-50 text-amber-700",
    label: "Menunggu Konfirmasi",
  },
  [CLIENT_BOOKING_STATUS.SCHEDULED]: {
    cls: "bg-primary-soft text-primary",
    label: "Terjadwal",
  },
  [CLIENT_BOOKING_STATUS.COMPLETED]: {
    cls: "bg-gray-100 text-gray-700",
    label: "Selesai",
  },
  [CLIENT_BOOKING_STATUS.CANCELLED]: {
    cls: "bg-red-50 text-red-700",
    label: "Dibatalkan",
  },
};

const LAST_BOOKING: LastBooking | null = {
  service: "Konseling Individu",
  counselor: "Giovanna Yudi, S. Psi., M. Psi.",
  status: CLIENT_BOOKING_STATUS.PENDING,
  requestedDate: new Date(2026, 9, 15),
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

/* ========================= HELPER ========================= */
const addDays = (d: Date, n: number) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
const fmtDateLong = (d: Date) =>
  d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

/* ========================= HALAMAN ========================= */
export default function BerandaKlienPage() {
  const today = useMemo(() => new Date(), []);
  const tomorrow = useMemo(() => addDays(today, 1), [today]);

  const upcoming: NextSession | null = useMemo(
    () => ({
      date: addDays(today, 1), // contoh: besok, untuk memunculkan banner
      time: "10:00",
      counselor: "Giovanna Yudi, S. Psi., M. Psi.",
      service: "Konseling Individu",
      room: "Ruang Konseling 01",
    }),
    [today],
  );

  const showTomorrowBanner = !!upcoming && sameDay(upcoming.date, tomorrow);

  return (
    <div className="space-y-6">
      {/* ================= SAPAAN ================= */}
      <PageHeader
        title={
          <>
            Selamat datang kembali,{" "}
            <span className="text-primary">{USER_NAME}!</span>{" "}
            <span className="inline-block">👋</span>
          </>
        }
        description="Jaga kesehatan mentalmu, karena kamu juga penting."
      >
        <p className="text-sm leading-relaxed text-gray-600 sm:text-base">
          Disini tempat kamu bisa berbagi, bercerita, didengar, dan mendapatkan
          dukungan.
        </p>
        <Link
          to="/klien/pesanan"
          className="mt-5 inline-flex items-center gap-2 rounded-full border border-primary/40 bg-white px-5 py-2.5 text-sm font-semibold text-primary shadow-sm transition hover:bg-primary-soft sm:text-[15px]"
        >
          Buat janji konseling
          <ArrowRight className="h-4 w-4" strokeWidth={2.2} />
        </Link>
      </PageHeader>

      {/* ================= JADWAL & STATUS ================= */}
      <section className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        {/* Jadwal berikutnya */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_20px_50px_rgba(0,0,0,0.06)] sm:p-6">
          <div className="flex items-center gap-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
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
                {/* Tanggal */}
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

                {/* Detail */}
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
                  className="inline-flex items-center gap-2 rounded-full border border-primary px-4 py-1.5 text-sm font-semibold text-primary transition hover:bg-primary-soft"
                >
                  Lihat Detail
                  <ChevronsRight className="h-4 w-4" strokeWidth={2} />
                </Link>
              </div>
            </>
          )}
        </div>

        {/* Status booking terakhir */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_20px_50px_rgba(0,0,0,0.06)] sm:p-6">
          <div className="flex items-center gap-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <CalendarCheck className="h-5 w-5" strokeWidth={1.8} />
            </span>
            <h2 className="font-display text-lg font-bold sm:text-xl">
              Status Booking Terakhir
            </h2>
          </div>

          {!LAST_BOOKING ? (
            <div className="mt-5 rounded-2xl border border-dashed border-gray-300 p-5 text-center text-sm text-gray-500">
              Belum ada booking.
            </div>
          ) : (
            <div className="mt-5">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                  <UserRound className="h-5 w-5" strokeWidth={1.8} />
                </span>
                <div>
                  <p className="font-semibold text-gray-700">
                    {LAST_BOOKING.service}
                  </p>
                  <p className="text-sm font-semibold text-gray-900">
                    {LAST_BOOKING.counselor}
                  </p>
                </div>
              </div>

              <span
                className={`mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ${STATUS_STYLE[LAST_BOOKING.status].cls}`}
              >
                {STATUS_STYLE[LAST_BOOKING.status].label}
              </span>

              <div className="mt-4">
                <p className="text-sm text-gray-500">Tanggal diminta</p>
                <p className="mt-0.5 font-semibold text-gray-900">
                  {fmtDateLong(LAST_BOOKING.requestedDate)}
                </p>
              </div>

              <div className="mt-5 flex justify-end">
                <Link
                  to="/klien/riwayat"
                  className="inline-flex items-center gap-2 rounded-full border border-primary px-4 py-1.5 text-sm font-semibold text-primary transition hover:bg-primary-soft"
                >
                  Lihat Detail
                  <ChevronsRight className="h-4 w-4" strokeWidth={2} />
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ================= BANNER PENGINGAT BESOK ================= */}
      {showTomorrowBanner && upcoming && (
        <div className="flex items-center gap-3 rounded-2xl border border-[#36c08f]/40 bg-primary-soft p-3 sm:p-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-primary">
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

      {/* ================= AKSES CEPAT ================= */}
      <section className="rounded-2xl bg-gray-100/60 p-4 sm:p-6">
        <div className="flex items-center justify-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-soft text-primary">
            <ChevronsRight className="h-5 w-5" strokeWidth={1.8} />
          </span>
          <h2 className="font-display text-xl font-bold text-primary sm:text-2xl">
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
                <span className="inline-flex w-fit items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-sm font-semibold text-primary">
                  <Icon className="h-4 w-4" strokeWidth={1.8} />
                  {card.title}
                </span>
                <p className="mt-3 flex-1 text-sm text-gray-600">{card.desc}</p>
                <span
                  className={`ml-auto flex h-7 w-7 items-center justify-center rounded-full text-white transition group-hover:translate-x-0.5 ${
                    card.highlight
                      ? "bg-primary"
                      : "bg-gray-300 group-hover:bg-primary"
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

/* ========================= KOMPONEN KECIL ========================= */
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
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
        <Icon className="h-5 w-5" strokeWidth={1.8} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-gray-500">{label}</p>
        <p className="font-semibold text-gray-900">{value}</p>
      </div>
    </div>
  );
}
