import { useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

const DAYS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"];
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
const HOURS = Array.from({ length: 12 }, (_, i) => i + 8); // jam mulai 08.00 – 19.00

type Exception = { date: string; type: "off" | "extra"; time: string }; // time "HH:00"

const pad = (n: number) => String(n).padStart(2, "0");
const fmt = (h: number) => `${pad(h)}.00`;
const range = (h: number) => `${fmt(h)}–${fmt(h + 1)}`;
const ymd = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d: Date, n: number) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const dayIndex = (d: Date) => (d.getDay() + 6) % 7; // Senin = 0

function startOfToday() {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t;
}

export default function JadwalPage() {
  const todayStr = ymd(startOfToday());

  const [active, setActive] = useState(true);
  const [rules, setRules] = useState<Record<number, number[]>>({});
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selDay, setSelDay] = useState<number | null>(null);
  const [mobileTab, setMobileTab] = useState<"rutin" | "kalender">("rutin");
  const [toastMsg, setToastMsg] = useState("");
  const [pending, setPending] = useState<{
    action: string;
    date: Date;
    hour: number;
  } | null>(null);
  const [confirmToggle, setConfirmToggle] = useState<"on" | "off" | null>(null);

  const sessions = (i: number) =>
    (rules[i] || []).slice().sort((a, b) => a - b);

  const toast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3000);
  };

  // ================= RUTIN =================
  const toggleDay = (i: number, on: boolean) => {
    setRules((prev) => {
      const next = { ...prev };
      if (on) next[i] = [9];
      else delete next[i];
      return next;
    });
    toast(
      on
        ? `${DAYS[i]} aktif dengan sesi 09.00–10.00.`
        : `${DAYS[i]} dinonaktifkan.`,
    );
  };

  const toggleHour = (i: number, h: number) => {
    const arr = sessions(i);
    const has = arr.includes(h);
    const nextArr = has ? arr.filter((x) => x !== h) : [...arr, h];
    setRules((prev) => {
      const next = { ...prev };
      if (nextArr.length) next[i] = nextArr.sort((a, b) => a - b);
      else delete next[i];
      return next;
    });
    toast(`${DAYS[i]} ${range(h)} ${has ? "dihapus" : "ditambahkan"}.`);
  };

  const copyMonday = () => {
    const base = sessions(0);
    if (!base.length)
      return toast("Aktifkan dan atur Senin dulu, lalu salin polanya.");
    setRules((prev) => {
      const next = { ...prev };
      for (let i = 1; i < 5; i++) next[i] = [...base];
      return next;
    });
    toast("Pola Senin disalin ke Selasa–Jumat.");
  };

  const totalSessions = Object.values(rules).reduce((s, a) => s + a.length, 0);
  const activeDays = Object.keys(rules).length;

  // ================= KALENDER =================
  const weekDates = useMemo(() => {
    const t = startOfToday();
    const mon = addDays(t, -dayIndex(t) + weekOffset * 7);
    return Array.from({ length: 5 }, (_, i) => addDays(mon, i));
  }, [weekOffset]);

  const statusOf = (date: Date, hour: number) => {
    const ds = ymd(date);
    const time = `${pad(hour)}:00`;
    if (!active) return "nonaktif";
    if (
      exceptions.some(
        (e) => e.date === ds && e.type === "extra" && e.time === time,
      )
    )
      return "khusus";
    if (sessions(dayIndex(date)).includes(hour)) {
      return exceptions.some(
        (e) => e.date === ds && e.type === "off" && e.time === time,
      )
        ? "off"
        : "rutin";
    }
    return "empty";
  };

  const openAction = (date: Date, hour: number) => {
    const st = statusOf(date, hour);
    const map: Record<
      string,
      { act: string; t: string; msg: string; btn: string }
    > = {
      empty: {
        act: "add-extra",
        t: "Tambah jadwal khusus?",
        msg: "Sesi ini hanya berlaku untuk tanggal ini.",
        btn: "Tambahkan",
      },
      rutin: {
        act: "off",
        t: "Tidak bisa hadir di tanggal ini?",
        msg: "Sesi rutin tetap berlaku minggu lain. Hanya tanggal ini yang dinonaktifkan.",
        btn: "Liburkan sesi ini",
      },
      off: {
        act: "restore",
        t: "Aktifkan kembali sesi ini?",
        msg: "Sesi rutin akan tersedia lagi pada tanggal ini.",
        btn: "Aktifkan",
      },
      khusus: {
        act: "remove-extra",
        t: "Hapus jadwal khusus?",
        msg: "Jadwal khusus untuk tanggal ini akan dihapus.",
        btn: "Hapus",
      },
    };
    const m = map[st];
    if (!m) return;
    setPending({ action: m.act, date, hour });
  };

  const applyPending = () => {
    if (!pending) return;
    const { action, date, hour } = pending;
    const ds = ymd(date);
    const time = `${pad(hour)}:00`;
    const label = `${DAYS[dayIndex(date)]} ${date.getDate()} ${MONTHS[date.getMonth()]}`;

    if (action === "add-extra") {
      setExceptions((p) => [...p, { date: ds, type: "extra", time }]);
      toast(`Jadwal khusus ${label} ${range(hour)} ditambahkan.`);
    } else if (action === "off") {
      setExceptions((p) => [...p, { date: ds, type: "off", time }]);
      toast(`${label} ${range(hour)} diliburkan.`);
    } else if (action === "restore") {
      setExceptions((p) =>
        p.filter(
          (e) => !(e.date === ds && e.type === "off" && e.time === time),
        ),
      );
      toast(`${label} ${range(hour)} kembali tersedia.`);
    } else if (action === "remove-extra") {
      setExceptions((p) =>
        p.filter(
          (e) => !(e.date === ds && e.type === "extra" && e.time === time),
        ),
      );
      toast(`Jadwal khusus ${label} ${range(hour)} dihapus.`);
    }
    setPending(null);
  };

  const cellClass: Record<string, string> = {
    empty:
      "border border-dashed border-gray-300 bg-white text-gray-400 hover:border-[#36c08f] hover:bg-[#f7fcf9] hover:text-[#1e5b3a]",
    rutin: "border border-[#36c08f] bg-[#e8f9f0] text-[#1e5b3a]",
    off: "border border-dashed border-gray-400 text-gray-400 line-through bg-[repeating-linear-gradient(45deg,#fff,#fff_6px,#eef0f3_6px,#eef0f3_12px)]",
    khusus: "border border-blue-300 bg-blue-50 text-blue-700",
    nonaktif: "cursor-not-allowed border-0 bg-gray-100 text-gray-400",
  };
  const cellLabel: Record<string, string> = {
    empty: "+",
    rutin: "Tersedia",
    off: "Libur",
    khusus: "Khusus",
    nonaktif: "Nonaktif",
  };

  const weekLabel = `${weekDates[0].getDate()} ${MONTHS[weekDates[0].getMonth()]} – ${weekDates[4].getDate()} ${MONTHS[weekDates[4].getMonth()]} ${weekDates[4].getFullYear()}`;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      {/* ================= HEADER ================= */}
      <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
        Jadwal &amp; Ketersediaan Konselor
      </h1>
      <p className="mt-1 text-sm text-gray-500 sm:text-base">
        Atur jadwal rutin Senin–Jumat, lalu tandai libur atau jadwal khusus
        untuk tanggal tertentu.
      </p>

      {/* ================= TAB MOBILE ================= */}
      <div className="mt-6 inline-flex max-w-full rounded-2xl border border-gray-200 bg-white p-1">
        <TabButton
          active={mobileTab === "rutin"}
          onClick={() => setMobileTab("rutin")}
        >
          Jadwal Rutin
        </TabButton>
        <TabButton
          active={mobileTab === "kalender"}
          onClick={() => setMobileTab("kalender")}
        >
          Kalender Minggu Ini
        </TabButton>
      </div>

      {/* ================= STATUS ================= */}
      <div
        className={`mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-5 ${active ? "border-[#36c08f] bg-[#f7fcf9]" : "border-gray-300 bg-gray-100"}`}
      >
        <div className="flex items-center gap-3">
          <span
            className={`h-3 w-3 rounded-full ${active ? "bg-[#36c08f] ring-4 ring-[#36c08f]/20" : "bg-gray-400 ring-4 ring-gray-300/40"}`}
          />
          <div>
            <p className="font-bold">
              {active ? "Jadwal konseling aktif" : "Jadwal konseling nonaktif"}
            </p>
            <p className="text-sm text-gray-600">
              {active
                ? "Mahasiswa dapat melihat dan booking sesi sesuai pola rutin dan jadwal khusus."
                : "Mahasiswa tidak dapat booking. Pola rutin tetap tersimpan dan aktif kembali saat dinyalakan."}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={active}
            onClick={() => setConfirmToggle("on")}
            className="rounded-xl bg-[#1e5b3a] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#174a2f] disabled:opacity-40"
          >
            Aktifkan Jadwal
          </button>
          <button
            type="button"
            disabled={!active}
            onClick={() => setConfirmToggle("off")}
            className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40"
          >
            Nonaktifkan Jadwal
          </button>
        </div>
      </div>

      {/* ================= STATISTIK ================= */}
      <div className="mt-4 flex flex-wrap gap-3">
        <Stat label="hari aktif" value={activeDays} />
        <Stat label="sesi per minggu" value={totalSessions} />
      </div>

      {/* ================= JADWAL RUTIN ================= */}
      <section className={mobileTab === "rutin" ? "mt-6 block" : "hidden"}>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
          <div
            className={`grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5 transition-opacity ${active ? "" : "opacity-50"}`}
          >
            {DAYS.map((name, i) => {
              const arr = sessions(i);
              const on = arr.length > 0;
              return (
                <div
                  key={name}
                  className={`flex flex-col gap-3.5 rounded-2xl border-[1.5px] bg-white p-4 transition ${on ? "border-[#36c08f] shadow-[0_6px_18px_rgba(54,192,143,0.12)]" : "border-gray-200"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-base font-bold">{name}</p>
                      <p
                        className={`text-sm ${on ? "text-gray-600" : "text-gray-400"}`}
                      >
                        {on ? `${arr.length} sesi` : "Tidak aktif"}
                      </p>
                    </div>
                    <label className="relative inline-block h-6 w-[42px] shrink-0 cursor-pointer">
                      <input
                        type="checkbox"
                        className="peer sr-only"
                        checked={on}
                        onChange={(e) => toggleDay(i, e.target.checked)}
                      />
                      <span className="absolute inset-0 rounded-full bg-gray-300 transition peer-checked:bg-[#1e5b3a] after:absolute after:left-[3px] after:top-[3px] after:h-[18px] after:w-[18px] after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-[18px]" />
                    </label>
                  </div>

                  <div className="flex h-2 gap-[3px]">
                    {HOURS.map((h) => (
                      <span
                        key={h}
                        className={`flex-1 rounded-sm ${arr.includes(h) ? "bg-[#36c08f]" : "bg-gray-100"}`}
                      />
                    ))}
                  </div>

                  <div className="grid grid-cols-4 gap-1.5">
                    {HOURS.map((h) => {
                      const sel = arr.includes(h);
                      return (
                        <button
                          key={h}
                          type="button"
                          onClick={() => toggleHour(i, h)}
                          className={`rounded-lg border py-2 text-xs font-semibold transition ${
                            sel
                              ? "border-[#1e5b3a] bg-[#1e5b3a] text-white"
                              : "border-gray-300 bg-white text-gray-600 hover:border-[#36c08f] hover:text-[#1e5b3a]"
                          } ${on ? "" : "opacity-55"}`}
                        >
                          {pad(h)}.00
                        </button>
                      );
                    })}
                  </div>

                  <p
                    className={`mt-auto min-h-[36px] text-sm font-semibold leading-snug ${on ? "text-[#1e5b3a]" : "font-medium text-gray-400"}`}
                  >
                    {on
                      ? `${arr.map((h) => range(h)).join(", ")} WITA`
                      : "Tidak tersedia. Pilih jam untuk membuka hari ini."}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={copyMonday}
              className="rounded-xl border-[1.5px] border-[#1e5b3a] bg-white px-4 py-2.5 text-sm font-semibold text-[#1e5b3a] hover:bg-[#e8f9f0]"
            >
              Salin pola Senin ke Selasa–Jumat
            </button>
          </div>
          <p className="mt-4 text-sm text-gray-500">
            Klik jam untuk membuka atau menutup sesi. Setiap sesi berdurasi 1
            jam. Pola berlaku setiap minggu untuk tanggal mendatang. Zona waktu
            WITA.
          </p>
        </div>
      </section>

      {/* ================= KALENDER ================= */}
      <section className={mobileTab === "kalender" ? "mt-6 block" : "hidden"}>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setWeekOffset((w) => w - 1)}
                aria-label="Minggu sebelumnya"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-300 hover:bg-gray-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="min-w-0 flex-1 px-2 text-center text-sm font-bold sm:min-w-[230px] sm:text-base">
                {weekLabel}
              </div>
              <button
                type="button"
                onClick={() => setWeekOffset((w) => w + 1)}
                aria-label="Minggu berikutnya"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-300 hover:bg-gray-50"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => setWeekOffset(0)}
              className="rounded-xl border-[1.5px] border-[#1e5b3a] px-4 py-2 text-sm font-semibold text-[#1e5b3a] hover:bg-[#e8f9f0]"
            >
              Minggu ini
            </button>
          </div>

          {/* Legenda */}
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-gray-600 sm:text-sm">
            <Legend
              swatch="bg-[#e8f9f0] border border-[#36c08f]"
              label="Tersedia (rutin)"
            />
            <Legend
              swatch="bg-[repeating-linear-gradient(45deg,#fff,#fff_4px,#e5e7eb_4px,#e5e7eb_8px)] border border-gray-400"
              label="Libur tanggal ini"
            />
            <Legend
              swatch="bg-blue-50 border border-blue-300"
              label="Jadwal khusus"
            />
            <Legend
              swatch="bg-white border border-dashed border-gray-300"
              label="Kosong"
            />
            <Legend swatch="bg-gray-100" label="Nonaktif" />
          </div>

          {/* Desktop: grid */}
          <div className="mt-5 hidden overflow-x-auto md:block">
            <div className="grid min-w-[640px] grid-cols-[56px_repeat(5,minmax(0,1fr))] gap-1.5">
              <div />
              {weekDates.map((d, i) => {
                const isToday = ymd(d) === todayStr;
                return (
                  <div
                    key={i}
                    className={`py-1.5 text-center text-xs font-semibold sm:text-sm ${isToday ? "text-[#1e5b3a]" : "text-gray-600"}`}
                  >
                    {DAYS[i].slice(0, 3)}
                    <span className="block text-lg font-bold text-gray-900">
                      {d.getDate()}
                    </span>
                  </div>
                );
              })}
              {HOURS.map((h) => (
                <FragmentRow key={h} hour={h}>
                  {weekDates.map((d) => {
                    const st = statusOf(d, h);
                    const isPast = ymd(d) < todayStr;
                    const locked = isPast || st === "nonaktif";
                    return (
                      <button
                        key={ymd(d) + h}
                        type="button"
                        disabled={locked}
                        onClick={() => openAction(d, h)}
                        className={`relative h-12 rounded-lg text-xs font-semibold transition ${
                          isPast ? "bg-gray-100 text-gray-300" : cellClass[st]
                        } disabled:cursor-not-allowed`}
                        title={range(h)}
                      >
                        {isPast ? "" : cellLabel[st]}
                      </button>
                    );
                  })}
                </FragmentRow>
              ))}
            </div>
          </div>

          {/* Mobile: pilih hari lalu daftar jam */}
          <div className="mt-5 md:hidden">
            <div className="grid grid-cols-5 gap-1.5">
              {weekDates.map((d, i) => {
                const isSel =
                  (selDay ??
                    (dayIndex(startOfToday()) <= 4
                      ? dayIndex(startOfToday())
                      : 0)) === i;
                const isToday = ymd(d) === todayStr;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSelDay(i)}
                    className={`flex flex-col items-center rounded-xl border py-2 ${
                      isSel
                        ? "border-[#1e5b3a] bg-[#1e5b3a] text-white"
                        : "border-gray-300 bg-white"
                    } ${isToday && !isSel ? "border-[#36c08f]" : ""}`}
                  >
                    <span className="text-[11px] font-semibold opacity-80">
                      {DAYS[i].slice(0, 3)}
                    </span>
                    <span className="text-base font-bold">{d.getDate()}</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex flex-col gap-2">
              {HOURS.map((h) => {
                const idx =
                  selDay ??
                  (dayIndex(startOfToday()) <= 4
                    ? dayIndex(startOfToday())
                    : 0);
                const d = weekDates[idx];
                const st = statusOf(d, h);
                const isPast = ymd(d) < todayStr;
                const locked = isPast || st === "nonaktif";
                return (
                  <button
                    key={h}
                    type="button"
                    disabled={locked}
                    onClick={() => openAction(d, h)}
                    className={`flex min-h-[56px] items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left text-sm ${
                      isPast ? "bg-gray-100 text-gray-300" : cellClass[st]
                    } disabled:cursor-not-allowed`}
                  >
                    <span className="font-bold">{range(h)}</span>
                    <span className="text-xs font-semibold">
                      {isPast
                        ? "Sudah lewat"
                        : cellLabel[st] === "+"
                          ? "Kosong · tap untuk tambah"
                          : cellLabel[st]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <p className="mt-4 text-sm text-gray-500">
            Klik sel hijau untuk tidak bisa hadir di tanggal ini. Klik sel
            kosong untuk menambah jadwal khusus. Klik sel libur atau khusus
            untuk membatalkannya.
          </p>
        </div>
      </section>

      {/* ================= MODAL AKSI SEL ================= */}
      {pending && (
        <Modal
          title={pendingTitle(pending.action)}
          body={`${DAYS[dayIndex(pending.date)]}, ${pending.date.getDate()} ${MONTHS[pending.date.getMonth()]} ${pending.date.getFullYear()} · ${range(pending.hour)} WITA`}
          confirmLabel={pendingButton(pending.action)}
          danger={pending.action === "off" || pending.action === "remove-extra"}
          onCancel={() => setPending(null)}
          onConfirm={applyPending}
        />
      )}

      {/* ================= MODAL TOGGLE ================= */}
      {confirmToggle && (
        <Modal
          title={
            confirmToggle === "on"
              ? "Aktifkan jadwal ketersediaan?"
              : "Nonaktifkan jadwal ketersediaan?"
          }
          body={
            confirmToggle === "on"
              ? "Mahasiswa akan kembali bisa melihat dan booking sesi sesuai pola rutin Anda."
              : "Mahasiswa tidak bisa booking sesi apa pun sampai jadwal diaktifkan kembali. Pola rutin Anda tidak akan dihapus."
          }
          confirmLabel={
            confirmToggle === "on" ? "Ya, aktifkan" : "Ya, nonaktifkan"
          }
          danger={confirmToggle === "off"}
          onCancel={() => setConfirmToggle(null)}
          onConfirm={() => {
            setActive(confirmToggle === "on");
            setConfirmToggle(null);
            toast(
              confirmToggle === "on"
                ? "Jadwal diaktifkan."
                : "Jadwal dinonaktifkan.",
            );
          }}
        />
      )}

      {/* ================= TOAST ================= */}
      <div
        className={`pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-gray-900 px-4 py-3 text-sm text-white shadow-lg transition duration-300 ${
          toastMsg ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
        }`}
      >
        {toastMsg}
      </div>
    </div>
  );
}

/* ================= SUB-KOMPONEN ================= */

function pendingTitle(action: string) {
  return (
    (
      {
        "add-extra": "Tambah jadwal khusus?",
        off: "Tidak bisa hadir di tanggal ini?",
        restore: "Aktifkan kembali sesi ini?",
        "remove-extra": "Hapus jadwal khusus?",
      } as Record<string, string>
    )[action] ?? ""
  );
}

function pendingButton(action: string) {
  return (
    (
      {
        "add-extra": "Tambahkan",
        off: "Liburkan sesi ini",
        restore: "Aktifkan",
        "remove-extra": "Hapus",
      } as Record<string, string>
    )[action] ?? "Simpan"
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
        active ? "bg-[#1e5b3a] text-white" : "text-gray-600 hover:bg-gray-50"
      }`}
    >
      {children}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-[120px] rounded-2xl border border-gray-200 bg-white px-4 py-2.5">
      <p className="text-2xl font-bold leading-none text-[#1e5b3a]">{value}</p>
      <p className="mt-1 text-xs text-gray-500">{label}</p>
    </div>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <i className={`inline-block h-3.5 w-3.5 rounded ${swatch}`} />
      {label}
    </span>
  );
}

function FragmentRow({
  hour,
  children,
}: {
  hour: number;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="flex items-center justify-end pr-2 text-xs font-semibold text-gray-400">
        {fmt(hour)}
      </div>
      {children}
    </>
  );
}

function Modal({
  title,
  body,
  confirmLabel,
  danger,
  onCancel,
  onConfirm,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0c2619]/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <h2 className="text-lg font-bold">{title}</h2>
        <p className="mt-2 text-sm text-gray-600">{body}</p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-xl px-5 py-2.5 text-sm font-semibold text-white ${
              danger
                ? "bg-red-600 hover:bg-red-700"
                : "bg-[#1e5b3a] hover:bg-[#174a2f]"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
