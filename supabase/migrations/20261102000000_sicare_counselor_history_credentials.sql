-- SiCARE counselor history credentials foundation
-- Secure storage for counselor counseling history protection credentials.
-- Passwords must be hashed using bcrypt or argon2id before storage.
-- Plaintext passwords and reversible encryption are strictly forbidden.

begin;

create table if not exists public.counselor_history_credentials (
  counselor_id uuid primary key references public.profiles(id) on delete cascade,
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint counselor_history_password_hash_format check (
    length(password_hash) >= 20 and (
      password_hash like '$2a$%' or
      password_hash like '$2b$%' or
      password_hash like '$argon2%'
    )
  )
);

-- RLS: Never allow anon or authenticated direct access
alter table public.counselor_history_credentials enable row level security;

revoke all on public.counselor_history_credentials from anon, authenticated;
grant all on public.counselor_history_credentials to service_role;

-- updated_at trigger
drop trigger if exists counselor_history_credentials_set_updated_at on public.counselor_history_credentials;
create trigger counselor_history_credentials_set_updated_at
  before update on public.counselor_history_credentials
  for each row execute function public.set_updated_at();

commit;

