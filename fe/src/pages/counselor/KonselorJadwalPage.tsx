import { PageContainer, PageHeader } from "../../components/shared";
import { useEffect, useState, type MouseEvent } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Lock, Plus } from "lucide-react";
import { CancelSessionDialog, SlotDialog } from "../../components/counselor/schedule/ScheduleDialogs";
import { createCounselorScheduleSeed } from "../../data/mock/counselorSchedule";
import type {
  Availability,
  CancelReason,
  CancelTarget,
  CancellationRecord,
  EditorState,
  Slot,
} from "../../types/counselorSchedule";
import {
  addDays,
  clamp,
  END,
  fmt,
  H,
  keyOf,
  LAST_START,
  MONTHS,
  pad,
  parseKey,
  PX,
  SESSION,
  SNAP,
  startOfDay,
  START,
  WEEKDAYS,
  yOf,
} from "../../features/counselor/schedule/scheduleUtils";

/* ========================= HALAMAN ========================= */

export default function KonselorJadwalPage() {
  const [today] = useState(() => startOfDay(new Date()));
  const todayKey = keyOf(today);
  const isPastKey = (k: string) => parseKey(k) < today;

  const [avail, setAvail] = useState<Availability>(() =>
    createCounselorScheduleSeed(today),
  );
  const [cancellations, setCancellations] = useState<CancellationRecord[]>([]);
  const [month, setMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [view, setView] = useState<"month" | "day">("month");
  const [dateKey, setDateKey] = useState<string>(todayKey);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [cancelTarget, setCancelTarget] = useState<CancelTarget | null>(null);
  const [toastMsg, setToastMsg] = useState("");

  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(""), 2500);
    return () => clearTimeout(t);
  }, [toastMsg]);

  /* ----- Logika ----- */
  const slotsOn = (k: string) =>
    (avail[k] ?? []).slice().sort((a, b) => a.start - b.start);

  // Dua sesi bentrok jika rentang 1 jam saling tumpang tindih
  const conflictAt = (k: string, start: number, ignore: number | null) =>
    slotsOn(k).find(
      (s) =>
        s.start !== ignore &&
        start < s.start + SESSION &&
        s.start < start + SESSION,
    ) ?? null;

  const firstFree = (k: string) => {
    for (let m = START; m <= LAST_START; m += SNAP) {
      if (!conflictAt(k, m, null)) return m;
    }
    return null;
  };

  const saveSlots = (k: string, list: Slot[]) => {
    setAvail((prev) => {
      const next = { ...prev };
      const sorted = list.slice().sort((a, b) => a.start - b.start);
      if (sorted.length) next[k] = sorted;
      else delete next[k];
      return next;
    });
  };

  /* ----- Aksi ----- */
  const handleSave = (start: number) => {
    if (!editor) return;
    // TODO API: POST (baru) / PUT (ubah) /api/konselor/me/ketersediaan
    const list = slotsOn(editor.date).filter((s) => s.start !== editor.orig);
    list.push({ start, status: "tersedia" });
    saveSlots(editor.date, list);
    setToastMsg(
      editor.mode === "new"
        ? `Jadwal ${fmt(start)} – ${fmt(start + SESSION)} ditambahkan.`
        : `Jadwal diubah menjadi ${fmt(start)} – ${fmt(start + SESSION)}.`,
    );
    setEditor(null);
  };

  // Hanya untuk jadwal yang belum dibooking
  const handleDelete = () => {
    if (!editor) return;
    // TODO API: DELETE /api/konselor/me/ketersediaan/{id}
    saveSlots(
      editor.date,
      slotsOn(editor.date).filter((s) => s.start !== editor.orig),
    );
    setEditor(null);
    setToastMsg("Jadwal dihapus.");
  };

  // Pembatalan sesi yang sudah di-ACC. Alasan dicatat, jam kembali tersedia.
  const handleConfirmCancel = (reason: CancelReason) => {
    if (!cancelTarget) return;
    // TODO API: PUT /api/konselor/me/sesi/{id}/batal (body: alasan + penjelasan, kirim notifikasi ke klien)
    const list = slotsOn(cancelTarget.date).map((s) =>
      s.start === cancelTarget.start
        ? { start: s.start, status: "tersedia" as const }
        : s,
    );
    saveSlots(cancelTarget.date, list);
    setCancellations((prev) => [
      ...prev,
      {
        ...reason,
        date: cancelTarget.date,
        start: cancelTarget.start,
        client: cancelTarget.client ?? "Klien",
        cancelledAt: new Date().toISOString(),
      },
    ]);
    setCancelTarget(null);
    setEditor(null);
    setToastMsg("Sesi dibatalkan. Alasan tercatat dan jam kembali tersedia.");
  };

  const openNew = (k: string, start: number) =>
    setEditor({
      mode: "new",
      date: k,
      orig: null,
      initialStart: start,
      status: "tersedia",
    });

  const openSlot = (k: string, slot: Slot) =>
    setEditor({
      mode: "edit",
      date: k,
      orig: slot.start,
      initialStart: slot.start,
      status: slot.status,
      client: slot.client,
    });

  // Klik area kosong di kolom hari → jadwal baru di jam yang dibulatkan
  const handleColumnClick = (e: MouseEvent<HTMLDivElement>) => {
    if (isPastKey(dateKey)) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const raw = START + (e.clientY - rect.top) / PX;
    const snapped = clamp(Math.round(raw / SNAP) * SNAP, START, LAST_START);
    const start = conflictAt(dateKey, snapped, null)
      ? firstFree(dateKey)
      : snapped;
    if (start === null)
      return setToastMsg("Tidak ada jam kosong di tanggal ini.");
    openNew(dateKey, start);
  };

  const openDay = (k: string) => {
    setDateKey(k);
    setView("day");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /* ----- Tampilan bulan ----- */
  const renderMonth = () => {
    const offset = (month.getDay() + 6) % 7; // Senin = 0
    const first = new Date(month.getFullYear(), month.getMonth(), 1 - offset);
    const cells = Array.from({ length: 42 }, (_, i) => addDays(first, i));

    return (
      <>
        <PageHeader
          title="Jadwal Ketersediaan"
          description="Klik tanggal untuk mengatur jam konseling pada hari itu."
          actions={
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Bulan sebelumnya"
                onClick={() =>
                  setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
                }
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-300 bg-white hover:bg-gray-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="w-44 text-center text-base font-bold text-text-base">
                {MONTHS[month.getMonth()]} {month.getFullYear()}
              </span>
              <button
                type="button"
                aria-label="Bulan berikutnya"
                onClick={() =>
                  setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
                }
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-300 bg-white hover:bg-gray-50"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() =>
                  setMonth(new Date(today.getFullYear(), today.getMonth(), 1))
                }
                className="ml-2 rounded-xl border border-primary px-4 py-2 text-sm font-semibold text-primary hover:bg-secondary"
              >
                Hari ini
              </button>
            </div>
          }
        />

        <div className="mt-6 overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="min-w-[680px]">
            <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
              {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((w) => (
                <div
                  key={w}
                  className="py-3 text-center text-xs font-bold uppercase tracking-wider text-gray-500"
                >
                  {w}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-px bg-gray-200">
              {cells.map((d) => {
                const k = keyOf(d);
                const list = slotsOn(k);
                const inMonth = d.getMonth() === month.getMonth();
                const isToday = k === todayKey;
                const past = isPastKey(k);
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => openDay(k)}
                    className={`flex h-28 flex-col gap-1 overflow-hidden bg-white p-2 text-left transition ${
                      inMonth ? "" : "bg-gray-50"
                    } ${past ? "" : "hover:bg-secondary/40"}`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold ${
                          isToday
                            ? "bg-primary text-white"
                            : inMonth
                              ? past
                                ? "text-gray-400"
                                : "text-text-base"
                              : "text-gray-300"
                        }`}
                      >
                        {d.getDate()}
                      </span>
                      {list.length > 0 && (
                        <span
                          className={`text-[11px] font-bold ${past ? "text-gray-400" : "text-primary"}`}
                        >
                          {list.length} jam
                        </span>
                      )}
                    </div>
                    {list.slice(0, 2).map((s) => (
                      <span
                        key={s.start}
                        className={`truncate rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${
                          s.status === "sesi"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-secondary text-primary"
                        } ${past ? "opacity-55" : ""}`}
                      >
                        {fmt(s.start)}
                      </span>
                    ))}
                    {list.length > 2 && (
                      <span className="text-[11px] font-semibold text-gray-500">
                        +{list.length - 2} lagi
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-5 text-xs text-text-muted">
          <span className="inline-flex items-center gap-2">
            <i className="inline-block h-3 w-3 rounded border border-primary-light/40 bg-secondary" />
            Tersedia
          </span>
          <span className="inline-flex items-center gap-2">
            <i className="inline-block h-3 w-3 rounded border border-blue-400 bg-blue-100" />
            Sesi (sudah di-ACC)
          </span>
          <span className="inline-flex items-center gap-2">
            <i className="inline-block h-3 w-3 rounded border border-gray-300 bg-gray-100" />
            Sudah lewat (hanya lihat)
          </span>
        </div>
      </>
    );
  };

  /* ----- Tampilan hari ----- */
  const renderDay = () => {
    const d = parseKey(dateKey);
    const past = isPastKey(dateKey);
    const list = slotsOn(dateKey);
    const nSesi = list.filter((s) => s.status === "sesi").length;
    const nTersedia = list.length - nSesi;

    const hourMarks: number[] = [];
    for (let m = START; m <= END; m += 60) hourMarks.push(m);

    return (
      <>
        <button
          type="button"
          onClick={() => {
            setView("month");
            setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
          }}
          className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Kembali ke kalender
        </button>

        <PageHeader
          className="mt-4"
          eyebrow={WEEKDAYS[d.getDay()]}
          title={`${pad(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`}
          description={
            list.length
              ? `${nTersedia} jam tersedia · ${nSesi} sesi`
              : "Belum ada jam tersedia"
          }
          actions={
            <button
              type="button"
              disabled={past}
              onClick={() => {
                const start = firstFree(dateKey);
                if (start === null)
                  return setToastMsg("Tidak ada jam kosong di tanggal ini.");
                openNew(dateKey, start);
              }}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus className="h-4 w-4" /> Tambah jadwal
            </button>
          }
        />

        {past && (
          <p className="mt-4 flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-100 px-4 py-3 text-sm text-text-muted">
            <Lock className="h-4 w-4" /> Tanggal ini sudah lewat, jadwal hanya
            bisa dilihat.
          </p>
        )}

        {cancellations.some((c) => c.date === dateKey) && (
          <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Pembatalan pada tanggal ini
            </p>
            <ul className="mt-2 space-y-2">
              {cancellations
                .filter((c) => c.date === dateKey)
                .map((c) => (
                  <li key={c.cancelledAt} className="text-sm text-text-base">
                    <span className="font-semibold">
                      {fmt(c.start)} – {fmt(c.start + SESSION)}
                    </span>{" "}
                    · {c.client} ·{" "}
                    <span className="text-red-700">{c.label}</span>
                  </li>
                ))}
            </ul>
          </div>
        )}

        <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-gray-50 px-4 py-3">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Jam ketersediaan
            </span>
            <div className="flex items-center gap-4 text-xs font-semibold text-gray-500">
              <span className="inline-flex items-center gap-1.5">
                <i className="inline-block h-3 w-3 rounded border border-primary-light/40 bg-secondary" />
                Tersedia
              </span>
              <span className="inline-flex items-center gap-1.5">
                <i className="inline-block h-3 w-3 rounded border border-blue-400 bg-blue-100" />
                Sesi
              </span>
              <span>08.00 – 16.00 WITA</span>
            </div>
          </div>

          <div className="grid grid-cols-[72px_minmax(0,1fr)]">
            {/* Label jam */}
            <div
              className="relative border-r border-gray-200 bg-white"
              style={{ height: H }}
            >
              {hourMarks.map((m) => (
                <div
                  key={m}
                  className="absolute right-3 -translate-y-1/2 text-[11px] font-semibold leading-none text-gray-400"
                  style={{ top: yOf(m) }}
                >
                  {fmt(m)}
                </div>
              ))}
            </div>

            {/* Kolom jadwal */}
            <div
              onClick={handleColumnClick}
              className={`relative bg-white ${past ? "cursor-default" : "cursor-cell"}`}
              style={{
                height: H,
                backgroundImage:
                  "repeating-linear-gradient(to bottom, #e5e7eb 0 1px, transparent 1px 72px)",
              }}
            >
              {list.map((s) => {
                const isSesi = s.status === "sesi";
                return (
                  <button
                    key={s.start}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isSesi && past)
                        return setToastMsg(
                          "Tanggal sudah lewat, jadwal hanya bisa dilihat.",
                        );
                      openSlot(dateKey, s);
                    }}
                    className={`absolute left-2 right-2 overflow-hidden rounded-xl border px-3 py-2 text-left transition hover:-translate-y-px hover:shadow-md ${
                      isSesi
                        ? "border-blue-400 bg-blue-50 text-blue-900"
                        : "border-primary-light/40 bg-[#f0fdfa] text-text-base"
                    } ${past ? "opacity-60" : ""}`}
                    style={{ top: yOf(s.start) + 1, height: SESSION * PX - 2 }}
                  >
                    <p className="text-sm font-bold">
                      {fmt(s.start)} – {fmt(s.start + SESSION)}
                    </p>
                    <p
                      className={`mt-0.5 truncate text-[11px] font-semibold ${
                        isSesi ? "text-blue-700" : "text-primary-light"
                      }`}
                    >
                      {isSesi ? `Sesi · ${s.client ?? "Klien"}` : "Tersedia"}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <p className="mt-3 text-xs text-text-muted">
          Klik area kosong untuk menambah jadwal. Jadwal yang sudah di-ACC
          (biru) tidak bisa dihapus, hanya bisa dibatalkan.
        </p>
      </>
    );
  };

  return (
    <PageContainer role="counselor" spacing="none" className="pb-10">
      {view === "month" ? renderMonth() : renderDay()}

      {/* Popup tambah / ubah / detail sesi */}
      {editor && (
        <SlotDialog
          key={`${editor.date}-${editor.orig ?? "new"}-${editor.initialStart}`}
          editor={editor}
          past={isPastKey(editor.date)}
          findConflict={(start) => conflictAt(editor.date, start, editor.orig)}
          onSave={handleSave}
          onDelete={handleDelete}
          onCancelSession={() =>
            setCancelTarget({
              date: editor.date,
              start: editor.initialStart,
              client: editor.client,
            })
          }
          onClose={() => setEditor(null)}
        />
      )}

      {/* Modal batal sesi (sama dengan halaman Aktivitas Saya) */}
      {cancelTarget && (
        <CancelSessionDialog
          target={cancelTarget}
          onClose={() => setCancelTarget(null)}
          onConfirm={handleConfirmCancel}
        />
      )}

      {/* Toast */}
      <div
        role="status"
        aria-live="polite"
        className={`pointer-events-none fixed bottom-6 left-1/2 z-[70] -translate-x-1/2 rounded-xl bg-gray-900 px-4 py-3 text-sm text-white shadow-lg transition duration-300 ${
          toastMsg ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
        }`}
      >
        {toastMsg}
      </div>
    </PageContainer>
  );
}
