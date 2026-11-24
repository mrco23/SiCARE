import { z } from "zod";
import { env } from "../config/env.js";
import { getSupabaseAdminClient, isSupabaseConfigured } from "../config/supabase.js";
import { HttpError, supabaseError } from "../lib/http.js";
import { writeAudit } from "../lib/audit.js";

/*
 * Logo Lasallian DNA di home page (migrasi 20261115150000).
 * - Satu logo aktif (tabel `homepage_logo`, id = 1); logo lama tidak disimpan.
 * - Admin hanya dapat mengganti, tidak dapat menghapus.
 * - Hanya PNG dan WebP, maksimal 1 MB, diverifikasi juga dari isi file (magic bytes).
 */

export const HOMEPAGE_LOGO_BUCKET = "site-assets";
export const HOMEPAGE_LOGO_MAX_BYTES = 1024 * 1024;
const DEFAULT_ALT = "Logo Lasallian DNA";

export const homepageLogoUpdateSchema = z
  .object({
    image_data: z.string().min(1, "Data gambar tidak boleh kosong.").optional(),
    alt_text: z.string().trim().min(1, "Keterangan logo wajib diisi.").max(120, "Keterangan logo maksimal 120 karakter."),
  })
  .strict();

const supa = () => {
  if (!isSupabaseConfigured()) {
    throw new HttpError(503, "SUPABASE_NOT_CONFIGURED", "Supabase belum dikonfigurasi pada server.");
  }
  return getSupabaseAdminClient();
};

function isPng(buffer) {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  return buffer.length >= 8 && sig.every((byte, i) => buffer[i] === byte);
}

function isWebp(buffer) {
  return (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  );
}

/** Mengurai data URL gambar dan memastikan formatnya benar-benar PNG atau WebP. */
export function parseLogoDataUrl(dataUrl) {
  const match = /^data:(image\/(?:png|webp));base64,(.+)$/is.exec(String(dataUrl).trim());
  if (!match) {
    throw new HttpError(400, "INVALID_LOGO_FORMAT", "Format logo harus PNG atau WebP.");
  }
  const mimeType = match[1].toLowerCase();
  const buffer = Buffer.from(match[2].replace(/\s+/g, ""), "base64");
  if (buffer.length === 0) {
    throw new HttpError(400, "INVALID_LOGO_FORMAT", "Data logo kosong atau rusak.");
  }
  if (buffer.length > HOMEPAGE_LOGO_MAX_BYTES) {
    throw new HttpError(400, "LOGO_TOO_LARGE", "Ukuran logo maksimal 1 MB.");
  }
  const contentMatches = mimeType === "image/png" ? isPng(buffer) : isWebp(buffer);
  if (!contentMatches) {
    throw new HttpError(400, "INVALID_LOGO_FORMAT", "Isi file tidak sesuai dengan format PNG atau WebP.");
  }
  return { mimeType, buffer, ext: mimeType === "image/png" ? "png" : "webp" };
}

export function homepageLogoPublicUrl(storagePath) {
  const base = (env.SUPABASE_URL || "").replace(/\/+$/, "");
  return `${base}/storage/v1/object/public/${HOMEPAGE_LOGO_BUCKET}/${storagePath}`;
}

function toDto(row) {
  if (!row) return null;
  return {
    url: homepageLogoPublicUrl(row.storage_path),
    alt_text: row.alt_text,
    updated_at: row.updated_at,
  };
}

export const homepageLogoService = {
  /** Logo aktif, atau null bila admin belum pernah mengunggah. */
  async getLogo(client = supa()) {
    const { data, error } = await client
      .from("homepage_logo")
      .select("storage_path,alt_text,updated_at")
      .eq("id", 1)
      .maybeSingle();
    if (error) supabaseError(error, "Logo home page tidak dapat dibaca.");
    return toDto(data);
  },

  /** Mengganti logo (dan/atau keterangannya). Tidak ada operasi hapus. */
  async updateLogo(input, actorUserId, client = supa()) {
    const { data: current, error: readError } = await client
      .from("homepage_logo")
      .select("storage_path,alt_text,updated_at")
      .eq("id", 1)
      .maybeSingle();
    if (readError) supabaseError(readError, "Logo home page tidak dapat dibaca.");

    if (!input.image_data && !current) {
      throw new HttpError(400, "LOGO_IMAGE_REQUIRED", "Unggah gambar logo terlebih dahulu.");
    }

    let storagePath = current?.storage_path ?? null;
    let uploadedPath = null;
    if (input.image_data) {
      const { mimeType, buffer, ext } = parseLogoDataUrl(input.image_data);
      uploadedPath = `homepage-logo/lasallian-dna-${Date.now()}.${ext}`;
      const { error: uploadError } = await client.storage
        .from(HOMEPAGE_LOGO_BUCKET)
        .upload(uploadedPath, buffer, { contentType: mimeType, upsert: false });
      if (uploadError) {
        throw new HttpError(500, "STORAGE_UPLOAD_FAILED", "Logo gagal diunggah ke penyimpanan.");
      }
      storagePath = uploadedPath;
    }

    const { data: saved, error: saveError } = await client
      .from("homepage_logo")
      .upsert(
        { id: 1, storage_path: storagePath, alt_text: input.alt_text || DEFAULT_ALT, updated_by: actorUserId },
        { onConflict: "id" },
      )
      .select("storage_path,alt_text,updated_at")
      .single();

    if (saveError) {
      // Jangan tinggalkan file yatim bila penyimpanan data gagal.
      if (uploadedPath) {
        await client.storage.from(HOMEPAGE_LOGO_BUCKET).remove([uploadedPath]).catch(() => null);
      }
      supabaseError(saveError, "Logo home page tidak dapat disimpan.");
    }

    // Logo lama tidak disimpan: hapus file lama setelah logo baru tersimpan (best effort).
    if (uploadedPath && current?.storage_path && current.storage_path !== uploadedPath) {
      await client.storage.from(HOMEPAGE_LOGO_BUCKET).remove([current.storage_path]).catch(() => null);
    }

    await writeAudit({
      actorUserId,
      action: "admin.homepage_logo.update",
      entityType: "homepage_logo",
      entityId: null,
      metadata: { field: uploadedPath ? "image" : "alt_text" },
    });

    return toDto(saved);
  },
};
