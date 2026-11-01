# SiCARE — Stage 1.3c Live Cross-User Ownership & RLS Verification Report

**Tanggal Eksekusi:** 30 Oktober 2026
**Branch:** `development`
**Mode Verifikasi:** Strictly Read-Only (`GET` / `SELECT` saja; tanpa mutasi, seeding, atau RPC penulisan)
**Skrip Verifikasi:** `be/scripts/verify-live-ownership.js` (`npm run verify:ownership`)

---

## 1. Environment Identification (Secrets Redacted)

Pemeriksaan konfigurasi environment dilakukan tanpa menampilkan nilai secret, token, atau kredensial:

| Parameter | Nilai / Status (Redacted) | Keterangan |
|---|---|---|
| `NODE_ENV` (`be/.env`) | `development` | Lulus safety gate non-production (`NODE_ENV !== 'production'`). |
| `HOST` (`be/.env`) | `127.0.0.1` | Target host backend lokal. |
| `PORT` (`be/.env`) | `3000` | Target port backend lokal (`http://127.0.0.1:3000`). |
| `SUPABASE_URL` (`be/.env`) | `[CONFIGURED — REDACTED]` | Tersedia dan tidak mengandung kata `prod`/`production`. |
| `SUPABASE_PUBLISHABLE_KEY` (`be/.env`) | `[CONFIGURED — REDACTED]` | Tersedia untuk request Supabase Auth / PostgREST non-privileged. |
| `SUPABASE_SECRET_KEY` (`be/.env`) | `[CONFIGURED — REDACTED]` | Tersedia di server lokal; **tidak** digunakan oleh pemeriksaan PostgREST RLS (`RLS-*`). |
| `supabase/.temp/linked-project.json` | `name: "SiCARE Project"` | Linked project non-production teridentifikasi. |
| `SICARE_CLIENT_A_TOKEN` | `UNSET (false)` | Belum disuplai di environment shell. |
| `SICARE_CLIENT_B_TOKEN` | `UNSET (false)` | Belum disuplai di environment shell. |
| `SICARE_COUNSELOR_A_TOKEN` | `UNSET (false)` | Belum disuplai di environment shell. |
| `SICARE_COUNSELOR_B_TOKEN` | `UNSET (false)` | Belum disuplai di environment shell. |

---

## 2. Account Identity Verification

Skrip `be/scripts/verify-live-ownership.js` dirancang untuk memverifikasi keempat akun uji secara otomatis melalui `GET /api/v1/auth/me` dan memastikan:
1. Keempat token valid dan menghasilkan HTTP `200`.
2. `Client A` dan `Client B` memiliki `role === 'client'` serta `is_active === true`.
3. `Counselor A` dan `Counselor B` memiliki `role === 'counselor'` serta `is_active === true`.
4. Keempat akun memiliki UUID kanonis (`data.profile.id`) yang berbeda satu sama lain (`uniqueIds.size === 4`), serta menampilkan hanya potongan UUID yang telah di-redact (`xxxxxxxx...xxxx`) tanpa membocorkan email, nomor telepon, atau JWT.

**Status Saat Ini:** `BLOCKED`

| Akun Uji | Variabel Environment | Expected Role | UUID Terverifikasi | Status |
|---|---|---|---|---|
| Client A | `SICARE_CLIENT_A_TOKEN` | `client` (`is_active = true`) | `N/A (token unset)` | `BLOCKED` |
| Client B | `SICARE_CLIENT_B_TOKEN` | `client` (`is_active = true`) | `N/A (token unset)` | `BLOCKED` |
| Counselor A | `SICARE_COUNSELOR_A_TOKEN` | `counselor` (`is_active = true`) | `N/A (token unset)` | `BLOCKED` |
| Counselor B | `SICARE_COUNSELOR_B_TOKEN` | `counselor` (`is_active = true`) | `N/A (token unset)` | `BLOCKED` |

---

## 3. Resource Availability

Penemuan resource dilakukan secara **read-only** melalui endpoint koleksi terautentikasi (`GET /api/v1/bookings`, `GET /api/v1/sessions`, `GET /api/v1/feedback/mine`, `GET /api/v1/notifications`, `GET /api/v1/counselor/availability`) tanpa mengarang UUID baru dan tanpa membuat record baru:

| Resource Uji | Pasangan Kepemilikan | Metode Penemuan Read-Only | Status Saat Ini |
|---|---|---|---|
| `Booking A` | `Client A` + `Counselor A` | `GET /api/v1/bookings` (Client A) | `BLOCKED` (menunggu 4 token akun uji) |
| `Booking B` | `Client B` + `Counselor B` | `GET /api/v1/bookings` (Client B) | `BLOCKED` (menunggu 4 token akun uji) |
| `Session A` | `Booking A` (`Client A` + `Counselor A`) | `GET /api/v1/sessions` (Client A / Counselor A) | `BLOCKED` (menunggu 4 token akun uji) |
| `Session B` | `Booking B` (`Client B` + `Counselor B`) | `GET /api/v1/sessions` (Client B / Counselor B) | `BLOCKED` (menunggu 4 token akun uji) |
| `Feedback A / B` | `Client A` atau `Client B` | `GET /api/v1/feedback/mine` | `BLOCKED` (menunggu 4 token akun uji) |
| `Notifications` | Masing-masing `recipient_user_id` | `GET /api/v1/notifications` | `BLOCKED` (menunggu 4 token akun uji) |
| `Availability Slot A / B` | `Counselor A` / `Counselor B` | `GET /api/v1/counselor/availability` | `BLOCKED` (menunggu 4 token akun uji) |

---

## 4. Backend API Ownership Results

> **Catatan Penting:** Pengujian Backend API (`API-*`) memverifikasi otorisasi aplikasi Express (`requireAuth`, `requireRoles`, dan filter query pada route handler `be/src/routes/*.js`). Karena backend menggunakan `supabaseAdmin` (`service_role`), hasil Backend API **tidak** diklaim sebagai bukti penegakan PostgreSQL RLS.

- **Ringkasan Eksekusi `npm run verify:ownership` (Backend API):**
  - `PASS`: `0`
  - `FAIL`: `0`
  - `BLOCKED`: `29` (`API-BK-01` s/d `API-BK-10`, `API-SS-01` s/d `API-SS-08`, `API-FB-01` s/d `API-FB-04`, `API-NT-01` s/d `API-NT-04`, `API-CS-01` s/d `API-CS-03`)
  - `NOT TESTED`: `6` (`MUT-01` s/d `MUT-06` — sengaja tidak dijalankan karena Batch 1.3c bersifat strictly read-only)
- **Bukti Pendukung Non-Cross-User yang Telah Terverifikasi:**
  - `npm test` (`be/test/ownershipGuards.test.js`): **20/20 PASS** (mencakup 11 pengujian runtime HTTP in-memory untuk isolasi lintas akun Client A/B dan Counselor A/B pada booking, session, feedback, notification, counselor availability, dan admin/head_lmi).
  - `npm run verify:live`: **15/15 PASS** untuk endpoint publik (`200`) dan penolakan tanpa token (`401`).

---

## 5. Direct PostgREST RLS Results

Pemeriksaan PostgREST RLS dirancang menggunakan `createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)` dengan header `Authorization: Bearer <user_access_token>` (tanpa `SUPABASE_SECRET_KEY`).

### Klasifikasi Tabel & Kebijakan RLS Aktif (`supabase/migrations/*.sql`)

1. **Category A — Tabel dengan Akses Baca Hanya Milik Sendiri (`auth.uid()`):**
   - `public.profiles`: Policy `profiles_select_self` (`id = (select auth.uid())`), `grant select on public.profiles to authenticated`.
   - `public.feedback`: Policy `feedback_select_submitter` (`client_id = (select auth.uid())`), `grant select on public.feedback to authenticated`. *(Catatan: konselor tidak memiliki policy `SELECT` langsung pada tabel `public.feedback` di PostgREST; konselor membaca feedback yang diizinkan melalui endpoint backend `GET /api/v1/feedback/counselor`.)*
   - `public.notifications`: Policy `notifications_select_recipient` (`recipient_user_id = (select auth.uid())`), `grant select on public.notifications to authenticated`.
2. **Category B — Tabel dengan Akses Baca Berdasarkan Relasi Pihak Booking / Visibilitas Publik:**
   - `public.bookings`: Policy `bookings_select_parties` (`client_id = (select auth.uid()) or counselor_id = (select auth.uid())`).
   - `public.booking_participants`: Policy `booking_participants_select_parties` (`exists` pada `public.bookings` untuk `client_id` atau `counselor_id`).
   - `public.counseling_sessions`: Policy `counseling_sessions_select_parties` (`exists` pada `public.bookings` untuk `client_id` atau `counselor_id`).
   - `public.counselor_profiles`: Policy `counselor_profiles_select_public` (`is_public_counselor(profile_id)`) **ATAU** `counselor_profiles_select_owner` (`profile_id = (select auth.uid()) and current_app_role() = 'counselor'`).
   - `public.availability_slots`: Policy `availability_slots_select_public` (`status = 'available' and is_public_counselor(counselor_id)`) **ATAU** `availability_slots_select_owner` (`counselor_id = (select auth.uid()) and current_app_role() = 'counselor'`).
   - `public.academic_periods`: Policy `academic_periods_select_published` (`is_published = true`).
3. **Category C — Tabel & RPC Server-Only (Akses Langsung `authenticated` Ditolak):**
   - `public.audit_events`: RLS aktif, tanpa policy `authenticated`, `revoke all on public.audit_events from anon, authenticated` (`42501`).
   - `public.whatsapp_outbox`: RLS aktif, tanpa policy `authenticated`, `revoke all on public.whatsapp_outbox from anon, authenticated` (`42501`).
   - `public.hero_motivations`: RLS aktif, tanpa policy `authenticated`, `revoke all on public.hero_motivations from public, anon, authenticated` (`42501`).
   - Seluruh RPC `public.sicare_*` (`sicare_create_booking`, `sicare_transition_booking`, `sicare_reschedule_booking`, `sicare_transition_session`, `sicare_submit_feedback`, `sicare_public_availability`, `sicare_save_availability_slot`, `sicare_cancel_availability_slot`): `revoke all ... from public, anon, authenticated; grant execute ... to service_role` (`42501`).

- **Ringkasan Eksekusi `npm run verify:ownership` (Direct Authenticated PostgREST RLS):**
  - `PASS`: `0`
  - `FAIL`: `0`
  - `BLOCKED`: `13` (`RLS-A-01` s/d `RLS-A-04`, `RLS-B-01` s/d `RLS-B-05`, `RLS-C-01` s/d `RLS-C-04`)
  - `NOT TESTED`: `0`
- **Catatan Pemisahan Bukti:** Probe RLS anonim pada Stage 1.3 (`11/11 PASS` menggunakan `SUPABASE_PUBLISHABLE_KEY` tanpa JWT user) membuktikan penolakan role `anon`, namun **tidak** menggantikan verifikasi RLS role `authenticated` (`RLS-A-*`, `RLS-B-*`, `RLS-C-*`).

---

## 6. Full Test Matrix

| ID | Test | Account | Resource owner | Expected | Actual | Status |
|---|---|---|---|---|---|---|
| `API-BK-01` | `(API)` Client A lists own bookings only | Client A | Client A | HTTP 200, only Client A rows | BLOCKED (Missing environment tokens) | `BLOCKED` |
| `API-BK-02` | `(API)` Client B lists own bookings only | Client B | Client B | HTTP 200, only Client B rows | BLOCKED (Missing environment tokens) | `BLOCKED` |
| `API-BK-03` | `(API)` Client A retrieves Booking A detail | Client A | Client A | HTTP 200, Booking A | BLOCKED (Missing environment tokens) | `BLOCKED` |
| `API-BK-04` | `(API)` Client B cannot retrieve Booking A detail | Client B | Client A | HTTP 404 `BOOKING_NOT_FOUND` | BLOCKED (Missing environment tokens) | `BLOCKED` |
| `API-BK-05` | `(API)` Client B retrieves Booking B detail | Client B | Client B | HTTP 200, Booking B | BLOCKED (Missing environment tokens) | `BLOCKED` |
| `API-BK-06` | `(API)` Client A cannot retrieve Booking B detail | Client A | Client B | HTTP 404 `BOOKING_NOT_FOUND` | BLOCKED (Missing environment tokens) | `BLOCKED` |
| `API-BK-07` | `(API)` Counselor A lists assigned bookings only | Counselor A | Counselor A | HTTP 200, only Counselor A rows | BLOCKED (Missing environment tokens) | `BLOCKED` |
| `API-BK-08` | `(API)` Counselor B lists assigned bookings only | Counselor B | Counselor B | HTTP 200, only Counselor B rows | BLOCKED (Missing environment tokens) | `BLOCKED` |
| `API-BK-09` | `(API)` Counselor A cannot retrieve Booking B detail | Counselor A | Counselor B | HTTP 404 `BOOKING_NOT_FOUND` | BLOCKED (Missing environment tokens) | `BLOCKED` |
| `API-BK-10` | `(API)` Counselor B cannot retrieve Booking A detail | Counselor B | Counselor A | HTTP 404 `BOOKING_NOT_FOUND` | BLOCKED (Missing environment tokens) | `BLOCKED` |
| `API-SS-01` | `(API)` Client A retrieves Session A detail | Client A | Client A / Counselor A | HTTP 200, Session A | BLOCKED (Missing environment tokens) | `BLOCKED` |
| `API-SS-02` | `(API)` Client B cannot retrieve Session A detail | Client B | Client A / Counselor A | HTTP 404 `SESSION_NOT_FOUND` | BLOCKED (Missing environment tokens) | `BLOCKED` |
| `API-SS-03` | `(API)` Counselor A retrieves Session A detail | Counselor A | Client A / Counselor A | HTTP 200, Session A | BLOCKED (Missing environment tokens) | `BLOCKED` |
| `API-SS-04` | `(API)` Counselor B cannot retrieve Session A detail | Counselor B | Client A / Counselor A | HTTP 404 `SESSION_NOT_FOUND` | BLOCKED (Missing environment tokens) | `BLOCKED` |
| `API-SS-05` | `(API)` Client B retrieves Session B detail | Client B | Client B / Counselor B | HTTP 200, Session B | BLOCKED (Missing environment tokens) | `BLOCKED` |
| `API-SS-06` | `(API)` Client A cannot retrieve Session B detail | Client A | Client B / Counselor B | HTTP 404 `SESSION_NOT_FOUND` | BLOCKED (Missing environment tokens) | `BLOCKED` |
| `API-SS-07` | `(API)` Counselor B retrieves Session B detail | Counselor B | Client B / Counselor B | HTTP 200, Session B | BLOCKED (Missing environment tokens) | `BLOCKED` |
| `API-SS-08` | `(API)` Counselor A cannot retrieve Session B detail | Counselor A | Client B / Counselor B | HTTP 404 `SESSION_NOT_FOUND` | BLOCKED (Missing environment tokens) | `BLOCKED` |
| `API-FB-01` | `(API)` Client A `/feedback/mine` returns only Client A rows | Client A | Client A | HTTP 200, only Client A rows | BLOCKED (Missing environment tokens) | `BLOCKED` |
| `API-FB-02` | `(API)` Client B `/feedback/mine` returns only Client B rows | Client B | Client B | HTTP 200, only Client B rows | BLOCKED (Missing environment tokens) | `BLOCKED` |
| `API-FB-03` | `(API)` Counselor A `/feedback/counselor` returns only Counselor A shown feedback | Counselor A | Counselor A | HTTP 200, Counselor A shown rows only | BLOCKED (Missing environment tokens) | `BLOCKED` |
| `API-FB-04` | `(API)` Cross-user `GET /feedback/:id` is rejected with 404 | Non-owner | Feedback owner | HTTP 404 `FEEDBACK_NOT_FOUND` | BLOCKED (Missing environment tokens) | `BLOCKED` |
| `API-NT-01` | `(API)` Client A notifications list contains only Client A rows | Client A | Client A | HTTP 200, `recipient_user_id === Client A` | BLOCKED (Missing environment tokens) | `BLOCKED` |
| `API-NT-02` | `(API)` Client B notifications list contains only Client B rows | Client B | Client B | HTTP 200, `recipient_user_id === Client B` | BLOCKED (Missing environment tokens) | `BLOCKED` |
| `API-NT-03` | `(API)` Counselor A notifications list contains only Counselor A rows | Counselor A | Counselor A | HTTP 200, `recipient_user_id === Counselor A` | BLOCKED (Missing environment tokens) | `BLOCKED` |
| `API-NT-04` | `(API)` Counselor B notifications list contains only Counselor B rows | Counselor B | Counselor B | HTTP 200, `recipient_user_id === Counselor B` | BLOCKED (Missing environment tokens) | `BLOCKED` |
| `API-CS-01` | `(API)` Counselor A `/counselor/me` and `/counselor/availability` return only Counselor A data | Counselor A | Counselor A | HTTP 200, `profile.id === Counselor A` | BLOCKED (Missing environment tokens) | `BLOCKED` |
| `API-CS-02` | `(API)` Counselor B `/counselor/me` and `/counselor/availability` return only Counselor B data | Counselor B | Counselor B | HTTP 200, `profile.id === Counselor B` | BLOCKED (Missing environment tokens) | `BLOCKED` |
| `API-CS-03` | `(API)` Client A is rejected from `/counselor/*` endpoints with 403 `AUTH_FORBIDDEN` | Client A | Counselor role | HTTP 403 `AUTH_FORBIDDEN` | BLOCKED (Missing environment tokens) | `BLOCKED` |
| `RLS-A-01` | `(RLS)` `profiles`: Client A reads only own profile and gets 0 rows for Client B | Client A | Client A / Client B | 1 own row, 0 cross-user rows | BLOCKED (Missing environment tokens) | `BLOCKED` |
| `RLS-A-02` | `(RLS)` `profiles`: Counselor A reads only own profile and gets 0 rows for Counselor B | Counselor A | Counselor A / Counselor B | 1 own row, 0 cross-user rows | BLOCKED (Missing environment tokens) | `BLOCKED` |
| `RLS-A-03` | `(RLS)` `feedback`: submitter-only `SELECT` enforced across Client B & Counselor A | Client A, B, Counselor A | Client A | Owner only; 0 rows for others | BLOCKED (Missing environment tokens) | `BLOCKED` |
| `RLS-A-04` | `(RLS)` `notifications`: recipient-only `SELECT` enforced across all 4 accounts | All 4 accounts | Each recipient | 0 cross-recipient rows | BLOCKED (Missing environment tokens) | `BLOCKED` |
| `RLS-B-01` | `(RLS)` `bookings`: Client B `SELECT` on Booking A returns 0 rows | Client B | Client A | HTTP 200, 0 rows | BLOCKED (Missing environment tokens) | `BLOCKED` |
| `RLS-B-02` | `(RLS)` `bookings`: Counselor B `SELECT` on Booking A returns 0 rows | Counselor B | Counselor A | HTTP 200, 0 rows | BLOCKED (Missing environment tokens) | `BLOCKED` |
| `RLS-B-03` | `(RLS)` `booking_participants`: non-party `SELECT` returns 0 rows | Client B / Counselor B | Booking A | HTTP 200, 0 rows | BLOCKED (Missing environment tokens) | `BLOCKED` |
| `RLS-B-04` | `(RLS)` `counseling_sessions`: non-party `SELECT` on Session A/B returns 0 rows | Client B / Counselor B | Session A | HTTP 200, 0 rows | BLOCKED (Missing environment tokens) | `BLOCKED` |
| `RLS-B-05` | `(RLS)` `availability_slots`: Counselor B cannot `SELECT` non-available slots of Counselor A | Counselor B | Counselor A | HTTP 200, 0 rows | BLOCKED (Missing environment tokens) | `BLOCKED` |
| `RLS-C-01` | `(RLS)` `audit_events`: direct authenticated `SELECT` denied | Client A / Counselor A | System | Permission denied (`42501`) | BLOCKED (Missing environment tokens) | `BLOCKED` |
| `RLS-C-02` | `(RLS)` `whatsapp_outbox`: direct authenticated `SELECT` denied | Client A / Counselor A | System | Permission denied (`42501`) | BLOCKED (Missing environment tokens) | `BLOCKED` |
| `RLS-C-03` | `(RLS)` `hero_motivations`: direct authenticated `SELECT` denied | Client A / Counselor A | System | Permission denied (`42501`) | BLOCKED (Missing environment tokens) | `BLOCKED` |
| `RLS-C-04` | `(RLS)` `sicare_public_availability` RPC: direct authenticated `EXECUTE` denied | Client A / Counselor A | System | Permission denied (`42501`) | BLOCKED (Missing environment tokens) | `BLOCKED` |
| `MUT-01` | `(API)` Client B `PATCH /bookings/:idA/status` (cancel) | Client B | Client A | HTTP 403 `BOOKING_FORBIDDEN` | NOT TESTED (Batch 1.3c is strictly read-only) | `NOT TESTED` |
| `MUT-02` | `(API)` Client B `PATCH /bookings/:idA/reschedule` | Client B | Client A | HTTP 403 `BOOKING_FORBIDDEN` | NOT TESTED (Batch 1.3c is strictly read-only) | `NOT TESTED` |
| `MUT-03` | `(API)` Counselor B `PATCH /sessions/:sidA/status` | Counselor B | Counselor A | HTTP 403 `SESSION_FORBIDDEN` | NOT TESTED (Batch 1.3c is strictly read-only) | `NOT TESTED` |
| `MUT-04` | `(API)` Client B `PATCH /notifications/:nidA/read` | Client B | Client A | HTTP 404 `NOTIFICATION_NOT_FOUND` | NOT TESTED (Batch 1.3c is strictly read-only) | `NOT TESTED` |
| `MUT-05` | `(API)` Counselor B `PATCH/DELETE /counselor/availability/:slotA` | Counselor B | Counselor A | HTTP 404 `AVAILABILITY_NOT_FOUND` | NOT TESTED (Batch 1.3c is strictly read-only) | `NOT TESTED` |
| `MUT-06` | `(API)` Client B `POST /sessions/:sidA/feedback` | Client B | Client A | HTTP 409 `FEEDBACK_NOT_ELIGIBLE` | NOT TESTED (Batch 1.3c is strictly read-only) | `NOT TESTED` |

---

## 7. Failed Checks

- **Jumlah `FAIL`:** `0`
- Tidak ada kegagalan otorisasi atau kebocoran data lintas pengguna yang terdeteksi.

---

## 8. Blocked Checks

- **Jumlah `BLOCKED`:** `42` (`29` pemeriksaan Backend API + `13` pemeriksaan Direct Authenticated PostgREST RLS).
- Seluruh 42 pemeriksaan berstatus `BLOCKED` karena keempat variabel environment token akun uji (`SICARE_CLIENT_A_TOKEN`, `SICARE_CLIENT_B_TOKEN`, `SICARE_COUNSELOR_A_TOKEN`, `SICARE_COUNSELOR_B_TOKEN`) belum diset di environment eksekusi saat ini.

---

## 9. Missing Prerequisites

Untuk membuka blokir (`UNBLOCK`) ke-42 pemeriksaan di atas, prasyarat berikut harus dipenuhi di environment non-production:

1. **Empat Akun Uji Non-Production yang Aktif (`is_active = true`):**
   - `Client A` (`role = 'client'`)
   - `Client B` (`role = 'client'`)
   - `Counselor A` (`role = 'counselor'`)
   - `Counselor B` (`role = 'counselor'`)
2. **Empat Access Token Supabase (`Bearer` JWT) pada Environment Shell:**
   - `SICARE_CLIENT_A_TOKEN`
   - `SICARE_CLIENT_B_TOKEN`
   - `SICARE_COUNSELOR_A_TOKEN`
   - `SICARE_COUNSELOR_B_TOKEN`
3. **Data Uji Berpasangan di Database Non-Production:**
   - `Booking A` & `Session A` yang menghubungkan `Client A` dengan `Counselor A`.
   - `Booking B` & `Session B` yang menghubungkan `Client B` dengan `Counselor B`.
   - Minimal 1 `feedback` milik `Client A` atau `Client B`, minimal 1 `notification` per akun, dan minimal 1 `availability_slot` milik `Counselor A`/`Counselor B`.
4. **Server Backend Lokal Aktif:**
   - Menjalankan `npm run start` di `be/` (`http://127.0.0.1:3000`) sebelum mengeksekusi `npm run verify:ownership`.

---

## 10. Security Findings

1. **Pemisahan Jelas antara Otorisasi Backend (`service_role`) dan PostgreSQL RLS (`authenticated`):**
   - Backend Express menggunakan `getSupabaseAdminClient()` (`SUPABASE_SECRET_KEY`), sehingga keamanan endpoint `/api/v1/*` bergantung penuh pada middleware `requireAuth`, `requireRoles`, validasi `req.auth.user.id` di tiap route handler, serta validasi `p_actor_id` di dalam fungsi SQL `sicare_*`.
   - Sebaliknya, akses langsung ke Supabase PostgREST menggunakan `SUPABASE_PUBLISHABLE_KEY` + JWT user dikendalikan oleh `GRANT`/`REVOKE` tabel dan kebijakan `CREATE POLICY ... TO authenticated`.
2. **Temuan Granularitas Kolom PostgREST (S1 & S2 dari Audit Stage 1.3 Tetap Berlaku):**
   - **S1 (`public.counseling_sessions`):** Policy `counseling_sessions_select_parties` mengizinkan `Client A` (sebagai pihak booking) melakukan `SELECT` langsung via PostgREST pada baris sesi miliknya, termasuk kolom `counselor_notes_summary` dan `cancelled_reason` karena `grant select on public.counseling_sessions to authenticated` bersifat table-level.
   - **S2 (`public.bookings`):** Policy `bookings_select_parties` mengizinkan `Counselor A` melakukan `SELECT` langsung via PostgREST pada baris booking yang ditugaskan kepadanya, termasuk kolom `anon_token_hash` apabila booking tersebut berjenis anonim.
   - Kedua poin ini tidak memengaruhi isolasi lintas pengguna (`Client B` dan `Counselor B` tetap mendapatkan `0 rows`), namun relevan jika akses PostgREST langsung dari browser diaktifkan di masa depan.

---

## 11. Remaining Risks

1. **Eksekusi Live Lintas Akun Belum Terbukti di Runtime Supabase:**
   - Meskipun logika route backend telah terbukti `20/20 PASS` pada `be/test/ownershipGuards.test.js` dan RLS anonim terbukti `11/11 PASS`, verifikasi live menggunakan 4 JWT `authenticated` nyata pada Supabase non-production masih `BLOCKED` hingga token dan data uji berpasangan disuplai.
2. **Pengujian Mutasi Negatif Live (`MUT-01` s/d `MUT-06`) Belum Dijalankan Secara Live:**
   - Karena Batch 1.3c dibatasi secara ketat pada operasi baca (`GET` / `SELECT`), pengujian mutasi negatif telah diverifikasi melalui test suite runtime in-memory (`be/test/ownershipGuards.test.js`) dan dicatat sebagai `NOT TESTED` pada matriks live.

---

## 12. Recommended Next Steps

1. Jalankan backend lokal pada terminal pertama:
   ```powershell
   cd be
   npm run start
   ```
2. Pada terminal kedua (non-production), set keempat variabel token akun uji dan jalankan skrip verifikasi:
   ```powershell
   cd be
   $env:SICARE_CLIENT_A_TOKEN="<jwt-client-a>"
   $env:SICARE_CLIENT_B_TOKEN="<jwt-client-b>"
   $env:SICARE_COUNSELOR_A_TOKEN="<jwt-counselor-a>"
   $env:SICARE_COUNSELOR_B_TOKEN="<jwt-counselor-b>"
   npm run verify:ownership
   ```
3. Perbarui hasil aktual pada laporan ini dan `docs/PROJECT_STATUS.md` setelah keempat akun serta resource pasangan tersedia.
