import React, { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import {
  FileText,
  ShieldCheck,
  AlertCircle,
  Download,
  CheckCircle2,
  Lock,
  Loader2,
  User,
  ArrowLeft,
} from "lucide-react";
import { SignaturePad } from "../../components/consent/SignaturePad";
import { consentApi } from "../../lib/consentApi";
import type {
  ConsentIdentityDto,
  InformedConsentDto,
} from "../../types/api";

export default function GuestConsentPage() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guestToken, setGuestToken] = useState<string | null>(null);
  const [consent, setConsent] = useState<InformedConsentDto | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [downloadingDoc, setDownloadingDoc] = useState(false);

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
  const hasInitialized = useRef(false);

  // 1. Claim token on mount and immediately scrub token from URL to prevent Referer leakage
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const initialize = async () => {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams(window.location.search);
      const token = params.get("token");

      // Scrub token from browser URL history immediately
      if (token) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }

      try {
        if (token) {
          // Claim guest invitation
          const claimResult = await consentApi.claimGuestInvitation(token);
          setGuestToken(claimResult.guest_token);
          setConsent(claimResult.consent);

          // Populate identity from existing snapshot or participant
          const existingSnapshot = claimResult.consent.identity_snapshot || {};
          const participant = claimResult.participant || {};
          setIdentity({
            full_name: existingSnapshot.full_name || participant.full_name || participant.display_name || "",
            faculty: existingSnapshot.faculty || "",
            study_program: existingSnapshot.study_program || "",
            nim: existingSnapshot.nim || "",
            birthplace: existingSnapshot.birthplace || "",
            date_of_birth: existingSnapshot.date_of_birth || "",
            gender: existingSnapshot.gender || "Laki-laki",
            phone_e164: existingSnapshot.phone_e164 || participant.phone_e164 || "",
          });
        } else {
          // Check if session cookie is already valid
          const guestConsent = await consentApi.getGuestConsent();
          setConsent(guestConsent);

          const existingSnapshot = guestConsent.identity_snapshot || {};
          const part = guestConsent.booking_participants;
          setIdentity({
            full_name: existingSnapshot.full_name || part?.full_name || part?.display_name || "",
            faculty: existingSnapshot.faculty || part?.faculty || "",
            study_program: existingSnapshot.study_program || part?.study_program || "",
            nim: existingSnapshot.nim || part?.nim || "",
            birthplace: existingSnapshot.birthplace || part?.birthplace || "",
            date_of_birth: existingSnapshot.date_of_birth || part?.date_of_birth || "",
            gender: (existingSnapshot.gender || part?.gender || "Laki-laki") as "Laki-laki" | "Perempuan",
            phone_e164: existingSnapshot.phone_e164 || part?.phone_e164 || "",
          });
        }
      } catch (err: unknown) {
        setError(
          err instanceof Error
            ? err.message
            : "Tautan undangan tidak valid, telah digunakan, atau telah kedaluwarsa. Silakan periksa kembali tautan WhatsApp Anda."
        );
      } finally {
        setLoading(false);
      }
    };

    initialize();
  }, []);

  const handleIdentityChange = (field: keyof ConsentIdentityDto, value: string) => {
    setIdentity((prev) => ({ ...prev, [field]: value }));
  };

  const handlePreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate identity fields
    if (
      !identity.full_name.trim() ||
      !identity.nim.trim() ||
      !identity.faculty.trim() ||
      !identity.study_program.trim() ||
      !identity.birthplace.trim() ||
      !identity.date_of_birth.trim() ||
      !identity.phone_e164.trim()
    ) {
      setError("Seluruh kolom data identitas peserta wajib dilengkapi.");
      return;
    }

    if (!agreementAccepted) {
      setError("Anda wajib mencentang persetujuan pernyataan kesediaan.");
      return;
    }

    if (!signatureDataUrl) {
      setError("Silakan bubuhkan tanda tangan elektronik Anda pada kotak yang disediakan.");
      return;
    }

    setShowConfirmDialog(true);
  };

  const handleFinalSubmit = async () => {
    if (!signatureDataUrl) return;

    setSubmitting(true);
    setError(null);

    try {
      const result = await consentApi.signGuestConsent(
        {
          signature_base64: signatureDataUrl,
          agreement_accepted: true,
          identity,
        },
        guestToken || undefined
      );

      setConsent(result.consent);
      setShowConfirmDialog(false);
    } catch (err: unknown) {
      setShowConfirmDialog(false);
      setError(err instanceof Error ? err.message : "Gagal menyimpan tanda tangan dan menyelesaikan persetujuan.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!consent) return;
    setDownloadingDoc(true);
    try {
      const res = await consentApi.getGuestSignedDocumentUrl(60, guestToken || undefined);
      if (res.downloadUrl) {
        window.open(res.downloadUrl, "_blank", "noopener,noreferrer");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal mengunduh dokumen persetujuan.");
    } finally {
      setDownloadingDoc(false);
    }
  };

  const isSigned = consent?.status === "signed";

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        {/* Top bar */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 hover:text-emerald-950 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Kembali ke Beranda SiCARE</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-600 animate-pulse" />
            <span className="text-xs font-semibold text-slate-600">Portal Undangan Peserta</span>
          </div>
        </div>

        {/* Card Container */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          {/* Header */}
          <div className="border-b border-emerald-900 bg-[#064E3B] px-6 py-5 text-white">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-700/60 bg-emerald-800/80 text-emerald-200">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-lg font-bold sm:text-xl">
                  Informed Consent (Surat Pernyataan Kesediaan)
                </h1>
                <p className="text-xs text-emerald-200">
                  Lembaga Misi & Identitas (LMI) — Unika De La Salle Manado
                </p>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="p-6 sm:p-8 space-y-6 text-slate-700">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-800" />
                <p className="text-sm font-medium">Memverifikasi tautan undangan peserta...</p>
              </div>
            ) : error && !consent ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-900 space-y-3">
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-6 w-6 text-red-600 shrink-0" />
                  <h3 className="font-bold text-base">Undangan Tidak Dapat Diakses</h3>
                </div>
                <p className="text-sm text-red-700">{error}</p>
                <div className="pt-2">
                  <Link
                    to="/"
                    className="inline-flex items-center gap-2 rounded-xl bg-red-700 px-4 py-2 text-xs font-semibold text-white hover:bg-red-800 transition"
                  >
                    Kembali ke Beranda
                  </Link>
                </div>
              </div>
            ) : isSigned ? (
              /* Signed Success State */
              <div className="space-y-6 py-4">
                <div className="flex flex-col sm:flex-row items-center gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center sm:text-left">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-emerald-300 bg-emerald-100 text-emerald-800">
                    <CheckCircle2 className="h-10 w-10" />
                  </div>
                  <div className="flex-1">
                    <span className="inline-block rounded-full bg-emerald-200 px-3 py-0.5 text-xs font-bold text-emerald-900 mb-2">
                      Persetujuan Telah Ditandatangani & Sah
                    </span>
                    <h2 className="text-lg font-bold text-slate-900">
                      Informed Consent Resmi Anda Telah Tersimpan
                    </h2>
                    <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                      Terima kasih telah melengkapi surat pernyataan kesediaan konseling kelompok.
                      Dokumen resmi Anda telah digabungkan dengan tanda tangan elektronik dan tersimpan
                      dengan aman.
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs space-y-2.5 text-slate-600">
                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span className="text-slate-500">Penandatangan:</span>
                    <span className="font-semibold text-slate-900">
                      {consent.signer_name_snapshot || identity.full_name}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span className="text-slate-500">Waktu Penandatanganan:</span>
                    <span className="font-semibold text-slate-900">
                      {consent.signed_at
                        ? new Date(consent.signed_at).toLocaleString("id-ID", {
                            dateStyle: "full",
                            timeStyle: "medium",
                          })
                        : "-"}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span className="text-slate-500">Versi Templat Resmi:</span>
                    <span className="font-semibold text-slate-900">
                      {consent.consent_statement_version || "v1.0"}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Integritas Hash (SHA-256):</span>
                    <span className="font-mono text-[10px] text-slate-700 truncate max-w-[200px] sm:max-w-[360px]">
                      {consent.signed_document_sha256 || "Terverifikasi"}
                    </span>
                  </div>
                </div>

                <div className="pt-4 flex justify-center sm:justify-end">
                  <button
                    type="button"
                    onClick={handleDownloadPdf}
                    disabled={downloadingDoc}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#064E3B] px-6 py-3 text-sm font-semibold text-white shadow-md hover:bg-emerald-950 transition disabled:opacity-50"
                  >
                    {downloadingDoc ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    <span>Unduh Dokumen PDF Resmi</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Signing Form Workflow */
              <form onSubmit={handlePreSubmit} className="space-y-6">
                {error && (
                  <div className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Banner Dokumen Resmi */}
                <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
                  <ShieldCheck className="h-5 w-5 text-emerald-800 shrink-0 mt-0.5" />
                  <div>
                    <span className="inline-block rounded bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-800 uppercase tracking-wide">
                      RAHASIA & DILINDUNGI
                    </span>
                    <p className="mt-1 leading-relaxed">
                      Dokumen ini merupakan pernyataan kesediaan sukarela mengikuti konseling dengan
                      psikolog di Lembaga Misi & Identitas (LMI) Unika De La Salle Manado. Identitas dan
                      tanda tangan Anda akan digabungkan ke dalam templat resmi.
                    </p>
                  </div>
                </div>

                {/* Data Identitas Peserta */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 border-b border-slate-200 pb-2 text-sm font-bold text-slate-900">
                    <User className="h-4 w-4 text-emerald-800" />
                    <h3>Data Identitas Peserta</h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">
                        Nama Lengkap *
                      </label>
                      <input
                        type="text"
                        value={identity.full_name}
                        onChange={(e) => handleIdentityChange("full_name", e.target.value)}
                        placeholder="Nama lengkap sesuai KTM/KTP"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-700 focus:outline-none focus:ring-1 focus:ring-emerald-700"
                        required
                      />
                    </div>

                    <div>
                      <label className="block font-medium text-slate-700 mb-1">
                        NIM (Nomor Induk Mahasiswa) *
                      </label>
                      <input
                        type="text"
                        value={identity.nim}
                        onChange={(e) => handleIdentityChange("nim", e.target.value)}
                        placeholder="Contoh: 210111045"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-700 focus:outline-none focus:ring-1 focus:ring-emerald-700"
                        required
                      />
                    </div>

                    <div>
                      <label className="block font-medium text-slate-700 mb-1">Fakultas *</label>
                      <input
                        type="text"
                        value={identity.faculty}
                        onChange={(e) => handleIdentityChange("faculty", e.target.value)}
                        placeholder="Contoh: Fakultas Teknik"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-700 focus:outline-none focus:ring-1 focus:ring-emerald-700"
                        required
                      />
                    </div>

                    <div>
                      <label className="block font-medium text-slate-700 mb-1">
                        Program Studi *
                      </label>
                      <input
                        type="text"
                        value={identity.study_program}
                        onChange={(e) => handleIdentityChange("study_program", e.target.value)}
                        placeholder="Contoh: Teknik Informatika"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-700 focus:outline-none focus:ring-1 focus:ring-emerald-700"
                        required
                      />
                    </div>

                    <div>
                      <label className="block font-medium text-slate-700 mb-1">
                        Tempat Lahir *
                      </label>
                      <input
                        type="text"
                        value={identity.birthplace}
                        onChange={(e) => handleIdentityChange("birthplace", e.target.value)}
                        placeholder="Kota tempat lahir"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-700 focus:outline-none focus:ring-1 focus:ring-emerald-700"
                        required
                      />
                    </div>

                    <div>
                      <label className="block font-medium text-slate-700 mb-1">
                        Tanggal Lahir *
                      </label>
                      <input
                        type="date"
                        value={identity.date_of_birth}
                        onChange={(e) => handleIdentityChange("date_of_birth", e.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-700 focus:outline-none focus:ring-1 focus:ring-emerald-700"
                        required
                      />
                    </div>

                    <div>
                      <label className="block font-medium text-slate-700 mb-1">
                        Jenis Kelamin *
                      </label>
                      <select
                        value={identity.gender}
                        onChange={(e) =>
                          handleIdentityChange("gender", e.target.value as "Laki-laki" | "Perempuan")
                        }
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-700 focus:outline-none focus:ring-1 focus:ring-emerald-700"
                        required
                      >
                        <option value="Laki-laki">Laki-laki</option>
                        <option value="Perempuan">Perempuan</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-medium text-slate-700 mb-1">
                        Nomor WhatsApp *
                      </label>
                      <input
                        type="tel"
                        value={identity.phone_e164}
                        onChange={(e) => handleIdentityChange("phone_e164", e.target.value)}
                        placeholder="Contoh: 081234567890"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-700 focus:outline-none focus:ring-1 focus:ring-emerald-700"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Ketentuan & Klausul Kesediaan */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 border-b border-slate-200 pb-2 text-sm font-bold text-slate-900">
                    <FileText className="h-4 w-4 text-emerald-800" />
                    <h3>Ketentuan & Klausul Kesediaan</h3>
                  </div>

                  <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed text-slate-700">
                    <p>
                      <strong>1. Kesukarelaan:</strong> Menyatakan setuju dan bersedia untuk
                      menjalani sesi bimbingan dan konseling dengan psikolog. Saya menyadari bahwa
                      keikutsertaan saya dalam proses bimbingan dan konseling ini bermula dari
                      kebutuhan pribadi untuk mendapatkan bantuan psikologis, sehingga bersifat
                      sukarela, tanpa adanya paksaan dari pihak manapun.
                    </p>
                    <p>
                      <strong>2. Jaminan Kerahasiaan:</strong> Saya bertanggung jawab untuk
                      menunjang keberlangsungan sesi. Saya memahami bahwa informasi yang saya
                      berikan akan terjamin kerahasiaannya.
                    </p>
                    <p>
                      <strong>3. Rencana Keselamatan:</strong> Untuk rencana keselamatan, saya
                      memahami bahwa data dan identitas saya akan diserahkan kepada pihak yang
                      berwenang jika ada resiko yang mengancam saya (klien), psikolog, atau pihak
                      lain. Jika demikian, maka psikolog wajib dan berhak untuk bekerja sama dengan
                      pihak lain yang berwenang.
                    </p>
                  </div>
                </div>

                {/* Pernyataan Kesediaan Checkbox */}
                <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
                  <input
                    id="guest-agreement-checkbox"
                    type="checkbox"
                    checked={agreementAccepted}
                    onChange={(e) => setAgreementAccepted(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-800 focus:ring-emerald-700 cursor-pointer"
                  />
                  <label
                    htmlFor="guest-agreement-checkbox"
                    className="cursor-pointer text-xs font-medium leading-relaxed text-slate-800"
                  >
                    Saya menyatakan telah membaca, memahami seluruh ketentuan di atas, dan dengan
                    sukarela menyetujui untuk menjalani sesi bimbingan dan konseling dengan psikolog
                    LMI Unika De La Salle Manado. *
                  </label>
                </div>

                {/* Kanvas Tanda Tangan */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2 text-sm font-bold text-slate-900">
                    <span className="flex items-center gap-2">
                      <Lock className="h-4 w-4 text-emerald-800" />
                      Tanda Tangan Elektronik Anda
                    </span>
                    <span className="text-[11px] font-normal text-slate-400">
                      Manado, {new Date().toLocaleDateString("id-ID")}
                    </span>
                  </div>

                  <SignaturePad onSignatureChange={setSignatureDataUrl} height={160} />
                </div>

                {/* Submit */}
                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={!agreementAccepted || !signatureDataUrl || submitting}
                    className="flex items-center gap-2 rounded-xl bg-[#064E3B] px-6 py-3 text-sm font-semibold text-white shadow-md hover:bg-emerald-950 transition disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <span>Lanjutkan Konfirmasi</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Dialog Konfirmasi Final */}
      {showConfirmDialog && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-emerald-900">
              <ShieldCheck className="h-6 w-6 text-emerald-700" />
              <h4 className="font-bold text-base">Konfirmasi Tanda Tangan</h4>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Dengan menekan <strong>"Ya, Tanda Tangani & Simpan"</strong>, Anda secara sadar dan
              resmi menandatangani Surat Pernyataan Kesediaan (Informed Consent) ini. Dokumen PDF
              resmi akan dibuat dan tidak dapat diubah setelah ditandatangani.
            </p>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs space-y-1.5 text-slate-600">
              <div>
                Nama: <strong className="text-slate-800">{identity.full_name}</strong>
              </div>
              <div>
                NIM: <strong className="text-slate-800">{identity.nim}</strong>
              </div>
              <div>
                Program Studi: <strong className="text-slate-800">{identity.study_program}</strong>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmDialog(false)}
                disabled={submitting}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleFinalSubmit}
                disabled={submitting}
                className="flex items-center gap-2 rounded-xl bg-[#064E3B] px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-950 transition disabled:opacity-50"
              >
                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>{submitting ? "Memproses Dokumen..." : "Ya, Tanda Tangani & Simpan"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
