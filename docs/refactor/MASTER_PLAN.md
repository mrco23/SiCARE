# Master Refactor Plan SiCARE v1.1 (Rencana Refactor Frontend)

**Status:** Dokumen historis untuk konsistensi visual dan modularisasi frontend. Baseline awal berasal dari snapshot `fe(5).zip`, 26 Oktober 2026.
**Cakupan dokumen ini:** Refactor visual dan struktur frontend. Dokumen ini bukan kontrak integrasi API dan tidak menggambarkan kondisi full-stack terbaru.
**Sumber implementasi terkini:** Working tree, `../integration/API_ENDPOINT_MATRIX.md`, dan `../integration/SOP_COVERAGE_MATRIX.md`.

> **Penting:** instruksi lama dalam rencana ini yang menyatakan “tanpa backend/database”, menunda API, atau menganggap seluruh data sebagai mock hanya berlaku untuk prototipe sebelum backend ditambahkan. Untuk pekerjaan integrasi, ikuti matriks di `../integration/`. Tahap 0 pada dokumen ini adalah audit refactor frontend lama, bukan Tahap 0 integrasi API yang dicatat pada `../PROJECT_STATUS.md`.

## A. Sasaran

1. UI konsisten pada setiap role: Admin, Klien, Konselor, Kepala LMI; area publik dan auth mempertahankan karakter masing-masing.
2. Warna utama `#064E3B` pada semua elemen dengan peran *primary brand*.
3. Halaman fokus pada komposisi. UI reusable di `components`, business logic di `features`, model di `types`, status di `constants/status`.
4. Data dummy terpusat di `src/data/mock`, dengan ID dan relasi yang konsisten.
5. Zustand hanya untuk shared state lintas halaman: booking, informed consent, feedback (serta domain lain hanya bila teridentifikasi perlu).
6. Tidak kehilangan route, fitur, interaksi, desain, aksesibilitas, atau responsivitas yang sudah ada.
7. Hasil setiap subtugas diverifikasi sebelum tahap berikutnya.

## B. Fakta Awal dari Snapshot

- Stack dari `package.json`: React `^19.2.8`, React Router DOM `^7.5.0`, Tailwind `^4.3.3`, Vite `^8.3.0`, TypeScript `~6.0.2`.
- Script: `npm run build` (`tsc -b && vite build`), `npm run lint` (`eslint .`).
- `src/app/router.tsx` memuat role routes `/klien/*`, `/konselor/*`, `/admin/*`, `/kepala-lmi/*`, serta halaman publik dan autentikasi.
- Sudah ada `src/components/auth/`, `src/components/home/`, `src/components/shared/`, `src/components/ui/`, `src/features/`, `src/constants/status.ts`, `src/types/`, `src/lib/academicPeriods.ts`, `src/services/`.
- `src/data/mock/` **belum ada** di snapshot.
- `src/index.css` **sudah** mendefinisikan `--color-primary: #064e3b` dalam `@theme`; namun banyak komponen masih memakai HEX literal lain.
- Zustand **belum tercantum** dalam dependensi ZIP.
- Ada sumber state `sessionStorage` dan `localStorage` spesifik fitur; perlu inventaris sebelum disatukan.
- Beberapa TSX yang sebelumnya diedit secara terpisah dalam percakapan **tidak identik** dengan salinan di ZIP. Agent harus memeriksa working tree terbaru, jangan menyalin balik snapshot secara otomatis.
- File `/informed-consent.pdf` direferensikan oleh halaman klien/konselor; keberadaannya di `public/` harus diperiksa dalam working tree aktual.

**Catatan:** Poin di atas adalah observasi statis dari ZIP. Ini **bukan** klaim bahwa project sudah lolos build/lint/run.

## C. Struktur Target (bertambah seperlunya)

```text
src/
├── app/
│   └── router.tsx
├── assets/
├── components/
│   ├── ui/                 # primitives: modal, button, field, tabs
│   ├── shared/             # PageContainer, PageHeader, shared filter
│   ├── auth/
│   ├── public/
│   ├── client/
│   ├── counselor/
│   ├── admin/
│   └── headlmi/
├── features/
│   ├── auth/
│   ├── booking/
│   │   ├── hooks/
│   │   ├── store/
│   │   ├── selectors/
│   │   └── utils/
│   ├── counseling/
│   ├── consent/
│   ├── feedback/
│   ├── history/
│   ├── academic-period/
│   ├── mood/
│   ├── notification/
│   └── reports/
├── data/
│   ├── mock/
│   │   ├── users.ts
│   │   ├── clients.ts
│   │   ├── counselors.ts
│   │   ├── bookings.ts
│   │   ├── counselingSessions.ts
│   │   ├── consents.ts
│   │   ├── feedbacks.ts
│   │   ├── academicPeriods.ts
│   │   └── index.ts
│   └── fixtures/
│       └── scenarios.ts
├── constants/
│   ├── status/
│   │   ├── bookingStatus.ts
│   │   ├── counselingStatus.ts
│   │   ├── feedbackStatus.ts
│   │   └── consentStatus.ts
│   └── registerOptions.ts
├── types/
│   ├── auth.ts
│   ├── user.ts
│   ├── booking.ts
│   ├── counseling.ts
│   ├── feedback.ts
│   ├── consent.ts
│   └── academicPeriod.ts
├── lib/
│   ├── date.ts
│   ├── formatters.ts
│   └── storage.ts
├── layouts/
│   ├── AdminLayout.tsx
│   ├── KlienLayout.tsx
│   ├── KonselorLayout.tsx
│   ├── KepalaLMILayout.tsx
│   └── PublicLayout.tsx
├── pages/
│   ├── auth/
│   ├── public/
│   ├── client/
│   ├── counselor/
│   ├── admin/
│   └── headlmi/
├── services/             # adapter domain bila diperlukan; hindari wrapper API duplikat
├── App.tsx
├── index.css
└── main.tsx
```

Nama file di atas adalah **rancangan**, bukan instruksi menciptakan seluruh placeholder. Folder yang belum dibutuhkan boleh belum dibuat. Komponen yang hanya dipakai satu fitur dapat ditempatkan di dalam fitur terkait bila lebih jelas; dokumentasikan pilihan.

## D. Urutan dan *Deliverable* per Tahap

### Tahap 0. Baseline, audit, dan pemetaan dampak (tanpa ubah kode aplikasi)
- `git status`, pastikan tidak ada perubahan user yang tertimpa.
- Inventaris semua route, layout, halaman, modul, CSS inline, modal, status, mock data, storage keys.
- Catat ukuran file besar, dependensi impor, komponen duplikat, kondisi empty/error state.
- `npm ci` bila dependensi belum tersedia dan lingkungan mengizinkan, kemudian `npm run build`, `npm run lint`; catat *sebagaimana adanya* termasuk error baseline.
- Tangkap screenshot desktop/mobile untuk halaman representative bila browser tersedia; jika tidak, catat NOT RUN dan halaman yang perlu review manusia.
- Dokumentasikan temuan dan risiko pada `../PROJECT_STATUS.md`; gunakan `PROGRESS.md` hanya sebagai arsip audit statis Tahap 0.
- **Dilarang mengedit `src/` pada tahap ini.**

### Tahap 1. Warna dan fondasi design tokens
- Audit setiap HEX, class warna, CSS `<style>`, inline `style={{...}}`, animasi.
- Tetapkan `#064E3B` sebagai primary brand di `src/index.css`; pertahankan semantic error/warning/rating.
- Buat mapping literal lama → token baru dan daftar komponen terdampak.
- Migrasikan bertahap dengan pembuktian visual; lakukan tanpa perubahan ukuran/spacing dulu.
- Jangan memindahkan seluruh Tailwind className ke CSS.

### Tahap 2. Standarisasi layout dan tipografi setiap role
- Bangun `PageContainer` dan `PageHeader` yang menjaga heading, max-width, padding, dan responsivitas per role.
- Sesuaikan `AdminLayout`, `KlienLayout`, `KonselorLayout`, `KepalaLMILayout` agar setiap page memperoleh **satu wrapper**.
- Hindari double padding dan nested max-width; hanya pengecualian yang dicatat boleh tetap.
- Judul H1: `text-2xl sm:text-3xl font-extrabold tracking-tight` sebagai standar kecuali halaman memiliki alasan khusus yang disetujui.
- Audit halaman satu per satu: ukuran konten, sidebar offset, sticky navbar, footer, mobile bottom navigation.

### Tahap 3. Types, constants, dan utilitas
- Audit `src/constants/status.ts`, semua union type status lokal, `src/types/*` dan `src/lib/academicPeriods.ts`.
- Buat status kanonis serta mapping dari nilai lama; jangan menukar arti status tanpa persetujuan.
- Definisikan shared types, util tanggal/format tanpa mengubah perilaku tanggal/timezone.
- Ganti secara incremental; jaga kompatibilitas import.

### Tahap 4. Konsolidasi data dummy
- Buat `src/data/mock/` untuk seed data yang stabil dan saling mengacu via ID.
- Inventaris dataset berdasarkan route/role. Bedakan booking, request, session, client note, counselor note, consent, feedback.
- Buat tabel mapping ID sumber → ID kanonis; **jangan gabungkan record yang tidak pasti sama**.
- Migrasikan screen satu per satu. Pastikan filter, jumlah, tanggal, serta urutan sebelum/sesudah terukur.
- Tetapkan kebijakan data yang memang relatif terhadap hari ini supaya demo tetap representatif tanpa membuat data acak saat navigasi.

### Tahap 5. Zustand untuk shared state
- Tambahkan dependensi `zustand` saat tahap ini saja setelah audit/approval.
- Store minimum: `useBookingStore`, `useConsentStore`, `useFeedbackStore`.
- Dataset awal di `data/mock`, actions/selectors di `features/<domain>`, state UI kecil tetap lokal.
- Tentukan apa yang boleh persisted berdasarkan klasifikasi data; lakukan schema version/migration/reset yang eksplisit.
- Uji navigasi antarroIe, refresh, duplikasi state, dan isolasi role dalam prototipe.

### Tahap 6. Modularisasi Klien
- Page prioritas: Pesanan, Aktivitas, Riwayat, Konselor, Beranda, Pengaturan.
- Ekstrak card/form/filter/calendar/modal dan logika fitur.
- Hubungkan booking/consent/feedback ke data bersama tanpa menghilangkan simulasi awal.
- Uji semua alur klien desktop/mobile.

### Tahap 7. Modularisasi Konselor
- Page prioritas: Permintaan, Aktivitas, Jadwal, Riwayat, Feedback, Pengaturan, Beranda.
- Pisahkan akses riwayat 30 menit ke custom hook/service lokal yang terpisah dari UI.
- Periksa maksimal tiga percobaan, cooldown, expiry, sessionStorage, lock on hidden/visibility/refresh.
- Cocokkan id booking, sesi, tanda tangan (jika tersedia), serta feedback dari dataset bersama.

### Tahap 8. Modularisasi Admin
- Page: Beranda, Aktivitas, Akun, Konseling, Feedback, Laporan, Periode, Pengaturan.
- Moderasi feedback `pending` → `shown` atau `disabled` dengan alasan; disabled → `pending` untuk pemeriksaan ulang sesuai perilaku yang disetujui.
- Penghitungan statistik/status harus memakai dataset dan selector yang sama.
- Jangan memengaruhi fungsi admin pengaturan periode akademik.

### Tahap 9. Kepala LMI, publik, auth, dan komponen lintas-role
- Migrasikan dashboard/laporan/feedback Kepala LMI tanpa mengubah makna metrik.
- Publik hanya boleh menerima feedback berstatus `shown`; data sensitif tidak boleh muncul.
- Audit shared UI, auth, halaman public, duplicate modal/buttons/headers; ekstraksi incremental.
- Pertahankan konten publik dan route sesuai snapshot yang berlaku.

### Tahap 10. Cleanup dan regression final
- Hilangkan duplicate type, unused import, dead code, CSS yatim, referensi data dummy lama **setelah penggantinya teruji**.
- Lakukan build/lint, pemeriksaan visual dan functional menyeluruh, navigasi, storage, dan responsive.
- Laporkan hasil dan sisa masalah, bukan sekadar menyatakan selesai.

## E. Granularitas Eksekusi

Jangan meminta agent "kerjakan seluruh Tahap 6" sekali jalan. Pecah menjadi unit yang kecil, contoh:

- 6.1 Ekstrak model UI serta komponen Pesanan Klien tanpa mengubah sumber data.
- 6.2 Uji Pesanan; gabungkan store booking.
- 6.3 Ekstrak komponen Aktivitas Klien.
- 6.4 Hubungkan consent ke session ID kanonis.
- 6.5 Audit Riwayat Klien dan regression.

**Setiap unit:** batas file jelas, rencana, implementasi, test, review diff, update progress, lalu berhenti.

## F. Dependensi Tahapan

- Tahap 0 → wajib sebelum semua pekerjaan.
- Tahap 1 dan 2 → fondasi UI; kerjakan satu role/screen dalam unit kecil.
- Tahap 3 → wajib sebelum konsolidasi data.
- Tahap 4 → wajib sebelum migrasi Zustand cross-page.
- Tahap 5 → wajib sebelum mengandalkan store di seluruh role.
- Tahap 6–9 → boleh bergantian per domain bila dependency antarfitur sudah jelas, tetapi jangan migrasi setengah model dengan hasil tidak konsisten.
- Tahap 10 → setelah seluruh scope selesai.

## G. Definisi Selesai

Tahap dianggap selesai hanya jika kriteria pada `ACCEPTANCE_CRITERIA.md` terpenuhi, lint/build dilaporkan secara faktual, perubahan visual disetujui, regression sesuai fitur, dan `../PROJECT_STATUS.md` diperbarui.

## H. Prompt Tahap 0 untuk Antigravity

```text
Baca AGENTS.md dan semua dokumen docs/refactor/. Pelajari working tree SiCARE yang saat ini terbuka, jangan menimpa perubahan terbaru dengan versi ZIP lama.

Kerjakan hanya Tahap 0 pada MASTER_PLAN.md. Audit struktur, routing, layout, CSS, semua state/data dummy, storage keys, dan risiko migrasi. Jalankan pemeriksaan yang tersedia dan catat hasilnya secara jujur.

JANGAN mengubah kode pada src/, konfigurasi build, package.json, atau dependency. Tulis status terkini dan baseline pada docs/PROJECT_STATUS.md. Pertahankan docs/refactor/PROGRESS.md sebagai arsip audit Tahap 0. Berikan daftar file dan rencana spesifik untuk Tahap 1, kemudian berhenti menunggu persetujuan.
```
