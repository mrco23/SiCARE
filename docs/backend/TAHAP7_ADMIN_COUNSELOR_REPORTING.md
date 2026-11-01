# SiCARE Backend — Tahap 7: Endpoint Admin, Konselor, dan Laporan

Status: source patch prepared; requires local verification and application of the fourth migration. This document does not claim live Supabase integration has passed.

## Endpoint baru

### Admin

- `GET /api/v1/admin/accounts?role=&status=&search=&limit=`
- `GET /api/v1/admin/accounts/:id`
- `POST /api/v1/admin/accounts`
- `PATCH /api/v1/admin/accounts/:id`
- `DELETE /api/v1/admin/accounts/:id` (soft disable, not hard delete)
- `PATCH /api/v1/admin/counselors/:id/publication`
- `GET /api/v1/admin/periods`
- `POST /api/v1/admin/periods`
- `PATCH /api/v1/admin/periods/:id`
- `DELETE /api/v1/admin/periods/:id`
- `GET /api/v1/admin/dashboard`
- `GET /api/v1/admin/activity`
- `GET /api/v1/admin/counseling`
- `GET /api/v1/admin/reports`
- `GET /api/v1/admin/feedback/statistics`
- `GET /api/v1/admin/feedback/:id`

### Head LMI

- `GET /api/v1/head-lmi/dashboard`
- `GET /api/v1/head-lmi/reports`
- Feedback review stays at `PATCH /api/v1/admin/feedback/:id/review` and is Head LMI-only.

### Konselor

- `GET /api/v1/counselor/profile`
- `PATCH /api/v1/counselor/profile`
- `GET /api/v1/feedback/counselor?rating=&limit=` (only feedback already approved for public display)
- `GET /api/v1/counselor/availability?status=`
- `POST /api/v1/counselor/availability`
- `PATCH /api/v1/counselor/availability/:id`
- `DELETE /api/v1/counselor/availability/:id` (marks slot cancelled)

## Important rules

- Account creation uses Supabase Auth Admin on the server. Public registration remains client-only; it cannot assign a role.
- Admin account deactivation is soft. The endpoint prevents an admin from deactivating themselves and prevents removal/demotion of the last active admin.
- Counselor publication is controlled by Admin. Counselors cannot set `is_public` through their profile endpoint.
- Academic period deletion is rejected while availability slots still reference that period.
- Schedule creation/update/cancel uses SQL `SECURITY DEFINER` functions executable only by `service_role`. Schedule changes are serialized per counselor and overlapping active bookings/availability are rejected.
- Feedback moderation (`pending`, `shown`, `disabled`) is separate from Head LMI review (`new`, `reviewed`, `resolved`). Public feedback must still be `shown` and tied to an eligible active/public counselor.
- No WhatsApp sending endpoints/worker are included in this stage.
- **Pembaruan setelah audit:** source code menyediakan CRUD kalimat motivasi Hero pada `/api/v1/admin/hero-motivations` dan endpoint publik `/api/v1/public/hero-motivations`. Migrasi `20261029100000_sicare_hero_motivations.sql` kini tersedia pada snapshot kerja dan telah diperiksa secara statis terhadap route, validasi, serta tes. Migrasi belum diverifikasi atau diterapkan pada database remote; fitur belum boleh dianggap siap di lingkungan tersebut.
- Mood tracking, informed consent, signature storage, intake responses and counseling notes are not persisted by this patch because the current schema/SOP snapshot does not define their authoritative data model and retention/access rules.

## Migration

Apply `supabase/migrations/20261028130000_sicare_admin_availability_management.sql` after the three existing migrations. It adds the server-only RPCs `sicare_save_availability_slot` and `sicare_cancel_availability_slot`.

## Validation

The JavaScript syntax check passed. Isolated migration, audit and domain-RPC tests passed. Full `npm test` and `npm audit` remain unverified in this patch environment because npm package installation could not access the registry/cache. Run all backend checks locally, then test with dedicated accounts for client, counselor, admin and Head LMI against a non-production Supabase project.
