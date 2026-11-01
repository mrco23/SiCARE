# SiCARE Design System: Warna, Layout, Typography, dan CSS

**Tujuan:** konsistensi lintas halaman dalam role yang sama, tanpa redesign komponen yang sudah berjalan.
**Warna utama final:** `#064E3B`.
**CSS utama:** `src/index.css` (Tailwind CSS v4 dengan `@theme`).

## 1. Prinsip Migrasi

- Pertahankan struktur, komponen, dan perilaku UI yang ada. Perubahan visual yang disetujui adalah penyeragaman warna primary, wrapper, ukuran judul, dan baseline spacing di dalam role yang sama.
- **Tailwind `className` tetap berada di TSX.** Jangan membuat CSS class khusus hanya untuk mengganti semua utility Tailwind yang sudah ada.
- CSS khusus, animasi, keyframes, global tokens, dan shared layout classes berada di `src/index.css`.
- Hindari style props berisi CSS statis; nilai dinamis yang tidak mungkin direpresentasikan utility statis boleh menggunakan CSS custom-property bridge.
- Prioritaskan semantik: `primary` untuk aksi utama dan navigasi; merah untuk error/danger, kuning untuk warning, amber untuk bintang. Jangan mengganti semua warna secara membabi buta.

## 2. Token Warna

Token yang sudah ada pada snapshot: `--color-primary`, `--color-primary-dark`, `--color-primary-light`, `--color-secondary`, `--color-secondary-dark`, `--color-bg`, `--color-text-base`, `--color-text-muted`. **Utamakan reuse, bukan duplikasi.**

| Token | Nilai awal | Kegunaan |
|---|---|---|
| `--color-primary` | `#064E3B` | Brand, tombol primary, tab aktif, tautan aktif |
| `--color-primary-dark` | `#043D2E` | Hover/pressed primary |
| `--color-primary-light` | `#0A7A5C` | Highlight hijau yang memang diperlukan |
| `--color-secondary` | `#DFF5E8` | Background hijau lembut |
| `--color-secondary-dark` | `#B8E8CA` | Variasi background/border pendukung |
| `--color-bg` | `#FAFAF5` | Background global bila dipakai |
| `--color-text-base` | `#1A1A1A` | Teks utama |
| `--color-text-muted` | `#6B7280` | Teks keterangan |

Nilai background/border spesifik yang sudah ada di UI tidak harus diseragamkan secara paksa. Audit terlebih dahulu apakah suatu warna merupakan peran semantik, identitas logo kampus, atau dekorasi khusus.

Contoh definisi yang diharapkan ada satu kali di `src/index.css`:

```css
@import "tailwindcss";

@theme {
  --color-primary: #064E3B;
  --color-primary-dark: #043D2E;
  --color-primary-light: #0A7A5C;
  --color-secondary: #DFF5E8;
  --color-secondary-dark: #B8E8CA;
  --color-bg: #FAFAF5;
  --color-text-base: #1A1A1A;
  --color-text-muted: #6B7280;
  --font-sans: "Inter", system-ui, sans-serif;
}
```

Catatan: Ini **spesifikasi**, bukan perintah mengganti seluruh isi `index.css` dengan cuplikan tersebut. Pertahankan reset, scrollbar, animasi auth, dan aturan yang sudah berjalan.

Contoh pemakaian setelah migrasi:

```tsx
<button className="rounded-xl bg-primary px-4 py-2.5 text-white hover:bg-primary-dark">
  Simpan
</button>
```

Jangan menulis class yang tidak terdaftar sebagai token/utility atau membuat warna dengan interpolasi string dinamis yang tidak bisa dipindai Tailwind.

## 3. Kontrak Layout Berdasarkan Role

| Role | Default content width | H1 | Struktur |
|---|---|---|---|
| Admin | `max-w-7xl` | `text-2xl sm:text-3xl` | `AdminLayout` → `PageContainer` → `PageHeader` → konten |
| Klien | `max-w-7xl` | `text-2xl sm:text-3xl` | `KlienLayout` → `PageContainer` → `PageHeader` → konten |
| Konselor | `max-w-6xl` | `text-2xl sm:text-3xl` | `KonselorLayout` → `PageContainer` → `PageHeader` → konten |
| Kepala LMI | `max-w-7xl` | `text-2xl sm:text-3xl` | `KepalaLMILayout` → `PageContainer` → `PageHeader` → konten |
| Publik & Auth | Berdasarkan desain yang berlaku | Audit terpisah | Jangan paksa menggunakan dashboard wrapper |

**Aturan tunggal:** lebar dan padding horizontal *page shell* mempunyai satu pemilik (idealnya layout). Page tidak boleh lagi menambahkan wrapper `max-w-*`/`px-*` lain hanya untuk mengulang fungsi yang sama.

**Tetap diperbolehkan** `max-w-*` pada form, tabel, teks, atau kontainer internal bila merupakan kebutuhan desain lokal dan tidak menggandakan pembungkus utama.

Parameter yang harus diaudit per role sebelum finalisasi:

- Padding horizontal mobile / tablet / desktop, mempertimbangkan padding yang sudah ada di layout (`p-4 sm:p-6` pada beberapa role di snapshot).
- Margin dari sidebar desktop (`lg:ml-[248px]` atau aturan existing), tinggi navbar (`72px` pada beberapa role), serta bottom navigation mobile.
- Tinggi minimum halaman, overflow, scroll container, sticky component, posisi modal/toast.
- Konsistensi heading saat menu berubah, terutama transisi daftar → detail dan filter responsive.

`PageContainer` dapat menggunakan variant `role` atau wrapper spesifik masing-masing layout. Pilih satu pendekatan yang menghindari wrapper ganda. Jangan menambahkan nested `<main>` bila layout sudah memilikinya.

## 4. Tipografi

- Font global: Inter; pertahankan import font yang sudah ada, jangan mengganti keluarga font tanpa persetujuan.
- Heading utama dashboard tiap role: `text-2xl font-extrabold tracking-tight sm:text-3xl`.
- `PageHeader` menerima minimal: `title`, `description?`, `actions?`, serta `children?` hanya bila perlu.
- Heading bagian: rekomendasi `text-base` atau `text-lg font-bold`, pilih satu per jenis section lalu konsisten.
- Label form: `text-sm font-medium`. Helper: `text-xs text-gray-500` (atau token muted yang setara).
- Jangan paksa nama konselor, angka KPI, metric cards, dan heading modal mengikuti ukuran H1; konteksnya berbeda.
- Jangan mengganti konten teks yang sudah ada hanya agar pendek/panjang.

Contoh konseptual (bukan wajib API final):

```tsx
<PageContainer role="admin">
  <PageHeader title="Feedback Klien" description="Periksa dan kelola feedback yang dikirim klien." />
  <FeedbackSummary />
  <FeedbackModerationTable />
</PageContainer>
```

Jika `PageContainer` sudah berada di layout, jangan menambahkannya sekali lagi di masing-masing page. Pilih pola final dan dokumentasikan.

## 5. Aturan Pemisahan CSS

**Pindahkan ke `index.css`:**

- `<style> ... @keyframes ... </style>` di JSX.
- Inline CSS statis: `style={{ color: '#...' }}`, `style={{ marginTop: ... }}`, dst., bila setara dengan class Tailwind atau semantic CSS class.
- Shared CSS khusus animasi, slider, scrollbar, cropping overlay, dynamic chart bars, dan efek dekorasi yang berulang.
- Nilai warna HEX yang berperan primary → token `primary`.

**Pengecualian terkontrol untuk data dinamis:**

```tsx
// TSX: mengirim data, bukan aturan CSS
<div className="feedback-distribution-bar" style={{ "--bar-width": `${percentage}%` } as React.CSSProperties} />
```

```css
/* index.css */
.feedback-distribution-bar {
  width: var(--bar-width, 0%);
}
```

Gunakan pendekatan serupa untuk offset crop, ukuran/posisi dinamis, dan progress. Dokumentasikan setiap pengecualian. Jangan menggunakan inline `<style>` dalam TSX untuk deklarasi panjang.

## 6. Komponen Shared yang Layak Dibuat

- `PageContainer`, `PageHeader`
- `Button`, `Modal`, `FormField`, `StatusBadge`
- `SearchField`, `PeriodFilter`, `Pagination` (hanya bila benar-benar sama)
- `RatingStars`, `EmptyState`, `ConfirmDialog`

**Jangan memaksakan abstraksi** jika dua modal berbeda logika, aksesibilitas, atau perilakunya. Kemiripan visual saja tidak selalu cukup.

## 7. Uji Visual Wajib

Periksa setiap role di viewport kecil (sekitar 375px), tablet (sekitar 768px), dan desktop (sekitar 1440px), atau ukuran lain yang tersedia. Ambil screenshot sebelum/sesudah apabila browser memungkinkan.

- H1 dan deskripsi sejajar antar-page dalam role sama.
- Max-width dan padding konsisten; tidak menabrak sidebar atau bawah navbar.
- Tidak muncul scroll horizontal yang baru.
- Tombol mobile, modal, dropdown, filter, dan tabel tidak terpotong.
- Warna primary yang terlihat adalah `#064E3B`; status error, warning, dan rating tetap jelas.
- Tidak ada pergeseran card/modal/spacing di luar perubahan standar yang telah disetujui.

Jika screenshot tidak tersedia, tulis *NOT RUN*, minta pemeriksaan manusia, dan jangan mengklaim visual regression lulus.


## Catatan Implementasi PageContainer (Tahap Layout)

- `PageContainer` menjadi pemilik lebar maksimum dan dasar tipografi pada halaman role yang menggunakannya.
- Prop `spacing` menerima `"default"` (default, menerapkan jarak antar-child `space-y-6`) atau `"none"` untuk halaman yang sudah mengatur jarak setiap section dengan utility seperti `mt-6`. Pilih satu sumber jarak agar tidak terjadi spacing ganda.
- `KlienLayout` pada snapshot masih memiliki wrapper lebar/padding sendiri. Untuk migrasi minimal, halaman klien menggunakan `PageHeader` tanpa menambahkan `PageContainer` di dalamnya, kecuali jika wrapper pada layout kelak dipindahkan sebagai bagian dari tahap tersendiri.
