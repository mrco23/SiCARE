import IconLabel from "../shared/IconLabel";
import { useEffect, useState } from "react";
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Loader2,
  MapPin,
  X,
  XCircle,
  Check,
} from "lucide-react";
import { ApiError } from "../../lib/api";
import { sicareApi } from "../../lib/sicareApi";
import type { BookingDetailDto, BookingRecordBaseDto } from "../../types/api";
import {
  formatBookingClientTitle,
  formatIsoDateId,
  formatIsoTimeRangeWita,
} from "../../features/counselor/shared/presentation";

export type BookingDecisionAction = "approve" | "reject" | "reschedule";

const REJECT_PRESETS = [
  "Jadwal konselor berbenturan dengan agenda mendadak",
  "Kuota layanan konseling pada hari tersebut telah penuh",
  "Topik memerlukan penanganan konselor dengan spesialisasi berbeda",
  "Lainnya",
] as const;

const RESCHEDULE_PRESETS = [
  "Konselor berhalangan hadir pada slot waktu yang dipilih",
  "Terdapat agenda rapat atau tugas mendadak di unit LMI",
  "Penyesuaian jam operasional ruang konseling",
  "Lainnya",
] as const;

export function BookingDecisionModal({
  booking,
  action,
  onClose,
  onSuccess,
}: {
  booking: BookingRecordBaseDto;
  action: BookingDecisionAction;
  onClose: () => void;
  onSuccess: (result: BookingDetailDto, action: BookingDecisionAction) => void;
}) {
  const [room, setRoom] = useState("Ruang Konseling LMI");
  const [presetReason, setPresetReason] = useState<string>("");
  const [customReason, setCustomReason] = useState("");
  const [extraNote, setExtraNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, submitting]);

  const clientTitle = formatBookingClientTitle(booking);
  const scheduleDate = formatIsoDateId(booking.starts_at);
  const scheduleTime = formatIsoTimeRangeWita(booking.starts_at, booking.ends_at);

  const composedReason = (() => {
    const base = presetReason === "Lainnya" ? customReason.trim() : presetReason.trim();
    const note = extraNote.trim();
    if (!base && !note) return "";
    if (base && note) return `${base}. ${note}`.slice(0, 1000);
    return (base || note).slice(0, 1000);
  })();

  const isReasonValid =
    action === "approve"
      ? room.trim().length <= 240
      : Boolean(presetReason) &&
        (presetReason !== "Lainnya" || customReason.trim().length >= 3) &&
        composedReason.length >= 3 &&
        composedReason.length <= 1000;

  const handleSubmit = async () => {
    if (!isReasonValid || submitting) return;
    setSubmitting(true);
    setErrorMessage(null);

    try {
      let result: BookingDetailDto;
      if (action === "approve") {
        result = await sicareApi.transitionBooking(booking.id, {
          status: "confirmed",
          session_format: "offline",
          room: room.trim() ? room.trim() : null,
        });
      } else if (action === "reject") {
        result = await sicareApi.transitionBooking(booking.id, {
          status: "rejected",
          reason: composedReason,
        });
      } else {
        result = await sicareApi.transitionBooking(booking.id, {
          status: "reschedule_requested",
          reason: composedReason,
        });
      }
      onSuccess(result, action);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("Gagal memproses keputusan booking. Silakan coba lagi.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const presets = action === "reject" ? REJECT_PRESETS : RESCHEDULE_PRESETS;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0c2619]/45 p-4 backdrop-blur-[2px]"
      onClick={(event) => {
        if (event.target === event.currentTarget && !submitting) {
          onClose();
        }
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-gray-200 p-6 pb-4">
          <div className="flex items-start gap-3">
            <div
              className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                action === "approve"
                  ? "bg-emerald-50 text-[#064E3B]"
                  : action === "reschedule"
                    ? "bg-amber-50 text-amber-700"
                    : "bg-red-50 text-red-600"
              }`}
            >
              {action === "approve" ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : action === "reschedule" ? (
                <CalendarClock className="h-5 w-5" />
              ) : (
                <XCircle className="h-5 w-5" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                {action === "approve"
                  ? "Terima Permintaan Konseling"
                  : action === "reschedule"
                    ? "Minta Jadwal Ulang"
                    : "Tolak Permintaan Konseling"}
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                {clientTitle} · {scheduleDate} ({scheduleTime})
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            aria-label="Tutup"
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto p-6">
          {errorMessage && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {action === "approve" ? (
            <>
              <div>
                <label
                  htmlFor="decisionRoomInput"
                  className="block text-sm font-semibold text-gray-800"
                >
                  Ruangan / Lokasi Konseling (Opsional)
                </label>
                <p className="mt-0.5 text-xs text-gray-500">
                  Sesi konseling dilaksanakan secara Tatap Muka. Tentukan ruangan pelaksanaan jika ada.
                </p>
                <div className="relative mt-2">
                  <MapPin className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    id="decisionRoomInput"
                    type="text"
                    maxLength={240}
                    value={room}
                    onChange={(event) => setRoom(event.target.value)}
                    placeholder="Contoh: Ruang Konseling LMI Lt. 2"
                    className="w-full rounded-xl border border-gray-300 py-2.5 pl-10 pr-3.5 text-sm text-gray-900 outline-none focus:border-[#064E3B] focus:ring-4 focus:ring-[#064E3B]/15"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-400">
                  Maksimal 240 karakter ({room.length}/240).
                </p>
              </div>
            </>
          ) : (
            <>
              <fieldset>
                <legend className="text-sm font-semibold text-gray-800">
                  {action === "reject"
                    ? "Alasan Penolakan"
                    : "Alasan Permintaan Jadwal Ulang"}{" "}
                  <span className="text-red-600">*</span>
                </legend>
                <div className="mt-2.5 space-y-2">
                  {presets.map((item) => (
                    <label
                      key={item}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 p-3 text-sm transition ${
                        action === "reject"
                          ? "hover:border-red-300 has-[:checked]:border-red-500 has-[:checked]:bg-red-50/60"
                          : "hover:border-amber-300 has-[:checked]:border-amber-500 has-[:checked]:bg-amber-50/60"
                      }`}
                    >
                      <input
                        type="radio"
                        name="bookingDecisionReason"
                        value={item}
                        checked={presetReason === item}
                        onChange={() => setPresetReason(item)}
                        className={`h-4 w-4 ${
                          action === "reject" ? "accent-red-600" : "accent-amber-600"
                        }`}
                      />
                      <span className="font-medium text-gray-800">{item}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              {presetReason === "Lainnya" && (
                <div>
                  <label
                    htmlFor="customReasonInput"
                    className="block text-sm font-semibold text-gray-800"
                  >
                    Sebutkan alasan utama <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="customReasonInput"
                    type="text"
                    maxLength={200}
                    value={customReason}
                    onChange={(event) => setCustomReason(event.target.value)}
                    placeholder="Tuliskan alasan singkat (minimal 3 karakter)"
                    className="mt-1.5 w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-gray-500"
                  />
                </div>
              )}

              <div>
                <label
                  htmlFor="extraNoteInput"
                  className="block text-sm font-semibold text-gray-800"
                >
                  Keterangan Tambahan untuk Klien (Opsional)
                </label>
                <textarea
                  id="extraNoteInput"
                  rows={3}
                  maxLength={750}
                  value={extraNote}
                  onChange={(event) => setExtraNote(event.target.value)}
                  placeholder={
                    action === "reschedule"
                      ? "Misal: Silakan memilih slot pada hari Rabu atau Kamis."
                      : "Tambahkan catatan penjelasan untuk klien bila diperlukan."
                  }
                  className="mt-1.5 w-full rounded-xl border border-gray-300 p-3 text-sm outline-none focus:border-gray-500"
                />
                <p className="mt-1 text-xs text-gray-400">
                  Total alasan: {composedReason.length}/1000 karakter.{" "}
                  {action === "reschedule"
                    ? "Alasan disimpan pada `reschedule_reason` dan slot saat ini dibuka kembali agar klien dapat memilih jadwal baru."
                    : "Alasan disimpan pada `cancellation_reason` dan dikirim ke notifikasi klien."}
                </p>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2.5 border-t border-gray-200 bg-gray-50/60 px-6 py-4">
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <IconLabel icon={X}>Batal</IconLabel>
          </button>
          <button
            type="button"
            disabled={!isReasonValid || submitting}
            onClick={() => void handleSubmit()}
            className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-45 ${
              action === "approve"
                ? "bg-[#064E3B] hover:bg-[#053e2f]"
                : action === "reschedule"
                  ? "bg-amber-600 hover:bg-amber-700"
                  : "bg-red-600 hover:bg-red-700"
            }`}
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : action === "approve" ? (
              <Check className="h-4 w-4" />
            ) : action === "reschedule" ? (
              <CalendarClock className="h-4 w-4" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            {action === "approve"
              ? "Konfirmasi & Buat Sesi"
              : action === "reschedule"
                ? "Kirim Permintaan Jadwal Ulang"
                : "Ya, Tolak Permintaan"}
          </button>
        </div>
      </div>
    </div>
  );
}
