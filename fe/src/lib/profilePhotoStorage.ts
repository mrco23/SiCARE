import { sicareApi } from "./sicareApi";
import { getPublicPhotoUrl } from "./publicApi";
import type { ProfilePhotoResultDto } from "../types/api";

export const ALLOWED_PHOTO_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

export const MAX_PHOTO_BYTES = 2 * 1024 * 1024; // 2 MB

/**
 * Validasi berkas foto profil sebelum pemrosesan.
 * Format yang diizinkan: JPG, PNG, atau WebP dengan batas maksimal 2 MB.
 */
export function validatePhotoFile(file: File): { valid: boolean; error?: string } {
  if (!ALLOWED_PHOTO_MIME_TYPES.includes(file.type.toLowerCase())) {
    return {
      valid: false,
      error: "Format foto harus JPG, PNG, atau WebP.",
    };
  }

  if (file.size > MAX_PHOTO_BYTES) {
    return {
      valid: false,
      error: "Ukuran foto maksimal 2 MB.",
    };
  }

  return { valid: true };
}

/**
 * Unggah foto profil ke Supabase Storage via backend API.
 * Menghapus objek lama dan memperbarui referensi database secara otomatis.
 */
export async function uploadProfilePhoto(imageDataUrl: string): Promise<ProfilePhotoResultDto> {
  return sicareApi.uploadPhoto(imageDataUrl);
}

/**
 * Hapus foto profil dari Supabase Storage dan kosongkan referensi pada database.
 */
export async function deleteProfilePhoto(): Promise<{ success: boolean; message: string }> {
  return sicareApi.deletePhoto();
}

export { getPublicPhotoUrl };

