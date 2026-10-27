import { PageContainer, PageHeader } from "../../components/shared";
import { useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, Check, ChevronDown, MapPin, Search, X } from "lucide-react";
import { intakes } from "../../data/mock/counselorRequests";
import { useBookingStore } from "../../features/booking/store/bookingStore";
import { DEMO_NOTIFICATION_RECIPIENTS } from "../../features/notification/notificationStore";
import { formatIndonesianDate, parseLocalISODate } from "../../lib/dateUtils";
import { CounselorAnswerRow, CounselorBadge as Badge, CounselorEssayCard, CounselorScaleView } from "../../components/counselor/shared/CounselorIntakeFields";
import { decideCounselorRequest } from "../../features/counselor/requests/decideCounselorRequest";
import { countPendingCounselorRequests, selectPendingCounselorBookings, selectPendingCounselorRequests } from "../../features/counselor/requests/requestSelectors";
import { getCounselorInitials as initials } from "../../features/counselor/shared/presentation";
import { getCounselorIntakeSafetyFlags } from "../../features/counselor/activity/sessionSelectors";












function waitLabel(minutes: number) {
  if (minutes < 60) return `${minutes} menit lalu`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} jam lalu`;
  return `${Math.floor(minutes / 1440)} hari lalu`;
}

function StatCard({
  label,
  value,
  note,
}: {
  label: string;
  value: ReactNode;
  note?: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
      <p className="mt-1 text-xs text-gray-400">{note}</p>
    </div>
  );
}

type ConfirmDecision = {
  id?: number;
  bookingId?: string;
  accept: boolean;
};

export default function KonselorPermintaanPage() {
  const bookings = useBookingStore((state) => state.bookings);
  const requests = useBookingStore((state) => state.legacyRequests);
  const pendingClientBookings = useMemo(
    () => selectPendingCounselorBookings(bookings, DEMO_NOTIFICATION_RECIPIENTS.counselor),
    [bookings],
  );
  const [formatFilter, setFormatFilter] = useState("Semua");
  const [sortMode, setSortMode] = useState("terlama");
  const [search, setSearch] = useState("");
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<ConfirmDecision | null>(null);
  const [roomInput, setRoomInput] = useState("");
  const [confirmRoomSave, setConfirmRoomSave] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const currentRequest = requests.find((request) => request.id === currentId);
  const currentIntake = currentId ? intakes[currentId] : null;

  const pendingRequests = useMemo(
    () => selectPendingCounselorRequests(requests, { formatFilter, sortMode, search }),
    [requests, formatFilter, sortMode, search],
  );
  const pendingCounts = useMemo(
    () => countPendingCounselorRequests(requests, bookings, DEMO_NOTIFICATION_RECIPIENTS.counselor),
    [requests, bookings],
  );
  const totalPendingCount = pendingCounts.total;
  const individualCount = pendingCounts.individual;
  const groupCount = pendingCounts.group;


  function notify(message: string) {
    setToastMsg(message);
    window.setTimeout(() => setToastMsg(""), 2600);
  }

  function openDecision(id: number, accept: boolean) {
    setRoomInput("");
    setConfirmRoomSave(false);
    setConfirm({ id, accept });
  }

  function handleDecision() {
    if (!confirm) return;
    if (confirm.accept && !roomInput.trim()) return;

    const target = confirm.bookingId
      ? { kind: "booking" as const, bookingId: confirm.bookingId }
      : confirm.id !== undefined
        ? { kind: "legacy-request" as const, requestId: confirm.id }
        : null;
    if (!target) return;

    const result = decideCounselorRequest(target, confirm.accept, roomInput);
    if (!result.ok) return;

    setConfirm(null);
    setRoomInput("");
    if (target.kind === "booking") {
      setConfirmRoomSave(false);
    } else if (currentId === target.requestId) {
      setCurrentId(null);
    }
    notify(result.message);
  }

  const safetyFlags = currentIntake
    ? getCounselorIntakeSafetyFlags(currentIntake)
    : [];

  const selectedDecisionBooking = confirm?.bookingId
    ? bookings.find((booking) => booking.id === confirm.bookingId)
    : undefined;
  const selectedDecisionRequest = confirm?.id !== undefined
    ? requests.find((request) => request.id === confirm.id)
    : undefined;
  const decisionName = selectedDecisionBooking?.clientName ?? selectedDecisionRequest?.name ?? "klien";
  const decisionFormat = selectedDecisionBooking
    ? selectedDecisionBooking.serviceType === "GROUP" ? "Kelompok" : "Individu"
    : selectedDecisionRequest?.format;
  const decisionTime = selectedDecisionBooking?.startTime ?? selectedDecisionRequest?.time;
  const decisionDate = selectedDecisionBooking
    ? formatIndonesianDate(parseLocalISODate(selectedDecisionBooking.date), { day: "numeric", month: "long", year: "numeric" })
    : intakes[selectedDecisionRequest?.id ?? -1]?.date ?? "28 September 2026";

  return (
    <PageContainer role="counselor" spacing="none">
      {!currentRequest ? (
        <>
          <PageHeader
            title="Permintaan Konseling"
            description="Tinjau permintaan klien sebelum menerima atau menolak."
          />

          {pendingClientBookings.length > 0 && (
            <section className="mt-5 rounded-2xl border border-primary/20 bg-primary/[0.035] p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-gray-900">Booking baru dari Klien</h2>
                  <p className="mt-1 text-xs text-gray-600">Booking yang dikirim melalui formulir pesanan tampil di sini secara langsung.</p>
                </div>
                <Badge className="bg-primary-soft text-primary">{pendingClientBookings.length} baru</Badge>
              </div>
              <ul className="mt-4 space-y-3">
                {pendingClientBookings.map((booking) => (
                  <li key={booking.id} className="rounded-xl border border-gray-200 bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900">{booking.clientName}</p>
                        <p className="mt-1 text-xs text-gray-600">{booking.serviceType === "GROUP" ? "Kelompok" : "Individu"} · {booking.topic}</p>
                        <p className="mt-1 text-xs text-gray-500">{formatIndonesianDate(parseLocalISODate(booking.date), { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · {booking.startTime} WITA</p>
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => { setRoomInput(""); setConfirmRoomSave(false); setConfirm({ bookingId: booking.id, accept: false }); }} className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50">Tolak</button>
                        <button type="button" onClick={() => { setRoomInput(""); setConfirmRoomSave(false); setConfirm({ bookingId: booking.id, accept: true }); }} className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white hover:bg-primary-dark">Terima</button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
            <StatCard
              label="Total Permintaan"
              value={totalPendingCount}
              note="Menunggu persetujuan"
            />
            <StatCard
              label="Konseling Individu"
              value={individualCount}
              note="Permintaan individu"
            />
            <StatCard
              label="Konseling Kelompok"
              value={groupCount}
              note="Permintaan kelompok"
            />
          </section>

          <section className="mt-6 flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:p-4">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari nama klien ..."
                className="w-full rounded-xl border border-gray-200 bg-gray-100/70 py-3 pl-12 pr-4 text-sm outline-none placeholder:text-gray-500 focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/15"
              />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="flex rounded-xl border border-gray-200 bg-gray-100/70 p-1">
                {["Semua", "Individu", "Kelompok"].map((format) => (
                  <button
                    key={format}
                    type="button"
                    onClick={() => setFormatFilter(format)}
                    className={`flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-sm transition sm:flex-none ${
                      formatFilter === format
                        ? "bg-white font-semibold text-gray-900 shadow-sm"
                        : "text-gray-500 hover:text-gray-800"
                    }`}
                  >
                    {format}
                  </button>
                ))}
              </div>
              <div className="relative">
                <select
                  value={sortMode}
                  onChange={(event) => setSortMode(event.target.value)}
                  className="w-full appearance-none rounded-xl border border-gray-200 bg-gray-100/70 py-3 pl-4 pr-10 text-sm text-gray-700 outline-none focus:border-primary focus:bg-white"
                >
                  <option value="terlama">Terlama</option>
                  <option value="terbaru">Terbaru</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              </div>
            </div>
          </section>

          <p className="mt-4 text-xs text-gray-500">
            Menampilkan {pendingRequests.length} permintaan · {formatFilter}
          </p>

          <ul className="mt-3 space-y-4">
            {pendingRequests.map((request) => (
              <li
                key={request.id}
                className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-soft font-bold text-primary">
                    {initials(request.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900">
                      {request.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      Permintaan konseling · {waitLabel(request.waitMin)}
                    </p>
                    <div className="mt-2">
                      {request.isNew ? (
                        <Badge className="bg-amber-100 text-amber-800">
                          Pertama kali
                        </Badge>
                      ) : (
                        <Badge className="bg-primary-soft text-primary">
                          Sudah pernah · {request.pastSessions} sesi
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 border-t border-gray-100 pt-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-gray-500">Jenis Konseling</p>
                    <p className="mt-0.5 text-sm font-semibold">
                      {request.format}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      Topik: {request.topic}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Waktu yang Diminta</p>
                    <p className="mt-0.5 text-sm font-semibold">
                      {request.time} WITA
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      28 September 2026
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
                  <button
                    type="button"
                    onClick={() => setCurrentId(request.id)}
                    className="text-sm font-semibold text-primary underline underline-offset-4"
                  >
                    Lihat Detail <span aria-hidden="true">→</span>
                  </button>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => openDecision(request.id, false)}
                      className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      Tolak
                    </button>
                    <button
                      type="button"
                      onClick={() => openDecision(request.id, true)}
                      className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark"
                    >
                      Terima Permintaan{" "}
                      <Check className="ml-1 inline h-4 w-4" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {pendingRequests.length === 0 && (
            <div className="mt-5 rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
              Tidak ada permintaan yang cocok.
            </div>
          )}
        </>
      ) : (
        <>
          <nav className="flex items-center gap-2 text-sm text-gray-500">
            <button
              type="button"
              onClick={() => setCurrentId(null)}
              className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
            >
              <ArrowLeft className="h-4 w-4" /> Permintaan Konseling
            </button>
            <span>/</span>
            <span className="truncate text-gray-700">
              {currentRequest.name}
            </span>
          </nav>

          <section className="mt-5 flex flex-col gap-5 rounded-2xl border border-gray-200 bg-white p-5 sm:flex-row sm:items-center sm:p-6">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary text-xl font-bold text-white">
              {initials(currentRequest.name)}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-bold sm:text-2xl">
                {currentRequest.name}
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Permintaan {currentRequest.format} · {currentIntake?.date}
              </p>
              <div className="mt-2">
                {currentRequest.isNew ? (
                  <Badge className="bg-amber-100 text-amber-800">
                    Pertama kali
                  </Badge>
                ) : (
                  <Badge className="bg-primary-soft text-primary">
                    Sudah pernah · {currentRequest.pastSessions} sesi
                  </Badge>
                )}
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-3 sm:gap-6">
              <div className="rounded-xl bg-gray-50 px-3 py-2.5 text-center sm:px-4">
                <dt className="text-xs text-gray-500">Jenis</dt>
                <dd className="mt-0.5 text-sm font-bold">
                  {currentRequest.format}
                </dd>
              </div>
              <div className="rounded-xl bg-gray-50 px-3 py-2.5 text-center sm:px-4">
                <dt className="text-xs text-gray-500">Waktu diminta</dt>
                <dd className="mt-0.5 text-sm font-bold">
                  {currentRequest.time} WITA
                </dd>
              </div>
            </dl>
          </section>

          {safetyFlags.length > 0 && (
            <section className="mt-5 rounded-2xl border border-red-300 bg-red-50 p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-200 font-bold text-red-800">
                  !
                </span>
                <div>
                  <p className="font-semibold text-red-900">
                    Perlu perhatian khusus
                  </p>
                  <p className="mt-0.5 text-sm text-red-800">
                    Klien menjawab ya atau mungkin pada:{" "}
                    {safetyFlags.join(", ")}. Pertimbangkan tindak lanjut
                    sebelum sesi.
                  </p>
                </div>
              </div>
            </section>
          )}

          {currentIntake && (
            <>
              <section className="mt-5 rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
                <h3 className="text-base font-bold">Kondisi Saat Ini</h3>
                <div className="mt-4">
                  <CounselorAnswerRow variant="request"
                    question="Apakah Anda sedang merasa ingin bunuh diri?"
                    answer={currentIntake.selfHarm}
                  />
                  <CounselorAnswerRow variant="request"
                    question="Apakah Anda sedang merasakan kesedihan, kehilangan, atau depresi yang luar biasa?"
                    answer={currentIntake.distress}
                  />
                  <CounselorAnswerRow variant="request"
                    question="Apakah Anda pernah mengalami pelecehan? (fisik, seksual, dan/atau emosional)"
                    answer={currentIntake.abuse}
                  />
                  <CounselorAnswerRow variant="request"
                    question="Apakah saat ini Anda sedang menggunakan obat-obatan?"
                    answer={currentIntake.substance}
                  />
                </div>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-sm font-semibold text-gray-700">
                      Kualitas tidur
                    </p>
                    <div className="mt-2">
                      <CounselorScaleView fallbackLabel="Tidak diketahui" value={currentIntake.sleep} />
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-700">
                      Keadaan finansial
                    </p>
                    <div className="mt-2">
                      <CounselorScaleView fallbackLabel="Tidak diketahui" value={currentIntake.finance} />
                    </div>
                  </div>
                </div>
              </section>

              <section className="mt-5 rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
                <h3 className="text-base font-bold">Masalah yang ingin dibahas</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {currentIntake.topics.map((topic) => (
                    <Badge key={topic} className="bg-blue-100 text-blue-800">
                      {topic}
                    </Badge>
                  ))}
                  {currentIntake.other && (
                    <Badge className="bg-blue-100 text-blue-800">
                      Lainnya: {currentIntake.other}
                    </Badge>
                  )}
                </div>
              </section>

              <section className="mt-5 space-y-4">
                <CounselorEssayCard variant="request" title="Deskripsikan keluhan yang Anda rasakan">
                  {currentIntake.complaint}
                </CounselorEssayCard>
                <CounselorEssayCard variant="request" title="Deskripsikan riwayat terjadinya keluhan secara jelas dan rinci">
                  {currentIntake.history}
                </CounselorEssayCard>
                <CounselorEssayCard variant="request" title="Keluhan dan alasan ingin memulai konseling">
                  {currentIntake.reason}
                </CounselorEssayCard>
                <CounselorEssayCard variant="request" title="Apa yang sudah dilakukan untuk menangani masalah ini?">
                  {currentIntake.efforts}
                </CounselorEssayCard>
                <CounselorEssayCard variant="request" title="Solusi apa yang diinginkan dari bantuan yang diterima?">
                  {currentIntake.goal}
                </CounselorEssayCard>
                <CounselorEssayCard variant="request" title="Apa kelebihan diri Anda?">
                  {currentIntake.strengths}
                </CounselorEssayCard>
                <CounselorEssayCard variant="request" title="Apa kekurangan diri Anda?">
                  {currentIntake.weaknesses}
                </CounselorEssayCard>
              </section>
            </>
          )}

          <section className="mt-5 rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
            <p className="text-sm text-gray-600">
              Pengisi formulir menyatakan bahwa isian dalam formulir ini benar.
            </p>
            <p className="mt-2 text-sm font-semibold text-gray-800">
              ✓ Ya, saya telah mengisi data sebenar-benarnya
            </p>
          </section>

          <div className="sticky bottom-0 mt-6 flex flex-col gap-3 border-t border-gray-200 bg-gray-50/95 py-4 backdrop-blur sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => openDecision(currentRequest.id, false)}
              className="rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Tolak
            </button>
            <button
              type="button"
              onClick={() => openDecision(currentRequest.id, true)}
              className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white hover:bg-primary-dark"
            >
              Terima Permintaan <Check className="ml-1 inline h-4 w-4" />
            </button>
          </div>
        </>
      )}

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0c2619]/40 p-4">
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            {!confirm.accept ? (
              <>
                <div className="p-6">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-lg font-bold">
                      Tolak permintaan{" "}
                      {decisionName}?
                    </h2>
                    <button
                      type="button"
                      onClick={() => setConfirm(null)}
                      aria-label="Tutup"
                      className="rounded-lg p-1 text-gray-500 hover:bg-gray-100"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <p className="mt-2 text-sm text-gray-600">
                    Permintaan akan ditolak dan klien akan diberi tahu.
                  </p>
                  <div className="mt-6 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirm(null)}
                      className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={handleDecision}
                      className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
                    >
                      Ya, tolak
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="border-b border-gray-200 p-6 pb-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-bold">
                        Tentukan ruangan konseling
                      </h2>
                      <p className="mt-1 text-sm text-gray-500">
                        {decisionName}{" "}
                        ·{" "}
                        {
                          decisionFormat
                        }{" "}
                        · {decisionDate}, {decisionTime} WITA
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setConfirm(null)}
                      aria-label="Tutup"
                      className="rounded-lg p-1 text-gray-500 hover:bg-gray-100"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>
                <div className="space-y-3 p-6">
                  <label
                    htmlFor="counseling-room"
                    className="block text-sm font-semibold text-gray-800"
                  >
                    Ruangan pelaksanaan
                  </label>
                  <input
                    id="counseling-room"
                    type="text"
                    value={roomInput}
                    onChange={(event) => setRoomInput(event.target.value)}
                    placeholder="Contoh: Ruang B-203, lantai 2"
                    autoComplete="off"
                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-800 outline-none placeholder:text-gray-400 focus:border-primary focus:ring-4 focus:ring-primary/15"
                  />
                  <p className="text-xs leading-relaxed text-gray-500">
                    Masukkan nama atau lokasi ruangan secara manual. Informasi
                    ini akan dicatat pada permintaan yang diterima.
                  </p>
                </div>
                <div className="flex justify-end gap-2 border-t border-gray-200 p-6 pt-4">
                  <button
                    type="button"
                    onClick={() => setConfirm(null)}
                    className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmRoomSave(true)}
                    disabled={!roomInput.trim()}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Check className="h-4 w-4" />
                    Terima &amp; simpan ruangan
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {confirmRoomSave && confirm?.accept && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#0c2619]/50 p-4">
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-room-title"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <MapPin className="h-6 w-6" />
            </div>
            <h2
              id="confirm-room-title"
              className="mt-4 text-lg font-bold text-gray-900"
            >
              Konfirmasi penerimaan permintaan
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              Apakah Anda yakin ingin menerima permintaan konseling dari{" "}
              <span className="font-semibold text-gray-900">
                {decisionName}
              </span>{" "}
              dengan lokasi pelaksanaan berikut?
            </p>
            <div className="mt-4 rounded-xl border border-[#ccebd9] bg-[#f4fbf7] p-4">
              <p className="text-xs font-medium text-gray-500">
                Ruangan yang akan disimpan
              </p>
              <p className="mt-1 flex items-start gap-2 font-semibold text-primary">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="break-words">{roomInput.trim()}</span>
              </p>
            </div>
            <p className="mt-3 text-xs text-gray-500">
              Setelah dikonfirmasi, permintaan akan berstatus diterima dan nama
              ruangan ini akan dicatat pada data permintaan.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setConfirmRoomSave(false)}
                className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Periksa kembali
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmRoomSave(false);
                  handleDecision();
                }}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark"
              >
                <Check className="h-4 w-4" />
                Ya, terima permintaan
              </button>
            </div>
          </section>
        </div>
      )}

      <div
        role="status"
        aria-live="polite"
        className={`pointer-events-none fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-xl bg-gray-900 px-4 py-3 text-sm text-white shadow-lg transition duration-300 ${
          toastMsg ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
        }`}
      >
        {toastMsg}
      </div>
    </PageContainer>
  );
}
