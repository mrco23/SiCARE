# SiCARE

SiCARE adalah aplikasi layanan konseling berbasis web dengan frontend React, API backend Express, dan Supabase untuk autentikasi serta database. Aplikasi memiliki area publik dan role Klien, Konselor, Admin, serta Kepala LMI.

> **Status proyek:** integrasi API sedang diaudit dan dilanjutkan bertahap. Build, lint, test lengkap, serta integrasi live belum dinyatakan lulus. Lihat [`docs/PROJECT_STATUS.md`](docs/PROJECT_STATUS.md) untuk status aktual.

## Mulai dari sini

1. Baca [`AGENTS.md`](AGENTS.md) sebelum meminta AI coding agent mengubah kode.
2. Baca [`docs/README.md`](docs/README.md) untuk indeks dokumentasi.
3. Baca [`docs/ROADMAP.md`](docs/ROADMAP.md) untuk tahapan pengerjaan.
4. Baca [`docs/PROJECT_STATUS.md`](docs/PROJECT_STATUS.md) untuk progres, kendala, dan pekerjaan berikutnya.

## Struktur repository

- `fe/`: frontend React, TypeScript, Vite, Tailwind CSS, React Router, dan Zustand.
- `be/`: API Express dengan prefix `/api/v1`.
- `supabase/migrations/`: migrasi SQL yang diberi nomor timestamp.
- `docs/integration/`: matriks endpoint dan cakupan SOP.
- `docs/backend/`: dokumentasi implementasi API, database, dan verifikasi backend.
- `docs/refactor/`: rencana dan catatan historis refactor frontend.

## Prasyarat

- Node.js yang kompatibel dengan Vite 8; backend menyatakan `node >=22`.
- Akses ke project Supabase pengembangan yang benar jika menjalankan API terintegrasi.
- Environment lokal terpisah untuk frontend dan backend. Jangan commit file `.env` atau secret.

## Menjalankan frontend

Dari folder `fe/`:

```bash
npm ci
cp .env.example .env
npm run dev
```

Atur `VITE_API_BASE_URL` dengan base URL yang menyertakan `/api/v1`, misalnya `http://127.0.0.1:3000/api/v1`. Frontend hanya boleh memakai Supabase publishable/anon key.

Pemeriksaan frontend:

```bash
npm run build
npm run lint
```

## Menjalankan backend

Dari folder `be/`:

```bash
npm ci
cp .env.example .env
npm run check
npm test
npm run dev
```

Isi variabel Supabase server di `be/.env`. Secret/service-role key hanya boleh berada di environment backend. Jangan menjalankan migrasi remote sebelum memeriksa project reference, riwayat migrasi, dan persetujuan untuk target tersebut.

## Catatan database

Daftar migrasi yang tersedia pada snapshot dan migrasi yang masih hilang dicatat di [`supabase/README.md`](supabase/README.md) serta [`docs/PROJECT_STATUS.md`](docs/PROJECT_STATUS.md). Jangan menganggap semua endpoint siap dipakai hanya karena route backend tersedia.
