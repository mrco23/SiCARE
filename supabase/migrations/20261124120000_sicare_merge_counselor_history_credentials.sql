-- SiCARE: gabungkan counselor_history_credentials ke counselor_profiles.
--
-- Hash sandi riwayat konselor pindah ke counselor_profiles.history_password_hash.
--
-- PENTING (keamanan): counselor_profiles dapat dibaca publik (anon/authenticated) untuk halaman
-- profil konselor. RLS bekerja per baris, jadi hash akan ikut terbaca bila hak SELECT diberikan
-- per tabel. Migrasi ini mencabut SELECT tingkat tabel dan memberi SELECT hanya pada kolom
-- profil publik. Kolom history_password_* hanya dapat diakses service_role (backend).
-- Setiap kolom baru di counselor_profiles harus di-grant eksplisit agar dapat dibaca client.

begin;

-- ----------------------------------------------------------------------------
-- 1. Kolom baru
-- ----------------------------------------------------------------------------
alter table public.counselor_profiles
  add column if not exists history_password_hash text,
  add column if not exists history_password_updated_at timestamptz;

alter table public.counselor_profiles
  add constraint counselor_profiles_history_password_hash_format check (
    history_password_hash is null or (
      length(history_password_hash) >= 20 and (
        history_password_hash like '$2a$%' or
        history_password_hash like '$2b$%' or
        history_password_hash like '$argon2%'
      )
    )
  ),
  add constraint counselor_profiles_history_password_pair check (
    (history_password_hash is null) = (history_password_updated_at is null)
  );

-- ----------------------------------------------------------------------------
-- 2. Hak akses kolom: tutup kolom sandi dari anon/authenticated
-- ----------------------------------------------------------------------------
revoke select on public.counselor_profiles from anon, authenticated;
grant select (
  profile_id,
  public_name,
  headline,
  bio,
  specialties,
  years_experience,
  photo_path,
  is_public,
  created_at,
  updated_at
) on public.counselor_profiles to anon, authenticated;
-- Hak UPDATE authenticated tetap per kolom (public_name..photo_path) dari skema inti;
-- kolom history_password_* tidak termasuk.

-- ----------------------------------------------------------------------------
-- 3. Pindahkan data
-- ----------------------------------------------------------------------------
-- Pemindahan data tidak boleh mengubah updated_at profil publik.
alter table public.counselor_profiles disable trigger counselor_profiles_set_updated_at;

-- Pemilik sandi tanpa baris counselor_profiles dibuatkan baris tersembunyi (is_public = false)
-- agar hash tidak hilang.
insert into public.counselor_profiles (profile_id, public_name, is_public)
select c.counselor_id, nullif(btrim(p.full_name), ''), false
from public.counselor_history_credentials c
join public.profiles p on p.id = c.counselor_id
where not exists (
  select 1 from public.counselor_profiles cp where cp.profile_id = c.counselor_id
);

update public.counselor_profiles cp
set history_password_hash = c.password_hash,
    history_password_updated_at = c.updated_at
from public.counselor_history_credentials c
where cp.profile_id = c.counselor_id;

alter table public.counselor_profiles enable trigger counselor_profiles_set_updated_at;

-- Pengaman: setiap hash lama harus sudah tersalin persis.
do $$
begin
  if exists (
    select 1
    from public.counselor_history_credentials c
    left join public.counselor_profiles cp on cp.profile_id = c.counselor_id
    where cp.history_password_hash is distinct from c.password_hash
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'COUNSELOR_HISTORY_CREDENTIAL_COPY_MISMATCH: hash sandi riwayat tidak tersalin lengkap.';
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 4. Hapus tabel lama
-- ----------------------------------------------------------------------------
drop table if exists public.counselor_history_credentials;

commit;
