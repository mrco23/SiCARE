import IconLabel from "../../components/shared/IconLabel";
import {
  PageContainer,
  PageHeader,
  useToast,
} from "../../components/shared";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  EyeOff,
  FileSignature,
  KeyRound,
  Lock,
  RefreshCw,
  Search,
  ShieldAlert,
  X,
  LockOpen,
  Printer,
  Save,
} from "lucide-react";
import {
  isInPeriod,
  loadPeriods,
  sortPeriods,
  toISO,
} from "../../lib/academicPeriods";
import type {
  ClientIntake,
  CounselingFormat as Format,
  IntakeAnswer,
} from "../../types/counseling";
import {
  INTAKE_ESSAY_OPTIONS,
  INTAKE_SCALE_OPTIONS,
  INTAKE_TOPICS,
  INTAKE_YESNO_OPTIONS,
} from "../../constants/intakeOptions";
import {
  formatBookingClientTitle,
  formatBookingRepresentative,
  getCounselorInitials as initials,
} from "../../features/counselor/shared/presentation";
import { useCounselorHistoryAccess } from "../../features/history/hooks/useCounselorHistoryAccess";
import {
  counselorHistorySessionKey as sessionKey,
  formatCounselorHistoryDate as fmtDate,
  getCounselorHistoryDateRange as getDateRange,
  getCounselorHistoryDateRangeLabel as dateRangeLabel,
  matchesCounselorHistoryFilter as matches,
  type CounselorHistoryPeriod as PeriodKey,
} from "../../features/counselor/history/historySelectors";
import { counselorApi } from "../../lib/counselorApi";
import CounselorSessionReportPrint from "../../components/reports/CounselorSessionReportPrint";
import { getLicenseExpiry } from "../../features/counselor/profile/licenseStatus";
import type {
  BookingRecordBaseDto,
  CounselorHistoryResponseDto,
  CounselorSessionNotesPatchApi,
  CounselorSessionReportDto,
} from "../../types/api";

export interface ClientSession {
  id: number;
  uid: string;
  code: string;
  topic: string;
  format: Format;
  date: string;
  time: string;
  status: "Selesai" | "Dibatalkan";
  counselorNote: string | null;
  clientNote: string | null;
  followUp: string | null;
  intake: ClientIntake | null;
  participants: { id: string; name: string }[];
}

export interface Client {
  id: string;
  name: string;
  photoUrl: string | null;
  sessions: ClientSession[];
}

type NoteTab = "konselor" | "klien" | "tindak";

const PERIOD_OPTIONS: [PeriodKey, string][] = [
  ["hari", "Hari"],
  ["minggu", "Minggu"],
  ["bulan", "Bulan"],
  ["semester", "Semester"],
];

const NOTE_TABS: {
  key: NoteTab;
  label: string;
  hint: string;
  empty: string;
}[] = [
  {
    key: "konselor",
    label: "Catatan konselor",
    hint: "Hanya dapat dibaca konselor yang menangani. Tidak tercetak di laporan.",
    empty: "Belum ada catatan konselor untuk sesi ini.",
  },
  {
    key: "klien",
    label: "Untuk klien",
    hint: "Ditujukan untuk klien. Tercetak di laporan.",
    empty: "Belum ada catatan untuk klien.",
  },
  {
    key: "tindak",
    label: "Tindak lanjut",
    hint: "Rencana untuk sesi berikutnya. Tercetak di laporan.",
    empty: "Belum ada catatan tindak lanjut.",
  },
];

const YN_PILL: Record<IntakeAnswer, string> = {
  Ya: "bg-red-50 text-red-700 ring-red-200",
  Mungkin: "bg-amber-50 text-amber-700 ring-amber-200",
  Tidak: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

const CONSENT_PDF_URL = "/informed-consent.pdf";

function sessionCode(id: string): string {
  return `KNS-${id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

function ClientAvatar({
  name,
  url,
  className = "",
  fallbackClass = "bg-primary-soft text-primary",
}: {
  name: string;
  url?: string | null;
  className?: string;
  fallbackClass?: string;
}) {
  const [broken, setBroken] = useState(false);
  if (url && !broken) {
    return (
      <img
        src={url}
        alt={name}
        onError={() => setBroken(true)}
        className={`shrink-0 rounded-full object-cover ${className}`}
      />
    );
  }
  return (
    <div
      aria-label={name}
      className={`flex shrink-0 items-center justify-center rounded-full font-bold ${fallbackClass} ${className}`}
    >
      {initials(name)}
    </div>
  );
}

function NoteText({
  value,
  emptyText,
}: {
  value?: string | null;
  emptyText: string;
}) {
  const text = value?.trim();
  if (!text) {
    return <p className="text-sm italic text-gray-400">{emptyText}</p>;
  }
  return (
    <p className="whitespace-pre-line text-sm leading-relaxed text-gray-700">
      {text}
    </p>
  );
}

function IntakeSection({ intake }: { intake: ClientIntake | null }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white">
      <header className="border-b border-gray-200 px-4 py-4 sm:px-6">
        <h3 className="text-base font-bold text-gray-900">
          Jawaban form pesanan konseling
        </h3>
        <p className="mt-0.5 text-xs text-gray-500">
          Diisi klien saat memesan sesi konseling
        </p>
      </header>

      {!intake ? (
        <p className="p-4 text-sm italic text-gray-400 sm:p-6">
          Jawaban form belum tersedia.
        </p>
      ) : (
        <div className="divide-y divide-gray-100">
          <div className="space-y-3 p-4 sm:p-6">
            <h4 className="text-xs font-bold uppercase tracking-wide text-gray-500">
              Pertanyaan ya / tidak
            </h4>
            {INTAKE_YESNO_OPTIONS.map(({ key, label }) => {
              const answer = intake[key];
              return (
                <div
                  key={key}
                  className="flex items-start justify-between gap-3"
                >
                  <p className="text-sm text-gray-700">{label}</p>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${YN_PILL[answer]}`}
                  >
                    {answer}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="space-y-3 p-4 sm:p-6">
            <h4 className="text-xs font-bold uppercase tracking-wide text-gray-500">
              Skala
            </h4>
            <div className="grid gap-3 sm:grid-cols-2">
              {INTAKE_SCALE_OPTIONS.map(({ key, label }) => (
                <div
                  key={key}
                  className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-2.5"
                >
                  <span className="text-sm text-gray-700">{label}</span>
                  <span className="text-sm font-bold text-gray-900">
                    {intake[key]}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3 p-4 sm:p-6">
            <h4 className="text-xs font-bold uppercase tracking-wide text-gray-500">
              Topik yang dipilih
            </h4>
            {intake.topics.length === 0 ? (
              <p className="text-sm italic text-gray-400">
                Tidak ada topik dipilih.
              </p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {INTAKE_TOPICS.filter((t) => intake.topics.includes(t)).map(
                  (t) => (
                    <li
                      key={t}
                      className="rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary"
                    >
                      {t}
                    </li>
                  ),
                )}
              </ul>
            )}
            {intake.other?.trim() && (
              <p className="text-sm text-gray-700">
                <span className="font-semibold">Lainnya: </span>
                {intake.other}
              </p>
            )}
          </div>

          <div className="space-y-5 p-4 sm:p-6">
            <h4 className="text-xs font-bold uppercase tracking-wide text-gray-500">
              Jawaban uraian
            </h4>
            {INTAKE_ESSAY_OPTIONS.map(({ key, label }) => (
              <div key={key}>
                <p className="text-sm font-semibold text-gray-800">{label}</p>
                <div className="mt-1.5">
                  <NoteText value={intake[key]} emptyText="Tidak diisi." />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function SessionDetailView({
  client,
  session,
  tab,
  onTab,
  onBackList,
  onBackClient,
  onOpenConsent,
  onSaveNotes,
  onPrintReport,
  printing,
}: {
  client: Client;
  session: ClientSession;
  tab: NoteTab;
  onTab: (t: NoteTab) => void;
  onBackList: () => void;
  onBackClient: () => void;
  onOpenConsent: () => void;
  onSaveNotes: (input: CounselorSessionNotesPatchApi) => Promise<boolean>;
  onPrintReport: (participantId: string | null) => void;
  printing: boolean;
}) {
  const activeTab = NOTE_TABS.find((t) => t.key === tab) ?? NOTE_TABS[0];
  const isCompleted = session.status === "Selesai";
  const saved = {
    konselor: session.counselorNote ?? "",
    klien: session.clientNote ?? "",
    tindak: session.followUp ?? "",
  };
  const [draft, setDraft] = useState(saved);
  const [savingNotes, setSavingNotes] = useState(false);
  const [participantId, setParticipantId] = useState(
    session.participants[0]?.id ?? "",
  );
  const notesDirty = NOTE_TABS.some((t) => draft[t.key] !== saved[t.key]);
  const noteValue = draft[tab];
  const isGroup = session.format === "Kelompok";

  const saveNotes = async () => {
    setSavingNotes(true);
    await onSaveNotes({
      counselor_note: draft.konselor,
      client_note: draft.klien,
      follow_up: draft.tindak,
    });
    setSavingNotes(false);
  };

  return (
    <>
      {/* Breadcrumb: Riwayat Konseling / Nama Klien / Kode Konseling */}
      <nav
        aria-label="Breadcrumb"
        className="flex min-w-0 flex-wrap items-center gap-1.5 text-sm text-gray-500"
      >
        <button
          type="button"
          onClick={onBackList}
          className="inline-flex shrink-0 items-center gap-1 font-semibold text-primary hover:underline"
        >
          <ChevronLeft className="h-4 w-4" />
          Riwayat Konseling
        </button>
        <span>/</span>
        <button
          type="button"
          onClick={onBackClient}
          className="max-w-[40%] truncate font-medium text-primary hover:underline sm:max-w-none"
        >
          {client.name}
        </button>
        <span>/</span>
        <span className="truncate font-mono text-gray-700">{session.code}</span>
      </nav>

      {/* Ringkasan sesi */}
      <div className="mt-5 flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                session.status === "Selesai"
                  ? "bg-primary-soft text-primary"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {session.status}
            </span>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                session.format === "Kelompok"
                  ? "bg-yellow-100 text-yellow-800"
                  : "bg-emerald-100 text-emerald-800"
              }`}
            >
              {session.format}
            </span>
          </div>
          <h2 className="mt-2 text-lg font-bold text-gray-900 sm:text-xl">
            {session.topic}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {fmtDate(session.date)} · {session.time} WITA
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:items-end">
          <button
            type="button"
            onClick={onOpenConsent}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-primary px-3.5 py-2 text-sm font-semibold text-primary hover:bg-primary-soft"
          >
            <FileSignature className="h-4 w-4" />
            Lihat informed consent
          </button>
          {isCompleted && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {isGroup && session.participants.length > 0 && (
                <select
                  aria-label="Peserta laporan"
                  value={participantId}
                  onChange={(e) => setParticipantId(e.target.value)}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                >
                  {session.participants.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              )}
              <button
                type="button"
                disabled={printing || notesDirty}
                title={notesDirty ? "Simpan catatan terlebih dahulu" : undefined}
                onClick={() => onPrintReport(isGroup ? participantId || null : null)}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
              >
                <Printer className="h-4 w-4" />
                {printing ? "Menyiapkan..." : "Cetak Laporan"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Catatan: satu kartu, tiga tab, teks biasa */}
      <section className="mt-5 overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <div
          role="tablist"
          aria-label="Jenis catatan"
          className="no-scrollbar flex overflow-x-auto border-b border-gray-200"
        >
          {NOTE_TABS.map((t) => {
            const active = t.key === tab;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onTab(t.key)}
                className={`-mb-px shrink-0 border-b-2 px-4 py-3 text-sm transition sm:px-6 ${
                  active
                    ? "border-primary font-semibold text-primary"
                    : "border-transparent font-medium text-gray-500 hover:text-gray-800"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        <div role="tabpanel" className="p-4 sm:p-6">
          <p className="mb-3 text-xs text-gray-500">{activeTab.hint}</p>
          {isCompleted ? (
            <>
              <textarea
                value={noteValue}
                rows={6}
                maxLength={tab === "tindak" ? 5000 : 10000}
                disabled={savingNotes}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, [tab]: e.target.value }))
                }
                placeholder={activeTab.empty}
                className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
              <div className="mt-3 flex items-center justify-end gap-3">
                {notesDirty && (
                  <span className="text-xs text-amber-700">
                    Ada perubahan yang belum disimpan.
                  </span>
                )}
                <button
                  type="button"
                  disabled={savingNotes || !notesDirty}
                  onClick={() => void saveNotes()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {savingNotes ? "Menyimpan..." : "Simpan catatan"}
                </button>
              </div>
            </>
          ) : (
            <NoteText value={noteValue} emptyText={activeTab.empty} />
          )}
        </div>
      </section>

      {/* Jawaban form pesanan konseling di bawah catatan */}
      <div className="mt-5">
        <IntakeSection intake={session.intake} />
      </div>
    </>
  );
}

export default function KonselorRiwayatPage() {
  const navigate = useNavigate();
  const today = useMemo(() => toISO(new Date()), []);
  const periods = useMemo(() => sortPeriods(loadPeriods()), []);
  const defaultSemester =
    periods.find((p) => isInPeriod(today, p)) ??
    periods[periods.length - 1] ??
    null;

  const [period, setPeriod] = useState<PeriodKey>("bulan");
  const [anchor, setAnchor] = useState(
    () =>
      new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        new Date().getDate(),
        12,
      ),
  );
  const [semesterId, setSemesterId] = useState<string | null>(
    defaultSemester?.id ?? null,
  );
  const [format, setFormat] = useState<Format>("Individu");
  const [query, setQuery] = useState("");
  const [timeSort, setTimeSort] = useState<"terbaru" | "terlama">("terbaru");

  // Level 1 = daftar klien, level 2 = sesi klien, level 3 = detail sesi.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailUid, setDetailUid] = useState<string | null>(null);
  const [noteTab, setNoteTab] = useState<NoteTab>("konselor");
  const [consentUid, setConsentUid] = useState<string | null>(null);
  const [report, setReport] = useState<CounselorSessionReportDto | null>(null);
  const [printing, setPrinting] = useState(false);

  const [pwInput, setPwInput] = useState("");
  const [pwVisible, setPwVisible] = useState(false);
  const [pwError, setPwError] = useState("");
  const [verifying, setVerifying] = useState(false);

  const toast = useToast();

  const handleAccessExpired = useCallback(() => {
    setSelectedId(null);
    setDetailUid(null);
    setConsentUid(null);
    toast.info("Akses riwayat terkunci kembali.");
  }, [toast]);

  const handleCooldownExpired = useCallback(() => setPwError(""), []);

  const {
    attemptState,
    hasAccess,
    grantToken,
    timerText,
    isPasswordLocked: pwLocked,
    isConfigured,
    maxAttempts: MAX_ATTEMPTS,
    unlock: unlockHistory,
    lock: lockHistory,
    initPassword,
  } = useCounselorHistoryAccess(handleAccessExpired, handleCooldownExpired);

  // Live session and booking data from backend API
  const [apiClients, setApiClients] = useState<Client[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const loadClientsFromResponse = useCallback(
    (res: CounselorHistoryResponseDto) => {
      if (!res.configured) {
        setApiClients([]);
        return;
      }

      const clientMap = new Map<string, Client>();
      const bookingMap = new Map<string, BookingRecordBaseDto>();
      for (const b of res.bookings || []) {
        bookingMap.set(b.id, b);
      }

      const profileMap = new Map<string, (typeof res.clients)[number]>();
      for (const p of res.clients || []) {
        profileMap.set(p.id, p);
      }

      const noteMap = new Map<
        string,
        NonNullable<CounselorHistoryResponseDto["session_notes"]>[number]
      >();
      for (const n of res.session_notes || []) {
        noteMap.set(n.session_id, n);
      }

      const intakeMap = new Map<string, ClientIntake>();
      for (const i of res.intake_answers || []) {
        intakeMap.set(i.booking_id, i.answers);
      }

      for (const s of res.sessions || []) {
        if (s.status !== "completed" && s.status !== "cancelled") continue;
        const b = bookingMap.get(s.booking_id);
        const clientId = b?.client_id || b?.id || s.id;
        const profileInfo = profileMap.get(b?.client_id || "");
        const repName = formatBookingRepresentative(b);
        const clientName =
          profileInfo?.full_name || repName || formatBookingClientTitle(b);

        if (!clientMap.has(clientId)) {
          clientMap.set(clientId, {
            id: clientId,
            name: clientName,
            photoUrl: profileInfo?.photo_url ?? null,
            sessions: [],
          });
        }

        const client = clientMap.get(clientId)!;
        const startDate = s.starts_at.split("T")[0] || today;
        const startTime = s.starts_at.includes("T")
          ? s.starts_at.split("T")[1].slice(0, 5).replace(":", ".")
          : "10.00";
        const note = noteMap.get(s.id);

        client.sessions.push({
          id: Number(s.id.replace(/\D/g, "").slice(0, 8)) || Date.now(),
          uid: s.id,
          code: sessionCode(s.id),
          topic: b?.group_name
            ? `Konseling Kelompok: ${b.group_name}`
            : "Konseling Pengembangan Diri & Akademik",
          format: b?.service_type === "group" ? "Kelompok" : "Individu",
          date: startDate,
          time: startTime,
          status: s.status === "cancelled" ? "Dibatalkan" : "Selesai",
          counselorNote: note?.counselor_note ?? null,
          clientNote: note?.client_note ?? null,
          followUp: note?.follow_up ?? null,
          intake: (b && intakeMap.get(b.id)) || null,
          participants: (b?.booking_participants ?? []).map((p) => ({
            id: p.id,
            name: p.display_name,
          })),
        });
      }

      setApiClients(Array.from(clientMap.values()));
    },
    [today],
  );

  const saveSessionNotes = async (
    sessionUid: string,
    input: CounselorSessionNotesPatchApi,
  ): Promise<boolean> => {
    if (!grantToken) return false;
    try {
      const updated = await counselorApi.saveSessionNotes(
        sessionUid,
        input,
        grantToken,
      );
      setApiClients((prev) =>
        prev.map((c) => ({
          ...c,
          sessions: c.sessions.map((s) =>
            s.uid === sessionUid
              ? {
                  ...s,
                  counselorNote: updated.counselor_note,
                  clientNote: updated.client_note,
                  followUp: updated.follow_up,
                }
              : s,
          ),
        })),
      );
      toast.success("Catatan sesi berhasil disimpan.");
      return true;
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Catatan sesi tidak dapat disimpan.",
      );
      return false;
    }
  };

  const printSessionReport = async (
    sessionUid: string,
    participantId: string | null,
  ) => {
    if (!grantToken) return;
    setPrinting(true);
    try {
      const data = await counselorApi.getSessionReport(
        sessionUid,
        participantId,
        grantToken,
      );
      const expiry = getLicenseExpiry(data.counselor.sipp_silp_valid_until);
      if (expiry?.state === "expired") toast.error(expiry.label);
      setReport(data);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Laporan tidak dapat disiapkan.",
      );
    } finally {
      setPrinting(false);
    }
  };

  useEffect(() => {
    if (!report) return;
    const clear = () => setReport(null);
    window.addEventListener("afterprint", clear);
    const frame = window.requestAnimationFrame(() => window.print());
    return () => {
      window.removeEventListener("afterprint", clear);
      window.cancelAnimationFrame(frame);
    };
  }, [report]);

  const fetchHistoryData = useCallback(
    async (token: string) => {
      setLoadingHistory(true);
      setHistoryError(null);
      try {
        const res = await counselorApi.getHistory(token);
        loadClientsFromResponse(res);
      } catch (err: unknown) {
        setHistoryError(
          err instanceof Error
            ? err.message
            : "Gagal memuat riwayat konseling dari server.",
        );
      } finally {
        setLoadingHistory(false);
      }
    },
    [loadClientsFromResponse],
  );

  useEffect(() => {
    if (!hasAccess || !grantToken) {
      return;
    }

    let active = true;
    counselorApi
      .getHistory(grantToken)
      .then((res) => {
        if (!active) return;
        loadClientsFromResponse(res);
        setHistoryError(null);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setHistoryError(
          err instanceof Error
            ? err.message
            : "Gagal memuat riwayat konseling dari server.",
        );
      });

    return () => {
      active = false;
    };
  }, [hasAccess, grantToken, loadClientsFromResponse]);

  const allClients = useMemo(() => apiClients, [apiClients]);


  const semester = periods.find((p) => p.id === semesterId) ?? null;
  const range = useMemo(
    () => getDateRange(period, anchor, semester),
    [period, anchor, semester],
  );
  const label = dateRangeLabel(period, range, semester);

  function stepPeriod(direction: -1 | 1) {
    if (period === "semester") {
      const index = periods.findIndex((p) => p.id === semesterId);
      const next = periods[index + direction];
      if (next) setSemesterId(next.id);
      return;
    }
    const next = new Date(anchor);
    if (period === "hari") next.setDate(next.getDate() + direction);
    else if (period === "minggu") next.setDate(next.getDate() + 7 * direction);
    else {
      next.setDate(15);
      next.setMonth(next.getMonth() + direction);
    }
    setAnchor(next);
  }

  const semesterIndex = periods.findIndex((p) => p.id === semesterId);
  const canPrevious = period !== "semester" || semesterIndex > 0;
  const canNext = period !== "semester" || semesterIndex < periods.length - 1;

  // Level 1: klien diurutkan dari konseling terbaru.
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allClients
      .filter((c) => !q || c.name.toLowerCase().includes(q))
      .map((c) => {
        const sessions = c.sessions.filter((s) => matches(s, format, range));
        const latest =
          sessions
            .map((s) => s.date)
            .sort()
            .at(-1) ?? "";
        return { client: c, count: sessions.length, latest };
      })
      .filter((r) => r.count > 0)
      .sort((a, b) => b.latest.localeCompare(a.latest));
  }, [allClients, query, format, range]);

  const selected = allClients.find((c) => c.id === selectedId) ?? null;

  // Level 2: sesi klien diurutkan sesuai dropdown.
  const detailSessions = useMemo(() => {
    if (!selected) return [];
    return selected.sessions
      .filter((s) => matches(s, format, range))
      .sort((a, b) =>
        timeSort === "terlama"
          ? sessionKey(a).localeCompare(sessionKey(b))
          : sessionKey(b).localeCompare(sessionKey(a)),
      );
  }, [selected, format, range, timeSort]);

  const lastDate =
    detailSessions
      .map((s) => s.date)
      .sort()
      .at(-1) ?? "";

  // Level 3: sesi yang dipilih (tidak ikut filter agar tetap terbuka).
  const detailSession =
    selected && detailUid
      ? (selected.sessions.find((s) => s.uid === detailUid) ?? null)
      : null;

  const consentSession =
    selected && consentUid
      ? (selected.sessions.find((s) => s.uid === consentUid) ?? null)
      : null;

  const pwUsed = attemptState.count;

  function handleOpenClient(cid: string) {
    if (!hasAccess) return;
    setSelectedId(cid);
    setDetailUid(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleOpenDetail(uid: string) {
    if (!selectedId || !hasAccess) {
      toast.info("Akses habis. Masukkan kata sandi kembali.");
      backToClients();
      return;
    }
    setDetailUid(uid);
    setNoteTab("konselor");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function backToClientDetail() {
    setDetailUid(null);
    setConsentUid(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function backToClients() {
    setSelectedId(null);
    setDetailUid(null);
    setConsentUid(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function closePw() {
    setPwInput("");
    navigate("/konselor");
  }

  async function handleUnlock(e: FormEvent) {
    e.preventDefault();
    if (verifying) return;
    setVerifying(true);
    setPwError("");
    try {
      if (isConfigured === false) {
        if (pwInput.length < 4) {
          setPwError("Kata sandi riwayat minimal 4 karakter.");
          return;
        }
        const initRes = await initPassword(pwInput);
        if (!initRes.success) {
          setPwError(initRes.message || "Gagal mengatur kata sandi riwayat.");
          return;
        }
      }

      const result = await unlockHistory(pwInput);
      if (result.status === "success") {
        setPwInput("");
        setPwError("");
        toast.info(
          "Riwayat konseling dibuka. Terkunci otomatis dalam 30 menit.",
        );
        return;
      }
      if (result.status === "locked") {
        setPwInput("");
        setPwError(
          result.message ||
            "Terlalu banyak percobaan. Akses dikunci sementara.",
        );
        return;
      }
      if (result.status === "invalid") {
        setPwInput("");
        setPwError(
          result.message ||
            `Kata sandi salah. Sisa percobaan: ${result.remainingAttempts}`,
        );
        return;
      }
      setPwError(result.message || "Gagal membuka riwayat konseling.");
    } catch (err: unknown) {
      setPwError(
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan sistem saat memverifikasi kata sandi.",
      );
    } finally {
      setVerifying(false);
    }
  }

  function handleOpenConsent(uid: string) {
    if (!hasAccess || !selectedId) {
      setConsentUid(null);
      return;
    }
    setConsentUid(uid);
  }

  return (
    <PageContainer
      role="counselor"
      spacing="none"
      className={report ? "report-print-page" : ""}
    >
      {report && <CounselorSessionReportPrint report={report} />}
      {/* Timer Bar when Access Granted */}
      {hasAccess && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-[#064E3B] sm:px-5">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#064E3B]" />
            <span>
              Akses riwayat terbuka sementara (sisa waktu:{" "}
              <span className="font-mono font-bold">{timerText}</span>)
            </span>
          </div>
          <button
            type="button"
            onClick={lockHistory}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-bold text-[#064E3B] transition hover:bg-emerald-100/50"
          >
            <Lock className="h-3.5 w-3.5" />
            Kunci Sekarang
          </button>
        </div>
      )}

      {hasAccess &&
        (!selected ? (
          <>
            {/* ================= LEVEL 1: DAFTAR KLIEN ================= */}
            <PageHeader
              title="Riwayat Konseling"
              description="Pilih klien untuk melihat riwayat konseling terbaru."
            />

            {/* Filter nama, format, dan periode waktu */}
            <div className="mt-6 space-y-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm sm:p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Cari nama klien ..."
                    className="w-full rounded-xl border border-gray-200 bg-gray-100/70 py-3 pl-12 pr-4 text-sm text-gray-800 outline-none placeholder:text-gray-500 focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/15"
                  />
                </div>

                <div
                  role="tablist"
                  aria-label="Format konseling"
                  className="flex w-full rounded-xl border border-gray-200 bg-gray-100/70 p-1 lg:w-auto"
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
                        className={`flex-1 whitespace-nowrap rounded-lg px-4 py-2 text-sm transition lg:flex-none ${
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
              </div>

              <div className="flex flex-col gap-3 border-t border-gray-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-1 rounded-xl border border-gray-200 bg-gray-100/70 p-1">
                  {PERIOD_OPTIONS.map(([key, labelText]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setPeriod(key)}
                      className={`rounded-lg px-3 py-2 text-xs font-semibold transition sm:text-sm ${
                        period === key
                          ? "bg-white text-gray-900 shadow-sm"
                          : "text-gray-500 hover:text-gray-900"
                      }`}
                    >
                      {labelText}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => stepPeriod(-1)}
                    disabled={!canPrevious}
                    aria-label="Periode sebelumnya"
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="min-w-[170px] flex-1 text-center text-sm font-semibold text-gray-800 sm:flex-none">
                    {label}
                  </span>
                  <button
                    type="button"
                    onClick={() => stepPeriod(1)}
                    disabled={!canNext}
                    aria-label="Periode berikutnya"
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-40"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>

                  {period === "semester" && (
                    <select
                      value={semesterId ?? ""}
                      onChange={(e) => setSemesterId(e.target.value)}
                      aria-label="Pilih semester akademik"
                      className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-xs font-semibold text-gray-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
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
            </div>

            {historyError && (
              <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 shrink-0 text-red-500" />
                  <span>{historyError}</span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    grantToken && void fetchHistoryData(grantToken)
                  }
                  className="inline-flex items-center gap-1.5 rounded-xl border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Coba Lagi
                </button>
              </div>
            )}

            {loadingHistory && (
              <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="animate-pulse rounded-2xl border border-gray-200 bg-white p-5"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-gray-200" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-3/4 rounded bg-gray-200" />
                        <div className="h-3 w-1/2 rounded bg-gray-100" />
                      </div>
                    </div>
                    <div className="mt-4 flex justify-between border-t border-gray-100 pt-4">
                      <div className="h-3 w-20 rounded bg-gray-100" />
                      <div className="h-5 w-14 rounded-full bg-gray-200" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!loadingHistory && allClients.length === 0 && (
              <div className="mt-6 rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-[#064E3B]">
                  <FileSignature className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-base font-bold text-gray-900">
                  Belum ada riwayat konseling.
                </h3>
                <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">
                  Riwayat sesi konseling yang telah selesai atau dibatalkan akan
                  tercatat secara otomatis di sini.
                </p>
              </div>
            )}

            {!loadingHistory && allClients.length > 0 && (
              <>
                <p className="mt-4 text-xs text-gray-500">
                  Menampilkan {rows.length} klien · {format} · {label}
                </p>

                <ul className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {rows.map(({ client, count, latest }) => (
                    <li key={client.id}>
                      <button
                        type="button"
                        onClick={() => handleOpenClient(client.id)}
                        className="flex w-full flex-col rounded-2xl border border-gray-200 bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-[#36c08f]/60 hover:shadow-md"
                      >
                        <div className="flex items-center gap-3">
                          <ClientAvatar
                            name={client.name}
                            url={client.photoUrl}
                            className="h-12 w-12 text-sm"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold text-gray-900">
                              {client.name}
                            </p>
                            <p className="truncate text-xs text-gray-500">
                              Terakhir konseling {fmtDate(latest)}
                            </p>
                          </div>
                        </div>
                        <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4 text-sm">
                          <span className="text-xs text-gray-500">
                            Konseling terbaru
                          </span>
                          <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">
                            {count} sesi {format.toLowerCase()}
                          </span>
                        </div>
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
            )}
          </>
        ) : detailSession ? (
          /* ================= LEVEL 3: DETAIL SESI ================= */
          <SessionDetailView
            client={selected}
            session={detailSession}
            tab={noteTab}
            onTab={setNoteTab}
            onBackList={backToClients}
            onBackClient={backToClientDetail}
            onOpenConsent={() => handleOpenConsent(detailSession.uid)}
            key={detailSession.uid}
            onSaveNotes={(input) => saveSessionNotes(detailSession.uid, input)}
            onPrintReport={(participantId) => void printSessionReport(detailSession.uid, participantId)}
            printing={printing}
          />
        ) : (
          <>
            {/* ================= LEVEL 2: RIWAYAT SESI KLIEN ================= */}
            <nav className="flex min-w-0 items-center gap-2 text-sm text-gray-500">
              <button
                type="button"
                onClick={backToClients}
                className="inline-flex shrink-0 items-center gap-1.5 font-semibold text-primary hover:underline"
              >
                <ChevronLeft className="h-4 w-4" />
                Riwayat Konseling
              </button>
              <span>/</span>
              <span className="truncate text-gray-700">{selected.name}</span>
            </nav>

            <div className="mt-5 flex flex-col gap-5 rounded-2xl border border-gray-200 bg-white p-5 sm:flex-row sm:items-center sm:p-6">
              <ClientAvatar
                name={selected.name}
                url={selected.photoUrl}
                className="h-16 w-16 text-xl"
                fallbackClass="bg-gradient-to-br from-primary to-[#36c08f] text-white"
              />
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-bold sm:text-2xl">
                  {selected.name}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Sesi konseling {format.toLowerCase()} · {label}
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
                  {format} · {label}
                </p>
              </div>
              <div className="relative">
                <select
                  value={timeSort}
                  onChange={(e) =>
                    setTimeSort(e.target.value as "terbaru" | "terlama")
                  }
                  aria-label="Urutkan sesi"
                  className="w-full appearance-none rounded-xl border border-gray-200 bg-gray-100/70 py-2.5 pl-4 pr-10 text-sm text-gray-600 outline-none focus:border-primary focus:bg-white sm:w-auto"
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
                  <li key={s.uid} className="relative">
                    <span className="absolute -left-[27px] top-5 h-3 w-3 rounded-full border-2 border-white bg-[#36c08f] sm:-left-[35px]" />
                    <div className="rounded-2xl border border-gray-200 bg-white p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900">
                            {s.topic}
                          </p>
                          <p className="mt-0.5 text-sm text-gray-500">
                            {fmtDate(s.date)} · {s.time} WITA
                          </p>
                          <p className="mt-0.5 font-mono text-xs text-gray-400">
                            {s.code}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            s.format === "Kelompok"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {s.format}
                        </span>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            s.status === "Selesai"
                              ? "bg-primary-soft text-primary"
                              : "bg-red-50 text-red-700"
                          }`}
                        >
                          {s.status}
                        </span>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenConsent(s.uid)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-primary px-3.5 py-2 text-sm font-semibold text-primary hover:bg-primary-soft"
                          >
                            <FileSignature className="h-4 w-4" />
                            Lihat informed consent
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenDetail(s.uid)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-white hover:bg-primary-dark"
                          >
                            Lihat detail
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </>
        ))}

      {/* ================= MODAL PASSWORD ================= */}
      {!hasAccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0c2619]/45 p-4 backdrop-blur-[2px]">
          <form
            onSubmit={handleUnlock}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div
              className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl ${
                isConfigured === false
                  ? "bg-amber-50 text-amber-600"
                  : "bg-primary-soft text-primary"
              }`}
            >
              {isConfigured === false ? (
                <KeyRound className="h-6 w-6" />
              ) : (
                <Lock className="h-6 w-6" />
              )}
            </div>
            <h2 className="text-lg font-bold">
              {isConfigured === false
                ? "Atur Sandi Riwayat Konseling"
                : "Buka Riwayat Konseling"}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {isConfigured === false
                ? "Kata sandi riwayat belum dikonfigurasi di database. Buat kata sandi khusus (minimal 4 karakter) untuk melindungi rekam medis konseling Anda."
                : "Masukkan kata sandi khusus untuk membuka seluruh riwayat dan catatan konseling. Ini berbeda dari kata sandi login Anda."}
            </p>

            <label
              htmlFor="pwInput"
              className="mt-5 block text-sm font-medium text-gray-700"
            >
              {isConfigured === false
                ? "Kata sandi riwayat baru"
                : "Kata sandi"}
            </label>
            <div className="relative mt-1.5">
              <input
                id="pwInput"
                type={pwVisible ? "text" : "password"}
                autoComplete="off"
                autoFocus
                value={pwInput}
                onChange={(e) => setPwInput(e.target.value)}
                disabled={pwLocked || verifying}
                placeholder={
                  isConfigured === false
                    ? "Buat kata sandi baru (min. 4 karakter)"
                    : "Masukkan kata sandi riwayat"
                }
                className="w-full rounded-xl border border-gray-300 py-2.5 pl-4 pr-20 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/15 disabled:bg-gray-100"
              />
              <button
                type="button"
                onClick={() => setPwVisible((v) => !v)}
                className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-primary hover:bg-primary-soft"
              >
                {pwVisible ? (
                  <EyeOff className="h-3.5 w-3.5" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
                {pwVisible ? "Sembunyikan" : "Lihat"}
              </button>
            </div>

            {pwError && (
              <div className="mt-2 flex items-center gap-1.5 text-sm text-red-600">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <span>{pwError}</span>
              </div>
            )}
            {!pwError && pwUsed > 0 && !pwLocked && isConfigured !== false && (
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
                <IconLabel icon={X}>Batal</IconLabel>
              </button>
              <button
                type="submit"
                disabled={pwLocked || verifying || pwInput.length === 0}
                className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
              >
                <IconLabel icon={LockOpen}>{verifying
                  ? "Memproses..."
                  : isConfigured === false
                    ? "Simpan & Buka"
                    : "Buka"}</IconLabel>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ================= MODAL LIHAT INFORMED CONSENT ================= */}
      {hasAccess && selected && consentSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0c2619]/45 p-4 backdrop-blur-[2px]">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="consent-view-title"
            className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-gray-200 p-5">
              <div>
                <h2
                  id="consent-view-title"
                  className="text-lg font-bold text-gray-900"
                >
                  Informed Consent
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  {selected.name} · {fmtDate(consentSession.date)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConsentUid(null)}
                aria-label="Tutup informed consent"
                className="rounded-lg p-2 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <object
                data={`${CONSENT_PDF_URL}#toolbar=0&navpanes=0`}
                type="application/pdf"
                className="h-[55vh] w-full"
                aria-label="Dokumen informed consent"
              >
                <div className="p-6 text-center text-sm text-gray-600">
                  Browser tidak dapat menampilkan PDF.{" "}
                  <a
                    href={CONSENT_PDF_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-primary underline"
                  >
                    Buka dokumen di tab baru
                  </a>
                </div>
              </object>
              <p className="border-t border-gray-200 p-5 text-sm text-gray-600">
                Ini adalah dokumen informed consent resmi SiCARE. Riwayat
                persetujuan dan status persetujuan disimpan dalam rekam medis
                terproteksi.
              </p>
            </div>
            <div className="flex justify-end border-t border-gray-200 p-5">
              <a
                href={CONSENT_PDF_URL}
                download="informed-consent.pdf"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark"
              >
                <Download className="h-4 w-4" />
                Unduh PDF
              </a>
            </div>
          </section>
        </div>
      )}

    </PageContainer>
  );
}
