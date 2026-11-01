# SiCARE UAT Test Execution Record

**Proyek:** SiCARE (Sistem Informasi Konseling & Rekam Terintegrasi)
**Dokumen:** Lembar Catatan Eksekusi Pengujian Penerimaan Pengguna (Execution Record)
**Tahap:** Batch 1.5g: Controlled User Acceptance Testing
**Tanggal Rilis Instrumen:** 31 Oktober 2026
**Status Sesi:** INSTRUMEN SIAP UNTUK EKSEKUSI MANUSIA (PREPARED FOR HUMAN EXECUTION)

---

## 1. Panduan Pengisian untuk Penguji Manusia

1. Setiap penguji manusia bertanggung jawab untuk menguji skenario sesuai peran yang ditugaskan dalam `docs/uat/UAT_TEST_PLAN.md`.
2. Lakukan pengujian secara urut mengacu pada langkah-langkah di `docs/uat/UAT_TEST_CASES.md`.
3. Catat hasil pengamatan faktual pada kolom **Hasil Pengamatan (Actual Result)**.
4. Tentukan status putusan pada kolom **Putusan (Verdict)**:
   - **PASS:** Sistem berperilaku persis sesuai kriteria yang diharapkan.
   - **FAIL:** Terjadi kegagalan fungsi, pesan error tidak wajar, data tidak tersimpan, atau pelanggaran otorisasi. Segera catat nomor cacat di `docs/uat/UAT_DEFECT_LOG.md`.
   - **BLOCKED:** Pengujian tidak dapat dilanjutkan karena komponen dependensi belum tersedia atau terkunci kebijakan keselamatan.
   - **NOT TESTED:** Kasus uji belum dieksekusi oleh penguji.
5. Cantumkan nama/inisial penguji, tanggal eksekusi, serta tautan bukti tangkapan layar atau log.

---

## 2. Ringkasan Status Verifikasi Awal (Pre-UAT Automated Baseline)

Sebelum pengujian manusia dimulai, pemeriksaan regresi otomatis pra-UAT telah dieksekusi pada lingkungan lokal/staging:

| Komponen Pemeriksaan | Alat Pemeriksaan | Hasil Faktual | Status |
|---|---|---|---|
| Backend Syntax Integrity | `node --check` (31 berkas backend) | 31/31 berkas valid tanpa sintaks error | **PASS** |
| Backend Automated Test Suite | `node --test` (Unit & Integration) | **184/184 PASS** (0 failed, 0 skipped, durasi 1.2s) | **PASS** |
| Frontend ESLint Code Quality | `npm --prefix fe run lint` | 0 errors, 0 warnings | **PASS** |
| Frontend Production Build | `npm --prefix fe run build` | 2458 modul ditransformasi, dist PWA terbentuk (3.48s) | **PASS** |
| Database Migration Alignment | `npx supabase migration list` | 8/8 berkas migrasi lokal sinkron dengan remote | **PASS** |
| Git Working Tree Hygiene | `git diff --check` | Bersih dari whitespace error atau marker konflik | **PASS** |

*Catatan Penting: Keberhasilan otomatisasi di atas tidak menggantikan pengujian manusia. Tabel di bawah ini disediakan khusus untuk mendokumentasikan hasil pengujian faktual oleh manusia.*

---

## 3. Matriks Lembar Kerja Eksekusi Pengujian Pengguna (Human UAT)

| Test ID | Modul & Judul Skenario Uji | Peran Penguji | Pra-UAT Baseline | Tanggal Uji | Nama Penguji | Hasil Pengamatan Faktual (Actual Result) | Putusan (Verdict) | No. Cacat / Ref Bukti |
|---|---|---|---|---|---|---|---|---|
| **UAT-ADM-001** | Pembuatan Akun Konselor Baru & Validasi Duplikat | Admin | PASS (Auto) | *(Diisi Penguji)* | *(Nama Penguji)* | *(Diisi saat eksekusi)* | `PREPARED` | - |
| **UAT-ADM-002** | Verifikasi Login Akun Konselor Baru | Counselor | PASS (Auto) | *(Diisi Penguji)* | *(Nama Penguji)* | *(Diisi saat eksekusi)* | `PREPARED` | - |
| **UAT-ADM-003** | Pengelolaan Periode Akademik & Validasi Tanggal | Admin | PASS (Auto) | *(Diisi Penguji)* | *(Nama Penguji)* | *(Diisi saat eksekusi)* | `PREPARED` | - |
| **UAT-ADM-004** | Dasbor Monitoring & Log Aktivitas Sistem | Admin | PASS (Auto) | *(Diisi Penguji)* | *(Nama Penguji)* | *(Diisi saat eksekusi)* | `PREPARED` | - |
| **UAT-ADM-005** | Pembaruan Profil Admin & Persistensi | Admin | PASS (Auto) | *(Diisi Penguji)* | *(Nama Penguji)* | *(Diisi saat eksekusi)* | `PREPARED` | - |
| **UAT-ADM-006** | Proteksi Admin (Self-Demotion & PDF Akses) | Admin / QA | PASS (Auto) | *(Diisi Penguji)* | *(Nama Penguji)* | *(Diisi saat eksekusi)* | `PREPARED` | - |
| **UAT-KLMI-001** | Dasbor Eksekutif & Statistik Konseling | Kepala LMI | PASS (Auto) | *(Diisi Penguji)* | *(Nama Penguji)* | *(Diisi saat eksekusi)* | `PREPARED` | - |
| **UAT-KLMI-002** | Laporan Layanan & Ekspor Data Agregat | Kepala LMI | PASS (Auto) | *(Diisi Penguji)* | *(Nama Penguji)* | *(Diisi saat eksekusi)* | `PREPARED` | - |
| **UAT-KLMI-003** | Monitoring & Peninjauan Feedback Mahasiswa | Kepala LMI | PASS (Auto) | *(Diisi Penguji)* | *(Nama Penguji)* | *(Diisi saat eksekusi)* | `PREPARED` | - |
| **UAT-KLMI-004** | Pembaruan Profil Kepala LMI | Kepala LMI | PASS (Auto) | *(Diisi Penguji)* | *(Nama Penguji)* | *(Diisi saat eksekusi)* | `PREPARED` | - |
| **UAT-KLMI-005** | Penegakan Privasi & Batasan Akses Pimpinan | Kepala LMI | PASS (Auto) | *(Diisi Penguji)* | *(Nama Penguji)* | *(Diisi saat eksekusi)* | `PREPARED` | - |
| **UAT-KON-001** | Menerima Booking Konseling (Format & Ruang) | Counselor | PASS (Auto) | *(Diisi Penguji)* | *(Nama Penguji)* | *(Diisi saat eksekusi)* | `PREPARED` | - |
| **UAT-KON-002** | Menolak Booking dengan Alasan Wajib | Counselor | PASS (Auto) | *(Diisi Penguji)* | *(Nama Penguji)* | *(Diisi saat eksekusi)* | `PREPARED` | - |
| **UAT-KON-003** | Pengelolaan Kalender & Slot Ketersediaan | Counselor | PASS (Auto) | *(Diisi Penguji)* | *(Nama Penguji)* | *(Diisi saat eksekusi)* | `PREPARED` | - |
| **UAT-KON-004** | Penegakan Kesiapan Sesi (Consent Blockade) | Counselor | PASS (Auto) | *(Diisi Penguji)* | *(Nama Penguji)* | *(Diisi saat eksekusi)* | `PREPARED` | - |
| **UAT-KON-005** | Pembatalan Sesi & Pembersihan Kaskade Undangan | Counselor | PASS (Auto) | *(Diisi Penguji)* | *(Nama Penguji)* | *(Diisi saat eksekusi)* | `PREPARED` | - |
| **UAT-KON-006** | Hak Akses Berkas PDF Pasien Binaan Konselor | Counselor | PASS (Auto) | *(Diisi Penguji)* | *(Nama Penguji)* | *(Diisi saat eksekusi)* | `PREPARED` | - |
| **UAT-CLI-001** | Pemesanan Konseling Individu | Client A | PASS (Auto) | *(Diisi Penguji)* | *(Nama Penguji)* | *(Diisi saat eksekusi)* | `PREPARED` | - |
| **UAT-CLI-002** | Pemesanan Konseling Kelompok & Validasi Duplikat | Client B | PASS (Auto) | *(Diisi Penguji)* | *(Nama Penguji)* | *(Diisi saat eksekusi)* | `PREPARED` | - |
| **UAT-CLI-003** | Peninjauan Riwayat & Status Pemesanan Klien | Client A | PASS (Auto) | *(Diisi Penguji)* | *(Nama Penguji)* | *(Diisi saat eksekusi)* | `PREPARED` | - |
| **UAT-CLI-004** | Penandatanganan Digital & Unduh PDF Klien | Client A | PASS (Auto) | *(Diisi Penguji)* | *(Nama Penguji)* | *(Diisi saat eksekusi)* | `PREPARED` | - |
| **UAT-CLI-005** | Isolasi Privasi Lintas-Klien | Client A / B | PASS (Auto) | *(Diisi Penguji)* | *(Nama Penguji)* | *(Diisi saat eksekusi)* | `PREPARED` | - |
| **UAT-GRP-001** | Penerimaan Undangan & Autentikasi Akun | Group Member | PASS (Auto) | *(Diisi Penguji)* | *(Nama Penguji)* | *(Diisi saat eksekusi)* | `PREPARED` | - |
| **UAT-GRP-002** | Verifikasi No. Telp Anti-Spoofing Klaim Undangan | Group Member | PASS (Auto) | *(Diisi Penguji)* | *(Nama Penguji)* | *(Diisi saat eksekusi)* | `PREPARED` | - |
| **UAT-GRP-003** | Auto-Fill Data Profil & Penandatanganan Mandiri | Group Member | PASS (Auto) | *(Diisi Penguji)* | *(Nama Penguji)* | *(Diisi saat eksekusi)* | `PREPARED` | - |
| **UAT-GRP-004** | Akses PDF Mandiri & Pembaruan Kesiapan Kelompok | Group Member | PASS (Auto) | *(Diisi Penguji)* | *(Nama Penguji)* | *(Diisi saat eksekusi)* | `PREPARED` | - |
| **UAT-GST-001** | Akses Portal Tamu & Pembersihan URL Seketika | Guest A | PASS (Auto) | *(Diisi Penguji)* | *(Nama Penguji)* | *(Diisi saat eksekusi)* | `PREPARED` | - |
| **UAT-GST-002** | Validasi 7 Field Identitas Wajib Tamu | Guest A | PASS (Auto) | *(Diisi Penguji)* | *(Nama Penguji)* | *(Diisi saat eksekusi)* | `PREPARED` | - |
| **UAT-GST-003** | Penandatanganan Kanvas & Pembuatan PDF Tamu | Guest A | PASS (Auto) | *(Diisi Penguji)* | *(Nama Penguji)* | *(Diisi saat eksekusi)* | `PREPARED` | - |
| **UAT-GST-004** | Pemulihan Sesi Tamu (Refresh & Reopen Link) | Guest A | PASS (Auto) | *(Diisi Penguji)* | *(Nama Penguji)* | *(Diisi saat eksekusi)* | `PREPARED` | - |
| **UAT-GST-005** | Penolakan Token Expired/Revoked & Isolasi Tamu | Guest B | PASS (Auto) | *(Diisi Penguji)* | *(Nama Penguji)* | *(Diisi saat eksekusi)* | `PREPARED` | - |
| **UAT-GCS-001** | Skenario Kelompok: 4 Signed -> Ready | Counselor/Client| PASS (Auto) | *(Diisi Penguji)* | *(Nama Penguji)* | *(Diisi saat eksekusi)* | `PREPARED` | - |
| **UAT-GCS-002** | Skenario Kelompok: 3 Signed, 1 Pending -> Blocked | Counselor | PASS (Auto) | *(Diisi Penguji)* | *(Nama Penguji)* | *(Diisi saat eksekusi)* | `PREPARED` | - |
| **UAT-GCS-003** | Skenario Kelompok: Undangan Expired/Revoked | Counselor/Client| PASS (Auto) | *(Diisi Penguji)* | *(Nama Penguji)* | *(Diisi saat eksekusi)* | `PREPARED` | - |
| **UAT-GCS-004** | Imutabilitas Bukti Hukum terhadap Pembaruan Profil | Client / QA | PASS (Auto) | *(Diisi Penguji)* | *(Nama Penguji)* | *(Diisi saat eksekusi)* | `PREPARED` | - |
| **UAT-NOT-001** | Pembangkitan Notifikasi Siklus Booking | Client/Counselor| PASS (Auto) | *(Diisi Penguji)* | *(Nama Penguji)* | *(Diisi saat eksekusi)* | `PREPARED` | - |
| **UAT-NOT-002** | Isolasi Penerima & Lencana Belum Dibaca | Client | PASS (Auto) | *(Diisi Penguji)* | *(Nama Penguji)* | *(Diisi saat eksekusi)* | `PREPARED` | - |
| **UAT-NOT-003** | Navigasi Cepat dari Notifikasi ke Halaman Aktivitas | Client/Counselor| PASS (Auto) | *(Diisi Penguji)* | *(Nama Penguji)* | *(Diisi saat eksekusi)* | `PREPARED` | - |
| **UAT-FON-001** | WhatsApp Outbox, Idempotensi & Reminder (Mock) | QA / System | PASS (Auto) | *(Diisi Penguji)* | *(Nama Penguji)* | *(Diisi saat eksekusi)* | `PREPARED` | - |
| **UAT-FON-002** | Verifikasi Pembatasan Pengiriman WhatsApp Langsung | QA / Admin | Kebijakan Aman | 31 Okt 2026 | QA Team | Pengiriman langsung ke pihak ketiga eksternal diblokir sesuai aturan keselamatan. | `BLOCKED` | Kebijakan Keamanan (§2) |
| **UAT-SEC-001** | Isolasi Akses Lintas-Klien (PostgREST RLS & API) | QA / Client | PASS (Auto) | *(Diisi Penguji)* | *(Nama Penguji)* | *(Diisi saat eksekusi)* | `PREPARED` | - |
| **UAT-SEC-002** | Isolasi Akses Lintas-Konselor | QA / Counselor | PASS (Auto) | *(Diisi Penguji)* | *(Nama Penguji)* | *(Diisi saat eksekusi)* | `PREPARED` | - |
| **UAT-SEC-003** | Restriksi PDF Klinis bagi Kepala LMI & Non-Assigned | QA / Head LMI | PASS (Auto) | *(Diisi Penguji)* | *(Nama Penguji)* | *(Diisi saat eksekusi)* | `PREPARED` | - |
| **UAT-SEC-004** | Perlindungan Storage Bucket Privat Supabase | QA / Public | PASS (Auto) | *(Diisi Penguji)* | *(Nama Penguji)* | *(Diisi saat eksekusi)* | `PREPARED` | - |
| **UAT-SEC-005** | Penolakan Eskalasi Peran (Privilege Escalation) | QA / User | PASS (Auto) | *(Diisi Penguji)* | *(Nama Penguji)* | *(Diisi saat eksekusi)* | `PREPARED` | - |

---

## 4. Rekapitulasi Kemajuan Eksekusi UAT

- **Total Skenario Uji:** 45 Kasus Uji
- **Status Otomatisasi Pra-UAT:** 44/45 PASS (97.8%), 1/45 BLOCKED (Live WhatsApp)
- **Status Eksekusi Pengguna Manusia:**
  - `PASS`: 0 (Menunggu pelaksanaan sesi pengujian tim Minggu 1 Nov 2026)
  - `FAIL`: 0
  - `BLOCKED`: 1 (`UAT-FON-002` - Pengiriman WhatsApp Langsung)
  - `PREPARED / READY`: 44 (Siap dieksekusi)
- **Tingkat Penyelesaian Pengujian Manusia:** 0% (Instrumen UAT Baru Dirilis; Menunggu Eksekusi Aktual Pengguna)
