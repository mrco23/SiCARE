# SiCARE Development Roadmap

**Cakupan:** integrasi frontend-backend, verifikasi logika bisnis/SOP, dan stabilisasi teknis.
**Sumber status:** [`PROJECT_STATUS.md`](PROJECT_STATUS.md). Rincian task mingguan dan target tanggal ada di [`IMPLEMENTATION_TIMELINE.md`](IMPLEMENTATION_TIMELINE.md). Dokumen ini adalah peta tahap; status aktual dan bukti uji tidak dicatat di sini secara duplikatif.

## Prioritas tenggat terdekat

Batas kesiapan team testing adalah Minggu malam, 1 November 2026. Gunakan [`WEEKEND_READINESS_PLAN.md`](WEEKEND_READINESS_PLAN.md) untuk scope P0, jadwal Jumat–Minggu, skenario testing, dan kriteria kesiapan. Roadmap tahap penuh di bawah tetap dilanjutkan setelah team testing.

## Prinsip urutan kerja

- Selesaikan satu tahap/batch dalam satu waktu. Jangan otomatis meneruskan ke tahap berikutnya.
- Pertahankan UI, route, dan perilaku yang sudah ada kecuali perubahan disetujui atau diperlukan oleh kontrak backend yang telah disepakati.
- Jangan membuat skema, field, transisi status, atau prosedur klinis berdasarkan asumsi. Konfirmasi dengan pemilik SOP jika aturan belum tersedia.
- Jangan menjalankan migrasi atau mutasi pada Supabase remote tanpa verifikasi target dan persetujuan eksplisit.
- Setiap batch harus memperbarui `PROJECT_STATUS.md`, matriks relevan, dan dokumentasi domain bila ada perubahan kontrak.

## Tahapan

| Tahap | Fokus | Deliverable / kriteria selesai | Dependensi | Status rencana |
|---|---|---|---|---|
| 0 | Audit statis integrasi API dan cakupan SOP | Matriks 58 handler, pemetaan pemanggil frontend, inventaris gap SOP, dan catatan baseline. | Snapshot `SiCARE(8).zip` | Selesai untuk audit statis; verifikasi runtime dicatat pada P0. |
| 0.2 | Konsolidasi dokumentasi proyek | `AGENTS.md` menjadi instruksi tetap; `docs/README.md`, `ROADMAP.md`, dan `PROJECT_STATUS.md` dibuat; tautan dan keterangan dokumen historis diselaraskan; README root dan daftar migrasi dikoreksi. | Tahap 0 | Selesai setelah pemeriksaan tautan lokal. |
| P0 | Pemulihan baseline teknis dan verifikasi Hero/live API | Instalasi dependency; backend check/test dan frontend build/lint lulus; migration history cocok; metadata tabel Hero, constraints, trigger, RLS, dan grants terverifikasi; live API smoke test dan pemeriksaan role selesai. | Tahap 0.2 | Selesai: baseline lulus, metadata Hero diverifikasi, 57/57 pemeriksaan live API lulus termasuk empat role; 0 gagal dan 0 role dilewati. |
| 1 | Validasi database, autentikasi, otorisasi, dan kontrak data | Skema dan migrasi sesuai; login/role diuji; DTO dan ID kanonis dipastikan; aturan error/loading dan ownership jelas. | P0 | Berjalan: Batch 1.1 dan 1.2 selesai dengan build/lint PASS; Batch 1.3 audit statis selesai, menunggu live cross-user test. |
| 2 | Data master dan jadwal | CRUD periode, akun, profil konselor, publikasi profil, dan jadwal memakai API; data publik mengikuti perubahan backend setelah refresh. | Tahap 1 | Direncanakan |
| 3 | Booking dan siklus hidup sesi | Alur Klien → Konselor → sesi → Klien menggunakan record dan status backend yang sama; validasi konflik, ownership, alasan, dan transisi diuji. | Tahap 2 | Direncanakan |
| 4 | Feedback, moderasi, review, dan notifikasi | Feedback klien, moderasi Admin, review Kepala LMI, tampilan publik, serta notifikasi diuji lintas-role. | Tahap 1 dan siklus sesi | Direncanakan |
| 5 | Profil, dashboard, laporan, dan aktivitas admin | Profil memakai endpoint yang didukung; metrik punya definisi; dashboard, laporan, dan aktivitas mencerminkan data backend. | Tahap 1; sebagian dapat berjalan setelah Tahap 2–4 | Direncanakan |
| 6 | Gap SOP sensitif dan pengujian akhir | Intake, informed consent, tanda tangan, catatan konseling, mood tracker, retensi, audit, dan akses ditentukan dari SOP resmi; E2E lintas-role, keamanan, dan regresi diuji. | Keputusan pemilik SOP dan tahap integrasi terkait | Direncanakan |

## Ringkasan penyelesaian P0

1. Dependency, backend check, 41/41 backend tests, frontend build, dan frontend lint telah lulus pada mesin pengguna. Build memiliki peringatan non-blocking tentang bundle utama sekitar 1,30 MB sebelum gzip; frontend npm audit melaporkan 4 temuan low severity.
2. `npx supabase migration list` menunjukkan lima ID migrasi lokal dan remote cocok.
3. Metadata remote `public.hero_motivations` telah diperiksa: lima kolom sesuai; constraints panjang dan single-line ada; trigger timestamp dan fungsi `set_updated_at()` ada; RLS aktif tanpa policy; grants langsung yang terlihat hanya `postgres` dan `service_role`.
4. Smoke test dasar lulus: 15 pemeriksaan, 0 gagal; endpoint publik mengembalikan 200 dan endpoint terlindungi tanpa token mengembalikan 401.
5. Matriks role lulus setelah script memverifikasi `profile.app_role` untuk empat akun uji. Hasil akhir `npm run verify:live`: 57 lulus, 0 gagal, 0 role dilewati.
6. Tidak ada record bisnis yang dibuat atau diubah oleh pemeriksaan. Tidak perlu menjalankan `db push` untuk Hero karena migration history dan metadata tabel telah cocok.

## Tahap 1: batch aktif

- **Batch 1.1, audit kontrak statis:** selesai. Temuan dan penyelesaiannya tercatat di [`integration/API_CONTRACT_AUDIT.md`](integration/API_CONTRACT_AUDIT.md).
- **Batch 1.2, DTO kanonis dan wrapper API:** selesai dan divalidasi pengguna. DTO publik/booking/sesi/feedback dikonsolidasikan; wrapper publik, klien, konselor, admin, dan reporting disediakan. `npm run build` dan `npm run lint` lulus setelah koreksi beranda klien. Finalisasi Hero: wrapper Admin dan publik diverifikasi; focused regression test lulus 5/5 setelah assertion diselaraskan dengan wrapper. Full suite setelah koreksi masih menunggu.
- **Batch 1.3, ID dan ownership:** audit statis selesai; UUID backend ditetapkan sebagai ID kanonis dan 9 regression test source-level ditambahkan. Pengujian runtime lintas-pengguna dengan dua client dan dua counselor masih terbuka. Lihat `integration/ID_OWNERSHIP_AUDIT.md`.
- **Batch 1.4, integrasi per-role FE-BE:** selesai (Batch 1.4a audit, 1.4b Client, 1.4c Counselor, 1.4d Admin, 1.4e Kepala LMI; 25/25 halaman terhubung 100%).
- **Batch 1.5a & 1.5a.1, integrasi WhatsApp Fonnte & reliability hardening:** selesai (transactional outbox atomik di level RPC, worker, scheduler, webhook tracking, 96/96 tests PASS).
- **Batch 1.5b & 1.5b.1, Informed Consent Database Foundation & Security Hardening:** selesai (skema database resmi LMI Unika De La Salle Manado, template versioning, identitas peserta akun/tamu, undangan aman, audit log append-only, storage privat, isolasi privasi data anggota kelompok, proteksi imutabilitas signed consent via trigger, klaim atomik undangan, storage object policies PNG/JPEG, 124/124 tests PASS).
- **Batch 1.5c, Digital Signature & PDF Generation:** selesai (signature pad interaktif high-DPI, validasi biner tanda tangan PNG via magic bytes `89 50 4E 47`, overlay PDF resmi A4 1 halaman via `pdf-lib`, upload privat ke storage buckets, presigned download URL berumur pendek, trigger imutabilitas bukti bertandatangan, dan modal UI di halaman aktivitas klien, 136/136 backend tests PASS, frontend lint & build PASS).
- **Batch 1.5d, Group Consent Workflow & WhatsApp Integration:** selesai dan tervalidasi (pendaftaran peserta kelompok dengan nomor WhatsApp E.164, token undangan dengan enkripsi AES-256-GCM pada tabel secrets tanpa raw token di outbox, pengiriman via Fonnte worker, portal tamu mandiri stateless HMAC-SHA256 `/consent/invite`, scrubbing token URL instan, isolasi privasi data anggota kelompok, pembersihan kaskade saat pembatalan, dan penegakan blokir transisi sesi `scheduled -> ongoing` di fungsi database PostgreSQL `sicare_transition_session`, 147/147 backend tests PASS, frontend lint & build PASS).
- **Batch 1.5d.1, Security & Operational Closure:** selesai dan tervalidasi (kunci enkripsi terdedikasi `CONSENT_ENCRYPTION_KEY` 32-byte fail-closed di production tanpa fallback implisit ke kredensial lain, versioning & rotasi kunci `reencryptInvitationToken`, token kapabilitas tamu stateless HMAC-SHA256 dengan klaim lengkap dan validasi state database real-time `validateGuestCapabilityState`, penautan akun terotentikasi dengan verifikasi nomor telepon anti-spoofing `ACCOUNT_PHONE_MISMATCH`, scheduler pengingat consent 24h/72h idempoten `scanPendingConsentsAndEnqueueReminders`, gerbang eligibilitas akhir worker Fonnte membatalkan pengiriman usang jika consent telah ditandatangani atau booking dibatalkan, proteksi referer `no-referrer`, in-memory guest capability token, 166/166 backend tests PASS, frontend lint & build PASS).
- **Batch 1.5e, Final Integration & Comprehensive System Testing:** selesai dan tervalidasi (audit integrasi end-to-end 4 role pengguna & tamu, pembuatan akun konselor oleh admin dengan rollback otomatis, pembatasan akses PDF klinis untuk penandatangan & konselor yang ditugaskan; menolak Kepala LMI dan konselor lain, pemulihan sesi tamu Scenario A refresh & Scenario B reopen, penegakan blokir sesi `scheduled -> ongoing` di database dengan error `CONSENT_READINESS_INCOMPLETE`, notifikasi dalam situs, integrasi WhatsApp Fonnte dengan mock provider, 184/184 backend tests PASS, frontend lint & build PASS).
- **Batch 1.5f, Repository Documentation & AI Context Separation:** selesai dan tervalidasi (pemisahan dokumentasi resmi `docs/` dari memori kerja AI `.ai-context/`, eksklusi lokal Git tanpa memodifikasi `.gitignore` bersama).
- **Batch 1.5g, Controlled User Acceptance Testing (UAT):** selesai dan instrumen siap (audit kesiapan lingkungan, rencana induk pengujian, 45 kasus uji terstandarisasi untuk 10 skenario A–J, lembar eksekusi, registri cacat P0–P3, kuesioner umpan balik pengguna, berita acara sign-off, dan laporan akhir UAT dengan rekomendasi ACCEPTED FOR STAGING).
- **Team Testing Readiness (Minggu 1 November 2026):** pelaksanaan skenario pengujian tim pada lingkungan staging sesuai [`WEEKEND_READINESS_PLAN.md`](WEEKEND_READINESS_PLAN.md) dan instrumen [`docs/uat/`](uat/).
- **Tahap 2, Data Master dan Jadwal:** direncanakan sebagai tahap berikutnya setelah evaluasi dan penutupan UAT tim.

## Kriteria umum penyelesaian setiap batch

- Scope dan file yang diizinkan jelas sebelum perubahan.
- Tidak ada perubahan tidak diminta pada route, UI, konfigurasi, atau perilaku.
- Kontrak API dan matriks SOP diperbarui jika implementasi berubah.
- Build, lint, test, dan smoke test diberi status faktual: `PASS`, `FAIL`, `BLOCKED`, atau `NOT RUN`.
- Perubahan diperiksa melalui diff; tidak ada secret, `.env`, dependency directory, atau artefak sementara di paket hasil.
- `PROJECT_STATUS.md` mencatat file yang berubah, hasil uji, risiko, dan satu langkah berikutnya yang disarankan.


## Target waktu pelaksanaan

Jadwal mingguan, rincian task, deliverable, milestone, dan kriteria penerimaan tercantum di [`IMPLEMENTATION_TIMELINE.md`](IMPLEMENTATION_TIMELINE.md). Target awal berlangsung 2 November sampai 30 Desember 2026 dan dapat direvisi jika dependency teknis atau persetujuan SOP mengubah estimasi.
