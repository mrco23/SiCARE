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

