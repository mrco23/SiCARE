import Badge from "../../components/shared/Badge";
import IconLabel from "../../components/shared/IconLabel";
import {
  SkeletonList,
  useToast,
} from "../../components/shared";
import { useCallback, useEffect, useMemo, useState } from "react";
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
  Pencil,
  Send,
  Users,
} from "lucide-react";
import { sicareApi } from "../../lib/sicareApi";
import { consentApi } from "../../lib/consentApi";
import { InformedConsentModal } from "../../components/consent/InformedConsentModal";
import { GroupConsentModal } from "../../components/consent/GroupConsentModal";
import {
  getAllPublicAvailability,
  getPublicCounselors,
  type PublicAvailabilitySlot,
  type PublicCounselor,
} from "../../lib/publicApi";
import type {
  BookingListItemDto,
  ClientFeedbackDto,
  InformedConsentDto,
  SessionListItemDto,
  SessionMissedReasonApi,
  SessionStatusApi,
} from "../../types/api";
import {
  EXPIRED_BOOKING_LABEL,
  expiredReasonText,
  MISSED_SESSION_LABEL,
  missedReasonText,
} from "../../lib/sessionStatus";
import { formatWitaTime } from "../../lib/witaTime";

// "waiting": jam sesi sudah tiba/lewat tetapi konselor belum memulai (status server masih `scheduled`).
// "missed": ditandai otomatis oleh server setelah lewat jam selesai + toleransi.
// "expired": booking yang tidak dikonfirmasi sampai jadwalnya tiba (status booking `expired`).
type SessionStatus = "ongoing" | "waiting" | "done" | "upcoming" | "missed" | "expired";

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
  /** Status dari server; tidak ada untuk booking yang belum punya baris sesi. */
  serverStatus?: SessionStatusApi;
  missedReason?: SessionMissedReasonApi | null;
  /** Status booking untuk entri yang belum punya baris sesi. */
  bookingStatus?: BookingListItemDto["status"];
  expiredReason?: BookingListItemDto["expired_reason"];
  consentId?: string;
  rawSessionId?: string;
  /** Booking kelompok: perwakilan membagikan tautan consent ke anggota. */
  isGroup?: boolean;
  /** Konselor meminta jadwal ulang: klien wajib memilih slot pengganti sebelum jam aslinya. */
  needsNewSlot?: boolean;
  /** Alasan konselor meminta jadwal ulang. */
  rescheduleReason?: string | null;
};

type RescheduleState = {
  sessionId: number | string;
  date: Date | null;
  slotIndex: number | null;
  error: string;
  month: Date;
  submitting: boolean;
};

type TimeSlot = {
  label: string;
  start: Date;
  slotId?: string;
};

const MAX_AHEAD_DAYS = 60;
/** Sama dengan aturan server: booking terkonfirmasi dibatalkan paling lambat 2 jam sebelumnya. */
const CLIENT_CANCEL_CUTOFF_HOURS = 2;

/** null bila boleh dibatalkan; selain itu alasan tidak bisa dibatalkan dari aplikasi. */
const cancelBlockReason = (session: Session, now: number): string | null => {
  if (!session.bookingId || now >= session.start.getTime()) return "Jadwal sudah lewat.";
  const confirmed = session.serverStatus === "scheduled";
  const pending = session.bookingStatus === "waiting_confirmation" || session.needsNewSlot;
  if (!confirmed && !pending) return "Booking ini tidak dapat dibatalkan.";
  if (confirmed && session.start.getTime() - now < CLIENT_CANCEL_CUTOFF_HOURS * 3_600_000) {
    return `Sesi terkonfirmasi hanya dapat dibatalkan paling lambat ${CLIENT_CANCEL_CUTOFF_HOURS} jam sebelum jadwal. Hubungi konselor bila mendesak.`;
  }
  return null;
};

const formatTime = (date: Date) =>
  formatWitaTime(date);

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
    timeZone: "Asia/Makassar",
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

// Status mengikuti server; jam hanya dipakai untuk membedakan sesi yang belum tiba waktunya.
const statusOf = (session: Session, now: number): SessionStatus => {
  if (session.serverStatus === "completed") return "done";
  if (session.serverStatus === "missed") return "missed";
  if (session.serverStatus === "ongoing") return "ongoing";
  if (!session.serverStatus) {
    // Belum ada sesi: booking masih menunggu konfirmasi atau jadwal ulang.
    if (session.bookingStatus === "expired") return "expired";
    if (session.bookingStatus === "reschedule_requested") return "upcoming";
    if (now >= session.start.getTime()) return "expired";
  }
  if (now < session.start.getTime()) return "upcoming";
  return "waiting";
};

const MISSED_VISIBLE_DAYS = 14;

const canReschedule = (session: Session, now: number) => {
  const hoursLeft = (session.start.getTime() - now) / 3_600_000;
  return (
    Boolean(session.needsNewSlot) &&
    statusOf(session, now) === "upcoming" &&
    hoursLeft > 0
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
      {date.toLocaleDateString("id-ID", { timeZone: "Asia/Makassar", month: "short" })}
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
        <Badge size="md" className={`shrink-0 ${badgeClass}`}>
          {count}
        </Badge>
      )}
    </div>
  );
};

export default function KlienAktivitasPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [dynamicSlots, setDynamicSlots] = useState<PublicAvailabilitySlot[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [feedbackSessionId, setFeedbackSessionId] = useState<
    number | string | null
  >(null);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackNote, setFeedbackNote] = useState("");
  const [consentSessionId, setConsentSessionId] = useState<
    number | string | null
  >(null);
  const [groupConsentBookingId, setGroupConsentBookingId] = useState<
    string | null
  >(null);
  const [cancelTarget, setCancelTarget] = useState<Session | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const toast = useToast();
  const [view, setView] = useState<"main" | "reschedule">("main");
  const [reschedule, setReschedule] = useState<RescheduleState | null>(null);

  const fetchActivity = useCallback(async () => {
    try {
      const from = new Date();
      const to = new Date(from.getTime() + 90 * 24 * 60 * 60 * 1000);

      const [sessionRows, bookingRows, counselors, feedbackRows, slotRows] =
        await Promise.all([
          sicareApi.allSessions().catch(() => [] as SessionListItemDto[]),
          sicareApi.allBookings().catch(() => [] as BookingListItemDto[]),
          getPublicCounselors().catch(() => [] as PublicCounselor[]),
          sicareApi.myFeedback().catch(() => [] as ClientFeedbackDto[]),
          getAllPublicAvailability({ from, to }).catch(
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
        if (s.status === "cancelled") continue;
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

        const isRescheduled = booking?.status === "reschedule_requested";

        mappedSessions.push({
          id: s.id,
          counselor: counselorName,
          initials,
          service,
          room: s.room || "Ruang Konseling 01",
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
                      timeZone: "Asia/Makassar",
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
          serverStatus: s.status,
          missedReason: s.missed_reason ?? null,
          consentId: consent?.id,
          rawSessionId: s.id,
          isGroup: booking?.service_type === "group",
          needsNewSlot: isRescheduled,
          rescheduleReason: isRescheduled ? booking?.reschedule_reason ?? null : null,
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
          bookingStatus: b.status,
          expiredReason: b.expired_reason ?? null,
          consentId: consent?.id,
          rawSessionId: b.id,
          isGroup: b.service_type === "group",
          needsNewSlot: isRescheduled,
          rescheduleReason: isRescheduled ? b.reschedule_reason ?? null : null,
        });
      }

      return {
        filteredSlots,
        mappedSessions,
      };
    } catch {
      return null;
    }
  }, []);

  const refreshActivity = useCallback(async () => {
    const res = await fetchActivity();
    if (!res) return;
    setDynamicSlots(res.filteredSlots);
    setSessions(res.mappedSessions);
  }, [fetchActivity]);

  useEffect(() => {
    let active = true;
    void fetchActivity()
      .then((res) => {
        if (!active || !res) return;
        setDynamicSlots(res.filteredSlots);
        setSessions(res.mappedSessions);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fetchActivity]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, []);


  const ongoing = useMemo(
    () =>
      sessions
        .filter((session) => {
          const status = statusOf(session, now);
          return status === "ongoing" || status === "waiting";
        })
        .sort((a, b) => a.start.getTime() - b.start.getTime()),
    [sessions, now],
  );

  const expiredRequests = useMemo(
    () =>
      sessions
        .filter(
          (session) =>
            statusOf(session, now) === "expired" &&
            now - session.start.getTime() <= MISSED_VISIBLE_DAYS * 86_400_000,
        )
        .sort((a, b) => b.start.getTime() - a.start.getTime()),
    [sessions, now],
  );

  const missed = useMemo(
    () =>
      sessions
        .filter(
          (session) =>
            statusOf(session, now) === "missed" &&
            now - session.end.getTime() <= MISSED_VISIBLE_DAYS * 86_400_000,
        )
        .sort((a, b) => b.start.getTime() - a.start.getTime()),
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
    ongoing.some((session) => statusOf(session, now) === "ongoing")
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

  /** Slot pengganti: hanya slot server milik konselor yang sama (dicocokkan lewat ID). */
  const slotsFor = (session: Session, date: Date): TimeSlot[] => {
    if (!session.counselorId) return [];
    return dynamicSlots
      .filter((slot) => {
        const slotStart = new Date(slot.starts_at);
        return (
          slot.counselor_id === session.counselorId &&
          sameDay(slotStart, date) &&
          slotStart.getTime() > now
        );
      })
      .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))
      .map((slot) => {
        const slotStart = new Date(slot.starts_at);
        const slotEnd = new Date(slot.ends_at);
        return {
          label: `${formatTime(slotStart)}-${formatTime(slotEnd)}`,
          start: slotStart,
          slotId: slot.id,
        };
      });
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
      toast.info("Terima kasih! Penilaianmu sudah kami terima.");
      void refreshActivity();
    } catch (cause) {
      const msg =
        cause instanceof Error ? cause.message : "Penilaian tidak dapat dikirim.";
      toast.error(msg);
    }
  };

  // Server-confirmed signing happens inside InformedConsentModal; refresh to reflect it.
  const handleConsentSigned = () => {
    toast.success("Informed consent berhasil ditandatangani.");
    void refreshActivity();
  };

  const openReschedule = (sessionId: number | string) => {
    const session = sessions.find((item) => item.id === sessionId);
    if (!session || !canReschedule(session, now)) return;

    const today = new Date(now);
    setReschedule({
      sessionId,
      date: null,
      slotIndex: null,
      error: "",
      month: new Date(today.getFullYear(), today.getMonth(), 1),
      submitting: false,
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
      reschedule.submitting ||
      !reschedule.date ||
      reschedule.slotIndex === null
    ) {
      return;
    }

    const selectedSlot = slotsFor(rescheduleSession, reschedule.date)[
      reschedule.slotIndex
    ];

    if (!selectedSlot?.slotId || !rescheduleSession.bookingId) {
      updateReschedule({
        error: "Jam yang dipilih sudah tidak tersedia. Silakan pilih kembali.",
      });
      return;
    }

    if (!canReschedule(rescheduleSession, now)) {
      updateReschedule({
        error:
          "Jadwal pengganti tidak dapat dipilih lagi karena jadwal semula sudah lewat.",
      });
      return;
    }

    updateReschedule({ submitting: true, error: "" });
    try {
      // Sukses hanya ditampilkan setelah server mengonfirmasi.
      await sicareApi.rescheduleBooking(
        rescheduleSession.bookingId,
        selectedSlot.slotId,
      );
      setReschedule(null);
      setView("main");
      toast.success(
        "Jadwal pengganti dikirim. Menunggu konfirmasi konselor.",
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
      void refreshActivity();
    } catch (cause) {
      const msg =
        cause instanceof Error
          ? cause.message
          : "Jadwal pengganti gagal dikirim. Silakan coba lagi.";
      updateReschedule({ error: msg, submitting: false });
    }
  };

  /** Tombol perwakilan untuk membagikan tautan consent ke anggota kelompok. */
  const renderGroupConsentButton = (session: Session) =>
    session.isGroup && session.bookingId && session.serverStatus === "scheduled" ? (
      <button
        type="button"
        onClick={() => setGroupConsentBookingId(session.bookingId ?? null)}
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#1e5b3a] px-4 py-2.5 text-sm font-semibold text-[#1e5b3a] transition hover:bg-[#e8f9f0]"
      >
        <Users className="h-4 w-4" />
        Consent anggota kelompok
      </button>
    ) : null;

  const renderOngoingCard = (session: Session) => {
    const signed = session.consentSigned;
    const waiting = statusOf(session, now) === "waiting";

    return (
      <article
        key={session.id}
        className="overflow-hidden rounded-3xl border border-[#1e5b3a]/15 bg-white shadow-sm"
      >
        <div
          className={`flex items-center justify-between gap-3 px-5 py-3 ${
            waiting ? "bg-amber-100 text-amber-900" : "bg-[#1e5b3a] text-white"
          }`}
        >
          <div className="flex items-center gap-2">
            {waiting ? (
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
            ) : (
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#8fe3bf] opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#8fe3bf]" />
              </span>
            )}
            <span className="text-xs font-semibold uppercase tracking-wider">
              {waiting ? "Menunggu sesi dimulai" : "Sedang berlangsung"}
            </span>
          </div>
          <span className={`text-xs ${waiting ? "text-amber-800" : "text-white/80"}`}>
            {formatTime(session.start)}–{formatTime(session.end)} WITA
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
                {waiting
                  ? "Konselor baru dapat memulai sesi setelah dokumen ini ditandatangani. Jika belum ditandatangani sampai 30 menit setelah jadwal berakhir, sesi ditandai terlewat."
                  : "Dokumen ini wajib disetujui sebelum sesi dimulai."}
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
          {session.isGroup && session.serverStatus === "scheduled" && (
            <div className="rounded-2xl border border-gray-200 p-4">
              <p className="text-sm font-semibold text-gray-900">
                Persetujuan anggota kelompok
              </p>
              <p className="mt-1 text-xs text-gray-600">
                Sesi baru dapat dimulai setelah semua anggota menandatangani.
                Bagikan tautan undangan pribadi kepada setiap anggota.
              </p>
              <div className="mt-3">{renderGroupConsentButton(session)}</div>
            </div>
          )}
        </div>
      </article>
    );
  };

  const renderMissedCard = (session: Session) => (
    <div
      key={session.id}
      className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 items-center gap-4">
        {dateBadge(session.start)}
        <div className="min-w-0">
          <p className="font-semibold text-gray-900">{session.counselor}</p>
          <p className="text-xs text-gray-500">
            {session.service} · {formatTime(session.start)}–{formatTime(session.end)} WITA
          </p>
          <p className="mt-1 text-xs text-gray-600">
            {statusOf(session, now) === "expired"
              ? expiredReasonText(session.expiredReason)
              : missedReasonText(session.missedReason)}
          </p>
        </div>
      </div>
      <Link
        to="/klien/permintaan"
        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-[#1e5b3a] px-4 py-2 text-sm font-semibold text-[#1e5b3a] transition hover:bg-[#f7fcf9]"
      >
        <CalendarPlus className="h-4 w-4" />
        Pesan jadwal baru
      </Link>
    </div>
  );

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

  const openCancel = (session: Session) => {
    setCancelTarget(session);
    setCancelReason("");
    setCancelError("");
  };

  const submitCancel = async () => {
    if (!cancelTarget?.bookingId || cancelSubmitting) return;
    const reason = cancelReason.trim();
    if (reason.length < 3) {
      setCancelError("Tuliskan alasan pembatalan (minimal 3 karakter).");
      return;
    }
    const blocked = cancelBlockReason(cancelTarget, Date.now());
    if (blocked) {
      setCancelError(blocked);
      return;
    }
    setCancelSubmitting(true);
    setCancelError("");
    try {
      // Sukses hanya setelah server mengonfirmasi pembatalan.
      await sicareApi.transitionBooking(cancelTarget.bookingId, { status: "cancelled", reason });
      setCancelTarget(null);
      toast.success("Booking dibatalkan. Konselor sudah diberi tahu.");
      void refreshActivity();
    } catch (cause) {
      setCancelError(cause instanceof Error ? cause.message : "Booking tidak dapat dibatalkan.");
    } finally {
      setCancelSubmitting(false);
    }
  };

  const renderUpcomingCard = (session: Session, isNext: boolean) => {
    const allowed = canReschedule(session, now);
    const cancelBlocked = cancelBlockReason(session, now);
    const awaitingConfirmation =
      session.bookingStatus === "waiting_confirmation";
    const canSignConsent =
      session.serverStatus === "scheduled" && !session.consentSigned;

    return (
      <article
        key={session.id}
        className={`rounded-2xl border bg-white p-4 sm:p-5 ${
          isNext ? "border-[#1e5b3a]/30 shadow-sm" : "border-gray-200"
        }`}
      >
        {isNext && (
          <Badge weight="semibold" className="mb-3 bg-[#1e5b3a] text-white">
            Sesi berikutnya · {countdown(session.start.getTime() - now)}
          </Badge>
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
            {canSignConsent && (
              <button
                type="button"
                onClick={() => setConsentSessionId(session.id)}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1e5b3a] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#174a2f]"
              >
                <FileSignature className="h-4 w-4" />
                Tanda tangan consent
              </button>
            )}
            {renderGroupConsentButton(session)}
            {session.needsNewSlot ? (
              <button
                type="button"
                disabled={!allowed}
                onClick={() => openReschedule(session.id)}
                className="rounded-xl border border-[#1e5b3a] px-4 py-2.5 text-sm font-semibold text-[#1e5b3a] transition hover:bg-[#e8f9f0] disabled:cursor-not-allowed disabled:border-gray-300 disabled:text-gray-400 disabled:hover:bg-transparent"
              >
                <IconLabel icon={Pencil}>Pilih jadwal pengganti</IconLabel>
              </button>
            ) : awaitingConfirmation ? (
              <span className="rounded-xl bg-amber-50 px-3 py-2 text-center text-xs font-semibold text-amber-800">
                Menunggu konfirmasi konselor
              </span>
            ) : null}
            {session.bookingId && (
              <button
                type="button"
                disabled={Boolean(cancelBlocked)}
                title={cancelBlocked ?? undefined}
                onClick={() => openCancel(session)}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:text-gray-400 disabled:hover:bg-transparent"
              >
                Batalkan booking
              </button>
            )}
          </div>
        </div>

        {session.needsNewSlot && (
          <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Konselor meminta jadwal ulang
            {session.rescheduleReason ? `: ${session.rescheduleReason}` : ""}.
            Pilih jadwal pengganti sebelum {dayLabel(session.start, now).toLowerCase()},{" "}
            {formatTime(session.start)} WITA; setelah itu permintaan otomatis
            kedaluwarsa.
          </p>
        )}
        {canSignConsent && (
          <p className="mt-3 text-xs text-gray-500">
            Tanda tangani informed consent sebelum sesi agar konselor dapat
            memulai sesi tepat waktu.
          </p>
        )}
        {session.serverStatus === "scheduled" && (
          <p className="mt-2 text-xs text-gray-500">
            Perlu mengubah jadwal? Sampaikan kepada konselor; konselor dapat
            meminta jadwal ulang sehingga kamu bisa memilih jadwal pengganti di
            sini.
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
      ? slotsFor(rescheduleSession, reschedule.date)
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
          slotsFor(rescheduleSession, date).length > 0;
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
            Pilih jadwal pengganti
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            {rescheduleSession.counselor} · jadwal semula{" "}
            {dayLabel(rescheduleSession.start, now)},{" "}
            {formatTime(rescheduleSession.start)} WITA
          </p>
        </section>

        <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
          <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 sm:p-6">
            <p className="text-sm font-bold text-amber-900">
              Alasan dari konselor
            </p>
            <p className="mt-2 text-sm text-amber-900">
              {rescheduleSession.rescheduleReason || "Konselor meminta penjadwalan ulang."}
            </p>
            <p className="mt-4 text-xs text-amber-800">
              Pilih salah satu jadwal konselor yang masih kosong. Setelah dikirim,
              konselor akan mengonfirmasi jadwal baru. Bila tidak dipilih sampai
              jadwal semula tiba, permintaan otomatis kedaluwarsa.
            </p>
          </section>

          <section className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-6">
            <p className="text-sm font-bold text-gray-900">
              1. Pilih tanggal <span className="text-red-600">*</span>
            </p>
            <p className="mt-0.5 text-xs text-gray-500">
              Tanggal berwarna hijau memiliki jadwal konselor yang masih kosong.
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
              2. Pilih jam <span className="text-red-600">*</span>
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
                      key={slot.slotId ?? slot.label}
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
            <IconLabel icon={X}>Batal</IconLabel>
          </button>
          <button
            type="button"
            disabled={
              reschedule.submitting ||
              !(reschedule.date && reschedule.slotIndex !== null)
            }
            onClick={() => void submitReschedule()}
            className="rounded-xl bg-[#1e5b3a] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#174a2f] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <IconLabel icon={Send}>
              {reschedule.submitting ? "Mengirim..." : "Kirim jadwal pengganti"}
            </IconLabel>
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
            timeZone: "Asia/Makassar",
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

      {missed.length > 0 && (
        <section
          className="space-y-4 rounded-3xl border border-gray-200 bg-gray-50/60 p-5 sm:p-6"
          aria-labelledby="missed-section-title"
        >
          <div id="missed-section-title">
            <SectionHeader
              title={`Sesi ${MISSED_SESSION_LABEL.toLowerCase()}`}
              description="Sesi ini tidak terlaksana sesuai jadwal. Kamu dapat mengajukan permintaan jadwal baru kapan saja."
              count={missed.length}
            />
          </div>
          <div className="space-y-3">{missed.map(renderMissedCard)}</div>
        </section>
      )}

      {expiredRequests.length > 0 && (
        <section
          className="space-y-4 rounded-3xl border border-gray-200 bg-gray-50/60 p-5 sm:p-6"
          aria-labelledby="expired-section-title"
        >
          <div id="expired-section-title">
            <SectionHeader
              title={`Permintaan ${EXPIRED_BOOKING_LABEL.toLowerCase()}`}
              description="Permintaan ini ditutup otomatis karena belum dikonfirmasi sampai jadwalnya tiba."
              count={expiredRequests.length}
            />
          </div>
          <div className="space-y-3">{expiredRequests.map(renderMissedCard)}</div>
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

        {loading ? (
          <SkeletonList rows={3} label="Memuat aktivitas konseling..." />
        ) : upcoming.length > 0 ? (
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
              to="/klien/permintaan"
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

      {consentSession?.bookingId && (
        <InformedConsentModal
          key={consentSession.id}
          bookingId={consentSession.bookingId}
          isOpen
          onClose={() => setConsentSessionId(null)}
          onSuccess={handleConsentSigned}
        />
      )}

      {cancelTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0c2619]/40 p-4"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget && !cancelSubmitting) setCancelTarget(null);
          }}
        >
          <div role="dialog" aria-modal="true" aria-labelledby="cancel-booking-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 id="cancel-booking-title" className="text-lg font-bold text-gray-900">
              Batalkan booking?
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              {cancelTarget.counselor} · {dayLabel(cancelTarget.start, now)}, {formatTime(cancelTarget.start)} WITA.
              Konselor akan diberi tahu dan ketersediaan dibuka kembali.
            </p>
            <label className="mt-4 block text-sm font-semibold text-gray-900">
              Alasan pembatalan <span className="text-red-600">*</span>
              <textarea
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
                maxLength={1000}
                rows={3}
                disabled={cancelSubmitting}
                placeholder="Contoh: bentrok dengan jadwal ujian."
                className="mt-2 w-full rounded-xl border border-gray-300 p-3 text-sm font-normal outline-none focus:border-[#1e5b3a] focus:ring-4 focus:ring-[#1e5b3a]/15"
              />
            </label>
            {cancelError && (
              <p role="alert" className="mt-2 text-sm text-red-600">
                {cancelError}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={cancelSubmitting}
                onClick={() => setCancelTarget(null)}
                className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Kembali
              </button>
              <button
                type="button"
                disabled={cancelSubmitting}
                onClick={() => void submitCancel()}
                className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {cancelSubmitting ? "Membatalkan..." : "Ya, batalkan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {groupConsentBookingId && (
        <GroupConsentModal
          bookingId={groupConsentBookingId}
          isOpen
          onClose={() => setGroupConsentBookingId(null)}
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
                <IconLabel icon={Send}>Kirim penilaian</IconLabel>
              </button>
            </div>
          </section>
        </div>
      )}

    </>
  );
}
