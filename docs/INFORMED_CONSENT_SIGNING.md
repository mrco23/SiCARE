# SiCARE: Arsitektur Digital Informed Consent Signing & PDF Generation

**Dokumen Teknis:** Batch 1.5c (Digital Signature & PDF Generation)
**Status:** IMPLEMENTED & TESTED (136/136 Backend Tests PASS, Frontend Lint & Build PASS)
**Tanggal:** 31 Oktober 2026
**Referensi Resmi:** Dokumen Formulir Informed Consent Lembaga Manajemen Informasi & Konseling (LMI) Universitas Katolik De La Salle Manado (`docs/reference/infromed-consent/informed-consent.pdf`)

---

## 1. Ringkasan Eksekutif

Batch 1.5c melengkapi fondasi basis data Informed Consent (Batch 1.5b dan 1.5b.1) dengan mengimplementasikan alur penandatanganan elektronik mandiri (_electronic signature pad_), pengisian identitas terverifikasi, perenderan dokumen PDF resmi berbasis templat kanonis, penyimpanan aman pada private Supabase Storage, serta audit trail kepatuhan klinis.

Prinsip fundamental:
1. **Persetujuan Individual:** Setiap peserta konseling (baik konseling individu maupun kelompok) menandatangani dokumen persetujuan secara mandiri. Tanda tangan Klien Utama tidak pernah mewakili anggota kelompok lainnya.
2. **Kesesuaian Templat Kanonis:** Dokumen PDF yang dihasilkan mempertahankan kalimat, struktur klausul, dan tata letak visual dari dokumen resmi LMI Unika De La Salle Manado (`docs/reference/infromed-consent/informed-consent.pdf`).
3. **Imutabilitas Bukti:** Dokumen yang telah ditandatangani dibekukan secara kriptografis (SHA-256) dan dilindungi oleh database trigger `prohibit_signed_consent_tampering()`. Identitas dan berkas yang sudah ditandatangani tidak dapat diubah kembali.
4. **Isolasi Privasi Storage:** Berkas tanda tangan PNG dan PDF bertandatangan disimpan dalam private Supabase Storage buckets dengan otorisasi berbasis signer dan assigned counselor. Klien Utama dilarang mengunduh dokumen bertandatangan anggota lain.

---

## 2. Analisis Templat PDF Kanonis

Berkas acuan resmi: `docs/reference/infromed-consent/informed-consent.pdf`

| Properti | Nilai Spesifikasi |
|---|---|
| Master SHA-256 | `59012141d8a54336928a4c076d9d0ad7276bbbc36064c37d9654cc031f14cd8f` |
| Kode Templat | `SICARE_IC_STD` |
| Versi Templat | `v1.0` |
| Format & Dimensi Halaman | 1 Halaman Tunggal, A4 (`595.276 x 841.890` poin standar PDF) |
| Tipe Isian | Bukan AcroForm interaktif; isian teks garis bawah (_underlined prompts_) dengan titik dua pada absis `x = 180` |
| Sistem Koordinat | Titik asal (0,0) di sudut kiri bawah (*bottom-left origin* standar PDF) |

### Peta Koordinat Overlay Teks & Gambar

| Kolom Identitas / Elemen | Absis (x) | Ordinat (y) | Dimensi / Ukuran | Format Tampilan |
|---|---|---|---|---|
| `full_name` (Nama Lengkap) | 190 | 624.5 | Font size 10 pt | Nama lengkap peserta |
| `faculty_study_program` (Fakultas / Prodi) | 190 | 602.0 | Font size 10 pt | e.g. "Fakultas Ilmu Komputer / Sistem Informasi" |
| `nim` (NIM) | 190 | 579.5 | Font size 10 pt | Nomor Induk Mahasiswa |
| `birth_info` (Tempat, Tanggal Lahir) | 190 | 557.0 | Font size 10 pt | e.g. "Manado, 12 April 2002" |
| `gender` (Jenis Kelamin) | 190 | 534.5 | Font size 10 pt | "Laki-laki" atau "Perempuan" |
| `phone_e164` (No. HP / WhatsApp) | 190 | 512.0 | Font size 10 pt | E.164 e.g. "+6281234567890" |
| `signing_date` (Tanggal Penandatanganan) | 418 | 263.8 | Font size 10 pt | Format Indonesia e.g. "31 Oktober 2026" |
| `signature_image` (Tanda Tangan Digital) | 390 | 165.0 | Lebar: 110 pt, Tinggi: 50 pt | Gambar PNG tanda tangan |
| `printed_name` (Nama Terang Penandatangan) | 375 | 140.0 | Font size 10 pt | Nama lengkap dalam kurung "( ... )" |

---

## 3. Validasi & Standar Keamanan Data

### 3.1. Validasi Identitas Peserta
Sebelum dokumen ditandatangani, seluruh 8 atribut identitas wajib diverifikasi oleh `validateConsentIdentity()`:
- `full_name`: String trimmed, minimal 2 karakter, maksimal 160 karakter.
- `faculty`: String trimmed, wajib diisi.
- `study_program`: String trimmed, wajib diisi.
- `nim`: String trimmed, wajib diisi.
- `birthplace`: String trimmed, tempat lahir wajib diisi.
- `date_of_birth`: Format tanggal valid (ISO YYYY-MM-DD).
- `gender`: Tepat salah satu dari `"Laki-laki"` atau `"Perempuan"`.
- `phone_e164`: Format nomor telepon seluler internasional/domestik, otomatis dinormalisasi menjadi awalan internasional `+62...`.

### 3.2. Validasi Tanda Tangan Digital PNG
Fungsi `validateSignaturePng()` menjamin berkas tanda tangan aman dari serangan injeksi:
- **Magic Bytes:** Memeriksa 8 byte awal berkas secara biner: `0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a`.
- **Penolakan Format Asing:** Menolak mutlak format SVG, XML, HTML, skrip teks, JPEG, atau buffer kosong. Pencegahan terhadap kerentanan XSS dan XML Entity Injection.
- **Batas Ukuran:** Maksimum 2 MB (`2 * 1024 * 1024` byte).
- **Integritas:** Dihitung hash kriptografis SHA-256 untuk disimpan pada log audit.

### 3.3. Persetujuan Eksplisit (Mandatory Agreement Checkbox)
Penandatanganan mewajibkan `agreement_accepted: true`. API backend menolak mutlak permintaan tanda tangan jika checkbox persetujuan belum dicentang.

---

## 4. Alur Kerja Penandatanganan & Pembangkitan PDF

```
[ Peserta Konseling ]
         │
         ▼
1. Buka Modal Informed Consent
   - Mengambil data draft & template melalui GET /consents/booking/:bookingId/my-consent
   - Formulir terisi otomatis dari profil akun SiCARE
         │
         ▼
2. Tinjau & Lengkapi Identitas (Opsional Edit Draft)
   - PATCH /consents/:id/identity (hanya jika draft belum ditandatangani)
         │
         ▼
3. Baca Seluruh Klausul Resmi LMI & Centang Checkbox Persetujuan
         │
         ▼
4. Goreskan Tanda Tangan pada Signature Pad Canvas (Touch / Stylus / Mouse)
         │
         ▼
5. Konfirmasi Penandatanganan (POST /consents/:id/sign)
   ├── A. Backend memvalidasi integritas identitas & tanda tangan PNG
   ├── B. Unggah PNG tanda tangan ke storage 'informed-consent-signatures'
   ├── C. Muat templat resmi & overlay teks/gambar via pdf-lib
   ├── D. Unggah PDF bertandatangan ke storage 'informed-consent-signed'
   ├── E. Mutasi status consent di PostgreSQL -> 'signed' (bekukan snapshot identitas & SHA-256)
   └── F. Catat log audit append-only ('consent_signed' & 'document_generated')
         │
         ▼
6. Tampilkan Status Berhasil & Tombol Unduh Dokumen PDF
   - GET /consents/:id/document menghasilkan presigned URL privat 60 detik
```

### 4.1. Idempotensi dan Penanganan Konkurensi
Jika pengguna mengirim ulang permintaan tanda tangan pada dokumen yang sudah bertatus `'signed'`, backend secara idempoten mengembalikan data dokumen yang sudah ada tanpa melakukan pembentukan ulang berkas atau menimpa berkas yang telah tersimpan.

### 4.2. Imutabilitas Dokumen
Setelah status menjadi `'signed'`:
- Mutasi draft identitas via `PATCH /consents/:id/identity` ditolak dengan kode `SIGNED_CONSENT_EVIDENCE_IMMUTABLE`.
- Database trigger `prohibit_signed_consent_tampering()` mencegah perubahan langsung pada kolom `identity_snapshot`, `signature_storage_path`, `signed_document_storage_path`, dan `signed_document_sha256`.

---

## 5. Arsitektur Kontrol Akses Storage (RBAC)

Migrasi `supabase/migrations/20261031170000_sicare_consent_signing_and_document_rbac.sql` menerapkan isolasi objek storage:

1. **Bucket `informed-consent-signatures` (Private):**
   - SELECT: Dibatasi hanya untuk penandatangan yang bersangkutan (`ic.signer_user_id = auth.uid()`) atau `service_role`.
   - INSERT: Hanya oleh pengguna terautentikasi untuk tanda tangan milik sendiri.
2. **Bucket `informed-consent-signed` (Private):**
   - SELECT: Dibatasi hanya untuk penandatangan dokumen (`ic.signer_user_id = auth.uid()`) atau konselor yang ditugaskan pada sesi terkait (`b.counselor_id = auth.uid()`).
   - Akses Klien Utama: Klien Utama **dilarang keras** mengunduh dokumen bertandatangan milik anggota kelompok lainnya.
3. **Presigned Download URL:**
   - Endpoint `GET /api/v1/consents/:id/document` mengevaluasi otorisasi pemohon via `assertConsentAccess()`. Pengguna yang tidak berhak menerima respon `403 FORBIDDEN`. Tautan unduh berumur pendek (default 60 detik) dibuat melalui Supabase Storage Service Role.

---

## 6. Komponen Antarmuka Frontend

| Komponen | Jalur Berkas | Tanggung Jawab |
|---|---|---|
| `SignaturePad.tsx` | `fe/src/components/consent/SignaturePad.tsx` | Canvas tanda tangan high-DPI (menyesuaikan `window.devicePixelRatio`), mendukung interaksi touch/stylus/mouse pointer events, latar belakang putih bersih, penolakan kanvas kosong, dan tombol bersihkan/ulang. |
| `InformedConsentModal.tsx` | `fe/src/components/consent/InformedConsentModal.tsx` | Modal dialog penuh mencakup identitas peserta, tinjauan klausul resmi LMI, checkbox persetujuan wajib, signature pad, dialog konfirmasi sebelum tanda tangan permanen, status penandatanganan, dan tombol unduh PDF resmi. |
| `consentApi.ts` | `fe/src/lib/consentApi.ts` | Klien API ter-tipe TypeScript (`getMyBookingConsent`, `getBookingConsentReadiness`, `getConsentById`, `updateDraftConsentIdentity`, `signInformedConsent`, `getSignedConsentDocumentUrl`). |
| `KlienAktivitasPage.tsx` | `fe/src/pages/client/KlienAktivitasPage.tsx` | Integrasi tombol "Informed Consent" pada kartu booking aktif dengan indikator visual status (badge "Consent Siap" warna emerald jika sudah ditandatangani, atau tombol aksi jika masih pending). |

---

## 7. Referensi Endpoint API

| Method | Endpoint | Hak Akses | Deskripsi |
|---|---|---|---|
| `GET` | `/api/v1/consents/booking/:bookingId/my-consent` | `client`, `counselor` | Mengambil atau menginisialisasi record consent peserta yang sedang login untuk suatu booking. |
| `GET` | `/api/v1/consents/booking/:bookingId/readiness` | `client`, `counselor`, `admin`, `head_lmi` | Memeriksa kesiapan consent seluruh peserta dalam booking secara tersanitasi. |
| `GET` | `/api/v1/consents/:id` | `client`, `counselor`, `admin`, `head_lmi` | Mengambil detail consent berdasarkan ID record (dibatasi otorisasi pemilik/konselor). |
| `PATCH` | `/api/v1/consents/:id/identity` | `client` | Memperbarui data draft identitas peserta sebelum ditandatangani. Ditolak jika sudah signed. |
| `POST` | `/api/v1/consents/:id/sign` | `client` | Mengirimkan tanda tangan PNG, membangkitkan PDF resmi, mengunggah ke storage, dan membekukan status. |
| `GET` | `/api/v1/consents/:id/document` | `client`, `counselor`, `admin`, `head_lmi` | Mengambil URL unduh bertanda waktu (presigned URL) untuk berkas PDF bertandatangan. |

---

## 8. Verifikasi & Pengujian Otomatis

Suite pengujian khusus: `be/test/consentSigning.test.js`

1. **Uji Integritas Templat & Tata Letak:**
   - Memastikan hash SHA-256 templat acuan cocok dengan `59012141d8a54336928a4c076d9d0ad7276bbbc36064c37d9654cc031f14cd8f`.
   - Memastikan dokumen memuat tepat 1 halaman A4 berdimensi 595 x 842 pt.
   - Memverifikasi peta koordinat untuk seluruh 9 posisi teks dan gambar overlay.
   - Memverifikasi formatting tanggal bahasa Indonesia (`formatIndonesianDate`).
2. **Uji Validasi Identitas & Tanda Tangan:**
   - Menolak identitas tidak lengkap (NIM kosong, nama kosong, format tanggal lahir salah, jenis kelamin tidak valid).
   - Menolak tanda tangan kosong, tanda tangan SVG/HTML, dan berkas melebihi 2 MB.
   - Menerima tanda tangan biner PNG yang valid dengan magic header `0x89, 0x50, 0x4e, 0x47`.
3. **Uji Pembangkitan PDF:**
   - Memverifikasi keluaran `generateInformedConsentPdf()` menghasilkan buffer dokumen PDF valid, 1 halaman, berukuran ~110 kB dengan SHA-256 yang terhitung tepat.
4. **Uji Alur Penandatanganan:**
   - Menolak penandatanganan tanpa centang persetujuan kesediaan (`agreement_accepted: false`).
   - Menguji idempotensi penandatanganan ulang dokumen yang sudah `signed`.
   - Menguji pengunggahan berkas storage, mutasi database, dan penulisan log audit `consent_signed` dan `document_generated`.
5. **Uji Imutabilitas & Otorisasi Unduh Dokumen:**
   - Memastikan upaya mutasi draft identitas pada dokumen yang sudah bertatus `signed` ditolak dengan error `SIGNED_CONSENT_EVIDENCE_IMMUTABLE`.
   - Menguji penolakan unduh bagi Klien Utama terhadap dokumen peserta kelompok lain (`403 FORBIDDEN`).
   - Menguji izin unduh bagi penandatangan dokumen dan konselor yang ditugaskan.
6. **Uji Skrip Migrasi Storage RBAC:**
   - Memverifikasi keberadaan kebijakan RLS objek storage untuk bucket `informed-consent-signatures` dan `informed-consent-signed`.

### Hasil Faktual Pengujian
- `be: npm run check` -> **PASS** (30/30 berkas backend sintaks valid).
- `be: npm test` -> **PASS 136/136** (0 gagal, 0 skipped, 12 tes penandatanganan baru).
- `fe: npm run lint` -> **PASS** (0 errors, 0 warnings).
- `fe: npm run build` -> **PASS** (2456 modul ditransformasikan, dist PWA dihasilkan).
