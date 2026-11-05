/**
 * Dokumen cetak A4 mengikuti template "Laporan Bimbingan & Konseling" LMI: sampul,
 * stempel CONFIDENTIAL, footer bernomor halaman, Kesimpulan dan Saran, serta tanda
 * tangan. Hanya berisi data agregat; identitas klien, jawaban intake, catatan
 * konseling, dan teks bebas (komentar, alasan pembatalan) tidak dimuat.
 */

export interface ReportPrintSession {
  id: string;
  shortId: string;
  date: string;
  format: string;
  counselor: string;
  outcome: string;
}

export interface ReportPrintData {
  role: "admin" | "headlmi";
  periodLabel: string;
  periodRange: string;
  dataLimited: boolean;
  totals: { sessions: number; done: number; cancelled: number };
  individual: { done: number; cancelled: number };
  group: { done: number; cancelled: number };
  months: { label: string; done: number; cancelled: number }[];
  counselors: {
    counselor: string;
    individualDone: number;
    groupDone: number;
    totalCancelled: number;
    totalSessions: number;
  }[];
  cancellations: { category: string; count: number }[];
  rating: { average: number; total: number; distribution: { star: number; count: number }[] };
  sessions: ReportPrintSession[];
  conclusion: string;
  signer: { name: string; identityCode: string | null };
}

const SIGN_LINE = "______________________";

const percent = (part: number, whole: number) =>
  whole ? `${Math.round((part / whole) * 100)}%` : "0%";

const longDate = (value: Date) =>
  value.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <tr>
      <td className="rp-label">{label}</td>
      <td className="rp-colon">:</td>
      <td>{value}</td>
    </tr>
  );
}

function MonthlyBars({ months }: { months: ReportPrintData["months"] }) {
  const max = Math.max(1, ...months.map((m) => m.done + m.cancelled));
  return (
    <div className="rp-chart">
      {months.map((month) => {
        const total = month.done + month.cancelled;
        return (
          <div key={month.label} className="rp-chart-col">
            <span className="rp-chart-value">{total}</span>
            <div className="rp-chart-bar" style={{ height: `${(total / max) * 100}%` }}>
              <div className="rp-chart-cancel" style={{ flexGrow: month.cancelled }} />
              <div className="rp-chart-done" style={{ flexGrow: month.done }} />
            </div>
            <span className="rp-chart-label">{month.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function CounselingReportPrint({ data }: { data: ReportPrintData }) {
  const isAdmin = data.role === "admin";
  const letters = "ABCDEFGH";
  let index = 0;
  const heading = (title: string) => `${letters[index++]}. ${title}`;
  const totalMonths = data.months.reduce(
    (sum, month) => sum + month.done + month.cancelled,
    0,
  );

  return (
    <div className="report-print-only">
      {/* Sampul */}
      <section className="rp-cover">
        <h1 className="rp-cover-title">
          LAPORAN
          <br />
          BIMBINGAN &amp; KONSELING
        </h1>
        <p className="rp-cover-period">{data.periodLabel}</p>
        <img src="/kampus.png" alt="Logo Universitas Katolik De La Salle Manado" className="rp-cover-logo" />
        <p className="rp-cover-org">
          Lembaga Misi &amp; Identitas (LMI)
          <br />
          Div. Bimbingan &amp; Konseling
        </p>
        <p className="rp-cover-org">
          Universitas Katolik De La Salle
          <br />
          Manado
        </p>
      </section>

      <section>
        <h2 className="rp-heading">{heading("Identitas Laporan")}</h2>
        <table className="rp-info">
          <tbody>
            <Row label="Jenis laporan" value={isAdmin ? "Laporan Layanan Konseling (Admin LMI)" : "Laporan Evaluasi Layanan (Kepala LMI)"} />
            <Row label="Periode" value={data.periodLabel} />
            <Row label="Rentang tanggal" value={data.periodRange} />
            <Row label="Tanggal cetak" value={longDate(new Date())} />
            <Row label="Sumber data" value="Sistem SiCARE" />
            <Row label="Cakupan" value="Data agregat layanan. Tidak memuat identitas klien, jawaban intake, dan catatan konseling." />
          </tbody>
        </table>
        {data.dataLimited && (
          <p className="rp-note">
            Perhatian: data pada laporan ini mencapai batas pembacaan sistem, sehingga
            sebagian data lama mungkin tidak terhitung.
          </p>
        )}
      </section>

      <section className="rp-keep">
        <h2 className="rp-heading">{heading("Ringkasan Layanan")}</h2>
        <table className="rp-table">
          <thead>
            <tr>
              <th>Uraian</th>
              <th className="rp-num">Jumlah</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Total booking dan sesi</td><td className="rp-num">{data.totals.sessions}</td></tr>
            <tr><td>Sesi selesai</td><td className="rp-num">{data.totals.done}</td></tr>
            <tr><td>Sesi dibatalkan/ditolak</td><td className="rp-num">{data.totals.cancelled}</td></tr>
            <tr><td>Konseling individu selesai</td><td className="rp-num">{data.individual.done}</td></tr>
            <tr><td>Konseling individu dibatalkan</td><td className="rp-num">{data.individual.cancelled}</td></tr>
            <tr><td>Konseling kelompok selesai</td><td className="rp-num">{data.group.done}</td></tr>
            <tr><td>Konseling kelompok dibatalkan</td><td className="rp-num">{data.group.cancelled}</td></tr>
            <tr><td>Tingkat penyelesaian</td><td className="rp-num">{percent(data.totals.done, data.totals.sessions)}</td></tr>
          </tbody>
        </table>
      </section>

      <section className="rp-keep">
        <h2 className="rp-heading">{heading("Perkembangan per Bulan")}</h2>
        {data.months.length === 0 ? (
          <p>Belum ada data pada periode ini.</p>
        ) : (
          <>
            {totalMonths > 0 && <MonthlyBars months={data.months} />}
            <table className="rp-table">
              <thead>
                <tr>
                  <th>Bulan</th>
                  <th className="rp-num">Selesai</th>
                  <th className="rp-num">Dibatalkan</th>
                  <th className="rp-num">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.months.map((month) => (
                  <tr key={month.label}>
                    <td>{month.label}</td>
                    <td className="rp-num">{month.done}</td>
                    <td className="rp-num">{month.cancelled}</td>
                    <td className="rp-num">{month.done + month.cancelled}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>

      <section>
        <h2 className="rp-heading">{heading("Layanan per Konselor")}</h2>
        {data.counselors.length === 0 ? (
          <p>Belum ada data layanan konselor pada periode ini.</p>
        ) : (
          <table className="rp-table">
            <thead>
              <tr>
                <th>Konselor</th>
                <th className="rp-num">Individu selesai</th>
                <th className="rp-num">Kelompok selesai</th>
                <th className="rp-num">Dibatalkan</th>
                <th className="rp-num">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.counselors.map((row) => (
                <tr key={row.counselor}>
                  <td>{row.counselor}</td>
                  <td className="rp-num">{row.individualDone}</td>
                  <td className="rp-num">{row.groupDone}</td>
                  <td className="rp-num">{row.totalCancelled}</td>
                  <td className="rp-num">{row.totalSessions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="rp-keep">
        <h2 className="rp-heading">{heading("Analisis Pembatalan")}</h2>
        {data.cancellations.length === 0 ? (
          <p>Tidak ada pembatalan pada periode ini.</p>
        ) : (
          <table className="rp-table">
            <thead>
              <tr>
                <th>Kategori</th>
                <th className="rp-num">Jumlah</th>
                <th className="rp-num">Persentase</th>
              </tr>
            </thead>
            <tbody>
              {data.cancellations.map((row) => (
                <tr key={row.category}>
                  <td>{row.category}</td>
                  <td className="rp-num">{row.count}</td>
                  <td className="rp-num">{percent(row.count, data.totals.cancelled)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="rp-keep">
        <h2 className="rp-heading">{heading("Evaluasi Layanan")}</h2>
        <table className="rp-info">
          <tbody>
            <Row label="Rata-rata rating" value={data.rating.total ? `${data.rating.average.toFixed(1).replace(".", ",")} dari 5` : "-"} />
            <Row label="Jumlah ulasan" value={data.rating.total} />
          </tbody>
        </table>
        <table className="rp-table">
          <thead>
            <tr>
              <th>Rating</th>
              <th className="rp-num">Jumlah</th>
              <th className="rp-num">Persentase</th>
            </tr>
          </thead>
          <tbody>
            {data.rating.distribution.map((row) => (
              <tr key={row.star}>
                <td>Bintang {row.star}</td>
                <td className="rp-num">{row.count}</td>
                <td className="rp-num">
                  {percent(row.count, data.rating.distribution.reduce((sum, item) => sum + item.count, 0))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {isAdmin && (
        <section>
          <h2 className="rp-heading">{heading("Rincian Sesi")}</h2>
          {data.sessions.length === 0 ? (
            <p>Belum ada sesi pada periode ini.</p>
          ) : (
            <table className="rp-table">
              <thead>
                <tr>
                  <th>ID Booking</th>
                  <th>Tanggal</th>
                  <th>Jenis</th>
                  <th>Konselor</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.sessions.map((row) => (
                  <tr key={row.id}>
                    <td>{row.shortId}</td>
                    <td>{longDate(new Date(`${row.date}T00:00:00`))}</td>
                    <td>{row.format}</td>
                    <td>{row.counselor}</td>
                    <td>{row.outcome}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      <section className="rp-keep">
        <h2 className="rp-heading">{heading("Kesimpulan dan Saran")}</h2>
        {data.conclusion.trim() ? (
          <p className="rp-conclusion">{data.conclusion.trim()}</p>
        ) : (
          <div className="rp-blank" />
        )}

        <div className={`rp-sign ${isAdmin ? "rp-sign-two" : ""}`}>
          {isAdmin && (
            <div>
              <p>&nbsp;</p>
              <p>Mengetahui,</p>
              <p>Kepala LMI</p>
              <p className="rp-sign-name">{SIGN_LINE}</p>
            </div>
          )}
          <div>
            <p>Manado, {longDate(new Date())}</p>
            <p>{isAdmin ? "Disusun oleh," : "Kepala LMI,"}</p>
            <p>{isAdmin ? "Admin LMI" : " "}</p>
            <p className="rp-sign-name">
              <u>{data.signer.name}</u>
            </p>
            {data.signer.identityCode && <p className="rp-sign-id">{data.signer.identityCode}</p>}
          </div>
        </div>
      </section>
    </div>
  );
}
