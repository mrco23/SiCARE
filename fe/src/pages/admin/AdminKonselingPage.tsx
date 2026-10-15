import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Ban,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  FolderOpen,
  List,
  Lock,
  Star,
  User,
  UserRound,
  Users,
  X,
} from "lucide-react";
import {
  isInPeriod,
  loadPeriods,
  sortPeriods,
  toISO,
  type AcademicPeriod,
} from "../../lib/academicPeriods";

/* ========================= DATA CONTOH ========================= */
/* Ganti dengan fetch('/api/admin/konseling?start=...&end=...') */
const COUNSELORS = [
  "Ma'am Giovanna Yudi, M.Psi",
  "Dr. Budi Santoso, Psikolog",
  "Sari Wulandari, M.Psi",
];
const RATING = [4.8, 4.2, 4.5]; // dari halaman Feedback
const REASONS = [
  "Konflik jadwal pribadi",
  "Klien sakit",
  "Tidak ada respons dari klien",
  "Konselor berhalangan",
  "Masalah koneksi sesi online",
];

type SessionType = "individu" | "kelompok";
type SessionStatus = "selesai" | "dibatalkan";

type Session = {
  id: number;
  start: Date;
  type: SessionType;
  durasi: number;
  konselor: number;
  participants: number[];
  status: SessionStatus;
  cancelledBy: "konselor" | "klien" | null;
  cancelReason: string | null;
  cancelLead: number | null; // jam sebelum jadwal
};

const NOW = new Date();
let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

const SESI: Session[] = Array.from({ length: 60 }, (_, i) => {
  const ago = i < 6 ? 0 : i < 9 ? 1 : Math.floor(rnd() * 240);
  const hour = 8 + Math.floor(rnd() * 9);
  const start = new Date(
    NOW.getFullYear(),
    NOW.getMonth(),
    NOW.getDate() - ago,
    hour,
    0,
  );
  const type: SessionType = rnd() < 0.65 ? "individu" : "kelompok";
  const cancelled = rnd() < 0.15;
  const n = type === "individu" ? 1 : 3 + Math.floor(rnd() * 6);
  return {
    id: 1001 + i,
    start,
    type,
    durasi: rnd() < 0.7 ? 60 : 45,
    konselor: Math.floor(rnd() * 3),
    participants: Array.from({ length: n }, (_, k) => i * 10 + k),
    status: cancelled ? "dibatalkan" : "selesai",
    cancelledBy: cancelled ? (rnd() < 0.6 ? "konselor" : "klien") : null,
    cancelReason: cancelled
      ? REASONS[Math.floor(rnd() * REASONS.length)]
      : null,
    cancelLead: cancelled ? Math.round(rnd() * 48) : null,
  };
}).sort((a, b) => b.start.getTime() - a.start.getTime());

/* ========================= UTIL ========================= */
type PeriodKey = "hari" | "minggu" | "bulan" | "semester";
type TblKey = "semua" | "individu" | "kelompok" | "dibatalkan";
type ViewKey = "daftar" | "detail";

const PAGE_SIZE = 20;
const DAY = 864e5;

const PERIOD_OPTS: [PeriodKey, string][] = [
  ["hari", "Hari"],
  ["minggu", "Minggu"],
  ["bulan", "Bulan"],
  ["semester", "Semester"],
];
const TBL_OPTS: [TblKey, string][] = [
  ["semua", "Semua"],
  ["individu", "Individu"],
  ["kelompok", "Kelompok"],
  ["dibatalkan", "Dibatalkan"],
];

const anonOf = (id: number) =>
  "Klien Anonim #" +
  ((id * 2654435761) >>> 0).toString(16).slice(-4).toUpperCase();

const initials = (n: string) =>
  n
    .replace(/[^A-Za-z ]/g, "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

const fmtT = (d: Date) =>
  d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
const fmtDT = (d: Date) =>
  `${d.toLocaleDateString("id-ID", { day: "numeric", month: "short" })}, ${fmtT(d)}`;
const fmtShort = (d: Date) =>
  d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });

const parseISO = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};

type Range = { s: Date; e: Date };
const inR = (t: number, r: Range) => t >= r.s.getTime() && t < r.e.getTime();

/* Rentang waktu sesuai mode tampilan */
function getRange(
  period: PeriodKey,
  anchor: Date,
  sem: AcademicPeriod | null,
): Range {
  const y = anchor.getFullYear();
  const m = anchor.getMonth();
  const d = anchor.getDate();
  if (period === "hari")
    return { s: new Date(y, m, d), e: new Date(y, m, d + 1) };
  if (period === "minggu")
    return { s: new Date(y, m, d - 6), e: new Date(y, m, d + 1) };
  if (period === "bulan")
    return { s: new Date(y, m, 1), e: new Date(y, m + 1, 1) };
  if (!sem) return { s: new Date(0), e: new Date(0) };
  return {
    s: parseISO(sem.start),
    e: new Date(parseISO(sem.end).getTime() + DAY),
  };
}

function rangeLabel(
  period: PeriodKey,
  range: Range,
  sem: AcademicPeriod | null,
) {
  if (period === "hari")
    return range.s.toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  if (period === "minggu")
    return `${fmtShort(range.s)} – ${fmtShort(new Date(range.e.getTime() - DAY))}`;
  if (period === "bulan")
    return range.s.toLocaleDateString("id-ID", {
      month: "long",
      year: "numeric",
    });
  return sem ? `TA ${sem.ta} · ${sem.sem}` : "Belum ada periode";
}

/* Bucket untuk grafik batang per konselor */
function buckets(period: PeriodKey, range: Range) {
  const y = range.s.getFullYear();
  const m = range.s.getMonth();
  const d = range.s.getDate();
  if (period === "hari") {
    return Array.from({ length: 9 }, (_, i) => ({
      label: `${8 + i}:00`,
      s: new Date(y, m, d, 8 + i),
      e: new Date(y, m, d, 9 + i),
    }));
  }
  if (period === "semester") {
    return Array.from({ length: 6 }, (_, i) => ({
      label: new Date(y, m + i, 1).toLocaleDateString("id-ID", {
        month: "short",
      }),
      s: i === 0 ? range.s : new Date(y, m + i, 1),
      e: new Date(y, m + i + 1, 1),
    }));
  }
  const days = Math.round((range.e.getTime() - range.s.getTime()) / DAY);
  return Array.from({ length: days }, (_, i) => {
    const s = new Date(y, m, d + i);
    return { label: String(s.getDate()), s, e: new Date(y, m, d + i + 1) };
  });
}

/* ========================= KOMPONEN KECIL ========================= */
function KpiCard({
  icon: Icon,
  title,
  value,
  sub,
}: {
  icon: LucideIcon;
  title: string;
  value: string | number;
  sub: string;
}) {
  return (
    <div className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            {title}
          </p>
          <h3 className="text-3xl font-bold">{value}</h3>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-100 bg-emerald-50 text-[#15803d]">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-500">{sub}</p>
    </div>
  );
}

function SegmentTabs<T extends string>({
  options,
  value,
  onChange,
}: {
  options: [T, string][];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex w-fit flex-wrap items-center rounded-xl border border-slate-200 bg-slate-100 p-1 text-xs font-semibold text-slate-600">
      {options.map(([k, l]) => (
        <button
          key={k}
          type="button"
          onClick={() => onChange(k)}
          className={`rounded-lg px-3 py-1.5 transition-colors ${
            value === k
              ? "bg-white text-slate-800 shadow-sm"
              : "hover:text-slate-900"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

/* Pindah tampilan: Daftar Konseling / Detail per Konselor */
function ViewSwitch({
  value,
  onChange,
}: {
  value: ViewKey;
  onChange: (v: ViewKey) => void;
}) {
  const items: { key: ViewKey; label: string; icon: LucideIcon }[] = [
    { key: "daftar", label: "Daftar Konseling", icon: List },
    { key: "detail", label: "Detail Konselor", icon: UserRound },
  ];
  return (
    <div className="inline-flex rounded-xl bg-slate-100 p-1 text-xs font-bold text-slate-500">
      {items.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 transition-all ${
            value === key
              ? "bg-[#14553a] text-white shadow-sm"
              : "hover:text-slate-800"
          }`}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </button>
      ))}
    </div>
  );
}

const TILE_TONE = {
  emerald: "bg-emerald-50 text-[#15803d] border-emerald-100",
  sky: "bg-sky-50 text-sky-700 border-sky-100",
  violet: "bg-violet-50 text-violet-700 border-violet-100",
  rose: "bg-rose-50 text-rose-600 border-rose-100",
} as const;

function StatTile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  tone: keyof typeof TILE_TONE;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${TILE_TONE[tone]}`}
      >
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div>
        <p className="text-[11px] font-semibold text-slate-400">{label}</p>
        <p className="text-2xl font-bold leading-tight">{value}</p>
      </div>
    </div>
  );
}

/* ========================= PANEL DETAIL KONSELOR ========================= */
function CounselorPanel({
  sessions,
  kon,
  onKonChange,
  period,
  range,
  onOpen,
}: {
  sessions: Session[];
  kon: number;
  onKonChange: (i: number) => void;
  period: PeriodKey;
  range: Range;
  onOpen: (id: number) => void;
}) {
  const KP = sessions.filter((s) => s.konselor === kon);
  const KSelesai = KP.filter((s) => s.status === "selesai");
  const KInd = KSelesai.filter((s) => s.type === "individu").length;
  const KBatal = KP.filter((s) => s.status === "dibatalkan").length;

  const bk = buckets(period, range);
  const counts = bk.map(
    (b) =>
      KSelesai.filter((s) => inR(s.start.getTime(), { s: b.s, e: b.e })).length,
  );
  const maxCount = Math.max(1, ...counts);
  const unit =
    period === "hari" ? "jam" : period === "semester" ? "bulan" : "hari";

  const countOf = (i: number) =>
    sessions.filter((s) => s.konselor === i && s.status === "selesai").length;

  return (
    <div className="space-y-6 p-6">
      {/* Pemilih konselor */}
      <div className="grid gap-3 sm:grid-cols-3">
        {COUNSELORS.map((c, i) => {
          const active = kon === i;
          return (
            <button
              key={c}
              type="button"
              onClick={() => onKonChange(i)}
              className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all ${
                active
                  ? "border-[#14553a] bg-[#14553a] text-white shadow-md"
                  : "border-slate-200 bg-white hover:border-[#2a8f5a]/50 hover:bg-[#f6fcf8]"
              }`}
            >
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${
                  active
                    ? "bg-white/15 text-white"
                    : "bg-emerald-50 text-[#15803d]"
                }`}
              >
                {initials(c)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{c}</p>
                <p
                  className={`text-[11px] ${active ? "text-emerald-100" : "text-slate-400"}`}
                >
                  {countOf(i)} sesi selesai
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Kartu profil */}
      <div className="flex flex-col gap-4 rounded-2xl bg-gradient-to-br from-[#14553a] to-[#2a8f5a] p-5 text-white sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-lg font-bold">
            {initials(COUNSELORS[kon])}
          </div>
          <div>
            <p className="font-bold">{COUNSELORS[kon]}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-emerald-100">
              <Star className="h-3.5 w-3.5 fill-amber-300 text-amber-300" />
              {RATING[kon].toFixed(1)} rating rata-rata dari klien
            </p>
          </div>
        </div>
        <div className="rounded-xl bg-white/10 px-4 py-2.5 sm:text-right">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-100">
            Total jadwal periode ini
          </p>
          <p className="text-xl font-bold">{KP.length}</p>
        </div>
      </div>

      {/* Statistik */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          icon={CircleCheck}
          label="Sesi selesai"
          value={KSelesai.length}
          tone="emerald"
        />
        <StatTile icon={User} label="Individu" value={KInd} tone="sky" />
        <StatTile
          icon={Users}
          label="Kelompok"
          value={KSelesai.length - KInd}
          tone="violet"
        />
        <StatTile icon={Ban} label="Dibatalkan" value={KBatal} tone="rose" />
      </div>

      {/* Grafik & daftar sesi */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <div className="rounded-2xl border border-slate-200 p-5 xl:col-span-3">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold">Layanan per {unit}</p>
              <p className="text-xs text-slate-400">
                Sesi selesai pada periode yang dipilih
              </p>
            </div>
            <p className="text-xs font-semibold text-slate-500">
              Total: <span className="text-slate-800">{KSelesai.length}</span>
            </p>
          </div>
          <div className="flex h-40 items-end gap-1.5">
            {counts.map((c, i) => (
              <div
                key={i}
                className="flex h-full min-w-0 flex-1 flex-col items-center justify-end"
              >
                <span className="mb-1 text-[10px] font-bold text-slate-500">
                  {c || ""}
                </span>
                <div
                  className={`w-full rounded-t-lg transition-all ${
                    c
                      ? "bg-gradient-to-t from-[#14553a] to-[#2a8f5a]"
                      : "bg-slate-100"
                  }`}
                  style={{
                    height: `${Math.max(c ? 8 : 4, Math.round((c / maxCount) * 100))}%`,
                  }}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-1.5 border-t border-slate-100 pt-2">
            {bk.map((b, i) => (
              <span
                key={i}
                className="flex-1 truncate text-center text-[10px] text-slate-400"
              >
                {b.label}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 xl:col-span-2">
          <div className="border-b border-slate-100 px-5 py-4">
            <p className="text-sm font-bold">Sesi konselor ini</p>
            <p className="text-xs text-slate-400">
              {KP.length} jadwal pada periode ini
            </p>
          </div>
          <div className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
            {KP.length > 0 ? (
              KP.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onOpen(s.id)}
                  className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left transition-colors hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-slate-700">
                      {fmtDT(s.start)}
                    </p>
                    <p className="truncate text-[11px] text-slate-400">
                      {s.type === "individu"
                        ? anonOf(s.participants[0])
                        : `${s.participants.length} peserta`}{" "}
                      · {s.durasi} menit
                    </p>
                  </div>
                  <span
                    className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                      s.status === "selesai"
                        ? "bg-emerald-50 text-[#15803d]"
                        : "bg-rose-50 text-rose-600"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        s.status === "selesai" ? "bg-[#15803d]" : "bg-rose-500"
                      }`}
                    />
                    {s.status === "selesai" ? "Selesai" : "Dibatalkan"}
                  </span>
                </button>
              ))
            ) : (
              <p className="p-8 text-center text-xs text-slate-400">
                Tidak ada sesi pada periode ini.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ========================= HALAMAN ========================= */
export default function AdminKonselingPage() {
  const today = useMemo(() => toISO(new Date()), []);
  const periods = useMemo(() => sortPeriods(loadPeriods()), []);
  const defaultSem =
    periods.find((p) => isInPeriod(today, p)) ??
    periods[periods.length - 1] ??
    null;

  const [period, setPeriod] = useState<PeriodKey>("bulan");
  const [anchor, setAnchor] = useState(
    () => new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate(), 12),
  );
  const [semId, setSemId] = useState<string | null>(defaultSem?.id ?? null);
  const [view, setView] = useState<ViewKey>("daftar");
  const [tbl, setTbl] = useState<TblKey>("semua");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [kon, setKon] = useState(0);
  const [openId, setOpenId] = useState<number | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Tutup drawer dengan Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Kembali ke 20 data setiap filter atau periode berubah
  useEffect(() => {
    setLimit(PAGE_SIZE);
  }, [period, anchor, semId, tbl]);

  const semester = periods.find((p) => p.id === semId) ?? null;
  const range = useMemo(
    () => getRange(period, anchor, semester),
    [period, anchor, semester],
  );
  const label = rangeLabel(period, range, semester);

  const P = useMemo(
    () => SESI.filter((s) => inR(s.start.getTime(), range)),
    [range],
  );

  /* ----- navigasi periode ----- */
  const semIdx = periods.findIndex((p) => p.id === semId);
  const canPrev = period === "semester" ? semIdx > 0 : true;
  const canNext = period === "semester" ? semIdx < periods.length - 1 : true;

  function step(dir: -1 | 1) {
    if (period === "semester") {
      const next = periods[semIdx + dir];
      if (next) setSemId(next.id);
      return;
    }
    const d = new Date(anchor);
    if (period === "hari") d.setDate(d.getDate() + dir);
    else if (period === "minggu") d.setDate(d.getDate() + 7 * dir);
    else {
      d.setDate(15);
      d.setMonth(d.getMonth() + dir);
    }
    setAnchor(d);
  }

  /* ----- KPI ----- */
  const selesai = P.filter((s) => s.status === "selesai");
  const batal = P.filter((s) => s.status === "dibatalkan");
  const indCount = selesai.filter((s) => s.type === "individu").length;
  const pctBatal = P.length ? Math.round((batal.length / P.length) * 100) : 0;
  const aktifKonselor = new Set(P.map((s) => s.konselor)).size;

  /* ----- tabel ----- */
  const rows = P.filter(
    (s) =>
      tbl === "semua" ||
      (tbl === "individu" && s.type === "individu") ||
      (tbl === "kelompok" && s.type === "kelompok") ||
      (tbl === "dibatalkan" && s.status === "dibatalkan"),
  );
  const shown = rows.slice(0, limit);
  const remaining = rows.length - shown.length;

  /* ----- drawer ----- */
  const sesi = SESI.find((s) => s.id === openId) ?? null;
  const openDrawer = (id: number) => {
    setOpenId(id);
    setDrawerOpen(true);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 font-[Inter] text-slate-800">
      {/* ================= HEADER ================= */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="text-xl font-bold">Monitoring Konseling</h2>
          <p className="hidden text-xs text-slate-500 sm:block">
            Pantau sesi konseling individu dan kelompok, serta pembatalan.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <SegmentTabs
            options={PERIOD_OPTS}
            value={period}
            onChange={setPeriod}
          />

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => step(-1)}
              disabled={!canPrev}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[190px] text-center text-sm font-bold">
              {label}
            </span>
            <button
              type="button"
              onClick={() => step(1)}
              disabled={!canNext}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {period === "semester" && (
            <select
              value={semId ?? ""}
              onChange={(e) => setSemId(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#22c55e]/30"
            >
              {periods.map((p) => (
                <option key={p.id} value={p.id}>
                  TA {p.ta} · {p.sem}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* ================= KPI ================= */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          icon={CircleCheck}
          title="Sesi Selesai"
          value={selesai.length}
          sub={`${indCount} individu · ${selesai.length - indCount} kelompok`}
        />
        <KpiCard
          icon={Ban}
          title="Dibatalkan"
          value={batal.length}
          sub={`${pctBatal}% dari ${P.length} jadwal`}
        />
        <KpiCard
          icon={UserRound}
          title="Konselor Aktif"
          value={`${aktifKonselor}/${COUNSELORS.length}`}
          sub="melayani sesi pada periode ini"
        />
      </div>

      {/* ================= SECTION UTAMA (SATU TAMPILAN SEKALIGUS) ================= */}
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-base font-bold">
              {view === "daftar" ? "Daftar Konseling" : "Detail per Konselor"}
            </h3>
            <p className="text-xs text-slate-400">
              {view === "daftar"
                ? `Menampilkan ${shown.length} dari ${rows.length} sesi pada periode ini`
                : "Layanan konselor pada periode yang dipilih"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {view === "daftar" && (
              <SegmentTabs options={TBL_OPTS} value={tbl} onChange={setTbl} />
            )}
            <ViewSwitch value={view} onChange={setView} />
          </div>
        </div>

        {view === "daftar" ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/70 text-[11px] uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-6 py-3 text-left font-bold">Waktu</th>
                    <th className="px-4 py-3 text-left font-bold">Klien</th>
                    <th className="px-4 py-3 text-left font-bold">Konselor</th>
                    <th className="px-4 py-3 text-left font-bold">Jenis</th>
                    <th className="px-4 py-3 text-left font-bold">Durasi</th>
                    <th className="px-6 py-3 text-left font-bold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {shown.map((s) => (
                    <tr
                      key={s.id}
                      onClick={() => openDrawer(s.id)}
                      className="cursor-pointer transition-colors hover:bg-slate-50"
                    >
                      <td className="whitespace-nowrap px-6 py-3.5 text-xs font-medium text-slate-600">
                        {fmtDT(s.start)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-xs">
                        {s.type === "individu" ? (
                          <span className="font-semibold">
                            {anonOf(s.participants[0])}
                          </span>
                        ) : (
                          <>
                            <span className="font-semibold">
                              {s.participants.length} peserta
                            </span>{" "}
                            <span className="text-slate-400">
                              · {anonOf(s.participants[0])} dst.
                            </span>
                          </>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-xs text-slate-600">
                        {COUNSELORS[s.konselor]}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5">
                        {s.type === "individu" ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-sky-100 bg-sky-50 px-2 py-1 text-[10px] font-bold text-sky-700">
                            <User className="h-3 w-3" /> Individu
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-violet-100 bg-violet-50 px-2 py-1 text-[10px] font-bold text-violet-700">
                            <Users className="h-3 w-3" /> Kelompok
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-xs text-slate-500">
                        {s.durasi} menit
                      </td>
                      <td className="px-6 py-3.5">
                        {s.status === "selesai" ? (
                          <span className="rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-[#15803d]">
                            Selesai
                          </span>
                        ) : (
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-1">
                              <span className="rounded-full border border-rose-100 bg-rose-50 px-2.5 py-1 text-[10px] font-bold text-rose-700">
                                Dibatalkan {s.cancelledBy}
                              </span>
                              {(s.cancelLead ?? 99) < 24 && (
                                <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-700">
                                  Mendadak H-{s.cancelLead}j
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400">
                              {s.cancelReason}
                            </p>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {rows.length === 0 && (
              <div className="flex flex-col items-center py-14 text-center text-slate-400">
                <FolderOpen className="mb-2 h-8 w-8" />
                <p className="text-sm font-medium">
                  Tidak ada data konseling pada periode ini.
                </p>
              </div>
            )}

            {remaining > 0 && (
              <div className="flex flex-col items-center gap-2 border-t border-slate-100 p-4">
                <button
                  type="button"
                  onClick={() => setLimit((l) => l + PAGE_SIZE)}
                  className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-[#2a8f5a]/50 hover:bg-[#f6fcf8]"
                >
                  Muat lebih banyak
                </button>
                <p className="text-[11px] text-slate-400">
                  {remaining} sesi lagi · {Math.min(PAGE_SIZE, remaining)} akan
                  ditambahkan
                </p>
              </div>
            )}
          </>
        ) : (
          <CounselorPanel
            sessions={P}
            kon={kon}
            onKonChange={setKon}
            period={period}
            range={range}
            onOpen={openDrawer}
          />
        )}
      </section>

      {/* ================= DRAWER DETAIL SESI ================= */}
      <div
        onClick={() => setDrawerOpen(false)}
        className={`fixed inset-0 z-30 bg-slate-900/30 transition-opacity ${
          drawerOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <aside
        className={`fixed right-0 top-0 z-40 flex h-full w-full flex-col border-l border-slate-200 bg-white shadow-2xl transition-transform duration-300 sm:w-[440px] ${
          drawerOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Detail Sesi
            </p>
            <h4 className="text-base font-bold">
              {sesi ? `Sesi #${sesi.id}` : ""}
            </h4>
          </div>
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {sesi && (
          <div className="flex-1 space-y-5 overflow-y-auto p-6">
            <div className="flex flex-wrap gap-2">
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                  sesi.type === "individu"
                    ? "bg-sky-50 text-sky-700"
                    : "bg-violet-50 text-violet-700"
                }`}
              >
                {sesi.type === "individu" ? "Individu" : "Kelompok"}
              </span>
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                  sesi.status === "selesai"
                    ? "bg-emerald-50 text-[#15803d]"
                    : "bg-rose-50 text-rose-700"
                }`}
              >
                {sesi.status === "selesai" ? "Selesai" : "Dibatalkan"}
              </span>
            </div>

            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Waktu
                </dt>
                <dd className="mt-1 font-semibold">{fmtDT(sesi.start)}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Durasi
                </dt>
                <dd className="mt-1 font-semibold">{sesi.durasi} menit</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Konselor
                </dt>
                <dd className="mt-1 font-semibold">
                  {COUNSELORS[sesi.konselor]}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {sesi.type === "individu"
                    ? "Klien"
                    : `Peserta (${sesi.participants.length})`}
                </dt>
                <dd className="mt-1">
                  {sesi.type === "individu" ? (
                    <p className="font-semibold">
                      {anonOf(sesi.participants[0])}
                    </p>
                  ) : (
                    <ul className="space-y-1 text-sm">
                      {sesi.participants.map((p) => (
                        <li key={p} className="flex items-center gap-2">
                          <Lock className="h-3 w-3 text-slate-300" />
                          {anonOf(p)}
                        </li>
                      ))}
                    </ul>
                  )}
                </dd>
              </div>
            </dl>

            {sesi.status === "dibatalkan" && (
              <div
                className={`space-y-2 rounded-2xl border p-4 ${
                  (sesi.cancelLead ?? 99) < 24
                    ? "border-amber-200 bg-amber-50"
                    : "border-slate-200 bg-slate-50"
                }`}
              >
                <p
                  className={`text-xs font-bold uppercase tracking-wider ${
                    (sesi.cancelLead ?? 99) < 24
                      ? "text-amber-700"
                      : "text-slate-500"
                  }`}
                >
                  Pembatalan
                </p>
                <p className="text-sm">
                  <span className="text-slate-500">Dibatalkan oleh:</span>{" "}
                  <b className="capitalize">{sesi.cancelledBy}</b>
                </p>
                <p className="text-sm">
                  <span className="text-slate-500">Alasan:</span>{" "}
                  {sesi.cancelReason}
                </p>
                <p className="text-sm">
                  <span className="text-slate-500">Waktu:</span> H-
                  {sesi.cancelLead} jam sebelum jadwal
                  {(sesi.cancelLead ?? 99) < 24 && (
                    <span className="ml-1 rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                      Mendadak
                    </span>
                  )}
                </p>
              </div>
            )}

            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Riwayat
              </p>
              <ol className="space-y-2 border-l-2 border-slate-100 pl-4 text-xs">
                <li>
                  {fmtDT(new Date(sesi.start.getTime() - 2 * DAY))} · Sesi
                  dijadwalkan
                </li>
                {sesi.status === "selesai" ? (
                  <li>{fmtDT(sesi.start)} · Sesi selesai dicatat</li>
                ) : (
                  <li>
                    {fmtDT(
                      new Date(
                        sesi.start.getTime() - (sesi.cancelLead ?? 0) * 3600e3,
                      ),
                    )}{" "}
                    · Dibatalkan oleh {sesi.cancelledBy}
                  </li>
                )}
              </ol>
            </div>

            <p className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-[11px] text-slate-400">
              <Lock className="mt-0.5 h-3 w-3 shrink-0" />
              Identitas klien ditampilkan dalam bentuk anonim. Setiap akses
              dicatat dalam log audit.
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}
