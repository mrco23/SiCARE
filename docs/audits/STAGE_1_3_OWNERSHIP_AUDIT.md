# Stage 1.3 — Live Ownership Verification & Repository Preflight

**Tanggal audit:** 30 Oktober 2026
**Branch:** `development` (terverifikasi, tidak diganti)
**Jenis pekerjaan:** verifikasi dan diagnosis. Tidak ada perubahan source code aplikasi, skema, migrasi, data remote, konfigurasi Git, atau `.gitignore`.
**Status keseluruhan:** **BELUM LULUS PENUH.** Audit statis, test otomatis, dan pemeriksaan live anonim lulus. Verifikasi ownership live lintas-pengguna (Client A/B, Counselor A/B) **BLOCKED** karena token akun uji dan data uji tidak tersedia di lingkungan audit.

---

## 1. Ringkasan eksekutif

| Area | Status | Ringkasan |
|---|---|---|
| Branch dan working tree | PASS (terverifikasi) | Branch `development`. Working tree memiliki 33 file termodifikasi dan 28 entri untracked (termasuk sebagian besar route backend, tes, migrasi Supabase). |
| Git tracking dokumentasi | **PASS (diperbaiki di Batch 1.3a)** | Saat audit awal: `AGENTS.md` dan `docs/` diabaikan oleh `.gitignore` root. Pada Batch 1.3a aturan tersebut telah dihapus sehingga `AGENTS.md` dan `docs/` kini eligible untuk tracking (belum di-commit). |
| File sensitif | **PASS (diperbaiki di Batch 1.3a)** | Tidak ada `.env`/secret yang ter-track. `be/.env` dan `fe/.env.local` diabaikan. `supabase/.temp/` kini diabaikan oleh `.gitignore:27:supabase/.temp/`. |
| Autentikasi | PASS (statis + mock runtime) | Identitas berasal dari token yang diverifikasi `auth.getUser()`; profil dicari dengan `authData.user.id`; akun nonaktif ditolak; role diperiksa server-side. |
| Ownership booking/sesi/feedback/notifikasi/konselor | PASS (statis + mock runtime) | Semua query/RPC yang diperiksa memakai identitas terautentikasi, bukan field dari body. Diperkuat dengan 11 test runtime negatif di Batch 1.3b. |
| Admin vs Head LMI | PASS (statis + mock runtime) | Hak akses dipisahkan di route; moderasi hanya admin, review hanya head_lmi. |
| RLS / grants (statis) | PASS dengan catatan | Semua tabel domain RLS aktif; RPC privileged hanya untuk `service_role`. Beberapa jalur tulis/baca langsung via PostgREST melewati validasi/audit backend (risiko rendah–sedang). |
| RLS runtime anonim | PASS 11/11 | Probe GET anonim ke PostgREST: semua tabel privat dan RPC privileged ditolak `401/42501`. |
| RLS runtime terautentikasi | **BLOCKED** | Memerlukan token pengguna uji. |
| Backend `npm test` | **PASS 61/61 (pasca-Batch 1.3b)** | Sebelum Batch 1.3b: 50/50 PASS. Setelah penambahan 11 test runtime ownership di Batch 1.3b: **61/61 PASS** dengan izin loopback (41 PASS / 20 FAIL di dalam sandbox tanpa izin port karena `EACCES` koneksi ke 127.0.0.1 pada `health.test.js`). |
| Backend `npm run check` | PASS | |
| Frontend build / lint | PASS |Lihat §11. |
| Live API dasar (`npm run verify:live`) | PASS 15/15 | 4 role dilewati (token tidak di-set). |
| Live ownership lintas-pengguna | **BLOCKED** | Lihat §12–§13. |

Tidak ditemukan kerentanan ownership kritis atau tinggi pada jalur API yang diaudit. Temuan tertinggi adalah masalah **proses repository** (dokumentasi dan sebagian besar backend belum ter-track) serta **kualitas test ownership** (sebagian assertion memeriksa definisi fungsi SQL yang sudah digantikan).

---

## 2. Repository preflight

### 2.1 Perintah dan hasil

| Perintah | Hasil |
|---|---|
| `git branch --show-current` | `development` |
| `git remote -v` | `origin https://github.com/mrco23/SiCARE.git` (fetch/push). Tidak ada kredensial tertanam di URL. |
| `git ls-files AGENTS.md docs/` | **Kosong** — tidak ada file yang ter-track. |
| `git check-ignore -v AGENTS.md docs/PROJECT_STATUS.md` | `.gitignore:26:/AGENTS.md` dan `.gitignore:27:/docs/` |
| `git status --short` | 33 file `M`, 28 entri `??` (lihat 2.3). |

### 2.2 Git tracking

| Pertanyaan | Jawaban |
|---|---|
| `AGENTS.md` ter-track? | **Tidak.** Diabaikan oleh `/AGENTS.md` di `.gitignore`. |
| File penting `docs/` ter-track? | **Tidak.** Seluruh `docs/` diabaikan oleh `/docs/`. Termasuk `PROJECT_STATUS.md`, `WORK_LOG.md`, matriks endpoint/SOP, dan laporan audit ini. |
| `.gitignore` mengecualikan dokumentasi tanpa sengaja? | Ya, kemungkinan besar. `AGENTS.md` menyatakan dokumen ini sebagai sumber kebenaran proyek, tetapi dokumen tersebut tidak akan pernah ter-commit. |
| File generated/sementara terabaikan dengan benar? | Sebagian. `node_modules`, `dist`, `.env*`, `*.local`, `coverage/` terabaikan melalui `.gitignore` root/`fe`/`be`. **`supabase/.temp/` tidak terabaikan.** Baris root `.fe/node_modules` (baris 10) adalah typo yang tidak efektif, tetapi tertutup oleh `fe/.gitignore`. |

### 2.3 Perubahan yang belum di-commit

- **Termodifikasi (33):** `.gitignore`, `be/.env.example`, `be/README.md`, `be/app.js`, `be/package.json`, `be/src/config/env.js`, `be/src/lib/audit.js`, `be/src/routes/auth.routes.js`, `be/src/routes/domain.routes.js`, `be/test/health.test.js`, `fe/README.md`, `fe/package*.json`, `fe/src/app/router.tsx`, dan 18 file frontend lain.
- **Untracked (28 entri):** `README.md` root, `be/scripts/`, `be/src/lib/domainRpc.js`, **semua route domain** (`admin`, `booking`, `counselor`, `feedback`, `notification`, `reporting`, `session`), 7 file tes backend termasuk `ownershipGuards.test.js`, `fe/.env.example`, `fe/src/features/auth/`, seluruh API wrapper frontend (`api.ts`, `publicApi.ts`, `sicareApi.ts`, dll.), `fe/src/types/api.ts`, dan **seluruh `supabase/`** (migrasi + `.temp`).

**Implikasi:** remote `development` saat ini tidak memuat implementasi backend domain, migrasi, maupun test yang diaudit. Deployment dari remote tidak akan sama dengan working tree lokal. Risiko kehilangan pekerjaan tinggi jika mesin lokal bermasalah.

### 2.4 File sensitif

| Item | Status di disk | Ignored | Tracked |
|---|---|---|---|
| `be/.env` | ada | ya (`be/.gitignore:2`) | tidak |
| `fe/.env.local` | ada | ya (`fe/.gitignore:13 *.local`) | tidak |
| `be/.env.example` | ada; semua nilai Supabase/Fonnte kosong | tidak | ya |
| `fe/.env.example` | ada; URL placeholder, key kosong | tidak | tidak (untracked) |
| Supabase secret/service-role key di frontend | Tidak ditemukan. `fe/.env.local` hanya memuat nama `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE_URL`; tidak ada nilai berbentuk `sb_secret_`/`service_role`. | — | — |
| Access token di file ter-track | Tidak ditemukan (`git ls-files` dipindai untuk `.env`, `secret`, `token`, `.temp`, `node_modules`, `dist`). | — | — |
| `supabase/.temp/*` (`project-ref`, `linked-project.json`, `pooler-url`, versi CLI) | ada | **tidak** | tidak (folder untracked) |
| `fe/dist`, `fe/node_modules`, `be/node_modules` | ada | ya | tidak |

Pemeriksaan bentuk (tanpa mencetak nilai): `pooler-url` tidak memuat pola password tertanam; `linked-project.json` memuat `ref`, `name`, `organization_id`, `organization_slug`. Ini bukan secret, tetapi metadata project/organisasi yang tidak perlu masuk repository.

### 2.5 Rekomendasi koreksi (tidak diterapkan pada audit ini)

1. Hapus `/AGENTS.md` dan `/docs/` dari `.gitignore` root setelah dikonfirmasi pemilik repo, lalu commit dokumentasi bersama kode.
2. Tambahkan `supabase/.temp/` ke `.gitignore` (atau `supabase/.gitignore`) **sebelum** `git add supabase/`.
3. Perbaiki typo `.fe/node_modules` → `fe/node_modules` atau cukup `node_modules/` (kosmetik).
4. Commit route backend, migrasi, test, dan wrapper frontend yang sudah tervalidasi ke `development` dalam commit yang terpisah dan dapat ditinjau.

---

## 3. Autentikasi

Sumber: [`be/src/middleware/auth.js`](../../be/src/middleware/auth.js), [`be/src/routes/auth.routes.js`](../../be/src/routes/auth.routes.js).

| Kontrol | Bukti | Status |
|---|---|---|
| Identitas dari token Supabase terverifikasi | `supabase.auth.getUser(match[1])` (auth.js:14); token invalid → 401 `INVALID_TOKEN`. | PASS (statis) |
| Profil tidak diambil dari field request | Profil dicari dengan `.eq("id", authData.user.id)` (auth.js:22). Semua route memakai `request.auth.user.id` / `request.auth.profile`. Tidak ada route yang menerima `client_id`, `counselor_id`, `recipient_user_id`, atau `app_role` dari body untuk menentukan identitas pelaku. | PASS (statis) |
| Akun nonaktif ditolak | `profile.account_status !== "active"` → 403 `ACCOUNT_INACTIVE` (auth.js:26), dicek pada setiap request. Login juga menolak akun nonaktif (auth.routes.js:180). | PASS (statis) |
| Role diperiksa server-side | `allowRoles(...)` membaca `request.auth.profile.app_role` dari database (auth.js:34–42). | PASS (statis) |
| Registrasi publik tidak dapat memilih role | `registerSchema` strict tanpa `app_role`; trigger `handle_new_auth_user` selalu membuat `client`/`active`. | PASS (statis) |
| Profile patch tidak dapat mengubah role/status | `profilePatchSchema` hanya `full_name`, `phone_e164` (domain.routes.js:10–13). | PASS (statis) |

Catatan: logout backend tidak mencabut sesi (`/auth/logout` hanya mengembalikan pesan) dan frontend memanggil `signOut({ scope: "local" })`. Refresh token tidak dicabut server-side (lihat §14, S5).

---

## 4. Booking

Sumber: [`be/src/routes/booking.routes.js`](../../be/src/routes/booking.routes.js); RPC aktif di `20261028000000_*` (`sicare_create_booking`) dan `20261028120000_*` (`sicare_transition_booking` versi terbaru, `sicare_reschedule_booking`).

| Kontrol | Bukti | Status statis | Status live |
|---|---|---|---|
| Client hanya melihat booking sendiri | `GET /bookings` → `.eq("client_id", request.auth.user.id)` (booking.routes.js:78–80). | PASS | BLOCKED |
| Client tidak dapat mengambil booking client lain via UUID | `loadBookingById` menambahkan filter `client_id`/`counselor_id` = profil pelaku; tidak ditemukan → 404 `BOOKING_NOT_FOUND` (booking.routes.js:60–69). | PASS | BLOCKED |
| Client tidak dapat membuat booking atas identitas lain | `p_client_id: request.auth.user.id`; body strict tanpa `client_id` (booking.routes.js:15–35, 89–96). RPC memeriksa client aktif. | PASS | NOT TESTED (mutasi) |
| Counselor hanya melihat booking miliknya | Filter `counselor_id = request.auth.user.id` (list) dan `profile.id` (detail). | PASS | BLOCKED |
| Reschedule/cancel tidak sah ditolak | Route: client hanya boleh `cancelled`, counselor tidak boleh `cancelled` (booking.routes.js:122–127). RPC `sicare_transition_booking` (versi 20261028120000:261–358) mensyaratkan `v_booking.counselor_id = p_actor_id` atau `v_booking.client_id = p_actor_id`, selain itu `BOOKING_FORBIDDEN`. `sicare_reschedule_booking` mensyaratkan `v_booking.client_id = p_client_id` dan slot milik counselor yang sama. | PASS | NOT TESTED (memerlukan probe PATCH; lihat §13) |

Kontrak status: GET detail milik orang lain → **404**; PATCH status/reschedule milik orang lain → **403** `BOOKING_FORBIDDEN`, sedangkan ID yang tidak ada → **404**. Perbedaan ini konsisten dengan kode saat ini, tetapi memungkinkan oracle keberadaan UUID (lihat §14, S3). Jangan diubah tanpa keputusan kontrak.

---

## 5. Sesi konseling

Sumber: [`be/src/routes/session.routes.js`](../../be/src/routes/session.routes.js); RPC `sicare_transition_session` (20261028000000:226–285).

| Kontrol | Bukti | Status statis | Status live |
|---|---|---|---|
| Akses mengikuti relasi booking | List: ambil `bookings.id` milik pelaku lalu `.in("booking_id", ...)` (session.routes.js:45–56). Detail: setelah membaca sesi, booking diverifikasi dengan filter pihak; gagal → 404 (session.routes.js:22–38). | PASS | BLOCKED |
| Client tidak dapat mengakses sesi client lain | Sama seperti di atas; respons 404 `SESSION_NOT_FOUND`. | PASS | BLOCKED |
| Counselor tidak dapat mengakses sesi counselor lain | Filter `bookings.counselor_id = profile.id`. | PASS | BLOCKED |
| Transisi tidak sah ditolak | Route hanya role `counselor`; RPC mensyaratkan `v_session.counselor_id = p_actor_id` dan profil counselor aktif → selain itu `SESSION_FORBIDDEN` (403). Transisi status dibatasi `scheduled→ongoing/cancelled`, `ongoing→completed/cancelled`. | PASS | NOT TESTED (mutasi) |

Catatan: detail sesi membaca baris sesi sebelum memverifikasi pihak, tetapi data tidak dikembalikan bila verifikasi gagal. Ini aman (fail-closed).

---

## 6. Feedback

Sumber: [`be/src/routes/feedback.routes.js`](../../be/src/routes/feedback.routes.js); RPC `sicare_submit_feedback` (20261028000000:287–327); constraint `feedback_one_per_client_session`.

| Kontrol | Bukti | Status statis | Status live |
|---|---|---|---|
| Client hanya melihat feedback miliknya | `GET /feedback/mine` → `.eq("client_id", request.auth.user.id)`; tidak mengembalikan `disabled_reason`. | PASS | BLOCKED |
| Counselor hanya melihat feedback yang berhak | `GET /feedback/counselor` → `counselor_id = user.id` **dan** `moderation_status = 'shown'`. | PASS | BLOCKED |
| Submit memerlukan sesi milik sendiri yang eligible | RPC: `s.status = 'completed' and b.client_id = p_client_id`; selain itu `FEEDBACK_SESSION_NOT_ELIGIBLE` (409). Satu feedback per client/sesi (unique constraint). | PASS | NOT TESTED (mutasi) |
| Pengguna tidak sah tidak dapat mengubah/membaca feedback privat | Detail/list admin: `admin`, `head_lmi`. Moderasi: hanya `admin`. Review: hanya `head_lmi`. Tidak ada endpoint ubah feedback untuk client/counselor. | PASS | Role-denial PASS historis (57/57); tidak diulang |

Catatan SOP: `/feedback/counselor` mengembalikan `session_id`, sehingga counselor dapat mengaitkan feedback ke sesi/klien tertentu. Apakah feedback harus anonim bagi counselor belum ditetapkan SOP (lihat §14, S6).

---

## 7. Notifikasi

Sumber: [`be/src/routes/notification.routes.js`](../../be/src/routes/notification.routes.js).

| Kontrol | Bukti | Status statis | Status live |
|---|---|---|---|
| Daftar dibatasi ke penerima | `.eq("recipient_user_id", request.auth.user.id)` untuk list dan unread count. | PASS | BLOCKED |
| Mark-as-read dibatasi ke penerima | `PATCH /:id/read` → `.eq("id", ...).eq("recipient_user_id", user.id)`; tidak cocok → 404. `read-all` hanya untuk penerima. | PASS | NOT TESTED (mutasi) |
| UUID notifikasi orang lain tidak dapat diubah | Update dengan dua filter; baris milik orang lain tidak terpengaruh dan respons 404 (tidak membedakan "tidak ada" dan "bukan milikmu"). | PASS | NOT TESTED (mutasi) |

---

## 8. Data counselor

Sumber: [`be/src/routes/counselor.routes.js`](../../be/src/routes/counselor.routes.js); RPC di `20261028130000_sicare_admin_availability_management.sql`.

| Kontrol | Bukti | Status statis | Status live |
|---|---|---|---|
| Update profil memakai identitas terautentikasi | `.eq("profile_id", req.auth.user.id)`; schema strict tanpa `profile_id`/`is_public`. | PASS | NOT TESTED (mutasi) |
| Availability dibatasi ke counselor terautentikasi | `p_counselor_id: req.auth.user.id`; RPC menyaring `s.id = p_slot_id and s.counselor_id = p_counselor_id` → slot counselor lain menjadi `AVAILABILITY_NOT_FOUND` (404). List memakai `counselor_id = user.id`. | PASS | BLOCKED (read) / NOT TESTED (mutasi) |
| Role lain tidak dapat mengubah resource counselor | Semua route `/counselor/*` memakai `allowRoles("counselor")`. RPC juga memeriksa `app_role = 'counselor'` aktif. | PASS | Role-denial GET PASS historis |

---

## 9. Admin dan Head LMI

Sumber: [`admin.routes.js`](../../be/src/routes/admin.routes.js), [`reporting.routes.js`](../../be/src/routes/reporting.routes.js), [`feedback.routes.js`](../../be/src/routes/feedback.routes.js).

| Endpoint | admin | head_lmi |
|---|---|---|
| `/admin/accounts*`, `/admin/counselors/:id/publication`, `/admin/periods*`, `/admin/hero-motivations*`, `/admin/activity` | ✅ | ❌ |
| `/admin/dashboard`, `/admin/reports` | ✅ | ❌ |
| `/head-lmi/dashboard`, `/head-lmi/reports` | ❌ | ✅ |
| `/admin/counseling`, `/admin/feedback`, `/admin/feedback/:id`, `/admin/feedback/statistics` | ✅ | ✅ |
| `PATCH /admin/feedback/:id/moderation` | ✅ | ❌ |
| `PATCH /admin/feedback/:id/review` | ❌ | ✅ |

| Kontrol | Status |
|---|---|
| Operasi admin memerlukan otorisasi admin | PASS (statis); role matrix live PASS historis |
| Head LMI mengikuti izin yang ditetapkan dokumentasi (`TAHAP5-6_API.md`, `TAHAP7_*.md`) | PASS (statis) |
| Admin dan Head LMI tidak saling menggantikan | PASS (statis): dashboard/report terpisah; moderasi vs review terpisah. |
| RPC privileged tidak dapat dipanggil langsung oleh pengguna tidak sah | PASS (statis): semua `sicare_*` di-`revoke` dari `public, anon, authenticated` dan hanya `grant execute ... to service_role`. Runtime anonim: `sicare_public_availability` ditolak 401/42501. Runtime terautentikasi: BLOCKED. |

Catatan: admin dapat membuat akun dan mengubah role siapa pun menjadi `admin`/`head_lmi`; safeguard hanya mencegah menurunkan/menonaktifkan diri sendiri dan admin aktif terakhir. Ini sesuai desain saat ini, tetapi kebijakan pemberian role tinggi perlu dikonfirmasi pemilik SOP. `/admin/counseling` mengekspos nama client kepada head_lmi; kebutuhan ini juga perlu konfirmasi SOP.

---

## 10. RLS dan grants

Sumber: `supabase/migrations/20261027000000_sicare_core_schema.sql` baris 323–447 dan migrasi berikutnya.

### 10.1 Temuan statis

- RLS aktif pada 11 tabel inti + `hero_motivations`.
- `revoke all ... from anon, authenticated` lalu grant minimal: `select` pada tabel domain untuk `authenticated`; `update(full_name, phone_e164)` pada `profiles`; `update(public_name, headline, bio, specialties, years_experience, photo_path)` pada `counselor_profiles`; `update(read_at)` pada `notifications`.
- Policy select berbasis pemilik: `profiles` (self), `bookings`/`booking_participants`/`counseling_sessions` (pihak booking), `feedback` (submitter), `notifications` (penerima), `counselor_profiles`/`availability_slots` (publik atau pemilik counselor aktif).
- `whatsapp_outbox` dan `audit_events`: tanpa policy → tertutup untuk browser.
- Semua RPC domain `security definer`, `search_path = ''`, eksekusi hanya `service_role`.

### 10.2 Celah antara backend dan database (bukan bypass lintas-pengguna)

Backend memakai server key yang **melewati RLS**, sehingga isolasi API sepenuhnya bergantung pada filter route/RPC. Pada saat yang sama, pengguna yang memiliki access token + publishable key dapat memanggil PostgREST langsung. Jalur langsung tersebut tetap owner-scoped, tetapi:

1. `profiles` dan `counselor_profiles` dapat di-update langsung tanpa validasi Zod dan tanpa audit backend (misalnya `bio`/`specialties` tanpa batas panjang DB, `photo_path` bebas, format telepon hanya dibatasi panjang).
2. `feedback` dapat dibaca client secara langsung termasuk `disabled_reason` dan `review_status`, yang sengaja tidak dikembalikan `/feedback/mine`.
3. `notifications.read_at` dapat diisi nilai sembarang (termasuk `null`/tanggal masa depan) untuk notifikasi milik sendiri.
4. Policy `bookings`, `counseling_sessions`, `feedback`, `notifications` tidak memeriksa `account_status`; akun yang dinonaktifkan dengan token yang masih berlaku dapat membaca data miliknya sendiri via PostgREST sampai token kedaluwarsa. Policy `counselor_profiles`/`availability_slots` memakai `current_app_role()` yang memeriksa status aktif, sehingga perilaku tidak seragam.

### 10.3 Verifikasi runtime

| Pemeriksaan | Konteks | Hasil |
|---|---|---|
| Anon GET `profiles`, `bookings`, `booking_participants`, `counseling_sessions`, `feedback`, `notifications`, `audit_events`, `whatsapp_outbox`, `hero_motivations` | publishable key, tanpa user | **PASS 9/9** — semua `401`, `42501` (permission denied) |
| Anon GET `rpc/sicare_public_availability` | publishable key | **PASS** — `401`, `42501` |
| Anon GET `counselor_profiles` (seharusnya terbuka via policy publik) | publishable key | `200`, 0 baris (informasional; dapat berarti belum ada counselor publik) |
| RLS dengan konteks user terautentikasi (A vs B) | token user | **BLOCKED** — token tidak tersedia |

Probe menggunakan skrip read-only di direktori scratch agent (bukan file repository), hanya GET, tidak memanggil RPC volatile, dan tidak mencetak key. **Service-role tidak dipakai sebagai bukti RLS.**

---

## 11. Hasil test otomatis

| Perintah | Hasil | Catatan |
|---|---|---|
| `be: npm test` (sandbox tanpa izin port) | 61 tests (pasca-Batch 1.3b): 41 PASS, 20 FAIL | Semua 20 kegagalan di `test/health.test.js`, `connect EACCES 127.0.0.1` — sandbox melarang koneksi loopback. Seluruh 20 test di `ownershipGuards.test.js` lulus di dalam sandbox. |
| `be: node --test` (dengan izin loopback) | **PASS 61/61**, 0 fail, 0 skipped | Hasil faktual suite pasca-Batch 1.3b (meningkat dari 50/50 pada baseline awal). |
| `be: npm run check` | **PASS** | |
| `fe: npm run build` | **PASS** (dengan peringatan ukuran bundle utama ~1,30 MB sebelum gzip / 364,94 kB gzip, non-blocking) | |
| `fe: npm run lint` | **PASS** (0 error) | |

### 11.1 Kualitas test ownership (Awal Audit vs Pasca-Batch 1.3b)

| Temuan saat Audit Awal | Detail | Status Pasca-Batch 1.3b |
|---|---|---|
| Semua 9 test di `ownershipGuards.test.js` adalah pencocokan regex terhadap source/SQL | Tidak ada eksekusi handler, tidak ada mock Supabase, tidak ada database. | **RESOLVED (Batch 1.3b):** Ditambahkan 11 test runtime yang mengeksekusi Express `app` + middleware + route handler nyata dengan mock database relasional berpasangan (User A & User B). |
| **Assertion transisi booking memeriksa definisi yang sudah digantikan** | Test "booking list and detail queries..." memotong `sicare_transition_booking` dari `20261028000000_*`, padahal definisi aktif adalah `create or replace` di `20261028120000_*`. | **RESOLVED (Batch 1.3b):** Helper `latestFunctionDefinition` mengurutkan migrasi secara kronologis dan memverifikasi definisi aktif pada `20261028120000_*`. |
| Tidak ada test negatif runtime untuk ownership | Tidak ada test "user B → 404/403 untuk resource user A" pada handler. | **RESOLVED untuk Express layer (Batch 1.3b):** Seluruh domain (Booking, Session, Feedback, Notification, Counselor, Admin/Head LMI) kini memiliki test negatif runtime. |
| `health.test.js` hanya menguji 401 tanpa token dan validasi input | Bermakna untuk autentikasi wajib, bukan ownership. | Tetap dipertahankan (20/20 PASS). |
| `domainRpc.test.js` menguji pemetaan kode error RPC → HTTP | Bermakna untuk kontrak status (`BOOKING_FORBIDDEN` → 403, dll.). | Tetap dipertahankan (6/6 PASS). |
| Tidak ada test RLS (pgTAP/SQL) dengan konteks `authenticated` | Policy belum pernah diuji dengan `request.jwt.claims` terhadap PostgreSQL nyata. | **Masih terbuka** — menjadi cakupan Batch 1.3c/1.3d. |

---

## 12. Hasil verifikasi live

### 12.1 Yang dijalankan

Backend lokal dijalankan sementara dari `be/` (konfigurasi `be/.env` yang ada, `NODE_ENV=development`) lalu dihentikan setelah pemeriksaan. Hanya request GET; PATCH role-denial di skrip tidak berjalan karena token tidak di-set.

| Pemeriksaan | Hasil |
|---|---|
| `npm run verify:live` — 6 endpoint publik | PASS 6/6 (200) |
| `npm run verify:live` — 9 endpoint terlindungi tanpa token | PASS 9/9 (401) |
| Role matrix 4 role | SKIPPED — `SICARE_*_TOKEN` tidak ada di environment |
| Probe RLS anonim (PostgREST) | PASS 11/11 (lihat §10.3) |

Total live yang dijalankan pada audit ini: **26 PASS, 0 FAIL**, ditambah 4 role dilewati. Hasil 57/57 sebelumnya tetap merupakan bukti historis dan tidak diulang.

### 12.2 Kemampuan `be/scripts/verify-live-api.js`

Skrip **tidak dapat** mendukung verifikasi dua akun per role dalam bentuk saat ini:

- Hanya satu token per role (`SICARE_<ROLE>_TOKEN`).
- `check()` hanya membandingkan status HTTP; tidak memeriksa isi koleksi.
- Tidak ada pemeriksaan berbasis ID resource.
- PATCH dikirim dengan body `{}`; aman untuk role-denial di middleware, tetapi tidak cocok untuk probe ownership.

Skrip **aman** dipakai berdampingan dengan ekstensi read-only karena tidak menulis data. Desain ekstensi yang disarankan ada di §15.

### 12.3 Cross-user ownership matrix

| # | Domain | Pemeriksaan | Metode | Status |
|---|---|---|---|---|
| L1 | Booking | Client A membaca booking miliknya (`GET /bookings/:idA`) | GET | BLOCKED |
| L2 | Booking | Client B → `GET /bookings/:idA` = 404 | GET | BLOCKED |
| L3 | Booking | Counselor B → `GET /bookings/:idA` (counselor A) = 404 | GET | BLOCKED |
| L4 | Booking | `GET /bookings` Client B / Counselor B tidak memuat `idA` | GET | BLOCKED |
| L5 | Sesi | Client A membaca sesi miliknya; Client B dan Counselor B → 404 | GET | BLOCKED |
| L6 | Sesi | `GET /sessions` B tidak memuat sesi A | GET | BLOCKED |
| L7 | Feedback | `GET /feedback/mine` Client B tidak memuat feedback A | GET | BLOCKED |
| L8 | Feedback | `GET /feedback/counselor` Counselor B tidak memuat feedback dengan `counselor_id` = A | GET | BLOCKED |
| L9 | Notifikasi | `GET /notifications` B tidak memuat ID notifikasi A | GET | BLOCKED |
| L10 | Counselor | `GET /counselor/availability` Counselor B tidak memuat slot A | GET | BLOCKED |
| L11 | RLS | PostgREST dengan token B: `bookings?id=eq.idA`, `counseling_sessions`, `feedback`, `notifications` → 0 baris | GET | BLOCKED |
| L12 | RLS | PostgREST dengan token user: `rpc/sicare_public_availability` → 401/403 | GET | BLOCKED |
| M1 | Booking | Client B `PATCH /bookings/:idA/status` (cancel) → 403 | PATCH (ditolak bila aman) | NOT TESTED — perlu otorisasi eksplisit |
| M2 | Booking | Client B `PATCH /bookings/:idA/reschedule` → 403 | PATCH | NOT TESTED |
| M3 | Sesi | Counselor B `PATCH /sessions/:sidA/status` → 403 | PATCH | NOT TESTED |
| M4 | Notifikasi | User B `PATCH /notifications/:nidA/read` → 404 | PATCH | NOT TESTED |
| M5 | Counselor | Counselor B `PATCH`/`DELETE /counselor/availability/:slotA` → 404 | PATCH/DELETE | NOT TESTED |
| M6 | Feedback | Client B `POST /sessions/:sidA/feedback` → 409 | POST | NOT TESTED |

Probe M1–M6 tidak akan mengubah data jika otorisasi benar. Namun, jika otorisasi rusak, probe dapat memutasi record milik akun lain. Karena itu, probe ini tidak dijalankan tanpa izin eksplisit dan hanya boleh dijalankan pada data uji yang dapat dibuang.

---

## 13. Test yang BLOCKED dan prasyarat

| Prasyarat | Detail |
|---|---|
| Empat akun uji khusus | `client` A, `client` B, `counselor` A, `counselor` B; semua `account_status = active`; bukan akun pengguna nyata. |
| Token di environment terminal saja | `SICARE_CLIENT_A_TOKEN`, `SICARE_CLIENT_B_TOKEN`, `SICARE_COUNSELOR_A_TOKEN`, `SICARE_COUNSELOR_B_TOKEN`. Jangan disimpan di `.env`, file ter-track, chat, atau log. Hapus setelah selesai. Token harus diverifikasi via `GET /auth/me` (`profile.app_role` dan `profile.id` berbeda untuk A/B). |
| Data uji yang sudah ada | Minimal: booking A (Client A ↔ Counselor A) dan booking B (Client B ↔ Counselor B); sesi untuk masing-masing booking yang sudah dikonfirmasi; ≥1 notifikasi untuk tiap akun; idealnya ≥1 feedback `shown` per counselor; ≥1 slot availability per counselor. ID ditemukan secara dinamis dari koleksi milik pemilik, bukan diketik manual. |
| Backend lokal berjalan | `npm run dev` di `be/` terhadap project Supabase yang sama dengan token. |
| Publishable key frontend | Untuk L11–L12 (sudah tersedia di `fe/.env.local`). |
| Otorisasi pengguna | Diperlukan secara eksplisit untuk probe M1–M6, dan untuk pembuatan data uji bila data A/B belum ada. Konfirmasi juga bahwa project target adalah non-produksi. |
| Ekstensi harness | **RESOLVED di Batch 1.3c:** `be/scripts/verify-live-ownership.js` (`npm run verify:ownership`) telah dibuat dan dieksekusi (`STAGE_1_3C_LIVE_OWNERSHIP_VERIFICATION.md`). |

---

## 14. Risiko keamanan berdasarkan tingkat

| ID | Tingkat | Temuan | File / fungsi | Dampak | Koreksi minimal yang disarankan | Test verifikasi |
|---|---|---|---|---|---|---|
| R1 | **High** (proses — **RESOLVED di Batch 1.3a**) | `AGENTS.md` dan `docs/` diabaikan Git | `.gitignore` | Dokumentasi kanonis, status, dan audit tidak pernah ter-version | Dihapus dari `.gitignore` pada Batch 1.3a; siap di-commit | `git check-ignore -v AGENTS.md docs/PROJECT_STATUS.md` kosong (**PASS**) |
| R2 | **High** (proses) | Route domain backend, migrasi, test, dan wrapper frontend belum ter-track | lihat §2.3 | Remote tidak mencerminkan kode yang diuji; risiko kehilangan pekerjaan dan deployment yang tidak sesuai | Commit bertahap ke `development` setelah review | `git status --short` bersih untuk file yang dimaksud |
| R3 | Medium (**RESOLVED di Batch 1.3a**) | `supabase/.temp/` tidak diabaikan | `.gitignore:27` | `git add supabase/` akan meng-commit metadata project/organisasi dan pooler host | Ditambahkan `supabase/.temp/` ke `.gitignore` pada Batch 1.3a | `git check-ignore -v supabase/.temp/project-ref` (**PASS**) |
| T1 | Medium (kualitas test — **RESOLVED di Batch 1.3b**) | Assertion ownership transisi booking memeriksa fungsi SQL yang sudah digantikan | `be/test/ownershipGuards.test.js` | Regresi ownership pada fungsi aktif tidak terdeteksi | Diperbaiki dengan `latestFunctionDefinition("sicare_transition_booking")` yang memeriksa `20261028120000_*`, ditambah 11 test runtime negatif | `node --test test/ownershipGuards.test.js` **20/20 PASS** |
| S1 | Low–Medium | Jalur PostgREST langsung melewati validasi/audit backend (`profiles`, `counselor_profiles` update; `feedback` select termasuk `disabled_reason`; `notifications.read_at` bebas) | core migration:337–433 | Konten publik counselor tanpa validasi panjang/format; perubahan tanpa audit; catatan moderator terbaca client | Keputusan desain: cabut grant update/select kolom yang tidak dibutuhkan browser, atau batasi kolom `feedback` (column grants). **Membutuhkan migrasi baru, di luar scope audit.** | Probe PostgREST dengan token user: update/select kolom tersebut ditolak |
| S2 | Low | Policy RLS domain tidak memeriksa `account_status` | core migration:367–401 | Akun nonaktif dengan token valid masih dapat membaca data miliknya via PostgREST sampai token kedaluwarsa | Tambahkan syarat aktif pada policy (migrasi) atau cabut sesi saat menonaktifkan akun | Nonaktifkan akun uji, akses PostgREST dengan token lama → 0 baris |
| S3 | Low | Oracle keberadaan UUID: PATCH status/reschedule/session → 403 untuk milik orang lain, 404 untuk tidak ada; GET → 404 | `domainRpc.js` (`BOOKING_FORBIDDEN`, `SESSION_FORBIDDEN`) | Enumerasi keberadaan ID (praktis sulit karena UUID v4) | Keputusan kontrak: samakan menjadi 404 untuk non-pihak, atau terima dan dokumentasikan | Test runtime M1–M3 |
| S4 | Low–Medium | Tidak ada rate limiting pada `/auth/login`; seluruh login ke Supabase berasal dari IP backend | `auth.routes.js:135` | Brute force tidak dibatasi per klien; batas Supabase per-IP dapat mengunci semua pengguna | Tambahkan rate limit per IP/identifier (dependency baru perlu justifikasi) | Test N request gagal → 429 |
| S5 | Low | Logout tidak mencabut refresh token | `auth.routes.js:191`, `AuthProvider.tsx` (`scope: "local"`) | Token yang bocor tetap berlaku sampai kedaluwarsa | Pertimbangkan `signOut({ scope: "global" })` atau revoke di server | Refresh token lama ditolak setelah logout |
| S6 | Info (SOP) | Counselor menerima `session_id` pada feedback; head_lmi melihat nama client di `/admin/counseling`; admin dapat mengangkat role apa pun | `feedback.routes.js:53`, `admin.routes.js:260`, `admin.routes.js:31` | Anonimitas feedback dan prinsip least privilege belum ditetapkan | Konfirmasi SOP sebelum mengubah | — |

Tidak ditemukan temuan **Critical** atau **High** terkait bypass ownership di jalur API yang diaudit.

---

## 15. Tugas implementasi berikutnya yang disarankan

Urutan saran (masing-masing perlu persetujuan sebelum dikerjakan):

1. **Batch 1.3a — Kebersihan repository (tanpa kode aplikasi):** perbaiki `.gitignore` (R1, R3), lalu commit dokumentasi, migrasi, route, dan test secara bertahap (R2). Tidak memerlukan perubahan perilaku.
2. **Batch 1.3b — Perbaikan assertion test (T1):** arahkan test transisi booking ke definisi SQL aktif. Tambahkan test handler dengan Supabase client tiruan untuk kasus negatif ownership (booking/session/notification/counselor slot → 404/403). Tidak mengubah kontrak API.
3. **Batch 1.3c — Harness ownership live read-only:** tambahkan skrip terpisah (misalnya `be/scripts/verify-live-ownership.js`, `npm run verify:ownership`) yang:
   - membaca empat token dari environment, memverifikasi `GET /auth/me` (role dan ID berbeda);
   - menemukan ID resource A dari koleksi milik A, bukan dari input manual;
   - menjalankan L1–L12, termasuk assertion isi koleksi (ID A tidak muncul di B);
   - hanya GET secara default; probe M1–M6 hanya dengan flag eksplisit, misalnya `SICARE_ALLOW_REJECTED_MUTATION_PROBES=1`, pada project non-produksi;
   - tidak pernah mencetak token atau isi record, hanya status, jumlah, dan ID terpotong.
4. **Jalankan harness** dengan empat akun uji dan data uji yang sudah ada. Catat hasil di `PROJECT_STATUS.md` dan `WORK_LOG.md`. Tutup Stage 1.3 hanya jika L1–L12 PASS.
5. **Keputusan desain RLS (S1, S2)** dan kontrak status 403/404 (S3). Bila disetujui, kerjakan melalui migrasi baru yang diuji di project non-produksi terlebih dahulu.
6. Setelah itu, lanjut ke Batch 1.4 (kontrak state UI) sesuai roadmap.
