# Architectural Decision Record & Spike: Real-Time & Frontend Caching di SiCARE

**Status:** Proposed / Spike & Planning Document  
**Tanggal:** 3 November 2026  
**Penulis:** Tim Engineering SiCARE  
**Domain:** Real-Time Synchronization, Data Confidentiality, Frontend State & Caching Architecture  
**Referensi Terkait:**  
- [`AGENTS.md`](../../AGENTS.md) (Aturan Tetap Pengembangan & Keamanan Data Klinis)  
- [`docs/security/security-architecture.md`](../security/security-architecture.md) (Arsitektur Keamanan SiCARE)  
- [`docs/refactor/DATA_ARCHITECTURE.md`](DATA_ARCHITECTURE.md) (Arsitektur Data & Model Transaksional)  
- [`docs/integration/API_ENDPOINT_MATRIX.md`](../integration/API_ENDPOINT_MATRIX.md) (Matriks Kontrak Endpoint Backend)  

---

## 1. Ringkasan Eksekutif & Rekomendasi Utama

> **Rekomendasi Satu Kalimat:**  
> **SiCARE direkomendasikan mengadopsi Opsi B (Supabase Broadcast via Backend Service Role pada Private Channel per Pengguna) yang dipadukan dengan In-Memory Caching ringan berbasis TTL dan Invalidasi Otomatis per Mutasi di `fe/src/lib/api.ts`, guna menjamin perlindungan absolut data klinis tanpa merombak RLS basis data dan tanpa menambah dependensi eksternal.**

---

## 2. Konteks Arsitektur & Masalah Saat Ini

### 2.1. Arsitektur Komunikasi Saat Ini
1. **Frontend Transport (`fe/src/lib/api.ts` L23–L55):**  
   Seluruh interaksi data bisnis (baca maupun tulis) dilakukan melalui panggilan HTTP REST ke Express Backend (`/api/v1/*`) menggunakan fungsi `fetchApi`. Frontend menyematkan Supabase JWT pengguna melalui header HTTP `Authorization: Bearer <access_token>`.
2. **Browser Supabase Client (`fe/src/lib/supabase.ts` L19–L42):**  
   Fungsi `getSupabaseClient()` saat ini **hanya digunakan untuk autentikasi Supabase Auth** (manajemen sesi, token refresh, dan verifikasi email) dengan persistensi di `window.sessionStorage`. Client browser **tidak pernah** digunakan untuk melakukan query data PostgREST langsung ke tabel bisnis.
3. **Backend Authority & Data Access (`be/src/config/supabase.js` L19–L42 & `be/src/middleware/auth.js` L4–L46):**  
   Express Backend bertindak sebagai *single source of truth* dan *sole authorizer*. Token diverifikasi via `supabase.auth.getUser()`, dan seluruh operasi basis data bisnis dilakukan menggunakan `service_role` client (`getSupabaseAdminClient()`), yang membypass PostgREST RLS. Otorisasi peran (`client`, `counselor`, `admin`, `head_lmi`) dan kepemilikan data (*ownership guards*) ditegakkan secara ketat pada middleware dan stored procedure SQL (`SECURITY DEFINER`).

### 2.2. Ketiadaan Sinkronisasi Real-Time & Caching
1. **Komponen Notifikasi (`fe/src/components/shared/NotificationBell.tsx` L33–L59):**  
   Notifikasi hanya dimuat secara ad-hoc saat komponen di-mount atau ketika tombol dropdown dibuka oleh pengguna. Jika konselor menyetujui pesanan atau klien mengirim pesan, pengguna lain tidak melihat perubahan jumlah badge notifikasi sampai melakukan aksi klik atau memuat ulang halaman (*full page refresh*).
2. **Mock Notification Store (`fe/src/features/notification/notificationStore.ts` L5–L60):**  
   Terdapat sisa state Zustand berisi initial mock seed yang tidak terhubung dengan siklus hidup perubahan backend.
3. **Penyegaran Halaman Manual pada Alur Multi-Pihak:**  
   - Pada halaman **Aktivitas Konseling** (`KlienAktivitasPage.tsx` dan `KonselorAktivitasPage.tsx`), saat konselor mengubah status booking (`confirmed`, `rejected`, `rescheduled`), klien tidak menerima pembaruan status terkini secara otomatis.  
   - Pada alur **Informed Consent Kelompok** (`GroupConsentModal.tsx`), konselor dan klien utama harus menutup dan membuka kembali modal untuk memeriksa apakah anggota kelompok atau peserta tamu telah menyelesaikan penandatanganan surat pernyataan kesediaan.
4. **Beban Request Berulang Tanpa Cache:**  
   Setiap navigasi antar-halaman memicu ulang pemanggilan data master dan profil (`/profile`, `/public/counselors`, `/admin/academic-periods`), meskipun data tersebut sangat jarang berubah dalam satu sesi penggunaan.

---

## 3. Analisis & Perbandingan 3 Opsi Real-Time

### 3.1. Opsi A: `postgres_changes` via Supabase Client + JWT Pengguna (CDC WAL Replikasi)

*Mekanisme:* Frontend browser menghubungkan WebSocket langsung ke Supabase Realtime Server dan berlangganan perubahan baris tabel:
```typescript
supabaseClient
  .channel('realtime:bookings')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, (payload) => {
    // Tangani perubahan row
  })
  .subscribe();
```

*Prasyarat Teknis:*
- Menambahkan tabel ke publikasi PostgreSQL: `ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings, ...;`
- Supabase Realtime mengevaluasi RLS terhadap token JWT pengguna yang tersambung di WebSocket. Artinya, **setiap tabel yang dilanggani wajib memiliki policy RLS `SELECT` yang valid untuk peran pengguna (`authenticated`)**.

*Kelemahan Kritis & Risiko Keamanan:*
1. **Risiko Kebocoran Data Sensitif & Rekam Klinis (Pelanggaran `AGENTS.md` Bagian 3):**  
   Pada migrasi `20261027000000_sicare_core_schema.sql` dan `20261031160000_sicare_consent_security_hardening.sql`, akses direct PostgREST sengaja diperketat atau di-revoke dari peran publik guna mencegah kebocoran data.  
   Jika Opsi A diterapkan, payload CDC WAL (`new` dan `old` record) dikirimkan melalui WebSocket. Celah kecil pada policy RLS SQL akan mengekspos data pribadi mahasiswa, snapshot identitas persetujuan (`identity_snapshot`), atau catatan asesmen ke browser pengguna lain.
2. **Bypass Otorisasi Backend Express:**  
   Logika bisnis SiCARE (seperti penyamaran nama klien menjadi *Klien Anonim #XXXX* untuk Kepala LMI/Admin, validasi relasi konselor penanggung jawab, dan audit logging) berada di Express. Mendengarkan tabel basis data mentah menghilangkan lapisan abstraksi dan penyamaran privasi tersebut.
3. **Ketidakmampuan Menangani Peserta Tamu (*Guest Participants*):**  
   Peserta konseling kelompok tamu tidak memiliki akun Supabase Auth (tidak memiliki JWT `authenticated`). Akibatnya, tamu **tidak dapat** memanfaatkan `postgres_changes` tanpa membuka akses tabel ke peran `anon` (yang merupakan risiko keamanan fatal).
4. **Dampak Perubahan Kode & Migrasi yang Masif:**  
   Memerlukan migrasi besar pada PostgreSQL untuk membuat puluhan RLS `SELECT` policy baru di berbagai tabel, serta penambahan publication. Perkiraan diff: **>600 baris SQL** dan perombakan arsitektur otorisasi.

---

### 3.2. Opsi B: Supabase Broadcast via Backend Service Role pada Private Channel (Direkomendasikan)

*Mekanisme:*
1. Klien membuka koneksi WebSocket Supabase ke channel privat milik pengguna yang terisolasi:  
   `private:user:${currentUserId}`.
2. Express Backend memproses seluruh mutasi secara transaksional (mempertahankan otorisasi, validasi schema Zod, dan audit logging).
3. Setelah mutasi database berhasil dikomit, backend Express mengirimkan pesan *Broadcast Event* berbobot ringan (*lightweight signal*) melalui `getSupabaseAdminClient()`:
   ```javascript
   // Backend (be/src/services/realtimeBroadcast.service.js)
   await adminClient.channel(`private:user:${recipientId}`).send({
     type: 'broadcast',
     event: 'SICARE_EVENT',
     payload: {
       entity: 'booking',
       action: 'status_changed',
       entityId: bookingId,
       timestamp: new Date().toISOString()
     }
   });
   ```
4. Frontend menerima sinyal broadcast dan secara cerdas **menginvalir in-memory cache** serta men-trigger pemanggilan ulang (*background refetch*) ke API Express yang sudah memiliki otorisasi dan serialisasi aman.

*Keunggulan Teknis & Keamanan:*
1. **Zero Risk Kebocoran Data Klinis:**  
   Pesan broadcast **tidak memuat data klinis, identitas diri, atau isi percakapan**. Pesan hanya memuat sinyal koordinasi operasional (`entity`, `action`, `entityId`). Data aktual tetap diambil melalui API Express yang menerapkan RBAC ketat.
2. **Tidak Memerlukan Perubahan RLS atau Migrasi Tabel:**  
   Supabase Broadcast tidak bergantung pada replikasi WAL PostgreSQL dan tidak membaca tabel. Tidak ada tabel yang perlu dimasukkan ke `supabase_realtime` publication.
3. **Backend Tetap Sebagai Single Source of Truth:**  
   Seluruh aturan bisnis, otorisasi peran, penyamaran identitas Kepala LMI, dan pencatatan audit log append-only tetap terjaga 100% di Express.
4. **Implementasi Ramping & Terukur:**  
   Hanya membutuhkan penambahan 1 modul service pengirim di backend (~150 baris kode) dan 1 custom React hook di frontend (~100 baris kode).

---

### 3.3. Opsi C: Controlled Polling dengan Header ETag / Versioning (Baseline Minimal)

*Mekanisme:*  
Frontend melakukan polling berkala menggunakan interval terkontrol (misal 30–60 detik untuk notifikasi latar, atau 10–15 detik saat modal persetujuan kelompok sedang dibuka).
Request menyertakan header `If-None-Match: <etag>` atau query parameter `?since=<timestamp>`. Jika tidak ada data baru, Express merespons dengan HTTP `304 Not Modified` tanpa payload body.

*Kelemahan & Keunggulan:*
- *Kelemahan:* Latensi pembaruan tidak seketika (tergantung interval); konsumsi baterai dan kuota pada perangkat seluler pengguna akibat request HTTP berulang.
- *Keunggulan:* Sangat andal, bebas dari kendala koneksi WebSocket firewall kampus, dan dapat digunakan sebagai **mekanisme fallback cadangan** jika koneksi WebSocket Supabase mengalami gangguan (*failover fallback*).

---

## 4. Matriks Perbandingan & Penilaian Risiko

| Parameter Evaluasi | Opsi A: `postgres_changes` (CDC WAL) | Opsi B: Supabase Broadcast (Backend Driven) | Opsi C: Controlled Polling (ETag/Timestamp) |
| :--- | :--- | :--- | :--- |
| **Dampak Terhadap RLS Database** | **Tinggi & Berbahaya.** Membutuhkan RLS `SELECT` policy publik/authenticated pada tabel sensitif. | **Nol.** Tidak menyentuh atau mengubah RLS database sama sekali. | **Nol.** Menggunakan otorisasi HTTP Express yang sudah ada. |
| **Kebutuhan Migrasi Basis Data** | **Wajib.** `ALTER PUBLICATION supabase_realtime ADD TABLE ...` dan penambahan RLS. | **Tidak Ada.** Menggunakan fitur Broadcast Supabase tanpa migrasi skema data. | **Opsional.** Menambahkan kolom komposit timestamp/index bila belum ada. |
| **Risiko Kebocoran Data Klinis & PII** | **Tinggi.** Data kolom database dipancarkan mentah via WebSocket replikasi WAL. | **Nol.** Hanya mengirimkan sinyal metadata tanpa data klinis/PII. | **Sangat Rendah.** Terlindungi oleh serialisasi DTO dan otorisasi Express. |
| **Dukungan Peserta Tamu (Tanpa Akun)** | **Tidak Mendukung.** Tamu tidak memiliki JWT Supabase Auth. | **Mendukung.** Dapat menggunakan token kapabilitas HMAC untuk channel temporer atau polling fallback. | **Sangat Mendukung.** Berjalan mulus menggunakan stateless HTTP endpoint tamu. |
| **Latensi Pembaruan UI** | Seketika (< 200 ms). | Seketika (< 300 ms). | Tertunda (sesuai interval 15–60 detik). |
| **Beban Jaringan & Baterai Klien** | Ringan (1 koneksi socket panjang). | Ringan (1 koneksi socket panjang). | Sedang-Tinggi (request berulang periodik). |
| **Estimasi Diff Baris Kode** | **Besar:** > 600 baris SQL + 350 baris FE. | **Kecil & Ramping:** ~150 baris BE + ~120 baris FE. | **Kecil:** ~80 baris BE + ~90 baris FE. |
| **Rekomendasi Arsitektural** | **DITOLAK (High Security Risk)** | **DIREKOMENDASIKAN (Pilihan Utama)** | **DITERIMA (Sebagai Fallback / Tamu)** |

---

## 5. Keputusan Arsitektur Frontend Caching

### 5.1. Evaluasi Opsi: TanStack Query vs In-Memory Caching Ringan

1. **Opsi 1: TanStack Query (`@tanstack/react-query`)**  
   - *Kelebihan:* Pengelolaan siklus hidup cache otomatis, garbage collection, penanganan *race conditions*, dan refetch on window focus.  
   - *Kelemahan & Pertimbangan di SiCARE:*  
     - Paket belum terpasang di `fe/package.json`. Sesuai aturan `AGENTS.md` Bagian 2 & 5, penambahan dependensi baru memerlukan izin eksplisit dan menambah beban bundle size (bundle JS SiCARE saat ini berada di kisaran ~1,4 MB).  
     - Mengharuskan refactor masif pada seluruh ~25 halaman dan puluhan komponen untuk beralih dari pola `useState`/`useEffect` ke custom hooks `useQuery` dan `useMutation`.
2. **Opsi 2: In-Memory Caching Terpusat di `fe/src/lib/api.ts` (Direkomendasikan)**  
   - *Kelebihan:*  
     - **Zero Dependency:** Dibangun menggunakan struktur data JavaScript bawaan (`Map` dengan kunci URL query dan metadata TTL).  
     - **Non-Breaking & Transparan:** Komponen UI dan wrapper domain (`sicareApi.ts`, `counselorApi.ts`, `adminApi.ts`) tetap memanggil fungsi yang sama tanpa perubahan signature kontrak.  
     - **Invalidasi Otomatis Berbasis Mutasi:** Setiap kali pemanggilan mutasi HTTP (`POST`, `PATCH`, `DELETE`) dieksekusi dengan sukses melalui `fetchApi`, cache query terkait secara otomatis dihapus (misal mutasi booking membersihkan cache prefix `api:v1:bookings`).  
     - **Sinergi dengan Real-Time Broadcast:** Ketika event broadcast masuk dari WebSocket, frontend cukup mengeksekusi `apiCache.invalidate('bookings')` dan memanggil ulang fungsi pemuat data.

### 5.2. Desain Mekanisme In-Memory Cache Ringan
```typescript
// Desain konseptual modul cache pada fe/src/lib/apiCache.ts
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class ApiCache {
  private store = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.data as T;
  }

  set<T>(key: string, data: T, ttlSeconds: number): void {
    this.store.set(key, { data, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  invalidate(pattern: string): void {
    for (const key of this.store.keys()) {
      if (key.includes(pattern)) {
        this.store.delete(key);
      }
    }
  }

  clear(): void {
    this.store.clear();
  }
}
```

---

## 6. Estimasi Cakupan Real-Time per Tabel Sistem

| Nama Tabel Data | Kebutuhan Real-Time | Target Penerima Event | Event Trigger yang Dibroadcast | Dampak Privasi Klinis |
| :--- | :--- | :--- | :--- | :--- |
| **`notifications`** | **Sangat Tinggi** | Klien, Konselor, Admin, Kepala LMI | `notification.created`, `notification.read` | Rendah (Pemberitahuan badge lonceng navbar). |
| **`bookings`** | **Tinggi** | Klien Pembuat & Konselor Ditugaskan | `booking.status_changed` (`confirmed`, `rejected`, `rescheduled`, `cancelled`) | Sedang (Perubahan jadwal & status persetujuan sesi). |
| **`counseling_sessions`** | **Tinggi** | Klien & Konselor | `session.transitioned` (`ongoing`, `completed`, `cancelled`) | Tinggi (Status kehadiran sesi; catatan klinis **tidak** dikirim via broadcast). |
| **`consent_invitations`** | **Sedang** | Konselor & Klien Utama | `invitation.status_changed` (`sent`, `claimed`, `revoked`) | Rendah (Hanya status operasional kelengkapan undangan). |
| **`informed_consents`** | **Tinggi** | Konselor & Klien Utama (Ringkasan) | `consent.signed`, `consent.readiness_ready` | **Sangat Tinggi.** Broadcast hanya memancarkan counter/status persetujuan (`participant_id`, `status: signed`). Snapshot identitas & PDF tetap terkunci di Express. |
| **`feedback`** | **Rendah** | Admin & Kepala LMI | `feedback.submitted`, `feedback.reviewed` | Rendah (Pemberitahuan adanya umpan balik baru dari mahasiswa). |

---

## 7. Daftar Migrasi Prospektif (Hanya Inventarisasi — Tidak Dijalankan)

Berdasarkan rekomendasi **Opsi B (Supabase Broadcast)**:  
> **Catatan Kepatuhan:** Untuk mengimplementasikan Opsi B, **TIDAK ADA MIGRASI DATABASE YANG DIBUTUHKAN**. Seluruh infrastruktur memanfaatkan kapabilitas channel WebSocket Supabase yang sudah aktif pada project Supabase yang ada.

*Catatan Kontinjensi (Hanya jika di masa depan arsitektur diubah ke Opsi A):*  
Jika tim di masa depan memutuskan menggunakan CDC WAL (Opsi A), migrasi berikut akan diwajibkan:
1. `supabase/migrations/YYYYMMDD_realtime_publication.sql`:  
   `ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;`  
   `ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;`  
   `ALTER PUBLICATION supabase_realtime ADD TABLE public.counseling_sessions;`
2. `supabase/migrations/YYYYMMDD_realtime_rls_policies.sql`:  
   Pembuatan RLS `SELECT` terpisah untuk setiap peran pengguna pada tabel-tabel di atas.

---

## 8. Keputusan yang Memerlukan Pengesahan Pemilik Produk (*Product Owner*)

Sebelum implementasi teknis Opsi B dimulai pada batch berikutnya, hal-hal berikut diajukan untuk disahkan:
1. **Kebijakan Pengalaman Pengguna (UX Audio & Visual):**  
   Apakah notifikasi real-time yang masuk cukup berupa pembaruan visual lencana (badge angka) dan pembaruan dinamis daftar notifikasi pada `NotificationBell`, atau apakah diperlukan *toast notification* / suara lonceng halus saat pengguna sedang aktif membuka halaman?
2. **Perlakuan Khusus Peserta Tamu Konseling Kelompok:**  
   Untuk modal kesiapan consent di sisi konselor (`GroupConsentModal`), apakah pembaruan status tanda tangan anggota tamu cukup menggunakan pembaruan saat modal dibuka ditambah Controlled Polling (interval 10 detik selama modal aktif), atau konselor mendengarkan channel broadcast booking terkait? *(Rekomendasi teknis: Konselor mendengarkan broadcast booking pada channel privat konselor).*
3. **Batas Masa Simpan Cache di Memori Browser (TTL):**  
   Apakah disetujui konfigurasi default:  
   - Profil Pengguna & Data Master: TTL 5 menit.  
   - Ketersediaan Jadwal (*Availability*): TTL 30 detik.  
   - Daftar Notifikasi: Invalidation-driven (hanya diperbarui saat ada event broadcast atau aksi pengguna).
4. **Adopsi Dependensi Jangka Panjang:**  
   Apakah disetujui untuk tetap mempertahankan arsitektur in-memory cache ringan tanpa menambah `@tanstack/react-query` demi menjaga ukuran bundle JavaScript SiCARE tetap optimal?

---

## 9. Rencana Tahapan Implementasi Bertahap (*Phased Rollout Plan*)

### Tahap 1: In-Memory Query Cache & Invalidation Helper di Frontend
- **Scope:** Membuat modul `fe/src/lib/apiCache.ts` dan mengintegrasikannya ke `fe/src/lib/api.ts` secara transparan.
- **Acceptance Criteria:**  
  - Query GET identik dalam jendela TTL tidak mengirim request HTTP berulang.  
  - Eksekusi mutasi (POST/PATCH/DELETE) secara instan menghapus entri cache terkait.  
  - Bundle size tidak bertambah secara signifikan (< 3 KB tambahan).
- **Pengujian Non-Produksi:** Unit test in-memory cache dan verifikasi Network Tab di browser.

### Tahap 2: Backend Supabase Broadcast Service
- **Scope:** Membuat layanan `be/src/services/realtimeBroadcast.service.js` menggunakan `getSupabaseAdminClient()`.
- **Integrasi:** Memanggil broadcast pada mutasi booking (`transitionBooking`), notifikasi (`createNotification`), dan penandatanganan consent (`signInformedConsent`).
- **Acceptance Criteria:**  
  - Panggilan broadcast dibungkus dalam blok try-catch aman (kegagalan broadcast tidak boleh membatalkan transaksi database utama).  
  - Log audit mencatat jika pengiriman broadcast mengalami kegagalan.
- **Pengujian Non-Produksi:** Backend integration test dengan mock Supabase Realtime channel.

### Tahap 3: Frontend WebSocket Hook (`useUserRealtime`) & Integrasi NotificationBell
- **Scope:** Membuat hook `fe/src/hooks/useUserRealtime.ts` yang menyambungkan browser ke channel privat pengguna `private:user:${user.id}` menggunakan client dari `getSupabaseClient()`.
- **Integrasi:** Menghubungkan event masuk ke fungsi invalidasi cache dan pembaruan state `NotificationBell.tsx` serta modal persetujuan kelompok.
- **Acceptance Criteria:**  
  - Lencana notifikasi bertambah secara instan (< 500 ms) saat notifikasi baru ditujukan ke pengguna.  
  - Pemutusan koneksi jaringan secara anggun mencoba menyambung kembali (*auto-reconnect* dengan backoff).
- **Pengujian Non-Produksi:** Skenario uji 2 browser bersamaan (Browser A sebagai Konselor menyetujui booking, Browser B sebagai Klien menerima pembaruan secara langsung).

---

*Dokumen perencanaan ini disusun sebagai acuan teknis resmi arsitektur real-time dan caching SiCARE tanpa mengubah satu baris pun kode produksi atau skema database pada batch ini.*

