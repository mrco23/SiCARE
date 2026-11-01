# Indeks Dokumentasi SiCARE

Gunakan halaman ini untuk menemukan dokumen yang benar dan menghindari penggunaan catatan historis sebagai status terkini.

## Urutan baca untuk pekerjaan baru

1. [`../AGENTS.md`](../AGENTS.md): instruksi tetap, aturan keamanan, batas perubahan, dan prosedur kerja agent.
2. [`PROJECT_STATUS.md`](PROJECT_STATUS.md): satu-satunya sumber status progres terkini.
3. [`ROADMAP.md`](ROADMAP.md): urutan tahap, dependensi, dan kriteria penyelesaian.
4. [`WORK_LOG.md`](WORK_LOG.md): catatan kronologis pekerjaan, keputusan, hasil validasi, dan langkah lanjutan. Baca entri terakhir saat melanjutkan batch.
5. [`integration/API_ENDPOINT_MATRIX.md`](integration/API_ENDPOINT_MATRIX.md): pemetaan endpoint backend ke pemanggil frontend.
6. [`integration/SOP_COVERAGE_MATRIX.md`](integration/SOP_COVERAGE_MATRIX.md): cakupan logika bisnis/SOP dan gap yang perlu keputusan.
7. Baca dokumentasi domain yang relevan sebelum menyentuh domain tersebut.

## Status, roadmap, dan integrasi

| Dokumen | Fungsi |
|---|---|
| [`PROJECT_STATUS.md`](PROJECT_STATUS.md) | Progres terbaru, bukti pengujian, kendala, risiko, dan tugas berikutnya. Perbarui setelah setiap batch. |
| [`ROADMAP.md`](ROADMAP.md) | Urutan pengerjaan yang disetujui, dependensi, deliverable, dan acceptance criteria per tahap. |
| [`WORK_LOG.md`](WORK_LOG.md) | Catatan kronologis append-only tentang batch yang dikerjakan, keputusan, hasil tes, gap, dan tindak lanjut. Bukan pengganti status terkini. |
| [`integration/API_ENDPOINT_MATRIX.md`](integration/API_ENDPOINT_MATRIX.md) | Inventaris handler API, role, pemanggil frontend, serta status integrasi berdasarkan audit statis. |
| [`integration/SOP_COVERAGE_MATRIX.md`](integration/SOP_COVERAGE_MATRIX.md) | Status implementasi proses bisnis, risiko, dan kriteria penerimaan. Tidak menggantikan SOP resmi pemilik proses. |

## Arsitektur, modul konseling, dan keamanan

- [`security/security-architecture.md`](security/security-architecture.md): arsitektur keamanan sistem, otorisasi RBAC & token kapabilitas tamu, enkripsi `CONSENT_ENCRYPTION_KEY`, least privilege, imutabilitas bukti klinis, dan penegakan sesi di database.
- [`INFORMED_CONSENT_ARCHITECTURE.md`](INFORMED_CONSENT_ARCHITECTURE.md): arsitektur digital informed consent, skema data, dan referensi templat resmi LMI Unika De La Salle Manado.
- [`GROUP_CONSENT_WORKFLOW.md`](GROUP_CONSENT_WORKFLOW.md): alur kerja konseling kelompok, pendaftaran peserta, isolasi dokumen per-anggota, dan integrasi WhatsApp.
- [`INFORMED_CONSENT_SIGNING.md`](INFORMED_CONSENT_SIGNING.md): penandatanganan digital via canvas signature pad dan perenderan PDF resmi via `pdf-lib`.
- [`integration/FONNTE_WHATSAPP_INTEGRATION.md`](integration/FONNTE_WHATSAPP_INTEGRATION.md): integrasi WhatsApp Fonnte, transactional outbox, worker background, dan reminder scheduler.

## Dokumentasi backend dan database

- [`backend/TAHAP2_DATABASE.md`](backend/TAHAP2_DATABASE.md): fondasi skema database dan batasan.
- [`backend/TAHAP5-6_API.md`](backend/TAHAP5-6_API.md): booking, sesi, feedback, moderasi, dan notifikasi.
- [`backend/TAHAP7_ADMIN_COUNSELOR_REPORTING.md`](backend/TAHAP7_ADMIN_COUNSELOR_REPORTING.md): endpoint Admin, Konselor, dan laporan.
- [`backend/VERIFIKASI_LIVE_SUPABASE.md`](backend/VERIFIKASI_LIVE_SUPABASE.md): prosedur pemeriksaan integrasi live; jalankan hanya pada project yang sudah diverifikasi.
- [`../supabase/README.md`](../supabase/README.md): urutan migrasi dan tindakan pencegahan.

## Dokumentasi refactor frontend

- [`refactor/MASTER_PLAN.md`](refactor/MASTER_PLAN.md): rencana historis modularisasi dan konsistensi visual frontend. Ini bukan roadmap integrasi API.
- [`refactor/DESIGN_SYSTEM.md`](refactor/DESIGN_SYSTEM.md): prinsip desain, warna, layout, dan tipografi.
- [`refactor/DATA_ARCHITECTURE.md`](refactor/DATA_ARCHITECTURE.md): referensi model data/mock dan pembagian state dari fase prototipe. Bukan kontrak API produksi.
- [`refactor/ACCEPTANCE_CRITERIA.md`](refactor/ACCEPTANCE_CRITERIA.md): checklist regresi dan kriteria umum; gunakan status serta scope integrasi dari `PROJECT_STATUS.md` dan `ROADMAP.md`.
- [`refactor/PROGRESS.md`](refactor/PROGRESS.md): laporan audit statis Tahap 0 tanggal 29 Oktober 2026. Detail historis; bukan sumber status berjalan.
- [`refactor/PROGRESS_FRONTEND_BASELINE_2026-10-26.md`](refactor/PROGRESS_FRONTEND_BASELINE_2026-10-26.md): arsip progres frontend dari snapshot lebih lama. Jangan gunakan untuk menilai kondisi full-stack saat ini.

## Aturan pemeliharaan dokumentasi

- `AGENTS.md` hanya memuat instruksi tetap. Jangan menyalin seluruh log progres ke dalamnya.
- `PROJECT_STATUS.md` adalah sumber tunggal untuk status terbaru dan tugas berikutnya.
- `ROADMAP.md` memuat urutan kerja dan dependensi, bukan hasil pengujian harian.
- Matriks integrasi diperbarui ketika kontrak endpoint atau pemanggil frontend berubah.
- Catatan lama dipertahankan sebagai arsip dengan label snapshot/tanggal yang jelas. Jangan menghapus riwayat untuk menyamarkan perubahan.
- Status `PASS`, `FAIL`, `BLOCKED`, dan `NOT RUN` hanya boleh ditulis berdasarkan pemeriksaan yang benar-benar dilakukan.

## Rencana kerja dan timeline

- [`IMPLEMENTATION_TIMELINE.md`](IMPLEMENTATION_TIMELINE.md): task mingguan, target tanggal, deliverable, milestone, dan kriteria penyelesaian sampai release readiness.

## Tenggat team testing

- [`WEEKEND_READINESS_PLAN.md`](WEEKEND_READINESS_PLAN.md): sprint darurat Jumat 30 Oktober–Minggu 1 November 2026, scope prioritas, skenario uji tim, dan kriteria kesiapan.
