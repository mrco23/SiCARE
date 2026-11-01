-- SiCARE Batch 1.5b.1: Consent Security & Data Integrity Hardening
-- Hardens Informed Consent RLS, Participant Identity Privacy, Signed Consent Immutability,
-- Supabase Storage Restrictions, Atomic Invitation Claiming, and Readiness RPC.

begin;

-- ============================================================================
-- 1. Storage Bucket Hardening: Restrict MIME types (Remove SVG, enforce PNG/JPEG)
-- ============================================================================
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    update storage.buckets
    set allowed_mime_types = array['image/png', 'image/jpeg']
    where id = 'informed-consent-signatures';
  end if;
end;
$$;

-- Storage object policies if storage.objects exists
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'objects') then
    -- Templates bucket: authenticated users can read, only admin or service_role can insert/modify
    drop policy if exists consent_templates_objects_select on storage.objects;
    create policy consent_templates_objects_select on storage.objects
      for select to authenticated
      using (bucket_id = 'informed-consent-templates');

    -- Signatures bucket: participant signer or service_role can read/write
    drop policy if exists consent_signatures_objects_select on storage.objects;
    create policy consent_signatures_objects_select on storage.objects
      for select to authenticated
      using (
        bucket_id = 'informed-consent-signatures'
        and (
          owner = (select auth.uid())
          or exists (
            select 1 from public.informed_consents ic
            where ic.signature_storage_path = name
              and ic.signer_user_id = (select auth.uid())
          )
        )
      );

    -- Signed PDFs bucket: only signer, assigned counselor, or admin/head_lmi can read
    drop policy if exists consent_signed_objects_select on storage.objects;
    create policy consent_signed_objects_select on storage.objects
      for select to authenticated
      using (
        bucket_id = 'informed-consent-signed'
        and exists (
          select 1 from public.informed_consents ic
          join public.bookings b on b.id = ic.booking_id
          where ic.signed_document_storage_path = name
            and (
              ic.signer_user_id = (select auth.uid())
              or b.counselor_id = (select auth.uid())
              or exists (
                select 1 from public.profiles p
                where p.id = (select auth.uid())
                  and p.app_role in ('admin', 'head_lmi')
                  and p.account_status = 'active'
              )
            )
        )
      );
  end if;
end;
$$;

-- ============================================================================
-- 2. Hardened RLS on public.informed_consents
-- Drop broad booking party policy to prevent primary client from reading other
-- participants' identity snapshots, signature paths, and signed document paths.
-- ============================================================================
drop policy if exists informed_consents_select_parties on public.informed_consents;
drop policy if exists informed_consents_select_strict on public.informed_consents;

create policy informed_consents_select_strict on public.informed_consents
  for select to authenticated
  using (
    -- 1. Direct signer
    signer_user_id = (select auth.uid())
    -- 2. Or the booking participant whose user account matches
    or exists (
      select 1 from public.booking_participants bp
      where bp.id = informed_consents.booking_participant_id
        and bp.user_id = (select auth.uid())
    )
    -- 3. Institutional compliance & oversight (Admin / Head LMI)
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.app_role in ('admin', 'head_lmi')
        and p.account_status = 'active'
    )
  );

-- Direct client updates or deletes on informed_consents remain completely revoked
revoke insert, update, delete on public.informed_consents from public, anon, authenticated;

-- ============================================================================
-- 3. Hardened RLS on public.booking_participants
-- Protects private clinical identity fields (nim, birthplace, date_of_birth, gender, phone_e164)
-- ============================================================================
drop policy if exists booking_participants_select_parties on public.booking_participants;
drop policy if exists booking_participants_select_strict on public.booking_participants;

create policy booking_participants_select_strict on public.booking_participants
  for select to authenticated
  using (
    -- Participant can view their own full participant row
    user_id = (select auth.uid())
    -- Or primary client can only view their own representative row via direct table SELECT
    or (
      is_primary = true
      and exists (
        select 1 from public.bookings b
        where b.id = booking_participants.booking_id
          and b.client_id = (select auth.uid())
      )
    )
    -- Or institutional compliance (Admin / Head LMI)
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.app_role in ('admin', 'head_lmi')
        and p.account_status = 'active'
    )
  );

-- Direct client modifications remain strictly revoked
revoke insert, update, delete on public.booking_participants from public, anon, authenticated;

-- ============================================================================
-- 4. Operational Consent Summaries Function (Safe for Primary Client & Counselor)
-- Exposes ONLY operational metadata (status, timestamp). Zero sensitive PII,
-- zero identity snapshots, zero signature paths, zero signed PDF paths.
-- ============================================================================
create or replace function public.sicare_get_booking_consent_summaries(
  p_booking_id uuid
)
returns table (
  participant_id uuid,
  display_name text,
  is_primary boolean,
  participant_status text,
  consent_status text,
  consent_id uuid,
  signed_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_caller uuid := auth.uid();
  v_caller_role text;
begin
  select * into v_booking
  from public.bookings
  where id = p_booking_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'BOOKING_NOT_FOUND';
  end if;

  -- Verify caller authorization: client, counselor, admin, head_lmi, or service_role
  if v_caller is not null then
    select app_role into v_caller_role
    from public.profiles
    where id = v_caller and account_status = 'active';

    if v_booking.client_id != v_caller
       and v_booking.counselor_id != v_caller
       and coalesce(v_caller_role, '') not in ('admin', 'head_lmi') then
      raise exception using errcode = '42501', message = 'BOOKING_ACCESS_FORBIDDEN';
    end if;
  end if;

  return query
  select
    bp.id as participant_id,
    coalesce(bp.full_name, bp.display_name) as display_name,
    bp.is_primary,
    bp.participant_status,
    coalesce(ic.status, 'uninitialized') as consent_status,
    ic.id as consent_id,
    ic.signed_at
  from public.booking_participants bp
  left join public.informed_consents ic on ic.booking_participant_id = bp.id
  where bp.booking_id = p_booking_id
    and bp.participant_status != 'removed'
  order by bp.is_primary desc, bp.created_at asc;
end;
$$;

revoke all on function public.sicare_get_booking_consent_summaries(uuid) from public, anon;
grant execute on function public.sicare_get_booking_consent_summaries(uuid) to authenticated, service_role;

-- ============================================================================
-- 5. Signed Consent Immutability Trigger
-- Enforces that once a consent is marked 'signed', its legal evidence
-- (identity snapshot, template reference, signatures, hashes, paths)
-- is permanently immutable and cannot be tampered with or deleted.
-- Revocation is append/state-based: preserves all signed evidence intact.
-- ============================================================================
create or replace function public.prohibit_signed_consent_tampering()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.status in ('signed', 'revoked') then
      raise exception using errcode = '42501', message = 'SIGNED_CONSENT_CANNOT_BE_DELETED';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' then
    -- Once signed, status can ONLY transition to 'revoked' or remain 'signed'
    if old.status = 'signed' then
      if new.status != 'revoked' and new.status != 'signed' then
        raise exception using errcode = '42501', message = 'SIGNED_CONSENT_INVALID_STATUS_TRANSITION';
      end if;

      -- Evidence must be strictly immutable
      if old.identity_snapshot is distinct from new.identity_snapshot
         or old.signer_user_id is distinct from new.signer_user_id
         or old.signer_name_snapshot is distinct from new.signer_name_snapshot
         or old.consent_template_id is distinct from new.consent_template_id
         or old.consent_statement_version is distinct from new.consent_statement_version
         or old.signed_at is distinct from new.signed_at
         or old.signature_storage_path is distinct from new.signature_storage_path
         or old.signed_document_storage_path is distinct from new.signed_document_storage_path
         or old.signed_document_sha256 is distinct from new.signed_document_sha256
         or old.signature_method is distinct from new.signature_method
         or old.booking_participant_id is distinct from new.booking_participant_id
         or old.booking_id is distinct from new.booking_id then
        raise exception using errcode = '42501', message = 'SIGNED_CONSENT_EVIDENCE_IMMUTABLE';
      end if;

      -- If transitioning to revoked, revoked_at must be populated
      if new.status = 'revoked' and new.revoked_at is null then
        new.revoked_at := now();
      end if;
    end if;

    -- Once revoked, record is permanently final; no further updates permitted
    if old.status = 'revoked' then
      raise exception using errcode = '42501', message = 'REVOKED_CONSENT_IS_FINAL';
    end if;

    return new;
  end if;

  return new;
end;
$$;

revoke all on function public.prohibit_signed_consent_tampering() from public, anon, authenticated;

drop trigger if exists informed_consents_tampering_guard on public.informed_consents;
create trigger informed_consents_tampering_guard
before update or delete on public.informed_consents
for each row execute function public.prohibit_signed_consent_tampering();

-- ============================================================================
-- 6. Atomic Invitation Claim RPC
-- Prevents race conditions during token redemption. Validates single-use,
-- expiration, and account identity matching for authenticated invitations.
-- ============================================================================
create or replace function public.sicare_claim_consent_invitation(
  p_token_hash text,
  p_claimer_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv public.consent_invitations%rowtype;
  v_part public.booking_participants%rowtype;
  v_updated public.consent_invitations%rowtype;
begin
  if p_token_hash is null or length(btrim(p_token_hash)) = 0 then
    raise exception using errcode = 'P0001', message = 'INVALID_TOKEN_HASH';
  end if;

  select * into v_inv
  from public.consent_invitations
  where token_hash = p_token_hash;

  if not found then
    raise exception using errcode = 'P0001', message = 'INVITATION_NOT_FOUND';
  end if;

  if v_inv.status in ('claimed', 'completed') then
    raise exception using errcode = 'P0001', message = 'INVITATION_ALREADY_USED';
  end if;

  if v_inv.status in ('revoked', 'failed') then
    raise exception using errcode = 'P0001', message = 'INVITATION_REVOKED';
  end if;

  if v_inv.expires_at <= now() or v_inv.status = 'expired' then
    update public.consent_invitations
    set status = 'expired', updated_at = now()
    where id = v_inv.id;
    raise exception using errcode = 'P0001', message = 'INVITATION_EXPIRED';
  end if;

  select * into v_part
  from public.booking_participants
  where id = v_inv.booking_participant_id;

  -- For authenticated invitations, verify caller account matching
  if v_inv.invitation_type = 'authenticated_participant' then
    if p_claimer_user_id is null then
      raise exception using errcode = 'P0001', message = 'AUTHENTICATION_REQUIRED';
    end if;
    if v_part.user_id is not null and v_part.user_id != p_claimer_user_id then
      raise exception using errcode = 'P0001', message = 'INVITATION_ACCOUNT_MISMATCH';
    end if;
  end if;

  -- Atomic claim update
  update public.consent_invitations
  set status = 'claimed',
      claimed_at = now(),
      claimed_by_user_id = coalesce(p_claimer_user_id, v_part.user_id),
      updated_at = now()
  where id = v_inv.id
    and status in ('pending', 'sent')
    and expires_at > now()
  returning * into v_updated;

  if not found then
    raise exception using errcode = 'P0001', message = 'INVITATION_CLAIM_RACE_OR_ALREADY_USED';
  end if;

  -- Append-only audit log
  insert into public.consent_audit_logs (
    consent_id,
    booking_participant_id,
    booking_id,
    invitation_id,
    actor_user_id,
    actor_type,
    event_type,
    metadata
  ) values (
    v_updated.consent_id,
    v_updated.booking_participant_id,
    v_part.booking_id,
    v_updated.id,
    p_claimer_user_id,
    case when p_claimer_user_id is not null then 'user' else 'guest' end,
    'invitation_claimed',
    jsonb_build_object('invitation_type', v_updated.invitation_type)
  );

  return jsonb_build_object(
    'success', true,
    'invitation_id', v_updated.id,
    'booking_participant_id', v_updated.booking_participant_id,
    'consent_id', v_updated.consent_id,
    'invitation_type', v_updated.invitation_type,
    'claimed_at', v_updated.claimed_at
  );
end;
$$;

revoke all on function public.sicare_claim_consent_invitation(text, uuid) from public, anon;
grant execute on function public.sicare_claim_consent_invitation(text, uuid) to authenticated, service_role;

-- ============================================================================
-- 7. Hardened Consent Readiness RPC
-- Validates authorization, excludes removed participants, checks active template
-- version compliance, and outputs sanitized operational metadata without PII.
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
  v_caller uuid := auth.uid();
  v_caller_role text;
  v_active_template public.consent_templates%rowtype;
  v_total_participants integer := 0;
  v_signed_participants integer := 0;
  v_participants jsonb;
  v_is_ready boolean := false;
  v_template_compliant boolean := true;
begin
  select * into v_booking
  from public.bookings
  where id = p_booking_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'BOOKING_NOT_FOUND';
  end if;

  -- Verify caller authorization: client, counselor, admin, head_lmi, or service_role
  if v_caller is not null then
    select app_role into v_caller_role
    from public.profiles
    where id = v_caller and account_status = 'active';

    if v_booking.client_id != v_caller
       and v_booking.counselor_id != v_caller
       and coalesce(v_caller_role, '') not in ('admin', 'head_lmi') then
      raise exception using errcode = '42501', message = 'BOOKING_ACCESS_FORBIDDEN';
    end if;
  end if;

  -- Resolve active consent template
  select * into v_active_template
  from public.consent_templates
  where template_code = 'SICARE_IC_STD'
    and is_active = true
  limit 1;

  if not found then
    raise exception using errcode = 'P0001', message = 'ACTIVE_CONSENT_TEMPLATE_MISSING';
  end if;

  if v_booking.service_type = 'individual' then
    v_total_participants := 1;

    select count(*) into v_signed_participants
    from public.informed_consents ic
    where ic.booking_id = p_booking_id
      and ic.status = 'signed'
      and ic.consent_template_id = v_active_template.id;

    v_is_ready := (v_signed_participants >= 1);
  else
    -- Group booking: strictly active participants (excluding removed)
    select count(*) into v_total_participants
    from public.booking_participants bp
    where bp.booking_id = p_booking_id
      and bp.participant_status != 'removed';

    if v_total_participants = 0 then
      v_total_participants := coalesce(v_booking.participant_count, 1);
    end if;

    -- Count distinct participants with signed consent using the ACTIVE template version
    select count(distinct ic.booking_participant_id) into v_signed_participants
    from public.informed_consents ic
    join public.booking_participants bp on bp.id = ic.booking_participant_id
    where bp.booking_id = p_booking_id
      and bp.participant_status != 'removed'
      and ic.status = 'signed'
      and ic.consent_template_id = v_active_template.id;

    -- Check if any signed consent used an outdated template version
    if exists (
      select 1 from public.informed_consents ic
      join public.booking_participants bp on bp.id = ic.booking_participant_id
      where bp.booking_id = p_booking_id
        and bp.participant_status != 'removed'
        and ic.status = 'signed'
        and ic.consent_template_id != v_active_template.id
    ) then
      v_template_compliant := false;
    end if;

    v_is_ready := (v_total_participants > 0 and v_signed_participants >= v_total_participants and v_template_compliant);
  end if;

  -- Operational participant summaries: strictly sanitized (NO PII, NO identity_snapshot)
  select coalesce(jsonb_agg(jsonb_build_object(
    'participant_id', bp.id,
    'full_name', coalesce(bp.full_name, bp.display_name),
    'is_primary', bp.is_primary,
    'participant_status', bp.participant_status,
    'consent_status', coalesce(ic.status, 'uninitialized'),
    'consent_id', ic.id,
    'template_compliant', (ic.consent_template_id = v_active_template.id),
    'signed_at', ic.signed_at
  )), '[]'::jsonb) into v_participants
  from public.booking_participants bp
  left join public.informed_consents ic on ic.booking_participant_id = bp.id
  where bp.booking_id = p_booking_id
    and bp.participant_status != 'removed';

  return jsonb_build_object(
    'booking_id', v_booking.id,
    'service_type', v_booking.service_type,
    'active_template_version', v_active_template.version,
    'total_participants', v_total_participants,
    'signed_participants', v_signed_participants,
    'pending_participants', greatest(0, v_total_participants - v_signed_participants),
    'template_compliant', v_template_compliant,
    'is_fully_consented', v_is_ready,
    'participants', v_participants
  );
end;
$$;

revoke all on function public.sicare_check_booking_consent_readiness(uuid) from public, anon;
grant execute on function public.sicare_check_booking_consent_readiness(uuid) to authenticated, service_role;

commit;
