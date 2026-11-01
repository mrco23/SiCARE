# SiCARE Backend — Tahap 2: Database foundation

Status: migration patch prepared; not yet applied to the remote Supabase project.

## Included tables

- `profiles`: application role, NIM/NIP identifier, account status, name, phone and WhatsApp opt-in metadata.
- `counselor_profiles`: explicitly public counselor profile fields, separated from private identity data.
- `academic_periods`: no seed records because the audited mock calendars disagree; official dates must be confirmed.
- `availability_slots`: counselor availability windows.
- `bookings`: one booking for one individual or one group represented by a single client account.
- `booking_participants`: normalized group roster with names only; no participant NIM or mandatory member account.
- `counseling_sessions`: separate session lifecycle; at most one session per booking in this initial model.
- `feedback`: rating, moderation status (`pending`, `shown`, `disabled`) and separate review status.
- `notifications`: `read_at` hides a notification from unread count but does not delete it.
- `whatsapp_outbox`: server-only queue metadata for booking accepted, H-1 and day-of reminders, with unique idempotency key.
- `audit_events`: minimal metadata for server-side audit; must not contain intake answers, notes, credentials or message contents.

## Security choices

- RLS is enabled on every app table.
- Public reads are limited to published academic periods, available slots for explicitly public active counselors, and the explicit public counselor profile table.
- Authenticated users can read only their own profile, their booking/session parties, their own submitted feedback, and their own notifications.
- Browser writes are limited to low-risk profile fields, counselor public-profile fields, and `notifications.read_at`. Domain writes/status transitions are backend-only.
- `app_role` and `account_status` cannot be changed by self-service column grants.
- Auth user trigger always creates role `client`; user-supplied metadata cannot set privileged roles.
- `whatsapp_outbox` and `audit_events` have no browser policies/grants.
- Admin and Head LMI do not receive direct raw intake/counseling-note access. Those tables are intentionally not created in this migration.
- No consent/signature tables are created until the official informed-consent document and process are available.

## Deliberate limitations / follow-up

- This migration has not been applied or integration-tested against the user's remote project.
- No official academic periods are seeded.
- Backend must validate caller identity/role and enforce state transitions before using its service key; service-role access bypasses RLS.
- Booking slot conflict index prevents two active bookings for the same slot, but overlapping slots for the same counselor and reschedule workflow need an explicit scheduling policy and transactional endpoint.
- Group participant count and roster consistency, exactly one representative participant row, and eligibility to create feedback must be validated transactionally by backend services.
- No intake response, counseling notes, consent, file uploads, or retention jobs are included.
- No WhatsApp messages are sent; the outbox is only a data structure for a later worker.
- Retention period for read notifications, WhatsApp logs, and audit events remains undecided.
- `identity_code` supports unique NIM/NIP storage, but the secure NIM/NIP-to-Supabase-Auth login resolver is a later backend task.

## Verification after applying

1. `supabase migration list` should show this migration applied.
2. Confirm the expected tables exist in Table Editor.
3. Inspect RLS is enabled for all tables.
4. Test with anon/authenticated users that private profile fields, bookings of other users, notifications of other users, `whatsapp_outbox`, and `audit_events` cannot be read.
5. Do not test with a service-role key in a browser; service role is backend-only.
