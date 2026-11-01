# SiCARE Refactor: Progress Log

---

## Tahap 0 — Baseline & Audit

**Status:** SELESAI
**Tanggal:** 2026-10-26
**Agent:** Antigravity (Claude Sonnet 4.6 Thinking)
**Perubahan pada src/:** TIDAK ADA (sesuai aturan Tahap 0)

---

### 0.1 Git Status

```
?? AGENTS.md
?? docs/
```

Working tree bersih. File AGENTS.md dan folder docs/ belum di-commit (untracked), tetapi tidak ada file yang di-modify. Tidak ada perubahan user yang tertimpa.

---

### 0.2 Stack & Konfigurasi

| Item | Nilai |
|---|---|
| React | ^19.2.8 |
| React Router DOM | ^7.5.0 |
| Tailwind CSS | ^4.3.3 |
| Vite | ^8.3.0 |
| TypeScript | ~6.0.2 |
| framer-motion | ^14.0.0 |
| lucide-react | ^1.52.0 |
| Zustand | BELUM ada di package.json |
| Build script | tsc -b && vite build |
| Lint script | eslint . |

---

### 0.3 Inventaris Route (src/app/router.tsx)

**Semua route sudah ada dan sesuai dengan ACCEPTANCE_CRITERIA.md:**

| Role | Route |
|---|---|
| Publik | /, /tentang-kami, /panduan, /profil-konselor, /mood-tracker, /feedback |
| Auth | /login, /register |
| Klien | /klien, /klien/pesanan, /klien/aktivitas, /klien/konselor, /klien/riwayat, /klien/pengaturan |
| Konselor | /konselor, /konselor/aktivitas, /konselor/permintaan, /konselor/riwayat, /konselor/jadwal, /konselor/feedback, /konselor/pengaturan |
| Admin | /admin, /admin/aktivitas, /admin/akun, /admin/konseling, /admin/feedback, /admin/laporan, /admin/periode, /admin/pengaturan |
| Kepala LMI | /kepala-lmi, /kepala-lmi/laporan, /kepala-lmi/feedback, /kepala-lmi/pengaturan |

CATATAN: Ada route /konselor/profil direferensikan di KonselorLayout.tsx (MORE_ROUTES dan link profil navbar) tapi tidak terdaftar di router. Kemungkinan bug atau halaman belum dibuat.

---

### 0.4 Inventaris Layout

| File | Role | Pattern |
|---|---|---|
| AdminLayout.tsx (11.6 KB) | Admin | Sidebar 248px desktop + BottomNav mobile 5 kolom, NAVBAR_H=72px, main dengan p-4 sm:p-6 |
| KonselorLayout.tsx (8.6 KB) | Konselor | Sidebar 248px desktop + BottomNav mobile 5 kolom, NAVBAR_H=72px, main dengan p-4 sm:p-6 |
| KepalaLMILayout.tsx (8.2 KB) | Kepala LMI | Sidebar 248px desktop + BottomNav mobile 4 kolom, NAVBAR_H=72px, main dengan p-4 sm:p-6 |
| KlienLayout.tsx (5.0 KB) | Klien | BERBEDA: Sticky navbar pill bukan fixed sidebar, main dengan mx-auto w-[92%] max-w-7xl pb-12 pt-6 |
| PublicLayout.tsx (0.4 KB) | Publik | Navbar + Outlet + Footer sederhana |

Inkonsistensi:
- AdminLayout menggunakan lg:ml-62 (Tailwind v4 custom) sementara KonselorLayout dan KepalaLMILayout menggunakan lg:ml-[248px]
- KlienLayout sepenuhnya berbeda pola dari tiga layout lainnya (tidak ada sidebar)

---

### 0.5 Inventaris Halaman

| File | Role | Ukuran | Catatan |
|---|---|---|---|
| KlienAktivitasPage.tsx | Klien | 49 KB | Besar; inline style tag |
| KlienPesananPage.tsx | Klien | 53 KB | Besar; semua data inline |
| KlienRiwayatPage.tsx | Klien | 54 KB | Besar; CONSENT_PDF_URL |
| KlienBerandaPage.tsx | Klien | 14 KB | |
| KlienKonselorPage.tsx | Klien | 11 KB | |
| KlienPengaturanPage.tsx | Klien | 16 KB | |
| KonselorAktivitasPage.tsx | Konselor | 54 KB | Besar; banyak TS error |
| KonselorRiwayatPage.tsx | Konselor | 47 KB | Besar; sessionStorage; CONSENT_PDF_URL |
| KonselorPengaturanPage.tsx | Konselor | 47 KB | Besar; password history sessionStorage |
| KonselorPermintaanPage.tsx | Konselor | 32 KB | Banyak TS error |
| KonselorBerandaPage.tsx | Konselor | 20 KB | |
| KonselorFeedbackPage.tsx | Konselor | 20 KB | |
| KonselorJadwalPage.tsx | Konselor | 36 KB | |
| AdminFeedbackPage.tsx | Admin | 39 KB | localStorage moderasi |
| AdminKonselingPage.tsx | Admin | 41 KB | TS error data type mismatch |
| AdminLaporanPage.tsx | Admin | 41 KB | Besar; inline style tag; TS errors |
| AdminPeriodePage.tsx | Admin | 24 KB | localStorage periods; duplikasi STORE_KEY |
| AdminBerandaPage.tsx | Admin | 13 KB | |
| AdminAkunPage.tsx | Admin | 18 KB | |
| AdminPengaturanPage.tsx | Admin | 18 KB | localStorage profile+hero |
| AdminAktivitasPage.tsx | Admin | 0.1 KB | PLACEHOLDER — hanya div>ActivityPage |
| KepalaLMIBerandaPage.tsx | Kepala LMI | 7.2 KB | |
| KepalaLMIFeedbackPage.tsx | Kepala LMI | 36 KB | inline style tag; error MONTHS undefined |
| KepalaLMILaporanPage.tsx | Kepala LMI | 32 KB | inline style tag; unused import |
| KepalaLMIPengaturanPage.tsx | Kepala LMI | 30 KB | |
| HomePage.tsx | Publik | 23 KB | Polaroid unused |
| AboutPage.tsx | Publik | 24 KB | |
| CounselorPage.tsx | Publik | 12 KB | |
| FeedbackPage.tsx | Publik | 13 KB | inline style tag |
| MoodTrackerPage.tsx | Publik | 13 KB | inline style tag |
| PanduanPage.tsx | Publik | 18 KB | TS errors ref type |
| Login.tsx | Auth | 4.1 KB | |
| Register.tsx | Auth | 33 KB | |

---

### 0.6 Inventaris Komponen

```
src/components/
- auth/   (7 file): AuthBackdrop, AuthBackground, AuthLayout, AuthScenery, CenteredAuthLayout, CounselingPreview, FormControls
- home/   (7 file): BenefitSection, CounselingProcessSection, CounselorSection, Footer, HeroSection, Navbar, TestimonialSection
- shared/ — KOSONG
- ui/     — KOSONG
```

CATATAN KRITIS: components/shared/ dan components/ui/ kosong. Tidak ada PageContainer, PageHeader, Button, Modal, StatusBadge yang reusable. Komponen role-spesifik tidak ada di components/ — semua UI dikubur di page file masing-masing.

src/pages/public/components/AlurSistem.tsx adalah page-local tapi berada di lokasi yang salah.

---

### 0.7 Inventaris Features

```
src/features/
- auth/         — KOSONG
- booking/      — KOSONG
- mood/         — KOSONG
- notification/ — KOSONG
```

Semua folder features/ kosong. Tidak ada Zustand store, hook, selector, atau action domain.

---

### 0.8 Inventaris Types, Constants, Lib

| File | Isi | Catatan |
|---|---|---|
| types/auth.ts | LoginForm, RegisterForm, RegisterErrors | Hanya form types |
| types/booking.ts | Booking interface | Menggunakan BookingStatus dari constants |
| types/user.ts | Role, User | Minimal |
| constants/status.ts | BOOKING_STATUS, BookingStatus | Hanya booking; tidak ada status konseling/feedback/consent |
| constants/registerOptions.ts | FACULTY_PROGRAMS, GENDERS, RELIGIONS, dll | Non-status |
| lib/academicPeriods.ts | AcademicPeriod, DEFAULT_PERIODS, loadPeriods(), dst | Bercampur: type + constants + localStorage logic + utility |

Tipe yang belum ada: Counselor, Client, CounselingSession, Consent, Feedback
AcademicPeriod ada di lib, bukan di types/

---

### 0.9 Inventaris Data Mock

src/data/ TIDAK ADA di working tree. Tidak ada src/data/mock/ maupun src/data/fixtures/.

Semua data dummy inline di dalam page file. Tidak ada ID kanonis (usr-*, cli-*, bok-*, dll.) — ID berupa angka numerik atau string nama.

---

### 0.10 Inventaris Storage Keys

| Key | Lokasi | Storage | Isi |
|---|---|---|---|
| sicare.periods | lib/academicPeriods.ts + AdminPeriodePage.tsx | localStorage | Array periode akademik |
| sicare_admin_profile_v1 | AdminPengaturanPage.tsx | localStorage | Profil admin |
| sicare_home_hero_content_v1 | AdminPengaturanPage.tsx | localStorage | Konten hero halaman publik |
| sicare:admin:feedback-moderation | AdminFeedbackPage.tsx | localStorage | Status moderasi feedback |
| sicare:konselor:riwayat-access | KonselorRiwayatPage.tsx + KonselorPengaturanPage.tsx | sessionStorage | Timestamp expiry akses riwayat |
| sicare:konselor:riwayat-attempts | KonselorRiwayatPage.tsx + KonselorPengaturanPage.tsx | sessionStorage | Jumlah percobaan password |
| sicare:konselor:riwayat-password-digest | KonselorPengaturanPage.tsx | sessionStorage | Digest password riwayat |

Masalah:
- sicare.periods: duplikat definisi di lib/academicPeriods.ts dan AdminPeriodePage.tsx
- Format key tidak konsisten: ada . (dot), : (colon), _ (underscore)
- sicare:admin:feedback-moderation di localStorage — perlu review apakah non-sensitif

---

### 0.11 Inventaris CSS & Warna

src/index.css (Baik):
- Token #064e3b sudah ada sebagai --color-primary dalam @theme
- Semua token yang diperlukan DESIGN_SYSTEM.md sudah ada
- @keyframes auth-bubble-rise, auth-twinkle, auth-float-drift sudah di sini (benar)
- Font Inter sudah di-import dari Google Fonts

Inline style tag JSX yang perlu dipindahkan ke index.css:
- src/pages/public/MoodTrackerPage.tsx (L333)
- src/pages/public/FeedbackPage.tsx (L346)
- src/pages/headlmi/KepalaLMILaporanPage.tsx (L451)
- src/pages/headlmi/KepalaLMIFeedbackPage.tsx (L522)
- src/pages/client/KlienAktivitasPage.tsx (L810)
- src/pages/admin/AdminLaporanPage.tsx (L620)

HEX hardcoded di className (sebagian besar di Layouts):
- #14553a  (aktif nav — kandidat text-primary)
- #1e5b3a  (klien nav — berbeda dari primary #064E3B)
- #2d6a1f  (logo "Si" konselor/klien — sangat berbeda, mungkin disengaja)
- #c9a54a  (border cincin logo — warna kuning/gold universitas, JANGAN dipaksa hijau)
- #2a8f5a, #1f7a4d, #14553a (SVG dekorasi gunung — warna dekoratif)

---

### 0.12 Inventaris informed-consent.pdf

File /public/informed-consent.pdf TIDAK ADA di working tree. BASELINE ISSUE.

Tiga halaman mereferensikannya:
- KlienAktivitasPage.tsx (L61) — CONSENT_PDF_URL
- KlienRiwayatPage.tsx (L22) — CONSENT_PDF_URL + download link
- KonselorRiwayatPage.tsx (L121) — CONSENT_PDF_URL + download link

---

### 0.13 Pemeriksaan Build

npm run build: FAIL (BASELINE ISSUE)
Total error TypeScript: 139 error

Ringkasan per file:

| File | Jenis Error Utama |
|---|---|
| KonselorAktivitasPage.tsx | ~40 error: implicit any, property tidak ada di never, SetStateAction mismatch |
| KonselorPermintaanPage.tsx | ~30 error: implicit any, property tidak ada di never, null check |
| AdminKonselingPage.tsx | SessionStatus type mismatch (string vs union) |
| AdminLaporanPage.tsx | Unused vars, unintentional comparison ("semester" vs "hari") |
| KepalaLMIFeedbackPage.tsx | MONTHS tidak terdefinisi (TS2304) |
| KepalaLMILaporanPage.tsx | Unused import FileChartColumnIncreasing |
| AlurSistem.tsx | LOREM_LONG/SectionTitle/steps tidak terdefinisi; Ref type mismatch |
| PanduanPage.tsx | Ref type mismatch (boolean vs Ref) |
| AdminPeriodePage.tsx | makePeriod dipanggil tanpa argumen wajib |
| AdminPengaturanPage.tsx | Unused imports |
| KlienAktivitasPage.tsx | Unused vars |
| KlienPengaturanPage.tsx | Unused import |
| HomePage.tsx | Unused Polaroid |
| AdminAktivitasPage.tsx | Unused React import |

CATATAN KRITIS: AlurSistem.tsx mempunyai simbol tak terdefinisi (LOREM_LONG, SectionTitle, steps) — sisa refactor sebelumnya yang tidak selesai.

---

### 0.14 Pemeriksaan Lint

npm run lint: FAIL (BASELINE ISSUE)
Total: 29 masalah (27 error, 2 warning)

Ringkasan:

| File | Error |
|---|---|
| AdminLaporanPage.tsx | 6 error: unused vars, preserve-manual-memoization |
| AdminKonselingPage.tsx | 1 warning: set-state-in-effect |
| AdminPengaturanPage.tsx | 2 error: unused vars |
| KlienAktivitasPage.tsx | 2 error: unused vars |
| KlienRiwayatPage.tsx | 1 warning: exhaustive-deps; 1 error: set-state-in-effect |
| KlienPengaturanPage.tsx | 1 error: unused var |
| KepalaLMILaporanPage.tsx | 1 error: preserve-manual-memoization |
| HomePage.tsx | 1 error: unused var |
| AlurSistem.tsx | 3 error: unused vars + fast refresh export |

---

### 0.15 Screenshot Visual

NOT RUN — dev server berjalan di terminal user, tetapi screenshot tidak diambil secara otomatis. Review visual manual diperlukan sebelum Tahap 1.

---

### 0.16 Temuan Risiko Utama

1. Build tidak lulus (139 TS errors) — BASELINE. Refactor tidak boleh menambah error baru.
2. AlurSistem.tsx tidak kompilasi — simbol tak terdefinisi (LOREM_LONG, SectionTitle, steps). Sisa refactor sebelumnya.
3. AdminAktivitasPage.tsx adalah placeholder — hanya div>ActivityPage. Route /admin/aktivitas ada tapi halaman kosong.
4. /konselor/profil direferensikan di layout tapi tidak ada di router.
5. informed-consent.pdf tidak ada di public/ — fitur download/view broken.
6. Semua data dummy inline di page — tidak ada src/data/mock/ sama sekali.
7. Zustand belum ada — harus ditambahkan di Tahap 5 saja.
8. STORE_KEY duplikat antara lib/academicPeriods.ts dan AdminPeriodePage.tsx.
9. Format storage key tidak konsisten (., :, _).
10. HEX warna hardcoded tersebar di semua layout dan halaman — perlu audit sebelum diubah.
11. components/shared/ dan components/ui/ kosong.
12. features/* semua kosong.
13. Warna logo "Si" berbeda antar layout — perlu konfirmasi pengguna.

---

### 0.17 File yang Berubah di Tahap 0

| File | Aksi | Alasan |
|---|---|---|
| docs/refactor/PROGRESS.md | DIBUAT | Rekam hasil audit sesuai instruksi Tahap 0 |

Tidak ada file src/ yang diubah.

---

---

## Tahap 0.5 — Stabilisasi Kode

**Status:** PERENCANAAN / SIAP EKSEKUSI
**Tanggal:** 2026-10-26
**Keputusan Pengguna:**
1. Warna utama SiCARE wajib menggunakan `#064E3B`, termasuk warna hijau utama logo "Si". Warna dekoratif dan border emas tetap dipertahankan.
2. `AlurSistem.tsx` tidak boleh dihapus. Perbaiki error yang ditemukan dengan tetap mempertahankan konten, fungsi, dan tampilan yang sudah ada.
3. `AdminAktivitasPage.tsx` tetap sebagai placeholder. Jangan membuat halaman atau fitur baru untuk saat ini.

---

### Inventaris Lengkap Error Baseline

#### TypeScript (139 Error di 15 File)
| File | Jumlah | Akar Masalah |
|---|---|---|
| `src/pages/counselor/KonselorPermintaanPage.tsx` | 54 | `useState(null)` meng-inferensi tipe `null` / `never`, missing type prop komponen lokal (`InfoRow`, `ScoreBadge`, `QAItem`, `Section`), dan parameter `any` |
| `src/pages/counselor/KonselorAktivitasPage.tsx` | 47 | Parameter fungsi lokal implicitly `any` (`clamp`, `formatMinutes`, `initials`, `scheduled`, `canStart`, `isFilled`, `openSession`, dll.) |
| `src/pages/admin/AdminLaporanPage.tsx` | 12 | Perbandingan tipe unintentional (`key === "hari"` dll.) karena `PeriodKey` hanya didefinisikan `"semester"`, serta variabel/import yang tidak terpakai |
| `src/pages/public/components/AlurSistem.tsx` | 9 | Simbol `steps`, `LOREM_LONG`, `SectionTitle` belum terdefinisi; `useInView` menghasilkan return type array bukan tuple; komponen belum di-export |
| `src/pages/public/PanduanPage.tsx` | 3 | Return type `useInView` belum tuple `as const` / explicit, dan implicit `any` pada `StepItem` |
| `src/pages/counselor/KonselorPengaturanPage.tsx` | 2 | Unused imports |
| `src/pages/admin/AdminPengaturanPage.tsx` | 2 | Unused imports (`FormEvent`, `X`) |
| `src/pages/admin/AdminKonselingPage.tsx` | 2 | Tipe status `"dibatalkan" \| "selesai"` inferred sebagai `string`, belum di-cast / di-type sebagai `SessionStatus`; unused import `CalendarDays` |
| `src/pages/client/KlienAktivitasPage.tsx` | 2 | Unused variables (`SESSION_MIN`, `formatDateLong`) |
| `src/pages/admin/AdminAktivitasPage.tsx` | 1 | Unused import `React` |
| `src/pages/public/HomePage.tsx` | 1 | Unused component `Polaroid` |
| `src/pages/headlmi/KepalaLMILaporanPage.tsx` | 1 | Unused import `FileChartColumnIncreasing` |
| `src/pages/admin/AdminPeriodePage.tsx` | 1 | `useRef<ReturnType<typeof setTimeout>>()` tanpa default value `undefined` |
| `src/pages/client/KlienPengaturanPage.tsx` | 1 | Unused import `GraduationCap` |
| `src/pages/headlmi/KepalaLMIFeedbackPage.tsx` | 1 | Simbol `MONTHS` belum didefinisikan |

#### ESLint (29 Problem di 11 File)
| File | Rules | Detail |
|---|---|---|
| `AdminKonselingPage.tsx` | `react-hooks/set-state-in-effect` | `setState` sinkron di dalam effect (reset page limit dan routing sync) |
| `AdminLaporanPage.tsx` | `@typescript-eslint/no-unused-vars`, `react-hooks/preserve-manual-memoization` | Unused icons & variables; `cancellationRows` memoization |
| `AdminPengaturanPage.tsx` | `@typescript-eslint/no-unused-vars` | Unused imports `FormEvent`, `X` |
| `KlienAktivitasPage.tsx` | `@typescript-eslint/no-unused-vars` | Unused variables `SESSION_MIN`, `formatDateLong` |
| `KlienRiwayatPage.tsx` | `react-hooks/set-state-in-effect`, `react-hooks/exhaustive-deps` | Reset `counselor` dalam `useEffect`; dependency `items` |
| `KlienPengaturanPage.tsx` | `@typescript-eslint/no-unused-vars` | Unused import `GraduationCap` |
| `KonselorAktivitasPage.tsx` | `react-hooks/exhaustive-deps` | Unnecessary dependency `now` di `useMemo` |
| `KonselorRiwayatPage.tsx` | `react-hooks/purity` | Pemanggilan `Date.now()` langsung di render body & handler non-event |
| `KepalaLMILaporanPage.tsx` | `@typescript-eslint/no-unused-vars`, `react-hooks/preserve-manual-memoization` | Unused import `FileChartColumnIncreasing`; `useMemo` pada `cancelled` array baru |
| `HomePage.tsx` | `@typescript-eslint/no-unused-vars` | Unused `Polaroid` |
| `AlurSistem.tsx` | `react-refresh/only-export-components`, `@typescript-eslint/no-unused-vars` | Komponen tidak di-export; fast refresh warning |

---

### Strategi Eksekusi Bertahap (Batch)

- **Batch 1 (File Sederhana & Unused / Missing Constants):** [SELESAI]
  - `AdminAktivitasPage.tsx` (hapus unused `React`) — SELESAI
  - `AdminPengaturanPage.tsx` (bersihkan unused `FormEvent`, `X`) — SELESAI
  - `KlienPengaturanPage.tsx` (bersihkan unused `GraduationCap`) — SELESAI
  - `KlienAktivitasPage.tsx` (bersihkan unused `SESSION_MIN`, `formatDateLong`) — SELESAI
  - `HomePage.tsx` (bersihkan unused `Polaroid`) — SELESAI
  - `KepalaLMIFeedbackPage.tsx` (tambahkan array `MONTHS`) — SELESAI
  - `AdminPeriodePage.tsx` (tambahkan default `undefined` pada `useRef`) — SELESAI
  - `KonselorPengaturanPage.tsx` (bersihkan unused `React` default import, rapikan `type ChangeEvent, type FormEvent`) — SELESAI
  - `AdminKonselingPage.tsx` (hapus unused `CalendarDays`, ketatkan tipe status & `cancelledBy` sesi) — SELESAI
  - *Hasil Batch 1:* TS errors berkurang dari 139 menjadi 126 (-13 error, 8 file tuntas). ESLint problems berkurang dari 29 menjadi 22.

- **Batch 2 (Komponen Publik: AlurSistem & PanduanPage):** [SELESAI BERSYARAT]
  - `PanduanPage.tsx` (perbaiki generic tuple return type pada `useInView`, pindahkan `type Step` ke atas dan ketik prop `StepItem`) — SELESAI (0 TS errors, 0 ESLint errors). *Status uji visual: Belum terverifikasi otomatis karena browser context CDP port issue.*
  - `AlurSistem.tsx` (lengkapi `steps`, `LOREM_LONG`, `SectionTitle` dari definisi asli `PanduanPage.tsx`, perbaiki generic tuple `useInView`, tambahkan `export default`) — SELESAI (0 TS errors, 0 ESLint errors). *Catatan teknis: Masih duplikasi inline `PanduanPage.tsx`, dicatat sebagai technical debt untuk tahap modularisasi.*
  - *Hasil Batch 2:* TS errors berkurang dari 126 menjadi 114 (-12 error). ESLint problems berkurang dari 22 menjadi 19 (-3 error).

- **Batch 3 (Laporan Admin & Kepala LMI):** [SELESAI]
  - `AdminLaporanPage.tsx` (perbaiki union `PeriodKey`, hapus unused icons `ChevronLeft`/`ChevronRight`, hapus unused vars `period`/`stepPeriod`/`PERIOD_OPTIONS`, selesaikan referential stability `reasonCount` dari `[rows]`) — SELESAI (0 TS errors, 0 ESLint errors)
  - `KepalaLMILaporanPage.tsx` (hapus unused import `FileChartColumnIncreasing`, selesaikan referential stability `cancellationRows` dari `[rows]`) — SELESAI (0 TS errors, 0 ESLint errors)
  - *Hasil Batch 3:* TS errors berkurang dari 114 menjadi 101 (-13 error). ESLint problems berkurang dari 19 menjadi 10 (-9 masalah). Sisa TS errors hanya pada 2 file (`KonselorPermintaanPage` [54] & `KonselorAktivitasPage` [47]).


- **Batch 4 (Halaman Konselor & Klien Riwayat):**
  - **Batch 4A (`KonselorPermintaanPage.tsx`):** [SELESAI BERSYARAT]
    - Mendefinisikan tipe `CounselingRequest`, `IntakeData`, dan `ConfirmDecision`.
    - Mengetik komponen lokal (`Badge`, `StatCard`, `ScaleView`, `AnswerRow`, `EssayCard`) dan utilitas (`initials`, `waitLabel`).
    - Memperbaiki state `currentId` (`number | null`), `confirm` (`ConfirmDecision | null`), serta membungkus detail formulir dengan pemeriksaan `currentIntake` non-null.
    - *Catatan Verifikasi:* Perubahan `currentIntake && (...)` perlu diaudit pada tahap modularisasi agar modal detail tidak kosong jika intake klien tidak tersedia. HTTP 200 OK tidak membuktikan interaksi React render sepenuhnya; status visual tetap dicatat sebagai belum terverifikasi otomatis.
    - *Hasil Batch 4A:* Seluruh 54 TS errors pada file ini tuntas (0 TS errors, 0 ESLint errors). TS errors global berkurang dari 101 menjadi **47 errors** (-54 error).
  - **Batch 4B (`KonselorAktivitasPage.tsx`):** [SELESAI BERSYARAT]
    - Mendefinisikan tipe dan interface eksplisit: `SessionFormat`, `SessionStatus`, `CancelInfo`, `CounselingSession`, `DialogState`, dan `ClientIntake`.
    - Mengetik fungsi utilitas dan komponen lokal: `clamp`, `formatMinutes`, `initials`, `getCurrentMinutes`, `buildDummySessions`, `Badge`, `ScaleView`, `AnswerRow`, `EssayCard`, `StatCard` (dengan tipe `LucideIcon` dan index record `tones`).
    - Mengetik state eksplisit: `sessions` (`CounselingSession[]`), `selectedBookingId` (`number | null`), `currentId` (`number | null`), `dialog` (`DialogState | null`), `cancelId` (`number | null`).
    - Melakukan type narrowing aman pada `confirmCancel` (validasi `reason` dari `CANCEL_REASONS.find`).
    - Memperbaiki warning ESLint `react-hooks/exhaustive-deps` dengan menghapus `now` dari dependency array `activeSessions` `useMemo`.
    - *Hasil Batch 4B:*
      - TypeScript errors `KonselorAktivitasPage.tsx`: **0** (dari 47).
      - ESLint errors/warnings `KonselorAktivitasPage.tsx`: **0** (dari 1 warning).
      - TypeScript errors seluruh proyek: **0** (dari baseline awal 139, tuntas 100%).
      - `npm run build`: **PASS** (`tsc -b && vite build` sukses).
      - Status uji visual/interaksi: **Belum terverifikasi otomatis** (lingkungan Antigravity Browser mengalami kendala CDP port resolution `failed to resolve CDP URLs`, pengujian visual otomatis dicatat sebagai NOT RUN).
  - **Batch 4C (Sisa ESLint Halaman Riwayat & Admin Konseling):**
    - **Batch 4C-A (`AdminKonselingPage.tsx`):** [SELESAI]
      - Mengeliminasi cascading render `react-hooks/set-state-in-effect` pada navigasi `location.key` dan `navState` dengan pola React 19 (storing previous location during render).
      - Menghapus `useEffect` pagination reset `[period, anchor, semId, tbl]`, memindahkan pembaruan `setLimit(PAGE_SIZE)` ke event handler interaktif (`handlePeriodChange`, `handleTblChange`, `handleSemIdChange`, dan `step`).
      - Menghapus komentar penonaktifan linter `// eslint-disable-next-line react-hooks/exhaustive-deps`.
      - *Hasil Batch 4C-A:*
        - ESLint errors `AdminKonselingPage.tsx`: **0** (dari 2 errors).
        - ESLint problems seluruh proyek: berkurang dari 9 menjadi **7 problems** (tersisa 2 file: `KlienRiwayatPage.tsx` dan `KonselorRiwayatPage.tsx`).
        - TypeScript errors: tetap **0 errors** di seluruh proyek.
        - `npm run build`: **PASS** (`tsc -b && vite build` sukses).
    - **Batch 4C-B (`KlienRiwayatPage.tsx`):** [SELESAI]
      - Memindahkan ekspresi kondisional `items` ke dalam `useMemo` dengan dependensi `[view]` untuk menjamin stabilitas referensial antar render (`react-hooks/exhaustive-deps`).
      - Mengganti `useEffect` yang memanggil `setCounselor("all")` dengan derived value `effectiveCounselor` yang dihitung saat render (fallback ke `"all"` jika konselor yang dipilih tidak memiliki data pada `baseItems` periode aktif), mengeliminasi cascading render (`react-hooks/set-state-in-effect`).
      - Memperbarui `visibleItems` untuk memfilter berdasarkan `effectiveCounselor`.
      - *Hasil Batch 4C-B:*
        - ESLint errors `KlienRiwayatPage.tsx`: **0** (dari 2 errors).
        - ESLint problems seluruh proyek: berkurang dari 7 menjadi **5 problems** (seluruh sisa error hanya berada pada 1 file: `KonselorRiwayatPage.tsx`).
        - TypeScript errors seluruh proyek: tetap **0 errors**.
        - `npm run build`: **PASS** (`tsc -b && vite build` sukses dalam 5.52 detik).
    - **Batch 4C-C (`KonselorRiwayatPage.tsx`):** [MENUNGGU PERSETUJUAN]
      - Mengganti pemanggilan tidak murni `Date.now()` di render body dan helper dengan state `now` yang diperbarui berkala (`react-hooks/purity`).


---

## Rencana Implementasi Tahap 1: Warna dan Fondasi Design Tokens

> BELUM DIKERJAKAN — Dimulai setelah Tahap 0.5 tuntas dan disetujui.

---

*File ini diperbarui oleh agent setiap akhir subtugas. Jangan mengedit manual kecuali menambahkan catatan pengguna.*


---

## Tahap 2 — Standardisasi Layout dan Tipografi (Batch Lanjutan)

**Status:** IMPLEMENTASI DILAKUKAN; BUILD/LINT BELUM TERVERIFIKASI DI LINGKUNGAN INI
**Tanggal:** 2026-10-26
**Basis kode:** `fe(6).zip` yang diberikan pengguna, berisi migrasi Admin parsial dari Antigravity.

### Perubahan yang diterapkan

- Menggunakan komponen bersama `PageHeader` untuk judul dan deskripsi halaman Klien, Konselor, dan Kepala LMI.
- Menerapkan `PageContainer` sebagai shell konsisten pada halaman Konselor dan Kepala LMI, serta mempertahankan `report-print-page` untuk aturan cetak.
- Menghilangkan wrapper `max-w-*` dan padding yang berulang dari halaman Konselor dan Kepala LMI yang sudah dipindahkan ke `PageContainer`.
- Mempertahankan wrapper utama `KlienLayout`; halaman Klien menggunakan `PageHeader` tanpa menambah container kedua, dan wrapper duplikat pada halaman pengaturan Klien dihapus.
- Menambahkan prop `spacing="none"` pada `PageContainer` untuk halaman yang sudah memiliki spacing eksplisit `mt-*`, sehingga tidak menumpuk `space-y-6`.
- Menyelaraskan wrapper pengaturan Admin ke max-width role Admin dan memperbaiki judul/deskripsi pada `AdminPeriodePage` yang pada snapshot parsial menunjuk ke Pengaturan, bukan Periode Akademik.

### File source yang diubah pada batch ini

- `fe/src/components/shared/PageContainer.tsx`
- `fe/src/pages/admin/AdminPeriodePage.tsx`
- `fe/src/pages/admin/AdminPengaturanPage.tsx`
- `fe/src/pages/client/KlienAktivitasPage.tsx`
- `fe/src/pages/client/KlienBerandaPage.tsx`
- `fe/src/pages/client/KlienKonselorPage.tsx`
- `fe/src/pages/client/KlienPengaturanPage.tsx`
- `fe/src/pages/client/KlienPesananPage.tsx`
- `fe/src/pages/client/KlienRiwayatPage.tsx`
- `fe/src/pages/counselor/KonselorAktivitasPage.tsx`
- `fe/src/pages/counselor/KonselorBerandaPage.tsx`
- `fe/src/pages/counselor/KonselorFeedbackPage.tsx`
- `fe/src/pages/counselor/KonselorJadwalPage.tsx`
- `fe/src/pages/counselor/KonselorPengaturanPage.tsx`
- `fe/src/pages/counselor/KonselorPermintaanPage.tsx`
- `fe/src/pages/counselor/KonselorRiwayatPage.tsx`
- `fe/src/pages/headlmi/KepalaLMIBerandaPage.tsx`
- `fe/src/pages/headlmi/KepalaLMIFeedbackPage.tsx`
- `fe/src/pages/headlmi/KepalaLMILaporanPage.tsx`
- `fe/src/pages/headlmi/KepalaLMIPengaturanPage.tsx`

### Verifikasi

- TypeScript TSX parser: **PASS**, 0 syntax/JSX parse diagnostics pada seluruh 65 file `.ts`/`.tsx` dalam `src/`.
- `npm ci`: **NOT RUN TO COMPLETION**, command timed out saat mencoba mengunduh dependencies.
- `npm ci --offline`: **FAIL / ENVIRONMENT**, npm cache tidak memiliki tarball `zod-validation-error`.
- `npm run build`: **NOT PASS / BLOCKED**, TypeScript melaporkan tipe `vite/client` dan `node` tidak ditemukan karena dependencies belum terpasang lengkap.
- `npm run lint`: **NOT RUN**, executable ESLint tidak tersedia tanpa instalasi dependency lengkap.
- Browser visual regression test: **NOT RUN**.

### Catatan

- Tidak ada perubahan routing, data dummy, atau aturan bisnis yang disengaja.
- Build dan lint harus dijalankan kembali dari project lokal setelah dependency tersedia.
- Review visual desktop/mobile tetap diperlukan sebelum tahap layout dinyatakan selesai.

## Tahap 6 — Modularisasi Seluruh Halaman Klien

**Status:** IMPLEMENTASI PATCH SELESAI; build/lint dan browser regression belum dapat diverifikasi di lingkungan patch ini.
**Tanggal:** 2026-10-27
**Cakupan:** `KlienPesananPage`, `KlienAktivitasPage`, `KlienRiwayatPage`, `KlienBerandaPage`, `KlienKonselorPage`, `KlienPengaturanPage`.

### Perubahan utama

- Memindahkan kontrak runtime `BookingRecord`/`CreateBookingInput` ke `src/types/booking.ts` (store tetap mengekspor ulang tipe tersebut agar import lama tetap kompatibel). Membuat selector booking klien (`features/booking/selectors/clientBookingSelectors.ts`) agar status booking yang sama dipetakan secara konsisten ke tampilan Beranda, Aktivitas, dan Riwayat. Status `rejected`, `cancelled`, dan `completed` kini memiliki representasi tampilan klien yang eksplisit.
- Menghubungkan status booking runtime dari Zustand ke kartu **Status Booking Terakhir** pada Beranda, daftar ringkas **Booking yang kamu ajukan** pada Aktivitas, serta daftar booking Riwayat. Data mock lama tetap menjadi fallback dan tidak diganti.
- Memecah kontrol formulir booking ke `components/client/booking/BookingFormControls.tsx`, kalender/jam ke `components/client/booking/BookingCalendar.tsx`, serta utilitas tanggal dan slot ke `features/booking/utils/clientBookingCalendar.ts`.
- Memindahkan kontrak form intake dan validasi murni ke `features/booking/utils/clientIntakeForm.ts`. Jawaban intake tetap berada pada state lokal formulir dan tidak dikirim ke Zustand.
- Memindahkan aturan sesi Aktivitas (status waktu, kelayakan ubah jadwal, countdown, dan label tanggal) ke `features/client/activity/sessionRules.ts`.
- Feedback dari sesi Aktivitas ditautkan menggunakan `clientActivitySessionId`, yaitu ID fixture lokal halaman Aktivitas, bukan ID sesi kanonis lintas-role. Store mencegah duplikasi feedback untuk pasangan klien/fixture tersebut; state feedback diturunkan dari store sehingga tetap terlihat setelah navigasi antarhalaman selama SPA aktif.
- Memindahkan kartu konselor beserta jadwal ke `components/client/counselors/CounselorCard.tsx`, filter pencarian ke `features/client/counselors/filterClientCounselors.ts`, baris detail dashboard ke `components/client/dashboard/DetailRow.tsx`, dan validasi profil ke `features/client/profile/profileValidation.ts`.
- State modal, filter, draft form, kalender aktif, dan perubahan profil tetap lokal. Tidak ada persistensi browser baru.

### File source diubah

- `fe/src/constants/status.ts`
- `fe/src/types/booking.ts`
- `fe/src/features/booking/store/bookingStore.ts`
- `fe/src/features/feedback/store/feedbackStore.ts`
- `fe/src/pages/client/KlienAktivitasPage.tsx`
- `fe/src/pages/client/KlienBerandaPage.tsx`
- `fe/src/pages/client/KlienKonselorPage.tsx`
- `fe/src/pages/client/KlienPengaturanPage.tsx`
- `fe/src/pages/client/KlienPesananPage.tsx`
- `fe/src/pages/client/KlienRiwayatPage.tsx`

### File source baru

- `fe/src/components/client/activity/BookingRequestCard.tsx`
- `fe/src/components/client/booking/BookingCalendar.tsx`
- `fe/src/components/client/booking/BookingFormControls.tsx`
- `fe/src/components/client/counselors/CounselorCard.tsx`
- `fe/src/components/client/dashboard/DetailRow.tsx`
- `fe/src/features/booking/selectors/clientBookingSelectors.ts`
- `fe/src/features/booking/utils/clientBookingCalendar.ts`
- `fe/src/features/booking/utils/clientIntakeForm.ts`
- `fe/src/features/client/activity/sessionRules.ts`
- `fe/src/features/client/counselors/filterClientCounselors.ts`
- `fe/src/features/client/profile/profileValidation.ts`
- `fe/src/features/feedback/selectors/clientActivityFeedbackSelectors.ts`

### Verifikasi

- Parsing sintaks TS/TSX dengan TypeScript compiler API global: **PASS**, 0 parse diagnostics pada 105 file source.
- Pemeriksaan relative import lokal: **PASS**, 0 import path yang tidak terselesaikan.
- `npm run lint`: **NOT RUN / BLOCKED** karena dependensi tidak dapat diinstal pada lingkungan ini; registry npm menghasilkan `EAI_AGAIN` dan npm berhenti dengan `Exit handler never called`.
- `npm run build`: **NOT RUN / BLOCKED** dengan alasan instalasi dependensi yang sama. Jangan anggap build/lint PASS sampai dijalankan di project lokal.
- Browser visual/functional regression: **NOT RUN**; perlu diperiksa manual setelah patch dipasang.

### Hal yang tetap ditunda / batasan

- Informed consent belum diimplementasikan/diintegrasikan ke store karena dokumen resmi `informed-consent.pdf` belum tersedia. UI placeholder lama tidak diubah pada tahap ini.
- Booking dan feedback runtime hanya bertahan selama aplikasi SPA aktif; tidak ditambahkan `localStorage`/persist middleware. Hard refresh memulai ulang state demo sesuai kebijakan default.
- Aktivitas konseling dan Riwayat masih memiliki fixture lokal yang berbeda; tidak dibuat relasi sesi lintas-role yang belum terverifikasi. Feedback fixture Aktivitas menggunakan referensi lokal yang dinyatakan eksplisit.
- Tidak ada perubahan route, backend/service, atau commit otomatis.

## Tahap 7 — Modularisasi seluruh halaman Konselor

**Status patch:** implementasi sumber selesai; validasi penuh tetap perlu dijalankan di lingkungan proyek yang memiliki dependensi lengkap.

### Perubahan utama

- **Beranda:** state demo, pengurutan sesi, ringkasan, status waktu sesi, dan aksi keputusan permintaan dipindahkan ke `features/counselor/dashboard/useCounselorDashboard.ts`. Data dashboard tetap memakai fixture dashboard tersendiri dan tidak dipaksakan menjadi booking kanonis.
- **Permintaan:** filter/count selector dipindahkan ke `features/counselor/requests/requestSelectors.ts`; keputusan booking/permintaan dan notifikasi dipindahkan ke `decideCounselorRequest.ts`. Aksi booking tetap memakai Zustand booking store dan notification store yang sudah ada. Permintaan legacy tetap memakai ID/skema aslinya.
- **Aktivitas:** aturan kesiapan sesi, validasi catatan minimum 20 karakter, status sesi, hitungan sesi, dan penanda intake berisiko dipindahkan ke selector domain. Modal konfirmasi mulai/selesai dan pembatalan sesi dipisahkan ke `components/counselor/activity/ActivityDialogs.tsx`.
- **Jadwal:** tipe jadwal dipindahkan ke `types/counselorSchedule.ts`, fixture ketersediaan ke `data/mock/counselorSchedule.ts`, helper waktu/kalender ke `features/counselor/schedule/scheduleUtils.ts`, serta modal tambah/ubah/batal ke `components/counselor/schedule/ScheduleDialogs.tsx`. Fixture jadwal tetap berdiri sendiri karena belum ada pemetaan ID booking/sesi yang terverifikasi.
- **Riwayat:** helper periode/tanggal dan filter sesi dipindahkan ke `features/counselor/history/historySelectors.ts`. Akses riwayat kini dikelola oleh `useCounselorHistoryAccess` dan layanan `counselorHistoryAccess.ts`: timestamp akses absolut 30 menit, maksimal 3 percobaan, cooldown 5 menit, pengecekan saat tab kembali aktif, dan reset tampilan saat akses habis. Verifikasi password riwayat sekarang memakai digest yang sama dengan halaman Pengaturan sehingga perubahan password benar-benar berlaku; password teks biasa tidak disimpan.
- **Feedback:** filter periode, pencarian, filter rating, pengurutan, dan rata-rata rating dipindahkan ke selector murni di `features/counselor/feedback/feedbackSelectors.ts`. Data feedback tidak digabung berdasarkan kemiripan nama.
- **Pengaturan:** model/seed profil dipisahkan ke `types/counselorProfile.ts` dan `data/mock/counselorProfile.ts`; validasi dipindahkan ke `features/counselor/profile/profileValidation.ts`; primitive panel, field, dan switch dipisahkan ke `components/counselor/settings/SettingsPrimitives.tsx`.
- Komponen intake (badge, skala, jawaban, dan jawaban uraian) yang sebelumnya terduplikasi pada Aktivitas dan Permintaan kini berbagi `components/counselor/shared/CounselorIntakeFields.tsx`. Format jam dan inisial konselor memakai helper bersama.

### File source diubah

- `fe/src/data/mock/index.ts`
- `fe/src/pages/counselor/KonselorAktivitasPage.tsx`
- `fe/src/pages/counselor/KonselorBerandaPage.tsx`
- `fe/src/pages/counselor/KonselorFeedbackPage.tsx`
- `fe/src/pages/counselor/KonselorJadwalPage.tsx`
- `fe/src/pages/counselor/KonselorPengaturanPage.tsx`
- `fe/src/pages/counselor/KonselorPermintaanPage.tsx`
- `fe/src/pages/counselor/KonselorRiwayatPage.tsx`

### File source baru

- `fe/src/components/counselor/activity/ActivityDialogs.tsx`
- `fe/src/components/counselor/schedule/ScheduleDialogs.tsx`
- `fe/src/components/counselor/settings/SettingsPrimitives.tsx`
- `fe/src/components/counselor/shared/CounselorIntakeFields.tsx`
- `fe/src/data/mock/counselorProfile.ts`
- `fe/src/data/mock/counselorSchedule.ts`
- `fe/src/features/counselor/activity/sessionSelectors.ts`
- `fe/src/features/counselor/dashboard/useCounselorDashboard.ts`
- `fe/src/features/counselor/feedback/feedbackSelectors.ts`
- `fe/src/features/counselor/history/historySelectors.ts`
- `fe/src/features/counselor/profile/profileValidation.ts`
- `fe/src/features/counselor/requests/decideCounselorRequest.ts`
- `fe/src/features/counselor/requests/requestSelectors.ts`
- `fe/src/features/counselor/schedule/scheduleUtils.ts`
- `fe/src/features/counselor/shared/presentation.ts`
- `fe/src/features/history/counselorHistoryAccess.ts`
- `fe/src/features/history/hooks/useCounselorHistoryAccess.ts`
- `fe/src/types/counselorProfile.ts`
- `fe/src/types/counselorSchedule.ts`

### Verifikasi Tahap 7

- Parsing sintaks TS/TSX dengan TypeScript compiler API global: **PASS**, 0 parse diagnostics pada 124 file source.
- Pemeriksaan seluruh relative import lokal: **PASS**, 0 path import yang tidak terselesaikan.
- Pemeriksaan TypeScript terarah pada file Tahap 7 dengan deklarasi sementara untuk dependensi eksternal yang tidak tersedia: **PASS**. Ini pemeriksaan bantu, bukan pengganti build dengan tipe resmi React/Zustand/Vite.
- Uji terisolasi layanan akses riwayat: **PASS** untuk password default/perubahan password, timestamp akses 30 menit, batas 3 percobaan, dan cooldown 5 menit.
- `npm run lint`: **BLOCKED** karena `eslint` tidak tersedia di `node_modules` ZIP.
- `npm run build`: **BLOCKED** karena tipe `vite/client` dan `node` tidak tersedia di `node_modules` ZIP. `npm ci --offline` juga tidak dapat selesai karena paket `zustand@5.0.15` tidak tersedia dalam cache; koneksi registry tidak berhasil pada percobaan instalasi sebelumnya.
- Browser visual/functional regression: **BELUM DILAKUKAN**. Setelah patch dipasang, jalankan `npm install`, `npm run lint`, `npm run build`, lalu cek halaman Konselor di browser.

### Hal yang tetap ditunda

- `public/informed-consent.pdf` masih belum tersedia; UI informed consent yang lama sengaja tidak diubah dan tidak dibuatkan dokumen pengganti.
- Aktivitas, riwayat, dashboard, dan kalender tetap menggunakan fixture terpisah jika ID relasinya belum terverifikasi. Tahap ini tidak mengarang relasi lintas halaman.
- Penyimpanan password riwayat berbasis digest di `sessionStorage` hanya mekanisme demo sisi browser, bukan otorisasi produksi. Saat backend tersedia, verifikasi dan batas akses harus dipindahkan ke server.
- Tidak ada perubahan route, dependensi, backend/service, atau commit otomatis pada Tahap 7.

## Tahap 8–10 — Modularisasi Admin, Kepala LMI, Publik, Cleanup, dan Backend Readiness

**Status:** Refactor terarah selesai pada source patch; validasi penuh build/lint/browser **belum dapat dikonfirmasi** di lingkungan patch ini karena dependensi frontend tidak tersedia dan registry npm tidak dapat dijangkau.

### Perubahan utama

- **Admin dashboard:** komponen metrik, tren aktivitas, distribusi layanan, beban konselor, dan daftar booking dipisahkan ke `components/admin/dashboard/DashboardSections.tsx`; halaman menjadi komposisi layout dan state filter.
- **Admin akun:** filter tab, pencarian, dan penentuan role default dipindahkan ke `features/admin/accounts/accountSelectors.ts`.
- **Admin feedback:** pemilihan periode, hitungan status moderasi, filter, dan pengurutan dipindahkan ke `features/admin/feedback/feedbackSelectors.ts`. Aturan alasan wajib ketika status menjadi `disabled` juga diperkuat di batas store Zustand.
- **Admin konseling:** rentang waktu dan bucket grafik dipindahkan ke `features/admin/counseling/timeSelectors.ts`; format label dan perilaku rentang tanggal dipertahankan.
- **Admin laporan:** pemilihan sesi berdasarkan periode, rata-rata rating, ringkasan outcome, agregasi bulanan, ringkasan konselor, alasan pembatalan, dan ringkasan topik dipindahkan ke `features/admin/reports/selectors.ts`.
- **Admin pengaturan dan Kepala LMI pengaturan:** primitive panel dan field yang serupa dipindahkan ke `components/shared/SettingsPrimitives.tsx`; mode header ringkas dipakai oleh Kepala LMI untuk mempertahankan struktur visual lamanya.
- **Periode akademik:** fungsi simpan demo `savePeriods` dipusatkan bersama `loadPeriods` di `lib/academicPeriods.ts`, lalu digunakan oleh halaman Admin Periode agar satu key storage dan satu helper menjadi sumber perilaku.
- **Kepala LMI dashboard:** komponen ringkasan statistik, aktivitas, dan konselor dipisahkan ke `components/headlmi/dashboard/DashboardSections.tsx`.
- **Kepala LMI feedback dan laporan:** filter periode, ringkasan rating, agregasi bulanan/konselor, ringkasan outcome, dan alasan pembatalan dipindahkan ke `features/headlmi/feedback/selectors.ts` serta `features/headlmi/reports/selectors.ts`; metric card yang sama dipakai bersama dari `components/headlmi/MetricCard.tsx`.
- **Publik:** section halaman Tentang dipisahkan ke `components/public/about/AboutSections.tsx`; komponen alur dan jenis layanan Panduan dipindahkan ke `components/public/guide/GuideSections.tsx`; pengurutan ulasan publik dan logika penilaian mood dipisahkan ke `features/public/feedback/selectors.ts` dan `features/public/mood/moodAssessment.ts`.
- Tidak ada perubahan route, implementasi backend/API, atau dependensi package.

### File source diubah

- `fe/src/components/shared/index.ts`
- `fe/src/features/feedback/store/feedbackStore.ts`
- `fe/src/lib/academicPeriods.ts`
- `fe/src/pages/admin/AdminAkunPage.tsx`
- `fe/src/pages/admin/AdminBerandaPage.tsx`
- `fe/src/pages/admin/AdminFeedbackPage.tsx`
- `fe/src/pages/admin/AdminKonselingPage.tsx`
- `fe/src/pages/admin/AdminLaporanPage.tsx`
- `fe/src/pages/admin/AdminPengaturanPage.tsx`
- `fe/src/pages/admin/AdminPeriodePage.tsx`
- `fe/src/pages/headlmi/KepalaLMIBerandaPage.tsx`
- `fe/src/pages/headlmi/KepalaLMIFeedbackPage.tsx`
- `fe/src/pages/headlmi/KepalaLMILaporanPage.tsx`
- `fe/src/pages/headlmi/KepalaLMIPengaturanPage.tsx`
- `fe/src/pages/public/AboutPage.tsx`
- `fe/src/pages/public/FeedbackPage.tsx`
- `fe/src/pages/public/MoodTrackerPage.tsx`
- `fe/src/pages/public/PanduanPage.tsx`

### File source baru

- `fe/src/components/admin/dashboard/DashboardSections.tsx`
- `fe/src/components/headlmi/MetricCard.tsx`
- `fe/src/components/headlmi/dashboard/DashboardSections.tsx`
- `fe/src/components/public/about/AboutSections.tsx`
- `fe/src/components/public/guide/GuideSections.tsx`
- `fe/src/components/shared/SettingsPrimitives.tsx`
- `fe/src/features/admin/accounts/accountSelectors.ts`
- `fe/src/features/admin/counseling/timeSelectors.ts`
- `fe/src/features/admin/feedback/feedbackSelectors.ts`
- `fe/src/features/admin/reports/selectors.ts`
- `fe/src/features/headlmi/feedback/selectors.ts`
- `fe/src/features/headlmi/reports/selectors.ts`
- `fe/src/features/public/feedback/selectors.ts`
- `fe/src/features/public/mood/moodAssessment.ts`

### Verifikasi

- TypeScript compiler API parse check seluruh source TS/TSX: **PASS**, 0 parse diagnostics pada 138 file.
- Pemeriksaan seluruh relative import lokal: **PASS**, 0 import path yang tidak terselesaikan.
- Type-check terarah modul selector, utilitas periode, dan utilitas tanggal menggunakan TypeScript global dengan strict mode: **PASS**.
- Smoke test terisolasi untuk selector hitungan moderasi, pengurutan ulasan, hasil mood default, dan rata-rata laporan: **PASS**.
- Pemeriksaan heuristik import dan local declaration yang tidak terpakai pada file terkait: **PASS**, tidak ditemukan sisa yang terdeteksi oleh pemeriksaan tersebut.
- `npm run lint`: **BLOCKED** — `eslint` tidak tersedia di lingkungan patch.
- `npm run build`: **BLOCKED** — definisi tipe `vite/client` dan `node` tidak tersedia. `npm ci --offline` tidak dapat dilakukan karena cache npm tidak memiliki `zustand@5.0.15`; percobaan instalasi online juga timeout.
- Browser visual/functional regression: **NOT RUN**. Perlu dijalankan di lingkungan proyek pengguna setelah patch diterapkan.

### Risiko dan pekerjaan yang tetap ditunda

- `src/pages/admin/AdminAktivitasPage.tsx` masih merupakan placeholder yang sudah ada sebelumnya (`ActivityPage`); implementasi fitur baru tidak termasuk refactor ini.
- `public/informed-consent.pdf` masih belum tersedia. Informed consent tetap **belum dikerjakan**; tidak ada dokumen atau status consent yang dibuat-buat.
- Fixture laporan Admin, laporan Kepala LMI, feedback agregat Kepala LMI, dan ulasan publik tetap terpisah jika belum memiliki mapping ID yang tervalidasi. Tidak dibuat relasi lintas-role hanya berdasarkan nama.
- `localStorage` pada pengaturan/periode masih merupakan penyimpanan demo browser. Data profil, perubahan konten, dan periode harus dipindahkan ke backend setelah kontrak API/schema disepakati.
- `services/` tetap tidak diisi implementasi API. Patch ini menyiapkan pemisahan logika, bukan mengklaim kesiapan produksi.
- Belum ada screenshot/browser test; periksa tampilan desktop/mobile, navigasi, filter, export CSV, cetak laporan, modal, dan pengaturan setelah patch dipasang.
