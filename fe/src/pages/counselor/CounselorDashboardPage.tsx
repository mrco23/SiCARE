import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  CalendarDays,
  ClipboardList,
  MessageSquareText,
} from "lucide-react";

type Request = {
  id: number;
  name: string;
  role: string;
  topic: string;
  format: "Individu" | "Kelompok";
  waitMin: number;
  status: "pending" | "accepted" | "rejected";
};

type Session = {
  id: number;
  client: string;
  topic: string;
  format: "Individu" | "Kelompok";
  time: string; // "HH.MM", durasi 1 jam
};

type SessionState = "done" | "live" | "upcoming";

const initialRequests: Request[] = [
  {
    id: 1,
    name: "Yusli Ngongano",
    role: "Mahasiswa",
    topic: "Masalah akademik & manajemen waktu",
    format: "Individu",
    waitMin: 185,
    status: "pending",
  },
  {
    id: 2,
    name: "Ayu Pratiwi",
    role: "Mahasiswa",
    topic: "Kecemasan menghadapi ujian",
    format: "Kelompok",
    waitMin: 42,
    status: "pending",
  },
  {
    id: 3,
    name: "Bagas Hermawan",
    role: "Dosen / Staf",
    topic: "Stres kerja",
    format: "Individu",
    waitMin: 1440,
    status: "pending",
  },
];

const initialSessions: Session[] = [
  {
    id: 101,
    client: "Ayu Pratiwi",
    topic: "Motivasi",
    format: "Kelompok",
    time: "10.00",
  },
  {
    id: 102,
    client: "Yusli Ngongano",
    topic: "Pengembangan Diri",
    format: "Individu",
    time: "15.00",
  },
];

const SESSIONS_THIS_WEEK = 4;
const RATINGS = [5, 5, 4, 5, 3];

const toMin = (t: string) => {
  const [h, m] = t.split(".").map(Number);
  return h * 60 + m;
};

const initials = (name: string) =>
  name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

function waitLabel(min: number) {
  if (min < 60) return `Menunggu ${min} menit`;
  if (min < 1440) return `Menunggu ${Math.floor(min / 60)} jam`;
  return `Menunggu ${Math.floor(min / 1440)} hari`;
}

function sessionState(s: Session, nowMin: number): SessionState {
  const start = toMin(s.time);
  const end = start + 60;
  if (nowMin >= end) return "done";
  if (nowMin >= start) return "live";
  return "upcoming";
}

export default function CounselorDashboardPage() {
  const [now, setNow] = useState(() => new Date());
  const [requests, setRequests] = useState<Request[]>(initialRequests);
  const [sessions, setSessions] = useState<Session[]>(initialSessions);
  const [confirm, setConfirm] = useState<{
    id: number;
    accept: boolean;
  } | null>(null);
  const [toastMsg, setToastMsg] = useState("");

  // Perbarui status sesi setiap menit
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  // Sembunyikan toast otomatis
  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(""), 2600);
    return () => clearTimeout(t);
  }, [toastMsg]);

  const nowMin = now.getHours() * 60 + now.getMinutes();

  const pendingRequests = useMemo(
    () =>
      requests
        .filter((r) => r.status === "pending")
        .sort((a, b) => b.waitMin - a.waitMin),
    [requests],
  );

  const sortedSessions = useMemo(
    () => [...sessions].sort((a, b) => toMin(a.time) - toMin(b.time)),
    [sessions],
  );

  const nextId = sortedSessions.find(
    (s) => sessionState(s, nowMin) === "upcoming",
  )?.id;
  const liveSessions = sortedSessions.filter(
    (s) => sessionState(s, nowMin) === "live",
  );
  const upcomingCount = sortedSessions.filter(
    (s) => sessionState(s, nowMin) === "upcoming",
  ).length;
  const avgRating = RATINGS.reduce((a, b) => a + b, 0) / RATINGS.length;

  const todayLabel = now.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const summary =
    pendingRequests.length > 0
      ? `Anda punya ${pendingRequests.length} permintaan menunggu dan ${upcomingCount} sesi lagi hari ini.`
      : `Tidak ada permintaan menunggu. ${upcomingCount} sesi lagi hari ini.`;

  function handleDecide() {
    if (!confirm) return;
    const req = requests.find((r) => r.id === confirm.id);
    if (!req) return;

    setRequests((prev) =>
      prev.map((r) =>
        r.id === req.id
          ? { ...r, status: confirm.accept ? "accepted" : "rejected" }
          : r,
      ),
    );

    if (confirm.accept) {
      setSessions((prev) => [
        ...prev,
        {
          id: 200 + req.id,
          client: req.name,
          topic: req.topic,
          format: req.format,
          time: "16.00",
        },
      ]);
    }

    setConfirm(null);
    setToastMsg(
      confirm.accept
        ? "Permintaan diterima. Sesi ditambahkan ke jadwal."
        : "Permintaan ditolak.",
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      {/* ================= SAPAAN ================= */}
      <section>
        <p className="text-sm font-medium text-gray-500">{todayLabel}</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">
          Selamat datang, Ma’am <span className="text-[#1e5b3a]">Giovanna</span>
        </h1>
        <p className="mt-2 text-sm text-gray-600 sm:text-base">{summary}</p>
      </section>

      {/* ================= KARTU RINGKASAN ================= */}
      <section className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          to="/konselor/permintaan"
          tone="amber"
          label="Menunggu konfirmasi"
          value={pendingRequests.length}
          note="Perlu ditanggapi segera"
        />
        <StatCard
          to="/konselor/jadwal"
          label="Sesi hari ini"
          value={sessions.length}
          note="Sesi terjadwal"
        />
        <StatCard
          to="/konselor/riwayat"
          label="Sesi minggu ini"
          value={SESSIONS_THIS_WEEK}
          note="Termasuk yang sudah selesai"
        />
        <StatCard
          to="/konselor/feedback"
          label="Rating rata-rata"
          value={avgRating.toFixed(1)}
          suffix="/ 5"
          note={`Dari ${RATINGS.length} feedback`}
        />
      </section>

      {/* ================= INFO SESI BERLANGSUNG ================= */}
      {liveSessions.length > 0 && (
        <section className="mt-6 flex flex-col items-start justify-between gap-4 rounded-2xl border border-[#36c08f]/60 bg-[#f7fcf9] p-4 sm:flex-row sm:items-center sm:p-5">
          <div className="flex items-start gap-3">
            <span className="relative mt-1 flex h-3 w-3 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#36c08f] opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-[#1e5b3a]" />
            </span>
            <div>
              <p className="font-semibold text-[#14553a]">
                Ada {liveSessions.length} sesi sedang berlangsung
              </p>
              <p className="mt-0.5 text-sm text-gray-600">
                Bersama {liveSessions.map((s) => s.client).join(", ")}. Lengkapi
                catatan setelah sesi selesai.
              </p>
            </div>
          </div>
          <Link
            to="/konselor/aktivitas"
            className="shrink-0 rounded-xl bg-[#1e5b3a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#174a2f]"
          >
            Isi catatan
          </Link>
        </section>
      )}

      {/* ================= KONTEN UTAMA ================= */}
      <section className="mt-6 grid gap-6 lg:grid-cols-5">
        {/* Permintaan menunggu */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 lg:col-span-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">Permintaan menunggu</h2>
              <p className="mt-0.5 text-sm text-gray-500">
                Diurutkan dari yang paling lama menunggu.
              </p>
            </div>
            <Link
              to="/konselor/permintaan"
              className="shrink-0 text-sm font-semibold text-[#1e5b3a] hover:underline"
            >
              Lihat semua
            </Link>
          </div>

          <ul className="mt-5 space-y-3">
            {pendingRequests.map((r) => (
              <li
                key={r.id}
                className="rounded-xl border border-gray-200 p-4 transition hover:shadow-sm"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#e8f9f0] text-sm font-bold text-[#1e5b3a]">
                    {initials(r.name)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-gray-900">
                      {r.name}
                    </p>
                    <p className="truncate text-xs text-gray-500">
                      {r.role} · {r.format}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-sm text-gray-700">{r.topic}</p>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-3">
                  <span className="text-xs text-gray-500">
                    {waitLabel(r.waitMin)}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirm({ id: r.id, accept: false })}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      Tolak
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirm({ id: r.id, accept: true })}
                      className="rounded-lg bg-[#1e5b3a] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#174a2f]"
                    >
                      Terima
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {pendingRequests.length === 0 && (
            <div className="mt-5 rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
              Tidak ada permintaan yang menunggu.
            </div>
          )}
        </div>

        {/* Sesi hari ini */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">Sesi hari ini</h2>
              {sortedSessions.length > 0 && (
                <p className="mt-0.5 text-sm text-gray-500">
                  {sortedSessions.length} sesi ·{" "}
                  {now.toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "short",
                  })}
                </p>
              )}
            </div>
            <Link
              to="/konselor/jadwal"
              className="shrink-0 text-sm font-semibold text-[#1e5b3a] hover:underline"
            >
              Jadwal
            </Link>
          </div>

          {sortedSessions.length > 0 ? (
            <ol className="relative mt-5 space-y-4 border-l-2 border-gray-200 pl-5">
              {sortedSessions.map((s) => {
                const st = sessionState(s, nowMin);
                const isNext = s.id === nextId;
                const highlight = st === "live" || isNext;

                const dot =
                  st === "live"
                    ? "bg-[#1e5b3a] ring-4 ring-[#36c08f]/25"
                    : isNext
                      ? "bg-[#36c08f] ring-4 ring-[#36c08f]/20"
                      : "bg-gray-300";

                const badge =
                  st === "done" ? (
                    <Badge className="bg-gray-100 text-gray-600">Selesai</Badge>
                  ) : st === "live" ? (
                    <Badge className="bg-[#1e5b3a] text-white">
                      Berlangsung
                    </Badge>
                  ) : isNext ? (
                    <Badge className="bg-[#e8f9f0] text-[#1e5b3a]">
                      Berikutnya
                    </Badge>
                  ) : (
                    <Badge className="bg-blue-50 text-blue-800">
                      Terjadwal
                    </Badge>
                  );

                return (
                  <li key={s.id} className="relative">
                    <span
                      className={`absolute -left-[27px] top-4 h-3 w-3 rounded-full border-2 border-white ${dot}`}
                    />
                    <div
                      className={`rounded-xl border p-3.5 ${highlight ? "border-[#36c08f]/60 bg-[#f7fcf9]" : "border-gray-200"}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-bold text-gray-900">
                          {s.time} WITA
                        </p>
                        {badge}
                      </div>
                      <p className="mt-1 truncate text-sm font-semibold text-gray-800">
                        {s.client}
                      </p>
                      <p className="truncate text-xs text-gray-500">
                        {s.topic} · {s.format}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <div className="mt-5 rounded-xl border border-dashed border-gray-300 p-6 text-center">
              <p className="text-sm font-semibold text-gray-700">
                Tidak ada sesi hari ini
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Sesi berikutnya akan tampil di sini.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ================= AKSI CEPAT ================= */}
      <section className="mt-6">
        <h2 className="text-sm font-semibold text-gray-500">Aksi cepat</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <QuickAction
            to="/konselor/jadwal"
            icon={CalendarDays}
            title="Atur jadwal"
            desc="Ubah ketersediaan mingguan"
          />
          <QuickAction
            to="/konselor/riwayat"
            icon={ClipboardList}
            title="Riwayat konseling"
            desc="Buka catatan klien"
          />
          <QuickAction
            to="/konselor/feedback"
            icon={MessageSquareText}
            title="Lihat feedback"
            desc="Tanggapan dari klien"
          />
        </div>
      </section>

      {/* ================= MODAL KONFIRMASI ================= */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-bold">
              {confirm.accept ? "Terima" : "Tolak"} permintaan{" "}
              {requests.find((r) => r.id === confirm.id)?.name}?
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              {confirm.accept
                ? "Sesi akan masuk ke jadwal hari ini dan klien akan diberi tahu."
                : "Permintaan akan ditolak dan klien akan diberi tahu."}
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirm(null)}
                className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDecide}
                className={`rounded-xl px-5 py-2.5 text-sm font-semibold text-white ${
                  confirm.accept
                    ? "bg-[#1e5b3a] hover:bg-[#174a2f]"
                    : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {confirm.accept ? "Ya, terima" : "Ya, tolak"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= TOAST ================= */}
      <div
        className={`pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-gray-900 px-4 py-3 text-sm text-white shadow-lg transition duration-300 ${
          toastMsg ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
        }`}
      >
        {toastMsg}
      </div>
    </div>
  );
}

/* ================= SUB-KOMPONEN ================= */

function StatCard({
  to,
  label,
  value,
  note,
  suffix,
  tone,
}: {
  to: string;
  label: string;
  value: number | string;
  note: string;
  suffix?: string;
  tone?: "amber";
}) {
  const amber = tone === "amber";
  return (
    <Link
      to={to}
      className={`rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md sm:p-5 ${
        amber ? "border-amber-200 bg-amber-50" : "border-gray-200 bg-white"
      }`}
    >
      <p
        className={`text-xs font-medium sm:text-sm ${amber ? "text-amber-800" : "text-gray-500"}`}
      >
        {label}
      </p>
      <p className="mt-2 flex items-baseline gap-1.5">
        <span
          className={`text-2xl font-bold sm:text-3xl ${amber ? "text-amber-900" : "text-gray-900"}`}
        >
          {value}
        </span>
        {suffix && <span className="text-xs text-gray-400">{suffix}</span>}
      </p>
      <p
        className={`mt-1 text-xs ${amber ? "text-amber-700" : "text-gray-400"}`}
      >
        {note}
      </p>
    </Link>
  );
}

function QuickAction({
  to,
  icon: Icon,
  title,
  desc,
}: {
  to: string;
  icon: typeof CalendarDays;
  title: string;
  desc: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 transition hover:border-[#36c08f]/60 hover:shadow-md"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e8f9f0] text-[#1e5b3a]">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-xs text-gray-500">{desc}</span>
      </span>
      <ArrowUpRight className="h-4 w-4 text-gray-400" />
    </Link>
  );
}

function Badge({
  children,
  className,
}: {
  children: React.ReactNode;
  className: string;
}) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}
    >
      {children}
    </span>
  );
}
