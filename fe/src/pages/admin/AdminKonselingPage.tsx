import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  PageContainer,
  PageHeader,
  AcademicPeriodFilter,
} from "../../components/shared";
import { adminApi } from "../../lib/adminApi";
import { getPublicCounselors } from "../../lib/publicApi";
import type {
  AdminCounselingDto,
  BookingStatusApi,
  SessionStatusApi,
} from "../../types/api";
import type { AcademicPeriod } from "../../types/academicPeriod";
import {
  Ban,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Clock,
  FolderOpen,
  List,
  Loader2,
  Lock,
  RefreshCw,
  Star,
  User,
  UserRound,
  Users,
  X,
} from "lucide-react";
import {
  isInPeriod,
  mapAcademicPeriodDto,
  sortPeriods,
  toISO,
} from "../../lib/academicPeriods";
import {
  createCounselingChartBuckets,
  getCounselingDateRange,
  type CounselingDateRange,
  type CounselingPeriodKey,
} from "../../features/admin/counseling/timeSelectors";

/* ========================= TIPE & UTIL ========================= */
type PeriodKey = CounselingPeriodKey;
type TblKey = "semua" | "individu" | "kelompok" | "dibatalkan";
type ViewKey = "daftar" | "detail";
type OutcomeCategory = "completed" | "cancelled" | "active";

interface CounselorOption {
  id: string;
  name: string;
  rating: number | null;
}

interface MonitoringItem {
  id: string;
  shortId: string;
  counselorId: string;
  counselorName: string;
  clientAnon: string;
  participantCount: number;
  participantAnons: string[];
  type: "individu" | "kelompok";
  start: Date;
  durasi: number;
  bookingStatus: BookingStatusApi;
  sessionStatus: SessionStatusApi | null;
  format: string | null;
  room: string | null;
  outcome: OutcomeCategory;
  statusLabel: string;
  reason: string | null;
  createdAt: Date;
}

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

const anonFromUuid = (id: string) =>
  "Klien Anonim #" +
  (id.replace(/[^A-Fa-f0-9]/g, "").slice(-4) || "0000").toUpperCase();

const initials = (n: string) =>
  n
    .replace(/[^A-Za-z ]/g, "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "KS";

const fmtT = (d: Date) =>
  d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
const fmtDT = (d: Date) =>
  `${d.toLocaleDateString("id-ID", { day: "numeric", month: "short" })}, ${fmtT(d)}`;
const fmtShort = (d: Date) =>
  d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });

type Range = CounselingDateRange;
const inR = (t: number, r: Range) => t >= r.s.getTime() && t < r.e.getTime();

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
  return sem ? `TA ${sem.ta} · ${sem.sem}` : "Semua periode";
}

function computeDurationMinutesFromIso(
  startsAt: string,
  endsAt: string,
): number {
  const s = new Date(startsAt).getTime();
  const e = new Date(endsAt).getTime();
  const diff = Math.round((e - s) / 60000);
  return diff > 0 ? diff : 60;
}

function resolveStatusInfo(
  bookingStatus: BookingStatusApi,
  sessionStatus: SessionStatusApi | null,
): { outcome: OutcomeCategory; label: string } {
  if (sessionStatus === "completed") {
    return { outcome: "completed", label: "Selesai" };
  }
  if (
    sessionStatus === "cancelled" ||
    bookingStatus === "cancelled" ||
    bookingStatus === "rejected"
  ) {
    return {
      outcome: "cancelled",
      label: bookingStatus === "rejected" ? "Ditolak" : "Dibatalkan",
    };
  }
  if (sessionStatus === "ongoing") {
    return { outcome: "active", label: "Sedang Berlangsung" };
  }
  if (bookingStatus === "confirmed" || sessionStatus === "scheduled") {
    return { outcome: "active", label: "Terjadwal" };
  }
  if (bookingStatus === "reschedule_requested") {
    return { outcome: "active", label: "Perubahan Jadwal" };
  }
  return { outcome: "active", label: "Menunggu Konfirmasi" };
}

function mapBookingDtoToItem(
  dto: AdminCounselingDto,
  counselorNameFallback: ReadonlyMap<string, string>,
): MonitoringItem {
  const primarySession = dto.counseling_sessions?.[0] ?? null;
  const sessionStatus = primarySession?.status ?? null;
  const { outcome, label } = resolveStatusInfo(dto.status, sessionStatus);
  const counselorName =
    dto.counselor?.full_name?.trim() ||
    counselorNameFallback.get(dto.counselor_id) ||
    `Konselor #${dto.counselor_id.slice(0, 6).toUpperCase()}`;

  const clientAnon = anonFromUuid(dto.client?.id || dto.client_id || dto.id);
  const participantRecords = dto.booking_participants ?? [];
  const participantAnons =
    participantRecords.length > 0
      ? participantRecords.map((p) => anonFromUuid(p.id))
      : [clientAnon];

  const formatLabel =
    primarySession?.format === "online"
      ? "Online"
      : primarySession?.format === "offline"
        ? "Tatap Muka"
        : null;

  return {
    id: dto.id,
    shortId: dto.id.slice(0, 8).toUpperCase(),
    counselorId: dto.counselor_id,
    counselorName,
    clientAnon,
    participantCount: Math.max(
      1,
      dto.participant_count || participantAnons.length,
    ),
    participantAnons,
    type: dto.service_type === "group" ? "kelompok" : "individu",
    start: new Date(dto.starts_at),
    durasi: computeDurationMinutesFromIso(dto.starts_at, dto.ends_at),
    bookingStatus: dto.status,
    sessionStatus,
    format: formatLabel,
    room: primarySession?.room ?? null,
    outcome,
    statusLabel: label,
    reason: dto.cancellation_reason || dto.reschedule_reason || null,
    createdAt: new Date(dto.created_at),
  };
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
              ? "bg-primary text-white shadow-sm"
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

/* ========================= POPUP PILIH KONSELOR ========================= */
function CounselorPicker({
  open,
  counselors,
  selectedCounselorId,
  sessions,
  onClose,
  onSelect,
}: {
  open: boolean;
  counselors: CounselorOption[];
  selectedCounselorId: string;
  sessions: MonitoringItem[];
  onClose: () => void;
  onSelect: (counselorId: string) => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-sm font-bold text-slate-800">Pilih konselor</p>
            <p className="text-xs text-slate-400">
              Detail akan menampilkan konselor yang dipilih
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
          {counselors.map((c) => {
            const active = c.id === selectedCounselorId;
            const done = sessions.filter(
              (s) => s.counselorId === c.id && s.outcome === "completed",
            ).length;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onSelect(c.id)}
                  className={`flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors ${
                    active ? "bg-[#f6fcf8]" : "hover:bg-slate-50"
                  }`}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xs font-bold text-slate-600">
                    {initials(c.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">
                      {c.name}
                    </p>
                    <p className="text-xs text-slate-400">
                      {done} sesi selesai · rating{" "}
                      {c.rating !== null ? c.rating.toFixed(1) : "-"}
                    </p>
                  </div>
                  {active && <Check className="h-4 w-4 text-[#15803d]" />}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/* ========================= PANEL DETAIL KONSELOR ========================= */
function CounselorPanel({
  sessions,
  counselors,
  selectedCounselorId,
  onCounselorChange,
  period,
  range,
  onOpen,
}: {
  sessions: MonitoringItem[];
  counselors: CounselorOption[];
  selectedCounselorId: string;
  onCounselorChange: (id: string) => void;
  period: PeriodKey;
  range: Range;
  onOpen: (id: string) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const selectedCounselor = counselors.find(
    (c) => c.id === selectedCounselorId,
  ) ??
    counselors[0] ?? {
      id: "",
      name: "Belum ada konselor",
      rating: null,
    };

  const KP = sessions.filter((s) => s.counselorId === selectedCounselor.id);
  const KSelesai = KP.filter((s) => s.outcome === "completed");
  const KInd = KSelesai.filter((s) => s.type === "individu").length;
  const KBatal = KP.filter((s) => s.outcome === "cancelled").length;

  const bk = createCounselingChartBuckets(period, range);
  const counts = bk.map(
    (b) =>
      KSelesai.filter((s) => inR(s.start.getTime(), { s: b.s, e: b.e })).length,
  );
  const maxCount = Math.max(1, ...counts);
  const unit =
    period === "hari" ? "jam" : period === "semester" ? "bulan" : "hari";

  return (
    <div className="space-y-5 p-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold text-slate-600">
            {initials(selectedCounselor.name)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-800">
              {selectedCounselor.name}
            </p>
            <p className="mt-0.5 flex items-center gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                {selectedCounselor.rating !== null
                  ? `${selectedCounselor.rating.toFixed(1)} rating`
                  : "Belum ada rating"}
              </span>
              <span className="text-slate-300">|</span>
              <span>{KP.length} jadwal periode ini</span>
            </p>
          </div>
        </div>

        {counselors.length > 1 && (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            Ganti konselor
            <ChevronDown className="h-4 w-4 text-slate-400" />
          </button>
        )}
      </div>

      <CounselorPicker
        open={pickerOpen}
        counselors={counselors}
        selectedCounselorId={selectedCounselor.id}
        sessions={sessions}
        onClose={() => setPickerOpen(false)}
        onSelect={(id) => {
          onCounselorChange(id);
          setPickerOpen(false);
        }}
      />

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

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
        <div className="rounded-2xl border border-slate-200 p-5 xl:col-span-3">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-slate-800">
                Layanan per {unit}
              </p>
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
                <span className="mb-1 text-[10px] font-semibold text-slate-500">
                  {c || ""}
                </span>
                <div
                  className={`w-full rounded-t-md ${c ? "bg-primary" : "bg-slate-100"}`}
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
            <p className="text-sm font-bold text-slate-800">
              Sesi konselor ini
            </p>
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
                        ? s.clientAnon
                        : `${s.participantCount} peserta`}{" "}
                      · {s.durasi} menit
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                      s.outcome === "completed"
                        ? "bg-emerald-50 text-[#15803d]"
                        : s.outcome === "cancelled"
                          ? "bg-rose-50 text-rose-600"
                          : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {s.statusLabel}
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
  const [periods, setPeriods] = useState<AcademicPeriod[]>([]);
  const [allItems, setAllItems] = useState<MonitoringItem[]>([]);
  const [counselors, setCounselors] = useState<CounselorOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [period, setPeriod] = useState<PeriodKey>("bulan");
  const [anchor, setAnchor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  });
  const [semId, setSemId] = useState<string | null>(null);
  const [tbl, setTbl] = useState<TblKey>("semua");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [openId, setOpenId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const location = useLocation();
  const navState = location.state as {
    view?: ViewKey;
    konselor?: string;
    counselorId?: string;
  } | null;

  const [view, setView] = useState<ViewKey>(navState?.view ?? "daftar");
  const [selectedCounselorId, setSelectedCounselorId] = useState<string>(
    navState?.counselorId ?? "",
  );

  const fetchData = useCallback(async () => {
    const [
      bookingDtos,
      periodDtos,
      counselorAccounts,
      publicCounselors,
      feedbackDtos,
    ] = await Promise.all([
      adminApi.listCounseling(100),
      adminApi.listAcademicPeriods().catch(() => []),
      adminApi.listAccounts({ role: "counselor", limit: 100 }).catch(() => []),
      getPublicCounselors().catch(() => []),
      adminApi.listFeedback({ limit: 100 }).catch(() => []),
    ]);

    const cNameMap = new Map<string, string>();
    for (const c of publicCounselors) {
      if (c.public_name?.trim())
        cNameMap.set(c.profile_id, c.public_name.trim());
    }
    for (const acc of counselorAccounts) {
      if (acc.full_name?.trim()) cNameMap.set(acc.id, acc.full_name.trim());
    }
    for (const b of bookingDtos) {
      if (b.counselor?.full_name?.trim()) {
        cNameMap.set(b.counselor_id, b.counselor.full_name.trim());
      } else if (!cNameMap.has(b.counselor_id)) {
        cNameMap.set(
          b.counselor_id,
          `Konselor #${b.counselor_id.slice(0, 6).toUpperCase()}`,
        );
      }
    }

    const ratingSums = new Map<string, { sum: number; count: number }>();
    for (const f of feedbackDtos) {
      const prev = ratingSums.get(f.counselor_id) ?? { sum: 0, count: 0 };
      ratingSums.set(f.counselor_id, {
        sum: prev.sum + f.rating,
        count: prev.count + 1,
      });
    }

    const counselorList: CounselorOption[] = [...cNameMap.entries()]
      .map(([id, name]) => {
        const r = ratingSums.get(id);
        return {
          id,
          name,
          rating: r && r.count > 0 ? r.sum / r.count : null,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    const sortedPeriods = sortPeriods(periodDtos.map(mapAcademicPeriodDto));
    const items = bookingDtos
      .map((dto) => mapBookingDtoToItem(dto, cNameMap))
      .sort((a, b) => b.start.getTime() - a.start.getTime());

    return { sortedPeriods, counselorList, items };
  }, []);

  useEffect(() => {
    let active = true;
    void fetchData()
      .then(({ sortedPeriods, counselorList, items }) => {
        if (!active) return;
        setPeriods(sortedPeriods);
        setCounselors(counselorList);
        setAllItems(items);
        setLoadError(null);

        const defaultSem =
          sortedPeriods.find((p) => isInPeriod(today, p)) ??
          sortedPeriods[sortedPeriods.length - 1] ??
          null;
        if (defaultSem) {
          setSemId((prev) => prev ?? defaultSem.id);
        }

        if (counselorList.length > 0) {
          setSelectedCounselorId((prev) => {
            if (prev && counselorList.some((c) => c.id === prev)) return prev;
            if (navState?.konselor) {
              const byName = counselorList.find(
                (c) => c.name === navState.konselor,
              );
              if (byName) return byName.id;
            }
            return counselorList[0].id;
          });
        }
      })
      .catch((err: unknown) => {
        if (!active) return;
        setLoadError(
          err instanceof Error
            ? err.message
            : "Data monitoring konseling tidak dapat dimuat.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fetchData, today, navState?.konselor]);

  const handleRefresh = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { sortedPeriods, counselorList, items } = await fetchData();
      setPeriods(sortedPeriods);
      setCounselors(counselorList);
      setAllItems(items);
    } catch (err) {
      setLoadError(
        err instanceof Error
          ? err.message
          : "Data monitoring konseling tidak dapat dimuat.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const semester = periods.find((p) => p.id === semId) ?? null;
  const range = useMemo(
    () => getCounselingDateRange(period, anchor, semester),
    [period, anchor, semester],
  );
  const label = rangeLabel(period, range, semester);

  const P = useMemo(
    () =>
      allItems.filter((s) =>
        period === "semester" && !semester
          ? true
          : inR(s.start.getTime(), range),
      ),
    [allItems, period, semester, range],
  );

  function handlePeriodChange(p: PeriodKey) {
    setPeriod(p);
    setLimit(PAGE_SIZE);
  }

  function handleSemIdChange(id: string) {
    setSemId(id);
    setLimit(PAGE_SIZE);
  }

  function handleTblChange(t: TblKey) {
    setTbl(t);
    setLimit(PAGE_SIZE);
  }

  const semIdx = periods.findIndex((p) => p.id === semId);
  const canPrev = period === "semester" ? semIdx > 0 : true;
  const canNext = period === "semester" ? semIdx < periods.length - 1 : true;

  function step(dir: -1 | 1) {
    setLimit(PAGE_SIZE);
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
  const selesai = P.filter((s) => s.outcome === "completed");
  const batal = P.filter((s) => s.outcome === "cancelled");
  const indCount = selesai.filter((s) => s.type === "individu").length;
  const pctBatal = P.length ? Math.round((batal.length / P.length) * 100) : 0;
  const aktifKonselor = new Set(P.map((s) => s.counselorId)).size;

  /* ----- tabel ----- */
  const rows = P.filter(
    (s) =>
      tbl === "semua" ||
      (tbl === "individu" && s.type === "individu") ||
      (tbl === "kelompok" && s.type === "kelompok") ||
      (tbl === "dibatalkan" && s.outcome === "cancelled"),
  );
  const shown = rows.slice(0, limit);
  const remaining = rows.length - shown.length;

  /* ----- drawer ----- */
  const sesi = allItems.find((s) => s.id === openId) ?? null;
  const openDrawer = (id: string) => {
    setOpenId(id);
    setDrawerOpen(true);
  };

  return (
    <PageContainer role="admin">
      {/* ================= HEADER ================= */}
      <PageHeader
        title="Monitoring Konseling"
        description="Pantau sesi konseling individu dan kelompok, serta pembatalan."
        actions={
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <SegmentTabs
              options={PERIOD_OPTS}
              value={period}
              onChange={handlePeriodChange}
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
              <AcademicPeriodFilter
                periods={periods}
                selectedId={semId ?? ""}
                onSelect={(id) => handleSemIdChange(id === "all" ? "" : id)}
                showAllOption={false}
                className="relative w-full sm:w-72"
              />
            )}

            <button
              type="button"
              onClick={() => void handleRefresh()}
              disabled={loading}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
              />
              Muat ulang
            </button>
          </div>
        }
      />

      {loadError && (
        <div
          role="alert"
          className="flex flex-col justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 sm:flex-row sm:items-center"
        >
          <p>{loadError}</p>
          <button
            type="button"
            onClick={() => void handleRefresh()}
            className="shrink-0 rounded-xl bg-red-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
          >
            Coba lagi
          </button>
        </div>
      )}

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
          value={`${aktifKonselor}/${counselors.length}`}
          sub="melayani sesi pada periode ini"
        />
      </div>

      {/* ================= SECTION UTAMA ================= */}
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
              <SegmentTabs
                options={TBL_OPTS}
                value={tbl}
                onChange={handleTblChange}
              />
            )}
            <ViewSwitch value={view} onChange={setView} />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            Memuat data monitoring konseling dari server...
          </div>
        ) : view === "daftar" ? (
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
                          <span className="font-semibold">{s.clientAnon}</span>
                        ) : (
                          <>
                            <span className="font-semibold">
                              {s.participantCount} peserta
                            </span>{" "}
                            <span className="text-slate-400">
                              · {s.clientAnon} dst.
                            </span>
                          </>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-xs text-slate-600">
                        {s.counselorName}
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
                        {s.outcome === "completed" ? (
                          <span className="rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-[#15803d]">
                            {s.statusLabel}
                          </span>
                        ) : s.outcome === "cancelled" ? (
                          <div className="space-y-1">
                            <span className="rounded-full border border-rose-100 bg-rose-50 px-2.5 py-1 text-[10px] font-bold text-rose-700">
                              {s.statusLabel}
                            </span>
                            {s.reason && (
                              <p className="text-[11px] text-slate-400">
                                {s.reason}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-800">
                            <Clock className="h-3 w-3" />
                            {s.statusLabel}
                          </span>
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
                  className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-brand-accent/50 hover:bg-[#f6fcf8]"
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
            counselors={counselors}
            selectedCounselorId={selectedCounselorId}
            onCounselorChange={setSelectedCounselorId}
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
              Detail Jadwal & Sesi
            </p>
            <h4 className="text-base font-bold">
              {sesi ? `Booking #${sesi.shortId}` : ""}
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
                  sesi.outcome === "completed"
                    ? "bg-emerald-50 text-[#15803d]"
                    : sesi.outcome === "cancelled"
                      ? "bg-rose-50 text-rose-700"
                      : "bg-amber-50 text-amber-800"
                }`}
              >
                {sesi.statusLabel}
              </span>
              {sesi.format && (
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">
                  {sesi.format}
                </span>
              )}
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
                <dd className="mt-1 font-semibold">{sesi.counselorName}</dd>
              </div>
              {sesi.room && (
                <div className="col-span-2">
                  <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Ruangan / Lokasi
                  </dt>
                  <dd className="mt-1 font-semibold">{sesi.room}</dd>
                </div>
              )}
              <div className="col-span-2">
                <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {sesi.type === "individu"
                    ? "Klien"
                    : `Peserta (${sesi.participantCount})`}
                </dt>
                <dd className="mt-1">
                  {sesi.type === "individu" ? (
                    <p className="font-semibold">{sesi.clientAnon}</p>
                  ) : (
                    <ul className="space-y-1 text-sm">
                      {sesi.participantAnons.map((p, idx) => (
                        <li key={idx} className="flex items-center gap-2">
                          <Lock className="h-3 w-3 text-slate-300" />
                          {p}
                        </li>
                      ))}
                    </ul>
                  )}
                </dd>
              </div>
            </dl>

            {sesi.reason && (
              <div className="space-y-1.5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Keterangan Status
                </p>
                <p className="text-sm text-slate-700">{sesi.reason}</p>
              </div>
            )}

            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Riwayat Sistem
              </p>
              <ol className="space-y-2 border-l-2 border-slate-100 pl-4 text-xs">
                <li>{fmtDT(sesi.createdAt)} · Permintaan booking tercatat</li>
                <li>
                  {fmtDT(sesi.start)} · Status saat ini: {sesi.statusLabel}
                </li>
              </ol>
            </div>

            <p className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-[11px] text-slate-400">
              <Lock className="mt-0.5 h-3 w-3 shrink-0" />
              Identitas klien ditampilkan dalam bentuk anonim. Catatan klinis
              konseling bersifat rahasia dan tidak dapat diakses oleh Admin.
            </p>
          </div>
        )}
      </aside>
    </PageContainer>
  );
}
