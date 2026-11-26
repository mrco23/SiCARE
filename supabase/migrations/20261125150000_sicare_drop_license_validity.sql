-- SiCARE: hapus masa berlaku SIPP/SILP (2026-11-25).
-- Website tidak lagi menyimpan tanggal "berlaku sampai" izin praktik konselor. No. SIPP/SILP
-- dan sipp_silp_updated_at tetap disimpan.
alter table public.profiles drop column if exists sipp_silp_valid_until;
