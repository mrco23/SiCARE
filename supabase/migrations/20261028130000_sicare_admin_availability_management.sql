-- Admin management and transactional counselor availability operations.
-- Apply after migrations 20261027000000, 20261028000000 and 20261028120000.
-- No hero quote/content table is introduced: landing-page hero copy remains static as decided.

begin;

create or replace function public.sicare_save_availability_slot(
  p_counselor_id uuid,
  p_slot_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_academic_period_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slot_id uuid;
  v_existing public.availability_slots%rowtype;
begin
  -- Serialize schedule changes for one counselor to prevent concurrent overlap races.
  perform 1 from public.profiles p
    where p.id = p_counselor_id and p.app_role = 'counselor' and p.account_status = 'active'
    for update;
  if not found then raise exception using errcode = 'P0001', message = 'AVAILABILITY_FORBIDDEN'; end if;
  if p_starts_at is null or p_ends_at is null or p_ends_at <= p_starts_at or p_starts_at <= pg_catalog.now() then
    raise exception using errcode = 'P0001', message = 'AVAILABILITY_TIME_INVALID';
  end if;

  if p_slot_id is not null then
    select * into v_existing from public.availability_slots s
      where s.id = p_slot_id and s.counselor_id = p_counselor_id for update;
    if not found then raise exception using errcode = 'P0001', message = 'AVAILABILITY_NOT_FOUND'; end if;
    if exists (
      select 1 from public.bookings b where b.availability_slot_id = p_slot_id
        and b.status in ('waiting_confirmation', 'confirmed', 'reschedule_requested')
    ) then raise exception using errcode = 'P0001', message = 'AVAILABILITY_BOOKED'; end if;
  end if;

  if p_academic_period_id is not null and not exists (
    select 1 from public.academic_periods ap
      where ap.id = p_academic_period_id
        and p_starts_at::date between ap.starts_on and ap.ends_on
        and p_ends_at::date <= ap.ends_on + 1
  ) then raise exception using errcode = 'P0001', message = 'AVAILABILITY_PERIOD_INVALID'; end if;

  if exists (
    select 1 from public.availability_slots s
      where s.counselor_id = p_counselor_id
        and s.status = 'available'
        and (p_slot_id is null or s.id <> p_slot_id)
        and s.starts_at < p_ends_at and s.ends_at > p_starts_at
  ) or exists (
    select 1 from public.bookings b
      where b.counselor_id = p_counselor_id
        and b.status in ('waiting_confirmation', 'confirmed', 'reschedule_requested')
        and b.starts_at < p_ends_at and b.ends_at > p_starts_at
  ) then raise exception using errcode = 'P0001', message = 'AVAILABILITY_OVERLAP'; end if;

  if p_slot_id is null then
    insert into public.availability_slots (counselor_id, academic_period_id, starts_at, ends_at, status)
      values (p_counselor_id, p_academic_period_id, p_starts_at, p_ends_at, 'available')
      returning id into v_slot_id;
  else
    update public.availability_slots
      set academic_period_id = p_academic_period_id, starts_at = p_starts_at, ends_at = p_ends_at, status = 'available'
      where id = p_slot_id returning id into v_slot_id;
  end if;
  return v_slot_id;
end;
$$;

create or replace function public.sicare_cancel_availability_slot(p_counselor_id uuid, p_slot_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slot public.availability_slots%rowtype;
begin
  perform 1 from public.profiles p
    where p.id = p_counselor_id and p.app_role = 'counselor' and p.account_status = 'active'
    for update;
  if not found then raise exception using errcode = 'P0001', message = 'AVAILABILITY_FORBIDDEN'; end if;
  select * into v_slot from public.availability_slots s
    where s.id = p_slot_id and s.counselor_id = p_counselor_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'AVAILABILITY_NOT_FOUND'; end if;
  if exists (select 1 from public.bookings b where b.availability_slot_id = p_slot_id
      and b.status in ('waiting_confirmation', 'confirmed', 'reschedule_requested'))
     or exists (select 1 from public.bookings b where b.counselor_id = p_counselor_id
      and b.status in ('waiting_confirmation', 'confirmed', 'reschedule_requested')
      and b.starts_at < v_slot.ends_at and b.ends_at > v_slot.starts_at) then
    raise exception using errcode = 'P0001', message = 'AVAILABILITY_BOOKED';
  end if;
  update public.availability_slots set status = 'cancelled' where id = p_slot_id;
  return 'cancelled';
end;
$$;

revoke all on function public.sicare_save_availability_slot(uuid, uuid, timestamptz, timestamptz, uuid) from public, anon, authenticated;
revoke all on function public.sicare_cancel_availability_slot(uuid, uuid) from public, anon, authenticated;
grant execute on function public.sicare_save_availability_slot(uuid, uuid, timestamptz, timestamptz, uuid) to service_role;
grant execute on function public.sicare_cancel_availability_slot(uuid, uuid) to service_role;

commit;
