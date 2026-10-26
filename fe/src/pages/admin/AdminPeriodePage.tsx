import { useEffect, useMemo, useRef, useState } from "react";
import { PageContainer, PageHeader } from "../../components/shared";
import {
  Calendar,
  CalendarX2,
  Plus,
  SquarePen,
  Trash2,
  TriangleAlert,
} from "lucide-react";

/* ========================= TIPE & DATA ========================= */
type Semester = "Ganjil" | "Genap";

type AcademicPeriod = {
  id: string;
  ta: string; // "2025/2026"
  sem: Semester;
  label: string;
  start: string; // ISO yyyy-mm-dd
  end: string; // ISO yyyy-mm-dd
};

type PeriodDraft = { ta: string; sem: Semester; start: string; end: string };
type Status = "Aktif" | "Mendatang" | "Selesai";

/* ===== DATA CONTOH =====
   Ganti dengan backend, mis. GET/POST/PUT/DELETE /api/admin/periode.
   Pada prototipe ini data disimpan di localStorage ("sicare.periods") supaya halaman
   Laporan & Ekspor bisa membaca periode yang sama. Di produksi, simpan di database. */
const STORE_KEY = "sicare.periods";

const mk = (
  ta: string,
  sem: Semester,
  start: string,
  end: string,
): AcademicPeriod => ({
  id: `${ta.replace("/", "-")}-${sem.toLowerCase()}`,
  ta,
  sem,
  label: `${ta} ${sem}`,
  start,
  end,
});

const DEFAULT_PERIODS: AcademicPeriod[] = [
  mk("2024/2025", "Ganjil", "2024-08-19", "2025-01-31"),
  mk("2024/2025", "Genap", "2025-02-01", "2025-07-31"),
  mk("2025/2026", "Ganjil", "2025-08-18", "2026-01-31"),
  mk("2025/2026", "Genap", "2026-02-01", "2026-07-31"),
];

function loadPeriods(): AcademicPeriod[] {
  try {
    const a = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
    if (Array.isArray(a)) return a;
  } catch {
    /* abaikan */
  }
  return DEFAULT_PERIODS.map((p) => ({ ...p }));
}

function savePeriods(list: AcademicPeriod[]) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(list));
  } catch {
    /* abaikan */
  }
}

/* ========================= HELPER TANGGAL ========================= */
const pad = (n: number) => String(n).padStart(2, "0");
const toISO = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const utc = (iso: string) =>
  Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
const diffDays = (a: string, b: string) =>
  Math.round((utc(b) - utc(a)) / 864e5); // b - a

const fmt = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
const fmtLong = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

const sortedAsc = (list: AcademicPeriod[]) =>
  [...list].sort((a, b) => a.start.localeCompare(b.start));

const statusOf = (p: AcademicPeriod, today: string): Status =>
  today < p.start ? "Mendatang" : today > p.end ? "Selesai" : "Aktif";

const STATUS_STYLE: Record<Status, string> = {
  Aktif: "bg-primary-subtle text-primary border-emerald-100",
  Mendatang: "bg-sky-50 text-sky-700 border-sky-100",
  Selesai: "bg-slate-100 text-slate-500 border-slate-200",
};

/* ===== DEFAULT TANGGAL & SARAN PERIODE BERIKUTNYA ===== */
function defaultsFor(ta: string, sem: Semester) {
  const [y1, y2] = ta.split("/").map(Number);
  return sem === "Ganjil"
    ? { start: `${y1}-08-17`, end: `${y2}-01-31` }
    : { start: `${y2}-02-01`, end: `${y2}-07-31` };
}

function suggestNext(
  list: AcademicPeriod[],
  today: string,
): PeriodDraft & { label: string } {
  const s = sortedAsc(list);
  const last = s[s.length - 1];
  let ta: string;
  let sem: Semester;

  if (last) {
    if (last.sem === "Ganjil") {
      ta = last.ta;
      sem = "Genap";
    } else {
      const [, y2] = last.ta.split("/").map(Number);
      ta = `${y2}/${y2 + 1}`;
      sem = "Ganjil";
    }
  } else {
    const y = +today.slice(0, 4);
    const m = +today.slice(5, 7);
    if (m >= 8) {
      ta = `${y}/${y + 1}`;
      sem = "Ganjil";
    } else if (m === 1) {
      ta = `${y - 1}/${y}`;
      sem = "Ganjil";
    } else {
      ta = `${y - 1}/${y}`;
      sem = "Genap";
    }
  }
  return { ta, sem, label: `${ta} ${sem}`, ...defaultsFor(ta, sem) };
}

/* ========================= KOMPONEN ========================= */
const inputClass =
  "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-accent/30";

export default function AdminPeriodePage() {
  const today = useMemo(() => toISO(new Date()), []);
  const [periods, setPeriods] = useState<AcademicPeriod[]>(loadPeriods);

  // Modal tambah / ubah
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PeriodDraft>({
    ta: "",
    sem: "Ganjil",
    start: "",
    end: "",
  });
  const [datesTouched, setDatesTouched] = useState(false);
  const [error, setError] = useState("");

  // Modal hapus
  const [deleting, setDeleting] = useState<AcademicPeriod | null>(null);

  // Toast
  const [toastMsg, setToastMsg] = useState("");
  const [toastShow, setToastShow] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Simpan ke localStorage setiap data berubah
  useEffect(() => {
    savePeriods(periods);
  }, [periods]);

  // Tutup modal dengan tombol Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setModalOpen(false);
        setDeleting(null);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const toast = (msg: string) => {
    setToastMsg(msg);
    setToastShow(true);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastShow(false), 2600);
  };

  /* ===== DATA TURUNAN ===== */
  const active = periods.find((p) => today >= p.start && today <= p.end);
  const suggestion = useMemo(
    () => suggestNext(periods, today),
    [periods, today],
  );

  const gaps = useMemo(() => {
    const s = sortedAsc(periods);
    const out: string[] = [];
    for (let i = 1; i < s.length; i++) {
      const g = diffDays(s[i - 1].end, s[i].start) - 1;
      if (g > 0) {
        out.push(
          `Jeda ${g} hari antara ${s[i - 1].label} (${fmt(s[i - 1].end)}) dan ${s[i].label} (${fmt(s[i].start)}).`,
        );
      }
    }
    return out;
  }, [periods]);

  const rows = useMemo(
    () => [...periods].sort((a, b) => b.start.localeCompare(a.start)), // terbaru di atas
    [periods],
  );

  const yearOptions = useMemo(() => {
    const y = +today.slice(0, 4);
    const opts = Array.from(
      { length: 8 },
      (_, i) => `${y - 4 + i}/${y - 3 + i}`,
    );
    // pastikan tahun ajaran yang sedang diedit / disarankan selalu tersedia
    if (draft.ta && !opts.includes(draft.ta)) opts.push(draft.ta);
    return opts.sort();
  }, [today, draft.ta]);

  /* ===== MODAL TAMBAH / UBAH ===== */
  const openModal = (
    p: AcademicPeriod | null = null,
    preset: PeriodDraft | null = null,
  ) => {
    const src = p ?? preset ?? suggestion;
    setEditingId(p ? p.id : null);
    setDraft({ ta: src.ta, sem: src.sem, start: src.start, end: src.end });
    setDatesTouched(!!p);
    setError("");
    setModalOpen(true);
  };

  const changeTaOrSem = (next: Partial<Pick<PeriodDraft, "ta" | "sem">>) => {
    setDraft((d) => {
      const merged = { ...d, ...next };
      if (datesTouched) return merged;
      const def = defaultsFor(merged.ta, merged.sem);
      return { ...merged, start: def.start, end: def.end };
    });
  };

  const validate = (d: PeriodDraft): string => {
    if (!d.start || !d.end) return "Tanggal mulai dan selesai wajib diisi.";
    if (d.end <= d.start) return "Tanggal selesai harus setelah tanggal mulai.";
    const id = mk(d.ta, d.sem, d.start, d.end).id;
    const others = periods.filter((p) => p.id !== editingId);
    if (others.some((p) => p.id === id))
      return `Periode ${d.ta} ${d.sem} sudah terdaftar.`;
    const clash = others.find((p) => p.start <= d.end && d.start <= p.end);
    if (clash)
      return `Tanggal bertabrakan dengan ${clash.label} (${fmt(clash.start)} sampai ${fmt(clash.end)}). Periode tidak boleh tumpang tindih.`;
    return "";
  };

  const handleSave = () => {
    const err = validate(draft);
    if (err) {
      setError(err);
      return;
    }
    const item = mk(draft.ta, draft.sem, draft.start, draft.end);
    setPeriods((prev) =>
      editingId
        ? prev.map((p) => (p.id === editingId ? item : p))
        : [...prev, item],
    );
    setModalOpen(false);
    toast(
      editingId
        ? `Periode ${item.label} diperbarui.`
        : `Periode ${item.label} ditambahkan.`,
    );
  };

  /* ===== HAPUS & RESET ===== */
  const confirmDelete = () => {
    if (!deleting) return;
    setPeriods((prev) => prev.filter((p) => p.id !== deleting.id));
    toast(`Periode ${deleting.label} dihapus.`);
    setDeleting(null);
  };

  const resetSample = () => {
    setPeriods(DEFAULT_PERIODS.map((p) => ({ ...p })));
    toast("Data contoh dikembalikan.");
  };

  /* ========================= RENDER ========================= */
  return (
    <PageContainer role="admin">
      <PageHeader title="Periode Akademik" />

      {/* ================= PERIODE AKADEMIK ================= */}
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-100 p-6 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-base font-bold">Periode Akademik</h3>
            <p className="mt-1 max-w-xl text-xs text-slate-400">
              SiCARE terpisah dari sistem kampus, jadi tahun ajaran dan semester
              diatur di sini. Laporan dan monitoring memakai periode ini untuk
              mengelompokkan sesi berdasarkan tanggalnya.
            </p>
          </div>
          <button
            type="button"
            onClick={() => openModal()}
            className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-dark"
          >
            <Plus className="h-4 w-4" /> Tambah Periode
          </button>
        </div>

        {/* Status periode hari ini */}
        <div className="px-6 pt-6">
          {active ? (
            (() => {
              const total = diffDays(active.start, active.end) + 1;
              const day = diffDays(active.start, today) + 1;
              const pct = Math.min(100, Math.round((day / total) * 100));
              return (
                <div className="rounded-2xl border border-emerald-200 bg-primary-subtle p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-primary">
                        Periode aktif hari ini
                      </p>
                      <p className="mt-0.5 text-xl font-bold">{active.label}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {fmtLong(active.start)} sampai {fmtLong(active.end)}
                      </p>
                    </div>
                    <p className="text-xs font-semibold text-slate-500">
                      Hari ke-{day} dari {total}
                    </p>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full border border-emerald-100 bg-white">
                    <div
                      className="h-full rounded-full bg-brand-accent"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })()
          ) : (
            <div className="flex flex-col justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:flex-row sm:items-center">
              <div className="flex gap-3">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div>
                  <p className="text-sm font-bold text-amber-900">
                    Hari ini ({fmtLong(today)}) tidak berada di periode akademik
                    mana pun.
                  </p>
                  <p className="mt-0.5 text-xs text-amber-800">
                    Sesi baru pada tanggal ini tidak akan terhitung di laporan
                    per periode. Tambahkan periode berikutnya.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => openModal(null, suggestion)}
                className="shrink-0 rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700"
              >
                Tambah {suggestion.label}
              </button>
            </div>
          )}
        </div>

        {/* Peringatan jeda */}
        {gaps.length > 0 && (
          <div className="px-6 pt-4">
            <div className="space-y-1 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
              <p className="flex items-center gap-1.5 font-bold text-slate-700">
                <CalendarX2 className="h-3.5 w-3.5" />
                Tanggal di luar periode
              </p>
              {gaps.map((g) => (
                <p key={g}>
                  {g} Sesi pada rentang ini tidak dihitung ke periode mana pun.
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Tabel */}
        {rows.length > 0 ? (
          <div className="mt-6 overflow-x-auto border-t border-slate-100">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-6 py-3">Tahun Ajaran</th>
                  <th className="px-6 py-3">Semester</th>
                  <th className="px-6 py-3">Mulai</th>
                  <th className="px-6 py-3">Selesai</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((p) => {
                  const st = statusOf(p, today);
                  return (
                    <tr
                      key={p.id}
                      className="transition-colors hover:bg-slate-50/60"
                    >
                      <td className="px-6 py-4 font-semibold">{p.ta}</td>
                      <td className="px-6 py-4 font-medium text-slate-600">
                        {p.sem}
                      </td>
                      <td className="px-6 py-4 text-xs font-medium text-slate-600">
                        {fmt(p.start)}
                      </td>
                      <td className="px-6 py-4 text-xs font-medium text-slate-600">
                        {fmt(p.end)}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${STATUS_STYLE[st]}`}
                        >
                          {st}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            title="Ubah"
                            onClick={() => openModal(p)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-primary"
                          >
                            <SquarePen className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            title="Hapus"
                            onClick={() => setDeleting(p)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-6 border-t border-slate-100 py-14 text-center text-slate-400">
            <Calendar className="mx-auto mb-2 h-8 w-8" />
            <p className="text-sm font-medium">Belum ada periode akademik.</p>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-6 py-4">
          <p className="text-[11px] text-slate-400">
            Periode aktif ditentukan otomatis dari tanggal hari ini. Sesi
            dihitung ke periode lewat tanggalnya, jadi mengubah tanggal periode
            ikut mengubah laporan lama.
          </p>
          <button
            type="button"
            onClick={resetSample}
            className="text-[11px] font-semibold text-slate-400 underline underline-offset-2 hover:text-slate-600"
          >
            Atur ulang ke data contoh
          </button>
        </div>
      </section>

      {/* ================= MODAL TAMBAH / UBAH ================= */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-bold">
              {editingId ? "Ubah Periode" : "Tambah Periode"}
            </h3>

            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600">
                    Tahun ajaran
                  </label>
                  <select
                    value={draft.ta}
                    onChange={(e) => changeTaOrSem({ ta: e.target.value })}
                    className={inputClass}
                  >
                    {yearOptions.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">
                    Semester
                  </label>
                  <select
                    value={draft.sem}
                    onChange={(e) =>
                      changeTaOrSem({ sem: e.target.value as Semester })
                    }
                    className={inputClass}
                  >
                    <option value="Ganjil">Ganjil</option>
                    <option value="Genap">Genap</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600">
                    Tanggal mulai
                  </label>
                  <input
                    type="date"
                    value={draft.start}
                    onChange={(e) => {
                      setDatesTouched(true);
                      setDraft({ ...draft, start: e.target.value });
                    }}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">
                    Tanggal selesai
                  </label>
                  <input
                    type="date"
                    value={draft.end}
                    onChange={(e) => {
                      setDatesTouched(true);
                      setDraft({ ...draft, end: e.target.value });
                    }}
                    className={inputClass}
                  />
                </div>
              </div>

              <p className="text-[11px] text-slate-400">
                Tanggal terisi otomatis sesuai semester dan dapat diubah.
                Tanggal selesai termasuk dalam periode.
              </p>

              {error && (
                <p className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-600">
                  {error}
                </p>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL KONFIRMASI HAPUS ================= */}
      {deleting && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeleting(null);
          }}
        >
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold">
              Hapus periode {deleting.label}?
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              Sesi yang tanggalnya berada di periode ini tidak akan masuk ke
              periode mana pun sampai ada periode baru yang mencakup tanggal
              tersebut. Data sesi sendiri tidak dihapus.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleting(null)}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                Ya, hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= TOAST ================= */}
      <div
        className={`pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-lg transition duration-300 ${
          toastShow ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
        }`}
      >
        {toastMsg}
      </div>
    </PageContainer>
  );
}
