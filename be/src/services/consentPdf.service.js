import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Official template constant metadata
export const OFFICIAL_TEMPLATE_SHA256 = "59012141d8a54336928a4c076d9d0ad7276bbbc36064c37d9654cc031f14cd8f";
export const OFFICIAL_TEMPLATE_CODE = "SICARE_IC_STD";
export const OFFICIAL_TEMPLATE_VERSION = "v1.0";

// Deterministic coordinate mapping onto the official A4 (595.3 x 841.9 pt) single-page template
export const CONSENT_PDF_COORDINATES = {
  full_name: { x: 190, y: 624.5, size: 10 },
  faculty_study_program: { x: 190, y: 602, size: 10 },
  nim: { x: 190, y: 579.5, size: 10 },
  birth_info: { x: 190, y: 557, size: 10 },
  gender: { x: 190, y: 534.5, size: 10 },
  phone_e164: { x: 190, y: 512, size: 10 },
  signing_date: { x: 418, y: 263.8, size: 10 },
  signature_image: { x: 390, y: 165, width: 110, height: 50 },
  printed_name: { x: 375, y: 140, size: 10 },
};

const INDONESIAN_MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

/**
 * Formats a Date object or ISO string to Indonesian date: e.g. "31 Oktober 2026"
 *
 * @param {Date|string} dateInput
 * @returns {string}
 */
export function formatIndonesianDate(dateInput) {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid date value: ${dateInput}`);
  }
  const day = d.getDate();
  const month = INDONESIAN_MONTHS[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

/**
 * Validates mandatory identity fields for the Informed Consent document.
 *
 * @param {object} identity
 * @returns {object} Sanitized and validated identity object
 */
export function validateConsentIdentity(identity) {
  if (!identity || typeof identity !== "object") {
    throw new Error("Data identitas peserta wajib diisi.");
  }

  const errors = [];
  const fullName = typeof identity.full_name === "string" ? identity.full_name.trim() : "";
  const faculty = typeof identity.faculty === "string" ? identity.faculty.trim() : "";
  const studyProgram = typeof identity.study_program === "string" ? identity.study_program.trim() : "";
  const nim = typeof identity.nim === "string" ? identity.nim.trim() : "";
  const birthplace = typeof identity.birthplace === "string" ? identity.birthplace.trim() : "";
  const dateOfBirth = identity.date_of_birth ? String(identity.date_of_birth).trim() : "";
  const gender = typeof identity.gender === "string" ? identity.gender.trim() : "";
  const phone = typeof identity.phone_e164 === "string" ? identity.phone_e164.trim() : "";

  if (!fullName || fullName.length < 2) errors.push("Nama lengkap wajib diisi (minimal 2 karakter).");
  if (!faculty || faculty.length < 2) errors.push("Fakultas wajib diisi.");
  if (!studyProgram || studyProgram.length < 2) errors.push("Program studi wajib diisi.");
  if (!nim || nim.length < 2) errors.push("NIM wajib diisi.");
  if (!birthplace || birthplace.length < 2) errors.push("Tempat lahir wajib diisi.");
  if (!dateOfBirth || Number.isNaN(new Date(dateOfBirth).getTime())) {
    errors.push("Tanggal lahir wajib diisi dengan tanggal yang valid.");
  }
  if (!gender || (gender !== "Laki-laki" && gender !== "Perempuan")) {
    errors.push("Jenis kelamin wajib dipilih ('Laki-laki' atau 'Perempuan').");
  }
  if (!phone || !/^\+?[0-9]{8,20}$/.test(phone.replace(/[\s-]/g, ""))) {
    errors.push("Nomor telepon wajib diisi dalam format yang valid.");
  }

  if (errors.length > 0) {
    const error = new Error(`Validasi identitas gagal: ${errors.join(" ")}`);
    error.validationIssues = errors;
    throw error;
  }

  return {
    full_name: fullName,
    faculty,
    study_program: studyProgram,
    nim,
    birthplace,
    date_of_birth: dateOfBirth.includes("T") ? dateOfBirth.split("T")[0] : dateOfBirth,
    gender,
    phone_e164: phone.startsWith("+") ? phone : (phone.startsWith("0") ? `+62${phone.slice(1)}` : `+${phone}`),
  };
}

/**
 * Validates that the signature is a valid, non-empty PNG buffer within 2MB.
 * Rejects SVG, HTML, executable scripts, and corrupt buffers.
 *
 * @param {Buffer|Uint8Array} signatureBuffer
 * @returns {Buffer}
 */
export function validateSignaturePng(signatureBuffer) {
  if (!signatureBuffer) {
    throw new Error("Tanda tangan digital tidak boleh kosong.");
  }

  const buf = Buffer.isBuffer(signatureBuffer) ? signatureBuffer : Buffer.from(signatureBuffer);

  if (buf.length === 0) {
    throw new Error("Tanda tangan digital tidak boleh kosong.");
  }

  if (buf.length > 2 * 1024 * 1024) {
    throw new Error("Ukuran berkas tanda tangan melampaui batas maksimum 2 MB.");
  }

  // Verify PNG signature magic bytes: 89 50 4E 47 0D 0A 1A 0A
  const isPng =
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a;

  if (!isPng) {
    throw new Error("Format tanda tangan tidak valid. Hanya berkas gambar PNG yang diizinkan (SVG dan tipe lain ditolak).");
  }

  return buf;
}

/**
 * Resolves and loads the official PDF template file.
 * Verifies SHA-256 integrity against the official master copy.
 *
 * @param {string} [customPath]
 * @returns {Promise<Buffer>}
 */
export async function loadOfficialTemplatePdf(customPath = null) {
  const templatePath =
    customPath ||
    path.resolve(__dirname, "../../../docs/reference/infromed-consent/informed-consent.pdf");

  const bytes = await fs.readFile(templatePath);
  const actualHash = crypto.createHash("sha256").update(bytes).digest("hex");

  if (actualHash.toLowerCase() !== OFFICIAL_TEMPLATE_SHA256.toLowerCase()) {
    throw new Error(
      `Integritas templat PDF tidak cocok. Diharapkan: ${OFFICIAL_TEMPLATE_SHA256}, Aktual: ${actualHash}`
    );
  }

  return bytes;
}

/**
 * Generates an individualized signed Informed Consent PDF by populating
 * the official template overlay with participant identity data and signature.
 *
 * @param {object} params
 * @param {object} params.identityData Validated identity attributes
 * @param {Buffer|Uint8Array} params.signaturePngBuffer Valid PNG signature image
 * @param {Date|string} [params.signingDate] Timestamp of signing (defaults to now)
 * @param {Buffer} [params.templateBytes] Optional pre-loaded template bytes
 * @returns {Promise<{ pdfBuffer: Buffer, pdfSha256: string, pdfSizeBytes: number, signatureSha256: string }>}
 */
export async function generateInformedConsentPdf({
  identityData,
  signaturePngBuffer,
  signingDate = new Date(),
  templateBytes = null,
}) {
  // 1. Validate inputs
  const validIdentity = validateConsentIdentity(identityData);
  const validSignature = validateSignaturePng(signaturePngBuffer);
  const sigSha256 = crypto.createHash("sha256").update(validSignature).digest("hex");

  // 2. Load and verify official template
  const rawTemplate = templateBytes || (await loadOfficialTemplatePdf());
  const pdfDoc = await PDFDocument.load(rawTemplate);

  // 3. Prepare font and page
  const page = pdfDoc.getPage(0);
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const textColor = rgb(0.1, 0.1, 0.1);

  // 4. Overlay identity fields
  const coords = CONSENT_PDF_COORDINATES;

  // Nama
  page.drawText(validIdentity.full_name, {
    x: coords.full_name.x,
    y: coords.full_name.y,
    size: coords.full_name.size,
    font: helvetica,
    color: textColor,
  });

  // Fakultas / Program Studi
  const facultyStudy = `${validIdentity.faculty} / ${validIdentity.study_program}`;
  page.drawText(facultyStudy, {
    x: coords.faculty_study_program.x,
    y: coords.faculty_study_program.y,
    size: coords.faculty_study_program.size,
    font: helvetica,
    color: textColor,
  });

  // NIM
  page.drawText(validIdentity.nim, {
    x: coords.nim.x,
    y: coords.nim.y,
    size: coords.nim.size,
    font: helvetica,
    color: textColor,
  });

  // Tempat, tanggal lahir
  const birthFormatted = `${validIdentity.birthplace}, ${formatIndonesianDate(validIdentity.date_of_birth)}`;
  page.drawText(birthFormatted, {
    x: coords.birth_info.x,
    y: coords.birth_info.y,
    size: coords.birth_info.size,
    font: helvetica,
    color: textColor,
  });

  // Jenis kelamin
  page.drawText(validIdentity.gender, {
    x: coords.gender.x,
    y: coords.gender.y,
    size: coords.gender.size,
    font: helvetica,
    color: textColor,
  });

  // Telepon
  page.drawText(validIdentity.phone_e164, {
    x: coords.phone_e164.x,
    y: coords.phone_e164.y,
    size: coords.phone_e164.size,
    font: helvetica,
    color: textColor,
  });

  // Tanggal penandatanganan di Manado
  const dateStr = formatIndonesianDate(signingDate);
  page.drawText(dateStr, {
    x: coords.signing_date.x,
    y: coords.signing_date.y,
    size: coords.signing_date.size,
    font: helvetica,
    color: textColor,
  });

  // 5. Embed and draw signature PNG
  const pngImage = await pdfDoc.embedPng(validSignature);
  page.drawImage(pngImage, {
    x: coords.signature_image.x,
    y: coords.signature_image.y,
    width: coords.signature_image.width,
    height: coords.signature_image.height,
  });

  // 6. Draw printed name below signature line
  const printedNameText = `( ${validIdentity.full_name} )`;
  page.drawText(printedNameText, {
    x: coords.printed_name.x,
    y: coords.printed_name.y,
    size: coords.printed_name.size,
    font: helveticaBold,
    color: textColor,
  });

  // 7. Save finalized PDF
  const outputUint8 = await pdfDoc.save();
  const pdfBuffer = Buffer.from(outputUint8);
  const pdfSha256 = crypto.createHash("sha256").update(pdfBuffer).digest("hex");

  return {
    pdfBuffer,
    pdfSha256,
    pdfSizeBytes: pdfBuffer.length,
    signatureSha256: sigSha256,
  };
}
