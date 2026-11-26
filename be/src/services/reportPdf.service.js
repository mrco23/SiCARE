// @ts-check
/**
 * PDF "Laporan Bimbingan Konseling" untuk Admin LMI dan Kepala LMI, disusun di server dengan
 * pdf-lib sehingga tombol "Unduh Laporan PDF" langsung mengunduh berkas (tanpa dialog cetak).
 * Tata letak mengikuti fe/src/components/reports/CounselingReportPrint.tsx: sampul, stempel
 * CONFIDENTIAL, footer bernomor halaman, bagian berhuruf A, B, ..., Kesimpulan dan Saran, serta
 * tanda tangan Kepala LMI. Hanya memuat data agregat yang dikirim halaman laporan; identitas
 * klien, jawaban intake, dan catatan konseling tidak pernah diterima endpoint ini.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGO_PATH = path.resolve(__dirname, "../../assets/kampus.png");

const MM = 72 / 25.4;
const PAGE_W = 210 * MM;
const PAGE_H = 297 * MM;
const MARGIN = { top: 26 * MM, side: 22 * MM, bottom: 20 * MM };
const CONTENT_W = PAGE_W - MARGIN.side * 2;
const BODY_SIZE = 10.5;
const LINE = BODY_SIZE * 1.45;
const CELL_PAD_X = 2 * MM;
const CELL_PAD_Y = 1 * MM;
const BLACK = rgb(0, 0, 0);
const RED = rgb(1, 0, 0);
const HEADER_FILL = rgb(0.906, 0.906, 0.906);
const DONE_FILL = rgb(0.024, 0.306, 0.231);
const CANCEL_FILL = rgb(0.75, 0.75, 0.75);
const FOOTER_TEXT = "Laporan Bimbingan & Konseling";
const SIGN_LINE = "______________________";

/** Helvetica (WinAnsi) tidak dapat menulis emoji atau aksara di luar Latin-1. */
export function toPdfText(value) {
  return String(value ?? "")
    .normalize("NFC")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[\t\r]/g, " ")
    .replace(/[^\n\x20-\x7E\xA0-\xFF]/g, "");
}

export const percent = (part, whole) => (whole ? `${Math.round((part / whole) * 100)}%` : "0%");

export function longDateWita(date) {
  return date.toLocaleDateString("id-ID", {
    timeZone: "Asia/Makassar",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function sessionDate(value) {
  const [y, m, d] = String(value).split("-").map(Number);
  if (!y || !m || !d) return toPdfText(value);
  return new Date(Date.UTC(y, m - 1, d, 4)).toLocaleDateString("id-ID", {
    timeZone: "Asia/Makassar",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Membungkus teks per kata agar muat pada lebar tertentu. */
function wrap(text, font, size, width) {
  const lines = [];
  for (const paragraph of toPdfText(text).split("\n")) {
    let current = "";
    for (const word of paragraph.split(/ +/)) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= width) {
        current = candidate;
        continue;
      }
      if (current) lines.push(current);
      // Kata yang lebih panjang dari kolom dipotong per karakter.
      let rest = word;
      while (font.widthOfTextAtSize(rest, size) > width && rest.length > 1) {
        let cut = rest.length - 1;
        while (cut > 1 && font.widthOfTextAtSize(rest.slice(0, cut), size) > width) cut -= 1;
        lines.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      current = rest;
    }
    lines.push(current);
  }
  return lines;
}

class ReportLayout {
  constructor(doc, fonts) {
    this.doc = doc;
    this.fonts = fonts;
    this.page = null;
    this.y = 0;
  }

  newPage() {
    this.page = this.doc.addPage([PAGE_W, PAGE_H]);
    this.y = PAGE_H - MARGIN.top;
  }

  get bottom() {
    return MARGIN.bottom;
  }

  ensure(height) {
    if (this.y - height < this.bottom) this.newPage();
  }

  text(value, { x = MARGIN.side, size = BODY_SIZE, font = this.fonts.regular, color = BLACK } = {}) {
    this.page.drawText(toPdfText(value), { x, y: this.y - size, size, font, color });
  }

  centered(value, size, font) {
    const safe = toPdfText(value);
    const width = font.widthOfTextAtSize(safe, size);
    this.page.drawText(safe, { x: (PAGE_W - width) / 2, y: this.y - size, size, font, color: BLACK });
    this.y -= size * 1.3;
  }

  paragraph(value, { size = BODY_SIZE, font = this.fonts.regular } = {}) {
    for (const line of wrap(value, font, size, CONTENT_W)) {
      this.ensure(LINE);
      this.text(line, { size, font });
      this.y -= LINE;
    }
  }

  /** Judul bagian; ikut pindah halaman bersama sedikit isi di bawahnya. */
  heading(value) {
    this.ensure(7 * MM + 2.5 * MM + 11.5 + LINE * 3);
    this.y -= 7 * MM;
    this.text(value.toUpperCase(), { size: 11.5, font: this.fonts.bold });
    this.y -= 11.5 + 2.5 * MM;
  }

  info(rows) {
    const labelW = 42 * MM;
    const colonW = 4 * MM;
    const valueW = CONTENT_W - labelW - colonW;
    for (const [label, value] of rows) {
      const lines = wrap(value, this.fonts.regular, BODY_SIZE, valueW);
      this.ensure(lines.length * LINE);
      this.text(label);
      this.text(":", { x: MARGIN.side + labelW });
      lines.forEach((line, i) => {
        this.page.drawText(line, {
          x: MARGIN.side + labelW + colonW,
          y: this.y - BODY_SIZE - i * LINE,
          size: BODY_SIZE,
          font: this.fonts.regular,
          color: BLACK,
        });
      });
      this.y -= lines.length * LINE;
    }
  }

  /**
   * @param {{ header: string, width: number, align?: "left" | "right" }[]} columns lebar relatif
   * @param {(string | number)[][]} rows
   */
  table(columns, rows) {
    const total = columns.reduce((sum, c) => sum + c.width, 0);
    const widths = columns.map((c) => (c.width / total) * CONTENT_W);

    const measure = (cells, font) =>
      cells.map((cell, i) => wrap(String(cell), font, BODY_SIZE, widths[i] - CELL_PAD_X * 2));

    const drawRow = (lines, font, fill) => {
      const height = Math.max(...lines.map((l) => l.length)) * LINE + CELL_PAD_Y * 2;
      let x = MARGIN.side;
      lines.forEach((cellLines, i) => {
        this.page.drawRectangle({
          x,
          y: this.y - height,
          width: widths[i],
          height,
          borderColor: BLACK,
          borderWidth: 0.5,
          color: fill,
        });
        cellLines.forEach((line, j) => {
          const lineW = font.widthOfTextAtSize(line, BODY_SIZE);
          const tx = columns[i].align === "right"
            ? x + widths[i] - CELL_PAD_X - lineW
            : x + CELL_PAD_X;
          this.page.drawText(line, {
            x: tx,
            y: this.y - CELL_PAD_Y - BODY_SIZE - j * LINE + 1.5,
            size: BODY_SIZE,
            font,
            color: BLACK,
          });
        });
        x += widths[i];
      });
      this.y -= height;
    };

    const headerLines = measure(columns.map((c) => c.header), this.fonts.bold);
    const headerHeight = Math.max(...headerLines.map((l) => l.length)) * LINE + CELL_PAD_Y * 2;
    const drawHeader = () => drawRow(headerLines, this.fonts.bold, HEADER_FILL);

    this.ensure(headerHeight + LINE + CELL_PAD_Y * 2);
    drawHeader();
    for (const row of rows) {
      const lines = measure(row, this.fonts.regular);
      const height = Math.max(...lines.map((l) => l.length)) * LINE + CELL_PAD_Y * 2;
      if (this.y - height < this.bottom) {
        // Judul kolom diulang di halaman berikutnya.
        this.newPage();
        drawHeader();
      }
      drawRow(lines, this.fonts.regular, undefined);
    }
    this.y -= 2 * MM;
  }

  bars(months) {
    const chartH = 40 * MM;
    const labelH = LINE;
    this.ensure(chartH + labelH + 4 * MM);
    const max = Math.max(1, ...months.map((m) => m.done + m.cancelled));
    const colW = CONTENT_W / months.length;
    const barW = Math.min(14 * MM, colW * 0.6);
    const baseY = this.y - chartH;
    const small = 8.5;

    months.forEach((month, i) => {
      const total = month.done + month.cancelled;
      const cx = MARGIN.side + colW * i + colW / 2;
      const barH = (total / max) * (chartH - small * 1.6);
      const doneH = total ? (month.done / total) * barH : 0;
      if (doneH > 0) {
        this.page.drawRectangle({ x: cx - barW / 2, y: baseY, width: barW, height: doneH, color: DONE_FILL });
      }
      if (barH - doneH > 0) {
        this.page.drawRectangle({ x: cx - barW / 2, y: baseY + doneH, width: barW, height: barH - doneH, color: CANCEL_FILL });
      }
      const value = String(total);
      const vw = this.fonts.bold.widthOfTextAtSize(value, small);
      this.page.drawText(value, { x: cx - vw / 2, y: baseY + barH + 2, size: small, font: this.fonts.bold, color: BLACK });
      const label = wrap(month.label, this.fonts.regular, small, colW - 2)[0] ?? "";
      const lw = this.fonts.regular.widthOfTextAtSize(label, small);
      this.page.drawText(label, { x: cx - lw / 2, y: baseY - small - 3, size: small, font: this.fonts.regular, color: BLACK });
    });
    this.page.drawLine({
      start: { x: MARGIN.side, y: baseY },
      end: { x: MARGIN.side + CONTENT_W, y: baseY },
      thickness: 0.5,
      color: BLACK,
    });

    // Keterangan warna.
    const legendY = baseY - small - 3 - LINE;
    let lx = MARGIN.side;
    for (const [fill, label] of [[DONE_FILL, "Selesai"], [CANCEL_FILL, "Dibatalkan/ditolak"]]) {
      this.page.drawRectangle({ x: lx, y: legendY, width: 3 * MM, height: 3 * MM, color: fill });
      this.page.drawText(label, { x: lx + 4.5 * MM, y: legendY + 0.5, size: small, font: this.fonts.regular, color: BLACK });
      lx += 4.5 * MM + this.fonts.regular.widthOfTextAtSize(label, small) + 6 * MM;
    }
    this.y = legendY - 4 * MM;
  }
}

function drawCover(layout, data, logo) {
  layout.newPage();
  const { bold } = layout.fonts;
  layout.y -= 12 * MM;
  layout.centered("LAPORAN", 22, bold);
  layout.y -= 22 * 0.05;
  layout.centered("BIMBINGAN KONSELING", 22, bold);
  layout.y -= 4 * MM;
  layout.centered(data.periodLabel, 12, bold);

  if (logo) {
    const size = 70 * MM;
    layout.y -= 14 * MM;
    layout.page.drawImage(logo, { x: (PAGE_W - size) / 2, y: layout.y - size, width: size, height: size });
    layout.y -= size;
  }

  layout.y -= 12 * MM;
  layout.centered("Lembaga Misi & Identitas (LMI)", 15, bold);
  layout.centered("Div. Bimbingan & Konseling", 15, bold);
  layout.y -= 12 * MM;
  layout.centered("Universitas Katolik De La Salle", 15, bold);
  layout.centered("Manado", 15, bold);
}

function drawStampAndFooter(doc, fonts) {
  const pages = doc.getPages();
  pages.forEach((page, index) => {
    // Stempel CONFIDENTIAL di kanan atas (border ganda), seperti @top-right versi cetak.
    const w = 34 * MM;
    const h = 8 * MM;
    const x = PAGE_W - MARGIN.side - w;
    const y = PAGE_H - 9 * MM - h;
    page.drawRectangle({ x, y, width: w, height: h, borderColor: RED, borderWidth: 0.75 });
    page.drawRectangle({ x: x + 1.6, y: y + 1.6, width: w - 3.2, height: h - 3.2, borderColor: RED, borderWidth: 0.75 });
    const label = "CONFIDENTIAL";
    const lw = fonts.bold.widthOfTextAtSize(label, 9);
    page.drawText(label, { x: x + (w - lw) / 2, y: y + (h - 9) / 2 + 1.5, size: 9, font: fonts.bold, color: RED });

    // Sampul (halaman 1) tanpa footer, nomor halaman tetap dihitung dari sampul.
    if (index === 0) return;
    const footer = `${FOOTER_TEXT} | ${index + 1}`;
    const fw = fonts.regular.widthOfTextAtSize(footer, 9);
    page.drawText(footer, { x: PAGE_W - MARGIN.side - fw, y: MARGIN.bottom / 2 - 3, size: 9, font: fonts.regular, color: BLACK });
  });
}

let cachedLogo;
async function loadLogo() {
  if (cachedLogo === undefined) {
    cachedLogo = await fs.readFile(LOGO_PATH).catch(() => null);
  }
  return cachedLogo;
}

/**
 * @param {any} data laporan tervalidasi (reportPdfSchema)
 * @param {{ role: "admin" | "headlmi", signer: { name: string, identityCode: string | null }, now?: Date, logoBytes?: Uint8Array | null }} options
 * @returns {Promise<Uint8Array>}
 */
export async function buildCounselingReportPdf(data, { role, signer, now = new Date(), logoBytes }) {
  const doc = await PDFDocument.create();
  doc.setTitle(`Laporan Bimbingan Konseling - ${toPdfText(data.periodLabel)}`);
  doc.setAuthor("LMI Universitas Katolik De La Salle Manado");
  doc.setCreator("SiCARE");
  doc.setProducer("SiCARE");
  doc.setCreationDate(now);

  const fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
  };
  const bytes = logoBytes === undefined ? await loadLogo() : logoBytes;
  const logo = bytes ? await doc.embedPng(bytes) : null;

  const layout = new ReportLayout(doc, fonts);
  const isAdmin = role === "admin";
  const letters = "ABCDEFGH";
  let index = 0;
  const heading = (title) => layout.heading(`${letters[index++]}. ${title}`);
  const printedOn = longDateWita(now);

  drawCover(layout, data, logo);
  layout.newPage();
  layout.y += 7 * MM; // bagian pertama tidak perlu jarak atas penuh

  heading("Identitas Laporan");
  layout.info([
    ["Jenis laporan", isAdmin ? "Laporan Layanan Konseling (Admin LMI)" : "Laporan Evaluasi Layanan (Kepala LMI)"],
    ["Periode", data.periodLabel],
    ["Rentang tanggal", data.periodRange],
    ["Tanggal cetak", printedOn],
    ["Sumber data", "Sistem SiCARE"],
    ["Cakupan", "Data agregat layanan. Tidak memuat identitas klien, jawaban intake, dan catatan konseling."],
  ]);
  if (data.dataLimited) {
    layout.y -= 2 * MM;
    layout.paragraph(
      "Perhatian: data pada laporan ini mencapai batas pembacaan sistem, sehingga sebagian data lama mungkin tidak terhitung.",
      { font: fonts.bold },
    );
  }

  heading("Ringkasan Layanan");
  layout.table(
    [{ header: "Uraian", width: 3 }, { header: "Jumlah", width: 1, align: "right" }],
    [
      ["Total booking dan sesi", data.totals.sessions],
      ["Sesi selesai", data.totals.done],
      ["Sesi dibatalkan/ditolak", data.totals.cancelled],
      ["Konseling individu selesai", data.individual.done],
      ["Konseling individu dibatalkan", data.individual.cancelled],
      ["Konseling kelompok selesai", data.group.done],
      ["Konseling kelompok dibatalkan", data.group.cancelled],
      ["Tingkat penyelesaian", percent(data.totals.done, data.totals.sessions)],
    ],
  );

  heading("Perkembangan per Bulan");
  if (data.months.length === 0) {
    layout.paragraph("Belum ada data pada periode ini.");
  } else {
    const totalMonths = data.months.reduce((sum, m) => sum + m.done + m.cancelled, 0);
    if (totalMonths > 0) layout.bars(data.months);
    layout.table(
      [
        { header: "Bulan", width: 2 },
        { header: "Selesai", width: 1, align: "right" },
        { header: "Dibatalkan", width: 1, align: "right" },
        { header: "Total", width: 1, align: "right" },
      ],
      data.months.map((m) => [m.label, m.done, m.cancelled, m.done + m.cancelled]),
    );
  }

  heading("Layanan per Konselor");
  if (data.counselors.length === 0) {
    layout.paragraph("Belum ada data layanan konselor pada periode ini.");
  } else {
    layout.table(
      [
        { header: "Konselor", width: 3 },
        { header: "Individu selesai", width: 1.3, align: "right" },
        { header: "Kelompok selesai", width: 1.3, align: "right" },
        { header: "Dibatalkan", width: 1.2, align: "right" },
        { header: "Total", width: 1, align: "right" },
      ],
      data.counselors.map((r) => [r.counselor, r.individualDone, r.groupDone, r.totalCancelled, r.totalSessions]),
    );
  }

  heading("Analisis Pembatalan");
  if (data.cancellations.length === 0) {
    layout.paragraph("Tidak ada pembatalan pada periode ini.");
  } else {
    layout.table(
      [
        { header: "Kategori", width: 3 },
        { header: "Jumlah", width: 1, align: "right" },
        { header: "Persentase", width: 1, align: "right" },
      ],
      data.cancellations.map((r) => [r.category, r.count, percent(r.count, data.totals.cancelled)]),
    );
  }

  heading("Evaluasi Layanan");
  layout.info([
    ["Rata-rata rating", data.rating.total ? `${data.rating.average.toFixed(1).replace(".", ",")} dari 5` : "-"],
    ["Jumlah ulasan", String(data.rating.total)],
  ]);
  layout.y -= 2 * MM;
  const ratingTotal = data.rating.distribution.reduce((sum, r) => sum + r.count, 0);
  layout.table(
    [
      { header: "Rating", width: 3 },
      { header: "Jumlah", width: 1, align: "right" },
      { header: "Persentase", width: 1, align: "right" },
    ],
    data.rating.distribution.map((r) => [`Bintang ${r.star}`, r.count, percent(r.count, ratingTotal)]),
  );

  if (isAdmin) {
    heading("Rincian Sesi");
    if (data.sessions.length === 0) {
      layout.paragraph("Belum ada sesi pada periode ini.");
    } else {
      layout.table(
        [
          { header: "ID Booking", width: 1.2 },
          { header: "Tanggal", width: 1.6 },
          { header: "Jenis", width: 1.2 },
          { header: "Konselor", width: 2 },
          { header: "Status", width: 1.3 },
        ],
        data.sessions.map((s) => [s.shortId, sessionDate(s.date), s.format, s.counselor, s.outcome]),
      );
    }
  }

  // Kesimpulan dan tanda tangan satu blok (seperti .rp-keep versi cetak) bila muat satu halaman.
  const conclusion = data.conclusion.trim();
  const blankH = 35 * MM;
  const signBlockH = 10 * MM + LINE * 3 + 22 * MM + LINE * 2;
  const conclusionH = conclusion
    ? wrap(conclusion, fonts.regular, BODY_SIZE, CONTENT_W).length * LINE
    : blankH;
  const keepH = 7 * MM + 11.5 + 2.5 * MM + conclusionH + signBlockH;
  if (keepH <= PAGE_H - MARGIN.top - MARGIN.bottom) layout.ensure(keepH);
  heading("Kesimpulan dan Saran");
  if (conclusion) {
    layout.paragraph(conclusion);
  } else {
    layout.ensure(blankH);
    layout.page.drawRectangle({
      x: MARGIN.side,
      y: layout.y - blankH,
      width: CONTENT_W,
      height: blankH,
      borderColor: BLACK,
      borderWidth: 0.5,
    });
    layout.y -= blankH;
  }

  // Tanda tangan hanya oleh Kepala LMI; laporan admin menyisakan garis nama kosong.
  const signLines = [`Manado, ${printedOn}`, "Mengetahui,", "Kepala LMI"];
  layout.y -= 10 * MM;
  layout.ensure(signBlockH - 10 * MM);
  const signX = MARGIN.side + CONTENT_W - 65 * MM;
  for (const line of signLines) {
    layout.text(line, { x: signX });
    layout.y -= LINE;
  }
  layout.y -= 22 * MM;
  if (isAdmin) {
    layout.text(SIGN_LINE, { x: signX });
  } else {
    const name = toPdfText(signer.name);
    layout.text(name, { x: signX, font: fonts.bold });
    const nameW = fonts.bold.widthOfTextAtSize(name, BODY_SIZE);
    layout.page.drawLine({
      start: { x: signX, y: layout.y - BODY_SIZE - 1.5 },
      end: { x: signX + nameW, y: layout.y - BODY_SIZE - 1.5 },
      thickness: 0.6,
      color: BLACK,
    });
    if (signer.identityCode) {
      layout.y -= LINE;
      layout.text(signer.identityCode, { x: signX });
    }
  }

  drawStampAndFooter(doc, fonts);
  return doc.save();
}

/** Nama berkas aman untuk header Content-Disposition. */
export function reportPdfFilename(periodLabel) {
  const slug = toPdfText(periodLabel)
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `Laporan-Bimbingan-Konseling${slug ? `-${slug}` : ""}.pdf`;
}
