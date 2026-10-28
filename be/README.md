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
- `POST /auth/login`

Authenticated endpoints:

- `GET /auth/me`
- `POST /auth/logout`
- `GET /profile`
- `PATCH /profile` (only low-risk profile fields)

Public availability queries are limited to a maximum 90-day range and 100 results. Public counselor profiles must be explicitly published and belong to active accounts whose role is `counselor`. Registration always creates a client account; role selection is not accepted from request data.

## Not implemented in this patch

Booking lifecycle endpoints, counselor availability management, session status changes, notification read-state endpoints, feedback submission/moderation, admin account/period management, WhatsApp delivery, informed consent, signatures, intake forms, and counseling notes are outside this patch's scope. The existing database migration defines some domain tables, but table existence does not mean these API workflows are implemented.

## Database safety

The core migration is present under `../supabase/migrations/`, but it has not been verified against a remote Supabase project by this patch. Check the project reference and `supabase migration list` before any migration push. No informed-consent schema is created because the official document and workflow are not available yet.
