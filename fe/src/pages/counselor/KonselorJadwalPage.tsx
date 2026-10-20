import { useEffect, useState, type MouseEvent } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Lock,
  Plus,
  X,
} from "lucide-react";

/* ========================= TIPE ========================= */

type SlotStatus = "tersedia" | "sesi";
type Slot = { start: number; status: SlotStatus; client?: string };
type Availability = Record<string, Slot[]>; // key: "YYYY-MM-DD"

type EditorState = {
  mode: "new" | "edit";
  date: string;
  orig: number | null; // jam awal sebelum diubah (null untuk jadwal baru)
  initialStart: number;
  status: SlotStatus;
  client?: string;
};

type CancelTarget = { date: string; start: number; client?: string };

type CancelReason = { code: string; label: string; note: string };

type CancellationRecord = CancelReason & {
  date: string;
  start: number;
  client: string;
  cancelledAt: string; // ISO
};

/* ========================= KONSTANTA ========================= */

// Sama dengan daftar alasan di halaman Aktivitas Saya
const CANCEL_REASONS = [
  { code: "KLIEN_SAKIT", label: "Klien sakit" },
  { code: "KONSELOR_BERHALANGAN", label: "Konselor berhalangan" },
  { code: "KLIEN_TIDAK_HADIR", label: "Klien tidak hadir tanpa kabar" },
  { code: "JADWAL_BENTROK", label: "Jadwal bentrok" },
  { code: "LAINNYA", label: "Lainnya" },
];

const START = 8 * 60; // 08.00
const END = 16 * 60; // 16.00
const SESSION = 60; // durasi tetap 1 jam
const LAST_START = END - SESSION; // 15.00
const SNAP = 15; // langkah jam mulai
const PX = 1.2; // 1 menit = 1.2px (1 jam = 72px)
const H = (END - START) * PX;

const MONTHS = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];
const WEEKDAYS = [
  "Minggu",
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
];

/* ========================= HELPER ========================= */

const pad = (n: number) => String(n).padStart(2, "0");
const fmt = (m: number) => `${pad(Math.floor(m / 60))}.${pad(m % 60)}`; // 13.45
const yOf = (m: number) => (m - START) * PX;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const startOfDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const keyOf = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseKey = (k: string) => {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const dateLabel = (k: string) => {
  const d = parseKey(k);
  return `${WEEKDAYS[d.getDay()]}, ${pad(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};

// Menerima "13.45" atau "13:45". Mengembalikan menit sejak 00.00, atau null jika format salah.
function parseTime(text: string): number | null {
  const m = /^(\d{1,2})[.:](\d{2})$/.exec(text.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h > 23 || mi > 59) return null;
  return h * 60 + mi;
}

// Data contoh. Di produksi, ganti dengan data dari API.
function sampleAvailability(today: Date): Availability {
  const o: Availability = {};
  const put = (offset: number, slots: Slot[]) => {
    o[keyOf(addDays(today, offset))] = slots;
  };
  const t = (start: number): Slot => ({ start, status: "tersedia" });
  const s = (start: number, client: string): Slot => ({
    start,
    status: "sesi",
    client,
  });
  put(-3, [s(9 * 60, "Klien Anonim #B7C1"), t(10 * 60)]);
  put(-1, [t(13 * 60)]);
  put(1, [t(8 * 60), s(10 * 60, "Klien Anonim #A3F2"), t(13 * 60)]);
  put(2, [t(9 * 60)]);
  put(4, [t(8 * 60), s(9 * 60, "Klien Anonim #4D9E"), t(12 * 60)]);
  put(5, [s(13 * 60 + 30, "Klien Anonim #7F12")]);
  put(7, [t(10 * 60), t(11 * 60)]);
  put(9, [t(8 * 60)]);
  put(12, [s(9 * 60, "Klien Anonim #C0DE"), t(13 * 60)]);
  put(14, [t(10 * 60)]);
  return o;
}

/* ========================= HALAMAN ========================= */

export default function KonselorJadwalPage() {
  const [today] = useState(() => startOfDay(new Date()));
  const todayKey = keyOf(today);
  const isPastKey = (k: string) => parseKey(k) < today;

  const [avail, setAvail] = useState<Availability>(() =>
    sampleAvailability(today),
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-text-base sm:text-3xl">
              Jadwal Ketersediaan
            </h1>
            <p className="mt-1 text-sm text-text-muted">
              Klik tanggal untuk mengatur jam konseling pada hari itu.
            </p>
          </div>
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
        </div>

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

        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-primary">
              {WEEKDAYS[d.getDay()]}
            </p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-text-base sm:text-3xl">
              {pad(d.getDate())} {MONTHS[d.getMonth()]} {d.getFullYear()}
            </h1>
            <p className="mt-1 text-sm text-text-muted">
              {list.length
                ? `${nTersedia} jam tersedia · ${nSesi} sesi`
                : "Belum ada jam tersedia"}
            </p>
          </div>
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
        </div>

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
    <div className="mx-auto w-full max-w-6xl pb-10">
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
    </div>
  );
}

/* ========================= MODAL BATAL SESI ========================= */

function CancelSessionDialog({
  target,
  onClose,
  onConfirm,
}: {
  target: CancelTarget;
  onClose: () => void;
  onConfirm: (reason: CancelReason) => void;
}) {
  const [reason, setReason] = useState("");
  const [other, setOther] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const otherValid = reason !== "LAINNYA" || other.trim().length >= 3;
  const valid = Boolean(reason) && otherValid && note.trim().length >= 10;

  const submit = () => {
    const picked = CANCEL_REASONS.find((r) => r.code === reason);
    if (!picked || !valid) return;
    onConfirm({
      code: picked.code,
      label: reason === "LAINNYA" ? `Lainnya: ${other.trim()}` : picked.label,
      note: note.trim(),
    });
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[#0c2619]/40 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="border-b border-gray-200 p-6 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-text-base">
                Batalkan sesi
              </h2>
              <p className="mt-1 text-sm text-text-muted">
                Sesi {fmt(target.start)} – {fmt(target.start + SESSION)} dengan{" "}
                {target.client ?? "Klien"}. Alasan akan tercatat di laporan.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup"
              className="rounded-lg p-1 text-gray-500 hover:bg-gray-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="space-y-5 overflow-y-auto p-6">
          <fieldset>
            <legend className="text-sm font-semibold text-gray-800">
              Alasan pembatalan <span className="text-red-600">*</span>
            </legend>
            <div className="mt-2 space-y-2">
              {CANCEL_REASONS.map((r) => (
                <label
                  key={r.code}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 p-3.5 transition hover:border-red-300 has-[:checked]:border-red-500 has-[:checked]:bg-red-50/60"
                >
                  <input
                    type="radio"
                    name="cancelReason"
                    value={r.code}
                    checked={reason === r.code}
                    onChange={() => setReason(r.code)}
                    className="h-4 w-4 accent-red-600"
                  />
                  <span className="text-sm font-medium text-gray-800">
                    {r.label}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {reason === "LAINNYA" && (
            <div>
              <label
                htmlFor="cancelOther"
                className="text-sm font-semibold text-gray-800"
              >
                Sebutkan alasan lainnya <span className="text-red-600">*</span>
              </label>
              <input
                id="cancelOther"
                type="text"
                maxLength={80}
                value={other}
                onChange={(e) => setOther(e.target.value)}
                placeholder="Misalnya: ruangan rusak mendadak"
                className="mt-1.5 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/15"
              />
              {other.trim().length > 0 && other.trim().length < 3 && (
                <p className="mt-1 text-xs text-red-600">Minimal 3 karakter.</p>
              )}
            </div>
          )}

          <div>
            <label
              htmlFor="cancelNote"
              className="text-sm font-semibold text-gray-800"
            >
              Penjelasan tambahan <span className="text-red-600">*</span>
            </label>
            <textarea
              id="cancelNote"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Jelaskan kondisi secara singkat (minimal 10 karakter)"
              className="mt-1.5 w-full rounded-xl border border-gray-300 p-3 text-sm outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/15"
            />
            <p className="mt-1 text-xs text-gray-400">
              {note.trim().length}/10 karakter minimum. Catatan ini hanya dapat
              dilihat konselor.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-200 p-6 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Kembali
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!valid}
            className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Ya, batalkan sesi
          </button>
        </div>
      </div>
    </div>
  );
}

/* ========================= POPUP TAMBAH / UBAH / DETAIL ========================= */

function SlotDialog({
  editor,
  past,
  findConflict,
  onSave,
  onDelete,
  onCancelSession,
  onClose,
}: {
  editor: EditorState;
  past: boolean;
  findConflict: (start: number) => Slot | null;
  onSave: (start: number) => void;
  onDelete: () => void;
  onCancelSession: () => void;
  onClose: () => void;
}) {
  const isSesi = editor.status === "sesi";
  const readonly = isSesi || past;
  const [text, setText] = useState(fmt(editor.initialStart));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const parsed = parseTime(text);
  let error = "";
  if (!readonly && text.trim() !== "") {
    if (parsed === null) error = "Format jam tidak valid. Contoh: 13.45";
    else if (parsed < START || parsed > LAST_START)
      error =
        "Jam mulai harus antara 08.00 dan 15.00, supaya sesi 1 jam selesai sebelum 16.00.";
    else {
      const c = findConflict(parsed);
      if (c)
        error = `Bentrok dengan jadwal ${fmt(c.start)} – ${fmt(c.start + SESSION)}.`;
    }
  }
  const canSave = !readonly && parsed !== null && error === "";
  const endText =
    parsed !== null && !error ? `${fmt(parsed + SESSION)} (1 jam)` : "—";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-text-base">
              {editor.mode === "new"
                ? "Tambah jadwal"
                : isSesi
                  ? "Detail sesi"
                  : "Ubah jadwal"}
            </h2>
            <p className="mt-1 text-sm text-text-muted">
              {dateLabel(editor.date)}
            </p>
          </div>
          <button
            type="button"
            aria-label="Tutup"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {isSesi && (
          <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            <p className="font-bold">Sesi sudah di-ACC</p>
            <p className="mt-1 text-xs text-blue-800">
              {editor.client ?? "Klien"}.{" "}
              {past
                ? "Sesi sudah lewat."
                : "Jadwal tidak bisa dihapus atau dipindah. Gunakan Batalkan sesi bila perlu."}
            </p>
          </div>
        )}

        <div className="mt-5 space-y-4">
          <div>
            <label
              htmlFor="startTime"
              className="mb-1.5 block text-sm font-semibold text-text-base"
            >
              Jam mulai
            </label>
            <input
              id="startTime"
              type="text"
              inputMode="numeric"
              maxLength={5}
              autoComplete="off"
              placeholder="contoh: 13.45"
              value={text}
              disabled={readonly}
              autoFocus={!readonly}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" &&
                canSave &&
                parsed !== null &&
                onSave(parsed)
              }
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-base font-semibold tabular-nums text-text-base outline-none focus:ring-4 focus:ring-secondary disabled:bg-gray-100 disabled:text-gray-500"
            />
            <p className="mt-1.5 text-xs text-text-muted">
              {readonly
                ? "Jam sesi tidak dapat diubah."
                : "Ketik langsung jamnya. Rentang 08.00 – 15.00."}
            </p>
          </div>

          <div className="rounded-xl bg-gray-50 px-4 py-3 text-sm">
            <span className="text-text-muted">Selesai otomatis:</span>
            <span className="ml-1 font-bold text-text-base">
              {readonly
                ? `${fmt(editor.initialStart + SESSION)} (1 jam)`
                : endText}
            </span>
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {error}
            </p>
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            {editor.mode === "edit" && !isSesi && !past && (
              <button
                type="button"
                onClick={onDelete}
                className="rounded-xl px-3 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50"
              >
                Hapus
              </button>
            )}
            {isSesi && !past && (
              <button
                type="button"
                onClick={onCancelSession}
                className="rounded-xl border border-red-300 px-3 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50"
              >
                Batalkan sesi
              </button>
            )}
          </div>
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-text-base hover:bg-gray-50"
            >
              {readonly ? "Tutup" : "Batal"}
            </button>
            {!readonly && (
              <button
                type="button"
                disabled={!canSave}
                onClick={() => parsed !== null && onSave(parsed)}
                className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-40"
              >
                Simpan
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
