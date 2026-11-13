-- SiCARE: pembersihan data booking/sesi uji coba.
-- Jalankan ini di Supabase Dashboard -> SQL Editor (project terkait), lalu HAPUS file ini
-- setelah dijalankan — ini skrip sekali pakai, bukan migrasi permanen.
--
-- Kenapa perlu skrip manual (bukan dikerjakan otomatis oleh asisten):
-- consent_audit_logs punya trigger "append-only" yang menolak SEMUA update/delete pada
-- tabel itu, termasuk saat Postgres mencoba mengosongkan referensinya secara otomatis
-- (ON DELETE SET NULL) ketika booking/consent terkait dihapus. Trigger ini hanya bisa
-- dimatikan lewat perintah ALTER TABLE, yang tidak bisa dijalankan lewat REST API yang
-- dipakai backend (hanya CRUD tabel/RPC, bukan DDL). Baris consent_audit_logs TIDAK
-- dihapus oleh skrip ini — hanya referensinya (booking_id, booking_participant_id,
-- consent_id) yang kosong, sama seperti perilaku normal ON DELETE SET NULL pada tabel
-- lain. Trigger dinyalakan lagi di akhir skrip ini, dalam transaksi yang sama.
--
-- 1 booking yang tidak punya informed_consents (status 'rejected') sudah dihapus lebih
-- dulu lewat API biasa (tanpa perlu skrip ini), jadi tidak termasuk di sini lagi.

begin;

alter table public.consent_audit_logs disable trigger consent_audit_logs_append_only;

delete from public.feedback
where session_id in (select id from public.counseling_sessions);

delete from public.informed_consents;

delete from public.whatsapp_outbox;

delete from public.notifications
where (entity_type = 'booking' and entity_id in (select id from public.bookings))
   or (entity_type = 'session' and entity_id in (select id from public.counseling_sessions));

delete from public.counseling_sessions;

delete from public.bookings;

alter table public.consent_audit_logs enable trigger consent_audit_logs_append_only;

commit;

-- Verifikasi setelah menjalankan (harus 0 untuk semua baris di bawah):
-- select
--   (select count(*) from public.bookings) as bookings,
--   (select count(*) from public.counseling_sessions) as sessions,
--   (select count(*) from public.booking_participants) as participants,
--   (select count(*) from public.informed_consents) as informed_consents,
--   (select count(*) from public.feedback) as feedback,
--   (select count(*) from public.whatsapp_outbox) as whatsapp_outbox;
