-- SiCARE: masa berlaku SIPP/SILP konselor.
-- Tetap di public.profiles (privat). `sipp_silp_updated_at` diisi backend saat konselor
-- memperbarui izinnya sendiri, agar Admin dapat melihat kapan terakhir berubah.

begin;

alter table public.profiles
  add column if not exists sipp_silp_valid_until date,
  add column if not exists sipp_silp_updated_at timestamptz;

commit;
