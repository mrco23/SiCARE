-- SiCARE: status otomatis "Terlewat" (missed) untuk sesi yang tidak kunjung dimulai.
--
-- Masalah (laporan 2026-11-15): sesi 14 Nov tetap `scheduled` setelah jamnya lewat karena
-- klien belum menandatangani informed consent, sehingga konselor tidak dapat memulainya.
-- Tidak ada proses yang menutup sesi semacam ini.
--
-- Perubahan:
-- 1. counseling_sessions.status menerima 'missed'; kolom missed_reason dan missed_at baru.
-- 2. sicare_mark_missed_sessions(p_grace_minutes) menandai sesi `scheduled` yang
--    ends_at + toleransi (default 30 menit) sudah lewat:
--      - missed_reason = 'consent_unsigned' bila consent belum lengkap,
--      - missed_reason = 'not_started' bila consent lengkap tetapi sesi tidak dimulai.
--    Pengingat WhatsApp yang masih tertunda untuk booking tersebut dibatalkan, dan klien
--    serta konselor mendapat notifikasi in-app. Status booking tidak diubah.
-- 3. sicare_transition_session (versi 20261113120000) sudah menolak transisi dari status
--    selain scheduled/ongoing, sehingga sesi `missed` bersifat final tanpa perubahan fungsi itu.
--
-- Status ini hanya mencatat fakta dan alasannya. Apakah dihitung sebagai "tidak hadir"
-- menunggu keputusan pemilik SOP LMI.

begin;

alter table public.counseling_sessions drop constraint if exists counseling_sessions_status_check;
alter table public.counseling_sessions add constraint counseling_sessions_status_check
  check (status in ('scheduled', 'ongoing', 'completed', 'cancelled', 'missed'));

alter table public.counseling_sessions
  add column if not exists missed_reason text,
  add column if not exists missed_at timestamptz;

alter table public.counseling_sessions drop constraint if exists counseling_session_missed_reason_valid;
alter table public.counseling_sessions add constraint counseling_session_missed_reason_valid
  check (
    (status = 'missed' and missed_reason in ('consent_unsigned', 'not_started') and missed_at is not null)
    or (status <> 'missed' and missed_reason is null and missed_at is null)
  );

-- Mempercepat pencarian sesi terjadwal yang sudah lewat.
create index if not exists counseling_sessions_scheduled_end_idx
  on public.counseling_sessions (ends_at)
  where status = 'scheduled';

create or replace function public.sicare_mark_missed_sessions(
  p_grace_minutes integer default 30
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session record;
  v_readiness jsonb;
  v_consented boolean;
  v_reason text;
  v_client_id uuid;
  v_now timestamptz := pg_catalog.now();
  v_grace integer := greatest(coalesce(p_grace_minutes, 30), 0);
  v_count integer := 0;
begin
  for v_session in
    select s.id, s.booking_id, s.counselor_id
    from public.counseling_sessions s
    where s.status = 'scheduled'
      and s.ends_at + pg_catalog.make_interval(mins => v_grace) <= v_now
    order by s.ends_at
    limit 200
    for update skip locked
  loop
    v_consented := false;
    begin
      v_readiness := public.sicare_check_booking_consent_readiness(v_session.booking_id);
      v_consented := coalesce((v_readiness ->> 'is_fully_consented')::boolean, false);
    exception when others then
      -- Readiness yang tidak dapat dihitung (mis. template consent tidak aktif) diperlakukan
      -- sebagai consent belum lengkap, karena sesi memang tidak dapat dimulai tanpanya.
      v_consented := false;
    end;

    v_reason := case when v_consented then 'not_started' else 'consent_unsigned' end;

    update public.counseling_sessions
    set status = 'missed',
        missed_reason = v_reason,
        missed_at = v_now,
        updated_at = v_now
    where id = v_session.id and status = 'scheduled';

    if not found then
      continue;
    end if;

    -- Pengingat yang belum terkirim tidak relevan lagi.
    update public.whatsapp_outbox
    set status = 'cancelled',
        last_error_code = 'SESSION_MISSED',
        last_error_message = 'Sesi terlewat; pesan tertunda dibatalkan.',
        updated_at = v_now
    where booking_id = v_session.booking_id
      and status in ('pending', 'queued', 'retry_wait')
      and message_type in ('reminder_h1', 'reminder_morning', 'reminder_day_of', 'consent_invitation', 'consent_reminder');

    select b.client_id into v_client_id from public.bookings b where b.id = v_session.booking_id;

    insert into public.notifications (recipient_user_id, type, title, body, entity_type, entity_id)
    values
      (
        v_client_id,
        'session.missed',
        'Sesi konseling terlewat',
        case v_reason
          when 'consent_unsigned' then 'Sesi tidak terlaksana karena informed consent belum ditandatangani. Kamu dapat memesan jadwal baru.'
          else 'Sesi tidak terlaksana karena belum dimulai sampai waktunya berakhir. Kamu dapat memesan jadwal baru.'
        end,
        'session', v_session.id
      ),
      (
        v_session.counselor_id,
        'session.missed',
        'Sesi konseling terlewat',
        case v_reason
          when 'consent_unsigned' then 'Sesi ditandai terlewat karena informed consent klien belum ditandatangani.'
          else 'Sesi ditandai terlewat karena belum dimulai sampai waktunya berakhir.'
        end,
        'session', v_session.id
      );

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.sicare_mark_missed_sessions(integer) from public, anon, authenticated;
grant execute on function public.sicare_mark_missed_sessions(integer) to service_role;

commit;
