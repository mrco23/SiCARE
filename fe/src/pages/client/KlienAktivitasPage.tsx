import { PageHeader } from "../../components/shared";
import {
  CLIENT_BOOKING_STATUS,
  CLIENT_SESSION_TIMELINE_STATUS,
} from "../../constants/status";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { COUNSELOR_SCHEDULE, RESCHEDULE_REASONS, createInitialSessions, type Session } from "../../data/mock/clientActivity";
import { CLIENT_COUNSELOR_IDENTITIES } from "../../data/mock/clientCounselors";
import { BookingRequestCard } from "../../components/client/activity/BookingRequestCard";
import { useBookingStore } from "../../features/booking/store/bookingStore";
import { selectClientBookings } from "../../features/booking/selectors/clientBookingSelectors";
import { selectClientActivityFeedback } from "../../features/feedback/selectors/clientActivityFeedbackSelectors";
import { useFeedbackStore } from "../../features/feedback/store/feedbackStore";
import {
  canReschedule,
  countdown,
  dayLabel,
  formatTime,
  needsFeedback,
  RESCHEDULE_MAX,
  RESCHEDULE_MIN_HOURS,
  sameDay,
  startOfDay,
  statusOf,
} from "../../features/client/activity/sessionRules";
import { DEMO_NOTIFICATION_RECIPIENTS, useNotificationStore } from "../../features/notification/notificationStore";






type RescheduleState = {
  sessionId: number;
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
};

const MAX_AHEAD_DAYS = 60;

// Letakkan file PDF di folder public/
const CONSENT_PDF_URL = "/informed-consent.pdf";









/* ============================================================
 * Kolom tanda tangan digital (canvas, mendukung jari/stylus/mouse)
 * ============================================================ */
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

/* ============================================================
 * Dialog informed consent: baca PDF -> tanda tangan digital
 * ============================================================ */
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
                    className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white"
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
                  className="mt-0.5 h-4 w-4 accent-primary"
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
                  className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-40"
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
              <p className="rounded-xl bg-primary-tint p-3 text-xs text-gray-600">
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
                className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-40"
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
  const addClientFeedback = useFeedbackStore((state) => state.addClientFeedback);
  const feedbackItems = useFeedbackStore((state) => state.items);
  const addNotification = useNotificationStore((state) => state.addNotification);
  const sharedBookings = useBookingStore((state) => state.bookings);
  const [localSessions, setLocalSessions] = useState<Session[]>(createInitialSessions);
  const sessions = useMemo(
    () =>
      localSessions.map((session) => {
        const feedback = selectClientActivityFeedback(
          feedbackItems,
          DEMO_NOTIFICATION_RECIPIENTS.client,
          session.id,
        );
        return feedback
          ? { ...session, feedbackGiven: true, rating: feedback.rating }
          : session;
      }),
    [localSessions, feedbackItems],
  );
  const clientBookings = useMemo(
    () => selectClientBookings(sharedBookings, DEMO_NOTIFICATION_RECIPIENTS.client),
    [sharedBookings],
  );
  const [now, setNow] = useState(() => Date.now());
  const [feedbackSessionId, setFeedbackSessionId] = useState<number | null>(
    null,
  );
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackNote, setFeedbackNote] = useState("");
  const [consentSessionId, setConsentSessionId] = useState<number | null>(null);
  const [toast, setToast] = useState("");
  const [view, setView] = useState<"main" | "reschedule">("main");
  const [reschedule, setReschedule] = useState<RescheduleState | null>(null);
  const toastTimeout = useRef<ReturnType<typeof window.setTimeout> | null>(
    null,
  );

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
        .filter((session) => statusOf(session, now) === CLIENT_SESSION_TIMELINE_STATUS.ONGOING)
        .sort((a, b) => a.start.getTime() - b.start.getTime()),
    [sessions, now],
  );

  const upcoming = useMemo(
    () =>
      sessions
        .filter((session) => statusOf(session, now) === CLIENT_SESSION_TIMELINE_STATUS.UPCOMING)
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
  const pendingBookingCount = clientBookings.filter(
    (booking) => booking.clientStatus === CLIENT_BOOKING_STATUS.PENDING,
  ).length;

  const summaryLine = [
    ongoing.length
      ? "Kamu sedang dalam sesi konseling. Kamu aman untuk bercerita."
      : "",
    !ongoing.length && upcoming.length
      ? weekCount
        ? `Kamu punya ${weekCount} sesi dalam 7 hari ke depan.`
        : "Belum ada sesi dalam 7 hari ke depan."
      : !ongoing.length && !upcoming.length && pendingBookingCount === 0
        ? "Belum ada sesi yang dijadwalkan."
        : !ongoing.length && !upcoming.length && pendingBookingCount > 0
          ? `${pendingBookingCount} permintaan booking menunggu konfirmasi.`
          : "",
    pendingFeedback.length
      ? `${pendingFeedback.length} sesi menunggu penilaianmu.`
      : "",
    pendingBookingCount > 0 && (ongoing.length > 0 || upcoming.length > 0)
      ? `${pendingBookingCount} permintaan booking menunggu konfirmasi.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  const timelineGroups = useMemo(() => {
    const rest = upcoming.slice(1);
    const groups = new Map<string, { date: Date; items: Session[] }>();

    rest.forEach((session) => {
      const key = session.start.toDateString();
      const group = groups.get(key);
      if (group) group.items.push(session);
      else groups.set(key, { date: session.start, items: [session] });
    });

    return Array.from(groups.values());
  }, [upcoming]);

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
    const times = (COUNSELOR_SCHEDULE[counselor] ?? {})[date.getDay()] ?? [];

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

  const openFeedback = (sessionId: number) => {
    const session = sessions.find((item) => item.id === sessionId);
    if (!session) return;
    setFeedbackSessionId(sessionId);
    setFeedbackRating(0);
    setFeedbackNote("");
  };

  const closeFeedback = () => setFeedbackSessionId(null);

  const submitFeedback = () => {
    if (feedbackSessionId === null || feedbackRating < 1) return;
    const session = sessions.find((item) => item.id === feedbackSessionId);
    if (!session) return;
    if (
      selectClientActivityFeedback(
        useFeedbackStore.getState().items,
        DEMO_NOTIFICATION_RECIPIENTS.client,
        feedbackSessionId,
      )
    ) {
      closeFeedback();
      showToast("Penilaian untuk sesi ini sudah pernah dikirim.");
      return;
    }

    const counselor = Object.values(CLIENT_COUNSELOR_IDENTITIES).find(
      (identity) => identity.historyName === session.counselor,
    );
    const counselorId = counselor?.entityId ?? "counselor-unknown";
    const format = session.service.toLowerCase().includes("kelompok")
      ? "Kelompok"
      : "Individu";
    addClientFeedback({
      clientId: DEMO_NOTIFICATION_RECIPIENTS.client,
      clientActivitySessionId: session.id,
      counselorId,
      counselorName: session.counselor,
      rating: feedbackRating,
      text: feedbackNote,
      format,
    });

    addNotification({
      recipientId: counselorId,
      recipientRole: "counselor",
      title: "Feedback baru dari Klien",
      message: `Klien memberikan penilaian ${feedbackRating}/5 untuk sesi bersama ${session.counselor}.`,
      href: "/konselor/feedback",
    });
    addNotification({
      recipientId: DEMO_NOTIFICATION_RECIPIENTS.admin,
      recipientRole: "admin",
      title: "Feedback baru menunggu moderasi",
      message: "Feedback baru dari sesi konseling masuk ke antrean pemeriksaan.",
      href: "/admin/feedback",
    });

    closeFeedback();
    showToast("Terima kasih! Penilaianmu sudah kami terima.");
  };

  const submitConsent = (signature: string) => {
    if (consentSessionId === null) return;

    setLocalSessions((current) =>
      current.map((session) =>
        session.id === consentSessionId
          ? {
              ...session,
              consentSigned: true,
              consentSignature: signature,
              consentSignedAt: new Date(),
            }
          : session,
      ),
    );
    setConsentSessionId(null);
    showToast("Informed consent berhasil ditandatangani.");
  };

  const openReschedule = (sessionId: number) => {
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

  const submitReschedule = () => {
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

    setLocalSessions((current) =>
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
  };

  const renderFeedbackItem = (session: Session) => (
    <div
      key={session.id}
      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 p-4"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-500">
          <Star className="h-5 w-5" fill="currentColor" strokeWidth={1.5} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">
            {dayLabel(session.start, now)}, {formatTime(session.start)}–
            {formatTime(session.end)} WITA
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
        className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white transition hover:bg-primary-dark"
      >
        Beri penilaian
      </button>
    </div>
  );

  const renderLiveCard = (session: Session) => {
    return (
      <article
        key={session.id}
        className="relative overflow-hidden rounded-3xl bg-[#0f3d2a] p-6 text-white shadow-lg sm:p-8"
      >
        <div className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-[#8fe3bf]/10 blur-2xl" />
        <div className="relative flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#36c08f] opacity-60" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-[#36c08f]" />
          </span>
          <p className="text-sm font-semibold uppercase tracking-wider text-[#8fe3bf]">
            Sedang berlangsung
          </p>
        </div>
        <div className="relative mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="font-display text-2xl font-bold sm:text-3xl">
              {session.counselor}
            </p>
            <p className="mt-1 text-sm text-white/75">
              {session.service} · {session.room}
            </p>
          </div>

          {/* Informed consent: ringkas, di sisi kanan */}
          {session.consentSigned ? (
            <div className="flex w-fit shrink-0 items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold text-[#8fe3bf]">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Sudah ditandatangani
            </div>
          ) : (
            <div className="flex w-fit shrink-0 flex-col items-start gap-2 rounded-xl border border-amber-300/40 bg-amber-300/15 p-3 sm:items-end">
              <p className="text-xs text-amber-100">
                Informed consent belum ditandatangani
              </p>
              <button
                type="button"
                onClick={() => setConsentSessionId(session.id)}
                className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-[#0f3d2a] transition hover:bg-primary-soft"
              >
                <FileSignature className="h-4 w-4" />
                Tanda tangan
              </button>
            </div>
          )}
        </div>
        <div
          className="relative mt-6 h-2 w-full overflow-hidden rounded-full bg-white/15"
          role="status"
          aria-label="Sesi konseling sedang berlangsung"
        >
          <div className="absolute inset-y-0 w-1/3 rounded-full bg-gradient-to-r from-[#36c08f]/40 via-[#8fe3bf] to-[#36c08f]/40 animate-[session-loading_1.8s_ease-in-out_infinite]" />
        </div>

        <p className="relative mt-5 text-sm text-white/85">
          Sesimu sedang berjalan. Kamu aman untuk bercerita.
        </p>
      </article>
    );
  };

  const renderNextSession = (session: Session) => {
    const allowed = canReschedule(session, now);
    const showLimitNote = !allowed && session.rescheduleCount < RESCHEDULE_MAX;

    return (
      <article
        key={session.id}
        className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
      >
        <p className="text-xs font-semibold text-primary">
          Sesimu berikutnya
        </p>
        <p className="mt-1.5 font-display text-lg font-bold text-gray-900">
          {session.counselor}
        </p>
        <p className="mt-1 text-sm text-gray-600">
          {dayLabel(session.start, now)}, {formatTime(session.start)} WITA ·{" "}
          {countdown(session.start.getTime() - now)}
        </p>
        <p className="text-sm text-gray-500">
          {session.service} · {session.room}
        </p>
        {session.pendingSlot && (
          <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Pengajuan jadwal baru: {session.pendingSlot.label}
          </div>
        )}
        <div className="mt-4">
          <button
            type="button"
            disabled={!allowed}
            onClick={() => openReschedule(session.id)}
            className="rounded-full border border-primary px-4 py-2 text-xs font-semibold text-primary transition hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-40"
          >
            Ubah jadwal
          </button>
        </div>
        {showLimitNote && (
          <p className="mt-3 text-xs text-gray-500">
            Ubah jadwal hanya bisa diajukan minimal 24 jam sebelum sesi.
          </p>
        )}
        {session.rescheduleCount > 0 && (
          <p className="mt-3 text-xs text-amber-700">
            Pengajuan ubah jadwal sedang menunggu persetujuan konselor.
          </p>
        )}
      </article>
    );
  };

  const renderTimelineItem = (session: Session) => {
    const allowed = canReschedule(session, now);

    return (
      <li
        key={session.id}
        className="relative rounded-2xl border border-gray-200 bg-white p-4 sm:p-5"
      >
        <span className="absolute -left-[29px] top-6 h-3 w-3 rounded-full border-2 border-white bg-[#36c08f]" />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900">
              {formatTime(session.start)}–{formatTime(session.end)} WITA
            </p>
            <p className="mt-0.5 truncate text-sm text-gray-700">
              {session.counselor}
            </p>
            <p className="truncate text-xs text-gray-500">
              {session.service} · {session.room}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            {session.rescheduleCount > 0 && (
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
                Menunggu persetujuan
              </span>
            )}
            <button
              type="button"
              disabled={!allowed}
              onClick={() => openReschedule(session.id)}
              className="rounded-full border border-gray-300 px-4 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Ubah jadwal
            </button>
          </div>
        </div>
      </li>
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
                ? "border-primary bg-primary text-white"
                : isAvailable
                  ? "border-primary/30 bg-primary-soft text-primary hover:border-primary"
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
          className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke aktivitas
        </button>

        <PageHeader
          title="Ubah jadwal sesi"
          description={
            <>
              {rescheduleSession.counselor} · jadwal semula{" "}
              {dayLabel(rescheduleSession.start, now)},{" "}
              {formatTime(rescheduleSession.start)} WITA
            </>
          }
        />

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
                        ? "border-primary bg-primary-tint font-semibold text-primary"
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
              className="mt-2 w-full rounded-xl border border-gray-300 p-3 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15"
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
                          ? "border-primary bg-primary text-white"
                          : "border-primary bg-white text-primary hover:bg-primary-soft"
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
            className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-40"
          >
            Kirim pengajuan
          </button>
        </div>
      </div>
    );
  };

  const renderMainPage = () => (
    <div className="space-y-6">
      <PageHeader
        eyebrow={new Date(now).toLocaleDateString("id-ID", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
        title="Aktivitasmu"
        description={summaryLine}
      />

      {clientBookings.length > 0 && (
        <section aria-labelledby="client-bookings-title">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 id="client-bookings-title" className="font-display text-lg font-bold text-gray-900">
                Booking yang kamu ajukan
              </h2>
              <p className="mt-0.5 text-xs text-gray-500">
                Status permintaan dan jadwal dari proses booking.
              </p>
            </div>
            <Link to="/klien/riwayat" className="shrink-0 text-xs font-semibold text-primary hover:underline">
              Lihat riwayat
            </Link>
          </div>
          <div className="space-y-3">
            {clientBookings.slice(0, 3).map((booking) => (
              <BookingRequestCard key={booking.id} booking={booking} />
            ))}
          </div>
        </section>
      )}

      {ongoing.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-lg font-bold text-gray-900">
            Sedang berlangsung
          </h2>
          <div className="space-y-4">{ongoing.map(renderLiveCard)}</div>
        </section>
      )}

      {pendingFeedback.length > 0 && (
        <section className="rounded-3xl border border-amber-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold text-gray-900">
                Menunggu penilaian
              </h2>
              <p className="mt-0.5 text-xs text-gray-500">
                Sesi sudah selesai. Bantu kami meningkatkan layanan dengan
                memberi penilaian.
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">
              {pendingFeedback.length}
            </span>
          </div>
          <div className="mt-4 space-y-3">
            {pendingFeedback.map(renderFeedbackItem)}
          </div>
        </section>
      )}

      <section>
        <div>
          <h2 className="font-display text-lg font-bold text-gray-900">
            Sesi mendatang
          </h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Sesi yang sedang berlangsung dan akan datang.
          </p>
        </div>

        <div className="mt-4 space-y-8">
          {upcoming[0] && renderNextSession(upcoming[0])}

          {timelineGroups.length > 0 && (
            <div className="space-y-8">
              {timelineGroups.map((group) => (
                <div key={group.date.toDateString()}>
                  <p className="mb-3 font-display text-sm font-bold uppercase tracking-wider text-primary">
                    {dayLabel(group.date, now)}
                  </p>
                  <ol className="relative space-y-3 border-l-2 border-primary-soft pl-5">
                    {group.items.map(renderTimelineItem)}
                  </ol>
                </div>
              ))}
            </div>
          )}

          {upcoming.length === 0 && (
            <div className="mt-6 rounded-3xl border border-dashed border-gray-300 bg-white p-10 text-center">
              <p className="font-display text-lg font-semibold text-gray-800">
                Belum ada sesi yang akan datang
              </p>
              <p className="mt-2 text-sm text-gray-500">
                Kalau kamu ingin berbicara dengan seseorang, kami siap
                mendampingimu.
              </p>
              <Link
                to="/klien/pesanan"
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white transition hover:bg-primary-dark"
              >
                <CalendarPlus className="h-4 w-4" />
                Buat janji baru
              </Link>
            </div>
          )}
        </div>
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
                  className="mt-1.5 w-full rounded-xl border border-gray-300 p-3 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15"
                />
              </div>

              <p className="rounded-xl bg-primary-tint p-3 text-xs text-gray-600">
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
                className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-40"
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
