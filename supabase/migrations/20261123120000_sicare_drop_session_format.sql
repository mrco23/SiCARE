-- SiCARE hanya melayani konseling tatap muka, jadi format sesi tidak disimpan maupun disebutkan.
-- 1) sicare_transition_booking ditulis ulang tanpa parameter p_session_format (berbasis definisi
--    produksi per 2026-11-23); konfirmasi booking tidak lagi memerlukan format.
-- 2) Kolom counseling_sessions.format beserta check constraint-nya dihapus.
-- Terapkan bersamaan dengan deploy backend yang tidak lagi membaca/mengirim format.

begin;

drop function if exists public.sicare_transition_booking(uuid, uuid, text, text, text, text);

create or replace function public.sicare_transition_booking(p_actor_id uuid, p_booking_id uuid, p_target_status text, p_reason text DEFAULT NULL::text, p_room text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
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
              room = nullif(pg_catalog.btrim(p_room), ''),
              started_at = null,
              completed_at = null
          where id = v_session.id;
        else
          insert into public.counseling_sessions (booking_id, counselor_id, starts_at, ends_at, status, room)
          values (v_booking.id, v_booking.counselor_id, v_booking.starts_at, v_booking.ends_at, 'scheduled', nullif(pg_catalog.btrim(p_room), ''));
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

revoke all on function public.sicare_transition_booking(uuid, uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.sicare_transition_booking(uuid, uuid, text, text, text)
  to service_role;

alter table public.counseling_sessions drop constraint if exists counseling_sessions_format_check;
alter table public.counseling_sessions drop column if exists format;

commit;
