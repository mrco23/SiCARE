# SiCARE UAT Defect Log

**Proyek:** SiCARE (Sistem Informasi Konseling & Rekam Terintegrasi)
**Dokumen:** Log Pelacakan & Manajemen Cacat Pengujian (UAT Defect Tracking Log)
**Tahap:** Batch 1.5g: Controlled User Acceptance Testing
**Tanggal Rilis:** 31 Oktober 2026
**Status Pelacakan:** INSTRUMEN AKTIF & TERSTRUKTUR

---

## 1. Kebijakan Manajemen & Klasifikasi Cacat (Defect Severity)

Setiap cacat yang ditemukan oleh penguji manusia selama UAT harus dicatat dengan skema keparahan berikut:

### P0 - Critical (Kritis)
- **Kriteria:** Kebocoran data klinis/privasi lintas-pengguna, bypass otorisasi atau RLS, sesi dimulai tanpa persetujuan lengkap (`consent bypass`), eskalasi peran (*privilege escalation*), tereksposnya token/rahasia server, kegagalan total server (*crash/fatal error*).
- **Penanganan:** Menghentikan jalannya UAT untuk modul terkait. Harus diperbaiki seketika (*immediate fix*) dan diuji ulang sebelum pengujian lain dilanjutkan.

### P1 - High (Tinggi)
- **Kriteria:** Alur bisnis utama terhenti: Klien tidak bisa mengajukan booking, Konselor tidak bisa menyetujui/menolak pesanan, peserta tidak bisa menandatangani consent, PDF resmi gagal digenerate/diunduh, sesi tidak bisa diselesaikan melalui transisi valid.
- **Penanganan:** Wajib diselesaikan sebelum penandatanganan Berita Acara Penerimaan (*UAT Sign-Off*).

### P2 - Medium (Sedang)
- **Kriteria:** Inkonsistensi status pada antarmuka yang memerlukan refresh manual, filter tanggal atau pencarian tidak presisi, pesan peringatan validasi kurang deskriptif, keterlambatan tampilan notifikasi non-kritis.
- **Penanganan:** Diperbaiki sebelum rilis produksi staging akhir, atau ditunda dengan persetujuan tertulis pemangku kepentingan.

### P3 - Low (Rendah)
- **Kriteria:** Masalah estetika minor, ketidaksejajaran spasi UI (*minor alignment*), salah ketik label (*typo*), peringatan ukuran chunk pada build yang tidak memengaruhi fungsi pengguna.
- **Penanganan:** Dicatat dalam backlog perbaikan bertahap; tidak menghalangi penerimaan sistem.

---

## 2. Alur Kerja Penanganan Cacat (Defect Workflow)

```
[Ditemukan Penguji] ──> [Dicatat di Log] ──> [Triase Severity (P0-P3)]
                             │
                             ▼
[Verifikasi Root Cause] ──> [Controlled Fix] ──> [Automated Regression Test]
                             │
                             ▼
[Retest oleh Penguji Manusia] ──> [Status: RESOLVED & VERIFIED]
```

---

## 3. Matriks Log Pelacakan Cacat (Defect Tracking Register)

| Defect ID | Test ID | Severity | Peran Terdampak | Modul | Ringkasan Masalah | Status Cacat | Ditemukan Oleh | Tanggal | Diselesaikan Oleh | Status Retest |
|---|---|---|---|---|---|---|---|---|---|---|
| **DEF-OBS-01** | `N/A` (Build) | **P3** | Pengembang | Frontend Build | Peringatan ukuran chunk JS bundle utama (`dist/assets/index-*.js` sebesar 1.34 MB > 500 kB) saat `npm run build`. | **OPEN (TRACKED)** | Sistem Otomasi | 31 Okt 2026 | Tim Frontend | Belum Diuji (Non-blocking) |
| **DEF-OBS-02** | `UAT-FON-002` | **N/A** (Policy) | Semua Peran | Integrasi Fonnte | Pengiriman pesan WhatsApp langsung ke nomor riil diblokir menunggu nomor uji resmi pengguna. | **BLOCKED (POLICY)** | Tim Keamanan | 31 Okt 2026 | - | BLOCKED |
| *DEF-001* | *(Test ID)* | *(P0/P1/P2/P3)* | *(Role)* | *(Modul)* | *(Diisi saat ditemukan cacat oleh penguji)* | `OPEN` | *(Nama Penguji)* | *(Tgl)* | *(Pengembang)* | *(PASS/FAIL)* |

---

## 4. Format Laporan Rinci Cacat Baru (Defect Report Template)

Jika penguji menemukan kegagalan atau cacat fungsional, salin templat di bawah ini untuk mendokumentasikan rincian permasalahan:

```markdown
### [DEF-XXX]: Judul Deskriptif Permasalahan

- **Defect ID:** DEF-XXX
- **Test ID Terkait:** UAT-XXX-XXX
- **Tingkat Keparahan (Severity):** P0 / P1 / P2 / P3
- **Peran Terdampak:** Admin / Kepala LMI / Counselor / Client / Guest
- **Modul / Halaman:** (contoh: /klien/pesanan)
- **Deskripsi Masalah:**
  Penjelasan ringkas mengenai cacat yang diamati saat pengujian.
- **Langkah-Langkah Reproduksi:**
  1. Login sebagai ...
  2. Buka halaman ...
  3. Klik tombol ...
  4. Amati reaksi sistem ...
- **Perilaku yang Diharapkan (Expected Behavior):**
  Perilaku sistem yang seharusnya sesuai spesifikasi dan SOP.
- **Perilaku Aktual (Actual Behavior):**
  Perilaku salah atau kegagalan yang diamati di lapangan.
- **Bukti Pendukung (Evidence):**
  (Tangkapan layar UI, pesan error konsol peramban, atau kutipan log respons API)
- **Akar Masalah (Root Cause Analysis):**
  (Diisi oleh tim pengembang setelah investigasi kode sumber)
- **Tindakan Perbaikan (Controlled Fix):**
  (Daftar perubahan file dan commit perbaikan terarah)
- **Hasil Pengujian Ulang (Retest Result):**
  PASS / FAIL / PENDING
```

---

## 5. Ringkasan Status Cacat Terkini

- **Total Cacat Aktif:** 0 Cacat Kritis/Fungsional (1 P3 Catatan Build, 1 Kebijakan Pengiriman Live Terblokir)
- **P0 (Critical):** 0
- **P1 (High):** 0
- **P2 (Medium):** 0
- **P3 (Low / Observasi):** 1 (Ukuran bundle frontend; tidak memblokir fungsionalitas)
- **Status Kebijakan:** 1 BLOCKED (Pengiriman WhatsApp langsung ke pihak luar)
- **Kondisi Kesiapan Rilis:** **MEMENUHI KRITERIA TEKNIS UNTUK MEMULAI UAT MANUSIA**
