-- WhatsApp ke klien setelah sesi selesai: ajakan mengisi feedback (message_type feedback_request).
-- Diantrekan backend (session.service.js) setelah konselor menyelesaikan sesi.

begin;

alter table public.whatsapp_outbox drop constraint if exists whatsapp_outbox_message_type_check;

alter table public.whatsapp_outbox
  add constraint whatsapp_outbox_message_type_check check (message_type = any (array[
    'booking_requested', 'booking_received', 'booking_accepted', 'booking_rejected',
    'reschedule_requested', 'booking_cancelled', 'reminder_h1', 'reminder_morning',
    'reminder_day_of', 'consent_invitation', 'consent_reminder', 'feedback_request'
  ]::text[]));

commit;
