-- SiCARE: public availability correctness and a complete client rescheduling flow.
-- Additive migration: safe to apply after the core and Stage 5-6 migrations.
-- Review and apply only to the intended Supabase project.

begin;

alter table public.bookings
  add column if not exists reschedule_reason text;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'booking_reschedule_reason_length'
      and conrelid = 'public.bookings'::regclass
  ) then
    alter table public.bookings
      add constraint booking_reschedule_reason_length
      check (reschedule_reason is null or pg_catalog.length(reschedule_reason) <= 1000);
  end if;
end;
$$;

create index if not exists bookings_counselor_active_time_idx
  on public.bookings (counselor_id, starts_at, ends_at)
  where status in ('waiting_confirmation', 'confirmed', 'reschedule_requested');

-- Public availability is filtered in SQL before LIMIT is applied. This prevents
-- unpublished academic periods and overlapping active bookings from consuming
-- the result limit or leaking as bookable slots.
create or replace function public.sicare_public_availability(
  p_counselor_ids uuid[],
  p_from timestamptz,
  p_to timestamptz,
  p_limit integer default 100
)
returns table (
  id uuid,
  counselor_id uuid,
  academic_period_id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  status text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.id,
    s.counselor_id,
    s.academic_period_id,
    s.starts_at,
    s.ends_at,
    s.status
  from public.availability_slots s
  where p_from is not null
    and p_to is not null
    and p_to >= p_from
    and p_counselor_ids is not null
    and s.counselor_id = any(p_counselor_ids)
    and s.status = 'available'
    and s.starts_at > pg_catalog.now()
    and s.starts_at >= p_from
    and s.starts_at <= p_to
    and exists (
      select 1
      from public.profiles p
      join public.counselor_profiles cp on cp.profile_id = p.id
      where p.id = s.counselor_id
        and p.app_role = 'counselor'
        and p.account_status = 'active'
        and cp.is_public = true
        and nullif(pg_catalog.btrim(cp.public_name), '') is not null
    )
    and (
      s.academic_period_id is null
      or exists (
        select 1
        from public.academic_periods ap
        where ap.id = s.academic_period_id
          and ap.is_published = true
          and s.starts_at::date between ap.starts_on and ap.ends_on
      )
    )
    and not exists (
      select 1
      from public.bookings b
      where b.counselor_id = s.counselor_id
        and b.status in ('waiting_confirmation', 'confirmed', 'reschedule_requested')
        and b.starts_at < s.ends_at
        and b.ends_at > s.starts_at
    )
  order by s.starts_at
  limit least(greatest(coalesce(p_limit, 100), 1), 100);
$$;

revoke all on function public.sicare_public_availability(uuid[], timestamptz, timestamptz, integer)
  from public, anon, authenticated;
grant execute on function public.sicare_public_availability(uuid[], timestamptz, timestamptz, integer)
  to service_role;

-- A client may propose a replacement slot only after the counselor requests a
-- reschedule. Locks on the slot and counselor serialize competing bookings.
create or replace function public.sicare_reschedule_booking(
  p_client_id uuid,
  p_booking_id uuid,
  p_slot_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_slot public.availability_slots%rowtype;
begin
  if not exists (
    select 1
    from public.profiles p
    where p.id = p_client_id
      and p.app_role = 'client'
      and p.account_status = 'active'
  ) then
    raise exception using errcode = 'P0001', message = 'BOOKING_CLIENT_NOT_ALLOWED';
  end if;

  select b.* into v_booking
  from public.bookings b
  where b.id = p_booking_id
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'BOOKING_NOT_FOUND';
  end if;
  if v_booking.client_id <> p_client_id then
    raise exception using errcode = 'P0001', message = 'BOOKING_FORBIDDEN';
  end if;
  if v_booking.status <> 'reschedule_requested' then
    raise exception using errcode = 'P0001', message = 'BOOKING_RESCHEDULE_NOT_ALLOWED';
  end if;

  select s.* into v_slot
  from public.availability_slots s
  where s.id = p_slot_id
  for update;
  if not found
     or v_slot.counselor_id <> v_booking.counselor_id
     or v_slot.id = v_booking.availability_slot_id
     or v_slot.status <> 'available'
     or v_slot.starts_at <= pg_catalog.now() then
    raise exception using errcode = 'P0001', message = 'BOOKING_SLOT_UNAVAILABLE';
  end if;

  -- Use the same lock order as booking creation: slot, then counselor profile.
  perform 1
  from public.profiles p
  where p.id = v_booking.counselor_id
  for update;

  if not exists (
    select 1
    from public.profiles p
    join public.counselor_profiles cp on cp.profile_id = p.id
    where p.id = v_booking.counselor_id
      and p.app_role = 'counselor'
      and p.account_status = 'active'
      and cp.is_public = true
      and nullif(pg_catalog.btrim(cp.public_name), '') is not null
  ) then
    raise exception using errcode = 'P0001', message = 'BOOKING_COUNSELOR_UNAVAILABLE';
  end if;

  if v_slot.academic_period_id is not null and not exists (
    select 1
    from public.academic_periods ap
    where ap.id = v_slot.academic_period_id
      and ap.is_published = true
      and v_slot.starts_at::date between ap.starts_on and ap.ends_on
  ) then
    raise exception using errcode = 'P0001', message = 'BOOKING_PERIOD_UNAVAILABLE';
  end if;

  if exists (
    select 1
    from public.bookings b
    where b.id <> v_booking.id
      and b.counselor_id = v_booking.counselor_id
      and b.status in ('waiting_confirmation', 'confirmed', 'reschedule_requested')
      and b.starts_at < v_slot.ends_at
      and b.ends_at > v_slot.starts_at
  ) then
    raise exception using errcode = 'P0001', message = 'BOOKING_SLOT_UNAVAILABLE';
  end if;

  update public.bookings
  set availability_slot_id = v_slot.id,
      starts_at = v_slot.starts_at,
      ends_at = v_slot.ends_at,
      status = 'waiting_confirmation',
      cancellation_reason = null
  where id = v_booking.id;

  insert into public.notifications (recipient_user_id, type, title, body, entity_type, entity_id)
  values (
    v_booking.counselor_id,
    'booking.reschedule_proposed',
    'Jadwal baru diajukan klien',
    'Klien memilih slot pengganti. Permintaan menunggu konfirmasi konselor.',
    'booking',
    v_booking.id
  );

  return v_booking.id;
end;
$$;

revoke all on function public.sicare_reschedule_booking(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.sicare_reschedule_booking(uuid, uuid, uuid) to service_role;

-- Extend the transition logic so a confirmed session can be rescheduled, the
-- reason is retained, and a previously cancelled session row is reused when
-- the counselor confirms the replacement slot.
create or replace function public.sicare_transition_booking(
  p_actor_id uuid,
  p_booking_id uuid,
  p_target_status text,
  p_reason text default null,
  p_session_format text default null,
  p_room text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_actor_role text;
  v_recipient uuid;
  v_session public.counseling_sessions%rowtype;
  v_has_session boolean := false;
begin
  select p.app_role into v_actor_role
  from public.profiles p
  where p.id = p_actor_id and p.account_status = 'active';
  if v_actor_role is null then
    raise exception using errcode = 'P0001', message = 'BOOKING_ACTOR_INACTIVE';
  end if;

  select b.* into v_booking
  from public.bookings b
  where b.id = p_booking_id
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'BOOKING_NOT_FOUND';
  end if;

  if v_actor_role = 'counselor' and v_booking.counselor_id = p_actor_id then
    if p_target_status = 'reschedule_requested' then
      if v_booking.status not in ('waiting_confirmation', 'confirmed') then
        raise exception using errcode = 'P0001', message = 'BOOKING_TRANSITION_NOT_ALLOWED';
      end if;
      if nullif(pg_catalog.btrim(p_reason), '') is null
         or pg_catalog.length(pg_catalog.btrim(p_reason)) > 1000 then
        raise exception using errcode = 'P0001', message = 'BOOKING_RESCHEDULE_REASON_REQUIRED';
      end if;

      select s.* into v_session
      from public.counseling_sessions s
      where s.booking_id = v_booking.id
      for update;
      v_has_session := found;
      if v_has_session then
        if v_session.status in ('ongoing', 'completed') then
          raise exception using errcode = 'P0001', message = 'BOOKING_SESSION_ALREADY_STARTED';
        end if;
        if v_booking.status = 'confirmed' and v_session.status <> 'scheduled' then
          raise exception using errcode = 'P0001', message = 'BOOKING_TRANSITION_NOT_ALLOWED';
        end if;
        update public.counseling_sessions
        set status = 'cancelled'
        where booking_id = v_booking.id and status = 'scheduled';
      elsif v_booking.status = 'confirmed' then
        raise exception using errcode = 'P0001', message = 'BOOKING_TRANSITION_NOT_ALLOWED';
      end if;
      v_recipient := v_booking.client_id;

    elsif p_target_status in ('confirmed', 'rejected') then
      if v_booking.status <> 'waiting_confirmation' then
        raise exception using errcode = 'P0001', message = 'BOOKING_TRANSITION_NOT_ALLOWED';
      end if;
      if p_target_status = 'confirmed' then
        if p_session_format is null or p_session_format not in ('online', 'offline') then
          raise exception using errcode = 'P0001', message = 'SESSION_FORMAT_REQUIRED';
        end if;
        if p_room is not null and pg_catalog.length(p_room) > 240 then
          raise exception using errcode = 'P0001', message = 'SESSION_ROOM_INVALID';
        end if;

        select s.* into v_session
        from public.counseling_sessions s
        where s.booking_id = v_booking.id
        for update;
        v_has_session := found;
        if v_has_session then
          if v_session.status <> 'cancelled' then
            raise exception using errcode = 'P0001', message = 'BOOKING_TRANSITION_NOT_ALLOWED';
          end if;
          update public.counseling_sessions
          set counselor_id = v_booking.counselor_id,
              starts_at = v_booking.starts_at,
              ends_at = v_booking.ends_at,
              status = 'scheduled',
              format = p_session_format,
              room = nullif(pg_catalog.btrim(p_room), ''),
              started_at = null,
              completed_at = null
          where id = v_session.id;
        else
          insert into public.counseling_sessions (booking_id, counselor_id, starts_at, ends_at, status, format, room)
          values (v_booking.id, v_booking.counselor_id, v_booking.starts_at, v_booking.ends_at, 'scheduled', p_session_format, nullif(pg_catalog.btrim(p_room), ''));
        end if;
      elsif nullif(pg_catalog.btrim(p_reason), '') is null
         or pg_catalog.length(pg_catalog.btrim(p_reason)) > 1000 then
        raise exception using errcode = 'P0001', message = 'BOOKING_REASON_REQUIRED';
      end if;
      v_recipient := v_booking.client_id;
    else
      raise exception using errcode = 'P0001', message = 'BOOKING_TRANSITION_NOT_ALLOWED';
    end if;

  elsif v_actor_role = 'client' and v_booking.client_id = p_actor_id then
    if p_target_status <> 'cancelled'
       or v_booking.status not in ('waiting_confirmation', 'confirmed', 'reschedule_requested') then
      raise exception using errcode = 'P0001', message = 'BOOKING_TRANSITION_NOT_ALLOWED';
    end if;
    select s.* into v_session
    from public.counseling_sessions s
    where s.booking_id = v_booking.id
    for update;
    v_has_session := found;
    if v_has_session and v_session.status in ('ongoing', 'completed') then
      raise exception using errcode = 'P0001', message = 'BOOKING_SESSION_ALREADY_STARTED';
    end if;
    update public.counseling_sessions
    set status = 'cancelled'
    where booking_id = v_booking.id and status = 'scheduled';
    if nullif(pg_catalog.btrim(p_reason), '') is null
       or pg_catalog.length(pg_catalog.btrim(p_reason)) > 1000 then
      raise exception using errcode = 'P0001', message = 'BOOKING_REASON_REQUIRED';
    end if;
    v_recipient := v_booking.counselor_id;
  else
    raise exception using errcode = 'P0001', message = 'BOOKING_FORBIDDEN';
  end if;

  update public.bookings
  set status = p_target_status,
      cancellation_reason = case
        when p_target_status in ('cancelled', 'rejected') then nullif(pg_catalog.btrim(p_reason), '')
        else null
      end,
      reschedule_reason = case
        when p_target_status = 'reschedule_requested' then nullif(pg_catalog.btrim(p_reason), '')
        when p_target_status = 'confirmed' then null
        else reschedule_reason
      end
  where id = v_booking.id;

  insert into public.notifications (recipient_user_id, type, title, body, entity_type, entity_id)
  values (
    v_recipient,
    'booking.' || p_target_status,
    case p_target_status
      when 'confirmed' then 'Konseling dikonfirmasi'
      when 'rejected' then 'Permintaan konseling ditolak'
      when 'reschedule_requested' then 'Penjadwalan ulang diminta'
      else 'Konseling dibatalkan'
    end,
    case p_target_status
      when 'confirmed' then 'Permintaan konseling diterima. Periksa detail sesi.'
      when 'rejected' then 'Permintaan konseling tidak dapat diterima.'
      when 'reschedule_requested' then 'Konselor meminta penjadwalan ulang. Pilih slot pengganti pada detail booking.'
      else 'Status permintaan konseling berubah menjadi dibatalkan.'
    end,
    'booking', v_booking.id
  );

  return v_booking.id;
end;
$$;

revoke all on function public.sicare_transition_booking(uuid, uuid, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.sicare_transition_booking(uuid, uuid, text, text, text, text)
  to service_role;

commit;
