# SiCARE Group Informed Consent Workflow & WhatsApp Integration (Batch 1.5d)

Dokumen ini menjelaskan arsitektur, alur data, mekanisme keamanan, dan integrasi WhatsApp Fonnte untuk Informed Consent Konseling Kelompok (Group Informed Consent) pada sistem SiCARE.

---

## 1. Ringkasan Arsitektur

Konseling kelompok melibatkan satu Klien Utama (perwakilan) dan beberapa peserta tambahan (2–10 peserta per kelompok). Sesuai prinsip kerahasiaan dan privasi data klinis:
- **Setiap peserta memiliki berkas informed consent independen.**
- **Setiap peserta menandatangani secara mandiri.**
- **Setiap peserta mendapatkan PDF hasil bertandatangan terpisah.**
- **Tidak ada dokumen persetujuan kelompok bersama (shared consent) yang mencampur identitas atau tanda tangan antar peserta.**
- **Klien Utama maupun peserta lain tidak dapat melihat snapshot identitas klinis, nomor telepon, tanggal lahir, citra tanda tangan, atau berkas PDF peserta lain.**
- **Sesi konseling diblokir di tingkat database jika ada peserta aktif yang belum menandatangani informed consent.**

---

## 2. Alur Pendaftaran Peserta Kelompok (Group Booking Registration)

1. **Input Data Anggota:**
   Pada saat pembuatan booking kelompok di `fe/src/pages/client/KlienPesananPage.tsx`, Klien Utama mengisikan nama lengkap (`full_name`) dan nomor WhatsApp aktif (`phone_e164`) untuk setiap anggota kelompok.
2. **Validasi:**
   - Jumlah anggota kelompok: 2 hingga 10 peserta.
   - Format nomor WhatsApp divalidasi ke standar E.164 (`+628...`).
   - Tepat satu peserta ditandai sebagai perwakilan (`is_representative = true`).
3. **Persistensi Database:**
   RPC PostgreSQL `sicare_create_booking` menyimpan setiap peserta ke tabel `public.booking_participants` dengan atribut `full_name`, `display_name`, `phone_e164`, `is_representative`, `is_primary`, `participant_type = 'guest_member'` (atau `'primary_client'` untuk perwakilan), dan `participant_status = 'registered'`.

---

## 3. Manajemen Token Undangan & Enkripsi AES-256-GCM

Untuk menjamin keamanan token undangan dan mencegah kebocoran melalui database query log atau payload outbox:
1. **Generasi Token Berkekuatan Tinggi:**
   Token acak sepanjang 64 karakter heksadesimal (256-bit entropy) dihasilkan menggunakan `crypto.randomBytes(32)`.
2. **Penyimpanan Hash di Database:**
   Tabel `public.consent_invitations` hanya menyimpan nilai hash SHA-256 dari token (`token_hash = sha256(raw_token)`). Raw token **tidak pernah** disimpan dalam bentuk plain-text di tabel `consent_invitations`.
3. **Penyimpanan Enkripsi untuk Dispatch Worker:**
   Raw token dienkripsi menggunakan algoritma terotentikasi **AES-256-GCM** sebelum disimpan di tabel terproteksi `public.consent_invitation_secrets`:
   - Kunci enkripsi diambil dari `CONSENT_ENCRYPTION_KEY` (atau diturunkan dari `SUPABASE_SERVICE_ROLE_KEY` / `JWT_SECRET` via HKDF-SHA256 jika variabel belum disetel eksplisit).
   - IV unik (12 bytes) dan Auth Tag (16 bytes) disimpan bersama ciphertext.
   - Tabel `consent_invitation_secrets` menerapkan RLS ketat dan hanya dapat diakses oleh `service_role`.
4. **Outbox Payload Sanitized:**
   Baris `whatsapp_outbox` untuk undangan consent **tidak memuat raw token**. Worker mengambil ciphertext dari `consent_invitation_secrets`, mendekripsinya di memori saat pengiriman, menyusun tautan lengkap `${APP_BASE_URL}/consent/invite?token=...`, lalu menandai `cleared_at = now()` pada tabel rahasia setelah pengiriman berhasil.

---

## 4. Dispatch WhatsApp Fonnte & Template Undangan

1. **Pemicu Undangan:**
   Saat konselor menerima permintaan konseling (`booking.status` bertransisi menjadi `confirmed`), fungsi `initializeGroupConsentInvitations` dipanggil:
   - Membuat record `informed_consents` (status `pending`) untuk setiap anggota kelompok yang belum memiliki consent.
   - Membuat `consent_invitations` (status `pending`, kedaluwarsa 48 jam).
   - Mengenkripsi token dan menyimpannya di `consent_invitation_secrets`.
   - Mengantrekan pesan `consent_invitation` ke `whatsapp_outbox` dengan kunci idempotensi deterministik `booking:{id}:consent_invitation:{participant_id}`.
2. **Template Pesan WhatsApp:**
   Template `consent_invitation` menyapa nama peserta secara ramah, menyebutkan nama Klien Utama dan Konselor, serta menyertakan tautan undangan unik.
3. **Pengingat Otomatis (Consent Reminder):**
   Scheduler juga dapat mengantrekan template `consent_reminder` bagi peserta yang belum menyelesaikan penandatanganan mendekati waktu sesi.
4. **Pengiriman Ulang Undangan (Resend Invitation):**
   Endpoint `POST /api/v1/consents/booking/:bookingId/participants/:participantId/resend-invitation` memungkinkan Klien Utama memicu pengiriman ulang:
   - Membatalkan undangan lama (`status = 'revoked'`).
   - Membatalkan pesan outbox lama yang belum terkirim (`status = 'cancelled'`).
   - Menghasilkan token baru, mengenkripsi rahasia, dan mengantrekan pesan outbox baru.

---

## 5. Portal Akses Tamu (Guest Portal: `/consent/invite`)

Peserta tamu kelompok yang tidak memiliki akun SiCARE dapat mengakses dan menandatangani informed consent secara mandiri tanpa pembuatan akun dummy Supabase Auth:
1. **Penerimaan & Pembersihan URL (Scrubbing):**
   Ketika tamu mengklik tautan di WhatsApp (`/consent/invite?token=<RAW_TOKEN>`), halaman frontend `fe/src/pages/guest/GuestConsentPage.tsx`:
   - Menangkap parameter `token`.
   - Melakukan pembersihan URL segera (`window.history.replaceState`) agar token tidak tertinggal di browser history atau referrer header.
2. **Klaim Undangan & Capability Token Stateless:**
   Frontend memanggil `POST /api/v1/consents/invitations/claim` dengan `raw_token`. Backend:
   - Menghitung `sha256(raw_token)` dan mencari baris aktif di `consent_invitations`.
   - Memvalidasi masa berlaku (`expires_at > now()`) dan status (`pending` atau `sent`).
   - Memperbarui status undangan menjadi `claimed`.
   - Menerbitkan **Capability Token Stateless** bertanda tangan kriptografis HMAC-SHA256 (`sicare_guest_cap_v1`) yang memuat `{ consentId, participantId, bookingId, role: "guest_participant" }` dengan masa berlaku 4 jam.
3. **Otorisasi Sesi Tamu:**
   Untuk semua interaksi selanjutnya (`GET /api/v1/consents/guest/me`, `PATCH /api/v1/consents/guest/me/identity`, `POST /api/v1/consents/guest/me/sign`, `GET /api/v1/consents/guest/me/document`), tamu mengirimkan header:
   `X-Guest-Capability-Token: <CAPABILITY_TOKEN>`.
   Backend memvalidasi tanda tangan HMAC-SHA256 token tersebut dan membatasi operasi **hanya pada record milik peserta bersangkutan**.

---

## 6. Penandatanganan Mandiri & Pembangkitan PDF Terpisah

1. **Kelengkapan Identitas Peserta:**
   Tamu melengkapi 8 atribut identitas wajib: Nama Lengkap, Fakultas, Program Studi, NIM, Tempat Lahir, Tanggal Lahir, Jenis Kelamin, dan Nomor WhatsApp.
2. **Tanda Tangan Digital Kanvas:**
   Tamu menandatangani pada kanvas high-DPI responsif. Data biner dikirim sebagai PNG dan divalidasi via magic bytes (`89 50 4E 47 0D 0A 1A 0A`).
3. **Pembangkitan PDF Resmi Individual:**
   Layanan `consentPdf.service.js` menggunakan templat PDF resmi A4 LMI Unika De La Salle Manado:
   - Menghasilkan berkas PDF bertandatangan tunggal untuk peserta tersebut.
   - Menghitung checksum integritas SHA-256.
   - Mengunggah citra tanda tangan ke bucket privat `informed-consent-signatures`.
   - Mengunggah berkas PDF ke bucket privat `informed-consent-signed`.
4. **Finalisasi & Imutabilitas:**
   Status consent dimutasi menjadi `signed` dengan timestamp dan ID penandatangan. Trigger database `prohibit_signed_consent_tampering` memastikan dokumen dan identitas bertandatangan tidak dapat diubah kembali.
5. **Log Audit Append-Only:**
   Mencatat entri log `consent_signed` dan `document_generated` pada tabel `consent_audit_logs`.

---

## 7. Ringkasan Status Persetujuan Kelompok (Group Consent Summary)

Klien Utama dan Konselor yang ditugaskan dapat memantau status penyelesaian informed consent seluruh anggota kelompok melalui modal `GroupConsentModal.tsx` (`GET /api/v1/consents/booking/:bookingId/group-summary`):
- **Data yang Disediakan:**
  - Status total: total peserta, jumlah yang sudah tanda tangan (`signed_count`), jumlah yang menunggu (`pending_count`).
  - Indikator kesiapan sesi (`ready_for_session = true/false`).
  - Daftar ringkasan per anggota: `participant_id`, `display_name`, `is_primary`, `consent_status`, `signed_at`, `invitation_status`.
- **Perlindungan Privasi Ketat (Data Isolation):**
  Field-field klinis dan pribadi sensitif berikut **dihapus secara tegas** dari respons ringkasan:
  - `nim`, `birthplace`, `date_of_birth`, `gender`, `faculty`, `study_program`
  - `signature_storage_path`, `signed_document_storage_path`
  - Hak unduh PDF hanya dimiliki oleh masing-masing pemilik consent dan konselor penanggung jawab (Klien Utama tidak dapat mengunduh PDF peserta lain).

---

## 8. Penegakan Blokir Transisi Sesi di Level Database (PostgreSQL Transition Guard)

Sesuai SOP, sesi konseling kelompok tidak boleh dimulai apabila masih ada anggota aktif yang belum menandatangani informed consent.
Penegakan ini diimplementasikan **di tingkat fungsi database (RPC PostgreSQL)**:
1. **Fungsi `sicare_transition_session`:**
   Saat konselor mencoba mengubah status sesi dari `scheduled` menjadi `ongoing`:
   ```sql
   if p_target_status = 'ongoing' then
     select * into v_readiness
     from public.sicare_check_booking_consent_readiness(v_session.booking_id);

     if not coalesce(v_readiness.is_fully_consented, false) then
       raise exception using errcode = 'P0001', message = 'CONSENT_READINESS_INCOMPLETE';
     end if;
   end if;
   ```
2. **Pemetaan Domain RPC:**
   Pengecualian `CONSENT_READINESS_INCOMPLETE` dipetakan oleh backend Express di `be/src/lib/domainRpc.js` ke status **HTTP 409 Conflict** dengan pesan ramah pengguna:
   > "Sesi konseling belum dapat dimulai karena informed consent belum dilengkapi oleh seluruh peserta."
3. **Umpan Balik Antarmuka Konselor:**
   Pada `KonselorAktivitasPage.tsx`, konselor diberikan indikator status kesiapan consent, dialog peringatan, dan instruksi untuk mengingatkan peserta bila ada yang belum melengkapi tanda tangan.

---

## 9. Penanganan Pembatalan & Penolakan Booking (Cancellation Cleanup)

Bila booking kelompok dibatalkan oleh Klien Utama atau ditolak/dibatalkan oleh Konselor (`sicare_transition_booking`):
1. **Pencabutan Undangan:**
   Seluruh undangan yang masih berstatus `pending` atau `sent` di tabel `consent_invitations` secara otomatis dimutasi menjadi `revoked` (`revoked_at = now()`).
2. **Pembatalan Antrean WhatsApp:**
   Seluruh pesan antrean di `whatsapp_outbox` dengan tipe `consent_invitation` dan `consent_reminder` yang masih berstatus `pending`, `queued`, atau `retry_wait` dimutasi menjadi `cancelled`.

---

## 10. Matriks Uji & Verifikasi Batch 1.5d

| Skenario Pengujian | Target Komponen | Hasil |
|---|---|---|
| Skema outbox, secrets, dan RPC | `20261031180000_sicare_group_consent_workflow.sql` | **PASS** |
| Siklus hidup enkripsi token AES-256-GCM | `tokenEncryption.service.js` | **PASS** |
| Keamanan token kapabilitas tamu stateless HMAC-SHA256 | `consent.service.js` | **PASS** |
| Kompilasi & perenderan template WhatsApp `consent_invitation` & `consent_reminder` | `whatsapp/index.js` | **PASS** |
| Pengiriman worker tanpa kebocoran raw token di outbox | `whatsapp.worker.js` | **PASS** |
| Isolasi data dan privasi ringkasan consent kelompok | `getGroupConsentSummary` | **PASS** |
| Alur resend invitation dan pembatalan outbox usang | `resendConsentInvitation` | **PASS** |
| Pemetaan domain RPC `CONSENT_READINESS_INCOMPLETE` ke HTTP 409 | `domainRpc.js` | **PASS** |
| Pembersihan otomatis undangan & outbox saat booking dibatalkan | `sicare_transition_booking` | **PASS** |
| Penandatanganan mandiri tamu & PDF resmi ber-SHA256 | `signGuestInformedConsent` & `pdf-lib` | **PASS** |
| Penegakan blokir transisi sesi `scheduled -> ongoing` di database | `sicare_transition_session` | **PASS** |

Seluruh 11 skenario diuji secara komprehensif pada `be/test/groupConsent.test.js` (**11/11 PASS**) dan seluruh rangkaian uji backend lulus (**147/147 PASS**).

---

## 11. Pengerasan Keamanan & Operasional Batch 1.5d.1 (Security & Operational Closure)

Pada Batch 1.5d.1, arsitektur diperkuat dengan penyelesaian celah keamanan dan operasional berikut:

1. **Kunci Enkripsi Terdedikasi `CONSENT_ENCRYPTION_KEY` & Fail-Closed:**
   - Mewajibkan 32-byte / 64 hex chars secret terpisah dari `SUPABASE_SERVICE_ROLE_KEY` dan `JWT_SECRET`.
   - Menolak inisialisasi pada environment produksi (`NODE_ENV === 'production'`) jika secret tidak disetel.
   - Mendukung arsitektur key ring multi-versi (`v1`) dan rotasi kunci via `reencryptInvitationToken`.

2. **Pengerasan Token Kapabilitas Tamu & Validasi State Database Real-Time:**
   - Klaim lengkap: `sub`, `consentId`, `participantId`, `bookingId`, `invitationId`, `purpose: 'consent_signing'`, `iss`, `aud`, `iat`, `exp`, `jti`.
   - Gerbang validasi state database `validateGuestCapabilityState`: menolak request tamu seketika jika undangan revoked/expired, peserta removed, booking cancelled/rejected, atau consent sudah signed/revoked.
   - Header `Referrer-Policy: no-referrer` pada endpoint tamu; token kapabilitas hanya disimpan di memori state React.

3. **Penautan Akun Terotentikasi & Verifikasi Kepemilikan Nomor Telepon:**
   - Endpoint `POST /api/v1/consents/invitations/claim` mendukung `optionalAuthenticate`.
   - Jika pengguna terotentikasi, nomor telepon akun diverifikasi terhadap nomor penerima undangan; penolakan HTTP 403 `ACCOUNT_PHONE_MISMATCH` jika tidak cocok untuk mencegah pembajakan undangan.

4. **Scheduler Pengingat Persetujuan Otomatis (24h/72h) & Gerbang Eligibilitas Akhir Worker:**
   - Scheduler `scanPendingConsentsAndEnqueueReminders` mengantrekan pengingat interval 1 (24 jam) dan interval 2 (72 jam) dengan idempotensi deterministik `invitation:<id>:consent_reminder:interval_<n>`.
   - Gerbang eligibilitas akhir worker membatalkan pengiriman (`cancelled`) dengan kode `CONSENT_ALREADY_SIGNED` jika peserta menandatangani sebelum worker dieksekusi, atau `BOOKING_CANCELLED` jika pemesanan dibatalkan.

5. **Verifikasi Uji Lanjutan & Integrasi Sistem (Batch 1.5e):**
   - `be/test/groupConsentClosure.test.js`: **19/19 PASS**.
   - `be/test/finalIntegration.test.js`: **18/18 PASS**.
   - Total backend tests: **184/184 PASS**. Rincian arsitektur keamanan ada di [`docs/security/security-architecture.md`](security/security-architecture.md) dan status pengujian di [`docs/PROJECT_STATUS.md`](PROJECT_STATUS.md).
