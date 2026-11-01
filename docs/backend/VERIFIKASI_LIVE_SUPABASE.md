# Verifikasi API terhadap Supabase aktif

Tujuan tahap ini adalah menguji skema/migrasi remote, endpoint publik, autentikasi, dan otorisasi role sebelum frontend diintegrasikan. Status akhir pemeriksaan pada 29 Oktober 2026: **57 passed, 0 failed, 0 role skipped**. Skrip ini tidak membuat booking, jadwal, feedback, periode, atau akun. Pemeriksaan `PATCH` untuk role yang tidak berwenang harus berhenti di middleware otorisasi sebelum menyentuh database.

## 1. Status migrasi dan metadata Hero yang sudah diperiksa

Pada pemeriksaan 29 Oktober 2026, `npx supabase migration list` menunjukkan kelima ID migrasi lokal sama dengan remote: `20261027000000`, `20261028000000`, `20261028120000`, `20261028130000`, dan `20261029100000`.

Query read-only ke project remote mengonfirmasi tabel `public.hero_motivations`, kolom `id`, `content`, `is_active`, `created_at`, `updated_at`, constraints panjang dan single-line, trigger `hero_motivations_set_updated_at`, fungsi `set_updated_at()`, RLS aktif tanpa policy, serta grants yang terlihat untuk `postgres` dan `service_role`. Tidak ada migrasi atau mutasi data yang dijalankan selama pemeriksaan ini.

Karena migration history dan metadata Hero sudah cocok, jangan menjalankan `db push`, `migration repair`, atau SQL DDL manual untuk Hero hanya demi mengulang pemeriksaan. Jika suatu saat ada perubahan migrasi lain, pastikan project linked benar sebelum dry run.

## 2. Jalankan backend

Di terminal pertama:

```powershell
cd be
npm ci
npm run dev
```

Pastikan backend memakai URL dan key server yang sesuai dengan project Supabase yang sama. Jangan mengirim atau menempelkan nilai `.env` ke chat atau commit.

## 3. Jalankan smoke test publik dan tanpa token

Di terminal kedua, dari folder `be`:

```powershell
npm run verify:live
```

Skrip menguji health, direktori konselor, periode publik, ketersediaan jadwal, feedback publik, serta respons `401` untuk endpoint yang dilindungi tanpa token.

Jika ada endpoint publik yang mengembalikan `503`, periksa konfigurasi Supabase backend. Jika mengembalikan `500`, periksa log backend dan apakah migrasi serta kolom yang dibutuhkan sudah tersedia. Respons `200` dengan array kosong dapat valid bila belum ada data publik.

## 4. Hasil smoke test dasar (29 Oktober 2026)

Pengguna menjalankan `npm run verify:live` terhadap `http://127.0.0.1:3000`. Hasil: **15 passed, 0 failed, 4 role token skipped**. Keenam endpoint publik mengembalikan 200 dan sembilan endpoint terlindungi tanpa token mengembalikan 401. Ini mengonfirmasi keterjangkauan endpoint dasar dan proteksi token wajib, tetapi belum membuktikan hak akses per-role.

## 5. Verifikasi keempat role

Gunakan hanya akun uji yang aktif untuk setiap role: `client`, `counselor`, `admin`, dan `head_lmi`. Ambil access token setelah login ke backend/API. Jangan memakai `service_role` key sebagai bearer token.

Set token pada terminal PowerShell saat ini saja. Ganti placeholder dengan access token akun uji; jangan commit token atau menambahkannya ke `.env`:

```powershell
$env:SICARE_CLIENT_TOKEN = '<access-token-client-uji>'
$env:SICARE_COUNSELOR_TOKEN = '<access-token-konselor-uji>'
$env:SICARE_ADMIN_TOKEN = '<access-token-admin-uji>'
$env:SICARE_HEAD_LMI_TOKEN = '<access-token-kepala-lmi-uji>'
$env:SICARE_REQUIRE_ALL_ROLES = '1'
npm run verify:live
```

Skrip melakukan GET read-only untuk endpoint role yang diizinkan, serta beberapa request PATCH yang seharusnya ditolak dengan `403` sebelum data diproses. Ia tidak melakukan operasi tulis yang sah.

Setelah selesai, hapus token dari environment terminal:

```powershell
Remove-Item Env:SICARE_CLIENT_TOKEN, Env:SICARE_COUNSELOR_TOKEN, Env:SICARE_ADMIN_TOKEN, Env:SICARE_HEAD_LMI_TOKEN, Env:SICARE_REQUIRE_ALL_ROLES -ErrorAction SilentlyContinue
```

## 6. Hasil akhir verifikasi empat role (29 Oktober 2026)

Pengguna menjalankan ulang skrip setelah script login PowerShell memeriksa bahwa `response.data.profile.app_role` sama dengan role yang diminta. Hasil akhir: **57 passed, 0 failed, 0 role token skipped**. Dari jumlah itu, 15 adalah pemeriksaan dasar (endpoint publik dan endpoint tanpa token), sedangkan 42 adalah pemeriksaan role untuk `client`, `counselor`, `admin`, dan `head_lmi`. Semua kasus akses yang diizinkan pada matriks mengembalikan 200, dan seluruh kasus lintas-role yang dicakup skrip mengembalikan 403. Tidak ada record bisnis yang dibuat atau diubah.

Percobaan role sebelumnya yang menghasilkan kegagalan tidak dipakai sebagai hasil akhir karena slot token belum memverifikasi role aktual akun. Setelah pemeriksaan role ditambahkan dan token dimuat ulang, seluruh matriks lulus.

Smoke test ini tidak menggantikan pengujian ownership lintas-user secara menyeluruh, seluruh operasi CRUD, atau E2E browser. P0 dapat ditutup untuk baseline dan pemeriksaan live API yang dicakup skrip.

## 7. Cara membaca hasil

- `200`: endpoint role yang diizinkan dapat dijangkau. Periksa isi data dan konsistensi domain secara manual juga.
- `401`: token hilang, tidak valid, atau sesi kedaluwarsa. Pada pemeriksaan tanpa token, ini hasil yang diharapkan.
- `403`: token valid tetapi role tidak berhak. Pada pemeriksaan role yang ditolak, ini hasil yang diharapkan.
- `404`: kemungkinan route tidak terpasang pada prefix yang benar atau endpoint tidak ada.
- `400`/`409`: dapat menunjukkan validasi atau konflik aturan bisnis. Untuk pemeriksaan GET biasa, ini perlu diselidiki.
- `500`: cek log backend dan kesesuaian skema/migrasi remote.
- `503`: konfigurasi service Supabase backend tidak tersedia atau belum lengkap.

Skrip ini adalah smoke test integrasi, bukan bukti formal bahwa seluruh CRUD atau seluruh aturan database benar. Operasi tulis seperti pembuatan akun, perubahan periode, moderasi feedback, dan perubahan jadwal harus diuji terpisah dengan data uji yang dapat dibuang di project non-production.
