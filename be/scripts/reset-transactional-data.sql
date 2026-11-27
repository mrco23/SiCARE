-- SiCARE: RESET DUMMY. Bersihkan seluruh data transaksi TANPA menghapus akun.
--
-- Simpan sebagai snippet di Supabase Dashboard -> SQL Editor (project NON-PRODUKSI).
-- Skrip manual, bukan migrasi. Jalankan sebelum snippet Seed Dummy
-- (be/scripts/seed-dummy-current-period.sql; seed menolak berjalan bila bookings belum kosong).
-- Aman dijalankan berulang kali.
--
-- DIHAPUS (TRUNCATE):
--   jadwal (availability_slots), booking + peserta + intake, sesi + catatan sesi, feedback,
--   informed consent + undangan + secret undangan + audit consent, notifikasi in-app,
--   outbox WhatsApp, dan audit_events.
--
-- DIPERTAHANKAN:
--   Semua akun dan datanya: auth.users, auth.identities, profiles, counselor_profiles
--   (termasuk sandi riwayat konselor), counselor_educations, login_attempts.
--   Konten & konfigurasi: academic_periods, consent_templates (bila masih ada),
--   hero_motivations, homepage_logo.
--
-- Catatan:
-- - Tahan terhadap database yang migrasinya belum lengkap: tabel yang belum ada (mis.
--   session_notes, booking_intakes, consent_invitation_secrets) dilewati dan disebut di NOTICE.
-- - TRUNCATE tidak memicu trigger baris ON DELETE, sehingga trigger append-only
--   consent_audit_logs dan penjaga consent bertanda tangan tidak perlu dimatikan.
-- - TRUNCATE sengaja TANPA "cascade": bila ada tabel lain yang masih mereferensikan tabel di
--   daftar, Postgres menolak dan transaksi dibatalkan (tidak ada yang terhapus diam-diam).
-- - File di Storage (bucket informed-consent-signed dan informed-consent-signatures) TIDAK
--   ikut terhapus; Supabase melarang hapus langsung dari storage.objects via SQL. Kosongkan
--   kedua bucket itu lewat Dashboard -> Storage bila perlu. JANGAN hapus
--   informed-consent-templates (berisi template PDF resmi).

begin;

do $$
declare
  v_tables text[] := array[
    'consent_invitation_secrets', 'consent_audit_logs', 'consent_invitations',
    'informed_consents', 'whatsapp_outbox', 'feedback', 'session_notes',
    'counseling_sessions', 'booking_intakes', 'booking_participants', 'bookings',
    'availability_slots', 'notifications', 'audit_events'
  ];
  v_existing text[];
  v_missing  text[];
  v_t        text;
  v_count    bigint;
begin
  select array_agg(t order by ord) filter (where to_regclass('public.' || t) is not null),
         array_agg(t order by ord) filter (where to_regclass('public.' || t) is null)
  into v_existing, v_missing
  from unnest(v_tables) with ordinality as x(t, ord);

  if v_missing is not null then
    raise notice 'Dilewati (tabel belum ada di database ini): %', array_to_string(v_missing, ', ');
  end if;

  execute 'truncate table ' || (
    select string_agg(format('public.%I', t), ', ') from unnest(v_existing) t
  );

  foreach v_t in array v_existing loop
    execute format('select count(*) from public.%I', v_t) into v_count;
    if v_count <> 0 then
      raise exception 'Tabel % masih berisi % baris setelah TRUNCATE.', v_t, v_count;
    end if;
  end loop;

  select count(*) into v_count from public.profiles;
  raise notice 'Selesai: % tabel dikosongkan; % profil akun tetap ada.',
    array_length(v_existing, 1), v_count;
end;
$$;

-- Opsional: reset juga periode akademik (lepas komentar bila diinginkan; seed dummy akan
-- membuat periode berjalan bila belum ada).
-- truncate table public.academic_periods;

commit;
