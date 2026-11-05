import IconLabel from "../../components/shared/IconLabel";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Info,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  X,
  Pencil,
  XCircle,
  Save,
} from "lucide-react";
import {
  PageContainer,
  PageHeader,
  SkeletonList,
  useToast,
} from "../../components/shared";
import {
  formatAcademicPeriodLabel,
  formatBookingClientTitle,
  toLocalDateKey,
} from "../../features/counselor/shared/presentation";
import {
  addDays,
  clamp,
  dateLabel,
  END,
  fmt,
  H,
  keyOf,
  LAST_START,
  MONTHS,
  pad,
  parseKey,
  parseTime,
  PX,
  SESSION,
  SNAP,
  START,
  startOfDay,
  WEEKDAYS,
  yOf,
} from "../../features/counselor/schedule/scheduleUtils";
import { ApiError } from "../../lib/api";
import { counselorApi } from "../../lib/counselorApi";
import {
  getPublicAcademicPeriods,
  type PublicAcademicPeriod,
} from "../../lib/publicApi";
import { sicareApi } from "../../lib/sicareApi";
import type {
  BookingRecordBaseDto,
  CounselorAvailabilitySlotDto,
  SessionListItemDto,
} from "../../types/api";

type CalendarSlotItem = {
  id: string;
  dateKey: string;
  start: number;
  end: number;
  isBooked: boolean;
  academicPeriodId: string | null;
  clientLabel?: string;
  bookingStatus?: string;
  bookingId?: string;
  sessionId?: string;
  sessionStatus?: string;
};

type SlotEditorModalState = {
  mode: "new" | "edit";
  slotId: string | null;
  dateKey: string;
  initialStart: number;
  isBooked: boolean;
  clientLabel?: string;
  bookingStatus?: string;
  bookingId?: string;
  sessionId?: string;
  sessionStatus?: string;
};

function buildSlotIsoPayload(
  dateKey: string,
  startMinutes: number,
  periods: PublicAcademicPeriod[],
) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const startDate = new Date(
    year,
    month - 1,
    day,
    Math.floor(startMinutes / 60),
    startMinutes % 60,
    0,
    0,
  );
  const endDate = new Date(startDate.getTime() + SESSION * 60 * 1000);
  const matchedPeriod =
    periods.find((p) => dateKey >= p.starts_on && dateKey <= p.ends_on) ?? null;

  return {
    starts_at: startDate.toISOString(),
    ends_at: endDate.toISOString(),
    academic_period_id: matchedPeriod ? matchedPeriod.id : null,
  };
}

export default function KonselorJadwalPage() {
  const navigate = useNavigate();

  const today = useMemo(() => startOfDay(new Date()), []);
  const todayKey = keyOf(today);

  const [rawSlots, setRawSlots] = useState<CounselorAvailabilitySlotDto[]>([]);
  const [bookings, setBookings] = useState<BookingRecordBaseDto[]>([]);
  const [sessions, setSessions] = useState<SessionListItemDto[]>([]);
  const [periods, setPeriods] = useState<PublicAcademicPeriod[]>([]);

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [mutating, setMutating] = useState(false);

  const toast = useToast();

  const [selected, setSelected] = useState(todayKey);
  const [weekStart, setWeekStart] = useState(today);
  const [calMonth, setCalMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );

  const [editor, setEditor] = useState<SlotEditorModalState | null>(null);
  const [editorText, setEditorText] = useState("09.00");
  const [editorError, setEditorError] = useState<string | null>(null);

  const [cancelSessionTarget, setCancelSessionTarget] = useState<{
    sessionId: string;
    clientLabel: string;
    dateKey: string;
    start: number;
  } | null>(null);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);

  const [drag, setDrag] = useState<{
    slotId: string;
    fromDate: string;
    origStart: number;
    toDate: string;
    start: number;
    offsetY: number;
  } | null>(null);
  const dragRef = useRef(drag);
  useEffect(() => {
    dragRef.current = drag;
  }, [drag]);
  const colRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const fetchScheduleData = useCallback(async () => {
    const [availRes, bookingsRes, sessionsRes, periodsRes] = await Promise.all([
      counselorApi.getAvailability(),
      sicareApi.bookings(100).catch(() => [] as BookingRecordBaseDto[]),
      sicareApi.sessions(100).catch(() => [] as SessionListItemDto[]),
      getPublicAcademicPeriods().catch(() => [] as PublicAcademicPeriod[]),
    ]);

    return {
      slots: availRes,
      bookings: bookingsRes,
      sessions: sessionsRes,
      periods: periodsRes,
    };
  }, []);

  useEffect(() => {
    let active = true;
    fetchScheduleData()
      .then((data) => {
        if (!active) return;
        setRawSlots(data.slots);
        setBookings(data.bookings);
        setSessions(data.sessions);
        setPeriods(data.periods);
        setErrorMessage(null);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setErrorMessage(
          err instanceof ApiError
            ? err.message
            : "Gagal memuat jadwal ketersediaan konselor dari server.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [fetchScheduleData]);

  const handleManualRefresh = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const data = await fetchScheduleData();
      setRawSlots(data.slots);
      setBookings(data.bookings);
      setSessions(data.sessions);
      setPeriods(data.periods);
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof ApiError
          ? err.message
          : "Gagal memuat ulang jadwal ketersediaan.",
      );
    } finally {
      setLoading(false);
    }
  };

  // Map published slots into calendar items grouped by YYYY-MM-DD
  const slotsByDate = useMemo(() => {
    const activeBookingBySlot = new Map<string, BookingRecordBaseDto>();
    for (const b of bookings) {
      if (
        b.availability_slot_id &&
        b.status !== "cancelled" &&
        b.status !== "rejected"
      ) {
        activeBookingBySlot.set(b.availability_slot_id, b);
      }
    }

    const sessionByBooking = new Map<string, SessionListItemDto>();
    for (const s of sessions) {
      if (s.status !== "cancelled") {
        sessionByBooking.set(s.booking_id, s);
      }
    }

    const grouped: Record<string, CalendarSlotItem[]> = {};

    for (const slot of rawSlots) {
      if (slot.status === "cancelled") continue;
      const startDate = new Date(slot.starts_at);
      const endDate = new Date(slot.ends_at);
      if (Number.isNaN(startDate.getTime())) continue;

      const dKey = toLocalDateKey(startDate);
      const startMins = startDate.getHours() * 60 + startDate.getMinutes();
      const endMins = Number.isNaN(endDate.getTime())
        ? startMins + SESSION
        : endDate.getHours() * 60 + endDate.getMinutes();

      const linkedBooking = activeBookingBySlot.get(slot.id);
      const linkedSession = linkedBooking
        ? sessionByBooking.get(linkedBooking.id)
        : undefined;

      const item: CalendarSlotItem = {
        id: slot.id,
        dateKey: dKey,
        start: startMins,
        end: endMins,
        isBooked: Boolean(slot.status === "blocked" || linkedBooking),
        academicPeriodId: slot.academic_period_id,
        clientLabel: linkedBooking
          ? formatBookingClientTitle(linkedBooking)
          : slot.status === "blocked"
            ? "Terpesan Klien"
            : undefined,
        bookingStatus: linkedBooking?.status,
        bookingId: linkedBooking?.id,
        sessionId: linkedSession?.id,
        sessionStatus: linkedSession?.status,
      };

      if (!grouped[dKey]) grouped[dKey] = [];
      grouped[dKey].push(item);
    }

    for (const dKey of Object.keys(grouped)) {
      grouped[dKey].sort((a, b) => a.start - b.start);
    }

    return grouped;
  }, [bookings, rawSlots, sessions]);

  const isPast = useCallback((dKey: string) => dKey < todayKey, [todayKey]);

  const findConflict = useCallback(
    (
      dKey: string,
      startMins: number,
      ignoreSlotId?: string | null,
    ): CalendarSlotItem | null => {
      const list = slotsByDate[dKey] ?? [];
      return (
        list.find(
          (s) =>
            s.id !== ignoreSlotId &&
            Math.abs(s.start - startMins) < SESSION,
        ) ?? null
      );
    },
    [slotsByDate],
  );

  const pickDate = (dKey: string) => {
    setSelected(dKey);
    const d = parseKey(dKey);
    setCalMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    const diff = Math.round((d.getTime() - weekStart.getTime()) / 86400000);
    if (diff < 0 || diff > 6) setWeekStart(d);
  };

  const openNewSlotModal = (dKey: string, initialStart?: number) => {
    if (isPast(dKey)) return;
    let start = initialStart ?? 9 * 60;
    if (initialStart === undefined) {
      for (let t = START; t <= LAST_START; t += SESSION) {
        if (!findConflict(dKey, t)) {
          start = t;
          break;
        }
      }
    }
    setEditorError(null);
    setEditorText(fmt(start));
    setEditor({
      mode: "new",
      slotId: null,
      dateKey: dKey,
      initialStart: start,
      isBooked: false,
    });
  };

  const openEditSlotModal = (item: CalendarSlotItem) => {
    setEditorError(null);
    setEditorText(fmt(item.start));
    setEditor({
      mode: "edit",
      slotId: item.id,
      dateKey: item.dateKey,
      initialStart: item.start,
      isBooked: item.isBooked,
      clientLabel: item.clientLabel,
      bookingStatus: item.bookingStatus,
      bookingId: item.bookingId,
      sessionId: item.sessionId,
      sessionStatus: item.sessionStatus,
    });
  };

  const handleSaveSlotModal = async () => {
    if (!editor || mutating) return;
    const parsed = parseTime(editorText);
    if (parsed === null) {
      setEditorError("Format jam tidak valid. Contoh: 09.00 atau 13.30");
      return;
    }
    if (parsed < START || parsed > LAST_START) {
      setEditorError(
        "Jam mulai harus antara 08.00 dan 15.00 agar sesi 1 jam selesai sebelum 16.00.",
      );
      return;
    }
    const conflict = findConflict(editor.dateKey, parsed, editor.slotId);
    if (conflict) {
      setEditorError(
        `Bentrok dengan jadwal ${fmt(conflict.start)} – ${fmt(conflict.start + SESSION)}.`,
      );
      return;
    }

    setMutating(true);
    setEditorError(null);

    try {
      const payload = buildSlotIsoPayload(editor.dateKey, parsed, periods);
      if (editor.mode === "new") {
        const created = await counselorApi.createAvailability(payload);
        setRawSlots((prev) => [...prev, created]);
        toast.success(`Slot ketersediaan ${dateLabel(editor.dateKey)} (${fmt(parsed)} – ${fmt(parsed + SESSION)}) berhasil ditambahkan.`);
      } else if (editor.slotId) {
        const updated = await counselorApi.updateAvailability(editor.slotId, payload);
        setRawSlots((prev) =>
          prev.map((s) => (s.id === editor.slotId ? updated : s)),
        );
        toast.success(`Slot ketersediaan berhasil diperbarui ke ${fmt(parsed)} – ${fmt(parsed + SESSION)}.`);
      }
      setEditor(null);
    } catch (err: unknown) {
      setEditorError(
        err instanceof ApiError
          ? err.message
          : "Gagal menyimpan jadwal ketersediaan ke server.",
      );
    } finally {
      setMutating(false);
    }
  };

  const handleDeleteSlot = async () => {
    if (!editor?.slotId || mutating) return;
    setMutating(true);
    setEditorError(null);

    try {
      const cancelled = await counselorApi.cancelAvailability(editor.slotId);
      setRawSlots((prev) =>
        prev.map((s) =>
          s.id === cancelled.id ? { ...s, status: "cancelled" } : s,
        ),
      );
      toast.success("Slot ketersediaan berhasil dibatalkan/dihapus.");
      setEditor(null);
    } catch (err: unknown) {
      setEditorError(
        err instanceof ApiError
          ? err.message
          : "Gagal menghapus slot ketersediaan.",
      );
    } finally {
      setMutating(false);
    }
  };

  const handleConfirmCancelSession = async () => {
    if (!cancelSessionTarget || cancelSubmitting) return;
    setCancelSubmitting(true);
    try {
      await sicareApi.transitionSession(cancelSessionTarget.sessionId, {
        status: "cancelled",
      });
      setCancelSessionTarget(null);
      toast.success(`Sesi dengan ${cancelSessionTarget.clientLabel} berhasil dibatalkan dan slot telah dibuka kembali.`);
      const fresh = await fetchScheduleData();
      setRawSlots(fresh.slots);
      setBookings(fresh.bookings);
      setSessions(fresh.sessions);
    } catch (err: unknown) {
      toast.error(err instanceof ApiError
            ? err.message
            : "Gagal membatalkan sesi konseling.");
    } finally {
      setCancelSubmitting(false);
    }
  };

  // Drag-and-drop support for unbooked slots
  useEffect(() => {
    if (!drag) return;

    const onMove = (e: PointerEvent) => {
      const cur = dragRef.current;
      if (!cur) return;
      let toDate = cur.toDate;
      for (const [k, el] of Object.entries(colRefs.current)) {
        if (!el || isPast(k)) continue;
        const r = el.getBoundingClientRect();
        if (e.clientX >= r.left && e.clientX <= r.right) {
          toDate = k;
          break;
        }
      }
      const col = colRefs.current[toDate];
      if (!col) return;
      const r = col.getBoundingClientRect();
      const rawMins = START + (e.clientY - r.top - cur.offsetY) / PX;
      const snapped = clamp(
        Math.round(rawMins / SNAP) * SNAP,
        START,
        LAST_START,
      );
      setDrag((d) => (d ? { ...d, toDate, start: snapped } : null));
    };

    const onUp = () => {
      const cur = dragRef.current;
      setDrag(null);
      if (!cur) return;
      if (isPast(cur.toDate)) return;
      if (cur.fromDate === cur.toDate && cur.origStart === cur.start) return;
      if (findConflict(cur.toDate, cur.start, cur.slotId)) {
        toast.error("Tidak dapat memindahkan jadwal karena berbenturan dengan slot lain.");
        return;
      }

      const payload = buildSlotIsoPayload(cur.toDate, cur.start, periods);
      setMutating(true);
      counselorApi
        .updateAvailability(cur.slotId, payload)
        .then((updated) => {
          setRawSlots((prev) =>
            prev.map((s) => (s.id === cur.slotId ? updated : s)),
          );
          toast.success(`Jadwal berhasil dipindahkan ke ${dateLabel(cur.toDate)} (${fmt(cur.start)} – ${fmt(cur.start + SESSION)}).`);
        })
        .catch((err: unknown) => {
          toast.error(err instanceof ApiError
                ? err.message
                : "Gagal memindahkan jadwal ketersediaan.");
        })
        .finally(() => {
          setMutating(false);
        });
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [drag, findConflict, isPast, periods, toast]);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );
  const hours = useMemo(() => Array.from({ length: 9 }, (_, i) => 8 + i), []);
  const quarterLines = useMemo(
    () => Array.from({ length: (END - START) / SNAP + 1 }, (_, i) => START + i * SNAP),
    [],
  );

  const calCells = useMemo(() => {
    const y = calMonth.getFullYear();
    const m = calMonth.getMonth();
    const firstDow = (new Date(y, m, 1).getDay() + 6) % 7;
    const days = new Date(y, m + 1, 0).getDate();
    const cells: (Date | null)[] = Array(firstDow).fill(null);
    for (let d = 1; d <= days; d++) cells.push(new Date(y, m, d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [calMonth]);

  const selectedSlots = slotsByDate[selected] ?? [];
  const selectedPast = isPast(selected);

  const activePeriodLabel = useMemo(() => {
    const matched = periods.find(
      (p) => selected >= p.starts_on && selected <= p.ends_on,
    );
    return matched ? formatAcademicPeriodLabel(matched) : null;
  }, [periods, selected]);

  return (
    <PageContainer>
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <PageHeader
            title="Jadwal"
            description="Atur jam ketersediaan konseling Anda pada kalender mingguan"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleManualRefresh()}
              disabled={loading || mutating}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-xs transition hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading || mutating ? "animate-spin" : ""}`}
              />
              Muat Ulang
            </button>
            <button
              type="button"
              disabled={selectedPast || loading || mutating}
              onClick={() => openNewSlotModal(selected)}
              className="inline-flex items-center gap-2 rounded-xl bg-[#064E3B] px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-[#053e2f] disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Plus className="h-4 w-4" />
              Tambah Jadwal
            </button>
          </div>
        </div>


        {errorMessage && (
          <div
            role="alert"
            className="flex items-start justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            <div className="flex items-start gap-2.5">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              <div>
                <p className="font-semibold">Gagal Memuat Jadwal</p>
                <p className="mt-0.5">{errorMessage}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void handleManualRefresh()}
              className="shrink-0 rounded-xl border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
            >
              Coba Lagi
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* ==================== KALENDER MINGGUAN (8 col) ==================== */}
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-xs lg:col-span-8">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-gray-900">
                  {pad(weekDays[0].getDate())} {MONTHS[weekDays[0].getMonth()]} –{" "}
                  {pad(weekDays[6].getDate())} {MONTHS[weekDays[6].getMonth()]}{" "}
                  {weekDays[6].getFullYear()}
                </p>
                <p className="text-xs text-gray-500">
                  Klik ruang kosong untuk menambah slot 1 jam. Geser kartu hijau
                  untuk memindahkan jadwal yang belum dipesan.
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  aria-label="Minggu sebelumnya"
                  onClick={() => setWeekStart(addDays(weekStart, -7))}
                  className="rounded-xl border border-gray-200 p-2 hover:bg-gray-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setWeekStart(today);
                    pickDate(todayKey);
                  }}
                  className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Hari ini
                </button>
                <button
                  type="button"
                  aria-label="Minggu berikutnya"
                  onClick={() => setWeekStart(addDays(weekStart, 7))}
                  className="rounded-xl border border-gray-200 p-2 hover:bg-gray-50"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <div className="min-w-[680px]">
                {/* Header 7 Hari */}
                <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-gray-200 pb-2">
                  <div />
                  {weekDays.map((d) => {
                    const k = keyOf(d);
                    const isSel = k === selected;
                    const isTod = k === todayKey;
                    const past = isPast(k);
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => pickDate(k)}
                        className={`mx-0.5 rounded-xl py-1.5 text-center transition ${
                          isSel
                            ? "bg-[#064E3B] text-white"
                            : past
                              ? "text-gray-400 hover:bg-gray-50"
                              : "text-gray-800 hover:bg-gray-50"
                        }`}
                      >
                        <div className="text-[11px] font-medium opacity-80">
                          {WEEKDAYS[d.getDay()].slice(0, 3)}
                        </div>
                        <div className="text-sm font-bold">
                          {pad(d.getDate())}
                          {isTod && !isSel && (
                            <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-[#064E3B] align-middle" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Grid Jam 08.00 - 16.00 */}
                <div className="relative mt-2 grid grid-cols-[56px_repeat(7,1fr)] select-none">
                  <div className="relative" style={{ height: H }}>
                    {hours.map((h) => (
                      <div
                        key={h}
                        style={{ top: yOf(h * 60) - 7 }}
                        className="absolute right-2 text-[11px] font-medium tabular-nums text-gray-400"
                      >
                        {pad(h)}.00
                      </div>
                    ))}
                  </div>

                  {weekDays.map((d) => {
                    const k = keyOf(d);
                    const daySlots = slotsByDate[k] ?? [];
                    const past = isPast(k);
                    const ghost = drag && drag.toDate === k ? drag : null;
                    const ghostConflict = ghost
                      ? findConflict(k, ghost.start, ghost.slotId) !== null
                      : false;

                    return (
                      <div
                        key={k}
                        ref={(el) => {
                          colRefs.current[k] = el;
                        }}
                        style={{ height: H }}
                        onClick={(e) => {
                          if (past || drag) return;
                          if (e.target !== e.currentTarget) return;
                          const r = e.currentTarget.getBoundingClientRect();
                          const raw = START + (e.clientY - r.top) / PX;
                          const snapped = clamp(
                            Math.floor(raw / 60) * 60,
                            START,
                            LAST_START,
                          );
                          pickDate(k);
                          if (!findConflict(k, snapped)) {
                            openNewSlotModal(k, snapped);
                          }
                        }}
                        className={`relative border-l border-gray-200 ${
                          past
                            ? "bg-gray-50/70"
                            : k === selected
                              ? "bg-emerald-50/20 cursor-pointer"
                              : "cursor-pointer hover:bg-gray-50/50"
                        }`}
                      >
                        {quarterLines.map((m) => (
                          <div
                            key={m}
                            style={{ top: yOf(m) }}
                            className={`pointer-events-none absolute inset-x-0 border-t ${
                              m % 60 === 0
                                ? "border-gray-200"
                                : "border-gray-100"
                            }`}
                          />
                        ))}

                        {daySlots.map((s) => {
                          const isDragging = drag?.slotId === s.id;
                          const isBooked = s.isBooked;
                          const locked = past || isBooked;

                          return (
                            <div
                              key={s.id}
                              style={{
                                top: yOf(s.start) + 1,
                                height: SESSION * PX - 2,
                              }}
                              onPointerDown={(e) => {
                                if (locked) return;
                                e.stopPropagation();
                                const r =
                                  e.currentTarget.getBoundingClientRect();
                                const offsetY = e.clientY - r.top;
                                const startX = e.clientX;
                                const startY = e.clientY;
                                const moveCheck = (me: PointerEvent) => {
                                  if (
                                    Math.hypot(
                                      me.clientX - startX,
                                      me.clientY - startY,
                                    ) > 5
                                  ) {
                                    window.removeEventListener(
                                      "pointermove",
                                      moveCheck,
                                    );
                                    setDrag({
                                      slotId: s.id,
                                      fromDate: k,
                                      origStart: s.start,
                                      toDate: k,
                                      start: s.start,
                                      offsetY,
                                    });
                                  }
                                };
                                const upCheck = () => {
                                  window.removeEventListener(
                                    "pointermove",
                                    moveCheck,
                                  );
                                  window.removeEventListener(
                                    "pointerup",
                                    upCheck,
                                  );
                                };
                                window.addEventListener(
                                  "pointermove",
                                  moveCheck,
                                );
                                window.addEventListener("pointerup", upCheck);
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                pickDate(k);
                                openEditSlotModal(s);
                              }}
                              className={`absolute inset-x-1 overflow-hidden rounded-lg border px-2 py-1 text-left transition ${
                                isDragging ? "opacity-30" : ""
                              } ${
                                isBooked
                                  ? "border-blue-600 bg-blue-600 text-white shadow-xs"
                                  : past
                                    ? "border-gray-300 bg-gray-200 text-gray-600"
                                    : "cursor-grab border-[#064E3B] bg-[#064E3B] text-white shadow-xs active:cursor-grabbing"
                              }`}
                            >
                              <div className="text-[11px] font-bold leading-tight tabular-nums">
                                {fmt(s.start)} – {fmt(s.end)}
                              </div>
                              <div className="truncate text-[10px] opacity-90">
                                {isBooked
                                  ? `Sesi · ${s.clientLabel ?? "Klien"}`
                                  : "Tersedia"}
                              </div>
                            </div>
                          );
                        })}

                        {ghost && (
                          <div
                            style={{
                              top: yOf(ghost.start) + 1,
                              height: SESSION * PX - 2,
                            }}
                            className={`pointer-events-none absolute inset-x-1 rounded-lg border-2 border-dashed px-2 py-1 text-[11px] font-bold ${
                              ghostConflict
                                ? "border-red-500 bg-red-100/80 text-red-800"
                                : "border-[#064E3B] bg-emerald-50/90 text-[#064E3B]"
                            }`}
                          >
                            {fmt(ghost.start)} – {fmt(ghost.start + SESSION)}
                            <div className="text-[10px] font-normal">
                              {ghostConflict
                                ? "Bentrok jadwal"
                                : "Lepas untuk simpan"}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Legenda */}
                <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-gray-100 pt-3 text-xs text-gray-500">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-sm bg-[#064E3B]" /> Tersedia
                    (dapat diubah / dihapus)
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-sm bg-blue-600" /> Sesi
                    Terpesan / Terkonfirmasi
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-sm bg-gray-300" /> Sudah
                    Lewat
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ==================== PANEL KANAN (4 col) ==================== */}
          <div className="space-y-6 lg:col-span-4">
            {/* Kalender Bulanan Mini */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-bold text-gray-900">
                  {MONTHS[calMonth.getMonth()]} {calMonth.getFullYear()}
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    aria-label="Bulan sebelumnya"
                    onClick={() =>
                      setCalMonth(
                        new Date(
                          calMonth.getFullYear(),
                          calMonth.getMonth() - 1,
                          1,
                        ),
                      )
                    }
                    className="rounded-lg p-1.5 hover:bg-gray-100"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Bulan berikutnya"
                    onClick={() =>
                      setCalMonth(
                        new Date(
                          calMonth.getFullYear(),
                          calMonth.getMonth() + 1,
                          1,
                        ),
                      )
                    }
                    className="rounded-lg p-1.5 hover:bg-gray-100"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-gray-400">
                {["Sn", "Sl", "Rb", "Km", "Jm", "Sb", "Mg"].map((d) => (
                  <div key={d} className="py-1">
                    {d}
                  </div>
                ))}
              </div>

              <div className="mt-1 grid grid-cols-7 gap-1 text-center text-xs">
                {calCells.map((d, idx) => {
                  if (!d) return <div key={`empty-${idx}`} />;
                  const k = keyOf(d);
                  const isSel = k === selected;
                  const hasSlots = (slotsByDate[k]?.length ?? 0) > 0;
                  const past = isPast(k);
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => pickDate(k)}
                      className={`relative rounded-lg py-2 font-semibold transition ${
                        isSel
                          ? "bg-[#064E3B] text-white"
                          : past
                            ? "text-gray-300 hover:bg-gray-50"
                            : "text-gray-800 hover:bg-gray-100"
                      }`}
                    >
                      {d.getDate()}
                      {hasSlots && (
                        <span
                          className={`mx-auto mt-0.5 block h-1 w-1 rounded-full ${
                            isSel ? "bg-white" : "bg-[#064E3B]"
                          }`}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Daftar Slot pada Tanggal Terpilih */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold text-gray-900">
                    {dateLabel(selected)}
                  </h2>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {selectedPast
                      ? "Tanggal sudah lewat (hanya lihat)"
                      : activePeriodLabel
                        ? `Periode: ${activePeriodLabel}`
                        : `${selectedSlots.length} slot terdaftar`}
                  </p>
                </div>
                {!selectedPast && (
                  <button
                    type="button"
                    disabled={loading || mutating}
                    onClick={() => openNewSlotModal(selected)}
                    className="inline-flex items-center gap-1 rounded-xl bg-[#064E3B] px-3 py-2 text-xs font-semibold text-white hover:bg-[#053e2f] disabled:opacity-45"
                  >
                    <Plus className="h-3.5 w-3.5" /> Tambah
                  </button>
                )}
              </div>

              {loading ? (
                <SkeletonList bare rows={3} label="Memuat slot ketersediaan..." className="mt-4" />
              ) : selectedSlots.length === 0 ? (
                <div className="mt-4 rounded-xl border border-dashed border-gray-200 p-6 text-center text-xs text-gray-500">
                  Belum ada slot ketersediaan pada tanggal ini.
                </div>
              ) : (
                <ul className="mt-4 space-y-2.5">
                  {selectedSlots.map((s) => (
                    <li
                      key={s.id}
                      className="flex items-center justify-between gap-2 rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm"
                    >
                      <button
                        type="button"
                        onClick={() => openEditSlotModal(s)}
                        className="flex flex-1 items-center gap-2.5 text-left"
                      >
                        <span
                          className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                            s.isBooked ? "bg-blue-600" : "bg-[#064E3B]"
                          }`}
                        />
                        <div className="min-w-0">
                          <div className="font-bold tabular-nums text-gray-900">
                            {fmt(s.start)} – {fmt(s.end)}
                          </div>
                          <div className="truncate text-xs text-gray-500">
                            {s.isBooked
                              ? `Terpesan · ${s.clientLabel ?? "Klien"}`
                              : "Tersedia untuk dipesan klien"}
                          </div>
                        </div>
                      </button>

                      {!selectedPast && !s.isBooked && (
                        <button
                          type="button"
                          onClick={() => openEditSlotModal(s)}
                          className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                        >
                          <IconLabel icon={Pencil}>Ubah</IconLabel>
                        </button>
                      )}

                      {!selectedPast && s.isBooked && s.sessionId && (
                        <button
                          type="button"
                          onClick={() =>
                            setCancelSessionTarget({
                              sessionId: s.sessionId!,
                              clientLabel: s.clientLabel ?? "Klien",
                              dateKey: s.dateKey,
                              start: s.start,
                            })
                          }
                          className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                        >
                          <IconLabel icon={XCircle}>Batalkan Sesi</IconLabel>
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ==================== MODAL TAMBAH / UBAH SLOT ==================== */}
      {editor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0c2619]/45 p-4 backdrop-blur-[2px]"
          onClick={(e) => {
            if (e.target === e.currentTarget && !mutating) {
              setEditor(null);
            }
          }}
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {editor.mode === "new"
                    ? "Tambah Slot Ketersediaan"
                    : editor.isBooked
                      ? "Detail Slot Terpesan"
                      : "Ubah Slot Ketersediaan"}
                </h2>
                <p className="mt-1 text-xs text-gray-500">
                  {dateLabel(editor.dateKey)}
                </p>
              </div>
              <button
                type="button"
                disabled={mutating}
                onClick={() => setEditor(null)}
                aria-label="Tutup"
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {editor.isBooked && (
              <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3.5 text-xs text-blue-900">
                <p className="font-bold">Slot Terhubung dengan Booking Aktif</p>
                <p className="mt-1 leading-relaxed text-blue-800">
                  Pemohon: <strong>{editor.clientLabel ?? "Klien"}</strong> (Status:{" "}
                  <code>{editor.bookingStatus ?? "booked"}</code>). Slot yang sudah
                  dipesan tidak dapat dihapus langsung (`AVAILABILITY_BOOKED`).
                </p>
              </div>
            )}

            <div className="mt-4 space-y-4">
              <div>
                <label
                  htmlFor="slotStartTimeInput"
                  className="mb-1.5 block text-sm font-semibold text-gray-800"
                >
                  Jam Mulai (WITA)
                </label>
                <input
                  id="slotStartTimeInput"
                  type="text"
                  inputMode="numeric"
                  maxLength={5}
                  disabled={editor.isBooked || isPast(editor.dateKey) || mutating}
                  value={editorText}
                  onChange={(e) => {
                    setEditorText(e.target.value);
                    setEditorError(null);
                  }}
                  placeholder="Contoh: 09.00 atau 13.30"
                  className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-base font-semibold tabular-nums text-gray-900 outline-none focus:border-[#064E3B] focus:ring-4 focus:ring-[#064E3B]/15 disabled:bg-gray-100 disabled:text-gray-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Rentang jam operasional: 08.00 – 15.00 (durasi otomatis 60 menit).
                </p>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3 text-xs">
                <span className="text-gray-500">Jam Selesai Otomatis:</span>
                <span className="font-bold text-gray-900">
                  {(() => {
                    const p = parseTime(editorText);
                    return p !== null && p >= START && p <= LAST_START
                      ? `${fmt(p + SESSION)} WITA (1 jam)`
                      : "—";
                  })()}
                </span>
              </div>

              {editorError && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                  <span>{editorError}</span>
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
              <div>
                {editor.mode === "edit" &&
                  !editor.isBooked &&
                  !isPast(editor.dateKey) && (
                    <button
                      type="button"
                      disabled={mutating}
                      onClick={() => void handleDeleteSlot()}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Hapus Slot
                    </button>
                  )}

                {editor.isBooked && editor.sessionId && !isPast(editor.dateKey) && (
                  <button
                    type="button"
                    onClick={() => {
                      const sid = editor.sessionId!;
                      const lbl = editor.clientLabel ?? "Klien";
                      const dk = editor.dateKey;
                      const st = editor.initialStart;
                      setEditor(null);
                      setCancelSessionTarget({
                        sessionId: sid,
                        clientLabel: lbl,
                        dateKey: dk,
                        start: st,
                      });
                    }}
                    className="rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
                  >
                    <IconLabel icon={XCircle}>Batalkan Sesi</IconLabel>
                  </button>
                )}

                {editor.isBooked &&
                  editor.bookingStatus === "waiting_confirmation" && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditor(null);
                        navigate("/konselor/permintaan");
                      }}
                      className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100"
                    >
                      Kelola Permintaan →
                    </button>
                  )}
              </div>

              <div className="ml-auto flex gap-2">
                <button
                  type="button"
                  disabled={mutating}
                  onClick={() => setEditor(null)}
                  className="rounded-xl border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  <IconLabel icon={X}>{editor.isBooked || isPast(editor.dateKey) ? "Tutup" : "Batal"}</IconLabel>
                </button>
                {!editor.isBooked && !isPast(editor.dateKey) && (
                  <button
                    type="button"
                    disabled={mutating}
                    onClick={() => void handleSaveSlotModal()}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#064E3B] px-4 py-2 text-xs font-semibold text-white hover:bg-[#053e2f] disabled:opacity-50"
                  >
                    {mutating ? (
<Loader2 className="h-3.5 w-3.5 animate-spin" />
) : (
<Save className="h-3.5 w-3.5" />
)}
                    Simpan
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL KONFIRMASI BATALKAN SESI ==================== */}
      {cancelSessionTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0c2619]/45 p-4 backdrop-blur-[2px]"
          onClick={(e) => {
            if (e.target === e.currentTarget && !cancelSubmitting) {
              setCancelSessionTarget(null);
            }
          }}
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  Batalkan Sesi Konseling?
                </h2>
                <p className="mt-1 text-xs text-gray-500">
                  {cancelSessionTarget.clientLabel} ·{" "}
                  {dateLabel(cancelSessionTarget.dateKey)} (
                  {fmt(cancelSessionTarget.start)} –{" "}
                  {fmt(cancelSessionTarget.start + SESSION)})
                </p>
              </div>
              <button
                type="button"
                disabled={cancelSubmitting}
                onClick={() => setCancelSessionTarget(null)}
                aria-label="Tutup"
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs leading-relaxed text-amber-900">
              <div className="flex items-start gap-2">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                <span>
                  Pembatalan sesi melalui `PATCH /api/v1/sessions/:id/status` akan
                  menandai sesi dan booking sebagai <strong>cancelled</strong> dengan
                  keterangan sistem <em>"Sesi dibatalkan oleh konselor"</em>, serta
                  membuka kembali slot ketersediaan ini.
                </span>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                disabled={cancelSubmitting}
                onClick={() => setCancelSessionTarget(null)}
                className="rounded-xl border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Kembali
              </button>
              <button
                type="button"
                disabled={cancelSubmitting}
                onClick={() => void handleConfirmCancelSession()}
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {cancelSubmitting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <XCircle className="h-3.5 w-3.5" />
                )}
                Ya, Batalkan Sesi
              </button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
