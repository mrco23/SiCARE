# SiCARE API Endpoint Integration Matrix

**Snapshot audit:** `SiCARE(8).zip`, 29 Oktober 2026 (diperbarui pada Batch 1.4e, 31 Oktober 2026 — lihat [`../audits/STAGE_1_4A_FRONTEND_BACKEND_INTEGRATION_AUDIT.md`](../audits/STAGE_1_4A_FRONTEND_BACKEND_INTEGRATION_AUDIT.md) untuk matriks lengkap rantai pemanggilan, ketidaksesuaian kontrak UI vs API, serta rencana Batch 1.4b–1.4f).

Matriks ini dibuat dari deklarasi route di `be/src/routes/*.js`, mount path di `be/app.js`, serta pemanggilan API yang ditemukan di `fe/src`. Total ada **60 deklarasi handler endpoint** (termasuk 2 endpoint infrastruktur WhatsApp Batch 1.5a: webhook Fonnte dan health monitoring outbox). Ditemukan pemanggil frontend untuk **56 bentuk method/path** setelah Batch 1.4e (**93,33%** keseluruhan, atau **96,55%** dari 58 endpoint domain UI); angka ini bukan ukuran keberhasilan runtime penuh lintas seluruh role. Endpoint yang ditandai terhubung tetap memerlukan tes integrasi dan otorisasi.

**Verifikasi runtime:** pada 29 Oktober 2026, `npm run verify:live` lulus 57/57 pemeriksaan untuk endpoint yang dicakup skrip, termasuk autentikasi dan otorisasi empat role. Status pemanggil frontend di matriks ini tetap berdasarkan audit statis, bukan diubah menjadi terhubung hanya karena endpoint live lulus.

**Status:** `Terhubung` = halaman UI memakai wrapper; `Terhubung sebagian` = ada pemanggilan UI, tetapi alur/role/field belum lengkap; `Wrapper ada, UI belum` = fungsi typed tersedia tetapi halaman belum menggunakannya; `Belum` = belum ada wrapper maupun pemanggil UI yang ditemukan; `Ops saja` = dipakai skrip operasional.

## Ringkasan per kelompok

| Kelompok | Handler | Dipanggil frontend | Catatan utama |
|---|---:|---:|---|
| Admin dan Hero | 16 | 16 | Seluruh 16 endpoint Admin (akun, publikasi konselor, periode akademik, monitoring konseling, log aktivitas, dan CRUD Hero) telah terhubung pada Batch 1.4d. |
| Autentikasi | 4 | 4 | Register, login, pemulihan profil, dan logout. |
| Booking | 5 | 4 | Daftar booking, buat booking, reschedule klien, serta transisi status klien & konselor (`confirmed`, `rejected`, `reschedule_requested`, `cancelled`) terhubung; hanya `GET /bookings/:id` yang belum dipanggil langsung. |
| Konselor | 6 | 6 | Profil konselor (`GET`/`PATCH`) dan slot ketersediaan (`GET`/`POST`/`PATCH`/`DELETE`) terhubung pada `KonselorPengaturanPage`, `KonselorBerandaPage`, `KonselorFeedbackPage`, dan `KonselorJadwalPage`. |
| Domain publik dan profil | 8 | 8 | Lima endpoint publik dan tiga endpoint profil/WhatsApp consent (`KlienPengaturanPage`, `KonselorBerandaPage`, `KonselorPengaturanPage`, `AdminPengaturanPage`, `KepalaLMIPengaturanPage`) sudah dipakai. |
| Feedback | 8 | 8 | Pengiriman dan baca feedback klien, baca feedback konselor, serta antrean/detail/statistik/moderasi Admin dan peninjauan Kepala LMI (`PATCH /admin/feedback/:id/review` di `KepalaLMIFeedbackPage`) seluruhnya terhubung (100%). |
| Health | 1 | 0 | Dipakai skrip operasional, bukan frontend. |
| Notifikasi | 3 | 3 | Daftar, tandai satu, tandai semua dibaca. |
| Reporting | 4 | 4 | Dashboard dan laporan Admin (`AdminBerandaPage`, `AdminLaporanPage`) serta dashboard dan laporan Kepala LMI (`KepalaLMIBerandaPage`, `KepalaLMILaporanPage`) seluruhnya terhubung (100%). |
| Sesi | 3 | 3 | Daftar sesi, detail sesi (`GET /sessions/:id`), dan transisi status sesi (`PATCH /sessions/:id/status`) terhubung pada halaman klien dan konselor. |
| Informed Consent | 13 | 13 | Rute Informed Consent individual dan kelompok (`/booking/:bookingId/my-consent`, `/booking/:bookingId/readiness`, `/:id`, `PATCH /:id/identity`, `POST /:id/sign`, `GET /:id/document`, `/booking/:bookingId/group-summary`, `/booking/:bookingId/participants/:participantId/resend-invitation`, `/invitations/claim`, `/guest/me`, `/guest/me/identity`, `/guest/me/sign`, `/guest/me/document`) terhubung di `KlienAktivitasPage`, `KonselorAktivitasPage`, `GroupConsentModal`, dan `GuestConsentPage`. |
| **Total** | **73** | **69** | Enam puluh sembilan handler UI terhubung penuh; 2 endpoint infrastruktur (webhook & admin whatsapp health), 1 operasional (`/health`), dan 1 handler UI (`GET /bookings/:id`). |

| # | Method | Endpoint | Role backend | Halaman/pemanggil frontend | Status | Catatan audit |
|---:|---|---|---|---|---|---|
| 1 | `GET` | `/api/v1/admin/accounts` | admin | AdminAkunPage, AdminFeedbackPage, AdminKonselingPage, AdminBerandaPage, AdminLaporanPage | **Terhubung** | Daftar akun (dengan filter `role`, `status`, `search`, `limit`) dan lookup nama konselor. |
| 2 | `GET` | `/api/v1/admin/accounts/:id` | admin | AdminAkunPage | **Terhubung** | Detail akun saat membuka modal edit akun di `AdminAkunPage`. |
| 3 | `POST` | `/api/v1/admin/accounts` | admin | AdminAkunPage | **Terhubung** | Pembuatan akun melalui Supabase Auth Admin di server (`email`, `password`, `full_name`, `app_role`, `member_category`, `status`). |
| 4 | `PATCH` | `/api/v1/admin/accounts/:id` | admin | AdminAkunPage | **Terhubung** | Perubahan `full_name`, `phone_e164`, `app_role`, `member_category`, dan `status` akun. |
| 5 | `DELETE` | `/api/v1/admin/accounts/:id` | admin | AdminAkunPage | **Terhubung** | Soft-disable akun (`status = 'disabled'`) dengan proteksi tidak menonaktifkan akun sendiri. |
| 6 | `PATCH` | `/api/v1/admin/counselors/:id/publication` | admin | AdminAkunPage | **Terhubung** | Kontrol publikasi profil konselor (`is_public: boolean`) dari tabel akun Admin. |
| 7 | `GET` | `/api/v1/admin/periods` | admin | AdminPeriodePage, AdminFeedbackPage, AdminKonselingPage, AdminBerandaPage, AdminLaporanPage | **Terhubung** | Daftar seluruh periode akademik (termasuk yang belum dipublikasikan) untuk pengelolaan dan filter Admin. |
| 8 | `POST` | `/api/v1/admin/periods` | admin | AdminPeriodePage | **Terhubung** | Pembuatan periode akademik (`academic_year`, `semester`, `starts_on`, `ends_on`, `is_published`). |
| 9 | `PATCH` | `/api/v1/admin/periods/:id` | admin | AdminPeriodePage | **Terhubung** | Perubahan periode akademik dan toggle status publikasi (`is_published`). |
| 10 | `DELETE` | `/api/v1/admin/periods/:id` | admin | AdminPeriodePage | **Terhubung** | Penghapusan periode akademik; menangani error `409 PERIOD_HAS_SLOTS` bila masih direferensikan jadwal. |
| 11 | `GET` | `/api/v1/admin/counseling` | admin, head_lmi | AdminKonselingPage, AdminBerandaPage, AdminLaporanPage | **Terhubung** | Monitoring konseling read-only dan agregasi laporan Admin dengan identitas klien teranonimkan. |
| 12 | `GET` | `/api/v1/admin/activity` | admin | AdminAktivitasPage | **Terhubung** | Log aktivitas sistem gabungan (`booking`, `session`, `feedback`) diurutkan berdasarkan `updated_at` terbaru. |
| 13 | `GET` | `/api/v1/admin/hero-motivations` | admin | AdminPengaturanPage | **Terhubung** | Daftar kalimat motivasi; migration history remote cocok dan metadata tabel/constraints/trigger/RLS/grants sudah diverifikasi. Live API verification akhir lulus 57/57 pemeriksaan termasuk empat role; lihat `../backend/VERIFIKASI_LIVE_SUPABASE.md`. |
| 14 | `POST` | `/api/v1/admin/hero-motivations` | admin | AdminPengaturanPage | **Terhubung** | Tambah kalimat motivasi. |
| 15 | `PATCH` | `/api/v1/admin/hero-motivations/:id` | admin | AdminPengaturanPage | **Terhubung** | Ubah konten atau status aktif kalimat motivasi. |
| 16 | `DELETE` | `/api/v1/admin/hero-motivations/:id` | admin | AdminPengaturanPage | **Terhubung** | Hapus kalimat motivasi. |
| 17 | `POST` | `/api/v1/auth/register` | public | Register.tsx | **Terhubung** | Pendaftaran melalui backend; role tidak boleh dipilih bebas oleh klien. |
| 18 | `POST` | `/api/v1/auth/login` | public | Login.tsx melalui AuthProvider | **Terhubung** | Login diverifikasi backend lalu sesi disimpan melalui Supabase Auth. |
| 19 | `GET` | `/api/v1/auth/me` | authenticated | AuthProvider | **Terhubung** | Memuat profil server saat sesi dipulihkan atau diperbarui. |
| 20 | `POST` | `/api/v1/auth/logout` | authenticated | AuthProvider | **Terhubung** | Backend logout dicoba; sesi lokal tetap dihapus bila API gagal. |
| 21 | `GET` | `/api/v1/bookings` | client, counselor | KlienBerandaPage, KlienAktivitasPage, KonselorPermintaanPage, KonselorBerandaPage, KonselorAktivitasPage, KonselorJadwalPage, KonselorRiwayatPage | **Terhubung** | Dipakai oleh halaman klien dan konselor untuk daftar/konteks booking. |
| 22 | `POST` | `/api/v1/bookings` | client | KlienPesananPage | **Terhubung sebagian** | Booking tersimpan, tetapi jawaban intake tidak ikut dikirim/disimpan. |
| 23 | `PATCH` | `/api/v1/bookings/:id/reschedule` | client | KlienAktivitasPage | **Terhubung** | Klien mengusulkan slot pengganti setelah status reschedule_requested. |
| 24 | `GET` | `/api/v1/bookings/:id` | client, counselor | Belum ada halaman | **Wrapper ada, UI belum** | Endpoint detail booking belum dipakai langsung karena proyeksi list & detail identik. |
| 25 | `PATCH` | `/api/v1/bookings/:id/status` | client, counselor | KlienAktivitasPage, KonselorPermintaanPage, KonselorBerandaPage (`BookingDecisionModal`) | **Terhubung** | Klien mengirim `cancelled`; konselor mengirim `confirmed` (`session_format` + `room`), `rejected` (`reason`), dan `reschedule_requested` (`reason`). |
| 26 | `GET` | `/api/v1/counselor/profile` | counselor | KonselorPengaturanPage, KonselorBerandaPage, KonselorFeedbackPage | **Terhubung** | Membaca profil direktori konselor (`public_name`, `headline`, `bio`, `specialties`, `years_experience`, `is_public`); menangani `404` bila belum disiapkan admin. |
| 27 | `PATCH` | `/api/v1/counselor/profile` | counselor | KonselorPengaturanPage | **Terhubung** | Menyimpan perubahan profil direktori konselor ke database. |
| 28 | `GET` | `/api/v1/counselor/availability` | counselor | KonselorJadwalPage | **Terhubung** | Membaca slot ketersediaan konselor pada kalender mingguan dan bulanan. |
| 29 | `POST` | `/api/v1/counselor/availability` | counselor | KonselorJadwalPage | **Terhubung** | Membuat slot ketersediaan 1 jam (`starts_at`, `ends_at`, `academic_period_id`). |
| 30 | `PATCH` | `/api/v1/counselor/availability/:id` | counselor | KonselorJadwalPage | **Terhubung** | Mengubah waktu/tanggal slot ketersediaan yang belum dipesan (modal & drag-and-drop). |
| 31 | `DELETE` | `/api/v1/counselor/availability/:id` | counselor | KonselorJadwalPage | **Terhubung** | Membatalkan slot ketersediaan (`status = 'cancelled'`) yang belum terhubung ke booking aktif. |
| 32 | `GET` | `/api/v1/public/hero-motivations` | public | HomePage | **Terhubung** | Home memilih kalimat aktif secara acak; migration history dan metadata tabel Hero di Supabase sudah cocok. Respons endpoint live belum diuji. |
| 33 | `GET` | `/api/v1/public/counselors` | public | HomePage, CounselorPage, KlienBerandaPage, KlienKonselorPage, KlienPesananPage, KlienAktivitasPage, KlienRiwayatPage, AdminAkunPage, AdminFeedbackPage, AdminKonselingPage, AdminBerandaPage, AdminLaporanPage, KepalaLMIFeedbackPage | **Terhubung** | Data profil publik diambil dari backend pada halaman publik, klien, admin, dan Kepala LMI. |
| 34 | `GET` | `/api/v1/public/periods` | public | HomePage, CounselorPage, KonselorJadwalPage, KonselorRiwayatPage, KonselorFeedbackPage | **Terhubung** | Halaman publik dan konselor membaca periode akademik yang dipublikasikan. |
| 35 | `GET` | `/api/v1/public/availability` | public | CounselorPage, KlienKonselorPage, KlienPesananPage, KlienAktivitasPage | **Terhubung** | Jadwal publik dibaca API; `slotsForCounselor` pada kalender booking klien kini membaca `availabilityByDate`. |
| 36 | `GET` | `/api/v1/public/feedback` | public | HomePage, FeedbackPage | **Terhubung** | Backend membatasi feedback yang ditampilkan ke status shown dan konselor aktif/publik. |
| 37 | `GET` | `/api/v1/profile` | authenticated | KlienPengaturanPage, KonselorBerandaPage, KonselorPengaturanPage, AdminPengaturanPage, KepalaLMIPengaturanPage | **Terhubung** | Dipakai oleh seluruh halaman profil pengaturan role (Client, Counselor, Admin, Kepala LMI). |
| 38 | `PATCH` | `/api/v1/profile` | authenticated | KlienPengaturanPage, KonselorPengaturanPage, AdminPengaturanPage, KepalaLMIPengaturanPage | **Terhubung** | Pembaruan profil `full_name` dan `phone_e164` terhubung pada seluruh role pengguna. |
| 39 | `PATCH` | `/api/v1/profile/whatsapp-consent` | authenticated | KlienPengaturanPage | **Terhubung** | Dipakai oleh `KlienPengaturanPage` (`opted_in: boolean`). Worker WhatsApp (`whatsapp.worker.js`) menegakkan opt-in ini secara langsung sebelum pengiriman. |
| 40 | `POST` | `/api/v1/sessions/:sessionId/feedback` | client | KlienRiwayatPage | **Terhubung sebagian** | Klien dapat mengirim feedback; intake/consent bukan bagian dari endpoint ini. |
| 41 | `GET` | `/api/v1/feedback/counselor` | counselor | KonselorFeedbackPage, KonselorBerandaPage | **Terhubung** | Menampilkan daftar ulasan dan distribusi bintang terverifikasi untuk konselor (`moderation_status = 'shown'`). |
| 42 | `GET` | `/api/v1/feedback/mine` | client | KlienBerandaPage, KlienRiwayatPage | **Terhubung** | Riwayat feedback klien dibaca dari backend. |
| 43 | `GET` | `/api/v1/admin/feedback/statistics` | admin, head_lmi | AdminFeedbackPage, KepalaLMIFeedbackPage | **Terhubung** | Statistik moderasi (`pending`, `shown`, `disabled`), peninjauan (`new`, `reviewed`, `resolved`), dan rata-rata rating dipakai di `AdminFeedbackPage` dan `KepalaLMIFeedbackPage`. |
| 44 | `GET` | `/api/v1/admin/feedback/:id` | admin, head_lmi | AdminFeedbackPage, KepalaLMIFeedbackPage | **Terhubung** | Detail feedback diambil dari API saat membuka modal tinjauan/moderasi. |
| 45 | `GET` | `/api/v1/admin/feedback` | admin, head_lmi | AdminFeedbackPage, AdminKonselingPage, AdminLaporanPage, KepalaLMIFeedbackPage | **Terhubung** | Daftar feedback dibaca dari API dengan filter `moderation_status`, `review_status`, dan `limit`. |
| 46 | `PATCH` | `/api/v1/admin/feedback/:id/moderation` | admin | AdminFeedbackPage | **Terhubung** | Moderasi `pending`/`shown`/`disabled` khusus role `admin` (wajib menyertakan `disabled_reason` saat `disabled`). |
| 47 | `PATCH` | `/api/v1/admin/feedback/:id/review` | head_lmi | KepalaLMIFeedbackPage | **Terhubung** | Review `new`/`reviewed`/`resolved` khusus role `head_lmi` dipakai di modal tinjauan `KepalaLMIFeedbackPage`. |
| 48 | `GET` | `/api/v1/health` | public/ops | be/scripts/verify-live-api.js | **Ops saja** | Dipakai untuk smoke test backend, bukan kebutuhan halaman UI. |
| 49 | `GET` | `/api/v1/notifications` | authenticated | NotificationBell | **Terhubung** | Notifikasi dibatasi berdasarkan recipient_user_id. |
| 50 | `PATCH` | `/api/v1/notifications/read-all` | authenticated | NotificationBell | **Terhubung** | Menandai seluruh notifikasi milik pengguna sebagai dibaca. |
| 51 | `PATCH` | `/api/v1/notifications/:id/read` | authenticated | NotificationBell | **Terhubung** | Menandai notifikasi milik pengguna sebagai dibaca. |
| 52 | `GET` | `/api/v1/admin/dashboard` | admin | AdminBerandaPage | **Terhubung** | Kartu ringkasan statistik akun, booking, sesi selesai, dan moderasi feedback di beranda Admin. |
| 53 | `GET` | `/api/v1/head-lmi/dashboard` | head_lmi | KepalaLMIBerandaPage | **Terhubung** | Dashboard ringkasan statistik pimpinan LMI di `KepalaLMIBerandaPage`. |
| 54 | `GET` | `/api/v1/admin/reports` | admin | AdminLaporanPage, AdminBerandaPage | **Terhubung** | Laporan bulanan dan beban kerja per konselor (`totals`, `monthly`, `counselors`, `truncated`) dipakai di `AdminLaporanPage` dan `AdminBerandaPage`. |
| 55 | `GET` | `/api/v1/head-lmi/reports` | head_lmi | KepalaLMIBerandaPage, KepalaLMILaporanPage | **Terhubung** | Laporan eksekutif 12 bulan terakhir (`totals`, `monthly`, `counselors`, `truncated`) dipakai di `KepalaLMIBerandaPage` dan `KepalaLMILaporanPage`. |
| 56 | `GET` | `/api/v1/sessions` | client, counselor | KlienBerandaPage, KlienRiwayatPage, KonselorBerandaPage, KonselorAktivitasPage, KonselorJadwalPage, KonselorRiwayatPage | **Terhubung** | Dipakai oleh halaman klien dan konselor untuk membaca daftar sesi konseling. |
| 57 | `GET` | `/api/v1/sessions/:id` | client, counselor | KonselorAktivitasPage | **Terhubung** | Dipakai saat membuka detail sesi pada `KonselorAktivitasPage`. |
| 58 | `PATCH` | `/api/v1/sessions/:id/status` | counselor | KonselorAktivitasPage, KonselorJadwalPage | **Terhubung** | Dipakai untuk memulai (`ongoing`), menyelesaikan (`completed`), dan membatalkan (`cancelled`) sesi konseling. |
| 59 | `POST` | `/api/v1/webhooks/fonnte/message-status` | webhook/ops | Fonnte Callback | **Terhubung (Backend Webhook)** | Webhook callback pembaruan status pesan WhatsApp dari Fonnte API (`delivered`, `failed`, `read`), dilindungi secret timing-safe. |
| 60 | `GET` | `/api/v1/admin/whatsapp/health` | admin | Internal Ops/Admin | **Terhubung (Backend Health)** | Endpoint observabilitas kesehatan outbox dan provider WhatsApp (metrik agregat status outbox, provider readiness, tanpa membocorkan token). |
| 61 | `GET` | `/api/v1/consents/booking/:bookingId/my-consent` | client, counselor | KlienAktivitasPage via InformedConsentModal | **Terhubung** | Mengambil atau menginisialisasi record consent peserta yang sedang login untuk booking tertentu. |
| 62 | `GET` | `/api/v1/consents/booking/:bookingId/readiness` | client, counselor, admin, head_lmi | KlienAktivitasPage via InformedConsentModal | **Terhubung** | Memeriksa kesiapan consent seluruh peserta dalam booking secara tersanitasi. |
| 63 | `GET` | `/api/v1/consents/:id` | client, counselor, admin, head_lmi | InformedConsentModal | **Terhubung** | Mengambil detail consent berdasarkan ID record (dibatasi otorisasi pemilik/konselor). |
| 64 | `PATCH` | `/api/v1/consents/:id/identity` | client | InformedConsentModal | **Terhubung** | Memperbarui data draft identitas peserta sebelum ditandatangani. Ditolak jika status sudah signed. |
| 65 | `POST` | `/api/v1/consents/:id/sign` | client | InformedConsentModal | **Terhubung** | Mengirimkan tanda tangan PNG, membangkitkan PDF resmi berbasis pdf-lib, mengunggah ke storage, dan membekukan status. |
| 66 | `GET` | `/api/v1/consents/:id/document` | client, counselor, admin, head_lmi | InformedConsentModal | **Terhubung** | Mengambil presigned URL berumur pendek (default 60s) untuk mengunduh dokumen PDF bertandatangan resmi. |
| 67 | `GET` | `/api/v1/consents/booking/:bookingId/group-summary` | client, counselor | GroupConsentModal | **Terhubung** | Ringkasan persetujuan kelompok (total, signed, pending, ready) dengan redaksi ketat data identitas pribadi. |
| 68 | `POST` | `/api/v1/consents/booking/:bookingId/participants/:participantId/resend-invitation` | client, counselor | GroupConsentModal | **Terhubung** | Mencabut undangan lama, membatalkan outbox usang, dan mengantrekan undangan WhatsApp baru. |
| 69 | `POST` | `/api/v1/consents/invitations/claim` | public/guest | GuestConsentPage | **Terhubung** | Klaim token undangan via hash SHA-256 dan penerbitan token kapabilitas tamu stateless HMAC-SHA256. |
| 70 | `GET` | `/api/v1/consents/guest/me` | guest | GuestConsentPage | **Terhubung** | Membaca data consent milik peserta tamu terotentikasi via header `X-Guest-Capability-Token`. |
| 71 | `PATCH` | `/api/v1/consents/guest/me/identity` | guest | GuestConsentPage | **Terhubung** | Memperbarui identitas draft peserta tamu sebelum penandatanganan. |
| 72 | `POST` | `/api/v1/consents/guest/me/sign` | guest | GuestConsentPage | **Terhubung** | Menandatangani consent peserta tamu secara mandiri dan membangkitkan PDF resmi individual. |
| 73 | `GET` | `/api/v1/consents/guest/me/document` | guest | GuestConsentPage | **Terhubung** | Mengambil presigned URL berumur pendek untuk mengunduh PDF bertandatangan resmi milik tamu. |

## Catatan lintas endpoint

1. Base path dipasang di `be/app.js` pada `/api/v1`. Frontend mengharapkan `VITE_API_BASE_URL` sudah menyertakan `/api/v1`.
2. Batch 1.2 menyatukan DTO publik di `fe/src/types/api.ts` dan menjadikan `fe/src/lib/publicApi.ts` sebagai satu-satunya wrapper publik untuk konselor, periode, availability, feedback, dan Hero publik. `sicareApi` tidak lagi menduplikasi wrapper availability/direktori publik.
3. CRUD Hero di `AdminPengaturanPage.tsx` kini memakai `adminApi`; wrapper typed domain juga tersedia pada `counselorApi.ts`, `adminApi.ts`, dan `reportingApi.ts`. Status `Wrapper ada, UI belum` menandai endpoint yang wrapper-nya sudah ada tetapi halaman terkait belum terintegrasi.
4. Adanya wrapper typed tidak berarti UI telah terhubung atau diuji. Status integrasi halaman hanya berubah ketika halaman benar-benar memakai wrapper dan alur terkait diuji.
5. `GET /api/v1/profile`, `PATCH /api/v1/profile`, dan `PATCH /api/v1/profile/whatsapp-consent` kini telah terintegrasi pada `KlienPengaturanPage.tsx` (Batch 1.4b). Kontrak patch hanya mendukung `full_name` dan `phone_e164`; tidak mencakup email, kata sandi, foto, atau field demografis kampus. Halaman pengaturan role lain (`KonselorPengaturanPage`, `AdminPengaturanPage`, `KepalaLMIPengaturanPage`) akan dihubungkan pada Batch 1.4c–1.4e.
6. `PATCH /api/v1/bookings/:id/status` sudah dipakai untuk pembatalan klien, dan wrapper sekarang menerima status transisi konselor; ini bukan bukti bahwa keputusan booking konselor telah terintegrasi ke halaman.
7. `GET /api/v1/sessions` digunakan halaman klien saja. Endpoint detail dan transisi status sesi belum dipakai UI.
8. API Hero sudah dipanggil frontend. `npx supabase migration list` menunjukkan `20261029100000` ada pada local dan remote; query read-only mengonfirmasi tabel, kolom, constraints, trigger, RLS, dan grants sesuai kontrak. Live API verification lulus 57/57 pemeriksaan, termasuk matriks empat role; lihat `../backend/VERIFIKASI_LIVE_SUPABASE.md`. Status pemanggil frontend pada matriks ini tetap berdasarkan audit statis, bukan diubah menjadi terhubung hanya karena endpoint live lulus.
9. Matriks endpoint frontend tetap merupakan audit statis. Status live API, migration history remote, metadata Hero, dan validitas role akun uji sudah diverifikasi pada P0. CORS production, seluruh operasi CRUD, ownership lintas-user, dan E2E browser belum diverifikasi.
