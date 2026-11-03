import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  CalendarPlus,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileSignature,
  Star,
  X,
} from "lucide-react";
import { sicareApi } from "../../lib/sicareApi";
import { consentApi } from "../../lib/consentApi";
import {
  getPublicAvailability,
  getPublicCounselors,
  type PublicAvailabilitySlot,
  type PublicCounselor,
} from "../../lib/publicApi";
import type {
  BookingListItemDto,
  ClientFeedbackDto,
  InformedConsentDto,
  SessionListItemDto,
} from "../../types/api";

type SessionStatus = "ongoing" | "done" | "upcoming";

type PendingSlot = {
  reason: string;
  note: string;
  label: string;
};

type Session = {
  id: number | string;
  counselor: string;
  initials: string;
  service: string;
  room: string;
  start: Date;
  end: Date;
  rescheduleCount: number;
  feedbackGiven: boolean;
  rating: number;
  pendingSlot?: PendingSlot | null;
  consentSigned?: boolean;
  consentSignature?: string | null;
  consentSignedAt?: Date | null;
  bookingId?: string;
  counselorId?: string;
  consentId?: string;
  rawSessionId?: string;
};

type RescheduleState = {
  sessionId: number | string;
  reason: string | null;
  date: Date | null;
  slotIndex: number | null;
  note: string;
  error: string;
  month: Date;
};

type TimeSlot = {
  label: string;
  start: Date;
  slotId?: string;
};

const RESCHEDULE_MIN_HOURS = 24;
const RESCHEDULE_MAX = 1;
const SESSION_MIN = 60;
const MAX_AHEAD_DAYS = 60;
const CONSENT_PDF_URL = "/informed-consent.pdf";

const RESCHEDULE_REASONS = [
  "Bentrok jadwal kuliah",
  "Sakit",
  "Keperluan mendesak",
  "Lainnya",
];

const COUNSELOR_WEEK: Record<number, string[]> = {
  2: ["14.00-15.00", "15.00-16.00"],
  3: ["09.00-10.00", "10.00-11.00"],
  4: ["14.00-15.00", "15.00-16.00"],
};

const COUNSELOR_SCHEDULE: Record<string, Record<number, string[]>> = {
  "Giovanna Yudi, S.Psi., M.Psi.": COUNSELOR_WEEK,
  "Rico Kornelius Wahani, S.Psi., M.Psi.": COUNSELOR_WEEK,
};

const formatTime = (date: Date) =>
  `${String(date.getHours()).padStart(2, "0")}.${String(date.getMinutes()).padStart(2, "0")}`;

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

const dayLabel = (date: Date, now: number) => {
  const today = startOfDay(new Date(now));
  const target = startOfDay(date);
  const difference = Math.round(
    (target.getTime() - today.getTime()) / 86_400_000,
  );

  if (difference === 0) return "Hari ini";
  if (difference === 1) return "Besok";
  if (difference === -1) return "Kemarin";

  return date.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
};

const countdown = (milliseconds: number) => {
  const minutes = Math.max(0, Math.floor(milliseconds / 60_000));
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return hours > 0
    ? `${hours} jam ${remainingMinutes} menit lagi`
    : `${remainingMinutes} menit lagi`;
};

const statusOf = (session: Session, now: number): SessionStatus => {
  if (now >= session.start.getTime() && now < session.end.getTime()) {
    return "ongoing";
  }
  if (now >= session.end.getTime()) return "done";
  return "upcoming";
};

const canReschedule = (session: Session, now: number) => {
  const hoursLeft = (session.start.getTime() - now) / 3_600_000;
  return (
    statusOf(session, now) === "upcoming" &&
    hoursLeft >= RESCHEDULE_MIN_HOURS &&
    session.rescheduleCount < RESCHEDULE_MAX
  );
};

const needsFeedback = (session: Session, now: number) =>
  statusOf(session, now) === "done" && !session.feedbackGiven;

const dateBadge = (date: Date) => (
  <div className="flex w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-[#e8f9f0] py-2 text-[#1e5b3a]">
    <span className="text-xl font-extrabold leading-none">
      {date.getDate()}
    </span>
    <span className="mt-1 text-[11px] font-semibold uppercase tracking-wide">
      {date.toLocaleDateString("id-ID", { month: "short" })}
    </span>
  </div>
);

const SectionHeader = ({
  title,
  description,
  count,
  tone = "green",
}: {
  title: string;
  description: string;
  count?: number;
  tone?: "green" | "amber" | "dark";
}) => {
  const badgeClass =
    tone === "amber"
      ? "bg-amber-100 text-amber-800"
      : tone === "dark"
        ? "bg-[#0f3d2a] text-white"
        : "bg-[#e8f9f0] text-[#1e5b3a]";

  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h2 className="font-display text-lg font-bold text-gray-900">
          {title}
        </h2>
        <p className="mt-0.5 text-xs text-gray-500">{description}</p>
      </div>
      {count !== undefined && count > 0 && (
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${badgeClass}`}
        >
          {count}
        </span>
      )}
    </div>
  );
};

function SignaturePad({
  onChange,
}: {
  onChange: (dataUrl: string | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111827";
  }, []);

  const getPoint = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handleDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    const p = getPoint(e);
    last.current = p;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + 0.01, p.y);
    ctx.stroke();
  };

  const handleMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !last.current) return;
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    const p = getPoint(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
  };

  const handleUp = () => {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    const canvas = canvasRef.current;
    if (canvas) onChange(canvas.toDataURL("image/png"));
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    onChange(null);
  };

  return (
    <div>
      <div className="relative rounded-xl border-2 border-dashed border-gray-300 bg-white">
        <canvas
          ref={canvasRef}
          onPointerDown={handleDown}
          onPointerMove={handleMove}
          onPointerUp={handleUp}
          onPointerCancel={handleUp}
          className="h-40 w-full touch-none rounded-xl"
          aria-label="Area tanda tangan"
        />
        <span className="pointer-events-none absolute bottom-2 left-3 text-[11px] text-gray-400">
          Tanda tangan di area ini
        </span>
      </div>
      <button
        type="button"
        onClick={clear}
        className="mt-2 text-xs font-semibold text-gray-500 hover:text-gray-800 hover:underline"
      >
        Hapus & ulangi
      </button>
    </div>
  );
}

function ConsentDialog({
  counselor,
  onClose,
  onSigned,
}: {
  counselor: string;
  onClose: () => void;
  onSigned: (signature: string) => void;
}) {
  const [step, setStep] = useState<"read" | "sign">("read");
  const [agreed, setAgreed] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0c2619]/50 p-4"
      role="presentation"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="consent-title"
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-gray-200 p-5">
          <div>
            <h2 id="consent-title" className="text-lg font-bold text-gray-900">
              Informed Consent
            </h2>
            <p className="mt-0.5 text-sm text-gray-500">
              {step === "read"
                ? `Langkah 1 dari 2 · Baca dokumen · ${counselor}`
                : "Langkah 2 dari 2 · Tanda tangan digital"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="rounded-full p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-gray-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {step === "read" ? (
          <>
            <div className="min-h-0 flex-1 bg-gray-100">
              <object
                data={CONSENT_PDF_URL}
                type="application/pdf"
                className="h-[60vh] w-full"
                aria-label="Dokumen informed consent"
              >
                <div className="flex h-[60vh] flex-col items-center justify-center gap-3 p-6 text-center">
                  <p className="text-sm text-gray-600">
                    Browser kamu tidak bisa menampilkan PDF di halaman ini.
                  </p>
                  <a
                    href={CONSENT_PDF_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full bg-[#1e5b3a] px-5 py-2 text-sm font-semibold text-white"
                  >
                    Buka PDF di tab baru
                  </a>
                </div>
              </object>
            </div>

            <div className="space-y-3 border-t border-gray-200 p-5">
              <label className="flex cursor-pointer items-start gap-3 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[#1e5b3a]"
                />
                Saya sudah membaca dan memahami isi informed consent ini.
              </label>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                >
                  Nanti
                </button>
                <button
                  type="button"
                  disabled={!agreed}
                  onClick={() => setStep("sign")}
                  className="rounded-xl bg-[#1e5b3a] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#174a2f] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Lanjut tanda tangan
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-4 overflow-y-auto p-5">
              <p className="text-sm text-gray-600">
                Gunakan jari, stylus, atau mouse untuk menandatangani di bawah
                ini.
              </p>
              <SignaturePad onChange={setSignature} />
              <p className="rounded-xl bg-[#f7fcf9] p-3 text-xs text-gray-600">
                Dengan menandatangani, kamu menyatakan setuju mengikuti sesi
                konseling sesuai ketentuan pada dokumen informed consent.
              </p>
            </div>
            <div className="flex justify-between gap-2 border-t border-gray-200 p-5">
              <button
                type="button"
                onClick={() => setStep("read")}
                className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                Kembali
              </button>
              <button
                type="button"
                disabled={!signature}
                onClick={() => signature && onSigned(signature)}
                className="rounded-xl bg-[#1e5b3a] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#174a2f] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Simpan tanda tangan
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

export default function KlienAktivitasPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [dynamicSlots, setDynamicSlots] = useState<PublicAvailabilitySlot[]>([]);
  const [counselorsList, setCounselorsList] = useState<PublicCounselor[]>([]);
  const [counselorSchedule, setCounselorSchedule] = useState<
    Record<string, Record<number, string[]>>
  >(COUNSELOR_SCHEDULE);
  const [now, setNow] = useState(() => Date.now());
  const [feedbackSessionId, setFeedbackSessionId] = useState<
    number | string | null
  >(null);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackNote, setFeedbackNote] = useState("");
  const [consentSessionId, setConsentSessionId] = useState<
    number | string | null
  >(null);
  const [toast, setToast] = useState("");
  const [view, setView] = useState<"main" | "reschedule">("main");
  const [reschedule, setReschedule] = useState<RescheduleState | null>(null);
  const toastTimeout = useRef<ReturnType<typeof window.setTimeout> | null>(
    null,
  );

  void SESSION_MIN;

  const fetchActivity = useCallback(async () => {
    try {
      const from = new Date();
      const to = new Date(from.getTime() + 90 * 24 * 60 * 60 * 1000);

      const [sessionRows, bookingRows, counselors, feedbackRows, slotRows] =
        await Promise.all([
          sicareApi.sessions(100).catch(() => [] as SessionListItemDto[]),
          sicareApi.bookings(100).catch(() => [] as BookingListItemDto[]),
          getPublicCounselors().catch(() => [] as PublicCounselor[]),
          sicareApi.myFeedback().catch(() => [] as ClientFeedbackDto[]),
          getPublicAvailability({ from, to, limit: 100 }).catch(
            () => [] as PublicAvailabilitySlot[],
          ),
        ]);

      const filteredSlots = slotRows.filter(
        (slot) =>
          slot.status === "available" &&
          Date.parse(slot.starts_at) > Date.now(),
      );

      const counselorMap = new Map(
        counselors.map((c) => [c.profile_id, c.public_name]),
      );
      const feedbackMap = new Map(feedbackRows.map((f) => [f.session_id, f]));

      const dynSchedule: Record<string, Record<number, string[]>> = {};
      for (const slot of slotRows) {
        const counselorName = counselorMap.get(slot.counselor_id);
        if (!counselorName) continue;
        const start = new Date(slot.starts_at);
        const day = start.getDay();
        const label = `${formatTime(start)}-${formatTime(new Date(slot.ends_at))}`;
        if (!dynSchedule[counselorName]) dynSchedule[counselorName] = {};
        if (!dynSchedule[counselorName][day])
          dynSchedule[counselorName][day] = [];
        if (!dynSchedule[counselorName][day].includes(label)) {
          dynSchedule[counselorName][day].push(label);
        }
      }

      const consentMap = new Map<string, InformedConsentDto>();
      const activeBookingIds = [
        ...new Set([
          ...sessionRows.map((s) => s.booking_id),
          ...bookingRows.map((b) => b.id),
        ]),
      ];

      await Promise.all(
        activeBookingIds.map(async (bookingId) => {
          try {
            const consent = await consentApi.getMyConsentForBooking(bookingId);
            consentMap.set(bookingId, consent);
          } catch {
            return null;
          }
        }),
      );

      const mappedSessions: Session[] = [];
      const processedBookingIds = new Set<string>();

      for (const s of sessionRows) {
        processedBookingIds.add(s.booking_id);
        const booking = bookingRows.find((b) => b.id === s.booking_id);
        const counselorName =
          counselorMap.get(s.counselor_id) ||
          (booking ? counselorMap.get(booking.counselor_id) : "") ||
          "Konselor LMI";

        const initials =
          counselorName
            .split(" ")
            .filter(Boolean)
            .slice(0, 2)
            .map((n) => n[0])
            .join("")
            .toUpperCase() || "KL";

        const service =
          booking?.service_type === "group"
            ? booking.group_name
              ? `Konseling Kelompok (${booking.group_name})`
              : "Konseling Kelompok"
            : "Konseling Individu";

        const fb = feedbackMap.get(s.id);
        const consent = consentMap.get(s.booking_id);

        const isRescheduled =
          booking?.status === "reschedule_requested" ||
          Boolean(booking?.reschedule_reason);

        mappedSessions.push({
          id: s.id,
          counselor: counselorName,
          initials,
          service,
          room:
            s.room ||
            (s.format === "online"
              ? "Online Meeting"
              : "Ruang Konseling 01"),
          start: new Date(s.starts_at),
          end: new Date(s.ends_at),
          rescheduleCount: isRescheduled ? 1 : 0,
          feedbackGiven: Boolean(fb),
          rating: fb?.rating ?? 0,
          pendingSlot: isRescheduled
            ? {
                reason:
                  booking?.reschedule_reason || "Perlu penjadwalan ulang",
                note: "",
                label: booking?.starts_at
                  ? `${new Date(booking.starts_at).toLocaleDateString("id-ID", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}, ${formatTime(new Date(booking.starts_at))} WITA`
                  : "Menunggu pemilihan jadwal baru",
              }
            : null,
          consentSigned: consent?.status === "signed",
          consentSignature: consent?.signature_storage_path ?? null,
          consentSignedAt: consent?.signed_at
            ? new Date(consent.signed_at)
            : null,
          bookingId: s.booking_id,
          counselorId: s.counselor_id,
          consentId: consent?.id,
          rawSessionId: s.id,
        });
      }

      for (const b of bookingRows) {
        if (processedBookingIds.has(b.id)) continue;
        if (b.status === "cancelled" || b.status === "rejected") continue;

        const counselorName =
          counselorMap.get(b.counselor_id) || "Konselor LMI";
        const initials =
          counselorName
            .split(" ")
            .filter(Boolean)
            .slice(0, 2)
            .map((n) => n[0])
            .join("")
            .toUpperCase() || "KL";

        const service =
          b.service_type === "group"
            ? b.group_name
              ? `Konseling Kelompok (${b.group_name})`
              : "Konseling Kelompok"
            : "Konseling Individu";

        const consent = consentMap.get(b.id);
        const isRescheduled = b.status === "reschedule_requested";

        mappedSessions.push({
          id: b.id,
          counselor: counselorName,
          initials,
          service,
          room: "Ruang Konseling 01",
          start: new Date(b.starts_at),
          end: new Date(b.ends_at),
          rescheduleCount: isRescheduled ? 1 : 0,
          feedbackGiven: false,
          rating: 0,
          pendingSlot: isRescheduled
            ? {
                reason: b.reschedule_reason || "Perlu penjadwalan ulang",
                note: "",
                label: "Menunggu pemilihan jadwal baru",
              }
            : null,
          consentSigned: consent?.status === "signed",
          consentSignature: consent?.signature_storage_path ?? null,
          consentSignedAt: consent?.signed_at
            ? new Date(consent.signed_at)
            : null,
          bookingId: b.id,
          counselorId: b.counselor_id,
          consentId: consent?.id,
          rawSessionId: b.id,
        });
      }

      return {
        counselors,
        filteredSlots,
        dynSchedule,
        mappedSessions,
      };
    } catch {
      return null;
    }
  }, []);

  const refreshActivity = useCallback(async () => {
    const res = await fetchActivity();
    if (!res) return;
    setCounselorsList(res.counselors);
    setDynamicSlots(res.filteredSlots);
    setCounselorSchedule((prev) => ({ ...prev, ...res.dynSchedule }));
    setSessions(res.mappedSessions);
  }, [fetchActivity]);

  useEffect(() => {
    let active = true;
    void fetchActivity().then((res) => {
      if (!active || !res) return;
      setCounselorsList(res.counselors);
      setDynamicSlots(res.filteredSlots);
      setCounselorSchedule((prev) => ({ ...prev, ...res.dynSchedule }));
      setSessions(res.mappedSessions);
    });
    return () => {
      active = false;
    };
  }, [fetchActivity]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(
    () => () => {
      if (toastTimeout.current !== null)
        window.clearTimeout(toastTimeout.current);
    },
    [],
  );

  const showToast = (message: string) => {
    setToast(message);
    if (toastTimeout.current !== null)
      window.clearTimeout(toastTimeout.current);
    toastTimeout.current = window.setTimeout(() => setToast(""), 2600);
  };

  const ongoing = useMemo(
    () =>
      sessions
        .filter((session) => statusOf(session, now) === "ongoing")
        .sort((a, b) => a.start.getTime() - b.start.getTime()),
    [sessions, now],
  );

  const upcoming = useMemo(
    () =>
      sessions
        .filter((session) => statusOf(session, now) === "upcoming")
        .sort((a, b) => a.start.getTime() - b.start.getTime()),
    [sessions, now],
  );

  const pendingFeedback = useMemo(
    () =>
      sessions
        .filter((session) => needsFeedback(session, now))
        .sort((a, b) => b.end.getTime() - a.end.getTime()),
    [sessions, now],
  );

  const weekCount = upcoming.filter(
    (session) => session.start.getTime() - now <= 7 * 86_400_000,
  ).length;

  const summaryLine = [
    ongoing.length
      ? "Kamu sedang dalam sesi konseling. Kamu aman untuk bercerita."
      : "",
    !ongoing.length && upcoming.length
      ? weekCount
        ? `Kamu punya ${weekCount} sesi dalam 7 hari ke depan.`
        : "Belum ada sesi dalam 7 hari ke depan."
      : !ongoing.length && !upcoming.length
        ? "Belum ada sesi yang dijadwalkan."
        : "",
    pendingFeedback.length
      ? `${pendingFeedback.length} sesi menunggu penilaianmu.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  const feedbackSession = sessions.find(
    (session) => session.id === feedbackSessionId,
  );

  const consentSession = sessions.find(
    (session) => session.id === consentSessionId,
  );

  const rescheduleSession = reschedule
    ? sessions.find((session) => session.id === reschedule.sessionId)
    : undefined;

  const slotsFor = (counselor: string, date: Date): TimeSlot[] => {
    const counselorObj = counselorsList.find(
      (c) =>
        c.public_name.toLowerCase().trim() === counselor.toLowerCase().trim() ||
        counselor.toLowerCase().includes(c.public_name.toLowerCase().trim()) ||
        c.public_name.toLowerCase().includes(counselor.toLowerCase().trim()),
    );
    const counselorId = counselorObj?.profile_id;

    const matchingDynamicSlots = dynamicSlots.filter((slot) => {
      if (counselorId && slot.counselor_id !== counselorId) return false;
      const slotStart = new Date(slot.starts_at);
      return (
        sameDay(slotStart, date) &&
        slotStart.getTime() - now >= RESCHEDULE_MIN_HOURS * 3_600_000
      );
    });

    if (matchingDynamicSlots.length > 0) {
      return matchingDynamicSlots.map((slot) => {
        const slotStart = new Date(slot.starts_at);
        const slotEnd = new Date(slot.ends_at);
        return {
          label: `${formatTime(slotStart)}-${formatTime(slotEnd)}`,
          start: slotStart,
          slotId: slot.id,
        };
      });
    }

    const times =
      (counselorSchedule[counselor] ?? COUNSELOR_WEEK)[date.getDay()] ?? [];

    return times
      .map((label) => ({
        label,
        start: new Date(
          date.getFullYear(),
          date.getMonth(),
          date.getDate(),
          Number(label.slice(0, 2)),
          Number(label.slice(3, 5)),
        ),
      }))
      .filter(
        (slot) =>
          slot.start.getTime() - now >= RESCHEDULE_MIN_HOURS * 3_600_000,
      );
  };

  const openFeedback = (sessionId: number | string) => {
    const session = sessions.find((item) => item.id === sessionId);
    if (!session) return;
    setFeedbackSessionId(sessionId);
    setFeedbackRating(0);
    setFeedbackNote("");
  };

  const closeFeedback = () => setFeedbackSessionId(null);

  const submitFeedback = async () => {
    if (feedbackSessionId === null || feedbackRating < 1) return;
    const session = sessions.find((item) => item.id === feedbackSessionId);
    if (!session) return;

    try {
      const targetId = session.rawSessionId || String(session.id);
      await sicareApi.submitFeedback(targetId, {
        rating: feedbackRating,
        comment: feedbackNote.trim() || null,
      });
      setSessions((current) =>
        current.map((s) =>
          s.id === feedbackSessionId
            ? { ...s, feedbackGiven: true, rating: feedbackRating }
            : s,
        ),
      );
      closeFeedback();
      showToast("Terima kasih! Penilaianmu sudah kami terima.");
      void refreshActivity();
    } catch (cause) {
      const msg =
        cause instanceof Error ? cause.message : "Penilaian tidak dapat dikirim.";
      showToast(msg);
    }
  };

  const submitConsent = async (signature: string) => {
    if (consentSessionId === null) return;
    const session = sessions.find((item) => item.id === consentSessionId);
    if (!session) return;

    try {
      let consentId = session.consentId;
      if (!consentId && session.bookingId) {
        const consentData = await consentApi.getMyConsentForBooking(
          session.bookingId,
        );
        consentId = consentData.id;
      }
      if (consentId) {
        await consentApi.signConsent(consentId, {
          signature_base64: signature,
          agreement_accepted: true,
        });
      }
      setSessions((current) =>
        current.map((s) =>
          s.id === consentSessionId
            ? {
                ...s,
                consentSigned: true,
                consentSignature: signature,
                consentSignedAt: new Date(),
              }
            : s,
        ),
      );
      setConsentSessionId(null);
      showToast("Informed consent berhasil ditandatangani.");
      void refreshActivity();
    } catch (cause) {
      const msg =
        cause instanceof Error
          ? cause.message
          : "Tanda tangan gagal disimpan.";
      showToast(msg);
    }
  };

  const openReschedule = (sessionId: number | string) => {
    const session = sessions.find((item) => item.id === sessionId);
    if (!session || !canReschedule(session, now)) return;

    const today = new Date(now);
    setReschedule({
      sessionId,
      reason: null,
      date: null,
      slotIndex: null,
      note: "",
      error: "",
      month: new Date(today.getFullYear(), today.getMonth(), 1),
    });
    setView("reschedule");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const backToActivity = () => {
    setView("main");
    setReschedule(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const updateReschedule = (changes: Partial<RescheduleState>) => {
    setReschedule((current) =>
      current ? { ...current, ...changes } : current,
    );
  };

  const submitReschedule = async () => {
    if (
      !reschedule ||
      !rescheduleSession ||
      !reschedule.reason ||
      !reschedule.date ||
      reschedule.slotIndex === null
    ) {
      return;
    }

    const availableSlots = slotsFor(
      rescheduleSession.counselor,
      reschedule.date,
    );
    const selectedSlot = availableSlots[reschedule.slotIndex];

    if (!selectedSlot) {
      updateReschedule({
        error: "Jam yang dipilih sudah tidak tersedia. Silakan pilih kembali.",
      });
      return;
    }

    if (!canReschedule(rescheduleSession, now)) {
      updateReschedule({
        error:
          "Pengajuan tidak dapat diproses. Periksa batas waktu atau kuota ubah jadwal.",
      });
      return;
    }

    const requestedLabel = `${reschedule.date.toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
    })}, ${selectedSlot.label.replace("-", "–")} WITA`;

    try {
      if (rescheduleSession.bookingId && selectedSlot.slotId) {
        await sicareApi.rescheduleBooking(
          rescheduleSession.bookingId,
          selectedSlot.slotId,
        );
      }

      setSessions((current) =>
        current.map((session) =>
          session.id === rescheduleSession.id
            ? {
                ...session,
                rescheduleCount: session.rescheduleCount + 1,
                pendingSlot: {
                  reason: reschedule.reason as string,
                  note: reschedule.note,
                  label: requestedLabel,
                },
              }
            : session,
        ),
      );

      setReschedule(null);
      setView("main");
      showToast(
        "Pengajuan ubah jadwal dikirim. Kami kabari begitu konselor menyetujuinya.",
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
      void refreshActivity();
    } catch (cause) {
      const msg =
        cause instanceof Error
          ? cause.message
          : "Pengajuan ubah jadwal gagal dikirim. Silakan coba lagi.";
      updateReschedule({ error: msg });
    }
  };

  const renderOngoingCard = (session: Session) => {
    const signed = session.consentSigned;

    return (
      <article
        key={session.id}
        className="overflow-hidden rounded-3xl border border-[#1e5b3a]/15 bg-white shadow-sm"
      >
        <div className="flex items-center justify-between gap-3 bg-[#1e5b3a] px-5 py-3 text-white">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#8fe3bf] opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#8fe3bf]" />
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider">
              Sedang berlangsung
            </span>
          </div>
          <span className="text-xs text-white/80">
            Selesai pukul {formatTime(session.end)} WITA
          </span>
        </div>

        <div className="space-y-5 p-5 sm:p-6">
          <div>
            <p className="font-display text-xl font-bold text-gray-900">
              {session.counselor}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              {session.service} · {session.room}
            </p>
          </div>

          {signed ? (
            <div className="flex items-center gap-3 rounded-2xl bg-[#f7fcf9] p-4">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-[#1e5b3a]" />
              <p className="text-sm font-semibold text-[#1e5b3a]">
                Informed consent sudah ditandatangani
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-900">
                Tanda tangani informed consent terlebih dahulu
              </p>
              <p className="mt-1 text-xs text-amber-800">
                Dokumen ini wajib disetujui sebelum sesi dimulai.
              </p>
              <button
                type="button"
                onClick={() => setConsentSessionId(session.id)}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1e5b3a] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#174a2f] sm:w-auto"
              >
                <FileSignature className="h-4 w-4" />
                Tanda tangan sekarang
              </button>
            </div>
          )}
        </div>
      </article>
    );
  };

  const renderFeedbackCard = (session: Session) => (
    <div
      key={session.id}
      className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 items-center gap-4">
        {dateBadge(session.start)}
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">
            {formatTime(session.start)}–{formatTime(session.end)} WITA
          </p>
          <p className="truncate text-sm text-gray-700">{session.counselor}</p>
          <p className="truncate text-xs text-gray-500">
            {session.service} · {session.room}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => openFeedback(session.id)}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-semibold text-amber-950 transition hover:bg-amber-300"
      >
        <Star className="h-4 w-4" fill="currentColor" strokeWidth={1.5} />
        Beri penilaian
      </button>
    </div>
  );

  const renderUpcomingCard = (session: Session, isNext: boolean) => {
    const allowed = canReschedule(session, now);
    const isPending = session.rescheduleCount > 0;
    const showLimitNote =
      !allowed && !isPending && session.rescheduleCount < RESCHEDULE_MAX;

    return (
      <article
        key={session.id}
        className={`rounded-2xl border bg-white p-4 sm:p-5 ${
          isNext ? "border-[#1e5b3a]/30 shadow-sm" : "border-gray-200"
        }`}
      >
        {isNext && (
          <span className="mb-3 inline-block rounded-full bg-[#1e5b3a] px-2.5 py-1 text-[11px] font-semibold text-white">
            Sesi berikutnya · {countdown(session.start.getTime() - now)}
          </span>
        )}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            {dateBadge(session.start)}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900">
                {dayLabel(session.start, now)}, {formatTime(session.start)}–
                {formatTime(session.end)} WITA
              </p>
              <p className="truncate text-sm text-gray-700">
                {session.counselor}
              </p>
              <p className="truncate text-xs text-gray-500">
                {session.service} · {session.room}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
            {isPending ? (
              <span className="rounded-xl bg-amber-50 px-3 py-2 text-center text-xs font-semibold text-amber-800">
                Menunggu persetujuan konselor
              </span>
            ) : (
              <button
                type="button"
                disabled={!allowed}
                onClick={() => openReschedule(session.id)}
                className="rounded-xl border border-[#1e5b3a] px-4 py-2.5 text-sm font-semibold text-[#1e5b3a] transition hover:bg-[#e8f9f0] disabled:cursor-not-allowed disabled:border-gray-300 disabled:text-gray-400 disabled:hover:bg-transparent"
              >
                Ubah jadwal
              </button>
            )}
          </div>
        </div>

        {session.pendingSlot && (
          <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Pengajuan jadwal baru: {session.pendingSlot.label}
          </p>
        )}
        {showLimitNote && (
          <p className="mt-3 text-xs text-gray-500">
            Ubah jadwal hanya bisa diajukan minimal 24 jam sebelum sesi.
          </p>
        )}
      </article>
    );
  };

  const renderReschedulePage = () => {
    if (!reschedule || !rescheduleSession) return null;

    const month = reschedule.month;
    const year = month.getFullYear();
    const monthIndex = month.getMonth();
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const firstDayOffset = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
    const today = startOfDay(new Date(now));
    const maxDate = new Date(today.getTime() + MAX_AHEAD_DAYS * 86_400_000);
    const previousMonth = new Date(year, monthIndex - 1, 1);
    const nextMonth = new Date(year, monthIndex + 1, 1);
    const canGoPrevious =
      previousMonth >= new Date(today.getFullYear(), today.getMonth(), 1);
    const canGoNext = nextMonth <= maxDate;
    const selectedSlots = reschedule.date
      ? slotsFor(rescheduleSession.counselor, reschedule.date)
      : [];

    const calendarCells = [
      ...Array.from({ length: firstDayOffset }, (_, index) => (
        <span key={`blank-${index}`} aria-hidden="true" />
      )),
      ...Array.from({ length: daysInMonth }, (_, index) => {
        const day = index + 1;
        const date = new Date(year, monthIndex, day);
        const isAvailable =
          date >= today &&
          date <= maxDate &&
          slotsFor(rescheduleSession.counselor, date).length > 0;
        const isSelected = reschedule.date
          ? sameDay(reschedule.date, date)
          : false;

        return (
          <button
            key={day}
            type="button"
            disabled={!isAvailable}
            onClick={() =>
              updateReschedule({ date, slotIndex: null, error: "" })
            }
            className={`flex h-10 items-center justify-center rounded-xl border text-sm font-semibold transition disabled:cursor-not-allowed ${
              isSelected
                ? "border-[#1e5b3a] bg-[#1e5b3a] text-white"
                : isAvailable
                  ? "border-[#1e5b3a]/30 bg-[#e8f9f0] text-[#1e5b3a] hover:border-[#1e5b3a]"
                  : "border-transparent text-gray-300"
            }`}
          >
            {day}
          </button>
        );
      }),
    ];

    return (
      <div className="space-y-6">
        <button
          type="button"
          onClick={backToActivity}
          className="inline-flex items-center gap-1 text-sm font-semibold text-[#1e5b3a] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke aktivitas
        </button>

        <section>
          <h1 className="font-display text-2xl font-extrabold text-gray-900 sm:text-3xl">
            Ubah jadwal sesi
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            {rescheduleSession.counselor} · jadwal semula{" "}
            {dayLabel(rescheduleSession.start, now)},{" "}
            {formatTime(rescheduleSession.start)} WITA
          </p>
        </section>

        <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
          <section className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-6">
            <p className="text-sm font-bold text-gray-900">
              1. Alasan <span className="text-red-600">*</span>
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {RESCHEDULE_REASONS.map((reason) => {
                const selected = reschedule.reason === reason;
                return (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => updateReschedule({ reason, error: "" })}
                    className={`rounded-xl border px-3 py-3 text-left text-sm transition ${
                      selected
                        ? "border-[#1e5b3a] bg-[#f7fcf9] font-semibold text-[#1e5b3a]"
                        : "border-gray-200 text-gray-700 hover:border-[#36c08f]"
                    }`}
                  >
                    {reason}
                  </button>
                );
              })}
            </div>

            <label
              htmlFor="reschedule-note"
              className="mt-6 block text-sm font-bold text-gray-900"
            >
              Catatan{" "}
              <span className="text-xs font-normal text-gray-400">
                (opsional)
              </span>
            </label>
            <textarea
              id="reschedule-note"
              rows={3}
              value={reschedule.note}
              onChange={(event) =>
                updateReschedule({ note: event.target.value })
              }
              className="mt-2 w-full rounded-xl border border-gray-300 p-3 text-sm outline-none transition focus:border-[#1e5b3a] focus:ring-4 focus:ring-[#1e5b3a]/15"
              placeholder="Tambahkan catatan jika diperlukan"
            />
          </section>

          <section className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-6">
            <p className="text-sm font-bold text-gray-900">
              2. Pilih tanggal <span className="text-red-600">*</span>
            </p>
            <p className="mt-0.5 text-xs text-gray-500">
              Tanggal berwarna hijau memiliki jadwal konselor. Minimal 24 jam
              dari sekarang.
            </p>

            <div className="mt-3 rounded-2xl border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  disabled={!canGoPrevious}
                  onClick={() =>
                    updateReschedule({
                      month: new Date(year, monthIndex - 1, 1),
                    })
                  }
                  aria-label="Bulan sebelumnya"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <p className="font-display text-sm font-bold capitalize text-gray-900">
                  {month.toLocaleDateString("id-ID", {
                    month: "long",
                    year: "numeric",
                  })}
                </p>
                <button
                  type="button"
                  disabled={!canGoNext}
                  onClick={() =>
                    updateReschedule({
                      month: new Date(year, monthIndex + 1, 1),
                    })
                  }
                  aria-label="Bulan berikutnya"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-gray-500">
                {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map(
                  (label) => (
                    <span key={label}>{label}</span>
                  ),
                )}
              </div>
              <div className="mt-1 grid grid-cols-7 gap-1">{calendarCells}</div>
            </div>

            <p className="mt-6 text-sm font-bold text-gray-900">
              3. Pilih jam <span className="text-red-600">*</span>
            </p>
            {!reschedule.date ? (
              <p className="mt-3 text-sm text-gray-500">
                Pilih tanggal terlebih dahulu.
              </p>
            ) : selectedSlots.length === 0 ? (
              <p className="mt-3 text-sm text-gray-500">
                Tidak ada jam tersedia pada tanggal ini.
              </p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedSlots.map((slot, index) => {
                  const selected = reschedule.slotIndex === index;
                  return (
                    <button
                      key={slot.label}
                      type="button"
                      onClick={() =>
                        updateReschedule({ slotIndex: index, error: "" })
                      }
                      className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                        selected
                          ? "border-[#1e5b3a] bg-[#1e5b3a] text-white"
                          : "border-[#1e5b3a] bg-white text-[#1e5b3a] hover:bg-[#e8f9f0]"
                      }`}
                    >
                      {slot.label.replace("-", "–")} WITA
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {reschedule.error && (
          <p role="alert" className="text-sm text-red-600">
            {reschedule.error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={backToActivity}
            className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={
              !(
                reschedule.reason &&
                reschedule.date &&
                reschedule.slotIndex !== null
              )
            }
            onClick={submitReschedule}
            className="rounded-xl bg-[#1e5b3a] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#174a2f] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Kirim pengajuan
          </button>
        </div>
      </div>
    );
  };

  const renderMainPage = () => (
    <div className="space-y-8">
      <header>
        <p className="text-sm text-gray-500">
          {new Date(now).toLocaleDateString("id-ID", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
        <h1 className="mt-1 font-display text-2xl font-extrabold text-gray-900 sm:text-3xl">
          Aktivitasmu
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-gray-600 sm:text-base">
          {summaryLine}
        </p>
      </header>

      {ongoing.length > 0 && (
        <section className="space-y-3" aria-labelledby="ongoing-title">
          <h2 id="ongoing-title" className="sr-only">
            Sedang berlangsung
          </h2>
          {ongoing.map(renderOngoingCard)}
        </section>
      )}

      {pendingFeedback.length > 0 && (
        <section
          className="space-y-4 rounded-3xl border border-amber-200 bg-amber-50/40 p-5 sm:p-6"
          aria-labelledby="feedback-section-title"
        >
          <div id="feedback-section-title">
            <SectionHeader
              title="Menunggu penilaian"
              description="Sesi sudah selesai. Bantu kami meningkatkan layanan."
              count={pendingFeedback.length}
              tone="amber"
            />
          </div>
          <div className="space-y-3">
            {pendingFeedback.map(renderFeedbackCard)}
          </div>
        </section>
      )}

      <section className="space-y-4" aria-labelledby="upcoming-title">
        <div id="upcoming-title">
          <SectionHeader
            title="Sesi mendatang"
            description="Jadwal konseling yang akan datang."
            count={upcoming.length}
          />
        </div>

        {upcoming.length > 0 ? (
          <div className="space-y-3">
            {upcoming.map((session, index) =>
              renderUpcomingCard(session, index === 0),
            )}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-gray-300 bg-white p-8 text-center">
            <p className="font-display text-lg font-semibold text-gray-800">
              Belum ada sesi yang akan datang
            </p>
            <p className="mt-2 text-sm text-gray-500">
              Kalau kamu ingin berbicara dengan seseorang, kami siap
              mendampingimu.
            </p>
            <Link
              to="/klien/pesanan"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#1e5b3a] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#174a2f]"
            >
              <CalendarPlus className="h-4 w-4" />
              Buat janji baru
            </Link>
          </div>
        )}
      </section>

      <p className="rounded-2xl bg-white p-5 text-center text-sm italic text-gray-500">
        “Langkah kecil yang kamu ambil hari ini tetap berarti.”
      </p>
    </div>
  );

  return (
    <>
      {view === "reschedule" ? renderReschedulePage() : renderMainPage()}

      {consentSession && (
        <ConsentDialog
          key={consentSession.id}
          counselor={consentSession.counselor}
          onClose={() => setConsentSessionId(null)}
          onSigned={submitConsent}
        />
      )}

      {feedbackSession && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0c2619]/40 p-4"
          role="presentation"
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedback-title"
            className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between border-b border-gray-200 p-6 pb-4">
              <div>
                <h2
                  id="feedback-title"
                  className="text-lg font-bold text-gray-900"
                >
                  Bagaimana sesimu?
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  {feedbackSession.counselor} · {feedbackSession.service}
                </p>
              </div>
              <button
                type="button"
                onClick={closeFeedback}
                aria-label="Tutup penilaian"
                className="rounded-full p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-gray-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5 overflow-y-auto p-6">
              <div>
                <p className="text-sm font-semibold text-gray-800">
                  Penilaian <span className="text-red-600">*</span>
                </p>
                <div
                  className="mt-2 flex gap-2"
                  role="radiogroup"
                  aria-label="Penilaian sesi"
                >
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <button
                      key={rating}
                      type="button"
                      role="radio"
                      aria-checked={feedbackRating === rating}
                      aria-label={`${rating} bintang`}
                      onClick={() => setFeedbackRating(rating)}
                      className={`text-3xl leading-none transition ${
                        rating <= feedbackRating
                          ? "text-amber-400"
                          : "text-gray-300 hover:text-amber-300"
                      }`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label
                  htmlFor="feedback-note"
                  className="text-sm font-semibold text-gray-800"
                >
                  Komentar{" "}
                  <span className="text-xs font-normal text-gray-400">
                    (opsional)
                  </span>
                </label>
                <textarea
                  id="feedback-note"
                  rows={3}
                  value={feedbackNote}
                  onChange={(event) => setFeedbackNote(event.target.value)}
                  placeholder="Ceritakan apa yang membantumu, atau apa yang bisa kami perbaiki"
                  className="mt-1.5 w-full rounded-xl border border-gray-300 p-3 text-sm outline-none transition focus:border-[#1e5b3a] focus:ring-4 focus:ring-[#1e5b3a]/15"
                />
              </div>

              <p className="rounded-xl bg-[#f7fcf9] p-3 text-xs text-gray-600">
                Penilaianmu bersifat anonim dan hanya digunakan untuk
                meningkatkan layanan. Kamu hanya dapat mengirim satu kali untuk
                setiap sesi.
              </p>
            </div>

            <div className="flex justify-end gap-2 border-t border-gray-200 p-6 pt-4">
              <button
                type="button"
                onClick={closeFeedback}
                className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                Lewati
              </button>
              <button
                type="button"
                disabled={feedbackRating < 1}
                onClick={submitFeedback}
                className="rounded-xl bg-[#1e5b3a] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#174a2f] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Kirim penilaian
              </button>
            </div>
          </section>
        </div>
      )}

      {toast && (
        <div
          role="status"
          className="pointer-events-none fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-xl bg-gray-900 px-4 py-3 text-sm text-white shadow-lg"
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-[#8fe3bf]" />
            {toast}
          </span>
        </div>
      )}
    </>
  );
}
