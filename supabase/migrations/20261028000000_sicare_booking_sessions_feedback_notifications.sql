-- SiCARE backend stages 5-6: transactional booking, session lifecycle,
-- feedback moderation and per-user notifications.
-- Apply only after reviewing the target Supabase project and the core schema.

begin;

create or replace function public.sicare_create_booking(
  p_client_id uuid,
  p_counselor_id uuid,
  p_slot_id uuid,
  p_service_type text,
  p_group_name text default null,
  p_participants jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slot public.availability_slots%rowtype;
  v_booking_id uuid;
  v_participant jsonb;
  v_count integer;
  v_representatives integer;
  v_name text;
  v_is_representative boolean;
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = p_client_id and p.app_role = 'client' and p.account_status = 'active'
  ) then
    raise exception using errcode = 'P0001', message = 'BOOKING_CLIENT_NOT_ALLOWED';
  end if;

  if not exists (
    select 1
    from public.profiles p
    join public.counselor_profiles cp on cp.profile_id = p.id
    where p.id = p_counselor_id
      and p.app_role = 'counselor'
      and p.account_status = 'active'
      and cp.is_public = true
      and nullif(pg_catalog.btrim(cp.public_name), '') is not null
  ) then
    raise exception using errcode = 'P0001', message = 'BOOKING_COUNSELOR_UNAVAILABLE';
  end if;

  select s.* into v_slot
  from public.availability_slots s
  where s.id = p_slot_id
  for update;

  if not found or v_slot.counselor_id <> p_counselor_id
     or v_slot.status <> 'available'
     or v_slot.starts_at <= pg_catalog.now() then
    raise exception using errcode = 'P0001', message = 'BOOKING_SLOT_UNAVAILABLE';
  end if;

  if v_slot.academic_period_id is not null and not exists (
    select 1 from public.academic_periods ap
    where ap.id = v_slot.academic_period_id
      and ap.is_published = true
      and v_slot.starts_at::date between ap.starts_on and ap.ends_on
  ) then
    raise exception using errcode = 'P0001', message = 'BOOKING_PERIOD_UNAVAILABLE';
  end if;

  -- Serialize booking attempts for one counselor, including different overlapping slots.
  perform 1 from public.profiles p where p.id = p_counselor_id for update;
  if exists (
    select 1 from public.bookings b
    where b.counselor_id = p_counselor_id
      and b.status in ('waiting_confirmation', 'confirmed', 'reschedule_requested')
      and b.starts_at < v_slot.ends_at
      and b.ends_at > v_slot.starts_at
  ) then
    raise exception using errcode = 'P0001', message = 'BOOKING_SLOT_UNAVAILABLE';
  end if;

  if p_participants is null or pg_catalog.jsonb_typeof(p_participants) is distinct from 'array' then
    raise exception using errcode = 'P0001', message = 'BOOKING_PARTICIPANTS_INVALID';
  end if;
  v_count := pg_catalog.jsonb_array_length(p_participants);
  select count(*) into v_representatives
  from pg_catalog.jsonb_array_elements(p_participants) as item(value)
  where (item.value ->> 'is_representative')::boolean is true;

  if p_service_type = 'individual' then
    if p_group_name is not null or v_count <> 0 then
      raise exception using errcode = 'P0001', message = 'BOOKING_GROUP_FIELDS_INVALID';
    end if;
  elsif p_service_type = 'group' then
    if p_group_name is null or pg_catalog.length(pg_catalog.btrim(p_group_name)) not between 1 and 160
       or v_count < 2 or v_count > 10 or v_representatives <> 1 then
      raise exception using errcode = 'P0001', message = 'BOOKING_GROUP_FIELDS_INVALID';
    end if;
    for v_participant in select item.value from pg_catalog.jsonb_array_elements(p_participants) as item(value)
    loop
      v_name := pg_catalog.btrim(coalesce(v_participant ->> 'display_name', ''));
      if pg_catalog.length(v_name) not between 1 and 160
         or coalesce(v_participant ->> 'is_representative', 'false') not in ('true', 'false') then
        raise exception using errcode = 'P0001', message = 'BOOKING_PARTICIPANTS_INVALID';
      end if;
    end loop;
  else
    raise exception using errcode = 'P0001', message = 'BOOKING_SERVICE_TYPE_INVALID';
  end if;

  insert into public.bookings (
    client_id, counselor_id, availability_slot_id, service_type, group_name,
    participant_count, starts_at, ends_at, status
  ) values (
    p_client_id, p_counselor_id, p_slot_id, p_service_type,
    case when p_service_type = 'group' then pg_catalog.btrim(p_group_name) else null end,
    case when p_service_type = 'group' then v_count else 1 end,
    v_slot.starts_at, v_slot.ends_at, 'waiting_confirmation'
  ) returning id into v_booking_id;

  if p_service_type = 'group' then
    insert into public.booking_participants (booking_id, display_name, is_representative)
    select v_booking_id,
      pg_catalog.btrim(item.value ->> 'display_name'),
      coalesce((item.value ->> 'is_representative')::boolean, false)
    from pg_catalog.jsonb_array_elements(p_participants) as item(value);
  end if;

  insert into public.notifications (recipient_user_id, type, title, body, entity_type, entity_id)
  values
    (p_counselor_id, 'booking.created', 'Permintaan konseling baru', 'Ada permintaan konseling yang perlu ditinjau.', 'booking', v_booking_id),
    (p_client_id, 'booking.submitted', 'Permintaan konseling terkirim', 'Permintaan konseling menunggu konfirmasi konselor.', 'booking', v_booking_id);

  return v_booking_id;
end;
$$;

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
  v_session_status text;
begin
  select p.app_role into v_actor_role
  from public.profiles p
  where p.id = p_actor_id and p.account_status = 'active';
  if v_actor_role is null then
    raise exception using errcode = 'P0001', message = 'BOOKING_ACTOR_INACTIVE';
  end if;

  select b.* into v_booking from public.bookings b where b.id = p_booking_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'BOOKING_NOT_FOUND'; end if;

  if v_actor_role = 'counselor' and v_booking.counselor_id = p_actor_id then
    if v_booking.status <> 'waiting_confirmation'
       or p_target_status not in ('confirmed', 'rejected', 'reschedule_requested') then
      raise exception using errcode = 'P0001', message = 'BOOKING_TRANSITION_NOT_ALLOWED';
    end if;
    v_recipient := v_booking.client_id;
    if p_target_status = 'confirmed' then
      if p_session_format is null or p_session_format not in ('online', 'offline') then
        raise exception using errcode = 'P0001', message = 'SESSION_FORMAT_REQUIRED';
      end if;
      if p_room is not null and pg_catalog.length(p_room) > 240 then
        raise exception using errcode = 'P0001', message = 'SESSION_ROOM_INVALID';
      end if;
      insert into public.counseling_sessions (booking_id, counselor_id, starts_at, ends_at, status, format, room)
      values (v_booking.id, v_booking.counselor_id, v_booking.starts_at, v_booking.ends_at, 'scheduled', p_session_format, nullif(pg_catalog.btrim(p_room), ''));
    end if;
  elsif v_actor_role = 'client' and v_booking.client_id = p_actor_id then
    if p_target_status <> 'cancelled'
       or v_booking.status not in ('waiting_confirmation', 'confirmed', 'reschedule_requested') then
      raise exception using errcode = 'P0001', message = 'BOOKING_TRANSITION_NOT_ALLOWED';
    end if;
    select s.status into v_session_status from public.counseling_sessions s where s.booking_id = v_booking.id;
    if v_session_status in ('ongoing', 'completed') then
      raise exception using errcode = 'P0001', message = 'BOOKING_SESSION_ALREADY_STARTED';
    end if;
    update public.counseling_sessions set status = 'cancelled'
      where booking_id = v_booking.id and status = 'scheduled';
    v_recipient := v_booking.counselor_id;
  else
    raise exception using errcode = 'P0001', message = 'BOOKING_FORBIDDEN';
  end if;

  update public.bookings
  set status = p_target_status,
      cancellation_reason = case when p_target_status in ('cancelled', 'rejected') then nullif(pg_catalog.btrim(p_reason), '') else null end
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
      when 'reschedule_requested' then 'Konselor meminta penjadwalan ulang. Hubungi konselor untuk menentukan jadwal baru.'
      else 'Status permintaan konseling berubah menjadi dibatalkan.'
    end,
    'booking', v_booking.id
  );

  return v_booking.id;
end;
$$;

create or replace function public.sicare_transition_session(
  p_actor_id uuid,
  p_session_id uuid,
  p_target_status text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.counseling_sessions%rowtype;
  v_client_id uuid;
begin
  select s.* into v_session from public.counseling_sessions s where s.id = p_session_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'SESSION_NOT_FOUND'; end if;
  if v_session.counselor_id <> p_actor_id or not exists (
    select 1 from public.profiles p where p.id = p_actor_id and p.app_role = 'counselor' and p.account_status = 'active'
  ) then
    raise exception using errcode = 'P0001', message = 'SESSION_FORBIDDEN';
  end if;

  if not (
    (v_session.status = 'scheduled' and p_target_status in ('ongoing', 'cancelled'))
    or (v_session.status = 'ongoing' and p_target_status in ('completed', 'cancelled'))
  ) then
    raise exception using errcode = 'P0001', message = 'SESSION_TRANSITION_NOT_ALLOWED';
  end if;

  select b.client_id into v_client_id from public.bookings b where b.id = v_session.booking_id;
  update public.counseling_sessions
  set status = p_target_status,
      started_at = case when p_target_status = 'ongoing' then pg_catalog.now() else started_at end,
      completed_at = case when p_target_status = 'completed' then pg_catalog.now() else completed_at end
  where id = v_session.id;

  if p_target_status = 'cancelled' then
    update public.bookings set status = 'cancelled', cancellation_reason = 'Sesi dibatalkan oleh konselor'
    where id = v_session.booking_id and status in ('confirmed', 'reschedule_requested');
  end if;

  insert into public.notifications (recipient_user_id, type, title, body, entity_type, entity_id)
  values (
    v_client_id,
    'session.' || p_target_status,
    case p_target_status
      when 'ongoing' then 'Sesi konseling dimulai'
      when 'completed' then 'Sesi konseling selesai'
      else 'Sesi konseling dibatalkan'
    end,
    case p_target_status
      when 'ongoing' then 'Sesi konseling sedang berlangsung.'
      when 'completed' then 'Sesi konseling selesai. Kamu dapat memberikan feedback.'
      else 'Sesi konseling dibatalkan oleh konselor.'
    end,
    'session', v_session.id
  );
  return v_session.id;
end;
$$;

create or replace function public.sicare_submit_feedback(
  p_client_id uuid,
  p_session_id uuid,
  p_rating integer,
  p_comment text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_feedback_id uuid;
  v_admin record;
begin
  if p_rating < 1 or p_rating > 5 or (p_comment is not null and pg_catalog.length(p_comment) > 5000) then
    raise exception using errcode = 'P0001', message = 'FEEDBACK_INVALID';
  end if;
  select b.* into v_booking
  from public.counseling_sessions s join public.bookings b on b.id = s.booking_id
  where s.id = p_session_id and s.status = 'completed' and b.client_id = p_client_id;
  if not found then raise exception using errcode = 'P0001', message = 'FEEDBACK_SESSION_NOT_ELIGIBLE'; end if;
  if not exists (select 1 from public.profiles p where p.id = p_client_id and p.app_role = 'client' and p.account_status = 'active') then
    raise exception using errcode = 'P0001', message = 'FEEDBACK_FORBIDDEN';
  end if;

  insert into public.feedback (session_id, client_id, counselor_id, rating, comment, moderation_status, review_status)
  values (p_session_id, p_client_id, v_booking.counselor_id, p_rating, nullif(pg_catalog.btrim(p_comment), ''), 'pending', 'new')
  returning id into v_feedback_id;

  for v_admin in
    select p.id from public.profiles p
    where p.app_role in ('admin', 'head_lmi') and p.account_status = 'active'
  loop
    insert into public.notifications (recipient_user_id, type, title, body, entity_type, entity_id)
    values (v_admin.id, 'feedback.submitted', 'Feedback baru', 'Feedback baru menunggu peninjauan.', 'feedback', v_feedback_id);
  end loop;
  return v_feedback_id;
end;
$$;

-- RPCs are called only by the backend service client after request authentication
-- and role checks. Browser roles must never execute these privileged functions.
revoke all on function public.sicare_create_booking(uuid, uuid, uuid, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.sicare_transition_booking(uuid, uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.sicare_transition_session(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.sicare_submit_feedback(uuid, uuid, integer, text) from public, anon, authenticated;
grant execute on function public.sicare_create_booking(uuid, uuid, uuid, text, text, jsonb) to service_role;
grant execute on function public.sicare_transition_booking(uuid, uuid, text, text, text, text) to service_role;
grant execute on function public.sicare_transition_session(uuid, uuid, text) to service_role;
grant execute on function public.sicare_submit_feedback(uuid, uuid, integer, text) to service_role;

commit;
