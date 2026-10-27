import { X } from "lucide-react";
import { CANCEL_REASONS, type CounselingSession } from "../../../data/mock/counselorActivity";

export type DialogState = { type: "start" | "finish"; id: number };

export function SessionConfirmationDialog({
  dialog,
  sessions,
  setDialog,
  startSession,
  finishSession,
  primaryBtn,
}: {
  dialog: DialogState | null;
  sessions: CounselingSession[];
  setDialog: (value: DialogState | null) => void;
  startSession: () => void;
  finishSession: () => void;
  primaryBtn: string;
}) {
  return (
    <>
      {dialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-bold">
                {dialog.type === "start"
                  ? `Mulai sesi dengan ${sessions.find((item) => item.id === dialog.id)?.client}?`
                  : "Selesaikan sesi ini?"}
              </h2>
              <button
                type="button"
                onClick={() => setDialog(null)}
                aria-label="Tutup"
                className="rounded-lg p-1 text-gray-500 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-2 text-sm text-gray-600">
              {dialog.type === "start"
                ? "Sesi akan dimulai sekarang. Anda akan diarahkan ke halaman sesi untuk mengisi catatan."
                : "Setelah diselesaikan, kedua catatan disimpan dan tidak dapat diubah lagi. Catatan konselor hanya dapat dilihat Anda, catatan untuk klien dapat dilihat klien."}
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDialog(null)}
                className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Kembali
              </button>
              <button
                type="button"
                onClick={dialog.type === "start" ? startSession : finishSession}
                className={primaryBtn}
              >
                {dialog.type === "start" ? "Ya, mulai sesi" : "Ya, selesaikan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function CancelActivitySessionDialog({
  cancelId,
  sessions,
  closeCancel,
  cancelReason,
  setCancelReason,
  cancelOther,
  setCancelOther,
  cancelNote,
  setCancelNote,
  cancelValid,
  confirmCancel,
}: {
  cancelId: number | null;
  sessions: CounselingSession[];
  closeCancel: () => void;
  cancelReason: string;
  setCancelReason: (value: string) => void;
  cancelOther: string;
  setCancelOther: (value: string) => void;
  cancelNote: string;
  setCancelNote: (value: string) => void;
  cancelValid: boolean;
  confirmCancel: () => void;
}) {
  return (
    <>
      {cancelId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-4">
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="border-b border-gray-200 p-6 pb-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold">Batalkan sesi</h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Sesi dengan{" "}
                    {sessions.find((item) => item.id === cancelId)?.client}.
                    Alasan akan tercatat di laporan.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeCancel}
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
                  {CANCEL_REASONS.map((reason) => (
                    <label
                      key={reason.code}
                      className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 p-3.5 transition hover:border-red-300 has-[:checked]:border-red-500 has-[:checked]:bg-red-50/60"
                    >
                      <input
                        type="radio"
                        name="cancelReason"
                        value={reason.code}
                        checked={cancelReason === reason.code}
                        onChange={() => setCancelReason(reason.code)}
                        className="h-4 w-4 accent-red-600"
                      />
                      <span className="text-sm font-medium text-gray-800">
                        {reason.label}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              {cancelReason === "LAINNYA" && (
                <div>
                  <label
                    htmlFor="cancelOther"
                    className="text-sm font-semibold text-gray-800"
                  >
                    Sebutkan alasan lainnya{" "}
                    <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="cancelOther"
                    type="text"
                    maxLength={80}
                    value={cancelOther}
                    onChange={(event) => setCancelOther(event.target.value)}
                    placeholder="Misalnya: ruangan rusak mendadak"
                    className="mt-1.5 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/15"
                  />
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
                  value={cancelNote}
                  onChange={(event) => setCancelNote(event.target.value)}
                  placeholder="Jelaskan kondisi secara singkat (minimal 10 karakter)"
                  className="mt-1.5 w-full rounded-xl border border-gray-300 p-3 text-sm outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/15"
                />
                <p className="mt-1 text-xs text-gray-400">
                  Catatan ini hanya dapat dilihat konselor. Laporan admin
                  menampilkan alasan pilihan saja.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-200 p-6 pt-4">
              <button
                type="button"
                onClick={closeCancel}
                className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Kembali
              </button>
              <button
                type="button"
                onClick={confirmCancel}
                disabled={!cancelValid}
                className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Ya, batalkan sesi
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
