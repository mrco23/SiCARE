-- Hapus atribut persetujuan WhatsApp pada profil (ERD: izin_whatsapp, izin_whatsapp_pada).
-- Sejak 2026-11-13 notifikasi WhatsApp wajib untuk semua klien/konselor dan worker tidak lagi
-- membaca kolom ini; endpoint PATCH /profile/whatsapp-consent juga dihapus (2026-11-24).
-- Tidak ada fungsi, view, atau policy database yang merujuk kolom ini (dicek di produksi).
-- Terapkan bersamaan dengan deploy backend yang tidak lagi memilih kolom ini.

begin;

alter table public.profiles drop column if exists whatsapp_opt_in_at;
alter table public.profiles drop column if exists whatsapp_opt_in;

commit;
