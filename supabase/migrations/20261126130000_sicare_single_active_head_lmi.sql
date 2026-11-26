-- SiCARE: hanya satu akun Kepala LMI yang aktif (keputusan pengguna 2026-11-26).
-- Membuat akun Kepala LMI baru atau mengaktifkan kembali akun Kepala LMI yang nonaktif
-- otomatis menonaktifkan Kepala LMI yang sedang aktif. Pergantian dilakukan atomik oleh
-- sicare_activate_head_lmi; indeks unik parsial menjadi pengaman terakhir di database.
-- Prasyarat: saat migrasi diterapkan paling banyak satu Kepala LMI aktif (dicek 2026-11-26: satu).

begin;

create or replace function public.sicare_activate_head_lmi(p_profile_id uuid)
returns table (activated_id uuid, deactivated_ids uuid[])
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_deactivated uuid[];
begin
  -- Serialisasi pergantian Kepala LMI agar dua permintaan bersamaan tidak saling bertabrakan.
  perform pg_advisory_xact_lock(hashtext('sicare_single_active_head_lmi'));

  select app_role into v_role from public.profiles where id = p_profile_id for update;
  if v_role is null then
    raise exception 'ACCOUNT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_role <> 'head_lmi' then
    raise exception 'NOT_HEAD_LMI' using errcode = '22023';
  end if;

  with disabled as (
    update public.profiles
    set account_status = 'disabled'
    where app_role = 'head_lmi'
      and account_status = 'active'
      and id <> p_profile_id
    returning id
  )
  select coalesce(array_agg(id), '{}') into v_deactivated from disabled;

  update public.profiles set account_status = 'active' where id = p_profile_id;

  return query select p_profile_id, v_deactivated;
end;
$$;

revoke all on function public.sicare_activate_head_lmi(uuid) from public, anon, authenticated;
grant execute on function public.sicare_activate_head_lmi(uuid) to service_role;

create unique index if not exists profiles_single_active_head_lmi
  on public.profiles (app_role)
  where app_role = 'head_lmi' and account_status = 'active';

commit;
