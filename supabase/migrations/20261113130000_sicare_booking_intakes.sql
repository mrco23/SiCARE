-- SiCARE: jawaban formulir intake klien saat membuat booking.
-- Keputusan SOP (pengguna, 2026-11-13): satu baris per booking (diisi oleh klien/perwakilan
-- yang membuat booking, bukan per peserta kelompok); hanya konselor yang menangani booking
-- tersebut yang boleh membacanya (filter counselor_id = auth.uid() di level backend, bukan
-- RLS, karena baris ini hanya diakses lewat service_role seperti session_notes); retensi
-- mengikuti siklus hidup booking (on delete cascade, tidak ada penghapusan terjadwal
-- tersendiri). Field mengikuti ClientIntake (fe/src/types/counseling.ts).

begin;

create table if not exists public.booking_intakes (
  booking_id uuid primary key references public.bookings(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  answers jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_intakes_answers_object check (jsonb_typeof(answers) = 'object'),
  constraint booking_intakes_answers_size check (pg_column_size(answers) <= 32768)
);

create index if not exists booking_intakes_client_idx on public.booking_intakes (client_id);

-- Hanya backend (service_role) yang boleh membaca/menulis; tidak ada akses langsung
-- dari klien atau konselor lewat anon/authenticated key.
alter table public.booking_intakes enable row level security;
revoke all on public.booking_intakes from anon, authenticated;
grant all on public.booking_intakes to service_role;

drop trigger if exists booking_intakes_set_updated_at on public.booking_intakes;
create trigger booking_intakes_set_updated_at
  before update on public.booking_intakes
  for each row execute function public.set_updated_at();

commit;
