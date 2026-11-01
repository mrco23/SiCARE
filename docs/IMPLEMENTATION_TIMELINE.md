# SiCARE Implementation Timeline

**Tanggal penyusunan:** 30 Oktober 2026
**Target mulai:** 2 November 2026
**Target selesai:** 30 Desember 2026
**Estimasi:** 9 minggu kalender, dengan asumsi sekitar 5 hari kerja per minggu dan satu pengembang utama.

Dokumen ini adalah rencana kerja bertahap untuk integrasi frontend-backend SiCARE, verifikasi SOP, pengujian lintas-role, dan persiapan rilis. Tanggal merupakan target, bukan komitmen tetap. Jadwal dapat bergeser jika ditemukan bug, dependency teknis, kebutuhan data uji, atau keputusan SOP yang belum disetujui.

> **Perubahan prioritas:** terdapat batas waktu team testing pada Minggu malam, 1 November 2026. Untuk tenggat ini, ikuti [`WEEKEND_READINESS_PLAN.md`](WEEKEND_READINESS_PLAN.md). Timeline 9 minggu di bawah tetap menjadi roadmap lanjutan, bukan target yang harus diselesaikan sebelum Minggu.

## 1. Posisi proyek saat timeline disusun

| Area | Status |
|---|---|
| Tahap 0, audit awal | Selesai |
| Tahap 0.2, konsolidasi dokumentasi | Selesai |
| P0, baseline dan verifikasi live API | Selesai; 57/57 pemeriksaan live lulus |
| Batch 1.1, audit kontrak API | Selesai |
| Batch 1.2, DTO dan wrapper API | Selesai; frontend build dan lint lulus setelah perbaikan |
| Batch 1.3, ID dan ownership | Audit statis selesai; full test suite setelah penambahan tes dan live cross-user test masih harus dikonfirmasi |
| Batch 1.4, standardisasi state UI | Belum dimulai |

**Aturan status:** pekerjaan hanya boleh dinyatakan selesai jika kriteria penerimaan dan pengujian yang relevan memiliki bukti. Audit statis, unit test, smoke test API, cross-user test, dan browser E2E harus dicatat sebagai jenis validasi yang berbeda.

## 2. Timeline mingguan

### Minggu 1 — 2 sampai 6 November 2026
**Fokus: menutup Tahap 1 (validasi fondasi integrasi).**

Tasks:
1. Jalankan seluruh backend test suite setelah penambahan `ownershipGuards.test.js`.
2. Verifikasi ownership menggunakan dua akun client berbeda dan dua akun counselor berbeda.
3. Pastikan pengguna A tidak dapat membaca resource pengguna B melalui ID resource yang diketahui.
4. Pastikan uji lintas-pengguna bersifat read-only. Jika data uji baru perlu dibuat atau diubah, minta persetujuan terlebih dahulu.
5. Selesaikan Batch 1.4: definisikan perilaku loading, empty, error, unauthorized (401), forbidden (403), not found (404), conflict (409), validation (422), dan server error (5xx).
6. Tetapkan pola penanganan error API yang konsisten dan pastikan halaman tidak menyamarkan error backend sebagai data kosong.
7. Jalankan ulang backend test, frontend build, dan lint.

Deliverables:
- Bukti full backend test suite.
- Matriks hasil ownership lintas-pengguna.
- Kontrak state UI dan error handling.
- Persetujuan penutupan Tahap 1.

Kriteria selesai:
- Semua tes backend yang relevan lulus.
- Tidak ada akses lintas-pengguna yang tidak sah pada skenario yang diuji.
- State UI memiliki perilaku konsisten dan terdokumentasi.
- Build dan lint frontend lulus.

### Minggu 2 — 9 sampai 13 November 2026
**Fokus: Tahap 2, data master dan jadwal.**

Tasks:
1. Hubungkan Admin Akun ke endpoint pengelolaan akun.
2. Hubungkan pengelolaan periode akademik.
3. Hubungkan profil konselor ke API, termasuk pembaruan data yang memang didukung backend.
4. Hubungkan status publikasi profil konselor.
5. Hubungkan pengelolaan ketersediaan konselor: tambah, ubah, dan batalkan slot.
6. Verifikasi aturan periode aktif, slot yang sudah dipesan, overlap jadwal, dan konflik perubahan jadwal.
7. Pastikan direktori konselor dan kalender booking klien membaca sumber data backend yang sama.
8. Hapus mock hanya pada bagian yang sudah berhasil digantikan dan diuji dengan API.

Deliverables:
- Data akun, periode, profil, dan jadwal menggunakan backend.
- Matriks role dan hasil pengujian untuk operasi data master.
- Tidak ada duplikasi sumber data antara kalender admin/konselor dan halaman booking klien.

Kriteria selesai:
- Perubahan data terlihat konsisten setelah refresh.
- Pengguna tanpa hak tidak dapat melakukan operasi pengelolaan.
- Konflik jadwal ditangani dengan respons yang jelas.
- Build, lint, dan test terkait lulus.

### Minggu 3 — 16 sampai 20 November 2026
**Fokus: Tahap 3, booking dan siklus hidup sesi.**

Tasks:
1. Audit ulang payload dan respons pembuatan booking klien.
2. Hubungkan daftar permintaan booking pada halaman konselor.
3. Implementasikan aksi menerima, menolak, dan meminta penjadwalan ulang sesuai kontrak backend.
4. Hubungkan pembatalan booking dan alasan penjadwalan ulang.
5. Hubungkan status sesi: terjadwal, berlangsung, selesai, dan status lain yang memang didefinisikan backend.
6. Pastikan Klien, Konselor, dan Admin melihat ID booking dan sesi yang sama.
7. Uji slot yang sudah terisi, slot yang berubah, request ganda, dan konflik transisi status.
8. Pastikan setiap operasi memeriksa ownership dan role di backend.

Deliverables:
- Alur booking klien sampai keputusan konselor terhubung.
- Siklus sesi tercermin konsisten pada halaman klien, konselor, dan admin.
- Matriks transisi status dan hasil pengujian.

Kriteria selesai:
- Tidak ada status yang hanya berubah di state lokal.
- Perubahan status tersimpan di backend dan tetap benar setelah refresh.
- Konflik dan operasi tidak sah ditangani dengan respons yang sesuai.

### Minggu 4 — 23 sampai 27 November 2026
**Fokus: Tahap 4, feedback, moderasi, review, dan notifikasi.**

Tasks:
1. Verifikasi pengiriman feedback oleh klien setelah sesi yang memenuhi syarat.
2. Hubungkan daftar feedback konselor sesuai aksesnya.
3. Hubungkan antrean moderasi dan statistik feedback Admin.
4. Hubungkan proses review feedback oleh Kepala LMI.
5. Pastikan feedback publik hanya menampilkan item yang memenuhi status publikasi.
6. Hubungkan notifikasi untuk perubahan booking, sesi, dan feedback yang memang didukung event backend.
7. Hubungkan status sudah dibaca/belum dibaca.
8. Uji akses feedback dan notifikasi lintas-role serta lintas-pengguna.

Deliverables:
- Alur feedback dari klien sampai publikasi.
- Pemisahan kewenangan moderasi Admin dan review Kepala LMI.
- Notifikasi memakai data backend.

Kriteria selesai:
- Feedback tidak tampil ke publik sebelum memenuhi aturan publikasi.
- Admin dan Kepala LMI hanya dapat melakukan tindakan sesuai kewenangannya.
- Notifikasi konsisten setelah refresh dan tidak bocor ke pengguna lain.

### Minggu 5 — 30 November sampai 4 Desember 2026
**Fokus: Tahap 5, profil, dashboard, laporan, dan aktivitas.**

Tasks:
1. Hubungkan pengaturan profil setiap role ke endpoint yang tersedia.
2. Hubungkan persetujuan WhatsApp jika field dan kebijakan backend sudah terdefinisi.
3. Hubungkan dashboard Admin dan Kepala LMI.
4. Hubungkan laporan dan filter periode yang didukung backend.
5. Hubungkan daftar konseling Admin.
6. Hubungkan aktivitas/audit log Admin.
7. Definisikan setiap metrik dashboard: sumber data, periode, status yang dihitung, dan aturan pengecualian.
8. Cocokkan angka dashboard dengan query atau hasil agregasi backend.

Deliverables:
- Profil dan pengaturan tersimpan di backend.
- Dashboard dan laporan memakai data aktual.
- Definisi metrik dan filter terdokumentasi.

Kriteria selesai:
- Tidak ada angka dashboard yang berasal dari mock atau perhitungan frontend yang tidak disepakati.
- Filter menghasilkan data yang sesuai.
- Hak akses laporan sesuai role.

### Minggu 6 — 7 sampai 11 Desember 2026
**Fokus: Tahap 6A, validasi SOP sensitif dan desain teknis.**

Tasks:
1. Kumpulkan SOP resmi untuk intake/asesmen awal, informed consent, tanda tangan, catatan konseling, dan mood tracker.
2. Identifikasi aktor yang boleh membuat, membaca, mengubah, menyetujui, atau menutup setiap data.
3. Tetapkan data minimum yang benar-benar diperlukan.
4. Tentukan hubungan data dengan booking dan sesi.
5. Tetapkan kebutuhan audit trail, retensi, penghapusan, dan pembatasan akses.
6. Tentukan apakah tanda tangan berupa persetujuan elektronik sederhana atau memerlukan mekanisme lain sesuai kebijakan institusi.
7. Buat matriks SOP-to-system, rancangan ERD, kontrak API, dan acceptance criteria.
8. Minta persetujuan pemilik proses sebelum implementasi.

Deliverables:
- Matriks SOP dan hak akses.
- Rancangan data dan API.
- Keputusan tertulis untuk setiap proses sensitif.

Kriteria selesai:
- Tidak ada prosedur klinis, masa retensi, atau hak akses yang ditentukan hanya berdasarkan asumsi pengembang.
- Rancangan disetujui sebelum migrasi dan implementasi.

### Minggu 7 — 14 sampai 18 Desember 2026
**Fokus: Tahap 6B, implementasi fitur sensitif yang telah disetujui.**

Tasks:
1. Implementasikan skema database dan migrasi hanya untuk kebutuhan yang sudah disetujui.
2. Uji migrasi pada lingkungan non-produksi terlebih dahulu.
3. Implementasikan endpoint intake dan consent sesuai SOP.
4. Implementasikan catatan konseling dengan pembatasan akses yang ketat.
5. Implementasikan tanda tangan atau bukti persetujuan sesuai keputusan institusi.
6. Implementasikan mood tracker jika memang menjadi bagian SOP.
7. Tambahkan audit trail dan kebijakan retensi yang telah disetujui.
8. Uji akses lintas-role dan lintas-pengguna untuk seluruh data sensitif.

Deliverables:
- Fitur sensitif yang telah disetujui terhubung ke backend.
- Migrasi dan pengujian non-produksi.
- Bukti pengujian akses dan audit.

Kriteria selesai:
- Tidak ada data sensitif yang hanya disimpan di localStorage atau persisted client state.
- Otorisasi diterapkan di backend.
- Migrasi tidak diterapkan ke produksi tanpa persetujuan eksplisit.

### Minggu 8 — 21 sampai 24 Desember 2026
**Fokus: pengujian sistem dan stabilisasi.**

Tasks:
1. Jalankan browser E2E untuk alur Client, Counselor, Admin, dan Head LMI.
2. Uji alur utama dari login sampai proses konseling dan feedback.
3. Uji unauthorized, forbidden, not found, conflict, validation, dan server error.
4. Uji isolasi data lintas-pengguna.
5. Uji refresh halaman, sesi login, navigasi langsung, dan state setelah logout.
6. Uji tampilan desktop dan mobile.
7. Periksa PWA, service worker, dan perilaku update aplikasi.
8. Tinjau bundle besar dan lakukan code splitting hanya jika tidak mengganggu route atau perilaku aplikasi.
9. Tinjau empat temuan low severity dari audit dependency frontend dan tentukan perbaikan aman tanpa `--force`.

Deliverables:
- Laporan E2E dan regresi.
- Daftar defect dan hasil perbaikan.
- Hasil pemeriksaan responsivitas, PWA, dan performa.

Kriteria selesai:
- Semua alur prioritas lulus E2E.
- Tidak ada defect kritis atau tinggi yang belum diselesaikan.
- Build, lint, test, dan smoke test lulus.

### Minggu 9 — 28 sampai 30 Desember 2026
**Fokus: release readiness dan persiapan deployment.**

Tasks:
1. Jalankan final regression suite.
2. Verifikasi konfigurasi environment produksi tanpa membagikan secret.
3. Periksa backup dan prosedur pemulihan database.
4. Periksa migration history dan rencana deployment.
5. Jalankan smoke test setelah deployment hanya setelah ada persetujuan.
6. Siapkan panduan penggunaan dan catatan perubahan.
7. Perbarui seluruh dokumentasi dan tutup task yang memenuhi acceptance criteria.
8. Catat risiko dan pekerjaan pascarilis.

Deliverables:
- Release checklist.
- Dokumentasi deployment dan rollback.
- Catatan versi dan daftar pekerjaan lanjutan.

Kriteria selesai:
- Tidak ada temuan kritis/tinggi yang terbuka.
- Pemilik proyek menyetujui deployment.
- Hasil smoke test pascadeploy terdokumentasi.

## 3. Milestone

| Target tanggal | Milestone |
|---|---|
| 6 November 2026 | Tahap 1 selesai |
| 13 November 2026 | Data master dan jadwal terintegrasi |
| 20 November 2026 | Booking dan siklus sesi terintegrasi |
| 27 November 2026 | Feedback dan notifikasi terintegrasi |
| 4 Desember 2026 | Profil, dashboard, dan laporan terintegrasi |
| 11 Desember 2026 | Desain fitur sensitif disetujui |
| 18 Desember 2026 | Implementasi fitur sensitif yang disetujui selesai |
| 24 Desember 2026 | E2E dan stabilisasi selesai |
| 30 Desember 2026 | Release readiness selesai |

## 4. Aturan pengendalian timeline

1. **Satu batch aktif pada satu waktu.** Jangan mulai batch berikutnya jika acceptance criteria batch aktif belum terpenuhi.
2. **Dokumentasi diperbarui setiap batch.** Perbarui `PROJECT_STATUS.md`, `WORK_LOG.md`, `ROADMAP.md`, matriks API, dan matriks SOP jika relevan.
3. **Tidak mengklaim selesai tanpa bukti.** Gunakan status `PASS`, `FAIL`, `BLOCKED`, atau `NOT RUN`.
4. **Tidak mengubah database produksi tanpa persetujuan.** Periksa migration history, target project, backup, dan dampak sebelum migrasi.
5. **Jangan mengarang SOP.** Intake, consent, tanda tangan, catatan konseling, mood tracker, retensi, dan akses harus mengikuti dokumen resmi.
6. **Pertahankan UI yang berjalan.** Perubahan desain atau route hanya dilakukan jika diminta atau diperlukan untuk memenuhi kontrak sistem.
7. **Jika jadwal meleset, revisi timeline.** Catat penyebab, dampak, dan tanggal target baru. Jangan mengubah status menjadi selesai untuk mengejar tanggal.

## 5. Risiko dan asumsi jadwal

- Timeline mengasumsikan satu pengembang utama dengan alokasi sekitar lima hari kerja per minggu.
- Ketersediaan akun uji, data uji, akses Supabase, dan keputusan pemilik SOP memengaruhi durasi.
- Tahap fitur sensitif dapat bergeser jika SOP atau persetujuan institusi belum tersedia.
- Integrasi dashboard dapat bergantung pada selesainya alur booking, sesi, dan feedback karena metrik harus memakai data yang konsisten.
- Deployment produksi bukan tindakan otomatis. Diperlukan persetujuan pemilik proyek.

**Langkah aktif berikutnya:** selesaikan Batch 1.3 dengan full backend test suite dan live cross-user ownership test, lalu lanjutkan Batch 1.4.
