-- SiCARE Batch 1.5d: Group Informed Consent Workflow & WhatsApp Integration
-- Incremental schema migration for:
-- 1. Allowing nullable recipient_user_id in whatsapp_outbox for guest participants
-- 2. Adding booking_participant_id and new message_types ('consent_invitation', 'consent_reminder')
-- 3. Dedicated protected consent_invitation_secrets table for AES-256-GCM token encryption
-- 4. Enforcing consent readiness check in sicare_transition_session (scheduled -> ongoing)
-- 5. Preserving phone_e164 and full_name in sicare_create_booking for group participants
-- 6. Cascading cancellation to pending invitations and outbox reminders

begin;

-- ============================================================================
-- 1. WhatsApp Outbox Enhancements for Guest Participants and Invitations
-- ============================================================================

-- Allow nullable recipient_user_id for guest participants who do not possess a SiCARE profile account
alter table public.whatsapp_outbox
  alter column recipient_user_id drop not null;

-- Add booking_participant_id reference
alter table public.whatsapp_outbox
  add column if not exists booking_participant_id uuid
  references public.booking_participants(id) on delete set null;

create index if not exists whatsapp_outbox_participant_idx
  on public.whatsapp_outbox (booking_participant_id)
  where booking_participant_id is not null;

-- Extend message_type check constraint to include consent invitations and reminders
alter table public.whatsapp_outbox drop constraint if exists whatsapp_outbox_message_type_check;
alter table public.whatsapp_outbox add constraint whatsapp_outbox_message_type_check
  check (message_type in (
    'booking_requested',
    'booking_received',
    'booking_accepted',
    'booking_rejected',
    'reschedule_requested',
    'booking_cancelled',
    'reminder_h1',
    'reminder_day_of',
    'consent_invitation',
    'consent_reminder'
  ));

-- ============================================================================
-- 2. Dedicated Table for Encrypted Invitation Token Secrets
-- ============================================================================
-- Stores AES-256-GCM encrypted token material for asynchronous WhatsApp dispatch.
-- Access is strictly restricted to service_role (zero access for authenticated or anon).

create table if not exists public.consent_invitation_secrets (
  invitation_id uuid primary key references public.consent_invitations(id) on delete cascade,
  encrypted_token text not null,
  iv text not null,
  auth_tag text not null,
  key_version text not null default 'v1',
  created_at timestamptz not null default now(),
  cleared_at timestamptz
);

alter table public.consent_invitation_secrets enable row level security;

-- Revoke all direct client access
revoke all on public.consent_invitation_secrets from public, anon, authenticated;
grant all on public.consent_invitation_secrets to service_role;

-- ============================================================================
-- 3. Enhance sicare_create_booking to store participant full_name and phone_e164
-- ============================================================================
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
  v_client_name text;
  v_counselor_name text;
  v_client_phone text;
  v_counselor_phone text;
  v_payload jsonb;
  v_now timestamptz := pg_catalog.now();
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

  -- Serialize booking attempts for one counselor
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
    insert into public.booking_participants (
      booking_id,
      user_id,
      display_name,
      full_name,
      phone_e164,
      is_representative,
      is_primary,
      participant_type,
      participant_status
    )
    select
      v_booking_id,
      case
        when coalesce((item.value ->> 'is_representative')::boolean, false) is true then p_client_id
        else null
      end,
      pg_catalog.btrim(coalesce(item.value ->> 'display_name', item.value ->> 'full_name', '')),
      pg_catalog.btrim(coalesce(item.value ->> 'full_name', item.value ->> 'display_name', '')),
      nullif(pg_catalog.btrim(coalesce(item.value ->> 'phone_e164', '')), ''),
      coalesce((item.value ->> 'is_representative')::boolean, false),
      coalesce((item.value ->> 'is_representative')::boolean, false),
      case
        when coalesce((item.value ->> 'is_representative')::boolean, false) is true then 'primary_client'
        else 'guest_member'
      end,
      'registered'
    from pg_catalog.jsonb_array_elements(p_participants) as item(value);
  else
    -- Individual booking: auto-register primary client participant
    insert into public.booking_participants (
      booking_id,
      user_id,
      display_name,
      full_name,
      phone_e164,
      is_representative,
      is_primary,
      participant_type,
      participant_status
    )
    select
      v_booking_id,
      p.id,
      p.full_name,
      p.full_name,
      p.phone_e164,
      true,
      true,
      'primary_client',
      'registered'
    from public.profiles p where p.id = p_client_id;
  end if;

  insert into public.notifications (recipient_user_id, type, title, body, entity_type, entity_id)
  values
    (p_counselor_id, 'booking.created', 'Permintaan konseling baru', 'Ada permintaan konseling yang perlu ditinjau.', 'booking', v_booking_id),
    (p_client_id, 'booking.submitted', 'Permintaan konseling terkirim', 'Permintaan konseling menunggu konfirmasi konselor.', 'booking', v_booking_id);

  -- Retrieve names and phone numbers for transactional WhatsApp outbox
  select p.full_name, p.phone_e164 into v_client_name, v_client_phone
  from public.profiles p where p.id = p_client_id;

  select coalesce(cp.public_name, p.full_name, 'Konselor'), p.phone_e164
  into v_counselor_name, v_counselor_phone
  from public.profiles p
  left join public.counselor_profiles cp on cp.profile_id = p.id
  where p.id = p_counselor_id;

  v_payload := jsonb_build_object(
    'booking_id', v_booking_id,
    'booking_reference', '#SC-' || upper(substring(replace(v_booking_id::text, '-', ''), 1, 6)),
    'starts_at', v_slot.starts_at,
    'ends_at', v_slot.ends_at,
    'service_type', p_service_type,
    'client_name', coalesce(v_client_name, 'Klien'),
    'counselor_name', coalesce(v_counselor_name, 'Konselor')
  );

  insert into public.whatsapp_outbox (
    booking_id, recipient_user_id, message_type, scheduled_at, status,
    idempotency_key, attempt_count, max_attempts, payload, phone_e164, next_attempt_at
  ) values (
    v_booking_id,
    p_counselor_id,
    'booking_requested',
    v_now,
    'pending',
    'booking:' || v_booking_id || ':booking_requested:' || p_counselor_id,
    0,
    5,
    v_payload || jsonb_build_object('recipient_name', coalesce(v_counselor_name, 'Konselor')),
    v_counselor_phone,
    v_now
  ) on conflict (idempotency_key) do nothing;

  insert into public.whatsapp_outbox (
    booking_id, recipient_user_id, message_type, scheduled_at, status,
    idempotency_key, attempt_count, max_attempts, payload, phone_e164, next_attempt_at
  ) values (
    v_booking_id,
    p_client_id,
    'booking_received',
    v_now,
    'pending',
    'booking:' || v_booking_id || ':booking_received:' || p_client_id,
    0,
    5,
    v_payload || jsonb_build_object('recipient_name', coalesce(v_client_name, 'Klien')),
    v_client_phone,
    v_now
  ) on conflict (idempotency_key) do nothing;

  return v_booking_id;
end;
$$;

-- ============================================================================
-- 4. Enhance sicare_transition_booking: Revoke Invitations and Outbox on Cancel
-- ============================================================================
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
  v_client_name text;
  v_counselor_name text;
  v_client_phone text;
  v_counselor_phone text;
  v_payload jsonb;
  v_now timestamptz := pg_catalog.now();
  v_ref text;
  v_h1_time timestamptz;
  v_day_of_time timestamptz;
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

  -- Retrieve names and phone numbers for WhatsApp outbox
  select p.full_name, p.phone_e164 into v_client_name, v_client_phone
  from public.profiles p where p.id = v_booking.client_id;

  select coalesce(cp.public_name, p.full_name, 'Konselor'), p.phone_e164
  into v_counselor_name, v_counselor_phone
  from public.profiles p
  left join public.counselor_profiles cp on cp.profile_id = p.id
  where p.id = v_booking.counselor_id;

  v_ref := '#SC-' || upper(substring(replace(v_booking.id::text, '-', ''), 1, 6));

  -- 1. Confirmed transition: Notify Client & Enqueue Session Reminders
  if p_target_status = 'confirmed' then
    v_payload := jsonb_build_object(
      'booking_id', v_booking.id,
      'booking_reference', v_ref,
      'starts_at', v_booking.starts_at,
      'ends_at', v_booking.ends_at,
      'service_type', v_booking.service_type,
      'session_format', p_session_format,
      'room', nullif(pg_catalog.btrim(p_room), ''),
      'client_name', coalesce(v_client_name, 'Klien'),
      'counselor_name', coalesce(v_counselor_name, 'Konselor'),
      'recipient_name', coalesce(v_client_name, 'Klien')
    );

    insert into public.whatsapp_outbox (
      booking_id, recipient_user_id, message_type, scheduled_at, status,
      idempotency_key, attempt_count, max_attempts, payload, phone_e164, next_attempt_at
    ) values (
      v_booking.id,
      v_booking.client_id,
      'booking_accepted',
      v_now,
      'pending',
      'booking:' || v_booking.id || ':booking_accepted:' || v_booking.client_id || ':' || v_booking.starts_at::text,
      0,
      5,
      v_payload,
      v_client_phone,
      v_now
    ) on conflict (idempotency_key) do nothing;

    -- Schedule H-1 and Day-of Reminders
    v_h1_time := v_booking.starts_at - interval '24 hours';
    v_day_of_time := v_booking.starts_at - interval '1 hour';

    if v_h1_time > v_now - interval '12 hours' then
      insert into public.whatsapp_outbox (
        booking_id, recipient_user_id, message_type, scheduled_at, status,
        idempotency_key, attempt_count, max_attempts, payload, phone_e164, next_attempt_at
      ) values (
        v_booking.id,
        v_booking.client_id,
        'reminder_h1',
        v_h1_time,
        'pending',
        'booking:' || v_booking.id || ':reminder_h1:' || v_booking.client_id || ':' || v_booking.starts_at::text,
        0,
        5,
        v_payload || jsonb_build_object('partner_name', coalesce(v_counselor_name, 'Konselor'), 'recipient_name', coalesce(v_client_name, 'Klien')),
        v_client_phone,
        v_h1_time
      ) on conflict (idempotency_key) do nothing;

      insert into public.whatsapp_outbox (
        booking_id, recipient_user_id, message_type, scheduled_at, status,
        idempotency_key, attempt_count, max_attempts, payload, phone_e164, next_attempt_at
      ) values (
        v_booking.id,
        v_booking.counselor_id,
        'reminder_h1',
        v_h1_time,
        'pending',
        'booking:' || v_booking.id || ':reminder_h1:' || v_booking.counselor_id || ':' || v_booking.starts_at::text,
        0,
        5,
        v_payload || jsonb_build_object('partner_name', coalesce(v_client_name, 'Klien'), 'recipient_name', coalesce(v_counselor_name, 'Konselor')),
        v_counselor_phone,
        v_h1_time
      ) on conflict (idempotency_key) do nothing;
    end if;

    if v_day_of_time > v_now - interval '30 minutes' then
      insert into public.whatsapp_outbox (
        booking_id, recipient_user_id, message_type, scheduled_at, status,
        idempotency_key, attempt_count, max_attempts, payload, phone_e164, next_attempt_at
      ) values (
        v_booking.id,
        v_booking.client_id,
        'reminder_day_of',
        v_day_of_time,
        'pending',
        'booking:' || v_booking.id || ':reminder_day_of:' || v_booking.client_id || ':' || v_booking.starts_at::text,
        0,
        5,
        v_payload || jsonb_build_object('partner_name', coalesce(v_counselor_name, 'Konselor'), 'recipient_name', coalesce(v_client_name, 'Klien')),
        v_client_phone,
        v_day_of_time
      ) on conflict (idempotency_key) do nothing;

      insert into public.whatsapp_outbox (
        booking_id, recipient_user_id, message_type, scheduled_at, status,
        idempotency_key, attempt_count, max_attempts, payload, phone_e164, next_attempt_at
      ) values (
        v_booking.id,
        v_booking.counselor_id,
        'reminder_day_of',
        v_day_of_time,
        'pending',
        'booking:' || v_booking.id || ':reminder_day_of:' || v_booking.counselor_id || ':' || v_booking.starts_at::text,
        0,
        5,
        v_payload || jsonb_build_object('partner_name', coalesce(v_client_name, 'Klien'), 'recipient_name', coalesce(v_counselor_name, 'Konselor')),
        v_counselor_phone,
        v_day_of_time
      ) on conflict (idempotency_key) do nothing;
    end if;

  -- 2. Rejected transition: Notify Client and cancel reminders/invitations
  elsif p_target_status = 'rejected' then
    update public.whatsapp_outbox
    set status = 'cancelled', updated_at = v_now
    where booking_id = v_booking.id
      and message_type in ('reminder_h1', 'reminder_day_of', 'consent_invitation', 'consent_reminder')
      and status in ('pending', 'queued', 'retry_wait');

    update public.consent_invitations
    set status = 'revoked', revoked_at = v_now, updated_at = v_now
    where booking_participant_id in (
      select id from public.booking_participants where booking_id = v_booking.id
    ) and status in ('pending', 'sent');

    v_payload := jsonb_build_object(
      'booking_id', v_booking.id,
      'booking_reference', v_ref,
      'starts_at', v_booking.starts_at,
      'ends_at', v_booking.ends_at,
      'service_type', v_booking.service_type,
      'reason', nullif(pg_catalog.btrim(p_reason), ''),
      'client_name', coalesce(v_client_name, 'Klien'),
      'counselor_name', coalesce(v_counselor_name, 'Konselor'),
      'recipient_name', coalesce(v_client_name, 'Klien')
    );

    insert into public.whatsapp_outbox (
      booking_id, recipient_user_id, message_type, scheduled_at, status,
      idempotency_key, attempt_count, max_attempts, payload, phone_e164, next_attempt_at
    ) values (
      v_booking.id,
      v_booking.client_id,
      'booking_rejected',
      v_now,
      'pending',
      'booking:' || v_booking.id || ':booking_rejected:' || v_booking.client_id,
      0,
      5,
      v_payload,
      v_client_phone,
      v_now
    ) on conflict (idempotency_key) do nothing;

  -- 3. Reschedule requested transition: Cancel reminders & Notify Client
  elsif p_target_status = 'reschedule_requested' then
    update public.whatsapp_outbox
    set status = 'cancelled', updated_at = v_now
    where booking_id = v_booking.id
      and message_type in ('reminder_h1', 'reminder_day_of')
      and status in ('pending', 'queued', 'retry_wait');

    v_payload := jsonb_build_object(
      'booking_id', v_booking.id,
      'booking_reference', v_ref,
      'starts_at', v_booking.starts_at,
      'ends_at', v_booking.ends_at,
      'service_type', v_booking.service_type,
      'reason', nullif(pg_catalog.btrim(p_reason), ''),
      'initiator_role', 'counselor',
      'client_name', coalesce(v_client_name, 'Klien'),
      'counselor_name', coalesce(v_counselor_name, 'Konselor'),
      'recipient_name', coalesce(v_client_name, 'Klien')
    );

    insert into public.whatsapp_outbox (
      booking_id, recipient_user_id, message_type, scheduled_at, status,
      idempotency_key, attempt_count, max_attempts, payload, phone_e164, next_attempt_at
    ) values (
      v_booking.id,
      v_booking.client_id,
      'reschedule_requested',
      v_now,
      'pending',
      'booking:' || v_booking.id || ':reschedule_requested:' || v_booking.client_id || ':' || v_booking.starts_at::text,
      0,
      5,
      v_payload,
      v_client_phone,
      v_now
    ) on conflict (idempotency_key) do nothing;

  -- 4. Cancelled transition: Cancel reminders, invitations & Notify Counselor
  elsif p_target_status = 'cancelled' then
    update public.whatsapp_outbox
    set status = 'cancelled', updated_at = v_now
    where booking_id = v_booking.id
      and message_type in ('reminder_h1', 'reminder_day_of', 'consent_invitation', 'consent_reminder')
      and status in ('pending', 'queued', 'retry_wait');

    update public.consent_invitations
    set status = 'revoked', revoked_at = v_now, updated_at = v_now
    where booking_participant_id in (
      select id from public.booking_participants where booking_id = v_booking.id
    ) and status in ('pending', 'sent');

    v_payload := jsonb_build_object(
      'booking_id', v_booking.id,
      'booking_reference', v_ref,
      'starts_at', v_booking.starts_at,
      'ends_at', v_booking.ends_at,
      'service_type', v_booking.service_type,
      'reason', nullif(pg_catalog.btrim(p_reason), ''),
      'initiator_role', 'client',
      'client_name', coalesce(v_client_name, 'Klien'),
      'counselor_name', coalesce(v_counselor_name, 'Konselor'),
      'recipient_name', coalesce(v_counselor_name, 'Konselor')
    );

    insert into public.whatsapp_outbox (
      booking_id, recipient_user_id, message_type, scheduled_at, status,
      idempotency_key, attempt_count, max_attempts, payload, phone_e164, next_attempt_at
    ) values (
      v_booking.id,
      v_booking.counselor_id,
      'booking_cancelled',
      v_now,
      'pending',
      'booking:' || v_booking.id || ':booking_cancelled:' || v_booking.counselor_id || ':' || v_booking.starts_at::text,
      0,
      5,
      v_payload,
      v_counselor_phone,
      v_now
    ) on conflict (idempotency_key) do nothing;
  end if;

  return v_booking.id;
end;
$$;

revoke all on function public.sicare_transition_booking(uuid, uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.sicare_transition_booking(uuid, uuid, text, text, text, text) to service_role;

-- ============================================================================
-- 5. Enhance sicare_transition_session: Enforce Consent Readiness Before Ongoing
-- ============================================================================
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
  v_readiness record;
begin
  select s.* into v_session from public.counseling_sessions s where s.id = p_session_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'SESSION_NOT_FOUND';
  end if;

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

  -- ENFORCE CONSENT READINESS: Before moving from scheduled to ongoing, all active participants must have signed
  if p_target_status = 'ongoing' then
    select * into v_readiness
    from public.sicare_check_booking_consent_readiness(v_session.booking_id);

    if not coalesce(v_readiness.is_fully_consented, false) then
      raise exception using errcode = 'P0001', message = 'CONSENT_READINESS_INCOMPLETE';
    end if;
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

revoke all on function public.sicare_transition_session(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.sicare_transition_session(uuid, uuid, text) to service_role;

commit;
