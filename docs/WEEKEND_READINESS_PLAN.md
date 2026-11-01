# SiCARE Weekend Readiness Plan

**Tanggal penyusunan:** Jumat, 30 Oktober 2026
**Batas kesiapan:** Minggu malam, 1 November 2026
**Tujuan:** Menyediakan build SiCARE yang stabil dan dapat diuji bersama tim pada lingkungan testing/staging.

> Rencana ini memprioritaskan kesiapan pengujian tim, bukan menyatakan seluruh sistem siap produksi. Roadmap 9 minggu tetap menjadi rencana pengembangan lanjutan setelah sesi testing.

## 1. Definisi "siap diuji" pada Minggu malam

SiCARE dinyatakan siap untuk sesi team testing jika:
1. Frontend dan backend dapat dijalankan atau diakses melalui URL testing yang disepakati.
2. Empat role dapat login dengan akun uji yang benar dan diarahkan ke area yang sesuai.
3. Halaman publik utama dapat dibuka dan membaca data publik dari backend.
4. Alur inti yang dipilih untuk diuji tidak mengalami blocker: login, melihat konselor/jadwal, membuat atau melihat booking, dan melihat perubahan status jika UI terkait sudah terhubung.
5. Fitur yang masih mock atau belum terintegrasi diberi label sebagai belum siap, bukan dipresentasikan sebagai fitur live.
6. Build, lint, backend tests, dan smoke test API terakhir memiliki hasil yang tercatat.
7. Tim memiliki akun uji, skenario, data uji, dan cara melaporkan bug.

**Batasan:** Kesiapan untuk team testing bukan persetujuan deployment produksi. Gunakan environment dan data uji. Jangan memakai data konseling nyata.

## 2. Prioritas berdasarkan waktu

### P0 — Wajib untuk sesi Minggu malam
- Aplikasi dapat dijalankan dan diakses.
- Login, logout, session persistence, dan role guard untuk client, counselor, admin, dan head_lmi.
- Halaman publik: direktori konselor, periode akademik, ketersediaan, motivasi Hero, dan feedback publik.
- Alur klien yang sudah terintegrasi: profil, booking, aktivitas/riwayat, feedback, dan notifikasi sesuai dukungan API yang tersedia.
- Verifikasi API live dan tidak ada error 401/403/500 yang tidak diharapkan.
- Tidak ada bug blocker: aplikasi crash, login gagal, data pengguna tertukar, akses lintas-role, atau data hilang.
- Checklist testing tim dan pencatatan bug.

### P1 — Dikerjakan jika P0 stabil
- Hubungkan bagian minimum halaman Konselor yang diperlukan untuk melihat dan memproses permintaan booking.
- Pastikan perubahan keputusan booking terlihat kembali pada akun klien.
- Hubungkan bagian minimum halaman Admin yang dibutuhkan untuk memeriksa akun/periode atau moderasi, jika endpoint dan UI sudah siap.
- Verifikasi tampilan dashboard Kepala LMI menggunakan data API yang tersedia.

### P2 — Tunda setelah team testing
- Integrasi penuh seluruh CRUD Admin dan Konselor.
- Seluruh dashboard, laporan, statistik, dan audit activity jika belum terhubung.
- Intake, informed consent, tanda tangan, catatan konseling, mood tracker, retensi data, dan fitur sensitif lain yang belum memiliki SOP dan kontrak data final.
- Optimasi bundle besar, refactor non-blocking, perubahan desain, dan pekerjaan kosmetik.
- Deployment produksi.

## 3. Jadwal kerja darurat

### Jumat, 30 Oktober 2026 — Audit blocker dan pembekuan scope

**Sesi 1: validasi baseline**
1. Jalankan seluruh `npm test` backend, termasuk tes ownership terbaru.
2. Jalankan `npm run check` backend.
3. Jalankan `npm run build` dan `npm run lint` frontend.
4. Jalankan live API verification.
5. Catat semua hasil sebagai PASS, FAIL, BLOCKED, atau NOT RUN.

**Sesi 2: smoke test browser**
1. Jalankan frontend dan backend.
2. Login memakai akun uji empat role.
3. Periksa redirect dan route guard.
4. Buka halaman publik dan halaman inti klien.
5. Catat halaman yang live API, partial, atau masih mock.

**Sesi 3: tetapkan ruang lingkup**
1. Pilih skenario yang benar-benar akan diuji tim pada Minggu malam.
2. Jangan menambah fitur baru yang tidak mendukung skenario prioritas.
3. Buat daftar blocker dengan kategori P0, P1, P2.
4. Siapkan akun dan data uji terpisah.

**Deliverable Jumat:** daftar blocker, daftar fitur live/partial/mock, dan test scenario final.

### Sabtu, 31 Oktober 2026 — Perbaikan blocker dan persiapan environment

**Pagi**
1. Perbaiki hanya bug P0 yang menghalangi aplikasi berjalan atau alur utama.
2. Selesaikan full backend test suite dan regression frontend setelah setiap patch.
3. Periksa konfigurasi environment tanpa membagikan secret.
4. Pastikan frontend menggunakan base URL API yang benar untuk environment testing.

**Siang**
1. Jalankan skenario klien dari login sampai membuat/melihat booking menggunakan data uji.
2. Jika halaman konselor yang diperlukan masih mock, integrasikan hanya bagian minimum untuk melihat dan memproses booking; jangan mencoba menyelesaikan seluruh dashboard.
3. Uji apakah perubahan status terlihat pada akun klien.
4. Periksa role guard dan ownership untuk operasi yang disentuh.

**Sore/malam**
1. Siapkan deployment staging atau cara akses testing yang disepakati.
2. Jalankan production build.
3. Jalankan smoke test dari URL/environment yang akan dipakai tim.
4. Bekukan scope. Perubahan setelah ini hanya untuk blocker.

**Deliverable Sabtu:** build kandidat untuk team testing, akun uji, data uji, dan daftar fitur yang belum siap.

### Minggu, 1 November 2026 — Regression, freeze, dan team testing

**Pagi**
1. Jalankan ulang backend tests, frontend build, lint, dan live API smoke test.
2. Uji login keempat role.
3. Uji alur inti sekali lagi dari awal.
4. Pastikan tidak ada secret di repository atau bundle frontend.
5. Pastikan data uji tidak bercampur dengan data produksi.

**Siang**
1. Code freeze.
2. Siapkan panduan singkat untuk anggota tim.
3. Siapkan lembar pencatatan bug.
4. Tentukan siapa yang menguji setiap role.
5. Catat known issues dan fitur yang belum terintegrasi.

**Minggu malam — Sesi testing tim**
1. Client: login, profil, direktori konselor, ketersediaan, booking, aktivitas/riwayat, feedback, notifikasi.
2. Counselor: login, profil, jadwal, permintaan booking, keputusan booking, sesi, feedback sesuai fitur yang benar-benar live.
3. Admin: login, akun, periode, moderasi feedback, dashboard sesuai fitur yang benar-benar live.
4. Head LMI: login, dashboard, laporan, review feedback sesuai fitur yang benar-benar live.
5. Uji akses terlarang: role tidak boleh membuka fitur role lain.
6. Catat hasil PASS/FAIL, screenshot jika perlu, langkah reproduksi, role, waktu, dan severity.

**Deliverable Minggu malam:** hasil team testing, daftar bug terurut, dan keputusan pekerjaan setelah testing.

## 4. Pembagian severity bug

| Severity | Definisi | Tindakan |
|---|---|---|
| Blocker | Aplikasi tidak dapat dibuka/login; data tertukar; akses data sensitif lintas pengguna; alur utama tidak dapat digunakan | Perbaiki sebelum team testing |
| Critical | Operasi inti gagal atau data tersimpan salah | Perbaiki sebelum team testing jika termasuk scope |
| Major | Fitur penting tidak berfungsi tetapi ada workaround | Catat dan prioritaskan |
| Minor | Tampilan, teks, alignment, atau masalah kosmetik | Tunda setelah testing |

## 5. Skenario team testing minimum

| ID | Role | Skenario | Expected result |
|---|---|---|---|
| T01 | Semua role | Login dengan akun masing-masing | Berhasil dan diarahkan ke area role yang benar |
| T02 | Semua role | Membuka route role lain | Ditolak atau diarahkan sesuai kebijakan |
| T03 | Publik | Membuka direktori konselor dan jadwal | Data tampil dari API |
| T04 | Client | Membuat/melihat booking | Data dan status sesuai backend |
| T05 | Counselor | Melihat dan memproses booking | Hanya booking yang berhak diakses |
| T06 | Client | Memeriksa perubahan booking | Status terbaru terlihat |
| T07 | Client | Membuka riwayat dan feedback | Hanya data milik sendiri |
| T08 | Admin | Mengakses fitur administrasi yang sudah live | Operasi sesuai role |
| T09 | Head LMI | Mengakses dashboard/review yang sudah live | Data sesuai hak akses |
| T10 | Semua role | Logout dan mencoba kembali ke route terlindungi | Sesi ditutup dan akses ditolak |

Jangan menandai skenario sebagai lulus jika halaman hanya menampilkan data mock. Catat sebagai `MOCK/NOT INTEGRATED`.

## 6. Aturan selama sprint darurat

- Jangan melakukan refactor besar atau perubahan desain yang tidak diperlukan.
- Jangan menambah migrasi atau mengubah database remote tanpa persetujuan eksplisit.
- Jangan memakai akun atau data konseling nyata untuk testing.
- Jangan membagikan `.env`, password, access token, atau service-role key.
- Jangan mengklaim fitur sudah live jika masih memakai mock/local state.
- Setelah setiap patch, jalankan tes yang relevan dan catat hasilnya.
- Jika waktu tidak cukup, kurangi scope P1/P2, bukan mengurangi pemeriksaan keamanan atau menyembunyikan bug.
- Simpan roadmap 9 minggu sebagai rencana lanjutan; jangan menganggap seluruh roadmap selesai pada Minggu malam.

## 7. Keputusan yang perlu dikonfirmasi

1. Apakah tim akan mengakses aplikasi melalui URL staging/hosting atau melalui jaringan lokal (LAN)?
2. Apakah target Minggu malam adalah pengujian internal/staging, bukan deployment produksi?
3. Siapa anggota tim yang memegang akun uji untuk masing-masing role?

## 8. Kriteria keberhasilan Minggu malam

Sesi dianggap berhasil jika:
- Semua anggota tim dapat mengakses environment testing.
- Keempat akun role dapat login dan role guard bekerja.
- Skenario P0 yang disepakati dapat dijalankan atau memiliki known issue yang jelas.
- Tidak ada blocker keamanan atau kebocoran data.
- Semua temuan dicatat dengan langkah reproduksi.
- Tim menyepakati daftar perbaikan pascatesting.

**Status saat dokumen dibuat:** rencana darurat disusun; pelaksanaan task Jumat–Minggu belum diverifikasi. Perbarui `PROJECT_STATUS.md` dan `WORK_LOG.md` berdasarkan hasil aktual, bukan berdasarkan rencana.
