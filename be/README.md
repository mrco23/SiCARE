# SiCARE Backend

Express API foundation for SiCARE. Supabase server credentials must stay in `be/.env` and must never be exposed in the frontend.

## Setup

From `be/`:

```bash
npm ci
cp .env.example .env
npm run check
npm test
```

Configure `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and exactly one server-side key (`SUPABASE_SECRET_KEY` or legacy `SUPABASE_SERVICE_ROLE_KEY`). `SUPABASE_ANON_KEY` is supported as a legacy public Auth key fallback. Do not put server-side keys in any `VITE_*` variable.

## Current API scope

All paths below use `/api/v1` as the prefix.

Public endpoints:

- `GET /health`
- `GET /public/counselors`
- `GET /public/periods`
- `GET /public/availability?counselor_id=&from=&to=&limit=`
- `GET /public/feedback?limit=` (only `moderation_status = shown`)
- `POST /auth/register`
  - Body mendukung `email`, `password`, `full_name`, `identity_code`, `member_category`, dan `phone_e164` dalam format E.164. Registrasi mandiri selalu membuat role `client`; role aplikasi tidak dapat dipilih dari frontend.
- `POST /auth/login`
  - Body: `{ "identifier": "email atau NIM/NIP", "password": "..." }`. Backend menyelesaikan kode identitas menjadi email melalui Supabase Auth di server. Field `email` lama tetap diterima untuk kompatibilitas.

Authenticated endpoints:

- `GET /auth/me`
- `POST /auth/logout`
- `GET /profile`
- `PATCH /profile` (only `full_name` and `phone_e164`)
- `PATCH /profile/whatsapp-consent` (`{ "opted_in": boolean }`; records or withdraws WhatsApp opt-in separately)
- `POST /bookings`, `GET /bookings`, `GET /bookings/:id`, `PATCH /bookings/:id/status`, `PATCH /bookings/:id/reschedule` (client submits a replacement slot after a counselor reschedule request)
- `GET /sessions`, `GET /sessions/:id`, `PATCH /sessions/:id/status`
- `POST /sessions/:sessionId/feedback`, `GET /feedback/mine`
- `GET /admin/feedback`, `PATCH /admin/feedback/:id/moderation` (Admin), `PATCH /admin/feedback/:id/review` (Head LMI)
- `GET /notifications`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all`

Public availability queries are limited to a maximum 90-day range and 100 results. SQL excludes slots tied to unpublished/invalid academic periods, slots overlapping active bookings, past slots, and slots belonging to inactive or non-public counselors before applying the result limit. Public feedback is restricted to `shown` records belonging to active counselors with public profiles. Public counselor profiles must be explicitly published and belong to active accounts whose role is `counselor`. Registration always creates a client account; role selection is not accepted from request data. If profile initialization fails after Auth sign-up, the backend attempts to delete the newly created Auth user. A database unique index remains authoritative for identity-code uniqueness. Audit writes are best-effort and database-returned errors are logged using safe metadata only.

## Scope and limitations

Booking lifecycle, session status, feedback submission/moderation, notification read-state, counselor availability, admin account/period management, reporting, and hero motivational sentence endpoints are included in the current backend source. WhatsApp delivery worker, informed consent, signatures, intake forms, and counseling notes remain outside the current scope. All SQL migrations under `../supabase/migrations/` must be applied in timestamp order to the intended Supabase project before the related endpoints can work against the database.

## Database safety

The SQL migrations are versioned under `../supabase/migrations/`. Check the project reference and `supabase migration list` before any migration push. No informed-consent schema is created because the official document and workflow are not available yet.

## Additional API coverage (Tahap 7)

Admin-only endpoints:

- `GET /admin/accounts?role=&status=&search=&limit=` and `GET /admin/accounts/:id` — list/search/detail account profiles; email is retrieved from Supabase Auth.
- `POST /admin/accounts` — create an Auth account and application profile. Public registration still cannot choose privileged roles.
- `PATCH /admin/accounts/:id` — update account profile, role or account status. `DELETE /admin/accounts/:id` is a soft deactivation (`account_status = disabled`), not a destructive Auth-user deletion.
- `PATCH /admin/counselors/:id/publication` — publish/unpublish a counselor profile. Publishing requires an active counselor and a non-empty public name.
- `GET /admin/periods`, `POST /admin/periods`, `PATCH /admin/periods/:id`, `DELETE /admin/periods/:id` — academic-period CRUD. A period with attached availability slots cannot be deleted.
- `GET /admin/dashboard`, `GET /admin/activity`, `GET /admin/counseling`, `GET /admin/reports` — summary metrics, recent domain activity, booking/session records and aggregate reports.
- `GET /admin/feedback/statistics`, `GET /admin/feedback/:id` — moderation statistics and feedback detail. Existing moderation and review status actions remain separate.

Head LMI endpoints:

- `GET /head-lmi/dashboard`, `GET /head-lmi/reports` — aggregate dashboard and reporting views. Existing Head LMI review status endpoint remains `PATCH /admin/feedback/:id/review`.

Counselor endpoints:

- `GET /counselor/profile`, `PATCH /counselor/profile` — read/update public counselor profile fields. `is_public` remains admin-controlled.
- `GET /counselor/availability?status=`, `POST /counselor/availability`, `PATCH /counselor/availability/:id`, `DELETE /counselor/availability/:id` — manage own schedule. Writes call database RPCs that serialize per-counselor changes, reject overlaps, and refuse to change/cancel slots with active bookings. Delete means mark the slot `cancelled`.

All admin, Head LMI and counselor endpoints enforce bearer authentication and application-role authorization on the server. The backend uses its server-only Supabase key; it is never sent to the browser. The counselor availability migration is `20261028130000_sicare_admin_availability_management.sql`. The hero motivational sentence migration is `20261029100000_sicare_hero_motivations.sql` and must also be applied before hero motivation CRUD works.

## Explicitly out of scope for this endpoint stage

- WhatsApp delivery and scheduled reminder worker are intentionally excluded. `whatsapp_outbox` remains only a queue schema.
- Hero motivational sentences are stored in `hero_motivations` and managed through `/api/v1/admin/hero-motivations`; the public page reads active sentences from `/api/v1/public/hero-motivations`. The model has no paragraph or `created_by` field.
- Mood tracker assessment is not persisted server-side because the current database/SOP snapshot does not define a mood-history entity or retention rules.
- Informed-consent signatures, intake answers and counseling notes remain unimplemented until the official document and data-handling rules are available.
- `GET /admin/activity` currently synthesizes a recent activity feed from bookings, sessions and feedback updates. It is not a full audit log; only allowlisted audit events are persisted separately.

## Verification status

- `node --check` passed for all backend JavaScript files.
- Isolated tests for audit behavior, migration contracts and domain RPC error mapping passed in the patch environment.
- Full `npm test` and `npm audit` could not be completed in the patch environment because package installation was blocked by unavailable npm registry/cache. Run `npm ci`, `npm run check`, `npm test`, and `npm audit` from `be/` on the development machine before applying the migration.
- No live Supabase integration test was run here. Review the target project and migration history before applying any pending migration.
