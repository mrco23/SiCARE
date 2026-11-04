import { SkeletonList } from "../shared/Skeleton";
import React, { useEffect, useState, useCallback } from "react";
import {
  Users,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Send,
  RefreshCw,
  X,
  Loader2,
  AlertCircle,
  FileCheck2,
} from "lucide-react";
import { consentApi } from "../../lib/consentApi";
import type { GroupConsentSummaryDto } from "../../types/api";

interface GroupConsentModalProps {
  bookingId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const GroupConsentModal: React.FC<GroupConsentModalProps> = ({
  bookingId,
  isOpen,
  onClose,
}) => {
  const [loading, setLoading] = useState(true);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [summary, setSummary] = useState<GroupConsentSummaryDto | null>(null);

  const loadSummary = useCallback(async () => {
    if (!bookingId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await consentApi.getGroupConsentSummary(bookingId);
      setSummary(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal memuat status persetujuan kelompok.");
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    if (!isOpen || !bookingId) return;

    let isMounted = true;
    const fetchData = async () => {
      try {
        const data = await consentApi.getGroupConsentSummary(bookingId);
        if (!isMounted) return;
        setSummary(data);
        setError(null);
      } catch (err: unknown) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : "Gagal memuat status persetujuan kelompok.");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [isOpen, bookingId]);

  const handleResend = async (participantId: string, participantName: string) => {
    setResendingId(participantId);
    setError(null);
    setFeedback(null);
    try {
      await consentApi.resendConsentInvitation(bookingId, participantId);
      setFeedback(`Undangan WhatsApp baru berhasil dikirimkan ke ${participantName}.`);
      await loadSummary();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : `Gagal mengirim ulang undangan ke ${participantName}.`);
    } finally {
      setResendingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 bg-[#064E3B] px-6 py-4 text-white">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-emerald-300" />
            <h3 className="font-semibold text-lg">Persetujuan Digital Kelompok</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-white/80 hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[75vh] overflow-y-auto p-6 space-y-6">
          {loading && (
            <SkeletonList bare rows={3} label="Memuat status persetujuan peserta..." />
          )}

          {error && (
            <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
              <div>
                <p className="font-semibold">Perhatian</p>
                <p className="mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {feedback && (
            <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
              <p>{feedback}</p>
            </div>
          )}

          {!loading && summary && (
            <>
              {/* Summary Card */}
              <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
                      Kelompok
                    </p>
                    <p className="text-base font-bold text-gray-900">
                      {summary.group_name || "Sesi Kelompok"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Progres Persetujuan</p>
                      <p className="text-sm font-semibold text-gray-900">
                        {summary.signed_count} dari {summary.total_participants} Peserta
                      </p>
                    </div>
                    {summary.ready_for_session ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                        <CheckCircle2 className="h-4 w-4" />
                        Siap Dimulai
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                        <Clock className="h-4 w-4" />
                        Menunggu Kelengkapan
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-gray-200">
                  <div
                    className="h-full bg-emerald-600 transition-all duration-300"
                    style={{
                      width: `${summary.total_participants > 0 ? (summary.signed_count / summary.total_participants) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              {/* Participants List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-gray-900">Daftar Anggota</h4>
                  <button
                    type="button"
                    onClick={loadSummary}
                    disabled={loading}
                    className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-800"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                    Perbarui
                  </button>
                </div>

                <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white shadow-xs">
                  {summary.participants.map((participant) => {
                    const isSigned = participant.consent_status === "signed";
                    const isRep = participant.is_primary;

                    return (
                      <div
                        key={participant.participant_id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 hover:bg-gray-50/50"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-gray-900">
                              {participant.display_name}
                            </span>
                            {isRep && (
                              <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 border border-blue-200">
                                Perwakilan
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                            <span>Status:</span>
                            {isSigned ? (
                              <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Sudah Menandatangani
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 font-medium text-amber-700">
                                <Clock className="h-3.5 w-3.5" />
                                Menunggu Persetujuan
                              </span>
                            )}
                            {participant.invitation_status && (
                              <span className="text-gray-400">
                                · Undangan WA: {participant.invitation_status}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2 self-end sm:self-center">
                          {isSigned ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                              <FileCheck2 className="h-3.5 w-3.5" />
                              Tersimpan
                            </span>
                          ) : (
                            !isRep && (
                              <button
                                type="button"
                                disabled={resendingId === participant.participant_id}
                                onClick={() =>
                                  handleResend(participant.participant_id, participant.display_name)
                                }
                                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-900 hover:bg-emerald-100 disabled:opacity-50 transition"
                              >
                                {resendingId === participant.participant_id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Send className="h-3.5 w-3.5" />
                                )}
                                Kirim Ulang WA
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Privacy Notice */}
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
                <div className="flex items-start gap-2.5">
                  <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-800" />
                  <p className="text-xs text-emerald-900 leading-relaxed">
                    <strong>Privasi Terjamin:</strong> Dokumen persetujuan dan data pribadi setiap
                    anggota bersifat rahasia. Sesuai Kode Etik Konseling, anggota lain dan perwakilan
                    hanya dapat melihat status kelengkapan persetujuan dan tidak dapat mengakses dokumen
                    pribadi peserta lain.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 bg-gray-50 px-6 py-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-300 transition"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
