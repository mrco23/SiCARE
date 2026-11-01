import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  CalendarCheck2,
  CalendarDays,
  CalendarX,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  MessageSquareHeart,
  Printer,
  RefreshCw,
  ShieldCheck,
  Star,
  Users,
} from "lucide-react";
import { PageContainer, PageHeader } from "../../components/shared";
import { MetricCard } from "../../components/headlmi/MetricCard";
import { reportingApi } from "../../lib/reportingApi";
import type { AdminReportDto } from "../../types/api";
import {
  describeApiError,
  fillMonthlyRange,
  formatIsoDate,
  formatIsoDateTime,
  formatMonthKey,
  formatRating,
  percent,
} from "../../features/headlmi/shared/presentation";

function Stars({ rating, size = "h-3.5 w-3.5" }: { rating: number; size?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`Rating ${rating} dari 5`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`${size} ${star <= rating ? "fill-amber-400 text-amber-400" : "text-slate-200"}`}
        />
      ))}
    </span>
  );
}

function downloadCSV(filename: string, data: (string | number)[][]) {
  const csv = data
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function KepalaLMILaporanPage() {
  const [report, setReport] = useState<AdminReportDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedAt, setLoadedAt] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    return reportingApi.getHeadLmiReport();
  }, []);

  useEffect(() => {
    let active = true;
    void fetchReport()
      .then((data) => {
        if (!active) return;
        setReport(data);
        setError(null);
        setLoadedAt(new Date().toISOString());
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(describeApiError(err, "Gagal memuat laporan layanan konseling dari server."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [fetchReport]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setError(null);
    try {
      const data = await fetchReport();
      setReport(data);
      setLoadedAt(new Date().toISOString());
    } catch (err: unknown) {
      setError(describeApiError(err, "Gagal memuat laporan layanan konseling dari server."));
    } finally {
      setRefreshing(false);
    }
  };

  const monthly = useMemo(() => (report ? fillMonthlyRange(report) : []), [report]);

  const maxMonthValue = useMemo(() => {
    if (!monthly.length) return 1;
    return Math.max(
      1,
      ...monthly.map((m) => Math.max(m.completed_sessions, m.bookings, m.feedback_count)),
    );
  }, [monthly]);

  const completionRate = useMemo(() => {
    if (!report) return 0;
    const totalSessions = report.totals.completed_sessions + report.totals.cancelled_sessions;
    return percent(report.totals.completed_sessions, totalSessions);
  }, [report]);

  const cancellationRate = useMemo(() => {
    if (!report) return 0;
    const totalSessions = report.totals.completed_sessions + report.totals.cancelled_sessions;
    return percent(report.totals.cancelled_sessions, totalSessions);
  }, [report]);

  const handleExportCsv = () => {
    if (!report) return;
    const data: (string | number)[][] = [
      ["Laporan Layanan Konseling SiCARE - Panel Kepala LMI"],
      ["Rentang Laporan", `${formatIsoDate(report.period.from)} s/d ${formatIsoDate(report.period.to)}`],
      ["Waktu Ekspor", new Date().toLocaleString("id-ID")],
      ["Status Pemotongan Data (1000 max)", report.truncated ? "Ya (mencapai batas)" : "Tidak (lengkap)"],
      [],
      ["Indikator Agregat", "Nilai"],
      ["Total Booking", report.totals.bookings],
      ["Sesi Selesai", report.totals.completed_sessions],
      ["Sesi Dibatalkan", report.totals.cancelled_sessions],
      ["Tingkat Penyelesaian Sesi", `${completionRate}%`],
      ["Tingkat Pembatalan Sesi", `${cancellationRate}%`],
      ["Total Feedback", report.totals.feedback],
      ["Feedback Ditampilkan Publik", report.totals.shown_feedback],
      ["Rata-rata Rating", report.totals.average_rating ? report.totals.average_rating.toFixed(2) : "-"],
      ["Konselor Aktif Tercatat", report.counselors.length],
      [],
      ["Tren Bulanan", "Booking", "Sesi Selesai", "Feedback"],
      ...monthly.map((m) => [m.month, m.bookings, m.completed_sessions, m.feedback_count]),
      [],
      ["Konselor", "Total Booking", "Sesi Selesai", "Jumlah Feedback", "Rata-rata Rating"],
      ...report.counselors.map((c) => [
        c.counselor_name,
        c.bookings,
        c.completed_sessions,
        c.feedback_count,
        c.average_rating ? c.average_rating.toFixed(2) : "-",
      ]),
    ];
    downloadCSV(`laporan-kepala-lmi-${new Date().toISOString().slice(0, 10)}.csv`, data);
  };

  if (loading) {
    return (
      <PageContainer role="headlmi" className="space-y-6 text-slate-800">
        <PageHeader
          eyebrow="Panel Pimpinan"
          title="Laporan Layanan Konseling"
          description="Rekapitulasi pelaksanaan layanan, pembatalan, dan distribusi sesi per konselor untuk mendukung evaluasi LMI."
        />
        <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-medium text-slate-600">Memuat laporan dari server…</p>
        </div>
      </PageContainer>
    );
  }

  if (error || !report) {
    return (
      <PageContainer role="headlmi" className="space-y-6 text-slate-800">
        <PageHeader
          eyebrow="Panel Pimpinan"
          title="Laporan Layanan Konseling"
          description="Rekapitulasi pelaksanaan layanan, pembatalan, dan distribusi sesi per konselor untuk mendukung evaluasi LMI."
        />
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
          <div className="rounded-full bg-red-50 p-3 text-red-600">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Gagal Memuat Laporan</h3>
            <p className="mt-1 text-sm text-slate-600">{error ?? "Data laporan tidak ditemukan."}</p>
          </div>
          <button
            type="button"
            onClick={() => void handleRefresh()}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark"
          >
            <RefreshCw className="h-4 w-4" />
            Coba Lagi
          </button>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer role="headlmi" className="report-print-page space-y-6 text-slate-800">
      <PageHeader
        eyebrow="Panel Pimpinan"
        title="Laporan Layanan Konseling"
        description="Rekapitulasi pelaksanaan layanan, pembatalan, dan distribusi sesi per konselor untuk mendukung evaluasi LMI."
        actions={
          <div className="no-print flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => void handleRefresh()}
              disabled={refreshing}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Segarkan
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              Ekspor CSV
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-dark"
            >
              <Printer className="h-4 w-4" />
              Cetak / PDF
            </button>
          </div>
        }
      />

      {/* Truncated Data Warning Banner */}
      {report.truncated && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs leading-relaxed text-amber-900 shadow-xs">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <span>
            <strong>Perhatian Batas Data:</strong> Sebagian sumber data query mencapai batas maksimal 1.000 baris.
            Laporan ini merefleksikan 1.000 record teratas dalam rentang 12 bulan terakhir dan mungkin belum mencakup
            seluruh riwayat database.
          </span>
        </div>
      )}

      {/* Period Banner */}
      <section className="rounded-2xl border border-[#d6eadc] bg-gradient-to-r from-[#f0faf3] to-white p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#32734f]">
              Periode Rentang Laporan Aktual
            </p>
            <h2 className="mt-1 text-lg font-bold text-slate-900">
              {formatIsoDate(report.period.from)} – {formatIsoDate(report.period.to)}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Agregasi backend mencakup data sekitar 12 bulan terakhir.
              {loadedAt && ` Terakhir diperbarui ${formatIsoDateTime(loadedAt)}.`}
            </p>
          </div>
          <Link
            to="/kepala-lmi"
            className="no-print inline-flex items-center justify-center gap-2 self-start rounded-xl border border-[#cce3d3] bg-white px-4 py-2 text-sm font-semibold text-primary transition hover:bg-[#f6fcf8] sm:self-auto"
          >
            Kembali ke beranda <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Ringkasan Eksekutif */}
      <section className="space-y-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">Ringkasan Eksekutif Layanan</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Angka agregat volume layanan konseling, pelaksanaan, dan kepuasan mahasiswa.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Total Booking Masuk"
            value={report.totals.bookings}
            note="Seluruh permohonan booking dalam rentang laporan"
            icon={CalendarDays}
            tone="blue"
          />
          <MetricCard
            label="Sesi Selesai Terlaksana"
            value={report.totals.completed_sessions}
            note={`${completionRate}% dari total sesi yang tercatat`}
            icon={CheckCircle2}
            tone="green"
          />
          <MetricCard
            label="Sesi Dibatalkan"
            value={report.totals.cancelled_sessions}
            note={`${cancellationRate}% dari total sesi yang tercatat`}
            icon={CalendarX}
            tone="red"
          />
          <MetricCard
            label="Konselor Aktif"
            value={report.counselors.length}
            note="Konselor yang tercatat aktif dalam sistem"
            icon={Users}
            tone="gold"
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <MetricCard
            label="Total Feedback Pengguna"
            value={report.totals.feedback}
            note="Ulasan kepuasan yang dikirim klien"
            icon={MessageSquareHeart}
            tone="blue"
          />
          <MetricCard
            label="Feedback Ditampilkan Publik"
            value={report.totals.shown_feedback}
            note="Ulasan yang disetujui Admin untuk publik"
            icon={CalendarCheck2}
            tone="green"
          />
          <MetricCard
            label="Rata-rata Rating Layanan"
            value={formatRating(report.totals.average_rating)}
            note="Skala kepuasan 1 sampai 5"
            icon={Star}
            tone="gold"
          />
        </div>
      </section>

      {/* Visualisasi Tren Bulanan & Evaluasi */}
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 xl:col-span-2 print-break-inside">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="font-bold text-slate-900">Tren Layanan per Bulan</h2>
              <p className="mt-1 text-xs text-slate-500">
                Perbandingan jumlah sesi selesai, booking masuk, dan feedback klien.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-[11px] font-medium text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-xs bg-[#15803d]" />
                Sesi Selesai
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-xs bg-sky-400" />
                Booking
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-xs bg-amber-400" />
                Feedback
              </span>
            </div>
          </div>

          {monthly.length === 0 ? (
            <div className="flex h-52 items-center justify-center text-sm text-slate-400">
              Belum ada riwayat aktivitas pada rentang laporan ini.
            </div>
          ) : (
            <>
              <div className="mt-6 flex h-52 items-end gap-2 border-b border-slate-100 pb-2 sm:gap-3">
                {monthly.map((month) => {
                  const sHeight = month.completed_sessions > 0 ? (month.completed_sessions / maxMonthValue) * 100 : 4;
                  const bHeight = month.bookings > 0 ? (month.bookings / maxMonthValue) * 100 : 4;
                  const fHeight = month.feedback_count > 0 ? (month.feedback_count / maxMonthValue) * 100 : 4;

                  return (
                    <div
                      key={month.month}
                      className="flex h-full min-w-0 flex-1 flex-col items-center justify-end"
                      title={`${formatMonthKey(month.month)}: ${month.completed_sessions} sesi selesai, ${month.bookings} booking, ${month.feedback_count} feedback`}
                    >
                      <div className="flex w-full items-end justify-center gap-0.5 sm:gap-1">
                        <div
                          className="w-full max-w-[14px] rounded-t-xs bg-[#15803d] transition-all"
                          style={{ height: `${sHeight}%` }}
                        />
                        <div
                          className="w-full max-w-[14px] rounded-t-xs bg-sky-400 transition-all"
                          style={{ height: `${bHeight}%` }}
                        />
                        <div
                          className="w-full max-w-[14px] rounded-t-xs bg-amber-400 transition-all"
                          style={{ height: `${fHeight}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 flex gap-2 sm:gap-3">
                {monthly.map((month) => (
                  <div
                    key={month.month}
                    className="min-w-0 flex-1 truncate text-center text-[10px] font-semibold text-slate-500"
                  >
                    {formatMonthKey(month.month, false)}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Panel Evaluasi Layanan */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 print-break-inside">
          <div>
            <h2 className="font-bold text-slate-900">Kinerja Pelaksanaan Layanan</h2>
            <p className="mt-1 text-xs text-slate-500">
              Rasio efektivitas penyelesaian sesi terhadap pembatalan dalam rentang laporan.
            </p>

            <div className="mt-5 space-y-4">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-semibold text-slate-500">Total Sesi Tercatat</p>
                <p className="mt-1 text-3xl font-extrabold text-slate-900">
                  {report.totals.completed_sessions + report.totals.cancelled_sessions}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {report.totals.completed_sessions} sesi selesai · {report.totals.cancelled_sessions} dibatalkan
                </p>
              </div>

              <div>
                <div className="mb-1 flex justify-between text-xs font-semibold text-slate-700">
                  <span>Tingkat Penyelesaian Sesi</span>
                  <span className="text-[#15803d]">{completionRate}%</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-[#15803d]" style={{ width: `${completionRate}%` }} />
                </div>
              </div>

              <div>
                <div className="mb-1 flex justify-between text-xs font-semibold text-slate-700">
                  <span>Tingkat Pembatalan Sesi</span>
                  <span className="text-rose-600">{cancellationRate}%</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-rose-500" style={{ width: `${cancellationRate}%` }} />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 border-t border-slate-100 pt-3">
            <p className="text-[11px] leading-relaxed text-slate-400">
              Perbandingan semester membutuhkan kueri filter periode akademik spesifik di backend, yang dapat dijadwalkan pada pengembangan lanjutan.
            </p>
          </div>
        </div>
      </section>

      {/* Tabel Distribusi Layanan per Konselor */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm print-break-inside">
        <div className="border-b border-slate-100 p-4 sm:p-5">
          <h2 className="font-bold text-slate-900">Distribusi Beban & Aktivitas per Konselor</h2>
          <p className="mt-1 text-xs text-slate-500">
            Ringkasan sesi dan ulasan berdasarkan konselor aktif. Angka ini mencerminkan persebaran aktivitas layanan,
            bukan penilaian tunggal atas mutu konseling.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Nama Konselor</th>
                <th className="px-4 py-3 text-right">Total Booking</th>
                <th className="px-4 py-3 text-right">Sesi Selesai</th>
                <th className="px-4 py-3 text-right">Feedback</th>
                <th className="px-4 py-3">Rata-rata Rating</th>
                <th className="px-4 py-3 text-right">Rasio Selesai / Booking</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {report.counselors.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-sm text-slate-400">
                    Belum ada data konselor aktif dalam rentang laporan ini.
                  </td>
                </tr>
              ) : (
                report.counselors.map((counselor) => {
                  const ratio = percent(counselor.completed_sessions, counselor.bookings);
                  return (
                    <tr key={counselor.counselor_id} className="hover:bg-slate-50/70">
                      <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-800">
                        {counselor.counselor_name}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700">{counselor.bookings}</td>
                      <td className="px-4 py-3 text-right font-semibold text-primary">
                        {counselor.completed_sessions}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700">{counselor.feedback_count}</td>
                      <td className="px-4 py-3">
                        {counselor.average_rating !== null ? (
                          <span className="inline-flex items-center gap-1.5">
                            <Stars rating={Math.round(counselor.average_rating)} />
                            <strong className="text-slate-800">{formatRating(counselor.average_rating)}</strong>
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">–</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-600">{ratio}%</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Informasi Privasi & Keamanan Data */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 print-break-inside">
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-slate-100 p-2.5 text-slate-700">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-bold text-slate-900">Perlindungan Kerahasiaan Mahasiswa</h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              Laporan eksekutif Kepala LMI menyajikan data dalam bentuk agregat organisasi. Detail rekam medis,
              catatan konseling klinis pribadi, dan identitas mahasiswa dilindungi secara ketat sesuai kode etik
              layanan bimbingan dan konseling.
            </p>
          </div>
        </div>
      </section>

      {/* Cetak Footer */}
      <div className="no-print flex flex-col gap-4 rounded-2xl border border-[#d6eadc] bg-[#f5fbf6] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-white p-2.5 text-primary shadow-sm">
            <Printer className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-bold text-slate-900">Cetak atau Simpan Laporan PDF</h2>
            <p className="mt-1 text-sm text-slate-500">
              Gunakan fitur cetak browser lalu pilih &ldquo;Simpan sebagai PDF&rdquo; untuk mengarsipkan laporan pimpinan.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark"
        >
          <Printer className="h-4 w-4" />
          Cetak / PDF
        </button>
      </div>

      <p className="pb-3 text-center text-[11px] text-slate-400 print:text-[10px]">
        Dokumen laporan resmi SiCARE. Dibuat otomatis dari data backend pada {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}.
      </p>
    </PageContainer>
  );
}
