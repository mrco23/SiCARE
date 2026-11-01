-- SiCARE Batch 1.5b: Digital Informed Consent Database Foundation
-- Supports Individual and Group Counseling, Account Holders and Guests,
-- Template Versioning, Private Storage Buckets, Invitations, and Append-Only Audit Logs.

begin;

-- ============================================================================
-- 1. Consent Templates
-- ============================================================================
create table if not exists public.consent_templates (
  id uuid primary key default gen_random_uuid(),
  template_code text not null default 'SICARE_IC_STD',
  version text not null default 'v1.0',
  title text not null default 'INFORMED CONSENT (Surat Pernyataan Kesediaan)',
  description text,
  storage_bucket text not null default 'informed-consent-templates',
  storage_path text not null default 'SICARE_IC_STD/v1.0/informed-consent.pdf',
  mime_type text not null default 'application/pdf',
  file_sha256 text not null check (file_sha256 ~ '^[0-9a-fA-F]{64}$'),
  file_size_bytes bigint not null check (file_size_bytes > 0),
  is_active boolean not null default true,
  effective_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint consent_templates_code_ver_uq unique (template_code, version),
  constraint consent_templates_code_len check (length(btrim(template_code)) between 3 and 64),
  constraint consent_templates_ver_len check (length(btrim(version)) between 1 and 32)
);

create unique index if not exists consent_templates_active_uq
  on public.consent_templates (template_code)
  where is_active = true;

-- Seed the initial active template record matching official docs/reference/infromed-consent/informed-consent.pdf
insert into public.consent_templates (
  template_code,
  version,
  title,
  description,
  storage_bucket,
  storage_path,
  mime_type,
  file_sha256,
  file_size_bytes,
  is_active,
  effective_at
) values (
  'SICARE_IC_STD',
  'v1.0',
  'INFORMED CONSENT (Surat Pernyataan Kesediaan)',
  'Template standar Informed Consent Lembaga Misi & Identitas (LMI) Unika De La Salle Manado',
  'informed-consent-templates',
  'SICARE_IC_STD/v1.0/informed-consent.pdf',
  'application/pdf',
  '59012141d8a54336928a4c076d9d0ad7276bbbc36064c37d9654cc031f14cd8f',
  113549,
  true,
  '2026-10-31T00:00:00Z'
) on conflict (template_code, version) do update set
  file_sha256 = excluded.file_sha256,
  file_size_bytes = excluded.file_size_bytes,
  is_active = excluded.is_active;

-- ============================================================================
-- 2. Extend Booking Participants for Identity & Account / Guest Representation
-- ============================================================================
alter table public.booking_participants
  add column if not exists user_id uuid references public.profiles(id) on delete set null,
  add column if not exists participant_type text not null default 'client'
    check (participant_type in ('primary_client', 'client', 'guest_member', 'registered_member')),
  add column if not exists full_name text,
  add column if not exists faculty text,
  add column if not exists study_program text,
  add column if not exists nim text,
  add column if not exists birthplace text,
  add column if not exists date_of_birth date,
  add column if not exists gender text
    check (gender is null or gender in ('Laki-laki', 'Perempuan')),
  add column if not exists phone_e164 text
    check (phone_e164 is null or length(btrim(phone_e164)) between 7 and 25),
  add column if not exists is_primary boolean not null default false,
  add column if not exists participant_status text not null default 'registered'
    check (participant_status in ('registered', 'invited', 'confirmed', 'removed'));

-- Sync display_name and full_name for existing records
update public.booking_participants
set full_name = display_name
where full_name is null and display_name is not null;

update public.booking_participants
set is_primary = is_representative
where is_primary = false and is_representative = true;

create index if not exists booking_participants_user_idx
  on public.booking_participants (user_id)
  where user_id is not null;

create unique index if not exists booking_participants_user_booking_uq
  on public.booking_participants (booking_id, user_id)
  where user_id is not null;

create unique index if not exists booking_participants_one_primary_uq
  on public.booking_participants (booking_id)
  where is_primary = true;

-- ============================================================================
-- 3. Informed Consents
-- ============================================================================
create table if not exists public.informed_consents (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete restrict,
  session_id uuid references public.counseling_sessions(id) on delete set null,
  booking_participant_id uuid not null references public.booking_participants(id) on delete restrict,
  consent_template_id uuid not null references public.consent_templates(id) on delete restrict,
  status text not null default 'pending'
    check (status in ('pending', 'viewed', 'signed', 'revoked', 'expired')),
  signer_user_id uuid references public.profiles(id) on delete set null,
  signer_name_snapshot text,
  identity_snapshot jsonb not null default '{}'::jsonb,
  consent_statement_version text not null default 'v1.0',
  viewed_at timestamptz,
  signed_at timestamptz,
  revoked_at timestamptz,
  revocation_reason text,
  signature_method text
    check (signature_method is null or signature_method in ('drawn', 'typed', 'uploaded', 'electronic_canvas')),
  signature_storage_path text,
  signed_document_storage_path text,
  signed_document_sha256 text
    check (signed_document_sha256 is null or signed_document_sha256 ~ '^[0-9a-fA-F]{64}$'),
  signed_document_size_bytes bigint check (signed_document_size_bytes is null or signed_document_size_bytes > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists informed_consents_booking_idx
  on public.informed_consents (booking_id);

create index if not exists informed_consents_participant_idx
  on public.informed_consents (booking_participant_id);

create index if not exists informed_consents_template_idx
  on public.informed_consents (consent_template_id);

create index if not exists informed_consents_status_idx
  on public.informed_consents (status);

create unique index if not exists informed_consents_participant_template_uq
  on public.informed_consents (booking_participant_id, consent_template_id)
  where status in ('pending', 'viewed', 'signed');

-- ============================================================================
-- 4. Consent Invitations (One-Time Tokens)
-- ============================================================================
create table if not exists public.consent_invitations (
  id uuid primary key default gen_random_uuid(),
  booking_participant_id uuid not null references public.booking_participants(id) on delete cascade,
  consent_id uuid references public.informed_consents(id) on delete cascade,
  invitation_type text not null default 'guest_participant'
    check (invitation_type in ('authenticated_participant', 'guest_participant')),
  recipient_phone_e164 text,
  recipient_email text,
  token_hash text not null unique,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'claimed', 'completed', 'expired', 'revoked', 'failed')),
  expires_at timestamptz not null,
  sent_at timestamptz,
  claimed_at timestamptz,
  claimed_by_user_id uuid references public.profiles(id) on delete set null,
  completed_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists consent_invitations_participant_idx
  on public.consent_invitations (booking_participant_id);

create index if not exists consent_invitations_token_hash_idx
  on public.consent_invitations (token_hash);

create index if not exists consent_invitations_status_expires_idx
  on public.consent_invitations (status, expires_at);

-- ============================================================================
-- 5. Consent Audit Logs (Append-Only)
-- ============================================================================
create table if not exists public.consent_audit_logs (
  id uuid primary key default gen_random_uuid(),
  consent_id uuid references public.informed_consents(id) on delete set null,
  booking_participant_id uuid references public.booking_participants(id) on delete set null,
  booking_id uuid references public.bookings(id) on delete set null,
  invitation_id uuid references public.consent_invitations(id) on delete set null,
  actor_user_id uuid references public.profiles(id) on delete set null,
  actor_type text not null default 'user'
    check (actor_type in ('user', 'system', 'guest', 'counselor', 'admin')),
  event_type text not null check (event_type in (
    'participant_registered',
    'identity_updated',
    'invitation_created',
    'invitation_sent',
    'invitation_claimed',
    'consent_created',
    'consent_viewed',
    'consent_signed',
    'document_generated',
    'document_downloaded',
    'consent_revoked',
    'consent_expired'
  )),
  event_timestamp timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  request_id text,
  created_at timestamptz not null default now()
);

create index if not exists consent_audit_logs_consent_idx
  on public.consent_audit_logs (consent_id);

create index if not exists consent_audit_logs_participant_idx
  on public.consent_audit_logs (booking_participant_id);

create index if not exists consent_audit_logs_booking_idx
  on public.consent_audit_logs (booking_id);

create index if not exists consent_audit_logs_event_type_idx
  on public.consent_audit_logs (event_type, event_timestamp desc);

-- Prohibit UPDATE and DELETE on consent_audit_logs
create or replace function public.prohibit_consent_audit_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception using errcode = '42501', message = 'CONSENT_AUDIT_LOG_IS_APPEND_ONLY';
end;
$$;

revoke all on function public.prohibit_consent_audit_mutation() from public, anon, authenticated;

drop trigger if exists consent_audit_logs_append_only on public.consent_audit_logs;
create trigger consent_audit_logs_append_only
before update or delete on public.consent_audit_logs
for each row execute function public.prohibit_consent_audit_mutation();

-- ============================================================================
-- 6. Storage Buckets (Private)
-- ============================================================================
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values
      ('informed-consent-templates', 'informed-consent-templates', false, 10485760, array['application/pdf']),
      ('informed-consent-signed', 'informed-consent-signed', false, 15728640, array['application/pdf']),
      ('informed-consent-signatures', 'informed-consent-signatures', false, 2097152, array['image/png', 'image/jpeg', 'image/svg+xml'])
    on conflict (id) do update set
      public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
  end if;
end;
$$;

-- ============================================================================
-- 7. Row Level Security & Access Grants
-- ============================================================================
alter table public.consent_templates enable row level security;
alter table public.informed_consents enable row level security;
alter table public.consent_invitations enable row level security;
alter table public.consent_audit_logs enable row level security;

-- Templates: viewable by authenticated users
drop policy if exists consent_templates_select_auth on public.consent_templates;
create policy consent_templates_select_auth on public.consent_templates
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.account_status = 'active'
    )
  );

-- Informed Consents: viewable by signer, booking client, or assigned counselor
drop policy if exists informed_consents_select_parties on public.informed_consents;
create policy informed_consents_select_parties on public.informed_consents
  for select using (
    signer_user_id = (select auth.uid())
    or exists (
      select 1 from public.booking_participants bp
      where bp.id = informed_consents.booking_participant_id
        and bp.user_id = (select auth.uid())
    )
    or exists (
      select 1 from public.bookings b
      where b.id = informed_consents.booking_id
        and (b.client_id = (select auth.uid()) or b.counselor_id = (select auth.uid()))
    )
  );

-- Invitations: viewable by primary client of booking
drop policy if exists consent_invitations_select_primary on public.consent_invitations;
create policy consent_invitations_select_primary on public.consent_invitations
  for select using (
    exists (
      select 1 from public.booking_participants bp
      join public.bookings b on b.id = bp.booking_id
      where bp.id = consent_invitations.booking_participant_id
        and b.client_id = (select auth.uid())
    )
  );

-- Audit logs: viewable only by admin / head_lmi
drop policy if exists consent_audit_logs_select_admin on public.consent_audit_logs;
create policy consent_audit_logs_select_admin on public.consent_audit_logs
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.app_role in ('admin', 'head_lmi')
        and p.account_status = 'active'
    )
  );

-- Privileges
revoke all on public.consent_templates from public, anon;
grant select on public.consent_templates to authenticated;
grant all on public.consent_templates to service_role;

revoke all on public.informed_consents from public, anon;
grant select on public.informed_consents to authenticated;
grant all on public.informed_consents to service_role;

revoke all on public.consent_invitations from public, anon;
grant select on public.consent_invitations to authenticated;
grant all on public.consent_invitations to service_role;

revoke all on public.consent_audit_logs from public, anon;
grant select on public.consent_audit_logs to authenticated;
grant all on public.consent_audit_logs to service_role;

-- ============================================================================
-- 8. Consent Readiness RPC
-- ============================================================================
create or replace function public.sicare_check_booking_consent_readiness(
  p_booking_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_total_participants integer := 0;
  v_signed_participants integer := 0;
  v_participants jsonb;
  v_is_ready boolean := false;
begin
  select * into v_booking
  from public.bookings
  where id = p_booking_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'BOOKING_NOT_FOUND';
  end if;

  if v_booking.service_type = 'individual' then
    v_total_participants := 1;
    select count(*) into v_signed_participants
    from public.informed_consents ic
    where ic.booking_id = p_booking_id
      and ic.status = 'signed';
    v_is_ready := (v_signed_participants >= 1);
  else
    -- Group booking
    select count(*) into v_total_participants
    from public.booking_participants bp
    where bp.booking_id = p_booking_id;

    if v_total_participants = 0 then
      v_total_participants := coalesce(v_booking.participant_count, 1);
    end if;

    select count(distinct ic.booking_participant_id) into v_signed_participants
    from public.informed_consents ic
    join public.booking_participants bp on bp.id = ic.booking_participant_id
    where bp.booking_id = p_booking_id
      and ic.status = 'signed';

    v_is_ready := (v_total_participants > 0 and v_signed_participants >= v_total_participants);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'participant_id', bp.id,
    'full_name', coalesce(bp.full_name, bp.display_name),
    'is_primary', bp.is_primary,
    'consent_status', coalesce(ic.status, 'uninitialized'),
    'consent_id', ic.id,
    'signed_at', ic.signed_at
  )), '[]'::jsonb) into v_participants
  from public.booking_participants bp
  left join public.informed_consents ic on ic.booking_participant_id = bp.id
  where bp.booking_id = p_booking_id;

  return jsonb_build_object(
    'booking_id', v_booking.id,
    'service_type', v_booking.service_type,
    'total_participants', v_total_participants,
    'signed_participants', v_signed_participants,
    'pending_participants', greatest(0, v_total_participants - v_signed_participants),
    'is_fully_consented', v_is_ready,
    'participants', v_participants
  );
end;
$$;

revoke all on function public.sicare_check_booking_consent_readiness(uuid) from public, anon;
grant execute on function public.sicare_check_booking_consent_readiness(uuid) to authenticated, service_role;

commit;
