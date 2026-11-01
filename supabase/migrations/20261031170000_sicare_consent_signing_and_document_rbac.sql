-- SiCARE Batch 1.5c: Informed Consent Signing & Storage RBAC Hardening
-- Tightens signed PDF and signature storage object policies so that:
-- 1. Signers can access only their own signature and signed PDF.
-- 2. Assigned counselors can access signed PDFs only for their assigned bookings.
-- 3. Automatic unrestricted direct access to signed PDFs by Admin/Head LMI is removed in favor of least-privilege clinical compliance.
-- 4. Primary clients cannot download other participants' signed PDFs.

begin;

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'objects') then
    -- Signatures bucket: strictly participant signer or service_role
    drop policy if exists consent_signatures_objects_select on storage.objects;
    create policy consent_signatures_objects_select on storage.objects
      for select to authenticated
      using (
        bucket_id = 'informed-consent-signatures'
        and exists (
          select 1 from public.informed_consents ic
          where ic.signature_storage_path = name
            and ic.signer_user_id = (select auth.uid())
        )
      );

    -- Signed PDFs bucket: strictly participant signer, assigned counselor, or service_role
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
            )
        )
      );
  end if;
end;
$$;

commit;
