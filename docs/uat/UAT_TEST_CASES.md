# SiCARE UAT Test Cases

**Proyek:** SiCARE (Sistem Informasi Konseling & Rekam Terintegrasi)
**Dokumen:** Spesifikasi Skenario & Kasus Uji Penerimaan Pengguna (UAT Test Cases)
**Versi:** 1.0.0
**Tanggal:** 31 Oktober 2026
**Status Instrumen:** PREPARED / READY FOR HUMAN TESTING
**Cakupan:** 10 Rangkaian Skenario (Skenario A s/d J)

---

## Format Lembar Kasus Uji

Setiap kasus uji didefinisikan dengan parameter berikut:
- **Test ID:** Pengenal unik terstandarisasi.
- **Module:** Modul fungsional yang diuji.
- **User Role:** Peran pengguna yang mengeksekusi pengujian.
- **Preconditions:** Kondisi awal sistem sebelum pengujian dijalankan.
- **Test Steps:** Langkah-langkah pengujian sekuensial yang harus diikuti penguji.
- **Expected Result:** Perilaku sistem yang diharapkan sesuai spesifikasi dan SOP.
- **Actual Result:** Hasil pengamatan faktual yang dicatat oleh penguji manusia.
- **Status:** Status penerimaan (`PREPARED`, `PASS`, `FAIL`, `BLOCKED`, `NOT TESTED`).
- **Evidence:** Referensi bukti tangkapan layar, log konsol, atau catatan verifikasi.
- **Tester:** Nama/inisial penguji manusia yang menjalankan pengujian.
- **Notes:** Catatan tambahan atau kendala operasional yang ditemukan.

---

## Skenario A: Alur Pengguna Administrator (Admin)

### UAT-ADM-001: Pembuatan Akun Konselor Baru oleh Admin
- **Test ID:** `UAT-ADM-001`
- **Module:** Manajemen Akun (`/admin/akun`)
- **User Role:** Admin (`uat.admin@sicare.test`)
- **Preconditions:** Admin telah login ke aplikasi SiCARE dan berada di halaman Manajemen Akun.
- **Test Steps:**
  1. Klik tombol **Tambah Akun**.
  2. Pilih Peran: **Konselor** (`counselor`).
  3. Masukkan Nama Lengkap sintetis: `Konselor UAT Baru`.
  4. Masukkan Email: `counselor.new@sicare.test`.
  5. Masukkan Nomor WhatsApp: `081234567890` (diformat otomatis ke `+6281234567890`).
  6. Masukkan Password awal yang valid (minimal 8 karakter).
  7. Klik **Simpan**.
  8. Lakukan percobaan kedua dengan email yang sama persis (`counselor.new@sicare.test`).
- **Expected Result:**
  - Pendaftaran pertama berhasil: Akun baru muncul di daftar akun, record `counselor_profiles` otomatis dibuat dengan `is_public = false`, dan log audit tercatat.
  - Percobaan kedua ditolak: Sistem menampilkan pesan validasi error bahwa email sudah terdaftar (`EMAIL_ALREADY_EXISTS` / HTTP 409).
- **Actual Result:** *(Diisi penguji manusia saat eksekusi)*
- **Status:** `PREPARED`
- **Evidence:** *(Tangkapan layar form & respon error duplikat)*
- **Tester:** *(Nama Penguji Admin)*
- **Notes:** *(Catatan pengujian)*

---

### UAT-ADM-002: Verifikasi Login Akun Konselor yang Baru Dibuat
- **Test ID:** `UAT-ADM-002`
- **Module:** Autentikasi (`/login`)
- **User Role:** Counselor (`counselor.new@sicare.test`)
- **Preconditions:** Akun konselor telah berhasil didaftarkan oleh Admin pada `UAT-ADM-001`.
- **Test Steps:**
  1. Logout dari akun Admin.
  2. Buka halaman login (`/login`).
  3. Masukkan email `counselor.new@sicare.test` dan password yang didaftarkan.
  4. Klik tombol **Masuk**.
- **Expected Result:** Konselor berhasil masuk ke sistem dan secara otomatis diarahkan ke dasbor Konselor (`/konselor/beranda`). Profil terkonfirmasi sebagai konselor.
- **Actual Result:** *(Diisi penguji manusia saat eksekusi)*
- **Status:** `PREPARED`
- **Evidence:** *(Tangkapan layar halaman /konselor/beranda pasca-login)*
- **Tester:** *(Nama Penguji Konselor/Admin)*
- **Notes:** *(Catatan pengujian)*

---

### UAT-ADM-003: Pengelolaan Periode Akademik & Validasi Tanggal
- **Test ID:** `UAT-ADM-003`
- **Module:** Periode Akademik (`/admin/periode`)
- **User Role:** Admin
- **Preconditions:** Admin telah login dan berada di halaman Pengaturan Periode.
- **Test Steps:**
  1. Klik tombol **Tambah Periode**.
  2. Masukkan Tahun Akademik: `2026/2027`, Semester: `Ganjil`.
  3. Masukkan Tanggal Mulai: `2026-08-01` dan Tanggal Selesai yang tidak valid: `2026-07-01` (selesai sebelum mulai).
  4. Klik **Simpan** dan amati reaksi sistem.
  5. Perbaiki Tanggal Selesai menjadi `2026-12-31`.
  6. Klik **Simpan**.
  7. Toggle status publikasi menjadi aktif (`is_published = true`).
- **Expected Result:**
  - Sistem menolak tanggal selesai yang mendahului tanggal mulai dengan pesan validasi error yang jelas.
  - Periode dengan rentang tanggal valid berhasil disimpan dan muncul pada daftar periode akademik.
- **Actual Result:** *(Diisi penguji manusia saat eksekusi)*
- **Status:** `PREPARED`
- **Evidence:** *(Tangkapan layar pesan validasi tanggal)*
- **Tester:** *(Nama Penguji Admin)*
- **Notes:** *(Catatan pengujian)*

---

### UAT-ADM-004: Dasbor Monitoring, Laporan, & Log Aktivitas Sistem
- **Test ID:** `UAT-ADM-004`
- **Module:** Dasbor & Log Aktivitas (`/admin/beranda`, `/admin/aktivitas`)
- **User Role:** Admin
- **Preconditions:** Admin telah login ke sistem.
- **Test Steps:**
  1. Buka halaman Dasbor Admin (`/admin/beranda`).
  2. Periksa kartu metrik KPI (Total Konseling, Konselor Aktif, Sesi Berjalan).
  3. Buka halaman Log Aktivitas (`/admin/aktivitas`).
  4. Terapkan filter tipe entitas (`booking`, `session`, `feedback`).
  5. Periksa apakah pembuatan akun pada `UAT-ADM-001` tercatat dalam log aktivitas.
- **Expected Result:** Data KPI menampilkan nilai agregat riil dari API; log aktivitas menampilkan kronologi kegiatan dengan filter yang responsif dan tanpa kebocoran data klinis rahasia.
- **Actual Result:** *(Diisi penguji manusia saat eksekusi)*
- **Status:** `PREPARED`
- **Evidence:** *(Tangkapan layar log aktivitas)*
- **Tester:** *(Nama Penguji Admin)*
- **Notes:** *(Catatan pengujian)*

---

### UAT-ADM-005: Pembaruan Profil Akun Admin & Persistensi
- **Test ID:** `UAT-ADM-005`
- **Module:** Pengaturan Profil (`/admin/pengaturan`)
- **User Role:** Admin
- **Preconditions:** Admin telah login.
- **Test Steps:**
  1. Buka halaman Pengaturan (`/admin/pengaturan`).
  2. Ubah kolom Nama Lengkap: `Admin Utama SiCARE`.
  3. Perbarui nomor WhatsApp: `081199990001`.
  4. Klik tombol **Simpan Profil**.
  5. Lakukan refresh peramban (*F5*).
- **Expected Result:** Data profil berhasil diperbarui, notifikasi sukses tampil, dan nilai nama/telepon tetap bertahan (*persistent*) setelah refresh.
- **Actual Result:** *(Diisi penguji manusia saat eksekusi)*
- **Status:** `PREPARED`
- **Evidence:** *(Tangkapan layar profil sebelum & sesudah refresh)*
- **Tester:** *(Nama Penguji Admin)*
- **Notes:** *(Catatan pengujian)*

---

### UAT-ADM-006: Proteksi Keamanan Admin (Self-Demotion & Clinical Doc Access)
- **Test ID:** `UAT-ADM-006`
- **Module:** Keamanan & Otorisasi Admin
- **User Role:** Admin
- **Preconditions:** Admin login sebagai admin aktif.
- **Test Steps:**
  1. Buka `/admin/akun`, cari akun diri sendiri.
  2. Coba ubah peran akun sendiri menjadi peran non-admin atau nonaktifkan akun sendiri.
  3. Coba lakukan request langsung ke endpoint unduh dokumen PDF Informed Consent (`GET /api/v1/consents/:id/document`).
- **Expected Result:**
  - Upaya mengubah peran/menonaktifkan akun admin sendiri ditolak dengan HTTP 409 (`SELF_ADMIN_CHANGE_BLOCKED`).
  - Upaya mengakses berkas PDF klinis ditolak dengan HTTP 403 Forbidden karena Admin tidak berhak membaca dokumen persetujuan klinis rahasia.
- **Actual Result:** *(Diisi penguji manusia saat eksekusi)*
- **Status:** `PREPARED`
- **Evidence:** *(Log penolakan otorisasi)*
- **Tester:** *(Nama Penguji Admin / QA)*
- **Notes:** *(Catatan pengujian)*

---

## Skenario B: Alur Pengguna Kepala LMI

### UAT-KLMI-001: Dasbor Eksekutif & Statistik Konseling
- **Test ID:** `UAT-KLMI-001`
- **Module:** Beranda Pimpinan (`/kepala-lmi/beranda`)
- **User Role:** Kepala LMI (`uat.kepala.lmi@sicare.test`)
- **Preconditions:** Kepala LMI telah login.
- **Test Steps:**
  1. Buka halaman Beranda Kepala LMI (`/kepala-lmi/beranda`).
  2. Periksa kartu ringkasan eksekutif (Total Layanan, Distribusi Sesi, Utilisasi Konselor).
  3. Klik tombol navigasi Laporan Layanan Konseling.
- **Expected Result:** Dasbor memuat data agregat statistik riil dari endpoint `/api/v1/reporting/head-lmi/dashboard`, dan tombol mengarahkan ke `/kepala-lmi/laporan` (bukan `/admin/laporan`).
- **Actual Result:** *(Diisi penguji manusia saat eksekusi)*
- **Status:** `PREPARED`
- **Evidence:** *(Tangkapan layar dasbor pimpinan)*
- **Tester:** *(Nama Penguji Kepala LMI)*
- **Notes:** *(Catatan pengujian)*

---

### UAT-KLMI-002: Laporan Layanan & Ekspor Data Agregat
- **Test ID:** `UAT-KLMI-002`
- **Module:** Laporan Eksekutif (`/kepala-lmi/laporan`)
- **User Role:** Kepala LMI
- **Preconditions:** Kepala LMI berada di halaman Laporan.
- **Test Steps:**
  1. Terapkan filter rentang tanggal (misal 3 bulan terakhir).
  2. Periksa tabel distribusi per topik dan per konselor.
  3. Klik tombol **Ekspor CSV**.
  4. Klik tombol **Cetak Laporan** (`window.print()`).
- **Expected Result:** Filter tanggal memicu pembaruan laporan agregat; berkas CSV terunduh dengan data ringkasan tanpa membocorkan identitas pribadi klien; dialog cetak PDF sistem terbuka dengan format rapi.
- **Actual Result:** *(Diisi penguji manusia saat eksekusi)*
- **Status:** `PREPARED`
- **Evidence:** *(Berkas CSV hasil ekspor & preview cetak)*
- **Tester:** *(Nama Penguji Kepala LMI)*
- **Notes:** *(Catatan pengujian)*

---

### UAT-KLMI-003: Monitoring & Peninjauan Feedback Mahasiswa
- **Test ID:** `UAT-KLMI-003`
- **Module:** Peninjauan Feedback (`/kepala-lmi/feedback`)
- **User Role:** Kepala LMI
- **Preconditions:** Terdapat feedback masuk dari sesi konseling yang telah selesai.
- **Test Steps:**
  1. Buka halaman Feedback (`/kepala-lmi/feedback`).
  2. Pilih salah satu umpan balik mahasiswa berkategori `new`.
  3. Ubah status tinjauan pimpinan menjadi **Ditinjau** (`reviewed`) atau **Selesai** (`resolved`).
  4. Periksa apakah terdapat opsi untuk mengubah status moderasi publik (`moderation_status`).
- **Expected Result:**
  - Status `review_status` berhasil diperbarui.
  - Identitas mahasiswa tetap teranonimkan (`Klien Anonim #XXXX`).
  - Kepala LMI **tidak memiliki kontrol moderasi publik** (hak moderasi hanya milik Admin).
- **Actual Result:** *(Diisi penguji manusia saat eksekusi)*
- **Status:** `PREPARED`
- **Evidence:** *(Tangkapan layar modal peninjauan feedback)*
- **Tester:** *(Nama Penguji Kepala LMI)*
- **Notes:** *(Catatan pengujian)*

---

### UAT-KLMI-004: Pembaruan Profil Kepala LMI
- **Test ID:** `UAT-KLMI-004`
- **Module:** Pengaturan Pimpinan (`/kepala-lmi/pengaturan`)
- **User Role:** Kepala LMI
- **Preconditions:** Kepala LMI telah login.
- **Test Steps:**
  1. Buka halaman Pengaturan (`/kepala-lmi/pengaturan`).
  2. Ubah Nama Lengkap dan Nomor Telepon.
  3. Klik **Simpan**.
  4. Refresh halaman.
- **Expected Result:** Data profil tersimpan dengan benar dan bertahan setelah penyegaran halaman. Fitur belum didukung (foto/password) berstatus disabled secara transparan.
- **Actual Result:** *(Diisi penguji manusia saat eksekusi)*
- **Status:** `PREPARED`
- **Evidence:** *(Tangkapan layar halaman pengaturan)*
- **Tester:** *(Nama Penguji Kepala LMI)*
- **Notes:** *(Catatan pengujian)*

---

### UAT-KLMI-005: Penegakan Privasi & Batasan Akses Pimpinan
- **Test ID:** `UAT-KLMI-005`
- **Module:** Keamanan Otorisasi Kepala LMI
- **User Role:** Kepala LMI
- **Preconditions:** Kepala LMI telah login.
- **Test Steps:**
  1. Buka URL administrasi akun (`/admin/akun`) secara manual.
  2. Buka URL unduh berkas PDF Informed Consent klien secara langsung.
- **Expected Result:**
  - Akses ke rute admin ditolak atau diarahkan kembali ke beranda pimpinan.
  - Akses ke endpoint unduh PDF klinis ditolak dengan HTTP 403 Forbidden (`FORBIDDEN_CONSENT_ACCESS`).
- **Actual Result:** *(Diisi penguji manusia saat eksekusi)*
- **Status:** `PREPARED`
- **Evidence:** *(Respon penolakan 403)*
- **Tester:** *(Nama Penguji Kepala LMI / QA)*
- **Notes:** *(Catatan pengujian)*

---

## Skenario C: Alur Pengguna Konselor (Counselor)

### UAT-KON-001: Menerima Permintaan Booking Konseling
- **Test ID:** `UAT-KON-001`
- **Module:** Permintaan Booking (`/konselor/permintaan`)
- **User Role:** Counselor (`uat.counselor@sicare.test`)
- **Preconditions:** Terdapat pesanan konseling masuk berstatus `waiting_confirmation`.
- **Test Steps:**
  1. Buka halaman Permintaan (`/konselor/permintaan`).
  2. Klik tombol **Terima Permintaan** pada salah satu pesanan.
  3. Pilih Format Sesi: **Online** atau **Offline**.
  4. Masukkan Ruang / Tautan: `Ruang Konseling LMI 1` atau link Google Meet.
  5. Klik tombol konfirmasi **Terima & Jadwalkan**.
- **Expected Result:** Status pesanan beralih menjadi `confirmed`, sesi konseling terbentuk berstatus `scheduled`, notifikasi dalam situs terkirim ke Klien, dan outbox WhatsApp pengingat dijadwalkan secara atomik.
- **Actual Result:** *(Diisi penguji manusia saat eksekusi)*
- **Status:** `PREPARED`
- **Evidence:** *(Tangkapan layar modal keputusan & status pesanan)*
- **Tester:** *(Nama Penguji Konselor)*
- **Notes:** *(Catatan pengujian)*

---

### UAT-KON-002: Menolak Permintaan Booking dengan Alasan Wajib
- **Test ID:** `UAT-KON-002`
- **Module:** Permintaan Booking (`/konselor/permintaan`)
- **User Role:** Counselor
- **Preconditions:** Terdapat pesanan masuk lain berstatus `waiting_confirmation`.
- **Test Steps:**
  1. Klik tombol **Tolak Permintaan**.
  2. Kosongkan kolom alasan penolakan dan coba klik tombol **Konfirmasi Penolakan**.
  3. Masukkan alasan penolakan yang valid: `Jadwal bentrok dengan seminar akademik fakultas.`
  4. Klik tombol **Konfirmasi Penolakan**.
- **Expected Result:**
  - Form menolak submit jika alasan kosong (wajib minimal 3 karakter).
  - Setelah diisi alasan valid, status pesanan beralih menjadi `rejected`, alasan tercatat, dan notifikasi penolakan sampai ke Klien.
- **Actual Result:** *(Diisi penguji manusia saat eksekusi)*
- **Status:** `PREPARED`
- **Evidence:** *(Tangkapan layar validasi form & status rejected)*
- **Tester:** *(Nama Penguji Konselor)*
- **Notes:** *(Catatan pengujian)*

---

### UAT-KON-003: Pengelolaan Kalender & Slot Jadwal Ketersediaan
- **Test ID:** `UAT-KON-003`
- **Module:** Jadwal Konselor (`/konselor/jadwal`)
- **User Role:** Counselor
- **Preconditions:** Konselor telah login.
- **Test Steps:**
  1. Buka halaman Jadwal (`/konselor/jadwal`).
  2. Tambahkan slot ketersediaan baru untuk hari kerja berikutnya (misal Pukul 09:00 - 10:00).
  3. Coba tambahkan slot kedua yang tumpang tindih (*overlap*) pada jam yang sama persis.
  4. Batalkan salah satu slot yang belum dibooking.
- **Expected Result:** Slot pertama berhasil dibuat; pembuatan slot tumpang tindih ditolak sistem dengan pesan konflik jadwal; pembatalan slot yang belum dibooking berhasil dieksekusi.
- **Actual Result:** *(Diisi penguji manusia saat eksekusi)*
- **Status:** `PREPARED`
- **Evidence:** *(Tangkapan layar kalender jadwal)*
- **Tester:** *(Nama Penguji Konselor)*
- **Notes:** *(Catatan pengujian)*

---

### UAT-KON-004: Penegakan Kesiapan Sesi (Consent Readiness Enforcement)
- **Test ID:** `UAT-KON-004`
- **Module:** Aktivitas Sesi Konseling (`/konselor/aktivitas`)
- **User Role:** Counselor
- **Preconditions:** Booking telah berstatus `confirmed` dan sesi berstatus `scheduled`, namun peserta **BELUM** menandatangani Informed Consent.
- **Test Steps:**
  1. Buka halaman Aktivitas Konselor (`/konselor/aktivitas`).
  2. Buka kartu sesi yang bersangkutan. Periksa indikator kesiapan persetujuan.
  3. Klik tombol **Mulai Sesi**.
  4. Amati respon sistem.
  5. Setelah peserta menandatangani consent (pada skenario Klien), refresh halaman dan klik **Mulai Sesi** kembali.
  6. Setelah sesi berjalan, klik **Selesaikan Sesi**.
- **Expected Result:**
  - Pada langkah 3, sistem **MENOLAK KERAS** transisi dengan error HTTP 409 `CONSENT_READINESS_INCOMPLETE` dan pesan peringatan bahwa informed consent belum lengkap.
  - Pada langkah 5 (setelah consent ditandatangani), sesi berhasil beralih status ke `ongoing`.
  - Pada langkah 6, sesi berhasil diselesaikan dan beralih ke `completed`.
- **Actual Result:** *(Diisi penguji manusia saat eksekusi)*
- **Status:** `PREPARED`
- **Evidence:** *(Tangkapan layar pesan blokir 409 & transisi sukses)*
- **Tester:** *(Nama Penguji Konselor)*
- **Notes:** *(Catatan pengujian)*

---

### UAT-KON-005: Pembatalan Sesi & Pembersihan Kaskade Undangan
- **Test ID:** `UAT-KON-005`
- **Module:** Aktivitas Konselor (`/konselor/aktivitas`)
- **User Role:** Counselor
- **Preconditions:** Terdapat pesanan kelompok berstatus `confirmed` dengan undangan kelompok yang masih berstatus pending.
- **Test Steps:**
  1. Klik opsi **Batalkan Sesi**.
  2. Masukkan alasan pembatalan operasional.
  3. Konfirmasi pembatalan.
- **Expected Result:** Sesi/booking beralih menjadi `cancelled`; seluruh undangan kelompok pending otomatis dicabut (`revoked`); antrean pesan pengingat WhatsApp yang belum terkirim otomatis dibatalkan (`cancelled`).
- **Actual Result:** *(Diisi penguji manusia saat eksekusi)*
- **Status:** `PREPARED`
- **Evidence:** *(Tangkapan layar pembatalan sesi)*
- **Tester:** *(Nama Penguji Konselor)*
- **Notes:** *(Catatan pengujian)*

---

### UAT-KON-006: Hak Akses Berkas PDF Klinis Konselor Binaannya
- **Test ID:** `UAT-KON-006`
- **Module:** Riwayat Konseling (`/konselor/riwayat`)
- **User Role:** Counselor
- **Preconditions:** Terdapat sesi selesai yang dibina oleh Konselor A, dan sesi lain yang dibina oleh Konselor B.
- **Test Steps:**
  1. Buka Riwayat Konseling (`/konselor/riwayat`).
  2. Klik tombol **Unduh Dokumen Informed Consent** pada sesi binaan Konselor A.
  3. Coba lakukan request unduh dokumen informed consent milik sesi binaan Konselor B (menggunakan ID consent sesi Konselor B).
- **Expected Result:**
  - Dokumen PDF pasien binaan sendiri berhasil diunduh dengan presigned URL berumur pendek.
  - Request unduh dokumen milik sesi konselor lain ditolak keras dengan HTTP 403 Forbidden.
- **Actual Result:** *(Diisi penguji manusia saat eksekusi)*
- **Status:** `PREPARED`
- **Evidence:** *(Dokumen PDF terunduh & respon 403 untuk konselor luar)*
- **Tester:** *(Nama Penguji Konselor / QA)*
- **Notes:** *(Catatan pengujian)*

---

## Skenario D: Alur Pengguna Klien (Client)

### UAT-CLI-001: Alur Pemesanan Konseling Individu
- **Test ID:** `UAT-CLI-001`
- **Module:** Pemesanan Konseling (`/klien/konselor`, `/klien/pesanan`)
- **User Role:** Client (`uat.client.a@sicare.test`)
- **Preconditions:** Klien telah login dan memilih konselor dari direktori publik/klien.
- **Test Steps:**
  1. Buka `/klien/konselor`, pilih salah satu konselor yang tersedia, klik **Pesan Konseling**.
  2. Pada `/klien/pesanan`, pilih tipe: **Individu**.
  3. Pilih tanggal pada kalender ketersediaan dan pilih salah satu slot jam yang aktif.
  4. Masukkan topik konseling: `Manajemen Stres Akademik & Skripsi`.
  5. Centang persetujuan WhatsApp (opt-in).
  6. Klik **Kirim Permintaan Konseling**.
- **Expected Result:** Pesanan tersimpan di basis data dengan status `waiting_confirmation`, notifikasi konfirmasi booking muncul di dasbor Klien, dan pesanan terlihat di daftar aktivitas Klien.
- **Actual Result:** *(Diisi penguji manusia saat eksekusi)*
- **Status:** `PREPARED`
- **Evidence:** *(Tangkapan layar kartu booking di /klien/aktivitas)*
- **Tester:** *(Nama Penguji Klien)*
- **Notes:** *(Catatan pengujian)*

---

### UAT-CLI-002: Pemesanan Konseling Kelompok dengan Peserta Berstruktur
- **Test ID:** `UAT-CLI-002`
- **Module:** Pemesanan Kelompok (`/klien/pesanan`)
- **User Role:** Client B (`uat.client.b@sicare.test`)
- **Preconditions:** Klien B login dan membuka form pemesanan konseling.
- **Test Steps:**
  1. Pilih tipe layanan: **Kelompok**.
  2. Pilih konselor, tanggal, dan slot jam.
  3. Daftarkan 3 peserta tambahan:
     - Peserta 1 (Akun): Nama: `UAT Peserta Terdaftar`, No. WA: `081200000003`.
     - Peserta 2 (Tamu A): Nama: `Peserta Tamu A`, No. WA: `081200000004`.
     - Peserta 3 (Tamu B): Nama: `Peserta Tamu B`, No. WA: `081200000005`.
  4. Coba masukkan nomor WhatsApp duplikat untuk Peserta 3 yang sama dengan Peserta 2.
  5. Amati validasi pencegahan duplikasi.
  6. Perbaiki nomor dan klik **Kirim Permintaan Konseling**.
- **Expected Result:**
  - Form memvalidasi dan menolak entri peserta dengan nomor telepon duplikat.
  - Setelah berhasil, basis data mencatat 4 baris entitas terpisah pada `booking_participants` (1 Klien Utama + 3 anggota kelompok) secara terstruktur (bukan string teks biasa).
- **Actual Result:** *(Diisi penguji manusia saat eksekusi)*
- **Status:** `PREPARED`
- **Evidence:** *(Tangkapan layar form pendaftaran kelompok & database query)*
- **Tester:** *(Nama Penguji Klien)*
- **Notes:** *(Catatan pengujian)*

---

### UAT-CLI-003: Peninjauan Riwayat & Status Pemesanan Klien
- **Test ID:** `UAT-CLI-003`
- **Module:** Riwayat & Aktivitas Klien (`/klien/riwayat`, `/klien/aktivitas`)
- **User Role:** Client
- **Preconditions:** Klien memiliki booking dalam berbagai status (`waiting_confirmation`, `confirmed`, `rejected`, `cancelled`, `completed`).
- **Test Steps:**
  1. Buka halaman Aktivitas (`/klien/aktivitas`).
  2. Periksa kartu pesanan aktif dan filter status.
  3. Buka halaman Riwayat (`/klien/riwayat`).
  4. Periksa sesi selesai dan ulasan feedback yang telah dikirimkan.
- **Expected Result:** Seluruh status ditampilkan dengan warna badge dan teks yang tepat; alasan penolakan/pembatalan terbaca transparan jika ada.
- **Actual Result:** *(Diisi penguji manusia saat eksekusi)*
- **Status:** `PREPARED`
- **Evidence:** *(Tangkapan layar halaman aktivitas & riwayat)*
- **Tester:** *(Nama Penguji Klien)*
- **Notes:** *(Catatan pengujian)*

---

### UAT-CLI-004: Penandatanganan Digital & Pengunduhan Dokumen PDF Klien
- **Test ID:** `UAT-CLI-004`
- **Module:** Digital Informed Consent (`/klien/aktivitas`)
- **User Role:** Client A
- **Preconditions:** Booking individu telah disetujui konselor (`confirmed`).
- **Test Steps:**
  1. Buka `/klien/aktivitas`, klik tombol **Isi Informed Consent** pada kartu booking.
  2. Periksa formulir identitas: verifikasi auto-fill nama lengkap dan nomor telepon.
  3. Lengkapi NIM, Fakultas, Program Studi, Tempat Lahir, Tanggal Lahir, Jenis Kelamin.
  4. Baca seluruh klausul pernyataan resmi LMI Unika De La Salle Manado.
  5. Centang kotak persetujuan: *"Saya telah membaca dan menyetujui seluruh klausul Informed Consent di atas."*
  6. Gambarkan tanda tangan pada area kanvas Signature Pad.
  7. Klik tombol **Tandatangani Dokumen**.
  8. Setelah berhasil, klik tombol **Unduh Dokumen PDF**.
- **Expected Result:**
  - Tanda tangan tersimpan aman sebagai berkas PNG valid.
  - Dokumen PDF resmi 1 halaman A4 dihasilkan via `pdf-lib` dengan koordinat teks dan tanda tangan presisi.
  - Berkas PDF berhasil diunduh dan dibuka di peramban, memuat identitas dan tanda tangan yang sesuai.
- **Actual Result:** *(Diisi penguji manusia saat eksekusi)*
- **Status:** `PREPARED`
- **Evidence:** *(Tangkapan layar modal signature pad & berkas PDF terunduh)*
- **Tester:** *(Nama Penguji Klien)*
- **Notes:** *(Catatan pengujian)*

---

### UAT-CLI-005: Isolasi Privasi Klien (Cross-Client Data Protection)
- **Test ID:** `UAT-CLI-005`
- **Module:** Privasi & Keamanan Klien
- **User Role:** Client A
- **Preconditions:** Client A dan Client B sama-sama memiliki booking dan dokumen consent.
- **Test Steps:**
  1. Login sebagai Client A.
  2. Coba akses detail booking milik Client B via API: `GET /api/v1/bookings/:clientB_BookingId`.
  3. Coba unduh dokumen consent milik Client B: `GET /api/v1/consents/:clientB_ConsentId/document`.
- **Expected Result:** Kedua request ditolak tegas dengan HTTP 403 Forbidden atau HTTP 404 Not Found (Row Level Security menyembunyikan data Client B).
- **Actual Result:** *(Diisi penguji manusia saat eksekusi)*
- **Status:** `PREPARED`
- **Evidence:** *(Respon penolakan API)*
- **Tester:** *(Nama Penguji Klien / QA)*
- **Notes:** *(Catatan pengujian)*

---

## Skenario E: Peserta Kelompok dengan Akun SiCARE

### UAT-GRP-001: Penerimaan Undangan & Autentikasi Akun
- **Test ID:** `UAT-GRP-001`
- **Module:** Undangan Persetujuan Kelompok
- **User Role:** Group Participant Terdaftar (`uat.participant.a@sicare.test`)
- **Preconditions:** Klien B telah mendaftarkan peserta ini pada konseling kelompok (`UAT-CLI-002`). Undangan telah dibuat.
- **Test Steps:**
  1. Penguji membuka tautan undangan consent yang diterima: `/consent/invite?token=...`.
  2. Sistem mendeteksi kebutuhan otentikasi jika akun belum login, atau menampilkan opsi tautkan akun.
  3. Login menggunakan akun `uat.participant.a@sicare.test`.
- **Expected Result:** Tautan undangan mengenali akun; token dibersihkan seketika dari URL peramban untuk mencegah kebocoran riwayat.
- **Actual Result:** *(Diisi penguji manusia saat eksekusi)*
- **Status:** `PREPARED`
- **Evidence:** *(Tangkapan layar peramban dengan URL bersih)*
- **Tester:** *(Nama Penguji Peserta Kelompok)*
- **Notes:** *(Catatan pengujian)*

---

### UAT-GRP-002: Verifikasi Nomor Telepon Anti-Spoofing pada Penautan Akun
- **Test ID:** `UAT-GRP-002`
- **Module:** Penautan Akun Terotentikasi (`/api/v1/consents/invitations/claim`)
- **User Role:** Group Participant Terdaftar
- **Preconditions:** Undangan dibuat khusus untuk nomor WhatsApp `+6281200000003`.
- **Test Steps:**
  1. Coba klaim undangan tersebut menggunakan akun lain yang nomor teleponnya berbeda (misal Klien A: `+6281200000001`).
  2. Amati penolakan sistem.
  3. Klaim undangan menggunakan akun `uat.participant.a@sicare.test` yang memiliki nomor telepon cocok (`+6281200000003`).
- **Expected Result:**
  - Upaya klaim dengan akun bertelepon beda ditolak dengan HTTP 403 `ACCOUNT_PHONE_MISMATCH` (mencegah pembajakan undangan kelompok).
  - Klaim dengan akun bertelepon cocok berhasil mengaitkan `user_id` ke record peserta.
- **Actual Result:** *(Diisi penguji manusia saat eksekusi)*
- **Status:** `PREPARED`
- **Evidence:** *(Log error 403 ACCOUNT_PHONE_MISMATCH & respon sukses)*
- **Tester:** *(Nama Penguji Peserta Kelompok / QA)*
- **Notes:** *(Catatan pengujian)*

---

### UAT-GRP-003: Auto-Fill Data Profil & Penandatanganan Mandiri
- **Test ID:** `UAT-GRP-003`
- **Module:** Formulir Informed Consent Anggota Kelompok
- **User Role:** Group Participant Terdaftar
- **Preconditions:** Akun peserta berhasil ditautkan ke undangan.
- **Test Steps:**
  1. Periksa kolom Nama, NIM, Fakultas, dan No Telepon pada form persetujuan.
  2. Verifikasi data terisi otomatis dari profil terverifikasi.
  3. Gambarkan tanda tangan elektronik pada canvas.
  4. Setujui klausul dan klik **Tandatangani Persetujuan**.
- **Expected Result:** Data profil ter-autofill dengan benar; tanda tangan diproses aman; record consent beralih status ke `signed`.
- **Actual Result:** *(Diisi penguji manusia saat eksekusi)*
- **Status:** `PREPARED`
- **Evidence:** *(Tangkapan layar formulir terisi & status signed)*
- **Tester:** *(Nama Penguji Peserta Kelompok)*
- **Notes:** *(Catatan pengujian)*

---

### UAT-GRP-004: Akses PDF Mandiri & Pembaruan Kesiapan Kelompok
- **Test ID:** `UAT-GRP-004`
- **Module:** Dokumen Persetujuan Kelompok
- **User Role:** Group Participant Terdaftar
- **Preconditions:** Peserta kelompok telah menyelesaikan tanda tangan digital.
- **Test Steps:**
  1. Klik tombol **Unduh Dokumen PDF Saya**.
  2. Periksa dokumen PDF yang diunduh.
  3. Coba akses berkas PDF milik anggota kelompok lain atau Klien Utama.
- **Expected Result:**
  - Peserta hanya dapat mengunduh dokumen PDF miliknya sendiri.
  - Akses ke dokumen PDF anggota kelompok lain ditolak (HTTP 403).
  - Penghitung kesiapan consent kelompok bertambah secara otomatis.
- **Actual Result:** *(Diisi penguji manusia saat eksekusi)*
- **Status:** `PREPARED`
- **Evidence:** *(Berkas PDF terunduh & pesan isolasi)*
- **Tester:** *(Nama Penguji Peserta Kelompok)*
- **Notes:** *(Catatan pengujian)*

---

## Skenario F: Peserta Kelompok Tanpa Akun (Tamu / Guest)

### UAT-GST-001: Akses Portal Tamu & Pembersihan URL Seketika
- **Test ID:** `UAT-GST-001`
- **Module:** Portal Tamu (`/consent/invite`)
- **User Role:** Group Guest A (`+6281200000004`)
- **Preconditions:** Klien mendaftarkan peserta tamu tanpa akun SiCARE. Token kapabilitas telah digenerate.
- **Test Steps:**
  1. Buka peramban (mode Incognito/Privat tanpa sesi login SiCARE).
  2. Buka URL undangan: `http://localhost:5173/consent/invite?token=<HMAC_CAPABILITY_TOKEN>`.
  3. Amati perubahan URL pada bilah alamat peramban secara seketika.
- **Expected Result:** Halaman portal tamu (`GuestConsentPage`) terbuka dengan lancar; token pada parameter URL peramban seketika dihapus via `window.history.replaceState` (URL menjadi bersih tanpa query token terekspos di browser history).
- **Actual Result:** *(Diisi penguji manusia saat eksekusi)*
- **Status:** `PREPARED`
- **Evidence:** *(Tangkapan layar bilah URL peramban yang telah dibersihkan)*
- **Tester:** *(Nama Penguji Tamu)*
- **Notes:** *(Catatan pengujian)*

---

### UAT-GST-002: Validasi 7 Field Identitas Wajib Peserta Tamu
- **Test ID:** `UAT-GST-002`
- **Module:** Formulir Identitas Tamu (`/consent/invite`)
- **User Role:** Group Guest A
- **Preconditions:** Tamu berada di formulir identitas Informed Consent.
- **Test Steps:**
  1. Coba klik tombol lanjutkan dengan mengosongkan beberapa field wajib.
  2. Uji satu per satu 7 field wajib identitas klinis:
     - Nama Lengkap
     - Fakultas / Program Studi
     - NIM
     - Tempat Lahir
     - Tanggal Lahir
     - Jenis Kelamin
     - Nomor Telepon WhatsApp
  3. Masukkan data valid untuk seluruh 7 field.
- **Expected Result:** Sistem menampilkan validasi error merah pada field yang kosong atau format tidak sesuai; form hanya dapat dilanjutkan setelah seluruh 7 field terisi lengkap dan valid.
- **Actual Result:** *(Diisi penguji manusia saat eksekusi)*
- **Status:** `PREPARED`
- **Evidence:** *(Tangkapan layar validasi form kosong & form valid)*
- **Tester:** *(Nama Penguji Tamu)*
- **Notes:** *(Catatan pengujian)*

---

### UAT-GST-003: Penandatanganan Kanvas & Pembuatan PDF Tamu
- **Test ID:** `UAT-GST-003`
- **Module:** Penandatanganan Tamu (`/consent/invite`)
- **User Role:** Group Guest A
- **Preconditions:** 7 field identitas terisi lengkap.
- **Test Steps:**
  1. Tinjau teks resmi Informed Consent LMI Unika De La Salle Manado.
  2. Centang persetujuan eksplisit klausul kerahasiaan.
  3. Bubuhkan tanda tangan pada kanvas digital interaktif.
  4. Klik tombol **Simpan & Tandatangani**.
  5. Klik tombol **Unduh Dokumen PDF**.
- **Expected Result:** Tanda tangan tervalidasi sebagai biner PNG asli; berkas PDF resmi dihasilkan via `pdf-lib` dan dapat diunduh langsung oleh tamu.
- **Actual Result:** *(Diisi penguji manusia saat eksekusi)*
- **Status:** `PREPARED`
- **Evidence:** *(Tangkapan layar sukses & PDF tamu terunduh)*
- **Tester:** *(Nama Penguji Tamu)*
- **Notes:** *(Catatan pengujian)*

---

### UAT-GST-004: Pemulihan Sesi Tamu (Refresh & Reopen Link Recovery)
- **Test ID:** `UAT-GST-004`
- **Module:** Mekanisme Pemulihan Sesi Tamu
- **User Role:** Group Guest A
- **Preconditions:** Tamu telah mengklaim undangan dan mengisi sebagian identitas (atau telah berstatus signed).
- **Test Steps:**
  1. **Skenario Refresh (Skenario A):** Pada saat mengisi formulir, lakukan refresh halaman peramban (*F5*).
  2. Amati apakah formulir dapat melanjutkan sesi atau terjadi error sesi hilang.
  3. **Skenario Reopen (Skenario B):** Tutup peramban sepenuhnya setelah dokumen ditandatangani (`signed`).
  4. Buka kembali tautan undangan awal dari WhatsApp.
- **Expected Result:**
  - Skenario A: Sesi tamu berlanjut aman tanpa logout karena dilindungi cookie aman `httpOnly` `sicare_guest_token`.
  - Skenario B: Sistem mendeteksi bahwa consent telah ditandatangani (`signed`), dan mengembalikan token kapabilitas baca-saja (*read-only*) sehingga tamu dapat langsung mengunduh PDF resminya kembali tanpa mengisi ulang.
- **Actual Result:** *(Diisi penguji manusia saat eksekusi)*
- **Status:** `PREPARED`
- **Evidence:** *(Tangkapan layar halaman pemulihan read-only PDF)*
- **Tester:** *(Nama Penguji Tamu / QA)*
- **Notes:** *(Catatan pengujian)*

---

### UAT-GST-005: Penolakan Token Kedaluwarsa, Dicabut, & Isolasi Antar Tamu
- **Test ID:** `UAT-GST-005`
- **Module:** Keamanan Portal Tamu
- **User Role:** Group Guest B (`+6281200000005`)
- **Preconditions:** Terdapat undangan yang masa berlakunya telah habis (*expired*) atau dicabut (*revoked*).
- **Test Steps:**
  1. Buka URL undangan dengan token kedaluwarsa atau dicabut.
  2. Amati pesan penolakan yang ditampilkan peramban.
  3. Coba gunakan token Tamu B untuk memanggil endpoint identitas Tamu A (`/api/v1/consents/guest/me/identity`).
- **Expected Result:**
  - Undangan expired/revoked ditolak dengan status HTTP 410 Gone atau HTTP 403 Forbidden dengan pesan informatif untuk meminta undangan baru ke Klien Utama.
  - Token Tamu B tidak dapat memodifikasi atau membaca data Tamu A (isolasi token HMAC berbasis `participantId` dan `consentId`).
- **Actual Result:** *(Diisi penguji manusia saat eksekusi)*
- **Status:** `PREPARED`
- **Evidence:** *(Tangkapan layar penolakan token expired/revoked)*
- **Tester:** *(Nama Penguji Tamu / QA)*
- **Notes:** *(Catatan pengujian)*

---

## Skenario G: Matriks Persetujuan Kelompok & Integritas Sesi

### UAT-GCS-001: Skenario Kelompok 4 Peserta - Status Lengkap (4 Signed -> Ready)
- **Test ID:** `UAT-GCS-001`
- **Module:** Evaluasi Kesiapan Konseling Kelompok
- **User Role:** Counselor & Primary Client
- **Preconditions:** Konseling kelompok dengan 4 peserta sintetis:
  1. Klien Utama (Signed)
  2. Peserta Terdaftar Berakun (Signed)
  3. Peserta Tamu A (Signed)
  4. Peserta Tamu B (Signed)
- **Test Steps:**
  1. Klien Utama membuka modal Status Persetujuan Kelompok di `/klien/aktivitas`.
  2. Konselor membuka kartu sesi di `/konselor/aktivitas`.
  3. Periksa status kesiapan persetujuan.
  4. Konselor mengklik tombol **Mulai Sesi**.
- **Expected Result:**
  - Indikator kesiapan menampilkan status **Siap Dimulai (4/4 Lengkap)**.
  - Transisi sesi `scheduled -> ongoing` berhasil tanpa error.
- **Actual Result:** *(Diisi penguji manusia saat eksekusi)*
- **Status:** `PREPARED`
- **Evidence:** *(Tangkapan layar indikator 4/4 lengkap & sesi berjalan)*
- **Tester:** *(Nama Penguji Konselor / Klien)*
- **Notes:** *(Catatan pengujian)*

---

### UAT-GCS-002: Skenario Kelompok - Status Belum Lengkap (3 Signed, 1 Pending -> Blocked)
- **Test ID:** `UAT-GCS-002`
- **Module:** Penegakan Kesiapan Sesi Database
- **User Role:** Counselor
- **Preconditions:** Kelompok 4 peserta di mana Tamu B **BELUM** menandatangani consent (`status = pending`).
- **Test Steps:**
  1. Konselor membuka sesi kelompok tersebut di `/konselor/aktivitas`.
  2. Periksa indikator kesiapan persetujuan (menampilkan 3/4 Ditandatangani, 1 Menunggu).
  3. Konselor mencoba mengklik tombol **Mulai Sesi**.
- **Expected Result:** Transisi sesi **DITOLAK** oleh stored procedure database `sicare_transition_session` dengan status HTTP 409 `CONSENT_READINESS_INCOMPLETE`. Sesi tetap berstatus `scheduled` dan tidak dapat dimulai.
- **Actual Result:** *(Diisi penguji manusia saat eksekusi)*
- **Status:** `PREPARED`
- **Evidence:** *(Tangkapan layar modal peringatan 409)*
- **Tester:** *(Nama Penguji Konselor)*
- **Notes:** *(Catatan pengujian)*

---

### UAT-GCS-003: Skenario Kelompok - Undangan Kedaluwarsa/Dicabut (Blocked)
- **Test ID:** `UAT-GCS-003`
- **Module:** Kesiapan Sesi dengan Undangan Expired/Revoked
- **User Role:** Counselor & Primary Client
- **Preconditions:** Kelompok 4 peserta di mana salah satu undangan peserta berstatus `expired` atau `revoked`.
- **Test Steps:**
  1. Klien Utama memeriksa daftar peserta di modal status persetujuan kelompok.
  2. Konselor mencoba memulai sesi.
- **Expected Result:**
  - Klien Utama melihat status peserta yang bermasalah dan memiliki opsi untuk mengklik **Kirim Ulang Undangan**.
  - Konselor tetap diblokir dari memulai sesi sampai peserta tersebut menerima undangan baru dan menandatangani persetujuan.
- **Actual Result:** *(Diisi penguji manusia saat eksekusi)*
- **Status:** `PREPARED`
- **Evidence:** *(Tangkapan layar tombol kirim ulang undangan & pesan blokir)*
- **Tester:** *(Nama Penguji Klien / Konselor)*
- **Notes:** *(Catatan pengujian)*

---

### UAT-GCS-004: Imutabilitas Bukti Hukum & Perlindungan Snapshot Identitas
- **Test ID:** `UAT-GCS-004`
- **Module:** Integritas Dokumen Bertandatangan
- **User Role:** Client & QA
- **Preconditions:** Client A telah menandatangani Informed Consent pada sesi sebelumnya.
- **Test Steps:**
  1. Client A membuka halaman Pengaturan Akun (`/klien/pengaturan`).
  2. Ubah Nama Lengkap dan Nomor Telepon di profil akun.
  3. Unduh kembali dokumen PDF Informed Consent dari sesi masa lalu di `/klien/riwayat`.
  4. Periksa identitas yang tertera pada dokumen PDF yang diunduh.
- **Expected Result:** Nilai identitas pada dokumen PDF dan record `informed_consents` tetap mempertahankan data saat penandatanganan dilakukan (`signer_name_snapshot` dan `identity_snapshot` bersifat imutabel dan tidak terpengaruh oleh pembaruan profil masa kini).
- **Actual Result:** *(Diisi penguji manusia saat eksekusi)*
- **Status:** `PREPARED`
- **Evidence:** *(Perbandingan profil aktif vs identitas pada PDF lama)*
- **Tester:** *(Nama Penguji Klien / QA)*
- **Notes:** *(Catatan pengujian)*

---

## Skenario H: Notifikasi Dalam Situs (Website In-App Notifications)

### UAT-NOT-001: Pembangkitan Notifikasi pada Peristiwa Siklus Booking
- **Test ID:** `UAT-NOT-001`
- **Module:** Notifikasi Sistem
- **User Role:** Client & Counselor
- **Preconditions:** Pengguna membuka aplikasi dengan ikon lonceng notifikasi (`NotificationBell`).
- **Test Steps:**
  1. Client membuat booking baru -> Periksa notifikasi Konselor.
  2. Konselor menerima booking -> Periksa notifikasi Klien.
  3. Konselor menolak booking -> Periksa notifikasi Klien.
  4. Booking dibatalkan -> Periksa notifikasi kedua belah pihak.
- **Expected Result:** Setiap perubahan siklus hidup booking menghasilkan record notifikasi yang relevan pada tabel `notifications` secara otomatis.
- **Actual Result:** *(Diisi penguji manusia saat eksekusi)*
- **Status:** `PREPARED`
- **Evidence:** *(Tangkapan layar dropdown lonceng notifikasi)*
- **Tester:** *(Nama Penguji Klien / Konselor)*
- **Notes:** *(Catatan pengujian)*

---

### UAT-NOT-002: Isolasi Penerima & Indikator Belum Dibaca (Unread Counter)
- **Test ID:** `UAT-NOT-002`
- **Module:** Antarmuka Notifikasi (`NotificationBell.tsx`)
- **User Role:** Client
- **Preconditions:** Klien menerima 2 notifikasi baru yang belum dibaca.
- **Test Steps:**
  1. Periksa angka lencana merah (*unread badge counter*) pada ikon lonceng notifikasi (harus bernilai 2).
  2. Buka dropdown notifikasi.
  3. Klik salah satu notifikasi untuk menandai telah dibaca (*mark as read*).
  4. Amati penurunan angka lencana menjadi 1.
  5. Login sebagai Klien lain dan periksa apakah notifikasi tersebut bocor ke akun lain.
- **Expected Result:** Lencana notifikasi mencerminkan jumlah pesan belum dibaca secara akurat; mutasi baca berhasil memperbarui status; notifikasi terisolasi 100% pada akun penerima (`recipient_user_id = auth.uid()`).
- **Actual Result:** *(Diisi penguji manusia saat eksekusi)*
- **Status:** `PREPARED`
- **Evidence:** *(Tangkapan layar lencana notifikasi sebelum & sesudah dibaca)*
- **Tester:** *(Nama Penguji Klien)*
- **Notes:** *(Catatan pengujian)*

---

### UAT-NOT-003: Navigasi Cepat dari Notifikasi ke Halaman Aktivitas
- **Test ID:** `UAT-NOT-003`
- **Module:** Tautan Navigasi Notifikasi
- **User Role:** Client & Counselor
- **Preconditions:** Terdapat notifikasi booking baru.
- **Test Steps:**
  1. Klik salah satu item notifikasi di dropdown lonceng.
- **Expected Result:** Sistem mengarahkan pengguna langsung ke halaman aktivitas atau pesanan terkait (`/klien/aktivitas` atau `/konselor/permintaan`).
- **Actual Result:** *(Diisi penguji manusia saat eksekusi)*
- **Status:** `PREPARED`
- **Evidence:** *(Tangkapan layar halaman hasil navigasi)*
- **Tester:** *(Nama Penguji Klien / Konselor)*
- **Notes:** *(Catatan pengujian)*

---

## Skenario I: Pipeline WhatsApp Fonnte

### UAT-FON-001: Pengujian Antrean Outbox, Idempotensi, & Pengingat Sesi (Mock Mode)
- **Test ID:** `UAT-FON-001`
- **Module:** WhatsApp Outbox & Worker Pipeline
- **User Role:** QA / System Tester
- **Preconditions:** Server backend berjalan dengan konfigurasi mock outbox (`WHATSAPP_SEND_ENABLED=false`, `WHATSAPP_TEST_MODE=true`).
- **Test Steps:**
  1. Buat booking baru terkonfirmasi.
  2. Periksa baris baru pada tabel `whatsapp_outbox` via endpoint kesehatan admin `/api/v1/admin/whatsapp/health`.
  3. Verifikasi pembuatan kunci idempotensi deterministik (`booking:<id>:booking_accepted:<recipient>:<starts_at>`).
  4. Jalankan worker: `npm --prefix be run whatsapp:worker`.
  5. Periksa transisi status outbox menjadi `accepted`.
  6. Jalankan scheduler pengingat: `npm --prefix be run whatsapp:scheduler`.
  7. Verifikasi penjadwalan pesan pengingat sesi (H-1 dan Hari H) untuk sesi terkonfirmasi.
- **Expected Result:** Seluruh pesan tersimpan dengan aman pada transactional outbox; kunci idempotensi mencegah duplikasi; scheduler menjadwalkan pengingat secara tepat; worker memproses antrean tanpa membocorkan token atau data klinis rahasia.
- **Actual Result:** *(Diisi penguji sistem saat eksekusi)*
- **Status:** `PREPARED`
- **Evidence:** *(Log JSON kesehatan outbox admin)*
- **Tester:** *(Nama Penguji QA)*
- **Notes:** *(Catatan pengujian)*

---

### UAT-FON-002: Verifikasi Pembatasan Pengiriman Pesan WhatsApp Langsung (Live Safety Gate)
- **Test ID:** `UAT-FON-002`
- **Module:** Keselamatan Pengiriman WhatsApp Langsung
- **User Role:** QA / Admin
- **Preconditions:** Konfigurasi standar proyek.
- **Test Steps:**
  1. Periksa variabel `WHATSAPP_SEND_ENABLED` pada environment server.
  2. Coba jalankan worker dengan nomor telepon pihak ketiga di luar daftar whitelist `WHATSAPP_TEST_RECIPIENTS`.
- **Expected Result:** Pengiriman langsung ke pihak ketiga eksternal diblokir secara mutlak; worker mencatat status simulasi (*dry-run*) tanpa mengirimkan sinyal HTTP nyata ke gateway provider Fonnte. Status pengujian langsung berstatus **BLOCKED** sampai ada otorisasi resmi pemangku kepentingan.
- **Actual Result:** Sesuai kebijakan keselamatan proyek, pengiriman nyata ke nomor publik diblokir (*BLOCKED*).
- **Status:** `BLOCKED`
- **Evidence:** *(Log worker: `[Fonnte Mock] Live sending disabled. Message logged safely.`)*
- **Tester:** *(Nama Penguji QA)*
- **Notes:** *(Fitur siap secara kode, pengiriman live ditangguhkan menunggu nomor uji resmi dari pengguna)*

---

## Skenario J: Privasi Data, Isolasi Akses, & Keamanan (Security)

### UAT-SEC-001: Isolasi Akses Lintas-Klien (Cross-Client Security Boundary)
- **Test ID:** `UAT-SEC-001`
- **Module:** Otorisasi Lintas-Klien
- **User Role:** Client A & Client B
- **Preconditions:** Klien A dan Klien B telah login di browser berbeda.
- **Test Steps:**
  1. Klien A mencoba memanggil endpoint detail booking Klien B.
  2. Klien A mencoba membaca notifikasi Klien B.
  3. Klien A mencoba mengubah profil Klien B.
- **Expected Result:** Seluruh percobaan ditolak oleh backend (HTTP 403 / HTTP 404). Data Klien B tidak pernah terekspos ke Klien A.
- **Actual Result:** *(Diisi penguji manusia saat eksekusi)*
- **Status:** `PREPARED`
- **Evidence:** *(Log penolakan otorisasi)*
- **Tester:** *(Nama Penguji QA)*
- **Notes:** *(Catatan pengujian)*

---

### UAT-SEC-002: Isolasi Akses Lintas-Konselor (Cross-Counselor Boundary)
- **Test ID:** `UAT-SEC-002`
- **Module:** Otorisasi Konselor
- **User Role:** Counselor A & Counselor B
- **Preconditions:** Dua konselor terdaftar di sistem.
- **Test Steps:**
  1. Konselor B mencoba mengambil keputusan atas booking yang ditugaskan kepada Konselor A.
  2. Konselor B mencoba mengubah ketersediaan jadwal Konselor A.
- **Expected Result:** Percobaan transisi booking ditolak dengan HTTP 403 `FORBIDDEN_COUNSELOR_ACCESS`; percobaan modifikasi jadwal ditolak dengan HTTP 403.
- **Actual Result:** *(Diisi penguji manusia saat eksekusi)*
- **Status:** `PREPARED`
- **Evidence:** *(Log penolakan otorisasi)*
- **Tester:** *(Nama Penguji QA)*
- **Notes:** *(Catatan pengujian)*

---

### UAT-SEC-003: Restriksi Akses Dokumen Klinis Kepala LMI & Konselor Luar
- **Test ID:** `UAT-SEC-003`
- **Module:** Akses Dokumen Klinis Informed Consent
- **User Role:** Kepala LMI & Konselor Luar
- **Preconditions:** Terdapat dokumen PDF Informed Consent yang telah ditandatangani oleh klien binaan Konselor A.
- **Test Steps:**
  1. Kepala LMI mencoba mengunduh dokumen PDF tersebut via endpoint `/api/v1/consents/:id/document`.
  2. Konselor B (tidak ditugaskan) mencoba mengunduh dokumen PDF tersebut.
- **Expected Result:** Kedua upaya pengunduhan ditolak keras dengan status HTTP 403 Forbidden. Hanya penandatangan langsung dan Konselor yang ditugaskan yang berhak mengunduh berkas PDF klinis.
- **Actual Result:** *(Diisi penguji manusia saat eksekusi)*
- **Status:** `PREPARED`
- **Evidence:** *(Respon HTTP 403 FORBIDDEN_CONSENT_ACCESS)*
- **Tester:** *(Nama Penguji QA)*
- **Notes:** *(Catatan pengujian)*

---

### UAT-SEC-004: Perlindungan Storage Bucket Privat Supabase
- **Test ID:** `UAT-SEC-004`
- **Module:** Supabase Storage Object RBAC
- **User Role:** Pengguna Publik / Tamu Tanpa Autentikasi
- **Preconditions:** Berkas PDF tersimpan di bucket `informed-consent-signed` dan tanda tangan di `informed-consent-signatures`.
- **Test Steps:**
  1. Lakukan request HTTP langsung ke URL publik Supabase Storage: `https://<REF>.supabase.co/storage/v1/object/public/informed-consent-signed/<path>.pdf`.
  2. Coba listing isi bucket storage tanpa token admin.
- **Expected Result:** Storage menolak akses dengan HTTP 400/404 (`Bucket is private`). Berkas hanya dapat diakses melalui URL presigned berumur pendek yang dihasilkan melalui endpoint backend terotorisasi.
- **Actual Result:** *(Diisi penguji manusia saat eksekusi)*
- **Status:** `PREPARED`
- **Evidence:** *(Respon penolakan akses storage publik)*
- **Tester:** *(Nama Penguji QA)*
- **Notes:** *(Catatan pengujian)*

---

### UAT-SEC-005: Penolakan Eskalasi Peran (Privilege Escalation Prevention)
- **Test ID:** `UAT-SEC-005`
- **Module:** Integritas Profil & Hak Akses
- **User Role:** Client & Counselor
- **Preconditions:** Pengguna login sebagai Client atau Counselor.
- **Test Steps:**
  1. Kirim payload mutasi profil `PATCH /api/v1/profile` dengan menyisipkan parameter `app_role: "admin"`.
  2. Coba panggil rute administrasi `/api/v1/admin/*`.
- **Expected Result:** Backend mengabaikan modifikasi `app_role` atau menolak request; peran pengguna tetap `client` atau `counselor`; akses ke rute admin tetap ditolak dengan HTTP 403 Forbidden.
- **Actual Result:** *(Diisi penguji manusia saat eksekusi)*
- **Status:** `PREPARED`
- **Evidence:** *(Log respon verifikasi profil)*
- **Tester:** *(Nama Penguji QA)*
- **Notes:** *(Catatan pengujian)*
