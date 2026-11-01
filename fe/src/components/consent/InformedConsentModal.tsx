import React, { useEffect, useState } from "react";
import {
  FileText,
  ShieldCheck,
  AlertCircle,
  Download,
  CheckCircle2,
  Lock,
  X,
  Loader2,
  User,
} from "lucide-react";
import { SignaturePad } from "./SignaturePad";
import { consentApi } from "../../lib/consentApi";
import type { ConsentIdentityDto, InformedConsentDto } from "../../types/api";

interface InformedConsentModalProps {
  bookingId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const InformedConsentModal: React.FC<InformedConsentModalProps> = ({
  bookingId,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consent, setConsent] = useState<InformedConsentDto | null>(null);

  // Identity Form State
  const [identity, setIdentity] = useState<ConsentIdentityDto>({
    full_name: "",
    faculty: "",
    study_program: "",
    nim: "",
    birthplace: "",
    date_of_birth: "",
    gender: "Laki-laki",
    phone_e164: "",
  });

  // Agreement and Signature State
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [downloadingDoc, setDownloadingDoc] = useState(false);

  // Fetch or initialize consent for this booking
  useEffect(() => {
    if (!isOpen || !bookingId) return;

    let isMounted = true;

    const loadConsent = async () => {
      try {
        const data = await consentApi.getMyConsentForBooking(bookingId);
        if (!isMounted) return;
        setConsent(data);

        // Prepopulate identity form
        const part = data.booking_participants;
        const snap = data.identity_snapshot || {};
        setIdentity({
          full_name: snap.full_name || part?.full_name || part?.display_name || "",
          faculty: snap.faculty || part?.faculty || "",
          study_program: snap.study_program || part?.study_program || "",
          nim: snap.nim || part?.nim || "",
          birthplace: snap.birthplace || part?.birthplace || "",
          date_of_birth: snap.date_of_birth || (part?.date_of_birth ? String(part.date_of_birth).split("T")[0] : ""),
          gender: (snap.gender || part?.gender || "Laki-laki") as "Laki-laki" | "Perempuan",
          phone_e164: snap.phone_e164 || part?.phone_e164 || "",
        });
        setError(null);
      } catch (err: unknown) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : "Gagal memuat dokumen Informed Consent.");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void loadConsent();

    return () => {
      isMounted = false;
    };
  }, [isOpen, bookingId]);

  if (!isOpen) return null;

  const isSigned = consent?.status === "signed";

  const handleIdentityChange = (field: keyof ConsentIdentityDto, value: string) => {
    setIdentity((prev) => ({ ...prev, [field]: value }));
  };

  const handlePreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate fields
    if (!identity.full_name.trim()) return setError("Nama lengkap wajib diisi.");
    if (!identity.faculty.trim()) return setError("Fakultas wajib diisi.");
    if (!identity.study_program.trim()) return setError("Program studi wajib diisi.");
    if (!identity.nim.trim()) return setError("NIM wajib diisi.");
    if (!identity.birthplace.trim()) return setError("Tempat lahir wajib diisi.");
    if (!identity.date_of_birth) return setError("Tanggal lahir wajib diisi.");
    if (!identity.phone_e164.trim()) return setError("Nomor telepon wajib diisi.");
    if (!agreementAccepted) return setError("Anda wajib menyetujui pernyataan persetujuan sebelum menandatangani.");
    if (!signatureDataUrl) return setError("Tanda tangan digital wajib dibubuhkan.");

    setShowConfirmDialog(true);
  };

  const handleExecuteSign = async () => {
    if (!consent || !signatureDataUrl) return;

    setSubmitting(true);
    setError(null);

    try {
      const result = await consentApi.signConsent(consent.id, {
        signature_base64: signatureDataUrl,
        agreement_accepted: true,
        identity,
      });

      setConsent(result.consent);
      setShowConfirmDialog(false);
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan saat memfinalisasi persetujuan.");
      setShowConfirmDialog(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!consent) return;
    setDownloadingDoc(true);
    try {
      const res = await consentApi.getSignedDocumentUrl(consent.id);
      if (res.downloadUrl) {
        window.open(res.downloadUrl, "_blank", "noopener,noreferrer");
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Gagal mengunduh dokumen persetujuan.");
    } finally {
      setDownloadingDoc(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="bg-emerald-950 text-white px-5 py-4 flex items-center justify-between border-b border-emerald-900">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-800/80 flex items-center justify-center text-emerald-200 border border-emerald-700/50">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-base sm:text-lg leading-tight">
                Informed Consent (Surat Pernyataan Kesediaan)
              </h3>
              <p className="text-xs text-emerald-300">Lembaga Misi & Identitas (LMI) — Unika De La Salle Manado</p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="text-emerald-300 hover:text-white p-1 rounded-lg hover:bg-emerald-900/60 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 text-slate-700">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-800" />
              <p className="text-sm">Memuat formulir Informed Consent...</p>
            </div>
          ) : error && !consent ? (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-3 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Dokumen tidak dapat dimuat</p>
                <p className="mt-0.5 text-xs text-rose-700">{error}</p>
              </div>
            </div>
          ) : isSigned ? (
            /* Post-Signing Success State */
            <div className="space-y-6 py-4">
              <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
                <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 border border-emerald-300">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div className="flex-1">
                  <span className="inline-block px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-200 text-emerald-900 mb-1.5">
                    Telah Ditandatangani & Sah
                  </span>
                  <h4 className="font-bold text-slate-900 text-base">Informed Consent Resmi Tersimpan</h4>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Dokumen persetujuan Anda telah ditandatangani secara elektronik dan disimpan permanen sebagai bukti
                    legal dalam arsip konseling Anda.
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-2 text-slate-600">
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-500">Penandatangan:</span>
                  <span className="font-semibold text-slate-800">{consent.signer_name_snapshot || consent.booking_participants?.full_name}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-500">Waktu Penandatanganan:</span>
                  <span className="font-semibold text-slate-800">
                    {consent.signed_at ? new Date(consent.signed_at).toLocaleString("id-ID", { dateStyle: "full", timeStyle: "medium" }) : "-"}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-500">Versi Templat Resmi:</span>
                  <span className="font-semibold text-slate-800">{consent.consent_statement_version || "v1.0"}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Integritas Hash (SHA-256):</span>
                  <span className="font-mono text-[10px] text-slate-700 truncate max-w-[200px] sm:max-w-[320px]">
                    {consent.signed_document_sha256 || "Terverifikasi"}
                  </span>
                </div>
              </div>

              <div className="pt-2 flex justify-center sm:justify-end gap-3">
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={downloadingDoc}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-900 hover:bg-emerald-950 text-white text-sm font-semibold shadow-md transition disabled:opacity-50"
                >
                  {downloadingDoc ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  <span>Unduh Dokumen PDF Resmi</span>
                </button>
              </div>
            </div>
          ) : (
            /* Signing Form Workflow */
            <form onSubmit={handlePreSubmit} className="space-y-6">
              {error && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Section A: Banner Dokumen Resmi */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3 text-xs text-slate-600">
                <ShieldCheck className="w-5 h-5 text-emerald-800 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-900 uppercase tracking-wide text-[10px] bg-slate-200 px-2 py-0.5 rounded">
                    CONFIDENTIAL
                  </span>
                  <p className="mt-1 leading-relaxed">
                    Dokumen ini merupakan pernyataan kesediaan sukarela mengikuti konseling dengan psikolog di LMI Unika
                    De La Salle Manado. Identitas dan tanda tangan Anda akan digabungkan ke dalam templat resmi.
                  </p>
                </div>
              </div>

              {/* Section B: Data Identitas Peserta */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900 border-b border-slate-200 pb-2">
                  <User className="w-4 h-4 text-emerald-800" />
                  <h4>Data Identitas Peserta</h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Nama Lengkap *</label>
                    <input
                      type="text"
                      value={identity.full_name}
                      onChange={(e) => handleIdentityChange("full_name", e.target.value)}
                      placeholder="Nama lengkap sesuai KTM/KTP"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-800 focus:outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-medium mb-1">NIM (Nomor Induk Mahasiswa) *</label>
                    <input
                      type="text"
                      value={identity.nim}
                      onChange={(e) => handleIdentityChange("nim", e.target.value)}
                      placeholder="Contoh: 210111045"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-800 focus:outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Fakultas *</label>
                    <input
                      type="text"
                      value={identity.faculty}
                      onChange={(e) => handleIdentityChange("faculty", e.target.value)}
                      placeholder="Contoh: Fakultas Teknik"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-800 focus:outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Program Studi *</label>
                    <input
                      type="text"
                      value={identity.study_program}
                      onChange={(e) => handleIdentityChange("study_program", e.target.value)}
                      placeholder="Contoh: Teknik Informatika"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-800 focus:outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Tempat Lahir *</label>
                    <input
                      type="text"
                      value={identity.birthplace}
                      onChange={(e) => handleIdentityChange("birthplace", e.target.value)}
                      placeholder="Kota tempat lahir"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-800 focus:outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Tanggal Lahir *</label>
                    <input
                      type="date"
                      value={identity.date_of_birth}
                      onChange={(e) => handleIdentityChange("date_of_birth", e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-800 focus:outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Jenis Kelamin *</label>
                    <select
                      value={identity.gender}
                      onChange={(e) => handleIdentityChange("gender", e.target.value as "Laki-laki" | "Perempuan")}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-800 focus:outline-none"
                      required
                    >
                      <option value="Laki-laki">Laki-laki</option>
                      <option value="Perempuan">Perempuan</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Nomor Telepon (WhatsApp) *</label>
                    <input
                      type="tel"
                      value={identity.phone_e164}
                      onChange={(e) => handleIdentityChange("phone_e164", e.target.value)}
                      placeholder="Contoh: +628123456789"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-800 focus:outline-none"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Section C: Teks Resmi Informed Consent */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900 border-b border-slate-200 pb-2">
                  <FileText className="w-4 h-4 text-emerald-800" />
                  <h4>Ketentuan & Klausul Kesediaan</h4>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-3 text-slate-700 leading-relaxed max-h-48 overflow-y-auto">
                  <p>
                    <strong>1. Kesukarelaan:</strong> Menyatakan setuju dan bersedia untuk menjalani sesi bimbingan dan
                    konseling dengan psikolog. Saya menyadari bahwa keikutsertaan saya dalam proses bimbingan dan
                    konseling ini bermula dari kebutuhan pribadi untuk mendapatkan bantuan psikologis, sehingga bersifat
                    sukarela, tanpa adanya paksaan dari pihak manapun.
                  </p>
                  <p>
                    <strong>2. Jaminan Kerahasiaan:</strong> Saya bertanggung jawab untuk menunjang keberlangsungan sesi.
                    Saya memahami bahwa informasi yang saya berikan akan terjamin kerahasiaannya.
                  </p>
                  <p>
                    <strong>3. Rencana Keselamatan:</strong> Untuk rencana keselamatan, saya memahami bahwa data dan
                    identitas saya akan diserahkan kepada pihak yang berwenang jika ada resiko yang mengancam saya
                    (klien), psikolog, atau pihak lain. Jika demikian, maka psikolog wajib dan berhak untuk bekerja sama
                    dengan pihak lain yang berwenang.
                  </p>
                </div>
              </div>

              {/* Section D: Pernyataan Kesediaan (Explicit Checkbox) */}
              <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/60 flex items-start gap-3">
                <input
                  id="agreement-checkbox"
                  type="checkbox"
                  checked={agreementAccepted}
                  onChange={(e) => setAgreementAccepted(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded border-slate-300 text-emerald-800 focus:ring-emerald-700 cursor-pointer"
                />
                <label htmlFor="agreement-checkbox" className="text-xs text-slate-800 leading-relaxed cursor-pointer font-medium">
                  Saya menyatakan telah membaca, memahami seluruh ketentuan di atas, dan dengan sukarela menyetujui
                  untuk menjalani sesi bimbingan dan konseling dengan psikolog LMI Unika De La Salle Manado. *
                </label>
              </div>

              {/* Section E: Kanvas Tanda Tangan Digital */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm font-bold text-slate-900 border-b border-slate-200 pb-2">
                  <span className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-emerald-800" />
                    Tanda Tangan Elektronik Anda
                  </span>
                  <span className="text-[11px] font-normal text-slate-400">Manado, {new Date().toLocaleDateString("id-ID")}</span>
                </div>

                <SignaturePad onSignatureChange={setSignatureDataUrl} height={160} />
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={!agreementAccepted || !signatureDataUrl || submitting}
                  className="px-5 py-2.5 rounded-xl bg-emerald-900 hover:bg-emerald-950 text-white text-sm font-semibold shadow-md transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <span>Lanjutkan Konfirmasi</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Dialog Konfirmasi Final */}
      {showConfirmDialog && (
        <div className="fixed inset-0 z-60 bg-slate-950/70 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto border border-emerald-200">
              <ShieldCheck className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h4 className="font-bold text-slate-900 text-base">Konfirmasi Penandatanganan</h4>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Setelah Anda mengirimkan persetujuan ini, dokumen Informed Consent atas nama{" "}
                <span className="font-bold text-slate-800">{identity.full_name}</span> akan difinalisasi dan disimpan
                sebagai dokumen bukti hukum resmi dalam riwayat konseling Anda.
              </p>
            </div>

            {signatureDataUrl && (
              <div className="border border-slate-200 rounded-xl p-2 bg-slate-50 flex flex-col items-center">
                <span className="text-[10px] text-slate-400 mb-1">Pratinjau Tanda Tangan:</span>
                <img src={signatureDataUrl} alt="Tanda tangan" className="max-h-16 object-contain" />
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmDialog(false)}
                disabled={submitting}
                className="flex-1 py-2 rounded-xl border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition"
              >
                Kembali
              </button>
              <button
                type="button"
                onClick={handleExecuteSign}
                disabled={submitting}
                className="flex-1 py-2 rounded-xl bg-emerald-900 hover:bg-emerald-950 text-white text-sm font-semibold shadow-md transition disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                <span>Finalisasi Sekarang</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default InformedConsentModal;
