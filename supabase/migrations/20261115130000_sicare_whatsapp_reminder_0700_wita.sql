-- SiCARE: jadwal pengingat WhatsApp jam 07.00 WITA (keputusan pengguna 2026-11-15).
--
-- Aturan baru:
--   * reminder_h1      : jam 07.00 WITA, sehari sebelum sesi (sebelumnya 24 jam sebelum sesi).
--                        Booking yang dikonfirmasi pada hari itu setelah 07.00 langsung dikirimi H-1;
--                        booking yang dikonfirmasi pada hari sesi tidak mendapat H-1.
--   * reminder_morning : jam 07.00 WITA, di hari sesi (jenis pesan baru, dibuat scheduler backend).
--   * reminder_day_of  : tetap 1 jam sebelum sesi, tidak terikat jam 07.00.
--   * consent_reminder : tidak lagi dikirim. Scheduler backend berhenti membuatnya; baris tertunda dibatalkan.
-- Pesan booking dan undangan consent tetap dikirim langsung saat kejadian.
--
-- sicare_transition_booking masih menyisipkan reminder_h1 dengan waktu "24 jam sebelum".
-- Agar fungsi besar itu tidak perlu ditulis ulang, trigger di bawah menyelaraskan waktu kirim
-- setiap reminder_h1 yang masuk: jam 07.00 WITA sehari sebelum sesi, atau saat itu juga bila
-- jam 07.00 hari itu sudah lewat, atau dibatalkan bila hari H-1 sudah berakhir.

begin;

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
    'reminder_morning',
    'reminder_day_of',
    'consent_invitation',
    'consent_reminder'
  ));

-- 07.00 WITA pada tanggal WITA dari p_at, digeser p_day_offset hari.
create or replace function public.sicare_wita_morning(p_at timestamptz, p_day_offset integer)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select (
    (pg_catalog.date_trunc('day', p_at at time zone 'Asia/Makassar')
      + pg_catalog.make_interval(days => p_day_offset)
      + interval '7 hours')
    at time zone 'Asia/Makassar'
  );
$$;

revoke all on function public.sicare_wita_morning(timestamptz, integer) from public, anon, authenticated;
grant execute on function public.sicare_wita_morning(timestamptz, integer) to service_role;

create or replace function public.sicare_align_reminder_h1_schedule()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_starts_at timestamptz;
  v_target timestamptz;
  v_window_end timestamptz;
  v_now timestamptz := pg_catalog.now();
begin
  if new.message_type <> 'reminder_h1' then
    return new;
  end if;

  select b.starts_at into v_starts_at from public.bookings b where b.id = new.booking_id;
  if v_starts_at is null then
    return new;
  end if;

  v_target := public.sicare_wita_morning(v_starts_at, -1);
  -- Hari H-1 berakhir pukul 00.00 WITA di hari sesi.
  v_window_end := public.sicare_wita_morning(v_starts_at, 0) - interval '7 hours';

  if v_now < v_target then
    new.scheduled_at := v_target;
    new.next_attempt_at := v_target;
  elsif v_now < v_window_end then
    -- Dikonfirmasi pada hari H-1 setelah 07.00: kirim langsung.
    new.scheduled_at := v_now;
    new.next_attempt_at := v_now;
  elsif new.status in ('pending', 'queued') then
    new.status := 'cancelled';
    new.last_error_code := 'REMINDER_WINDOW_PASSED';
    new.last_error_message := 'Booking dikonfirmasi pada hari sesi; pengingat H-1 dilewati, pengingat hari H tetap dikirim.';
  end if;

  return new;
end;
$$;

revoke all on function public.sicare_align_reminder_h1_schedule() from public, anon, authenticated;

drop trigger if exists whatsapp_outbox_align_reminder_h1 on public.whatsapp_outbox;
create trigger whatsapp_outbox_align_reminder_h1
  before insert on public.whatsapp_outbox
  for each row
  when (new.message_type = 'reminder_h1')
  execute function public.sicare_align_reminder_h1_schedule();

-- Selaraskan pengingat H-1 yang masih menunggu dengan aturan yang sama seperti trigger:
-- belum 07.00 H-1 -> 07.00 H-1; sudah lewat tetapi masih hari H-1 -> sekarang.
update public.whatsapp_outbox o
set scheduled_at = greatest(public.sicare_wita_morning(b.starts_at, -1), pg_catalog.now()),
    next_attempt_at = greatest(public.sicare_wita_morning(b.starts_at, -1), pg_catalog.now()),
    updated_at = pg_catalog.now()
from public.bookings b
where o.booking_id = b.id
  and o.message_type = 'reminder_h1'
  and o.status in ('pending', 'queued', 'retry_wait')
  and pg_catalog.now() < public.sicare_wita_morning(b.starts_at, 0) - interval '7 hours';

-- Hari H-1 sudah berakhir: pengingat H-1 tidak dikirim terlambat.
update public.whatsapp_outbox o
set status = 'cancelled',
    last_error_code = 'REMINDER_WINDOW_PASSED',
    last_error_message = 'Hari H-1 sudah berakhir; pengingat H-1 dilewati, pengingat hari H tetap dikirim.',
    updated_at = pg_catalog.now()
from public.bookings b
where o.booking_id = b.id
  and o.message_type = 'reminder_h1'
  and o.status in ('pending', 'queued', 'retry_wait')
  and pg_catalog.now() >= public.sicare_wita_morning(b.starts_at, 0) - interval '7 hours';

-- Pengingat consent tidak lagi dikirim.
update public.whatsapp_outbox
set status = 'cancelled',
    last_error_code = 'CONSENT_REMINDER_DISABLED',
    last_error_message = 'Pengingat consent dinonaktifkan sejak 2026-11-15.',
    updated_at = pg_catalog.now()
where message_type = 'consent_reminder'
  and status in ('pending', 'queued', 'retry_wait');

commit;
