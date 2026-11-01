# SiCARE Backend — Tahap 5–6 API

Status: implementation patch prepared. Apply the migration only after reviewing the intended Supabase project. This patch has not been applied to a remote database and does not prove live integration.

## Stage 5: Booking

All routes use `/api/v1` and require a valid bearer token except existing public endpoints.

- `POST /bookings` — client creates an individual or group booking. The server derives time from the locked availability slot; clients cannot submit arbitrary start/end times.
- `GET /bookings?status=&limit=` — client sees own bookings; counselor sees bookings assigned to them.
- `GET /bookings/:id` — party-scoped booking detail, including group roster names.
- `PATCH /bookings/:id/status` — counselor may set `confirmed`, `rejected`, or `reschedule_requested` while a booking is waiting for confirmation; a confirmed booking may also move to `reschedule_requested` if its session has not started. Client may cancel their own eligible booking. A reason is required for rejection, cancellation, and reschedule requests.
- `PATCH /bookings/:id/reschedule` — client-only. Available only while the booking is `reschedule_requested`; the client submits `{ "availability_slot_id": "<replacement-slot-uuid>" }`. The replacement must belong to the same active public counselor, be future-dated, be in a published academic period when a period is attached, and not overlap another active booking. The booking returns to `waiting_confirmation` for counselor confirmation.

Create individual request:

```json
{
  "counselor_id": "<counselor-uuid>",
  "availability_slot_id": "<slot-uuid>",
  "service_type": "individual",
  "participants": []
}
```

Create group request:

```json
{
  "counselor_id": "<counselor-uuid>",
  "availability_slot_id": "<slot-uuid>",
  "service_type": "group",
  "group_name": "Kelompok A",
  "participants": [
    { "display_name": "Perwakilan", "is_representative": true },
    { "display_name": "Peserta 2", "is_representative": false }
  ]
}
```

Confirm booking (counselor only):

```json
{
  "status": "confirmed",
  "session_format": "online",
  "room": null
}
```

Reject, cancel, and reschedule requests require a `reason`. The database RPC locks the slot/booking rows and creates booking, participants, session, and notifications in a transaction. Existing unique active-slot index remains a second line of protection. A reschedule request stores `reschedule_reason` separately from cancellation/rejection reason. If the original booking had a session, the session is cancelled while a replacement is pending and the same session row is reactivated with the new time only after the counselor confirms the replacement.

## Stage 6: Sessions, feedback, moderation and notifications

- `GET /sessions?status=&limit=` — sessions associated with the authenticated client's or counselor's bookings.
- `GET /sessions/:id` — session detail, scoped to a booking party.
- `PATCH /sessions/:id/status` — owning counselor may move `scheduled -> ongoing/cancelled` or `ongoing -> completed/cancelled`.
- `POST /sessions/:sessionId/feedback` — client may submit one rating (1–5) and optional comment (max 5000 characters) after session completion. Feedback starts as `pending` and can be submitted only once per client/session.
- `GET /feedback/mine` — own feedback records.
- `GET /admin/feedback?moderation_status=&review_status=&limit=` — admin and Head LMI may review the queue.
- `PATCH /admin/feedback/:id/moderation` — admin only; set `pending`, `shown`, or `disabled`. `disabled_reason` is mandatory for `disabled` and cleared for other statuses.
- `PATCH /admin/feedback/:id/review` — Head LMI only; set `new`, `reviewed`, or `resolved` independently of public moderation.
- `GET /notifications?unread_only=true|false&limit=` — own notifications plus unread count. Read notifications remain stored.
- `PATCH /notifications/:id/read` — marks one own notification as read.
- `PATCH /notifications/read-all` — marks all own unread notifications as read.

## Authorization and data handling

- Booking/session RPCs are `SECURITY DEFINER`, use an empty `search_path`, and are executable only by `service_role`. The backend authenticates the bearer token and checks the application role before calling them.
- The client never supplies booking start/end timestamps. Group participants are name-only and are inserted transactionally with the booking.
- Booking cancellation by a client is blocked once a session is ongoing or completed. The counselor can cancel a scheduled/ongoing session through the session status endpoint.
- Public feedback requires `moderation_status = shown` and a counselor whose account is active and whose public profile is enabled with a non-blank public name. Public availability is filtered in SQL before applying the result limit: unpublished/invalid academic-period slots and slots overlapping active bookings are excluded.
- Notification reads filter by the authenticated user's ID. Marking read sets `read_at`, never deletes the record.
- Audit metadata records only allowlisted action/status/role/count values; comments, participant names, tokens and counseling content are not copied into audit metadata.
- No WhatsApp messages are sent by these stages. The outbox worker is still future work.
- Informed consent, signatures, intake answers, and counseling notes remain unimplemented pending the official client document and process.

## Required verification

1. Run `npm ci`, `npm run check`, `npm test`, and `npm audit` from `be/`.
2. Review and apply migrations in timestamp order: `20261027000000_sicare_core_schema.sql`, `20261028000000_sicare_booking_sessions_feedback_notifications.sql`, then `20261028120000_sicare_public_availability_rescheduling.sql`. The latest migration adds `reschedule_reason`, a public availability RPC, the client reschedule RPC, and the updated booking transition function.
3. Run integration tests against a non-production Supabase project with test accounts for client, counselor, admin and Head LMI.
4. Verify concurrent requests cannot reserve overlapping times for one counselor; unpublished periods and overlapping slots are absent from public availability; feedback from inactive/non-public counselors is absent; a reschedule reason persists; the client can propose a new slot only after a reschedule request; the counselor can confirm/reject the replacement; unauthorized parties cannot read/change bookings or sessions; clients cannot moderate feedback; users cannot mark another user's notification as read.
5. Do not use a service-role key in the browser or frontend environment variables.
