# SiCARE User Acceptance Testing (UAT) Final Report

**Proyek:** SiCARE (Sistem Informasi Konseling & Rekam Terintegrasi)
**Dokumen:** Laporan Akhir Kesiapan & Pengujian Penerimaan Pengguna (UAT Final Report)
**Tahap:** Batch 1.5g: Controlled User Acceptance Testing
**Tanggal Evaluasi:** 31 Oktober 2026
**Target Sesi Pengujian Tim:** Minggu, 1 November 2026 (Sesuai `docs/WEEKEND_READINESS_PLAN.md`)

---

## Ringkasan Eksekutif Status 4 Dimensi Evaluasi

Untuk mencegah klaim prematur dan menjamin integritas pelaporan, evaluasi UAT SiCARE dibagi secara tegas ke dalam 4 dimensi status:

| Dimensi Evaluasi | Status Faktual | Keterangan & Dasar Penetapan |
|---|:---:|---|
| **1. UAT Preparation** | **COMPLETE** | Rencana induk, spesifikasi 45 kasus uji, lembar kerja eksekusi, sistem pelacakan cacat, instrumen umpan balik, dan berita acara sign-off telah selesai disusun dan diverifikasi. |
| **2. Technical Readiness** | **READY / PASS** | Verifikasi kode sumber 100% lulus: 31 berkas sintaks valid, **184/184 automated tests PASS**, 0 lint error/warning, build produksi PWA sukses, dan 8 migrasi database sinkron. |
| **3. Human UAT Execution** | **PENDING / NOT STARTED** | Skenario pengujian telah siap dieksekusi oleh manusia. Sesi pengujian langsung bersama perwakilan pengguna dijadwalkan pada Minggu malam, 1 November 2026. Belum ada pengujian manusia yang dijalankan sebelum sesi tersebut. |
| **4. Final User Acceptance** | **PENDING APPROVAL** | Penandatanganan formal Berita Acara Penerimaan Pengguna (*Sign-Off*) menunggu hasil pengamatan faktual dan evaluasi umpan balik dari penguji manusia. |

---

## A. Executive Summary

Laporan ini mendokumentasikan kesiapan menyeluruh aplikasi SiCARE menjelang pelaksanaan User Acceptance Testing (UAT) terkendali bersama perwakilan pemangku kepentingan universitas.

SiCARE telah menuntaskan seluruh fondasi teknis Tahap 1, mencakup integrasi penuh 25/25 halaman antarmuka pengguna lintas-peran (Admin, Kepala LMI, Konselor, Klien), arsitektur Informed Consent Digital berstandar Lembaga Misi & Identitas (LMI) Unika De La Salle Manado, alur persetujuan kelompok multi-peserta (anggota terdaftar dan tamu mandiri), penegakan kesiapan sesi konseling di tingkat basis data, serta pipeline transactional outbox WhatsApp Fonnte yang andal.

Berdasarkan audit kesiapan lingkungan, sistem direkomendasikan secara teknis dengan predikat:
### **ACCEPTED FOR STAGING (SIAP UNTUK USER ACCEPTANCE TESTING TERKENDALI)**
*Pelaksanaan pengujian penerimaan manusia dan penandatanganan berita acara tetap berstatus **PENDING** sampai sesi pengujian tim selesai diselenggarakan.*

---

## B. Environment Readiness (Audit Faktual 10 Komponen)

Berdasarkan audit faktual pada [`docs/uat/UAT_ENVIRONMENT_READINESS.md`](UAT_ENVIRONMENT_READINESS.md), kesiapan 10 komponen lingkungan diklasifikasikan sebagai berikut:

| No | Komponen Lingkungan | Status Kesiapan | Bukti Faktual Aktual | Tindakan yang Diperlukan Sebelum UAT |
|---|---|:---:|---|---|
| 1 | **Local Development Environment** | **READY** | Node.js `v22.16.0`, npm `10.9.2`. Express port 3000, Vite port 5173. `npm run check` PASS, `npm test` 184/184 PASS, build/lint PASS. | Tidak ada; runtime lokal terverifikasi penuh. |
| 2 | **Dedicated Staging Frontend** | **NOT READY** | Build produksi `dist/` terbentuk secara lokal (PWA precache 6 entri, ukuran 1,34 MB). Namun **belum ada instance hosting staging terdedikasi di cloud/remote**. | Jalankan `npm run preview` pada `fe/` (port 4173) untuk mensimulasikan bundle staging, ATAU deploy `dist/` ke web host staging. |
| 3 | **Dedicated Staging Backend** | **NOT READY** | `be/.env` mengarah ke `HOST=127.0.0.1` dan `PORT=3000`. **Belum ada server backend staging terdedikasi di cloud/hosting publik**. | Jalankan backend lokal via `node server.js` (port 3000) pada komputer host pengujian, ATAU deploy backend ke server staging. |
| 4 | **Isolated Supabase Staging Project** | **READY** | `be/.env` dan `fe/.env.local` terhubung ke endpoint project Supabase yang sama (`tfzgztrvonkqsqmesmjy.supabase.co`). RLS aktif. | Pertahankan status database; jangan mengeksekusi DDL destruktif. |
| 5 | **Supabase Auth Test Accounts** | **NOT READY** | 7 spesifikasi peran akun sintetis telah dirancang, namun **belum dibuat secara fisik di database Supabase Auth**. | Daftarkan 6 akun terotentikasi di Supabase Auth dengan password sementara sebelum sesi testing dimulai. |
| 6 | **Supabase Storage Test Buckets** | **READY** | Bucket privat `informed-consent-templates`, `informed-consent-signatures`, `informed-consent-signed` terdefinisi dengan kebijakan RLS objek ketat. | Pastikan berkas templat master `informed-consent.pdf` telah terunggah pada bucket templat. |
| 7 | **Database Migrations** | **READY** | 8 berkas migrasi lokal sinkron dengan remote: `20261027000000` s/d `20261031180000`. Stored procedures & triggers aktif. | Tidak ada migrasi baru; pertahankan konsistensi skema. |
| 8 | **Website In-App Notification Service** | **READY** | Tabel `notifications`, RPC atomik, DTO, router `/api/v1/notifications`, dan UI `NotificationBell` teruji dan berfungsi. | Siap beroperasi secara otomatis saat mutasi booking berjalan. |
| 9 | **WhatsApp Fonnte Configuration** | **READY (Mock Pipeline) / BLOCKED (Live Delivery)** | Pipeline outbox atomik, scheduler, worker, dan webhook 100% lulus uji mock. Parameter `WHATSAPP_SEND_ENABLED=false` aktif di `be/.env`. Pengiriman nyata diblokir demi keselamatan. | Pengujian UAT dijalankan dalam mode Mock Outbox. Pengujian live memerlukan otorisasi resmi pengguna dan whitelist nomor. |
| 10 | **Test Phone Numbers & Emails** | **READY (Spesifikasi Sintetis) / NOT READY (Whitelist Riil)** | Alamat email `@sicare.test` dan nomor E.164 sintetis (`+6281200000001` s/d `+6281200000005`) telah dipetakan. Namun `WHATSAPP_TEST_RECIPIENTS` masih kosong. | Gunakan nomor sintetis untuk mode mock. Jika live diizinkan, daftarkan nomor HP nyata penguji ke whitelist. |

---

## C. Tester and Role Matrix

Matriks penugasan pengujian mencakup 6 konteks peran pengguna:

| No | Peran Sistem | Profil Penguji | Akun Uji Sintetis | Target Alur Kerja yang Diuji | Status Penyediaan Akun |
|---|---|---|---|---|:---:|
| 1 | **Admin** | Perwakilan Administrator | `uat.admin@sicare.test` | Manajemen akun konselor, periode akademik, log aktivitas, proteksi diri. | *Perlu Didaftarkan* |
| 2 | **Kepala LMI** | Pimpinan Lembaga LMI | `uat.kepala.lmi@sicare.test` | Dasbor eksekutif, laporan agregat layanan, tinjauan feedback mahasiswa. | *Perlu Didaftarkan* |
| 3 | **Counselor** | Konselor / Psikolog LMI | `uat.counselor@sicare.test` | Permintaan booking, jadwal, sesi, kesiapan consent, unduh PDF binaan. | *Perlu Didaftarkan* |
| 4 | **Client A** | Mahasiswa (Klien Individu) | `uat.client.a@sicare.test` | Booking individu, penandatanganan mandiri, unduh PDF pribadi. | *Perlu Didaftarkan* |
| 5 | **Client B** | Mahasiswa (Klien Kelompok)| `uat.client.b@sicare.test` | Booking kelompok, pendaftaran peserta terstruktur, monitoring status. | *Perlu Didaftarkan* |
| 6 | **Group Member (Akun)** | Mahasiswa Terdaftar | `uat.participant.a@sicare.test` | Penautan akun anti-spoofing via no. telp, autofill profil, tanda tangan. | *Perlu Didaftarkan* |
| 7 | **Group Guest A (Tamu)** | Peserta Tanpa Akun | *(Tanpa Akun; No. HP Uji)* | Portal tamu stateless HMAC, 7 field identitas, tanda tangan canvas, unduh PDF. | *Tidak Perlu Akun Auth* |
| 8 | **Group Guest B (Tamu)** | Peserta Tanpa Akun | *(Tanpa Akun; No. HP Uji)* | Pengujian token kedaluwarsa/dicabut, pemulihan sesi tamu (Scenario A & B). | *Tidak Perlu Akun Auth* |

---

## D. Admin UAT Results

- **UAT Preparation:** `COMPLETE` (Skenario `UAT-ADM-001` s/d `UAT-ADM-006` telah siap di `UAT_TEST_CASES.md`).
- **Technical Readiness:** `READY / PASS` (Terverifikasi secara otomatis melalui `be/test/finalIntegration.test.js` dan unit test admin).
  - Pembuatan akun konselor baru via API berjalan atomik dengan inisialisasi profil konselor dan log audit.
  - Rollback otomatis terbukti membersihkan user auth jika inisialisasi profil konselor gagal.
  - Validasi duplikasi email berfungsi andal (`EMAIL_ALREADY_EXISTS` / HTTP 409).
  - Validasi tanggal periode akademik menolak `ends_on < starts_on`.
  - Proteksi akun admin menolak penurunan peran sendiri atau penonaktifan akun sendiri (`SELF_ADMIN_CHANGE_BLOCKED`).
- **Human UAT Execution:** `PENDING / NOT STARTED` (Menunggu pengujian oleh perwakilan Admin).
- **Final User Acceptance:** `PENDING APPROVAL`.

---

## E. Kepala LMI UAT Results

- **UAT Preparation:** `COMPLETE` (Skenario `UAT-KLMI-001` s/d `UAT-KLMI-005` telah siap).
- **Technical Readiness:** `READY / PASS` (Terverifikasi secara otomatis melalui suite integrasi reporting).
  - Dasbor pimpinan memuat data agregat operasional riil dari API reporting.
  - Tinjauan feedback mahasiswa memungkinkan perubahan `review_status` (`reviewed`, `resolved`) dengan identitas mahasiswa tetap teranonimkan (`Klien Anonim #XXXX`).
  - Kepala LMI dibatasi dari hak mengubah moderasi publik (`moderation_status`).
  - Restriksi kepatuhan klinis least-privilege menolak Kepala LMI dari mengunduh atau membaca berkas PDF Informed Consent klinis (HTTP 403 Forbidden).
- **Human UAT Execution:** `PENDING / NOT STARTED` (Menunggu pengujian oleh perwakilan Kepala LMI).
- **Final User Acceptance:** `PENDING APPROVAL`.

---

## F. Counselor UAT Results

- **UAT Preparation:** `COMPLETE` (Skenario `UAT-KON-001` s/d `UAT-KON-006` telah siap).
- **Technical Readiness:** `READY / PASS` (Terverifikasi secara otomatis melalui suite booking & session).
  - Penerimaan booking mengonfirmasi format sesi (`online` / `offline`) dan ruangan/tautan.
  - Penolakan booking mewajibkan alasan penolakan tertulis (minimal 3 karakter).
  - Manajemen kalender jadwal mencegah bentrok slot tumpang tindih.
  - Transisi sesi `scheduled -> ongoing` diblokir secara mutlak jika ada peserta yang belum bertandatangan (`CONSENT_READINESS_INCOMPLETE`).
  - Konselor yang ditugaskan dapat mengunduh berkas PDF pasien binaannya, namun ditolak dari mengakses berkas sesi konselor lain (HTTP 403).
- **Human UAT Execution:** `PENDING / NOT STARTED` (Menunggu pengujian oleh perwakilan Konselor).
- **Final User Acceptance:** `PENDING APPROVAL`.

---

## G. Client UAT Results

- **UAT Preparation:** `COMPLETE` (Skenario `UAT-CLI-001` s/d `UAT-CLI-005` telah siap).
- **Technical Readiness:** `READY / PASS` (Terverifikasi secara otomatis melalui suite client booking & consent).
  - Pemesanan konseling individu mencakup pemilihan konselor, tanggal ketersediaan, dan topik konseling.
  - Formulir penandatanganan Informed Consent menampilkan pratinjau teks klausul resmi LMI, autofill data profil, dan interaksi canvas Signature Pad responsif.
  - Berkas PDF resmi 1 halaman A4 berhasil diunduh melalui presigned URL berumur pendek.
  - Isolasi data klien terbukti mencegah Client A mengakses booking atau dokumen milik Client B.
- **Human UAT Execution:** `PENDING / NOT STARTED` (Menunggu pengujian oleh perwakilan Mahasiswa/Klien).
- **Final User Acceptance:** `PENDING APPROVAL`.

---

## H. Authenticated Group Participant Results

- **UAT Preparation:** `COMPLETE` (Skenario `UAT-GRP-001` s/d `UAT-GRP-004` telah siap).
- **Technical Readiness:** `READY / PASS` (Terverifikasi secara otomatis melalui `be/test/groupConsent.test.js`).
  - Penerimaan undangan kelompok memvalidasi kecocokan nomor telepon akun (`ACCOUNT_PHONE_MISMATCH` pada nomor yang berbeda).
  - Data profil terverifikasi terisi otomatis ke formulir persetujuan.
  - Penandatanganan independen berhasil memperbarui status consent dan memicu rekalkulasi kesiapan kelompok.
- **Human UAT Execution:** `PENDING / NOT STARTED` (Menunggu pengujian oleh peserta berakun).
- **Final User Acceptance:** `PENDING APPROVAL`.

---

## I. Guest Participant Results

- **UAT Preparation:** `COMPLETE` (Skenario `UAT-GST-001` s/d `UAT-GST-005` telah siap).
- **Technical Readiness:** `READY / PASS` (Terverifikasi secara otomatis melalui `be/test/groupConsentClosure.test.js`).
  - Akses portal tamu via token HMAC-SHA256 membersihkan token URL seketika via `window.history.replaceState`.
  - Validasi ketat terhadap 7 field identitas klinis wajib.
  - Penandatanganan menghasilkan bukti PNG biner valid dan dokumen PDF A4 resmi.
  - Pemulihan sesi terverifikasi: Scenario A (refresh aman via httpOnly cookie) dan Scenario B (reopen link WhatsApp mengembalikan token baca-saja jika sudah signed).
  - Token kedaluwarsa atau dicabut ditolak dengan pesan informatif.
- **Human UAT Execution:** `PENDING / NOT STARTED` (Menunggu pengujian oleh peserta tamu).
- **Final User Acceptance:** `PENDING APPROVAL`.

---

## J. Booking Workflow Results

- **UAT Preparation:** `COMPLETE`.
- **Technical Readiness:** `READY / PASS`. Seluruh 5 status booking (`waiting_confirmation`, `confirmed`, `reschedule_requested`, `rejected`, `cancelled`) terpetakan konsisten. Pembatalan booking memicu pencabutan kaskade terhadap undangan kelompok dan pembatalan antrean outbox pengingat.
- **Human UAT Execution:** `PENDING / NOT STARTED`.
- **Final User Acceptance:** `PENDING APPROVAL`.

---

## K. Website Notification Results

- **UAT Preparation:** `COMPLETE`.
- **Technical Readiness:** `READY / PASS`. Pembangkitan notifikasi otomatis terjadi pada setiap mutasi siklus booking. Lonceng notifikasi menampilkan badge jumlah belum dibaca secara akurat. Mutasi tanda dibaca terisolasi pada penerima (`recipient_user_id = auth.uid()`).
- **Human UAT Execution:** `PENDING / NOT STARTED`.
- **Final User Acceptance:** `PENDING APPROVAL`.

---

## L. WhatsApp Fonnte Results

- **Status Pengujian Mock:**
  - **Technical Readiness:** `READY / PASS (44/44 Test WhatsApp Lulus)`.
  - Transactional outbox PostgreSQL atomik di RPC database.
  - Worker mandiri dengan sewa atomik `FOR UPDATE SKIP LOCKED`.
  - Scheduler pengingat sesi (H-1 & Hari H) dan pengingat consent (24h & 72h) idempoten.
  - Webhook callback Fonnte tahan terhadap pembaruan out-of-order (status terminal monotonik).
- **Status Pengiriman Langsung (Live Delivery):**
  - **Status:** `BLOCKED (Kebijakan Keamanan Sistem)`.
  - Parameter `WHATSAPP_SEND_ENABLED` diatur `false` (mode mock/dry-run) sampai ada persetujuan tertulis dan nomor uji resmi dari pengguna.

---

## M. Individual Informed Consent Results

- **UAT Preparation:** `COMPLETE`.
- **Technical Readiness:** `READY / PASS`. Integritas template master A4 1 halaman terverifikasi SHA-256 (`59012141...`), koordinat teks dan tanda tangan presisi, penolakan format non-PNG (anti-SVG/XSS), serta penyimpanan aman pada bucket privat.
- **Human UAT Execution:** `PENDING / NOT STARTED`.
- **Final User Acceptance:** `PENDING APPROVAL`.

---

## N. Group Consent Results

- **UAT Preparation:** `COMPLETE`.
- **Technical Readiness:** `READY / PASS`. Penyimpanan peserta kelompok sebagai entitas berstruktur terpisah di tabel `booking_participants`. Pemisahan record consent dan berkas PDF individual per peserta. Ringkasan status kelompok menyembunyikan identitas sensitif anggota kelompok lain.
- **Human UAT Execution:** `PENDING / NOT STARTED`.
- **Final User Acceptance:** `PENDING APPROVAL`.

---

## O. PDF and Document Access Results

- **UAT Preparation:** `COMPLETE`.
- **Technical Readiness:** `READY / PASS`. Presigned URL berumur pendek dihasilkan khusus untuk pihak yang berhak; URL publik storage ditolak (HTTP 400/404); akses lintas-klien dan lintas-konselor ditolak (HTTP 403).
- **Human UAT Execution:** `PENDING / NOT STARTED`.
- **Final User Acceptance:** `PENDING APPROVAL`.

---

## P. Session Readiness Results

- **UAT Preparation:** `COMPLETE`.
- **Technical Readiness:** `READY / PASS`.
  - Matriks 4 peserta: 4 Signed -> Sesi Siap (`Ready`).
  - Matriks 4 peserta: 3 Signed, 1 Pending -> Transisi sesi diblokir di database dengan error `CONSENT_READINESS_INCOMPLETE` (HTTP 409).
  - Konselor tidak dapat mem-bypass kesiapan persetujuan.
- **Human UAT Execution:** `PENDING / NOT STARTED`.
- **Final User Acceptance:** `PENDING APPROVAL`.

---

## Q. Security and Privacy Results

- **UAT Preparation:** `COMPLETE`.
- **Technical Readiness:** `READY / PASS`. RLS aktif pada seluruh tabel publik. Enkripsi AES-256-GCM `CONSENT_ENCRYPTION_KEY` fail-closed di production. Trigger imutabilitas bukti tanda tangan aktif. Audit log append-only menolak `UPDATE`/`DELETE`. Penolakan eskalasi peran pengguna.
- **Human UAT Execution:** `PENDING / NOT STARTED`.
- **Final User Acceptance:** `PENDING APPROVAL`.

---

## R. User Feedback

- **Status Instrumen:** Form umpan balik skala Likert (10 aspek operasional) dan 5 pertanyaan kualitatif terbuka telah disiapkan di [`docs/uat/UAT_USER_FEEDBACK.md`](UAT_USER_FEEDBACK.md).
- **Hasil Evaluasi Manusia:** `PENDING / MENUNGGU SESI UAT TIM` (Akan dikompilasi setelah sesi testing selesai).

---

## S. Defect Summary

Berdasarkan registri pada [`docs/uat/UAT_DEFECT_LOG.md`](UAT_DEFECT_LOG.md):
- **P0 (Critical):** 0
- **P1 (High):** 0
- **P2 (Medium):** 0
- **P3 (Low / Observasi):** 1 (Peringatan ukuran bundle frontend `dist/assets/index-*.js` sebesar 1.34 MB; non-blocking)
- **Status Kebijakan:** 1 BLOCKED (Pengiriman WhatsApp langsung ke nomor eksternal)
- **Total Cacat Menghalangi Rilis:** **0 Cacat Blocker**

---

## T. Automated Regression Results

Hasil eksekusi suite regresi otomatis komprehensif pada batch ini:

```bash
> node --check (31 backend files) -> PASS
> node --test (be/)               -> 184/184 PASS (1226ms)
> eslint . (fe/)                  -> PASS (0 errors, 0 warnings)
> tsc -b && vite build (fe/)      -> PASS (3.48s, 2458 modules)
> git diff --check                -> PASS (Clean)
```

---

## U. Remaining Issues & Action Items

1. **Penyediaan Akun Uji di Supabase Auth:** 6 akun uji terotentikasi perlu didaftarkan di Supabase Auth sebelum sesi pengujian tim dimulai.
2. **Pengiriman WhatsApp Fonnte Langsung:** Berstatus `BLOCKED` menunggu otorisasi resmi pemangku kepentingan dan penyediaan nomor telepon pengujian nyata. Pengujian berjalan dengan pipeline mock outbox.
3. **Penyediaan Server Frontend/Backend untuk UAT:** Tim perlu menjalankan `fe: npm run preview` (port 4173) dan `be: node server.js` (port 3000) pada komputer host testing.

---

## V. Acceptance and Sign-Off

- **Dimensi 1 (UAT Preparation):** **COMPLETE**
- **Dimensi 2 (Technical Readiness):** **READY / PASS (184/184 Automated Tests)**
- **Dimensi 3 (Human UAT Execution):** **PENDING / NOT STARTED (Menunggu Sesi Tim Minggu 1 Nov 2026)**
- **Dimensi 4 (Final User Acceptance):** **PENDING APPROVAL (Menunggu Tanda Tangan Berita Acara)**

---

## W. Final Recommendation

Berdasarkan pemisahan 4 dimensi evaluasi dan hasil audit kesiapan teknis:

### **ACCEPTED FOR STAGING (SIAP UNTUK MEMULAI UAT TERKENDALI OLEH TIM PENGUJI MANUSIA)**

*Catatan: Sistem direkomendasikan secara teknis untuk memasuki tahap User Acceptance Testing bersama perwakilan pengguna nyata pada Minggu malam, 1 November 2026. Persetujuan penerimaan sistem secara final tetap berstatus **PENDING** sampai pengujian manusia selesai dieksekusi dan berita acara ditandatangani.*
