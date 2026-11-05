-- SiCARE: jenis kelamin pengguna dan nomor izin konselor.
-- Disimpan di public.profiles (RLS: hanya pemilik; ditulis lewat backend), bukan di
-- public.counselor_profiles yang dapat dibaca publik. Kolom nullable agar akun lama
-- tetap valid; kewajiban pengisian akun konselor baru ditegakkan di backend.

begin;

alter table public.profiles
  add column if not exists gender text,
  add column if not exists siap_number text,
  add column if not exists sipp_silp_number text;

alter table public.profiles
  add constraint profiles_gender_valid
    check (gender is null or gender in ('male', 'female')),
  add constraint profiles_siap_number_length
    check (siap_number is null or length(btrim(siap_number)) between 1 and 80),
  add constraint profiles_sipp_silp_number_length
    check (sipp_silp_number is null or length(btrim(sipp_silp_number)) between 1 and 80);

commit;
