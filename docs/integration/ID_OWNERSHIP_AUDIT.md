# Audit ID Kanonis dan Ownership SiCARE

**Tanggal:** 30 Oktober 2026
**Tahap:** 1, Batch 1.3
**Status:** Audit source statis selesai; pengujian ownership lintas-pengguna saat runtime masih perlu dilakukan.

## Ringkasan

Audit source backend dan migrasi tidak menemukan bypass ownership yang jelas pada jalur booking, sesi, feedback, notifikasi, profil, dan jadwal yang diperiksa. Handler menggunakan identitas dari token yang diverifikasi, lalu membatasi query atau meneruskan actor ID ke fungsi domain yang memeriksa kepemilikan.

Temuan ini adalah hasil pemeriksaan statis. Ini bukan sertifikasi keamanan penuh, dan belum menggantikan pengujian runtime dengan dua akun berbeda pada role yang sama.

## 1. ID kanonis

`profiles.id` adalah UUID yang mereferensikan `auth.users.id`. Relasi domain mengikuti UUID ini:

- `counselor_profiles.profile_id` mengacu ke `profiles.id`.
- `bookings.client_id` dan `bookings.counselor_id` mengacu ke `profiles.id`.
- `availability_slots.counselor_id` mengacu ke `profiles.id`.
- `counseling_sessions.booking_id` mengacu ke booking dan `counselor_id` mengacu ke profil konselor.
- `feedback.session_id`, `client_id`, dan `counselor_id` mengacu ke record domain kanonis.
- `notifications.recipient_user_id` mengacu ke profil penerima.
- ID record domain dibuat sebagai UUID oleh PostgreSQL.

DTO API di `fe/src/types/api.ts` memakai `string` untuk ID. Ini sesuai dengan UUID yang diterima/dikembalikan API. ID numerik yang masih berada di `fe/src/data/mock/` adalah ID fixture untuk halaman yang belum dimigrasikan. Jangan meneruskan ID mock ke endpoint API atau mengubah UUID menjadi angka.

## 2. Pemeriksaan ownership yang ditemukan

| Domain | Pemeriksaan pada source | Status statis |
|---|---|---|
| Identitas autentikasi | Middleware memverifikasi token dengan `auth.getUser()`, mencari profil menggunakan `authData.user.id`, dan menolak akun nonaktif. | PASS |
| Profil dan consent WhatsApp | Query update memakai ID dari pengguna terautentikasi; schema tidak menerima `id` atau `app_role` dari body profil biasa. | PASS |
| Booking list/detail | Daftar dan detail membatasi record berdasarkan `client_id` atau `counselor_id` sesuai role. | PASS |
| Booking create | RPC memeriksa client aktif, role client, konselor aktif/publik, slot milik konselor, dan konflik jadwal. | PASS |
| Booking transition | RPC memeriksa actor aktif, role, dan kesesuaian actor dengan `client_id`/`counselor_id` booking sebelum transisi. | PASS |
| Booking reschedule | RPC memeriksa bahwa booking milik client yang meminta perubahan dan slot pengganti milik konselor yang sama. | PASS |
| Sesi list/detail | Daftar sesi dibangun dari booking milik pengguna; detail memverifikasi pihak booking sebelum mengembalikan konteks sesi. | PASS |
| Transisi sesi | RPC memeriksa bahwa actor adalah konselor aktif yang memiliki sesi tersebut. | PASS |
| Feedback client | Daftar feedback difilter berdasarkan client terautentikasi; submit hanya untuk sesi selesai yang booking-nya dimiliki client. Constraint mencegah lebih dari satu feedback per client/session. | PASS |
| Feedback counselor | Endpoint hanya mengembalikan feedback berstatus `shown` untuk `counselor_id` konselor yang terautentikasi. | PASS |
| Moderasi dan review feedback | Handler dibatasi ke role admin atau head LMI sesuai operasi. | PASS |
| Notifikasi | Daftar, hitung unread, read-all, dan read-by-ID dibatasi ke `recipient_user_id` pengguna yang terautentikasi. | PASS |
| Profil dan jadwal konselor | Profil dibatasi dengan `profile_id` pengguna. Fungsi simpan/batal jadwal memeriksa profil konselor aktif dan memastikan slot dimiliki konselor tersebut. | PASS |
| Data administratif | Handler akun/periode/admin dibatasi melalui middleware role; domain writes di browser dicabut dan RPC sensitif diberikan ke `service_role`. | PASS |

## 3. Regression test statis yang ditambahkan

File baru `be/test/ownershipGuards.test.js` menambahkan 9 pemeriksaan source-level untuk menjaga agar pola autentikasi, owner filter, RPC ownership, batas role, grants, dan tipe ID kanonis tidak hilang tanpa disadari.

Pemeriksaan terisolasi:

- `node --test be/test/ownershipGuards.test.js`: **9 lulus, 0 gagal**.

Tes ini membaca source dan migrasi. Tes ini tidak memanggil Supabase dan tidak membuktikan isolasi data pada runtime.

## 4. Gap yang masih harus ditutup

1. **Pengujian runtime lintas-pengguna dengan role sama belum dilakukan.** Smoke test 57/57 sebelumnya menguji akses role dan penolakan lintas-role. Smoke test tersebut tidak membuktikan bahwa client A tidak bisa membaca resource client B atau counselor A tidak bisa membaca resource counselor B.
2. **Harness live belum memiliki pasangan token untuk role yang sama.** Untuk menguji isolasi secara nyata, siapkan minimal dua akun uji client dan dua akun uji counselor yang berbeda. Gunakan data yang sudah ada dan lakukan pemeriksaan read-only; jangan membuat atau mengubah booking hanya untuk meluluskan tes tanpa persetujuan.
3. **ID numerik masih ada di mock data.** Ini belum menjadi bug pada dirinya sendiri selama mock terisolasi. Setiap halaman harus berpindah ke DTO backend sebelum handler-nya menggunakan ID untuk operasi API.
4. **E2E browser lintas-role belum dilakukan.** Pemeriksaan API tidak membuktikan alur UI, refresh, empty state, atau perilaku error.

## 5. Kriteria penutupan Batch 1.3

- [x] ID kanonis dan relasi utama dipetakan.
- [x] Ownership filter pada route dan RPC utama ditinjau.
- [x] Regression test statis ditambahkan dan lulus secara terisolasi.
- [ ] Seluruh backend test lulus setelah test baru ditambahkan.
- [ ] Live cross-user checks lulus untuk dua client dan dua counselor.
- [ ] Temuan yang tersisa dicatat sebelum beralih ke Batch 1.4.

Jangan menambah migration atau mengubah data remote untuk menutup batch ini. Jika live cross-user test menemukan masalah, perbaiki jalur spesifik tersebut dengan tes regresi sebelum meneruskan integrasi UI.
