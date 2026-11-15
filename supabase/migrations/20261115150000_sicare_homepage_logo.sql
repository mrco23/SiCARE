-- SiCARE: logo Lasallian DNA di home page yang dikelola admin (keputusan pengguna 2026-11-15).
--
-- Aturan:
-- * Hanya satu logo aktif (tabel satu baris, id = 1). Logo lama tidak disimpan; file lama dihapus
--   dari penyimpanan oleh backend setelah logo baru berhasil diunggah.
-- * Admin hanya dapat mengganti logo, tidak dapat menghapusnya (tidak ada endpoint hapus).
-- * Format yang diterima hanya PNG dan WebP (juga dibatasi di bucket).
-- * Home page membaca logo lewat endpoint publik backend; tabel tidak dibuka untuk anon/authenticated.

begin;

create table if not exists public.homepage_logo (
  id smallint primary key default 1,
  storage_path text not null,
  alt_text text not null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint homepage_logo_single_row check (id = 1),
  constraint homepage_logo_path_valid check (
    storage_path ~ '^homepage-logo/[A-Za-z0-9._-]+\.(png|webp)$'
  ),
  constraint homepage_logo_alt_length check (length(btrim(alt_text)) between 1 and 120)
);

drop trigger if exists homepage_logo_set_updated_at on public.homepage_logo;
create trigger homepage_logo_set_updated_at
  before update on public.homepage_logo
  for each row execute function public.set_updated_at();

alter table public.homepage_logo enable row level security;
revoke all on table public.homepage_logo from public, anon, authenticated;
grant select, insert, update on table public.homepage_logo to service_role;

-- Bucket publik khusus aset situs: hanya PNG/WebP, maksimal 1 MB.
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('site-assets', 'site-assets', true, 1048576, array['image/png', 'image/webp'])
    on conflict (id) do update set
      public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
  end if;
end;
$$;

commit;
