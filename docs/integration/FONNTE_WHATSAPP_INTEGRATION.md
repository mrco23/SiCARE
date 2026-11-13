# SiCARE — Dokumentasi Integrasi WhatsApp Fonnte (Batch 1.5a & 1.5a.1)

**Status:** Selesai diimplementasikan, diaudit keandalannya, diperluas pada Batch 1.5d, dan diverifikasi integrasi menyeluruh pada Batch 1.5e (184/184 backend tests PASS).
**Lingkup:** Infrastruktur pengiriman pesan WhatsApp, transactional outbox, worker background, retry dengan exponential backoff dan jitter, pencegahan pesan duplikat (idempotensi deterministik), scheduler pengingat sesi (H-1 dan Hari H), scheduler pengingat consent (24 jam dan 72 jam), gerbang eligibilitas akhir worker (pembatalan pesan usang), pelacakan status pengiriman via webhook Fonnte, catatan opt-in WhatsApp yang tidak lagi menggerbang pengiriman (wajib untuk semua klien/konselor, 2026-11-13), pemantauan kesehatan provider, serta penyebaran undangan Informed Consent kelompok dengan enkripsi token terdedikasi AES-256-GCM.
**Dokumen Alur Undangan Kelompok (Batch 1.5d):** [`docs/GROUP_CONSENT_WORKFLOW.md`](../GROUP_CONSENT_WORKFLOW.md)
**Dokumen Arsitektur Keamanan:** [`docs/security/security-architecture.md`](../security/security-architecture.md)
**Status Pengujian & Progres:** [`docs/PROJECT_STATUS.md`](../PROJECT_STATUS.md)

---

## 1. Arsitektur Sistem

Sistem notifikasi WhatsApp SiCARE dirancang mengikuti pola **Transactional Outbox Pattern** untuk memisahkan siklus hidup request HTTP Express dari pengiriman pesan eksternal, menjamin keandalan pengiriman tanpa risiko kegagalan parsial transaksi bisnis atau duplikasi pesan.

```text
[Aksi Bisnis / Booking]
        |
        v
[Database PostgreSQL]  <--- Transaksi ACID (sicare_create_booking / sicare_transition_booking)
        |
        +---> Simpan status booking & in-app notifications
        |
        +---> Enqueue ke public.whatsapp_outbox (status: 'pending', scheduled_at, idempotency_key)

-----------------------------------------------------------------------------------------
[Background WhatsApp Worker] (src/workers/whatsapp.worker.js)
        |
        v
[Atomic Claiming RPC]  <--- sicare_claim_whatsapp_jobs (FOR UPDATE SKIP LOCKED + Lease Expiry)
        |
        +---> Klaim batch job, ubah status -> 'processing', kunci worker lease
        |
        +---> Validasi status akun aktif (profiles.account_status === 'active')
        |     (Sejak 2026-11-13: TIDAK lagi memeriksa profiles.whatsapp_opt_in, notifikasi wajib
        |     untuk semua klien/konselor; kolom itu masih ada tapi tidak dibaca worker.)
        |
        +---> Render Template Pesan (src/templates/whatsapp/index.js)
        |
        +---> Kirim via FonnteService (POST https://api.fonnte.com/send, Auth: TOKEN)
        |
        +---> Sukses: status -> 'accepted', simpan provider_message_id
        +---> Timeout: status -> 'unknown' (menghindari duplikasi akibat timeout ambigu)
        +---> Gagal Sementara (429, 5xx, device disconnect): status -> 'retry_wait' (backoff + jitter)
        +---> Gagal Permanen: status -> 'failed'

-----------------------------------------------------------------------------------------
[Fonnte Webhook Receiver] (POST /api/v1/webhooks/fonnte/message-status)
        |
        v
[Verifikasi Secret]    <--- timingSafeEqualString(FONNTE_WEBHOOK_SECRET)
        |
        +---> Cari outbox berdasarkan provider_message_id
        +---> Pembaruan status pengiriman (status -> 'delivered', delivered_at)
        +---> Callback gagal pengiriman (status -> 'failed', last_error_code: 'PROVIDER_DELIVERY_FAILED')

-----------------------------------------------------------------------------------------
[Reminder Scheduler] (src/workers/whatsapp.scheduler.js)
        |
        v
[Pindai Sesi Konseling Mendatang] (starts_at dalam rentang lookahead)
        |
        +---> Enqueue Pengingat H-1 (starts_at - 24 jam)
        +---> Enqueue Pengingat Hari H (starts_at - 1 jam)
        +---> Batalkan pengingat usang jika booking/sesi dibatalkan atau reschedule
```

### 1.1 Keandalan Transaksional & Atomisitas ACID (Batch 1.5a.1)

Pada Batch 1.5a.1, dilakukan audit dan penguatan konsistensi transaksional:
1. **Atomisitas Tunggal (Single Transaction Boundary):**
   - Sebelum 1.5a.1, outbox diisi melalui panggilan sekunder Node.js setelah RPC booking selesai. Hal ini berpotensi kehilangan event notifikasi jika Node.js mengalami crash atau gangguan koneksi database di antara dua panggilan tersebut.
   - Pada 1.5a.1, outbox event disisipkan langsung di dalam fungsi transaksi PostgreSQL:
     - `sicare_create_booking` (notifikasi konselor `booking_requested` & klien `booking_received`).
     - `sicare_reschedule_booking` (pembatalan pengingat lama & notifikasi konselor `reschedule_requested`).
     - `sicare_transition_booking` (notifikasi transisi `booking_accepted`, `booking_rejected`, `reschedule_requested`, `booking_cancelled`, serta pengingat H-1 dan Hari H).
   - Pemanggilan sekunder di Express (`booking.routes.js`) telah dihapus total, sehingga seluruh operasi state mutation dan outbox berada di dalam satu transaksi ACID yang sama.
2. **Kunci Idempotensi Berbasis Qualifier Waktu:**
   - Untuk mencegah tabrakan kunci idempotensi saat sesi di-reschedule ke tanggal/jam baru, generator kunci idempotensi pengingat menambahkan timestamp `starts_at` sebagai qualifier (`booking:{id}:{type}:{recipient}:{starts_at}`).
3. **Proteksi Monotonik Status Terminal Webhook:**
   - Webhook penerima callback pengiriman melindungi status terminal `delivered` dan `cancelled` agar tidak dapat diturunkan kembali (*downgrade*) oleh callback status yang datang terlambat (*out-of-order*).
4. **Pembersihan Sewa Kadaluarsa (Worker Lease Reaper):**
   - RPC `sicare_claim_whatsapp_jobs` dan query worker secara otomatis mendeteksi dan menandai pekerjaan berstatus `processing` yang sewanya kadaluarsa dan telah melampaui `max_attempts` sebagai `failed` (`LEASE_EXPIRED_MAX_ATTEMPTS`).

---

## 2. Status Lifecycle Outbox (State Machine)

```text
               +-------------------------------------------+
               |                  pending                  |
               +-------------------------------------------+
                                     |
                         Worker Atomic Claim (RPC)
                                     v
               +-------------------------------------------+
               |                processing                 |
               +-------------------------------------------+
                 /                   |                   \
       Fonnte Sukses         Gagal Sementara         Gagal Permanen / Opt-Out
               /                     |                     \
              v                      v                      v
    +-------------------+  +-------------------+  +-------------------+
    |     accepted      |  |    retry_wait     |  |      failed       |
    +-------------------+  +-------------------+  +-------------------+
              |                      |
       Webhook Status        next_attempt_at
       ("delivered")                 |
              v                      v
    +-------------------+  +-------------------+
    |     delivered     |  |      pending      |
    +-------------------+  +-------------------+
```

- **`pending`**: Menunggu diklaim oleh worker. Nilai default untuk record baru.
- **`processing`**: Telah diklaim secara eksklusif oleh suatu worker berkat PostgreSQL `FOR UPDATE SKIP LOCKED`. Memiliki batas waktu sewa (`lease_expires_at`).
- **`accepted`**: Fonnte menerima pesan (`status: true`). Pesan berada di antrean internal Fonnte untuk dikirimkan ke perangkat WhatsApp.
- **`delivered`**: Fonnte mengirimkan webhook pembaruan status bahwa pesan telah sampai di perangkat penerima (`delivered` atau `read`).
- **`retry_wait`**: Pengiriman mengalami gangguan sementara (HTTP 429, 5xx, atau device WhatsApp konselor/sistem terputus sementara). Dijadwalkan untuk dicoba kembali pada timestamp `next_attempt_at`.
- **`failed`**: Pengiriman gagal secara permanen (token tidak valid, nomor telepon tidak terdaftar, atau batas `max_attempts` tercapai). Kode `RECIPIENT_NOT_OPTED_IN`/kategori `opt_out` sudah tidak pernah terjadi lagi sejak 2026-11-13.
- **`cancelled`**: Pesan dibatalkan karena sesi konseling telah dibatalkan atau dijadwalkan ulang oleh klien/konselor, atau tidak dikirim karena mode simulasi (`last_error_code: DRY_RUN_NOT_SENT`, `provider_status: simulated`).
- **`unknown`**: Request ke Fonnte mengalami timeout setelah pesan mungkin telah mencapai server provider. Sistem menahan pengiriman ulang membabi buta agar tidak terjadi spam pesan ganda.

---

## 3. Variabel Lingkungan & Konfigurasi Aman

Variabel backend berikut dikelola melalui `be/src/config/env.js` dan terdokumentasi di `be/.env.example`:

| Nama Variabel | Tipe | Default | Keterangan |
|---|---|---|---|
| `FONNTE_TOKEN` | Secret (string) | *kosong* | API token Fonnte dari dashboard resmi. Server-side only; tidak pernah dibocorkan ke frontend. |
| `FONNTE_API_URL` | URL | `https://api.fonnte.com` | Base URL endpoint Fonnte. |
| `FONNTE_ENABLED` | Boolean | `false` | Status aktivasi provider Fonnte. |
| `FONNTE_WEBHOOK_SECRET` | Secret (string) | *kosong* | Secret autentikasi untuk memvalidasi callback webhook status pesan. |
| `FONNTE_TIMEOUT_MS` | Integer | `15000` | Batas waktu timeout request HTTP ke Fonnte (milidetik). |
| `CRON_SECRET` | Secret (string) | *kosong* | Bearer secret untuk endpoint `/api/v1/internal/whatsapp/*`. Jika kosong, endpoint menolak semua request. |
| `WHATSAPP_SEND_ENABLED` | Boolean | `false` | Safety gate utama. Jika `false`, sistem berjalan dalam mode simulasi aman (*dry-run*) tanpa mengirim pesan nyata. |
| `WHATSAPP_MAX_ATTEMPTS` | Integer | `5` | Jumlah percobaan maksimal sebelum pesan ditandai gagal permanen. |
| `WHATSAPP_WORKER_CONCURRENCY` | Integer | `1` | Jumlah batch job yang diklaim worker dalam satu putaran. |
| `WHATSAPP_POLL_INTERVAL_MS` | Integer | `5000` | Interval polling daemon worker (milidetik). |
| `WHATSAPP_TEST_MODE` | Boolean | `true` | Jika `true`, pesan HANYA dikirimkan ke nomor yang terdaftar di `WHATSAPP_TEST_RECIPIENTS`. |
| `WHATSAPP_TEST_RECIPIENTS` | String | *kosong* | Daftar nomor telepon penguji terotorisasi yang dipisahkan tanda koma (format E.164, misal: `6281234567890`). |

### Aturan Keamanan:
1. `FONNTE_TOKEN` dan `FONNTE_WEBHOOK_SECRET` **tidak pernah** ditulis ke log, audit trail, database outbox, atau response API.
2. Tidak adanya token atau gagalnya koneksi Fonnte **tidak menggagalkan** alur kerja transaksi booking pengguna.
3. Seluruh pesan baru berada dalam mode aman (*simulated*) hingga pengelola sistem secara eksplisit mengaktifkan `WHATSAPP_SEND_ENABLED=true` dan memasukkan `WHATSAPP_TEST_RECIPIENTS`.
4. Pesan simulasi tidak dicatat sebagai terkirim: outbox menjadi `cancelled` (`DRY_RUN_NOT_SENT`) tanpa `sent_at`, undangan consent tetap `pending`, dan `cleared_at` tidak diisi. Pesan ini tidak dikirim ulang saat pengiriman nyata diaktifkan; gunakan kirim ulang undangan atau tunggu pengingat berikutnya.
5. Selama `WHATSAPP_TEST_MODE=true`, nomor di luar `WHATSAPP_TEST_RECIPIENTS` ditandai `failed` (`TEST_RECIPIENT_NOT_ALLOWED`) sebelum gerbang simulasi.

---

## 4. Perubahan Database & Migrasi SQL

File migrasi baru:
`supabase/migrations/20261031120000_sicare_whatsapp_outbox_fonnte.sql`

Perubahan skema pada `public.whatsapp_outbox`:
1. **Perluasan `message_type`**:
   `check (message_type in ('booking_requested', 'booking_received', 'booking_accepted', 'booking_rejected', 'reschedule_requested', 'booking_cancelled', 'reminder_h1', 'reminder_day_of'))`.
2. **Perluasan `status`**:
   `check (status in ('pending', 'processing', 'accepted', 'delivered', 'retry_wait', 'failed', 'cancelled', 'unknown', 'queued', 'sending', 'sent'))` dengan default `'pending'`.
3. **Penambahan Kolom Operasional**:
   - `next_attempt_at timestamptz default now()`
   - `max_attempts integer not null default 5`
   - `locked_at timestamptz`
   - `locked_by text`
   - `lease_expires_at timestamptz`
   - `last_attempt_at timestamptz`
   - `phone_e164 text`
   - `payload jsonb not null default '{}'::jsonb`
   - `provider_request_id text`
   - `provider_state_id text`
   - `provider_status text`
   - `provider_state text`
   - `provider_response jsonb`
   - `last_error_message text`
   - `error_category text check (error_category is null or error_category in ('permanent', 'temporary', 'unknown', 'validation', 'opt_out'))`
   - `delivered_at timestamptz`
4. **Indeks Performa**:
   - `whatsapp_outbox_eligible_claim_idx` pada `(status, scheduled_at, next_attempt_at)`.
   - `whatsapp_outbox_provider_msg_idx` pada `(provider_message_id) where provider_message_id is not null`.
   - `whatsapp_outbox_recipient_idx` pada `(recipient_user_id, created_at desc)`.
5. **PostgreSQL RPC `sicare_claim_whatsapp_jobs`**:
   Menggunakan `FOR UPDATE SKIP LOCKED` dan perpanjangan sewa otomatis (`lease_expires_at`). Memulihkan job yang sewa worker-nya telah kedaluwarsa akibat crash.
6. **PostgreSQL RPC `sicare_get_whatsapp_stats`**:
   Menghitung agregasi status outbox untuk pemantauan kesehatan backend.

---

## 5. Matriks Integrasi Event Booking

| Peristiwa Bisnis | Pemicu (Actor) | Penerima Notifikasi | Message Type | Keterangan |
|---|---|---|---|---|
| Permintaan Booking Dibuat | Klien (`POST /bookings`) | Konselor | `booking_requested` | Memberitahu konselor ada permintaan baru yang perlu ditinjau. |
| Konfirmasi Pengajuan Diterima | Klien (`POST /bookings`) | Klien | `booking_received` | Menegaskan ke klien bahwa pengajuan telah masuk dan menunggu konfirmasi. |
| Booking Diterima (`confirmed`) | Konselor (`PATCH /bookings/:id/status`) | Klien | `booking_accepted` | Mengirimkan detail sesi, format (online/offline), ruangan/link, dan waktu sesi. Sekaligus menjadwalkan pengingat sesi H-1 dan Hari H. |
| Booking Ditolak (`rejected`) | Konselor (`PATCH /bookings/:id/status`) | Klien | `booking_rejected` | Menginformasikan penolakan jadwal beserta alasan penolakan operasional. |
| Permintaan Reschedule | Klien atau Konselor | Pihak Lawan | `reschedule_requested` | Menginformasikan permintaan pemilihan slot baru dan membatalkan pengingat jadwal lama. |
| Booking Dibatalkan (`cancelled`) | Klien atau Konselor | Pihak Lawan | `booking_cancelled` | Menginformasikan pembatalan jadwal dan membatalkan seluruh pengingat sesi terkait. |
| Pengingat Sesi H-1 | Scheduler Otomatis | Klien & Konselor | `reminder_h1` | Dikirimkan 24 jam sebelum sesi konseling dimulai. |
| Pengingat Sesi Hari H | Scheduler Otomatis | Klien & Konselor | `reminder_day_of` | Dikirimkan 1 jam sebelum sesi konseling dimulai. |

---

## 6. Template Pesan WhatsApp SiCARE

Seluruh template dikelola terpusat di `be/src/templates/whatsapp/index.js` dengan format tanggal Indonesia (`id-ID`, zona waktu `Asia/Jakarta`, WIB).

1. **`booking-requested`**: Permintaan jadwal baru kepada Konselor.
2. **`booking-received`**: Konfirmasi pengajuan booking kepada Klien.
3. **`booking-accepted`**: Notifikasi jadwal terkonfirmasi kepada Klien lengkap dengan format dan ruangan/link.
4. **`booking-rejected`**: Notifikasi penolakan jadwal kepada Klien disertai alasan operasional.
5. **`reschedule-requested`**: Permintaan penjadwalan ulang kepada Klien atau Konselor.
6. **`booking-cancelled`**: Pemberitahuan pembatalan sesi kepada Klien atau Konselor.
7. **`session-reminder-h1`**: Pengingat sesi H-1 (besok) kepada Klien dan Konselor.
8. **`session-reminder-day-of`**: Pengingat sesi Hari H (1 jam sebelum mulai) kepada Klien dan Konselor.

**Perlindungan Privasi Klinis (SOP SiCARE):**
Pesan hanya memuat data operasional (nomor referensi booking `#SC-XXXXXX`, nama konselor/klien, tanggal, jam, format, ruangan/link). Catatan konseling, asesmen psikologis, jawaban form intake, dan keluhan klien **dilarang keras** dimasukkan ke dalam template pesan.

---

## 7. Notifikasi WhatsApp Wajib (bukan lagi opt-in)

**Keputusan pengguna, 2026-11-13:** notifikasi WhatsApp bersifat wajib untuk semua klien dan
konselor, bukan lagi preferensi yang bisa dimatikan.

- `be/src/workers/whatsapp.worker.js` tidak lagi memeriksa `profiles.whatsapp_opt_in` sebelum
  mengirim. Satu-satunya syarat sebelum kirim adalah akun penerima `account_status === 'active'`.
- Toggle "Terima Notifikasi Jadwal WhatsApp" di halaman Pengaturan klien sudah dihapus dari UI.
- Endpoint `PATCH /api/v1/profile/whatsapp-consent` dan kolom `profiles.whatsapp_opt_in` masih
  ada di backend/database (tidak dihapus, hanya tidak lagi dibaca untuk keputusan kirim/tidak),
  karena beberapa tampilan admin masih menampilkannya sebagai riwayat. Nilai lama klien yang
  pernah opt-out **tidak diubah**; nilai itu sekarang murni historis dan tidak memengaruhi apakah
  mereka menerima WhatsApp.
- **Validasi Nomor Telepon:** hanya nomor telepon dengan format E.164 valid (minimal 7 digit,
  diawali `62` atau `08`) yang akan diproses.

---

## 8. Kebijakan Retry dan Idempotensi

### Idempotensi Deterministik:
Kunci idempotensi dihasilkan dari entitas bisnis:
`booking:{booking_id}:{message_type}:{recipient_user_id}`
Database PostgreSQL menjamin `idempotency_key UNIQUE`. Upaya pengiriman duplikat akibat retry HTTP atau refresh browser ditangani secara *silent skip* (`ON CONFLICT DO NOTHING`) tanpa menimbulkan pesan berulang ke WhatsApp pengguna.

### Exponential Backoff dengan Jitter:
Jadwal percobaan ulang untuk error sementara (HTTP 429, 5xx, atau device WhatsApp terputus):
- Percobaan 1: Segera.
- Percobaan 2: ~1 menit (60 detik ± 15% random jitter).
- Percobaan 3: ~5 menit (300 detik ± 15% random jitter).
- Percobaan 4: ~15 menit (900 detik ± 15% random jitter).
- Percobaan 5: ~60 menit (3600 detik ± 15% random jitter).

Setelah 5 kali percobaan gagal, status pesan berubah menjadi `failed` secara permanen.

---

## 9. Webhook Pelacakan Status Pengiriman

Endpoint:
`POST /api/v1/webhooks/fonnte/message-status`

- **Verifikasi Kredensial:** Memvalidasi `FONNTE_WEBHOOK_SECRET` menggunakan perbandingan waktu-konstan (`crypto.timingSafeEqual`) melalui header `x-fonnte-secret`, `x-webhook-secret`, atau query string `?secret=`.
- **Pembaruan Status:** Mencocokkan `provider_message_id` pada outbox. Mengubah status pesan dari `accepted` menjadi `delivered` (`delivered_at = now()`) ketika Fonnte mengonfirmasi status `delivered` atau `read`.
- **Ketahanan Callback Duplikat:** Idempoten; pengiriman callback berulang tidak merusak integritas data outbox.
- **Respons HTTP 200:** Callback untuk ID yang tidak tercatat di outbox dijawab dengan status `ignored` (HTTP 200) guna mencegah badai retry dari server Fonnte.

---

## 10. Panduan Operasional & Eksekusi

### Menjalankan Worker WhatsApp:
```bash
# Menjalankan worker satu putaran (single-pass):
node src/workers/whatsapp.worker.js --once

# Menjalankan worker sebagai daemon background:
npm run whatsapp:worker
```

### Menjalankan Scheduler Pengingat:
```bash
# Menjalankan scheduler satu putaran (single-pass):
node src/workers/whatsapp.scheduler.js --once

# Menjalankan scheduler berkala (setiap 10 menit):
npm run whatsapp:scheduler
```

### Menjalankan di Vercel (tanpa proses worker):
Fungsi Vercel tidak bisa menjalankan proses terus-menerus, dan cron paket Hobby dibatasi sekali sehari. Karena itu, layanan cron eksternal memanggil dua endpoint berikut:

| Endpoint | Jadwal yang disarankan |
|---|---|
| `POST /api/v1/internal/whatsapp/worker-run` | Tiap 1 menit |
| `POST /api/v1/internal/whatsapp/scheduler-run` | Tiap 10 menit |

Setiap request wajib mengirim header `Authorization: Bearer <CRON_SECRET>`, tanpa body. Layanan cron menyimpan secret ini, jadi gunakan nilai khusus untuk cron dan ganti bila layanan tersebut tidak lagi dipakai.

Langkah aktivasi:
1. Isi `CRON_SECRET` di environment Vercel, lalu redeploy.
2. Pastikan `WHATSAPP_SEND_ENABLED=false` dan `WHATSAPP_TEST_MODE=true`, lalu buat kedua jadwal. Pesan lama di antrean akan ditutup tanpa terkirim: `cancelled` untuk nomor uji, `failed` untuk nomor lain.
3. Pantau `GET /api/v1/admin/whatsapp/health` sampai `pending` tidak lagi menumpuk.
4. Isi `FONNTE_TOKEN`, `FONNTE_WEBHOOK_SECRET`, dan `WHATSAPP_TEST_RECIPIENTS`, set `WHATSAPP_SEND_ENABLED=true`, lalu redeploy dan uji dengan nomor uji yang disetujui.

Setiap putaran memproses maksimal 10 pesan secara berurutan. Masa kunci dihitung dari ukuran batch (230 detik untuk 10 pesan pada timeout 15 detik) agar putaran yang tumpang tindih tidak mengirim pesan yang sama dua kali.

### Memeriksa Kesehatan & Observabilitas Outbox:
Endpoint admin terautentikasi:
`GET /api/v1/admin/whatsapp/health` (Bearer token dengan role `admin`).

Menghasilkan ringkasan kesehatan:
```json
{
  "data": {
    "provider": {
      "name": "Fonnte",
      "configured": true,
      "send_enabled": false,
      "test_mode": true,
      "api_url": "https://api.fonnte.com",
      "timeout_ms": 15000,
      "test_recipients_count": 1
    },
    "outbox": {
      "total": 42,
      "pending": 0,
      "processing": 0,
      "accepted": 35,
      "delivered": 34,
      "retry_wait": 0,
      "failed": 7,
      "cancelled": 0,
      "unknown": 0
    },
    "recent_issues": [],
    "timestamp": "2026-10-31T19:30:00.000Z"
  }
}
```
