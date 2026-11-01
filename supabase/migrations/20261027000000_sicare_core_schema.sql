-- SiCARE database foundation (Stage 2)
-- Apply only to the intended Supabase project after reviewing this migration.
-- No mock records, intake answers, counseling notes, or consent/signature data are seeded.

begin;

-- Shared updated_at trigger. The empty search_path and schema-qualified objects reduce
-- the risk of object-shadowing in a SECURITY DEFINER / trigger context.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public, anon, authenticated;

-- Profiles are the app-level identity for auth.users. Public sign-up can never choose
-- its own role: this trigger always creates a client profile and reads only a name.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  identity_code text,
  full_name text not null default 'Pengguna SiCARE',
  app_role text not null default 'client'
    check (app_role in ('client', 'counselor', 'admin', 'head_lmi')),
  member_category text
    check (member_category is null or member_category in ('student', 'faculty_staff', 'other')),
  account_status text not null default 'active'
    check (account_status in ('pending', 'active', 'disabled')),
  phone_e164 text,
  whatsapp_opt_in boolean not null default false,
  whatsapp_opt_in_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_name_not_blank check (length(btrim(full_name)) between 1 and 160),
  constraint profiles_identity_not_blank check (identity_code is null or length(btrim(identity_code)) > 0),
  constraint profiles_phone_length check (phone_e164 is null or length(btrim(phone_e164)) between 7 and 20)
);

create unique index profiles_identity_code_ci_uq
  on public.profiles (lower(btrim(identity_code)))
  where identity_code is not null;
create index profiles_role_status_idx on public.profiles (app_role, account_status);

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  submitted_name text;
begin
  submitted_name := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '')), '');

  insert into public.profiles (id, full_name, app_role, account_status)
  values (new.id, coalesce(submitted_name, 'Pengguna SiCARE'), 'client', 'active')
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function public.handle_new_auth_user() from public, anon, authenticated;
drop trigger if exists on_auth_user_created_sicare on auth.users;
create trigger on_auth_user_created_sicare
after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- Public counselor data is deliberately separate from private profiles. is_public is
-- controlled by the backend/provisioning flow, not by self-service column grants.
create table public.counselor_profiles (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  public_name text,
  headline text,
  bio text,
  specialties text[] not null default '{}',
  years_experience integer check (years_experience is null or years_experience >= 0),
  photo_path text,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint counselor_public_name_length check (public_name is null or length(btrim(public_name)) between 1 and 160),
  constraint counselor_headline_length check (headline is null or length(headline) <= 240)
);

create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.app_role
  from public.profiles p
  where p.id = (select auth.uid())
    and p.account_status = 'active'
  limit 1;
$$;
revoke all on function public.current_app_role() from public, anon;
grant execute on function public.current_app_role() to authenticated;

create or replace function public.is_public_counselor(target_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    join public.counselor_profiles cp on cp.profile_id = p.id
    where p.id = target_profile_id
      and p.app_role = 'counselor'
      and p.account_status = 'active'
      and cp.is_public = true
      and nullif(btrim(cp.public_name), '') is not null
  );
$$;
revoke all on function public.is_public_counselor(uuid) from public;
grant execute on function public.is_public_counselor(uuid) to anon, authenticated;

create table public.academic_periods (
  id uuid primary key default gen_random_uuid(),
  academic_year text not null,
  semester text not null check (semester in ('Ganjil', 'Genap')),
  starts_on date not null,
  ends_on date not null,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint academic_period_dates_valid check (ends_on >= starts_on),
  constraint academic_year_not_blank check (length(btrim(academic_year)) between 4 and 20),
  constraint academic_period_unique unique (academic_year, semester)
);

create table public.availability_slots (
  id uuid primary key default gen_random_uuid(),
  counselor_id uuid not null references public.profiles(id) on delete restrict,
  academic_period_id uuid references public.academic_periods(id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'available'
    check (status in ('available', 'blocked', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint availability_slot_time_valid check (ends_at > starts_at)
);
create index availability_counselor_start_idx on public.availability_slots (counselor_id, starts_at);
create index availability_public_start_idx on public.availability_slots (starts_at) where status = 'available';

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete restrict,
  counselor_id uuid not null references public.profiles(id) on delete restrict,
  availability_slot_id uuid references public.availability_slots(id) on delete set null,
  service_type text not null check (service_type in ('individual', 'group')),
  group_name text,
  participant_count integer not null default 1 check (participant_count between 1 and 10),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'waiting_confirmation'
    check (status in ('waiting_confirmation', 'confirmed', 'rejected', 'reschedule_requested', 'cancelled')),
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_time_valid check (ends_at > starts_at),
  constraint booking_group_fields_valid check (
    (service_type = 'individual' and group_name is null and participant_count = 1)
    or
    (service_type = 'group' and group_name is not null and length(btrim(group_name)) between 1 and 160 and participant_count between 2 and 10)
  ),
  constraint booking_cancellation_reason_length check (cancellation_reason is null or length(cancellation_reason) <= 1000)
);
create index bookings_client_created_idx on public.bookings (client_id, created_at desc);
create index bookings_counselor_start_idx on public.bookings (counselor_id, starts_at);
create index bookings_status_start_idx on public.bookings (status, starts_at);
-- Prevent two active bookings from reserving the same slot, including concurrent requests.
create unique index bookings_one_active_per_slot_uq
  on public.bookings (availability_slot_id)
  where availability_slot_id is not null
    and status in ('waiting_confirmation', 'confirmed', 'reschedule_requested');

create table public.booking_participants (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  display_name text not null,
  is_representative boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_participant_name_valid check (length(btrim(display_name)) between 1 and 160)
);
create index booking_participants_booking_idx on public.booking_participants (booking_id);
create unique index booking_participants_one_representative_uq
  on public.booking_participants (booking_id)
  where is_representative = true;

create table public.counseling_sessions (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete restrict,
  counselor_id uuid not null references public.profiles(id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'ongoing', 'completed', 'cancelled')),
  format text not null check (format in ('online', 'offline')),
  room text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint counseling_session_time_valid check (ends_at > starts_at),
  constraint counseling_session_room_length check (room is null or length(room) <= 240)
);
create index counseling_sessions_counselor_start_idx on public.counseling_sessions (counselor_id, starts_at);
create index counseling_sessions_status_start_idx on public.counseling_sessions (status, starts_at);

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.counseling_sessions(id) on delete restrict,
  client_id uuid not null references public.profiles(id) on delete restrict,
  counselor_id uuid not null references public.profiles(id) on delete restrict,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  moderation_status text not null default 'pending'
    check (moderation_status in ('pending', 'shown', 'disabled')),
  review_status text not null default 'new'
    check (review_status in ('new', 'reviewed', 'resolved')),
  disabled_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint feedback_one_per_client_session unique (session_id, client_id),
  constraint feedback_comment_length check (comment is null or length(comment) <= 5000),
  constraint feedback_disabled_reason_length check (disabled_reason is null or length(disabled_reason) <= 1000)
);
create index feedback_moderation_created_idx on public.feedback (moderation_status, created_at desc);
create index feedback_counselor_idx on public.feedback (counselor_id, created_at desc);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  entity_type text,
  entity_id uuid,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint notification_type_not_blank check (length(btrim(type)) between 1 and 80),
  constraint notification_title_length check (length(btrim(title)) between 1 and 200),
  constraint notification_body_length check (length(btrim(body)) between 1 and 2000)
);
create index notifications_recipient_created_idx on public.notifications (recipient_user_id, created_at desc);
create index notifications_recipient_unread_idx on public.notifications (recipient_user_id, created_at desc) where read_at is null;

-- Server-only outbox. Fonnte tokens and full message secrets are never stored here.
create table public.whatsapp_outbox (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete restrict,
  recipient_user_id uuid not null references public.profiles(id) on delete restrict,
  message_type text not null check (message_type in ('booking_accepted', 'reminder_h1', 'reminder_day_of')),
  scheduled_at timestamptz not null,
  status text not null default 'queued'
    check (status in ('queued', 'sending', 'sent', 'failed', 'cancelled')),
  idempotency_key text not null unique,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  provider_message_id text,
  sent_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint whatsapp_error_code_length check (last_error_code is null or length(last_error_code) <= 120)
);
create index whatsapp_outbox_due_idx on public.whatsapp_outbox (scheduled_at)
  where status in ('queued', 'failed');
create index whatsapp_outbox_booking_idx on public.whatsapp_outbox (booking_id, message_type);

-- Minimal audit metadata only. Never put intake answers, notes, credentials, or full message
-- contents in metadata. This table is backend-only until the audit policy is reviewed.
create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint audit_action_not_blank check (length(btrim(action)) between 1 and 120),
  constraint audit_entity_type_not_blank check (length(btrim(entity_type)) between 1 and 120),
  constraint audit_metadata_object check (jsonb_typeof(metadata) = 'object')
);
create index audit_events_entity_created_idx on public.audit_events (entity_type, entity_id, created_at desc);
create index audit_events_actor_created_idx on public.audit_events (actor_user_id, created_at desc);

-- updated_at triggers
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger counselor_profiles_set_updated_at before update on public.counselor_profiles
for each row execute function public.set_updated_at();
create trigger academic_periods_set_updated_at before update on public.academic_periods
for each row execute function public.set_updated_at();
create trigger availability_slots_set_updated_at before update on public.availability_slots
for each row execute function public.set_updated_at();
create trigger bookings_set_updated_at before update on public.bookings
for each row execute function public.set_updated_at();
create trigger booking_participants_set_updated_at before update on public.booking_participants
for each row execute function public.set_updated_at();
create trigger counseling_sessions_set_updated_at before update on public.counseling_sessions
for each row execute function public.set_updated_at();
create trigger feedback_set_updated_at before update on public.feedback
for each row execute function public.set_updated_at();
create trigger notifications_set_updated_at before update on public.notifications
for each row execute function public.set_updated_at();
create trigger whatsapp_outbox_set_updated_at before update on public.whatsapp_outbox
for each row execute function public.set_updated_at();

-- RLS: no direct client writes for domain records. Writes/status transitions go through the
-- backend using its server-only key, which must validate the authenticated actor explicitly.
alter table public.profiles enable row level security;
alter table public.counselor_profiles enable row level security;
alter table public.academic_periods enable row level security;
alter table public.availability_slots enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_participants enable row level security;
alter table public.counseling_sessions enable row level security;
alter table public.feedback enable row level security;
alter table public.notifications enable row level security;
alter table public.whatsapp_outbox enable row level security;
alter table public.audit_events enable row level security;

create policy profiles_select_self on public.profiles
for select to authenticated
using (id = (select auth.uid()));
create policy profiles_update_self on public.profiles
for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy counselor_profiles_select_public on public.counselor_profiles
for select to anon, authenticated
using (public.is_public_counselor(profile_id));
create policy counselor_profiles_select_owner on public.counselor_profiles
for select to authenticated
using (profile_id = (select auth.uid()) and public.current_app_role() = 'counselor');
create policy counselor_profiles_update_owner on public.counselor_profiles
for update to authenticated
using (profile_id = (select auth.uid()) and public.current_app_role() = 'counselor')
with check (profile_id = (select auth.uid()) and public.current_app_role() = 'counselor');

create policy academic_periods_select_published on public.academic_periods
for select to anon, authenticated
using (is_published = true);

create policy availability_slots_select_public on public.availability_slots
for select to anon, authenticated
using (status = 'available' and public.is_public_counselor(counselor_id));
create policy availability_slots_select_owner on public.availability_slots
for select to authenticated
using (counselor_id = (select auth.uid()) and public.current_app_role() = 'counselor');

create policy bookings_select_parties on public.bookings
for select to authenticated
using (client_id = (select auth.uid()) or counselor_id = (select auth.uid()));

create policy booking_participants_select_parties on public.booking_participants
for select to authenticated
using (
  exists (
    select 1 from public.bookings b
    where b.id = booking_participants.booking_id
      and (b.client_id = (select auth.uid()) or b.counselor_id = (select auth.uid()))
  )
);

create policy counseling_sessions_select_parties on public.counseling_sessions
for select to authenticated
using (
  exists (
    select 1 from public.bookings b
    where b.id = counseling_sessions.booking_id
      and (b.client_id = (select auth.uid()) or b.counselor_id = (select auth.uid()))
  )
);

create policy feedback_select_submitter on public.feedback
for select to authenticated
using (client_id = (select auth.uid()));

create policy notifications_select_recipient on public.notifications
for select to authenticated
using (recipient_user_id = (select auth.uid()));
create policy notifications_mark_read on public.notifications
for update to authenticated
using (recipient_user_id = (select auth.uid()))
with check (recipient_user_id = (select auth.uid()));

-- No policies for whatsapp_outbox or audit_events: RLS denies anon/authenticated access.

-- Explicit grants: keep private columns and domain writes away from browser clients.
revoke all on public.profiles from anon, authenticated;
revoke all on public.counselor_profiles from anon, authenticated;
revoke all on public.academic_periods from anon, authenticated;
revoke all on public.availability_slots from anon, authenticated;
revoke all on public.bookings from anon, authenticated;
revoke all on public.booking_participants from anon, authenticated;
revoke all on public.counseling_sessions from anon, authenticated;
revoke all on public.feedback from anon, authenticated;
revoke all on public.notifications from anon, authenticated;
revoke all on public.whatsapp_outbox from anon, authenticated;
revoke all on public.audit_events from anon, authenticated;

-- Profiles: users can read their own profile and edit only low-risk fields.
grant select on public.profiles to authenticated;
grant update (full_name, phone_e164) on public.profiles to authenticated;

-- Public directory exposes only the explicit counselor profile table, never profiles.
grant select on public.counselor_profiles to anon, authenticated;
grant update (public_name, headline, bio, specialties, years_experience, photo_path)
  on public.counselor_profiles to authenticated;
grant select on public.academic_periods to anon, authenticated;
grant select on public.availability_slots to anon, authenticated;
grant select on public.bookings to authenticated;
grant select on public.booking_participants to authenticated;
grant select on public.counseling_sessions to authenticated;
grant select on public.feedback to authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

-- Backend service role is server-only and is expected to be used only after the API
-- authenticates the request and checks domain authorization.
grant all on public.profiles to service_role;
grant all on public.counselor_profiles to service_role;
grant all on public.academic_periods to service_role;
grant all on public.availability_slots to service_role;
grant all on public.bookings to service_role;
grant all on public.booking_participants to service_role;
grant all on public.counseling_sessions to service_role;
grant all on public.feedback to service_role;
grant all on public.notifications to service_role;
grant all on public.whatsapp_outbox to service_role;
grant all on public.audit_events to service_role;

commit;
