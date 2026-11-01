# SiCARE: Acceptance Criteria dan Regression Checklist

> **Konteks:** kriteria dalam dokumen ini berasal dari refactor frontend/mock sebelum integrasi API. Untuk penerimaan integrasi full-stack, gunakan `../integration/API_ENDPOINT_MATRIX.md` dan `../integration/SOP_COVERAGE_MATRIX.md`; jangan menganggap checklist mock sebagai bukti penyimpanan atau keamanan produksi.

## A. Definisi PASS / FAIL / NOT RUN

- **PASS**: dijalankan, hasil teramati sesuai ekspektasi; dokumentasikan bukti/command.
- **FAIL**: dijalankan, hasil tidak sesuai; catat detail dan dampaknya.
- **NOT RUN**: tidak dieksekusi karena keterbatasan; tulis alasan. **Tidak boleh dinyatakan PASS.**
- **BASELINE ISSUE**: masalah sudah ada sebelum perubahan; catat bukti pembanding. Tetap laporkan secara transparan.

Tahap baru boleh dinyatakan selesai ketika semua *blocker* utama PASS dan tidak ada regresi baru; pengecualian membutuhkan keputusan eksplisit pengguna.

## B. Perintah Pemeriksaan Minimum

Dari root proyek (sesuaikan bila command tidak tersedia di lingkungan):

```bash
git status --short
npm ci
npm run build
npm run lint
```

`npm ci` biasanya dijalankan sekali saat setup environment, bukan setiap subtugas. `npm run build` dalam snapshot menjalankan `tsc -b && vite build`; jangan menganggap Vite build saja setara dengan pemeriksaan TypeScript. Bila command gagal, kutip error sebenarnya, klasifikasikan *baseline* atau regresi.

Untuk unit yang menyentuh alur, lakukan uji manual/browser atau test yang memang tersedia. Jangan mengklaim screenshot visual telah diperiksa jika tidak ada browser/screenshot.

## C. Checklist Umum untuk Setiap Subtugas

- [ ] Scope dan file yang diizinkan jelas; tidak ada perubahan tidak diminta.
- [ ] `git diff` tidak memperlihatkan penghapusan fitur, string, data, atau prop penting.
- [ ] Kode page yang dipindahkan tetap berfungsi (routing/import/export dan props cocok).
- [ ] Tidak ada TypeScript error baru.
- [ ] Tidak ada lint error baru pada file yang disentuh.
- [ ] Build dapat berjalan tanpa regresi baru (jika lingkungan mendukung).
- [ ] Responsif dan layout tidak bergeser di luar standar disetujui.
- [ ] Keyboard, fokus modal, close, action button, disabled state, feedback error/success tetap bekerja.
- [ ] Dummy data konsisten; tidak ada ID/tabrakan/mapping palsu.
- [ ] Storage dan privasi mengikuti `DATA_ARCHITECTURE.md`.
- [ ] `docs/PROJECT_STATUS.md` diperbarui dengan file, bukti uji, isu, dan langkah berikutnya.
- [ ] Agent berhenti setelah subtugas yang disetujui.

## D. Kriteria Selesai per Tahap

### Tahap 0: Baseline
- [ ] Inventaris folder dan halaman berbasis working tree terbaru.
- [ ] Inventaris seluruh route dari `src/app/router.tsx`.
- [ ] Audit data dummy, storage, inline CSS/HEX, dan animasi.
- [ ] Identifikasi file yang divergen dari snapshot jika tersedia.
- [ ] Build dan lint dijalankan atau berstatus NOT RUN dengan alasan.
- [ ] `docs/PROJECT_STATUS.md` diisi tanpa mengubah source code aplikasi.

### Tahap 1: Colour palette
- [ ] Token utama `#064E3B` ada satu sumber kanonis di `src/index.css`.
- [ ] Semua tombol/navigasi dengan peran primary yang dimigrasi konsisten.
- [ ] Warna status/error/warning/bintang/logo tidak dirusak.
- [ ] Perubahan visual warna yang diminta terverifikasi.
- [ ] Tidak ada regresi responsive/modal.

### Tahap 2: Layout dan tipografi
- [ ] Wrapper utama tiap role konsisten (width/padding/alignment).
- [ ] Tidak ada double wrapper/double padding.
- [ ] H1 dan deskripsi berada pada baseline yang sama antar halaman se-role.
- [ ] Sidebar, navbar, bottom navigation tetap berfungsi.
- [ ] Mobile/tablet/desktop tidak mengalami overflow baru.

### Tahap 3: Types dan status
- [ ] Shared type tidak didefinisikan saling bertentangan.
- [ ] Status enum, label, dan rules memiliki sumber kanonis.
- [ ] Semua mapping dari status lama terdokumentasi dan lolos uji.
- [ ] Tidak ada perubahan perilaku filtering/status karena rename.

### Tahap 4: Data dummy
- [ ] Dataset utama pindah ke `src/data/mock/` dan stabil.
- [ ] Relasi menggunakan ID yang dapat diaudit.
- [ ] Jumlah dan isi data lama dipertahankan atau perubahan tercatat disetujui.
- [ ] Tidak ada relasi consent/feedback/klien yang direkayasa.
- [ ] Komponen tidak membuat ulang data acak saat mount.

### Tahap 5: Zustand
- [ ] Zustand dipasang dengan versi yang kompatibel dan lock file diperbarui.
- [ ] Hanya shared state yang masuk stores; local UI state tetap lokal.
- [ ] Komponen klien/konselor/admin membaca entitas yang sama sesuai ID.
- [ ] Selector dan actions tidak menyebabkan penggandaan data.
- [ ] Kebijakan refresh/persistensi telah disetujui, didokumentasikan, dan diuji.
- [ ] Tidak ada payload sensitif di persisted browser storage.

### Tahap 6: Klien
- [ ] Booking, aktivitas, detail konselor, dan riwayat tetap ada.
- [ ] Kalender, reschedule, format/semester, feedback, consent modal tetap bekerja.
- [ ] Tidak ada perubahan tak terduga dalam kartu dan navigasi mobile.
- [ ] Data terkait dibaca melalui model bersama yang benar.

### Tahap 7: Konselor
- [ ] Semua halaman konselor dan fiturnya tetap ada.
- [ ] Akses riwayat satu password 30 menit tetap bekerja saat pindah route dan refresh.
- [ ] Expiry mengunci daftar/detail/note aktif; tiga percobaan dan cooldown tetap sesuai.
- [ ] Detail klien tidak pernah memakai consent klien lain.
- [ ] Perubahan password riwayat dari Pengaturan tetap diterapkan sesuai prototipe.

### Tahap 8: Admin
- [ ] Admin Feedback memiliki `pending`, `shown`, `disabled` dan alasan penonaktifan wajib.
- [ ] Semua filter status/rating/psikolog/periode tetap benar.
- [ ] Feedback publik hanya menggunakan yang `shown`.
- [ ] Semua halaman Admin tetap dengan wrapper dan heading yang sama.
- [ ] Periode akademik, laporan, akun, dan konseling tidak regresi.

### Tahap 9: Kepala LMI, publik, auth
- [ ] Dashboard, feedback, laporan, dan pengaturan Kepala LMI tidak regresi.
- [ ] Halaman publik dan auth tidak berubah desain tanpa izin.
- [ ] Testimonial publik tidak menampilkan feedback pending/disabled.
- [ ] Route publik/auth beserta role navigation tetap benar.

### Tahap 10: Final
- [ ] Tidak ada unused code/duplicate stylesheet impor yang menyebabkan bug.
- [ ] Build/lint tidak mempunyai regresi baru.
- [ ] Semua smoke test lintas-role PASS atau pengecualian disetujui.
- [ ] Screenshot/perbandingan manual UI telah dilakukan dan dicatat.
- [ ] Semua perubahan punya catatan progress serta daftar known limitations.

## E. Smoke Test Route (berdasarkan `src/app/router.tsx` pada ZIP)

Jalankan setiap route yang tersedia; verifikasi router aktual jika ada perubahan sebelum test.

| Role | Route yang perlu dicoba |
|---|---|
| Public | `/`, `/tentang-kami`, `/panduan`, `/profil-konselor`, `/mood-tracker`, `/feedback` |
| Auth | `/login`, `/register` |
| Klien | `/klien`, `/klien/pesanan`, `/klien/aktivitas`, `/klien/konselor`, `/klien/riwayat`, `/klien/pengaturan` |
| Konselor | `/konselor`, `/konselor/aktivitas`, `/konselor/permintaan`, `/konselor/riwayat`, `/konselor/jadwal`, `/konselor/feedback`, `/konselor/pengaturan` |
| Admin | `/admin`, `/admin/aktivitas`, `/admin/akun`, `/admin/konseling`, `/admin/feedback`, `/admin/laporan`, `/admin/periode`, `/admin/pengaturan` |
| Kepala LMI | `/kepala-lmi`, `/kepala-lmi/laporan`, `/kepala-lmi/feedback`, `/kepala-lmi/pengaturan` |

**Wajib uji alur lintas-page:**

1. Booking Klien → Permintaan Konselor → Admin Konseling → kembali ke Klien.
2. Consent pada Aktivitas Klien → tampilan Konselor Riwayat untuk session yang sama.
3. Feedback baru → Admin pending → shown → halaman publik → disabled + alasan → hilang dari publik.
4. Riwayat Konselor unlock → buka catatan beberapa klien → pindah route → refresh → waktu habis dan terkunci.
5. Logout/login simulasi sesuai flow existing; reset akses riwayat.
6. Filter Hari/Minggu/Bulan/Semester dan opsi rating/format tiap halaman terkait.
7. Unduh/view PDF informed consent hanya bila `public/informed-consent.pdf` memang tersedia; jika tidak, catat issue sumber asset, jangan membuat file PDF palsu.

## F. Test Visual

Minimal satu halaman representatif tiap role diuji di mobile dan desktop; setelah standarisasi layout, uji beberapa halaman berbeda **dalam role yang sama** untuk melihat konsistensi wrapper dan H1. Gunakan hasil screenshot baseline. Catat keterbatasan jika screenshot tak bisa dibuat.

## G. Kapan Agent Harus Berhenti

Berhenti dan minta persetujuan bila:

- Perubahan memerlukan menghapus atau mengganti fitur.
- Relasi data dummy tidak dapat dipastikan.
- Perlu menyimpan data sensitif agar fitur bertahan refresh.
- Perlu mengubah route, skema penyimpanan, atau aturan hak akses.
- Perlu membuat API/backend atau dependensi besar di luar tahap.
- UI harus berbeda dari standar yang disetujui agar implementasi bisa berjalan.
- Ada konflik kode, perubahan user tak ter-commit, atau merge conflict.

## H. Format Bukti Akhir Subtugas

```text
Tahap / Subtugas:
Perubahan ringkas:
File berubah:
Risiko / regresi yang dicek:
npm run build: PASS / FAIL / NOT RUN (log ...)
npm run lint: PASS / FAIL / NOT RUN (log ...)
Functional smoke: PASS / FAIL / NOT RUN (skenario ...)
Visual review: PASS / FAIL / NOT RUN (viewport / bukti ...)
Catatan baseline / isu tersisa:
Keputusan/approval yang dibutuhkan:
```
