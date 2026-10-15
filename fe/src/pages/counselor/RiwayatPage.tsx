import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  ChevronDown,
  ChevronLeft,
  Eye,
  EyeOff,
  Lock,
  Search,
  X,
} from "lucide-react";

type Format = "Individu" | "Kelompok";

type Session = {
  id: number;
  topic: string;
  format: Format;
  date: string; // YYYY-MM-DD
  time: string; // "HH.MM"
  summary: string;
  note: string;
};

type Client = {
  id: string;
  name: string;
  email: string;
  role: string;
  password: string;
  sessions: Session[];
};

const MAX_ATTEMPTS = 3;
const ACCESS_DURATION_MS = 10 * 60 * 1000;

// Data contoh. Semua sesi sudah memiliki catatan.
const clients: Client[] = [
  {
    id: "c1",
    name: "Yusli Ngongano",
    email: "yusli@mhs.unikadelasalle.ac.id",
    role: "Mahasiswa",
    password: "1234",
    sessions: [
      {
        id: 1,
        topic: "Pengembangan Diri",
        format: "Individu",
        date: "2026-09-28",
        time: "15.00",
        summary: "Klien membahas rencana pengembangan diri jangka pendek.",
        note: "Klien aktif berdiskusi. Disepakati tugas refleksi mingguan.",
      },
      {
        id: 2,
        topic: "Pengembangan Diri",
        format: "Individu",
        date: "2026-10-02",
        time: "15.00",
        summary: "Lanjutan sesi sebelumnya.",
        note: "Progres baik. Perlu evaluasi pada sesi berikutnya.",
      },
      {
        id: 3,
        topic: "Pengembangan Diri",
        format: "Individu",
        date: "2026-10-05",
        time: "15.00",
        summary: "Sesi evaluasi bulanan.",
        note: "Klien menunjukkan kemajuan. Lanjutkan sesi rutin.",
      },
    ],
  },
  {
    id: "c2",
    name: "Ayu Pratiwi",
    email: "ayu@mhs.unikadelasalle.ac.id",
    role: "Mahasiswa",
    password: "1234",
    sessions: [
      {
        id: 4,
        topic: "Motivasi",
        format: "Kelompok",
        date: "2026-10-07",
        time: "10.00",
        summary: "Sesi kelompok motivasi belajar.",
        note: "Peserta aktif. Disepakati jadwal lanjutan.",
      },
    ],
  },
  {
    id: "c3",
    name: "Bagas Hermawan",
    email: "bagas@staf.unikadelasalle.ac.id",
    role: "Dosen / Staf",
    password: "1234",
    sessions: [
      {
        id: 5,
        topic: "Stres",
        format: "Individu",
        date: "2026-10-08",
        time: "14.00",
        summary: "Diskusi pengelolaan stres kerja.",
        note: "Teknik pernapasan diperkenalkan. Perlu tindak lanjut.",
      },
    ],
  },
];

const allSessions = clients.flatMap((c) => c.sessions);

const initials = (name: string) =>
  name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

const fmtDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

const monthLabel = (ym: string) =>
  new Date(`${ym}-01T00:00:00`).toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });

const sessionKey = (s: Session) => `${s.date} ${s.time}`;

const matches = (s: Session, format: Format, month: string) =>
  s.format === format && (month === "all" || s.date.startsWith(month));

const monthOptions = [...new Set(allSessions.map((s) => s.date.slice(0, 7)))]
  .sort()
  .reverse();

export default function RiwayatPage() {
  const [format, setFormat] = useState<Format>("Individu");
  const [month, setMonth] = useState("all");
  const [query, setQuery] = useState("");
  const [timeSort, setTimeSort] = useState<"terbaru" | "terlama">("terbaru");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [noteId, setNoteId] = useState<number | null>(null);

  const [accessUntil, setAccessUntil] = useState<Record<string, number>>({});
  const [attempts, setAttempts] = useState<Record<string, number>>({});
  const [now, setNow] = useState(() => Date.now());

  const [pwClientId, setPwClientId] = useState<string | null>(null);
  const [pwInput, setPwInput] = useState("");
  const [pwVisible, setPwVisible] = useState(false);
  const [pwError, setPwError] = useState("");

  const [toastMsg, setToastMsg] = useState("");

  // Perbarui waktu setiap detik untuk timer akses
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Sembunyikan toast otomatis
  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(""), 2800);
    return () => clearTimeout(t);
  }, [toastMsg]);

  // Kunci otomatis saat akses habis
  useEffect(() => {
    if (!selectedId) return;
    if ((accessUntil[selectedId] ?? 0) > now) return;
    setSelectedId(null);
    setNoteId(null);
    setToastMsg("Akses riwayat terkunci kembali.");
  }, [now, selectedId, accessUntil]);

  const hasAccess = (cid: string) => (accessUntil[cid] ?? 0) > now;

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clients
      .filter((c) => !q || c.name.toLowerCase().includes(q))
      .map((c) => {
        const sessions = c.sessions.filter((s) => matches(s, format, month));
        const latest =
          sessions
            .map((s) => s.date)
            .sort()
            .at(-1) ?? "";
        return { client: c, count: sessions.length, latest };
      })
      .filter((r) => r.count > 0)
      .sort((a, b) => b.latest.localeCompare(a.latest));
  }, [query, format, month]);

  const selected = clients.find((c) => c.id === selectedId) ?? null;

  const detailSessions = useMemo(() => {
    if (!selected) return [];
    return selected.sessions
      .filter((s) => matches(s, format, month))
      .sort((a, b) =>
        timeSort === "terlama"
          ? sessionKey(a).localeCompare(sessionKey(b))
          : sessionKey(b).localeCompare(sessionKey(a)),
      );
  }, [selected, format, month, timeSort]);

  const lastDate =
    detailSessions
      .map((s) => s.date)
      .sort()
      .at(-1) ?? "";

  const noteSession =
    noteId !== null ? (allSessions.find((s) => s.id === noteId) ?? null) : null;

  const timeLeft = selectedId
    ? Math.max(0, (accessUntil[selectedId] ?? 0) - now)
    : 0;
  const timerText = `${Math.floor(timeLeft / 60000)}:${String(
    Math.floor((timeLeft % 60000) / 1000),
  ).padStart(2, "0")}`;

  const pwClient = clients.find((c) => c.id === pwClientId) ?? null;
  const pwUsed = pwClientId ? (attempts[pwClientId] ?? 0) : 0;
  const pwLocked = pwUsed >= MAX_ATTEMPTS;

  function openClient(cid: string) {
    if (hasAccess(cid)) {
      setSelectedId(cid);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setPwClientId(cid);
    setPwInput("");
    setPwVisible(false);
    setPwError("");
  }

  function closePw() {
    setPwClientId(null);
  }

  function handleUnlock(e: FormEvent) {
    e.preventDefault();
    if (!pwClient || pwLocked) return;

    if (pwInput === pwClient.password) {
      const cid = pwClient.id;
      setAttempts((p) => ({ ...p, [cid]: 0 }));
      setAccessUntil((p) => ({ ...p, [cid]: Date.now() + ACCESS_DURATION_MS }));
      setPwClientId(null);
      setSelectedId(cid);
      setToastMsg(
        `Riwayat ${pwClient.name} dibuka. Terkunci otomatis dalam 10 menit.`,
      );
      return;
    }

    const used = pwUsed + 1;
    setAttempts((p) => ({ ...p, [pwClient.id]: used }));
    const left = MAX_ATTEMPTS - used;
    setPwError(
      left > 0
        ? `Kata sandi salah. Sisa percobaan: ${left}`
        : "Terlalu banyak percobaan. Coba lagi nanti.",
    );
    setPwInput("");
  }

  function backToClients() {
    setSelectedId(null);
    setNoteId(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openNote(id: number) {
    if (!selectedId || !hasAccess(selectedId)) {
      setToastMsg("Akses habis. Masukkan kata sandi kembali.");
      backToClients();
      return;
    }
    setNoteId(id);
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      {!selected ? (
        <>
          {/* ================= DAFTAR KLIEN ================= */}
          <section>
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
              Riwayat Konseling
            </h1>
            <p className="mt-1 text-sm text-gray-500 sm:text-base">
              Pilih klien untuk membuka riwayat dan catatan konseling.
            </p>
          </section>

          {/* Filter */}
          <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:p-4">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari nama client ..."
                className="w-full rounded-xl border border-gray-200 bg-gray-100/70 py-3 pl-12 pr-4 text-sm text-gray-800 outline-none placeholder:text-gray-500 focus:border-[#1e5b3a] focus:bg-white focus:ring-4 focus:ring-[#1e5b3a]/15"
              />
            </div>

            <div className="flex items-center gap-2">
              <div
                role="tablist"
                className="flex flex-1 rounded-xl border border-gray-200 bg-gray-100/70 p-1 sm:flex-none"
              >
                {(["Individu", "Kelompok"] as Format[]).map((f) => {
                  const active = format === f;
                  return (
                    <button
                      key={f}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setFormat(f)}
                      className={`flex-1 whitespace-nowrap rounded-lg px-4 py-2 text-sm transition sm:flex-none ${
                        active
                          ? "bg-white font-semibold text-gray-900 shadow-sm"
                          : "font-medium text-gray-500"
                      }`}
                    >
                      {f}
                    </button>
                  );
                })}
              </div>

              <div className="relative">
                <select
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className="w-full appearance-none rounded-xl border border-gray-200 bg-gray-100/70 py-3 pl-4 pr-10 text-sm text-gray-600 outline-none focus:border-[#1e5b3a] focus:bg-white sm:w-auto"
                >
                  <option value="all">Semua Bulan</option>
                  {monthOptions.map((m) => (
                    <option key={m} value={m}>
                      {monthLabel(m)}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              </div>
            </div>
          </div>

          <p className="mt-4 text-xs text-gray-500">
            Menampilkan {rows.length} klien · {format}
            {month !== "all" && ` · ${monthLabel(month)}`}
          </p>

          <ul className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map(({ client, count, latest }) => (
              <li key={client.id}>
                <button
                  type="button"
                  onClick={() => openClient(client.id)}
                  className="flex w-full flex-col rounded-2xl border border-gray-200 bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-[#36c08f]/60 hover:shadow-md"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#e8f9f0] font-bold text-[#1e5b3a]">
                      {initials(client.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-gray-900">
                        {client.name}
                      </p>
                      <p className="truncate text-xs text-gray-500">
                        {client.role}
                      </p>
                    </div>
                    <Lock className="h-4 w-4 shrink-0 text-gray-400" />
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4 text-sm">
                    <span className="text-gray-600">
                      {count} sesi {format.toLowerCase()}
                    </span>
                    <span className="rounded-full bg-[#e8f9f0] px-2.5 py-1 text-xs font-semibold text-[#1e5b3a]">
                      Selesai
                    </span>
                  </div>
                  <p className="mt-3 text-xs text-gray-400">
                    Terakhir: {fmtDate(latest)}
                  </p>
                </button>
              </li>
            ))}
          </ul>

          {rows.length === 0 && (
            <div className="mt-5 rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
              Tidak ada klien yang cocok dengan filter ini.
            </div>
          )}
        </>
      ) : (
        <>
          {/* ================= DETAIL KLIEN ================= */}
          <nav className="flex items-center gap-2 text-sm text-gray-500">
            <button
              type="button"
              onClick={backToClients}
              className="inline-flex items-center gap-1.5 font-semibold text-[#1e5b3a] hover:underline"
            >
              <ChevronLeft className="h-4 w-4" />
              Riwayat Konseling
            </button>
            <span>/</span>
            <span className="truncate text-gray-700">{selected.name}</span>
          </nav>

          <div className="mt-5 flex flex-col gap-5 rounded-2xl border border-gray-200 bg-white p-5 sm:flex-row sm:items-center sm:p-6">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#1e5b3a] to-[#36c08f] text-xl font-bold text-white">
              {initials(selected.name)}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-bold sm:text-2xl">{selected.name}</h2>
              <p className="mt-1 text-sm text-gray-500">
                {selected.role} · {selected.email}
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-3 sm:gap-6">
              <div className="rounded-xl bg-gray-50 px-3 py-2.5 text-center sm:px-4">
                <dt className="text-xs text-gray-500">Total sesi</dt>
                <dd className="mt-0.5 text-lg font-bold">
                  {detailSessions.length}
                </dd>
              </div>
              <div className="rounded-xl bg-gray-50 px-3 py-2.5 text-center sm:px-4">
                <dt className="text-xs text-gray-500">Terakhir</dt>
                <dd className="mt-0.5 text-sm font-semibold">
                  {lastDate ? fmtDate(lastDate) : "-"}
                </dd>
              </div>
            </dl>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-gray-900">
                Riwayat sesi
              </h3>
              <p className="text-xs text-gray-500">
                {format}
                {month !== "all" && ` · ${monthLabel(month)}`}
              </p>
            </div>
            <div className="relative">
              <select
                value={timeSort}
                onChange={(e) =>
                  setTimeSort(e.target.value as "terbaru" | "terlama")
                }
                className="w-full appearance-none rounded-xl border border-gray-200 bg-gray-100/70 py-2.5 pl-4 pr-10 text-sm text-gray-600 outline-none focus:border-[#1e5b3a] focus:bg-white sm:w-auto"
              >
                <option value="terbaru">Waktu terbaru</option>
                <option value="terlama">Waktu terlama</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            </div>
          </div>

          {detailSessions.length === 0 ? (
            <p className="mt-4 text-sm text-gray-500">
              Tidak ada sesi yang cocok dengan filter ini.
            </p>
          ) : (
            <ol className="relative mt-4 space-y-4 border-l-2 border-gray-200 pl-5 sm:pl-7">
              {detailSessions.map((s) => (
                <li key={s.id} className="relative">
                  <span className="absolute -left-[27px] top-5 h-3 w-3 rounded-full border-2 border-white bg-[#36c08f] sm:-left-[35px]" />
                  <div className="rounded-2xl border border-gray-200 bg-white p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-gray-900">{s.topic}</p>
                        <p className="mt-0.5 text-sm text-gray-500">
                          {fmtDate(s.date)} · {s.time} WITA
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          s.format === "Kelompok"
                            ? "bg-yellow-200 text-yellow-900"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {s.format}
                      </span>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
                      <span className="rounded-full bg-[#e8f9f0] px-2.5 py-1 text-xs font-semibold text-[#1e5b3a]">
                        Selesai
                      </span>
                      <button
                        type="button"
                        onClick={() => openNote(s.id)}
                        className="rounded-lg bg-[#1e5b3a] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#174a2f]"
                      >
                        Lihat catatan
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </>
      )}

      {/* ================= MODAL PASSWORD ================= */}
      {pwClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0c2619]/45 p-4">
          <form
            onSubmit={handleUnlock}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#e8f9f0] text-[#1e5b3a]">
              <Lock className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-bold">Buka riwayat klien</h2>
            <p className="mt-1 text-sm text-gray-500">
              Masukkan kata sandi untuk membuka riwayat dan catatan{" "}
              <span className="font-semibold text-gray-700">
                {pwClient.name}
              </span>
              . Ini berbeda dari kata sandi login Anda.
            </p>

            <label
              htmlFor="pwInput"
              className="mt-5 block text-sm font-medium text-gray-700"
            >
              Kata sandi
            </label>
            <div className="relative mt-1.5">
              <input
                id="pwInput"
                type={pwVisible ? "text" : "password"}
                autoComplete="off"
                autoFocus
                value={pwInput}
                onChange={(e) => setPwInput(e.target.value)}
                disabled={pwLocked}
                className="w-full rounded-xl border border-gray-300 py-2.5 pl-4 pr-20 text-sm outline-none focus:border-[#1e5b3a] focus:ring-4 focus:ring-[#1e5b3a]/15 disabled:bg-gray-100"
              />
              <button
                type="button"
                onClick={() => setPwVisible((v) => !v)}
                className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-[#1e5b3a] hover:bg-[#e8f9f0]"
              >
                {pwVisible ? (
                  <EyeOff className="h-3.5 w-3.5" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
                {pwVisible ? "Sembunyikan" : "Lihat"}
              </button>
            </div>

            {pwError && <p className="mt-2 text-sm text-red-600">{pwError}</p>}
            {!pwError && pwUsed > 0 && !pwLocked && (
              <p className="mt-1 text-xs text-gray-500">
                Sisa percobaan: {MAX_ATTEMPTS - pwUsed}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={closePw}
                className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={pwLocked || pwInput.length === 0}
                className="rounded-xl bg-[#1e5b3a] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#174a2f] disabled:opacity-50"
              >
                Buka
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ================= MODAL BACA CATATAN ================= */}
      {noteSession && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0c2619]/45 p-4">
          <div className="flex max-h-[88vh] w-full max-w-xl flex-col rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-gray-200 p-5 sm:p-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#1e5b3a]">
                  Catatan terbuka sementara
                </p>
                <h2 className="mt-1 text-lg font-bold">{noteSession.topic}</h2>
                <p className="mt-1 text-sm text-gray-500">
                  {fmtDate(noteSession.date)} · {noteSession.time} WITA ·{" "}
                  {noteSession.format}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setNoteId(null)}
                aria-label="Tutup"
                className="rounded-lg p-2 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto p-5 sm:p-6">
              <h3 className="text-sm font-semibold text-gray-700">
                Ringkasan sesi
              </h3>
              <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-gray-700">
                {noteSession.summary}
              </p>
              <h3 className="mt-5 text-sm font-semibold text-gray-700">
                Catatan konselor
              </h3>
              <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-gray-700">
                {noteSession.note}
              </p>
              <p className="mt-5 text-xs text-gray-400">
                Akses terkunci otomatis dalam {timerText}
              </p>
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
