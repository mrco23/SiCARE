-- SiCARE hanya melayani sesi konseling tatap muka.
-- 1) Sesi lama berformat 'online' (hanya data dummy) diubah menjadi 'offline'.
-- 2) Batasan kolom format diganti agar hanya menerima 'offline', dengan default 'offline'.
-- Backend sudah selalu mengirim 'offline' saat booking dikonfirmasi (2026-11-23).
--
-- Catatan 2026-11-25: versi inilah yang diterapkan di produksi dengan nomor 20261123120000.
-- Penghapusan kolom format dan parameter p_session_format dipindah ke
-- 20261125120000_sicare_drop_session_format.sql.

begin;

update public.counseling_sessions
set format = 'offline'
where format <> 'offline';

alter table public.counseling_sessions
  drop constraint if exists counseling_sessions_format_check;

alter table public.counseling_sessions
  alter column format set default 'offline';

alter table public.counseling_sessions
  add constraint counseling_sessions_format_check check (format = 'offline');

commit;
