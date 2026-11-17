-- SiCARE: tanggal periode dalam WITA, batas booking per klien, dan consent lintas versi template.
-- 2026-11-17 (audit kesiapan):
-- 1. Pengecekan periode akademik memakai tanggal WITA (Asia/Makassar), bukan tanggal UTC,
--    sehingga slot sebelum 08.00 WITA di hari pertama periode tidak lagi ditolak.
-- 2. sicare_create_booking: klien tidak boleh memesan dua sesi yang bentrok (konselor mana pun)
--    dan maksimal 2 booking aktif yang belum selesai (BOOKING_CLIENT_OVERLAP,
--    BOOKING_CLIENT_LIMIT_REACHED). sicare_reschedule_booking juga menolak jadwal pengganti
--    yang bentrok dengan booking aktif klien.
-- 3. sicare_check_booking_consent_readiness: consent yang sudah ditandatangani tetap sah walau
--    versi template aktif berganti (template_compliant tetap dilaporkan, tidak memblokir).
-- Definisi fungsi lain tidak berubah; create or replace mempertahankan hak akses yang ada.

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
      and (v_slot.starts_at at time zone 'Asia/Makassar')::date between ap.starts_on and ap.ends_on
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

  -- Batas per klien (2026-11-17): serialisasi per klien, tidak boleh bentrok dengan booking
  -- aktif klien sendiri (konselor mana pun), dan maksimal 2 booking aktif yang belum selesai.
  perform 1 from public.profiles p where p.id = p_client_id for update;
  if exists (
    select 1 from public.bookings b
    where b.client_id = p_client_id
      and b.status in ('waiting_confirmation', 'confirmed', 'reschedule_requested')
      and b.starts_at < v_slot.ends_at
      and b.ends_at > v_slot.starts_at
  ) then
    raise exception using errcode = 'P0001', message = 'BOOKING_CLIENT_OVERLAP';
  end if;
  if (
    select count(*) from public.bookings b
    where b.client_id = p_client_id
      and b.status in ('waiting_confirmation', 'confirmed', 'reschedule_requested')
      and b.ends_at > v_now
  ) >= 2 then
    raise exception using errcode = 'P0001', message = 'BOOKING_CLIENT_LIMIT_REACHED';
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
          and (s.starts_at at time zone 'Asia/Makassar')::date between ap.starts_on and ap.ends_on
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
        and (p_starts_at at time zone 'Asia/Makassar')::date between ap.starts_on and ap.ends_on
        and (p_ends_at at time zone 'Asia/Makassar')::date <= ap.ends_on + 1
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
  v_client_name text;
  v_counselor_name text;
  v_counselor_phone text;
  v_payload jsonb;
  v_now timestamptz := pg_catalog.now();
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
      and (v_slot.starts_at at time zone 'Asia/Makassar')::date between ap.starts_on and ap.ends_on
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

  -- Jadwal pengganti tidak boleh bentrok dengan booking aktif klien lain miliknya (2026-11-17).
  if exists (
    select 1
    from public.bookings b
    where b.id <> v_booking.id
      and b.client_id = v_booking.client_id
      and b.status in ('waiting_confirmation', 'confirmed', 'reschedule_requested')
      and b.starts_at < v_slot.ends_at
      and b.ends_at > v_slot.starts_at
  ) then
    raise exception using errcode = 'P0001', message = 'BOOKING_CLIENT_OVERLAP';
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

  -- Cancel obsolete reminder jobs for old schedule
  update public.whatsapp_outbox
  set status = 'cancelled', updated_at = v_now
  where booking_id = v_booking.id
    and message_type in ('reminder_h1', 'reminder_day_of')
    and status in ('pending', 'queued', 'retry_wait');

  -- Retrieve names and phone
  select p.full_name into v_client_name from public.profiles p where p.id = p_client_id;
  select coalesce(cp.public_name, p.full_name, 'Konselor'), p.phone_e164
  into v_counselor_name, v_counselor_phone
  from public.profiles p
  left join public.counselor_profiles cp on cp.profile_id = p.id
  where p.id = v_booking.counselor_id;

  v_payload := jsonb_build_object(
    'booking_id', v_booking.id,
    'booking_reference', '#SC-' || upper(substring(replace(v_booking.id::text, '-', ''), 1, 6)),
    'starts_at', v_slot.starts_at,
    'ends_at', v_slot.ends_at,
    'service_type', v_booking.service_type,
    'client_name', coalesce(v_client_name, 'Klien'),
    'counselor_name', coalesce(v_counselor_name, 'Konselor'),
    'initiator_role', 'client',
    'recipient_name', coalesce(v_counselor_name, 'Konselor')
  );

  -- Atomic transactional WhatsApp outbox insertion to Counselor
  insert into public.whatsapp_outbox (
    booking_id, recipient_user_id, message_type, scheduled_at, status,
    idempotency_key, attempt_count, max_attempts, payload, phone_e164, next_attempt_at
  ) values (
    v_booking.id,
    v_booking.counselor_id,
    'reschedule_requested',
    v_now,
    'pending',
    'booking:' || v_booking.id || ':reschedule_requested:' || v_booking.counselor_id || ':' || v_slot.starts_at::text,
    0,
    5,
    v_payload,
    v_counselor_phone,
    v_now
  ) on conflict (idempotency_key) do nothing;

  return v_booking.id;
end;
$$;


create or replace function public.sicare_check_booking_consent_readiness(
  p_booking_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_caller uuid := auth.uid();
  v_caller_role text;
  v_active_template public.consent_templates%rowtype;
  v_total_participants integer := 0;
  v_signed_participants integer := 0;
  v_participants jsonb;
  v_is_ready boolean := false;
  v_template_compliant boolean := true;
begin
  select * into v_booking
  from public.bookings
  where id = p_booking_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'BOOKING_NOT_FOUND';
  end if;

  -- Verify caller authorization: client, counselor, admin, head_lmi, or service_role
  if v_caller is not null then
    select app_role into v_caller_role
    from public.profiles
    where id = v_caller and account_status = 'active';

    if v_booking.client_id != v_caller
       and v_booking.counselor_id != v_caller
       and coalesce(v_caller_role, '') not in ('admin', 'head_lmi') then
      raise exception using errcode = '42501', message = 'BOOKING_ACCESS_FORBIDDEN';
    end if;
  end if;

  -- Resolve active consent template
  select * into v_active_template
  from public.consent_templates
  where template_code = 'SICARE_IC_STD'
    and is_active = true
  limit 1;

  if not found then
    raise exception using errcode = 'P0001', message = 'ACTIVE_CONSENT_TEMPLATE_MISSING';
  end if;

  if v_booking.service_type = 'individual' then
    v_total_participants := 1;

    select count(*) into v_signed_participants
    from public.informed_consents ic
    where ic.booking_id = p_booking_id
      and ic.status = 'signed';

    v_is_ready := (v_signed_participants >= 1);
  else
    -- Group booking: strictly active participants (excluding removed)
    select count(*) into v_total_participants
    from public.booking_participants bp
    where bp.booking_id = p_booking_id
      and bp.participant_status != 'removed';

    if v_total_participants = 0 then
      v_total_participants := coalesce(v_booking.participant_count, 1);
    end if;

    -- Count distinct participants with a signed consent (any template version they signed)
    select count(distinct ic.booking_participant_id) into v_signed_participants
    from public.informed_consents ic
    join public.booking_participants bp on bp.id = ic.booking_participant_id
    where bp.booking_id = p_booking_id
      and bp.participant_status != 'removed'
      and ic.status = 'signed';

    -- Check if any signed consent used an outdated template version
    if exists (
      select 1 from public.informed_consents ic
      join public.booking_participants bp on bp.id = ic.booking_participant_id
      where bp.booking_id = p_booking_id
        and bp.participant_status != 'removed'
        and ic.status = 'signed'
        and ic.consent_template_id != v_active_template.id
    ) then
      v_template_compliant := false;
    end if;

    -- template_compliant tetap dilaporkan sebagai informasi, tetapi tidak lagi memblokir sesi.
    v_is_ready := (v_total_participants > 0 and v_signed_participants >= v_total_participants);
  end if;

  -- Operational participant summaries: strictly sanitized (NO PII, NO identity_snapshot)
  select coalesce(jsonb_agg(jsonb_build_object(
    'participant_id', bp.id,
    'full_name', coalesce(bp.full_name, bp.display_name),
    'is_primary', bp.is_primary,
    'participant_status', bp.participant_status,
    'consent_status', coalesce(ic.status, 'uninitialized'),
    'consent_id', ic.id,
    'template_compliant', (ic.consent_template_id = v_active_template.id),
    'signed_at', ic.signed_at
  )), '[]'::jsonb) into v_participants
  from public.booking_participants bp
  left join public.informed_consents ic on ic.booking_participant_id = bp.id
  where bp.booking_id = p_booking_id
    and bp.participant_status != 'removed';

  return jsonb_build_object(
    'booking_id', v_booking.id,
    'service_type', v_booking.service_type,
    'active_template_version', v_active_template.version,
    'total_participants', v_total_participants,
    'signed_participants', v_signed_participants,
    'pending_participants', greatest(0, v_total_participants - v_signed_participants),
    'template_compliant', v_template_compliant,
    'is_fully_consented', v_is_ready,
    'participants', v_participants
  );
end;
$$;

