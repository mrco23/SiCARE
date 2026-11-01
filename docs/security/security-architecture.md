# SiCARE — Arsitektur Keamanan Sistem (System Security Architecture)

**Klasifikasi Dokumen:** Dokumentasi Teknis Resmi Proyek SiCARE
**Institusi Penyelenggara:** Lembaga Misi & Identitas (LMI) — Universitas Katolik De La Salle Manado, Indonesia
**Terakhir Diperbarui:** 31 Oktober 2026
**Status Kepatuhan:** Terverifikasi & Lulus Audit Otomatis (184/184 backend tests PASS)

---

## 1. Prinsip & Batasan Kepercayaan (Security Principles & Trust Boundaries)

Sistem Informasi Konseling & Rekam Edukasi (SiCARE) dirancang dengan memprioritaskan kerahasiaan data klinis, keabsahan hukum persetujuan bimbingan dan konseling (*Digital Informed Consent*), serta integritas transaksional notifikasi. Seluruh kontrol keamanan ditegakkan di sisi server (Node.js Express) dan basis data (PostgreSQL Row-Level Security & Stored Procedures), bukan hanya pada antarmuka pengguna (*frontend*).

### Prinsip Utama:
1. **Least Privilege & Role Isolation:** Setiap peran pengguna hanya memiliki akses minimum yang dibutuhkan untuk menjalankan fungsinya. Peran manajerial/eksekutif tidak memiliki izin membaca berkas klinis individual.
2. **Clinical Document Immutability:** Berkas persetujuan yang telah ditandatangani bersifat mutlak tidak dapat diubah (*immutable*). Perubahan data profil pengguna di kemudian hari tidak boleh mengubah bukti identitas yang telah dibekukan pada saat penandatanganan.
3. **Stateless Authorization with Server State Validation:** Akses peserta tamu (*guest participant*) menggunakan token kapabilitas kriptografis stateless yang status keabsahannya divalidasi langsung ke database pada setiap request.
4. **Separation of Secrets in Dispatch Pipelines:** Token rahasia undangan WhatsApp tidak pernah disimpan dalam bentuk teks biasa (*plain-text*) di tabel outbox atau query log.
5. **Fail-Closed in Production:** Lingkungan produksi menolak inisialisasi jika konfigurasi kunci kriptografis terdedikasi tidak terpenuhi secara sah.

---

## 2. Autentikasi & Otorisasi Berbasis Peran (RBAC)

### A. Mekanisme Verifikasi Sesi
- Setiap request terotentikasi membawa header HTTP `Authorization: Bearer <supabase_jwt>`.
- Middleware `be/src/middleware/auth.js` memverifikasi token ke Supabase Auth melalui `auth.getUser()`.
- Identitas pengguna diambil dari record database `public.profiles` (`authData.user.id`). Akun yang berstatus nonaktif (`is_active = false`) langsung ditolak dengan status HTTP 403 `ACCOUNT_INACTIVE`.
- Hak akses rute divalidasi terhadap kolom `app_role` di database:
  - `client`: Mahasiswa / penerima konseling.
  - `counselor`: Konselor / psikolog LMI.
  - `admin`: Administrator operasional sistem.
  - `head_lmi`: Kepala Lembaga Misi & Identitas.

### B. Proteksi Akun Administratif
1. **Pencegahan Self-Demotion & Self-Deactivation:** Admin dilarang mengubah perannya sendiri atau menonaktifkan akunnya sendiri melalui endpoint API (`SELF_ADMIN_CHANGE_BLOCKED` -> HTTP 409).
2. **Proteksi Admin Aktif Terakhir:** Sistem memvalidasi jumlah admin aktif di sistem. Penonaktifan akun admin terakhir diblokir dengan error `LAST_ADMIN` (HTTP 409).
3. **Mekanisme Rollback Pembuatan Konselor:** Saat Admin membuat akun konselor baru, sistem menjalankan transaksi kompensasi: jika inisialisasi record `profiles` atau `counselor_profiles` gagal, akun Supabase Auth yang baru dibuat segera dihapus via `auth.admin.deleteUser`, mencegah terbentuknya *orphaned accounts*.

---

## 3. Otorisasi Peserta Tamu (Guest Capability Token)

Peserta konseling kelompok yang belum memiliki akun SiCARE mengakses portal penandatanganan `/consent/invite` menggunakan *Guest Capability Token*.

### A. Struktur Token Kriptografis
Token ditandatangani menggunakan algoritma HMAC-SHA256 dengan payload terikat:
- `sub`: UUID peserta (`participantId`).
- `consentId`: UUID dokumen consent.
- `participantId`: UUID peserta.
- `bookingId`: UUID permohonan booking.
- `invitationId`: UUID rekaman undangan.
- `purpose`: `"consent_signing"` (dituntut secara mutlak oleh backend verifier).
- `iss`: `"sicare-backend"`.
- `aud`: `"sicare-guest-signer"`.
- Masa berlaku: Dibatasi hingga batas kedaluwarsa sesi (default 24 jam).

### B. Validasi State Berbasis Database (`validateGuestCapabilityState`)
Sebelum memproses aksi penandatanganan atau pembacaan formulir, backend memverifikasi token terhadap state aktual database:
1. Rekaman undangan `consent_invitations` harus berstatus `sent` atau `claimed`.
2. Rekaman booking `bookings` tidak boleh berstatus `cancelled`.
3. Rekaman peserta `booking_participants` berstatus aktif (`participant_status = 'registered'`).
4. Jika persetujuan telah berstatus `signed`, token ditolak untuk aksi penandatanganan ulang (*re-signing blocked*).

### C. Pemulihan Sesi Tamu (Session Recovery)
- **Scenario A (Page Refresh):** Token pada URL dibersihkan seketika dari browser via `window.history.replaceState`. Sesi kapabilitas disimpan di cookie aman `httpOnly` (`sameSite: 'lax'`, `secure` di lingkungan produksi). Saat halaman direfresh, formulir membaca sesi dari cookie tanpa perlu memaparkan token kembali di URL.
- **Scenario B (Browser Re-open):** Jika peserta telah menandatangani consent (`consent.status === 'signed'`) dan menutup browser, pembukaan kembali tautan undangan mengembalikan token kapabilitas baca-saja (*read-only*) untuk memungkinkan peserta mengunduh berkas PDF miliknya kapan saja. Jika belum menandatangani, undangan sekali pakai berstatus `claimed` dilindungi dari penggunaan pihak ketiga.

---

## 4. Arsitektur Kriptografi & Manajemen Kunci

### A. Kunci Enkripsi Terdedikasi (`CONSENT_ENCRYPTION_KEY`)
- Sistem mewajibkan variabel lingkungan `CONSENT_ENCRYPTION_KEY` untuk mengamankan data rahasia undangan.
- **Karakteristik Kunci:** 256-bit (32 bytes) kriptografis aman, disediakan dalam format 64 karakter heksadesimal atau 32 karakter UTF-8.
- **Kebijakan Fail-Closed Produksi:** Pada `NODE_ENV === 'production'`, backend menolak booting jika variabel ini tidak disetel atau formatnya tidak sesuai.
- **Isolasi Lingkungan Pengujian:** Pada pengujian lokal deterministik, sistem menggunakan kunci uji terisolasi yang tidak pernah digunakan pada server produksi.

### B. Key Ring Versioning & Rotasi Kunci
Layanan `be/src/services/tokenEncryption.service.js` menerapkan arsitektur *Key Ring*:
- Setiap ciphertext menyimpan penanda versi kunci (misal `keyVersion = 'v1'`).
- Dekripsi mendukung versi multi-kunci secara dinamis, memungkinkan proses rotasi kunci berjalan tanpa downtime.
- Disediakan fungsi `reencryptInvitationToken` yang mendekripsi ciphertext dengan kunci lama dan mengenkripsi ulang dengan kunci baru setelah integritas terverifikasi.

### C. Pemisahan Data Rahasia di Saluran Dispatch
1. Tabel `public.consent_invitations` hanya menyimpan nilai hash SHA-256 (`token_hash = sha256(raw_token)`).
2. Ciphertext token terenkripsi disimpan di tabel privat `public.consent_invitation_secrets` (AES-256-GCM dengan Auth Tag dan IV acak 12 byte).
3. Baris antrean `whatsapp_outbox` untuk pengiriman undangan WhatsApp **tidak pernah memuat raw token**.
4. Worker mendekripsi token di dalam memori sesaat sebelum panggilan HTTP ke API Fonnte, menyusun tautan lengkap, lalu menandai kolom `cleared_at = now()` pada tabel rahasia setelah pengiriman berhasil.

---

## 5. Kerahasiaan Data Klinis & Privasi Dokumen (Least Privilege)

### A. Isolasi Privasi Konseling Kelompok
Pada permohonan konseling kelompok (2 hingga 10 peserta):
- Setiap peserta memiliki baris terpisah pada `booking_participants` dan `informed_consents`.
- Klien Utama (perwakilan pembuat pesanan) **dilarang membaca** data PII anggota lain (NIM, tempat/tanggal lahir, nomor telepon) atau mengunduh PDF anggota lain.
- Endpoint ringkasan kelompok `GET /api/v1/consents/booking/:id/group-summary` hanya mengembalikan metadata operasional anonim (`participant_id`, `display_name`, `is_representative`, `status: 'signed' | 'pending'`).

### B. Matriks Hak Unduh Dokumen Bertandatangan (`GET /api/v1/consents/:id/document`)

| Peran Pemohon | Kondisi Pemohon | Status Akses | Kode Respons HTTP |
|---|---|:---:|:---:|
| **Penandatangan (Client)** | Akun pemilik consent (`signer_user_id === authUser.id`) | **IZIN (ALLOW)** | 200 OK (Presigned URL) |
| **Peserta Tamu (Guest)** | Membawa token kapabilitas sah untuk consent bersangkutan | **IZIN (ALLOW)** | 200 OK (Presigned URL) |
| **Konselor Bertugas** | Ditugaskan pada booking terkait (`counselor_id === authUser.id`) | **IZIN (ALLOW)** | 200 OK (Presigned URL) |
| **Konselor Lain** | Konselor terdaftar tetapi tidak ditugaskan pada sesi terkait | **TOLAK (DENIED)** | 403 Forbidden |
| **Kepala LMI (`head_lmi`)** | Kepala lembaga pemantau eksekutif | **TOLAK (DENIED)** | 403 Forbidden |
| **Pengguna Luar / Anonim** | Tidak memiliki relasi sah terhadap booking/consent | **TOLAK (DENIED)** | 401 / 403 |

*Catatan Kebijakan Etis:* Kepala LMI dan pihak manajemen hanya berhak memantau metrik statistik agregat (jumlah konseling, tren masalah umum, durasi rata-rata) tanpa mengakses dokumen kesediaan atau catatan klinis individu, menjamin kerahasiaan hubungan psikolog-klien.

---

## 6. Imutabilitas Bukti Hukum Persetujuan

### A. Proteksi Database Level (`prohibit_signed_consent_tampering`)
Trigger PostgreSQL `prohibit_signed_consent_tampering()` berjalan otomatis sebelum operasi `UPDATE` pada tabel `public.informed_consents`:
- Jika status saat ini adalah `signed`, perubahan pada kolom pembuktian legal dilarang keras:
  - `identity_snapshot` (snapshot data diri saat bertandatangan)
  - `signature_storage_path` (lokasi berkas tanda tangan)
  - `signed_document_storage_path` (lokasi berkas PDF bertandatangan)
  - `signed_document_sha256` (hash integritas PDF)
  - `signed_at` (waktu legal penandatanganan)
  - `template_version` (versi templat yang disetujui)
- Regresi status dari `signed` kembali ke `pending` ditolak dengan exception database.

### B. Audit Trail Append-Only (`prohibit_consent_audit_mutation`)
Tabel `public.consent_audit_logs` merekam seluruh riwayat aktivitas consent (pembentukan, pengiriman undangan, klaim token, pembubuhan tanda tangan, pembangkitan dokumen).
- Trigger database memblokir operasi `UPDATE` dan `DELETE` pada tabel audit log secara absolut.
- Audit trail hanya dapat ditambah (*append-only*).
- Metadata audit disanitasi: dilarang menyalin token rahasia, password, atau isi klinis ke dalam field metadata.

### C. Pencegahan Serangan Berkas Tanda Tangan
- Bucket Supabase Storage `informed-consent-signatures` menerapkan RLS privat dan validasi MIME type ketat (`image/png`, `image/jpeg`).
- Buffer biner tanda tangan divalidasi langsung di backend Node.js menggunakan pemeriksaan *magic bytes* header PNG. Berkas SVG, HTML, atau XML ditolak secara mutlak untuk mencegah kerentanan *Stored Cross-Site Scripting (XSS)* atau *XML External Entity (XXE)* saat perenderan dokumen.

---

## 7. Penegakan Sesi Konseling di Database (Session Consent Enforcement)

Sesuai SOP LMI, sesi konseling tidak diizinkan berjalan sebelum seluruh peserta aktif menandatangani Informed Consent:
- Fungsi tersimpan PostgreSQL `public.sicare_transition_session(p_session_id, p_new_status, ...)` memverifikasi kesiapan persetujuan saat sesi dialihkan dari `scheduled` ke `ongoing`.
- Fungsi secara internal memanggil `sicare_check_booking_consent_readiness(p_booking_id)` yang memeriksa apakah ada peserta dengan status aktif (`participant_status != 'removed'`) yang belum bertandatangan (`status != 'signed'`).
- Jika terdapat peserta pending, stored procedure membatalkan transaksi dan melempar pengecualian SQL dengan kode `CONSENT_READINESS_INCOMPLETE` (HTTP 409 Conflict di sisi API).
- Pengujian regresi otomatis memastikan manipulasi transisi status melalui antarmuka atau panggilan API langsung akan digagalkan oleh database.

---

## 8. Keandalan & Keamanan Saluran Notifikasi WhatsApp

1. **Transactional Outbox:** Penulisan pesan WhatsApp ke tabel `whatsapp_outbox` terjadi dalam transaksi PostgreSQL yang sama dengan pembuatan atau pembaruan status booking, menjamin tidak ada pesan yang hilang saat terjadi kegagalan jaringan eksternal.
2. **Lease Locking & Crash Recovery:** Background worker menggunakan pola *lease locking* (`locked_until = now() + lease_duration`). Jika worker mengalami kegagalan proses (*crash*), mekanisme *lease reaper* otomatis membuka kunci baris untuk diproses ulang oleh worker aktif.
3. **Penyaringan Pembatalan Akhir (Final Eligibility Gate):** Sebelum mengirimkan pesan ke API Fonnte, worker memeriksa state aktual: jika permohonan booking telah berstatus `cancelled` atau peserta telah menandatangani consent, pesan dibatalkan otomatis dengan status `cancelled` tanpa diteruskan ke gateway WhatsApp.
4. **Validasi Webhook Callback Monotonik:** Callback penerimaan pesan dari gateway Fonnte divalidasi untuk mencegah regresi status (misal status `delivered` tidak boleh diubah kembali menjadi `sent` oleh payload callback yang datang terlambat).
