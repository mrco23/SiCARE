# Dokumen Spesifikasi Modul SiCARE

- **Tanggal:** 2026-11-14
- **Sumber:** analisis kode pada branch `development` (commit `6c68df3`), dilengkapi klarifikasi pemilik proyek.
- **Cakupan:** backend Express (`be/src`, prefix `/api/v1`), fungsi database Supabase (`supabase/migrations`), dan frontend React (`fe/src`).
- **Role sistem:** `client` (klien/mahasiswa/staf), `counselor` (konselor), `admin` (administrator), `head_lmi` (Kepala LMI). Pengecekan role dilakukan middleware `authenticate` + `allowRoles(...)` (`be/src/middleware/auth.js`) dan diulang di fungsi database untuk kepemilikan record.

Keputusan hasil klarifikasi:

1. Mood Tracker adalah fitur hiburan publik permintaan klien proyek: tanpa login dan tanpa penyimpanan.
2. Masa aktif sesi login mengikuti implementasi kode yang ada (bawaan Supabase Auth), tanpa aturan tambahan.
3. Notifikasi in-app: perilaku saat ini sudah sesuai (tanpa penghapusan otomatis, tanpa realtime).
4. Aturan pembuatan akun per role: final sesuai kode.

===

## 1. Autentikasi

* **<Deskripsi>:** Mengelola registrasi akun klien, konfirmasi email, login dengan NIM/NIP atau email, pemeriksaan identitas pengguna aktif, dan logout. Identitas dan token dikelola Supabase Auth; profil dan role disimpan di tabel `profiles`.
* **<Hak / Akses Role>:**
  * Publik (tanpa token): `POST /auth/register`, `POST /auth/login`, `POST /auth/resend-confirmation`.
  * Semua role yang sudah login: `GET /auth/me`, `POST /auth/logout`, `GET/PATCH /profile`.
* **<Alur Kerja>:**
  1. Pengunjung mengisi form registrasi (email, kata sandi, nama lengkap, opsional NIM/NIP dan kategori anggota). Backend memvalidasi dengan Zod lalu membuat user Supabase dan profil ber-role `client`.
  2. Supabase mengirim email konfirmasi. Tautan konfirmasi diproses halaman `AuthConfirmedPage` di frontend.
  3. Jika email belum masuk, pengguna dapat meminta kirim ulang konfirmasi.
  4. Saat login, pengguna memasukkan NIM/NIP atau email beserta kata sandi. Jika yang dimasukkan bukan email, backend mencari email dari `identity_code`, lalu memanggil `signInWithPassword`.
  5. Backend menolak login jika email belum dikonfirmasi atau `account_status` bukan `active`, lalu mengembalikan user, profil, dan session (access + refresh token).
  6. Frontend (`AuthProvider`) menyimpan session melalui Supabase client. Setiap request API mengirim `Authorization: Bearer <access_token>`.
  7. Di setiap endpoint terproteksi, middleware `authenticate` memverifikasi token ke Supabase, memuat profil, dan menolak akun nonaktif.
  8. Logout memanggil `POST /auth/logout` dan menghapus session di frontend.
* **<Aturan & Batasan>:**
  * Email maksimal 254 karakter. Kata sandi registrasi 8–128 karakter. Nama lengkap 1–160 karakter.
  * NIM/NIP (`identity_code`) 1–80 karakter alfanumerik plus `. _ / -`.
  * Kategori anggota: `student`, `faculty_staff`, atau `other`.
  * Registrasi mandiri selalu menghasilkan role `client`.
  * Kirim ulang email konfirmasi dibatasi sekali per 60 detik per email. Cooldown ini disimpan di memori server, jadi akan ter-reset jika server restart.
  * Endpoint login, registrasi, dan kirim ulang konfirmasi diberi rate limit per jendela waktu, diatur lewat environment `AUTH_*_RATE_LIMIT_*`.
  * Pesan gagal login dibuat generik ("NIM/NIP/email atau kata sandi tidak benar") agar tidak membocorkan keberadaan akun.
  * Masa aktif sesi mengikuti bawaan Supabase Auth: access token berumur pendek (default sekitar 1 jam) dan diperbarui otomatis memakai refresh token. Tidak ada batas idle atau batas sesi maksimal tambahan di kode.
  * Akun yang dinonaktifkan admin langsung ditolak pada request berikutnya (`403 ACCOUNT_INACTIVE`), walaupun tokennya belum kedaluwarsa.
  * Route guard frontend hanya untuk navigasi. Otorisasi sebenarnya dilakukan di backend.

===

## 2. Manajemen Role & Akun

* **<Deskripsi>:** Memberikan admin kemampuan mengelola akun staf (konselor dan Kepala LMI), status akun, serta publikasi profil konselor ke halaman publik.
* **<Hak / Akses Role>:** Hanya `admin`: `GET/POST /admin/accounts`, `GET/PATCH/DELETE /admin/accounts/:id`, dan `PATCH /admin/counselors/:counselorId/publication`.
* **<Alur Kerja>:**
  1. Admin membuka halaman manajemen akun. Frontend memanggil `GET /admin/accounts` dengan filter role atau status.
  2. Saat membuat akun, admin mengisi data dan memilih role `counselor` atau `head_lmi`. Untuk konselor, nomor lisensi SIPP/SILP wajib diisi.
  3. Backend membuat user Supabase beserta profilnya dan mencatat aktivitas admin.
  4. Admin dapat mengubah data atau status akun (`PATCH`), atau menonaktifkannya (`DELETE`). Penonaktifan adalah soft delete: `account_status = disabled`.
  5. Admin dapat menerbitkan atau menyembunyikan profil konselor di daftar konselor publik.
* **<Aturan & Batasan>:**
  * Role sistem ada 4: `client`, `counselor`, `admin`, `head_lmi`. Setiap akun hanya memiliki satu role (`profiles.app_role`).
  * Akun `client` hanya dibuat lewat registrasi mandiri.
  * Admin hanya dapat membuat atau mengubah role ke `counselor` dan `head_lmi` (`adminManageableRoles`). Akun `admin` tidak dapat dibuat lewat aplikasi; akun admin dibuat langsung di database oleh pengelola sistem.
  * Status akun: `pending`, `active`, atau `disabled`. Hanya akun `active` yang bisa login dan memakai API.
  * Akun konselor wajib memiliki nomor SIPP/SILP (1–80 karakter).
  * Foto profil admin memakai logo resmi SiCARE dan tidak dapat diubah.

===

## 3. Notifikasi In-App

* **<Deskripsi>:** Menampilkan pemberitahuan kejadian penting (booking, sesi, consent, feedback) kepada penerima melalui ikon lonceng di header setiap dashboard.
* **<Hak / Akses Role>:** `client`, `counselor`, `admin`, `head_lmi`. Setiap pengguna hanya dapat melihat dan mengubah notifikasinya sendiri (`recipient_user_id`).
* **<Alur Kerja>:**
  1. Notifikasi dibuat otomatis oleh fungsi database saat terjadi kejadian bisnis, misalnya:
     * booking dibuat (ke konselor);
     * booking dikonfirmasi, ditolak, dibatalkan, atau diminta jadwal ulang;
     * booking dijadwal ulang oleh klien;
     * sesi dimulai, selesai, atau dibatalkan;
     * feedback masuk (ke semua admin dan Kepala LMI aktif).
  2. Saat layout dashboard dimuat, komponen `NotificationBell` memanggil `GET /notifications?limit=10&offset=0` untuk mengisi badge jumlah belum dibaca.
  3. Saat pengguna membuka panel, halaman pertama dimuat ulang. Halaman berikutnya dimuat otomatis ketika pengguna menggulir ke bawah (infinite scroll, 10 item per halaman).
  4. Pengguna dapat memfilter "Semua" atau "Belum dibaca", menandai satu notifikasi dibaca (`PATCH /notifications/:id/read`), atau menandai semuanya dibaca (`PATCH /notifications/read-all`).
* **<Aturan & Batasan>:**
  * Dropdown menampilkan 10 notifikasi per halaman, diurutkan dari yang terbaru.
  * Batas API: `limit` 1–100 (default 30) dengan `offset`. Response berisi `items`, `unread_count`, dan `has_more`.
  * Badge menampilkan jumlah belum dibaca dan berubah menjadi `99+` jika lebih dari 99.
  * Notifikasi diperbarui hanya saat halaman dimuat dan saat panel dibuka. Tidak ada realtime atau polling (disetujui).
  * Notifikasi tidak dapat dihapus dan tidak ada pembersihan otomatis. Notifikasi tersimpan permanen dengan status dibaca/belum dibaca (disetujui).
  * Isi notifikasi tidak boleh memuat isi konseling atau jawaban intake.

===

## 4. Notifikasi WhatsApp

* **<Deskripsi>:** Mengirim pesan WhatsApp operasional (pengingat sesi, undangan dan pengingat informed consent) melalui provider Fonnte dengan pola transactional outbox, worker, dan scheduler.
* **<Hak / Akses Role>:**
  * Sistem: `POST /internal/whatsapp/worker-run` dan `POST /internal/whatsapp/scheduler-run`, dilindungi secret cron. Endpoint ini menolak semua request jika secret belum dikonfigurasi.
  * Fonnte: `POST /webhooks/fonnte/message-status` (dengan rate limit).
  * `admin`: `GET /admin/whatsapp/health`.
  * Pengguna login: `PATCH /profile/whatsapp-consent` (hanya mencatat persetujuan).
* **<Alur Kerja>:**
  1. Kejadian bisnis (booking dikonfirmasi, undangan consent kelompok) menulis baris ke tabel `whatsapp_outbox` dalam transaksi yang sama.
  2. Scheduler berjalan berkala untuk:
     * mengantrekan pengingat sesi H-1 dan Hari H;
     * mengantrekan pengingat consent yang belum ditandatangani, 24 jam dan 72 jam setelah undangan, maksimal 2 pengingat.
  3. Worker mengambil job yang jatuh tempo memakai lease, mengecek ulang kelayakan (misalnya booking sudah batal berarti job dibatalkan), lalu mengirim pesan ke Fonnte.
  4. Jika gagal sementara, job berstatus `retry_wait` dengan exponential backoff dan jitter. Jika gagal permanen atau batas percobaan habis, job ditandai gagal.
  5. Webhook Fonnte memperbarui status pengiriman.
* **<Aturan & Batasan>:**
  * Jenis pesan: `reminder_h1`, `reminder_day_of`, `consent_invitation`, `consent_reminder` (plus `booking_accepted` pada skema sebelumnya).
  * Sejak 2026-11-13, notifikasi WhatsApp wajib untuk semua klien dan konselor. `whatsapp_opt_in` tetap dicatat tetapi tidak lagi menentukan pengiriman.
  * Maksimal 5 percobaan per pesan (`WHATSAPP_MAX_ATTEMPTS`, dapat diatur 1–20).
  * Idempotency key mencegah pesan pengingat ganda untuk interval yang sama.
  * Jika booking dibatalkan atau diminta jadwal ulang, pengingat yang masih tertunda dibatalkan.
  * Token undangan consent dienkripsi AES-256-GCM.
  * Pesan yang masuk outbox belum tentu terkirim. Status terkirim hanya berlaku setelah ada konfirmasi dari provider.

===

## 5. Mood Tracker

* **<Deskripsi>:** Kuis singkat untuk hiburan yang menebak suasana hati pengunjung website. Fitur ini diminta klien proyek sebagai daya tarik halaman publik, bukan alat asesmen klinis.
* **<Hak / Akses Role>:** Publik. Semua pengunjung dapat mencobanya tanpa login.
* **<Alur Kerja>:**
  1. Pengunjung membuka halaman Mood Tracker dari navbar atau footer.
  2. Pengunjung menjawab 8 pertanyaan pilihan ganda (4 pilihan bergambar emoji): 4 pertanyaan sumbu energi dan 4 pertanyaan sumbu perasaan.
  3. Setiap pilihan bernilai -2, -1, +1, atau +2. Fungsi `calculateMood` (`fe/src/features/public/mood/moodAssessment.ts`) menjumlahkan skor per sumbu.
  4. Hasil ditentukan di browser:
     * **Seimbang:** total energi dan total perasaan sama-sama di antara -2 dan +2;
     * **Ceria & Bersemangat:** energi ≥ 0 dan perasaan ≥ 0;
     * **Tenang & Damai:** energi < 0 dan perasaan ≥ 0;
     * **Tegang & Gelisah:** energi ≥ 0 dan perasaan < 0;
     * **Lelah & Sendu:** energi < 0 dan perasaan < 0.
  5. Halaman menampilkan judul, badge, deskripsi, dan warna hasil. Untuk hasil Tegang dan Lelah, ditambahkan catatan ajakan menghubungi konselor BK di SiCARE.
* **<Aturan & Batasan>:**
  * Tidak memerlukan login dan tidak memiliki endpoint backend.
  * Jawaban dan hasil tidak disimpan (tidak di database, `localStorage`, maupun Zustand) dan tidak dikaitkan dengan akun.
  * Hasil bersifat hiburan dan tidak boleh dipakai sebagai diagnosis atau dasar keputusan klinis.
  * Pertanyaan, skor, dan teks hasil bersifat statis di kode frontend. Perubahan isi memerlukan perubahan kode.

===

## 6. Booking Konseling

* **<Deskripsi>:** Memungkinkan klien memesan slot konseling individual atau kelompok pada konselor tertentu, beserta pengisian intake. Konselor kemudian dapat menerima, menolak, atau meminta jadwal ulang.
* **<Hak / Akses Role>:**
  * `client`: membuat booking (`POST /bookings`), menjadwal ulang (`PATCH /bookings/:id/reschedule`), dan membatalkan booking miliknya.
  * `client` dan `counselor`: melihat daftar dan detail booking milik sendiri (`GET /bookings`, `GET /bookings/:id`), mengubah status (`PATCH /bookings/:id/status`), dan melihat ringkasan consent.
  * Publik: melihat konselor terpublikasi, periode, dan slot tersedia (`/public/*`).
* **<Alur Kerja>:**
  1. Klien memilih konselor dan slot dari jadwal publik, lalu memilih jenis layanan (individual atau kelompok).
  2. Klien mengisi intake: skrining risiko, skala tidur dan keuangan, topik, serta tujuh isian esai.
  3. Backend memvalidasi data dan fungsi database membuat booking berstatus `waiting_confirmation`, mengunci slot, menyimpan intake, dan mengirim notifikasi ke konselor.
  4. Konselor meninjau permintaan:
     * **Terima (`confirmed`):** wajib memilih format `online` atau `offline` (opsional ruang). Sistem membuat sesi `scheduled`.
     * **Tolak (`rejected`):** wajib menyertakan alasan.
     * **Minta jadwal ulang (`reschedule_requested`):** wajib menyertakan alasan. Sesi yang masih `scheduled` dibatalkan.
  5. Jika diminta jadwal ulang, klien memilih slot baru. Booking kembali ke `waiting_confirmation` dan pengingat WhatsApp lama dibatalkan.
  6. Klien dapat membatalkan booking dengan alasan.
* **<Aturan & Batasan>:**
  * Status booking: `waiting_confirmation`, `confirmed`, `rejected`, `reschedule_requested`, `cancelled`.
  * Klien hanya boleh mengubah status ke `cancelled`, dari status `waiting_confirmation`, `confirmed`, atau `reschedule_requested`.
  * Konselor tidak boleh memakai status `cancelled` pada booking. Konselor hanya boleh menerima atau menolak dari `waiting_confirmation`, dan meminta jadwal ulang dari `waiting_confirmation` atau `confirmed`.
  * Booking tidak dapat dibatalkan atau dijadwal ulang jika sesinya sudah `ongoing` atau `completed`.
  * Alasan (1–1000 karakter) wajib untuk pembatalan, penolakan, dan permintaan jadwal ulang.
  * Booking individual tidak boleh memiliki nama kelompok atau peserta.
  * Booking kelompok wajib memiliki nama kelompok dan 2–10 peserta, dengan tepat satu perwakilan.
  * Intake diisi sekali per booking oleh pembuat booking, bukan per peserta:
    * skrining berisi jawaban `Ya`, `Mungkin`, atau `Tidak`;
    * skala tidur dan keuangan bernilai 1–5;
    * topik maksimal 8, minimal satu topik atau isian "lainnya";
    * esai 1–1500 karakter.
  * Slot harus `available`, berada di masa depan, milik konselor aktif, dalam periode akademik aktif, dan tidak sedang dipakai booking lain yang aktif.
  * Daftar booking dibatasi maksimal 100 per request (default 50).

===

## 7. Sesi Konseling

* **<Deskripsi>:** Mengelola siklus hidup sesi yang terbentuk dari booking yang diterima, dari terjadwal hingga selesai.
* **<Hak / Akses Role>:** `client` dan `counselor` dapat melihat sesi miliknya (`GET /sessions`, `GET /sessions/:id`). Hanya `counselor` pemilik sesi yang dapat mengubah status (`PATCH /sessions/:id/status`).
* **<Alur Kerja>:**
  1. Sesi `scheduled` dibuat saat konselor menerima booking.
  2. Konselor memulai sesi (`ongoing`). Sistem memeriksa bahwa semua informed consent peserta sudah lengkap.
  3. Konselor menyelesaikan sesi (`completed`). Klien menerima notifikasi bahwa feedback dapat diberikan.
  4. Konselor dapat membatalkan sesi (`cancelled`). Booking terkait ikut menjadi `cancelled`.
* **<Aturan & Batasan>:**
  * Transisi yang diizinkan hanya `scheduled → ongoing/cancelled` dan `ongoing → completed/cancelled`.
  * Sesi tidak dapat dimulai sebelum consent lengkap (`CONSENT_READINESS_INCOMPLETE`).
  * Waktu mulai (`started_at`) dan selesai (`completed_at`) dicatat oleh server.
  * Setiap transisi mengirim notifikasi in-app ke klien.

===

## 8. Informed Consent

* **<Deskripsi>:** Mengumpulkan persetujuan tertulis (tanda tangan digital) dari klien dan setiap peserta kelompok sebelum sesi dimulai, lalu menyimpannya sebagai dokumen PDF yang tidak dapat diubah.
* **<Hak / Akses Role>:**
  * `client`: melengkapi identitas dan menandatangani consent miliknya.
  * `client` dan `counselor`: melihat consent miliknya pada booking.
  * Semua role yang sudah login: melihat readiness, detail consent, ringkasan kelompok, dan mengunduh dokumen, dengan pengecekan akses booking di database.
  * `client`, `counselor`, `admin`: mengirim ulang undangan ke peserta kelompok.
  * Peserta tamu: klaim undangan melalui token, lalu mengisi identitas, menandatangani, dan mengunduh dokumennya sendiri (`/consents/guest/me/*`).
* **<Alur Kerja>:**
  1. Setelah booking dibuat, sistem membuat consent untuk klien. Untuk booking kelompok, setiap peserta menerima undangan, termasuk lewat WhatsApp.
  2. Peserta membuka tautan undangan dan mengklaim token. Peserta lalu mengisi identitas (disimpan sebagai draft) dan menandatangani.
  3. Server membuat PDF bertanda tangan dari template consent aktif dan mencatat audit log.
  4. Konselor memantau readiness. Sesi hanya bisa dimulai jika semua consent lengkap.
  5. Dokumen diunduh lewat URL bertanda tangan yang berlaku singkat.
* **<Aturan & Batasan>:**
  * Harus ada template consent aktif (`ACTIVE_CONSENT_TEMPLATE_MISSING`).
  * Consent yang sudah ditandatangani tidak dapat diubah atau dihapus. Consent yang dicabut bersifat final.
  * Audit log consent hanya bisa ditambah (append-only).
  * Undangan bisa kedaluwarsa, dicabut, atau sudah terpakai. Undangan hanya bisa diklaim sekali dan harus cocok dengan akun yang benar.
  * Pengingat consent dikirim maksimal 2 kali, pada 24 jam dan 72 jam setelah undangan dibuat.

===

## 9. Profil & Jadwal Konselor

* **<Deskripsi>:** Memungkinkan konselor mengelola profil publik, lisensi praktik, dan slot ketersediaan jadwal.
* **<Hak / Akses Role>:**
  * `counselor`: `/counselor/profile`, `/counselor/license`, `/counselor/availability`.
  * Semua pengguna login: foto profil (`/profile/photo`), kecuali admin.
  * Publik: membaca konselor terpublikasi dan slot tersedia.
* **<Alur Kerja>:**
  1. Konselor memperbarui nama publik, headline, bio, spesialisasi, dan pengalaman.
  2. Konselor memperbarui nomor SIPP/SILP beserta masa berlakunya.
  3. Konselor membuat slot jadwal (waktu mulai dan selesai, opsional periode akademik), mengubahnya, atau membatalkannya.
  4. Slot `available` milik konselor yang terpublikasi tampil di halaman publik untuk dipesan.
* **<Aturan & Batasan>:**
  * Nama publik 1–160 karakter, headline maksimal 240, bio maksimal 5000.
  * Spesialisasi maksimal 20 item (masing-masing 1–100 karakter). Pengalaman 0–80 tahun.
  * Nomor SIPP/SILP 1–80 karakter dengan masa berlaku format `YYYY-MM-DD`.
  * Slot harus di masa depan, waktu selesai harus setelah waktu mulai, tidak boleh tumpang tindih dengan slot lain, dan harus berada dalam periode akademik yang valid.
  * Slot yang sudah dipesan tidak dapat diubah (`AVAILABILITY_BOOKED`).
  * Foto profil harus JPG, PNG, atau WebP dengan ukuran maksimal 2 MB.

===

## 10. Riwayat & Catatan Konseling

* **<Deskripsi>:** Menyediakan riwayat konseling dan catatan sesi untuk konselor, dilindungi kata sandi riwayat tambahan di luar login.
* **<Hak / Akses Role>:** Hanya `counselor`: `/counselor/history-password/*`, `GET /counselor/history`, `PUT /counselor/sessions/:sessionId/notes`, `GET /counselor/sessions/:sessionId/report`.
* **<Alur Kerja>:**
  1. Saat pertama kali, konselor membuat kata sandi riwayat (`init`).
  2. Untuk membuka riwayat, konselor memverifikasi kata sandi. Server menerbitkan grant token bertanda tangan yang berlaku 30 menit.
  3. Grant dikirim bersama request riwayat. Frontend menyimpannya di `sessionStorage` hanya untuk kemudahan; validasi tetap dilakukan server.
  4. Konselor menyimpan catatan sesi (catatan konselor, catatan untuk klien, tindak lanjut) dan melihat laporan sesi, termasuk intake klien.
  5. Konselor dapat mengganti kata sandi riwayat.
* **<Aturan & Batasan>:**
  * Kata sandi riwayat 4–100 karakter.
  * Setelah 5 kali verifikasi gagal, akses dikunci 15 menit. Penghitung ini disimpan di memori server dan ter-reset jika server restart.
  * Grant akses berlaku 30 menit dan terikat pada ID konselor.
  * Catatan konselor dan catatan klien maksimal 10.000 karakter. Tindak lanjut maksimal 5.000 karakter.
  * Konselor hanya dapat mengakses sesi miliknya sendiri.

===

## 11. Feedback

* **<Deskripsi>:** Mengumpulkan penilaian klien atas sesi yang selesai, memoderasi feedback untuk ditampilkan ke publik, dan meninjaunya untuk evaluasi layanan.
* **<Hak / Akses Role>:**
  * `client`: mengirim feedback (`POST /sessions/:sessionId/feedback`) dan melihat feedback miliknya (`GET /feedback/mine`).
  * `counselor`: melihat feedback untuk dirinya (`GET /feedback/counselor`).
  * `admin` dan `head_lmi`: daftar, statistik, dan detail feedback (`/admin/feedback*`).
  * `admin`: moderasi (`PATCH /admin/feedback/:id/moderation`).
  * `head_lmi`: peninjauan (`PATCH /admin/feedback/:id/review`).
  * Publik: membaca feedback yang sudah ditampilkan (`GET /public/feedback`).
* **<Alur Kerja>:**
  1. Setelah sesi `completed`, klien memberikan rating dan komentar opsional.
  2. Feedback tersimpan dengan status moderasi `pending` dan status tinjau `new`. Semua admin dan Kepala LMI aktif menerima notifikasi.
  3. Admin memoderasi: `shown` (tampil di publik) atau `disabled` (wajib dengan alasan).
  4. Kepala LMI menandai tinjauan: `reviewed` atau `resolved`.
* **<Aturan & Batasan>:**
  * Rating berupa bilangan bulat 1–5. Komentar maksimal 5000 karakter.
  * Feedback hanya untuk sesi `completed` milik klien tersebut, dan hanya oleh klien aktif.
  * Status moderasi: `pending`, `shown`, `disabled`. Alasan wajib (1–1000 karakter) jika `disabled`.
  * Status tinjau: `new`, `reviewed`, `resolved`.
  * Hanya feedback `shown` yang tampil di halaman publik.
  * Daftar feedback konselor maksimal 100 per request. Daftar feedback admin maksimal 1000 per request.

===

## 12. Dashboard & Laporan

* **<Deskripsi>:** Menyajikan ringkasan statistik dan laporan layanan konseling untuk pengelola.
* **<Hak / Akses Role>:**
  * `admin`: `GET /admin/dashboard`, `GET /admin/reports`, `GET /admin/activity`.
  * `head_lmi`: `GET /head-lmi/dashboard`, `GET /head-lmi/reports`.
  * `admin` dan `head_lmi`: `GET /admin/counseling`.
* **<Alur Kerja>:**
  1. Saat dashboard dibuka, frontend memanggil endpoint dashboard sesuai role.
  2. Backend mengagregasi data booking, sesi, dan feedback, lalu mengembalikan ringkasan.
  3. Halaman laporan menampilkan rekap konseling. Admin juga dapat melihat log aktivitas sistem.
* **<Aturan & Batasan>:**
  * Dashboard dan laporan dipisah per role; endpoint admin tidak dapat diakses Kepala LMI dan sebaliknya.
  * Audit trail tidak menyalin isi konseling, jawaban intake, atau token ke metadata.

===

## 13. Periode Akademik & Konten Publik

* **<Deskripsi>:** Mengatur periode akademik yang membatasi jadwal konseling, serta konten motivasi pada hero halaman utama.
* **<Hak / Akses Role>:**
  * `admin`: CRUD `/admin/periods` dan `/admin/hero-motivations`.
  * Publik: `GET /public/periods`, `GET /public/hero-motivations`, `GET /public/counselors`, `GET /public/availability`.
* **<Alur Kerja>:**
  1. Admin membuat periode akademik, lalu mengaktifkan atau menonaktifkannya (`is_active`).
  2. Konselor mengaitkan slot ke periode. Booking hanya dapat dibuat pada periode yang valid.
  3. Admin mengelola daftar motivasi hero. Motivasi yang aktif tampil di beranda.
* **<Aturan & Batasan>:**
  * Periode baru default nonaktif. Motivasi hero baru default aktif.
  * Slot di luar periode aktif tidak dapat dipesan (`BOOKING_PERIOD_UNAVAILABLE`).

===

## Catatan

* Frontend masih memiliki `fe/src/features/notification/notificationStore.ts` berisi data demo/mock. Notifikasi produksi memakai `NotificationBell` yang terhubung ke API.
* Rincian kontrak endpoint ada di `docs/integration/API_ENDPOINT_MATRIX.md`. Gap SOP ada di `docs/integration/SOP_COVERAGE_MATRIX.md`.
