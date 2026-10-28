import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { CancelReason, CancelTarget, EditorState, Slot } from "../../../types/counselorSchedule";
import { CANCEL_REASONS, dateLabel, fmt, LAST_START, parseTime, SESSION, START } from "../../../features/counselor/schedule/scheduleUtils";

/* ========================= MODAL BATAL SESI ========================= */

export function CancelSessionDialog({
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

export function SlotDialog({
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
