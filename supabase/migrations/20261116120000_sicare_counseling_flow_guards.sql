-- SiCARE: penjaga alur konseling (audit alur 2026-11-16, disetujui pengguna).
--
-- 1. Sesi `ongoing` yang tidak diakhiri konselor ditutup otomatis menjadi `completed`
--    setelah ends_at + 2 jam (kolom auto_completed_at menandai penutupan otomatis).
--    Sebelumnya sesi seperti ini "berlangsung" selamanya sehingga feedback klien dan
--    catatan konselor tidak pernah bisa diisi.
-- 2. Booking `reschedule_requested` ikut kedaluwarsa saat jam aslinya lewat bila klien belum
--    memilih slot pengganti (kolom expired_reason membedakan alasannya). Sebelumnya booking ini
--    menggantung tanpa batas.
-- 3. Sesi hanya dapat dimulai dari 15 menit sebelum jam mulai sampai jam selesainya
--    (SESSION_START_TOO_EARLY / SESSION_START_WINDOW_PASSED).
-- 4. Booking `confirmed` tidak dapat dibatalkan atau dijadwalkan ulang bila sesinya sudah
--    berlangsung, selesai, atau terlewat (BOOKING_SESSION_CLOSED). Sebelumnya klien dapat
--    membatalkan booking yang sesinya sudah `missed`, sehingga data saling bertentangan.

begin;

-- ---------------------------------------------------------------------------
-- 1. Penutupan otomatis sesi yang tidak diakhiri
-- ---------------------------------------------------------------------------

alter table public.counseling_sessions
  add column if not exists auto_completed_at timestamptz;

alter table public.counseling_sessions drop constraint if exists counseling_session_auto_completed_valid;
alter table public.counseling_sessions add constraint counseling_session_auto_completed_valid
  check (auto_completed_at is null or status = 'completed');

create index if not exists counseling_sessions_ongoing_end_idx
  on public.counseling_sessions (ends_at)
  where status = 'ongoing';

create or replace function public.sicare_auto_complete_sessions(
  p_grace_minutes integer default 120
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session record;
  v_client_id uuid;
  v_now timestamptz := pg_catalog.now();
  v_grace integer := greatest(coalesce(p_grace_minutes, 120), 0);
  v_count integer := 0;
begin
  for v_session in
    select s.id, s.booking_id, s.counselor_id, s.ends_at, s.started_at
    from public.counseling_sessions s
    where s.status = 'ongoing'
      and s.ends_at + pg_catalog.make_interval(mins => v_grace) <= v_now
    order by s.ends_at
    limit 200
    for update skip locked
  loop
    -- completed_at mengikuti jam selesai terjadwal, bukan saat penutupan otomatis berjalan.
    update public.counseling_sessions
    set status = 'completed',
        completed_at = greatest(v_session.ends_at, coalesce(v_session.started_at, v_session.ends_at)),
        auto_completed_at = v_now,
        updated_at = v_now
    where id = v_session.id and status = 'ongoing';

    if not found then
      continue;
    end if;

    select b.client_id into v_client_id from public.bookings b where b.id = v_session.booking_id;

    insert into public.notifications (recipient_user_id, type, title, body, entity_type, entity_id)
    values
      (
        v_client_id,
        'session.completed',
        'Sesi konseling selesai',
        'Sesi konseling selesai. Kamu dapat memberikan feedback.',
        'session', v_session.id
      ),
      (
        v_session.counselor_id,
        'session.auto_completed',
        'Sesi ditutup otomatis',
        'Sesi belum diakhiri sampai 2 jam setelah jadwal selesai, sehingga ditutup otomatis. Lengkapi catatan sesi bila perlu.',
        'session', v_session.id
      );

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.sicare_auto_complete_sessions(integer) from public, anon, authenticated;
grant execute on function public.sicare_auto_complete_sessions(integer) to service_role;

-- ---------------------------------------------------------------------------
-- 2. Booking "Minta jadwal ulang" ikut kedaluwarsa
-- ---------------------------------------------------------------------------

alter table public.bookings add column if not exists expired_reason text;

update public.bookings
set expired_reason = 'not_confirmed'
where status = 'expired' and expired_reason is null;

alter table public.bookings drop constraint if exists booking_expired_reason_valid;
alter table public.bookings add constraint booking_expired_reason_valid
  check (
    (status = 'expired' and expired_reason in ('not_confirmed', 'reschedule_not_selected'))
    or (status <> 'expired' and expired_reason is null)
  );

create index if not exists bookings_reschedule_start_idx
  on public.bookings (starts_at)
  where status = 'reschedule_requested';

create or replace function public.sicare_mark_expired_bookings()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking record;
  v_reason text;
  v_now timestamptz := pg_catalog.now();
  v_count integer := 0;
begin
  for v_booking in
    select b.id, b.client_id, b.counselor_id, b.status
    from public.bookings b
    where b.status in ('waiting_confirmation', 'reschedule_requested')
      and b.starts_at <= v_now
    order by b.starts_at
    limit 200
    for update skip locked
  loop
    v_reason := case when v_booking.status = 'reschedule_requested'
      then 'reschedule_not_selected' else 'not_confirmed' end;

    update public.bookings
    set status = 'expired',
        expired_at = v_now,
        expired_reason = v_reason,
        updated_at = v_now
    where id = v_booking.id and status = v_booking.status;

    if not found then
      continue;
    end if;

    update public.whatsapp_outbox
    set status = 'cancelled',
        last_error_code = 'BOOKING_EXPIRED',
        last_error_message = 'Booking kedaluwarsa; pesan tertunda dibatalkan.',
        updated_at = v_now
    where booking_id = v_booking.id
      and status in ('pending', 'queued', 'retry_wait');

    -- Undangan consent anggota kelompok tidak berlaku lagi.
    update public.consent_invitations
    set status = 'revoked', revoked_at = v_now, updated_at = v_now
    where booking_participant_id in (
      select bp.id from public.booking_participants bp where bp.booking_id = v_booking.id
    ) and status in ('pending', 'sent');

    insert into public.notifications (recipient_user_id, type, title, body, entity_type, entity_id)
    values
      (
        v_booking.client_id,
        'booking.expired',
        'Permintaan konseling kedaluwarsa',
        case v_reason
          when 'reschedule_not_selected' then 'Jadwal pengganti tidak dipilih sampai jadwal awal lewat. Silakan buat permintaan baru.'
          else 'Permintaanmu tidak sempat dikonfirmasi konselor sampai jadwalnya tiba. Silakan pilih jadwal lain.'
        end,
        'booking', v_booking.id
      ),
      (
        v_booking.counselor_id,
        'booking.expired',
        'Permintaan konseling kedaluwarsa',
        case v_reason
          when 'reschedule_not_selected' then 'Permintaan ditutup otomatis karena klien tidak memilih jadwal pengganti sampai jadwal awal lewat.'
          else 'Permintaan konseling ditutup otomatis karena belum dikonfirmasi sampai jadwalnya tiba.'
        end,
        'booking', v_booking.id
      );

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.sicare_mark_expired_bookings() from public, anon, authenticated;
grant execute on function public.sicare_mark_expired_bookings() to service_role;

-- ---------------------------------------------------------------------------
-- 3. Jendela waktu memulai sesi
-- ---------------------------------------------------------------------------

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
  v_readiness jsonb;
  v_now timestamptz := pg_catalog.now();
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

  if p_target_status = 'ongoing' then
    -- Sesi hanya dapat dimulai mulai 15 menit sebelum jam mulai sampai jam selesainya.
    if v_now < v_session.starts_at - interval '15 minutes' then
      raise exception using errcode = 'P0001', message = 'SESSION_START_TOO_EARLY';
    end if;
    if v_now > v_session.ends_at then
      raise exception using errcode = 'P0001', message = 'SESSION_START_WINDOW_PASSED';
    end if;

    v_readiness := public.sicare_check_booking_consent_readiness(v_session.booking_id);
    if not coalesce((v_readiness ->> 'is_fully_consented')::boolean, false) then
      raise exception using errcode = 'P0001', message = 'CONSENT_READINESS_INCOMPLETE';
    end if;
  end if;

  select b.client_id into v_client_id from public.bookings b where b.id = v_session.booking_id;

  update public.counseling_sessions
  set status = p_target_status,
      started_at = case when p_target_status = 'ongoing' then v_now else started_at end,
      completed_at = case when p_target_status = 'completed' then v_now else completed_at end
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

-- ---------------------------------------------------------------------------
-- 4. Booking yang sesinya sudah ditutup tidak dapat dibatalkan/dijadwalkan ulang
-- ---------------------------------------------------------------------------

create or replace function public.sicare_guard_booking_closed_session()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'confirmed'
     and new.status in ('cancelled', 'reschedule_requested')
     and exists (
       select 1 from public.counseling_sessions s
       where s.booking_id = new.id
         and s.status in ('ongoing', 'completed', 'missed')
     ) then
    raise exception using errcode = 'P0001', message = 'BOOKING_SESSION_CLOSED';
  end if;
  return new;
end;
$$;

revoke all on function public.sicare_guard_booking_closed_session() from public, anon, authenticated;

drop trigger if exists bookings_guard_closed_session on public.bookings;
create trigger bookings_guard_closed_session
  before update of status on public.bookings
  for each row
  execute function public.sicare_guard_booking_closed_session();

commit;
