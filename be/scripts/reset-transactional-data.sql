-- SiCARE: bersihkan seluruh data transaksi TANPA menghapus akun.
--
-- Jalankan di Supabase Dashboard -> SQL Editor pada project NON-PRODUKSI.
-- Skrip ini manual/sekali pakai, bukan migrasi.
--
-- DIHAPUS (TRUNCATE):
--   jadwal (availability_slots), booking + peserta + intake, sesi + catatan sesi, feedback,
--   informed consent + undangan + secret undangan + audit consent, notifikasi in-app,
--   outbox WhatsApp, dan audit_events.
--
-- DIPERTAHANKAN:
--   auth.users, auth.identities, profiles, counselor_profiles, counselor_history_credentials
--   (semua akun: klien, konselor, admin, kepala LMI), consent_templates, academic_periods,
--   hero_motivations, homepage_logo.
--
-- Catatan:
-- - TRUNCATE tidak memicu trigger baris ON DELETE, sehingga trigger append-only
--   consent_audit_logs dan penjaga consent bertanda tangan tidak perlu dimatikan.
-- - TRUNCATE sengaja TANPA "cascade": bila ada tabel lain yang masih mereferensikan tabel di
--   bawah, Postgres akan menolak dan transaksi dibatalkan (tidak ada yang terhapus diam-diam).
-- - File di Storage (bucket informed-consent-signed dan informed-consent-signatures) TIDAK
--   ikut terhapus; Supabase melarang hapus langsung dari storage.objects via SQL. Kosongkan
--   kedua bucket itu lewat Dashboard -> Storage bila perlu. JANGAN hapus
--   informed-consent-templates (berisi template PDF resmi).
-- - Hapus baris "academic_periods" pada daftar di bawah HANYA bila periode juga ingin direset
--   (seed dummy akan membuat periode berjalan bila belum ada).

begin;

truncate table
  public.consent_invitation_secrets,
  public.consent_audit_logs,
  public.consent_invitations,
  public.informed_consents,
  public.whatsapp_outbox,
  public.feedback,
  public.session_notes,
  public.counseling_sessions,
  public.booking_intakes,
  public.booking_participants,
  public.bookings,
  public.availability_slots,
  public.notifications,
  public.audit_events;

-- Opsional: reset juga periode akademik (lepas komentar bila diinginkan).
-- truncate table public.academic_periods;

commit;

-- Verifikasi (semua kolom harus 0; akun tetap ada):
-- select
--   (select count(*) from public.availability_slots)   as slots,
--   (select count(*) from public.bookings)             as bookings,
--   (select count(*) from public.booking_participants) as participants,
--   (select count(*) from public.booking_intakes)      as intakes,
--   (select count(*) from public.counseling_sessions)  as sessions,
--   (select count(*) from public.session_notes)        as session_notes,
--   (select count(*) from public.feedback)             as feedback,
--   (select count(*) from public.informed_consents)    as consents,
--   (select count(*) from public.consent_invitations)  as invitations,
--   (select count(*) from public.consent_audit_logs)   as consent_audit,
--   (select count(*) from public.notifications)        as notifications,
--   (select count(*) from public.whatsapp_outbox)      as whatsapp_outbox,
--   (select count(*) from public.audit_events)         as audit_events,
--   (select count(*) from public.profiles)             as profiles_tetap_ada;
