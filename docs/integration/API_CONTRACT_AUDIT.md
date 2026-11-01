# Audit Kontrak API SiCARE

**Tanggal:** 30 Oktober 2026
**Tahap:** 1, Batch 1.2 dan 1.3
**Baseline:** audit statis Batch 1.1 terhadap `SiCARE(8).zip` dan verifikasi runtime P0.
**Status:** DTO kanonis dan wrapper per domain telah ditambahkan. Build/lint penuh perlu dikonfirmasi pada mesin pengembangan pengguna karena instalasi dependency di lingkungan audit terhenti akibat timeout registry.

## Ringkasan

Batch 1.2 menyelaraskan definisi tipe frontend dengan proyeksi query dan response backend yang ada. Perubahan ini tidak mengubah route backend, skema database, atau migrasi. Wrapper tetap memakai `apiRequest()` sebagai transport terpusat sehingga envelope response, autentikasi, timeout, dan `ApiError` tetap dikelola pada satu tempat.

## Hasil per temuan Batch 1.1

| ID | Temuan awal | Hasil Batch 1.2 | Status |
|---|---|---|---|
| API-01 | `PublicCounselor` didefinisikan di dua wrapper | Definisi DTO publik dipindahkan ke `fe/src/types/api.ts`; wrapper lama mengekspor alias kompatibilitas. | Ditangani |
| API-02 | Dua wrapper availability memiliki union status berbeda | `getPublicAvailability()` menjadi wrapper publik kanonis; method publik yang duplikat di `sicareApi` dihapus. DTO publik hanya menyatakan status `available`, sesuai filter backend. | Ditangani |
| API-03 | DTO booking memuat nested `counselor` yang tidak dikembalikan query | `BookingListItemDto`/`BookingDetailDto` mengikuti proyeksi aktual dan tidak lagi mengklaim ada nested counselor. UI klien menggunakan `counselor_id` untuk mencocokkan nama publik dari direktori konselor; jika konselor tidak ada pada direktori publik, UI memakai fallback “Konselor”. | Ditangani |
| API-04 | Satu tipe sesi mewakili respons list dan detail sekaligus | `SessionListItemDto` tidak memiliki nested booking. `SessionDetailDto` memiliki ringkasan booking yang dikembalikan endpoint detail/status. Nested counselor tidak diklaim tersedia. | Ditangani |
| API-05 | Satu tipe feedback dipakai untuk konteks berbeda | DTO terpisah tersedia untuk feedback publik, feedback klien, hasil submit, feedback konselor, dan feedback admin. | Ditangani |
| API-06 | `apiRequest<T>()` tidak memvalidasi bentuk JSON saat runtime | Belum ditambahkan validasi runtime. Generic TypeScript tetap merupakan deklarasi tipe, bukan validator payload. Penambahan schema runtime ditunda sampai batch kontrak state/error agar cakupannya bisa dipilih berdasarkan risiko. | Ditunda |
| API-07 | Wrapper domain untuk admin, konselor, dan reporting belum tersedia | Wrapper `counselorApi`, `adminApi`, dan `reportingApi` ditambahkan. Hero publik dan CRUD Hero admin juga dipindahkan dari pemanggilan `apiRequest` langsung ke wrapper domain. | Ditangani untuk wrapper |
| API-08 | ID resource backend menggunakan UUID, sementara fixture lama bisa memakai ID tampilan | UUID backend ditetapkan sebagai ID kanonis; owner filter route/RPC utama telah diaudit statis. ID numerik tersisa di mock fixture untuk halaman yang belum diintegrasikan. | Audit statis selesai; live cross-user test pending |

## Struktur wrapper setelah Batch 1.2

- `fe/src/lib/api.ts`: transport HTTP, sesi bearer token, timeout, envelope response, dan error API.
- `fe/src/lib/apiQuery.ts`: serialisasi query string yang konsisten. Hanya `null`/`undefined` dihilangkan; nilai `false` dan `0` tetap dikirim.
- `fe/src/lib/publicApi.ts`: direktori konselor, periode publik, availability publik, feedback publik, motivasi Hero publik, dan URL foto publik.
- `fe/src/lib/sicareApi.ts`: profil, WhatsApp consent, booking, sesi, feedback klien, dan notifikasi yang memerlukan autentikasi.
- `fe/src/lib/counselorApi.ts`: profil konselor, availability konselor, dan feedback konselor.
- `fe/src/lib/adminApi.ts`: akun, periode, publikasi konselor, daftar konseling, aktivitas, Hero, serta antrean/statistik feedback.
- `fe/src/lib/reportingApi.ts`: dashboard dan laporan Admin serta Kepala LMI.
- `fe/src/types/api.ts`: DTO kanonis untuk kontrak `/api/v1`.

DTO lama yang diimpor halaman yang sudah terhubung tetap diekspor sebagai alias kompatibilitas. Alias ini dimaksudkan untuk migrasi bertahap, bukan sebagai definisi kontrak tambahan.

## Catatan penting tentang bentuk respons

- Daftar booking dan detail booking saat ini menggunakan proyeksi booking yang sama. Dua nama tipe dipertahankan untuk membedakan konteks pemakaian tanpa mengklaim field tambahan.
- Daftar sesi hanya mengembalikan row sesi. Detail dan perubahan status sesi juga mengembalikan konteks booking.
- Query booking klien/konselor tidak mengembalikan objek counselor. Karena itu, UI tidak boleh mengandalkan `booking.counselor.full_name`.
- Endpoint feedback memiliki proyeksi berbeda menurut konteks. Jangan membuat field `client_id`, `disabled_reason`, atau status moderasi seolah selalu tersedia pada semua endpoint feedback.
- Wrapper tidak menggantikan otorisasi backend. Role yang benar tetap harus diverifikasi oleh middleware server.
- `apiRequest<T>()` belum memvalidasi schema JSON saat runtime. Jangan menganggap deklarasi tipe sebagai bukti bahwa payload server telah divalidasi.

## Pemeriksaan yang dilakukan pada Batch 1.2

- Type-check terisolasi dengan TypeScript strict pada DTO dan enam wrapper API menggunakan stub transport: **PASS**.
- Pemeriksaan sintaks/transpilasi pada lima halaman TSX yang berubah: **PASS**.
- Validasi awal pengguna: `npm run lint` lulus, tetapi `npm run build` menemukan dua error tipe di `KlienBerandaPage.tsx` karena halaman masih mengakses nested `booking.counselor` dan `session.booking.counselor` yang memang tidak ada dalam DTO kanonis.
- Koreksi: `KlienBerandaPage.tsx` sekarang memetakan `counselor_id` ke `profile_id` dari direktori konselor publik. Permintaan direktori bersifat best-effort sehingga kegagalan direktori tidak menggagalkan pemuatan ringkasan utama. Jika konselor tidak ada di direktori publik, UI menampilkan fallback “Konselor”.
- Setelah koreksi, pengguna menjalankan `npm run build` dan `npm run lint`: keduanya **PASS**. Build tetap menampilkan peringatan non-blocking ukuran bundle utama sekitar 1,30 MB sebelum gzip.
- Backend dan database tidak diubah pada batch ini.

## Koreksi setelah validasi pengguna

Build pengguna menemukan dua error TypeScript di `KlienBerandaPage.tsx`: akses `upcoming.booking.counselor` dan `nextBooking.counselor` tidak sesuai dengan kontrak backend. Perbaikan menghindari perluasan DTO yang tidak didukung backend dan memakai lookup nama publik berdasarkan ID konselor. Tidak ada perubahan backend, skema, atau database.

## Batch 1.3: ID kanonis dan ownership

Audit rinci tersedia di [`ID_OWNERSHIP_AUDIT.md`](ID_OWNERSHIP_AUDIT.md). Pemeriksaan statis menemukan pola owner filter pada booking, sesi, feedback, notifikasi, profil, dan jadwal. ID domain backend adalah UUID dan DTO API memakai `string`; ID numerik yang masih tersisa berada di fixture mock dan tidak boleh digunakan untuk operasi API.

Regression test baru `be/test/ownershipGuards.test.js` lulus secara terisolasi (9/9). Tes ini statis, bukan pengujian isolasi runtime. Pengujian lintas-pengguna dengan dua akun client dan dua akun counselor masih dibutuhkan untuk menutup Batch 1.3.

## Berikutnya

Jalankan seluruh suite backend, lalu lakukan live cross-user verification menggunakan dua akun client dan dua akun counselor berbeda. Jangan mengubah role atau data remote untuk membuat tes lulus.


## Finalisasi Hero Motivation setelah validasi test

Pemeriksaan source terkini mengonfirmasi bahwa UI Hero sudah memakai wrapper domain, sehingga pemanggilan langsung `apiRequest` di dalam halaman bukan lagi kontrak yang benar untuk dijadikan assertion.

| Area | Kontrak yang diverifikasi | Status
|---|---|---|
| Admin page | `AdminPengaturanPage.tsx` memakai `adminApi.listHeroMotivations`, `createHeroMotivation`, `updateHeroMotivation`, dan `deleteHeroMotivation`. | PASS statis |
| Admin wrapper | `adminApi.ts` memakai `GET/POST/PATCH/DELETE /admin/hero-motivations` dan `auth: true` untuk seluruh operasi. | PASS statis |
| Public page | `HomePage.tsx` memanggil `getPublicHeroMotivations()`, memilih konten nonkosong, menggunakan kalimat fallback, dan merender state Hero. | PASS statis |
| Public wrapper | `publicApi.ts` memanggil `GET /public/hero-motivations` melalui transport terpusat. | PASS statis |
| Backend public route | Query hanya mengambil `is_active = true`. | PASS statis |
| Regression test | Assertion diperbarui agar mengikuti wrapper saat ini, bukan pola `apiRequest` ad hoc yang sudah diganti. | 5/5 focused tests PASS |

Tes source-level ini tidak membuktikan tampilan browser, rotasi kalimat pada refresh di semua kondisi, atau respons runtime Supabase. Live API smoke test Hero sebelumnya mengembalikan HTTP 200, tetapi full suite setelah perubahan assertion tetap harus dijalankan pada mesin pengembang.


## Pembaruan Batch 1.4c: Kontrak Integrasi Halaman Counselor (30 Oktober 2026)

Pada Batch 1.4c, ketujuh halaman Counselor (`KonselorPermintaanPage`, `KonselorBerandaPage`, `KonselorAktivitasPage`, `KonselorPengaturanPage`, `KonselorJadwalPage`, `KonselorRiwayatPage`, `KonselorFeedbackPage`) telah dihubungkan ke wrapper `sicareApi`, `counselorApi`, dan `publicApi`. Temuan dan penyesuaian kontrak yang diterapkan:

| ID | Kontrak API & Database | Penanganan Frontend pada Batch 1.4c |
|---|---|---|
| `CM-03` | `PATCH /api/v1/bookings/:id/status` memerlukan `session_format: "online" \| "offline"` dan `room?: string \| null` (maks 240 karakter) untuk `confirmed`, serta `reason: string` (1–1000 karakter) untuk `rejected` dan `reschedule_requested` (`strict()`, menolak `meeting_url`). | Komponen bersama `BookingDecisionModal.tsx` mengirim payload kanonis yang tervalidasi ke `sicareApi.transitionBooking` tanpa field `meeting_url`. |
| `SQL-RESCHEDULE` | Migrasi aktif `20261028120000_sicare_public_availability_rescheduling.sql` telah menambahkan kolom `reschedule_reason` pada `public.bookings` dan memperbarui fungsi `public.sicare_transition_booking` untuk menyimpan `reschedule_reason = nullif(pg_catalog.btrim(p_reason), '')` saat `p_target_status = 'reschedule_requested'` serta membuka kembali slot (`status = 'available'`). | UI menampilkan `booking.reschedule_reason` dan `booking.cancellation_reason` secara terpisah di `KonselorPermintaanPage`, `KonselorAktivitasPage`, dan `KonselorRiwayatPage`. |
| `CM-04` | `PATCH /api/v1/sessions/:id/status` hanya menerima `{ status: "ongoing" \| "completed" \| "cancelled" }` (`strict()`). Saat sesi dibatalkan oleh konselor, fungsi SQL `sicare_transition_session` otomatis mengisi `bookings.cancellation_reason = 'Sesi dibatalkan oleh konselor'`. | `KonselorAktivitasPage` dan `KonselorJadwalPage` memanggil `sicareApi.transitionSession(id, { status })` tanpa memblokir penyelesaian sesi pada input catatan klinis dan menjelaskan mekanisme pembatalan sistem secara jujur. |
| `CM-01` / `CM-05` | `POST /api/v1/counselor/availability` dan `PATCH /api/v1/counselor/availability/:id` memerlukan `{ starts_at, ends_at, academic_period_id }` dengan ISO 8601 bertimezone; `DELETE /api/v1/counselor/availability/:id` membatalkan slot yang belum terpesan. | `KonselorJadwalPage` membangun ISO timestamp dari tanggal dan menit mulai (`new Date(...).toISOString()`), mencocokkan tanggal slot dengan `getPublicAcademicPeriods()` (`starts_on <= date <= ends_on`), serta membedakan slot `available` vs `blocked`. |
| `CM-06` | `PATCH /api/v1/counselor/profile` mendukung `{ public_name, headline, bio, specialties, years_experience, photo_path }` dan mengembalikan `404 COUNSELOR_PROFILE_NOT_FOUND` jika baris `counselor_profiles` belum dibuat Admin; `is_public` dikendalikan Admin. | `KonselorPengaturanPage` menggabungkan `sicareApi.updateProfile` (`full_name`, `phone_e164`) dan `counselorApi.updateProfile` dengan rekonsiliasi penyimpanan parsial, mengonversi tahun mulai praktik ke `years_experience`, menampilkan `is_public` sebagai badge read-only, dan menangani `404` secara elegan. |
| `CLIENT-ID-PROJ` | Proyeksi `GET /api/v1/bookings` dan `GET /api/v1/sessions` tidak melakukan join ke `profiles.full_name` milik klien individu (hanya menyediakan `client_id`, `group_name`, dan `booking_participants`). | Helper `formatBookingClientTitle` menampilkan `Kelompok ${booking.group_name}` (beserta daftar `booking_participants`) untuk layanan kelompok, dan `Klien Individu · #${client_id.slice(0, 8).toUpperCase()}` untuk layanan individu tanpa mengarang nama klien fiktif. |


## Pembaruan Batch 1.4d: Kontrak Integrasi Halaman Admin (30 Oktober 2026)

Pada Batch 1.4d, kedelapan halaman Admin (`AdminPeriodePage`, `AdminAkunPage`, `AdminFeedbackPage`, `AdminKonselingPage`, `AdminAktivitasPage`, `AdminBerandaPage`, `AdminLaporanPage`, `AdminPengaturanPage`) serta komponen `DashboardSections.tsx` dan helper `academicPeriods.ts` telah dihubungkan ke wrapper `adminApi`, `reportingApi`, `publicApi`, dan `sicareApi`. Temuan dan penyesuaian kontrak yang diterapkan:

| ID | Kontrak API & Database | Penanganan Frontend pada Batch 1.4d |
|---|---|---|
| `CM-09` (Periode) | `GET/POST/PATCH/DELETE /api/v1/admin/periods` menggunakan `AcademicPeriodRecordDto` (`id: UUID`, `academic_year: "YYYY/YYYY"`, `semester: "Ganjil" \| "Genap"`, `starts_on`, `ends_on`, `is_published: boolean`). `DELETE /admin/periods/:id` mengembalikan `409 PERIOD_HAS_SLOTS` jika periode masih direferensikan oleh `availability_slots`. | `fe/src/lib/academicPeriods.ts` menambahkan `mapAcademicPeriodDto(dto)` dan `AdminPeriodePage.tsx` memanggil keempat endpoint `adminApi.*AcademicPeriod*`, menyediakan toggle `is_published`, serta menampilkan pesan error `409 PERIOD_HAS_SLOTS` tanpa menghapus state secara optimistik. |
| `CM-08` (Akun & Publikasi) | `POST /api/v1/admin/accounts` menerima `{ email, password, full_name, phone_e164?, app_role, member_category?, status? }` (`member_category: "student" \| "faculty_staff" \| "other" \| null`). `PATCH /api/v1/admin/accounts/:id` mengembalikan `UpdatedAdminAccountDto` (tanpa kolom `email`). `DELETE /api/v1/admin/accounts/:id` menonaktifkan akun (`status = 'disabled'`). `PATCH /api/v1/admin/counselors/:id/publication` mengubah `counselor_profiles.is_public`. | `AdminAkunPage.tsx` memetakan kategori UI (`Mahasiswa`/`Dosen`/`Staff`/`Konselor`/`Kepala LMI`/`Admin`) ke `app_role` + `member_category`, mempertahankan `email` saat update lokal dari respons `PATCH`, mencocokkan status publikasi konselor dengan `getPublicCounselors()`, dan memblokir deaktivasi akun Admin yang sedang login (`account.id === currentUser?.id`). |
| `CM-07` (Moderasi Feedback) | `PATCH /api/v1/admin/feedback/:id/moderation` (`allowRoles("admin")`) mewajibkan `disabled_reason` (3–1000 karakter) saat `moderation_status === "disabled"` (validasi Zod `superRefine`). Sebaliknya, `PATCH /api/v1/admin/feedback/:id/review` dibatasi untuk `allowRoles("head_lmi")`. | `AdminFeedbackPage.tsx` memvalidasi dan mengirim `disabled_reason` saat moderasi `"disabled"`, menghilangkan `disabled_reason` saat `"shown"` atau `"pending"`, menampilkan `review_status` sebagai badge read-only (`Baru`, `Ditinjau LMI`, `Ditindaklanjuti LMI`), serta menyamarkan identitas klien (`Klien Anonim #XXXX`). |
| `ADMIN-COUNSELING` | `GET /api/v1/admin/counseling` mengembalikan `AdminCounselingDto` yang telah menyamarkan identitas klien (tanpa `client_id` atau `group_name`), dengan `service_type: "individual" \| "group"`, `starts_at`, `ends_at`, `status`, dan `counseling_sessions: Array<{ id, status, format, room, started_at, completed_at }>`. | `AdminKonselingPage.tsx`, `AdminBerandaPage.tsx`, dan `AdminLaporanPage.tsx` menggunakan `AdminCounselingDto` secara read-only dengan label `Klien Anonim #XXXX`, memetakan nama konselor melalui `adminApi.listAccounts({ role: "counselor" })` dan `getPublicCounselors()`, serta menghitung beban kerja konselor dan analisis pembatalan secara akurat. |
| `CM-10` (Laporan & Truncation) | `GET /api/v1/admin/reports` mengembalikan `AdminReportDto` (`totals`, `monthly`, `counselors`, `truncated: boolean` bila query mencapai batas 1.000 baris). Database tidak menyimpan kolom `topic` pada `bookings` maupun `counseling_sessions`. | `AdminLaporanPage.tsx` menampilkan banner peringatan apabila `report.truncated === true` atau terdapat sesi di luar rentang periode akademik, mengganti tabel topik sintetis dengan tabel faktual `Distribusi format pelaksanaan & ulasan` (`Tatap Muka` vs `Online` + ulasan), serta menyediakan fitur cetak PDF (`window.print()`) dan ekspor CSV (`handleExportCsv`). |
| `CM-11` (Profil Admin) | `PATCH /api/v1/profile` hanya menerima `{ full_name, phone_e164 }` (`strict()`). | `AdminPengaturanPage.tsx` menghapus penyimpanan `localStorage` (`sicare_admin_profile_v1`), menghubungkan profil Admin ke `sicareApi.getProfile()`, `sicareApi.updateProfile({ full_name, phone_e164 })`, dan `useAuth().refreshProfile()`, sambil mempertahankan CRUD Hero Motivation (`adminApi.*HeroMotivation*`). |


## Pembaruan Batch 1.4e: Kontrak Integrasi Halaman Kepala LMI (31 Oktober 2026)

Pada Batch 1.4e, keempat halaman Kepala LMI (`KepalaLMIBerandaPage`, `KepalaLMIFeedbackPage`, `KepalaLMILaporanPage`, `KepalaLMIPengaturanPage`) serta komponen pendukung `DashboardSections.tsx` dan `presentation.ts` telah dihubungkan ke wrapper `reportingApi`, `adminApi`, `publicApi`, dan `sicareApi`. Temuan dan penyesuaian kontrak yang diterapkan:

| ID | Kontrak API & Database | Penanganan Frontend pada Batch 1.4e |
|---|---|---|
| `HEAD-LMI-DASHBOARD` | `GET /api/v1/head-lmi/dashboard` (`allowRoles("head_lmi")`) mengembalikan `AdminDashboardDto` (`users.active_clients`, `users.active_counselors`, `bookings.total`, `bookings.waiting_confirmation`, `bookings.confirmed`, `sessions.total`, `sessions.completed`, `feedback.pending_moderation`). Endpoint tidak menyediakan status ketersediaan real-time konselor ("Tersedia" / "Jadwal penuh"). | `KepalaLMIBerandaPage.tsx` dan `fe/src/components/headlmi/dashboard/DashboardSections.tsx` menggunakan metrik aktual dari backend, menghapus fixture `DASHBOARD_COUNTS`/`WEEKLY_SESSIONS`/`COUNSELOR_WORKLOAD`, dan memperbaiki navigasi CTA ke `/kepala-lmi/laporan`. |
| `HEAD-LMI-REPORTS` | `GET /api/v1/head-lmi/reports` (`allowRoles("head_lmi")`) mengembalikan `AdminReportDto` (`period: { from, to }`, `totals`, `monthly`, `counselors`, `truncated: boolean`). Backend mengagregasi data ~12 bulan terakhir dengan batasan 1.000 record per sumber tabel dan tidak menerima parameter filter semester. | `KepalaLMILaporanPage.tsx` menampilkan rentang tanggal aktual (`period.from` – `period.to`), menyajikan metrik nyata (`totals`, tren bulanan, beban konselor), menampilkan banner peringatan saat `report.truncated === true`, dan tidak mengarang pembagian sesi individu/kelompok atau alasan pembatalan yang tidak dikembalikan API. |
| `HEAD-LMI-REVIEW` | `PATCH /api/v1/admin/feedback/:id/review` (`allowRoles("head_lmi")`) menerima `{ review_status: "new" \| "reviewed" \| "resolved" }` (`strict()`). Kepala LMI tidak memiliki izin untuk memanggil `PATCH /admin/feedback/:id/moderation` (khusus role `admin`). | `KepalaLMIFeedbackPage.tsx` menghubungkan peninjauan feedback ke `adminApi.reviewFeedback`, menampilkan status moderasi admin secara read-only, melindungi privasi mahasiswa (menampilkan ref ID `#XXXX` tanpa email/NIM), serta menghapus filter kategori layanan sintetis. |
| `HEAD-LMI-PROFILE` | `PATCH /api/v1/profile` hanya menerima `{ full_name, phone_e164 }` (`strict()`). Backend belum menyediakan endpoint upload foto profil atau perubahan kata sandi untuk pimpinan. | `KepalaLMIPengaturanPage.tsx` mengintegrasikan `sicareApi.getProfile()`, `sicareApi.updateProfile({ full_name, phone_e164 })`, dan `useAuth().refreshProfile()`; menandai fitur upload foto dan ubah kata sandi sebagai disabled ("Fitur Belum Tersedia") secara jujur tanpa manipulasi `localStorage`. |

## Pembaruan Batch 1.5b: Fondasi Database Digital Informed Consent (31 Oktober 2026)

Pada Batch 1.5b, fondasi database dan service layer untuk Informed Consent digital (`docs/INFORMED_CONSENT_ARCHITECTURE.md`) telah diimplementasikan:

| ID | Kontrak & Skema Database | Spesifikasi Implementasi Batch 1.5b |
|---|---|---|
| `CONSENT-TPL` | Tabel `public.consent_templates` (`template_code`, `version`, `title`, `storage_bucket`, `storage_path`, `file_sha256`, `is_active`). Template aktif awal `SICARE_IC_STD v1.0` mengikat SHA-256 berkas master resmi `docs/reference/infromed-consent/informed-consent.pdf` (`59012141d8a54336928a4c076d9d0ad7276bbbc36064c37d9654cc031f14cd8f`). | RLS mengizinkan `SELECT` untuk seluruh pengguna terautentikasi aktif agar dapat meninjau isi surat pernyataan. Pengubahan template dibatasi ke `service_role`. |
| `CONSENT-PARTICIPANT` | Ekstensi `public.booking_participants` (`user_id`, `participant_type`, `full_name`, `faculty`, `study_program`, `nim`, `birthplace`, `date_of_birth`, `gender`, `phone_e164`, `is_primary`, `participant_status`). | Mendukung peserta pemilik akun (`user_id` merujuk `profiles.id`) dan peserta tamu (`user_id = NULL`). Mempertahankan kolom lama `display_name` dan `is_representative` agar kompatibel 100% dengan query frontend yang ada. |
| `CONSENT-DOC` | Tabel `public.informed_consents` (`booking_id`, `session_id`, `booking_participant_id`, `consent_template_id`, `status: pending\|viewed\|signed\|revoked\|expired`, `signer_user_id`, `signer_name_snapshot`, `identity_snapshot: jsonb`, `signed_at`, `signature_storage_path`, `signed_document_storage_path`, `signed_document_sha256`). | Dokumen persetujuan per-peserta. Pada konseling kelompok, setiap peserta menandatangani dokumen masing-masing. Persetujuan klien utama tidak pernah menggantikan tanda tangan anggota lain. |
| `CONSENT-INVITE` | Tabel `public.consent_invitations` (`booking_participant_id`, `consent_id`, `invitation_type`, `token_hash`, `status`, `expires_at`). | Token acak 32-byte (64 hex char) hanya disimpan nilai hash SHA-256 (`token_hash`), berlaku 72 jam, sekali pakai, dan dapat dicabut (`revoked`). Token mentah tidak pernah disimpan di database. |
| `CONSENT-AUDIT` | Tabel `public.consent_audit_logs` (`consent_id`, `booking_participant_id`, `booking_id`, `actor_user_id`, `actor_type`, `event_type`, `metadata: jsonb`, `event_timestamp`). | Append-only. Mutasi `UPDATE` dan `DELETE` dicegah permanen melalui trigger PostgreSQL `prohibit_consent_audit_mutation()` (`42501`). Tidak menyimpan citra tanda tangan atau data klinis di metadata. |
| `CONSENT-STORAGE` | 3 bucket privat Supabase Storage: `informed-consent-templates` (10MB), `informed-consent-signed` (15MB), dan `informed-consent-signatures` (2MB). | Seluruh bucket bersifat privat (`public = false`). Akses unduh di masa depan menggunakan short-lived signed URL yang diverifikasi hak kepemilikannya oleh backend. |
| `CONSENT-READINESS` | RPC `public.sicare_check_booking_consent_readiness(p_booking_id)` mengembalikan `{ is_fully_consented: boolean, total_participants, signed_participants, pending_participants, participants: [...] }`. | Fondasi untuk penegakan backend di masa depan: sesi konseling tidak dapat dimulai sebelum seluruh peserta aktif menandatangani informed consent. |

## Pembaruan Batch 1.5c: Penandatanganan Digital & PDF Generation (31 Oktober 2026)

Pada Batch 1.5c, kontrak dan alur penandatanganan elektronik mandiri serta perenderan PDF resmi LMI telah dihubungkan dan diverifikasi:

| ID | Kontrak & Endpoint API | Penanganan Frontend & Backend pada Batch 1.5c |
|---|---|---|
| `CONSENT-MY` | `GET /api/v1/consents/booking/:bookingId/my-consent` (`allowRoles("client", "counselor")`). Mengembalikan `InformedConsentDto` lengkap dengan `booking_participants`, `bookings`, dan `consent_templates`. | Dipanggil saat membuka modal di `KlienAktivitasPage.tsx` via `consentApi.getMyBookingConsent(bookingId)`. Mengisi otomatis form identitas dari profil/akun. |
| `CONSENT-PATCH-ID` | `PATCH /api/v1/consents/:id/identity` (`allowRoles("client")`). Memperbarui identitas draft peserta sebelum ditandatangani. Ditolak keras jika status sudah `'signed'` (`SIGNED_CONSENT_EVIDENCE_IMMUTABLE`). | Dipanggil saat peserta mengedit identitas draft pada modal Informed Consent. |
| `CONSENT-SIGN` | `POST /api/v1/consents/:id/sign` (`allowRoles("client")`). Menerima `{ signature_base64, agreement_accepted: true, identity?, idempotency_key? }`. Memvalidasi biner PNG via magic bytes `89 50 4E 47`, overlay teks/tanda tangan ke templat resmi A4 1 halaman via `pdf-lib`, upload privat ke storage buckets, dan memutasi status ke `'signed'`. | `SignaturePad.tsx` mengekspor canvas ke format PNG murni (menolak goresan kosong). `InformedConsentModal.tsx` memvalidasi checkbox persetujuan wajib dan menampilkan konfirmasi sebelum memanggil `consentApi.signInformedConsent`. |
| `CONSENT-DOC` | `GET /api/v1/consents/:id/document` (`allowRoles("client", "counselor", "admin", "head_lmi")`). Mengembalikan `{ downloadUrl, storagePath, sha256 }` dengan presigned URL Supabase Storage berumur pendek (default 60 detik). | `InformedConsentModal.tsx` menampilkan tombol unduh PDF resmi berstatus signed via `consentApi.getSignedConsentDocumentUrl(consentId)`. |
| `CONSENT-READINESS-API` | `GET /api/v1/consents/booking/:bookingId/readiness` (`allowRoles("client", "counselor", "admin", "head_lmi")`). Mengembalikan status kesiapan consent seluruh peserta dalam booking. | Dipanggil untuk menampilkan status kesiapan pada kartu aktivitas booking. |

## Pembaruan Batch 1.5d & 1.5d.1: Group Informed Consent & WhatsApp Fonnte Integration (31 Oktober 2026)

Pada Batch 1.5d dan pengerasan 1.5d.1, alur persetujuan kelompok, undangan WhatsApp terenkripsi, portal tamu tanpa akun dummy, dan penegakan sesi di database telah diselesaikan:

| ID | Kontrak & Endpoint API | Penanganan Frontend & Backend pada Batch 1.5d & 1.5d.1 |
|---|---|---|
| `GROUP-CONSENT-SUMMARY` | `GET /api/v1/consents/booking/:bookingId/group-summary` (`allowRoles("client", "counselor", "admin", "head_lmi")`). Mengembalikan `GroupConsentSummaryDto` (`total_participants`, `signed_count`, `pending_count`, `ready_for_session`, `participants: [...]`). | Menyaring ketat data sensitif (tanpa NIM, tanggal lahir, tempat lahir, jenis kelamin, jalur tanda tangan, atau berkas PDF anggota lain). Terhubung ke `GroupConsentModal.tsx` di halaman Klien dan Konselor. |
| `GROUP-CONSENT-RESEND` | `POST /api/v1/consents/booking/:bookingId/participants/:participantId/resend-invitation` (`allowRoles("client")`). Membatalkan undangan lama (`revoked`) dan pesan outbox lama yang belum dikirim (`cancelled`), menghasilkan token baru terenkripsi AES-256-GCM, dan mengantrekan outbox baru. | Terhubung ke tombol kirim ulang undangan pada `GroupConsentModal.tsx`. |
| `GUEST-CLAIM-INVITATION` | `POST /api/v1/consents/invitations/claim` (`optionalAuthenticate`). Menerima `{ token: string }` (64 hex chars). Memvalidasi hash SHA-256 dan masa berlaku 48 jam. | Jika pengguna login terotentikasi, nomor telepon akun diverifikasi terhadap nomor undangan; menolak penipuan identitas dengan HTTP 403 `ACCOUNT_PHONE_MISMATCH`. Menerbitkan Capability Token HMAC-SHA256 stateless berumur 4 jam dengan klaim lengkap (`sub`, `consentId`, `participantId`, `bookingId`, `invitationId`, `purpose: 'consent_signing'`, `iss`, `aud`, `iat`, `exp`, `jti`). |
| `GUEST-STATE-GUARD` | Middleware `authenticateGuest` mengevaluasi fungsi `validateGuestCapabilityState` pada setiap request tamu. | Menolak seketika request tamu jika undangan dicabut (`revoked`) / kedaluwarsa (`expired`), peserta dihapus (`removed`), booking dibatalkan/ditolak (`cancelled`/`rejected`), atau dokumen sudah ditandatangani (`signed`) saat mutasi identitas/tanda tangan. Header `Referrer-Policy: no-referrer` diterapkan. |
| `GUEST-OPERATIONS` | `GET /api/v1/consents/guest/me`, `PATCH /api/v1/consents/guest/me/identity`, `POST /api/v1/consents/guest/me/sign`, `GET /api/v1/consents/guest/me/document`. Memerlukan header `X-Guest-Capability-Token`. | Terhubung ke portal tamu mandiri `fe/src/pages/guest/GuestConsentPage.tsx`. Pembersihan URL segera via `window.history.replaceState`. Token kapabilitas hanya disimpan di memori state React. |
| `CONSENT-SESSION-GUARD` | RPC PostgreSQL `sicare_transition_session` memanggil `sicare_check_booking_consent_readiness(booking_id)` saat transisi ke `'ongoing'`. Membangkitkan exception `CONSENT_READINESS_INCOMPLETE` jika masih ada peserta aktif yang belum menandatangani consent. | Dipetakan di `be/src/lib/domainRpc.js` ke HTTP 409 Conflict. `KonselorAktivitasPage.tsx` menampilkan modal peringatan ramah pengguna bila konselor mencoba memulai sesi kelompok yang belum siap. |
| `ENCRYPTION-FAIL-CLOSED` | `CONSENT_ENCRYPTION_KEY` mewajibkan 32-byte secret (64 karakter heksadesimal). Diisolasi penuh dari kredensial Supabase/Auth. | *Fail-closed* saat production (`NODE_ENV === 'production'`). Mendukung key ring multi-versi (`v1`) dan rotasi via `reencryptInvitationToken`. |
| `CONSENT-REMINDERS` | Scheduler `scanPendingConsentsAndEnqueueReminders` di `whatsapp.scheduler.js` memindai undangan pending dan menjadwalkan pengingat bertahap: Interval 1 (24 jam) dan Interval 2 (72 jam) dengan batas maksimal 2 pengingat dan idempotensi deterministik. | Worker `whatsapp.worker.js` menerapkan *just-in-time eligibility check*: membatalkan pesan (`cancelled`) dengan kode `CONSENT_ALREADY_SIGNED` jika peserta sudah tanda tangan atau `BOOKING_CANCELLED` jika booking telah dibatalkan sebelum pengiriman. |
