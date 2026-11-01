# SiCARE: Instruksi Tetap untuk AI Coding Agent

Instruksi ini berlaku untuk pekerjaan integrasi API dan pengembangan frontend SiCARE. Sebelum mengubah kode, baca `docs/README.md`, `docs/PROJECT_STATUS.md`, `docs/ROADMAP.md`, `docs/WORK_LOG.md` (minimal entri terakhir dan batch terkait), `docs/integration/API_ENDPOINT_MATRIX.md`, dan `docs/integration/SOP_COVERAGE_MATRIX.md`. Baca dokumentasi `docs/backend/` yang relevan dengan domain yang sedang dikerjakan.

## 1. Arsitektur dan sumber kebenaran

- SiCARE adalah aplikasi full-stack: frontend React 19, Vite, TypeScript, Tailwind CSS 4, React Router, dan Zustand; backend Express dengan API prefix `/api/v1`; Supabase Auth dan PostgreSQL menjadi layanan identitas/database.
- Source code pada working tree adalah sumber kebenaran implementasi. ZIP dan catatan audit adalah snapshot, bukan alasan untuk menimpa perubahan yang lebih baru.
- Deklarasi endpoint aktual berada di `be/src/routes/*.js` dan mount path di `be/app.js`. Pemetaan audit ada di `docs/integration/API_ENDPOINT_MATRIX.md`.
- Aturan yang terlihat dan gap SOP dicatat di `docs/integration/SOP_COVERAGE_MATRIX.md`. Jangan mengarang prosedur klinis yang belum disahkan pemilik SOP.
- `docs/PROJECT_STATUS.md` adalah sumber tunggal status progres terkini. `docs/ROADMAP.md` menyimpan urutan tahap. `docs/WORK_LOG.md` adalah catatan kronologis append-only untuk pekerjaan, keputusan, bukti pengujian, dan langkah lanjutan. `docs/refactor/PROGRESS.md` dan `docs/refactor/PROGRESS_FRONTEND_BASELINE_2026-10-26.md` adalah catatan historis, bukan sumber status berjalan.
- `docs/refactor/MASTER_PLAN.md`, `DATA_ARCHITECTURE.md`, dan `ACCEPTANCE_CRITERIA.md` berasal dari rencana refactor frontend/mock sebelumnya. Gunakan untuk keputusan visual/modular yang masih relevan, bukan sebagai bukti bahwa backend belum ada.
- Route frontend di `fe/src/app/router.tsx` tidak boleh diubah tanpa kebutuhan yang jelas dan persetujuan pengguna.

## 2. Aturan perubahan

1. Kerjakan hanya tahap dan batch yang diminta. Jangan otomatis melanjutkan ke batch berikutnya.
2. Pertahankan route, desain, teks, fitur, urutan, perilaku, dan responsivitas yang sudah ada kecuali perubahan telah disetujui atau diperlukan untuk menghubungkan perilaku backend yang sudah disepakati.
3. Jangan menghapus mock secara massal. Ganti sumber data satu alur pada satu waktu setelah adapter API dan kriteria penerimaannya jelas.
4. Jangan membuat endpoint, field, status, atau transisi baru hanya berdasarkan asumsi. Perbarui matriks kontrak dan jelaskan jika backend perlu perubahan.
5. Gunakan wrapper `fe/src/lib/api.ts` dan API helper yang ada (`publicApi.ts`, `sicareApi.ts`) sebagai fondasi. Hindari menambah pemanggilan `fetch` langsung atau kontrak DTO duplikat tanpa alasan. API helper dapat dikonsolidasikan bertahap, bukan dalam refactor massal.
6. Gunakan `#064E3B` sebagai warna primary brand. Pertahankan utility Tailwind `className` di TSX; CSS khusus, token, dan animasi reusable berada di `fe/src/index.css`.
7. Gunakan Zustand hanya untuk state lintas halaman yang memang perlu dibagikan. State form, modal, filter lokal, dan state request tetap lokal jika tidak perlu dibagikan.
8. Gunakan ID backend sebagai identitas kanonis. Jangan menyambungkan record berdasarkan nama, indeks array, atau ID dummy yang tidak memiliki mapping terverifikasi.
9. Setiap mutasi harus menangani loading, kegagalan, validasi, dan rekonsiliasi bila beberapa request berhasil sebagian. Jangan menampilkan status sukses sebelum server mengonfirmasi.

## 3. Keamanan dan data sensitif

- Jangan pernah memasukkan Supabase secret/service-role key ke `VITE_*`, frontend, source control, atau artefak yang dibagikan. Frontend hanya boleh memakai publishable/anon key; secret backend tetap di environment server.
- Jangan menyimpan password, access token manual, tanda tangan digital, jawaban intake, catatan konseling, atau informasi sensitif lain dalam `localStorage`, persisted Zustand, atau data dummy.
- Route guard frontend bukan pengganti autentikasi dan otorisasi server. Endpoint sensitif harus memvalidasi role, pemilik record, dan transisi status di backend.
- Password/pengunci riwayat yang hanya berjalan di browser, termasuk `sessionStorage`, tidak boleh dianggap sebagai kontrol keamanan untuk data konseling produksi.
- Jangan menyatakan consent, tanda tangan, intake, catatan konseling, mood, notifikasi, atau pesan WhatsApp telah tersimpan/terkirim jika model database, endpoint, dan worker yang diperlukan belum tersedia dan diuji.
- Sebelum menambah tabel atau endpoint untuk data konseling, minta/rujuk SOP resmi mengenai field, akses, retensi, audit, dan penghapusan.
- Audit trail tidak boleh menyalin token, isi konseling, jawaban intake, komentar sensitif, atau data peserta yang tidak diperlukan ke metadata audit.

## 4. Aturan API dan database

- Base URL frontend harus berisi `/api/v1` melalui `VITE_API_BASE_URL`. Jangan menambahkan prefix kedua kali.
- Ikuti DTO, validasi Zod, role middleware, dan status yang benar-benar didefinisikan backend. Perubahan kontrak harus dicatat di matriks endpoint.
- Periksa migrasi lokal dan status remote sebelum menerapkan migrasi. Gunakan database non-produksi untuk pengujian tulis; jangan menjalankan migrasi atau mutasi remote tanpa instruksi eksplisit.
- Jangan menyamakan persetujuan WhatsApp dengan pengiriman pesan. Outbox tanpa worker bukan sistem pengiriman lengkap.
- Waktu disimpan sebagai timestamp yang konsisten; zona waktu tampilan harus mengikuti kebijakan operasional yang disepakati dan diuji.

## 5. Prosedur setiap batch

1. Baca status dan roadmap; baca matriks endpoint/SOP serta dokumentasi domain terkait.
2. Tetapkan scope, file yang akan diubah, risiko, dan kriteria penerimaan.
3. Periksa status repository jika `.git` tersedia; jangan overwrite perubahan pengguna.
4. Lakukan perubahan terkecil yang menyelesaikan batch.
5. Jalankan pemeriksaan yang relevan: `npm run check`, `npm test`, `npm run build`, `npm run lint`, serta tes integrasi/browser yang tersedia. Catat PASS/FAIL/BLOCKED/NOT RUN secara jujur.
6. Periksa diff dan pastikan tidak ada secret, file environment, dependency directory, atau artefak sementara yang ikut dikemas.
7. Perbarui `docs/PROJECT_STATUS.md` setelah setiap batch. Perbarui matriks endpoint/SOP atau dokumentasi domain jika kontrak/implementasi berubah; ubah `docs/ROADMAP.md` hanya jika urutan atau scope yang disetujui berubah.
8. Laporkan file yang berubah, hasil verifikasi, risiko tersisa, dan batch berikutnya. Berhenti setelah scope selesai.

## 6. Format pelaporan

Setiap laporan penyelesaian batch harus mencantumkan:

- Tahap/batch dan ringkasan perubahan.
- File yang berubah.
- Pemeriksaan yang dijalankan dan hasil faktualnya.
- Risiko, baseline issue, dan bagian yang belum diuji.
- Tugas berikutnya yang disarankan.

Jangan menduplikasi log progres panjang di file ini. `AGENTS.md` berisi aturan tetap; status terbaru berada di `docs/PROJECT_STATUS.md`, rencana di `docs/ROADMAP.md`, dan riwayat batch di `docs/WORK_LOG.md`.


## Timeline pengembangan

Sebelum memulai batch, baca `docs/IMPLEMENTATION_TIMELINE.md` bersama `docs/PROJECT_STATUS.md` dan `docs/ROADMAP.md`. Jika estimasi, urutan, atau milestone berubah, perbarui timeline dan catat alasan perubahan di `docs/WORK_LOG.md`. Jangan menandai task selesai tanpa bukti pengujian dan acceptance criteria.


## Tenggat team testing

Jika tenggat team testing Minggu 1 November 2026 masih berlaku, baca `docs/WEEKEND_READINESS_PLAN.md` sebelum mengerjakan batch. Prioritaskan blocker P0 dan jangan memperluas scope ke P1/P2 sebelum alur wajib stabil. Catat status aktual; jangan menganggap fitur mock sebagai integrasi live.
