# SiCARE Master UAT Test Plan

**Proyek:** SiCARE (Sistem Informasi Konseling & Rekam Terintegrasi)
**Dokumen:** Rencana Induk Pengujian Penerimaan Pengguna (Master UAT Test Plan)
**Tahap:** Batch 1.5g: Controlled User Acceptance Testing
**Tanggal Penyusunan:** 31 Oktober 2026
**Target Eksekusi Tim:** Minggu, 1 November 2026 (Sesuai `docs/WEEKEND_READINESS_PLAN.md`)
**Penanggung Jawab:** Tim Pengembang & QA SiCARE

---

## 1. Pendahuluan & Tujuan Utama

User Acceptance Testing (UAT) adalah tahap pengujian formal untuk memverifikasi bahwa aplikasi SiCARE memenuhi kebutuhan operasional nyata dan dapat dioperasikan secara benar, aman, serta nyaman oleh seluruh kelompok pengguna sasarannya.

UAT dirancang untuk mengevaluasi sistem secara menyeluruh dari perspektif 6 profil pengguna:
1. **Admin:** Pengelola data master, akun, periode akademik, dan observabilitas operasional.
2. **Kepala LMI:** Pimpinan lembaga yang memantau agregat layanan, laporan, dan umpan balik tanpa mengakses rekam medis/klinis personal.
3. **Konselor:** Tenaga profesional yang mengelola jadwal, memproses permintaan booking, memimpin sesi, dan memeriksa berkas Informed Consent klien binaannya.
4. **Klien (Mahasiswa Pemesan):** Mahasiswa yang mengajukan layanan konseling individu maupun kelompok, melengkapi Informed Consent, dan memantau riwayat.
5. **Peserta Kelompok Terdaftar (Dengan Akun SiCARE):** Peserta konseling kelompok yang memiliki akun SiCARE dan menautkan undangannya secara aman.
6. **Peserta Kelompok Tamu (Tanpa Akun SiCARE):** Peserta konseling kelompok yang tidak memiliki akun, mengakses portal mandiri via tautan ber-token kapabilitas aman, mengisi identitas, dan menandatangani persetujuan secara mandiri.

### Prinsip Utama UAT:
- **Human Verification Required:** Keberhasilan otomatisasi unit/integrasi (184/184 tests PASS) merupakan prasyarat teknis (*baseline*), bukan pengganti penerimaan pengguna manusia. UAT resmi hanya dinyatakan selesai apabila perwakilan manusia dari setiap peran telah mengeksekusi skenario dan memberikan persetujuan formal.
- **Workflow-Centric:** Pengujian berfokus pada alur kerja bisnis menyeluruh (*end-to-end*), bukan hanya fitur individual yang terisolasi.
- **Zero Fabrication:** Dilarang mengarang identitas penguji, bukti tangkapan layar, hasil pengujian, atau umpan balik palsu.

---

## 2. Cakupan Pengujian (Scope)

### 2.1 Modul dan Alur Kerja dalam Cakupan (In-Scope):
1. **Manajemen Akun & Otorisasi:** Pendaftaran konselor oleh admin, proteksi penurunan peran, deaktivasi, otentikasi login, pembaruan profil pengguna.
2. **Pengelolaan Periode Akademik:** Pembuatan periode akademik baru, validasi rentang tanggal, aktivasi/publikasi periode.
3. **Pemesanan Konseling Individu:** Pemilihan konselor dan slot jadwal, pengisian form pesanan, konfirmasi Klien, penerimaan/penolakan oleh Konselor dengan alasan.
4. **Pemesanan Konseling Kelompok:** Pendaftaran peserta kelompok berstruktur (Nama, No. WhatsApp), pembuatan record peserta independen, pencegahan duplikasi peserta.
5. **Digital Informed Consent Individu:** Peninjauan klausul resmi LMI Unika De La Salle Manado, penandatanganan mandiri via Signature Pad, pembangkitan dokumen PDF resmi A4 1 halaman via `pdf-lib`, pengunduhan berkas PDF ber-URL berumur pendek.
6. **Alur Persetujuan Konseling Kelompok (Group Consent):** Pembangkitan token undangan kriptografis, portal mandiri peserta tamu, penautan akun terotentikasi dengan verifikasi nomor telepon anti-spoofing, isolasi privasi data klinis antar peserta kelompok.
7. **Penegakan Kesiapan Sesi Konseling (Session Readiness Enforcement):** Evaluasi kesiapan consent kelompok secara atomik di database; pemblokiran transisi sesi `scheduled -> ongoing` bila ada peserta yang belum bertandatangan (`CONSENT_READINESS_INCOMPLETE`).
8. **Pengelolaan Jadwal & Sesi Konselor:** Kalender ketersediaan, penyelesaian sesi, pembatalan sesi terkonfirmasi beserta pembersihan kaskade undangan.
9. **Notifikasi Dalam Situs (Website In-App Notifications):** Notifikasi pesanan, persetujuan, penolakan, pembatalan, dan kesiapan consent dengan isolasi penerima.
10. **Pipeline WhatsApp Fonnte (Mode Mock / Outbox ACID):** Penjadwalan pesan transaksi, pengingat sesi (H-1 & Hari H), pengingat consent (24h & 72h), gerbang pembatalan akhir worker, dan penanganan status webhook monotonik.
11. **Privasi, Hak Akses, dan Keamanan Data:** Isolasi lintas-klien, isolasi lintas-konselor, pembatasan akses PDF klinis bagi Kepala LMI dan konselor luar, imutabilitas bukti bertandatangan.

### 2.2 Luar Cakupan (Out-of-Scope) / Status Khusus:
1. **Pengiriman WhatsApp Langsung ke Nomor Nyata (Live Delivery):** Berstatus **BLOCKED** sampai pengguna memberikan persetujuan tertulis dan menetapkan nomor seluler uji resmi.
2. **Perekaman Rekam Medis Klinis Lengkap (Clinical Notes Detail):** Sesuai matriks SOP, modul catatan klinis mendalam belum memiliki SOP hukum resmi dan tidak diuji dalam batch ini.
3. **Penggantian Password / Foto Profil:** Ditandai disabled secara transparan di UI karena belum didukung oleh backend API.

---

## 3. Strategi & Metodologi Pengujian

Pengujian dilakukan melalui pendekatan bertahap (*multi-stage validation*):
```
[Pre-UAT Automated Regression] (184/184 tests, build, lint)
               │
               ▼
   [Environment Readiness Audit] (docs/uat/UAT_ENVIRONMENT_READINESS.md)
               │
               ▼
     [Human Role-Based UAT] (Skenario A s/d J pada UAT_TEST_CASES.md)
               │
               ▼
    [Defect Logging & Triage] (docs/uat/UAT_DEFECT_LOG.md: P0 s/d P3)
               │
               ▼
      [Controlled Bug Fixes] (Targeted fixes & regression test)
               │
               ▼
     [User Feedback Collection] (docs/uat/UAT_USER_FEEDBACK.md)
               │
               ▼
   [Formal Sign-Off & Report] (docs/uat/UAT_FINAL_REPORT.md & SIGN_OFF.md)
```

---

## 4. Kriteria Masuk dan Kriteria Keluar (Entry & Exit Criteria)

### 4.1 Kriteria Masuk UAT (Entry Criteria):
- [x] Backend syntax check (`npm --prefix be run check`) **PASS**.
- [x] Backend automated unit & integration test suite (`npm --prefix be test`) **184/184 PASS**.
- [x] Frontend linting (`npm --prefix fe run lint`) **PASS (0 error, 0 warning)**.
- [x] Frontend production build (`npm --prefix fe run build`) **PASS**.
- [x] Seluruh skema migrasi database lokal sinkron dengan basis data staging.
- [x] Instrumen pengujian (Test Plan, Test Cases, Execution Sheet, Defect Log, Feedback Form, Sign-off Form) telah disiapkan lengkap.
- [x] Akun uji sintetis telah dipetakan untuk seluruh 6 konteks pengguna.

### 4.2 Kriteria Keluar UAT (Exit Criteria):
- [ ] Seluruh skenario uji P0 (Kritis) dan P1 (Tinggi) telah dieksekusi oleh perwakilan pengguna manusia dan berstatus **PASS**.
- [ ] Tidak ada cacat (*defect*) berkategori P0 (Critical) atau P1 (High) yang belum teratasi (*unresolved*).
- [ ] Cacat berkategori P2 (Medium) telah diperbaiki atau disetujui untuk ditunda ke rilis berikutnya dengan mitigasi terdokumentasi.
- [ ] Formulir evaluasi umpan balik (*User Feedback Instrument*) telah diisi oleh perwakilan masing-masing peran dengan skor rata-rata minimal 3.5 dari skala 5.
- [ ] Dokumen Persetujuan Resmi (*Sign-Off Document*) telah ditandatangani oleh pemangku kepentingan kunci (Admin, Konselor, Klien, Kepala LMI, QA Lead).

---

## 5. Klasifikasi Tingkat Keparahan Cacat (Defect Severity)

| Tingkat | Kategori | Definisi & Kriteria | SLA Penanganan |
|---|---|---|---|
| **P0** | **Critical** | Pelanggaran keamanan data, kebocoran dokumen klinis lintas-pengguna, bypass otorisasi/RLS, sesi dimulai tanpa consent, kegagalan fatal server. | Harus diperbaiki seketika; memblokir UAT. |
| **P1** | **High** | Alur bisnis utama terhenti: Klien tidak bisa booking, Konselor tidak bisa menyetujui, penandatanganan consent gagal, PDF gagal di-generate, notifikasi penting gagal. | Harus diselesaikan sebelum penandatanganan sign-off. |
| **P2** | **Medium** | Tampilan status tidak sinkron tanpa refresh, filter laporan tidak presisi, pesan peringatan UI kurang jelas, inkonsistensi visual non-fatal. | Diupayakan selesai sebelum rilis akhir atau ditunda dengan persetujuan. |
| **P3** | **Low** | Ketidaksejajaran minor pada layout UI, salah ketik label (*typo*), format tanggal kurang estetis. | Dicatat dalam backlog perbaikan bertahap. |

---

## 6. Matriks Pembagian Peran dan Tanggung Jawab

| Peran | Pihak Bertanggung Jawab | Tanggung Jawab Utama dalam UAT |
|---|---|---|
| **UAT Coordinator & QA** | Tim Antigravity / QA Lead | Menyiapkan instrumen uji, memandu penguji manusia, mencatat cacat, memfasilitasi perbaikan terkontrol. |
| **Admin Tester** | Perwakilan Administrator SiCARE | Menjalankan Skenario A (Manajemen Akun, Periode, Laporan, Log Aktivitas). |
| **Executive Tester** | Perwakilan Kepala LMI Unika De La Salle | Menjalankan Skenario B (Monitoring Eksekutif, Laporan Agregat, Tinjauan Feedback). |
| **Counselor Tester** | Perwakilan Konselor / Psikolog LMI | Menjalankan Skenario C (Penerimaan Booking, Penjadwalan, Sesi & Kesiapan Consent, Unduh PDF). |
| **Client Tester** | Perwakilan Mahasiswa / Klien Utama | Menjalankan Skenario D (Booking Individu/Kelompok, Tanda Tangan Mandiri, Unduh PDF). |
| **Group Participant Tester** | Mahasiswa Terdaftar & Tamu Simulasi | Menjalankan Skenario E, F, dan G (Penautan Akun, Portal Tamu, Pengisian Identitas, Penandatanganan). |

---

## 7. Jadwal Pelaksanaan UAT (Target Akhir Pekan)

| Waktu / Tanggal | Agenda Kegiatan | Output yang Diharapkan |
|---|---|---|
| **Sabtu, 31 Okt 2026 (Malam)** | Audit Kesiapan Lingkungan & Finalisasi Instrumen UAT | Seluruh 8 dokumen UAT di `docs/uat/` siap pakai. |
| **Minggu, 1 Nov 2026 (Pagi - Siang)** | Briefing Penguji, Distribusi Akun Uji, Eksekusi Skenario A–D | Lembar eksekusi terisi hasil observasi nyata awal. |
| **Minggu, 1 Nov 2026 (Sore)** | Eksekusi Skenario E–J (Konseling Kelompok, Tamu, Notifikasi, Keamanan) | Identifikasi cacat dan pencatatan pada Defect Log. |
| **Minggu, 1 Nov 2026 (Malam)** | Controlled Fixes (bila ada defect), Retesting, Pengumpulan Feedback & Evaluasi Sign-Off | `UAT_FINAL_REPORT.md` dan rekomendasi kesiapan tim. |
