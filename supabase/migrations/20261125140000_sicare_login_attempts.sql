-- Pembatasan percobaan login (keputusan pengguna 2026-11-25): setelah 3 kali kata sandi salah
-- untuk identitas yang sama (email/NIM/NIP), login dikunci 30 menit.
-- Identitas disimpan sebagai hash SHA-256 (bukan teks asli). Hanya backend (service_role) yang
-- mengakses tabel ini; RLS aktif tanpa policy sehingga anon/authenticated tidak dapat membaca.

begin;

create table if not exists public.login_attempts (
  identifier_hash text primary key,
  failed_count integer not null default 0 check (failed_count >= 0),
  last_failed_at timestamptz,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.login_attempts enable row level security;
revoke all on table public.login_attempts from public, anon, authenticated;
grant select, insert, update, delete on table public.login_attempts to service_role;

commit;
