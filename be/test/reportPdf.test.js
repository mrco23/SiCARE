import assert from "node:assert/strict";
import { test } from "node:test";
import { PDFDocument } from "pdf-lib";
import {
  buildCounselingReportPdf,
  reportPdfFilename,
  toPdfText,
} from "../src/services/reportPdf.service.js";
import { reportPdfSchema } from "../src/validators/reporting.validator.js";

export function sampleReport(overrides = {}) {
  return {
    periodLabel: "Semester Ganjil 2026/2027",
    periodRange: "1 Agustus 2026 - 31 Januari 2027",
    dataLimited: false,
    totals: { sessions: 12, done: 9, cancelled: 3 },
    individual: { done: 7, cancelled: 2 },
    group: { done: 2, cancelled: 1 },
    months: [
      { label: "Agu 2026", done: 2, cancelled: 1 },
      { label: "Sep 2026", done: 3, cancelled: 0 },
      { label: "Okt 2026", done: 4, cancelled: 2 },
    ],
    counselors: [
      { counselor: "Giovana", individualDone: 5, groupDone: 1, totalCancelled: 2, totalSessions: 8 },
    ],
    cancellations: [{ category: "Dibatalkan klien", count: 3 }],
    rating: { average: 4.5, total: 4, distribution: [5, 4, 3, 2, 1].map((star) => ({ star, count: star >= 4 ? 2 : 0 })) },
    sessions: Array.from({ length: 70 }, (_, i) => ({
      id: `b-${i}`,
      shortId: `BK-${String(i).padStart(4, "0")}`,
      date: "2026-10-12",
      format: i % 3 ? "Individu" : "Kelompok",
      counselor: "Giovana",
      outcome: "Selesai",
    })),
    conclusion: "Layanan berjalan baik. 😇 Perlu sosialisasi jadwal ketersediaan.",
    ...overrides,
  };
}

test("report PDF schema rejects role/signer injection and accepts the aggregate payload", () => {
  assert.equal(reportPdfSchema.safeParse(sampleReport()).success, true);
  assert.equal(reportPdfSchema.safeParse({ ...sampleReport(), role: "headlmi" }).success, false);
  assert.equal(
    reportPdfSchema.safeParse({ ...sampleReport(), signer: { name: "X", identityCode: null } }).success,
    false,
  );
});

test("admin report PDF has a cover plus paginated content", async () => {
  const bytes = await buildCounselingReportPdf(sampleReport(), {
    role: "admin",
    signer: { name: "ignored", identityCode: null },
    now: new Date("2026-11-25T03:00:00Z"),
    logoBytes: null,
  });
  assert.equal(Buffer.from(bytes.slice(0, 5)).toString(), "%PDF-");
  const doc = await PDFDocument.load(bytes);
  assert.ok(doc.getPageCount() >= 3, "sampul + isi + rincian sesi berlanjut");
  assert.equal(doc.getTitle(), "Laporan Bimbingan Konseling - Semester Ganjil 2026/2027");
});

test("head LMI report PDF omits session detail and renders with the logo", async () => {
  const bytes = await buildCounselingReportPdf(sampleReport({ months: [], conclusion: "" }), {
    role: "headlmi",
    signer: { name: "Kepala LMI Uji", identityCode: "NIP 123" },
  });
  const doc = await PDFDocument.load(bytes);
  assert.ok(doc.getPageCount() >= 2);
});

test("PDF text helper strips characters Helvetica cannot encode", () => {
  assert.equal(toPdfText("Selesai 😇 “oke” – ya…"), 'Selesai  "oke" - ya...');
  assert.equal(reportPdfFilename("Semester Ganjil 2026/2027"), "Laporan-Bimbingan-Konseling-Semester-Ganjil-2026-2027.pdf");
});

test("report PDF controller sends an attachment signed by the logged-in head LMI", async () => {
  const { reportingController } = await import("../src/controllers/reporting.controller.js");
  const headers = {};
  let status;
  let body;
  const res = {
    setHeader: (k, v) => { headers[k] = v; },
    status(code) { status = code; return this; },
    send(payload) { body = payload; return this; },
  };
  await reportingController.downloadReportPdf(
    { body: sampleReport(), auth: { profile: { app_role: "head_lmi", full_name: "Kepala Uji", identity_code: "NIP 1" } } },
    res,
  );
  assert.equal(status, 200);
  assert.equal(headers["Content-Type"], "application/pdf");
  assert.match(headers["Content-Disposition"], /^attachment; filename="Laporan-Bimbingan-Konseling-Semester-Ganjil-2026-2027\.pdf"$/);
  assert.equal(body.subarray(0, 5).toString(), "%PDF-");

  await assert.rejects(
    reportingController.downloadReportPdf(
      { body: { ...sampleReport(), sessions: [{ ...sampleReport().sessions[0], cancelReason: "rahasia" }] }, auth: { profile: { app_role: "admin" } } },
      res,
    ),
    (e) => e.status === 400,
  );
});
