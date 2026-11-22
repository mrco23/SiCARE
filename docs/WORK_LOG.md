# SiCARE Work Log

**Fungsi:** catatan kronologis keputusan, pekerjaan, bukti validasi, dan langkah lanjutan. Dokumen ini bersifat historis dan ditambahkan setiap kali batch selesai atau ada hasil pengujian baru.

**Sumber status terkini:** [`PROJECT_STATUS.md`](PROJECT_STATUS.md)
**Rencana tahap:** [`ROADMAP.md`](ROADMAP.md)

> Aturan: jangan menulis hasil yang belum diuji sebagai `PASS`. Bedakan audit statis, test terisolasi, test suite penuh, smoke test API, dan pengujian browser. Jangan menyimpan password, token, `.env`, atau data pribadi sensitif di log.

## 2026-10-29 sampai 2026-10-30: Tahap 0, audit dan konsolidasi dokumentasi

### Tahap 0: audit statis

- Memeriksa snapshot `SiCARE(8).zip`, mencakup frontend React, backend Express, Supabase, route, API helper, dokumentasi, dan struktur proyek.
- Membuat pemetaan endpoint backend terhadap pemanggil frontend dan matriks cakupan SOP.
- Menandai alur yang masih memakai mock/local state, khususnya beberapa halaman Konselor, Admin, Kepala LMI, pengaturan, dan pelaporan.
- Membedakan keberadaan route/komponen dari bukti bahwa suatu alur sudah berjalan end-to-end.
- **Status:** audit statis selesai; belum merupakan pengujian runtime.

### Tahap 0.2: konsolidasi dokumentasi

- Menetapkan `AGENTS.md` sebagai instruksi tetap untuk coding agent.
- Menetapkan `docs/PROJECT_STATUS.md` sebagai sumber status terkini dan `docs/ROADMAP.md` sebagai urutan rencana.
- Menyelaraskan indeks dokumentasi dan memberi batas yang jelas antara dokumentasi integrasi API terbaru dengan catatan refactor frontend yang historis.
- **Status:** selesai. Tahap ini tidak mengubah logika aplikasi, API, atau database.

## 2026-10-29 sampai 2026-10-30: P0, pemulihan baseline dan validasi Hero

### Baseline lokal

- Pengguna menjalankan `npm ci` pada `fe/` dan `be/`.
- Backend `npm run check`: **PASS**.
- Backend `npm test`: **41/41 PASS**, 0 gagal, 0 skipped sebelum penambahan test ownership.
- Frontend `npm run build`: **PASS**; muncul peringatan non-blocking karena bundle JavaScript utama sekitar 1,30 MB sebelum gzip.
- Frontend `npm run lint`: **PASS**.
- `npm ci` frontend melaporkan 4 temuan low-severity; tidak menjalankan `npm audit fix --force` karena perubahan dependency berpotensi breaking. Backend melaporkan 0 vulnerability.

### Supabase dan migrasi Hero

- `npx supabase migration list` menunjukkan lima ID migrasi lokal cocok dengan remote: `20261027000000`, `20261028000000`, `20261028120000`, `20261028130000`, dan `20261029100000`.
- Query metadata read-only mengonfirmasi `public.hero_motivations` tersedia dengan kolom `id`, `content`, `is_active`, `created_at`, `updated_at`.
- Constraint panjang kalimat dan single-line tersedia; trigger `hero_motivations_set_updated_at` dan fungsi `set_updated_at()` tersedia.
- RLS aktif, tanpa policy langsung; grants yang terdeteksi untuk `postgres` dan `service_role`. Tidak ada migrasi yang didorong pada pemeriksaan ini.
- **Status:** pemeriksaan metadata Hero lulus; tidak ada data bisnis yang dibuat atau diubah.

### Live API smoke test dan role

- Pemeriksaan dasar: **15 PASS, 0 FAIL**. Enam endpoint publik menghasilkan HTTP 200 dan sembilan endpoint terlindungi menolak request tanpa token dengan HTTP 401.
- Percobaan matriks role pertama tidak valid karena script menyimpan token berdasarkan nama slot tanpa memeriksa role aktual akun. Hasil tersebut tidak digunakan untuk menilai bug otorisasi.
- Script diperbaiki agar `response.data.profile.app_role` harus cocok dengan role yang diminta sebelum token disimpan.
- Pengujian ulang memakai akun uji untuk `client`, `counselor`, `admin`, dan `head_lmi` yang role aktualnya telah diverifikasi: **57 PASS, 0 FAIL, 0 role dilewati**.
- Tes ini mencakup endpoint publik, autentikasi wajib, endpoint yang diizinkan per-role, dan beberapa penolakan lintas-role. Tes ini belum menguji isolasi dua pengguna berbeda dalam role yang sama atau seluruh operasi CRUD.
- **Status P0:** selesai untuk kriteria baseline, metadata Hero, smoke test, dan matriks role yang tercakup.

## 2026-10-30: Tahap 1, Batch 1.1, audit kontrak API

- Memeriksa API transport, wrapper publik, DTO frontend, serta route/query backend.
- Mencatat duplikasi DTO publik, perbedaan tipe availability, nested field booking/counselor yang tidak tersedia pada respons aktual, tipe feedback lintas-konteks yang terlalu umum, dan kebutuhan wrapper domain.
- Menegaskan UUID dari backend sebagai identitas kanonis; ID fixture atau indeks array tidak boleh dipakai sebagai ID API.
- **Status:** audit statis selesai. Rincian: [`integration/API_CONTRACT_AUDIT.md`](integration/API_CONTRACT_AUDIT.md).

## 2026-10-30: Tahap 1, Batch 1.2, DTO kanonis dan wrapper API

- Menambahkan `fe/src/types/api.ts` untuk DTO kanonis.
- Menambahkan `fe/src/lib/apiQuery.ts` untuk serialisasi query parameter.
- Menambahkan wrapper domain `counselorApi.ts`, `adminApi.ts`, dan `reportingApi.ts`; mengonsolidasikan wrapper publik dan memperbarui penggunaan Hero di Home dan Admin Pengaturan.
- Memperbarui beberapa halaman klien agar memakai kontrak respons backend aktual.
- Validasi pertama menemukan dua error TypeScript pada `KlienBerandaPage.tsx`: akses `upcoming.booking.counselor` dan `nextBooking.counselor` tidak sesuai dengan DTO.
- Perbaikan memakai `counselor_id` untuk mencocokkan `profile_id` pada direktori konselor publik, dengan fallback nama jika data direktori tidak tersedia. Tidak memperluas kontrak backend tanpa bukti.
- Setelah perbaikan, pengguna menjalankan `npm run build`: **PASS**. `npm run lint`: **PASS**.
- Build tetap memberi peringatan ukuran bundle; ini non-blocking dan dipisahkan dari integrasi API.
- **Status:** Batch 1.2 selesai dan tervalidasi pada mesin pengguna.

## 2026-10-30: Tahap 1, Batch 1.3, audit ID kanonis dan ownership

- Memetakan relasi UUID untuk profil, booking, sesi, jadwal, feedback, dan notifikasi.
- Meninjau owner filters dan pemeriksaan actor pada route/RPC yang tercakup. Audit source statis tidak menemukan bypass ownership yang jelas pada jalur yang diperiksa.
- Menambahkan `be/test/ownershipGuards.test.js` dengan 9 pemeriksaan source-level.
- Test terisolasi `node --test be/test/ownershipGuards.test.js`: **9 PASS, 0 FAIL**.
- Hasil ini belum membuktikan isolasi runtime. Full backend suite setelah test baru ditambahkan belum dikonfirmasi oleh pengguna.
- Pengujian live cross-user menggunakan dua akun client dan dua akun counselor berbeda belum dilakukan.
- **Status:** audit statis selesai; Batch 1.3 masih terbuka sampai full test suite dan live cross-user verification selesai.
- Rincian: [`integration/ID_OWNERSHIP_AUDIT.md`](integration/ID_OWNERSHIP_AUDIT.md).

## Langkah berikutnya yang disetujui

1. Jalankan full backend test suite setelah penambahan `ownershipGuards.test.js`.
2. Jika suite lulus, lakukan pemeriksaan read-only lintas-pengguna dengan dua akun client dan dua akun counselor berbeda. Jangan membuat atau mengubah booking/session/feedback hanya demi pengujian tanpa persetujuan.
3. Catat hasil setiap pasangan uji tanpa mencatat token atau data pribadi.
4. Jika semua pemeriksaan ownership lulus, tutup Batch 1.3.
5. Lanjutkan Batch 1.4 untuk menetapkan kontrak state UI: loading, empty, error, unauthorized, not found, conflict, dan server error.
6. Setelah Tahap 1 stabil, mulai Tahap 2 untuk data master dan jadwal, satu alur pada satu waktu.

## Template catatan untuk batch berikutnya

Salin template ini di bagian bawah log ketika batch baru selesai:

```markdown
## YYYY-MM-DD: Tahap N, Batch N.N, Nama batch

- **Tujuan:** ...
- **Perubahan:** file/area yang berubah dan alasan.
- **Validasi:** perintah atau skenario yang dijalankan beserta jumlah PASS/FAIL.
- **Tidak diuji:** ...
- **Risiko/keputusan:** ...
- **Status:** selesai / terbuka / terhambat.
- **Langkah berikutnya:** ...
```

## 2026-10-30: Penyusunan timeline implementasi

- Menyusun target timeline 2 November–30 Desember 2026 dengan estimasi 9 minggu.
- Memecah pekerjaan menjadi penutupan Tahap 1, integrasi data master/jadwal, booking/sesi, feedback/notifikasi, profil/dashboard/laporan, validasi dan implementasi SOP sensitif, E2E/stabilisasi, serta release readiness.
- Menetapkan deliverable, acceptance criteria, milestone, asumsi kapasitas, dan risiko jadwal.
- Timeline adalah estimasi, bukan bukti bahwa pekerjaan pada minggu-minggu tersebut telah dilakukan.
- Rincian: [`IMPLEMENTATION_TIMELINE.md`](IMPLEMENTATION_TIMELINE.md).


## 2026-10-30: Penyesuaian rencana untuk tenggat team testing

- Pengguna menetapkan bahwa website harus siap dijalankan paling lambat Minggu malam, 1 November 2026, untuk pengujian bersama tim.
- Prioritas diubah dari menyelesaikan roadmap 9 minggu menjadi menyiapkan build testing yang stabil dalam sprint darurat Jumat–Minggu.
- Ruang lingkup dibagi menjadi P0 (wajib), P1 (jika P0 stabil), dan P2 (ditunda).
- Roadmap 9 minggu tidak dibatalkan; pekerjaan yang tidak realistis diselesaikan sebelum tenggat akan dilanjutkan setelah team testing.
- Rencana lengkap: [`WEEKEND_READINESS_PLAN.md`](WEEKEND_READINESS_PLAN.md).
- Belum ada task sprint darurat yang dinyatakan selesai hanya berdasarkan dokumen rencana ini.


## 2026-10-30: Tahap 1.2, finalisasi integrasi Hero Motivation

- Meninjau implementasi terbaru pada `HomePage.tsx`, `AdminPengaturanPage.tsx`, `publicApi.ts`, `adminApi.ts`, DTO, route backend, dan migrasi Hero.
- Memastikan halaman Admin sudah menggunakan wrapper `adminApi` untuk list/create/update/delete; semua method menggunakan endpoint Hero yang benar dan `auth: true`.
- Memastikan HomePage memanggil `getPublicHeroMotivations()`, memilih satu kalimat nonkosong dari daftar aktif, memakai fallback default saat daftar kosong/API gagal, dan merender hasil pada Hero. Backend menyaring `is_active = true`.
- Menemukan dua assertion lama di `be/test/heroMotivations.test.js` yang masih mencari pemanggilan `apiRequest` langsung di halaman. Assertion diperbarui agar memeriksa pemanggilan wrapper pada halaman serta endpoint, method, dan autentikasi pada wrapper domain.
- Memperbaiki regex pemeriksaan migrasi untuk memastikan whitespace pada `created_by` dan `paragraph` benar-benar diperiksa.
- `node --test test/heroMotivations.test.js`: **5 PASS, 0 FAIL**.
- `npm run check` backend: **PASS**.
- Full `npm test` setelah koreksi: **NOT RUN** pada workspace audit karena `npm ci` timeout dan dependency backend tidak terpasang lengkap. Full suite harus dijalankan ulang pada komputer pengguna.
- Frontend `npm run build` dan `npm run lint`: **PASS berdasarkan hasil terminal pengguna sebelum subtask ini**; tidak ada source frontend yang diubah.
- Tidak ada perubahan backend route, database, migrasi, `.env`, atau data Supabase.
- **Status:** implementasi Hero sudah terhubung secara statis; focused regression tests lulus. Penutupan subtask menunggu full backend suite di komputer pengguna.


## 2026-10-30: Tahap 1, Stage 1.3, Live Ownership Verification & Repository Preflight Audit

- **Tujuan:** melakukan preflight repository dan mengaudit keamanan ownership lintas domain (autentikasi, booking, sesi, feedback, notifikasi, data konselor, admin/Head LMI, serta RLS/grants) beserta verifikasi runtime yang aman.
- **Perubahan:** membuat laporan [`audits/STAGE_1_3_OWNERSHIP_AUDIT.md`](audits/STAGE_1_3_OWNERSHIP_AUDIT.md). Tidak mengubah source code aplikasi, skema, migrasi, atau data remote.
- **Validasi:**
  - `be: node --test` (dengan izin loopback lokal): **50 PASS, 0 FAIL, 0 SKIPPED** (dalam sandbox tanpa izin port: 30 PASS, 20 FAIL karena `connect EACCES 127.0.0.1`).
  - `be: npm run check`: **PASS**.
  - `fe: npm run build`: **PASS** (dengan peringatan ukuran bundle utama ~1,30 MB sebelum gzip).
  - `fe: npm run lint`: **PASS**.
  - `be: npm run verify:live` terhadap backend lokal sementara: **15 PASS, 0 FAIL**, 4 role token skipped.
  - Probe RLS anonim read-only ke PostgREST (menggunakan publishable key): **11 PASS, 0 FAIL** — akses anonim ke 9 tabel privat dan RPC `sicare_public_availability` ditolak `401/42501`.
- **Tidak diuji / BLOCKED:** verifikasi ownership live lintas-pengguna (Client A vs Client B, Counselor A vs Counselor B) serta verifikasi RLS dengan konteks user terautentikasi **BLOCKED** karena keempat token akun uji (`SICARE_CLIENT_A_TOKEN`, `SICARE_CLIENT_B_TOKEN`, `SICARE_COUNSELOR_A_TOKEN`, `SICARE_COUNSELOR_B_TOKEN`) dan data uji berpasangan tidak tersedia di environment.
- **Temuan utama:**
  - Tidak ditemukan bypass ownership statis pada handler API maupun RPC SQL aktif.
  - `.gitignore` root mengabaikan `/AGENTS.md` dan `/docs/`, tidak mengabaikan `supabase/.temp/`, dan memiliki typo `.fe/node_modules`.
  - Satu assertion di `be/test/ownershipGuards.test.js` memeriksa definisi `sicare_transition_booking` dari migrasi `20261028000000_*` yang sudah digantikan oleh `20261028120000_*`.
- **Status:** audit selesai; penutupan penuh Stage 1.3 masih menunggu live cross-user ownership verification.


## 2026-10-30: Tahap 1, Batch 1.3a, Repository Hygiene & Git Tracking

- **Tujuan:** memperbaiki aturan `.gitignore` root agar dokumentasi kanonis (`AGENTS.md`, `docs/`) eligible untuk Git tracking dan file sementara `supabase/.temp/` diabaikan, tanpa kehilangan perubahan kerja atau men-stage file secara otomatis.
- **Perubahan:**
  - Memperbarui `.gitignore` root: menghapus `/AGENTS.md` dan `/docs/`, menambahkan `supabase/.temp/`, serta memperbaiki `.fe/node_modules` menjadi `node_modules/`.
  - Memperbarui [`PROJECT_STATUS.md`](PROJECT_STATUS.md), [`WORK_LOG.md`](WORK_LOG.md), dan hasil build/lint aktual pada [`audits/STAGE_1_3_OWNERSHIP_AUDIT.md`](audits/STAGE_1_3_OWNERSHIP_AUDIT.md).
- **Validasi:**
  - `git check-ignore -v AGENTS.md`, `docs/PROJECT_STATUS.md`, `docs/WORK_LOG.md`: kosong (tidak lagi diabaikan — **PASS**).
  - `git check-ignore -v supabase/.temp/project-ref`: cocok pada `.gitignore:27:supabase/.temp/` (**PASS**).
  - `git check-ignore -v be/.env fe/.env.local`: tetap diabaikan (**PASS**).
  - `git diff --check`: **PASS** (tanpa whitespace/conflict error).
  - Tidak ada `git add`, `git commit`, `git push`, atau perubahan branch yang dijalankan.
- **Status:** Batch 1.3a selesai.
- **Langkah berikutnya:** tinjau inventaris file untracked untuk staging/commit terkontrol ke `development`, lanjutkan ke Batch 1.3b (perbaikan assertion `ownershipGuards.test.js` dan unit test negatif ownership) serta Batch 1.3c (harness dan eksekusi live cross-user ownership verification).


## 2026-10-30: Tahap 1, Batch 1.3b, Ownership Test Hardening

- **Tujuan:** memperbaiki assertion migrasi SQL yang usang untuk `sicare_transition_booking` dan menambahkan pengujian ownership runtime (termasuk skenario akses negatif lintas-pengguna dan lintas-role) yang mengeksekusi pipeline Express + route handler nyata tanpa bergantung pada kredensial Supabase nyata atau menyentuh database produksi.
- **Perubahan:**
  - `be/src/config/supabase.js`: menambahkan hook injeksi test minimal `setSupabaseAdminClientForTests(client)` dan memperbarui `getSupabaseAdminClient()` serta `isSupabaseConfigured()` agar pengujian dapat menyuntikkan mock Supabase in-memory dan membersihkannya kembali setelah setiap request.
  - `be/test/ownershipGuards.test.js`:
    1. Menambahkan helper `latestFunctionDefinition(functionName)` yang mengurutkan file migrasi secara kronologis (`20261027000000_*` s.d. `20261029100000_*`) dan mengekstrak definisi `create or replace function public.<name>` paling mutakhir.
    2. Memperbaiki test transisi booking agar memverifikasi definisi aktif `sicare_transition_booking` pada `20261028120000_sicare_public_availability_rescheduling.sql` (termasuk pemeriksaan akun aktif, kepemilikan `counselor_id`/`client_id`, pembatasan target status `'cancelled'` untuk client, perlindungan `BOOKING_SESSION_ALREADY_STARTED`, penolakan `BOOKING_FORBIDDEN`, dan pencabutan hak eksekusi dari `public, anon, authenticated`).
    3. Menambahkan **11 test runtime ownership & negative authorization baru** (sehingga total test di `ownershipGuards.test.js` meningkat dari 9 menjadi 20, dan total backend suite meningkat dari 50 menjadi 61) menggunakan dispatcher HTTP in-memory (`requestApp`) dan mock database relasional (`createOwnershipMockDb`) yang menyimpan record milik User A dan User B secara bersamaan:
       - Autentikasi & profil: penolakan akun `disabled` (`403 ACCOUNT_INACTIVE`) dan pencegahan injeksi `id`/`app_role` pada `PATCH /api/v1/profile`.
       - Booking (4 test): isolasi koleksi & detail Client A vs Client B (`404 BOOKING_NOT_FOUND` + verifikasi filter `.eq("client_id", ...)`), pencegahan pembuatan booking dengan `client_id` milik client lain, isolasi koleksi/detail/transisi Counselor A vs Counselor B (`404`/`403 BOOKING_FORBIDDEN`), serta penolakan reschedule/cancel lintas-pengguna.
       - Sesi konseling (2 test): isolasi daftar & detail sesi untuk Client A/B dan Counselor A/B (`404 SESSION_NOT_FOUND`), penolakan transisi status sesi oleh client (`403 FORBIDDEN`) atau counselor lain (`403 SESSION_FORBIDDEN`), serta penolakan injeksi `counselor_id` di body.
       - Feedback (1 test): isolasi `/feedback/mine` (Client B tidak menerima feedback Client A), isolasi `/feedback/counselor` (hanya `moderation_status = 'shown'` milik counselor terkait), penolakan submit feedback pada sesi milik client lain atau sesi yang belum `completed` (`409 FEEDBACK_NOT_ELIGIBLE`), serta penolakan akses detail/moderasi oleh client/counselor (`403`).
       - Notifikasi (1 test): isolasi daftar & unread count per penerima, penolakan `PATCH /notifications/:id/read` lintas-client maupun lintas-counselor (`404 NOTIFICATION_NOT_FOUND` tanpa mengubah `read_at` pemilik asli), dan pembatasan `PATCH /notifications/read-all` hanya pada notifikasi penerima.
       - Counselor profile & availability (1 test): isolasi profil & slot jadwal Counselor A vs B, pencegahan injeksi `profile_id`/`counselor_id`, serta penolakan `PATCH`/`DELETE /counselor/availability/:id` atas slot milik counselor lain (`404 AVAILABILITY_NOT_FOUND`).
       - Admin & Head LMI (1 test): penolakan Client/Counselor dari seluruh route Admin/Head LMI (`403`), pemisahan tegas izin Admin vs Head LMI (Head LMI ditolak dari `/admin/accounts`, `/admin/periods`, `/admin/hero-motivations`, `/admin/activity`, `/admin/dashboard`, `/admin/reports`, dan moderasi feedback; Admin ditolak dari `/head-lmi/dashboard`, `/head-lmi/reports`, dan review feedback), serta safeguard `409 SELF_ADMIN_CHANGE_BLOCKED`.
- **Validasi:**
  - `be: node --test test/ownershipGuards.test.js`: **20 PASS, 0 FAIL** (berjalan di dalam sandbox tanpa memerlukan port TCP).
  - `be: node --test` (full suite dengan izin loopback untuk `health.test.js`): **61 PASS, 0 FAIL, 0 SKIPPED** (di dalam sandbox tanpa izin port: 41 PASS, 20 FAIL pada `health.test.js` karena `connect EACCES 127.0.0.1`).
  - `be: npm run check`: **PASS**.
- **Tidak diuji / BLOCKED:** pengujian mock runtime membuktikan perilaku middleware/handler Express, namun **tidak** membuktikan penegakan RLS PostgreSQL nyata. Verifikasi live cross-user ownership dan RLS terautentikasi tetap **BLOCKED** sampai 4 akun uji dan data uji tersedia.
- **Status:** Batch 1.3b selesai.
- **Langkah berikutnya:** lanjutkan ke Batch 1.3c (penyusunan harness & eksekusi live cross-user ownership verification dengan 4 akun uji), serta staging/commit terkontrol ke `development`.



## 2026-10-30: Tahap 1, Batch 1.3c, Live Cross-User Ownership & RLS Verification

- **Tujuan:** menyusun dan menjalankan harness verifikasi read-only live cross-user ownership (Backend API) dan authenticated PostgREST RLS terhadap environment Supabase non-produksi menggunakan empat akun terpisah (`Client A`, `Client B`, `Counselor A`, `Counselor B`), tanpa melakukan mutasi data atau membocorkan secret/PII.
- **Perubahan:**
  - `be/scripts/verify-live-ownership.js`: membuat skrip verifikasi read-only yang:
    1. Menerapkan safety gate non-production (`NODE_ENV !== 'production'` dan URL tidak mengandung indikator produksi).
    2. Memeriksa ketersediaan keempat variabel token (`SICARE_CLIENT_A_TOKEN`, `SICARE_CLIENT_B_TOKEN`, `SICARE_COUNSELOR_A_TOKEN`, `SICARE_COUNSELOR_B_TOKEN`) dan memverifikasi identitas (`role`, `is_active === true`, serta 4 UUID berbeda) melalui `GET /api/v1/auth/me`.
    3. Menemukan resource uji yang sudah ada (`Booking A`, `Booking B`, `Session A`, `Session B`, `Feedback`, `Notifications`, `Availability Slots`) secara dinamis melalui endpoint `GET` tanpa mengarang UUID atau melakukan seeding/mutasi.
    4. Memisahkan 29 pemeriksaan Backend API (`API-BK-01` s/d `API-BK-10`, `API-SS-01` s/d `API-SS-08`, `API-FB-01` s/d `API-FB-04`, `API-NT-01` s/d `API-NT-04`, `API-CS-01` s/d `API-CS-03`) dari 13 pemeriksaan Direct Authenticated PostgREST RLS (`RLS-A-01` s/d `RLS-A-04`, `RLS-B-01` s/d `RLS-B-05`, `RLS-C-01` s/d `RLS-C-04` menggunakan `SUPABASE_PUBLISHABLE_KEY` + user `Bearer` token), serta mencatat 6 skenario mutasi negatif (`MUT-01` s/d `MUT-06`) sebagai `NOT TESTED` (karena mode strictly read-only).
    5. Melakukan redaksi penuh atas token, email, nomor telepon, dan hanya menampilkan potongan UUID yang telah di-redact.
  - `be/package.json`: menambahkan `"verify:ownership": "node scripts/verify-live-ownership.js"` dan menyertakan `node --check scripts/verify-live-ownership.js` pada `"check"`.
  - `docs/audits/STAGE_1_3C_LIVE_OWNERSHIP_VERIFICATION.md`: membuat laporan lengkap 12 bagian beserta matriks 48 pemeriksaan (`29 API` + `13 RLS` + `6 MUT`).
  - Memperbarui [`PROJECT_STATUS.md`](PROJECT_STATUS.md) dan [`audits/STAGE_1_3_OWNERSHIP_AUDIT.md`](audits/STAGE_1_3_OWNERSHIP_AUDIT.md).
- **Validasi:**
  - `be: npm run check`: **PASS** (termasuk `scripts/verify-live-ownership.js`).
  - `be: npm test`: **61/61 PASS** (dengan izin loopback untuk `health.test.js`).
  - `be: npm run verify:ownership`: berjalan bersih dan melaporkan secara jujur **0 PASS, 0 FAIL, 29 BLOCKED, 6 NOT TESTED** (Backend API) serta **0 PASS, 0 FAIL, 13 BLOCKED** (Direct RLS) karena keempat token environment belum diset di shell.
- **Status:** Harness & laporan Batch 1.3c selesai; eksekusi live lintas-akun berstatus **BLOCKED** menunggu suplai 4 token akun uji dan data pasangan uji di environment non-produksi.
- **Langkah berikutnya:** suplai keempat variabel environment token pada terminal non-produksi dan jalankan ulang `npm run verify:ownership` saat server lokal (`npm run start`) aktif.



## 2026-10-30: Tahap 1, Stage 1.4a, Complete Frontend-Backend Integration Audit

- **Tujuan:** melakukan audit read-only menyeluruh terhadap integrasi frontend-backend pada seluruh role (`Public`, `Auth`, `Client`, `Counselor`, `Admin`, `Head LMI`), menghitung ulang metrik integrasi aktual dari source code, mengidentifikasi ketidaksesuaian kontrak UI vs API, menginventarisasi data mock/store/storage yang tersisa, dan menyusun roadmap eksekusi **Batch 1.4b s/d Batch 1.4f** sebelum pengujian live 4 akun dimulai.
- **Perubahan (Dokumentasi Saja — 0 Perubahan Kode Aplikasi):**
  - Membuat [`audits/STAGE_1_4A_FRONTEND_BACKEND_INTEGRATION_AUDIT.md`](audits/STAGE_1_4A_FRONTEND_BACKEND_INTEGRATION_AUDIT.md) yang mencakup 14 bagian lengkap:
    1. Executive summary & temuan utama.
    2. Status repositori & hasil validasi aktual.
    3. Inventaris 58 handler `/api/v1/*` (+ 1 handler root `GET /`) yang diklasifikasikan ke Kategori A–H.
    4. Inventaris seluruh 57 fungsi wrapper/pemanggil API frontend beserta rantai pemanggilan lengkap (`Page -> Component/Hook -> Wrapper -> apiRequest -> Backend Endpoint`).
    5. Matriks integrasi fitur per role (`PUB-*`, `AUTH-*`, `SHARED-*`, `CLI-*`, `CNS-*`, `ADM-*`, `LMI-*`) dan matriks cakupan 58 endpoint backend.
    6. 11 ketidaksesuaian kontrak UI vs Backend (`CM-01` s/d `CM-11`), termasuk ketiadaan `session_format` & `reason` pada modal keputusan konselor, format waktu slot jadwal konselor, pembatasan kolom `PATCH /api/v1/profile`, kebutuhan password & pemetaan `app_role`/`member_category` pada `AdminAkunPage`, pemisahan ID periode `localStorage` vs UUID PostgreSQL, dan bug tombol CTA `KepalaLMIBerandaPage` yang mengarah ke `/admin/laporan`.
    7. Audit end-to-end 8 alur kerja bisnis utama.
    8. Inventaris 24 file di `fe/src/data/mock/*`, 3 store Zustand (`bookingStore`, `feedbackStore`, `notificationStore`), dan `localStorage`/`sessionStorage` yang diklasifikasikan ke Kategori A–E.
    9. Audit state UI per halaman (loading, empty, error, validation, unauthorized, anti-double-submit, post-mutation refresh).
    10. Analisis konektivitas deployment (`VITE_API_BASE_URL`, masalah loopback `127.0.0.1:3000` dari Vercel HTTPS, dan `FRONTEND_ORIGINS` CORS).
    11. Lima metrik kelengkapan integrasi dengan pembilang dan penyebut eksplisit:
        - **Endpoint Backend (`/api/v1/*`):** `23/58` (**39,66%**) dipanggil UI (`18` Terintegrasi Penuh [**31,03%**], `5` Terintegrasi Sebagian [**8,62%**], `34` Hanya Wrapper Tanpa UI [**58,62%**], `1` Operasional/Health [**1,72%**]).
        - **Halaman Route (`33` total, `30` berbasis API):** `10/30` (**33,33%**) halaman berbasis API telah terhubung ke backend (`6` penuh, `4` sebagian, `20` masih mock/`localStorage`/stub, ditambah `3` halaman publik statis/widget).
        - **Kesiapan per Role (Halaman Berbasis API):** Public & Auth **100%** (`5/5`), Client **66,67%** (`4/6`), Counselor **0,00%** (`0/7`), Admin **12,50%** (`1/8`), Head LMI **0,00%** (`0/4`).
    12. Daftar temuan kritis/prioritas tinggi (`P0-01` s/d `P0-04`, `P1-01` s/d `P1-06`, `P2-01`).
    13. Rencana implementasi terperinci untuk **Batch 1.4b (Client)**, **Batch 1.4c (Counselor)**, **Batch 1.4d (Admin)**, **Batch 1.4e (Head LMI)**, dan **Batch 1.4f (E2E Verification & Mock Cleanup)**.
    14. Daftar blocker & dependensi (SOP klinis intake/catatan sesi, konektivitas HTTPS backend untuk Vercel, periode akademik aktif di database).
  - Memperbarui [`PROJECT_STATUS.md`](PROJECT_STATUS.md) dan [`integration/API_ENDPOINT_MATRIX.md`](integration/API_ENDPOINT_MATRIX.md).
- **Validasi:**
  - `be: npm run check`: **PASS** (21 file JS).
  - `be: npm test`: **61/61 PASS** (dengan izin loopback untuk `health.test.js`; `ownershipGuards.test.js` **20/20 PASS** di dalam sandbox).
  - `fe: npm run build`: **PASS** (`tsc -b && vite build` selesai dalam `9,25s`, peringatan ukuran bundle non-blocking `1.302,15 kB`).
  - `fe: npm run lint`: **PASS** (`0` error, `0` warning).
  - `git diff --check`: **PASS**.
  - Tidak ada perubahan pada `fe/`, `be/`, atau `supabase/`, dan tidak ada operasi `git add`, `git commit`, `git push`, atau `git merge`.
- **Status:** Stage 1.4a selesai.
- **Langkah berikutnya:** mulai **Batch 1.4b (Client Remaining Integrations)** untuk menuntaskan integrasi `KlienKonselorPage`, `KlienAktivitasPage`, `KlienRiwayatPage`, dan `KlienPengaturanPage`.


## 2026-10-30 - Batch 1.4b: Client Remaining Integrations

- **Tujuan:** menyelesaikan integrasi frontend-backend pada seluruh enam halaman Client (`KlienKonselorPage`, `KlienAktivitasPage`, `KlienRiwayatPage`, `KlienPengaturanPage`, `KlienBerandaPage`, `KlienPesananPage`) agar 100% menggunakan data aktual dari backend.
- **Perubahan utama:**
  1. `fe/src/pages/client/KlienKonselorPage.tsx` & `fe/src/components/client/counselors/CounselorCard.tsx`: mengganti `CLIENT_DIRECTORY_COUNSELORS` dengan `getPublicCounselors()` dan `getPublicAvailability()`, memetakan `PublicCounselorDto` + `PublicAvailabilitySlotDto` ke `ClientDirectoryCounselor`, menambahkan state loading/error/retry/empty, dan meneruskan `state={{ counselorProfileId: counselor.entityId }}` ke `/klien/pesanan`.
  2. `fe/src/pages/client/KlienPesananPage.tsx`, `fe/src/features/booking/utils/clientBookingCalendar.ts`, & `fe/src/data/mock/clientCounselors.ts`: memperbaiki `slotsForCounselor(counselor, iso)` agar membaca `counselor.availabilityByDate?.[iso]` dari slot backend (sebelumnya hanya membaca `counselor.schedule` yang kosong saat dimuat dari API), serta mendukung praseleksi konselor dari `location.state.counselorProfileId`.
  3. `fe/src/pages/client/KlienAktivitasPage.tsx`: menambahkan resolusi nama konselor via `getPublicCounselors()`, menampilkan kelima status booking (`waiting_confirmation`, `confirmed`, `reschedule_requested`, `rejected`, `cancelled`) lengkap dengan filter status dan `cancellation_reason`/`reschedule_reason`, serta memvalidasi alasan pembatalan (`3–1000` karakter) dan menangani kode HTTP `401/403/404/409`.
  4. `fe/src/pages/client/KlienRiwayatPage.tsx`: menambahkan resolusi nama konselor via `getPublicCounselors()`, menampilkan label `moderation_status` yang jelas (`pending`, `shown`, `disabled`), memvalidasi rating (`1–5`) dan komentar (`<= 5000` karakter), serta menangani konflik `409` pada duplikasi feedback.
  5. `fe/src/pages/client/KlienPengaturanPage.tsx` & `fe/src/features/client/profile/profileValidation.ts`: menghapus hardcoded `ACCOUNT` (`Yusli Ngongano`) dan `INITIAL` (`081298765432`), serta menghubungkan halaman ke `sicareApi.getProfile()`, `sicareApi.updateProfile({ full_name, phone_e164 })`, dan `sicareApi.setWhatsAppConsent({ opted_in })` (beserta normalisasi nomor telepon ke E.164 dan `useAuth().refreshProfile()`).
  6. `fe/src/pages/client/KlienBerandaPage.tsx`: diaudit dan dikonfirmasi telah terintegrasi penuh dengan `sicareApi.bookings(100)`, `sicareApi.sessions(100)`, `sicareApi.myFeedback()`, dan `getPublicCounselors()`.
- **Bukti verifikasi:**
  - `cd fe && npm run build`: **PASS** (`tsc -b && vite build`, 2482 modul ditransformasi).
  - `cd fe && npm run lint`: **PASS** (0 error, 0 warning).
  - `cd be && npm run check`: **PASS**.
  - `cd be && npm test`: **61/61 PASS** (0 gagal, 0 skipped).
- **Langkah berikutnya:** lanjutkan ke **Batch 1.4c (Counselor Integrations)**.


## 2026-10-30 — Tahap 1, Batch 1.4c: Counselor Integrations (7/7 Halaman Counselor Terhubung)

### Scope & Tujuan
Menyelesaikan integrasi penuh Frontend-Backend untuk seluruh **7 halaman Counselor** (`fe/src/pages/counselor/*.tsx`) agar menggunakan data dan mutasi aktual dari `/api/v1/*` tanpa ketergantungan runtime pada mock data atau Zustand store lokal untuk fitur yang sudah didukung backend, sambil mempertahankan desain visual, warna (`#064E3B`), navigasi, dan responsivitas halaman.

### File yang Dibuat / Diubah
1. **`fe/src/features/counselor/shared/presentation.ts`** (Diperbarui):
   - Menambahkan helper `formatBookingClientTitle`, `formatBookingRepresentative`, `formatIsoDateId`, `formatIsoShortDateId`, `formatIsoTimeRangeWita`, `toLocalDateKey`, `getMinutesFromIso`, `formatSessionFormatLabel`, dan `formatAcademicPeriodLabel`.
2. **`fe/src/components/counselor/BookingDecisionModal.tsx`** (Baru):
   - Komponen modal keputusan booking konselor yang dapat digunakan ulang oleh `KonselorPermintaanPage` dan `KonselorBerandaPage`.
   - Mendukung ketiga transisi konselor pada `sicareApi.transitionBooking(booking.id, payload)`:
     - **Terima (`confirmed`):** wajib memilih `session_format: "offline" | "online"` dan opsional `room: string | null` (maks 240 karakter; tanpa mengirim `meeting_url`).
     - **Tolak (`rejected`):** wajib mengisi `reason: string` (3–1000 karakter).
     - **Minta Jadwal Ulang (`reschedule_requested`):** wajib mengisi `reason: string` (3–1000 karakter).
3. **`fe/src/pages/counselor/KonselorPermintaanPage.tsx`** (Diperbarui):
   - Menghapus `useBookingStore`, `decideCounselorRequest`, `useNotificationStore`, dan fixture `intakes` (`counselorRequests.ts`).
   - Menghubungkan daftar dan detail permintaan ke `sicareApi.bookings(100)` dan `BookingDecisionModal` (`sicareApi.transitionBooking`), dengan filter tab status (`waiting_confirmation`, `reschedule_requested`, `confirmed`, `closed`, `all`), filter jenis layanan (`Individu`/`Kelompok`), urutan `terlama`/`terbaru`, dan pencarian.
4. **`fe/src/pages/counselor/KonselorBerandaPage.tsx`** (Diperbarui):
   - Menghapus `"Giovanna"`, `RATINGS`, `SESSIONS_THIS_WEEK`, dan `useCounselorDashboard`.
   - Menghubungkan halaman ke `sicareApi.getProfile()`, `counselorApi.getProfile()`, `sicareApi.bookings(100)`, `sicareApi.sessions(100)`, dan `counselorApi.getFeedback({ limit: 100 })` untuk menampilkan sapaan nama konselor asli, statistik aktual, banner sesi `ongoing`, antrean permintaan `waiting_confirmation` terlama dengan aksi keputusan langsung, jadwal sesi hari ini, dan distribusi bintang ulasan.
5. **`fe/src/pages/counselor/KonselorAktivitasPage.tsx`** (Diperbarui):
   - Menghapus `buildDummySessions` dan `getCounselorActivityIntake`.
   - Menghubungkan halaman ke `sicareApi.sessions(100)`, `sicareApi.session(id)`, `sicareApi.transitionSession(id, { status })`, dan `sicareApi.bookings(100)` untuk transisi `scheduled -> ongoing` (**Mulai Sesi**), `ongoing -> completed` (**Selesaikan Sesi**), dan `scheduled|ongoing -> cancelled` (**Batalkan Sesi**).
6. **`fe/src/pages/counselor/KonselorPengaturanPage.tsx`** (Diperbarui):
   - Menghapus `INITIAL_COUNSELOR_PROFILE`.
   - Menghubungkan halaman ke `sicareApi.getProfile()`, `sicareApi.updateProfile({ full_name, phone_e164 })`, `counselorApi.getProfile()`, `counselorApi.updateProfile({ public_name, headline, bio, specialties, years_experience })`, dan `useAuth().refreshProfile()`, termasuk penanganan `404 COUNSELOR_PROFILE_NOT_FOUND` dan rekonsiliasi jika salah satu request PATCH gagal.
7. **`fe/src/pages/counselor/KonselorJadwalPage.tsx`** (Diperbarui):
   - Menghapus `createCounselorScheduleSeed`.
   - Menghubungkan kalender mingguan (termasuk drag-and-drop slot `available`) dan kalender bulanan ke `counselorApi.getAvailability()`, `counselorApi.createAvailability()`, `counselorApi.updateAvailability()`, `counselorApi.cancelAvailability()`, `getPublicAcademicPeriods()`, `sicareApi.bookings(100)`, dan `sicareApi.sessions(100)`.
8. **`fe/src/pages/counselor/KonselorRiwayatPage.tsx`** (Diperbarui):
   - Menghapus `clients` (`counselorHistory.ts`), `loadPeriods()` (`localStorage`), catatan klinis palsu, klaim Informed Consent PDF, dan pengunci PIN sisi browser (`useCounselorHistoryAccess`).
   - Menampilkan riwayat sesi `completed` dan `cancelled` dari `sicareApi.sessions(100)` dan `sicareApi.bookings(100)` beserta filter periode akademik dari `getPublicAcademicPeriods()`.
9. **`fe/src/pages/counselor/KonselorFeedbackPage.tsx`** (Diperbarui):
   - Menghapus `feedbackData`, `COUNSELOR`, `useFeedbackStore`, dan `LEGACY_UI_SEMESTERS`.
   - Menghubungkan halaman ke `counselorApi.getFeedback({ limit: 100 })`, `getPublicAcademicPeriods()`, dan `counselorApi.getProfile()` dengan filter periode, filter bintang (1–5), pencarian komentar, dan pengurutan (`new`, `high`, `low`).
10. **Dokumentasi:** `docs/PROJECT_STATUS.md`, `docs/WORK_LOG.md`, `docs/integration/API_ENDPOINT_MATRIX.md`, dan `docs/integration/API_CONTRACT_AUDIT.md`.

### Bukti Pengujian
- `cd fe && npm run build`: **PASS** (`✓ 2465 modules transformed`, `✓ built in 5.03s`, PWA generated).
- `cd fe && npm run lint`: **PASS** (0 errors, 0 warnings).
- `cd be && npm run check`: **PASS**.
- `cd be && npm test`: **61/61 PASS** (`0 fail`, `0 skipped`).

### Langkah Berikutnya
- Lanjut ke **Batch 1.4d (Admin Integrations)** untuk mengintegrasikan seluruh halaman Admin (`AdminPeriodePage`, `AdminAkunPage`, `AdminFeedbackPage`, `AdminKonselingPage`, `AdminBerandaPage`, `AdminLaporanPage`, `AdminAktivitasPage`, dan profil di `AdminPengaturanPage`).


## 2026-10-30 — Tahap 1, Batch 1.4d: Admin Integrations (8/8 Halaman Admin Terhubung)

### Scope & Tujuan
Menyelesaikan integrasi penuh Frontend-Backend untuk seluruh **8 halaman Admin** (`fe/src/pages/admin/*.tsx`) beserta komponen dan helper pendukung (`fe/src/components/admin/dashboard/DashboardSections.tsx` dan `fe/src/lib/academicPeriods.ts`) agar menggunakan data dan mutasi aktual dari `/api/v1/*` tanpa ketergantungan runtime pada mock data, Zustand store lokal, atau `localStorage`, sambil mempertahankan desain visual, warna (`#064E3B`), navigasi, dan responsivitas halaman.

### File yang Dibuat / Diubah
1. **`fe/src/lib/academicPeriods.ts`** (Diperbarui):
   - Menambahkan helper `mapAcademicPeriodDto(dto)` untuk memetakan `AcademicPeriodRecordDto` (`id`, `academic_year`, `semester`, `starts_on`, `ends_on`, `is_published`) ke struktur `AcademicPeriod & { isPublished: boolean }` sambil mempertahankan ekspor fungsi yang masih dipakai halaman Kepala LMI hingga Batch 1.4e.
2. **`fe/src/pages/admin/AdminPeriodePage.tsx`** (Diperbarui):
   - Menghapus `DEFAULT_ACADEMIC_PERIODS`, `loadPeriods`, `savePeriods` (`localStorage` `sicare.periods`), dan tombol reset sampel demo.
   - Menghubungkan daftar dan CRUD periode akademik ke `adminApi.listAcademicPeriods()`, `adminApi.createAcademicPeriod()`, `adminApi.updateAcademicPeriod()`, dan `adminApi.deleteAcademicPeriod()`, lengkap dengan toggle publikasi (`is_published`) dan penanganan error `409 PERIOD_HAS_SLOTS` saat periode masih direferensikan slot jadwal konselor.
3. **`fe/src/pages/admin/AdminAkunPage.tsx`** (Diperbarui):
   - Menghapus `INITIAL_ACCOUNTS` dan pembuatan ID sekuensial numerik.
   - Menghubungkan pengelolaan akun ke `adminApi.listAccounts({ limit: 100 })`, `adminApi.getAccount(id)`, `adminApi.createAccount()`, `adminApi.updateAccount()`, `adminApi.deactivateAccount()`, `adminApi.setCounselorPublication()`, dan `getPublicCounselors()`.
   - Memetakan kategori UI (`Konselor`, `Mahasiswa`, `Dosen`, `Staff`, `Kepala LMI`, `Admin`) ke `app_role` dan `member_category`, menambahkan filter status (`all` | `active` | `pending` | `disabled`), kontrol publikasi direktori konselor (`Publik` / `Privat`), dan proteksi agar Admin tidak menonaktifkan akunnya sendiri.
4. **`fe/src/pages/admin/AdminFeedbackPage.tsx`** (Diperbarui):
   - Menghapus `useFeedbackStore`, `useNotificationStore`, `PSIKOLOG`, dan `loadPeriods` (`localStorage`).
   - Menghubungkan daftar, detail, statistik, dan moderasi feedback ke `adminApi.listFeedback({ limit: 100 })`, `adminApi.getFeedback(id)`, `adminApi.getFeedbackStatistics()`, `adminApi.moderateFeedback(id, input)`, `adminApi.listAcademicPeriods()`, `adminApi.listAccounts({ role: "counselor", limit: 100 })`, dan `getPublicCounselors()`.
   - Mewajibkan `disabled_reason` saat mengubah `moderation_status` menjadi `"disabled"`, tidak mengirim `disabled_reason` saat `"shown"` atau `"pending"`, serta menampilkan `review_status` sebagai badge read-only karena `PATCH /admin/feedback/:id/review` dibatasi untuk role `head_lmi`.
5. **`fe/src/pages/admin/AdminKonselingPage.tsx`** (Diperbarui):
   - Menghapus `COUNSELORS`, `RATING`, `SESI`, `NOW` dari `fe/src/data/mock/adminCounseling.ts` dan `loadPeriods` (`localStorage`).
   - Menghubungkan halaman monitoring konseling (read-only) ke `adminApi.listCounseling(100)`, `adminApi.listAcademicPeriods()`, `adminApi.listAccounts({ role: "counselor", limit: 100 })`, `getPublicCounselors()`, dan `adminApi.listFeedback({ limit: 100 })` dengan identitas klien teranonimkan (`Klien Anonim #XXXX`).
6. **`fe/src/pages/admin/AdminAktivitasPage.tsx`** (Diperbarui):
   - Menggantikan placeholder 4 baris dengan halaman Log Aktivitas Sistem yang terhubung ke `adminApi.listActivity(100)` lengkap dengan kartu ringkasan KPI, filter `entity_type` (`booking` | `session` | `feedback`), filter status, filter rentang waktu (`today`, `7d`, `30d`, `all`), dan pencarian UUID/status.
7. **`fe/src/pages/admin/AdminBerandaPage.tsx` & `fe/src/components/admin/dashboard/DashboardSections.tsx`** (Diperbarui):
   - Menghapus `useBookingStore`, `COUNSELOR_WORKLOAD`, `DASHBOARD_COUNTS`, dan `WEEKLY_SESSIONS`.
   - Menghubungkan beranda Admin ke `reportingApi.getAdminDashboard()`, `reportingApi.getAdminReport()`, `adminApi.listCounseling(100)`, `adminApi.listAcademicPeriods()`, `adminApi.listAccounts({ role: "counselor", limit: 100 })`, dan `getPublicCounselors()`.
8. **`fe/src/pages/admin/AdminLaporanPage.tsx`** (Diperbarui):
   - Menghapus `SESSIONS`, `TOPICS`, `REASONS` dari `fe/src/data/mock/adminReports.ts`, `REPORT_COUNSELORS` dari `fe/src/data/mock/reportCommon.ts`, dan `DEFAULT_PERIODS`.
   - Menghubungkan halaman laporan operasional ke `reportingApi.getAdminReport()`, `adminApi.listCounseling(100)`, `adminApi.listAcademicPeriods()`, `adminApi.listAccounts({ role: "counselor", limit: 100 })`, `getPublicCounselors()`, dan `adminApi.listFeedback({ limit: 100 })` lengkap dengan banner `report.truncated`, peringatan sesi lintas periode, cetak PDF (`window.print()`), dan ekspor CSV (`handleExportCsv`).
9. **`fe/src/pages/admin/AdminPengaturanPage.tsx`** (Diperbarui):
   - Mempertahankan CRUD Hero Motivation (`adminApi.listHeroMotivations()`, `createHeroMotivation()`, `updateHeroMotivation()`, `deleteHeroMotivation()`) dan menghubungkan bagian Profil Akun Admin ke `sicareApi.getProfile()`, `sicareApi.updateProfile({ full_name, phone_e164 })`, dan `useAuth().refreshProfile()`, serta menghapus `ADMIN_PROFILE_KEY` (`localStorage`).
10. **Dokumentasi:** `docs/PROJECT_STATUS.md`, `docs/WORK_LOG.md`, `docs/integration/API_ENDPOINT_MATRIX.md`, dan `docs/integration/API_CONTRACT_AUDIT.md`.

### Bukti Pengujian
- `cd fe && npm run build`: **PASS** (`✓ 2457 modules transformed`, `✓ built in 7.06s`, PWA generated).
- `cd fe && npm run lint`: **PASS** (0 errors, 0 warnings).
- `cd be && npm run check`: **PASS** (seluruh file JS backend lulus pemeriksaan sintaks).
- `cd be && npm test`: **61/61 PASS** (`0 fail`, `0 skipped`).
- `git diff --check`: **PASS**.

### Langkah Berikutnya
- Lanjut ke **Batch 1.4e (Kepala LMI Integrations)** untuk mengintegrasikan seluruh halaman Kepala LMI (`KepalaLMIBerandaPage`, `KepalaLMILaporanPage`, `KepalaLMIFeedbackPage`, `KepalaLMIPengaturanPage`).


## 2026-10-31 — Tahap 1, Batch 1.4e: Kepala LMI Integrations (4/4 Halaman Kepala LMI Terhubung)

### Scope & Tujuan
Menyelesaikan integrasi penuh Frontend-Backend untuk seluruh **4 halaman Kepala LMI** (`KepalaLMIBerandaPage`, `KepalaLMIFeedbackPage`, `KepalaLMILaporanPage`, `KepalaLMIPengaturanPage`) beserta komponen dan helper pendukung (`fe/src/components/headlmi/dashboard/DashboardSections.tsx`, `fe/src/features/headlmi/shared/presentation.ts`, dan `fe/src/features/headlmi/feedback/selectors.ts`) agar menggunakan data dan mutasi aktual dari `/api/v1/*` tanpa ketergantungan runtime pada mock data atau `localStorage`, sambil mempertahankan otorisasi ketat role `head_lmi`, desain visual, warna (`#064E3B`), navigasi, dan perlindungan privasi mahasiswa.

### File yang Dibuat / Diubah
1. **`fe/src/features/headlmi/shared/presentation.ts`** (Baru):
   - Modul helper presentasi pimpinan terpusat: `MONTH_SHORT_ID`, `formatMonthKey`, `formatIsoDate`, `formatIsoDateTime`, `buildMonthKeys`, `fillMonthlyRange` (mengisi kontigu bulan agar bulan tanpa record tetap tampak dengan nilai 0), `shortRef`, `buildCounselorNameMap`, `counselorLabel`, `describeApiError`, `formatRating`, `percent`, `normalizePhoneToE164`, dan `validatePhoneInput`.
2. **`fe/src/components/headlmi/dashboard/DashboardSections.tsx`** (Diperbarui):
   - Menghapus ketergantungan runtime pada `DASHBOARD_COUNTS`, `WEEKLY_SESSIONS`, `COUNSELOR_WORKLOAD`, dan `dashboardOverview.ts`.
   - Mengubah komponen menjadi props-driven menerima `AdminDashboardDto` dan `AdminReportDto` aktual dengan state loading (`SectionState`), error, retry, dan empty state ramah pengguna.
   - Mengganti status availability mock ("Tersedia"/"Jadwal penuh") dengan metrik nyata (`completed_sessions`, `bookings`, `feedback_count`, `average_rating`).
3. **`fe/src/pages/headlmi/KepalaLMIBerandaPage.tsx`** (Diperbarui):
   - Menghubungkan halaman beranda pimpinan ke `reportingApi.getHeadLmiDashboard()` dan `reportingApi.getHeadLmiReport()`.
   - Memperbaiki rute navigasi tombol CTA "Lihat laporan lengkap" dari rute salah `/admin/laporan` menjadi rute benar `/kepala-lmi/laporan`.
   - Menambahkan banner peringatan `report.truncated` jika query mencapai batas 1.000 record serta tombol segarkan manual.
4. **`fe/src/features/headlmi/feedback/selectors.ts`** (Diperbarui):
   - Menghapus ketergantungan pada mock `Feedback` dan `headlmiFeedback.ts`.
   - Menyesuaikan selector (`selectHeadLmiFeedback`, `summarizeHeadLmiFeedback`, `groupHeadLmiFeedbackByMonth`, `summarizeFeedbackByCounselor`) untuk memproses `AdminFeedbackDto` kanonis dan pemetaan nama konselor backend.
5. **`fe/src/pages/headlmi/KepalaLMIFeedbackPage.tsx`** (Diperbarui):
   - Menghapus `FEEDBACKS`, `headlmiFeedback.ts`, `REPORT_COUNSELORS`, `loadPeriods()`, dan `localStorage`.
   - Menghubungkan daftar feedback ke `adminApi.listFeedback({ limit: 100 })`, statistik ke `adminApi.getFeedbackStatistics()`, nama konselor ke `getPublicCounselors()`, serta peninjauan ke `adminApi.reviewFeedback(feedbackId, { review_status })` (`new` | `reviewed` | `resolved`).
   - Menerapkan batas kewenangan ketat: Kepala LMI hanya mengubah `review_status`, tidak memanggil moderasi publik (`moderation_status`) yang menjadi kewenangan Admin.
   - Melindungi privasi klien: tidak menampilkan nama, email, atau NIM mahasiswa (hanya ref ID `#XXXX` / UUID).
   - Menghapus filter kategori layanan sintetis (`Individu`/`Kelompok`) yang tidak tersedia di `AdminFeedbackDto`, menambahkan filter review status dan rating, serta ekspor CSV dengan catatan batas data termuat.
6. **`fe/src/pages/headlmi/KepalaLMILaporanPage.tsx`** (Diperbarui):
   - Menghapus `SESSIONS`, `CANCELLATION_REASONS`, `headlmiReports.ts`, `REPORT_COUNSELORS`, `REPORT_MONTHS`, `loadPeriods()`, dan `localStorage`.
   - Menghubungkan laporan eksekutif ke `reportingApi.getHeadLmiReport()`.
   - Menampilkan rentang tanggal laporan aktual (`period.from` – `period.to`) dan metrik riil dari `AdminReportDto` (`totals`, `monthly`, `counselors`).
   - Menampilkan banner peringatan saat `report.truncated === true`.
   - Mengganti perbandingan semester dan breakdown pembatalan sintetis dengan visualisasi efektivitas penyelesaian sesi dan informasi kerahasiaan mahasiswa.
   - Mempertahankan cetak PDF (`window.print()`) dan menambahkan ekspor CSV.
7. **`fe/src/pages/headlmi/KepalaLMIPengaturanPage.tsx`** (Diperbarui):
   - Menghubungkan profil pimpinan ke `sicareApi.getProfile()`, `sicareApi.updateProfile({ full_name, phone_e164 })`, dan `useAuth().refreshProfile()`.
   - Menampilkan email sebagai read-only sesuai akun autentikasi.
   - Menandai fitur yang belum didukung backend (unggah foto dan ubah kata sandi) sebagai disabled secara jujur tanpa simulasi lokal atau penyimpanan `localStorage`.
   - Mempertahankan `SignOutPanel` dan mekanisme logout.
8. **Dokumentasi:** `docs/PROJECT_STATUS.md`, `docs/WORK_LOG.md`, `docs/integration/API_ENDPOINT_MATRIX.md`, dan `docs/integration/API_CONTRACT_AUDIT.md`.

### Bukti Pengujian
- `cd fe && npm run build`: **PASS** (`✓ 2453 modules transformed`, `✓ built in 3.97s`, PWA generated).
- `cd fe && npm run lint`: **PASS** (0 errors, 0 warnings).
- `cd be && npm run check`: **PASS** (seluruh file backend lulus pemeriksaan sintaks).
- `cd be && npm test`: **61/61 PASS** (`0 fail`, `0 skipped`).
- `git diff --check`: **PASS**.

### Langkah Berikutnya
- Lanjut ke **Batch 1.5a (WhatsApp Fonnte Integration)** (Batch 1.4f ditangguhkan sesuai arahan prioritas).


## 2026-10-31 — Tahap 1, Batch 1.5a: WhatsApp Fonnte Integration (Infrastruktur Notifikasi WhatsApp Lengkap)

### Scope & Tujuan
Mengimplementasikan infrastruktur notifikasi WhatsApp tingkat produksi menggunakan Fonnte API yang terintegrasi dengan backend Express, PostgreSQL/Supabase, alur booking, profil pengguna, dan arsitektur notifikasi SiCARE. Sistem mencakup pengiriman pesan, transactional outbox queue, worker background mandiri dengan klaim atomik (`FOR UPDATE SKIP LOCKED`), retry dengan exponential backoff dan jitter, pencegahan duplikasi berbasis kunci idempotensi deterministik, scheduler pengingat sesi (H-1 dan Hari H), webhook pelacakan status pengiriman, penegakan persetujuan pengguna (*opt-in* live), serta pemantauan kesehatan provider tanpa kebocoran rahasia.

### File yang Dibuat / Diubah
1. **`supabase/migrations/20261031120000_sicare_whatsapp_outbox_fonnte.sql`** (Baru):
   - Memperluas constraint `message_type` untuk 8 jenis notifikasi: `booking_requested`, `booking_received`, `booking_accepted`, `booking_rejected`, `reschedule_requested`, `booking_cancelled`, `reminder_h1`, `reminder_day_of`.
   - Memperluas constraint status state machine: `pending`, `processing`, `accepted`, `delivered`, `retry_wait`, `failed`, `cancelled`, `unknown`, `queued`, `sending`, `sent` (default: `'pending'`).
   - Menambahkan kolom sewa worker dan pelacakan: `next_attempt_at`, `max_attempts`, `locked_at`, `locked_by`, `lease_expires_at`, `last_attempt_at`, `phone_e164`, `payload jsonb`, `provider_request_id`, `provider_state_id`, `provider_status`, `provider_state`, `provider_response`, `last_error_message`, `error_category`, `delivered_at`.
   - Menambahkan indeks: `whatsapp_outbox_eligible_claim_idx`, `whatsapp_outbox_provider_msg_idx`, `whatsapp_outbox_recipient_idx`.
   - Menambahkan fungsi RPC PostgreSQL: `sicare_claim_whatsapp_jobs` (atomic claim dengan `FOR UPDATE SKIP LOCKED` dan perpanjangan sewa) serta `sicare_get_whatsapp_stats` (agregasi metrik outbox).
2. **`be/src/config/env.js` & `be/.env.example`** (Diperbarui):
   - Menambahkan variabel konfigurasi: `FONNTE_TOKEN`, `FONNTE_API_URL`, `FONNTE_ENABLED`, `FONNTE_WEBHOOK_SECRET`, `FONNTE_TIMEOUT_MS`, `WHATSAPP_SEND_ENABLED`, `WHATSAPP_MAX_ATTEMPTS`, `WHATSAPP_WORKER_CONCURRENCY`, `WHATSAPP_POLL_INTERVAL_MS`, `WHATSAPP_TEST_MODE`, `WHATSAPP_TEST_RECIPIENTS`.
   - Mengatur default aman: `WHATSAPP_SEND_ENABLED=false` (mode simulasi aktif sampai diaktifkan eksplisit), `WHATSAPP_TEST_MODE=true` (hanya mengirim ke whitelist penerima uji).
3. **`be/src/services/fonnte.service.js`** (Baru):
   - Modul service resmi Fonnte: `normalizePhoneNumber` (konversi format Indonesia 08/8/+62 ke 628), `isTestRecipientAllowed`, `validateResponse`, `normalizeProviderError` (pemetaan kategori error `temporary`, `permanent`, `unknown`), serta class `FonnteService` dengan metode `checkConfiguration` dan `sendMessage`.
   - Menggunakan header wajib Fonnte: `Authorization: TOKEN` (tanpa kata kunci `Bearer`).
   - Menangani timeout via `AbortSignal.timeout(FONNTE_TIMEOUT_MS)` dengan kategori error `unknown` untuk mencegah spam pengiriman ulang.
4. **`be/src/templates/whatsapp/index.js`** (Baru):
   - Registri 8 template pesan WhatsApp bahasa Indonesia (`id-ID`) dengan format tanggal dan jendela waktu WIB (`Asia/Jakarta`).
   - Format referensi booking seragam: `#SC-XXXXXX`.
   - Penegakan privasi ketat: hanya memuat informasi operasional (nama pihak, tanggal, jam, format online/offline, ruangan/tautan, alasan operasional); tidak ada data asesmen psikologis, formulir intake, atau catatan klinis.
5. **`be/src/services/whatsappOutbox.service.js`** (Baru):
   - Generator kunci idempotensi deterministik: `booking:{booking_id}:{message_type}:{recipient_user_id}`.
   - Perhitungan delay retry exponential backoff dengan ±15% random jitter (`calculateRetryDelayMs`).
   - Helper `enqueueOutboxMessage` dengan penanganan silent skip duplikat (`23505`).
   - Dispatcher event booking `enqueueBookingNotifications` untuk pembuatan, konfirmasi, penolakan, reschedule, dan pembatalan booking.
   - Penjadwalan pengingat sesi `enqueueSessionReminders` (H-1 dan Hari H) untuk Klien dan Konselor.
   - Pembersih pengingat usang `cancelObsoleteReminders` saat booking/sesi dibatalkan atau di-reschedule.
6. **`be/src/workers/whatsapp.worker.js`** (Baru):
   - Worker background mandiri dengan mode CLI satu putaran (`--once`) dan daemon loop (`WHATSAPP_POLL_INTERVAL_MS`).
   - Klaim job atomik via RPC `sicare_claim_whatsapp_jobs` dengan fallback query cerdas.
   - Penegakan izin WhatsApp *live*: memeriksa `profiles.whatsapp_opt_in === true` dan validitas nomor telepon E.164 tepat sebelum pengiriman. Jika pengguna opt-out, pesan langsung ditandai `failed` dengan kategori `opt_out`.
   - Pembaruan status outbox: `accepted`, `retry_wait` (dengan `next_attempt_at`), `failed`, atau `unknown`.
7. **`be/src/workers/whatsapp.scheduler.js`** (Baru):
   - Scheduler pengingat sesi mandiri (`--once` atau loop berkala).
   - Memindai sesi konseling berstatus `scheduled` dengan booking `confirmed` dalam horizon 7 hari ke depan.
   - Menjadwalkan pengingat H-1 (24 jam sebelum sesi) dan Hari H (1 jam sebelum sesi) secara idempoten.
   - Membatalkan pengingat untuk booking yang statusnya bukan `confirmed`.
8. **`be/src/routes/webhook.routes.js`** (Baru):
   - Rute `POST /api/v1/webhooks/fonnte/message-status` untuk menerima callback Fonnte.
   - Verifikasi secret webhook menggunakan perbandingan waktu konstan (`timingSafeEqualString`).
   - Pencocokan record berdasarkan `provider_message_id`. Pembaruan status menjadi `delivered` (`delivered_at = now()`) atau `failed` (`PROVIDER_DELIVERY_FAILED`).
   - Menghasilkan respons HTTP 200 `ignored` untuk ID yang tidak tercatat guna menghindari spam retry provider.
9. **`be/src/routes/admin.routes.js`** (Diperbarui):
   - Menambahkan endpoint observabilitas internal `GET /api/v1/admin/whatsapp/health` khusus role `admin` (status outbox, metrik status, sampel isu terbaru, tanpa membocorkan token).
10. **`be/src/routes/booking.routes.js`** (Diperbarui):
    - Mengintegrasikan pemanggilan `enqueueBookingNotifications` pada alur pembuatan booking baru (`POST /bookings`), pengajuan reschedule (`PATCH /bookings/:id/reschedule`), dan transisi status (`PATCH /bookings/:id/status`) tanpa memblokir transaksi booking jika terjadi error non-kritis.
11. **`be/app.js` & `be/package.json`** (Diperbarui):
    - Memasang rute webhook di `/api/v1/webhooks`.
    - Menambahkan npm script `"whatsapp:worker"` dan `"whatsapp:scheduler"`, serta memperbarui skrip sintaks `"check"`.
12. **Dokumentasi & Automated Tests:**
    - `docs/integration/FONNTE_WHATSAPP_INTEGRATION.md` (Panduan teknis dan operasional lengkap).
    - `docs/PROJECT_STATUS.md` & `docs/integration/API_ENDPOINT_MATRIX.md`.
    - 6 file test baru: `whatsappMigration.test.js`, `fonnteService.test.js`, `whatsappTemplates.test.js`, `whatsappOutbox.test.js`, `whatsappWorker.test.js`, `whatsappScheduler.test.js`, `whatsappWebhook.test.js`, `whatsappHealth.test.js`.

### Bukti Pengujian
- `cd be && npm run check`: **PASS** (seluruh 26 file backend, routes, services, templates, workers, dan test harness lulus pengecekan sintaks).
- `cd be && npm test`: **93/93 PASS** (0 fail, 0 skipped, durasi ~820ms; 32 pengujian baru untuk Fonnte, outbox, worker, scheduler, templates, webhook, health, dan migrasi).
- `git diff --check`: **PASS**.

### Langkah Berikutnya
- Melanjutkan ke **Batch 1.5a.1: Fonnte Finalization & Reliability Audit** untuk mengaudit keandalan outbox transaksional, konkurensi worker, dan hardening webhook.

## 2026-10-31: Batch 1.5a.1, Fonnte Finalization & Reliability Audit

### Ringkasan Pekerjaan
Melakukan audit keandalan menyeluruh, hardening, dan verifikasi terhadap integrasi WhatsApp Fonnte yang dibangun pada Batch 1.5a, dengan fokus utama memastikan konsistensi transaksional outbox dan keamanan status lifecycle:

1. **Critical Audit A: Transactional Outbox (Atomisitas Transaksi Booking):**
   - Mengatasi potensi inkonsistensi di mana transaksi booking di database berhasil tetapi outbox event gagal/hilang akibat kegagalan jaringan atau crash Node.js antara eksekusi RPC dan panggilan outbox sekunder.
   - Mengintegrasikan penyisipan event WhatsApp outbox langsung ke dalam fungsi transaksi ACID PostgreSQL di `supabase/migrations/20261031120000_sicare_whatsapp_outbox_fonnte.sql`:
     - `sicare_create_booking`: menyisipkan notifikasi konselor (`booking_requested`) dan klien (`booking_received`) secara atomik.
     - `sicare_reschedule_booking`: membatalkan pengingat jadwal lama dan menyisipkan event `reschedule_requested` ke konselor secara atomik.
     - `sicare_transition_booking`: menyisipkan notifikasi atomik untuk `booking_accepted` (+ pengingat H-1 dan Hari H), `booking_rejected`, `reschedule_requested` (konselor), dan `booking_cancelled` (klien), serta membatalkan pengingat saat sesi dibatalkan/di-reschedule.
   - Menghapus pemanggilan sekunder `enqueueBookingNotifications` dari `be/src/routes/booking.routes.js`, menetapkan database RPC sebagai batas transaksi tunggal yang otoritatif dan mengeliminasi risiko duplikasi event.

2. **Critical Audit B: Database Migration Hardening:**
   - Memperbarui `supabase/migrations/20261031120000_sicare_whatsapp_outbox_fonnte.sql` dengan klausa `ON CONFLICT (idempotency_key) DO NOTHING` pada seluruh operasi penyisipan outbox untuk menjamin deduplikasi absolut.
   - Menambahkan mekanisme *reaper* otomatis pada RPC `sicare_claim_whatsapp_jobs` untuk menandai pekerjaan kadaluarsa yang telah melampaui `max_attempts` sebagai `failed` (`LEASE_EXPIRED_MAX_ATTEMPTS`).
   - Menegakkan hak akses database: `REVOKE ALL ... FROM public, anon, authenticated; GRANT EXECUTE ... TO service_role;` untuk seluruh fungsi baru.

3. **Critical Audit C: Worker Concurrency & Lease Safety:**
   - Memverifikasi implementasi `FOR UPDATE SKIP LOCKED` pada klaim job, mencegah *race condition* dan pengklaiman ganda antar worker paralel.
   - Memperbarui penanganan fallback kueri di `be/src/workers/whatsapp.worker.js` untuk membersihkan sewa kadaluarsa yang telah melampaui batas percobaan maksimum.

4. **Critical Audit D: Provider Timeout & Unknown State:**
   - Memvalidasi perlakuan kegagalan ambigu (`FONNTE_TIMEOUT` atau `errorCategory === 'unknown'`) di `be/src/workers/whatsapp.worker.js`. Status pekerjaan dialihkan ke `unknown` dan tidak langsung dicoba ulang secara buta, melindungi penerima dari pesan duplikat. Status dapat direkonsiliasi melalui callback webhook atau endpoint kesehatan admin.

5. **Critical Audit E: Webhook Delivery Status Hardening:**
   - Memperketat mesin status webhook pada `be/src/routes/webhook.routes.js`: menjamin sifat monotonik dan ireversibel untuk status terminal.
   - Status `delivered` dan `cancelled` tidak dapat diturunkan kembali (*downgrade*) oleh callback pengiriman yang datang terlambat (*out-of-order*) seperti `accepted`, `queued`, `sent`, atau `failed`.

6. **Critical Audit F: Reminder Scheduler Idempotency & Rescheduling:**
   - Menambahkan parameter *qualifier* berbasis timestamp slot (`starts_at`) pada generator kunci idempotensi di `be/src/services/whatsappOutbox.service.js` (`booking:{id}:{type}:{recipient}:{starts_at}`).
   - Memastikan bahwa ketika sebuah booking di-reschedule ke waktu baru, pengingat baru dapat dijadwalkan tanpa berbenturan dengan kunci idempotensi pengingat lama yang telah dibatalkan.

### File yang Berubah
- `supabase/migrations/20261031120000_sicare_whatsapp_outbox_fonnte.sql` (Penambahan transactional RPCs `sicare_create_booking`, `sicare_reschedule_booking`, `sicare_transition_booking`, dan lease reaper).
- `be/src/routes/booking.routes.js` (Pembersihan pemanggilan sekunder outbox; transaksi kini ditangani 100% atomik di level RPC).
- `be/src/routes/webhook.routes.js` (Hardening proteksi status terminal terhadap callback out-of-order).
- `be/src/services/whatsappOutbox.service.js` (Dukungan *qualifier* pada `generateIdempotencyKey` dan penyisipan pengingat).
- `be/src/workers/whatsapp.worker.js` (Penambahan pembersihan sewa kadaluarsa untuk percobaan yang telah habis).
- `be/test/ownershipGuards.test.js` (Pembaruan filename RPC terbaru ke migrasi 1.5a.1).
- `be/test/whatsappMigration.test.js` (Pengujian statis untuk keberadaan outbox atomik pada RPC).
- `be/test/whatsappWebhook.test.js` (Pengujian regresi status terminal terhadap callback out-of-order).
- `be/test/whatsappWorker.test.js` (Pengujian pembersihan sewa kadaluarsa dan penanganan timeout ambigu).
- `be/test/whatsappOutbox.test.js` (Pengujian kunci idempotensi dengan qualifier).
- `docs/PROJECT_STATUS.md` & `docs/WORK_LOG.md`.

### Bukti Pengujian
- `cd be && npm run check`: **PASS** (seluruh 26 file backend lulus verifikasi sintaks).
- `cd be && npm test`: **96/96 PASS** (0 fail, 0 skipped, durasi ~800ms; 3 pengujian keandalan baru lulus).
- CLI Worker test: `node src/workers/whatsapp.worker.js --once`: **PASS** (exit code 0).
- CLI Scheduler test: `node src/workers/whatsapp.scheduler.js --once`: **PASS** (exit code 0).
- `cd fe && npm run lint`: **PASS** (0 error, 0 warning).
- `cd fe && npm run build`: **PASS** (build sukses dalam 3.32s).
- `git diff --check`: **PASS**.

### Langkah Berikutnya
- Melanjutkan ke **Batch 1.5b: Informed Consent Database Foundation** untuk merancang skema database, tabel form consent, audit consent, dan endpoint persiapan tanda tangan digital.

## 2026-10-31: Batch 1.5b, Informed Consent Database Foundation

### Ringkasan Pekerjaan
Merancang dan mengimplementasikan fondasi basis data dan backend service untuk Digital Informed Consent SiCARE sesuai dokumen resmi Lembaga Misi & Identitas (LMI) Unika De La Salle Manado (`docs/reference/infromed-consent/informed-consent.pdf`):

1. **Inspeksi Dokumen Resmi Informed Consent:**
   - Membaca dan menganalisis berkas PDF resmi (`docs/reference/infromed-consent/informed-consent.pdf`).
   - Judul resmi: `INFORMED CONSENT (Surat Pernyataan Kesediaan)` dengan label `CONFIDENTIAL`.
   - Mengidentifikasi 6 bidang identitas peserta: Nama (`full_name`), Fakultas/Prodi (`faculty`, `study_program`), NIM (`nim`), Tempat dan tanggal lahir (`birthplace`, `date_of_birth`), Jenis kelamin (`gender`), Telepon (`phone_e164`).
   - Tiga klausul persetujuan kanonis: kesukarelaan konseling dengan psikolog, tanggung jawab kelangsungan sesi & jaminan kerahasiaan, serta pengecualian kerahasiaan untuk rencana keselamatan jiwa.
   - Menghitung integritas SHA-256 berkas master: `59012141d8a54336928a4c076d9d0ad7276bbbc36064c37d9654cc031f14cd8f` (ukuran: 113.549 bytes).

2. **Perancangan & Migrasi Database (`supabase/migrations/20261031150000_sicare_informed_consent_foundation.sql`):**
   - **`public.consent_templates`:** tabel versi templat master (`template_code`, `version`, `title`, `storage_bucket`, `storage_path`, `file_sha256`, `file_size_bytes`, `is_active`, `effective_at`). Diisi benih data awal untuk versi `v1.0` yang cocok dengan dokumen fisik resmi.
   - **`public.booking_participants` (Ekstensi):** menambahkan kolom identitas klinis (`user_id`, `participant_type`, `full_name`, `faculty`, `study_program`, `nim`, `birthplace`, `date_of_birth`, `gender`, `phone_e164`, `is_primary`, `participant_status`). Mendukung peserta pemilik akun (`user_id` terhubung ke `profiles.id`) maupun peserta tamu tanpa akun (`user_id = NULL`) tanpa membuat akun dummy.
   - **`public.informed_consents`:** tabel dokumen persetujuan per-peserta (`booking_id`, `session_id`, `booking_participant_id`, `consent_template_id`, `status`, `signer_user_id`, `signer_name_snapshot`, `identity_snapshot jsonb`, `consent_statement_version`, `signed_at`, `signature_method`, `signature_storage_path`, `signed_document_storage_path`, `signed_document_sha256`). Mencegah re-consent duplikat melalui unique index pada `(booking_participant_id, consent_template_id)` untuk status pending/signed.
   - **`public.consent_invitations`:** tabel token undangan kriptografis berentropi tinggi (32-byte / 64 hex char). Hanya menyimpan nilai hash SHA-256 (`token_hash`), masa kedaluwarsa (`expires_at`), dan status sekali pakai (`pending`, `sent`, `claimed`, `completed`, `expired`, `revoked`).
   - **`public.consent_audit_logs`:** jejak audit hukum persetujuan append-only. Dilengkapi fungsi dan trigger `prohibit_consent_audit_mutation()` yang menolak mutasi `UPDATE` dan `DELETE` dengan kode error `42501`.
   - **Storage Buckets Privat:** mendaftarkan bucket privat `informed-consent-templates`, `informed-consent-signed`, dan `informed-consent-signatures` dengan batas ukuran dan tipe MIME ketat, tanpa akses publik.
   - **Row Level Security (RLS) & Grants:** mengaktifkan RLS pada seluruh tabel baru dengan kebijakan akses berbasis peran dan hak kepemilikan booking/peserta. Akses publik/anonim dicabut total.
   - **RPC `public.sicare_check_booking_consent_readiness`:** fungsi evaluasi kesiapan consent atomik untuk memeriksa apakah seluruh peserta aktif (individu maupun kelompok) telah menandatangani consent sebelum sesi dimulai.

3. **Backend Service (`be/src/services/consent.service.js`):**
   - Fungsi `hashInvitationToken` (SHA-256) dan `generateInvitationToken` (kriptografi aman).
   - Fungsi `getActiveConsentTemplate` untuk mengambil metadata templat aktif.
   - Fungsi `ensureBookingParticipants` untuk inisialisasi peserta pada booking individu dan kelompok secara idempoten.
   - Fungsi `initializeConsentForParticipant` untuk membuat record consent pending beserta snapshot data identitas.
   - Fungsi `createConsentInvitation` dan `verifyInvitationToken` untuk pembuatan dan validasi undangan tanpa menyimpan token mentah.
   - Fungsi `recordConsentAuditLog` untuk pencatatan log audit.
   - Fungsi `getBookingConsentStatus` untuk pengecekan kesiapan consent booking.

4. **Automated Testing & Dokumentasi:**
   - Membuat `be/test/consentMigration.test.js` (pengujian statis skema, constraints, dan RPC).
   - Membuat `be/test/consentFoundation.test.js` (pengujian unit lengkap untuk token, inisialisasi peserta, snapshot identitas, audit log, dan kesiapan consent).
   - Membuat arsitektur lengkap di `docs/INFORMED_CONSENT_ARCHITECTURE.md`.

### File yang Berubah
- `supabase/migrations/20261031150000_sicare_informed_consent_foundation.sql` (Baru: migrasi fondasi informed consent).
- `be/src/services/consent.service.js` (Baru: modul backend service fondasi consent).
- `be/package.json` (Diperbarui: penambahan `consent.service.js` pada skrip sintaks check).
- `be/test/consentMigration.test.js` (Baru: tes verifikasi migrasi consent).
- `be/test/consentFoundation.test.js` (Baru: tes unit backend service consent).
- `docs/INFORMED_CONSENT_ARCHITECTURE.md` (Baru: dokumentasi arsitektur informed consent).
- `docs/PROJECT_STATUS.md`, `docs/ROADMAP.md`, `docs/WORK_LOG.md`.

### Bukti Pengujian
- `cd be && npm run check`: **PASS** (seluruh 27 file backend lulus pengecekan sintaks Node.js).
- `cd be && npm test`: **105/105 PASS** (0 fail, 0 skipped, durasi ~770ms; 9 pengujian baru untuk fondasi informed consent dan migrasi).
- `cd fe && npm run lint`: **PASS** (0 error, 0 warning).
- `cd fe && npm run build`: **PASS** (build sukses dalam 3.32s).
- `git diff --check`: **PASS**.

### Langkah Berikutnya
- Melanjutkan ke **Batch 1.5b.1: Consent Security & Data Integrity Hardening** untuk mengaudit kelemahan privasi, mencegah kebocoran data anggota kelompok ke Klien Utama, mengamankan storage dan token undangan, serta menegakkan imutabilitas dokumen bertandatangan.

## 2026-10-31: Batch 1.5b.1, Consent Security & Data Integrity Hardening

### Ringkasan Pekerjaan
Melakukan audit keamanan mendalam, remediasi kerentanan privasi, dan pengerasan integritas data (*hardening*) terhadap arsitektur Digital Informed Consent SiCARE yang dibangun pada Batch 1.5b:

1. **Audit Keamanan A & B: Privasi Dokumen Consent & Identitas Peserta:**
   - Menghapus kerentanan kebocoran data di mana policy `informed_consents_select_parties` sebelumnya mengizinkan Klien Utama membaca seluruh `identity_snapshot`, path tanda tangan, dan berkas PDF bertandatangan milik peserta kelompok lainnya.
   - Mengganti policy direct `SELECT` pada `public.informed_consents` menjadi `informed_consents_select_strict`: hanya penandatangan langsung (`signer_user_id = auth.uid()`), peserta terkait (`booking_participants.user_id = auth.uid()`), atau peran pengawasan institusi (`admin`, `head_lmi`) yang dapat membaca baris consent.
   - Mengganti policy direct `SELECT` pada `public.booking_participants` menjadi `booking_participants_select_strict`: peserta hanya dapat melihat data klinis lengkap miliknya sendiri, dan Klien Utama hanya dapat melihat baris perwakilannya sendiri.
   - Menyediakan fungsi aman SECURITY DEFINER `public.sicare_get_booking_consent_summaries(p_booking_id)` untuk Klien Utama dan Konselor: hanya mengembalikan metadata status operasional (`participant_id`, `display_name`, `is_primary`, `participant_status`, `consent_status`, `signed_at`) tanpa mengekspos NIM, tempat/tanggal lahir, jenis kelamin, nomor telepon, citra tanda tangan, atau berkas PDF.

2. **Audit Keamanan C & D: Integritas Snapshot Identitas & Imutabilitas Bukti Hukum:**
   - Menstandarkan siklus hidup identitas: identitas peserta berstatus draft/editable sebelum penandatanganan dan dibekukan permanen ke dalam `identity_snapshot` saat status beralih ke `signed`.
   - Mengimplementasikan fungsi trigger PostgreSQL `public.prohibit_signed_consent_tampering()` pada `public.informed_consents`:
     - Menolak keras operasi `DELETE` terhadap consent berstatus `signed` atau `revoked` (`SIGNED_CONSENT_CANNOT_BE_DELETED`).
     - Mengunci seluruh kolom bukti hukum (`identity_snapshot`, `signer_user_id`, `signer_name_snapshot`, `consent_template_id`, `consent_statement_version`, `signed_at`, `signature_storage_path`, `signed_document_storage_path`, `signed_document_sha256`, `signature_method`) dari perubahan apa pun (`SIGNED_CONSENT_EVIDENCE_IMMUTABLE`).
     - Mencegah regresi status dari `signed` kembali ke `pending` atau `viewed` (`SIGNED_CONSENT_INVALID_STATUS_TRANSITION`).
     - Status `signed` hanya dapat beralih ke `revoked` (dengan mengisi `revoked_at`), di mana seluruh bukti hukum bertandatangan masa lalu tetap dipertahankan utuh dan tidak boleh dimanipulasi atau ditimpa. Record `revoked` dinyatakan final (`REVOKED_CONSENT_IS_FINAL`).

3. **Audit Keamanan E: Pengerasan Supabase Storage:**
   - Membatasi `allowed_mime_types` pada bucket privat `informed-consent-signatures` menjadi **hanya `image/png` dan `image/jpeg`**; menghapus dukungan `image/svg+xml` untuk mengeliminasi risiko Stored XSS dan serangan injeksi XML pada dokumen/browser.
   - Menambahkan policy RLS pada `storage.objects`: Klien Utama dilarang mengunduh berkas PDF bertandatangan milik peserta lain; penandatangan dan konselor penanggung jawab hanya dapat mengakses berkas yang bersangkutan; pembaruan langsung berkas bertandatangan ditolak.

4. **Audit Keamanan F: Siklus Hidup Token Undangan & Klaim Atomik:**
   - Mencegah kondisi balapan (*race condition*) klaim ganda concurrent melalui fungsi database atomik `public.sicare_claim_consent_invitation(p_token_hash, p_claimer_user_id)`.
   - Menegakkan pencocokan identitas akun: jika `invitation_type = 'authenticated_participant'`, pengklaim harus terotentikasi dan akun pengguna harus cocok dengan `booking_participants.user_id` (`INVITATION_ACCOUNT_MISMATCH`).
   - Mengisolasi peserta tamu: token capability satu kali pakai hanya memberikan hak akses untuk pengisian identitas dan penandatanganan consent miliknya sendiri.

5. **Audit Keamanan G: Verifikasi Audit Log Append-Only:**
   - Memvalidasi ketahanan fungsi trigger `prohibit_consent_audit_mutation()` terhadap mutasi `UPDATE` dan `DELETE` dengan 2 unit test eksplisit.

6. **Audit Keamanan H: Pengerasan RPC Kesiapan Consent (`sicare_check_booking_consent_readiness`):**
   - Menambahkan validasi otorisasi pemanggil: hanya Klien pembuat pesanan, Konselor terkait, Admin, atau Kepala LMI yang dapat memeriksa status kesiapan booking.
   - Mengecualikan peserta yang telah berstatus dihapus (`participant_status = 'removed'`).
   - Menambahkan verifikasi kepatuhan versi templat aktif: consent yang ditandatangani menggunakan versi templat lama yang sudah tidak aktif ditandai `template_compliant = false` dan memblokir kesiapan sesi (`is_fully_consented = false`).

### File yang Berubah
- `supabase/migrations/20261031160000_sicare_consent_security_hardening.sql` (Baru: migrasi hardening RLS, fungsi summary operasional, trigger imutabilitas bukti bertandatangan, RPC klaim atomik token, dan hardening readiness RPC).
- `be/src/services/consent.service.js` (Diperbarui: penambahan `claimConsentInvitation`, helper otorisasi `assertConsentAccess`, dan pembaruan `getBookingConsentStatus` untuk kepatuhan templat).
- `be/test/consentMigration.test.js` (Diperbarui: penambahan pengujian statis komprehensif untuk migrasi hardening).
- `be/test/consentSecurity.test.js` (Baru: 18 skenario uji keamanan lengkap sesuai panduan audit A–H).
- `docs/INFORMED_CONSENT_SECURITY_AUDIT.md` (Baru: laporan resmi audit keamanan dan hardening integritas data).
- `docs/INFORMED_CONSENT_ARCHITECTURE.md` (Diperbarui: referensi migrasi hardening dan dokumen audit keamanan).
- `docs/PROJECT_STATUS.md`, `docs/ROADMAP.md`, `docs/WORK_LOG.md`.

### Bukti Pengujian
- `cd be && npm run check`: **PASS** (seluruh 27 berkas backend lulus pemeriksaan kompilasi syntax Node.js tanpa error).
- `cd be && npm test`: **124/124 PASS** (0 fail, 0 skipped, durasi ~840ms; 19 tes baru untuk verifikasi keamanan privasi, klaim token atomik, imutabilitas berkas legal, storage security, dan audit append-only).
- `cd fe && npm run lint`: **PASS** (0 error, 0 warning).
- `cd fe && npm run build`: **PASS** (`✓ built in 3.34s`, PWA generated).
- `git diff --check`: **PASS**.

### Langkah Berikutnya
- Melanjutkan ke **Batch 1.5c: Digital Signature & PDF Generation** untuk mengimplementasikan kanvas tanda tangan digital, stempel tanda tangan pada template resmi, dan penyimpanan PDF tertandatangani di bucket privat.

## 2026-10-31: Tahap 1, Batch 1.5c (Digital Signature & PDF Generation)

### Ringkasan Pekerjaan
Mengimplementasikan alur lengkap penandatanganan elektronik mandiri (_electronic signature pad_) dan pembangkitan dokumen PDF resmi Informed Consent SiCARE:

1. **Inspeksi dan Peta Koordinat Templat PDF Kanonis:**
   - Membaca dan memvalidasi berkas templat acuan resmi LMI Unika De La Salle Manado (`docs/reference/infromed-consent/informed-consent.pdf`, SHA-256: `59012141d8a54336928a4c076d9d0ad7276bbbc36064c37d9654cc031f14cd8f`).
   - Format 1 halaman tunggal A4 (595.3 x 841.9 pt) tanpa AcroForm interaktif.
   - Memetakan 9 posisi eksak teks dan citra tanda tangan (`full_name`, `faculty_study_program`, `nim`, `birth_info`, `gender`, `phone_e164`, `signing_date`, `signature_image`, `printed_name`).
2. **Pustaka Manipulasi PDF Server-Side:**
   - Memasang `pdf-lib` pada `be/` untuk overlay teks, penyisipan gambar PNG, dan kompilasi PDF tanpa ketergantungan headless browser / Chromium berat.
3. **Penyusunan Layanan Backend (`consentPdf.service.js` & `consent.service.js`):**
   - Validasi identitas lengkap (`validateConsentIdentity`): memastikan semua 8 atribut wajib terisi dan memformat nomor telepon E.164.
   - Validasi biner tanda tangan PNG (`validateSignaturePng`): memeriksa magic bytes `89 50 4E 47 0D 0A 1A 0A`, menolak tegas berkas non-PNG/SVG/HTML/skrip injeksi, dan membatasi ukuran maksimal 2 MB.
   - Pembangkitan PDF (`generateInformedConsentPdf`): menghasilkan dokumen PDF individual bertandatangan dengan checksum SHA-256.
   - Alur penandatanganan idempoten (`signInformedConsent`): mengunggah PNG ke `informed-consent-signatures`, mengunggah PDF ke `informed-consent-signed`, memutasi status database ke `signed`, dan mencatat log audit append-only (`consent_signed` dan `document_generated`).
   - Pengecekan imutabilitas: draft identitas tidak dapat diubah lagi jika status sudah `signed` (`SIGNED_CONSENT_EVIDENCE_IMMUTABLE`).
   - Pengambilan URL unduh presigned berumur pendek (`getSignedDocumentDownloadUrl`): memeriksa otorisasi pemilik/konselor dan menolak akses Klien Utama terhadap dokumen peserta kelompok lain.
4. **Perutean API (`consent.routes.js`):**
   - Dipasang pada `/api/v1/consents`:
     - `GET /booking/:bookingId/my-consent`
     - `GET /booking/:bookingId/readiness`
     - `GET /:id`
     - `PATCH /:id/identity`
     - `POST /:id/sign`
     - `GET /:id/document`
   - Penyesuaian batas body JSON Express menjadi 5MB di `be/app.js` untuk mengakomodasi payload base64 PNG tanda tangan.
5. **Pengerasan RBAC Storage Supabase:**
   - Migrasi `20261031170000_sicare_consent_signing_and_document_rbac.sql` mengunci akses SELECT pada bucket tanda tangan dan dokumen PDF bertandatangan hanya kepada penandatangan bersangkutan dan konselor yang ditugaskan.
6. **Antarmuka Pengguna Frontend:**
   - Komponen canvas `SignaturePad.tsx`: high-DPI handling, pointer events multi-perangkat (touch, stylus, mouse), latar belakang putih bersih, penolakan kanvas kosong, dan ekspor PNG murni.
   - Komponen `InformedConsentModal.tsx`: modal lengkap dengan data identitas terisi otomatis dari profil, peninjauan klausul resmi LMI, validasi checkbox persetujuan wajib, dialog konfirmasi sebelum tanda tangan, feedback status, dan unduh berkas PDF bertandatangan.
   - Integrasi tombol "Informed Consent" dan badge status pada `KlienAktivitasPage.tsx`.

### File yang Berubah
- `be/package.json` & `be/package-lock.json` (Menambahkan dependensi `pdf-lib`).
- `be/app.js` (Mounting `/api/v1/consents` dan peningkatan batas payload JSON 5MB).
- `be/src/services/consentPdf.service.js` (Baru: validasi PNG, pemetaan koordinat, dan perenderan PDF).
- `be/src/services/consent.service.js` (Diperbarui: penambahan `getConsentById`, `updateDraftConsentIdentity`, `signInformedConsent`, `getSignedDocumentDownloadUrl`).
- `be/src/routes/consent.routes.js` (Baru: rute Express untuk operasi consent).
- `supabase/migrations/20261031170000_sicare_consent_signing_and_document_rbac.sql` (Baru: migrasi storage RBAC).
- `be/test/consentSigning.test.js` (Baru: 12 skenario uji penandatanganan, PDF overlay, validasi PNG, idempotensi, imutabilitas, dan otorisasi unduh).
- `fe/src/types/api.ts` (Penambahan DTO Informed Consent).
- `fe/src/lib/consentApi.ts` (Baru: klien API TypeScript).
- `fe/src/components/consent/SignaturePad.tsx` (Baru: komponen signature pad canvas).
- `fe/src/components/consent/InformedConsentModal.tsx` (Baru: modal alur informed consent).
- `fe/src/pages/client/KlienAktivitasPage.tsx` (Integrasi tombol modal dan badge status).
- `docs/INFORMED_CONSENT_SIGNING.md` (Baru: dokumentasi arsitektur signing dan koordinat PDF).
- `docs/PROJECT_STATUS.md`, `docs/ROADMAP.md`, `docs/WORK_LOG.md`.

### Bukti Pengujian
- `cd be && npm run check`: **PASS** (30 berkas backend sintaks valid).
- `cd be && npm test`: **136/136 PASS** (124 tes lama + 12 tes baru `consentSigning.test.js`, 0 gagal, 0 skipped, durasi ~1,12s).
- `cd fe && npm run lint`: **PASS** (0 errors, 0 warnings).
- `cd fe && npm run build`: **PASS** (2456 modul ditransformasikan, dist PWA selesai dibuat dalam 3.46s).
- `git diff --check`: **PASS**.

### Langkah Berikutnya
- Melanjutkan ke **Batch 1.5d: Group Consent Workflow & WhatsApp Invitations** untuk mengimplementasikan penyebaran token undangan anggota kelompok via WhatsApp Fonnte, portal penandatanganan tamu/anggota kelompok, dan validasi gerbang kesiapan consent sebelum sesi konseling dimulai.


## 2026-10-31: Tahap 1, Batch 1.5d (Group Informed Consent Workflow & WhatsApp Integration)

### Ringkasan Pekerjaan
Mengimplementasikan alur lengkap Informed Consent Konseling Kelompok (Group Informed Consent) dan integrasi undangan WhatsApp melalui infrastruktur Fonnte yang ada:

1. **Skema Database & Pengerasan Transisi SQL:**
   - Menambahkan migrasi `supabase/migrations/20261031180000_sicare_group_consent_workflow.sql`.
   - Mengubah kolom `whatsapp_outbox.recipient_user_id` menjadi `nullable` agar mendukung pengiriman pesan ke peserta tamu tanpa profil akun SiCARE.
   - Menambahkan kolom `whatsapp_outbox.booking_participant_id` dengan referensi FK ke `booking_participants(id)`.
   - Memperluas constraint tipe pesan outbox untuk mencakup `consent_invitation` dan `consent_reminder`.
   - Membuat tabel terproteksi `public.consent_invitation_secrets` untuk menyimpan token terenkripsi AES-256-GCM. Mengaktifkan RLS ketat dengan akses eksklusif `service_role`.
   - Memperbarui RPC `sicare_create_booking` untuk memvalidasi dan menyimpan nama lengkap (`full_name`) serta nomor telepon E.164 (`phone_e164`) ke tabel `booking_participants`.
   - Memperbarui RPC `sicare_transition_booking` untuk secara otomatis mencabut undangan pending (`status = 'revoked'`) dan membatalkan pesan outbox pengingat/undangan yang belum terkirim (`status = 'cancelled'`) ketika booking dibatalkan atau ditolak.
   - Memperbarui RPC `sicare_transition_session` untuk memanggil `sicare_check_booking_consent_readiness(booking_id)` dan memblokir transisi dari `scheduled` ke `ongoing` dengan exception `CONSENT_READINESS_INCOMPLETE` jika masih ada peserta aktif yang belum menandatangani informed consent.
2. **Layanan Enkripsi Token Rahasia (`tokenEncryption.service.js`):**
   - Menggunakan AES-256-GCM dengan autentikasi kriptografis terintegrasi (`encryptInvitationToken`, `decryptInvitationToken`).
   - Kunci enkripsi diambil dari `CONSENT_ENCRYPTION_KEY` atau diturunkan melalui HKDF-SHA256 dari secret backend yang ada.
   - IV unik 12-byte acak per token dan auth tag 16-byte untuk deteksi kerusakan atau manipulasi.
3. **Penyempurnaan Background Worker & Template WhatsApp:**
   - Menambahkan template `consent-invitation` dan `consent-reminder` pada `be/src/templates/whatsapp/index.js` dengan penyusunan pesan yang ramah pengguna dan bebas dari kebocoran data klinis.
   - Memperbarui `be/src/workers/whatsapp.worker.js`: mengambil token terenkripsi dari `consent_invitation_secrets`, mendekripsinya di memori saat pengiriman, menyusun tautan undangan unik `${APP_BASE_URL}/consent/invite?token=...`, menandai undangan sebagai `sent`, dan menghapus rahasia setelah terkirim (`cleared_at = now()`).
   - Menjamin bahwa raw token tidak pernah disimpan di database atau payload outbox JSON.
4. **Layanan Informed Consent Kelompok & Portal Tamu (`consent.service.js` & `consent.routes.js`):**
   - Menambahkan pembuatan dan verifikasi token kapabilitas tamu stateless HMAC-SHA256 (`createGuestCapabilityToken`, `verifyGuestCapabilityToken`) dengan masa berlaku 4 jam.
   - Menambahkan fungsi inisialisasi undangan kelompok (`initializeGroupConsentInvitations`) dan pengiriman ulang undangan (`resendConsentInvitation`) dengan pembatalan otomatis outbox lama.
   - Menambahkan fungsi ringkasan status consent kelompok (`getGroupConsentSummary`): menghitung total, jumlah signed, jumlah pending, dan status kesiapan sesi, serta menyaring secara ketat seluruh field sensitif (NIM, tanggal lahir, tempat lahir, jalur tanda tangan, berkas PDF) untuk mencegah kebocoran antar anggota.
   - Menambahkan alur klaim undangan dan penandatanganan mandiri untuk tamu: `claimGuestInvitation`, `getGuestConsent`, `updateGuestDraftIdentity`, `signGuestInformedConsent`, dan `getGuestSignedDocumentDownloadUrl`.
   - Menambahkan pemetaan domain RPC `CONSENT_READINESS_INCOMPLETE` ke HTTP 409 Conflict pada `be/src/lib/domainRpc.js`.
5. **Antarmuka Pengguna Frontend:**
   - Form pendaftaran peserta kelompok pada `fe/src/pages/client/KlienPesananPage.tsx` kini mengumpulkan dan memvalidasi nama lengkap serta nomor WhatsApp E.164 (`+628...`).
   - Membuat halaman portal tamu mandiri `fe/src/pages/guest/GuestConsentPage.tsx` yang secara instan membersihkan token dari URL browser (`window.history.replaceState`), menampilkan review klausul resmi LMI Unika De La Salle Manado, formulir identitas, canvas penandatanganan elektronik, dan unduh berkas PDF individual.
   - Mendaftarkan route `/consent/invite` pada `fe/src/app/router.tsx`.
   - Membuat modal pemantauan persetujuan kelompok `fe/src/components/consent/GroupConsentModal.tsx` yang terintegrasi pada `fe/src/pages/client/KlienAktivitasPage.tsx` dan `fe/src/pages/counselor/KonselorAktivitasPage.tsx`.
   - Menambahkan penanganan error 409 `CONSENT_READINESS_INCOMPLETE` pada `KonselorAktivitasPage.tsx` saat konselor mencoba memulai sesi kelompok yang belum lengkap persetujuannya.

### File yang Berubah
- `supabase/migrations/20261031180000_sicare_group_consent_workflow.sql` (Baru: migrasi skema outbox nullable, booking_participant_id, consent_invitation_secrets, RPC update).
- `be/src/services/tokenEncryption.service.js` (Baru: layanan enkripsi AES-256-GCM).
- `be/src/templates/whatsapp/index.js` (Diperbarui: penambahan template WhatsApp consent invitation & reminder).
- `be/src/workers/whatsapp.worker.js` (Diperbarui: penanganan dekripsi token in-memory dan dispatch undangan).
- `be/src/services/consent.service.js` (Diperbarui: token kapabilitas tamu stateless, inisialisasi undangan, resend, ringkasan kelompok, alur tamu).
- `be/src/routes/consent.routes.js` (Diperbarui: endpoint ringkasan kelompok, resend, claim undangan, dan endpoint tamu).
- `be/src/routes/booking.routes.js` (Diperbarui: skema peserta dengan full_name & phone_e164, inisialisasi undangan saat konfirmasi booking).
- `be/src/lib/domainRpc.js` (Diperbarui: pemetaan error CONSENT_READINESS_INCOMPLETE ke 409 Conflict).
- `be/test/groupConsent.test.js` (Baru: 11 skenario pengujian komprehensif alur consent kelompok).
- `fe/src/types/api.ts` (Diperbarui: DTO ringkasan kelompok, claim undangan, dan respons tamu).
- `fe/src/lib/consentApi.ts` & `fe/src/lib/api.ts` (Diperbarui: fungsi klien API untuk ringkasan kelompok, resend, dan tamu).
- `fe/src/pages/client/KlienPesananPage.tsx` (Diperbarui: form pendaftaran anggota kelompok dengan nomor WhatsApp).
- `fe/src/pages/guest/GuestConsentPage.tsx` (Baru: halaman portal penandatanganan tamu).
- `fe/src/components/consent/GroupConsentModal.tsx` (Baru: modal pemantauan status persetujuan kelompok).
- `fe/src/app/router.tsx` (Diperbarui: mounting rute `/consent/invite`).
- `fe/src/pages/client/KlienAktivitasPage.tsx` (Diperbarui: integrasi tombol GroupConsentModal).
- `fe/src/pages/counselor/KonselorAktivitasPage.tsx` (Diperbarui: indikator kesiapan consent kelompok dan penanganan error 409).
- `docs/GROUP_CONSENT_WORKFLOW.md` (Baru: dokumentasi lengkap alur informed consent kelompok).
- `docs/PROJECT_STATUS.md`, `docs/ROADMAP.md`, `docs/WORK_LOG.md`.

### Bukti Pengujian
- `node --test be/test/groupConsent.test.js`: **11/11 PASS** (0 gagal, 0 skipped, durasi ~407ms).
- `cd be && npm test`: **147/147 PASS** (136 tes lama + 11 tes baru `groupConsent.test.js`, 0 gagal, 0 skipped, durasi ~1,05s).
- `cd be && npm run check`: **PASS** (31 berkas backend sintaks valid).
- `cd fe && npm run lint`: **PASS** (0 errors, 0 warnings).
- `cd fe && npm run build`: **PASS** (2458 modul ditransformasikan, dist PWA selesai dibuat dalam 3.40s).
- `git diff --check`: **PASS** (tanpa error whitespace atau marker konflik).

### Langkah Berikutnya
- Melanjutkan ke **Batch 1.5d.1: Security & Operational Closure** untuk pengerasan kunci enkripsi, keamanan kapabilitas tamu, penautan akun terotentikasi, scheduler pengingat, dan gerbang eligibilitas akhir worker.

## 2026-10-31: Tahap 1, Batch 1.5d.1 (Security & Operational Closure)

### Ringkasan Pekerjaan
Menuntaskan pengerasan keamanan menyeluruh (*security and operational hardening*) pada arsitektur Informed Consent Kelompok dan WhatsApp Fonnte:

1. **Prioritas A: Kunci Enkripsi Terdedikasi, Fail-Closed, dan Key Ring Rotation (`tokenEncryption.service.js` & `env.js`):**
   - Menghapus fallback implisit ke `SUPABASE_SERVICE_ROLE_KEY` atau `JWT_SECRET`. Kunci enkripsi token undangan diisolasi penuh dari kredensial Supabase/Auth.
   - Mengimplementasikan `parseEncryptionKey`: mewajibkan tepat 32 bytes (64 karakter heksadesimal atau 32 byte mentah).
   - Menegakkan prinsip *fail-closed* di lingkungan produksi (`NODE_ENV === 'production'`): jika `CONSENT_ENCRYPTION_KEY` tidak disetel atau tidak valid, aplikasi Express gagal start (`throw new Error(...)`).
   - Menyediakan kunci deterministik khusus pengujian/pengembangan jika variabel belum disetel di non-produksi.
   - Menambahkan metadata versi kunci (`v1`) pada payload enkripsi dan arsitektur key ring (`getKeyByVersion`, `setEncryptionKeyRingForTests`, `resetEncryptionKeyRing`) untuk mendukung rotasi kunci multi-versi tanpa membatalkan token yang belum didekripsi.
   - Mengimplementasikan `reencryptInvitationToken` yang memvalidasi integritas autentikasi sebelum mengenkripsi ulang dengan kunci target.
   - Menambahkan dokumentasi konfigurasi di `be/.env.example` dan validasi Zod produksi di `be/src/config/env.js`.

2. **Prioritas B: Pengerasan Token Kapabilitas Tamu Stateless & Validasi State Database (`consent.service.js` & `consent.routes.js`):**
   - Menstandarkan klaim token HMAC-SHA256: `sub` (participantId), `consentId`, `participantId`, `bookingId`, `invitationId`, `purpose: 'consent_signing'`, `iss: 'sicare-backend'`, `aud: 'sicare-guest-signer'`, `role: 'guest_participant'`, `iat`, `exp` (4 jam), `jti` (UUID v4 unik).
   - Memperketat verifikasi di `verifyGuestCapabilityToken`: pengecekan klaim penerbit (`iss`), audiens (`aud`), tujuan (`purpose`), waktu kedaluwarsa (`exp`), dan verifikasi signature dengan timing-safe comparison (`crypto.timingSafeEqual`).
   - Mengimplementasikan gerbang validasi state real-time berbasis database (`validateGuestCapabilityState`):
     - Memeriksa undangan: menolak jika undangan telah dicabut (`revoked`) atau kedaluwarsa (`expired`).
     - Memeriksa peserta: menolak jika peserta telah dihapus dari booking (`removed`).
     - Memeriksa booking: menolak jika pemesanan konseling telah dibatalkan (`cancelled`) atau ditolak (`rejected`).
     - Memeriksa consent: menolak mutasi (`identity`, `sign`) jika dokumen telah ditandatangani (`signed`) atau dicabut (`revoked`).
   - Menerapkan middleware pemeriksaan status state database pada setiap request tamu (`/guest/me`, `/guest/me/identity`, `/guest/me/sign`, `/guest/me/document`).
   - Menambahkan header `Referrer-Policy: no-referrer` pada semua respons rute endpoint tamu untuk mencegah kebocoran token via HTTP Referer.
   - Memastikan token kapabilitas tamu di frontend hanya disimpan di memori state komponen React (`GuestConsentPage.tsx`), tanpa persistensi di `localStorage` atau `sessionStorage`.

3. **Prioritas C: Penautan Akun Terotentikasi & Verifikasi Kepemilikan Nomor Telepon (`consent.service.js` & `consent.routes.js`):**
   - Memperbarui endpoint `POST /api/v1/consents/invitations/claim` dengan middleware `optionalAuthenticate`.
   - Mengimplementasikan verifikasi kepemilikan nomor telepon anti-spoofing pada `claimGuestInvitation`:
     - Jika pemanggil merupakan pengguna terotentikasi SiCARE, nomor telepon akun profil (`phone_e164`) dinormalisasi dan dibandingkan secara ketat dengan nomor telepon undangan (`phone_e164`).
     - Jika nomor telepon tidak cocok, request ditolak dengan HTTP 403 `ACCOUNT_PHONE_MISMATCH`, mencegah pengguna terotentikasi mengklaim undangan milik orang lain atau menghubungkan akun yang tidak sah.
     - Jika nomor telepon cocok, sistem secara atomik menautkan `user_id` ke record `booking_participants` dan `informed_consents`, serta mengisi otomatis data identitas terverifikasi (`full_name`, `nim`, `faculty`, `study_program`, `gender`, `birthplace`, `date_of_birth`) ke formulir persetujuan.

4. **Prioritas D: Scheduler Pengingat Persetujuan Otomatis & Gerbang Eligibilitas Akhir Worker (`whatsapp.scheduler.js` & `whatsapp.worker.js`):**
   - Mengimplementasikan `scanPendingConsentsAndEnqueueReminders` di `be/src/workers/whatsapp.scheduler.js`:
     - Memindai undangan berstatus `sent` pada sesi yang terkonfirmasi.
     - Menjadwalkan pengingat bertahap: Interval 1 pada 24 jam setelah undangan dibuat, Interval 2 pada 72 jam setelah undangan dibuat.
     - Maksimum 2 pengingat per undangan (`reminder_count < 2`).
     - Kunci idempotensi deterministik `invitation:${invitation.id}:consent_reminder:interval_${interval}` mencegah duplikasi pengingat dalam interval yang sama.
     - Melewatkan peserta yang telah menandatangani persetujuan (`consent.status === 'signed'`) atau dibatalkan.
   - Menambahkan gerbang eligibilitas akhir (*just-in-time eligibility check*) di `processOutboxJob` pada `be/src/workers/whatsapp.worker.js`:
     - Sesaat sebelum pesan dikirim ke Fonnte, worker memverifikasi status terkini consent dan booking di database.
     - Jika peserta telah menandatangani consent sebelum worker memproses job, job dibatalkan (`status = 'cancelled'`) dengan kode `CONSENT_ALREADY_SIGNED`.
     - Jika booking konseling telah dibatalkan atau ditolak, job dibatalkan (`status = 'cancelled'`) dengan kode `BOOKING_CANCELLED`.
     - Menjamin tidak ada pesan pengingat atau undangan usang yang dikirim ke peserta jika sesi/consent sudah selesai atau dibatalkan di luar jadwal.

5. **Pengujian Menyeluruh Batch 1.5d.1 (`be/test/groupConsentClosure.test.js`):**
   - 19 skenario pengujian unit dan integrasi komprehensif mencakup:
     1. Validasi parsing kunci enkripsi (format heksadesimal 64 karakter & panjang 32 byte).
     2. Penolakan string kunci non-heksadesimal atau panjang tidak tepat.
     3. Mode fail-closed saat production jika kunci hilang.
     4. Roundtrip enkripsi dan dekripsi AES-256-GCM.
     5. Penolakan dekripsi jika ciphertext atau auth tag diubah.
     6. Penolakan dekripsi jika kunci yang digunakan salah.
     7. Dukungan multi-versi kunci dan re-enkripsi token undangan.
     8. Pembangkitan token kapabilitas tamu dengan klaim lengkap standar RFC.
     9. Penolakan token kapabilitas tamu dengan tanda tangan palsu atau diubah.
     10. Penolakan token kapabilitas tamu yang telah kedaluwarsa.
     11. Isolasi hak akses tamu terhadap consent peserta lain.
     12. Penolakan validasi state tamu saat undangan dicabut (`revoked`).
     13. Penolakan validasi state tamu saat booking dibatalkan (`cancelled`).
     14. Penolakan mutasi identitas pada consent yang telah ditandatangani (`signed`).
     15. Penautan akun terotentikasi dan prefill profil terverifikasi jika nomor telepon cocok.
     16. Penolakan penautan akun dengan error `ACCOUNT_PHONE_MISMATCH` jika nomor telepon akun berbeda.
     17. Penjadwalan pengingat persetujuan idempoten (interval 24 jam & 72 jam).
     18. Pengecualian pengingat untuk peserta yang telah menandatangani consent.
     19. Pembatalan pengiriman oleh worker jika consent telah ditandatangani sebelum pesan dikirim.

### File yang Berubah
- `be/src/services/tokenEncryption.service.js` (Kunci terdedikasi 32-byte, fail-closed production, key ring rotation, re-encryption).
- `be/src/config/env.js` (Validasi Zod fail-closed untuk `CONSENT_ENCRYPTION_KEY` di production).
- `be/.env.example` (Dokumentasi konfigurasi `CONSENT_ENCRYPTION_KEY`).
- `be/src/middleware/auth.js` (Penambahan middleware `optionalAuthenticate`).
- `be/src/services/consent.service.js` (Klaim kapabilitas tamu lengkap, verifikasi HMAC timing-safe, `validateGuestCapabilityState`, penautan akun dengan verifikasi telepon `ACCOUNT_PHONE_MISMATCH`).
- `be/src/routes/consent.routes.js` (Integrasi `optionalAuthenticate`, middleware database state validation pada rute tamu, `Referrer-Policy: no-referrer`).
- `be/src/workers/whatsapp.scheduler.js` (Implementasi `scanPendingConsentsAndEnqueueReminders` 24h/72h).
- `be/src/workers/whatsapp.worker.js` (Gerbang eligibilitas akhir worker membatalkan `CONSENT_ALREADY_SIGNED` dan `BOOKING_CANCELLED`).
- `be/test/groupConsentClosure.test.js` (Baru: 19 unit test pengerasan keamanan dan operasional).
- `docs/SECURITY_OPERATIONAL_CLOSURE_1_5D1.md` (Baru: laporan resmi audit dan penyelesaian pengerasan keamanan Batch 1.5d.1).
- `docs/PROJECT_STATUS.md`, `docs/ROADMAP.md`, `docs/WORK_LOG.md`.

### Bukti Pengujian
- `node --test be/test/groupConsentClosure.test.js`: **19/19 PASS** (0 gagal, 0 skipped, durasi ~407ms).
- `node --test be/test/groupConsent.test.js`: **11/11 PASS** (0 gagal, 0 skipped, durasi ~424ms).
- `cd be && npm test`: **166/166 PASS** (147 tes lama + 19 tes baru, 0 gagal, 0 skipped, durasi ~1,15s).
- `cd be && npm run check`: **PASS** (31 berkas backend sintaks valid).
- `cd fe && npm run lint`: **PASS** (0 errors, 0 warnings).
- `cd fe && npm run build`: **PASS** (2458 modul ditransformasikan, dist PWA selesai dibuat dalam 3.46s).
- `git diff --check`: **PASS** (tanpa error whitespace atau marker konflik).

### Langkah Berikutnya
- Melanjutkan ke **Batch 1.5e: Final Integration & System Testing** untuk pengujian integrasi fungsional end-to-end menyeluruh (Client, Counselor, Guest, Worker, Scheduler, Storage).

## 2026-10-31: Tahap 1, Batch 1.5e (Final Integration & Comprehensive System Testing)

### Ringkasan Pekerjaan
Melaksanakan audit integrasi menyeluruh dan pengujian sistem akhir (*final comprehensive system testing*) terhadap seluruh fungsionalitas aplikasi SiCARE secara terintegrasi:

1. **Audit & Pengujian Alur Peran Admin (Admin Workflows):**
   - Menguji alur pembuatan akun Konselor oleh Admin secara utuh: Form Frontend -> API `POST /api/v1/admin/accounts` -> Supabase Auth Admin -> update `profiles` -> inisialisasi `counselor_profiles` (`is_public = false`) -> audit log `admin.account.create`.
   - Menguji ketahanan rollback: jika inisialisasi profil atau `counselor_profiles` gagal, sistem secara otomatis menghapus user Auth Supabase (`auth.admin.deleteUser`) sehingga tidak meninggalkan akun yatim (*orphaned accounts*).
   - Menguji proteksi akun admin: penolakan penurunan role admin sendiri atau penonaktifan akun sendiri (`SELF_ADMIN_CHANGE_BLOCKED` -> HTTP 409), serta proteksi terhadap admin aktif terakhir (`LAST_ADMIN` -> HTTP 409).
   - Validasi periode akademik: menolak rentang tanggal tidak valid di mana `ends_on < starts_on`.

2. **Audit & Pengujian Alur Kepala LMI (Executive Oversight & Document Privacy):**
   - Menguji pemuatan dasbor eksekutif dan laporan agregat 12 bulan (batasan 1.000 baris record per tabel sumber).
   - Menguji peninjauan feedback mahasiswa: Kepala LMI dapat memperbarui `review_status` (`reviewed`, `resolved`), namun dilarang keras mengubah moderasi publik (`moderation_status`).
   - Penegakan privasi dokumen klinis: fungsi `assertConsentAccess` diperketat sehingga pengguna dengan peran `head_lmi` **ditolak dari akses langsung mengunduh atau membaca berkas PDF Informed Consent klinis** (least-privilege clinical compliance). Kepala LMI hanya memantau data operasional/metrik statistik tanpa membuka isi persetujuan individu.

3. **Audit & Pengujian Alur Konselor (Counselor Workflows & Assigned PDF Access):**
   - Menguji keputusan permintaan booking (accept/reject dengan alasan wajib).
   - Penegakan akses dokumen bertandatangan: Konselor yang ditugaskan (`counselor_id === authUser.id`) diizinkan mengunduh dan membaca berkas PDF persetujuan peserta konselingnya, sedangkan konselor yang tidak ditugaskan ditolak keras dengan status HTTP 403 Forbidden.
   - Penegakan blokir transisi sesi di database: RPC `sicare_transition_session` memverifikasi kesiapan consent (`sicare_check_booking_consent_readiness`). Jika ada peserta aktif yang belum menandatangani, transisi ke `ongoing` diblokir dengan exception `CONSENT_READINESS_INCOMPLETE` (HTTP 409).

4. **Audit & Pengujian Alur Klien & Konseling Kelompok (Client & Group Consent):**
   - Menguji skenario kelompok sintetis 4 peserta: Klien Utama (perwakilan), Mahasiswa Pemilik Akun, Tamu A, Tamu B.
   - Memverifikasi pembentukan 4 record peserta dan 4 record consent independen.
   - Menegakkan isolasi data persetujuan kelompok: Klien Utama dilarang melihat snapshot klinis (NIM, tanggal lahir, tempat lahir, nomor telepon) atau mengunduh berkas PDF milik anggota kelompok lain.
   - Memverifikasi imutabilitas bukti hukum: pembaruan data profil klien tidak menimpa bukti `identity_snapshot` yang telah dibekukan saat penandatanganan consent masa lalu.

5. **Audit & Pengujian Tamu Mandiri & Pemulihan Sesi (Guest Session Recovery):**
   - **Skenario A (Page Refresh):** Tamu membuka tautan undangan WhatsApp, token dibersihkan dari URL browser via `window.history.replaceState`. Sesi kapabilitas tamu disimpan di cookie aman `httpOnly` `sameSite: lax`. Saat halaman direfresh, formulir membaca cookie dan mengembalikan data draft identitas tanpa kendala.
   - **Skenario B (Browser Closed & Reopened):** Menambahkan logika pemulihan dokumen pada `claimGuestInvitation`: jika peserta telah menandatangani consent (`consent.status === 'signed'`) dan menutup browser, pembukaan kembali tautan WhatsApp mengembalikan token kapabilitas baca-saja (*read-only*) yang memungkinkan peserta mengunduh berkas PDF resmi miliknya kapan saja. Jika belum bertandatangan, tautan sekali pakai yang berstatus `claimed` dilindungi dari penggunaan ganda, dan Klien Utama dapat menggunakan fitur kirim ulang (*Resend Invitation*).

6. **Audit & Pengujian Notifikasi & WhatsApp Fonnte Pipeline:**
   - Memverifikasi pembuatan notifikasi persistensial dalam situs (*website in-app notifications*) untuk Klien dan Konselor pada setiap event booking, dengan isolasi penerima ketat (`recipient_user_id = auth.uid()`).
   - Memverifikasi transactional outbox WhatsApp, idempotensi kunci deterministik, scheduler pengingat sesi (H-1 & Hari H), scheduler pengingat persetujuan (24h & 72h), gerbang pembatalan akhir worker (`CONSENT_ALREADY_SIGNED` & `BOOKING_CANCELLED`), dan status monotonik webhook penerima callback.

7. **Pengujian Integrasi Komprehensif (`be/test/finalIntegration.test.js`):**
   - Menambahkan 18 skenario pengujian integrasi sistem baru mencakup:
     1. Pembuatan akun konselor oleh admin dengan `counselor_profiles` otomatis dan audit log.
     2. Rollback otomatis akun Auth jika inisialisasi profil konselor gagal.
     3. Proteksi admin dari self-demotion dan self-deactivation.
     4. Penolakan akses unduh PDF klinis terhadap peran Kepala LMI.
     5. Pemberian izin akses PDF kepada konselor yang ditugaskan dan penolakan terhadap konselor lain.
     6. Blokir transisi sesi `scheduled -> ongoing` dengan kode `CONSENT_READINESS_INCOMPLETE` saat peserta pending.
     7. Pembuatan 4 record peserta dan consent terpisah pada konseling kelompok beserta isolasi dokumen.
     8. Alur penandatanganan tamu, verifikasi SHA-256, dan pemulihan sesi tamu (Scenario A & B).
     9. Idempotensi outbox WhatsApp dan pembatalan otomatis oleh worker jika peserta sudah menandatangani.
     10. Notifikasi dalam situs dengan isolasi penerima dan mutasi tanda dibaca terotorisasi.
     11. Pembatalan booking kaskade ke pencabutan undangan dan pembatalan antrean outbox.
     12. Skenario E2E 1: Siklus hidup konseling individu lengkap.
     13. Skenario E2E 2: Konseling kelompok akun terotentikasi dan kesiapan sesi saat seluruhnya bertandatangan.
     14. Skenario E2E 3: Konseling kelompok tamu dengan ringkasan status tanpa kebocoran PII.
     15. Skenario E2E 4: Transisi sesi diblokir saat persetujuan kelompok belum lengkap (3 Signed, 1 Pending).
     16. Skenario E2E 6: Batasan hak akses dokumen riwayat konseling sesuai peran.
     17. Imutabilitas bukti snapshot identitas terhadap pembaruan profil pengguna berjalan.
     18. Validasi rentang tanggal periode akademik admin (`ends_on >= starts_on`).

### File yang Berubah
- `be/src/services/consent.service.js` (Pembaruan `assertConsentAccess` untuk hak unduh konselor bertugas & restriksi Kepala LMI; pembaruan `claimGuestInvitation` untuk pemulihan dokumen tamu saat re-open link WhatsApp).
- `be/test/finalIntegration.test.js` (Baru: 18 unit & integration test untuk seluruh skenario audit sistem terintegrasi).
- `docs/FINAL_INTEGRATION_TEST_REPORT_1_5E.md` (Baru: laporan resmi audit integrasi komprehensif dan pengujian sistem Batch 1.5e).
- `docs/PROJECT_STATUS.md`, `docs/ROADMAP.md`, `docs/WORK_LOG.md`.

### Bukti Pengujian
- `node --test be/test/finalIntegration.test.js`: **18/18 PASS** (0 gagal, 0 skipped, durasi ~428ms).
- `cd be && npm test`: **184/184 PASS** (166 tes lama + 18 tes baru, 0 gagal, 0 skipped, 0 cancelled, 0 todo, durasi ~1,34s).
- `cd be && npm run check`: **PASS** (31 berkas backend sintaks valid tanpa error).
- `cd fe && npm run lint`: **PASS** (0 errors, 0 warnings).
- `cd fe && npm run build`: **PASS** (2458 modul ditransformasikan, dist PWA selesai dibuat dalam 3.93s).
- `git diff --check`: **PASS** (tanpa error whitespace atau marker konflik).

### Langkah Berikutnya
- Melaksanakan sesi pengujian tim (Weekend Team Testing) pada Minggu malam, 1 November 2026 pada lingkungan testing/staging sesuai panduan [`docs/WEEKEND_READINESS_PLAN.md`](WEEKEND_READINESS_PLAN.md).
- Mempersiapkan transisi ke Tahap 2: Data Master dan Jadwal setelah sesi pengujian tim selesai dievaluasi.

## 2026-10-31: Tahap 1, Batch 1.5f (Repository Documentation & AI Context Separation)

### Ringkasan Pekerjaan
Melaksanakan reorganisasi dokumentasi repositori SiCARE untuk menegakkan pemisahan ketat antara dokumentasi resmi sistem (`docs/`) dan memori kerja AI personal (`.ai-context/`):

1. **Konfigurasi Eksklusi Git Lokal:**
   - Menambahkan aturan eksklusi `.ai-context/` ke `.git/info/exclude`.
   - Mempertahankan integritas berkas bersama `.gitignore` tanpa modifikasi apapun.
   - Memvalidasi bahwa `.ai-context/` sepenuhnya terabaikan secara lokal dan tidak ada file di dalamnya yang ter-track di Git (`git check-ignore` dan `git ls-files` terverifikasi).

2. **Pembentukan Struktur Memori Kerja AI Personal (`.ai-context/`):**
   - Membuat `MASTER_CONTEXT.md` (arsitektur full-stack, 4 peran + tamu, alur bisnis, standar keamanan).
   - Membuat `PROJECT_MEMORY.md` (kronologi teknis, riwayat batch 1.1–1.5e, keputusan arsitektur, bug teratasi).
   - Membuat `CURRENT_TASK.md` (status pengerjaan aktif dan kriteria penerimaan).
   - Membuat `NEXT_TASKS.md` (roadmap weekend team testing 1 Nov 2026 dan rencana Tahap 2).
   - Membuat `decisions/TECHNICAL_DECISIONS.md` (pencatatan ADR-001 hingga ADR-008).
   - Menyediakan direktori templat prompt (`prompts/antigravity/`, `prompts/general/`).
   - Menyediakan direktori arsip sesi (`sessions/2026-10/`, `sessions/2026-11/`).

3. **Penyusunan Dokumentasi Resmi Arsitektur Keamanan:**
   - Membuat dokumen resmi `docs/security/security-architecture.md` yang memuat spesifikasi menyeluruh mengenai RBAC server-side, otorisasi stateless token kapabilitas tamu dengan validasi state database, enkripsi AES-256-GCM `CONSENT_ENCRYPTION_KEY` dan key ring versioning, isolasi privasi least-privilege, imutabilitas bukti hukum informed consent di database, penegakan kesiapan sesi konseling di stored procedure `sicare_transition_session`, serta pola transactional outbox WhatsApp Fonnte.

4. **Pembersihan & Penyelarasan Tautan Dokumentasi:**
   - Menyelaraskan referensi pada `docs/README.md`, `docs/PROJECT_STATUS.md`, `docs/INFORMED_CONSENT_ARCHITECTURE.md`, `docs/GROUP_CONSENT_WORKFLOW.md`, dan `docs/integration/FONNTE_WHATSAPP_INTEGRATION.md` untuk merujuk pada dokumentasi resmi arsitektur keamanan.
   - Mengarsipkan laporan sesi kerja historis batch (1.5b.1, 1.5d.1, 1.5e) ke dalam `.ai-context/sessions/2026-10/`.
   - Menghapus laporan batch sementara dari `docs/` (`FINAL_INTEGRATION_TEST_REPORT_1_5E.md`, `SECURITY_OPERATIONAL_CLOSURE_1_5D1.md`, `INFORMED_CONSENT_SECURITY_AUDIT.md`) sehingga direktori `docs/` hanya memuat spesifikasi resmi sistem.

### File yang Berubah
- `.git/info/exclude` (Pembaruan lokal: penambahan eksklusi `.ai-context/`).
- `docs/security/security-architecture.md` (Baru: dokumentasi resmi arsitektur keamanan SiCARE).
- `docs/README.md`, `docs/PROJECT_STATUS.md`, `docs/INFORMED_CONSENT_ARCHITECTURE.md`, `docs/GROUP_CONSENT_WORKFLOW.md`, `docs/integration/FONNTE_WHATSAPP_INTEGRATION.md`, `docs/WORK_LOG.md` (Penyelarasan dokumentasi resmi).
- `.ai-context/` (Baru: direktori lokal memori kerja AI; tidak ter-track di Git).

### Bukti Pengujian
- `git check-ignore -v .ai-context/MASTER_CONTEXT.md`: **PASS** (`.git/info/exclude:9:.ai-context/`).
- `git ls-files .ai-context/`: **PASS** (output kosong, 0 file ter-track).
- `git diff -- .gitignore`: **PASS** (tidak ada perubahan pada .gitignore dari Batch 1.5f).
- `cd be && npm test`: **184/184 PASS** (0 failed, 0 skipped, durasi ~1.3s).
- `cd be && npm run check`: **PASS** (31 berkas backend sintaks valid).
- `cd fe && npm run lint`: **PASS** (0 errors, 0 warnings).
- `cd fe && npm run build`: **PASS** (2458 modul ditransformasikan, dist PWA selesai dibuat).
- `git diff --check`: **PASS** (tanpa error whitespace).

### Langkah Berikutnya
- Melaksanakan sesi pengujian tim (Weekend Team Testing) pada Minggu malam, 1 November 2026 sesuai [`docs/WEEKEND_READINESS_PLAN.md`](WEEKEND_READINESS_PLAN.md).
- Mempersiapkan transisi ke Tahap 2: Data Master dan Jadwal.


## 2026-10-31: Tahap 1, Batch 1.5g (Controlled User Acceptance Testing)

### Ringkasan Pekerjaan
Menyiapkan, mengaudit, dan memfasilitasi instrumen User Acceptance Testing (UAT) terkendali untuk sistem SiCARE secara menyeluruh dari perspektif 6 profil pengguna (Admin, Kepala LMI, Konselor, Klien Utama, Peserta Kelompok Berakun, dan Peserta Tamu Mandiri):

1. **Audit Kesiapan Lingkungan UAT (`docs/uat/UAT_ENVIRONMENT_READINESS.md`):**
   - Mengaudit 10 aspek lingkungan: lokal dev, staging frontend, staging backend, project Supabase staging, akun auth, storage buckets, migrasi database, notifikasi dalam situs, integrasi WhatsApp Fonnte (mock vs live), dan nomor telepon/email uji.
   - Menegakkan kebijakan keselamatan pengujian: penggunaan data sintetis murni, larangan penggunaan identitas/rekam klinis mahasiswa nyata, proteksi rahasia server dari dokumentasi, isolasi basis data dari reset remote, serta pemblokiran mutlak pengiriman WhatsApp langsung ke pihak luar (`WHATSAPP_SEND_ENABLED=false`).
   - Memetakan spesifikasi 7 akun uji sintetis untuk 6 peran pengguna.

2. **Penyusunan Rencana Induk UAT (`docs/uat/UAT_TEST_PLAN.md`):**
   - Merumuskan tujuan utama UAT: verifikasi kegunaan, kebenaran fungsi, otorisasi berbasis peran, konsistensi alur kerja, akurasi data, penegakan kesiapan informed consent, dan penerimaan pengguna.
   - Menetapkan prinsip etika: penegasan bahwa pengujian otomatis bukan pengganti persetujuan manusia; UAT resmi mensyaratkan eksekusi dan persetujuan oleh pengguna manusia nyata.
   - Menetapkan kriteria masuk/keluar, jadwal pengujian (target Minggu 1 November 2026), matriks peran/tanggung jawab, dan triase keparahan cacat P0-P3.

3. **Spesifikasi Kasus Uji Komprehensif (`docs/uat/UAT_TEST_CASES.md`):**
   - Menyusun 45 kasus uji terstandarisasi untuk 10 rangkaian skenario:
     - **Skenario A (Admin):** `UAT-ADM-001` s/d `UAT-ADM-006` (Akun konselor, validasi duplikat email, periode akademik, log aktivitas, profil, proteksi diri dan batasan akses PDF).
     - **Skenario B (Kepala LMI):** `UAT-KLMI-001` s/d `UAT-KLMI-005` (Dasbor eksekutif, laporan agregat, review feedback, profil, larangan moderasi publik & restriksi unduh PDF klinis).
     - **Skenario C (Counselor):** `UAT-KON-001` s/d `UAT-KON-006` (Penerimaan booking format/ruang, penolakan alasan wajib, kalender ketersediaan, penegakan kesiapan sesi, pembatalan kaskade, akses PDF pasien binaan vs penolakan konselor luar).
     - **Skenario D (Client):** `UAT-CLI-001` s/d `UAT-CLI-005` (Booking individu, booking kelompok multi-peserta berstruktur, riwayat & status, tanda tangan mandiri & unduh PDF, isolasi lintas-klien).
     - **Skenario E (Group Participant Berakun):** `UAT-GRP-001` s/d `UAT-GRP-004` (Undangan, penautan akun anti-spoofing via verifikasi telepon, autofill profil terverifikasi, tanda tangan mandiri, unduh PDF pribadi, rekalkulasi kesiapan).
     - **Skenario F (Group Guest Tanpa Akun):** `UAT-GST-001` s/d `UAT-GST-005` (Portal tamu stateless HMAC, pembersihan URL seketika via `replaceState`, validasi 7 field identitas wajib, tanda tangan canvas, pemulihan sesi Scenario A refresh & Scenario B reopen, penolakan token expired/revoked, isolasi antar tamu).
     - **Skenario G (Matriks Persetujuan Kelompok):** `UAT-GCS-001` s/d `UAT-GCS-004` (Kelompok 4 peserta sintetis: 4 Signed -> Ready; 3 Signed 1 Pending -> Blokir sesi HTTP 409 `CONSENT_READINESS_INCOMPLETE`; undangan expired/revoked; imutabilitas snapshot identitas terhadap pembaruan profil berjalan).
     - **Skenario H (Website Notifications):** `UAT-NOT-001` s/d `UAT-NOT-003` (Pembangkitan notifikasi siklus booking, isolasi penerima, lencana counter belum dibaca, navigasi instan).
     - **Skenario I (WhatsApp Fonnte Pipeline):** `UAT-FON-001` & `UAT-FON-002` (Outbox atomik, idempotensi, scheduler reminder sesi, gerbang pengiriman live berstatus BLOCKED).
     - **Skenario J (Privasi & Keamanan Data):** `UAT-SEC-001` s/d `UAT-SEC-005` (Isolasi lintas-klien, isolasi lintas-konselor, pembatasan PDF klinis, perlindungan storage bucket privat, penolakan eskalasi peran).

4. **Penyusunan Lembar Eksekusi & Registri Cacat (`docs/uat/UAT_TEST_EXECUTION_RECORD.md` & `docs/uat/UAT_DEFECT_LOG.md`):**
   - Menyediakan lembar kerja eksekusi untuk penguji manusia dengan memisahkan status otomatis pra-UAT dari kolom observasi manusia yang berstatus `PREPARED`.
   - Menginisialisasi sistem pelacakan cacat P0–P3 dengan mencatat observasi build (chunk size non-blocking) dan kebijakan keselamatan pengiriman WhatsApp langsung.

5. **Kuesioner Umpan Balik & Berita Acara Penerimaan (`docs/uat/UAT_USER_FEEDBACK.md` & `docs/uat/UAT_SIGN_OFF.md`):**
   - Menyiapkan instrumen evaluasi skala Likert 1–5 untuk 10 aspek operasional serta 5 pertanyaan kualitatif terbuka tanpa rekayasa data.
   - Menyiapkan berita acara sign-off untuk 5 pemangku kepentingan (Admin, Kepala LMI, Konselor, Klien, QA Lead) dengan status persetujuan manusia berstatus `PENDING ACTUAL HUMAN EXECUTION`.

6. **Laporan Akhir UAT (`docs/uat/UAT_FINAL_REPORT.md`):**
   - Menyusun laporan komprehensif 23 bagian (Bagian A s/d W) sesuai standar UAT dengan rekomendasi teknis resmi `ACCEPTED FOR STAGING` untuk melanjutkan ke sesi pengujian terkendali bersama pengguna nyata.

### File yang Berubah
- `docs/uat/UAT_ENVIRONMENT_READINESS.md` (Baru: audit kesiapan 10 komponen lingkungan & akun uji sintetis).
- `docs/uat/UAT_TEST_PLAN.md` (Baru: rencana induk pengujian penerimaan pengguna).
- `docs/uat/UAT_TEST_CASES.md` (Baru: spesifikasi 45 kasus uji untuk 10 skenario A–J).
- `docs/uat/UAT_TEST_EXECUTION_RECORD.md` (Baru: lembar kerja eksekusi pengujian pengguna).
- `docs/uat/UAT_DEFECT_LOG.md` (Baru: sistem klasifikasi & registri pelacakan cacat P0–P3).
- `docs/uat/UAT_USER_FEEDBACK.md` (Baru: kuesioner evaluasi kegunaan & kepuasan pengguna).
- `docs/uat/UAT_SIGN_OFF.md` (Baru: berita acara penerimaan pengguna resmi).
- `docs/uat/UAT_FINAL_REPORT.md` (Baru: laporan akhir evaluasi UAT & rekomendasi staging).
- `docs/PROJECT_STATUS.md` (Diperbarui: pencatatan penyelesaian Batch 1.5g dan status kesiapan UAT).
- `docs/ROADMAP.md` (Diperbarui: penambahan milestone Batch 1.5g dan alur weekend testing).
- `docs/WORK_LOG.md` (Diperbarui: entri append-only Batch 1.5g).

### Bukti Pengujian
- `node --check` (31 berkas backend): **PASS** (100% sintaks valid).
- `node --test` (backend suite): **184/184 PASS** (0 failed, 0 skipped, durasi ~1.2s).
- `npm --prefix fe run lint`: **PASS** (0 errors, 0 warnings).
- `npm --prefix fe run build`: **PASS** (2458 modul ditransformasi, dist PWA selesai dibuat dalam 3.48s).
- `git diff --check`: **PASS** (tanpa error whitespace).

### Langkah Berikutnya
- Memfasilitasi pelaksanaan sesi User Acceptance Testing (UAT) bersama penguji manusia nyata pada Minggu malam, 1 November 2026 sesuai dengan [`docs/WEEKEND_READINESS_PLAN.md`](WEEKEND_READINESS_PLAN.md) dan instrumen [`docs/uat/`](uat/).
- Mengumpulkan hasil observasi nyata, mencatat cacat jika ada, melakukan perbaikan terkontrol bila diperlukan, dan menyelesaikan berita acara sign-off.


---

## 2026-11-01 — Batch 1.5g.2: Frontend UAT Polish & Controlled Database Reset Preparation

### Scope dan Tujuan
1. **Frontend Polish (Task A, B, C):**
   - Mengimplementasikan komponen dropdown profil dan logout terpadu (`NavbarProfileDropdown`) untuk 4 peran pengguna (`admin`, `head_lmi`, `counselor`, `client`), terhubung ke arsitektur autentikasi yang ada (`useAuth().signOut()`), menangani keyboard accessibility, escape key, dan click outside.
   - Mengimplementasikan sistem avatar profil yang tegas: Admin SELALU menampilkan logo resmi SiCARE (`/icon-512x512.png`); Non-Admin mengikuti urutan prioritas foto profil -> fallback inisial nama berstandar brand SiCARE `#064E3B` -> penanganan gambar rusak (`onError`).
   - Melakukan standardisasi filter periode akademik di 5 halaman (`AdminFeedbackPage`, `AdminLaporanPage`, `AdminKonselingPage`, `KonselorFeedbackPage`, `KonselorRiwayatPage`) menggunakan komponen bersama `AcademicPeriodFilter` berbasis desain referensi modal 2-kolom `AdminFeedbackPage.tsx`.
2. **Database Reset Preparation (Task D):**
   - Melakukan audit inventarisasi menyeluruh terhadap target database Supabase remote (`tfzgztrvonkqsqmesmjy.supabase.co`).
   - Mengidentifikasi secara presisi akun Admin kanonis yang WAJIB dipertahankan (`markomakalew@gmail.com` / `2c165fc0-3483-4bdf-9dc0-8be6e020c759`).
   - Menyusun urutan pembersihan aman berdasarkan foreign key constraints (*leaf-to-root*), skrip verifikasi dry-run, serta mengonfirmasi bahwa **TIDAK ADA PENGHAPUSAN ATAU MUTASI YANG DIEKSEKUSI PADA BATCH INI** (menunggu persetujuan pengguna).

### Pekerjaan yang Dilakukan
1. **Pembuatan Komponen Bersama:**
   - `fe/src/lib/avatarUtils.ts`: Implementasi fungsi murni `getInitials(name)` dengan dukungan Unicode, nama Indonesia, pemotongan spasi liar, dan penanganan kata tunggal/jamak.
   - `fe/src/components/shared/NavbarProfileDropdown.tsx`: Komponen dropdown navbar profil responsif, aman dari layout shift, ringkasan profil (nama, email, role badge), tautan pengaturan per-role, dan tombol logout interaktif dengan loader.
   - `fe/src/components/shared/AcademicPeriodFilter.tsx`: Komponen modal filter 2-kolom (Tahun Ajaran di kiri, Semester dengan tanggal & badge di kanan, trigger button status Aktif/Mendatang/Selesai).
   - `fe/src/components/shared/index.ts`: Ekspor publik untuk komponen dan utilitas baru.
2. **Pembaruan Layouts Navbar:**
   - `fe/src/layouts/AdminLayout.tsx`: Mengganti avatar `/gio.jpeg` statis dengan `<NavbarProfileDropdown role="admin" />`.
   - `fe/src/layouts/KepalaLMILayout.tsx`: Mengganti avatar `/gio.jpeg` statis dengan `<NavbarProfileDropdown role="head_lmi" />`.
   - `fe/src/layouts/KonselorLayout.tsx`: Mengganti `<Link to="/konselor/pengaturan">` dengan `<NavbarProfileDropdown role="counselor" />`.
   - `fe/src/layouts/KlienLayout.tsx`: Mengganti `<NavLink to="/klien/pengaturan">` dengan `<NavbarProfileDropdown role="client" />`.
3. **Standardisasi 5 Halaman Periode Akademik:**
   - `fe/src/pages/admin/AdminFeedbackPage.tsx`: Mengganti implementasi internal `PeriodDropdown` dengan `AcademicPeriodFilter`.
   - `fe/src/pages/admin/AdminLaporanPage.tsx`: Mengganti implementasi internal `SemesterPeriodDropdown` dengan `AcademicPeriodFilter`.
   - `fe/src/pages/admin/AdminKonselingPage.tsx`: Mengganti elemen HTML `<select>` mentah dengan `AcademicPeriodFilter`.
   - `fe/src/pages/counselor/KonselorFeedbackPage.tsx`: Mengganti elemen HTML `<select>` mentah dengan `AcademicPeriodFilter`.
   - `fe/src/pages/counselor/KonselorRiwayatPage.tsx`: Mengganti elemen HTML `<select>` mentah dengan `AcademicPeriodFilter`.
4. **Audit Basis Data & Dokumentasi:**
   - `docs/uat/UAT_FRONTEND_POLISH.md`: Dokumentasi teknis lengkap perbaikan frontend, aturan inisial, dan komponen bersama.
   - `docs/uat/UAT_DATABASE_CLEANUP_PLAN.md`: Inventarisasi tabel, identifikasi akun Admin utama, temuan perbedaan migrasi lokal vs remote, urutan eksekusi FK-safe, dan skrip dry-run SQL.
   - `docs/PROJECT_STATUS.md`: Pembaruan status kanonis proyek SiCARE.

### File yang Berubah
- `fe/src/lib/avatarUtils.ts` (Baru: utilitas pembangkitan inisial nama)
- `fe/src/components/shared/NavbarProfileDropdown.tsx` (Baru: dropdown profil & logout terpadu)
- `fe/src/components/shared/AcademicPeriodFilter.tsx` (Baru: filter periode akademik 2-kolom terstandardisasi)
- `fe/src/components/shared/index.ts` (Diperbarui: ekspor komponen bersama)
- `fe/src/layouts/AdminLayout.tsx` (Diperbarui: integrasi dropdown profil Admin dengan logo SiCARE)
- `fe/src/layouts/KepalaLMILayout.tsx` (Diperbarui: integrasi dropdown profil Kepala LMI)
- `fe/src/layouts/KonselorLayout.tsx` (Diperbarui: integrasi dropdown profil Konselor)
- `fe/src/layouts/KlienLayout.tsx` (Diperbarui: integrasi dropdown profil Klien)
- `fe/src/pages/admin/AdminFeedbackPage.tsx` (Diperbarui: integrasi `AcademicPeriodFilter`)
- `fe/src/pages/admin/AdminLaporanPage.tsx` (Diperbarui: integrasi `AcademicPeriodFilter`)
- `fe/src/pages/admin/AdminKonselingPage.tsx` (Diperbarui: integrasi `AcademicPeriodFilter`)
- `fe/src/pages/counselor/KonselorFeedbackPage.tsx` (Diperbarui: integrasi `AcademicPeriodFilter`)
- `fe/src/pages/counselor/KonselorRiwayatPage.tsx` (Diperbarui: integrasi `AcademicPeriodFilter`)
- `docs/uat/UAT_FRONTEND_POLISH.md` (Baru: dokumentasi teknis perbaikan frontend)
- `docs/uat/UAT_DATABASE_CLEANUP_PLAN.md` (Baru: rencana pembersihan basis data terperinci)
- `docs/PROJECT_STATUS.md` (Diperbarui: pencatatan Batch 1.5g.2)
- `docs/WORK_LOG.md` (Diperbarui: entri append-only ini)

### Hasil Verifikasi Faktual
- `npm --prefix fe run lint`: **PASS** (0 errors, 0 warnings).
- `npm --prefix fe run build`: **PASS** (2461 modul ditransformasi, PWA dist siap produksi).
- `npm --prefix be run check`: **PASS** (31 berkas backend valid tanpa syntax error).
- `npm --prefix be test`: **184/184 PASS** (0 failed, 0 skipped).
- `git diff --check`: **PASS** (bersih dari whitespace errors dan conflict markers).

### Risiko Tersisa & Langkah Berikutnya
- Rencana pembersihan basis data remote berada dalam status **PENDING APPROVAL**. Database remote belum dibersihkan dan migrasi Batch 1.5c s.d. 1.5e (`20261031120000` - `20261031180000`) belum diaplikasikan ke remote.
- Langkah berikutnya: Pengguna meninjau `UAT_DATABASE_CLEANUP_PLAN.md`, memberikan konfirmasi/persetujuan untuk eksekusi reset dan deploy migrasi remote, dilanjutkan dengan eksekusi manual UAT oleh penguji manusia.


---

## 2026-11-01 — Perbaikan Posisi NavbarProfileDropdown & Penyelarasan Header Visual

### Deskripsi Masalah
Setelah implementasi Batch 1.5g.2, posisi avatar profil pada layout portal (`AdminLayout.tsx`, `KepalaLMILayout.tsx`, `KonselorLayout.tsx`) mengalami kegagalan penempatan visual:
- Avatar profil muncul di ujung kiri navbar tepat di dekat batas sidebar desktop (`lg:left-[248px]`), bahkan terpotong oleh perbatasan sidebar.
- Penyebab utama: `NavbarProfileDropdown.tsx` memiliki kelas bawaan `relative inline-block` yang bertabrakan dengan kelas prop `wrapperClassName="absolute right-[14px] top-[16px] z-50"`. Pada urutan resolusi CSS Tailwind v4, properti `position: relative` menimpa `position: absolute`, sehingga komponen ditempatkan dalam flow normal dokumen di sudut kiri atas `<header>` (di sebelah sidebar) dan pergeseran `right: 14px` justru mendorong avatar ke arah kiri menembus batas sidebar.
- Dekorasi tiga gunung hijau di sisi kanan navbar menjadi kosong tanpa avatar di atasnya.

### Solusi dan Implementasi
1. **Penyatuan Kontainer Aksi Navbar Kanan:**
   - Pada `AdminLayout.tsx`, `KepalaLMILayout.tsx`, dan `KonselorLayout.tsx`, dibuat kontainer aksi kanan terpadu: `<div className="absolute right-4 top-1/2 -translate-y-1/2 z-40 flex items-center gap-3">`.
   - Di dalam kontainer ini, tombol notifikasi (`NotificationBell`) diletakkan di sebelah kiri avatar profil (`NavbarProfileDropdown`) dengan jarak proporsional `gap-3` (12px).
   - Avatar profil berada di posisi paling kanan (`right-4`), tepat di atas area dekorasi tiga gunung hijau SVG SiCARE.
   - Dekorasi tiga gunung hijau dipertahankan 100% utuh tanpa perubahan ukuran atau koordinat SVG, dengan `z-0` di bawah kontainer aksi (`z-40`).
2. **Penyelarasan Tampilan & Tombol:**
   - Tombol `NotificationBell` diberikan gaya bundar `h-10 w-10` dengan latar `bg-white/95`, border halus, dan bayangan, sehingga serasi dengan tombol avatar 40x40px dan teks lonceng tetap kontras serta terbaca jelas di atas gunung hijau.
   - Pada `KlienLayout.tsx`, `NotificationBell` dan `NavbarProfileDropdown` disatukan ke dalam kontainer `<div className="flex items-center gap-2.5 sm:gap-3 shrink-0">` dengan ukuran tombol seragam `h-10 w-10`.
3. **Verifikasi Fungsionalitas & Aksesibilitas:**
   - Dropdown menu terbuka sempurna di bawah avatar (`top-full right-0 mt-2.5`) tanpa terpotong batas navbar (`overflow-visible` pada header).
   - Seluruh fungsi (logo SiCARE Admin, fallback inisial brand `#064E3B`, foto profil, tombol logout, click outside, escape key) bekerja normal.

### Berkas yang Berubah
- `fe/src/layouts/AdminLayout.tsx` (posisi top navbar diperbaiki)
- `fe/src/layouts/KepalaLMILayout.tsx` (posisi top navbar diperbaiki)
- `fe/src/layouts/KonselorLayout.tsx` (posisi top navbar diperbaiki)
- `fe/src/layouts/KlienLayout.tsx` (posisi flex container diselaraskan)
- `docs/WORK_LOG.md` (entri append-only ini)

### Hasil Verifikasi
- `npm --prefix fe run lint`: **PASS** (0 errors, 0 warnings).
- `npm --prefix fe run build`: **PASS** (2461 modul tertransformasi, PWA dist siap).
- `npm --prefix be run check`: **PASS** (31 berkas backend valid).
- `npm --prefix be test`: **184/184 PASS** (0 failed, 0 skipped).
- `git diff --check`: **PASS** (bersih dari whitespace error).


---

## 2026-11-02 — Integrasi Foto Profil Supabase Storage, Pemulihan Scroll Global & Pembersihan Pengaturan

### Scope & Tujuan
Mengimplementasikan integrasi penuh penyimpanan foto profil Supabase Storage, pemulihan posisi scroll global otomatis pada setiap transisi halaman, dan perapian antarmuka halaman pengaturan dengan menghapus tombol keluar:
1. **CRUD Foto Profil Supabase Storage:**
   - Menggantikan mekanisme data URL Base64 dan `localStorage` sementara dengan upload riil ke bucket publik `avatars` di Supabase Storage.
   - Menyediakan endpoint backend terproteksi `POST /api/v1/profile/photo` dan `DELETE /api/v1/profile/photo` dengan validasi berkas (JPG/JPEG, PNG, WebP; maksimal 2 MB; pesan penolakan bahasa Indonesia).
   - Menghapus objek foto lama pada penyimpanan saat terjadi penggantian foto baru atau penghapusan foto profil.
   - Memperbarui `photo_path` pada `counselor_profiles` (untuk Konselor) dan metadata otentikasi `user_metadata.avatar_url` (untuk seluruh peran: Konselor, Kepala LMI, Klien).
   - Mempertahankan logo resmi SiCARE (`/icon-512x512.png`) sebagai identitas baku Administrator.
   - Menyelaraskan tampilan avatar navbar (`NavbarProfileDropdown`) seketika tanpa memerlukan logout/login ulang.
   - Memastikan direktori publik konselor (`HomePage` dan `CounselorPage`) menampilkan foto dari Supabase Storage dengan fallback inisial nama yang anggun jika foto tidak ada atau gagal dimuat.
2. **Restorasi Scroll Global Terpusat (`ScrollToTop`):**
   - Komponen pemulihan scroll otomatis saat transisi rute (`pathname`) pada seluruh peran dan halaman publik.
   - Mengembalikan posisi scroll pada `window`, `document.documentElement`, `document.body`, dan seluruh kontainer konten utama (`main`).
   - Mempertahankan posisi scroll pada perubahan tab/filter lokal di halaman yang sama (query parameters) dan mendukung navigasi jangkar hash (`#anchor`).
3. **Pembersihan Tombol Keluar pada Halaman Pengaturan:**
   - Menghapus tombol dan panel `SignOutPanel` dari seluruh 4 halaman pengaturan:
     - `AdminPengaturanPage.tsx`
     - `KepalaLMIPengaturanPage.tsx`
     - `KonselorPengaturanPage.tsx`
     - `KlienPengaturanPage.tsx`
   - Mempertahankan fungsi keluar aplikasi terpusat melalui menu dropdown profil pada navigasi atas (`NavbarProfileDropdown`).

### File yang Dibuat / Diubah
- **`be/src/routes/domain.routes.js`** (Diperbarui: menambahkan endpoint `POST /profile/photo` dan `DELETE /profile/photo` lengkap dengan audit trail dan pembersihan objek storage lama).
- **`be/src/middleware/auth.js`** (Diperbarui: hidrasi `avatar_url` dan `photo_path` pada `request.auth.profile`).
- **`fe/src/lib/profilePhotoStorage.ts`** (Baru: utilitas client-side untuk validasi berkas, upload, delete, dan resolusi URL foto profil).
- **`fe/src/components/shared/ScrollToTop.tsx`** (Baru: komponen pengatur posisi scroll terpusat berbasis rute).
- **`fe/src/components/shared/index.ts`** (Diperbarui: mengekspor `ScrollToTop`).
- **`fe/src/App.tsx`** (Diperbarui: memasang `<ScrollToTop />` di root router).
- **`fe/src/types/auth.ts` & `fe/src/types/api.ts`** (Diperbarui: menambahkan field `avatar_url` dan `photo_path` pada `AuthProfile` dan `ProfileDto`, serta tipe `ProfilePhotoResultDto`).
- **`fe/src/lib/sicareApi.ts`** (Diperbarui: menambahkan metode `uploadPhoto` dan `deletePhoto`).
- **`fe/src/components/shared/NavbarProfileDropdown.tsx`** (Diperbarui: resolusi URL foto via `getPublicPhotoUrl` dan sinkronisasi reaktif tanpa cascading render).
- **`fe/src/pages/admin/AdminPengaturanPage.tsx`** (Diperbarui: menghapus `SignOutPanel`).
- **`fe/src/pages/headlmi/KepalaLMIPengaturanPage.tsx`** (Diperbarui: menghapus `SignOutPanel`, menghapus foto hardcoded `/gio.jpeg`, integrasi CRUD foto storage).
- **`fe/src/pages/counselor/KonselorPengaturanPage.tsx`** (Diperbarui: menghapus `SignOutPanel`, integrasi CRUD foto storage ke `counselor_profiles`).
- **`fe/src/pages/client/KlienPengaturanPage.tsx`** (Diperbarui: menghapus `SignOutPanel`, integrasi CRUD foto storage ke metadata).
- **`fe/src/pages/public/HomePage.tsx` & `fe/src/pages/public/CounselorPage.tsx`** (Diperbarui: penanganan fallback foto konselor reaktif tanpa memory leak atau layout shift).
- **`docs/WORK_LOG.md` & `docs/PROJECT_STATUS.md`** (Diperbarui: pencatatan progres dan log pekerjaan).

### Bukti Pengujian
- `npm --prefix be run check`: **PASS** (31 berkas backend valid tanpa syntax error).
- `npm --prefix be test`: **189/189 PASS** (0 failed, 0 skipped, seluruh suite backend lulus).
- Uji integrasi endpoint foto profil (`scratch/test-photo-endpoint.mjs`): **PASS** (Admin ditolak 403, berkas invalid ditolak 400, upload 200, penimpaan menghapus berkas lama, GET /profile mengembalikan avatar_url, DELETE menghapus dari storage dan mengosongkan metadata).
- `npm --prefix fe run lint`: **PASS** (0 errors, 0 warnings).
- `npm --prefix fe run build`: **PASS** (2467 modul ditransformasi, PWA bundle siap produksi).
- `git diff --check`: **PASS** (bersih dari whitespace error dan conflict marker).

## 2026-11-02 — Perbaikan Konstruksi URL Foto Profil Supabase Storage (Resolusi Bucket 'avatars')

### Ringkasan
Memperbaiki bug di mana foto profil yang berhasil diunggah ke Supabase Storage tidak muncul pada antarmuka website (jatuh ke inisial nama).

1. **Akar Masalah:**
   - Fungsi `getPublicPhotoUrl` pada `fe/src/lib/publicApi.ts` mengonstruksi URL publik Supabase Storage tanpa menyertakan nama bucket `avatars/` ketika menerima path relatif dari database (misal: `<user_id>/avatar-<timestamp>.jpg`).
   - Akibatnya, URL yang dihasilkan menjadi `https://<supabase-url>/storage/v1/object/public/<user_id>/avatar-...jpg`, di mana Supabase menganggap segmen `<user_id>` sebagai nama bucket.
   - Supabase merespons dengan `HTTP 400 Bad Request` (`code: NoSuchBucket`), memicu handler `onError` pada elemen `<img>`, dan memaksa antarmuka beralih ke inisial nama (fallback).
2. **Perbaikan:**
   - Menyempurnakan `getPublicPhotoUrl` di `fe/src/lib/publicApi.ts`:
     - Memastikan segmen bucket `avatars/` selalu disertakan pada relative path Supabase Storage.
     - Melakukan auto-correct jika URL absolut Supabase Storage yang masuk tidak memiliki prefix `avatars/`.
     - Menghindari duplikasi bucket (`avatars/avatars/`).
     - Mempertahankan integritas data URL (`data:image/`) dan aset statis lokal (`/icon-512x512.png`, `/logo.png`, dll.).
3. **Hasil Verifikasi:**
   - 12/12 uji kasus URL pembentukan foto profil: **PASS**.
   - Probe live URL foto konselor di Supabase Storage: `HTTP 200 OK` (Content-Type: `image/jpeg`, Content-Length: 94336 bytes).
   - `npm --prefix fe run lint`: **PASS** (0 errors, 0 warnings).
   - `npm --prefix fe run build`: **PASS** (2467 modules transformed, build sukses).
   - `npm --prefix be run check`: **PASS** (syntax checks clean).

## 2026-11-02 — Implementasi Verifikasi Email Supabase Auth + Brevo SMTP & Persiapan Vercel

### Ringkasan
Mengimplementasikan verifikasi email otomatis berbasis Supabase Auth dengan Brevo SMTP, halaman callback terdedikasi `/auth/confirmed`, penegakan login hanya untuk akun terverifikasi (`account_status = active`), endpoint & antarmuka pengiriman ulang (resend confirmation) dengan rate limit/cooldown 60 detik, serta konfigurasi routing SPA Vercel:

1. **Alur Registrasi:**
   - Menyematkan `emailRedirectTo` terverifikasi berbasis origin tepercaya (`env.frontendOrigins` atau `env.appBaseUrl`, misal `https://si-care.vercel.app/auth/confirmed` atau `http://localhost:5173/auth/confirmed`).
   - Mencegah open redirect dengan validasi origin tepercaya di backend.
   - Pesan sukses frontend diarahkan ke `/login` dengan notice: `"Silakan periksa email untuk melakukan verifikasi akun"`.
   - Menjaga aturan bahwa registrasi publik secara kanonis hanya menghasilkan role `client`.
2. **Halaman Callback `/auth/confirmed`:**
   - Komponen callback `fe/src/pages/auth/AuthConfirmedPage.tsx` yang menangani 3 varian flow: PKCE (`?code=...`), token hash OTP (`?token_hash=...`), dan implicit flow (`#access_token=...`).
   - Membersihkan session lokal pada browser setelah verifikasi sukses (`client.auth.signOut({ scope: "local" })`) agar tidak berbenturan dengan `AuthProvider` dan memungkinkan login eksplisit.
   - Menampilkan status loading, kartu sukses berstandar brand dengan tombol "Masuk ke SiCARE", serta kartu error dengan form inline kirim ulang jika tautan invalid/kedaluwarsa.
3. **Fitur Kirim Ulang Email Verifikasi (Resend Confirmation):**
   - Endpoint backend baru `POST /api/v1/auth/resend-confirmation` dengan validasi Zod (mendukung email atau NIM/NIP), pembersihan cooldown memory 60 detik, proteksi anti-leak enumeration akun, dan audit logging.
   - Penambahan method `resendConfirmation` pada `AuthContext` dan `AuthProvider`.
   - Form kirim ulang interaktif pada `Login.tsx` dan `AuthConfirmedPage.tsx` dengan countdown timer cooldown.
4. **Penegakan Login:**
   - `POST /api/v1/auth/login` secara ketat menolak pengguna yang belum mengonfirmasi email (`HTTP 403 EMAIL_NOT_CONFIRMED`) baik melalui error `signInWithPassword` maupun verifikasi eksplisit field `email_confirmed_at`/`confirmed_at`.
   - Mempertahankan penegakan status akun aktif (`account_status === "active"`) dan perlindungan RBAC semua role (Admin, Konselor, Kepala LMI, Klien).
5. **Kesiapan Vercel:**
   - Membuat `fe/vercel.json` dengan rewrite rewrite rule `/(.*) -> /index.html` untuk menjamin direct access dan refresh rute React Router di Vercel tanpa 404.
6. **Hasil Pengujian & Verifikasi:**
   - In-memory automated tests `be/test/emailVerification.test.js`: **5/5 PASS**.
   - `npm --prefix be run check`: **PASS** (31 berkas sintaks backend valid).
   - `npm --prefix fe run lint`: **PASS** (0 errors, 0 warnings).
   - `npm --prefix fe run build`: **PASS** (2468 modul ditransformasi, bundle Vite & PWA sukses).

## 2026-11-02 — Peningkatan Antarmuka Publik (Hero Slideshow, Animasi Maskot, Mood Tracker & Panduan)

### Ringkasan
Penyempurnaan visual, responsivitas, dan interaktivitas pada halaman publik dan footer SiCARE:
1. **Hero Section Beranda (`HomePage.tsx` & `index.css`):**
   - Implementasi slideshow latar hero (4 citra) dengan efek transisi crossfade dan zoom lembut (Ken Burns effect).
   - Penyesuaian `MotivationalTyping` dengan mode `tone="light"` untuk keterbacaan optimal di atas latar hero dinamis serta stabilisasi tinggi kontainer (`min-h`) guna mencegah Cumulative Layout Shift (CLS).
   - Penataan ulang CTA utama ("Mulai Konseling" & "Lihat Konselor") dengan tombol rounded-pill dan daftar keunggulan ringkas.
   - Penambahan animasi maskot interaktif (`.mascot-confused` dan partikel tanda tanya `.mascot-qmark`) pada seksi "Kenapa Layanan Konseling Hadir" dengan dukungan `prefers-reduced-motion`.
2. **Halaman Refleksi Mood (`MoodTrackerPage.tsx`):**
   - Header visual baru dengan badge aksen brand SiCARE.
   - Kartu progress pertanyaan sticky dengan backdrop-blur dan border halus.
   - Kartu pertanyaan interaktif dengan indikator aksen kiri dan checkmark status.
   - Pilihan opsi mood dengan micro-interaction hover zoom emoji dan state terpilih kontras tinggi.
   - Banner hasil penilaian mood dengan gradien dinamis dan maskot responsif.
3. **Halaman Panduan (`PanduanPage.tsx`):**
   - Pembaruan kartu audiens "Siapa Saja yang Dapat Menggunakan Layanan" menjadi kartu artikel modern dengan visual gradient header, nomor indeks latar (`01`, `02`, `03`), badge peran pengguna, dan aksen garis brand gold.
4. **Komponen Footer (`Footer.tsx`):**
   - Konsolidasi tautan navigasi untuk menghilangkan redundansi antara navigasi dan informasi.
   - Penataan ulang grid menjadi 3 kolom terstruktur (`lg:grid-cols-[1.25fr_1fr_1.2fr]`) dengan alignment responsif untuk tampilan mobile dan tablet.

### File yang Diubah
- `fe/src/components/home/Footer.tsx`
- `fe/src/index.css`
- `fe/src/pages/public/HomePage.tsx`
- `fe/src/pages/public/MoodTrackerPage.tsx`
- `fe/src/pages/public/PanduanPage.tsx`
- `docs/WORK_LOG.md`

### Bukti Pengujian
- `npm --prefix fe run lint`: **PASS** (0 errors, 0 warnings).
- `npm --prefix fe run build`: **PASS** (2468 modul ditransformasi, bundle Vite & PWA sukses).



## 2026-11-03 — Pembatasan Pembuatan & Perubahan Role Akun oleh Admin (Hanya Counselor & Head LMI)

### Ringkasan
Membatasi pembuatan dan perubahan role akun oleh admin pada backend dan frontend agar hanya role `counselor` dan `head_lmi` yang dapat dibuat atau diberikan lewat halaman admin:
1. **Backend (`be/src/routes/admin.routes.js`):**
   - Skema `createAccountSchema.app_role` dan `patchAccountSchema.app_role` dibatasi secara ketat hanya menerima `"counselor"` dan `"head_lmi"`.
   - `email_confirm: true` pada `POST /admin/accounts` tetap terjaga khusus bagi akun konselor dan kepala LMI yang dibuat admin.
   - Pada `PATCH /admin/accounts/:id`: jika `input.app_role` dikirimkan pada akun target yang bukan counselor/head_lmi (misal client atau admin), server menolak dengan `400 ROLE_CHANGE_NOT_ALLOWED`.
   - Zod schema menolak role `client` dan `admin` dengan `400 VALIDATION_ERROR`, mencegah admin menurunkan role konselor/kepala LMI menjadi client/admin.
2. **Backend Tests (`be/test/adminRoutesLoad.test.js` & `be/test/ownershipGuards.test.js`):**
   - Menambahkan 7 automated test di `be/test/adminRoutesLoad.test.js` untuk memastikan:
     - `POST /admin/accounts` dengan `app_role: "client"` ditolak (400).
     - `POST /admin/accounts` dengan `app_role: "admin"` ditolak (400).
     - `POST /admin/accounts` dengan `app_role: "counselor"` dan `"head_lmi"` berhasil (201).
     - `PATCH /admin/accounts/:id` dengan `app_role: "client"` atau `"admin"` ditolak (400).
     - `PATCH /admin/accounts/:id` untuk akun client ditolak jika mencoba mengubah role (400).
     - `PATCH /admin/accounts/:id` berhasil mentransisikan akun counselor ke head_lmi (200).
   - Menyelaraskan tes self-demotion di `be/test/ownershipGuards.test.js` untuk menguji payload `app_role: "counselor"` yang lolos schema namun diblokir dengan 409 `SELF_ADMIN_CHANGE_BLOCKED`.
3. **Frontend (`fe/src/pages/admin/AdminAkunPage.tsx` & `fe/src/types/api.ts`):**
   - Konstanta `ROLES` hanya berisi `"Konselor"` dan `"Kepala LMI"`. Opsi Mahasiswa, Dosen, Staff, dan Admin dihapus dari pilihan pembuatan akun.
   - Memisahkan antara tab filter tampilan (`TABS = ["Semua", "Konselor", "Klien", "Kepala LMI", "Admin"]`) agar admin tetap dapat memonitor dan mengelola akun klien dan admin yang sudah ada, dengan form pembuatan (`emptyForm`) yang selalu default ke `"Konselor"` atau `"Kepala LMI"`.
   - `mapUiRoleToApi` disederhanakan hanya memetakan "Konselor" dan "Kepala LMI".
   - Saat mengedit akun yang sudah berstatus client atau admin, form mengunci role sebagai teks (tanpa dropdown), menampilkan pesan penjelasan bahwa role akun tidak dapat diubah dari halaman admin, dan tidak mengirim `app_role` pada payload PATCH.
   - Mempersempit tipe `CreateAdminAccountApi.app_role` dan `UpdateAdminAccountApi.app_role` menjadi `AdminAccountAssignableRoleApi = "counselor" | "head_lmi"`.
4. **Dokumentasi:**
   - Memperbarui `docs/integration/API_ENDPOINT_MATRIX.md` untuk endpoint `POST /admin/accounts` dan `PATCH /admin/accounts/:id`.

### File yang Diubah
- `be/src/routes/admin.routes.js`
- `be/test/adminRoutesLoad.test.js`
- `be/test/ownershipGuards.test.js`
- `fe/src/pages/admin/AdminAkunPage.tsx`
- `fe/src/types/api.ts`
- `docs/integration/API_ENDPOINT_MATRIX.md`
- `docs/PROJECT_STATUS.md`
- `docs/WORK_LOG.md`

### Bukti Pengujian
- `be: npm run check`: **PASS** (32 berkas sintaks backend valid).
- `be: npm test`: **201/201 PASS** (0 gagal, 0 skipped).
- `fe: npm run lint`: **PASS** (0 errors, 0 warnings).
- `fe: npm run build`: **PASS** (2466 modul ditransformasi, build Vite & PWA sukses).


---

## 2026-11-03 — Batch Perencanaan & Spike: Real-Time Synchronization & Frontend Caching Architecture

### Scope & Tujuan
Menyusun Architectural Decision Record (ADR) dan dokumen evaluasi mendalam (*Spike Document*) untuk arsitektur sinkronisasi real-time dan mekanisme caching di SiCARE tanpa melakukan modifikasi pada kode produksi frontend/backend, tanpa migrasi database, dan tanpa menambah dependensi eksternal:
1. Memetakan konteks arsitektur saat ini di mana frontend berkomunikasi via REST Express (`fe/src/lib/api.ts`), Supabase client di browser (`fe/src/lib/supabase.ts`) hanya menangani autentikasi berbasis `sessionStorage`, dan Express backend memproses data via service role (`be/src/config/supabase.js`) dengan bypass RLS PostgREST.
2. Membandingkan 3 opsi real-time:
   - **Opsi A:** `postgres_changes` via Supabase Client dengan user JWT (CDC WAL).
   - **Opsi B:** Supabase Broadcast via Backend Service Role pada private channel per user (`private:user:${user.id}`).
   - **Opsi C:** Controlled Polling dengan ETag / If-Modified-Since atau versioning data.
3. Menyusun tabel risiko menyeluruh: dampak RLS, migrasi yang dibutuhkan, risiko kebocoran data sensitif klinis/PII, estimasi diff baris kode.
4. Memberikan 1 rekomendasi pendekatan terbaik yang dapat dipertanggungjawabkan secara teknis.
5. Mengevaluasi perbandingan TanStack Query (`@tanstack/react-query`) vs In-Memory Caching ringan berbasis TTL & invalidasi otomatis per-mutasi di wrapper `api.ts`.
6. Menginventarisasi migrasi prospektif dan daftar keputusan yang memerlukan persetujuan pemilik produk (*Product Owner*).
7. Menyusun rencana tahapan implementasi bertahap (*phased rollout plan*) dengan acceptance criteria dan estimasi cakupan pada 6 tabel utama (`bookings`, `counseling_sessions`, `consent_invitations`, `informed_consents`, `notifications`, `feedback`).

### Dokumen yang Dibuat / Diperbarui
- **`docs/refactor/REALTIME_CACHE_DECISION.md`** (Baru): Architectural Decision Record & Spike Document lengkap memuat 9 bab evaluasi teknis, tabel risiko, mitigasi privasi data klinis, desain cache in-memory, dan tahapan peluncuran.
- **`docs/PROJECT_STATUS.md`** (Diperbarui): Pencatatan status Spike Real-Time & Caching sebagai **Belum Dikerjakan (Tahap Perancangan & ADR Selesai)**.
- **`docs/WORK_LOG.md`** (Diperbarui): Entri append-only ini.

### Kesimpulan & Rekomendasi Utama
- **Rekomendasi Utama:** Mengadopsi **Opsi B (Supabase Broadcast via Backend)** yang dipadukan dengan **In-Memory Caching ringan berbasis TTL dan Invalidasi Otomatis per Mutasi di `fe/src/lib/api.ts`**.
- **Alasan Keamanan & Kepatuhan:**
  - Opsi A (`postgres_changes`) ditolak karena memancarkan data baris mentah via WAL ke WebSocket browser, menuntut pembukaan RLS `SELECT` publik/authenticated yang berisiko membocorkan rekam klinis, data kelompok, atau snapshot identitas, serta tidak mendukung peserta tamu tanpa akun.
  - Opsi B menjamin *zero-risk* data leak karena pesan broadcast hanya berupa sinyal operasional ringan (`entity`, `action`, `entityId`). Data aktual tetap diambil melalui API Express yang menerapkan RBAC, penyamaran privasi Kepala LMI, dan audit log.
  - Opsi B tidak memerlukan migrasi SQL atau perubahan RLS pada PostgreSQL.
  - In-memory cache ringan di `api.ts` bersifat zero-dependency, menjaga ukuran bundle frontend tetap hemat (<1,4 MB), transparan bagi komponen, dan otomatis mengosongkan entri saat mutasi dijalankan.

### Status Verifikasi Faktual
- Tidak ada file kode produksi (`fe/src/*` atau `be/src/*`) yang dimodifikasi dalam batch ini.
- Tidak ada skrip migrasi baru yang dibuat atau dijalankan ke database.
- Tidak ada dependensi baru yang ditambahkan ke `package.json` (`fe` maupun `be`).
- `git diff --check`: **PASS** (tidak ada whitespace error atau marker konflik).


---

## 2026-11-03 — Perbaikan Konsol Browser & Keandalan Dashboard Admin

### Scope & Masalah yang Diselesaikan
1. **CORS Preflight Header Riwayat Konselor (`be/app.js` & `be/test/health.test.js`):**
   - Menambahkan `"X-Counselor-History-Grant"` ke dalam `allowedHeaders` pada konfigurasi CORS Express di `be/app.js`.
   - Mengatasi penolakan preflight `OPTIONS /api/v1/counselor/history` di browser yang sebelumnya memblokir pemuatan halaman riwayat konselor (`KonselorRiwayatPage.tsx`).
   - Tidak membuka CORS untuk origin atau method di luar allowlist yang telah ditentukan.
   - Menambahkan test di `be/test/health.test.js` untuk memvalidasi bahwa preflight `OPTIONS` dengan origin yang diizinkan mengembalikan header `access-control-allow-headers` memuat `x-counselor-history-grant`, serta origin tidak tepercaya tetap ditolak dengan HTTP 403.
2. **Normalisasi Relasi `counseling_sessions` di `GET /admin/counseling` (`be/src/routes/admin.routes.js` & `be/test/adminRoutesLoad.test.js`):**
   - Mengatasi akar masalah crash dashboard di mana PostgREST mengembalikan embed `counseling_sessions` sebagai objek atau `null` (karena foreign key `booking_id` pada tabel `counseling_sessions` memiliki constraint `unique`, merepresentasikan relasi 1-to-1).
   - Backend menormalisasi setiap record booking sebelum dikirim: jika `counseling_sessions` berupa objek, dibungkus menjadi array satu elemen `[{ ... }]`; jika `null` atau `undefined`, dinormalisasi menjadi array kosong `[]`. Seluruh field lain dipertahankan.
   - Menambahkan test di `be/test/adminRoutesLoad.test.js` yang memverifikasi normalisasi array untuk ketiga kondisi (objek, null, missing/undefined embed).
   - Kontrak DTO `AdminCounselingDto` pada `fe/src/types/api.ts` tetap konsisten (`counseling_sessions: Array<{ ... }>`).
3. **Pengecekan Defensif Frontend (`fe/src/components/admin/dashboard/DashboardSections.tsx`):**
   - Pada komponen `RecentClientBookings` (sekitar baris 428), menambahkan proteksi defensif `Array.isArray` sebelum memanggil `.some(...)` untuk menentukan status selesai sesi konseling.
4. **Pembaruan Meta Tag PWA (`fe/index.html`):**
   - Menambahkan `<meta name="mobile-web-app-capable" content="yes" />` di `fe/index.html` untuk menghilangkan peringatan usang (*deprecation warning*) di konsol browser modern, dengan tetap mempertahankan `<meta name="apple-mobile-web-app-capable" content="yes" />`.
5. **Komponen Section Error Boundary (`fe/src/components/shared/SectionErrorBoundary.tsx` & `AdminBerandaPage.tsx`):**
   - Membuat komponen error boundary umum berbasis Class Component di `fe/src/components/shared/SectionErrorBoundary.tsx` dengan fallback pesan berbahasa Indonesia yang informatif dan tombol "Muat ulang bagian ini".
   - Mematuhi aturan keamanan `AGENTS.md` Bagian 3: `componentDidCatch` tidak mencatat data pribadi mahasiswa/klien (nama, NIM, isi konseling) ke console atau layanan log.
   - Membungkus seluruh seksi data di `AdminBerandaPage.tsx` (`MetricCards`, `RecentClientBookings`, `SessionTrend`, `ServiceDistribution`, `CounselorWorkload`) secara terpisah sehingga kegagalan satu komponen tidak membuat area dashboard lain crash atau menjadi blank.

### File yang Diubah / Dibuat
- `be/app.js` (Menambahkan `X-Counselor-History-Grant` ke `allowedHeaders` CORS)
- `be/test/health.test.js` (Menambahkan test verifikasi CORS preflight)
- `be/src/routes/admin.routes.js` (Normalisasi `counseling_sessions` menjadi array pada `GET /counseling`)
- `be/test/adminRoutesLoad.test.js` (Menambahkan test normalisasi array 3 kondisi pada `GET /counseling`)
- `fe/src/components/admin/dashboard/DashboardSections.tsx` (Pengecekan defensif `Array.isArray`)
- `fe/index.html` (Menambahkan meta tag `mobile-web-app-capable`)
- `fe/src/components/shared/SectionErrorBoundary.tsx` (Baru: komponen error boundary seksi)
- `fe/src/components/shared/index.ts` (Ekspor `SectionErrorBoundary`)
- `fe/src/pages/admin/AdminBerandaPage.tsx` (Pembungkusan seksi dashboard dengan `SectionErrorBoundary`)
- `docs/integration/API_ENDPOINT_MATRIX.md` (Catatan normalisasi respons `GET /admin/counseling`)
- `docs/PROJECT_STATUS.md` (Pembaruan status kanonis)
- `docs/WORK_LOG.md` (Entri append-only ini)

### Hasil Verifikasi Faktual
- `npm run check` di `be/`: **PASS** (32 berkas backend valid tanpa syntax error).
- `node --test` di `be/`: **203/203 PASS** (0 failed, 0 skipped; durasi ~1,6s).
- `npm run lint` di `fe/`: **PASS** (0 errors, 0 warnings).
- `npm run build` di `fe/`: **PASS** (2467 modul ditransformasikan, PWA dist siap produksi dalam 5.5s).
- `git diff --check`: **PASS** (bersih dari whitespace error).

---

## 2026-11-03 — Pemisahan Pesan Error Login & Penanganan Verifikasi Email

### Scope & Masalah yang Diselesaikan
1. **Pemisahan Kredensial Salah vs Status Verifikasi Email:**
   - Sebelumnya, saat pengguna gagal login, pesan error dapat memicu kebingungan apakah kredensial salah atau akun belum diverifikasi/dikonfirmasi.
   - Di `be/src/routes/auth.routes.js`, pesan error 401 `INVALID_CREDENTIALS` distandardisasi menjadi `"NIM/NIP/email atau kata sandi tidak benar."` untuk semua kondisi kegagalan kredensial (pengguna tidak ditemukan maupun kata sandi salah). Dilarang keras memuat kata "dikonfirmasi" atau "verifikasi" pada respons 401 agar tidak membingungkan pengguna dan mencegah enumerasi akun (karena pesan untuk akun terdaftar yang salah password dan akun tidak terdaftar adalah identik).
2. **Penanganan Akun Belum Diverifikasi (`EMAIL_NOT_CONFIRMED`):**
   - Saat kata sandi benar tetapi email belum dikonfirmasi oleh pengguna (Supabase Auth melempar error `email not confirmed` atau `email_confirmed_at: null`), backend mengembalikan HTTP 403 dengan kode `EMAIL_NOT_CONFIRMED` baik melalui login email maupun lookup NIM.
   - Di frontend (`fe/src/pages/auth/Login.tsx`), status ini ditampilkan dalam panel informasi edukatif berlatar hijau lembut/emerald (`bg-emerald-50/70 border-primary/25`) sesuai warna identitas brand `#064E3B`, bukan kotak error merah menyala. Panel dilengkapi instruksi pengecekan folder Kotak Masuk dan Spam, serta tombol "Kirim ulang email verifikasi".
   - Tombol kirim ulang mengimplementasikan client-side cooldown 60 detik dengan hitung mundur (`${cooldown}d`) dan penanganan HTTP 429 dari server.
3. **Penanganan Akun Dinonaktifkan (`ACCOUNT_INACTIVE`):**
   - HTTP 403 `ACCOUNT_INACTIVE` menampilkan pesan jelas bahwa akun belum aktif atau telah dinonaktifkan oleh institusi, mengarahkan pengguna menghubungi administrator LMI Unika De La Salle Manado tanpa menampilkan tombol kirim ulang verifikasi.
4. **Penanganan Kesalahan Jaringan / Server (503 / Network Error):**
   - Kesalahan koneksi jaringan atau server 503 dipetakan ke pesan terpisah yang mengarahkan pengguna memeriksa koneksi internet atau mencoba beberapa saat lagi, tanpa tertukar dengan kesalahan kredensial.
5. **Pembaruan Payload Resend Confirmation (`fe/src/features/auth/AuthProvider.tsx`):**
   - Fungsi `resendConfirmation(target)` diselaraskan dengan schema backend `resendConfirmationSchema`: bila input berupa NIM/NIP (bukan email valid), dikirim sebagai `{ identifier: trimmed }`; bila berupa email, dikirim sebagai `{ email: trimmed.toLowerCase() }`, sehingga backend dapat me-resolve NIM ke alamat email tujuan tanpa kegagalan validasi Zod.
6. **Automated Testing (`be/test/emailVerification.test.js`):**
   - Menambahkan hook pengujian `setPublicAuthClientForTests` di `be/src/routes/auth.routes.js` untuk injeksi mock Supabase Auth client tanpa menyentuh network remote.
   - Menambahkan 3 test baru di `be/test/emailVerification.test.js`:
     a. NIM tidak terdaftar dan kata sandi salah menghasilkan 401 dengan pesan sama persis tanpa kata "verifikasi" atau "dikonfirmasi" (mencegah enumerasi akun).
     b. Kata sandi benar dengan email belum dikonfirmasi mengembalikan 403 `EMAIL_NOT_CONFIRMED` baik untuk input email maupun NIM.
     c. Akun dinonaktifkan dengan kata sandi benar mengembalikan 403 `ACCOUNT_INACTIVE`.
   - Total tes di `be/test/emailVerification.test.js` bertambah dari 5 menjadi 8 (8/8 PASS).

### File yang Diubah
- `be/src/routes/auth.routes.js`: Standardisasi pesan 401 `INVALID_CREDENTIALS` dan hook `setPublicAuthClientForTests`.
- `be/test/emailVerification.test.js`: Penambahan 3 pengujian automated security & error classification.
- `fe/src/features/auth/AuthProvider.tsx`: Penyelarasan payload `identifier` vs `email` pada `resendConfirmation`.
- `fe/src/pages/auth/Login.tsx`: Klasifikasi `errorKind`, panel edukatif hijau/emerald untuk `EMAIL_NOT_CONFIRMED`, tombol resend + cooldown 60s, isolasi pesan akun nonaktif & jaringan.
- `docs/integration/API_ENDPOINT_MATRIX.md`: Catatan pembaruan respons `POST /api/v1/auth/login`.
- `docs/PROJECT_STATUS.md`: Pembaruan status kanonis dan jumlah automated test (206/206).
- `docs/WORK_LOG.md`: Entri append-only ini.

### Hasil Verifikasi Faktual
- `npm run check` di `be/`: **PASS** (32 berkas backend valid tanpa syntax error).
- `node --test` di `be/`: **206/206 PASS** (0 failed, 0 skipped; durasi ~1,5s).
- `node --test be/test/emailVerification.test.js`: **8/8 PASS** (0 failed, 0 skipped).
- `npm run lint` di `fe/`: **PASS** (0 errors, 0 warnings).
- `npm run build` di `fe/`: **PASS** (2467 modul ditransformasikan, PWA dist siap produksi dalam 5.9s).
- `git diff --check`: **PASS** (bersih dari whitespace error).


## 2026-11-04 — Refactoring & Optimasi Arsitektur Project SiCARE (Frontend & Backend)

### Scope & Perubahan Arsitektur

1. **Frontend Architecture & Mock Clean-Up:**
   - **Pembersihan Folder `fe/src/data/mock/`:** Menghapus seluruh 24 file mock fixtures dan direktori `fe/src/data/`. Menghapus selector mati (`features/admin/reports/selectors.ts`, `clientBookingSelectors.ts`, `sessionRules.ts`, `sessionSelectors.ts`, `useCounselorDashboard.ts`, `requestSelectors.ts`, `clientActivityFeedbackSelectors.ts`, `features/headlmi/reports/selectors.ts`, `features/public/feedback/selectors.ts`) dan store legacy mati (`bookingStore.ts`, `feedbackStore.ts`).
   - **Konstanta Aplikasi & Domain Types:** Membuat `fe/src/constants/intakeOptions.ts`, `fe/src/constants/academicPeriods.ts`, `fe/src/constants/counseling.ts`; membuat `fe/src/types/clientCounselor.ts`, `fe/src/types/admin.ts`; melengkapi `fe/src/types/counseling.ts` dan `fe/src/types/booking.ts`.
   - **Static Content & Reusable Showcases:** Memindahkan data statis ke `fe/src/features/public/constants/publicShowcases.ts` dan `guideContent.tsx`. Menulis ulang `historySelectors.ts` menjadi kalkulasi tanggal murni tanpa mock data.
   - **Domain API & Shared Services:** Membuat `fe/src/services/api/apiClient.ts`, `fe/src/services/api/apiQuery.ts`, dan `fe/src/services/supabase/supabaseClient.ts`. Mengelompokkan domain API di `fe/src/features/*/api/` (`adminApi.ts`, `counselorApi.ts`, `publicApi.ts`, `reportingApi.ts`, `consentApi.ts`, `bookingApi.ts`). Mempertahankan facade di `fe/src/lib/` untuk backward compatibility.
   - **Pembersihan Komponen:** Menghapus duplikat usang `AlurSistem.tsx` dan `fe/src/pages/public/components/`, serta mock card `BookingRequestCard.tsx`.

2. **Backend Separation of Concerns (Routes -> Controllers -> Services -> Repositories):**
   - **Layer Validators (`be/src/validators/`):** Zod request validation schemas (`auth.validator.js`, `booking.validator.js`, `session.validator.js`, `feedback.validator.js`, `counselor.validator.js`, `admin.validator.js`, `consent.validator.js`).
   - **Layer Repositories (`be/src/repositories/`):** Isolasi query database (`booking.repository.js`, `session.repository.js`, `feedback.repository.js`).
   - **Layer Services (`be/src/services/`):** Business logic (`auth.service.js`, `booking.service.js`, `session.service.js`, `feedback.service.js`, `notification.service.js`, `reporting.service.js`, `admin/accounts.service.js`, `admin/periods.service.js`, `admin/counseling.service.js`, `admin/hero.service.js`, `counselor/profile.service.js`, `counselor/availability.service.js`).
   - **Layer Controllers (`be/src/controllers/`):** HTTP request/response orchestration (`health.controller.js`, `auth.controller.js`, `booking.controller.js`, `session.controller.js`, `feedback.controller.js`, `notification.controller.js`, `reporting.controller.js`, `webhook.controller.js`, `consent.controller.js`, `admin/accounts.controller.js`, `admin/periods.controller.js`, `admin/counseling.controller.js`, `admin/hero.controller.js`, `admin/whatsapp.controller.js`, `counselor/profile.controller.js`, `counselor/availability.controller.js`, `counselor/historyCredential.controller.js`).
   - **Thin Express Routes (`be/src/routes/`):** Seluruh 11 route backend disederhanakan murni untuk routing, middleware, dan delegasi ke controller, dengan tetap menjaga named test exports (`setPublicAuthClientForTests`, `timingSafeEqualString`, `verifyWebhookSecret`) dan ownership assertions.
   - **Pembaruan Script Syntax Check:** `be/package.json` `"check"` script dialihkan ke `node scripts/check-syntax.js` untuk memverifikasi seluruh 75 berkas `.js` secara dinamis dan rekursif.

### File yang Dibuat, Diubah, dan Dihapus

- **File Baru (Backend):**
  - `be/src/validators/` (7 files)
  - `be/src/repositories/` (3 files)
  - `be/src/services/` (`auth.service.js`, `booking.service.js`, `session.service.js`, `feedback.service.js`, `notification.service.js`, `reporting.service.js`, `admin/*.service.js`, `counselor/*.service.js`)
  - `be/src/controllers/` (15 files)
- **File Baru (Frontend):**
  - `fe/src/constants/` (`intakeOptions.ts`, `academicPeriods.ts`, `counseling.ts`)
  - `fe/src/types/` (`clientCounselor.ts`, `admin.ts`)
  - `fe/src/features/public/constants/` (`publicShowcases.ts`, `guideContent.tsx`)
  - `fe/src/services/api/` (`apiClient.ts`, `apiQuery.ts`)
  - `fe/src/services/supabase/` (`supabaseClient.ts`)
  - `fe/src/features/*/api/` (`adminApi.ts`, `counselorApi.ts`, `publicApi.ts`, `reportingApi.ts`, `consentApi.ts`, `bookingApi.ts`)
- **File Dihapus (Frontend):**
  - `fe/src/data/mock/` (24 mock data files)
  - `fe/src/data/` (direktori data)
  - `fe/src/pages/public/components/AlurSistem.tsx` dan folder `fe/src/pages/public/components/`
  - `fe/src/components/client/activity/BookingRequestCard.tsx`
  - Selector mati & store legacy: `bookingStore.ts`, `feedbackStore.ts`, `decideCounselorRequest.ts`, `features/admin/reports/selectors.ts`, `clientBookingSelectors.ts`, `sessionRules.ts`, `sessionSelectors.ts`, `useCounselorDashboard.ts`, `requestSelectors.ts`, `clientActivityFeedbackSelectors.ts`, `features/headlmi/reports/selectors.ts`, `features/public/feedback/selectors.ts`.

### Hasil Verifikasi Faktual

- `be: npm run check` (`node scripts/check-syntax.js`): **PASS** (75 berkas JavaScript backend valid tanpa syntax error).
- `be: node --test`:
  - `test/ownershipGuards.test.js`: **20/20 PASS**.
  - `test/adminRoutesLoad.test.js`: **1/1 PASS**.
  - `test/emailVerification.test.js`: **8/8 PASS**.
  - `test/heroMotivations.test.js`: **5/5 PASS**.
  - `test/adminAvailabilityMigration.test.js`: **1/1 PASS**.
  - `test/consentFoundation.test.js`: **8/8 PASS**.
  - `test/domainMigration.test.js`: **5/5 PASS**.
  - `test/audit.test.js`: **3/3 PASS**.
  - `test/domainRpc.test.js`: **6/6 PASS**.
  - `test/whatsappMigration.test.js`: **1/1 PASS**.
  - `test/whatsappTemplates.test.js`: **7/7 PASS**.
  - `test/consentMigration.test.js`: **2/2 PASS**.
  - `test/consentSecurity.test.js`: **16/16 PASS**.
  - `test/consentSigning.test.js`: **12/12 PASS**.
  - `test/groupConsent.test.js`: **11/11 PASS**.
  - `test/groupConsentClosure.test.js`: **19/19 PASS**.
  - `test/whatsappScheduler.test.js`: **5/5 PASS**.
  - `test/whatsappWorker.test.js`: **6/6 PASS**.
  - `test/whatsappOutbox.test.js`: **2/2 PASS**.
  - `test/fonnteService.test.js`: **7/7 PASS**.
- `fe: npm run lint`: **PASS** (0 errors, 0 warnings).
- `fe: npm run build` (`tsc -b && vite build`): **PASS** (2475 modul ditransformasi, bundle PWA dihasilkan).


## 2026-11-04 — Perbaikan Kontrak DTO Reporting Backend & Resiliensi Dashboard Admin

### Scope & Perbaikan
1. **Penyelarasan Kontrak DTO Reporting Backend (`be/src/services/reporting.service.js`):**
   - Mengembalikan struktur kanonis `getReport()` sesuai DTO `AdminReportDto` dan matriks endpoint (`docs/integration/API_ENDPOINT_MATRIX.md` #54 & #55): properti `period: { from, to }`, `totals` (`bookings`, `completed_sessions`, `cancelled_sessions`, `feedback`, `shown_feedback`, `average_rating`), `monthly`, `counselors` (`counselor_id`, `counselor_name`, `bookings`, `completed_sessions`, `feedback_count`, `average_rating`), dan `truncated`.
   - Mengatasi akar masalah crash runtime `TypeError: Cannot read properties of undefined (reading 'cancelled_sessions')` pada `AdminBerandaPage.tsx:202`.
2. **Defensive Null-Safety pada Frontend Dashboard & Laporan Admin:**
   - Memperbaiki `AdminBerandaPage.tsx` dengan optional chaining bertingkat pada `report?.totals?.cancelled_sessions`, `report?.monthly`, serta safe access untuk seluruh metrik `dashboard?.bookings?.total`, `dashboard?.sessions?.completed`, `dashboard?.feedback?.pending_moderation`, `dashboard?.users?.active_clients`, dan `dashboard?.users?.active_counselors`.
   - Memperbaiki `AdminLaporanPage.tsx` dengan optional chaining pada `report?.totals?.bookings`, `report?.totals?.completed_sessions`, `report?.totals?.cancelled_sessions`, serta penjagaan kondisional `report?.totals`, `report?.monthly`, dan `report?.counselors`.
3. **Klarifikasi Endpoint Auth Login (`127.0.0.1:3000/api/v1/auth/login: 404 Not Found`):**
   - Menjelaskan bahwa route backend `/api/v1/auth/login` didefinisikan khusus untuk method HTTP `POST`.
   - Akses browser langsung (navigasi URL bar / GET) atau proses backend yang belum di-restart dengan arsitektur route terbaru akan menghasilkan respon 404 dari `notFoundHandler`.

### File yang Diubah
- `be/src/services/reporting.service.js`
- `fe/src/pages/admin/AdminBerandaPage.tsx`
- `fe/src/pages/admin/AdminLaporanPage.tsx`
- `docs/WORK_LOG.md`

### Hasil Verifikasi Faktual
- `be: npm run check` (`node scripts/check-syntax.js`): **PASS** (75 berkas JavaScript backend lolos uji sintaks).
- `be: node --test` (unit tests: `adminRoutesLoad.test.js`, `heroMotivations.test.js`, `emailVerification.test.js`, `ownershipGuards.test.js`): **42/42 PASS**.
- `fe: npm run lint`: **PASS** (0 errors, 0 warnings).
- `fe: npm run build` (`tsc -b && vite build`): **PASS** (2475 modul ditransformasi, bundle PWA berhasil dibuat).

## 2026-11-04 — Riwayat Konselor: `photo_url` klien & usulan catatan sesi/intake

### Scope
- `GET /counselor/history` kini menambahkan `clients[].photo_url` dari `auth.users.user_metadata.avatar_url` (path bucket `avatars` diubah menjadi URL publik; URL absolut diteruskan; kegagalan lookup menghasilkan `null` tanpa menggagalkan respons). Tidak butuh migrasi.
- `session_notes` dan `intake_answers` **tidak diimplementasikan**: tidak ada tabel di skema dan SOP #13/#16 belum disahkan. Draf migrasi, draf controller, dan daftar pertanyaan SOP ditulis di `docs/backend/PROPOSAL_COUNSELOR_HISTORY_NOTES_INTAKE.md`. Tidak ada file di `supabase/migrations/` dan tidak ada mutasi remote.

### File yang diubah
- `be/src/controllers/counselor/historyCredential.controller.js`
- `be/test/counselorHistoryCredentials.test.js` (tes baru `photo_url`)
- `docs/backend/PROPOSAL_COUNSELOR_HISTORY_NOTES_INTAKE.md` (baru)
- `docs/integration/API_ENDPOINT_MATRIX.md` (#74), `docs/PROJECT_STATUS.md`, `docs/WORK_LOG.md`
- Perubahan frontend yang sudah ada sebelumnya (`KonselorRiwayatPage.tsx`, `types/api.ts`) tidak disentuh.

### Hasil verifikasi
- `be: npm run check`: **PASS** (75 berkas).
- `be: node --test test/counselorHistoryCredentials.test.js`: **6/6 PASS**.
- `be: npm test`: **205/207**. Gagal: `heroMotivations.test.js` (baseline — asersi `type="text"` pada `AdminPengaturanPage.tsx` sejak commit 9f849da) dan `groupConsentClosure.test.js` A5 (flaky; 3/3 PASS saat dijalankan ulang terpisah).
- `be: npx eslint`: 13 error baseline; file controller yang diubah bersih; error di file tes (`parsedBody`, baris 112) sudah ada di HEAD.
- `fe: npx tsc -b`: **PASS**. `fe: npm run lint`: **PASS**.
- Belum diuji: live Supabase / browser.

## 2026-11-04 — Layout Klien: margin konten diperlebar

- `fe/src/layouts/KlienLayout.tsx`: `<main>` dari `max-w-7xl` → `max-w-6xl` dan `lg:w-[86%]` → `lg:w-[84%]` agar konten selalu lebih sempit dari navbar (navbar tetap `max-w-7xl`). Mobile (`w-[92%]`) dan `sm:w-[88%]` tidak berubah. Berlaku untuk semua halaman `/klien/*`.
- `fe: npx tsc -b`: **PASS**. `fe: npm run lint`: **PASS**.
- Browser: **NOT RUN** — `/klien` mengarah ke `/login`, tidak ada akun uji klien di sesi ini.

## 2026-11-04 — Klien Riwayat: riwayat booking + sesi, detail, catatan 2 tab

- `fe/src/pages/client/KlienRiwayatPage.tsx` ditulis ulang:
  - Daftar satu item per booking (`sicareApi.bookings(100)`), dipasangkan dengan sesi lewat `session.booking_id` (`sicareApi.sessions(100)`). Menampilkan status booking (Menunggu konfirmasi, Dikonfirmasi, Ditolak, Jadwal ulang diminta, Dibatalkan) dan status sesi bila ada.
  - Filter: pencarian nama konselor, `AcademicPeriodFilter` (berdasarkan `starts_on`–`ends_on`), dan status (Semua, Menunggu, Terjadwal, Selesai, Batal/Ditolak).
  - Detail in-page dengan breadcrumb (pola Riwayat Konselor): layanan, format, ruang, alasan pembatalan/jadwal ulang, peserta kelompok.
  - Catatan hanya 2 tab (Untuk klien, Tindak lanjut); catatan konselor tidak ditampilkan. Karena tabel `session_notes` belum ada, isi berupa empty state "Catatan belum tersedia." tanpa data palsu.
  - Form feedback dipindah ke detail sesi selesai; endpoint, validasi, dan penanganan 409 sama seperti sebelumnya.
- Aturan akses catatan klien dicatat di `docs/backend/PROPOSAL_COUNSELOR_HISTORY_NOTES_INTAKE.md` (pertanyaan SOP #1). Matriks endpoint #21 menambah KlienRiwayatPage sebagai pemanggil.
- `fe: npx tsc -b`: **PASS**. `fe: eslint`: **PASS**. Browser: **NOT RUN** (butuh login klien).

## 2026-11-04 — Revisi: filter periode, Riwayat Klien per layanan, loading skeleton

- `fe/src/components/shared/AcademicPeriodFilter.tsx`: panel dropdown diukur saat dibuka/resize; bila akan melewati tepi kanan viewport, panel digeser ke kiri (tetap tidak melewati tepi kiri, gutter 8px). Berlaku di semua pemakai komponen.
- `fe/src/pages/client/KlienRiwayatPage.tsx`: toggle Individu/Kelompok (default Individu); nama dan foto konselor dihapus dari kartu dan detail (judul kartu = "Konseling Individu" / nama kelompok, badge tanggal); pencarian menjadi kode pesanan/nama kelompok; data konselor publik tidak lagi diambil; skeleton daftar.
- `fe/src/components/shared/Skeleton.tsx` (baru, diekspor dari `components/shared`): `Skeleton`, `SkeletonList`, `SkeletonTable`, `SkeletonStatGrid`, `SkeletonCardGrid`, `SkeletonBlock` (varian `bare` untuk di dalam panel; `role="status"` + label sr-only).
- Spinner/teks "Memuat..." diganti skeleton di: Admin Aktivitas, Akun, Beranda, Feedback, Konseling, Pengaturan (Hero), Periode; Konselor Aktivitas, Beranda (antrean, sesi hari ini, angka KPI), Feedback, Jadwal (slot), Permintaan; Klien Konselor, Pesanan; Kepala LMI Feedback, Laporan, dan `DashboardSections` (Beranda Kepala LMI); modal Group Consent dan Informed Consent.
- Tidak diubah: Admin Laporan dan Konselor Riwayat (sudah punya skeleton); Klien Beranda/Aktivitas dan halaman Pengaturan semua role (tidak punya state loading; form diisi dari sesi auth) — perlu state loading baru bila ingin skeleton.
- `fe: npx tsc -b`: **PASS**. `fe: npm run lint`: **PASS**. Browser: **NOT RUN** (semua halaman butuh login).

## 2026-11-04 — Loading skeleton untuk halaman tanpa state loading

- Menambah state `loading` (selesai di `.finally`, dengan guard `active`) dan skeleton pada:
  - `KlienBerandaPage.tsx`: kartu "Jadwal konseling berikutnya" dan "Status Booking Terakhir" (`SkeletonBlock`) — sebelumnya sempat menampilkan empty state sebelum data datang.
  - `KlienAktivitasPage.tsx`: daftar "Sesi mendatang" (`SkeletonList`).
  - `KlienPengaturanPage.tsx`, `KonselorPengaturanPage.tsx`, `KepalaLMIPengaturanPage.tsx`: grid panel formulir diganti `SkeletonFormGrid` sampai profil dari server dimuat, sehingga isian tidak tertimpa data server saat pengguna sudah mulai mengetik. Banner akun (dari sesi auth) tetap tampil.
- `components/shared/Skeleton.tsx`: tambah `SkeletonFormGrid` (diekspor dari `components/shared`).
- Tidak diubah: bagian profil `AdminPengaturanPage` (sudah diisi dari sesi auth; bagian Hero sudah ber-skeleton).
- `fe: npx tsc -b`: **PASS**. `fe: npm run lint`: **PASS**. Browser: **NOT RUN** (butuh login).

## 2026-11-04 — Refactor: satu toast global di atas layar

- Baru: `fe/src/components/shared/Toast.tsx` (`ToastProvider`, default export) dan `fe/src/components/shared/useToast.ts` (`useToast`, `ToastApi`, `ToastVariant`; dipisah agar react-refresh tetap aktif). Diekspor dari `components/shared`. Provider dipasang sekali di `fe/src/main.tsx` (di dalam `AuthProvider`, membungkus `BrowserRouter`; `router.tsx` tidak diubah).
  - Posisi: fixed di atas layar, tengah, tepat di bawah navbar (`top-20`/`sm:top-24`, `z-[70]`), lebar maks `max-w-md`.
  - Varian `success` / `error` / `info`; durasi 3,5 s (error 5 s); maksimal 3 tampil; pesan identik tidak menumpuk; tombol tutup; `role="status"`/`role="alert"` + `aria-live`. Animasi `toast-enter` di `fe/src/index.css` (mati saat `prefers-reduced-motion`).
  - React Context, bukan Zustand (state UI sementara, sesuai AGENTS.md §2.7).
- 14 halaman dimigrasikan: state/timer/markup toast lokal dihapus, panggilan diganti `toast.success|error|info(...)`. Teks pesan tidak diubah.
  - Admin: Akun, Feedback, Pengaturan, Periode. Konselor: Aktivitas, Beranda, Jadwal, Pengaturan, Permintaan, Riwayat. Klien: Aktivitas, Pengaturan. Kepala LMI: Feedback, Pengaturan.
  - Varian: hasil sukses dari server → `success`; error API/validasi → `error`; status netral (mis. "Foto profil ditandai untuk dihapus", status kunci riwayat, tolak/jadwal ulang booking oleh konselor, pembatalan sesi) → `info`. Sebelumnya toast konselor "reject"/"cancel" berwarna merah; kini netral karena aksinya berhasil.
- Catatan, tidak diubah (di luar scope): beberapa pesan menyatakan perubahan kata sandi akun "disimpan untuk sesi browser ini" / "permintaan ... diterima" tanpa endpoint backend; perlu ditinjau terpisah.
- `fe: npx tsc -b`: **PASS**. `fe: npm run lint`: **PASS**. `fe: npm run build`: **PASS**. `be: npm test`: **206/207** (gagal: `heroMotivations.test.js`, baseline yang sama). Browser: **NOT RUN** (halaman pemicu toast butuh login).

## 2026-11-04 — Beranda Kepala LMI: kartu ringkasan diringkas

- `fe/src/components/headlmi/dashboard/DashboardSections.tsx` (`MetricCards`, hanya dipakai `KepalaLMIBerandaPage`): 7 kartu (2 baris) → 4 kartu satu baris (2 kolom di HP): Total Booking, Sesi Selesai (dari total sesi), Klien Aktif, Konselor Aktif. Dihapus dari beranda: Menunggu Konfirmasi, Feedback Menunggu Moderasi, Booking Terkonfirmasi. Catatan kartu dipersingkat. `ActivitySummary` dan `CounselorSummary` tidak diubah; data/endpoint tidak berubah.
- `fe: npx tsc -b`: **PASS**. `fe: eslint` (headlmi): **PASS**. Browser: **NOT RUN** (butuh login).

## 2026-11-05 — Laporan & Feedback Kepala LMI mengikuti Admin, popup notifikasi, data konselor

- **Grafik bulanan:** batang tidak tampil karena tinggi persen batang berada di wrapper tanpa tinggi; wrapper kini `h-full`. Filter periode default ke periode akademik berjalan (Admin dan Kepala LMI), sehingga bulan mengikuti semester; "Semua periode" menampilkan tahun pada label.
- **Laporan:** isi `AdminLaporanPage` dipindah ke `fe/src/components/reports/CounselingReportView.tsx`; Admin dan Kepala LMI hanya menyuplai sumber data. Ekspor CSV Kepala LMI dihapus, tersisa Unduh Laporan PDF.
- **Feedback:** isi `AdminFeedbackPage` dipindah ke `fe/src/components/feedback/FeedbackModerationView.tsx` dengan `readOnly`. Kepala LMI hanya melihat: tanpa Tampilkan/Nonaktifkan/Periksa ulang dan tanpa ubah status peninjauan.
- **Privasi:** `GET /admin/counseling` kini mengosongkan `client_id`, `client`, `group_name`, `booking_participants` untuk `head_lmi`. `cancellation_reason` tetap terkirim karena dipakai Analisis pembatalan.
- **Notifikasi:** `NotificationBell` dirender lewat portal ke body (navbar `backdrop-blur` membuat `fixed` mengacu ke navbar), posisi dihitung dari tombol dan dijaga dalam layar; klik luar dan Escape menutup panel.
- **Data akun:** migrasi `20261105000000_sicare_profile_gender_counselor_license.sql` (kolom `gender`, `siap_number`, `sipp_silp_number` di `profiles`, bukan `counselor_profiles` yang terbaca publik). **BELUM diterapkan.** Backend membaca kolom ini, jadi halaman akun admin gagal sampai migrasi diterapkan. Wajib saat membuat konselor (backend + form `AdminAkunPage`). Konselor lama bernilai null dan tetap bisa diubah statusnya.
- **Bug yang ikut diperbaiki:** `patchAccountSchema` (strict) tidak menerima `phone_e164` padahal form selalu mengirimnya, sehingga simpan Ubah Akun ditolak 400.
- Dihapus karena tidak terpakai: `fe/src/features/headlmi/feedback/selectors.ts`, `fe/src/components/headlmi/MetricCard.tsx`.
- Periode untuk Kepala LMI berasal dari endpoint publik (hanya yang dipublikasikan). Angka per periode dihitung dari maksimal 100 booking/feedback terbaru (batas API).
- Verifikasi harness sementara (mock data, sudah dihapus): batang 98/196/98 px, label Agu–Jan, popup 12–363 px pada lebar 375 tanpa scroll horizontal, feedback hanya-lihat tanpa tombol aksi.
- Hasil: `fe: npx tsc -b` **PASS**, `fe: npm run lint` **PASS**, `fe: npm run build` **PASS**; `be: npm run check` **PASS**, `be: npm test` **211/212** (gagal: `heroMotivations.test.js`, baseline). Belum diuji dengan akun sungguhan dan database live.

## 2026-11-05 — Pemeriksaan sebelum menerapkan migrasi profil (belum diterapkan)

- Target tertaut `tfzgztrvonkqsqmesmjy` berlabel **production**. Riwayat migrasi remote berhenti di `20261029100000`; `db push --remote --dry-run` akan menerapkan 7 migrasi (`20261031120000` s.d. `20261105000000`), bukan hanya migrasi profil.
- Query baca-saja: tabel consent (`informed_consents`, `consent_templates`, `consent_invitations`, `consent_audit_logs`, `consent_invitation_secrets`) belum ada di remote, sedangkan `counselor_history_credentials` sudah ada walau tidak tercatat di riwayat migrasi. Data: 5 profil, 2 booking, 0 outbox. Kolom `gender`/`siap_number`/`sipp_silp_number` belum ada.
- Tidak ada perubahan pada database. Menunggu keputusan pengguna soal cakupan.

## 2026-11-05 — Tujuh migrasi diterapkan ke production

- Atas persetujuan eksplisit pengguna, `supabase db push --remote` menerapkan `20261031120000` s.d. `20261105000000` ke `tfzgztrvonkqsqmesmjy` (production).
- Percobaan pertama gagal pada `20261102000000` karena file memanggil `public.handle_updated_at()` yang tidak ada; lima migrasi sebelumnya sudah masuk, dan migrasi yang gagal ter-rollback (trigger, RLS, dan 1 baris `counselor_history_credentials` utuh). File diperbaiki menjadi `public.set_updated_at()`, lalu dua migrasi sisanya diterapkan.
- Menggantikan catatan "BELUM diterapkan" pada entri sebelumnya.

## 2026-11-05 — Izin praktik di Pengaturan Konselor, sapaan beranda

- `GET /profile` (lewat `authenticate`) kini membawa `gender`, `siap_number`, `sipp_silp_number` milik pengguna sendiri. Tidak ada perubahan skema.
- `KonselorPengaturanPage`: panel "Izin Praktik" hanya-baca untuk No. SIAP dan No. SIPP/SILP; perubahan dilakukan Admin.
- `AdminAkunPage`: label "(opsional)" pada jenis kelamin dihapus. Jenis kelamin kini wajib saat membuat akun apa pun (form dan `createAccountSchema`); saat mengubah akun tetap wajib hanya untuk konselor.
- `KonselorBerandaPage`: sapaan "Halo ma'am, ..." / "Halo Sir, ..." dari `profile.gender`, netral "Halo, ..." bila kosong; lambaian 👋 (`.wave-hand` di `index.css`, dua kali lalu berhenti, mati saat `prefers-reduced-motion`).

## 2026-11-05 — SIPP/SILP diperbarui konselor, masa berlaku dan pengingat

- Keputusan: SIAP dikelola Admin; SIPP/SILP dan tanggal berlakunya diperbarui konselor, tanpa persetujuan Admin, dengan audit. Kebijakan saat izin kedaluwarsa menunggu pemilik SOP; saat ini hanya peringatan, tidak memblokir booking.
- Migrasi `20261105120000_sicare_counselor_license_validity.sql`: `sipp_silp_valid_until`, `sipp_silp_updated_at` di `profiles`. **BELUM diterapkan.** `middleware/auth.js` sengaja tidak membaca kolom ini agar login tidak terdampak; `/admin/accounts` dan `/counselor/license` akan gagal sampai migrasi diterapkan.
- Backend: `GET`/`PATCH /counselor/license`, audit `counselor.license.update` (metadata hanya tanggal berlaku), `sipp_silp_valid_until` opsional pada akun Admin.
- Frontend: panel Izin Praktik di `KonselorPengaturanPage` dapat disunting (SIAP hanya-baca), pengingat 30 hari di Beranda dan Pengaturan konselor, lencana kedaluwarsa di daftar `AdminAkunPage`, tanggal berlaku dan waktu pembaruan terakhir di modal akun. Helper `features/counselor/profile/licenseStatus.ts`.
- Pengingat hanya tampil di UI; belum ada notifikasi atau WhatsApp.
- Audit tidak terlihat di halaman Aktivitas Admin; Admin melihat perubahan lewat modal akun.
- `fe: tsc`, `lint`, `build`: **PASS**. `be: check` **PASS**, `be: npm test` **213/214** (gagal: `heroMotivations.test.js`, baseline). Browser dan API live: **NOT RUN**.

## 2026-11-05 — Migrasi masa berlaku SIPP/SILP diterapkan

- Atas persetujuan pengguna, `20261105120000` diterapkan ke production (`tfzgztrvonkqsqmesmjy`) lewat `supabase db push --remote`. Hanya migrasi ini yang tertunda (dry run). Menggantikan catatan "BELUM diterapkan" pada entri sebelumnya.

## 2026-11-05 — Ikon pada tombol aksi CRUD

- Baru: `fe/src/components/shared/IconLabel.tsx` (ikon mengikuti ukuran teks tombol). 59 tombol aksi tanpa ikon di admin, konselor, klien, kepala LMI, tamu, dan modal consent kini berikon. Pemetaan: Simpan `Save`, Hapus `Trash2`, Tambah `Plus`, Ubah `Pencil`, Kirim `Send`, Batal/Tutup `X`, Batalkan sesi/Tolak `XCircle`, Terima `Check`, Kata sandi `KeyRound`.
- Tombol yang hanya menampilkan `Loader2` saat memproses kini menampilkan ikon aksi saat diam.
- Dilewati karena bukan aksi CRUD: tombol langkah "Lanjut..." dan tautan "Kirim ulang" di Login. Teks dan perilaku tombol tidak berubah.
- `fe: tsc`, `lint`, `build`: **PASS**. Browser: **NOT RUN** (butuh login).

## 2026-11-05 — Template PDF Laporan Bimbingan & Konseling (Admin dan Kepala LMI)

- Baru: `fe/src/components/reports/CounselingReportPrint.tsx`, dokumen A4 khusus cetak mengikuti template LMI: sampul, stempel CONFIDENTIAL, footer bernomor halaman, Kesimpulan dan Saran, tanda tangan. Halaman 2 template (lembar pribadi konselor) tidak dipakai. CSS di `fe/src/index.css` (`@page sicare-report`, kelas `rp-*`). Logo `public/kampus.png` (220px).
- Struktur: A Identitas Laporan, B Ringkasan Layanan, C Perkembangan per Bulan, D Layanan per Konselor, E Analisis Pembatalan, F Evaluasi Layanan, G Rincian Sesi (Admin saja, semua baris), lalu Kesimpulan dan Saran.
- Kesimpulan diisi di kotak isian halaman laporan; tidak disimpan. Kosong = ruang tulis tangan.
- Tanda tangan: Admin "Disusun oleh" (nama dari akun) dan "Mengetahui, Kepala LMI" (garis kosong); Kepala LMI satu tanda tangan (nama dari akun).
- Analisis pembatalan di PDF dan layar Kepala LMI memakai kategori dari status data (Ditolak konselor, Sesi dibatalkan, Booking dibatalkan), bukan teks alasan. `GET /admin/counseling` kini mengosongkan `cancellation_reason` dan `reschedule_reason` untuk `head_lmi`.
- Batas baca laporan dinaikkan: `/admin/counseling` dan `/admin/feedback` hingga 1000 baris; PDF menampilkan peringatan bila batas tercapai.
- Verifikasi: PDF nyata dari Edge headless 156 dengan data contoh (harness sudah dihapus), kedua peran. 60 baris tercetak, header tabel berulang, teks rahasia contoh tidak muncul. `@page` margin box butuh Chrome/Edge 131+; browser lain dapat kehilangan stempel dan footer.

## 2026-11-05 — Catatan sesi dan laporan per sesi konselor

- Keputusan pengguna: tambah agama, pendidikan, alamat; laporan per sesi untuk konselor; akses hanya konselor penangan, sesi selesai, memakai kata sandi riwayat; syarat consent bertanda tangan; audit cetak belum diperlukan. Kelompok: data mengikuti peserta yang dipilih.
- Migrasi `20261105140000_sicare_session_notes_client_identity.sql`: kolom `religion`, `education`, `address` di `booking_participants`; tabel `session_notes` (RLS, hanya service_role). **BELUM diterapkan.** Retensi dan penghapusan belum ditetapkan SOP.
- Backend: `PUT /counselor/sessions/:id/notes`, `GET /counselor/sessions/:id/report`, `session_notes` pada `GET /counselor/history`; tiga field identitas pada alur consent (opsional di backend agar data lama valid, wajib di form).
- Frontend: form agama/pendidikan/alamat di `InformedConsentModal` dan `GuestConsentPage`; catatan dapat diedit di detail sesi selesai `KonselorRiwayatPage`; tombol Cetak Laporan (nonaktif bila catatan belum disimpan), pilihan peserta untuk kelompok, peringatan SIPP kedaluwarsa. Dokumen `components/reports/CounselorSessionReportPrint.tsx`.
- Isi laporan: identitas, data sesi, Catatan untuk Klien, Tindak Lanjut, tanda tangan dan No. SIPP. Catatan Konselor tidak dimuat; Uraian Permasalahan template tidak dipakai. Consent yang sudah ditandatangani sebelumnya menampilkan "-" untuk tiga field baru.
- Belum dibuat: endpoint klien untuk membaca catatan; tab catatan Riwayat Klien masih kosong. Intake belum dimuat.
- `fe: tsc`, `lint`, `build`: **PASS**. `be: check` **PASS**, `be: npm test` **216/217** (gagal: `heroMotivations.test.js`, baseline). PDF diverifikasi lewat Edge headless dengan data contoh. Alur live: **NOT RUN**.

## 2026-11-05 — Migrasi catatan sesi diterapkan

- Atas persetujuan pengguna, `20261105140000` diterapkan ke production (`tfzgztrvonkqsqmesmjy`). Hanya migrasi ini yang tertunda (dry run). Menggantikan catatan "BELUM diterapkan" pada entri sebelumnya.
- Verifikasi baca-saja: tiga kolom identitas ada; `session_notes` RLS aktif, tanpa grant anon/authenticated, 1 trigger, 0 baris. Data tetap 5 profil dan 2 booking.
- Temuan: `booking_participants` production kosong karena 2 booking lama dibuat sebelum alur consent; baris peserta baru dibuat saat consent dibuka. Laporan untuk booking seperti ini kini mengembalikan `409 CONSENT_NOT_SIGNED`, bukan `404`.

## 2026-11-05 — Panduan: revisi Alur Sistem dibatalkan pengguna, perbaikan angka mobile

- Pengguna mengembalikan perubahan Alur Sistem sebelumnya ke versi awal; entri di atas tidak lagi berlaku.
- Hanya angka ganjil 01/03/05 di mobile yang diubah: pindah ke atas kartu (72px) agar tidak tertimpa. Desktop tetap sama (posisi 150px diverifikasi).
- `fe: tsc`, `eslint` (public): **PASS**. Dicek di browser pada 375px dan 1280px.
- Kartu Alur Sistem memakai Style A pilihan pengguna: putih, garis hijau di atas, label "Langkah 0X", tanpa sudut membulat dan bayangan. `fe: tsc`, `lint`, `build`: **PASS**. Dicek di browser pada 1280px dan 375px.
- Angka genap 02/04 di mobile mengikuti angka ganjil: 72px di atas kartu, rata kanan. Terukur tidak ada angka menimpa kartu pada 375px; posisi desktop tidak berubah. `fe: tsc`, `lint`, `build`: **PASS**.
- Style A dibatalkan atas permintaan pengguna: kartu Alur Sistem kembali ke gaya awal (sudut membulat, border tipis, tanpa garis atas dan label "Langkah"). Perbaikan posisi angka di mobile tetap dipertahankan. `fe: tsc`, `lint`, `build`: **PASS**.

## 2026-11-05 — Konselor: jarak navbar dan isi halaman

- Padding ganda dihapus: `py-6 lg:py-8` pada `PageContainer` halaman Konselor Aktivitas, Beranda, Feedback, Jadwal, Permintaan. Jarak atas kini hanya dari layout (16px mobile, 24px desktop), sama dengan Pengaturan, Riwayat, dan halaman Admin. `fe: tsc`, `lint`, `build`: **PASS**. Browser: **NOT RUN** (butuh login).
- Riwayat Konselor: lebar konten dari `max-w-6xl` ke `max-w-7xl` agar sama dengan Beranda, Aktivitas, Permintaan, Jadwal, dan Feedback (ruang kosong samping berkurang pada layar di atas sekitar 1530px). Pengukuran harness (sudah dihapus) pada 1280px dan 1920px: jarak navbar ke konten 24px di semua halaman konselor; Feedback tidak berbeda dari halaman lain. `fe: tsc`, `lint`, `build`: **PASS**.
- `KonselorLayout`: padding atas konten dari 24px ke 16px di semua ukuran (`p-4 sm:px-6 sm:pb-6`), berlaku untuk seluruh halaman konselor; layout role lain tidak berubah. `fe: tsc`, `lint`, `build`: **PASS**. Browser: **NOT RUN** (butuh login).
- Koreksi pengguna: yang dimaksud jarak ke sidebar, bukan navbar. `KonselorLayout` dikembalikan ke `p-4 sm:p-6`. Riwayat dan Feedback konselor memakai `maxWidth="full"`, sehingga konten menempel pada padding layout (24px dari sidebar) di layar lebar. `fe: tsc`, `lint`, `build`: **PASS**. Browser: **NOT RUN** (butuh login).

## 2026-11-05 — Navbar: sudut kanan bawah

- `AdminLayout`, `KonselorLayout`, `KepalaLMILayout`: navbar mendapat `rounded-br-[20px]` agar mengikuti lengkung gunung ketiga (radius 28 pada viewBox 234, setara sekitar 20px). Dicek di browser pada layout Konselor; ketiga layout memakai bentuk gunung yang sama. `fe: tsc`, `lint`, `build`: **PASS**.

## 2026-11-05 — Tipe database untuk backend

- Baru: `be/src/types/database.types.ts` (hasil `npm run db:types`, hanya struktur skema, tanpa data), `be/tsconfig.json`, skrip `npm run typecheck` dan `db:types`. `getSupabaseAdminClient()` kini bertipe `SupabaseClient<Database>`.
- Pemeriksaan bertahap lewat `// @ts-check` (`checkJs` mati): `config/supabase.js`, seluruh service admin, counselor (profile, availability, sessionReport), `feedback`, `notification`, `reporting`, dan `historyCredential.controller.js`. Belum: `consent.service.js`, `auth.service.js`, `whatsappOutbox.service.js`, repositories (parameter client belum bertipe), routes, workers.
- JSDoc pada `supabaseError` (`@returns {never}`) dan `writeAudit`. `reporting.service.js`: perulangan per konselor ditulis tanpa non-null, perilaku sama. Bukti: kolom salah pada `.select()` gagal di typecheck dengan pesan `column ... does not exist`.
- **Koreksi audit:** `writeAudit` membuang aksi di luar `SAFE_ACTIONS`, sehingga `counselor.license.update` dan `counselor.session_notes.update` yang dilaporkan tercatat ternyata tidak pernah tertulis, dan `sipp_silp_valid_until` terbuang. Keduanya ditambahkan ke daftar, dengan tes. Masih terbuang (sudah ada sebelumnya, belum diubah): `counselor.history.read`, `counselor.history_password.init|verify|change`, `counselor.publication`, `profile.photo_upload`, `profile.photo_delete`.
- `eslint`, `@eslint/js`, `globals` kini dideklarasikan sebagai devDependencies backend; sebelumnya tidak tercatat dan terhapus saat `npm install`. `be/package-lock.json` berubah.
- Bila skema berubah, jalankan `npm run db:types` setelah migrasi diterapkan.
- `be: typecheck` **PASS**, `check` **PASS**, `npm test` **217/218** (gagal: `heroMotivations.test.js`, baseline).
- Lanjutan audit: `counselor.history.read`, `counselor.history_password.init|verify|change`, `profile.photo_upload`, `profile.photo_delete` ditambahkan ke `SAFE_ACTIONS`; `counselor.publication` disamakan dengan nama daftar `admin.counselor.publication`; kunci metadata `is_public` diizinkan. `filename`/`deleted_path` tetap terbuang karena memuat path berisi ID pengguna. Tes baru memindai `src/` agar setiap aksi `writeAudit` ada di daftar.
- Hasil lanjutan audit: `be: typecheck` **PASS**, `check` **PASS**, `npm test` **218/219** (gagal: `heroMotivations.test.js`, baseline). Aktif setelah backend di-restart.

## 2026-11-09 — WhatsApp: mode simulasi tidak lagi tercatat terkirim

- Masalah: `whatsapp.worker.js` mengabaikan `simulated` dari `fonnte.service.js`, sehingga di mode simulasi outbox menjadi `accepted`, undangan consent menjadi `sent`, dan `cleared_at` terisi, padahal tidak ada pesan yang keluar.
- Keputusan: outbox ditandai `cancelled` dengan `last_error_code: DRY_RUN_NOT_SENT` dan `provider_status: simulated`, tanpa `sent_at` dan `provider_message_id`. Undangan dan rahasianya tidak diubah. Tidak ada status baru, migrasi, atau perubahan kontrak API.
- Pesan yang dibatalkan tidak dikirim ulang saat pengiriman nyata diaktifkan, agar pesan lama tidak terkirim mendadak.
- Dokumen status diselaraskan: catatan "worker belum tersedia" di `PROJECT_STATUS.md` dan `SOP_COVERAGE_MATRIX.md` sudah usang. Worker ada sejak 2026-11-01, tetapi pengiriman nyata belum diuji.
- Temuan, belum diubah: `cleared_at` hanya mencatat waktu, ciphertext token tetap ada; `FONNTE_ENABLED` tidak dipakai; repo belum punya konfigurasi deploy worker/scheduler. Baris outbox lama di database yang sudah `accepted`/`sent` akibat simulasi tidak diperiksa atau dikoreksi.
- `be: typecheck` **PASS**, `check` **PASS**, `npm test` **220/221** (gagal: `heroMotivations.test.js`, baseline; 2 tes baru lulus). Uji live Fonnte: **NOT RUN**. Aktif setelah worker di-restart.

## 2026-11-09 — WhatsApp: pemicu cron untuk backend di Vercel Hobby

- Konteks: pengguna melaporkan backend berjalan di Vercel Hobby. Proses `whatsapp:worker` dan `whatsapp:scheduler` tidak bisa berjalan terus-menerus di sana, dan dokumentasi Vercel membatasi cron Hobby sekali sehari dengan ketepatan per jam.
- Keputusan: cron eksternal memanggil `POST /api/v1/internal/whatsapp/worker-run` dan `scheduler-run` (`be/src/routes/internal.routes.js`), diamankan `Authorization: Bearer <CRON_SECRET>`. Tanpa secret, semua request ditolak `401`. Skrip proses terus-menerus tetap ada untuk host non-serverless.
- Worker memproses 10 pesan per putaran lewat endpoint. `calculateLeaseSeconds` menggantikan masa kunci tetap 60 detik (230 detik untuk 10 pesan), karena pesan dikirim berurutan dan kunci lama bisa habis sebelum giliran pesan tiba.
- Tidak ada migrasi. Kontrak baru dicatat di `API_ENDPOINT_MATRIX.md` (#79, #80), panduan aktivasi di `FONNTE_WHATSAPP_INTEGRATION.md`.
- Risiko saat aktivasi: pesan lama di antrean ikut diproses, jadi jalankan dulu dalam mode simulasi. Isi antrean production belum diperiksa.
- `be: typecheck` **PASS**, `check` **PASS**, `npm test` **228/229** (gagal: `heroMotivations.test.js`, baseline; 8 tes baru lulus). Deploy Vercel, cron eksternal, dan uji live Fonnte: **NOT RUN**.

## 2026-11-13 — Jadwal konselor, slot hari ini, dan halaman permintaan

- `KonselorJadwalPage`: pesan error untuk tanggal yang sudah lewat dan jam hari ini yang sudah lewat, saat membuat, mengubah, atau menggeser slot. Sebelumnya tanggal lampau diblokir tanpa pesan dan jam lewat hanya ditolak server dengan pesan umum. Tombol "Tambah Jadwal" tidak lagi dinonaktifkan untuk tanggal lampau agar pesan bisa tampil.
- Slot hari ini kini muncul di `KlienPesananPage` dan direktori konselor. Penyebabnya batasan frontend `MIN_LEAD_DAYS = 1` dan permintaan slot yang dimulai besok; backend dan RPC `sicare_public_availability` sudah membolehkan slot yang belum dimulai. Tidak ditemukan aturan SOP untuk batas minimal hari.
- Halaman permintaan konselor dan Beranda konselor: tombol "Jadwal Ulang" dihapus dari permintaan yang menunggu konfirmasi; "Tolak" diganti "Tidak Dapat Menerima"; status "Ditolak" menjadi "Tidak Diterima". "Minta Jadwal Ulang" untuk sesi yang sudah dikonfirmasi tetap ada. Teks teknis di detail permintaan dan modal keputusan diganti teks biasa.
- Isi form klien belum ditampilkan: jawaban intake tidak pernah dikirim ke backend dan belum ada tabel penyimpanannya. Menunggu keputusan SOP; tidak ada tabel atau endpoint baru.
- Temuan, belum diubah: notifikasi dalam aplikasi dan template WhatsApp ke klien masih memakai kata "ditolak"; kunci idempotensi pengingat RPC dan scheduler kemungkinan berbeda format sehingga pengingat bisa terkirim dua kali; sesi terlewat tetap `scheduled` tanpa penanganan otomatis.
- `fe: tsc` **PASS**, `lint` **PASS** (0 peringatan), `build` **PASS**. Backend tidak berubah. Uji browser: **NOT RUN** (butuh login konselor dan klien).

## 2026-11-13 — WhatsApp: pengingat sesi tidak lagi masuk antrean dua kali

- Masalah: RPC `sicare_transition_booking` membuat kunci pengingat dengan `starts_at::text` (`2026-11-13 00:00:00+00`), sedangkan scheduler memakai `String(starts_at)` dari JSON (`2026-11-13T00:00:00+00:00`). Kunci unik tidak pernah sama, sehingga scheduler menambah salinan kedua tiap pengingat H-1 dan Hari H.
- Bukti: query baca-saja ke database tertaut menemukan 8 baris pengingat = 4 pengingat x 2 format kunci, semua `failed` (mode uji, tidak ada pesan terkirim). Tidak ada data yang diubah atau dihapus.
- Perbaikan: `enqueueSessionReminders` (`be/src/services/whatsappOutbox.service.js`) mengecek baris yang sudah ada untuk booking, jenis, penerima, dan `scheduled_at` yang sama (status apa pun) sebelum menambah. Jika pengecekan gagal, pengingat dilewati dan dicoba lagi di putaran berikutnya. Jumlah `enqueuedReminders` kini tidak menghitung baris yang dilewati. Tanpa migrasi dan tanpa perubahan kontrak API.
- Baris duplikat lama dibiarkan karena sudah `failed`.
- `be: typecheck` **PASS**, `check` **PASS**, `npm test` **231/232** (gagal: `heroMotivations.test.js`, baseline; 3 tes baru lulus, mock scheduler diperbarui). Deploy: **NOT RUN**.

## 2026-11-13 — Mulai sesi, tanda tangan consent klien, dan isi otomatis identitas

- Laporan pengguna: (1) konselor memulai sesi saat klien belum tanda tangan → `PATCH /sessions/:id/status` 500; (2) tanda tangan klien gagal tersimpan dengan toast error; (3) form consent tidak terisi data klien; (4) konselor tidak melihat isi formulir di detail permintaan.
- (1) `sicare_transition_session` (migrasi `20261031180000`) memakai `select * into v_readiness` lalu `v_readiness.is_fully_consented`, padahal `sicare_check_booking_consent_readiness` mengembalikan `jsonb`. Setiap transisi ke `ongoing` error di PostgreSQL. Migrasi baru `20261113120000_sicare_fix_session_consent_readiness.sql` membaca `v_readiness ->> 'is_fully_consented'`. **Belum diterapkan** ke database; Supabase CLI tidak terpasang di mesin ini. Readiness booking `bc128861…` diperiksa baca-saja: `is_fully_consented=false`, consent `pending`.
- (2) `KlienAktivitasPage` memakai `ConsentDialog` lama yang hanya mengirim gambar tanda tangan tanpa identitas. Backend mewajibkan fakultas, prodi, NIM, tempat/tanggal lahir, dan jenis kelamin; data peserta booking ini kosong, sehingga validasi gagal dan dilempar sebagai `Error` biasa (500). Halaman kini memakai `InformedConsentModal` (form identitas + tanda tangan + unduh PDF); `ConsentDialog`, `SignaturePad` lokal, dan penanda "berhasil" tanpa konfirmasi server dihapus. `validateConsentIdentity` dan `validateSignaturePng` kini melempar `HttpError 400` (`CONSENT_IDENTITY_INVALID`, `CONSENT_SIGNATURE_INVALID`).
- (3) `GET /consents/booking/:id/my-consent` mengisi field kosong peserta dari profil akun (nama, NIM dari `identity_code`, jenis kelamin `male/female` → `Laki-laki/Perempuan`, telepon) hanya pada respons. Fakultas, prodi, tempat/tanggal lahir, agama, pendidikan, dan alamat tidak ada di profil sehingga tetap diisi klien.
- (4) Tidak diubah: jawaban intake tidak pernah dikirim ke backend dan belum ada tabelnya. Menunggu keputusan SOP (`backend/PROPOSAL_COUNSELOR_HISTORY_NOTES_INTAKE.md`).
- `be: typecheck` **PASS**, `check` **PASS**, `npm test` **235/236** (gagal: `heroMotivations.test.js`, baseline; 4 tes baru lulus). `fe: lint` **PASS**, `build` **PASS** (frontend tidak punya script test). Penerapan migrasi, deploy, dan uji browser: **NOT RUN**.

## 2026-11-13 — Aktivitas konselor: gerbang persetujuan sebelum mulai sesi, indikator sesi berjalan, kata ganti "Batalkan"

- Tombol "Mulai Sesi" di `KonselorAktivitasPage` (daftar dan detail) kini dinonaktifkan dan diberi catatan "Menunggu N peserta menandatangani informed consent" ketika `GET /consents/booking/:id/readiness` belum `is_fully_consented`. Pengecekan gagal-terbuka (fail-open): jika pengambilan readiness gagal atau belum selesai, tombol tetap aktif agar pesan error asli dari server tetap muncul, bukan diblokir diam-diam.
- Badge status "Sedang Berlangsung" (daftar dan detail) kini punya titik berdenyut (`animate-ping`) agar sesi aktif terlihat "hidup", bukan sekadar teks statis.
- Diperiksa: `KonselorRiwayatPage` sudah memenuhi aturan "hanya tampilkan sesi, bukan booking" tanpa perlu perubahan — baris `counseling_sessions` hanya pernah dibuat saat booking berstatus `confirmed` (migrasi `20261028000000`, `20261031180000`), sehingga sesi yang `completed`/`cancelled` di halaman ini selalu berasal dari booking yang pernah diterima konselor, termasuk yang dibatalkan setelah diterima.
- Kata "Batalkan"/"Batalkan Sesi" (aksi membatalkan sesi, bukan status hasil) diganti di `KonselorAktivitasPage` dan `KonselorJadwalPage`: "Urungkan Sesi" untuk sesi yang masih `scheduled`, "Hentikan Sesi" untuk sesi yang `ongoing`. `KonselorJadwalPage` memakai "Urungkan Sesi" secara umum karena halaman itu tidak membedakan status sesi pada tombol pembatalannya. Label status "Dibatalkan" dan kata "dibatalkan" pada teks konsekuensi/toast **tidak diubah** (keputusan pengguna: hanya tombol aksi yang berubah, label status tetap sama di semua halaman).
- Tidak diubah: teks teknis `PATCH /api/v1/sessions/:id/status` yang masih tampil di dialog pembatalan `KonselorJadwalPage` (di luar scope permintaan ini, dilaporkan terpisah).
- `fe: tsc` **PASS**, `lint` **PASS**, `build` **PASS**. Backend tidak berubah. Uji browser: **NOT RUN** (butuh login konselor dengan sesi terjadwal yang consent-nya belum ditandatangani).

## 2026-11-13 — Jawaban formulir intake klien: disimpan dan tampil ke konselor

- Keputusan SOP dikonfirmasi pengguna sebelum implementasi (wajib per `AGENTS.md` §3): (1) satu baris jawaban intake per booking, diisi oleh klien/perwakilan yang membuat booking, bukan per peserta kelompok; (2) hanya konselor yang menangani booking yang boleh membaca jawabannya; (3) retensi mengikuti siklus hidup booking (tidak ada aturan penghapusan terjadwal terpisah).
- Migrasi baru `supabase/migrations/20261113130000_sicare_booking_intakes.sql`: tabel `booking_intakes` (`booking_id` PK, `client_id`, `answers` jsonb, batas ukuran 32KB), RLS aktif, hanya `service_role` yang diberi akses — pola yang sama dengan `session_notes` (migrasi `20261105140000`). **Belum diterapkan ke database** (Supabase CLI tidak terpasang di mesin ini).
- Backend: `clientIntakeAnswersSchema` baru di `booking.validator.js` (mencerminkan `ClientIntake`/`ClientIntakeForm` di frontend beserta batas panjangnya), dipasang sebagai `intake_answers` opsional pada `createBookingSchema`. `booking.repository.js` mendapat `findIntakeAnswersByBookingIds` dan `saveIntakeAnswers`. `booking.service.js`: `createBooking` menyimpan `intake_answers` setelah RPC booking sukses — kegagalan simpan intake dicatat ke log server dan **tidak membatalkan booking** (slot sudah terpakai, mengikuti pola `initializeGroupConsentInvitations` yang sudah ada untuk undangan consent kelompok); `listBookings`/`getBookingDetail` melampirkan `intake_answers` ke setiap booking **hanya saat pemanggil berperan konselor** (klien tidak pernah menerima balik jawabannya sendiri lewat endpoint ini). Audit `booking.create` hanya mencatat `has_intake_answers` (boolean), bukan isi jawaban.
- Frontend: `KlienPesananPage` mengirim `intake_answers` saat submit (re-validasi defensif sebelum kirim selain validasi langkah sebelumnya). Komponen baru `ClientIntakeView` (diekstrak dari pola `IntakeSection` yang sudah ada di `KonselorRiwayatPage`, tidak mengubah halaman itu) dipasang di `KonselorPermintaanPage` (kotak "Formulir Klien" di detail permintaan) dan `KonselorAktivitasPage` (kotak yang sama di detail sesi, menggantikan teks lama yang keliru menyebut `session_notes` belum aktif dan menyebut nama tabel database `/api/v1/sessions` ke UI).
- Tidak diubah (di luar scope permintaan "Aktivitas & Permintaan"): `GET /counselor/history` (halaman Riwayat Konselor) belum melampirkan `intake_answers` walau tipenya sudah siap — dicatat sebagai langkah lanjutan di `backend/PROPOSAL_COUNSELOR_HISTORY_NOTES_INTAKE.md`.
- `be: check` **PASS**, `typecheck` **PASS**, `npm test` **245/246** (gagal: `heroMotivations.test.js`, baseline; 10 tes baru lulus — `test/bookingIntake.test.js`). `fe: tsc`, `lint`, `build` **PASS**. Migrasi, deploy, dan uji browser: **NOT RUN**.

## 2026-11-13 — Perbaikan: GET /bookings 500 karena booking_intakes belum ada

- Dilaporkan pengguna: `GET /api/v1/bookings` mengembalikan 500 di dev lokal setelah batch formulir intake. Penyebab: migrasi `20261113130000_sicare_booking_intakes.sql` belum diterapkan ke database (dikonfirmasi lewat query baca-saja: tabel `booking_intakes` tidak ada di schema cache PostgREST), sementara `attachIntakeAnswersForCounselor` di `booking.service.js` memanggil query ke tabel itu tanpa penangkap galat untuk peran konselor.
- Perbaikan: `attachIntakeAnswersForCounselor` kini gagal-terbuka (fail-open) — kegagalan membaca `booking_intakes` (termasuk saat tabelnya belum ada) dicatat ke log server dan tidak menggagalkan `GET /bookings`/`GET /bookings/:id`; `intake_answers` cukup tidak terisi untuk booking terkait. Konsisten dengan penanganan gagal-terbuka yang sudah ada di jalur simpan (`createBooking`) dan jalur pengingat WhatsApp.
- `be: check`, `typecheck` **PASS**, `npm test` **245/246** (gagal: `heroMotivations.test.js`, baseline, tidak terkait).
- Tetap perlu diterapkan: migrasi `20261113130000` ke database agar `intake_answers` benar-benar terisi (bukan sekadar tidak error).

## 2026-11-13 — Notifikasi infinite-scroll, WhatsApp wajib, Kontak disederhanakan, stepper booking

- **Notifikasi:** panel `NotificationBell` kini memuat 10 notifikasi terbaru, lalu memuat 10 berikutnya saat discroll mendekati bawah daftar. Backend `GET /notifications` menerima `offset` baru (selain `unread_only`, `limit`) dan mengembalikan `has_more` (dihitung dari mengambil `limit+1` baris, tanpa query count tambahan per halaman). "Baca semua" kini memperbarui status lokal tanpa memuat ulang dari awal (supaya halaman yang sudah di-scroll tidak reset).
- **WhatsApp wajib untuk semua klien/konselor (keputusan pengguna):** gerbang "Mandatory Opt-In Enforcement" di `whatsapp.worker.js` yang menolak kirim saat `profiles.whatsapp_opt_in !== true` **dihapus**. Worker sekarang hanya memeriksa `account_status === active`. Toggle "Terima Notifikasi Jadwal WhatsApp" dihapus dari `KlienPengaturanPage`. Kolom `profiles.whatsapp_opt_in` dan endpoint `PATCH /profile/whatsapp-consent` **tidak dihapus** (masih dipakai tampilan admin sebagai riwayat), hanya tidak lagi dibaca untuk keputusan kirim — tidak ada migrasi data, nilai lama klien yang pernah opt-out dibiarkan apa adanya karena sudah tidak berpengaruh.
- **Kontak klien disederhanakan:** kartu "Kontak & Preferensi Notifikasi" di Pengaturan klien diganti nama jadi "Kontak". Tombol "Ganti Foto"/"Unggah Foto" dan "Hapus Foto" yang terpisah dihapus — unggah foto tetap bisa lewat avatar di bagian atas halaman (klik ikon kamera yang sudah ada sebelumnya); pesan error unggah foto dipindah ke bawah avatar itu. Kemampuan menghapus foto profil dari halaman ini **hilang** (sesuai permintaan eksplisit); tidak ada jalur pengganti yang ditambahkan.
- **Booking klien:** nomor langkah pada `Stepper` (komponen `BookingFormControls.tsx`) kini bisa diklik untuk berpindah ke langkah yang sudah pernah dicapai (`maxStepReached`), tidak bisa melompat ke langkah yang belum pernah dibuka karena datanya belum terisi. Foto konselor kini tampil di kartu pilihan pada langkah 2 (Pilih Konselor) — sebelumnya hanya inisial; fallback ke inisial tetap ada kalau konselor tidak punya foto. `BookingCounselor` (tipe) dan `mapBookingCounselors` mendapat field `photoUrl`.
- `be: check`, `typecheck` **PASS**, `npm test` **249/250** (gagal: `heroMotivations.test.js`, baseline; 4 tes baru lulus — `notificationPagination.test.js` dan pembaruan `whatsappWorker.test.js`; mock DB bersama di `ownershipGuards.test.js` mendapat dukungan `.range()` yang sebelumnya tidak ada, dipakai pagination notifikasi). `fe: tsc`, `lint`, `build` **PASS**. Uji browser: **NOT RUN**.

## 2026-11-14 — Hapus kartu "Layanan Konseling" di Pengaturan konselor (UI murni, tidak pernah tersimpan)

- Pengguna bertanya apakah kartu "Layanan Konseling" (toggle Konseling Individu/Kelompok) di `KonselorPengaturanPage` tersimpan di database. Jawaban: tidak pernah — nilainya hardcode default aktif semua di kode frontend, tidak pernah diambil dari server saat halaman dimuat, dan `saveChanges` tidak pernah mengirimkannya ke `counselorApi.updateProfile`. Tabel `counselor_profiles` juga tidak punya kolom untuk ini. Toggle tidak memengaruhi apa pun di sisi klien (klien tetap bisa memesan individu/kelompok ke konselor manapun).
- Atas permintaan pengguna, kartu ini dihapus dari `KonselorPengaturanPage.tsx`, beserta field `services` di tipe `CounselorProfile` (`types/counselorProfile.ts`) dan validasi "Pilih minimal satu jenis layanan" di `profileValidation.ts`. Komponen primitif `SettingsSwitchRow` (`SettingsPrimitives.tsx`) dibiarkan ada meski sekarang tidak dipakai di mana pun — primitif bersama, bukan kode mati yang spesifik fitur ini.
- Tidak ada perubahan backend/migrasi (tidak pernah ada yang disimpan untuk dihapus).
- `fe: tsc`, `lint`, `build` **PASS**. Backend tidak berubah. Uji browser: **NOT RUN**.

## 2026-11-14 — Dokumen spesifikasi modul (dokumentasi saja)

- Menyusun `docs/specs/SPESIFIKASI_MODUL.md`: 13 modul (Autentikasi, Manajemen Role & Akun, Notifikasi In-App, Notifikasi WhatsApp, Mood Tracker, Booking, Sesi, Informed Consent, Profil & Jadwal Konselor, Riwayat & Catatan, Feedback, Dashboard & Laporan, Periode & Konten Publik). Format per modul: Deskripsi, Hak/Akses Role, Alur Kerja, Aturan & Batasan. Isi diturunkan dari route, validator, service, dan fungsi migrasi.
- Klarifikasi pengguna: Mood Tracker adalah fitur hiburan publik permintaan klien proyek (tanpa login, tidak disimpan). Masa aktif sesi mengikuti kode (bawaan Supabase, tanpa aturan tambahan). Perilaku notifikasi in-app saat ini (tanpa auto-hapus, tanpa realtime) dan aturan pembuatan akun per role dinyatakan final.
- Tidak ada perubahan kode atau kontrak. Pemeriksaan build/test: **NOT RUN** (tidak relevan untuk perubahan dokumentasi saja).

## 2026-11-14 — Aturan kata sandi, email kampus, telepon +62, ganti kata sandi tersambung server

- Permintaan pengguna (revisi): (1) kata sandi wajib huruf kecil, huruf besar, angka, simbol, 8–128 karakter; (2) pesan WhatsApp ke konselor saat ada permintaan booking masuk; (3) input telepon registrasi dan semua halaman pengaturan akun memakai format `+62`; (4) email registrasi dan pembuatan akun Konselor/Kepala LMI oleh admin hanya mengisi nama email, akhiran `@unikadelasalle.ac.id` diatur frontend. Pengguna juga meminta ganti kata sandi akun di Pengaturan disambungkan ke server.
- **Backend:** `be/src/validators/shared.validator.js` baru (`strongPasswordSchema`, `campusEmailSchema`, `indonesianPhoneSchema` `^\+62[1-9]\d{7,12}$`). Dipasang di `registerSchema`, `createAccountSchema` (email + password), `patchAccountSchema.phone_e164`, dan `profilePatchSchema.phone_e164` (`PATCH /profile`). Endpoint baru `POST /api/v1/auth/change-password` (authenticated): verifikasi ulang kata sandi saat ini via `signInWithPassword`, lalu `auth.admin.updateUserById`; audit `auth.password_change` tanpa metadata/isi kata sandi. PIN riwayat konselor (min. 4) **tidak diubah**. Validator telepon peserta consent/booking kelompok **tidak diubah** (di luar "pengaturan akun").
- **Frontend:** `fe/src/lib/accountRules.ts` (aturan cermin backend) dan `fe/src/components/shared/AccountInputs.tsx` (`PhoneE164Input` awalan tetap `+62`, `CampusEmailInput` akhiran tetap, `PasswordRuleList` checklist langsung). Dipakai di `Register.tsx` (email dosen/staf; mahasiswa tetap otomatis dari NIM), `AdminAkunPage.tsx` (email + password saat buat akun, telepon saat ubah akun), `KlienPengaturanPage`, `KepalaLMIPengaturanPage`, `AdminPengaturanPage`, `KonselorPengaturanPage`. `features/auth/accountPasswordChange.ts` + `sicareApi.changePassword` menggantikan toast palsu "disimpan untuk sesi browser ini" di Klien/Kepala LMI dan "Permintaan diterima" di Konselor; sukses hanya setelah server mengonfirmasi.
- **Konselor:** Pengaturan Konselor sebelumnya tidak punya kolom telepon sama sekali (padahal validasi mewajibkannya). Ditambahkan kolom "Nomor telepon (WhatsApp)" di panel Profil Publik (tidak ditampilkan ke klien). `sicareApi.updateProfile` di halaman ini tidak lagi menelan galat (`.catch(() => null)` dihapus) supaya telepon yang ditolak server tidak dilaporkan sukses.
- **WhatsApp ke konselor (poin 2):** sudah ada sejak Batch 1.5a — RPC `sicare_create_booking` (migrasi `20261031180000`) mengantrekan `booking_requested` ke konselor, template `booking-requested`, worker membaca `profiles.phone_e164` saat kirim. Tidak ada perubahan kode; konselor tanpa nomor telepon valid tidak akan menerima pesan, yang kini bisa diisi lewat Pengaturan Konselor.
- **Bug lama ditemukan saat uji browser:** di `Register.tsx`, klik "Lanjut" pada langkah 3 langsung mengirim form pendaftaran (React memakai ulang elemen `<button>` yang sama lalu mengubah `type` menjadi `submit` di tengah klik), sehingga langkah Tinjau terlewati. Diperbaiki dengan `key` berbeda pada tombol "Lanjut" dan "Daftar". Selama uji, satu permintaan `POST /auth/register` sempat terkirim ke backend lokal yang tidak berjalan (`ERR_CONNECTION_REFUSED`), sehingga tidak ada akun yang terbentuk.
- Tidak diubah: data lama — akun dengan kata sandi lemah tetap bisa login; nomor tersimpan `08…` baru dinormalisasi saat profil disimpan ulang. Edit akun di Admin Akun tetap menampilkan email penuh (read-only) karena akun lama bisa memakai domain lain.
- `be: check` **PASS**, `typecheck` **PASS**, `npm test` **259/260** (gagal: `heroMotivations.test.js`, baseline; 10 tes baru `accountRules.test.js` lulus; fixture `adminRoutesLoad`/`counselorLicense` diperbarui ke email kampus dan kata sandi kuat). `fe: tsc`, `lint`, `build` **PASS**. Uji browser Registrasi (dev server, tanpa backend): input email berakhiran tetap, checklist kata sandi, telepon `+62 812-3456-7890` → `+6281234567890`, tampilan mobile **PASS**. Halaman Pengaturan, Admin Akun, dan ganti kata sandi end-to-end dengan backend: **NOT RUN**. Deploy: **NOT RUN**. Tidak ada migrasi.


## 2026-11-14 — Ikon Mood Tracker: mini maskot Psi dan cuaca hati

- Permintaan pengguna: ikon sendiri bergaya SiCARE untuk setiap jawaban Mood Tracker. Arah yang disetujui: A (karakter) untuk 32 jawaban + C (cuaca hati) untuk 5 badge hasil. Saat implementasi ditemukan maskot resmi `fe/public/maskot.png` (karakter Psi navy, DNA hijau-emas, bintang); atas keputusan pengguna karakter A memakai **mini maskot Psi**, bukan karakter daun baru, agar SiCARE tidak punya dua maskot.
- Komponen baru `fe/src/components/mood/MoodIcons.tsx` (SVG React, tanpa file gambar): `MoodAnswerIcon` — posisi lengan Psi = energi (+2 terangkat tinggi … −2 terkulai), ekspresi wajah = perasaan, properti kecil = konteks jawaban; `MoodResultIcon` — cerah/teduh/angin/hujan/busur seimbang. Semua `aria-hidden`; teks jawaban/badge tetap menjadi label. Jawaban negatif tidak memakai merah atau tanda peringatan.
- `moodAssessment.ts`: `Option.emoji` → `Option.icon` (`MoodAnswerIconId`); emoji di teks `badge` dipindah ke field `id` (`MoodResultIconId`). Teks, urutan, skor, dan `calculateMood` tidak berubah.
- `MoodTrackerPage.tsx`: lingkaran ikon jawaban 44px → 56px agar detail maskot terbaca; saat kartu terpilih (latar `bg-primary`) lingkaran ikon menjadi putih (sebelumnya `bg-white/15`) agar maskot navy tidak tenggelam di hijau tua. Badge hasil menjadi `inline-flex` dengan ikon cuaca.
- Pratinjau sementara (`fe/mood-icons-preview.html`, `fe/src/__preview__/`) dipakai untuk persetujuan pengguna lalu dihapus.
- `fe: tsc`, `lint`, `build` **PASS**. Uji browser `/mood-tracker` (desktop + mobile 375px): 32 ikon tampil, kartu terpilih terbaca, badge hasil "Seimbang" tampil dengan ikon, tanpa scroll horizontal **PASS**. Backend tidak berubah.


## 2026-11-14 — Sinkronisasi SPESIFIKASI_MODUL.md dengan revisi akun dan ikon Mood Tracker

- `docs/specs/SPESIFIKASI_MODUL.md` diperbarui agar sesuai kode: §1 (aturan kata sandi kuat, email `@unikadelasalle.ac.id`, telepon E.164 `+62`, alur `POST /auth/change-password`), §2 (aturan email dan kata sandi saat admin membuat akun, telepon `+62` di form ubah akun), §4 (daftar jenis pesan lengkap termasuk `booking_requested` ke konselor; worker membaca `profiles.phone_e164` saat kirim), §5 (ikon mini maskot Psi dan ikon cuaca hati menggantikan emoji), §9 (kolom nomor telepon WhatsApp di Pengaturan Konselor). Ditambahkan baris "Pembaruan 2026-11-14" di kepala dokumen.
- Dokumentasi saja; tidak ada perubahan kode. Pemeriksaan build/test: **NOT RUN** (tidak relevan).

## 2026-11-15 — Laporan sesi 14 Nov: blokir akhir pekan, temuan status sesi dan pengingat WhatsApp

- Laporan pengguna: (1) sesi 14 Nov tampil "selesai" di klien setelah lewat hari, padahal konselor masih menunggu tanda tangan consent; (2) tidak ada pengingat hari H; (3) jadwal konselor seharusnya hanya hari kerja.
- **(3) Dikerjakan:** `slotSchema` (`be/src/validators/counselor.validator.js`) menolak slot yang mulai/berakhir pada Sabtu atau Minggu menurut WITA (`isWeekendInOperationalZone`). `KonselorJadwalPage` menandai Sabtu/Minggu "Libur", menolak klik/tambah/geser ke akhir pekan (`isWeekendKey`, `WEEKEND_MESSAGE` di `scheduleUtils.ts`), dan menonaktifkan ubah jam slot akhir pekan yang sudah ada (batal tetap bisa). Keputusan pengguna: tidak ada batasan di database supaya pengelola tetap bisa memasukkan slot akhir pekan langsung di Supabase untuk uji/pemeliharaan. Tes baru `availabilityWeekday.test.js` (3).
- **(1) Temuan, belum diubah:** `KlienAktivitasPage.statusOf` menentukan status dari jam saja (`now >= ends_at` → "done") dan mengabaikan `counseling_sessions.status`, sehingga sesi yang masih `scheduled` di server tampil selesai dan memunculkan permintaan feedback. Tidak ada proses yang mengubah status sesi secara otomatis. Pengguna meminta status otomatis baru untuk sesi yang lewat waktu tanpa dimulai; usulan desain disampaikan dan menunggu persetujuan sebelum implementasi.
- **(2) Temuan, belum diubah:** tidak ada pengingat in-app (lonceng). Pengingat WhatsApp H-1 (24 jam sebelum) dan hari H (1 jam sebelum) dikirim worker yang dipicu cron-job.org; pengiriman nyata bergantung pada env produksi `WHATSAPP_SEND_ENABLED` (false = simulasi, outbox `cancelled`/`DRY_RUN_NOT_SENT`), `WHATSAPP_TEST_MODE` (true = hanya nomor di `WHATSAPP_TEST_RECIPIENTS`, lainnya `failed`/`TEST_RECIPIENT_NOT_ALLOWED`), dan `FONNTE_TOKEN`. `FONNTE_ENABLED` didefinisikan di `env.js` tetapi tidak dibaca kode mana pun. Template WhatsApp memformat jam dengan `Asia/Jakarta` dan akhiran "WIB", sedangkan aplikasi memakai WITA (selisih 1 jam). Route `GET /internal/whatsapp/smoke-test` tanpa autentikasi dengan nomor pribadi hardcoded sudah ada di `origin/main` (ter-deploy). Query baca-saja ke database untuk sesi 14 Nov ditolak pengaman otomatis sesi ini; status outbox produksi belum diperiksa.
- `be: check`, `typecheck` **PASS**, `npm test` **262/263** (gagal: `heroMotivations.test.js`, baseline). `fe: tsc`, `lint`, `build` **PASS**. Uji browser kalender konselor: **NOT RUN** (butuh login konselor + backend). Tidak ada migrasi.

## 2026-11-15 — Status otomatis "Terlewat" untuk sesi yang tidak kunjung dimulai

- Disetujui pengguna (usulan 2026-11-15; label "Terlewat", toleransi 30 menit setelah jam selesai sesuai usulan bawaan).
- **Migrasi** `supabase/migrations/20261115120000_sicare_session_missed_status.sql`: `counseling_sessions.status` menerima `missed`; kolom `missed_reason` (`consent_unsigned`/`not_started`) dan `missed_at` dengan constraint konsistensi; indeks parsial `scheduled` per `ends_at`; fungsi `sicare_mark_missed_sessions(p_grace_minutes default 30)` (security definer, hanya `service_role`) yang menandai maks. 200 sesi per panggilan (`for update skip locked`), menentukan alasan dari `sicare_check_booking_consent_readiness` (galat dianggap consent belum lengkap), membatalkan outbox WhatsApp tertunda (`reminder_h1`, `reminder_day_of`, `consent_invitation`, `consent_reminder`; kode `SESSION_MISSED`), dan membuat notifikasi `session.missed` untuk klien dan konselor. Booking tidak diubah. `sicare_transition_session` tidak diubah karena sudah menolak transisi dari status selain `scheduled`/`ongoing`. **Belum diterapkan ke database.**
- **Backend:** `services/missedSession.service.js` (`markMissedSessions` untuk scheduler; `markMissedSessionsSafely` untuk jalur baca, dibatasi sekali per 60 detik per instance dan gagal-terbuka). Dipanggil di `runSchedulerPass` (respons kini berisi `missedSessions`), `sessionService.listSessions`, riwayat konselor (`historyCredential.controller.js`), dan `reportingService.getReport` (`totals.missed_sessions`). `session.repository.js` meminta `missed_reason,missed_at` dan mengulang query tanpa kolom itu bila migrasi belum diterapkan (`42703`). `sessionListQuerySchema` menerima `missed`.
- **Frontend:** `lib/sessionStatus.ts` (label dan teks alasan). `KlienAktivitasPage.statusOf` kini mengikuti status server: `completed` → selesai (baru meminta feedback), `missed` → bagian baru "Sesi terlewat" (14 hari terakhir, tombol "Pesan jadwal baru"), `ongoing` → berlangsung, `scheduled` yang jamnya sudah tiba → kartu "Menunggu sesi dimulai" (tombol tanda tangan consent tetap ada). Sesi `cancelled` tidak lagi ikut ditampilkan sebagai sesi aktif. Label "Terlewat" ditambahkan di `KlienRiwayatPage` (filter + keterangan alasan), `KlienBerandaPage`, `KonselorAktivitasPage` (tab Selesai + detail alasan), `KonselorBerandaPage`, `KonselorRiwayatPage`, `AdminKonselingPage` dan `CounselingReportView` (kelompok tidak terlaksana dengan label/kategori sendiri). Tipe `SessionStatusApi` + `SessionMissedReasonApi`, `AdminReportDto.totals.missed_sessions?`.
- Risiko tersisa: `sicare_transition_booking` masih mengizinkan klien membatalkan atau konselor meminta jadwal ulang booking `confirmed` yang sesinya `missed` (UI tidak menampilkan aksi itu untuk sesi terlewat); pembatalan oleh klien akan mengubah sesi `missed` menjadi `cancelled`, dan konfirmasi ulang setelah jadwal ulang ditolak (`BOOKING_TRANSITION_NOT_ALLOWED`). Status "tidak hadir" menunggu keputusan pemilik SOP.
- `be: check`, `typecheck` **PASS**, `npm test` **271/272** (gagal: `heroMotivations.test.js`, baseline; 9 tes baru `missedSession.test.js`; ekspektasi `internalWhatsappRoutes.test.js` ditambah `missedSessions`). `fe: tsc`, `lint`, `build` **PASS**. Penerapan migrasi, deploy, dan uji browser: **NOT RUN**.


## 2026-11-15 — Hapus route smoke-test WhatsApp tanpa autentikasi

- Atas persetujuan pengguna, route sementara `GET /api/v1/internal/whatsapp/smoke-test` (tanpa autentikasi, mengirim pesan ke nomor pribadi yang di-hardcode) dihapus dari `be/src/routes/internal.routes.js` beserta import `fonnteService` yang tidak terpakai lagi. Route ini sudah ter-deploy di `origin/main`; tetap aktif di produksi sampai perubahan ini di-merge dan Vercel redeploy.
- Tes baru di `internalWhatsappRoutes.test.js` memastikan route mengembalikan 404.
- `be: check` **PASS**, `npm test` **272/273** (gagal: `heroMotivations.test.js`, baseline). Deploy: **NOT RUN**.

## 2026-11-15 — Pengingat WhatsApp jam 07.00 WITA dan Admin Akun tanpa akun admin

- Keputusan pengguna: pengingat H-1 dan hari H dikirim jam 07.00 WITA; pengingat 1 jam sebelum sesi tetap ada dan tidak terikat jam 07.00; pengingat consent yang belum ditandatangani tidak dikirim lagi. Pesan booking dan undangan consent tetap langsung.
- **Migrasi** `20261115130000_sicare_whatsapp_reminder_0700_wita.sql`: jenis pesan baru `reminder_morning`; fungsi `sicare_wita_morning(timestamptz, int)`; trigger `whatsapp_outbox_align_reminder_h1` (BEFORE INSERT) yang memindahkan `reminder_h1` dari `sicare_transition_booking` ke 07.00 WITA sehari sebelum sesi dan membatalkannya (`REMINDER_WINDOW_PASSED`) bila jam itu sudah lewat > 30 menit — dipilih agar fungsi booking (±420 baris) tidak ditulis ulang. Data: `reminder_h1` tertunda diselaraskan (yang sudah lewat dibatalkan), `consent_reminder` tertunda dibatalkan (`CONSENT_REMINDER_DISABLED`). Migrasi `20261115120000` (belum diterapkan) ikut membatalkan `reminder_morning` saat sesi terlewat. **Belum diterapkan.**
- **Backend:** `whatsappOutbox.service.js` — `witaMorning()`, `enqueueSessionReminders` membuat `reminder_h1` (07.00 H-1), `reminder_morning` (07.00 hari H, dilewati bila sesi mulai ≤ 08.30 WITA), `reminder_day_of` (−1 jam); `cancelObsoleteReminders` mencakup `reminder_morning`. Template `session-reminder-morning`. Worker: gerbang baru membatalkan semua `reminder_*` bila booking tidak `confirmed` atau sesi tidak `scheduled` (menutup celah fungsi database lama yang hanya membatalkan `reminder_h1`/`reminder_day_of`). `runSchedulerPass` tidak lagi memanggil `scanPendingConsentsAndEnqueueReminders` (fungsi dibiarkan); respons scheduler kehilangan `scannedInvitations` dan `enqueuedConsentReminders`.
- **Frontend:** `AdminAkunPage` — tab "Admin" dihapus, akun `admin` disaring dari daftar; `AdminAccountTab` tanpa "Admin". API tidak berubah.
- Tidak diubah (sudah dilaporkan): template WhatsApp masih menulis jam dalam WIB (`Asia/Jakarta`), sedangkan aplikasi memakai WITA.
- `be: check`, `typecheck` **PASS**, `npm test` **280/281** (gagal: `heroMotivations.test.js`, baseline; 8 tes baru `whatsappReminder0700.test.js`; ekspektasi `whatsappOutbox`, `whatsappScheduler`, `internalWhatsappRoutes` diperbarui). `fe: tsc`, `lint`, `build` **PASS**. Migrasi, deploy, uji browser: **NOT RUN**.

## 2026-11-15 — Jam di pesan WhatsApp memakai WITA

- Atas persetujuan pengguna: `be/src/templates/whatsapp/index.js` kini memformat tanggal dan jam dengan `Asia/Makassar` (konstanta `OPERATIONAL_TIME_ZONE`) dan akhiran "WITA" (sebelumnya `Asia/Jakarta` dan "WIB", sehingga jam di pesan 1 jam lebih awal dari jadwal di aplikasi).
- Template menghitung ulang `session_date`/`session_time` dari `starts_at`/`ends_at` bila tersedia, karena payload antrean yang dibuat backend menyimpan teks jam yang sudah diformat (WIB). Dengan begitu pesan yang sudah terlanjur antre juga tampil dalam WITA.
- `whatsappTemplates.test.js`: ekspektasi WIB diganti WITA (jam pasti `15:00 - 16:00 WITA` untuk 07:00 UTC), plus tes hari kalender WITA dan tes teks WIB lama diabaikan.
- `be: check`, `typecheck` **PASS**, `npm test` **282/283** (gagal: `heroMotivations.test.js`, baseline). Deploy: **NOT RUN**.

## 2026-11-15 — Pengingat H-1 langsung dikirim bila booking dikonfirmasi setelah 07.00 di hari H-1

- Keputusan pengguna: H-1 tetap dijadwalkan 07.00 WITA sehari sebelum sesi, tetapi booking yang dikonfirmasi pada hari H-1 setelah 07.00 langsung dikirimi H-1 saat dikonfirmasi (sebelumnya dibatalkan bila 07.00 sudah lewat > 30 menit). Dikonfirmasi pada hari sesi: H-1 tidak dikirim (pengingat pagi/1 jam tetap).
- `whatsappOutbox.service.js`: `enqueueSessionReminders` memakai jendela hari H-1 (07.00 H-1 sampai 00.00 WITA hari sesi): sebelum 07.00 dijadwalkan 07.00, di dalam jendela dijadwalkan saat itu juga, setelahnya dilewati. `reminderAlreadyQueued` menerima `scheduledBefore` sehingga H-1 yang sudah dikirim langsung (dicap waktu konfirmasi, termasuk baris dari RPC) tidak dibuat ulang oleh scheduler.
- Migrasi `20261115130000` (belum diterapkan) diperbarui dengan aturan yang sama: trigger `sicare_align_reminder_h1_schedule` dan penyelarasan data `reminder_h1` tertunda.
- Contoh: sesi Selasa 08.00, booking diterima Senin 13.00 → H-1 terkirim Senin 13.00, pengingat 1 jam Selasa 07.00 (pengingat pagi dilewati karena sesi ≤ 08.30).
- 5 tes skenario baru di `whatsappReminder0700.test.js` (Date.now distub); mock `whatsappOutbox`/`whatsappScheduler` mendukung filter rentang. `npm test` **286/287** (gagal: `heroMotivations.test.js`, baseline). Migrasi dan deploy: **NOT RUN**.

## 2026-11-15 — Status otomatis "Kedaluwarsa" untuk booking yang tidak dikonfirmasi

- Pertanyaan pengguna: apa yang terjadi bila konselor tidak menerima/menolak booking sampai jamnya lewat. Temuan: tidak ada penanganan — booking tetap `waiting_confirmation` tanpa batas, konselor masih bisa menerimanya (sesi terbentuk di masa lalu, klien menerima WA konfirmasi yang terlambat), dan `KlienAktivitasPage` menampilkannya sebagai "Menunggu sesi dimulai" (efek samping perubahan status sesi sebelumnya).
- Disetujui pengguna dengan pilihan bawaan usulan: kedaluwarsa tepat saat jam mulai, notifikasi in-app saja (tanpa WhatsApp).
- **Migrasi** `20261115140000_sicare_booking_expired_status.sql`: `bookings.status` menerima `expired`, kolom `expired_at` (konsisten dengan status), indeks parsial `waiting_confirmation` per `starts_at`; `sicare_mark_expired_bookings()` (security definer, hanya `service_role`, maks. 200 per panggilan, `skip locked`) mengubah booking, membatalkan outbox WhatsApp tertunda (`BOOKING_EXPIRED`), dan membuat notifikasi `booking.expired` untuk klien dan konselor; trigger `bookings_guard_confirmation_time` menolak perubahan ke `confirmed` bila `starts_at <= now()` (dipilih agar `sicare_transition_booking` tidak ditulis ulang). `reschedule_requested` sengaja tidak ikut kedaluwarsa. **Belum diterapkan.**
- **Backend:** `missedSession.service.js` — `markExpiredBookings()`; `markMissedSessionsSafely` kini menjalankan kedua penanda (masing-masing gagal-terbuka). Dipanggil juga di `bookingService.listBookings` dan `reportingService.getDashboard`. Scheduler menambah `expiredBookings` ke respons. `DOMAIN_ERRORS.BOOKING_EXPIRED` → 409. `bookingListQuerySchema` menerima `expired`. Laporan: `totals.expired_bookings`.
- **Frontend:** `BookingStatusApi` + `expired`; label `EXPIRED_BOOKING_LABEL` di `lib/sessionStatus.ts`. `KlienAktivitasPage`: entri booking tanpa sesi yang `expired` atau masih `waiting_confirmation` setelah jam mulai masuk bagian baru "Permintaan kedaluwarsa"; `reschedule_requested` tetap di "Sesi mendatang". Label/filter di `KlienRiwayatPage` (filter "Terlewat/Kedaluwarsa"), `KlienBerandaPage`, `KonselorPermintaanPage` (tab Ditutup), `AdminKonselingPage`, `CounselingReportView`, `DashboardSections`.
- `be: check`, `typecheck` **PASS**, `npm test` **294/295** (gagal: `heroMotivations.test.js`, baseline; 8 tes baru `bookingExpired.test.js`). `fe: tsc`, `lint`, `build` **PASS**. Migrasi, deploy, uji browser: **NOT RUN**.

## 2026-11-15 — Bagian pembuka Mood Tracker dengan maskot SVG beranimasi

- Permintaan pengguna: penjelasan fitur Mood Tracker (mood apa saja yang dapat terdeteksi), UI ajakan "Ayo cek mood kamu sekarang", dan maskot SiCARE yang bergerak natural. Maskot resmi hanya berupa PNG utuh; pengguna memilih mencoba SVG berlapis buatan kode lebih dulu, dan akan memesan animasi Rive (`.riv`) bila hasilnya kurang.
- Komponen baru `fe/src/components/mood/AnimatedMascot.tsx`: maskot Psi SVG (badan, lengan Psi bergaris emas, sarung tangan, mata, mulut, DNA, bintang) digerakkan satu loop `requestAnimationFrame` — napas, kedip acak (kadang ganda), lambaian dalam babak acak dengan pergelangan tertinggal (gerak susulan), badan condong dan pupil mengikuti kursor lewat pegas teredam, bintang berkilau; prop `excited` mempercepat lambaian dan menambah lompatan kecil. Berhenti saat tidak terlihat (IntersectionObserver) dan diam untuk `prefers-reduced-motion`.
- `MoodTrackerPage.tsx`: header diganti bagian pembuka — judul tetap "Refleksi Mood & Kepribadian"; subjudul lama "Lacak perasaan harian Anda…" diganti penjelasan yang sesuai cara kerja fitur; daftar lima mood (ikon cuaca + warna hasil dari `moodResults`); tiga keterangan (±1–2 menit, tanpa login/tidak disimpan, refleksi bukan diagnosis); tombol "Ayo cek mood kamu sekarang" menggulir ke pertanyaan pertama dan membuat maskot bersemangat; gelembung percakapan maskot.
- `fe: tsc`, `lint`, `build` **PASS**. Uji browser (desktop + mobile 375px): animasi berjalan (transform bagian maskot berubah tiap frame), gelembung berganti saat tombol disorot, tombol menggulir ke pertanyaan, tanpa scroll horizontal **PASS**. Backend tidak berubah.

## 2026-11-15 — Maskot pembuka Mood Tracker disesuaikan dengan maskot landing page (trisula)

- Masukan pengguna: maskot harus mirip maskot landing page (`fe/public/thinking.png`), yang memiliki trisula Psi seperti logo HIMPSI. Versi sebelumnya menjadikan cabang samping trisula sebagai lengan.
- `AnimatedMascot.tsx` digambar ulang (viewBox 260×300): kepala-badan sebagai cabang tengah trisula yang melebar di atas dan bercabang jadi dua kaki bersepatu bergaris emas; dua cabang samping besar (navy, garis emas di sisi dalam, kilau di sisi luar) tumbuh dari pinggang dan melengkung ke atas; lengan kecil terpisah dengan sarung tangan putih dan manset emas (kiri melambai, kanan mempersilakan); DNA emas-hijau dengan anak tangga ungu melilit badan bawah; bintang emas-hijau dengan buku di atas kepala. Animasi baru: kedua cabang trisula berayun pelan berlawanan arah (lebih lebar saat `excited`) dan alis terangkat saat bersemangat; animasi lain tetap.
- `fe: tsc`, `lint`, `build` **PASS**. Uji browser: bentuk trisula tampil, 8 bagian bergerak per frame, tanpa error konsol dan tanpa scroll horizontal **PASS**.

## 2026-11-15 — Anatomi maskot pembuka: badan DNA dan sayap trisula

- Masukan pengguna (dengan gambar referensi maskot landing page): badan maskot dibentuk oleh DNA, dan sayap trisula seperti logo HIMPSI tumbuh dari bawah ke atas, terpisah dari lengan.
- `AnimatedMascot.tsx`: kepala kini berbentuk cawan yang menyempit menjadi leher (`HEAD`); badan berupa dua pita DNA emas dan hijau yang bersilang tiga kali (`DNA_GOLD`, `DNA_GREEN`) dengan ruang dalam putih berisi anak tangga ungu; kaki navy bergaris emas keluar dari bawah DNA; sayap trisula tumbuh dari belakang leher dan melengkung ke atas setinggi kepala; lengan kiri keluar dari sisi DNA dan melambai, lengan kanan bertolak pinggang dengan kepalan bersarung tangan (menggantikan tangan terbuka). Titik putar animasi (mata, mulut, lengan, sayap, bintang) disesuaikan dengan anatomi baru.
- `fe: tsc`, `lint`, `build` **PASS**. Uji browser: 15 transform bergerak per frame, tanpa error konsol, tanpa scroll horizontal **PASS**.


## 2026-11-15 — Maskot pembuka: arah jari tangan yang melambai

- Masukan pengguna: jari tangan yang melambai terbalik. Saat menyapa dengan telapak menghadap pengguna, jempol harus mengarah ke badan maskot. Sarung tangan di `AnimatedMascot.tsx` dicerminkan (jempol ke dalam, kelingking di sisi luar); titik putar lambaian tidak berubah.
- `fe: tsc`, `lint` **PASS**. Dicek di browser.

## 2026-11-15 — Maskot home page memakai maskot SVG beranimasi (pose berpikir)

- Permintaan pengguna: maskot di home page (bagian "Kenapa Layanan Konseling Hadir Untuk Anda?", sebelumnya `thinking.png` dengan animasi CSS `mascot-confused`) juga dibuat seperti maskot SVG beranimasi.
- `AnimatedMascot.tsx` mendapat prop `pose` (`"wave"` bawaan, `"thinking"` baru) mengikuti `thinking.png`: tangan kiri menopang dagu dengan telunjuk (`gloveChin`), tangan kanan bertolak pinggang, alis berkerut, mulut kecil "hmm". Animasi pose berpikir: kepala miring pelan, mata melirik ke atas kiri-kanan bergantian, alis naik-turun, telunjuk mengetuk dagu dalam semburan singkat, ditambah napas, kedip, sayap berayun, dan bintang berkilau. Pose berpikir tidak mengikuti kursor dan mengabaikan `excited`.
- `HomePage.tsx`: `<img src="/thinking.png" class="mascot-confused">` diganti `<AnimatedMascot pose="thinking" />` di dalam pembungkus `role="img"` berlabel "Maskot SiCARE sedang berpikir". Tiga tanda tanya beranimasi (`mascot-qmark`) dipertahankan. Kelas CSS `mascot-confused` di `index.css` kini tidak dipakai (dibiarkan); `thinking.png` tetap ada di `public/`.
- `fe: tsc`, `lint`, `build` **PASS**. Uji browser home page: pose dan tanda tanya tampil, animasi berjalan saat terlihat, tanpa scroll horizontal **PASS**. Error konsol yang muncul berasal dari panggilan API ke backend lokal (dev server di port 5174 tidak ada di daftar CORS backend), bukan dari maskot.

## 2026-11-15 — Mood Tracker dipisah menjadi halaman pembuka dan halaman formulir, ekspresi maskot per mood

- Permintaan pengguna: tombol "Ayo cek mood kamu sekarang" membuka halaman lain berisi formulir; setelah "Cek Mood" halaman bergulir ke paling atas dan hasil tampil di atas formulir; latar seperti halaman login/register; setiap mood punya ekspresi maskot sendiri.
- **Route baru** `fe/src/app/router.tsx`: `/mood-tracker/cek` → `MoodCheckPage` (di dalam `PublicLayout`), atas permintaan eksplisit pengguna.
- `MoodTrackerPage.tsx` kini hanya bagian pembuka; tombol ajakan menavigasi ke `/mood-tracker/cek` (ikon panah kanan). Komponen `MascotResult` lama yang memakai `maskot.png` dihapus dari halaman ini.
- `MoodCheckPage.tsx` (baru): latar `bg-bg` + `AuthBackground` seperti halaman login, tautan "Kembali", judul "Cek mood kamu sekarang", progres sticky, 8 pertanyaan (logika dan tampilan dipindah apa adanya), tombol "Cek Mood Saya" yang menampilkan hasil lalu `window.scrollTo({ top: 0, behavior: "smooth" })`; kartu hasil (`aria-live="polite"`) di atas formulir dengan maskot berekspresi dan tombol "Ulangi tes".
- `AnimatedMascot.tsx` ditata ulang berbasis konfigurasi pose (`POSES`: lengan kiri/kanan, mata, alis, mulut, efek) dan mendapat lima pose mood (`ceria`, `tenang`, `tegang`, `lelah`, `seimbang`) selain `wave` dan `thinking`, masing-masing dengan gerak khas (lompat dan kilauan, napas dalam, gemetar dan keringat menetes, sayap terkulai/menguap/"Z" melayang, jungkitan seimbang dengan lengan mengimbangi). Tangan santai memakai lipatan jempol agar tidak terlihat seperti wajah.
- `fe: tsc`, `lint`, `build` **PASS**. Uji browser desktop + mobile: navigasi ke `/mood-tracker/cek`, kelima mood menampilkan ekspresi yang sesuai, hasil di atas formulir dengan `scrollY = 0`, "Ulangi tes" mengosongkan jawaban, tanpa scroll horizontal dan tanpa error React **PASS**. Kelas CSS `mascot-happy` kini tidak dipakai (dibiarkan).

## 2026-11-15 — Logo Lasallian DNA di beranda dikelola admin

- Permintaan pengguna: logo HIMPSI di beranda diganti logo Lasallian DNA yang berubah setiap tahun dan dikelola admin. Keputusan pengguna: admin hanya dapat mengganti (tidak menghapus), logo tahun sebelumnya tidak disimpan, format hanya PNG dan WebP.
- **Migrasi** `20261115150000_sicare_homepage_logo.sql`: tabel satu baris `homepage_logo` (id = 1, `storage_path` berpola `homepage-logo/*.png|webp`, `alt_text` 1–120, `updated_by`), trigger `set_updated_at`, RLS aktif dan hanya `service_role`; bucket publik `site-assets` (PNG/WebP, maks. 1 MB). **Belum diterapkan.**
- **Backend:** `services/homepageLogo.service.js` — `parseLogoDataUrl` (data URL PNG/WebP, verifikasi magic bytes, maks. 1 MB), `getLogo`, `updateLogo` (unggah file baru dengan nama unik, upsert baris, hapus file lama setelah tersimpan; bila simpan gagal, file baru dihapus; keterangan dapat diubah tanpa gambar; gambar wajib bila belum ada logo). Route `GET`/`PUT /admin/homepage-logo` (admin, tanpa DELETE) dan `GET /public/homepage-logo`. Audit `admin.homepage_logo.update` (metadata hanya `field`).
- **Frontend:** `components/admin/settings/HomepageLogoPanel.tsx` di `AdminPengaturanPage` (pratinjau di samping logo kampus dengan ukuran beranda, pilih file PNG/WebP dengan validasi tipe dan ukuran, keterangan wajib, simpan; tanpa tombol hapus). `HomePage.tsx`: komponen `LasallianLogo` memuat logo dari `GET /public/homepage-logo` dan memakai kelas ukuran yang sama dengan logo sebelumnya (`h-14 md:h-16`, lebar mengikuti proporsi, maks. 220px); fallback ke `/himsi.png` bila belum ada logo atau gagal dimuat. Helper `adminApi.getHomepageLogo/updateHomepageLogo`, `getPublicHomepageLogo`, tipe `HomepageLogoDto`.
- `be: check`, `typecheck` **PASS**, `npm test` **305/306** (gagal: `heroMotivations.test.js`, baseline; 11 tes baru `homepageLogo.test.js`). `fe: tsc`, `lint`, `build` **PASS**. Uji browser beranda: fallback logo HIMPSI tampil dengan tinggi sama dengan logo kampus (56px) **PASS**. Panel admin dan unggah nyata: **NOT RUN** (butuh login admin, migrasi, dan bucket).


## 2026-11-15 — Ukuran logo kampus dan Lasallian DNA di beranda diperbesar

- **Permintaan pengguna:** "perbesar sedikit logo de la salle dan lasallian DNA di home page".
- **Perubahan:** `HomePage.tsx` (logo kampus dan `LasallianLogo`) serta pratinjau di `HomepageLogoPanel.tsx`: `h-14 md:h-16` → `h-16 md:h-20` (56/64px → 64/80px), batas lebar logo Lasallian 220px → 260px. Spesifikasi §13 diperbarui.
- **Verifikasi:** `fe: tsc`, `eslint` file terkait **PASS**. Browser (viewport kecil): kedua logo 64px, tinggi sama **PASS**. Ukuran `md` (80px) mengikuti kelas Tailwind, tidak diukur terpisah.

## 2026-11-16 — Penjaga alur konseling (audit alur, prioritas tinggi)

- **Permintaan pengguna:** setelah audit alur konseling dari awal hingga akhir, pengguna menyetujui perbaikan empat temuan prioritas tinggi ("Ya, perbaiki") dengan usulan bawaan.
- **Migrasi `20261116120000_sicare_counseling_flow_guards.sql`:**
  1. `sicare_auto_complete_sessions(p_grace_minutes default 120)`: sesi `ongoing` yang lewat jam selesai + 2 jam menjadi `completed` (`completed_at` = jam selesai terjadwal, kolom baru `auto_completed_at`), notifikasi `session.completed` ke klien dan `session.auto_completed` ke konselor.
  2. `sicare_mark_expired_bookings()` kini juga menangani `reschedule_requested` yang jam aslinya lewat; kolom baru `expired_reason` (`not_confirmed`/`reschedule_not_selected`, data lama diisi `not_confirmed`); undangan consent booking itu dicabut.
  3. `sicare_transition_session` menolak `scheduled → ongoing` di luar jendela 15 menit sebelum jam mulai sampai jam selesai (`SESSION_START_TOO_EARLY`, `SESSION_START_WINDOW_PASSED`).
  4. Trigger `bookings_guard_closed_session` menolak `confirmed → cancelled/reschedule_requested` bila sesinya `ongoing`/`completed`/`missed` (`BOOKING_SESSION_CLOSED`).
- **Backend:** `missedSession.service.js` (`autoCompleteSessions`, `AUTO_COMPLETE_GRACE_MINUTES = 120`, ikut dijalankan di jalur baca); scheduler mengembalikan `autoCompletedSessions`; `domainRpc.js` memetakan tiga kode baru ke 409; repository sesi dan booking membaca kolom baru dengan fallback bertingkat bila migrasi belum diterapkan.
- **Frontend:** `lib/sessionStatus.ts` (`expiredReasonText`, `AUTO_COMPLETED_NOTE`, `sessionStartTimeBlockReason`); Aktivitas Konselor menonaktifkan "Mulai Sesi" di luar jendela waktu (jam berjalan tiap 30 detik) dan menampilkan keterangan "Ditutup otomatis"; Aktivitas Klien menampilkan alasan kedaluwarsa sesuai `expired_reason`; tipe DTO diperbarui.
- **Pemeriksaan:** `be: npm test` **311/312** (gagal: `heroMotivations.test.js`, baseline), 6 tes baru `counselingFlowGuards.test.js`, tiga tes lama disesuaikan; `be: check`, `typecheck` **PASS**. `fe: tsc`, `lint`, `build` **PASS**. Fungsi `sessionStartTimeBlockReason` dicek dengan Node pada empat titik waktu **PASS**. Uji browser halaman konselor/klien dan uji fungsi SQL di database: **NOT RUN** (migrasi belum diterapkan, butuh login).
- **Risiko:** booking yang diminta jadwal ulang menjelang jadwal hanya memberi waktu klien sampai jam mulai asli; menguji "Mulai Sesi" kini harus dalam jendela waktu sesi. Temuan menengah dan minor dari audit belum dikerjakan.

## 2026-11-17 — Perbaikan kesiapan klien (audit 2026-11-16)

- **Permintaan pengguna:** setelah audit kesiapan, perbaiki bug baru kecuali temuan A ("masalah A jangan dikerjakan dulu"). Temuan A (rate limit login/register tingkat aplikasi; `be/src/middleware/rateLimiter.js` tidak terpakai dan `express-rate-limit` tidak terpasang) dibiarkan apa adanya. Temuan E (secret webhook Fonnte) adalah konfigurasi environment, tidak diubah di kode.
- **Login (temuan 4):** `classifySignInError` di `auth.service.js`; batas percobaan Supabase menjadi `429 RATE_LIMITED`, gangguan auth/jaringan menjadi `503 AUTH_UNAVAILABLE` (frontend sudah menampilkan 503 sebagai gangguan koneksi dan 429 sebagai pesan umum). Kata sandi salah tetap `401 INVALID_CREDENTIALS` dengan pesan identik.
- **Paginasi (temuan B):** `GET /bookings` dan `GET /sessions` menerima `offset`; repository memakai `.range()` dengan urutan stabil (`id` sebagai pemutus). Daftar sesi kini difilter langsung di database (konselor: `counselor_id`; klien: join `bookings!inner(client_id)`), menggantikan daftar `booking_id` di URL yang akan gagal untuk pengguna dengan ratusan booking. Frontend: `sicareApi.allBookings()`/`allSessions()` mengambil semua halaman (100 per halaman, maksimal 50 halaman, duplikat dibuang); 13 pemanggilan `bookings(100)`/`sessions(100)` di 7 halaman diganti.
- **Riwayat Konselor (temuan C):** filter semester memuat periode terbit dari `GET /public/periods`; daftar bawaan hanya fallback bila API gagal/kosong. Semester terpilih disesuaikan bila ID-nya tidak ada di daftar baru.
- **Formulir intake (temuan D):** `POST /bookings` mengembalikan `intake_saved` bila jawaban dikirim. Halaman sukses booking sebelumnya **selalu** menyatakan jawaban formulir tidak dikirim (teks lama sebelum 2026-11-13); kini peringatan hanya muncul saat `intake_saved === false`.
- **Pemeriksaan:** `be: npm test` **317/318** (gagal: `heroMotivations.test.js`, baseline); 6 tes baru `readinessFixes.test.js`; fake query di `counselingFlowGuards`, `missedSession`, dan `ownershipGuards` disesuaikan dengan `.range()` dan filter join. `be: check`, `typecheck` **PASS**. `fe: tsc`, `lint`, `build` **PASS**. Uji browser dan uji query join PostgREST terhadap database nyata: **NOT RUN** (butuh login dan deploy).
- **Risiko:** filter join `bookings!inner` untuk klien belum diuji ke PostgREST nyata; Riwayat Konselor tidak menampilkan periode yang tidak diterbitkan admin.

## 2026-11-17 — Consent kelompok dan jadwal terpotong (audit kedua, temuan 1–3)

- **Permintaan pengguna:** "Ya, perbaiki 1–3" dari audit kedua.
- **Temuan 1 (consent kelompok):** tautan consent anggota hanya dikirim lewat outbox WhatsApp, yang belum aktif, sehingga sesi kelompok tidak pernah bisa dimulai. `resendConsentInvitation` kini memeriksa booking `confirmed` dan jadwal belum berakhir, lalu mengembalikan `invitation_link` (format sama dengan worker), `expires_at`, `whatsapp_queued` hanya kepada pihak booking yang sudah diotorisasi (perwakilan, konselor, admin); tautan tidak masuk audit/log. Masa berlaku undangan (awal dan ulang) = sampai jam selesai booking, minimal 72 jam (`invitationHoursUntil`). `GroupConsentModal` mengganti tombol "Kirim Ulang WA" menjadi "Buat Tautan Undangan" dengan tombol salin dan "Bagikan lewat WhatsApp" (`wa.me/?text=`, dari WhatsApp pengguna sendiri); tautan hanya di state memori. Aktivitas Klien menambahkan tombol "Consent anggota kelompok" pada sesi kelompok `scheduled` untuk perwakilan.
- **Temuan 2 (kalender klien):** `getAllPublicAvailability()` di `publicApi.ts` mengambil halaman berikutnya mulai dari `starts_at` slot terakhir (maks. 30 halaman). Dipakai `KlienPesananPage`, `KlienKonselorPage`, `KlienAktivitasPage` (jadwal ulang), dan `CounselorPage`. Kontrak backend tidak berubah.
- **Temuan 3 (jadwal konselor):** `GET /counselor/availability` menerima `limit` (≤200) dan `offset` dengan urutan stabil; `counselorApi.getAvailability()` mengambil semua halaman (maks. 25 halaman).
- **Pemeriksaan:** `be: npm test` **321/322** (gagal: `heroMotivations.test.js`, baseline); 4 tes baru di `readinessFixes.test.js`. `be: check`, `typecheck` **PASS**. `fe: tsc`, `lint`, `build` **PASS**. Uji browser **BLOCKED**: port 3000/5173 dipakai proses lain dan server di port 3000 menolak origin preview 5174 (CORS); halaman klien/konselor juga butuh login.
- **Risiko:** perwakilan kini memegang tautan pribadi anggota dan secara teknis dapat membukanya sendiri; tanda tangan tetap meminta data identitas anggota. Membuat tautan baru mencabut tautan lama anggota tersebut. Undangan awal saat konfirmasi tetap hanya dibuat untuk anggota yang punya nomor telepon; anggota tanpa nomor memperoleh tautan lewat "Buat Tautan Undangan".

## 2026-11-17 — Webhook Fonnte gagal-tertutup di production (temuan E)

- **Permintaan pengguna:** kerjakan daftar "harus beres sebelum dibuka untuk klien" kecuali temuan A.
- **Perubahan:** `verifyWebhookSecret` (`be/src/routes/webhook.routes.js`) kini menolak callback status bila `FONNTE_WEBHOOK_SECRET` kosong dan `NODE_ENV=production` (sebelumnya selalu menerima). Lingkungan development/test tetap menerima tanpa secret.
- **Tindakan pengguna:** isi `FONNTE_WEBHOOK_SECRET` di environment Vercel backend dan pasang URL webhook Fonnte `.../api/v1/webhooks/fonnte/message-status?secret=<nilai>`; tanpa itu status pengiriman WhatsApp tidak diperbarui di production.
- **Pemeriksaan:** `be: npm test` **322/323** (gagal: `heroMotivations.test.js`, baseline); 1 tes baru di `readinessFixes.test.js`.

## 2026-11-17 — Jadwal ulang dan waktu tanda tangan consent klien (audit alur sesi)

- **Permintaan pengguna:** "Ya, perbaiki" untuk tiga temuan audit alur sesi individu/kelompok.
- **Temuan tambahan saat memperbaiki:** setelah konselor meminta jadwal ulang, server membatalkan baris sesi; `KlienAktivitasPage` menandai booking itu "sudah diproses" sebelum melewati sesi batal, sehingga booking `reschedule_requested` (dan `waiting_confirmation` hasil jadwal ulang) hilang dari Aktivitas Klien. Kini hanya sesi aktif yang menandai booking.
- **Jadwal ulang (temuan 1 & 2):** kartu booking `reschedule_requested` menampilkan alasan konselor dan tombol "Pilih jadwal pengganti" sampai jam semula; halaman pemilihan hanya menawarkan slot server milik konselor yang sama berdasarkan `counselor_id` (bukan nama), tanpa jadwal contoh `COUNSELOR_WEEK` (yang memuat nama konselor nyata); permintaan selalu dikirim ke server dan sukses hanya ditampilkan setelah server mengonfirmasi. Pilihan alasan dan catatan klien yang tidak pernah tersimpan di server dihapus. Tombol "Ubah jadwal" untuk booking terkonfirmasi dihapus (server hanya menerima pilihan klien setelah konselor meminta) dan diganti keterangan untuk menghubungi konselor. Penanda jadwal ulang tidak lagi memakai `reschedule_reason` lama setelah booking dikonfirmasi ulang.
- **Consent (temuan 3):** kartu sesi mendatang berstatus `scheduled` menampilkan tombol "Tanda tangan consent" bila belum ditandatangani, sehingga konselor dapat memulai sesi dalam jendela 15 menit sebelum jadwal.
- **Pemeriksaan:** `fe: tsc`, `lint`, `build` **PASS**; `be: npm test` **322/323** (gagal: `heroMotivations.test.js`, baseline). Uji browser **NOT RUN** (butuh login klien dan booking uji). Tidak ada perubahan kontrak API atau database.

## 2026-11-17 — Bagian B kesiapan klien (B1–B6)

- **Permintaan pengguna:** "kerjakan bagian B".
- **B1 pembatalan oleh konselor:** `sessionStatusSchema` mewajibkan `reason` untuk `cancelled`; `session.service.js` menyimpan alasan ke `bookings.cancellation_reason` lalu memanggil `applyBookingClosureSideEffects` (baru, `bookingClosure.service.js`): membatalkan pengingat/pesan consent di outbox, mencabut undangan consent, dan mengantrekan WhatsApp `booking_cancelled` ke klien. Dialog batal di Aktivitas dan Jadwal Konselor meminta alasan. Alasan tidak disalin ke audit.
- **B2 akun dinonaktifkan/role berubah:** `accounts.service.js` memanggil `cancelActiveBookingsForProfile` setelah update/nonaktif: booking `waiting_confirmation`/`confirmed`/`reschedule_requested` yang sesinya belum berlangsung dibatalkan (sesi `scheduled` → `cancelled`), pihak lain menerima notifikasi in-app dan WhatsApp; booking dengan sesi berlangsung dibiarkan. Kegagalan pembersihan tidak menggagalkan perubahan akun (`booking_cleanup_failed`).
- **B3 keluarkan anggota kelompok:** endpoint `POST /consents/booking/:bookingId/participants/:participantId/remove` dan tombol "Keluarkan" (dengan konfirmasi) di `GroupConsentModal`. Hanya anggota yang belum tanda tangan dan bukan perwakilan, booking aktif, sesi belum berlangsung, minimal 2 anggota aktif tersisa.
- **B4 lupa kata sandi:** `POST /auth/forgot-password` dan `POST /auth/reset-password` (hanya sesi `amr: recovery` ≤ 1 jam); halaman baru `ResetPasswordPage` di route `/auth/reset-password` (route baru atas permintaan fitur ini) dan tautan "Lupa kata sandi?" di Login. Token pemulihan hanya di memori halaman; sesi lokal dibersihkan setelah berhasil. **Tindakan pengguna:** tambahkan `https://si-care.vercel.app/auth/reset-password` ke Supabase Dashboard → Authentication → URL Configuration → Redirect URLs.
- **B5 penanda krisis:** `lib/intakeRisk.ts`; permintaan menunggu dengan jawaban Ya/Mungkin pada pertanyaan keinginan bunuh diri diberi badge "Perlu perhatian segera" dan selalu di urutan teratas di Permintaan Konselor, serta peringatan di detail formulir (Permintaan dan Aktivitas). Tidak ada prosedur klinis baru; teks merujuk SOP penanganan krisis LMI.
- **B6 notifikasi:** `NotificationBell` menyegarkan halaman pertama tiap 60 detik saat tab terlihat dan panel tertutup, serta saat tab kembali aktif.
- **Temuan sampingan:** `resendConsentInvitation` mencatat audit consent `invitation_resent` yang tidak ada di constraint `consent_audit_logs.event_type`, sehingga insert audit itu gagal diam-diam (tidak memengaruhi respons). Belum diubah.
- **Pemeriksaan:** `be: npm test` **327/328** (gagal: `heroMotivations.test.js`, baseline); 5 tes baru di `readinessFixes.test.js`; allow-list audit menambah `booking.participant.remove`. `be: check`, `typecheck` **PASS**. `fe: tsc`, `lint`, `build` **PASS**. Uji browser dan pengiriman email reset nyata **NOT RUN**.
- **Bug tambahan ditemukan saat uji browser (B4):** `ScrollToTop` memanggil `document.querySelector(location.hash)`; hash tautan Supabase Auth (`#access_token=...`, `#error=...`) bukan selector valid sehingga **seluruh aplikasi menjadi layar kosong** saat membuka tautan email (verifikasi akun maupun reset kata sandi). Kini memakai `getElementById` dalam `try/catch`. Uji browser lokal (`localhost:5173`, backend lokal): halaman lupa kata sandi tampil, validasi kosong, permintaan untuk NIM tak terdaftar menjawab pesan generik (`200`), tautan kedaluwarsa menampilkan pesan yang benar, tautan "Lupa kata sandi?" ada di Login. Alur email reset nyata **NOT RUN**.

## 2026-11-17 — Pembersihan akun dummy di database Supabase

- **Permintaan pengguna:** hapus semua akun konselor dan klien beserta data terkait karena data asli akan mulai diisi; sisakan admin. Pengguna memilih: head_lmi ikut dihapus, semua log audit dikosongkan, data master dipertahankan.
- **Pelaksanaan:** skrip SQL sekali pakai (dijalankan pengguna di Supabase SQL Editor karena trigger `consent_audit_logs_append_only` dan `informed_consents_tampering_guard` perlu dimatikan sementara dalam satu transaksi; DDL tidak bisa lewat REST). Dihapus: 4 akun (1 konselor, 2 klien, 1 head_lmi) dari `auth.users`/`profiles`, profil dan kredensial konselor, 10 slot jadwal, 1 booking beserta peserta/intake/sesi, 1 informed consent (pending), 4 notifikasi, 7 outbox WhatsApp, 103 `audit_events`, 7 `consent_audit_logs`. Setelah itu 3 file avatar akun terhapus dihapus dari bucket `avatars` lewat Storage API. Skrip dihapus setelah dipakai.
- **Dipertahankan:** akun Administrator SiCARE, `academic_periods`, `consent_templates`, `hero_motivations`, `homepage_logo`, logo di bucket `site-assets`.
- **Verifikasi (read-only, service role):** tabel transaksi bernilai 0; yang tersisa hanya admin dan akun konselor asli "Giovanna Yudi" yang dibuat admin pukul 04:03 UTC setelah pembersihan (beserta 10 audit event dan avatarnya); akun ini tidak disentuh.

## 2026-11-17 — NIP wajib saat admin membuat akun

- **Permintaan pengguna:** hapus kata "opsional" pada kolom NIP dan hapus "NIM" karena admin hanya membuat akun staf dan dosen.
- **Perubahan:** label form Akun Admin menjadi "NIP" (tetap "NIM / NIP" saat mengedit akun klien yang sudah ada); form menolak simpan tanpa NIP untuk akun konselor/Kepala LMI. Backend `createAccountSchema` mewajibkan `identity_code` (pesan "NIP wajib diisi."). Fixture tes disesuaikan dan satu asersi baru memastikan pembuatan akun tanpa NIP ditolak.
- **Pemeriksaan:** `be: npm test` **327/328** (gagal: `heroMotivations.test.js`, baseline); `fe: tsc`, `lint` **PASS**. Uji browser halaman admin **NOT RUN** (butuh login admin).

## 2026-11-17 — Perbaikan consent, booking, anggota kelompok, laporan, zona waktu, dan bug kecil

- **Permintaan pengguna:** atasi bug consent, booking, data anggota kelompok, laporan, zona waktu, beserta bug kecil.
- **Migrasi baru `20261117120000_sicare_wita_dates_booking_limits.sql` (belum diterapkan):** redefinisi `sicare_create_booking`, `sicare_public_availability`, `sicare_save_availability_slot`, `sicare_reschedule_booking` (tanggal periode dalam WITA; batas 2 booking aktif dan larangan bentrok per klien) serta `sicare_check_booking_consent_readiness` (consent bertanda tangan sah walau template aktif berganti). Isi fungsi lain disalin dari definisi terakhir.
- **Consent:** `assertBookingAcceptsConsent` menolak tanda tangan untuk booking `cancelled`/`rejected`/`expired` atau sesi `completed`/`cancelled`/`missed`; tamu wajib memakai nomor WA yang didaftarkan perwakilan (`CONSENT_PHONE_MISMATCH`); audit kirim ulang undangan memakai `invitation_created` + `resent: true` (sebelumnya gagal karena constraint).
- **Booking:** batas waktu pembatalan klien 2 jam untuk booking terkonfirmasi (`BOOKING_CANCEL_CUTOFF_PASSED`) dan tombol "Batalkan booking" berikut dialog alasan di Aktivitas Klien (sebelumnya klien tidak punya UI pembatalan).
- **Anggota kelompok:** `participantSchema` menormalisasi nomor ke +62 dan memvalidasinya; anggota selain perwakilan wajib bernomor; nama/nomor ganda ditolak; halaman booking memeriksa duplikat lebih awal.
- **Laporan:** `reporting.service.js` mengambil semua baris per 1000 (batas 20.000, lalu `truncated`), bulan dan awal periode dihitung dalam WITA, konselor nonaktif/berganti role yang punya data tetap tampil (`is_active`).
- **Zona waktu:** 55 pemanggilan `toLocale*String`/`Intl.DateTimeFormat` diberi `timeZone: "Asia/Makassar"`, lalu 13 di antaranya dikembalikan karena memformat tanggal kalender yang dibangun lokal (label bulan, rentang periode, kalender) agar tidak bergeser di perangkat zona timur; helper jam berbasis `getHours()` untuk tampilan diganti `formatWitaTime` (`lib/witaTime.ts`). Logika kalender konselor/klien yang menghitung menit lokal tidak diubah.
- **Bug kecil:** konselor yang diaktifkan kembali dari `disabled` tidak otomatis dipublikasikan (toast admin menjelaskan); `todayKey` Aktivitas Konselor mengikuti jam berjalan; `worker-run` (cron tiap menit) menjalankan penanda otomatis; toast admin menampilkan jumlah booking yang dibatalkan otomatis saat menonaktifkan akun.
- **Pemeriksaan:** `be: npm test` **334/335** (gagal: `heroMotivations.test.js`, baseline); 7 tes baru; mock tes consent, worker-run, dan nama berkas migrasi reschedule disesuaikan. `be: check`, `typecheck` **PASS**. `fe: tsc`, `lint`, `build` **PASS**. Browser lokal: halaman Profil Konselor publik tampil tanpa error konsol, semua API publik `200`. Migrasi SQL **belum dijalankan** di database mana pun (sintaks hanya diperiksa lewat tes statis).

## 2026-11-17 — Performa halaman (wilayah server, code splitting, jalur baca)

- **Permintaan pengguna:** halaman terasa lambat; apakah bisa dipercepat atau karena batasan JavaScript/Vercel gratis.
- **Pengukuran production:** header `X-Vercel-Id: sin1::iad1` menunjukkan fungsi backend berjalan di **iad1 (Washington, AS)**, sedangkan Supabase berada di **ap-southeast-1 (Singapura)**. `GET /health` (tanpa database) ±0,5 dtk; `/public/periods` (1 query) ±1,3 dtk; `/public/counselors` ±2,1 dtk; `/public/availability` ±3,0 dtk. Setiap query menyeberang AS–Singapura; endpoint terautentikasi melakukan 3 panggilan auth/profil ditambah 3 RPC penanda status sebelum query utama.
- **Perubahan:**
  1. `be/vercel.json` baru dengan `"regions": ["sin1"]` agar fungsi backend berjalan di Singapura, dekat Supabase. **Tindakan pengguna:** pastikan Vercel backend → Settings → Functions → Function Region = Singapore (sin1), lalu redeploy.
  2. Frontend: 34 halaman dimuat lazy (`React.lazy` + `Suspense` per rute; path rute tidak berubah). JS awal turun dari **1,52 MB** menjadi **±540 KB** (+215 KB klien Supabase).
  3. `GET /bookings`, `GET /sessions`, dan riwayat konselor tidak lagi menunggu 3 RPC penanda status; penanda dijalankan cron `worker-run` tiap menit (laporan dan dashboard tetap menjalankannya). Di lingkungan lokal tanpa cron, status otomatis hanya diperbarui saat laporan dibuka atau cron dipanggil manual.
- **Pemeriksaan:** `be: npm test` **334/335** (gagal: `heroMotivations.test.js`, baseline), `typecheck` **PASS**; `fe: tsc`, `lint`, `build` **PASS**; browser lokal: halaman lazy (Tentang Kami, Lupa kata sandi) tampil tanpa error konsol. Efek wilayah `sin1` belum terukur (perlu deploy).

## 2026-11-18 — Skrip reset data transaksi dan seed dummy periode berjalan

- **Permintaan pengguna:** query untuk membersihkan data Supabase tanpa menghapus akun, dan query data dummy untuk periode akademik berjalan (tanpa membuat akun admin, Kepala LMI, dan konselor).
- **File baru:** `be/scripts/reset-transactional-data.sql` (TRUNCATE tabel transaksi tanpa `cascade`; akun, `consent_templates`, `academic_periods`, `hero_motivations`, `homepage_logo` dipertahankan; file Storage consent tidak ikut terhapus) dan `be/scripts/seed-dummy-current-period.sql` (memakai konselor aktif/publik yang sudah ada; membuat/memakai ulang 12 akun klien `@sicare-dummy.test`; slot, booking individu/kelompok berbagai status, intake, sesi, consent tanpa file PDF, catatan sesi `[DUMMY]`, feedback, notifikasi; tanpa `whatsapp_outbox`).
- **Pemeriksaan:** **NOT RUN** di database mana pun (Docker/Postgres lokal tidak tersedia); hanya ditinjau manual terhadap constraint dan trigger di `supabase/migrations/`. Jalankan hanya di project non-produksi.

## 2026-11-18 — Diagnosis registrasi 400 dan verifikasi wilayah backend

- **Laporan pengguna:** konsol browser menampilkan `POST /auth/register` 400 berulang dan `POST /auth/login` 401.
- **Temuan:** semua galat `signUp` Supabase (gagal kirim email SMTP, batas email, kebijakan kata sandi, email ditolak) dipetakan ke satu `400 REGISTER_FAILED` tanpa log, sehingga penyebab asli tidak terlihat. Login 401 konsisten dengan akun yang belum pernah berhasil dibuat.
- **Perubahan:** `signUpErrorToHttp` di `auth.service.js` memetakan penyebab spesifik (`429 RATE_LIMITED`, `503 EMAIL_SEND_FAILED`, `400 PASSWORD_REJECTED`, `400 EMAIL_REJECTED`, `409 ACCOUNT_EXISTS`, `503 SIGNUP_DISABLED`) dan mencatat status/kode galat Supabase ke log server (tanpa email). Tes baru di `readinessFixes.test.js`.
- **Verifikasi production:** header kini `X-Vercel-Id: sin1::sin1` (fungsi backend di Singapura); `GET /public/periods` turun dari ±1,3 dtk menjadi ±0,3–0,5 dtk.
- **Pemeriksaan:** `be: npm test` **335/336** (gagal: `heroMotivations.test.js`, baseline), `typecheck` **PASS**.

## 2026-11-18 — Status "Aktif" untuk akun yang belum verifikasi email

- **Laporan pengguna:** akun klien yang baru mendaftar dan belum mengklik tautan verifikasi sudah tampil "Aktif" di halaman Akun Admin.
- **Penyebab:** `profiles.account_status` default `active` (migrasi inti) dan hanya menandai akun tidak dinonaktifkan admin; status verifikasi email disimpan terpisah di Supabase Auth (`email_confirmed_at`). Login tetap menolak akun yang belum verifikasi (`403 EMAIL_NOT_CONFIRMED`), jadi tidak ada celah akses; yang keliru hanya tampilan admin.
- **Perubahan:** `GET /admin/accounts` menambahkan `email_verified` (dari Supabase Auth; `null` bila tidak terbaca) dan kini mengambil data Auth secara paralel per 10 akun (sebelumnya satu per satu). Tabel Akun Admin menampilkan keterangan "Email belum diverifikasi" di bawah status.
- **Pemeriksaan:** `be: npm test` **335/336** (gagal: `heroMotivations.test.js`, baseline), `typecheck` **PASS**; `fe: tsc`, `lint` **PASS**. Uji browser halaman admin **NOT RUN**.

## 2026-11-18 — Emoji pesan WhatsApp, tanda tangan laporan, dan catatan anggota kelompok

- **Permintaan pengguna:** pesan WhatsApp memakai emoji agar tidak terlihat seperti teks penuh; tanda tangan laporan hanya Kepala LMI dan nama/tautan website tidak ikut tercetak; form konseling kelompok memberi tahu bahwa nama pemilik akun tidak perlu ditulis.
- **Perubahan:**
  - `be/src/templates/whatsapp/index.js`: semua 11 template memakai judul *tebal* WhatsApp dan emoji per baris (🔖 nomor booking, 👤, 📅, ⏰, 💻/🏫 format, 📍 ruangan/🔗 tautan, 📝 alasan, 🔒 kerahasiaan). Isi dan data yang dikirim tidak berubah; tidak ada data sensitif yang ditambahkan. Template dirender saat worker mengirim, jadi outbox yang masih `pending` ikut memakai format baru.
  - `fe/src/components/reports/CounselingReportPrint.tsx`: blok tanda tangan kini hanya "Mengetahui, Kepala LMI". Laporan admin menyisakan garis nama kosong (blok "Disusun oleh, Admin LMI" dihapus); laporan Kepala LMI menampilkan nama dan NIP penanda tangan.
  - `fe/src/index.css`: margin box `@top-left/@top-center/@bottom-left/@bottom-center` pada `@page sicare-report` dan `sicare-session` dikosongkan, dan footer halaman sampul `content: ""` (sebelumnya `none`), agar header/footer bawaan browser (judul tab dan URL website) tidak tercetak. Kelas `.rp-sign-two` yang tidak dipakai dihapus.
  - `fe/src/pages/client/KlienPesananPage.tsx`: kotak informasi di atas daftar anggota kelompok: "Tidak perlu menuliskan nama kamu sendiri", beserta jumlah anggota yang perlu ditulis (jumlah peserta - 1).
- **Pemeriksaan:** `be: npm test` **335/336** (gagal: `heroMotivations.test.js`, baseline, file tidak diubah); tes WhatsApp **47/47 PASS**; `fe: tsc -b`, `lint`, `build` **PASS**. Cetak laporan di browser dan tampilan form kelompok **NOT RUN**. Penyembunyian header/footer browser lewat margin box bergantung pada dukungan browser (Chrome 131+); bila URL masih tercetak, matikan opsi "Header dan footer" di dialog cetak.

## 2026-11-18 — Judul halaman admin

- `AdminKonselingPage.tsx`: judul "Monitoring Konseling" menjadi "Pemantauan Konseling".
- `AdminBerandaPage.tsx`: judul "Dashboard Monitoring Konseling" menjadi "Beranda Admin".
- **Pemeriksaan:** `fe: tsc -b` **PASS**. Uji browser **NOT RUN**.

## 2026-11-19 — Tata letak Pengaturan dan marquee feedback beranda

- **Pengaturan Klien, Konselor, Kepala LMI:** kartu section kini ditumpuk satu kolom penuh (`flex flex-col gap-4 sm:gap-5 lg:gap-6`) seperti Pengaturan Admin; sebelumnya grid 2 kolom. Isi, urutan, dan perilaku kartu tidak berubah. Skeleton loading mengikuti tata letak yang sama.
- **Marquee feedback beranda (`HomePage.tsx`):**
  - Animasi tidak pernah berjalan karena efeknya hanya dipasang sekali saat halaman dimuat, sebelum feedback dari API tiba (elemen marquee belum ada). Efek kini bergantung pada `testimonials.length`.
  - Kartu bergerak dari kiri ke kanan.
  - Bila feedback sedikit, kartu diulang dalam satu set agar loop tidak kosong.
  - Marquee dapat digulir manual (swipe di mobile) tanpa ujung karena posisinya dikembalikan ke set lain saat mencapai tepi.
  - `touch-pan-x` dihapus agar halaman tetap bisa digulir vertikal saat jari berada di atas marquee.
- **Pemeriksaan:** `fe: tsc -b`, `lint`, `build` **PASS**. Browser lokal dengan feedback tiruan (fetch di-mock di tab uji, karena data feedback produksi kosong):
  - `scrollLeft` berkurang dari waktu ke waktu, artinya kartu bergerak ke kanan.
  - Di mobile 375px, area marquee dapat digulir (`overflow-x: auto`, `touch-action: auto`) tanpa overflow halaman.
  - Wrap di tepi kiri dan kanan bekerja.
  - Swipe sentuh asli dan tampilan halaman Pengaturan (butuh login) **NOT RUN**.

## 2026-11-19 — Kartu Pengaturan dapat dilipat (akordeon)

- **Klarifikasi pengguna:** yang diminta bukan sekadar satu kolom, tetapi kartu section yang default-nya tertutup. Kartu tertutup hanya menampilkan ikon, judul, subjudul, dan panah ke bawah di kanan; klik membuka isinya seperti FAQ di halaman Panduan.
- **Perubahan:**
  - `components/shared/SettingsPrimitives.tsx`: `SettingsPanel` dapat dilipat.
    - Default tertutup.
    - Seluruh header dan tombol panah dapat diklik (`aria-expanded`, `aria-controls`); panah berputar 180° saat terbuka.
    - Isi dianimasikan dengan `grid-rows` seperti FAQ. Isi tetap ter-mount dan `inert` saat tertutup sehingga isian form tidak hilang.
    - Tombol `action` (mis. "Tambah" kalimat motivasi) hanya tampil saat panel terbuka.
    - Prop baru `defaultOpen` dan `forceOpen`. `forceOpen` membuka panel otomatis saat simpan gagal validasi, supaya pesan error tidak tersembunyi.
  - `components/counselor/settings/SettingsPrimitives.tsx` kini me-reexport panel/field bersama.
  - `KlienPengaturanPage.tsx` memakai panel bersama (panel lokal dihapus).
  - `forceOpen` dipasang pada panel yang berisi field tervalidasi:
    - Admin: Informasi Akun, Kalimat Motivasi;
    - Klien: Kontak;
    - Konselor: Profil Publik;
    - Kepala LMI: Informasi Akun.
  - Berlaku di keempat halaman Pengaturan, termasuk panel Logo Lasallian DNA.
- **Pemeriksaan:** `fe: tsc -b`, `lint`, `build` **PASS**. Komponen dirender langsung di dev server: default tertutup; klik membuka isi, memutar panah, dan memunculkan tombol aksi. Halaman Pengaturan asli per role (butuh login) **NOT RUN**.

## 2026-11-19 — Hapus panel Status Sinkronisasi; diagnosis tautan verifikasi email

- `AdminPengaturanPage.tsx`: panel "Status Sinkronisasi" dihapus. `fe: tsc -b`, `lint` **PASS**.
- **Laporan pengguna:** tautan verifikasi email klien mengarah ke `https://si-care-markod1rs-projects.vercel.app/#access_token=...&type=signup`, deployment preview lama yang sudah dihapus Vercel (410 GONE).
- **Diagnosis:**
  - Backend mengirim `emailRedirectTo = <origin frontend>/auth/confirmed` (`getTrustedConfirmationCallbackUrl`).
  - URL yang diterima tidak memuat `/auth/confirmed`. Artinya Supabase menolak `emailRedirectTo` karena tidak ada di daftar Redirect URLs, lalu memakai **Site URL** proyek Supabase, yang masih menunjuk deployment preview lama.
- **Perbaikan (konfigurasi, oleh pengguna):** Supabase Dashboard → Authentication → URL Configuration:
  - Site URL `https://si-care.vercel.app`;
  - Redirect URLs `https://si-care.vercel.app/auth/confirmed` dan `https://si-care.vercel.app/auth/reset-password`.
  - Periksa juga `APP_BASE_URL` dan `FRONTEND_ORIGINS` di environment Vercel backend.
- Tidak ada perubahan kode backend.

## 2026-11-19 — Skeleton booking, foto konselor langkah 3, ikon sapaan SiCARE

- **Skeleton Booking Jadwal Konseling:**
  - Komponen baru `components/client/booking/BookingPageSkeleton.tsx` mengikuti bentuk langkah yang akan tampil: stepper, judul, lalu isi langkah.
    - Langkah 1: dua kartu layanan dan kotak privasi.
    - Langkah 2: kotak pencarian dan grid kartu konselor.
    - Langkah 3: profil konselor, kalender 7 kolom, dan slot jam.
  - `KlienPesananPage.tsx` menampilkannya selama direktori konselor dan jadwal dimuat. Sebelumnya tampil tiga kartu generik di atas stepper, sementara isi langkah ikut tampil.
- **Foto konselor di langkah 3 (Pilih Jadwal):** sebelumnya hanya inisial. Sekarang memakai `photoUrl` yang sama dengan langkah 2, dan kembali ke inisial bila foto tidak ada atau gagal dimuat.
- **Ikon sapaan:** komponen baru `components/shared/WaveHandIcon.tsx`, SVG sarung tangan putih bergaya maskot dengan garis hijau brand, manset emas, dan garis gerak. Ikon ini menggantikan emoji 👋 di Beranda Klien dan Beranda Konselor. Animasi lambaian memakai `.wave-hand` dan nonaktif untuk `prefers-reduced-motion`.
- **`Skeleton`:** kelas `rounded-*` dari pemanggil kini menggantikan `rounded-md` bawaan. Sebelumnya avatar `rounded-full` tampil kotak di semua skeleton.
- **Pemeriksaan:** `fe: tsc -b`, `lint`, `build` **PASS**. Ikon dan skeleton dirender di dev server dan diperiksa lewat screenshot. Halaman booking asli dengan foto konselor (butuh login klien) **NOT RUN**.

## 2026-11-19 — Ikon sapaan gaya logo, hamburger, gunung navbar, layar lebar

- **`WaveHandIcon.tsx` didesain ulang mengikuti gaya logo SiCARE:**
  - bentuk flat tanpa garis tepi;
  - tangan navy (warna lambang Ψ);
  - manset heliks emas-hijau dengan latar ungu (motif DNA);
  - bintang emas berinti hijau;
  - lengkung gerak emas/hijau.
  - Hanya tangan yang melambai (kelas `.wave-hand-svg`, `transform-box: fill-box`); animasi nonaktif untuk `prefers-reduced-motion`.
- **Navbar publik:**
  - Hamburger kini tiga garis hijau primary tanpa latar (hover tipis `bg-primary/10`).
  - SVG gunung digeser `-right-1` agar melewati tepi kanan bar dan terpotong oleh `overflow-hidden`. Sebelumnya path berakhir di x=169.2 dari 170, sehingga tersisa garis putih.
- **Layar lebar (27", 2560px):**
  - Halaman publik menaikkan skala `rem` menjadi 112.5% (≥1920px) dan 125% (≥2400px) lewat `html:has(.public-layout)` (kelas baru di `PublicLayout`). Teks, jarak, dan kartu tetap proporsional. Halaman dashboard tidak terpengaruh.
  - Tinggi hero beranda di desktop kini `max(30rem, 56vh)`, sebelumnya tetap 480px sehingga foto ter-crop menjadi pita tipis.
- **Pemeriksaan:** `fe: tsc -b`, `lint`, `build` **PASS**. Diperiksa di browser lokal:
  - 2560×1440: foto hero utuh dan SVG gunung melewati tepi kanan 5px tanpa celah;
  - 1600×900: tampilan setara sebelumnya;
  - 375px: hamburger tiga garis hijau;
  - ikon sapaan dirender pada ukuran judul dan ukuran besar.

## 2026-11-19 — Latar halaman klien dan maskot sapaan

- **`KlienLayout.tsx`:** semua halaman klien memakai latar halaman login: warna `bg-bg` dan `AuthBackground` (cahaya lembut, simbol Ψ, garis detak jantung, ikon konseling). Latar dipasang `fixed` di belakang konten (`-z-10`, `pointer-events-none`), jadi tetap di tempat saat halaman digulir. Sebelumnya latarnya `bg-gray-50`.
- **Sapaan beranda:** komponen baru `components/mood/MascotGreeting.tsx` menampilkan maskot SiCARE pose `wave` dari `AnimatedMascot` dengan ukuran mengikuti font judul. Dipakai di Beranda Klien dan Beranda Konselor, menggantikan ikon tangan SVG. Maskot diam untuk `prefers-reduced-motion`.
- `components/shared/WaveHandIcon.tsx` serta CSS `.wave-hand`, `.wave-hand-svg`, dan `@keyframes wave-hand` dihapus karena tidak dipakai lagi.
- **Pemeriksaan:** `fe: tsc -b`, `lint`, `build` **PASS**. Latar dan maskot dirender di dev server dan diperiksa lewat screenshot. Halaman klien asli (butuh login) **NOT RUN**.

## 2026-11-19 — Navbar klien, latar lebih terang, sapaan mengetik, ikon tombol Masuk

- **Navbar klien (`KlienLayout.tsx`):**
  - Logo dan teks SiCARE kini memakai komponen baru `components/brand/BrandMark.tsx`, salinan persis markup navbar publik: ukuran logo, warna Si/CARE, dan ikon pesan.
  - Menu desktop dipindah ke `DesktopNav`. Bobot huruf tetap `font-medium` saat aktif (sebelumnya `font-semibold`, sehingga teks melebar).
  - Garis bawah tunggal meluncur ke menu aktif (`transition-all 300ms`), diukur dari `aria-current="page"` saat rute berubah, saat resize, dan setelah font termuat.
- **Latar halaman klien:** lapisan `bg-white/55` di atas `AuthBackground` agar lebih terang.
- **Sapaan beranda klien dan konselor:** komponen baru `components/mood/TypingGreeting.tsx`.
  - Kalimat diketik per huruf (55 ms) dengan kursor berkedip. Lebar kalimat dipesan oleh teks penuh tak terlihat, sehingga maskot tetap di tempatnya dan pengetikan berhenti tepat sebelum maskot.
  - Pembaca layar menerima kalimat utuh. Untuk `prefers-reduced-motion` kalimat langsung utuh.
  - Pengetikan diulang bila nama selesai dimuat.
- **Login:** tombol "Masuk" diberi ikon `LogIn`.
- **Pemeriksaan:** `fe: tsc -b`, `lint`, `build` **PASS**. `KlienLayout` asli dirender di dev server (MemoryRouter + AuthProvider):
  - logo dan teks sama dengan navbar publik;
  - semua menu berbobot 500;
  - setelah klik, garis berada tepat di bawah menu aktif (x dan lebar sama);
  - selama pengetikan, posisi maskot tetap (x=565 di empat sampel).
  - Halaman login tidak dibuka di browser.

## 2026-11-19 — Sapaan mengetik menunggu data profil

- **Masalah:** Beranda Konselor langsung mengetik sapaan sementara ("Halo, Konselor") saat profil masih dimuat. Setelah jenis kelamin dan nama tiba, pengetikan diulang dari awal dengan "Halo ma'am/Sir".
- **Perubahan:**
  - `TypingGreeting` menerima prop `ready`. Selama `ready=false` hanya kursor yang berkedip (`role="status"`), tanpa teks dan tanpa maskot. Penghitung huruf juga tidak berjalan, sehingga kalimat final diketik sekali.
  - Beranda Konselor memakai `ready={profile !== null || !loading}`. Bila jenis kelamin tidak ada, sapaan netral "Halo" diketik setelah data selesai. Bila pemuatan gagal, sapaan tetap tampil setelah `loading` selesai.
  - Beranda Klien memakai `ready={Boolean(profile) || !authLoading}`.
- **Pemeriksaan:** `fe: tsc -b`, `lint`, `build` **PASS**. Simulasi di dev server dengan data tiba setelah 1,5 detik: 0–1,3 s hanya kursor; mulai 1,5 s mengetik "Halo ma'am, Dr. Rina" satu kali tanpa pengulangan.

## 2026-11-19 — Hapus tabel consent_templates, template consent menjadi konstanta backend

- **Keputusan (pengguna):** tabel `consent_templates` dihapus; versi template Informed Consent disimpan sebagai konstanta di backend. Sebelumnya isi PDF memang sudah dibaca dari berkas lokal dan diverifikasi terhadap konstanta SHA-256; tabel hanya menyimpan metadata, dan kolom `storage_bucket`/`storage_path` tidak dipakai kode.
- **Migrasi baru `supabase/migrations/20261119120000_sicare_drop_consent_templates.sql`:**
  - pengaman: batal bila ada `informed_consents.consent_statement_version` yang berbeda dari versi template yang direferensikan;
  - trigger `prohibit_signed_consent_tampering` dibuat ulang tanpa `consent_template_id`; `consent_statement_version` tetap imutabel setelah `signed`;
  - `sicare_check_booking_consent_readiness` tidak membaca `consent_templates`; RPC mengembalikan `consent_statement_version` per peserta, tanpa `active_template_version`/`template_compliant`. Aturan `is_fully_consented` tidak berubah;
  - index unik aktif dipindah ke `(booking_participant_id, consent_statement_version)`; kolom `consent_template_id` dihapus; default `'v1.0'` pada `consent_statement_version` dihapus dan diberi check panjang 1–32;
  - tabel `consent_templates` dihapus. Bucket `informed-consent-templates` dan policy storage-nya tidak disentuh.
- **Backend:**
  - `consentPdf.service.js`: konstanta `OFFICIAL_TEMPLATE_TITLE` dan `OFFICIAL_CONSENT_TEMPLATE` (frozen).
  - `consent.service.js`: `getActiveConsentTemplate()` kini sinkron dan mengembalikan konstanta; parameter `templateId` di `initializeConsentForParticipant` dihapus (tidak ada pemanggil); idempotensi memakai `consent_statement_version`; join `consent_templates(*)` diganti metadata dari konstanta. Respons `consent_templates` (detail consent) dan `template` (consent tamu) tetap ada, tanpa `id`; untuk versi lama `title`/`file_sha256` bernilai `null`.
  - `getBookingConsentStatus`: `templateCompliant` dihitung backend (kelompok dengan consent bertanda tangan versi lama = `false`, individu selalu `true`, sama dengan perilaku RPC sebelumnya); respons menambah `activeTemplateVersion` dan `participants[].template_compliant`.
  - `database.types.ts` diedit manual (belum di-generate ulang karena migrasi belum diterapkan).
  - Seed `seed-dummy-current-period.sql` mengisi `consent_statement_version = 'v1.0'`; komentar `reset-transactional-data.sql` diperbarui.
- **Frontend:** `InformedConsentDto` tanpa `consent_template_id`; `consent_templates` tanpa `id`, `title`/`file_sha256` nullable. Tidak ada komponen yang memakai field tersebut.
- **Tes:** `consentTemplateDrop.test.js` baru (7 tes migrasi dan konstanta); `consentFoundation`, `consentSecurity` (tes 18 memakai `consent_statement_version`), dan `groupConsent` disesuaikan.
- **Pemeriksaan:**
  - `be: npm test` 342/343 PASS. Satu FAIL sama dengan baseline sebelum perubahan (`heroMotivations.test.js`: "admin settings manages one motivational sentence per input", tidak terkait).
  - `be: npm run check` PASS (82 berkas), `be: npm run typecheck` PASS.
  - `fe: tsc -b`, `lint`, `build` PASS.
  - Migrasi pada Postgres/Supabase nyata **NOT RUN** (tidak ada database lokal; tidak ada mutasi remote).
- **Baseline issue ditemukan (tidak diubah):** `GET /consents/booking/:bookingId/readiness` mengirim camelCase (`isFullyConsented`, `pendingParticipants`), sedangkan `BookingConsentReadinessDto` dan `KonselorAktivitasPage` membaca snake_case (`is_fully_consented`, `pending_participants`). Akibatnya `consentBlockReason` selalu mengembalikan alasan "Menunggu peserta menandatangani informed consent." walaupun consent sudah lengkap.
- **Langkah berikutnya:** terapkan migrasi ke database non-produksi, jalankan `npm run db:types`, uji tanda tangan consent individu dan kelompok, lalu rilis backend dan migrasi bersamaan.

## 2026-11-22 — Seed dummy terarah untuk semester berjalan

- **Permintaan pengguna:** ganti seed acak dengan data dummy terarah: 4 konseling selesai + feedback, 2 konseling diurungkan, 3 jadwal kosong per konselor, dan notifikasi terkait; ditambah saran alur aktif.
- **Perubahan:** `be/scripts/seed-dummy-current-period.sql` ditulis ulang. 4 klien dummy (`klien01..04@sicare-dummy.test`); skenario C1–C4 (3 individu + 1 kelompok, rating 5/4/4/3, moderasi shown/shown/pending/disabled, consent signed, catatan sesi `[DUMMY]`), X1 (dibatalkan klien saat menunggu konfirmasi), X2 (sesi dibatalkan konselor), opsional W1 (menunggu konfirmasi) dan U1 (terkonfirmasi, consent pending) lewat `c_include_active_flows`; 3 slot kosong mendatang per konselor aktif/publik. Notifikasi memakai type yang dibuat RPC (`booking.created`, `booking.submitted`, `booking.confirmed`, `booking.cancelled`, `session.cancelled`, `session.completed`, `feedback.submitted` ke admin/Kepala LMI); slot kosong tidak diberi notifikasi karena jenisnya tidak ada. Consent memakai `consent_statement_version = 'v1.0'` (pasca migrasi `20261119120000`).
- **Pemeriksaan:** **NOT RUN** di database mana pun (Postgres/Docker lokal tidak tersedia); ditinjau manual terhadap constraint dan trigger. Jalankan hanya di project non-produksi setelah `reset-transactional-data.sql`.

## 2026-11-22 — Penyesuaian template WhatsApp

- `be/src/templates/whatsapp/index.js`:
  - `booking-accepted`: baris Format dihapus. Ruangan tetap disebut bila ada.
  - `session-reminder-h1`: baris Format dan Tautan dihapus. Untuk sesi tatap muka, ruangan tetap disebut.
  - `session-reminder-morning`: baris Format dihapus.
  - Emoji 🙂 diganti 😇.
  - Template lain tidak berubah.
- **Pemeriksaan:** tes WhatsApp **47/47 PASS**; pratinjau render keempat kasus sudah diperiksa.

## 2026-11-22 — Perbaikan skrip reset & seed; komposisi akun dummy 70/30

- **Permintaan pengguna:** perbaiki seed dan reset; akun test 70% mahasiswa dan 30% dosen/staf. Sebelumnya seed gagal di Supabase (`consent_template_id` not-null) karena database belum menerapkan `20261119120000_sicare_drop_consent_templates.sql`.
- **Reset:** TRUNCATE dinamis hanya untuk tabel yang ada (tabel yang belum dimigrasi dilewati dan dilaporkan), verifikasi jumlah baris 0 setelahnya, opsi hapus akun `@sicare-dummy.test` (dikomentari).
- **Seed:** 10 akun klien dummy `klien01..10` (7 `student` dengan NIM dummy, 3 `faculty_staff` dengan NIP dummy, gelar/jabatan dan pendidikan sesuai); skenario C2/U1 dosen dan X1 staf; teks intake menyesuaikan kategori. Prasyarat kolom diperiksa dengan pesan jelas; `booking_intakes`/`session_notes` dilewati bila tabelnya belum ada; consent mengisi `consent_template_id` lewat SQL dinamis bila kolom itu masih ada.
- **Pemeriksaan:** **NOT RUN** di database (tidak ada Postgres lokal); hanya pemeriksaan keseimbangan blok/kurung dan tinjauan manual.

## 2026-11-22 — Label kategori klien di Admin Akun

- **Masalah:** `AdminAkunPage.tsx` memetakan `member_category: faculty_staff` ke label "Dosen" dan `other` ke "Staff". Padahal form Daftar menyebut kategori `faculty_staff` sebagai "Dosen / Staff", sehingga staf tampil sebagai dosen.
- **Perubahan:** label menjadi "Dosen / Staff" untuk `faculty_staff` dan "Lainnya" untuk `other` (`types/admin.ts` ikut diperbarui). Data dan kontrak API tidak berubah.
- **Pemeriksaan:** `fe: tsc -b`, `lint` **PASS**.

## 2026-11-22 — Komponen Badge bersama

- **Komponen baru `fe/src/components/shared/Badge.tsx`** (juga diekspor dari `components/shared/index.ts`). Prop:
  - `size`: `xs` 10px, `sm` 11px (default), `md` 12px;
  - `weight`: `bold` atau `semibold`;
  - `bordered`, `icon`, `title`;
  - `tone`: 14 warna bawaan, termasuk `gold` (emas Lasallian);
  - `className`: untuk warna khusus halaman, misalnya peta status yang sudah ada.
- **Migrasi:** 63 badge inline di 18 file kini memakai `<Badge>`, dengan warna masing-masing tetap dipertahankan. File: dashboard admin dan Kepala LMI, kartu konselor, intake, moderasi feedback, laporan, filter periode, Admin Aktivitas/Akun/Konseling/Periode, Aktivitas/Riwayat Klien, Aktivitas/Beranda/Permintaan/Riwayat Konselor, Mood Check.
  - Tidak dimigrasi: tombol dan tab yang bergaya mirip badge (Feedback Konselor, Jadwal Konselor, dll.) serta badge Admin Pengaturan yang memakai `hidden sm:inline-block`.
- **Konsekuensi visual kecil:** padding kini seragam per ukuran (mis. beberapa badge 11px yang sebelumnya `py-0.5` menjadi `py-1`, dan badge 12px yang sebelumnya `py-1` menjadi `py-0.5`). Badge role di modal Admin Akun kini sama dengan badge di tabel.
- **Warna role Admin Akun:** `ROLE_STYLE` diganti `ROLE_TONE`. Kepala LMI memakai `gold` agar berbeda dari Dosen / Staff (`indigo`); sebelumnya violet, mirip indigo.
- **Pemeriksaan:** `fe: tsc -b`, `lint`, `build` **PASS**. Badge role, ukuran, dan semua tone dirender di dev server dan diperiksa lewat screenshot. Halaman yang dimigrasi (butuh login) tidak dibuka satu per satu.
