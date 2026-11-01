# SiCARE UAT Formal Sign-Off Instrument

**Proyek:** SiCARE (Sistem Informasi Konseling & Rekam Terintegrasi)
**Dokumen:** Berita Acara Penerimaan Pengguna (User Acceptance Sign-Off Form)
**Tahap:** Batch 1.5g: Controlled User Acceptance Testing
**Tanggal Rilis Form:** 31 Oktober 2026
**Status Penerimaan:** MENUNGGU PELAKSANAAN DAN PERSETUJUAN AKTUAL PENGUJI MANUSIA (PENDING ACTUAL HUMAN APPROVAL)

---

## 1. Kriteria Penerimaan Sistem (System Acceptance Criteria)

Sistem SiCARE dinyatakan diterima secara formal apabila memenuhi ketentuan dalam matriks kriteria penerimaan berikut:

| No | Kriteria Penerimaan Sistem | Standar Verifikasi Faktual | Status Verifikasi Teknis | Status Persetujuan Pengguna |
|---|---|---|:---:|:---:|
| 1 | **Stabilitas & Integritas Kode** | Seluruh test suite otomatis lulus 100%, 0 lint error/warning, build produksi PWA berhasil. | **PASS (184/184 Test)** | Menunggu Verifikasi UI |
| 2 | **Informed Consent Digital Individu** | Template resmi LMI De La Salle A4 terisi presisi, tanda tangan biner PNG valid, SHA-256 terverifikasi. | **PASS (Teruji Unit/E2E)** | Menunggu Pengujian Klien |
| 3 | **Alur Peserta Kelompok Berakun** | Penautan akun anti-spoofing terverifikasi via nomor telepon, autofill profil, tanda tangan mandiri, unduh PDF pribadi, pembaruan kesiapan kelompok. | **PASS (Teruji Unit/E2E)** | Menunggu Pengujian Peserta Berakun |
| 4 | **Alur Peserta Kelompok Tamu (Tanpa Akun)** | Portal stateless HMAC tanpa login, scrubbing URL seketika via `replaceState`, validasi 7 field wajib, tanda tangan canvas, pemulihan sesi (refresh via httpOnly cookie & reopen via read-only capability token). | **PASS (Teruji Unit/E2E)** | Menunggu Pengujian Peserta Tamu |
| 5 | **Penegakan Kesiapan Sesi Konseling** | Database RPC memblokir sesi `scheduled -> ongoing` bila ada peserta yang belum bertandatangan (`CONSENT_READINESS_INCOMPLETE`). | **PASS (Teruji Unit/E2E)** | Menunggu Pengujian Konselor |
| 6 | **Keamanan & Pembatasan Dokumen Klinis** | Dokumen PDF klinis hanya dapat diakses oleh penandatangan dan konselor binaan; Kepala LMI dan konselor luar ditolak keras (HTTP 403). | **PASS (Teruji Unit/E2E)** | Menunggu Verifikasi Pimpinan |
| 7 | **Manajemen Cacat Kritis** | 0 Cacat P0 (Kritis) dan 0 Cacat P1 (Tinggi) yang belum terselesaikan. | **TERPENUHI (0 Cacat Blocker)** | Menunggu Pengujian Tim |
| 8 | **Evaluasi Kepuasan Pengguna** | Skor rata-rata kuesioner umpan balik minimal 3.5 dari skala 5.0 di setiap peran. | **Instrumen Disiapkan** | Menunggu Pengisian Form |

---

## 2. Formulir Tanda Tangan Persetujuan Pemangku Kepentingan (Stakeholder Sign-Off)

*Formulir ini wajib ditandatangani oleh perwakilan manusia yang ditunjuk dari masing-masing pihak setelah sesi pengujian tim pada Minggu 1 November 2026:*

### 1. Perwakilan Administrator Sistem
- **Nama Terang:** _______________________________________
- **Jabatan:** Administrator Sistem SiCARE
- **Pernyataan:** Menyatakan bahwa fungsi pengelolaan data master, manajemen akun konselor, pemantauan log aktivitas sistem, dan konfigurasi periode akademik telah diuji dan memenuhi kebutuhan administratif.
- **Putusan:** [ ] Diterima Penuh  [ ] Diterima Bersyarat  [ ] Perlu UAT Lanjutan  [ ] Ditolak
- **Tanda Tangan:** _______________________  **Tanggal:** _______________
- **Catatan / Syarat:** __________________________________________________________________

---

### 2. Perwakilan Kepala Lembaga Misi & Identitas (LMI)
- **Nama Terang:** _______________________________________
- **Jabatan:** Kepala Lembaga Misi & Identitas (LMI) Unika De La Salle Manado
- **Pernyataan:** Menyatakan bahwa dasbor pemantauan eksekutif, laporan agregat layanan, serta penegakan kerahasiaan dokumen klinis telah sesuai dengan tata kelola institusi dan SOP kerahasiaan bimbingan konseling.
- **Putusan:** [ ] Diterima Penuh  [ ] Diterima Bersyarat  [ ] Perlu UAT Lanjutan  [ ] Ditolak
- **Tanda Tangan:** _______________________  **Tanggal:** _______________
- **Catatan / Syarat:** __________________________________________________________________

---

### 3. Perwakilan Tim Konselor / Psikolog
- **Nama Terang:** _______________________________________
- **Jabatan:** Konselor / Psikolog LMI
- **Pernyataan:** Menyatakan bahwa alur penerimaan pesanan, pengelolaan jadwal, penegakan kesiapan informed consent sebelum sesi, serta akses terhadap dokumen persetujuan pasien binaan telah berfungsi dengan baik dan aman.
- **Putusan:** [ ] Diterima Penuh  [ ] Diterima Bersyarat  [ ] Perlu UAT Lanjutan  [ ] Ditolak
- **Tanda Tangan:** _______________________  **Tanggal:** _______________
- **Catatan / Syarat:** __________________________________________________________________

---

### 4. Perwakilan Mahasiswa / Klien Utama (Pemesan Layanan)
- **Nama Terang:** _______________________________________
- **Peran:** Perwakilan Mahasiswa / Klien Pemesan (Individu & Kelompok)
- **Pernyataan:** Menyatakan bahwa proses pemesanan konseling (individu & kelompok), pendaftaran peserta kelompok, penandatanganan Informed Consent digital mandiri, pemantauan status anggota, serta pengunduhan dokumen bukti telah diuji dan dapat digunakan dengan nyaman.
- **Putusan:** [ ] Diterima Penuh  [ ] Diterima Bersyarat  [ ] Perlu UAT Lanjutan  [ ] Ditolak
- **Tanda Tangan:** _______________________  **Tanggal:** _______________
- **Catatan / Syarat:** __________________________________________________________________

---

### 5. Perwakilan Peserta Kelompok Terdaftar (Berakun SiCARE)
- **Nama Terang:** _______________________________________
- **Peran:** Peserta Konseling Kelompok Pemilik Akun SiCARE
- **Pernyataan:** Menyatakan bahwa penerimaan tautan undangan, proses penautan akun terotentikasi dengan verifikasi nomor telepon anti-spoofing, pengisian otomatis data profil terverifikasi, penandatanganan persetujuan mandiri, serta pengunduhan berkas PDF pribadi telah diuji dan berfungsi secara aman tanpa kebocoran data antar anggota kelompok.
- **Putusan:** [ ] Diterima Penuh  [ ] Diterima Bersyarat  [ ] Perlu UAT Lanjutan  [ ] Ditolak
- **Tanda Tangan:** _______________________  **Tanggal:** _______________
- **Catatan / Syarat:** __________________________________________________________________

---

### 6. Perwakilan / Validator Pengujian Peserta Kelompok Tamu (Tanpa Akun SiCARE / Guest)
- **Nama Terang:** _______________________________________
- **Peran:** Penguji / Validator Alur Peserta Tamu Mandiri
- **Pernyataan:** Menyatakan bahwa alur portal tamu tanpa akun (`/consent/invite`) telah diuji: token HMAC stateless terverifikasi, parameter token URL seketika dibersihkan via `replaceState`, 7 field identitas wajib tervalidasi dengan ketat, penandatanganan canvas lancar, pemulihan sesi (refresh via httpOnly cookie & reopen link WhatsApp via capability token read-only saat signed) berfungsi andal, serta token kedaluwarsa/dicabut ditolak sistem secara konsisten.
- **Putusan:** [ ] Diterima Penuh  [ ] Diterima Bersyarat  [ ] Perlu UAT Lanjutan  [ ] Ditolak
- **Tanda Tangan:** _______________________  **Tanggal:** _______________
- **Catatan / Syarat:** __________________________________________________________________

---

### 7. Koordinator QA & Pengujian Sistem
- **Nama Terang:** _______________________________________
- **Jabatan:** QA Lead / Koordinator Pengujian Sistem
- **Pernyataan:** Menyatakan bahwa seluruh tahapan persiapan, verifikasi regresi otomatis, triase cacat, audit kesiapan lingkungan, dan peninjauan keamanan telah dilaksanakan secara terkendali sesuai prosedur pengujian resmi.
- **Putusan Rekomendasi:** [ ] ACCEPTED FOR STAGING  [ ] REQUIRES FURTHER UAT  [ ] BLOCKED
- **Tanda Tangan:** _______________________  **Tanggal:** _______________
- **Catatan Teknis:** ____________________________________________________________________

---

## 3. Status Keputusan Akhir Penerimaan

| Parameter Evaluasi | Status Faktual |
|---|---|
| **Dimensi 1: Kesiapan Persiapan (UAT Preparation):** | **COMPLETE (Seluruh 8 instrumen UAT terbit dan terverifikasi)** |
| **Dimensi 2: Kesiapan Teknis (Technical Readiness):** | **READY / PASS (184/184 Automated Tests, 0 lint error, build PWA PASS)** |
| **Dimensi 3: Eksekusi UAT Manusia (Human Execution):** | **PENDING / NOT STARTED (Menunggu Sesi Tim Minggu 1 Nov 2026)** |
| **Dimensi 4: Persetujuan Akhir Pengguna (Sign-Off):** | **PENDING APPROVAL (Menunggu Pelaksanaan & Tanda Tangan Para Pihak)** |
| **Rekomendasi Teknis Resmi:** | **ACCEPTED FOR CONTROLLED STAGING UAT** |
