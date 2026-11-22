-- SiCARE: hapus tabel consent_templates; versi template Informed Consent menjadi konstanta backend.
--
-- Sumber kebenaran template kini be/src/services/consentPdf.service.js
-- (OFFICIAL_TEMPLATE_CODE, OFFICIAL_TEMPLATE_VERSION, OFFICIAL_TEMPLATE_SHA256). Berkas PDF resmi
-- tetap dibaca dari docs/reference/infromed-consent/informed-consent.pdf dan diverifikasi SHA-256.
--
-- Perubahan:
-- 1. informed_consents.consent_statement_version menjadi satu-satunya penanda versi template
--    yang ditandatangani. Kolom consent_template_id (FK ke consent_templates) dihapus.
-- 2. Index unik "satu consent aktif per peserta per template" dipindah ke
--    (booking_participant_id, consent_statement_version).
-- 3. Trigger imutabilitas consent bertanda tangan tidak lagi memeriksa consent_template_id;
--    consent_statement_version tetap imutabel.
-- 4. sicare_check_booking_consent_readiness tidak lagi membaca consent_templates. Fungsi ini
--    mengembalikan consent_statement_version per peserta; backend menghitung template_compliant
--    terhadap konstanta. Kelayakan sesi (is_fully_consented) tidak berubah.
-- 5. Tabel consent_templates dan policy-nya dihapus. Bucket storage informed-consent-templates
--    tidak disentuh.

begin;

-- ----------------------------------------------------------------------------
-- 0. Pengaman: versi pada consent harus sama dengan versi template yang direferensikan.
--    Backend selalu mengisi keduanya bersamaan; bila ada selisih, migrasi dibatalkan agar
--    bukti versi tidak hilang diam-diam.
-- ----------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1
    from public.informed_consents ic
    join public.consent_templates ct on ct.id = ic.consent_template_id
    where ic.consent_statement_version is distinct from ct.version
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'CONSENT_VERSION_MISMATCH: consent_statement_version berbeda dari versi consent_templates. Periksa data sebelum menghapus consent_templates.';
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 1. Trigger imutabilitas tanpa consent_template_id
-- ----------------------------------------------------------------------------
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

  return null;
end;
$$;

revoke all on function public.prohibit_signed_consent_tampering() from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. Readiness tanpa consent_templates
-- ----------------------------------------------------------------------------
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

  if v_booking.service_type = 'individual' then
    v_total_participants := 1;

    select count(*) into v_signed_participants
    from public.informed_consents ic
    where ic.booking_id = p_booking_id
      and ic.status = 'signed';

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

    -- Count distinct participants with a signed consent (any template version they signed)
    select count(distinct ic.booking_participant_id) into v_signed_participants
    from public.informed_consents ic
    join public.booking_participants bp on bp.id = ic.booking_participant_id
    where bp.booking_id = p_booking_id
      and bp.participant_status != 'removed'
      and ic.status = 'signed';

    v_is_ready := (v_total_participants > 0 and v_signed_participants >= v_total_participants);
  end if;

  -- Operational participant summaries: strictly sanitized (NO PII, NO identity_snapshot)
  select coalesce(jsonb_agg(jsonb_build_object(
    'participant_id', bp.id,
    'full_name', coalesce(bp.full_name, bp.display_name),
    'is_primary', bp.is_primary,
    'participant_status', bp.participant_status,
    'consent_status', coalesce(ic.status, 'uninitialized'),
    'consent_id', ic.id,
    'consent_statement_version', ic.consent_statement_version,
    'signed_at', ic.signed_at
  )), '[]'::jsonb) into v_participants
  from public.booking_participants bp
  left join public.informed_consents ic on ic.booking_participant_id = bp.id
  where bp.booking_id = p_booking_id
    and bp.participant_status != 'removed';

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

-- ----------------------------------------------------------------------------
-- 3. Index dan kolom informed_consents
-- ----------------------------------------------------------------------------
drop index if exists public.informed_consents_participant_template_uq;
drop index if exists public.informed_consents_template_idx;

create unique index if not exists informed_consents_participant_version_uq
  on public.informed_consents (booking_participant_id, consent_statement_version)
  where status in ('pending', 'viewed', 'signed');

alter table public.informed_consents
  drop column if exists consent_template_id;

-- Versi wajib diisi eksplisit oleh backend dari konstanta; tidak ada default diam-diam.
alter table public.informed_consents
  alter column consent_statement_version drop default;

alter table public.informed_consents
  add constraint informed_consents_statement_version_len
    check (length(btrim(consent_statement_version)) between 1 and 32);

-- ----------------------------------------------------------------------------
-- 4. Hapus tabel consent_templates
-- ----------------------------------------------------------------------------
drop policy if exists consent_templates_select_auth on public.consent_templates;
drop table if exists public.consent_templates;

commit;
