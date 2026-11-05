import type { CounselorSessionReportDto } from "../../types/api";

/**
 * Laporan per sesi untuk konselor, mengikuti halaman 2 template LMI. Identitas
 * berasal dari informed consent yang ditandatangani; catatan konselor tidak dimuat.
 */

const EMPTY = "-";

const longDate = (value: string | Date | null | undefined) => {
  if (!value) return EMPTY;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return EMPTY;
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
};

const clock = (value: string) =>
  new Date(value).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

function Row({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td className="rp-label">{label}</td>
      <td className="rp-colon">:</td>
      <td>{value}</td>
    </tr>
  );
}

function NoteBlock({ title, value }: { title: string; value: string | null }) {
  return (
    <section>
      <h2 className="rp-heading">{title}:</h2>
      <p className="rp-session-note">{value?.trim() || EMPTY}</p>
    </section>
  );
}

export default function CounselorSessionReportPrint({
  report,
}: {
  report: CounselorSessionReportDto;
}) {
  const { client, counselor, notes, session } = report;
  const birth = [client.birthplace, client.date_of_birth ? longDate(client.date_of_birth) : null]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="report-print-only rp-session">
      <h1 className="rp-session-name">{client.full_name}</h1>
      <p className="rp-session-sub">
        Fakultas/Prodi : {client.faculty ?? EMPTY} / {client.study_program ?? EMPTY}
      </p>
      <p className="rp-session-sub">NIM : {client.nim ?? EMPTY}</p>

      <section>
        <h2 className="rp-heading">Identitas Diri:</h2>
        <table className="rp-info">
          <tbody>
            <Row label="Tempat/tanggal lahir" value={birth || EMPTY} />
            <Row label="Jenis kelamin" value={client.gender ?? EMPTY} />
            <Row label="Agama" value={client.religion ?? EMPTY} />
            <Row label="Pendidikan" value={client.education ?? EMPTY} />
            <Row label="Alamat rumah" value={client.address ?? EMPTY} />
            <Row label="Telepon" value={client.phone_e164 ?? EMPTY} />
            <Row label="Tujuan pemeriksaan" value="Konseling" />
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="rp-heading">Data Sesi:</h2>
        <table className="rp-info">
          <tbody>
            <Row label="Konselor" value={counselor.full_name ?? EMPTY} />
            <Row label="Layanan" value={session.service_type === "group" ? "Konseling Kelompok" : "Konseling Individu"} />
            <Row label="Tanggal sesi" value={`${longDate(session.starts_at)}, ${clock(session.starts_at)}–${clock(session.ends_at)}`} />
            <Row label="Tanggal cetak" value={longDate(new Date())} />
          </tbody>
        </table>
      </section>

      <NoteBlock title="Catatan untuk Klien" value={notes.client_note} />
      <NoteBlock title="Tindak Lanjut" value={notes.follow_up} />

      <div className="rp-sign rp-keep">
        <div>
          <p>Manado, {longDate(new Date())}</p>
          <p>Psikolog,</p>
          <p className="rp-sign-name">
            <u>{counselor.full_name ?? EMPTY}</u>
          </p>
          <p className="rp-sign-id">No. SIPP : {counselor.sipp_silp_number ?? EMPTY}</p>
        </div>
      </div>
    </div>
  );
}
