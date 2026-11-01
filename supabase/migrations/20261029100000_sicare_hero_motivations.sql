-- Admin-managed single-line motivational sentences for the public landing-page hero.
-- The API accesses this table with the server-only Supabase client after role checks.
-- Do not seed production-facing content in this migration.

begin;

create table public.hero_motivations (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hero_motivations_content_length
    check (length(btrim(content)) between 1 and 180),
  constraint hero_motivations_single_line
    check (content !~ E'[\r\n]')
);

create trigger hero_motivations_set_updated_at
before update on public.hero_motivations
for each row execute function public.set_updated_at();

alter table public.hero_motivations enable row level security;

-- Browser clients must not access this table directly. The backend's service-role
-- client is server-only and performs explicit authentication and role checks.
revoke all on public.hero_motivations from public, anon, authenticated;
grant all on public.hero_motivations to service_role;

commit;
