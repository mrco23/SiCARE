import IconLabel from "../../components/shared/IconLabel";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  PageContainer,
  PageHeader,
  SkeletonTable,
  useToast,
} from "../../components/shared";
import { adminApi } from "../../lib/adminApi";
import {
  fmtDate,
  mapAcademicPeriodDto,
  periodStatus,
  sortPeriods,
  toISO,
  type AcademicPeriod,
  type PeriodStatus,
  type Semester,
} from "../../lib/academicPeriods";
import {
  differenceInCalendarDaysISO,
  formatIndonesianDate,
  parseLocalISODate,
} from "../../lib/dateUtils";
import {
  Calendar,
  CalendarX2,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  RefreshCw,
  SquarePen,
  TriangleAlert,
  X,
  Save,
} from "lucide-react";

/* ========================= TIPE & DATA ========================= */
type ManagedPeriod = AcademicPeriod & { isPublished: boolean };
type PeriodDraft = {
  ta: string;
  sem: Semester;
  start: string;
  end: string;
  isPublished: boolean;
};

/* ========================= HELPER TANGGAL ========================= */
const fmtLong = (iso: string) =>
  formatIndonesianDate(parseLocalISODate(iso), {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

const STATUS_STYLE: Record<PeriodStatus, string> = {
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
  list: ManagedPeriod[],
  today: string,
): PeriodDraft & { label: string } {
  const s = sortPeriods(list);
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
  return {
    ta,
    sem,
    label: `${ta} ${sem}`,
    isPublished: true,
    ...defaultsFor(ta, sem),
  };
}

/* ========================= KOMPONEN ========================= */
const inputClass =
  "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-accent/30";

export default function AdminPeriodePage() {
  const today = useMemo(() => toISO(new Date()), []);
  const [periods, setPeriods] = useState<ManagedPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Modal tambah / ubah
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PeriodDraft>({
    ta: "",
    sem: "Ganjil",
    start: "",
    end: "",
    isPublished: true,
  });
  const [datesTouched, setDatesTouched] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [togglingPublishId, setTogglingPublishId] = useState<string | null>(null);

  const toast = useToast();

  const fetchPeriods = useCallback(async () => {
    const dtos = await adminApi.listAcademicPeriods();
    return dtos.map(mapAcademicPeriodDto);
  }, []);

  useEffect(() => {
    let active = true;
    void fetchPeriods()
      .then((items) => {
        if (!active) return;
        setPeriods(items);
        setLoadError(null);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setLoadError(
          err instanceof Error
            ? err.message
            : "Daftar periode akademik tidak dapat dimuat.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fetchPeriods]);

  const handleRefresh = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const items = await fetchPeriods();
      setPeriods(items);
    } catch (err) {
      setLoadError(
        err instanceof Error
          ? err.message
          : "Daftar periode akademik tidak dapat dimuat.",
      );
    } finally {
      setLoading(false);
    }
  };

  // Tutup modal dengan tombol Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) {
        setModalOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [submitting]);


  /* ===== DATA TURUNAN ===== */
  const active = periods.find((p) => today >= p.start && today <= p.end);
  const suggestion = useMemo(
    () => suggestNext(periods, today),
    [periods, today],
  );

  const gaps = useMemo(() => {
    const s = sortPeriods(periods);
    const out: string[] = [];
    for (let i = 1; i < s.length; i++) {
      const g = differenceInCalendarDaysISO(s[i - 1].end, s[i].start) - 1;
      if (g > 0) {
        out.push(
          `Jeda ${g} hari antara ${s[i - 1].label} (${fmtDate(s[i - 1].end)}) dan ${s[i].label} (${fmtDate(s[i].start)}).`,
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
    if (draft.ta && !opts.includes(draft.ta)) opts.push(draft.ta);
    return opts.sort();
  }, [today, draft.ta]);

  /* ===== MODAL TAMBAH / UBAH ===== */
  const openModal = (
    p: ManagedPeriod | null = null,
    preset: PeriodDraft | null = null,
  ) => {
    const src = p ?? preset ?? suggestion;
    setEditingId(p ? p.id : null);
    setDraft({
      ta: src.ta,
      sem: src.sem,
      start: src.start,
      end: src.end,
      isPublished: "isPublished" in src ? src.isPublished : true,
    });
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
    const taTrimmed = d.ta.trim();
    if (taTrimmed.length < 4 || taTrimmed.length > 20) {
      return "Tahun ajaran wajib antara 4 hingga 20 karakter.";
    }
    if (!d.start || !d.end) return "Tanggal mulai dan selesai wajib diisi.";
    if (d.end < d.start) return "Tanggal selesai harus sama atau setelah tanggal mulai.";
    const others = periods.filter((p) => p.id !== editingId);
    if (others.some((p) => p.ta === taTrimmed && p.sem === d.sem)) {
      return `Periode ${taTrimmed} ${d.sem} sudah terdaftar.`;
    }
    const clash = others.find((p) => p.start <= d.end && d.start <= p.end);
    if (clash) {
      return `Rentang tanggal bertabrakan dengan periode akademik yang sudah ada (${clash.label}: ${fmtDate(clash.start)} sampai ${fmtDate(clash.end)}).`;
    }
    return "";
  };

  const handleSave = async () => {
    const err = validate(draft);
    if (err) {
      setError(err);
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const payload = {
        academic_year: draft.ta.trim(),
        semester: draft.sem,
        starts_on: draft.start,
        ends_on: draft.end,
        is_published: draft.isPublished,
      };
      if (editingId) {
        const updated = await adminApi.updateAcademicPeriod(editingId, payload);
        const mapped = mapAcademicPeriodDto(updated);
        setPeriods((prev) => prev.map((p) => (p.id === editingId ? mapped : p)));
        setModalOpen(false);
        toast.success(`Periode ${mapped.label} diperbarui.`);
      } else {
        const created = await adminApi.createAcademicPeriod(payload);
        const mapped = mapAcademicPeriodDto(created);
        setPeriods((prev) => [...prev, mapped]);
        setModalOpen(false);
        toast.success(`Periode ${mapped.label} ditambahkan.`);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Periode akademik tidak dapat disimpan.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleTogglePublished = async (period: ManagedPeriod) => {
    setTogglingPublishId(period.id);
    try {
      const updated = await adminApi.updateAcademicPeriod(period.id, {
        is_published: !period.isPublished,
      });
      const mapped = mapAcademicPeriodDto(updated);
      setPeriods((prev) => prev.map((p) => (p.id === period.id ? mapped : p)));
      toast.success(
        mapped.isPublished
          ? `Periode ${mapped.label} dipublikasikan.`
          : `Periode ${mapped.label} disembunyikan dari publikasi.`,
      );
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Status publikasi periode tidak dapat diubah.",
      );
    } finally {
      setTogglingPublishId(null);
    }
  };

  /* ========================= RENDER ========================= */
  return (
    <PageContainer role="admin">
      <PageHeader
        title="Periode Akademik"
        actions={
          <button
            type="button"
            onClick={() => void handleRefresh()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Muat ulang
          </button>
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

      {/* ================= PERIODE AKADEMIK ================= */}
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-100 p-6 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-base font-bold">Periode Akademik</h3>
            <p className="mt-1 max-w-xl text-xs text-slate-400">
              SiCARE terpisah dari sistem kampus, jadi tahun ajaran dan semester
              diatur di sini. Laporan, slot konselor, dan monitoring memakai periode
              ini untuk mengelompokkan sesi berdasarkan tanggalnya.
            </p>
          </div>
          <button
            type="button"
            onClick={() => openModal()}
            disabled={loading}
            className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-dark disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> Tambah Periode
          </button>
        </div>

        {/* Status periode hari ini */}
        {!loading && (
          <div className="px-6 pt-6">
            {active ? (
              (() => {
                const total = differenceInCalendarDaysISO(active.start, active.end) + 1;
                const day = differenceInCalendarDaysISO(active.start, today) + 1;
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
                  <IconLabel icon={Plus}>Tambah {suggestion.label}</IconLabel>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Peringatan jeda */}
        {!loading && gaps.length > 0 && (
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
        {loading ? (
          <SkeletonTable bare rows={4} columns={5} label="Memuat periode akademik dari server..." className="mt-6 border-t border-slate-100" />
        ) : rows.length > 0 ? (
          <div className="mt-6 overflow-x-auto border-t border-slate-100">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-6 py-3">Tahun Ajaran</th>
                  <th className="px-6 py-3">Semester</th>
                  <th className="px-6 py-3">Mulai</th>
                  <th className="px-6 py-3">Selesai</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Publikasi</th>
                  <th className="px-6 py-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((p) => {
                  const st = periodStatus(p, today);
                  const isToggling = togglingPublishId === p.id;
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
                        {fmtDate(p.start)}
                      </td>
                      <td className="px-6 py-4 text-xs font-medium text-slate-600">
                        {fmtDate(p.end)}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${STATUS_STYLE[st]}`}
                        >
                          {st}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          type="button"
                          disabled={isToggling}
                          onClick={() => void handleTogglePublished(p)}
                          title={
                            p.isPublished
                              ? "Dipublikasikan — klik untuk menyembunyikan"
                              : "Disembunyikan — klik untuk mempublikasikan"
                          }
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold transition ${
                            p.isPublished
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              : "border-slate-200 bg-slate-100 text-slate-500 hover:bg-slate-200"
                          } disabled:opacity-50`}
                        >
                          {p.isPublished ? (
                            <>
                              <Eye className="h-3 w-3" /> Dipublikasikan
                            </>
                          ) : (
                            <>
                              <EyeOff className="h-3 w-3" /> Draft
                            </>
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center">
                          <button
                            type="button"
                            title="Ubah"
                            onClick={() => openModal(p)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-primary"
                          >
                            <SquarePen className="h-4 w-4" />
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
            Periode aktif ditentukan otomatis dari tanggal hari ini. Periode yang
            masih memiliki slot ketersediaan konselor tidak dapat dihapus demi
            menjaga integritas jadwal.
          </p>
        </div>
      </section>

      {/* ================= MODAL TAMBAH / UBAH ================= */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !submitting) setModalOpen(false);
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
                    disabled={submitting}
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
                    disabled={submitting}
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
                    disabled={submitting}
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
                    disabled={submitting}
                    onChange={(e) => {
                      setDatesTouched(true);
                      setDraft({ ...draft, end: e.target.value });
                    }}
                    className={inputClass}
                  />
                </div>
              </div>

              <label className="flex items-center gap-2.5 pt-1 text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={draft.isPublished}
                  disabled={submitting}
                  onChange={(e) =>
                    setDraft({ ...draft, isPublished: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                />
                Publikasikan periode ini untuk konselor dan klien
              </label>

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
                disabled={submitting}
                onClick={() => setModalOpen(false)}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
              >
                <IconLabel icon={X}>Batal</IconLabel>
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleSave()}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
              >
                {submitting ? (
<Loader2 className="h-4 w-4 animate-spin" />
) : (
<Save className="h-4 w-4" />
)}
                {submitting ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}

    </PageContainer>
  );
}
