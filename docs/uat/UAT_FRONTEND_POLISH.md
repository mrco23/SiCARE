# UAT Frontend Polish Documentation (Batch 1.5g.2)

Tanggal: 1 November 2026
Status: Terimplementasi & Terverifikasi (Build PASS, ESLint 0 errors/0 warnings)

Dokumen ini mencatat detail teknis dan hasil implementasi dari 3 perbaikan frontend yang diselesaikan pada Batch 1.5g.2 sebelum pelaksanaan Manual User Acceptance Testing (UAT).

---

## 1. Task A: Navbar Profile Dropdown & Sesi Logout Terpadu

### 1.1. Latar Belakang & Masalah
Sebelumnya, navigasi profil pada navbar di 4 layout (`AdminLayout`, `KepalaLMILayout`, `KonselorLayout`, `KlienLayout`) memiliki perilaku yang tidak seragam:
- Admin dan Kepala LMI menampilkan gambar statis tanpa menu aksi atau tombol keluar.
- Konselor dan Klien hanya berupa tautan navigasi langsung ke halaman pengaturan tanpa opsi logout yang jelas dari navbar.
- Tidak tersedia dropdown menu profil yang mudah diakses dari header aplikasi.

### 1.2. Solusi & Implementasi
Dibuat komponen bersama terpadu: `fe/src/components/shared/NavbarProfileDropdown.tsx`.
Komponen ini diintegrasikan ke dalam seluruh 4 layout sistem SiCARE:
1. `fe/src/layouts/AdminLayout.tsx` (`role="admin"`)
2. `fe/src/layouts/KepalaLMILayout.tsx` (`role="head_lmi"`)
3. `fe/src/layouts/KonselorLayout.tsx` (`role="counselor"`)
4. `fe/src/layouts/KlienLayout.tsx` (`role="client"`)

### 1.3. Perilaku & Kontrak Interaksi
- **Pemicu Dropdown:** Tombol avatar melingkar berukuran standar (`h-10 w-10` / 40px) dengan ring focus yang dapat diakses melalui keyboard.
- **Header Profil Dropdown:** Menampilkan avatar, nama lengkap pengguna (dari Supabase profile), email autentikasi, serta badge peran pengguna berdesain emerald.
- **Tautan Pengaturan:** Mengarah ke rute pengaturan sesuai peran:
  - Admin: `/admin/pengaturan`
  - Kepala LMI: `/kepala-lmi/pengaturan`
  - Konselor: `/konselor/pengaturan`
  - Klien: `/klien/pengaturan`
- **Tombol Keluar ("Keluar dari SiCARE"):**
  - Menggunakan arsitektur autentikasi yang ada (`useAuth().signOut()`).
  - Menghapus sesi supabase, menghapus state lokal terotentikasi.
  - Menampilkan state loading interaktif (`Loader2`) untuk mencegah multi-submit.
  - Melakukan redirect ke `/login` dengan opsi `{ replace: true }`.
  - Mencegah akses kembali ke rute terlindungi setelah sesi berakhir.
- **Aksesibilitas & UX:**
  - Menutup secara otomatis saat pengguna mengklik di luar area dropdown (`mousedown` dan `touchstart` listener).
  - Menutup secara otomatis saat pengguna menekan tombol `Escape`.
  - Responsif pada tampilan layar mobile maupun desktop tanpa layout shift.

---

## 2. Task B: Sistem Avatar Profil & Pembangkitan Inisial

### 2.1. Aturan Tampilan Avatar Peran Admin
- **Aturan Ketat:** Admin **SELALU** menggunakan logo resmi SiCARE (`/icon-512x512.png`).
- Logo diletakkan di dalam kontainer lingkaran berlatar putih dengan `object-contain` dan padding halus.
- Admin **tidak pernah** menggunakan foto pribadi atau inisial nama sembarang.

### 2.2. Aturan Tampilan Avatar Non-Admin (Kepala LMI, Konselor, Klien)
Sistem avatar mengimplementasikan urutan prioritas berjenjang (fallback chain):
1. **Foto Profil Unggahan:** Menampilkan foto profil yang diunggah pengguna jika tersedia (`photoUrl` / `avatar_url` / `photo_path`).
2. **Inisial Fallback:** Jika tidak ada foto atau gambar gagal dimuat (`onError`), sistem menampilkan avatar fallback berisi 1–2 huruf inisial nama.
3. **Desain Inisial:** Menggunakan warna brand resmi SiCARE `#064E3B` dengan tipografi tebal (bold) putih di tengah kontainer bundar.

### 2.3. Algoritma Pembangkitan Inisial (`fe/src/lib/avatarUtils.ts`)
Fungsi `getInitials(name?: string | null): string` mematuhi aturan berikut:
1. Trim spasi depan dan belakang.
2. Abaikan spasi berulang di antara kata (`split(/\s+/)`).
3. Ambil karakter pertama dari kata pertama (`Array.from(words[0])[0]?.toUpperCase()`).
4. Ambil karakter pertama dari kata kedua jika tersedia (`Array.from(words[1])[0]?.toUpperCase()`).
5. Ubah menjadi huruf kapital (*uppercase*).
6. Jika nama hanya memiliki satu kata, tampilkan satu karakter saja.
7. Mendukung karakter Unicode dan nama khas Indonesia.

**Hasil Pengujian Inisial:**
| Nama Input | Inisial yang Dihasilkan | Keterangan |
|---|---|---|
| `"Marco Makalew"` | `MM` | Dua kata |
| `"Gio"` | `G` | Satu kata |
| `"Alvin Pramudita"` | `AP` | Dua kata |
| `"Muhammad Alvin Pramudita"` | `MA` | Tiga kata (kata 1 & 2) |
| `"  budi   santoso  "` | `BS` | Menangani spasi liar |
| `""` / `null` / `undefined` | `U` | Default pengguna |

---

## 3. Task C: Standardisasi Komponen Academic Period Filter

### 3.1. Latar Belakang & Masalah
Sebelumnya, komponen pemilihan periode akademik terfragmentasi:
- `AdminFeedbackPage.tsx` memiliki implementasi modal dropdown 2-kolom yang sangat rapi (`PeriodDropdown`).
- `AdminLaporanPage.tsx` menduplikasi logika tersebut secara internal (`SemesterPeriodDropdown`).
- `AdminKonselingPage.tsx` hanya memakai elemen HTML `<select>` mentah sederhana saat filter mode semester dipilih.
- `KonselorFeedbackPage.tsx` dan `KonselorRiwayatPage.tsx` memakai elemen HTML `<select>` mentah dengan styling minimal.

### 3.2. Solusi: Komponen Bersama `AcademicPeriodFilter.tsx`
Dibuat komponen reusable di `fe/src/components/shared/AcademicPeriodFilter.tsx` yang mengadopsi desain visual referensi dari `AdminFeedbackPage.tsx`:
- **Trigger Button:** `rounded-2xl`, border slate-200, label kecil uppercase "Periode akademik", teks tebal semester/tahun ajaran, pill status periode (Aktif / Mendatang / Selesai), dan indikator chevron yang berotasi mulus.
- **Dropdown Popover:** Card melayang berbayang lembut (`rounded-2xl`, shadow-2xl, border-slate-200) dengan opsi "Semua periode" di bagian atas (dapat disembunyikan via prop `showAllOption={false}`).
- **Layout 2-Kolom:**
  - Kolom kiri: Daftar Tahun Ajaran (`Tahun ajaran`) dengan penanda dot aktif.
  - Kolom kanan: Daftar semester (`Ganjil`, `Genap`) dilengkapi rentang tanggal terformat bahasa Indonesia, pill status, dan slot kustom untuk badge jumlah (misalnya: "X feedback" atau "Y sesi").
- **Toleransi Tipe Fleksibel:** Menggunakan adapter normalisasi data internal sehingga kompatibel dengan tipe `AcademicPeriod`, `PublicAcademicPeriod`, maupun DTO mentah dari API.

### 3.3. Standardisasi 5 Halaman SiCARE
Seluruh 5 halaman berikut kini menggunakan `AcademicPeriodFilter` secara konsisten:
1. `fe/src/pages/admin/AdminFeedbackPage.tsx`
2. `fe/src/pages/admin/AdminLaporanPage.tsx`
3. `fe/src/pages/admin/AdminKonselingPage.tsx`
4. `fe/src/pages/counselor/KonselorFeedbackPage.tsx`
5. `fe/src/pages/counselor/KonselorRiwayatPage.tsx`

---

## 4. Hasil Verifikasi Otomatis
- **ESLint:** `npm --prefix fe run lint` -> **PASS** (0 errors, 0 warnings).
- **TypeScript & Vite Build:** `npm --prefix fe run build` -> **PASS** (semua 2461 modul tertransformasi tanpa kegagalan).
- **Backend Check:** `npm --prefix be run check` -> **PASS** (31 file bebas syntax error).
- **Backend Test Suite:** `npm --prefix be test` -> **PASS** (184/184 tests pass, 0 fail).
