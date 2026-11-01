# SiCARE: Catatan Audit Statis Tahap 0 (Arsip)

**Tanggal snapshot:** 29 Oktober 2026
**Snapshot:** `SiCARE(8).zip`
**Fungsi dokumen:** rekaman rinci hasil audit Tahap 0, bukan status progres berjalan.
**Status terkini:** lihat [`../PROJECT_STATUS.md`](../PROJECT_STATUS.md); urutan kerja ada di [`../ROADMAP.md`](../ROADMAP.md).

> Catatan: laporan frontend-only dari 26 Oktober diarsipkan pada `PROGRESS_FRONTEND_BASELINE_2026-10-26.md`. Dokumen lama tersebut berasal dari snapshot lebih awal dan tidak boleh dipakai untuk menyimpulkan kondisi backend saat ini.

## 1. Ruang lingkup Tahap 0 yang dikerjakan

- Menginventaris route frontend dan endpoint backend.
- Memetakan setiap endpoint ke halaman/pemanggil frontend yang ditemukan.
- Menginventaris sumber data mock/local state yang masih aktif.
- Menilai cakupan logika bisnis dan SOP berdasarkan kode serta dokumen yang tersedia.
- Mencatat masalah baseline dan risiko sebelum implementasi batch berikutnya.
- Menyelaraskan instruksi proyek yang sebelumnya menyebut aplikasi frontend-only.

**Tidak dilakukan:** perubahan `fe/src`, `be/src`, SQL migration, data Supabase, konfigurasi environment, atau perubahan UI/behavior aplikasi.

## 2. Deliverable audit

| Dokumen | Isi |
|---|---|
| `../integration/API_ENDPOINT_MATRIX.md` | Inventaris 58 handler endpoint, role backend, halaman/pemanggil, status integrasi, dan catatan kontrak. |
| `../integration/SOP_COVERAGE_MATRIX.md` | Matriks 27 proses/SOP, aturan yang terlihat di kode, cakupan frontend, gap, dan kriteria penerimaan. |
| `AGENTS.md` | Instruksi agent diselaraskan dengan arsitektur full-stack saat ini dan aturan keamanan data. |
| `docs/refactor/MASTER_PLAN.md` | Diberi batasan yang jelas sebagai rencana refactor frontend historis. |
| `docs/refactor/DATA_ARCHITECTURE.md` dan `ACCEPTANCE_CRITERIA.md` | Ditandai sebagai referensi prototipe/mock, bukan kontrak integrasi produksi. |
| `docs/backend/TAHAP7_ADMIN_COUNSELOR_REPORTING.md` | Pernyataan lama tentang Hero diselaraskan dengan source code terbaru dan migrasi yang hilang. |

## 3. Ringkasan arsitektur yang ditemukan

| Area | Temuan statis |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4, React Router, Zustand. Terdapat 33 route aplikasi eksplisit ditambah catch-all. |
| Backend | Express dengan mount prefix `/api/v1`; 58 deklarasi handler route. |
| API frontend | Ditemukan 23 bentuk method/path yang dipanggil frontend. Satu endpoint health digunakan oleh skrip operasional, bukan halaman UI. Ini bukan hasil pengujian runtime. |
| Database | Empat file migrasi SQL tersedia dalam snapshot. Tabel `hero_motivations` tidak didefinisikan dalam file tersebut. |
| Autentikasi | `AuthProvider` memakai `/auth/register`, `/auth/login`, `/auth/me`, `/auth/logout` serta Supabase Auth untuk sesi browser. |
| API wrapper | `api.ts` menyediakan wrapper terpusat. `publicApi.ts` dan `sicareApi.ts` masih memiliki tipe/wrapper publik yang tumpang tindih. Admin Pengaturan juga memanggil API Hero langsung dari halaman. |
| Data dummy | Data mock masih digunakan di banyak halaman Klien, Konselor, Admin, dan Kepala LMI. Zustand/local state bukan bukti data tersimpan di backend. |

## 4. Cakupan integrasi frontend

### Terhubung atau dipanggil sebagian

- Autentikasi: register, login, `/auth/me`, logout.
- Data publik: konselor, periode, ketersediaan, feedback, dan kalimat motivasi Hero.
- Klien: daftar/pembuatan booking, pembatalan booking, usulan penjadwalan ulang, daftar sesi, baca feedback sendiri, dan kirim feedback.
- Notifikasi: daftar notifikasi, tandai satu dibaca, tandai semua dibaca.
- Admin Pengaturan: CRUD kalimat motivasi Hero.

### Belum terhubung ke halaman yang sesuai

- Profil pengguna dan persetujuan WhatsApp.
- Akun admin dan publikasi profil konselor.
- CRUD periode akademik.
- Profil dan ketersediaan konselor.
- Keputusan booking oleh konselor dan transisi status sesi.
- Feedback konselor, antrean moderasi Admin, dan review Kepala LMI.
- Dashboard, laporan, aktivitas admin, dan daftar konseling lintas-role.
- Detail booking/sesi.

Rincian per endpoint ada di `../integration/API_ENDPOINT_MATRIX.md`.

## 5. Gap SOP dan data sensitif

Temuan berikut harus diselesaikan atau diklarifikasi sebelum sistem dinyatakan mencakup seluruh SOP:

1. **Intake:** frontend memiliki pilihan/field intake, tetapi payload `POST /bookings` tidak mengirim jawaban intake dan database/API belum menyediakan model persistensinya.
2. **Informed consent dan tanda tangan:** tidak ditemukan tabel atau endpoint untuk menyimpan versi dokumen, status, pihak, waktu persetujuan, atau bukti tanda tangan.
3. **Catatan konseling:** skema dan endpoint catatan konseling belum ditemukan. Riwayat konselor masih menggunakan mock.
4. **Kunci riwayat konselor:** password default `1234`, digest, jumlah percobaan, dan waktu akses berada di `sessionStorage`. Ini hanya pengunci UI, bukan otorisasi backend.
5. **Jadwal dan keputusan booking:** endpoint backend sudah ada, tetapi halaman Konselor Jadwal dan Permintaan masih menggunakan seed/mock/store lokal.
6. **Feedback:** klien dan halaman publik telah memakai API, tetapi moderasi Admin serta review Kepala LMI masih memakai mock/store.
7. **Dashboard/laporan:** endpoint backend tersedia, tetapi dashboard dan laporan role masih memakai mock. Definisi metrik perlu diverifikasi terhadap data database.
8. **WhatsApp:** endpoint persetujuan opt-in/out dan tabel outbox tersedia, tetapi worker pengiriman belum ada. Jangan mengklaim pesan terkirim.
9. **Hero:** endpoint frontend/backend sudah dibuat, tetapi migrasi `20261029100000_sicare_hero_motivations.sql` tidak ada pada ZIP dan menyebabkan satu test gagal.
10. **SOP formal:** tidak ditemukan satu dokumen SOP konseling resmi yang lengkap di snapshot. Matriks hanya mencatat aturan yang terlihat di kode dan menandai area yang perlu keputusan pemilik SOP.

Rincian lengkap dan kriteria penerimaan ada di `../integration/SOP_COVERAGE_MATRIX.md`.

## 6. Pemeriksaan baseline

| Pemeriksaan | Hasil | Bukti/keterbatasan |
|---|---|---|
| `be: npm run check` | **PASS** | Semua file JavaScript yang terdaftar dalam script lolos `node --check`. |
| `be: npm test` | **FAIL: 19/22 lulus** | Dua test gagal karena paket `express` dan `cors` tidak tersedia di `node_modules`; satu test gagal karena file migrasi Hero tidak ada. |
| `be: npm ci --no-audit --no-fund` | **BLOCKED / TIMEOUT** | Instalasi dependensi tidak selesai dalam batas waktu audit; direktori dependensi parsial dibersihkan dari salinan kerja audit. |
| `fe: npm run build` | **BLOCKED** | Dependensi tidak terpasang; TypeScript tidak menemukan `vite/client` dan tipe `node`. Ini belum membuktikan source frontend gagal setelah instalasi normal. |
| `fe: npm run lint` | **BLOCKED** | `eslint` tidak tersedia karena dependensi belum terpasang. |
| Live Supabase/API | **NOT RUN** | Tidak dilakukan request ke project remote; `.env` runtime tidak disertakan dalam paket. |
| Browser end-to-end lintas-role | **NOT RUN** | Belum dilakukan pada audit statis ini. |
| `git status` | **NOT RUN** | ZIP tidak menyertakan direktori `.git`, jadi status working tree asal tidak dapat diperiksa. |

## 7. Prioritas yang direkomendasikan

### P0: pulihkan baseline dan blokir keamanan

- Pulihkan/tinjau migrasi Hero yang dirujuk oleh test dan README, lalu verifikasi pada database non-produksi sebelum mengaplikasikannya.
- Pastikan instalasi dependency dapat berjalan pada lingkungan lokal pengguna; ulangi build, lint, dan test setelah `npm ci` berhasil.
- Jangan menyimpan atau mengklaim intake, consent, tanda tangan, maupun catatan konseling sebagai data backend sampai model, endpoint, otorisasi, retensi, dan audit disetujui.

### P1: tutup siklus inti lintas-role

- Admin Periode dan Konselor Jadwal → jadwal publik.
- Klien Booking → Konselor Permintaan → keputusan booking → Klien Aktivitas.
- Booking terkonfirmasi → Konselor Aktivitas → status sesi → Riwayat Klien.
- Klien Feedback → Admin Moderasi → publik; review Kepala LMI tetap merupakan status terpisah.

### P2: operasional dan konsolidasi

- Hubungkan profil, akun, dashboard, laporan, dan aktivitas admin.
- Verifikasi notifikasi untuk seluruh event SOP yang disepakati.
- Konsolidasikan tipe/wrapper API setelah kontrak dan use case stabil.
- Tetapkan apakah mood tracker perlu disimpan, lalu ikuti keputusan privasi dan retensi.

## 8. Kriteria penutupan Tahap 0

- [x] Inventaris 58 handler endpoint selesai.
- [x] Pemetaan pemanggil frontend dan status integrasi selesai.
- [x] Gap SOP/logika bisnis utama terdokumentasi.
- [x] Dokumentasi yang menyebut frontend-only diberi konteks historis atau diperbarui.
- [x] Tidak ada perubahan pada source code aplikasi atau database.
- [ ] Build, lint, dan seluruh test lulus setelah dependensi dipulihkan.
- [ ] Smoke test live dan E2E lintas-role dijalankan pada environment non-produksi.

**Status akhir:** Tahap 0 selesai untuk audit statis dan dokumentasi. Tahap 0 belum selesai untuk validasi runtime. Jangan mulai batch implementasi API berikutnya sebelum pengguna menyetujui prioritas P0 dan kondisi baseline sudah dapat diuji.


---

**Catatan pemeliharaan:** dokumen ini dipertahankan sebagai laporan audit statis bertanggal. Jangan memperbarui status pekerjaan harian di sini. Pembaruan progres berikutnya harus masuk ke [`../PROJECT_STATUS.md`](../PROJECT_STATUS.md).
