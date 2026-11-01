# SiCARE Supabase migrations

Direktori ini berisi migrasi SQL bernomor timestamp untuk skema SiCARE. Snapshot kerja saat ini memuat lima file migrasi. Keberadaan file migrasi lokal tidak membuktikan bahwa migrasi sudah diterapkan ke database Supabase.

## Migration order

Jalankan migrasi yang memang belum diterapkan dalam urutan timestamp setelah memeriksa target project dan riwayat migrasi:

1. `migrations/20261027000000_sicare_core_schema.sql` membuat tabel domain inti, trigger, grants, dan kebijakan RLS.
2. `migrations/20261028000000_sicare_booking_sessions_feedback_notifications.sql` menambahkan RPC transaksional untuk booking, sesi, feedback, dan notifikasi.
3. `migrations/20261028120000_sicare_public_availability_rescheduling.sql` menambahkan filter ketersediaan publik, alur reschedule klien, dan `bookings.reschedule_reason`.
4. `migrations/20261028130000_sicare_admin_availability_management.sql` menambahkan RPC server-side untuk pengelolaan slot ketersediaan konselor.
5. `migrations/20261029100000_sicare_hero_motivations.sql` membuat tabel kalimat motivasi Hero, validasi panjang dan satu baris, trigger `updated_at`, RLS, serta grants server-only. Migrasi ini disusun dari kontrak route, validasi Zod, dan tes yang tersedia. Migrasi belum diverifikasi atau diterapkan pada database remote.

### Status migrasi Hero

File `20261029100000_sicare_hero_motivations.sql` sekarang tersedia di snapshot kerja dan memenuhi kontrak yang diperiksa oleh `be/test/heroMotivations.test.js`. Ini hanya verifikasi statis. Sebelum penerapan, periksa target Supabase dan migration history, lalu jalankan dry run pada lingkungan non-produksi. Jangan membuat data seed atau menjalankan perubahan remote tanpa persetujuan eksplisit. Catat hasil verifikasi di [`../docs/PROJECT_STATUS.md`](../docs/PROJECT_STATUS.md).

Migrasi yang tersedia tidak membuat data dummy, jawaban intake, catatan konseling, atau data consent/tanda tangan. Informed consent tetap belum diimplementasikan sampai dokumen resmi dan prosesnya tersedia.

## Important before applying

- Konfirmasi project reference Supabase yang dituju.
- Tinjau migration history dan migrasi pending sebelum menjalankan perubahan. Jangan mengedit atau menjalankan ulang migrasi yang sudah tercatat diterapkan; buat migrasi baru untuk perubahan lanjutan.
- Jangan commit `.env`, Supabase secret/service-role keys, atau token Fonnte.
- API menggunakan key server-side untuk RPC berhak istimewa. Jangan pernah mengekspos key tersebut ke frontend.
- Utamakan database non-produksi untuk verifikasi tulis.

## Recommended CLI workflow

1. Instal Supabase CLI mengikuti instruksi resmi untuk sistem operasi yang digunakan.
2. Dari root repository, autentikasi dan tautkan project yang sudah dikonfirmasi:

   ```powershell
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   ```

3. Periksa riwayat dan status migrasi sebelum menerapkan perubahan:

   ```powershell
   supabase migration list
   supabase db push --dry-run
   ```

4. Tinjau output dry run. Terapkan hanya setelah target, urutan, dan perubahan yang pending disetujui:

   ```powershell
   supabase db push
   ```

5. Periksa tabel, fungsi, grants, dan kebijakan RLS di Supabase Dashboard atau melalui query SQL yang disetujui.

Jangan menjalankan ulang migrasi secara manual di SQL Editor setelah `supabase db push` berhasil. Jika memakai SQL Editor, koordinasikan history migrasi sebelum kembali menggunakan CLI.
