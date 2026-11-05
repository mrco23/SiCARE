-- SiCARE: catatan sesi konseling dan identitas tambahan peserta.
-- session_notes hanya dapat diakses backend (service_role). counselor_note tidak boleh
-- dikirim ke klien. Retensi dan penghapusan mengikuti SOP LMI yang belum ditetapkan.

begin;

alter table public.booking_participants
  add column if not exists religion text,
  add column if not exists education text,
  add column if not exists address text;

alter table public.booking_participants
  add constraint booking_participants_religion_length
    check (religion is null or length(btrim(religion)) between 1 and 50),
  add constraint booking_participants_education_length
    check (education is null or length(btrim(education)) between 1 and 100),
  add constraint booking_participants_address_length
    check (address is null or length(btrim(address)) between 1 and 300);

create table if not exists public.session_notes (
  session_id uuid primary key references public.counseling_sessions(id) on delete cascade,
  counselor_id uuid not null references public.profiles(id) on delete restrict,
  counselor_note text,
  client_note text,
  follow_up text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint session_notes_counselor_note_length
    check (counselor_note is null or length(counselor_note) <= 10000),
  constraint session_notes_client_note_length
    check (client_note is null or length(client_note) <= 10000),
  constraint session_notes_follow_up_length
    check (follow_up is null or length(follow_up) <= 5000)
);

create index if not exists session_notes_counselor_idx on public.session_notes (counselor_id);

alter table public.session_notes enable row level security;
revoke all on public.session_notes from anon, authenticated;
grant all on public.session_notes to service_role;

drop trigger if exists session_notes_set_updated_at on public.session_notes;
create trigger session_notes_set_updated_at
  before update on public.session_notes
  for each row execute function public.set_updated_at();

commit;
