# SiCARE UAT Environment Readiness Audit

**Dokumen:** Audit Kesiapan Lingkungan User Acceptance Testing (UAT)
**Versi:** 1.1.0
**Tanggal Audit:** 31 Oktober 2026
**Status Kesiapan Menyeluruh:** READY FOR LOCAL / SIMULATED STAGING UAT (Dengan Komponen Hosting Staging & Akun Uji Memerlukan Tindakan Awal; Pengiriman WhatsApp Nyata Berstatus BLOCKED)

---

## 1. Tujuan Dokumen

Dokumen ini mendokumentasikan hasil audit kesiapan faktual dari infrastruktur, konfigurasi perangkat lunak, skema basis data, dan akun uji yang diperlukan untuk menyelenggarakan User Acceptance Testing (UAT) SiCARE secara terkendali dan aman, menjelang tenggat pengujian tim Minggu malam, 1 November 2026.

Audit ini secara tegas membedakan antara **ketersediaan file konfigurasi** dan **kesiapan operasional aktual** (*operational readiness*). Ketersediaan file konfigurasi (`.env`, `vite.config.ts`, dll) tidak dianggap sebagai bukti bahwa lingkungan staging telah aktif dan siap pakai.

---

## 2. Kebijakan Keamanan Lingkungan (Environment Safety Policies)

Pengujian penerimaan pengguna harus mematuhi prinsip tata kelola data klinis dan privasi institusional:

1. **Data Uji Sintetis Murni:** Seluruh data yang digunakan dalam UAT adalah data fiktif (nama sintetis, NIM simulasi, nomor telepon uji). Dilarang keras menggunakan data identitas mahasiswa nyata atau data rekam klinis bimbingan konseling riil.
2. **Kerahasiaan Kredensial & Bebas Token:** Rahasia server (`SUPABASE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `FONNTE_TOKEN`, `FONNTE_WEBHOOK_SECRET`, `CONSENT_ENCRYPTION_KEY`) dan password akun uji **tidak boleh dicantumkan dalam dokumentasi publik, commit repositori, log peramban, atau artefak pengujian**.
3. **Penyediaan Akun Aman (Out-of-Band Credentialing):** Password akun uji didistribusikan secara terpisah melalui kanal komunikasi internal yang aman kepada penguji yang ditunjuk.
4. **Isolasi Basis Data:** Dilarang menjalankan reset basis data (`db reset`) atau mutasi destruktif pada basis data Supabase bersama.
5. **Proteksi Pengiriman Pesan:** Parameter `WHATSAPP_SEND_ENABLED` harus tetap bernilai `false` (mode mock/dry-run) sampai ada persetujuan resmi dan pendaftaran nomor uji di `WHATSAPP_TEST_RECIPIENTS`.

---

## 3. Matriks Kesiapan Faktual 10 Komponen Lingkungan

Status kesiapan dikategorikan secara ketat menjadi tiga nilai:
- **READY:** Komponen telah terkonfigurasi, berjalan, dan terverifikasi secara faktual.
- **NOT READY:** Komponen belum tersedia atau belum di-deploy/didaftarkan; memerlukan tindakan prasyarat sebelum pengujian manusia dimulai.
- **BLOCKED:** Komponen tidak dapat dijalankan karena terhalang kebijakan keamanan atau ketergantungan izin eksternal.

| No | Komponen Lingkungan | Status Kesiapan | Bukti Faktual Aktual | Tindakan yang Diperlukan Sebelum UAT |
|---|---|:---:|---|---|
| 1 | **Local Development Environment** | **READY** | Node.js `v22.16.0`, npm `10.9.2`. Express backend port 3000, Vite frontend port 5173. `npm run check` 31 file PASS, `npm test` 184/184 PASS, `npm run lint` 0 errors/warnings, `npm run build` PASS. | Tidak ada; runtime lokal telah diverifikasi penuh. |
| 2 | **Dedicated Staging Frontend** | **NOT READY** | Build produksi `dist/` (PWA precache 6 entri, ukuran 1,34 MB) berhasil dibangun secara lokal. Namun **belum ada server hosting staging terdedikasi** (misalnya deployment cloud staging di Vercel/Netlify/server internal). | Jalankan `npm run preview` pada `fe/` (port 4173) untuk mensimulasikan bundle staging lokal, ATAU deploy `dist/` ke web host staging jika pengujian dilakukan lintas perangkat. |
| 3 | **Dedicated Staging Backend** | **NOT READY** | `be/.env` terkonfigurasi pada `HOST=127.0.0.1` dan `PORT=3000`. **Belum ada server backend staging terdedikasi di cloud/hosting publik**. | Jalankan backend lokal via `node server.js` (port 3000) pada komputer host pengujian, ATAU deploy backend Express ke server staging jika pengujian dilakukan melalui jaringan publik. |
| 4 | **Isolated Supabase Staging Project** | **READY** | `be/.env` dan `fe/.env.local` terhubung ke project ref Supabase yang sama (`https://tfzgztrvonkqsqmesmjy.supabase.co`). Seluruh tabel domain menerapkan RLS. | Pertahankan status database; jangan mengeksekusi DDL destruktif atau mutasi data tanpa otorisasi. |
| 5 | **Supabase Auth Test Accounts** | **NOT READY** | Spesifikasi 7 peran akun sintetis telah dirancang di dokumen UAT, namun **akun-akun tersebut belum terdaftar secara fisik di database Supabase Auth** project staging. | Daftarkan/buat 7 akun sintetis di Supabase Auth (via Supabase Studio Dashboard atau pendaftaran terarah) dengan password aman sebelum sesi testing dimulai. |
| 6 | **Supabase Storage Test Buckets** | **READY** | Migrasi `20261031150000` & `20261031170000` mendefinisikan bucket privat `informed-consent-templates`, `informed-consent-signatures`, `informed-consent-signed` dengan kebijakan RLS objek ketat. | Pastikan file master template PDF `informed-consent.pdf` telah terunggah pada bucket `informed-consent-templates`. |
| 7 | **Database Migrations** | **READY** | 8 berkas migrasi lokal sinkron dengan basis data remote: `20261027000000` s/d `20261031180000`. RPC kesiapan consent, outbox atomik, dan trigger imutabilitas aktif. | Tidak ada tindakan perubahan skema; pertahankan skema aktif. |
| 8 | **Website In-App Notification Service** | **READY** | Tabel `notifications`, RPC atomik, DTO, router `/api/v1/notifications`, dan UI `NotificationBell` teruji dan berfungsi. | Siap beroperasi secara otomatis saat mutasi siklus booking berlangsung. |
| 9 | **WhatsApp Fonnte Configuration** | **READY (Mock Pipeline) / BLOCKED (Live Delivery)** | Pipeline outbox atomik, scheduler, worker, dan webhook 100% lulus 44 tes unit/integrasi. Parameter `WHATSAPP_SEND_ENABLED=false` aktif di `be/.env`. Pengiriman nyata ke nomor eksternal diblokir sesuai kebijakan keselamatan. | Untuk pengujian live: peroleh izin tertulis pengguna, set `WHATSAPP_SEND_ENABLED=true`, dan daftarkan nomor uji di `WHATSAPP_TEST_RECIPIENTS`. Jika tidak, jalankan dalam mode Mock. |
| 10 | **Test Phone Numbers & Emails** | **READY (Spesifikasi Sintetis) / NOT READY (Whitelist WhastApp Uji)** | Alamat email `@sicare.test` dan nomor E.164 sintetis (`+6281200000001` s/d `+6281200000005`) telah dipetakan. Namun `WHATSAPP_TEST_RECIPIENTS` pada `be/.env` masih kosong. | Jika menggunakan mode mock: langsung gunakan nomor sintetis. Jika pengujian live diizinkan: masukkan nomor WhatsApp riil milik penguji ke `WHATSAPP_TEST_RECIPIENTS`. |

---

## 4. Matriks Spesifikasi Akun Uji Sintetis & Prosedur Penyediaan Aman

### 4.1 Prinsip Keamanan Kredensial
- Dilarang menuliskan password atau token login di dalam berkas markdown, commit git, atau dokumen repositori bersama.
- Akun uji didaftarkan melalui Supabase Auth Dashboard atau endpoint registrasi resmi menggunakan password sementara yang memenuhi kompleksitas (minimal 8 karakter, kombinasi huruf, angka, dan simbol).
- Kredensial login didistribusikan kepada masing-masing penguji melalui kanal komunikasi internal yang terenkripsi (*out-of-band*).

### 4.2 Matriks Akun yang Perlu Didaftarkan Sebelum UAT:

| No | Peran Sistem | Nama Tampilan | Email Uji | No. Telepon Uji (E.164) | Prosedur Penyediaan & Hak Akses | Status Registrasi |
|---|---|---|---|---|---|:---:|
| 1 | **Admin** | UAT Administrator | `uat.admin@sicare.test` | `+6281100000001` | Didaftarkan via Auth, update `profiles.app_role = 'admin'`. Akses: Akun, Periode, Aktivitas, Motivasi. Dilarang unduh PDF klinis. | `BELUM DIBUAT` |
| 2 | **Kepala LMI** | UAT Kepala LMI | `uat.kepala.lmi@sicare.test` | `+6281100000002` | Didaftarkan via Auth, update `profiles.app_role = 'head_lmi'`. Akses: Dasbor Eksekutif, Laporan, Tinjauan Feedback. Dilarang unduh PDF klinis. | `BELUM DIBUAT` |
| 3 | **Counselor** | UAT Konselor | `uat.counselor@sicare.test` | `+6281100000003` | Didaftarkan via Admin (`UAT-ADM-001`) atau Auth dengan inisialisasi `counselor_profiles`. Akses: Permintaan, Jadwal, Sesi, Unduh PDF pasien binaan. | `BELUM DIBUAT` |
| 4 | **Client A** | UAT Klien A | `uat.client.a@sicare.test` | `+6281200000001` | Didaftarkan via Auth, update `profiles.app_role = 'client'`. Akses: Booking Individu, Penandatanganan Mandiri, Unduh PDF pribadi. | `BELUM DIBUAT` |
| 5 | **Client B** | UAT Klien B | `uat.client.b@sicare.test` | `+6281200000002` | Didaftarkan via Auth, update `profiles.app_role = 'client'`. Akses: Booking Kelompok, Pendaftaran Anggota Berstruktur, Monitoring Persetujuan. | `BELUM DIBUAT` |
| 6 | **Group Member (Akun)** | UAT Peserta Terdaftar | `uat.participant.a@sicare.test` | `+6281200000003` | Didaftarkan via Auth, update `profiles.app_role = 'client'`. Akses: Penautan Undangan Kelompok via Verifikasi Telepon, Tanda Tangan, Unduh PDF. | `BELUM DIBUAT` |
| 7 | **Group Guest A (Tamu)** | Peserta Tamu A | *(Tanpa Akun)* | `+6281200000004` | Tidak memerlukan akun Supabase Auth. Didaftarkan oleh Klien B saat booking; mengakses portal via token kapabilitas HMAC unik. | `TIDAK PERLU AKUN` |
| 8 | **Group Guest B (Tamu)** | Peserta Tamu B | *(Tanpa Akun)* | `+6281200000005` | Tidak memerlukan akun Supabase Auth. Digunakan untuk pengujian penolakan/kedaluwarsa token dan pemulihan sesi tamu. | `TIDAK PERLU AKUN` |

---

## 5. Prasyarat yang Masih BLOCKED & Rencana Mitigasi

1. **Pengiriman WhatsApp Langsung ke Nomor Nyata (Live Delivery):**
   - **Status:** **BLOCKED (Policy Gate)**.
   - **Kondisi Pemblokir:** Kebijakan keselamatan proyek melarang pengiriman pesan nyata ke nomor seluler sebelum ada persetujuan tertulis resmi dan penetapan whitelist nomor penerima uji di `WHATSAPP_TEST_RECIPIENTS`.
   - **Dampak pada UAT:** Skenario `UAT-FON-002` tidak dapat dieksekusi secara live dan ditandai `BLOCKED`.
   - **Mitigasi UAT:** Seluruh pengujian alur bisnis booking dan undangan kelompok dieksekusi menggunakan **Mock Outbox Pipeline**, di mana pesan diverifikasi melalui tabel `whatsapp_outbox` dan audit log sistem. Mekanisme ini menjamin 100% alur bisnis teruji tanpa risiko spamming atau kebocoran pesan ke nomor pihak ketiga.

---

## 6. Prosedur Operasional Memulai Sesi UAT (Execution Runbook)

Sebelum koordinator menyatakan sesi UAT manusia dimulai, jalankan 3 langkah berikut:

### Langkah 1: Penyediaan 6 Akun Uji Terotentikasi
Administrator staging mendaftarkan 6 akun pada tabel di atas ke Supabase Auth dengan password sementara, lalu membagikannya secara privat kepada penguji.

### Langkah 2: Menjalankan Server Backend & Scheduler/Worker
```powershell
cd be
node server.js
```
*(Buka terminal kedua untuk worker & scheduler background)*
```powershell
cd be
npm run whatsapp:worker
npm run whatsapp:scheduler
```

### Langkah 3: Menjalankan Frontend dalam Mode Preview Staging
```powershell
cd fe
npm run preview
```
*Aplikasi siap diakses oleh penguji manusia melalui peramban pada `http://localhost:4173` (atau port dev `http://localhost:5173`).*
