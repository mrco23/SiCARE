-- SiCARE: perbaiki pengecekan informed consent saat sesi dimulai.
-- sicare_check_booking_consent_readiness mengembalikan jsonb, tetapi
-- sicare_transition_session membacanya sebagai record (v_readiness.is_fully_consented).
-- Akibatnya setiap transisi scheduled -> ongoing gagal dengan error PostgreSQL
-- (HTTP 500), baik consent sudah lengkap maupun belum. Versi ini membaca field jsonb
-- sehingga transisi berhasil saat consent lengkap dan mengembalikan
-- CONSENT_READINESS_INCOMPLETE (HTTP 409) saat belum.

begin;

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
    v_readiness := public.sicare_check_booking_consent_readiness(v_session.booking_id);

    if not coalesce((v_readiness ->> 'is_fully_consented')::boolean, false) then
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
