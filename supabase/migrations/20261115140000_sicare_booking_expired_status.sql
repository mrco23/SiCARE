-- SiCARE: status otomatis "Kedaluwarsa" (expired) untuk booking yang tidak dikonfirmasi tepat waktu.
--
-- Masalah (2026-11-15): booking `waiting_confirmation` yang tidak diterima atau ditolak konselor
-- sampai jam mulainya tetap menunggu tanpa batas. Konselor masih bisa menerimanya, sehingga sesi
-- terbentuk dengan jadwal yang sudah lewat dan klien menerima konfirmasi yang tidak lagi berguna.
--
-- Perubahan:
-- 1. bookings.status menerima 'expired'; kolom expired_at baru.
-- 2. sicare_mark_expired_bookings() mengubah booking `waiting_confirmation` yang jam mulainya
--    sudah tiba menjadi `expired`, membatalkan pesan WhatsApp yang belum terkirim untuk booking itu,
--    dan memberi notifikasi in-app ke klien dan konselor. Slot jadwal otomatis lepas karena indeks
--    unik slot hanya berlaku untuk booking aktif.
-- 3. Trigger penjaga menolak perubahan booking menjadi `confirmed` bila jam mulainya sudah tiba
--    (BOOKING_EXPIRED), sehingga sicare_transition_booking tidak perlu ditulis ulang.
--
-- Booking `reschedule_requested` tidak ikut kedaluwarsa: waktu lamanya tidak lagi berlaku dan klien
-- masih dapat memilih jadwal baru setelah waktu itu lewat.

begin;

alter table public.bookings drop constraint if exists bookings_status_check;
alter table public.bookings add constraint bookings_status_check
  check (status in ('waiting_confirmation', 'confirmed', 'rejected', 'reschedule_requested', 'cancelled', 'expired'));

alter table public.bookings add column if not exists expired_at timestamptz;

alter table public.bookings drop constraint if exists booking_expired_at_consistent;
alter table public.bookings add constraint booking_expired_at_consistent
  check ((status = 'expired') = (expired_at is not null));

create index if not exists bookings_waiting_start_idx
  on public.bookings (starts_at)
  where status = 'waiting_confirmation';

create or replace function public.sicare_mark_expired_bookings()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking record;
  v_now timestamptz := pg_catalog.now();
  v_count integer := 0;
begin
  for v_booking in
    select b.id, b.client_id, b.counselor_id
    from public.bookings b
    where b.status = 'waiting_confirmation'
      and b.starts_at <= v_now
    order by b.starts_at
    limit 200
    for update skip locked
  loop
    update public.bookings
    set status = 'expired',
        expired_at = v_now,
        updated_at = v_now
    where id = v_booking.id and status = 'waiting_confirmation';

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

    insert into public.notifications (recipient_user_id, type, title, body, entity_type, entity_id)
    values
      (
        v_booking.client_id,
        'booking.expired',
        'Permintaan konseling kedaluwarsa',
        'Permintaanmu tidak sempat dikonfirmasi konselor sampai jadwalnya tiba. Silakan pilih jadwal lain.',
        'booking', v_booking.id
      ),
      (
        v_booking.counselor_id,
        'booking.expired',
        'Permintaan konseling kedaluwarsa',
        'Permintaan konseling ditutup otomatis karena belum dikonfirmasi sampai jadwalnya tiba.',
        'booking', v_booking.id
      );

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.sicare_mark_expired_bookings() from public, anon, authenticated;
grant execute on function public.sicare_mark_expired_bookings() to service_role;

-- Penjaga: booking yang jam mulainya sudah tiba tidak dapat dikonfirmasi.
create or replace function public.sicare_guard_booking_confirmation_time()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'confirmed'
     and old.status is distinct from 'confirmed'
     and new.starts_at <= pg_catalog.now() then
    raise exception using errcode = 'P0001', message = 'BOOKING_EXPIRED';
  end if;
  return new;
end;
$$;

revoke all on function public.sicare_guard_booking_confirmation_time() from public, anon, authenticated;

drop trigger if exists bookings_guard_confirmation_time on public.bookings;
create trigger bookings_guard_confirmation_time
  before update of status on public.bookings
  for each row
  execute function public.sicare_guard_booking_confirmation_time();

commit;
