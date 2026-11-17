# Dokumen Spesifikasi Modul SiCARE

- **Tanggal:** 2026-11-14 (diperbarui 2026-11-16)
- **Sumber:** analisis kode pada branch `development` (commit `6c68df3`), dilengkapi klarifikasi pemilik proyek.
- **Pembaruan 2026-11-14:** aturan kata sandi kuat, email kampus wajib, telepon format `+62`, ganti kata sandi akun lewat server (§1, §2, §9), notifikasi WhatsApp permintaan booking ke konselor (§4), dan ikon Mood Tracker (§5).
- **Pembaruan 2026-11-15:** status otomatis sesi "Terlewat" dan booking "Kedaluwarsa" (§6, §7), pengingat WhatsApp 07.00 WITA (§4), blokir jadwal akhir pekan (§9), halaman Mood Tracker terpisah dengan maskot animasi (§5), dan logo Lasallian DNA yang dikelola admin (§13).
- **Pembaruan 2026-11-16:** penjaga alur konseling hasil audit (migrasi `20261116120000`): penutupan otomatis sesi yang tidak diakhiri, booking jadwal ulang ikut kedaluwarsa, jendela waktu memulai sesi, dan larangan membatalkan booking yang sesinya sudah ditutup (§3, §6, §7, §10–§12).
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
  * Semua role yang sudah login: `GET /auth/me`, `POST /auth/logout`, `POST /auth/change-password`, `GET/PATCH /profile`.
* **<Alur Kerja>:**
  1. Pengunjung mengisi form registrasi (kategori, NIM/NIP, email, kata sandi, nama lengkap, nomor telepon). Untuk mahasiswa, email dibuat otomatis dari NIM. Untuk dosen/staf, pengunjung hanya mengetik nama email; akhiran `@unikadelasalle.ac.id` dipasang tetap oleh frontend. Telepon diisi di samping awalan tetap `+62`. Backend memvalidasi dengan Zod lalu membuat user Supabase dan profil ber-role `client`.
  2. Supabase mengirim email konfirmasi. Tautan konfirmasi diproses halaman `AuthConfirmedPage` di frontend.
  3. Jika email belum masuk, pengguna dapat meminta kirim ulang konfirmasi.
  4. Saat login, pengguna memasukkan NIM/NIP atau email beserta kata sandi. Jika yang dimasukkan bukan email, backend mencari email dari `identity_code`, lalu memanggil `signInWithPassword`.
  5. Backend menolak login jika email belum dikonfirmasi atau `account_status` bukan `active`, lalu mengembalikan user, profil, dan session (access + refresh token).
  6. Frontend (`AuthProvider`) menyimpan session melalui Supabase client. Setiap request API mengirim `Authorization: Bearer <access_token>`.
  7. Di setiap endpoint terproteksi, middleware `authenticate` memverifikasi token ke Supabase, memuat profil, dan menolak akun nonaktif.
  8. Logout memanggil `POST /auth/logout` dan menghapus session di frontend.
  9. Ganti kata sandi akun dilakukan dari halaman Pengaturan (Klien, Konselor tab "Kata Sandi Akun", Kepala LMI). Frontend mengirim `POST /auth/change-password` berisi kata sandi saat ini dan kata sandi baru. Backend memverifikasi ulang kata sandi saat ini lewat `signInWithPassword`, lalu memperbarui kata sandi lewat Supabase Auth Admin. Pesan sukses hanya tampil setelah server mengonfirmasi.
* **<Aturan & Batasan>:**
  * Email maksimal 254 karakter dan wajib berdomain `@unikadelasalle.ac.id`. Nama lengkap 1–160 karakter.
  * Kata sandi akun (registrasi, akun buatan admin, dan ganti kata sandi) wajib 8–128 karakter serta memuat minimal satu huruf kecil, satu huruf besar, satu angka, dan satu simbol. Frontend menampilkan daftar syarat yang tercentang langsung; backend tetap memvalidasi ulang (`strongPasswordSchema`).
  * Nomor telepon disimpan dalam format E.164 Indonesia: `+62` diikuti 8–13 digit tanpa angka 0 di depan (`^\+62[1-9]\d{7,12}$`). Input `08…` atau `62…` dinormalisasi otomatis di frontend.
  * Ganti kata sandi: kata sandi baru harus berbeda dari kata sandi saat ini. Kata sandi saat ini yang salah ditolak (`400 CURRENT_PASSWORD_INVALID`). Aktivitas dicatat di audit (`auth.password_change`) tanpa menyimpan kata sandi.
  * Akun lama yang kata sandinya tidak memenuhi aturan baru tetap dapat login. Aturan hanya berlaku saat membuat atau mengganti kata sandi.
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
  2. Saat membuat akun, admin mengisi data dan memilih role `counselor` atau `head_lmi`. Admin hanya mengetik nama email; akhiran `@unikadelasalle.ac.id` dipasang tetap. Kata sandi awal wajib memenuhi aturan kata sandi akun (§1). **NIP wajib diisi** (sejak 2026-11-17; admin hanya membuat akun staf/dosen, sehingga kolomnya berlabel "NIP", bukan "NIM / NIP"). Untuk konselor, nomor lisensi SIPP/SILP wajib diisi.
  3. Backend membuat user Supabase beserta profilnya dan mencatat aktivitas admin.
  4. Admin dapat mengubah data atau status akun (`PATCH`), atau menonaktifkannya (`DELETE`). Penonaktifan adalah soft delete: `account_status = disabled`.
  5. Admin dapat menerbitkan atau menyembunyikan profil konselor di daftar konselor publik.
* **<Aturan & Batasan>:**
  * Role sistem ada 4: `client`, `counselor`, `admin`, `head_lmi`. Setiap akun hanya memiliki satu role (`profiles.app_role`).
  * Akun `client` hanya dibuat lewat registrasi mandiri.
  * Admin hanya dapat membuat atau mengubah role ke `counselor` dan `head_lmi` (`adminManageableRoles`). Akun `admin` tidak dapat dibuat lewat aplikasi; akun admin dibuat langsung di database oleh pengelola sistem.
  * Status akun: `pending`, `active`, atau `disabled`. Hanya akun `active` yang bisa login dan memakai API.
  * Akun konselor wajib memiliki nomor SIPP/SILP (1–80 karakter).
  * Akun baru yang dibuat admin wajib memakai email `@unikadelasalle.ac.id`. Saat mengubah akun, email ditampilkan penuh dan tidak dapat diubah.
  * Nomor telepon pada form ubah akun memakai awalan tetap `+62` dan disimpan dalam format E.164 Indonesia (§1).
  * Foto profil admin memakai logo resmi SiCARE dan tidak dapat diubah.
  * Sejak 2026-11-15 halaman Admin Akun tidak memiliki filter "Admin" dan tidak menampilkan akun ber-role `admin` (disaring di frontend; `GET /admin/accounts` tidak berubah).

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
     * booking kedaluwarsa (`booking.expired`, ke klien dan konselor);
     * sesi terlewat (`session.missed`, ke klien dan konselor);
     * sesi ditutup otomatis (`session.completed` ke klien, `session.auto_completed` ke konselor);
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

* **<Deskripsi>:** Mengirim pesan WhatsApp operasional (pemberitahuan booking, pengingat sesi, dan undangan informed consent kelompok) melalui provider Fonnte dengan pola transactional outbox, worker, dan scheduler.
* **<Hak / Akses Role>:**
  * Sistem: `POST /internal/whatsapp/worker-run` dan `POST /internal/whatsapp/scheduler-run`, dilindungi secret cron. Endpoint ini menolak semua request jika secret belum dikonfigurasi.
  * Fonnte: `POST /webhooks/fonnte/message-status` (dengan rate limit).
  * `admin`: `GET /admin/whatsapp/health`.
  * Pengguna login: `PATCH /profile/whatsapp-consent` (hanya mencatat persetujuan).
* **<Alur Kerja>:**
  1. Kejadian bisnis menulis baris ke tabel `whatsapp_outbox` dalam transaksi yang sama, misalnya:
     * booking dibuat: pesan `booking_requested` ke konselor ("Anda menerima permintaan jadwal konseling baru…" beserta nomor booking, nama klien, tanggal, waktu, dan jenis layanan) dan `booking_received` ke klien;
     * booking dikonfirmasi, ditolak, dibatalkan, atau diminta jadwal ulang;
     * undangan consent kelompok.
  2. Scheduler (dipanggil cron tiap 10 menit) mengantrekan pengingat sesi untuk booking `confirmed` yang sesinya `scheduled` dalam 7 hari ke depan, dan menandai sesi terlewat (§7). Sejak 2026-11-15 scheduler tidak lagi membuat pengingat consent.
  3. Worker (dipanggil cron tiap 1 menit) mengambil job yang jatuh tempo memakai lease, mengecek ulang kelayakan, lalu mengirim pesan ke Fonnte. Pengingat sesi dibatalkan (`REMINDER_NOT_APPLICABLE`) bila booking tidak lagi `confirmed` atau sesi tidak lagi `scheduled`; undangan consent dibatalkan bila undangan dicabut/kedaluwarsa, consent sudah ditandatangani, atau booking batal/ditolak.
  4. Jika gagal sementara, job berstatus `retry_wait` dengan exponential backoff dan jitter. Jika gagal permanen atau batas percobaan habis, job ditandai gagal.
  5. Webhook Fonnte memperbarui status pengiriman.
* **<Aturan & Batasan>:**
  * Jenis pesan dan waktu kirim (WITA):
    * `booking_requested` (ke konselor) dan `booking_received` (ke klien): langsung saat klien membuat booking.
    * `booking_accepted` (ke klien): langsung saat konselor menerima booking.
    * `booking_rejected` (ke klien): langsung saat konselor menolak.
    * `reschedule_requested` dan `booking_cancelled` (ke pihak lawan): langsung saat jadwal ulang diminta atau booking dibatalkan.
    * `consent_invitation` (ke anggota kelompok selain perwakilan yang punya nomor WhatsApp): langsung saat konselor menerima booking kelompok, atau saat konselor mengirim ulang undangan.
    * `reminder_h1` (ke klien dan konselor): jam 07.00 WITA sehari sebelum sesi. Jika booking baru dikonfirmasi pada hari itu setelah 07.00 (sampai 23.59 WITA), H-1 langsung dikirim saat dikonfirmasi. Jika booking dikonfirmasi pada hari sesi, H-1 tidak dikirim.
    * `reminder_morning` (ke klien dan konselor): jam 07.00 WITA di hari sesi. Dilewati untuk sesi yang mulai pukul 08.30 WITA atau lebih awal karena bertabrakan dengan pengingat 1 jam.
    * `reminder_day_of` (ke klien dan konselor): 1 jam sebelum sesi, tidak terikat jam 07.00.
    * `consent_reminder`: dinonaktifkan sejak 2026-11-15; baris tertunda dibatalkan (`CONSENT_REMINDER_DISABLED`).
  * Semua tanggal dan jam di isi pesan WhatsApp ditulis dalam WITA (`Asia/Makassar`). Template menghitung ulang dari `starts_at`/`ends_at`, sehingga teks jam lama yang sudah tersimpan di antrean tidak dipakai bila waktu mulai tersedia.
  * Waktu 07.00 WITA dihitung di backend (`witaMorning`) dan di database (`sicare_wita_morning`, migrasi `20261115130000`). Trigger `whatsapp_outbox_align_reminder_h1` menyelaraskan `reminder_h1` yang dibuat fungsi booking database ke jam 07.00 WITA. `reminder_morning` hanya dibuat scheduler, jadi baru masuk antrean paling lambat 10 menit setelah booking dikonfirmasi.
  * Pengiriman nyata bergantung pada environment server: `WHATSAPP_SEND_ENABLED=false` berarti simulasi (pesan dibatalkan `DRY_RUN_NOT_SENT`), `WHATSAPP_TEST_MODE=true` berarti hanya nomor di `WHATSAPP_TEST_RECIPIENTS` yang dikirimi (lainnya gagal `TEST_RECIPIENT_NOT_ALLOWED`), dan `FONNTE_TOKEN` wajib terisi. `FONNTE_ENABLED` tidak dibaca kode.
  * Worker membaca nomor `profiles.phone_e164` penerima saat mengirim. Penerima tanpa nomor yang valid tidak menerima pesan. Konselor mengisi nomor WhatsApp di Pengaturan Konselor (§9); klien mengisinya saat registrasi atau di Pengaturan Klien.
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
  1. Pengunjung membuka halaman Mood Tracker dari navbar atau footer. Bagian pembuka menjelaskan fitur (8 pertanyaan tentang energi dan perasaan, memperkirakan mood saat ini ke salah satu dari lima mood), lama pengisian ±1–2 menit, bahwa jawaban tidak disimpan, dan bahwa hasilnya untuk refleksi, bukan diagnosis. Tombol "Ayo cek mood kamu sekarang" (didampingi maskot SiCARE yang melambai) membuka halaman terpisah `/mood-tracker/cek` berisi formulir pertanyaan, dengan latar seperti halaman login/register.
  2. Pengunjung menjawab 8 pertanyaan pilihan ganda (4 pilihan bergambar ikon): 4 pertanyaan sumbu energi dan 4 pertanyaan sumbu perasaan.
  3. Setiap pilihan bernilai -2, -1, +1, atau +2. Fungsi `calculateMood` (`fe/src/features/public/mood/moodAssessment.ts`) menjumlahkan skor per sumbu.
  4. Hasil ditentukan di browser:
     * **Seimbang:** total energi dan total perasaan sama-sama di antara -2 dan +2;
     * **Ceria & Bersemangat:** energi ≥ 0 dan perasaan ≥ 0;
     * **Tenang & Damai:** energi < 0 dan perasaan ≥ 0;
     * **Tegang & Gelisah:** energi ≥ 0 dan perasaan < 0;
     * **Lelah & Sendu:** energi < 0 dan perasaan < 0.
  5. Setelah semua pertanyaan dijawab dan tombol "Cek Mood Saya" diklik, halaman otomatis bergulir ke paling atas dan kartu hasil tampil di atas formulir: judul, badge (dengan ikon cuaca hati), deskripsi, warna hasil, maskot dengan ekspresi sesuai mood, dan tombol "Ulangi tes" (mengosongkan jawaban). Mengubah jawaban setelah hasil tampil menyembunyikan hasil lama. Untuk hasil Tegang dan Lelah, ditambahkan catatan ajakan menghubungi konselor BK di SiCARE.
* **<Aturan & Batasan>:**
  * Tidak memerlukan login dan tidak memiliki endpoint backend.
  * Jawaban dan hasil tidak disimpan (tidak di database, `localStorage`, maupun Zustand) dan tidak dikaitkan dengan akun.
  * Hasil bersifat hiburan dan tidak boleh dipakai sebagai diagnosis atau dasar keputusan klinis.
  * Pertanyaan, skor, dan teks hasil bersifat statis di kode frontend. Perubahan isi memerlukan perubahan kode.
  * Ikon jawaban adalah versi mini maskot resmi SiCARE (karakter Psi navy dengan bintang dan DNA hijau-emas), dibuat sebagai SVG di `fe/src/components/mood/MoodIcons.tsx`. Posisi lengan Psi menunjukkan energi (terangkat tinggi untuk +2 hingga terkulai untuk −2), ekspresi wajah menunjukkan perasaan, dan properti kecil memberi konteks jawaban.
  * Maskot pembuka (`fe/src/components/mood/AnimatedMascot.tsx`) adalah SVG berlapis yang mengikuti maskot di landing page — kepala berbentuk cawan (cabang tengah trisula Psi), badan berupa pilinan DNA emas-hijau dengan anak tangga ungu, kaki keluar dari bawah DNA, dua sayap trisula navy bergaris emas dari belakang leher, lengan kecil bersarung tangan putih dari sisi DNA, dan bintang ber-buku — dengan animasi prosedural (cabang trisula berayun, melambai dengan gerak susulan pergelangan, kedip acak, napas, badan dan mata mengikuti kursor, lebih bersemangat saat tombol ajakan disorot). Animasi berhenti saat maskot tidak terlihat dan tidak berjalan untuk pengguna dengan `prefers-reduced-motion`. Komponen ini dapat diganti animasi Rive (`.riv`) tanpa mengubah halaman.
  * Ekspresi maskot hasil: Ceria — melambai semangat sambil melompat, mata tersenyum, kilauan; Tenang — mata terpejam damai, tangan santai, napas pelan; Tegang — mata melebar, alis cemas, mulut bergelombang, keringat, gemetar, tangan di dada; Lelah — kelopak setengah tertutup, sayap terkulai, menguap, "Z" melayang; Seimbang — kedua tangan terentang, badan menjungkit pelan.
  * Badge hasil memakai ikon cuaca hati: cerah (Ceria), teduh (Tenang), angin (Tegang), hujan (Lelah), busur seimbang (Seimbang).
  * Ikon bersifat dekoratif (`aria-hidden`); teks jawaban dan badge tetap menjadi label. Jawaban bernilai negatif tidak memakai warna merah atau tanda peringatan.

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
  5. Jika diminta jadwal ulang, klien memilih slot baru. Booking kembali ke `waiting_confirmation` dan pengingat WhatsApp lama dibatalkan. Bila klien belum memilih slot sampai jam mulai asli booking, booking otomatis `expired`.
  6. Klien dapat membatalkan booking dengan alasan.
* **<Aturan & Batasan>:**
  * Status booking: `waiting_confirmation`, `confirmed`, `rejected`, `reschedule_requested`, `cancelled`, `expired` (otomatis, tidak dapat dipilih pengguna).
  * Klien hanya boleh mengubah status ke `cancelled`, dari status `waiting_confirmation`, `confirmed`, atau `reschedule_requested`.
  * Konselor tidak boleh memakai status `cancelled` pada booking. Konselor hanya boleh menerima atau menolak dari `waiting_confirmation`, dan meminta jadwal ulang dari `waiting_confirmation` atau `confirmed`.
  * Booking tidak dapat dibatalkan atau dijadwal ulang jika sesinya sudah `ongoing`, `completed`, atau `missed` (`409 BOOKING_SESSION_CLOSED` / `SESSION_ALREADY_STARTED`).
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
  * Sejak 2026-11-15, booking `waiting_confirmation` yang belum diterima atau ditolak konselor sampai jam mulainya otomatis menjadi `expired` ("Kedaluwarsa") lewat fungsi `sicare_mark_expired_bookings` (migrasi `20261115140000`). Fungsi ini dipanggil scheduler cron tiap 10 menit serta saat daftar booking, daftar sesi, dashboard, atau laporan dibaca (maks. sekali per menit per instance). `expired_at` mencatat waktunya.
  * Saat booking kedaluwarsa: pesan WhatsApp yang belum terkirim untuk booking itu dibatalkan, klien dan konselor menerima notifikasi in-app `booking.expired` (tanpa WhatsApp), dan slot jadwalnya lepas. Booking `expired` bersifat final.
  * Booking yang jam mulainya sudah tiba tidak dapat dikonfirmasi lagi: trigger `bookings_guard_confirmation_time` menolak perubahan ke `confirmed` (`409 BOOKING_EXPIRED`), walaupun penanda otomatis belum berjalan.
  * Sejak 2026-11-16 (migrasi `20261116120000`), booking `reschedule_requested` juga kedaluwarsa bila klien belum memilih slot pengganti sampai jam mulai aslinya tiba. Kolom `expired_reason` membedakan alasannya: `not_confirmed` (belum dikonfirmasi konselor) atau `reschedule_not_selected` (jadwal pengganti tidak dipilih). Undangan consent anggota kelompok untuk booking itu dicabut. Akibatnya, bila konselor meminta jadwal ulang menjelang jadwal, waktu klien untuk memilih slot pengganti hanya sampai jam mulai asli tersebut.
  * Booking `confirmed` tidak dapat dibatalkan klien atau diminta jadwal ulang bila sesinya sudah `ongoing`, `completed`, atau `missed`: trigger `bookings_guard_closed_session` menolaknya (`409 BOOKING_SESSION_CLOSED`).
  * Tampilan: klien melihat bagian "Permintaan kedaluwarsa" di Aktivitas (14 hari terakhir, tombol "Pesan jadwal baru") dan label "Kedaluwarsa" di Riwayat dan Beranda; konselor melihatnya di tab "Ditutup" halaman Permintaan; Admin mengelompokkannya sebagai tidak terlaksana dengan label sendiri; laporan menyertakan `totals.expired_bookings`.

===

## 7. Sesi Konseling

* **<Deskripsi>:** Mengelola siklus hidup sesi yang terbentuk dari booking yang diterima, dari terjadwal hingga selesai.
* **<Hak / Akses Role>:** `client` dan `counselor` dapat melihat sesi miliknya (`GET /sessions`, `GET /sessions/:id`). Hanya `counselor` pemilik sesi yang dapat mengubah status (`PATCH /sessions/:id/status`).
* **<Alur Kerja>:**
  1. Sesi `scheduled` dibuat saat konselor menerima booking.
  2. Konselor memulai sesi (`ongoing`) dalam jendela 15 menit sebelum jam mulai sampai jam selesai. Sistem memeriksa bahwa semua informed consent peserta sudah lengkap.
  3. Konselor menyelesaikan sesi (`completed`). Klien menerima notifikasi bahwa feedback dapat diberikan.
  4. Konselor dapat membatalkan sesi (`cancelled`). Booking terkait ikut menjadi `cancelled`.
  5. Sesi `ongoing` yang belum diakhiri konselor sampai 2 jam setelah jam selesainya ditutup otomatis menjadi `completed` oleh `sicare_auto_complete_sessions` (migrasi `20261116120000`), dipanggil bersama penanda otomatis lain. `completed_at` diisi jam selesai terjadwal dan `auto_completed_at` mencatat waktu penutupan. Klien menerima notifikasi `session.completed` (feedback dapat diberikan) dan konselor menerima `session.auto_completed`; catatan sesi tetap dapat diisi. Detail sesi konselor menampilkan keterangan "Ditutup otomatis".
  6. Sesi yang masih `scheduled` 30 menit setelah jam selesainya ditandai otomatis `missed` ("Terlewat") oleh fungsi database `sicare_mark_missed_sessions` (migrasi `20261115120000`). Fungsi ini dipanggil scheduler cron tiap 10 menit, dan juga saat daftar sesi, riwayat konselor, atau laporan dibaca (paling sering sekali per menit per instance), sehingga status tetap benar walau cron tidak berjalan.
* **<Aturan & Batasan>:**
  * Status sesi: `scheduled`, `ongoing`, `completed`, `cancelled`, `missed` (otomatis).
  * Transisi oleh konselor hanya `scheduled → ongoing/cancelled` dan `ongoing → completed/cancelled`. Transisi otomatis sistem: `scheduled → missed` (jam selesai + 30 menit) dan `ongoing → completed` (jam selesai + 2 jam).
  * Sesi tidak dapat dimulai sebelum consent lengkap (`CONSENT_READINESS_INCOMPLETE`).
  * Sejak 2026-11-16, sesi hanya dapat dimulai dari 15 menit sebelum jam mulai sampai jam selesainya (`409 SESSION_START_TOO_EARLY` / `409 SESSION_START_WINDOW_PASSED`). Tombol "Mulai Sesi" di Aktivitas Konselor nonaktif di luar jendela itu dan menampilkan alasannya; waktu diperbarui tiap 30 detik.
  * Waktu mulai (`started_at`) dan selesai (`completed_at`) dicatat oleh server.
  * Setiap transisi mengirim notifikasi in-app ke klien.
  * Status `missed` mencatat alasan (`missed_reason`): `consent_unsigned` bila informed consent belum lengkap, atau `not_started` bila consent lengkap tetapi konselor tidak memulai sesi. Waktu penandaan disimpan di `missed_at`.
  * Saat sesi ditandai `missed`: pengingat WhatsApp dan undangan/pengingat consent yang belum terkirim dibatalkan, klien dan konselor menerima notifikasi in-app `session.missed`, dan status booking tidak diubah. Sesi `missed` bersifat final (tidak dapat dimulai, diselesaikan, atau dibatalkan) dan tidak dapat diberi feedback.
  * Sebelum sesi ditandai `missed`, halaman Aktivitas klien menampilkan sesi yang jamnya sudah tiba tetapi belum dimulai sebagai "Menunggu sesi dimulai", dengan tombol tanda tangan consent bila belum ditandatangani. Status tampilan klien mengikuti status server, bukan jam.
  * Sesi terlewat tampil sebagai "Terlewat" di halaman klien (Aktivitas 14 hari terakhir, Riwayat, Beranda), konselor (Aktivitas tab Selesai, Beranda, Riwayat), dan Admin (dikelompokkan sebagai tidak terlaksana bersama sesi batal, dengan label sendiri). Laporan menyertakan `totals.missed_sessions`.
  * Apakah sesi terlewat dihitung sebagai "tidak hadir" belum ditetapkan dan menunggu keputusan pemilik SOP LMI.

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
  1. Konselor memperbarui nama publik, nomor telepon (WhatsApp), headline, bio, spesialisasi, dan pengalaman.
  2. Konselor memperbarui nomor SIPP/SILP beserta masa berlakunya.
  3. Konselor membuat slot jadwal (waktu mulai dan selesai, opsional periode akademik), mengubahnya, atau membatalkannya.
  4. Slot `available` milik konselor yang terpublikasi tampil di halaman publik untuk dipesan.
* **<Aturan & Batasan>:**
  * Nama publik 1–160 karakter, headline maksimal 240, bio maksimal 5000.
  * Spesialisasi maksimal 20 item (masing-masing 1–100 karakter). Pengalaman 0–80 tahun.
  * Nomor SIPP/SILP 1–80 karakter dengan masa berlaku format `YYYY-MM-DD`.
  * Nomor telepon konselor wajib diisi, memakai awalan tetap `+62` (§1), dan tidak ditampilkan ke klien. Nomor ini dipakai untuk notifikasi WhatsApp permintaan booking dan pengingat jadwal (§4).
  * Slot harus di masa depan, waktu selesai harus setelah waktu mulai, tidak boleh tumpang tindih dengan slot lain, dan harus berada dalam periode akademik yang valid.
  * Sejak 2026-11-15 konselor hanya dapat membuat atau mengubah slot pada hari kerja Senin–Jumat (dihitung dalam waktu WITA, `Asia/Makassar`). Sabtu dan Minggu ditandai "Libur" di kalender konselor dan ditolak backend (`slotSchema`). Aturan ini hanya berlaku lewat aplikasi: slot akhir pekan yang dimasukkan langsung ke database oleh pengelola (untuk uji atau pemeliharaan) tetap tampil dan dapat dipesan, dan konselor tetap dapat membatalkannya.
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
  * Catatan sesi dan laporan hanya tersedia untuk sesi `completed`, termasuk sesi yang ditutup otomatis. Sesi `missed` dan `cancelled` tidak memiliki catatan.

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
  * Feedback hanya untuk sesi `completed` milik klien tersebut (termasuk sesi yang ditutup otomatis), dan hanya oleh klien aktif. Pada booking kelompok, hanya klien pembuat booking yang dapat memberi feedback.
  * Satu feedback per klien per sesi (constraint `feedback_one_per_client_session`).
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
  * Sebelum agregasi, backend menjalankan penanda otomatis (booking kedaluwarsa, sesi ditutup otomatis, sesi terlewat), paling sering sekali per menit per instance.
  * Total laporan mencakup `completed_sessions` (termasuk yang ditutup otomatis), `cancelled_sessions`, `missed_sessions`, dan `expired_bookings`.
  * Audit trail tidak menyalin isi konseling, jawaban intake, atau token ke metadata.

===

## 13. Periode Akademik & Konten Publik

* **<Deskripsi>:** Mengatur periode akademik yang membatasi jadwal konseling, konten motivasi pada hero halaman utama, dan logo Lasallian DNA di beranda.
* **<Hak / Akses Role>:**
  * `admin`: CRUD `/admin/periods` dan `/admin/hero-motivations`; baca dan ganti `/admin/homepage-logo` (tanpa hapus).
  * Publik: `GET /public/periods`, `GET /public/hero-motivations`, `GET /public/homepage-logo`, `GET /public/counselors`, `GET /public/availability`.
* **<Alur Kerja>:**
  1. Admin membuat periode akademik, lalu mengaktifkan atau menonaktifkannya (`is_active`).
  2. Konselor mengaitkan slot ke periode. Booking hanya dapat dibuat pada periode yang valid.
  3. Admin mengelola daftar motivasi hero. Motivasi yang aktif tampil di beranda.
  4. Admin mengganti logo Lasallian DNA di Pengaturan Admin (panel "Logo Lasallian DNA"): memilih file, melihat pratinjau di samping logo kampus, mengisi keterangan, lalu menyimpan. Beranda menampilkan logo itu di tempat logo HIMPSI sebelumnya.
* **<Aturan & Batasan>:**
  * Periode baru default nonaktif. Motivasi hero baru default aktif.
  * Slot di luar periode aktif tidak dapat dipesan (`BOOKING_PERIOD_UNAVAILABLE`).
  * Logo Lasallian DNA (migrasi `20261115150000`): hanya satu logo aktif (tabel `homepage_logo`, id = 1); admin hanya dapat mengganti, tidak dapat menghapus; logo lama tidak disimpan (file lama dihapus dari bucket `site-assets` setelah logo baru tersimpan); hanya PNG atau WebP maksimal 1 MB, diverifikasi juga dari isi file; keterangan (teks alternatif) wajib 1–120 karakter. Keterangan dapat diubah tanpa mengganti gambar.
  * Di beranda tinggi logo sama dengan logo kampus (`h-16`, `md:h-20`; diperbesar 2026-11-15) dan lebarnya mengikuti proporsi gambar (maksimal 260px). Selama admin belum mengunggah logo, atau logo gagal dimuat, beranda menampilkan logo HIMPSI bawaan.

===

## Catatan

* Frontend masih memiliki `fe/src/features/notification/notificationStore.ts` berisi data demo/mock. Notifikasi produksi memakai `NotificationBell` yang terhubung ke API.
* Rincian kontrak endpoint ada di `docs/integration/API_ENDPOINT_MATRIX.md`. Gap SOP ada di `docs/integration/SOP_COVERAGE_MATRIX.md`.
