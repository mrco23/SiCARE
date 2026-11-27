-- SiCARE: riwayat pendidikan konselor (2026-11-26).
-- Satu profil konselor (counselor_profiles) memiliki banyak riwayat pendidikan (one-to-many).
-- Data ini tampil di profil publik konselor, tetapi hanya diakses lewat backend (service_role):
-- RLS aktif tanpa policy sehingga anon/authenticated tidak dapat membaca atau menulis langsung.

begin;

create table if not exists public.counselor_educations (
  id uuid primary key default gen_random_uuid(),
  counselor_profile_id uuid not null
    references public.counselor_profiles (profile_id) on delete cascade,
  institution text not null check (char_length(btrim(institution)) between 1 and 160),
  degree text not null check (char_length(btrim(degree)) between 1 and 160),
  graduation_year smallint not null check (graduation_year between 1950 and 2100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists counselor_educations_profile_idx
  on public.counselor_educations (counselor_profile_id, graduation_year desc);

drop trigger if exists counselor_educations_set_updated_at on public.counselor_educations;
create trigger counselor_educations_set_updated_at before update on public.counselor_educations
for each row execute function public.set_updated_at();

alter table public.counselor_educations enable row level security;
revoke all on table public.counselor_educations from public, anon, authenticated;
grant select, insert, update, delete on table public.counselor_educations to service_role;

commit;
