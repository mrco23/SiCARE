# SiCARE Data Architecture: Dummy Data, Relasi, dan Zustand

> **Status per 29 Oktober 2026:** dokumen ini berasal dari desain prototipe frontend/mock sebelum integrasi backend. SiCARE kini memiliki backend Express dan Supabase. Untuk pekerjaan integrasi aktif, gunakan `../integration/API_ENDPOINT_MATRIX.md` dan `../integration/SOP_COVERAGE_MATRIX.md`. Rekomendasi persistensi mock di bawah tidak berlaku untuk domain yang sudah memiliki API atau data sensitif.

## 1. Ruang Lingkup

Dokumen ini menjelaskan struktur data dummy untuk memahami dan memigrasikan UI prototipe. Data mock dan Zustand bukan penyimpanan produksi serta tidak memberi jaminan keamanan.

Prioritas domain: users/clients/counselors, bookings, counseling sessions, consents, feedback, academic periods. Domain lain mengikuti kebutuhan saat ditemukan.

## 2. Pemisahan Tanggung Jawab

| Lokasi | Isi | Boleh berubah runtime? |
|---|---|---|
| `src/data/mock/*.ts` | Seed data demonstrasi stabil dan mudah diaudit | Tidak; dataset awal konstan |
| `src/data/fixtures/*.ts` | Skenario untuk pengujian manual/otomatis | Tidak, kecuali fixture sengaja diubah |
| `src/types/*.ts` | Kontrak/identitas domain dan tipe status | Tidak |
| `src/constants/status/*.ts` | Kode status, label, mapping, transisi | Tidak |
| `src/features/*/store/*` | Zustand shared state + actions | Ya |
| `src/features/*/selectors/*` | Query/proyeksi domain untuk UI | Tidak, pure |
| `src/features/*/hooks/*` | Integrasi state, validasi, time tracking, local behavior | Ya sesuai hook |
| `src/pages/*` | Komposisi render + event handlers tipis | Lokal UI saja |
| `src/services/` | Adapter domain jika diperlukan setelah kontrak API disepakati | Status implementasi harus diperiksa pada working tree terbaru |

## 3. ID Kanonis dan Relasi

**Jangan menyamakan record hanya dari nama, email, tanggal, urutan array, atau id numerik yang kebetulan sama.**

Usulan ID berprefiks (semua string agar aman lintas-domain):

- user: `usr-...`
- client: `cli-...`
- counselor: `cou-...`
- booking: `bok-...`
- session: `ses-...`
- consent: `con-...`
- feedback: `fbk-...`

Ini adalah usulan. Sebelum migrasi, buat tabel **mapping ID existing → kanonis**; jika ID lama dipakai logika spesifik, siapkan adapter sampai seluruh consumer dimigrasi.

```text
User 1 ── 0..1 Client / Counselor / Admin / KepalaLMI profile
Client 1 ── 0..N Booking ── 1 Counselor
Booking 0..1 ── 1 CounselingSession (terbentuk hanya jika sesuai aturan bisnis)
CounselingSession 0..1 ── 1 Consent
CounselingSession 0..1 ── 1 Feedback
```

Hubungan Booking–Session dan Session–Consent bersifat **opsional sampai memang ada data yang cocok**. Jangan buat tanda tangan atau feedback palsu untuk memaksakan hubungan.

## 4. Draft Kontrak Domain

Agent wajib menyesuaikan schema final dengan kode nyata, bukan mengganti data untuk memenuhi contoh ini.

```ts
export type FeedbackStatus = "pending" | "shown" | "disabled";

export interface FeedbackRecord {
  id: string;
  sessionId: string | null;
  counselorId: string;
  rating: 1 | 2 | 3 | 4 | 5;
  text: string;
  createdAt: string; // ISO string
  status: FeedbackStatus;
  disabledReason?: string;
}

export interface ConsentRecord {
  id: string;
  sessionId: string;
  clientId: string;
  status: "unsigned" | "signed";
  signedAt?: string;
  // Signature payload tidak dipersist ke browser storage.
}

export interface BookingRecord {
  id: string;
  clientId: string;
  counselorId: string;
  status: string; // ganti union status kanonis setelah audit
  scheduledAt?: string;
}
```

`status: string` pada contoh booking adalah placeholder sementara. Setelah audit, gunakan union kanonis lengkap dari `constants/status/bookingStatus.ts`. Hindari nilai status bebas di implementasi final.

**Makna waktu:** simpan timestamp ISO dan tentukan timezone tampilan secara konsisten; jangan diam-diam mengubah WITA ke timezone lain. Periksa fungsi `toISO`, `relativeDate`, `Date.now()`, dan formatting di halaman lama.

## 5. Data Dummy Stabil

- Jangan membangkitkan ID baru dengan `Date.now()` atau `Math.random()` untuk seed tetap.
- Jangan membuat array mock baru di render/page; import dari satu sumber.
- Jika demo memerlukan sesi relatif terhadap hari ini, gunakan satu `demoClock`/seed anchor yang konsisten sepanjang lifecycle. **Pertahankan pengalaman simulasi berbasis waktu** yang sudah ada dan tulis keputusan supaya jadwal tidak bergeser tak terduga saat pindah route.
- Jangan mengubah jumlah, ringkasan, teks, atau rating dummy selama ekstraksi murni tanpa persetujuan.
- Bila dua dataset lama berbeda secara nyata, tandai sebagai `unlinked` hingga pengguna menentukan mapping.
- Buat fixture *empty state* dan *mixed status* tersendiri tanpa mengganti dataset utama.

## 6. State: Lokal vs Shared

**React `useState` lokal:** filter, pencarian, modal terbuka, tab aktif, show password, draft form, sorting, open menu, calendar viewport.

**Zustand shared:**

1. `useBookingStore`: booking list, status, konfirmasi, penolakan, usulan jadwal; selector berdasarkan clientId/counselorId/status.
2. `useConsentStore`: consent per session ID, status dan timestamp, referensi runtime tanda tangan bila benar-benar dibutuhkan dan aman untuk prototipe. Jangan persist signature.
3. `useFeedbackStore`: daftar feedback, moderasi, alasan nonaktif, selector list publik (`status === 'shown'`).

Masing-masing store mengekspor actions yang bermakna (`approveBooking`, `submitConsent`, `showFeedback`, `disableFeedback`, `resubmitForReview`) bukan membiarkan setiap page mengubah field mentah secara bebas.

**Peringatan:** sharing store lintas role pada satu browser adalah simulasi. Ini bukan autentikasi, isolasi pengguna, atau sinkronisasi antarperangkat.

## 7. Persistensi dan Reset

Kebutuhan "data dummy konsisten saat membuka halaman" memiliki dua lapis:

1. **Stabil saat navigasi / remount:** Zustand module store mempertahankan runtime state selama SPA terbuka.
2. **Stabil saat refresh:** dataset awal berasal dari mock yang tetap. Mutasi tertentu boleh dikembalikan ke awal kecuali pengguna menyetujui penyimpanan non-sensitif.

Kebijakan default:

- `localStorage` **tidak** dipakai untuk password, tanda tangan, catatan konseling, intake, ringkasan/keluhan, komentar feedback sensitif, atau isi sesi.
- `sessionStorage` untuk **timestamp akses riwayat konselor** hanya sesuai mekanisme existing; verifikasi frontend tetap dummy/tidak aman untuk produksi.
- Jika diperlukan persistensi moderasi feedback, pertimbangkan hanya **ID + status + alasan yang bukan informasi sensitif**, tetapi alasan penonaktifan dapat berisi data bebas. Secara default, **jangan persist alasan teks bebas** sampai ada review privasi dan persetujuan.
- Jangan menggunakan `persist()` Zustand secara otomatis untuk seluruh store. Gunakan partialize/schema version/migration hanya pada field yang memang diizinkan.
- Jika demo harus bertahan refresh untuk perubahan status non-sensitif, gunakan key versi seperti `sicare-demo:feedback-status:v1`; sediakan tombol reset demo atau util penghapus terkontrol.
- Jangan menghapus storage existing sebelum mapping dan mekanisme migrasi dinilai aman; dokumentasikan sebelum/after.

**Jika requirement berubah menjadi tanda tangan/consent riil yang bertahan refresh dan dapat diakses lintas akun, perlu backend/database dengan otorisasi. Jangan memalsukan persistence menggunakan browser storage.**

## 8. Status Moderasi Feedback

```text
PENDING --(Tampilkan)--> SHOWN
PENDING --(Nonaktifkan + alasan wajib)--> DISABLED
SHOWN   --(Nonaktifkan + alasan wajib)--> DISABLED
DISABLED --(Periksa ulang)--> PENDING
```

- Label UI: `Menunggu pemeriksaan`, `Ditampilkan`, `Dinonaktifkan`.
- Validasi: menonaktifkan mewajibkan alasan non-kosong setelah trim.
- Public/Kepala LMI/Konselor: perilaku penampilan feedback harus mengikuti hak akses fitur yang **sudah ada**. **Publik hanya menerima `shown`**; Admin dapat melihat semua sesuai filter.
- Aturan kepemilikan dan anonimitas: klien publik tidak boleh diperlihatkan nama/pengenal pembuat feedback; jangan mengambil data identitas dari mock client hanya karena relasi memungkinkan.
- Untuk feedback dinonaktifkan: bila alasan tetap tersimpan dalam state admin, **jangan bocorkan alasan ke komponen publik**.

## 9. Akses Riwayat Konselor

- Satu password prototipe untuk seluruh Riwayat Konseling (nilai awal `1234` pada versi yang telah diminta pengguna; cek kode terbaru).
- Masa akses tetap 30 menit dari waktu verifikasi, bukan rolling.
- Kedaluwarsa diperiksa via timestamp aktual (`Date.now()`), termasuk refresh, `visibilitychange`, focus, dan interval/timeout.
- Maksimal 3 kesalahan, kemudian cooldown/recovery sesuai implementasi yang disetujui.
- Hapus akses saat logout bila handler logout ada.
- Jangan simpan password di `sessionStorage` atau global store persisted.
- Jangan pernah memindahkan mekanisme ini ke `useBookingStore` atau `useFeedbackStore`.

## 10. Skenario Integrasi yang Harus Diuji

1. Klien membuat booking → konselor melihat ID yang sama → admin melihat status yang sama → konselor menerima/menolak → klien membaca hasil tanpa data duplikat.
2. Consent satu session ditandatangani di Aktivitas Klien → status muncul pada session yang sama di halaman konselor saat runtime masih aktif; tidak pernah berpindah ke klien lain.
3. Feedback klien dibuat → status awal `pending` → admin menampilkan → publik menampilkan feedback yang sama → admin menonaktifkan dengan alasan → publik menyembunyikannya.
4. Pindah route bolak-balik dan refresh: state mengikuti kebijakan persistensi, bukan berubah acak.
5. Cari/sort/filter/summary count pada Klien/Konselor/Admin tetap sesuai data shared.
6. Ketika relasi tidak ditemukan, UI menampilkan state yang benar, bukan mengambil record lain sebagai pengganti.
7. Logout/ubah user demo: jangan bocorkan informasi sesi sebelumnya. Untuk domain yang belum terhubung ke API, ini tetap simulasi, bukan keamanan produksi.

## 11. Sebelum Mengubah Kode

Agent harus menyerahkan:

- Daftar dataset existing serta lokasi tiap data dan field/status.
- Matriks mapping ID sumber dan daftar relasi ambigu.
- Schema kanonis beserta migration mapping.
- Rencana penyimpanan field dan reset demo.
- Perubahan UI atau behavior yang tidak dapat dipertahankan apa adanya, untuk persetujuan pengguna.

Jangan lanjut ke migrasi store bila daftar ambigu belum ditangani secara eksplisit.
