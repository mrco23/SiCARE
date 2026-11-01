# Tahap 7B.1: Fondasi Integrasi API

## Tujuan

Menetapkan satu jalur komunikasi frontend ke backend sebelum setiap halaman diintegrasikan. Tahap ini tidak menghubungkan semua halaman fitur dan tidak mengubah schema database.

## Perubahan

1. `fe/src/lib/api.ts` tetap menjadi API client terpusat dan sekarang:
   - mengambil sesi Supabase secara langsung saat `apiRequest` memerlukan autentikasi dan token tidak diberikan eksplisit;
   - mengirim bearer token hanya melalui header `Authorization`;
   - menetapkan timeout default 15 detik yang dapat dioverride melalui `timeoutMs`;
   - menghormati `AbortSignal` dari pemanggil;
   - membedakan timeout, pembatalan, sesi yang gagal dibaca, backend yang tidak terjangkau, respons yang tidak bisa dibaca, dan respons JSON yang tidak valid;
   - menormalisasi error backend menjadi `ApiError` dan mempertahankan `code`, `message`, serta `details` dari envelope error;
   - membuka envelope `{ data: ... }` dan tetap mendukung endpoint yang mengembalikan objek JSON biasa;
   - mengabaikan cookie browser untuk request API karena autentikasi menggunakan bearer token.
2. `fe/.env.example` menjelaskan bahwa `VITE_API_BASE_URL` mencakup `/api/v1` dan wajib diatur untuk production.
3. `be/.env.example` dan default `FRONTEND_ORIGINS` mengizinkan dua host Vite lokal yang lazim dipakai, `localhost` dan `127.0.0.1` pada port 5173. Daftar production tetap harus ditentukan secara eksplisit melalui environment deployment.
4. README frontend dan backend menjelaskan kontrak API dan konfigurasi origin.

## Kontrak pemakaian

```ts
const data = await apiRequest<MyResponse>('/some-endpoint', {
  method: 'GET',
  auth: true,
});
```

Untuk operasi tulis, berikan `method` dan `body`. Jangan memasukkan server key/service-role key ke variabel `VITE_*`. Jangan memanggil endpoint admin dari frontend sebagai pengganti pemeriksaan role backend.

## Di luar cakupan

- Integrasi halaman publik, klien, konselor, admin, dan Kepala LMI.
- Perubahan schema Supabase atau migration.
- Pengiriman WhatsApp.
- Model intake konseling, catatan konselor, dan consent yang belum disepakati.

## Validasi

Source diambil dari `SiCARE(3).zip`, lalu patch kalimat motivasi hero terbaru diterapkan sebagai overlay agar patch fondasi tidak mengembalikan perubahan tersebut.

Build dan lint belum dapat dijalankan di lingkungan penyusunan karena `npm ci` tidak selesai sebelum batas waktu tool. Jalankan perintah validasi pada komputer pengembangan setelah menerapkan patch:

- `cd fe; npm ci; npm run lint; npm run build; npm audit`
- `cd be; npm ci; npm run check; npm test; npm audit`

Tahap 7B.1 baru dianggap tervalidasi setelah perintah tersebut lulus. Tahap ini tidak mengklaim seluruh frontend sudah terintegrasi.
