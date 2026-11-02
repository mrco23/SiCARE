import { useCallback, useEffect, useState } from "react";
import { Star, RefreshCw } from "lucide-react";
import { PageHeader } from "../../components/shared";
import {
  sicareApi,
  type FeedbackRecordApi,
  type SessionRecordApi,
} from "../../lib/sicareApi";
import { getPublicCounselors } from "../../lib/publicApi";
import { ApiError } from "../../lib/api";
import type { FeedbackModerationStatusApi } from "../../types/api";

const dateTime = (value: string) =>
  new Date(value).toLocaleString("id-ID", {
    dateStyle: "full",
    timeStyle: "short",
  });

const statusLabels: Record<string, string> = {
  scheduled: "Terjadwal",
  ongoing: "Berlangsung",
  completed: "Selesai",
  cancelled: "Dibatalkan",
};

const moderationLabels: Record<FeedbackModerationStatusApi, string> = {
  pending: "Menunggu moderasi Admin",
  shown: "Ditampilkan ke publik",
  disabled: "Dinonaktifkan oleh Admin",
};

const MAX_COMMENT_LENGTH = 5000;

export default function KlienRiwayatPage() {
  const [sessions, setSessions] = useState<SessionRecordApi[]>([]);
  const [feedback, setFeedback] = useState<FeedbackRecordApi[]>([]);
  const [counselorNames, setCounselorNames] = useState<Record<string, string>>({});
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const fetchHistory = useCallback(async () => {
    const [sessionRows, feedbackRows, counselors] = await Promise.all([
      sicareApi.sessions(100),
      sicareApi.myFeedback(),
      getPublicCounselors().catch(() => []),
    ]);
    return {
      sessionRows,
      feedbackRows,
      counselors: Object.fromEntries(
        counselors.map((counselor) => [
          counselor.profile_id,
          counselor.public_name,
        ]),
      ),
    };
  }, []);

  const applyHistory = useCallback(
    (result: Awaited<ReturnType<typeof fetchHistory>>) => {
      setSessions(result.sessionRows);
      setFeedback(result.feedbackRows);
      setCounselorNames(result.counselors);
      setError("");
    },
    [],
  );

  const reportLoadError = useCallback((cause: unknown) => {
    setError(
      cause instanceof ApiError || cause instanceof Error
        ? cause.message
        : "Riwayat konseling tidak dapat dimuat.",
    );
  }, []);

  useEffect(() => {
    let active = true;
    void fetchHistory()
      .then((result) => {
        if (active) applyHistory(result);
      })
      .catch((cause: unknown) => {
        if (active) reportLoadError(cause);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fetchHistory, applyHistory, reportLoadError]);

  const refresh = () => {
    setLoading(true);
    setError("");
    void fetchHistory()
      .then(applyHistory)
      .catch(reportLoadError)
      .finally(() => setLoading(false));
  };

  const submitted = new Set(feedback.map((item) => item.session_id));

  const submit = async (session: SessionRecordApi) => {
    if (submitted.has(session.id)) {
      setError("Feedback untuk sesi ini sudah pernah dikirim.");
      return;
    }
    const rating = ratings[session.id] ?? 5;
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      setError("Rating harus bernilai antara 1 sampai 5.");
      return;
    }
    const commentText = comments[session.id]?.trim() ?? "";
    if (commentText.length > MAX_COMMENT_LENGTH) {
      setError(`Komentar maksimal ${MAX_COMMENT_LENGTH} karakter.`);
      return;
    }

    setBusyId(session.id);
    setError("");
    try {
      const saved = await sicareApi.submitFeedback(session.id, {
        rating,
        comment: commentText || null,
      });
      setFeedback((previous) => [
        saved,
        ...previous.filter(
          (item) => item.id !== saved.id && item.session_id !== saved.session_id,
        ),
      ]);
      setComments((previous) => ({ ...previous, [session.id]: "" }));
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 409) {
        setError(
          cause.message || "Feedback untuk sesi ini sudah pernah dikirim.",
        );
        void fetchHistory().then(applyHistory).catch(() => {});
      } else {
        setError(
          cause instanceof ApiError || cause instanceof Error
            ? cause.message
            : "Feedback tidak dapat dikirim.",
        );
      }
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Riwayat Konseling"
        description="Riwayat sesi dan feedback tersimpan dari database SiCARE."
        actions={
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className="h-4 w-4" /> Muat ulang
          </button>
        }
      />
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      {loading && (
        <p
          role="status"
          className="rounded-xl bg-white p-4 text-sm text-slate-600"
        >
          Memuat riwayat...
        </p>
      )}
      {!loading && sessions.length > 0 ? (
        <div className="space-y-4">
          {sessions.map((session) => {
            const counselorName =
              counselorNames[session.counselor_id] ?? "Konselor";
            const existingFeedback = feedback.find(
              (item) => item.session_id === session.id,
            );
            return (
              <article
                key={session.id}
                className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-bold text-slate-900">{counselorName}</h2>
                    <p className="mt-1 text-sm text-slate-600">
                      {dateTime(session.starts_at)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Tatap muka · {session.room ?? "Ruang Konseling LMI"}
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                    {statusLabels[session.status] ?? session.status}
                  </span>
                </div>
                {existingFeedback ? (
                  <div className="rounded-xl bg-primary-soft p-3">
                    <p className="text-sm font-semibold text-primary">
                      Feedback sudah dikirim · {existingFeedback.rating}/5
                    </p>
                    <p className="mt-1 text-sm text-slate-700">
                      {existingFeedback.comment || "Tanpa komentar."}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Status publik:{" "}
                      {moderationLabels[existingFeedback.moderation_status] ??
                        existingFeedback.moderation_status}
                    </p>
                  </div>
                ) : (
                  session.status === "completed" && (
                    <div className="space-y-3 border-t border-slate-100 pt-3">
                      <p className="text-sm font-semibold text-slate-800">
                        Bagikan feedback tentang sesi ini
                      </p>
                      <label className="block text-xs font-semibold text-slate-600">
                        Rating
                        <select
                          value={ratings[session.id] ?? 5}
                          onChange={(event) =>
                            setRatings((previous) => ({
                              ...previous,
                              [session.id]: Number(event.target.value),
                            }))
                          }
                          className="mt-1 block rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                        >
                          {[5, 4, 3, 2, 1].map((value) => (
                            <option key={value} value={value}>
                              {value} / 5
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block text-xs font-semibold text-slate-600">
                        Komentar (opsional)
                        <textarea
                          value={comments[session.id] ?? ""}
                          onChange={(event) =>
                            setComments((previous) => ({
                              ...previous,
                              [session.id]: event.target.value,
                            }))
                          }
                          maxLength={MAX_COMMENT_LENGTH}
                          rows={3}
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                          placeholder="Tuliskan pengalamanmu secara sopan."
                        />
                      </label>
                      <button
                        type="button"
                        disabled={
                          busyId === session.id || submitted.has(session.id)
                        }
                        onClick={() => void submit(session)}
                        className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        <Star className="h-4 w-4" />{" "}
                        {busyId === session.id
                          ? "Mengirim..."
                          : "Kirim feedback"}
                      </button>
                      <p className="text-xs text-slate-500">
                        Feedback dikirim dengan status pending dan hanya
                        ditampilkan ke publik setelah disetujui Admin.
                      </p>
                    </div>
                  )
                )}
              </article>
            );
          })}
        </div>
      ) : (
        !loading && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <p className="font-semibold text-slate-700">
              Belum ada riwayat sesi.
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Sesi akan muncul setelah booking dikonfirmasi.
            </p>
          </div>
        )
      )}
    </div>
  );
}
