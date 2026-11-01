# SiCARE | STAGE 1.4a: Complete Frontend-Backend Integration Audit

**Audit Date:** 30 October 2026
**Branch Audited:** `development` (production target: `main`)
**Audit Type:** Strictly Read-Only Static & Architectural Integration Audit (Zero Application Code Changes)
**Scope:** Full-stack frontend (`fe/`) to backend (`be/`) and database (`supabase/`) integration coverage across Public, Auth, Client, Counselor, Admin, and Head LMI workspaces.

---

## 1. Executive Summary

This Stage 1.4a audit provides a ground-truth, source-verified inventory of all backend endpoints, frontend API wrappers, role-by-role UI pages, business workflows, mock data dependencies, UI state gaps, and deployment connectivity constraints in the SiCARE monorepo.

### Key Headline Findings

1. **Wrapper vs. UI Invocation Gap (98.28% Wrapped vs. 39.66% Invoked by UI):**
   - The backend defines **58 route handlers under `/api/v1/*`** (plus **1 root `GET /` metadata handler** in `be/app.js`, totaling 59 Express handlers).
   - Following Batch 1.2, **57 of 58 `/api/v1/*` endpoints (98.28%)** have typed frontend functions across `AuthProvider.tsx`, `publicApi.ts`, `sicareApi.ts`, `counselorApi.ts`, `adminApi.ts`, and `reportingApi.ts` (only `GET /api/v1/health` is operational-only).
   - However, **only 23 of 58 `/api/v1/*` endpoints (39.66%)**—or **23 of 57 UI-applicable endpoints (40.35%)**—are actually invoked by frontend pages or shared components:
     - **18 endpoints (31.03%)** are **Fully Integrated** end-to-end in UI.
     - **5 endpoints (8.62%)** are **Partially Integrated** (invoked only by the Client side while Counselor/Admin consumers remain on mock/Zustand state, or missing clinical intake persistence).
     - **34 endpoints (58.62%)** have **Typed Wrappers Only (`0` UI callers)** because the corresponding Client Profile, Counselor, Admin, and Head LMI pages still read and mutate `fe/src/data/mock/*`, Zustand stores (`bookingStore`, `feedbackStore`, `notificationStore`), or `localStorage`/`sessionStorage`.
     - **1 endpoint (1.72%)** (`GET /api/v1/health`, plus root `GET /`) is **Operational Only**.

2. **Severe Asymmetry Across Application Roles:**
   - **Public & Auth (`8/8` pages = 100% route readiness; `9/9` endpoints called):** `HomePage`, `CounselorPage`, `FeedbackPage`, `Login`, and `Register` are live-integrated (`AboutPage` and `PanduanPage` are intentionally static informational pages; `MoodTrackerPage` is an intentional browser-only interactive widget without a backend domain).
   - **Client (`4/6` pages live-connected = 66.67%):** `KlienBerandaPage`, `KlienPesananPage`, `KlienAktivitasPage`, and `KlienRiwayatPage` call live backend endpoints. However, `KlienKonselorPage` (`/klien/konselor`) still reads mock `CLIENT_DIRECTORY_COUNSELORS` instead of `getPublicCounselors()`, and `KlienPengaturanPage` (`/klien/pengaturan`) uses hardcoded account data (`Yusli Ngongano`) instead of `sicareApi.getProfile()` / `updateProfile()` / `setWhatsAppConsent()`. Furthermore, `KlienAktivitasPage` and `KlienRiwayatPage` hardcode `"Konselor"` instead of resolving `counselor_id` names.
   - **Counselor (`0/7` pages live-connected = 0.00%):** All seven counselor pages (`KonselorBerandaPage`, `KonselorPermintaanPage`, `KonselorAktivitasPage`, `KonselorRiwayatPage`, `KonselorJadwalPage`, `KonselorFeedbackPage`, `KonselorPengaturanPage`) run 100% on mock fixtures and in-memory Zustand stores. Only the layout-level `NotificationBell` and `SignOutPanel` talk to the backend.
   - **Admin (`1/8` pages live-connected = 12.50%):** Only `AdminPengaturanPage` is partially live (for Hero Motivation CRUD via `adminApi`). Its profile/password form uses `localStorage`, `AdminAktivitasPage` is a 4-line stub (`<div>ActivityPage</div>`), and `AdminBerandaPage`, `AdminAkunPage`, `AdminPeriodePage`, `AdminKonselingPage`, `AdminFeedbackPage`, and `AdminLaporanPage` are 100% mock/Zustand/`localStorage`.
   - **Head LMI (`0/4` pages live-connected = 0.00%):** All four Head LMI pages (`KepalaLMIBerandaPage`, `KepalaLMILaporanPage`, `KepalaLMIFeedbackPage`, `KepalaLMIPengaturanPage`) run 100% on mock data and `localStorage` periods.

3. **Critical API Contract & UI Mismatches Must Be Reconciled During Page Wiring:**
   - **Counselor Booking Confirmation (`PATCH /api/v1/bookings/:id/status`):** Backend requires `session_format: "online" | "offline"` when `status === "confirmed"`, and requires a non-empty `reason` when `status` is `"rejected"` or `"reschedule_requested"`. `KonselorPermintaanPage` and `KonselorBerandaPage` currently have no `session_format` input, no `"reschedule_requested"` action button, and no rejection `reason` input.
   - **Counselor Schedule (`POST/PATCH /api/v1/counselor/availability`):** Backend stores concrete UTC timestamp ranges (`starts_at`, `ends_at`) tied to an `academic_period_id` UUID. `KonselorJadwalPage` operates on local date strings and minute offsets (`start: number`) without period UUIDs or slot UUIDs.
   - **Profile Settings (`PATCH /api/v1/profile` & `PATCH /api/v1/counselor/profile`):** Backend `/api/v1/profile` only accepts `full_name` and `phone_e164`. Client, Counselor, Admin, and Head LMI settings pages expose unsupported fields (demographic fields, `educations[]`, `services`, base64 data-URL photos exceeding the 1,000-char `photo_path` limit, and mock password change forms).

4. **Deployment Connectivity Blocker (Vercel Frontend vs. Local Backend):**
   - A deployed Vercel HTTPS frontend cannot reach a backend running only on `http://127.0.0.1:3000` for external users (loopback resolves to the visitor's own device, browsers block mixed content / private network requests, and `be/src/config/env.js` defaults `FRONTEND_ORIGINS` to `http://localhost:5173,http://127.0.0.1:5173`).

---

## 2. Current Repository State

### 2.1 Git Branch & Working Tree Status

- **Current Branch:** `development` (verified via `git branch --show-current`).
- **Tracked Modified Files (34 files):** Existing work from Stage 1.1–1.3c (`.gitignore`, `README.md`, `be/app.js`, `be/package.json`, `be/src/config/supabase.js`, `be/src/routes/domain.routes.js`, `be/src/routes/feedback.routes.js`, `be/test/health.test.js`, `be/test/heroMotivations.test.js`, `fe/src/components/shared/NotificationBell.tsx`, `fe/src/lib/api.ts`, `fe/src/lib/publicApi.ts`, `fe/src/lib/sicareApi.ts`, and public/client/admin pages).
- **Untracked Files:** `AGENTS.md`, `docs/`, `be/scripts/verify-live-ownership.js`, `be/src/routes/{admin,counselor,reporting}.routes.js`, `be/test/ownershipGuards.test.js`, `fe/src/lib/{adminApi,apiQuery,counselorApi,reportingApi}.ts`, `fe/src/types/api.ts`, and `supabase/migrations/20261028120000_*` through `20261029100000_*`.
- **Stage 1.4a Hygiene Guarantee:** Zero application source files in `fe/`, `be/`, or `supabase/` were modified during this audit.

### 2.2 Validation Command Results

| Check | Command | Directory | Status | Factual Output / Notes |
|---|---|---|---|---|
| Backend syntax check | `npm run check` | `be/` | **PASS** | All 21 backend JS files (including `app.js`, 10 route files, middlewares, services, and `scripts/verify-live-ownership.js`) passed `node --check` with 0 errors. |
| Backend unit & ownership tests (sandboxed) | `npm test` | `be/` | **41 PASS / 20 FAIL (Sandbox Loopback)** | `ownershipGuards.test.js` (**20/20 PASS**), `heroMotivations.test.js` (**5/5 PASS**), and non-network tests pass; `health.test.js` HTTP listener tests fail in sandbox due to Windows sandbox loopback restriction (`connect EACCES 127.0.0.1`). |
| Backend full test suite (loopback enabled) | `npm test` | `be/` | **PASS (61/61)** | **61 PASS, 0 FAIL, 0 SKIPPED** in `744.59ms` (`health.test.js`, `heroMotivations.test.js`, `ownershipGuards.test.js`). |
| Frontend production build | `npm run build` | `fe/` | **PASS** | `tsc -b && vite build` succeeded in `9.25s`. PWA service worker (`dist/sw.js`) generated. Non-blocking Vite chunk size warning on main JS bundle (`1,302.15 kB` raw / `364.94 kB` gzip). |
| Frontend ESLint | `npm run lint` | `fe/` | **PASS** | `eslint .` exited with code `0` (0 errors, 0 warnings). |

---

## 3. Backend Endpoint Inventory

### 3.1 Classification Categories

Every backend route handler is classified into one of the following categories required by Section 5.2:

- **Category A (`PUBLIC_INTEGRATED`):** Public endpoint, integrated with frontend.
- **Category B (`PUBLIC_NOT_INTEGRATED`):** Public endpoint, not integrated with frontend.
- **Category C (`AUTH_FULLY_INTEGRATED`):** Authenticated endpoint, fully integrated with frontend.
- **Category D (`AUTH_PARTIALLY_INTEGRATED`):** Authenticated endpoint, partially integrated with frontend (e.g., called by one role or missing sub-workflows).
- **Category E (`WRAPPER_ONLY_NO_UI`):** Authenticated endpoint with frontend API wrapper, but no page/component caller.
- **Category F (`BACKEND_ONLY_NO_WRAPPER`):** Backend-only endpoint with no frontend wrapper and no UI caller.
- **Category G (`OPS_HEALTH_ONLY`):** Operational/health/admin utility endpoint not intended for UI consumption.
- **Category H (`DEPRECATED_OR_DUPLICATE`):** Deprecated, duplicate, or unused endpoint.

### 3.2 Complete Inventory of Backend Route Handlers (58 `/api/v1/*` + 1 Root Handler)

#### Root Service Metadata (`be/app.js`)

| # | Method & Path | Route File | Auth & Roles | Params / Query / Body | Response Structure (`data`) | DB Tables / RPCs | Business Purpose | Category |
|---:|---|---|---|---|---|---|---|---|
| 0 | `GET /` | `be/app.js` | Public (`none`) | None | `{ service: "SiCARE Backend API", status: "running", health: "/api/v1/health" }` | None | Root API liveness banner | **G (`OPS_HEALTH_ONLY`)** |

#### 1. Health (`be/src/routes/health.routes.js` — 1 handler)

| # | Method & Path | Route File | Auth & Roles | Params / Query / Body | Response Structure (`data`) | DB Tables / RPCs | Business Purpose | Category |
|---:|---|---|---|---|---|---|---|---|
| 1 | `GET /api/v1/health` | `health.routes.js` | Public (`none`) | None | `{ status: "ok", environment, timestamp, supabase: { configured, reachable, detail? } }` | `public.academic_periods` (`head: true` probe) | Operational health & Supabase connectivity check | **G (`OPS_HEALTH_ONLY`)** |

#### 2. Authentication (`be/src/routes/auth.routes.js` — 4 handlers)

| # | Method & Path | Route File | Auth & Roles | Params / Query / Body | Response Structure (`data`) | DB Tables / RPCs | Business Purpose | Category |
|---:|---|---|---|---|---|---|---|---|
| 2 | `POST /api/v1/auth/register` | `auth.routes.js` | Public (`none`) | Body (`registerSchema`): `email`, `password` (8–72), `full_name` (2–120), `member_category` (`student\|lecturer\|staff`), `identity_code?`, `phone_e164?`, `whatsapp_opt_in?` | `201`: `{ user: { id, email }, profile: ProfileDto, session: { access_token, refresh_token, expires_at, token_type } \| null }` | `auth.users`, `public.profiles` (always `app_role = 'client'`) | Self-service client registration | **C (`AUTH_FULLY_INTEGRATED`)** |
| 3 | `POST /api/v1/auth/login` | `auth.routes.js` | Public (`none`) | Body (`loginSchema`): `email`, `password` | `200`: `{ user: { id, email }, profile: ProfileDto, session: { access_token, refresh_token, expires_at, token_type } }` | `auth.users`, `public.profiles`, `public.audit_logs` | Authenticate user, check `account_status === 'active'`, return session & profile | **C (`AUTH_FULLY_INTEGRATED`)** |
| 4 | `GET /api/v1/auth/me` | `auth.routes.js` | `requireAuth` (`any active role`) | None | `200`: `{ user: { id, email }, profile: ProfileDto }` | `public.profiles` | Restore/verify authenticated user & canonical server role | **C (`AUTH_FULLY_INTEGRATED`)** |
| 5 | `POST /api/v1/auth/logout` | `auth.routes.js` | `requireAuth` (`any active role`) | None | `200`: `{ signed_out: true }` | `public.audit_logs` | Record `auth.logout` audit event on sign-out | **C (`AUTH_FULLY_INTEGRATED`)** |

#### 3. Public Domain & Authenticated Profile (`be/src/routes/domain.routes.js` — 8 handlers)

| # | Method & Path | Route File | Auth & Roles | Params / Query / Body | Response Structure (`data`) | DB Tables / RPCs | Business Purpose | Category |
|---:|---|---|---|---|---|---|---|---|
| 6 | `GET /api/v1/public/hero-motivations` | `domain.routes.js` | Public (`none`) | None | `{ hero_motivations: PublicHeroMotivation[] }` | `public.hero_motivations` (`is_active = true`) | Active motivational quotes for public landing page | **A (`PUBLIC_INTEGRATED`)** |
| 7 | `GET /api/v1/public/counselors` | `domain.routes.js` | Public (`none`) | None | `{ counselors: PublicCounselor[] }` | `public.counselor_profiles`, `public.profiles` (`is_public = true`, active counselor) | Public & client directory of active published counselors | **A (`PUBLIC_INTEGRATED`)** |
| 8 | `GET /api/v1/public/periods` | `domain.routes.js` | Public (`none`) | None | `{ periods: PublicAcademicPeriod[] }` | `public.academic_periods` (`is_published = true`) | Published academic periods for public display | **A (`PUBLIC_INTEGRATED`)** |
| 9 | `GET /api/v1/public/availability` | `domain.routes.js` | Public (`none`) | Query (`publicAvailabilityQuerySchema`): `counselor_id?` (UUID), `from?` (ISO), `to?` (ISO) | `{ availability: PublicAvailabilitySlot[] }` | `public.counselor_availability_slots`, `public.counselor_profiles`, `public.profiles`, `public.academic_periods`, `public.counseling_bookings` | Public bookable slots with dynamic `status: "available" \| "booked"` | **A (`PUBLIC_INTEGRATED`)** |
| 10 | `GET /api/v1/public/feedback` | `domain.routes.js` | Public (`none`) | None | `{ feedback: PublicFeedback[] }` | `public.session_feedback`, `public.counselor_profiles`, `public.profiles` | Approved (`moderation_status = 'shown'`) anonymous public testimonials | **A (`PUBLIC_INTEGRATED`)** |
| 11 | `GET /api/v1/profile` | `domain.routes.js` | `requireAuth` (`any`) | None | `{ profile: ProfileDto }` | `public.profiles` | Read authenticated user's own profile | **E (`WRAPPER_ONLY_NO_UI`)** |
| 12 | `PATCH /api/v1/profile` | `domain.routes.js` | `requireAuth` (`any`) | Body (`profilePatchSchema`): `full_name?`, `phone_e164?` (at least one required; `.strict()`) | `{ profile: ProfileDto }` | `public.profiles`, `public.audit_logs` | Update own `full_name` and/or `phone_e164` | **E (`WRAPPER_ONLY_NO_UI`)** |
| 13 | `PATCH /api/v1/profile/whatsapp-consent` | `domain.routes.js` | `requireAuth` (`any`) | Body (`whatsappConsentSchema`): `whatsapp_opt_in` (boolean) | `{ profile: ProfileDto }` | `public.profiles`, `public.audit_logs` | Opt-in or opt-out of WhatsApp notifications (requires `phone_e164` when `true`) | **E (`WRAPPER_ONLY_NO_UI`)** |

#### 4. Bookings (`be/src/routes/booking.routes.js` — 5 handlers)

| # | Method & Path | Route File | Auth & Roles | Params / Query / Body | Response Structure (`data`) | DB Tables / RPCs | Business Purpose | Category |
|---:|---|---|---|---|---|---|---|---|
| 14 | `GET /api/v1/bookings` | `booking.routes.js` | `requireAuth`, `requireRole("client", "counselor")` | Query: `status?` (`BookingStatus`), `limit` (1–100, default 50) | `{ bookings: BookingRecordApi[] }` | `public.counseling_bookings` (scoped by `client_id` or `counselor_id`) | List bookings for authenticated client or counselor | **D (`AUTH_PARTIALLY_INTEGRATED`)** |
| 15 | `POST /api/v1/bookings` | `booking.routes.js` | `requireAuth`, `requireRole("client")` | Body (`createBookingSchema`): `counselor_id` (UUID), `availability_slot_id` (UUID), `academic_period_id?` (UUID), `booking_type` (`individual\|group`), `participant_count` (1–10), `client_Checkin_summary?` (max 500) | `201`: `{ booking: BookingRecordApi }` | RPC `public.sicare_create_booking` | Create booking & notify counselor (`booking_created`) | **D (`AUTH_PARTIALLY_INTEGRATED`)** |
| 16 | `PATCH /api/v1/bookings/:id/reschedule` | `booking.routes.js` | `requireAuth`, `requireRole("client")` | Params: `id` (UUID). Body: `availability_slot_id` (UUID), `reason?` (max 500) | `{ booking: BookingRecordApi }` | RPC `public.sicare_reschedule_booking` | Client selects replacement slot when booking is `reschedule_requested` | **C (`AUTH_FULLY_INTEGRATED`)** |
| 17 | `GET /api/v1/bookings/:id` | `booking.routes.js` | `requireAuth`, `requireRole("client", "counselor")` | Params: `id` (UUID) | `{ booking: BookingRecordApi }` | `public.counseling_bookings` | Read single booking detail owned by client or counselor | **E (`WRAPPER_ONLY_NO_UI`)** |
| 18 | `PATCH /api/v1/bookings/:id/status` | `booking.routes.js` | `requireAuth`, `requireRole("client", "counselor")` | Params: `id` (UUID). Body (`transitionBookingSchema`): `status` (`confirmed\|rejected\|reschedule_requested\|cancelled`), `reason?`, `session_format?` (`online\|offline`), `room?`, `meeting_url?` | `{ booking: BookingRecordApi, session: SessionRecordApi \| null }` | RPC `public.sicare_transition_booking` | Confirm (creates session), reject, request reschedule (counselor), or cancel (client/counselor) | **D (`AUTH_PARTIALLY_INTEGRATED`)** |

#### 5. Counseling Sessions (`be/src/routes/session.routes.js` — 3 handlers)

| # | Method & Path | Route File | Auth & Roles | Params / Query / Body | Response Structure (`data`) | DB Tables / RPCs | Business Purpose | Category |
|---:|---|---|---|---|---|---|---|---|
| 19 | `GET /api/v1/sessions` | `session.routes.js` | `requireAuth`, `requireRole("client", "counselor")` | Query: `status?` (`scheduled\|ongoing\|completed\|cancelled`), `limit` (1–100, default 50) | `{ sessions: SessionRecordApi[] }` | `public.counseling_sessions` | List counseling sessions for client or counselor | **D (`AUTH_PARTIALLY_INTEGRATED`)** |
| 20 | `GET /api/v1/sessions/:id` | `session.routes.js` | `requireAuth`, `requireRole("client", "counselor")` | Params: `id` (UUID) | `{ session: SessionDetailRecordApi }` (includes `academic_period_id`, `started_at`, `ended_at`, `updated_at`) | `public.counseling_sessions` | Read single session detail owned by client or counselor | **E (`WRAPPER_ONLY_NO_UI`)** |
| 21 | `PATCH /api/v1/sessions/:id/status` | `session.routes.js` | `requireAuth`, `requireRole("counselor")` | Params: `id` (UUID). Body (`sessionStatusSchema`): `status` (`ongoing\|completed\|cancelled`) | `{ session: SessionRecordApi }` | RPC `public.sicare_transition_session` | Counselor transitions session (`scheduled -> ongoing -> completed` or `cancelled`) | **E (`WRAPPER_ONLY_NO_UI`)** |

#### 6. Session Feedback (`be/src/routes/feedback.routes.js` — 8 handlers)

| # | Method & Path | Route File | Auth & Roles | Params / Query / Body | Response Structure (`data`) | DB Tables / RPCs | Business Purpose | Category |
|---:|---|---|---|---|---|---|---|---|
| 22 | `POST /api/v1/sessions/:sessionId/feedback` | `feedback.routes.js` | `requireAuth`, `requireRole("client")` | Params: `sessionId` (UUID). Body: `rating` (int 1–5), `comment?` (max 1000), `is_anonymous` (bool, default `true`) | `201`: `{ feedback: FeedbackRecordApi }` | RPC `public.sicare_submit_session_feedback` | Client submits post-session rating/comment for a `completed` session | **D (`AUTH_PARTIALLY_INTEGRATED`)** |
| 23 | `GET /api/v1/feedback/counselor` | `feedback.routes.js` | `requireAuth`, `requireRole("counselor")` | Query: `limit` (1–100, default 50) | `{ feedback: CounselorFeedbackRecordApi[] }` (strips `client_id`, `is_anonymous`, `moderated_by`, `moderated_at`) | `public.session_feedback` (`counselor_id = auth`, `moderation_status = 'shown'`) | Counselor reads approved anonymous feedback for their sessions | **E (`WRAPPER_ONLY_NO_UI`)** |
| 24 | `GET /api/v1/feedback/mine` | `feedback.routes.js` | `requireAuth`, `requireRole("client")` | Query: `limit` (1–100, default 50) | `{ feedback: FeedbackRecordApi[] }` | `public.session_feedback` (`client_id = auth`) | Client reads their own submitted feedback records | **C (`AUTH_FULLY_INTEGRATED`)** |
| 25 | `GET /api/v1/admin/feedback/statistics` | `feedback.routes.js` | `requireAuth`, `requireRole("admin", "head_lmi")` | Query: `academic_period_id?` (UUID), `counselor_id?` (UUID) | `{ total, average_rating, moderation_counts: { pending, shown, disabled }, review_counts: { new, reviewed, resolved }, rating_distribution: { 1..5 } }` | `public.session_feedback`, `public.counseling_sessions` | Aggregate feedback KPIs for Admin & Head LMI | **E (`WRAPPER_ONLY_NO_UI`)** |
| 26 | `GET /api/v1/admin/feedback/:id` | `feedback.routes.js` | `requireAuth`, `requireRole("admin", "head_lmi")` | Params: `id` (UUID) | `{ feedback: AdminFeedbackRecordApi }` (never exposes `client_id`) | `public.session_feedback` | Read single feedback record for moderation/review | **E (`WRAPPER_ONLY_NO_UI`)** |
| 27 | `GET /api/v1/admin/feedback` | `feedback.routes.js` | `requireAuth`, `requireRole("admin", "head_lmi")` | Query: `moderation_status?`, `review_status?`, `counselor_id?`, `academic_period_id?`, `rating?`, `limit` (1–100) | `{ feedback: AdminFeedbackRecordApi[] }` | `public.session_feedback`, `public.counseling_sessions` | List feedback for Admin moderation or Head LMI evaluation | **E (`WRAPPER_ONLY_NO_UI`)** |
| 28 | `PATCH /api/v1/admin/feedback/:id/moderation` | `feedback.routes.js` | `requireAuth`, `requireRole("admin")` | Params: `id` (UUID). Body: `moderation_status` (`pending\|shown\|disabled`), `disabled_reason?` (required if `disabled`) | `{ feedback: AdminFeedbackRecordApi }` | RPC `public.sicare_moderate_feedback` | Admin moderates feedback visibility & notifies client | **E (`WRAPPER_ONLY_NO_UI`)** |
| 29 | `PATCH /api/v1/admin/feedback/:id/review` | `feedback.routes.js` | `requireAuth`, `requireRole("head_lmi")` | Params: `id` (UUID). Body: `review_status` (`new\|reviewed\|resolved`) | `{ feedback: AdminFeedbackRecordApi }` | RPC `public.sicare_review_feedback` | Head LMI updates executive review status of feedback | **E (`WRAPPER_ONLY_NO_UI`)** |

#### 7. Notifications (`be/src/routes/notification.routes.js` — 3 handlers)

| # | Method & Path | Route File | Auth & Roles | Params / Query / Body | Response Structure (`data`) | DB Tables / RPCs | Business Purpose | Category |
|---:|---|---|---|---|---|---|---|---|
| 30 | `GET /api/v1/notifications` | `notification.routes.js` | `requireAuth` (`any`) | Query: `unread_only` (`true\|false`), `limit` (1–100, default 30) | `{ notifications: NotificationRecordApi[], unread_count: number }` | `public.notifications` (`recipient_user_id = auth`) | List user's in-app notifications & unread badge count | **C (`AUTH_FULLY_INTEGRATED`)** |
| 31 | `PATCH /api/v1/notifications/read-all` | `notification.routes.js` | `requireAuth` (`any`) | None | `{ updated_count: number, read_at: string }` | `public.notifications` | Mark all unread notifications for current user as read | **C (`AUTH_FULLY_INTEGRATED`)** |
| 32 | `PATCH /api/v1/notifications/:id/read` | `notification.routes.js` | `requireAuth` (`any`) | Params: `id` (UUID) | `{ notification: { id, read_at } }` | `public.notifications` | Mark single notification owned by current user as read | **C (`AUTH_FULLY_INTEGRATED`)** |

#### 8. Counselor Self-Service (`be/src/routes/counselor.routes.js` — 6 handlers)

| # | Method & Path | Route File | Auth & Roles | Params / Query / Body | Response Structure (`data`) | DB Tables / RPCs | Business Purpose | Category |
|---:|---|---|---|---|---|---|---|---|
| 33 | `GET /api/v1/counselor/profile` | `counselor.routes.js` | `requireAuth`, `requireRole("counselor")` | None | `{ counselor_profile: CounselorProfileRecord \| null }` | `public.counselor_profiles` (`profile_id = auth`) | Read counselor's own professional profile | **E (`WRAPPER_ONLY_NO_UI`)** |
| 34 | `PATCH /api/v1/counselor/profile` | `counselor.routes.js` | `requireAuth`, `requireRole("counselor")` | Body: `public_name?`, `headline?`, `bio?`, `specialties?` (string[], max 20), `years_experience?` (0–80), `photo_path?` (max 1000) | `{ counselor_profile: CounselorProfileRecord }` | `public.counselor_profiles`, `public.audit_logs` | Upsert counselor's own professional profile (`is_public` preserved) | **E (`WRAPPER_ONLY_NO_UI`)** |
| 35 | `GET /api/v1/counselor/availability` | `counselor.routes.js` | `requireAuth`, `requireRole("counselor")` | Query: `academic_period_id?` (UUID), `status?`, `from?`, `to?`, `limit` (1–200) | `{ availability: CounselorAvailabilitySlotRecord[] }` | `public.counselor_availability_slots` (`counselor_id = auth`) | List counselor's own availability slots | **E (`WRAPPER_ONLY_NO_UI`)** |
| 36 | `POST /api/v1/counselor/availability` | `counselor.routes.js` | `requireAuth`, `requireRole("counselor")` | Body: `academic_period_id?` (UUID), `starts_at` (ISO), `ends_at` (ISO), `session_format` (`online\|offline\|hybrid`), `capacity` (1–10), `status` (`available\|blocked\|cancelled`) | `201`: `{ availability_slot: CounselorAvailabilitySlotRecord }` | RPC `public.sicare_save_availability_slot` | Create counselor availability slot with overlap/period validation | **E (`WRAPPER_ONLY_NO_UI`)** |
| 37 | `PATCH /api/v1/counselor/availability/:id` | `counselor.routes.js` | `requireAuth`, `requireRole("counselor")` | Params: `id` (UUID). Body: partial of `createAvailabilitySchema` | `{ availability_slot: CounselorAvailabilitySlotRecord }` | `public.counselor_availability_slots`, RPC `sicare_save_availability_slot` | Update counselor availability slot (blocks changes if active booking exists) | **E (`WRAPPER_ONLY_NO_UI`)** |
| 38 | `DELETE /api/v1/counselor/availability/:id` | `counselor.routes.js` | `requireAuth`, `requireRole("counselor")` | Params: `id` (UUID) | `{ availability_slot: CounselorAvailabilitySlotRecord }` (`status: "cancelled"`) | `public.counselor_availability_slots`, `public.counseling_bookings`, `public.audit_logs` | Soft-cancel availability slot if no active booking references it | **E (`WRAPPER_ONLY_NO_UI`)** |

#### 9. Admin Governance & Master Data (`be/src/routes/admin.routes.js` — 16 handlers)

| # | Method & Path | Route File | Auth & Roles | Params / Query / Body | Response Structure (`data`) | DB Tables / RPCs | Business Purpose | Category |
|---:|---|---|---|---|---|---|---|---|
| 39 | `GET /api/v1/admin/accounts` | `admin.routes.js` | `requireAuth`, `requireRole("admin")` | Query: `role?`, `member_category?`, `account_status?`, `q?`, `limit` (1–200) | `{ accounts: AdminAccountRecord[] }` (includes nested `counselor_profile`) | `public.profiles`, `public.counselor_profiles` | List & filter user accounts | **E (`WRAPPER_ONLY_NO_UI`)** |
| 40 | `GET /api/v1/admin/accounts/:id` | `admin.routes.js` | `requireAuth`, `requireRole("admin")` | Params: `id` (UUID) | `{ account: AdminAccountRecord }` | `public.profiles`, `public.counselor_profiles` | Read single user account & counselor profile | **E (`WRAPPER_ONLY_NO_UI`)** |
| 41 | `POST /api/v1/admin/accounts` | `admin.routes.js` | `requireAuth`, `requireRole("admin")` | Body: `email`, `password`, `full_name`, `app_role`, `member_category`, `identity_code?`, `phone_e164?`, `whatsapp_opt_in?`, `account_status`, `counselor_profile?` | `201`: `{ account: AdminAccountRecord }` | `auth.users` (Admin API), `public.profiles`, `public.counselor_profiles`, `public.audit_logs` | Create new user account of any role (with rollback on profile failure) | **E (`WRAPPER_ONLY_NO_UI`)** |
| 42 | `PATCH /api/v1/admin/accounts/:id` | `admin.routes.js` | `requireAuth`, `requireRole("admin")` | Params: `id` (UUID). Body: partial profile + `counselor_profile?` | `{ account: AdminAccountRecord }` | `public.profiles`, `public.counselor_profiles`, `public.audit_logs` | Update account role/status/profile (guards against self-demotion & last active admin) | **E (`WRAPPER_ONLY_NO_UI`)** |
| 43 | `DELETE /api/v1/admin/accounts/:id` | `admin.routes.js` | `requireAuth`, `requireRole("admin")` | Params: `id` (UUID) | `{ account: AdminAccountRecord }` (`account_status: "disabled"`) | `public.profiles`, `public.counselor_profiles`, `public.audit_logs` | Soft-disable account & unpublish counselor profile | **E (`WRAPPER_ONLY_NO_UI`)** |
| 44 | `PATCH /api/v1/admin/counselors/:id/publication` | `admin.routes.js` | `requireAuth`, `requireRole("admin")` | Params: `id` (UUID). Body: `is_public` (boolean) | `{ counselor_profile: CounselorProfileRecord }` | `public.profiles`, `public.counselor_profiles`, `public.audit_logs` | Publish or unpublish active counselor profile to public directory | **E (`WRAPPER_ONLY_NO_UI`)** |
| 45 | `GET /api/v1/admin/periods` | `admin.routes.js` | `requireAuth`, `requireRole("admin")` | None | `{ periods: AcademicPeriodRecord[] }` | `public.academic_periods` | List all academic periods | **E (`WRAPPER_ONLY_NO_UI`)** |
| 46 | `POST /api/v1/admin/periods` | `admin.routes.js` | `requireAuth`, `requireRole("admin")` | Body: `code`, `name`, `starts_on`, `ends_on`, `is_active`, `is_published` | `201`: `{ period: AcademicPeriodRecord }` | `public.academic_periods`, `public.audit_logs` | Create academic period (auto-deactivates previous active period if `is_active = true`) | **E (`WRAPPER_ONLY_NO_UI`)** |
| 47 | `PATCH /api/v1/admin/periods/:id` | `admin.routes.js` | `requireAuth`, `requireRole("admin")` | Params: `id` (UUID). Body: partial of `periodBodySchema` | `{ period: AcademicPeriodRecord }` | `public.academic_periods`, `public.audit_logs` | Update academic period | **E (`WRAPPER_ONLY_NO_UI`)** |
| 48 | `DELETE /api/v1/admin/periods/:id` | `admin.routes.js` | `requireAuth`, `requireRole("admin")` | Params: `id` (UUID) | `{ deleted: { id, code } }` | `public.academic_periods`, `public.counselor_availability_slots`, `public.counseling_bookings`, `public.counseling_sessions`, `public.audit_logs` | Delete unreferenced academic period (`409 PERIOD_IN_USE` if referenced) | **E (`WRAPPER_ONLY_NO_UI`)** |
| 49 | `GET /api/v1/admin/counseling` | `admin.routes.js` | `requireAuth`, `requireRole("admin", "head_lmi")` | Query: `academic_period_id?`, `counselor_id?`, `booking_status?`, `session_status?`, `booking_type?`, `from?`, `to?`, `limit` (1–200) | `{ counseling: AdminCounselingMonitoringItem[] }` | `public.counseling_bookings`, `public.counseling_sessions` | Privacy-minimized counseling monitoring (redacts `client_id` to `client_alias`, omits clinical notes) | **E (`WRAPPER_ONLY_NO_UI`)** |
| 50 | `GET /api/v1/admin/activity` | `admin.routes.js` | `requireAuth`, `requireRole("admin")` | Query: `action?`, `entity_type?`, `actor_role?`, `limit` (1–200) | `{ activity: AdminActivityLogItem[] }` | `public.audit_logs` | List sanitized administrative audit trail | **E (`WRAPPER_ONLY_NO_UI`)** |
| 51 | `GET /api/v1/admin/hero-motivations` | `admin.routes.js` | `requireAuth`, `requireRole("admin")` | Query: `is_active?` (`true\|false`), `limit` (1–200) | `{ hero_motivations: HeroMotivationRecord[] }` | `public.hero_motivations` | List all Hero motivational quotes for Admin management | **C (`AUTH_FULLY_INTEGRATED`)** |
| 52 | `POST /api/v1/admin/hero-motivations` | `admin.routes.js` | `requireAuth`, `requireRole("admin")` | Body: `content` (single-line, 1–280 chars), `is_active` (bool) | `201`: `{ hero_motivation: HeroMotivationRecord }` | `public.hero_motivations`, `public.audit_logs` | Create Hero motivational quote | **C (`AUTH_FULLY_INTEGRATED`)** |
| 53 | `PATCH /api/v1/admin/hero-motivations/:id` | `admin.routes.js` | `requireAuth`, `requireRole("admin")` | Params: `id` (UUID). Body: `content?`, `is_active?` | `{ hero_motivation: HeroMotivationRecord }` | `public.hero_motivations`, `public.audit_logs` | Update Hero motivational quote content or active state | **C (`AUTH_FULLY_INTEGRATED`)** |
| 54 | `DELETE /api/v1/admin/hero-motivations/:id` | `admin.routes.js` | `requireAuth`, `requireRole("admin")` | Params: `id` (UUID) | `{ deleted: { id: string } }` | `public.hero_motivations`, `public.audit_logs` | Delete Hero motivational quote | **C (`AUTH_FULLY_INTEGRATED`)** |

#### 10. Dashboards & Aggregate Reporting (`be/src/routes/reporting.routes.js` — 4 handlers)

| # | Method & Path | Route File | Auth & Roles | Params / Query / Body | Response Structure (`data`) | DB Tables / RPCs | Business Purpose | Category |
|---:|---|---|---|---|---|---|---|---|
| 55 | `GET /api/v1/admin/dashboard` | `reporting.routes.js` | `requireAuth`, `requireRole("admin")` | Query: `academic_period_id?`, `from?`, `to?`, `counselor_id?`, `booking_type?` | `{ summary: DashboardSummaryDto }` | `academic_periods`, `counseling_bookings`, `counseling_sessions`, `session_feedback`, `profiles`, `counselor_profiles` | Operational dashboard KPIs for Admin | **E (`WRAPPER_ONLY_NO_UI`)** |
| 56 | `GET /api/v1/head-lmi/dashboard` | `reporting.routes.js` | `requireAuth`, `requireRole("head_lmi")` | Query: `academic_period_id?`, `from?`, `to?`, `counselor_id?`, `booking_type?` | `{ summary: DashboardSummaryDto }` | Same aggregate tables (privacy-minimized) | Executive dashboard KPIs for Head LMI | **E (`WRAPPER_ONLY_NO_UI`)** |
| 57 | `GET /api/v1/admin/reports` | `reporting.routes.js` | `requireAuth`, `requireRole("admin")` | Query: `academic_period_id?`, `from?`, `to?`, `counselor_id?`, `booking_type?` | `{ report: CounselingReportDto }` (`summary`, `monthly_trend`, `counselor_distribution`, `cancellation_reasons`) | Same aggregate tables | Operational report by period/counselor/format for Admin | **E (`WRAPPER_ONLY_NO_UI`)** |
| 58 | `GET /api/v1/head-lmi/reports` | `reporting.routes.js` | `requireAuth`, `requireRole("head_lmi")` | Query: `academic_period_id?`, `from?`, `to?`, `counselor_id?`, `booking_type?` | `{ report: CounselingReportDto }` | Same aggregate tables | Executive counseling report for Head LMI | **E (`WRAPPER_ONLY_NO_UI`)** |

---

## 4. Frontend API Consumer Inventory

### 4.1 Core Transport & Query Layer

- **[`fe/src/lib/api.ts`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/lib/api.ts):** Canonical HTTP client (`apiRequest<T>`, `getApiBaseUrl()`, `ApiError`, `getAccessToken()`). Reads `VITE_API_BASE_URL` (falls back to `http://127.0.0.1:3000/api/v1` only when `import.meta.env.DEV` is true), attaches `Authorization: Bearer <token>` from `supabase.auth.getSession()` when `auth: true`, and unwraps `{ data }`.
- **[`fe/src/lib/apiQuery.ts`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/lib/apiQuery.ts):** Shared query-string builder (`buildApiQuery`) preserving `false` and `0`.
- **[`fe/src/types/api.ts`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/types/api.ts):** Canonical DTO definitions for all 57 wrapped endpoints.
- **Direct `fetch()` / `axios` Check:** Zero direct `fetch()` or `axios` calls exist anywhere in `fe/src` outside `fe/src/lib/api.ts`.

### 4.2 Full Call Chains: Wrapper Function -> Backend Endpoint -> UI Callers

#### A. `fe/src/features/auth/AuthProvider.tsx` & `Register.tsx` (4 Auth Endpoints — All 4 Invoked)

| Wrapper / Function | HTTP & Endpoint | Invoked By (Page / Component / Hook) | Status |
|---|---|---|---|
| `apiRequest("/auth/register", { method: "POST" })` | `POST /api/v1/auth/register` | [`Register.tsx`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/pages/auth/Register.tsx) (`handleSubmit`) -> `supabase.auth.setSession` | **Active in UI** |
| `AuthProvider.signIn(email, password)` | `POST /api/v1/auth/login` | [`Login.tsx`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/pages/auth/Login.tsx) (`handleSubmit` -> `useAuth().signIn`) | **Active in UI** |
| `fetchBackendProfile(accessToken)` | `GET /api/v1/auth/me` | [`AuthProvider.tsx`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/features/auth/AuthProvider.tsx) (`hydrateSession`, `onAuthStateChange`, `refreshProfile`) | **Active in UI** |
| `AuthProvider.signOut()` | `POST /api/v1/auth/logout` | [`SignOutPanel.tsx`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/features/auth/SignOutPanel.tsx) (mounted in `KlienPengaturanPage`, `KonselorPengaturanPage`, `AdminPengaturanPage`, `KepalaLMIPengaturanPage`) | **Active in UI** |

#### B. `fe/src/lib/publicApi.ts` (5 Public Endpoints — All 5 Invoked)

| Wrapper Function | HTTP & Endpoint | Invoked By (Page / Component) | Status |
|---|---|---|---|
| `getPublicHeroMotivations()` | `GET /api/v1/public/hero-motivations` | [`HomePage.tsx`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/pages/public/HomePage.tsx) (`HeroSection`) | **Active in UI** |
| `getPublicCounselors()` | `GET /api/v1/public/counselors` | [`HomePage.tsx`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/pages/public/HomePage.tsx), [`CounselorPage.tsx`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/pages/public/CounselorPage.tsx), [`KlienBerandaPage.tsx`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/pages/client/KlienBerandaPage.tsx), [`KlienPesananPage.tsx`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/pages/client/KlienPesananPage.tsx) *(Missing in `KlienKonselorPage`, `KlienAktivitasPage`, `KlienRiwayatPage`)* | **Active in UI** |
| `getPublicPeriods()` | `GET /api/v1/public/periods` | [`HomePage.tsx`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/pages/public/HomePage.tsx), [`CounselorPage.tsx`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/pages/public/CounselorPage.tsx) | **Active in UI** |
| `getPublicAvailability(params)` | `GET /api/v1/public/availability` | [`CounselorPage.tsx`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/pages/public/CounselorPage.tsx), [`KlienPesananPage.tsx`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/pages/client/KlienPesananPage.tsx), [`KlienAktivitasPage.tsx`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/pages/client/KlienAktivitasPage.tsx) | **Active in UI** |
| `getPublicFeedback()` | `GET /api/v1/public/feedback` | [`HomePage.tsx`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/pages/public/HomePage.tsx), [`FeedbackPage.tsx`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/pages/public/FeedbackPage.tsx) | **Active in UI** |

#### C. `fe/src/lib/sicareApi.ts` (15 Endpoints — 10 Invoked, 5 Unused)

| Wrapper Function | HTTP & Endpoint | Invoked By (Page / Component) | Status |
|---|---|---|---|
| `sicareApi.getProfile()` | `GET /api/v1/profile` | *None (`0` callers)* | **Unused Wrapper** |
| `sicareApi.updateProfile(input)` | `PATCH /api/v1/profile` | *None (`0` callers)* | **Unused Wrapper** |
| `sicareApi.setWhatsAppConsent(optIn)` | `PATCH /api/v1/profile/whatsapp-consent` | *None (`0` callers)* | **Unused Wrapper** |
| `sicareApi.listBookings(statusOrParams)` | `GET /api/v1/bookings` | [`KlienBerandaPage.tsx`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/pages/client/KlienBerandaPage.tsx), [`KlienAktivitasPage.tsx`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/pages/client/KlienAktivitasPage.tsx) *(Not called by Counselor pages)* | **Active in UI (Client only)** |
| `sicareApi.getBooking(id)` | `GET /api/v1/bookings/:id` | *None (`0` callers)* | **Unused Wrapper** |
| `sicareApi.createBooking(payload)` | `POST /api/v1/bookings` | [`KlienPesananPage.tsx`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/pages/client/KlienPesananPage.tsx) (`submitBooking`) | **Active in UI** |
| `sicareApi.rescheduleBooking(id, payload)` | `PATCH /api/v1/bookings/:id/reschedule` | [`KlienAktivitasPage.tsx`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/pages/client/KlienAktivitasPage.tsx) (`confirmReschedule`) | **Active in UI** |
| `sicareApi.transitionBookingStatus(id, payload)` | `PATCH /api/v1/bookings/:id/status` | [`KlienAktivitasPage.tsx`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/pages/client/KlienAktivitasPage.tsx) (`confirmCancel` -> `status: "cancelled"`) *(Not called by Counselor pages)* | **Active in UI (Client cancel only)** |
| `sicareApi.listSessions(statusOrParams)` | `GET /api/v1/sessions` | [`KlienBerandaPage.tsx`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/pages/client/KlienBerandaPage.tsx), [`KlienRiwayatPage.tsx`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/pages/client/KlienRiwayatPage.tsx) *(Not called by Counselor pages)* | **Active in UI (Client only)** |
| `sicareApi.getSession(id)` | `GET /api/v1/sessions/:id` | *None (`0` callers)* | **Unused Wrapper** |
| `sicareApi.submitSessionFeedback(sessionId, payload)` | `POST /api/v1/sessions/:sessionId/feedback` | [`KlienRiwayatPage.tsx`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/pages/client/KlienRiwayatPage.tsx) (`submitRating`) | **Active in UI** |
| `sicareApi.listMyFeedback(limit)` | `GET /api/v1/feedback/mine` | [`KlienBerandaPage.tsx`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/pages/client/KlienBerandaPage.tsx), [`KlienRiwayatPage.tsx`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/pages/client/KlienRiwayatPage.tsx) | **Active in UI** |
| `sicareApi.listNotifications(unreadOnly, limit)` | `GET /api/v1/notifications` | [`NotificationBell.tsx`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/components/shared/NotificationBell.tsx) (`loadNotifications`) | **Active in UI (All 4 roles)** |
| `sicareApi.markNotificationRead(id)` | `PATCH /api/v1/notifications/:id/read` | [`NotificationBell.tsx`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/components/shared/NotificationBell.tsx) (`handleMarkAsRead`) | **Active in UI (All 4 roles)** |
| `sicareApi.markAllNotificationsRead()` | `PATCH /api/v1/notifications/read-all` | [`NotificationBell.tsx`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/components/shared/NotificationBell.tsx) (`handleMarkAllAsRead`) | **Active in UI (All 4 roles)** |

#### D. `fe/src/lib/counselorApi.ts` (8 Endpoints — 0 Invoked)

| Wrapper Function | HTTP & Endpoint | Invoked By | Status |
|---|---|---|---|
| `counselorApi.getProfile()` | `GET /api/v1/counselor/profile` | *None (`0` callers)* | **Unused Wrapper** |
| `counselorApi.updateProfile(payload)` | `PATCH /api/v1/counselor/profile` | *None (`0` callers)* | **Unused Wrapper** |
| `counselorApi.listAvailability(params)` | `GET /api/v1/counselor/availability` | *None (`0` callers)* | **Unused Wrapper** |
| `counselorApi.createAvailability(payload)` | `POST /api/v1/counselor/availability` | *None (`0` callers)* | **Unused Wrapper** |
| `counselorApi.updateAvailability(id, payload)` | `PATCH /api/v1/counselor/availability/:id` | *None (`0` callers)* | **Unused Wrapper** |
| `counselorApi.deleteAvailability(id)` | `DELETE /api/v1/counselor/availability/:id` | *None (`0` callers)* | **Unused Wrapper** |
| `counselorApi.transitionSessionStatus(id, status)` | `PATCH /api/v1/sessions/:id/status` | *None (`0` callers)* | **Unused Wrapper** |
| `counselorApi.listFeedback(limit)` | `GET /api/v1/feedback/counselor` | *None (`0` callers)* | **Unused Wrapper** |

#### E. `fe/src/lib/adminApi.ts` (21 Endpoints — 4 Invoked, 17 Unused)

| Wrapper Function | HTTP & Endpoint | Invoked By | Status |
|---|---|---|---|
| `adminApi.listAccounts(params)` | `GET /api/v1/admin/accounts` | *None (`0` callers)* | **Unused Wrapper** |
| `adminApi.getAccount(id)` | `GET /api/v1/admin/accounts/:id` | *None (`0` callers)* | **Unused Wrapper** |
| `adminApi.createAccount(payload)` | `POST /api/v1/admin/accounts` | *None (`0` callers)* | **Unused Wrapper** |
| `adminApi.updateAccount(id, payload)` | `PATCH /api/v1/admin/accounts/:id` | *None (`0` callers)* | **Unused Wrapper** |
| `adminApi.disableAccount(id)` | `DELETE /api/v1/admin/accounts/:id` | *None (`0` callers)* | **Unused Wrapper** |
| `adminApi.setCounselorPublication(id, isPublic)` | `PATCH /api/v1/admin/counselors/:id/publication` | *None (`0` callers)* | **Unused Wrapper** |
| `adminApi.listPeriods()` | `GET /api/v1/admin/periods` | *None (`0` callers)* | **Unused Wrapper** |
| `adminApi.createPeriod(payload)` | `POST /api/v1/admin/periods` | *None (`0` callers)* | **Unused Wrapper** |
| `adminApi.updatePeriod(id, payload)` | `PATCH /api/v1/admin/periods/:id` | *None (`0` callers)* | **Unused Wrapper** |
| `adminApi.deletePeriod(id)` | `DELETE /api/v1/admin/periods/:id` | *None (`0` callers)* | **Unused Wrapper** |
| `adminApi.listCounseling(params)` | `GET /api/v1/admin/counseling` | *None (`0` callers)* | **Unused Wrapper** |
| `adminApi.listActivity(params)` | `GET /api/v1/admin/activity` | *None (`0` callers)* | **Unused Wrapper** |
| `adminApi.listHeroMotivations(params)` | `GET /api/v1/admin/hero-motivations` | [`AdminPengaturanPage.tsx`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/pages/admin/AdminPengaturanPage.tsx) (`loadHeroMotivations`) | **Active in UI** |
| `adminApi.createHeroMotivation(payload)` | `POST /api/v1/admin/hero-motivations` | [`AdminPengaturanPage.tsx`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/pages/admin/AdminPengaturanPage.tsx) (`saveHeroMotivation`) | **Active in UI** |
| `adminApi.updateHeroMotivation(id, payload)` | `PATCH /api/v1/admin/hero-motivations/:id` | [`AdminPengaturanPage.tsx`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/pages/admin/AdminPengaturanPage.tsx) (`saveHeroMotivation`, `toggleHeroMotivationActive`) | **Active in UI** |
| `adminApi.deleteHeroMotivation(id)` | `DELETE /api/v1/admin/hero-motivations/:id` | [`AdminPengaturanPage.tsx`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/pages/admin/AdminPengaturanPage.tsx) (`confirmDeleteHeroMotivation`) | **Active in UI** |
| `adminApi.getFeedbackStatistics(params)` | `GET /api/v1/admin/feedback/statistics` | *None (`0` callers)* | **Unused Wrapper** |
| `adminApi.getFeedbackDetail(id)` | `GET /api/v1/admin/feedback/:id` | *None (`0` callers)* | **Unused Wrapper** |
| `adminApi.listFeedback(params)` | `GET /api/v1/admin/feedback` | *None (`0` callers)* | **Unused Wrapper** |
| `adminApi.moderateFeedback(id, payload)` | `PATCH /api/v1/admin/feedback/:id/moderation` | *None (`0` callers)* | **Unused Wrapper** |
| `adminApi.reviewFeedback(id, reviewStatus)` | `PATCH /api/v1/admin/feedback/:id/review` | *None (`0` callers)* | **Unused Wrapper** |

#### F. `fe/src/lib/reportingApi.ts` (4 Endpoints — 0 Invoked)

| Wrapper Function | HTTP & Endpoint | Invoked By | Status |
|---|---|---|---|
| `reportingApi.getAdminDashboard(params)` | `GET /api/v1/admin/dashboard` | *None (`0` callers)* | **Unused Wrapper** |
| `reportingApi.getHeadLmiDashboard(params)` | `GET /api/v1/head-lmi/dashboard` | *None (`0` callers)* | **Unused Wrapper** |
| `reportingApi.getAdminReports(params)` | `GET /api/v1/admin/reports` | *None (`0` callers)* | **Unused Wrapper** |
| `reportingApi.getHeadLmiReports(params)` | `GET /api/v1/head-lmi/reports` | *None (`0` callers)* | **Unused Wrapper** |

---

## 5. Role-by-Role Integration Matrix & Backend Endpoint Coverage Matrix

### 5.1 Role-by-Role Frontend Feature Integration Matrix

| ID | Role | Feature | Frontend Page | API Wrapper | HTTP Method | Backend Endpoint | Integration Status | Missing Work | Priority |
|---|---|---|---|---|---|---|---|---|---|
| `PUB-01` | Public | Hero motivation quote banner | `HomePage.tsx` | `getPublicHeroMotivations` | `GET` | `/api/v1/public/hero-motivations` | **Fully Integrated** | None (uses random active quote with fallback) | P3 |
| `PUB-02` | Public | Landing page counselor showcase & period summary | `HomePage.tsx` | `getPublicCounselors`, `getPublicPeriods` | `GET` | `/api/v1/public/counselors`, `/api/v1/public/periods` | **Fully Integrated** | None | P3 |
| `PUB-03` | Public | Landing page anonymous testimonials | `HomePage.tsx` | `getPublicFeedback` | `GET` | `/api/v1/public/feedback` | **Fully Integrated** | None | P3 |
| `PUB-04` | Public | Public counselor directory & live slot calendar | `CounselorPage.tsx` | `getPublicCounselors`, `getPublicPeriods`, `getPublicAvailability` | `GET` | `/api/v1/public/counselors`, `/api/v1/public/periods`, `/api/v1/public/availability` | **Fully Integrated** | None | P3 |
| `PUB-05` | Public | Public feedback & rating distribution page | `FeedbackPage.tsx` | `getPublicFeedback` | `GET` | `/api/v1/public/feedback` | **Fully Integrated** | None | P3 |
| `PUB-06` | Public | About & Guide informational pages | `AboutPage.tsx`, `PanduanPage.tsx` | *Static UI* | `N/A` | *None (static copy by design)* | **Static by Design** | None | P3 |
| `PUB-07` | Public | Interactive Mood Tracker widget | `MoodTrackerPage.tsx` | *Local state* | `N/A` | *None (no backend table/endpoint)* | **Local Widget Only** | Keep clearly labeled as non-persistent browser self-check | P3 |
| `AUTH-01` | Auth | Client registration | `Register.tsx` | `apiRequest("/auth/register")` | `POST` | `/api/v1/auth/register` | **Fully Integrated** | None | P0 |
| `AUTH-02` | Auth | Role-based login & redirect | `Login.tsx`, `AuthProvider.tsx` | `signIn`, `fetchBackendProfile` | `POST`, `GET` | `/api/v1/auth/login`, `/api/v1/auth/me` | **Fully Integrated** | None | P0 |
| `AUTH-03` | Auth | Session restore, route guards & sign-out | `AuthProvider.tsx`, `RouteGuards.tsx`, `SignOutPanel.tsx` | `fetchBackendProfile`, `signOut` | `GET`, `POST` | `/api/v1/auth/me`, `/api/v1/auth/logout` | **Fully Integrated** | None | P0 |
| `SHARED-01` | All 4 Roles | In-app notification bell, unread count, mark read/all | `NotificationBell.tsx` | `sicareApi.listNotifications`, `markNotificationRead`, `markAllNotificationsRead` | `GET`, `PATCH` | `/api/v1/notifications`, `/api/v1/notifications/:id/read`, `/api/v1/notifications/read-all` | **Fully Integrated** | Remove unused `recipientId` prop & dead `notificationStore.ts` | P2 |
| `CLI-01` | Client | Client dashboard summary (bookings, sessions, feedback) | `KlienBerandaPage.tsx` | `sicareApi.listBookings`, `listSessions`, `listMyFeedback`, `getPublicCounselors` | `GET` | `/api/v1/bookings`, `/api/v1/sessions`, `/api/v1/feedback/mine`, `/api/v1/public/counselors` | **Fully Integrated** | None | P1 |
| `CLI-02` | Client | Counseling booking creation | `KlienPesananPage.tsx` | `getPublicCounselors`, `getPublicAvailability`, `sicareApi.createBooking` | `GET`, `POST` | `/api/v1/public/counselors`, `/api/v1/public/availability`, `/api/v1/bookings` | **Partially Integrated** | Booking & `client_checkin_summary` persist; clinical intake answers & digital signature have no backend table/SOP and are discarded | P0 |
| `CLI-03` | Client | Client active bookings, reschedule & cancel | `KlienAktivitasPage.tsx` | `sicareApi.listBookings`, `rescheduleBooking`, `transitionBookingStatus`, `getPublicAvailability` | `GET`, `PATCH` | `/api/v1/bookings`, `/api/v1/bookings/:id/reschedule`, `/api/v1/bookings/:id/status`, `/api/v1/public/availability` | **Partially Integrated** | Resolve `counselor_id` via `getPublicCounselors()` instead of hardcoded `"Konselor"`; show `rejected`/`cancelled` bookings so cancellation reasons are visible | P1 |
| `CLI-04` | Client | Client counselor directory (`/klien/konselor`) | `KlienKonselorPage.tsx` | *Uses mock `CLIENT_DIRECTORY_COUNSELORS`* | `GET` | `/api/v1/public/counselors` | **Not Integrated (Mock)** | Replace `CLIENT_DIRECTORY_COUNSELORS` with `getPublicCounselors()` + loading/error/empty states | P1 |
| `CLI-05` | Client | Client session history & feedback submission | `KlienRiwayatPage.tsx` | `sicareApi.listSessions`, `listMyFeedback`, `submitSessionFeedback` | `GET`, `POST` | `/api/v1/sessions`, `/api/v1/feedback/mine`, `/api/v1/sessions/:sessionId/feedback` | **Partially Integrated** | Resolve `counselor_id` via `getPublicCounselors()` instead of hardcoded `"Konselor"` | P1 |
| `CLI-06` | Client | Client profile & WhatsApp consent settings | `KlienPengaturanPage.tsx` | *Hardcoded `ACCOUNT`/`INITIAL` (0 API calls)* | `GET`, `PATCH` | `/api/v1/profile`, `/api/v1/profile/whatsapp-consent` | **Not Integrated (Mock)** | Wire `sicareApi.getProfile()`, `updateProfile()`, `setWhatsAppConsent()`; align UI fields with `full_name`, `phone_e164`, `whatsapp_opt_in` | P1 |
| `CNS-01` | Counselor | Counselor dashboard (pending requests & today's sessions) | `KonselorBerandaPage.tsx` | *Uses mock `useCounselorDashboard`* | `GET`, `PATCH` | `/api/v1/bookings`, `/api/v1/sessions`, `/api/v1/feedback/counselor`, `/api/v1/bookings/:id/status` | **Not Integrated (Mock)** | Replace `useCounselorDashboard` with live bookings, sessions, and feedback summary | P0 |
| `CNS-02` | Counselor | Incoming booking request queue & decision modal | `KonselorPermintaanPage.tsx` | *Uses mock `useBookingStore` + `intakes`* | `GET`, `PATCH` | `/api/v1/bookings`, `/api/v1/bookings/:id/status` | **Not Integrated (Mock)** | Wire `sicareApi.listBookings` and `transitionBookingStatus`; add `session_format` (`online`/`offline`), rejection `reason`, and `reschedule_requested` support | P0 |
| `CNS-03` | Counselor | Counselor active session management (`ongoing`/`completed`/`cancelled`) | `KonselorAktivitasPage.tsx` | *Uses mock `buildDummySessions`* | `GET`, `PATCH` | `/api/v1/sessions`, `/api/v1/sessions/:id`, `/api/v1/sessions/:id/status` | **Not Integrated (Mock)** | Wire `sicareApi.listSessions` and `counselorApi.transitionSessionStatus`; gate unsupported clinical notes (`noteCounselor`/`noteClient`/`plan`) | P0 |
| `CNS-04` | Counselor | Counselor session history | `KonselorRiwayatPage.tsx` | *Uses mock `counselorHistory.ts` + `sessionStorage` PIN* | `GET` | `/api/v1/sessions`, `/api/v1/public/periods` | **Not Integrated (Mock)** | Wire `sicareApi.listSessions({ status: "completed" })` (and `cancelled`); do not display fake clinical notes | P1 |
| `CNS-05` | Counselor | Counselor schedule & availability CRUD | `KonselorJadwalPage.tsx` | *Uses mock `createCounselorScheduleSeed`* | `GET`, `POST`, `PATCH`, `DELETE` | `/api/v1/counselor/availability`, `/api/v1/counselor/availability/:id`, `/api/v1/public/periods` | **Not Integrated (Mock)** | Wire `counselorApi.listAvailability`, `createAvailability`, `updateAvailability`, `deleteAvailability` with ISO timestamps & active period UUID | P0 |
| `CNS-06` | Counselor | Counselor approved feedback view | `KonselorFeedbackPage.tsx` | *Uses mock `counselorFeedback.ts` + `useFeedbackStore`* | `GET` | `/api/v1/feedback/counselor`, `/api/v1/public/periods` | **Not Integrated (Mock)** | Wire `counselorApi.listFeedback()` | P1 |
| `CNS-07` | Counselor | Counselor profile & account settings | `KonselorPengaturanPage.tsx` | *Uses mock `INITIAL_COUNSELOR_PROFILE`* | `GET`, `PATCH` | `/api/v1/profile`, `/api/v1/counselor/profile` | **Not Integrated (Mock)** | Wire `sicareApi.getProfile`/`updateProfile` and `counselorApi.getProfile`/`updateProfile`; map supported fields | P1 |
| `ADM-01` | Admin | Admin operational dashboard | `AdminBerandaPage.tsx` | *Uses mock `dashboardOverview.ts` + `useBookingStore`* | `GET` | `/api/v1/admin/dashboard`, `/api/v1/admin/counseling` | **Not Integrated (Mock)** | Wire `reportingApi.getAdminDashboard()` and `adminApi.listCounseling()` | P1 |
| `ADM-02` | Admin | User account & counselor publication management | `AdminAkunPage.tsx` | *Uses mock `INITIAL_ACCOUNTS`* | `GET`, `POST`, `PATCH`, `DELETE` | `/api/v1/admin/accounts`, `/api/v1/admin/accounts/:id`, `/api/v1/admin/counselors/:id/publication` | **Not Integrated (Mock)** | Wire `adminApi.listAccounts`, `createAccount`, `updateAccount`, `disableAccount`, `setCounselorPublication` | P1 |
| `ADM-03` | Admin | Academic period CRUD | `AdminPeriodePage.tsx` | *Uses `localStorage` (`sicare.periods`)* | `GET`, `POST`, `PATCH`, `DELETE` | `/api/v1/admin/periods`, `/api/v1/admin/periods/:id` | **Not Integrated (Mock)** | Wire `adminApi.listPeriods`, `createPeriod`, `updatePeriod`, `deletePeriod` (including `is_active`/`is_published` flags & `409 PERIOD_IN_USE` handling) | P1 |
| `ADM-04` | Admin | Privacy-minimized counseling monitoring | `AdminKonselingPage.tsx` | *Uses mock `adminCounseling.ts` (`SESI`)* | `GET` | `/api/v1/admin/counseling`, `/api/v1/admin/periods` | **Not Integrated (Mock)** | Wire `adminApi.listCounseling()` and `adminApi.listPeriods()` | P1 |
| `ADM-05` | Admin | Feedback moderation (`pending`/`shown`/`disabled`) | `AdminFeedbackPage.tsx` | *Uses `useFeedbackStore` + `useNotificationStore`* | `GET`, `PATCH` | `/api/v1/admin/feedback`, `/api/v1/admin/feedback/statistics`, `/api/v1/admin/feedback/:id/moderation`, `/api/v1/admin/periods` | **Not Integrated (Mock)** | Wire `adminApi.listFeedback`, `getFeedbackStatistics`, `moderateFeedback` | P1 |
| `ADM-06` | Admin | Admin counseling report & PDF print | `AdminLaporanPage.tsx` | *Uses mock `adminReports.ts` (`SESSIONS`)* | `GET` | `/api/v1/admin/reports`, `/api/v1/admin/periods` | **Not Integrated (Mock)** | Wire `reportingApi.getAdminReports()` and `adminApi.listPeriods()` | P1 |
| `ADM-07` | Admin | Administrative audit/activity log | `AdminAktivitasPage.tsx` | *Placeholder `<div>ActivityPage</div>`* | `GET` | `/api/v1/admin/activity` | **Placeholder Stub** | Implement activity log table wired to `adminApi.listActivity()` (note: route is currently not in `AdminLayout` sidebar) | P2 |
| `ADM-08` | Admin | Admin settings & Hero Motivation CRUD | `AdminPengaturanPage.tsx` | `adminApi.*HeroMotivation*` (Hero); `localStorage` (Profile) | `GET`, `POST`, `PATCH`, `DELETE` | `/api/v1/admin/hero-motivations*`, `/api/v1/profile` | **Partially Integrated** | Hero CRUD is **Fully Integrated**; profile section still uses `localStorage` (`sicare_admin_profile_v1`) instead of `sicareApi.getProfile()`/`updateProfile()` | P2 |
| `LMI-01` | Head LMI | Head LMI executive dashboard | `KepalaLMIBerandaPage.tsx` | *Uses mock `dashboardOverview.ts`* | `GET` | `/api/v1/head-lmi/dashboard` | **Not Integrated (Mock)** | Wire `reportingApi.getHeadLmiDashboard()`; fix CTA button that wrongly navigates to `/admin/laporan` (`403` for Head LMI) instead of `/kepala-lmi/laporan` | P1 |
| `LMI-02` | Head LMI | Head LMI counseling aggregate report | `KepalaLMILaporanPage.tsx` | *Uses mock `headlmiReports.ts` (`SESSIONS`)* | `GET` | `/api/v1/head-lmi/reports`, `/api/v1/public/periods` | **Not Integrated (Mock)** | Wire `reportingApi.getHeadLmiReports()` and period selector | P1 |
| `LMI-03` | Head LMI | Head LMI feedback evaluation & review status | `KepalaLMIFeedbackPage.tsx` | *Uses mock `headlmiFeedback.ts` (`FEEDBACKS`)* | `GET`, `PATCH` | `/api/v1/admin/feedback`, `/api/v1/admin/feedback/statistics`, `/api/v1/admin/feedback/:id/review`, `/api/v1/public/periods` | **Not Integrated (Mock)** | Wire `adminApi.listFeedback`, `getFeedbackStatistics`, and `reviewFeedback` (`new`/`reviewed`/`resolved`) | P1 |
| `LMI-04` | Head LMI | Head LMI account settings | `KepalaLMIPengaturanPage.tsx` | *Uses mock `INITIAL_PROFILE`* | `GET`, `PATCH` | `/api/v1/profile` | **Not Integrated (Mock)** | Wire `sicareApi.getProfile()` and `sicareApi.updateProfile()` | P2 |

### 5.2 Backend Endpoint Coverage Matrix (All 58 `/api/v1/*` Endpoints)

| # | Endpoint | Intended Consumer | Frontend Consumer (Actual) | Status | Reason |
|---:|---|---|---|---|---|
| 1 | `GET /api/v1/health` | Operational scripts (`verify-live-api.js`) | None (Ops script only) | **Ops Only (Cat. G)** | Health probe for CLI/deployment verification, not UI. |
| 2 | `POST /api/v1/auth/register` | Public (`Register.tsx`) | `Register.tsx` | **Integrated (Cat. C)** | Live client self-registration. |
| 3 | `POST /api/v1/auth/login` | Public (`Login.tsx`) | `Login.tsx` via `AuthProvider.signIn` | **Integrated (Cat. C)** | Live authentication & role verification. |
| 4 | `GET /api/v1/auth/me` | Authenticated (`AuthProvider.tsx`) | `AuthProvider.tsx` (`fetchBackendProfile`) | **Integrated (Cat. C)** | Session hydration & role guard verification. |
| 5 | `POST /api/v1/auth/logout` | Authenticated (`SignOutPanel.tsx`) | `SignOutPanel.tsx` via `AuthProvider.signOut` | **Integrated (Cat. C)** | Audit log & session sign-out across all 4 roles. |
| 6 | `GET /api/v1/public/hero-motivations` | Public (`HomePage.tsx`) | `HomePage.tsx` (`getPublicHeroMotivations`) | **Integrated (Cat. A)** | Renders active Hero quote on landing page. |
| 7 | `GET /api/v1/public/counselors` | Public & Client pages | `HomePage`, `CounselorPage`, `KlienBerandaPage`, `KlienPesananPage` | **Integrated (Cat. A)** | Live counselor directory (missing in `KlienKonselorPage`, `KlienAktivitasPage`, `KlienRiwayatPage`). |
| 8 | `GET /api/v1/public/periods` | Public & non-admin period filters | `HomePage`, `CounselorPage` | **Integrated (Cat. A)** | Live published periods on public pages (not yet used by Counselor/Head LMI period dropdowns). |
| 9 | `GET /api/v1/public/availability` | Public & Client booking/reschedule | `CounselorPage`, `KlienPesananPage`, `KlienAktivitasPage` | **Integrated (Cat. A)** | Live slot availability lookup. |
| 10 | `GET /api/v1/public/feedback` | Public (`HomePage`, `FeedbackPage`) | `HomePage`, `FeedbackPage` (`getPublicFeedback`) | **Integrated (Cat. A)** | Live approved (`shown`) public feedback. |
| 11 | `GET /api/v1/profile` | All 4 roles (`*PengaturanPage.tsx`) | *None (`sicareApi.getProfile` unused)* | **Wrapper Only (Cat. E)** | Settings pages still use hardcoded/localStorage profile state. |
| 12 | `PATCH /api/v1/profile` | All 4 roles (`*PengaturanPage.tsx`) | *None (`sicareApi.updateProfile` unused)* | **Wrapper Only (Cat. E)** | Settings pages simulate save locally without calling API. |
| 13 | `PATCH /api/v1/profile/whatsapp-consent` | Client (`KlienPengaturanPage.tsx`) | *None (`sicareApi.setWhatsAppConsent` unused)* | **Wrapper Only (Cat. E)** | `KlienPengaturanPage` has no WhatsApp consent toggle yet. |
| 14 | `GET /api/v1/bookings` | Client & Counselor booking pages | `KlienBerandaPage`, `KlienAktivitasPage` | **Partial (Cat. D)** | Called by Client pages; `KonselorBerandaPage` & `KonselorPermintaanPage` still use mock data. |
| 15 | `POST /api/v1/bookings` | Client (`KlienPesananPage.tsx`) | `KlienPesananPage.tsx` (`sicareApi.createBooking`) | **Partial (Cat. D)** | Creates booking in DB, but UI intake form & canvas signature are discarded locally. |
| 16 | `PATCH /api/v1/bookings/:id/reschedule` | Client (`KlienAktivitasPage.tsx`) | `KlienAktivitasPage.tsx` (`sicareApi.rescheduleBooking`) | **Integrated (Cat. C)** | Client replacement slot selection when `reschedule_requested`. |
| 17 | `GET /api/v1/bookings/:id` | Client & Counselor detail views | *None (`sicareApi.getBooking` unused)* | **Wrapper Only (Cat. E)** | List endpoints already return full `BOOKING_SELECT_COLUMNS`; no standalone detail page calls this yet. |
| 18 | `PATCH /api/v1/bookings/:id/status` | Client & Counselor booking actions | `KlienAktivitasPage.tsx` (`cancelled` only) | **Partial (Cat. D)** | Client cancellation is wired; Counselor `confirmed`, `rejected`, and `reschedule_requested` in `KonselorPermintaanPage` / `KonselorBerandaPage` are still mock. |
| 19 | `GET /api/v1/sessions` | Client & Counselor session pages | `KlienBerandaPage`, `KlienRiwayatPage` | **Partial (Cat. D)** | Called by Client pages; Counselor pages (`KonselorBerandaPage`, `KonselorAktivitasPage`, `KonselorRiwayatPage`) still use mock data. |
| 20 | `GET /api/v1/sessions/:id` | Client & Counselor session detail | *None (`sicareApi.getSession` unused)* | **Wrapper Only (Cat. E)** | Counselor activity/history drawers still read mock session objects. |
| 21 | `PATCH /api/v1/sessions/:id/status` | Counselor (`KonselorAktivitasPage.tsx`) | *None (`counselorApi.transitionSessionStatus` unused)* | **Wrapper Only (Cat. E)** | `KonselorAktivitasPage` mutates local `useState<CounselingSession[]>` only. |
| 22 | `POST /api/v1/sessions/:sessionId/feedback` | Client (`KlienRiwayatPage.tsx`) | `KlienRiwayatPage.tsx` (`sicareApi.submitSessionFeedback`) | **Partial (Cat. D)** | Client submission is live; downstream Counselor/Admin/Head LMI views do not yet read from API. |
| 23 | `GET /api/v1/feedback/counselor` | Counselor (`KonselorFeedbackPage.tsx`) | *None (`counselorApi.listFeedback` unused)* | **Wrapper Only (Cat. E)** | `KonselorFeedbackPage` reads `feedbackData` + `useFeedbackStore`. |
| 24 | `GET /api/v1/feedback/mine` | Client (`KlienBerandaPage`, `KlienRiwayatPage`) | `KlienBerandaPage`, `KlienRiwayatPage` (`sicareApi.listMyFeedback`) | **Integrated (Cat. C)** | Client reads their own submitted feedback from backend. |
| 25 | `GET /api/v1/admin/feedback/statistics` | Admin & Head LMI feedback pages | *None (`adminApi.getFeedbackStatistics` unused)* | **Wrapper Only (Cat. E)** | `AdminFeedbackPage` & `KepalaLMIFeedbackPage` compute KPIs from mock arrays. |
| 26 | `GET /api/v1/admin/feedback/:id` | Admin & Head LMI feedback detail | *None (`adminApi.getFeedbackDetail` unused)* | **Wrapper Only (Cat. E)** | List endpoint returns full `ADMIN_FEEDBACK_COLUMNS`; detail endpoint not called. |
| 27 | `GET /api/v1/admin/feedback` | Admin & Head LMI feedback pages | *None (`adminApi.listFeedback` unused)* | **Wrapper Only (Cat. E)** | `AdminFeedbackPage` uses `useFeedbackStore`; `KepalaLMIFeedbackPage` uses mock `FEEDBACKS`. |
| 28 | `PATCH /api/v1/admin/feedback/:id/moderation` | Admin (`AdminFeedbackPage.tsx`) | *None (`adminApi.moderateFeedback` unused)* | **Wrapper Only (Cat. E)** | `AdminFeedbackPage` mutates `useFeedbackStore` & `useNotificationStore` locally. |
| 29 | `PATCH /api/v1/admin/feedback/:id/review` | Head LMI (`KepalaLMIFeedbackPage.tsx`) | *None (`adminApi.reviewFeedback` unused)* | **Wrapper Only (Cat. E)** | `KepalaLMIFeedbackPage` is read-only over mock `FEEDBACKS` and has no review status action buttons yet. |
| 30 | `GET /api/v1/notifications` | All 4 roles (`NotificationBell.tsx`) | `NotificationBell.tsx` (`sicareApi.listNotifications`) | **Integrated (Cat. C)** | Live notifications list & unread count in all role layouts. |
| 31 | `PATCH /api/v1/notifications/read-all` | All 4 roles (`NotificationBell.tsx`) | `NotificationBell.tsx` (`sicareApi.markAllNotificationsRead`) | **Integrated (Cat. C)** | Marks all user notifications as read. |
| 32 | `PATCH /api/v1/notifications/:id/read` | All 4 roles (`NotificationBell.tsx`) | `NotificationBell.tsx` (`sicareApi.markNotificationRead`) | **Integrated (Cat. C)** | Marks individual notification as read. |
| 33 | `GET /api/v1/counselor/profile` | Counselor (`KonselorPengaturanPage.tsx`) | *None (`counselorApi.getProfile` unused)* | **Wrapper Only (Cat. E)** | `KonselorPengaturanPage` uses mock `INITIAL_COUNSELOR_PROFILE`. |
| 34 | `PATCH /api/v1/counselor/profile` | Counselor (`KonselorPengaturanPage.tsx`) | *None (`counselorApi.updateProfile` unused)* | **Wrapper Only (Cat. E)** | `KonselorPengaturanPage` saves only to local component state. |
| 35 | `GET /api/v1/counselor/availability` | Counselor (`KonselorJadwalPage.tsx`) | *None (`counselorApi.listAvailability` unused)* | **Wrapper Only (Cat. E)** | `KonselorJadwalPage` uses mock `createCounselorScheduleSeed`. |
| 36 | `POST /api/v1/counselor/availability` | Counselor (`KonselorJadwalPage.tsx`) | *None (`counselorApi.createAvailability` unused)* | **Wrapper Only (Cat. E)** | `KonselorJadwalPage` mutates local state only. |
| 37 | `PATCH /api/v1/counselor/availability/:id` | Counselor (`KonselorJadwalPage.tsx`) | *None (`counselorApi.updateAvailability` unused)* | **Wrapper Only (Cat. E)** | `KonselorJadwalPage` mutates local state only. |
| 38 | `DELETE /api/v1/counselor/availability/:id` | Counselor (`KonselorJadwalPage.tsx`) | *None (`counselorApi.deleteAvailability` unused)* | **Wrapper Only (Cat. E)** | `KonselorJadwalPage` mutates local state only. |
| 39 | `GET /api/v1/admin/accounts` | Admin (`AdminAkunPage.tsx`) | *None (`adminApi.listAccounts` unused)* | **Wrapper Only (Cat. E)** | `AdminAkunPage` uses mock `INITIAL_ACCOUNTS`. |
| 40 | `GET /api/v1/admin/accounts/:id` | Admin (`AdminAkunPage.tsx`) | *None (`adminApi.getAccount` unused)* | **Wrapper Only (Cat. E)** | Not called by `AdminAkunPage`. |
| 41 | `POST /api/v1/admin/accounts` | Admin (`AdminAkunPage.tsx`) | *None (`adminApi.createAccount` unused)* | **Wrapper Only (Cat. E)** | `AdminAkunPage` appends to local `useState<Account[]>`. |
| 42 | `PATCH /api/v1/admin/accounts/:id` | Admin (`AdminAkunPage.tsx`) | *None (`adminApi.updateAccount` unused)* | **Wrapper Only (Cat. E)** | `AdminAkunPage` updates local `useState<Account[]>`. |
| 43 | `DELETE /api/v1/admin/accounts/:id` | Admin (`AdminAkunPage.tsx`) | *None (`adminApi.disableAccount` unused)* | **Wrapper Only (Cat. E)** | `AdminAkunPage` toggles `active` boolean in local state. |
| 44 | `PATCH /api/v1/admin/counselors/:id/publication` | Admin (`AdminAkunPage.tsx`) | *None (`adminApi.setCounselorPublication` unused)* | **Wrapper Only (Cat. E)** | No publication toggle exists in `AdminAkunPage` yet. |
| 45 | `GET /api/v1/admin/periods` | Admin (`AdminPeriodePage.tsx`, reports/filters) | *None (`adminApi.listPeriods` unused)* | **Wrapper Only (Cat. E)** | `AdminPeriodePage` reads `localStorage` (`sicare.periods`). |
| 46 | `POST /api/v1/admin/periods` | Admin (`AdminPeriodePage.tsx`) | *None (`adminApi.createPeriod` unused)* | **Wrapper Only (Cat. E)** | `AdminPeriodePage` writes to `localStorage` (`sicare.periods`). |
| 47 | `PATCH /api/v1/admin/periods/:id` | Admin (`AdminPeriodePage.tsx`) | *None (`adminApi.updatePeriod` unused)* | **Wrapper Only (Cat. E)** | `AdminPeriodePage` writes to `localStorage` (`sicare.periods`). |
| 48 | `DELETE /api/v1/admin/periods/:id` | Admin (`AdminPeriodePage.tsx`) | *None (`adminApi.deletePeriod` unused)* | **Wrapper Only (Cat. E)** | `AdminPeriodePage` deletes from `localStorage` (`sicare.periods`). |
| 49 | `GET /api/v1/admin/counseling` | Admin (`AdminKonselingPage`, `AdminBerandaPage`) | *None (`adminApi.listCounseling` unused)* | **Wrapper Only (Cat. E)** | `AdminKonselingPage` uses mock `SESI` from `adminCounseling.ts`. |
| 50 | `GET /api/v1/admin/activity` | Admin (`AdminAktivitasPage.tsx`) | *None (`adminApi.listActivity` unused)* | **Wrapper Only (Cat. E)** | `AdminAktivitasPage` is an unimplemented stub (`<div>ActivityPage</div>`). |
| 51 | `GET /api/v1/admin/hero-motivations` | Admin (`AdminPengaturanPage.tsx`) | `AdminPengaturanPage.tsx` (`adminApi.listHeroMotivations`) | **Integrated (Cat. C)** | Live Hero quote list in Admin Settings. |
| 52 | `POST /api/v1/admin/hero-motivations` | Admin (`AdminPengaturanPage.tsx`) | `AdminPengaturanPage.tsx` (`adminApi.createHeroMotivation`) | **Integrated (Cat. C)** | Live Hero quote creation in Admin Settings. |
| 53 | `PATCH /api/v1/admin/hero-motivations/:id` | Admin (`AdminPengaturanPage.tsx`) | `AdminPengaturanPage.tsx` (`adminApi.updateHeroMotivation`) | **Integrated (Cat. C)** | Live Hero quote edit/toggle in Admin Settings. |
| 54 | `DELETE /api/v1/admin/hero-motivations/:id` | Admin (`AdminPengaturanPage.tsx`) | `AdminPengaturanPage.tsx` (`adminApi.deleteHeroMotivation`) | **Integrated (Cat. C)** | Live Hero quote deletion in Admin Settings. |
| 55 | `GET /api/v1/admin/dashboard` | Admin (`AdminBerandaPage.tsx`) | *None (`reportingApi.getAdminDashboard` unused)* | **Wrapper Only (Cat. E)** | `AdminBerandaPage` uses `DASHBOARD_COUNTS` + `useBookingStore`. |
| 56 | `GET /api/v1/head-lmi/dashboard` | Head LMI (`KepalaLMIBerandaPage.tsx`) | *None (`reportingApi.getHeadLmiDashboard` unused)* | **Wrapper Only (Cat. E)** | `KepalaLMIBerandaPage` uses mock `DASHBOARD_COUNTS`. |
| 57 | `GET /api/v1/admin/reports` | Admin (`AdminLaporanPage.tsx`) | *None (`reportingApi.getAdminReports` unused)* | **Wrapper Only (Cat. E)** | `AdminLaporanPage` uses mock `SESSIONS` from `adminReports.ts`. |
| 58 | `GET /api/v1/head-lmi/reports` | Head LMI (`KepalaLMILaporanPage.tsx`) | *None (`reportingApi.getHeadLmiReports` unused)* | **Wrapper Only (Cat. E)** | `KepalaLMILaporanPage` uses mock `SESSIONS` from `headlmiReports.ts`. |

---

## 6. API Contract Mismatches (Frontend UI vs. Backend Routes & Schemas)

While `fe/src/types/api.ts` and the wrapper files (`publicApi.ts`, `sicareApi.ts`, `counselorApi.ts`, `adminApi.ts`, `reportingApi.ts`) accurately mirror the backend response envelopes and Zod schemas after Batch 1.2, **significant contract mismatches exist between the unintegrated Frontend Page UI models and the actual Backend API contracts**:

| # | Domain / Page | Frontend UI Assumption | Backend API Reality (`be/src/routes/*.js`) | Impact & Required Resolution |
|---:|---|---|---|---|
| `CM-01` | **Counselor Booking Decision** (`KonselorPermintaanPage.tsx`, `KonselorBerandaPage.tsx`) | Accept modal only asks for optional `roomInput` (string). Reject modal asks for no reason (`"Ya, tolak"`). No button exists to request a reschedule (`reschedule_requested`). | `PATCH /api/v1/bookings/:id/status` (`transitionBookingSchema` + `sicare_transition_booking` RPC) **requires** `session_format: "online" \| "offline"` when `status === "confirmed"` (with optional `room` or `meeting_url`), and **requires** a non-empty `reason` (1–500 chars) when `status` is `"rejected"` or `"reschedule_requested"`. | **High Blocker for Batch 1.4c:** Update Counselor decision modals in `KonselorPermintaanPage` and `KonselorBerandaPage` to include `session_format` (`online`/`offline`), `room`/`meeting_url`, a mandatory `reason` textarea for `rejected`, and a `"Minta Jadwal Ulang"` (`reschedule_requested`) action with mandatory `reason`. |
| `CM-02` | **Counselor Availability Schedule** (`KonselorJadwalPage.tsx`) | Uses local date key (`YYYY-MM-DD`) and minute offset (`start: 540` = 09:00) with implicit 60-min duration, no `academic_period_id`, no `session_format` (`online\|offline\|hybrid`), and no slot `id` UUID. Also includes a `"Batalkan sesi"` flow with cancellation reasons (`CANCEL_REASONS`) inside the schedule grid. | `POST /api/v1/counselor/availability` requires ISO `starts_at` and `ends_at` timestamps, `session_format` (`online\|offline\|hybrid`), `capacity` (1–10), `status` (`available\|blocked\|cancelled`), and resolves or validates `academic_period_id` against published/active periods. Booked slots cannot be edited/deleted via `/counselor/availability/:id` (`409 AVAILABILITY_HAS_BOOKINGS`); bookings/sessions must be transitioned via `/bookings/:id/status` or `/sessions/:id/status`. | **High Blocker for Batch 1.4c:** Map `KonselorJadwalPage` date + hour slots to UTC ISO `starts_at`/`ends_at` (WITA `+08:00`), bind to active `academic_period_id`, use canonical slot UUIDs for `PATCH`/`DELETE`, and route booked-slot cancellations through booking/session status endpoints. |
| `CM-03` | **Counselor Session Transitions & Clinical Notes** (`KonselorAktivitasPage.tsx`, `KonselorRiwayatPage.tsx`) | `KonselorAktivitasPage` collects cancellation reasons (`CANCEL_REASONS`), counselor clinical notes (`noteCounselor`), client summary (`noteClient`), and follow-up plan (`plan`), and displays client intake answers (`getCounselorActivityIntake`). `KonselorRiwayatPage` displays multi-session clinical notes behind a browser `sessionStorage` PIN (`1234`). | `PATCH /api/v1/sessions/:id/status` (`sessionStatusSchema`) **only** accepts `{ status: "ongoing" \| "completed" \| "cancelled" }`. Neither `counseling_sessions` nor `counseling_bookings` has columns for `noteCounselor`, `noteClient`, `plan`, or structured intake answers (only `booking.client_checkin_summary` and `booking.cancellation_reason` exist). | **High Governance Constraint (AGENTS.md §3):** Do not invent clinical note persistence without approved SOP. Wire `KonselorAktivitasPage` and `KonselorRiwayatPage` to live `GET /api/v1/sessions` + `PATCH /api/v1/sessions/:id/status` + `GET /api/v1/bookings` (for `client_checkin_summary` and `cancellation_reason`), and clearly disable/gate unbacked clinical note inputs. |
| `CM-04` | **Client & Role Profile Settings** (`KlienPengaturanPage.tsx`, `AdminPengaturanPage.tsx`, `KepalaLMIPengaturanPage.tsx`) | `KlienPengaturanPage` edits `phone`, `address`, `occupation`, `education` and displays read-only `gender`, `age`, `ethnicity`, `religion`, `maritalStatus`, `childOrder`, `siblingsCount`, `faculty`, `studyProgram`. `AdminPengaturanPage` and `KepalaLMIPengaturanPage` edit `displayName`, `email`, `phone`, `photo` (512x512 base64 data URL), and a password change form. | `GET /api/v1/profile` returns `{ id, full_name, identity_code, member_category, app_role, account_status, phone_e164, whatsapp_opt_in, whatsapp_opt_in_at, created_at, updated_at }`. `PATCH /api/v1/profile` (`profilePatchSchema`) is `.strict()` and **only** accepts `full_name` and `phone_e164` (`^\+[1-9][0-9]{7,14}$`). Email changes, photos on base profiles, demographic fields, and password change endpoints do not exist in backend. | **Medium:** Bind `full_name`, `identity_code`, `member_category`, `phone_e164` (normalizing `08...` to `+628...`), and `whatsapp_opt_in` (via `PATCH /api/v1/profile/whatsapp-consent`) to live endpoints; make email read-only from `useAuth().user.email`; keep unsupported demographic/password/photo controls read-only or disabled with honest UI messaging. |
| `CM-05` | **Counselor Professional Profile** (`KonselorPengaturanPage.tsx`) | Edits `photo` (base64 data URL from canvas crop, ~50–150 KB), `displayName`, `bio`, `experienceStartYear` (`"2018"`), `educations[]`, `topics[]`, `phone`, `email`, `services: { individual, group }`, plus password and history PIN forms. | `PATCH /api/v1/counselor/profile` accepts `public_name` (2–120), `headline` (max 160), `bio` (max 2000), `specialties` (string[], max 20), `years_experience` (int 0–80), and `photo_path` (max **1000 chars** — rejects base64 data URLs!). `phone_e164` and `full_name` live on `PATCH /api/v1/profile`. `educations[]` and `services` do not exist in `counselor_profiles`. | **Medium:** Split save across `PATCH /api/v1/profile` (`full_name`, `phone_e164`) and `PATCH /api/v1/counselor/profile` (`public_name`, `headline`, `bio`, `specialties`, `years_experience = currentYear - Number(experienceStartYear)`), and avoid sending base64 data URLs to `photo_path` (which has `.max(1000)`). |
| `CM-06` | **Admin Account Management** (`AdminAkunPage.tsx`) | Uses single `role` union (`"Konselor" \| "Mahasiswa" \| "Dosen" \| "Staff" \| "Kepala LMI" \| "Admin"`), numeric `id`, `active: boolean`, and no `password` field when creating an account. | `POST /api/v1/admin/accounts` requires UUID `id`, separate `app_role` (`client\|counselor\|admin\|head_lmi`) + `member_category` (`student\|lecturer\|staff\|counselor\|admin\|head_lmi`), `account_status` (`active\|inactive\|suspended\|disabled`), and **requires** `password` (8–72 chars) on creation. Also supports `counselor_profile` and `PATCH /api/v1/admin/counselors/:id/publication`. | **High Blocker for Batch 1.4d:** Map UI role selector to `{ app_role, member_category }`, add `password` input to the Add Account modal (or initial password field), use UUID `id`, and add a counselor publication (`is_public`) toggle. |
| `CM-07` | **Admin Academic Periods** (`AdminPeriodePage.tsx`) | Generates slug IDs (`2025-2026-ganjil`), stores `{ id, ta, sem, label, start, end }` in `localStorage` (`sicare.periods`), and has no `is_active` or `is_published` toggles (computes status purely from `today >= start && today <= end`). | `public.academic_periods` uses UUID `id`, `code` (e.g. `2026-GANJIL`), `name` (`TA 2026/2027 Ganjil`), `starts_on`, `ends_on`, `is_active` (boolean), and `is_published` (boolean). `DELETE /api/v1/admin/periods/:id` returns `409 PERIOD_IN_USE` if referenced by slots/bookings/sessions. | **High Blocker for Batch 1.4d:** Map `ta` + `sem` to `code` and `name`, use backend UUID `id`, expose `is_active` and `is_published` controls in `AdminPeriodePage`, and handle `409 PERIOD_IN_USE` gracefully on delete. |
| `CM-08` | **Head LMI Feedback Review Status** (`KepalaLMIFeedbackPage.tsx`) | Uses Indonesian review status labels (`"Baru" \| "Ditinjau" \| "Selesai"` from `FEEDBACK_REVIEW_STATUS`) and has no UI buttons to update review status. | `PATCH /api/v1/admin/feedback/:id/review` expects `review_status: "new" \| "reviewed" \| "resolved"`. | **Medium (Batch 1.4e):** Map backend `new -> Baru`, `reviewed -> Ditinjau`, `resolved -> Selesai` and add review status action controls on `KepalaLMIFeedbackPage` calling `adminApi.reviewFeedback(id, reviewStatus)`. |
| `CM-09` | **Admin & Head LMI Reports Topic Table** (`AdminLaporanPage.tsx`) | Renders a "Sesi per topik" table (`TOPICS`) and a raw session preview table (`SESSIONS`). | `GET /api/v1/admin/reports` and `GET /api/v1/head-lmi/reports` return `{ summary, monthly_trend, counselor_distribution, cancellation_reasons }`. There is no `topics` breakdown in `reporting.routes.js` because sessions do not store structured topic categories in PostgreSQL. Detailed session rows come from `GET /api/v1/admin/counseling`. | **Medium (Batch 1.4d/1.4e):** Drive KPI cards, monthly chart, counselor table, and cancellation reasons from `reportingApi.getAdminReports()` / `getHeadLmiReports()`, and drive Admin's session table from `adminApi.listCounseling()`. |
| `CM-10` | **Head LMI Dashboard CTA Link Bug** (`KepalaLMIBerandaPage.tsx`) | Line 18: `"Lihat laporan lengkap"` button calls `navigate("/admin/laporan")`. | `/admin/laporan` is guarded by `<RequireRole allowedRoles={["admin"]} />` and redirects `head_lmi` users away! The Head LMI report route is `/kepala-lmi/laporan`. | **High UX Bug (Batch 1.4e):** Change `navigate("/admin/laporan")` to `navigate("/kepala-lmi/laporan")` in `KepalaLMIBerandaPage.tsx`. |
| `CM-11` | **Counselor Identity Resolution on Client Pages** (`KlienAktivitasPage.tsx`, `KlienRiwayatPage.tsx`) | `KlienAktivitasPage` renders hardcoded `<h2>Konselor</h2>` and `KlienRiwayatPage` sets `const counselorName = "Konselor"`. | `GET /api/v1/bookings` and `GET /api/v1/sessions` return `counselor_id` (UUID) without a nested `counselor` object. `KlienBerandaPage` already solves this by fetching `getPublicCounselors()` and building a `counselorMap.get(counselor_id)`. | **Low/Easy Fix (Batch 1.4b):** Load `getPublicCounselors()` in `KlienAktivitasPage` and `KlienRiwayatPage` (just like `KlienBerandaPage`) so clients see the actual counselor name. |

---

## 7. End-to-End Business Workflow Audit (Workflows 1–8)

### Workflow 1: Authentication & Session Lifecycle

1. **User Registration (`/register` -> `Register.tsx`):**
   - Calls `POST /api/v1/auth/register` with `email`, `password`, `full_name`, `member_category` (`student|lecturer|staff`), optional `identity_code`, `phone_e164`, `whatsapp_opt_in`.
   - Backend creates Supabase Auth user + `public.profiles` row (`app_role = 'client'`, `account_status = 'active'`). If a session is returned, `Register.tsx` calls `supabase.auth.setSession` and `refreshProfile()`, then navigates to `/klien`.
2. **User Login (`/login` -> `Login.tsx`):**
   - Calls `AuthProvider.signIn(email, password)` -> `POST /api/v1/auth/login`.
   - Backend verifies password via Supabase Auth, verifies `public.profiles.account_status === 'active'`, writes `auth.login` audit log, and returns `{ user, profile, session }`.
   - `AuthProvider` persists the session in Supabase Auth client (`supabase.auth.setSession`) and caches `profile` in React state.
3. **Session Restoration & Token Verification (`AuthProvider.tsx`):**
   - On page load or auth state change, `AuthProvider` reads the Supabase session token and calls `GET /api/v1/auth/me` (`fetchBackendProfile`) to verify `account_status === 'active'` and retrieve the authoritative `app_role`. If `/auth/me` fails with `401` or `403`, `AuthProvider` signs out locally and clears `profile`.
4. **Role-Based Route Protection (`RouteGuards.tsx`):**
   - `RequireAuth` redirects unauthenticated users to `/login`. `RequireRole` compares `profile.app_role` against `allowedRoles` (`client`, `counselor`, `admin`, `head_lmi`) and redirects unauthorized roles to their canonical role home (`roleHomePath`).
5. **Logout (`SignOutPanel.tsx`):**
   - Calls `AuthProvider.signOut()`, which invokes `POST /api/v1/auth/logout` (best-effort audit log) and always executes `supabase.auth.signOut()` in `finally`, clearing session and redirecting to `/login`.
- **Verdict:** **100% Integrated & Verified.**

---

### Workflow 2: Public Information Flow

1. **Hero Motivations (`HomePage.tsx`):**
   - Calls `getPublicHeroMotivations()` (`GET /api/v1/public/hero-motivations`), filters active non-empty quotes, picks one at random, and falls back to `DEFAULT_HERO_MOTIVATION` on empty/error.
2. **Public Counselor Directory (`HomePage.tsx`, `CounselorPage.tsx`):**
   - Calls `getPublicCounselors()` (`GET /api/v1/public/counselors`). Backend returns only counselors where `counselor_profiles.is_public = true` and `profiles.account_status = 'active'` and `profiles.app_role = 'counselor'`.
3. **Published Academic Periods (`HomePage.tsx`, `CounselorPage.tsx`):**
   - Calls `getPublicPeriods()` (`GET /api/v1/public/periods`). Backend returns periods where `is_published = true`.
4. **Public Availability Schedule (`CounselorPage.tsx`):**
   - Calls `getPublicAvailability()` (`GET /api/v1/public/availability`). Backend filters to active published counselors, published periods, non-cancelled slots, and dynamically computes `status: "available" | "booked"` from active `counseling_bookings`.
5. **Public Feedback (`HomePage.tsx`, `FeedbackPage.tsx`):**
   - Calls `getPublicFeedback()` (`GET /api/v1/public/feedback`). Backend returns only `moderation_status = 'shown'` feedback for active published counselors, with `client_id` stripped.
- **Verdict:** **100% Integrated & Verified.**

---

### Workflow 3: Booking Lifecycle (End-to-End Cross-Role Trace)

| Step | Actor | Action | Frontend Page | Backend Endpoint | Current Status | Gap / Breakdown |
|---:|---|---|---|---|---|---|
| 1 | Counselor | Create availability slot | `KonselorJadwalPage.tsx` | `POST /api/v1/counselor/availability` | **BROKEN (Mock)** | `KonselorJadwalPage` mutates local state (`createCounselorScheduleSeed`) instead of calling `counselorApi.createAvailability`. |
| 2 | Client | Browse counselor & slots | `KlienPesananPage.tsx` | `GET /api/v1/public/counselors`, `GET /api/v1/public/availability` | **LIVE** | Works when DB has published counselors and slots. |
| 3 | Client | Create booking | `KlienPesananPage.tsx` | `POST /api/v1/bookings` | **PARTIAL LIVE** | Booking record + `client_checkin_summary` + counselor notification are created in DB via `sicare_create_booking`. Structured intake answers and digital canvas signature stay in component memory and are discarded. |
| 4 | Counselor | View incoming booking requests | `KonselorPermintaanPage.tsx`, `KonselorBerandaPage.tsx` | `GET /api/v1/bookings` | **BROKEN (Mock)** | Counselor pages read `useBookingStore` (`legacyRequests`) and `useCounselorDashboard` (`initialRequests`) instead of `sicareApi.listBookings()`. |
| 5 | Counselor | Confirm, reject, or request reschedule | `KonselorPermintaanPage.tsx`, `KonselorBerandaPage.tsx` | `PATCH /api/v1/bookings/:id/status` | **BROKEN (Mock + Contract Mismatch)** | Counselor pages mutate local Zustand/hook state; UI lacks `session_format` (`online`/`offline`), rejection `reason`, and `"reschedule_requested"` action. |
| 6 | Client | Reschedule booking (if `reschedule_requested`) | `KlienAktivitasPage.tsx` | `PATCH /api/v1/bookings/:id/reschedule` | **LIVE** | Client selects a new slot from `getPublicAvailability` and calls `sicareApi.rescheduleBooking()`. |
| 7 | Client | Cancel booking | `KlienAktivitasPage.tsx` | `PATCH /api/v1/bookings/:id/status` | **LIVE** | Client submits `status: "cancelled"` with mandatory `reason` (`confirmCancel`). |

---

### Workflow 4: Counseling Session Lifecycle

| Step | Actor | Action | Frontend Page | Backend Endpoint | Current Status | Gap / Breakdown |
|---:|---|---|---|---|---|---|
| 1 | System | Auto-create `scheduled` session on booking confirmation | Triggered by Counselor confirm | `PATCH /api/v1/bookings/:id/status` (`sicare_transition_booking`) | **Backend Ready / UI Blocked by Step 5 above** | Backend RPC atomically inserts `public.counseling_sessions` with `status = 'scheduled'` when booking is confirmed. |
| 2 | Client / Counselor | View upcoming & active sessions | `KlienBerandaPage.tsx`, `KonselorAktivitasPage.tsx` | `GET /api/v1/sessions` | **Client LIVE / Counselor BROKEN** | `KlienBerandaPage` calls `sicareApi.listSessions()`; `KonselorAktivitasPage` uses mock `buildDummySessions()`. |
| 3 | Counselor | Start session (`scheduled -> ongoing`) | `KonselorAktivitasPage.tsx` | `PATCH /api/v1/sessions/:id/status` | **BROKEN (Mock)** | `KonselorAktivitasPage` updates local `useState` instead of calling `counselorApi.transitionSessionStatus(id, "ongoing")`. |
| 4 | Counselor | Complete (`ongoing -> completed`) or Cancel (`-> cancelled`) session | `KonselorAktivitasPage.tsx` | `PATCH /api/v1/sessions/:id/status` | **BROKEN (Mock)** | `KonselorAktivitasPage` updates local state only; backend RPC `sicare_transition_session` is never called from UI. |
| 5 | Client / Counselor | View session history | `KlienRiwayatPage.tsx`, `KonselorRiwayatPage.tsx` | `GET /api/v1/sessions` | **Client LIVE / Counselor BROKEN** | `KlienRiwayatPage` calls `sicareApi.listSessions()`; `KonselorRiwayatPage` uses mock `clients` from `counselorHistory.ts`. |

---

### Workflow 5: Feedback Lifecycle

| Step | Actor | Action | Frontend Page | Backend Endpoint | Current Status | Gap / Breakdown |
|---:|---|---|---|---|---|---|
| 1 | Client | Submit rating (1–5) & comment for `completed` session | `KlienRiwayatPage.tsx` | `POST /api/v1/sessions/:sessionId/feedback` | **LIVE** | Calls `sicareApi.submitSessionFeedback()`. Creates `session_feedback` with `moderation_status = 'pending'`, `review_status = 'new'`, and notifies Admins. |
| 2 | Client | View own submitted feedback & moderation state | `KlienBerandaPage.tsx`, `KlienRiwayatPage.tsx` | `GET /api/v1/feedback/mine` | **LIVE** | Calls `sicareApi.listMyFeedback()`. |
| 3 | Admin | View feedback queue, statistics & moderate (`pending -> shown / disabled`) | `AdminFeedbackPage.tsx` | `GET /api/v1/admin/feedback`, `GET /api/v1/admin/feedback/statistics`, `PATCH /api/v1/admin/feedback/:id/moderation` | **BROKEN (Mock)** | `AdminFeedbackPage` reads/writes `useFeedbackStore` instead of calling `adminApi`. |
| 4 | Head LMI | View feedback statistics, list & update review status (`new -> reviewed -> resolved`) | `KepalaLMIFeedbackPage.tsx` | `GET /api/v1/admin/feedback`, `GET /api/v1/admin/feedback/statistics`, `PATCH /api/v1/admin/feedback/:id/review` | **BROKEN (Mock)** | `KepalaLMIFeedbackPage` reads mock `FEEDBACKS` from `headlmiFeedback.ts` and has no UI buttons to trigger `adminApi.reviewFeedback()`. |
| 5 | Counselor | View approved (`shown`) anonymous feedback | `KonselorFeedbackPage.tsx` | `GET /api/v1/feedback/counselor` | **BROKEN (Mock)** | `KonselorFeedbackPage` reads `feedbackData` + `useFeedbackStore` instead of `counselorApi.listFeedback()`. |
| 6 | Public | View approved (`shown`) feedback on landing & feedback pages | `HomePage.tsx`, `FeedbackPage.tsx` | `GET /api/v1/public/feedback` | **LIVE** | Calls `getPublicFeedback()`. |

---

### Workflow 6: Notification Lifecycle

1. **Creation (Backend Server-Side):**
   - `sicare_create_booking`, `sicare_reschedule_booking`, `sicare_transition_booking`, `sicare_transition_session`, `sicare_submit_session_feedback`, and `sicare_moderate_feedback` automatically insert in-app notification rows into `public.notifications` (and WhatsApp outbox rows when `whatsapp_opt_in = true`).
2. **Listing & Unread Badge (`NotificationBell.tsx`):**
   - Mounted in `KlienLayout`, `KonselorLayout`, `AdminLayout`, and `KepalaLMILayout`. Calls `sicareApi.listNotifications(false, 30)` (`GET /api/v1/notifications`) on mount, sets `unreadCount` from `response.unread_count`, and renders notification cards with deep-links (`resolveHref`).
3. **Mark Single & Mark All Read (`NotificationBell.tsx`):**
   - Calls `sicareApi.markNotificationRead(id)` (`PATCH /api/v1/notifications/:id/read`) and `sicareApi.markAllNotificationsRead()` (`PATCH /api/v1/notifications/read-all`), updating local state only after server confirmation.
- **Verdict:** **100% Integrated & Verified.** *(Note: `AdminFeedbackPage.tsx` and `KonselorPermintaanPage.tsx` still call the legacy in-memory `useNotificationStore().addNotification`, which `NotificationBell.tsx` no longer reads).*

---

### Workflow 7: Admin Management Lifecycle

1. **Account Management (`AdminAkunPage.tsx`):** **0% Integrated** (uses `INITIAL_ACCOUNTS` instead of `adminApi.listAccounts` / `createAccount` / `updateAccount` / `disableAccount`).
2. **Counselor Publication (`AdminAkunPage.tsx`):** **0% Integrated** (no UI toggle calling `adminApi.setCounselorPublication`).
3. **Academic Period Management (`AdminPeriodePage.tsx`):** **0% Integrated** (uses `localStorage` `sicare.periods` instead of `adminApi.listPeriods` / `createPeriod` / `updatePeriod` / `deletePeriod`).
4. **Hero Motivation Management (`AdminPengaturanPage.tsx`):** **100% Integrated** (uses `adminApi.listHeroMotivations`, `createHeroMotivation`, `updateHeroMotivation`, `deleteHeroMotivation`).
5. **Counseling Monitoring (`AdminKonselingPage.tsx`):** **0% Integrated** (uses mock `SESI` from `adminCounseling.ts` instead of `adminApi.listCounseling`).
6. **Audit Activity Log (`AdminAktivitasPage.tsx`):** **0% Integrated** (placeholder `<div>ActivityPage</div>` instead of `adminApi.listActivity`).

---

### Workflow 8: Reporting & Executive Oversight Lifecycle

1. **Admin Operational Dashboard (`AdminBerandaPage.tsx`):** **0% Integrated** (uses `DASHBOARD_COUNTS`, `WEEKLY_SESSIONS`, `COUNSELOR_WORKLOAD`, and `useBookingStore` instead of `reportingApi.getAdminDashboard()`).
2. **Admin Counseling Reports (`AdminLaporanPage.tsx`):** **0% Integrated** (uses `SESSIONS`, `TOPICS`, `REASONS` from `adminReports.ts` and `DEFAULT_PERIODS` instead of `reportingApi.getAdminReports()` and `adminApi.listPeriods()`).
3. **Head LMI Executive Dashboard (`KepalaLMIBerandaPage.tsx`):** **0% Integrated** (uses `DASHBOARD_COUNTS`, `WEEKLY_SESSIONS`, `COUNSELOR_WORKLOAD` instead of `reportingApi.getHeadLmiDashboard()`).
4. **Head LMI Counseling Reports (`KepalaLMILaporanPage.tsx`):** **0% Integrated** (uses `SESSIONS`, `CANCELLATION_REASONS` from `headlmiReports.ts` and `loadPeriods()` from `localStorage` instead of `reportingApi.getHeadLmiReports()` and `getPublicPeriods()`).

---

## 8. Mock Data, Local State & Browser Storage Inventory

### 8.1 Classification Categories (Section 10.2)

- **Category A (`REMOVE_ON_INTEGRATION`):** Replace immediately when connecting existing backend endpoints.
- **Category B (`TEMPORARY_FALLBACK`):** Keep temporarily as a safe fallback for empty/error states or UI options.
- **Category C (`BLOCKED_ON_BACKEND`):** Keep until new backend schema/endpoints and clinical SOPs are approved and implemented.
- **Category D (`STATIC_UI_CONFIG`):** Keep permanently as static UI copy, form option catalogs, or visual showcase constants.
- **Category E (`SECURITY_SENSITIVE_MOCK`):** Security-sensitive mock/browser storage that must never be treated as a production control or used to store real sensitive data.

### 8.2 Complete Inventory of `fe/src/data/mock/*` (24 Files)

| # | File Path | Exported Symbols | Current Consumers | Category | Action Plan |
|---:|---|---|---|---|---|
| 1 | [`fe/src/data/mock/academicPeriods.ts`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/data/mock/academicPeriods.ts) | `DEFAULT_ACADEMIC_PERIODS`, `LEGACY_UI_SEMESTERS` | `lib/academicPeriods.ts`, `AdminPeriodePage`, `KonselorFeedbackPage` | **Cat. A** | Replace with `adminApi.listPeriods()` (Admin) and `getPublicPeriods()` (Counselor/Head LMI). |
| 2 | [`fe/src/data/mock/adminAccounts.ts`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/data/mock/adminAccounts.ts) | `INITIAL_ACCOUNTS`, `Account`, `Role` | `AdminAkunPage.tsx`, `accountSelectors.ts` | **Cat. A** | Replace with `adminApi.listAccounts()` and `AdminAccountRecord` DTO in Batch 1.4d. |
| 3 | [`fe/src/data/mock/adminCounseling.ts`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/data/mock/adminCounseling.ts) | `COUNSELORS`, `RATING`, `SESI`, `NOW`, `Session` | `AdminKonselingPage.tsx` | **Cat. A** | Replace with `adminApi.listCounseling()` in Batch 1.4d. |
| 4 | [`fe/src/data/mock/adminFeedback.ts`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/data/mock/adminFeedback.ts) | `PSIKOLOG`, `DATA`, `Feedback` | `AdminFeedbackPage.tsx`, `feedbackStore.ts` | **Cat. A** | Replace with `adminApi.listFeedback()` & `getFeedbackStatistics()` in Batch 1.4d. |
| 5 | [`fe/src/data/mock/adminReports.ts`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/data/mock/adminReports.ts) | `SESSIONS`, `TOPICS`, `REASONS`, `Session` | `AdminLaporanPage.tsx`, `features/admin/reports/selectors.ts` | **Cat. A** | Replace with `reportingApi.getAdminReports()` & `adminApi.listCounseling()` in Batch 1.4d. |
| 6 | [`fe/src/data/mock/clientActivity.ts`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/data/mock/clientActivity.ts) | `CANCEL_REASONS`, `counselors`, `initialSessions`, `Session` | `features/client/activity/sessionRules.ts` (type only; `KlienAktivitasPage` already migrated) | **Cat. A** | Unused at runtime (`KlienAktivitasPage` uses live API); clean up dead type reference. |
| 7 | [`fe/src/data/mock/clientCounselors.ts`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/data/mock/clientCounselors.ts) | `CLIENT_DIRECTORY_COUNSELORS`, `CLIENT_COUNSELOR_IDENTITIES`, `BookingCounselor` | `KlienKonselorPage.tsx` (runtime data), `KonselorFeedbackPage.tsx`, `KlienPesananPage.tsx` (type only) | **Cat. A** | Replace runtime usage in `KlienKonselorPage.tsx` with `getPublicCounselors()` in Batch 1.4b; move `BookingCounselor` type to `types/`. |
| 8 | [`fe/src/data/mock/clientHistory.ts`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/data/mock/clientHistory.ts) | `SESSIONS` | `fe/src/data/mock/index.ts` only (`KlienRiwayatPage` already migrated) | **Cat. A** | No active page consumer; safe to retire after barrel cleanup. |
| 9 | [`fe/src/data/mock/counselorActivity.ts`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/data/mock/counselorActivity.ts) | `CANCEL_REASONS`, `buildDummySessions`, `getCounselorActivityIntake`, `CounselingSession` | `KonselorAktivitasPage.tsx`, `ActivityDialogs.tsx`, `scheduleUtils.ts` | **Cat. A / Cat. D / Cat. E** | Replace `buildDummySessions` (Cat. A) & `getCounselorActivityIntake` (Cat. E) in Batch 1.4c; keep `CANCEL_REASONS` as static UI option catalog (Cat. D). |
| 10 | [`fe/src/data/mock/counselorDashboard.ts`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/data/mock/counselorDashboard.ts) | `initialRequests`, `initialSessions`, `RATINGS`, `SESSIONS_THIS_WEEK` | `useCounselorDashboard.ts`, `KonselorBerandaPage.tsx` | **Cat. A** | Replace with `sicareApi.listBookings()`, `sicareApi.listSessions()`, and `counselorApi.listFeedback()` in Batch 1.4c. |
| 11 | [`fe/src/data/mock/counselorFeedback.ts`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/data/mock/counselorFeedback.ts) | `COUNSELOR`, `feedbackData` | `KonselorFeedbackPage.tsx` | **Cat. A** | Replace with `counselorApi.listFeedback()` in Batch 1.4c. |
| 12 | [`fe/src/data/mock/counselorHistory.ts`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/data/mock/counselorHistory.ts) | `clients`, `Session`, `Client` | `KonselorRiwayatPage.tsx`, `historySelectors.ts` | **Cat. A / Cat. E** | Replace session history with `sicareApi.listSessions()`; remove fake clinical notes (`catatan`, `rencana`, `keluhan`) in Batch 1.4c. |
| 13 | [`fe/src/data/mock/counselorProfile.ts`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/data/mock/counselorProfile.ts) | `INITIAL_COUNSELOR_PROFILE`, `CounselorProfile` | `KonselorPengaturanPage.tsx` | **Cat. A** | Replace with `counselorApi.getProfile()` + `sicareApi.getProfile()` in Batch 1.4c. |
| 14 | [`fe/src/data/mock/counselorRequests.ts`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/data/mock/counselorRequests.ts) | `initialRequests`, `intakes`, `CounselingRequest` | `bookingStore.ts`, `KonselorPermintaanPage.tsx` | **Cat. A / Cat. E** | Replace `initialRequests` with `sicareApi.listBookings()` in Batch 1.4c; remove fake clinical `intakes` (Cat. E). |
| 15 | [`fe/src/data/mock/counselorSchedule.ts`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/data/mock/counselorSchedule.ts) | `createCounselorScheduleSeed`, `Slot` | `KonselorJadwalPage.tsx` | **Cat. A** | Replace with `counselorApi.listAvailability()` in Batch 1.4c. |
| 16 | [`fe/src/data/mock/dashboardOverview.ts`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/data/mock/dashboardOverview.ts) | `DASHBOARD_COUNTS`, `WEEKLY_SESSIONS`, `COUNSELOR_WORKLOAD` | `components/admin/dashboard/DashboardSections.tsx`, `components/headlmi/dashboard/DashboardSections.tsx` | **Cat. A** | Replace with `reportingApi.getAdminDashboard()` (Batch 1.4d) and `reportingApi.getHeadLmiDashboard()` (Batch 1.4e). |
| 17 | [`fe/src/data/mock/guideContent.tsx`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/data/mock/guideContent.tsx) | `audiences`, `faqs`, `steps`, `LOREM_LONG` | `PanduanPage.tsx`, `GuideSections.tsx` | **Cat. D** | Keep permanently as static informational content for `/panduan`. |
| 18 | [`fe/src/data/mock/headlmiFeedback.ts`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/data/mock/headlmiFeedback.ts) | `FEEDBACKS`, `Feedback` | `KepalaLMIFeedbackPage.tsx`, `features/headlmi/feedback/selectors.ts` | **Cat. A** | Replace with `adminApi.listFeedback()` & `getFeedbackStatistics()` in Batch 1.4e. |
| 19 | [`fe/src/data/mock/headlmiReports.ts`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/data/mock/headlmiReports.ts) | `SESSIONS`, `CANCELLATION_REASONS`, `Session` | `KepalaLMILaporanPage.tsx`, `features/headlmi/reports/selectors.ts` | **Cat. A** | Replace with `reportingApi.getHeadLmiReports()` in Batch 1.4e. |
| 20 | [`fe/src/data/mock/index.ts`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/data/mock/index.ts) | Barrel re-exports of mock modules | No active page imports the barrel directly | **Cat. A** | Prune re-exports as mock modules are retired. |
| 21 | [`fe/src/data/mock/intakeOptions.ts`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/data/mock/intakeOptions.ts) | `INTAKE_TOPICS`, `INTAKE_YESNO_OPTIONS`, `INTAKE_SCALE_OPTIONS`, `INTAKE_ESSAY_OPTIONS` | `KlienPesananPage.tsx`, `clientIntakeForm.ts` | **Cat. C / Cat. D** | Form question labels (Cat. D) used by `KlienPesananPage` step-2 intake questionnaire; persistence of answers is blocked on clinical SOP & DB schema (Cat. C). |
| 22 | [`fe/src/data/mock/publicFeedback.ts`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/data/mock/publicFeedback.ts) | `reviews`, `Review`, `Role`, `Format` | `feedbackStore.ts`, `features/public/feedback/selectors.ts` (types) | **Cat. A** | Public `FeedbackPage` and `HomePage` already use live `getPublicFeedback()`; keep only type definitions or move types to `types/`. |
| 23 | [`fe/src/data/mock/publicShowcases.ts`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/data/mock/publicShowcases.ts) | `COUNSELOR_SECTION_SHOWCASE`, `TESTIMONIALS`, ` COUNSELOR_PAGE_SHOWCASE` | `CounselorSection.tsx`, `TestimonialSection.tsx` (dead components not mounted in `HomePage`) | **Cat. B / Cat. D** | Dead showcase constants; `HomePage` and `CounselorPage` already fetch live counselors and feedback. |
| 24 | [`fe/src/data/mock/reportCommon.ts`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/data/mock/reportCommon.ts) | `REPORT_COUNSELORS`, `REPORT_MONTHS` | `AdminLaporanPage.tsx`, `KepalaLMILaporanPage.tsx`, `KepalaLMIFeedbackPage.tsx` | **Cat. A / Cat. D** | Keep `REPORT_MONTHS` (`Jan..Des`, Cat. D); replace `REPORT_COUNSELORS` with dynamic counselor list from API (Cat. A). |

### 8.3 Zustand Stores, Browser Storage (`localStorage` / `sessionStorage`) & Inline Page Mocks

| Store / Storage / Inline Constant | Location | Current Consumers | Category | Audit Finding & Action Plan |
|---|---|---|---|---|
| `useBookingStore` (Zustand in-memory) | [`fe/src/features/booking/store/bookingStore.ts`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/features/booking/store/bookingStore.ts) | `KonselorPermintaanPage.tsx`, `AdminBerandaPage.tsx` | **Cat. A** | `KlienPesananPage` no longer writes to `useBookingStore`, so `bookings` is always `[]` and `legacyRequests` holds static mock requests. Replace with `sicareApi.listBookings()` (Counselor) and `reportingApi.getAdminDashboard()` (Admin). |
| `useFeedbackStore` (Zustand in-memory) | [`fe/src/features/feedback/store/feedbackStore.ts`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/features/feedback/store/feedbackStore.ts) | `KonselorFeedbackPage.tsx`, `AdminFeedbackPage.tsx` | **Cat. A** | `KlienRiwayatPage` and `FeedbackPage` already use live backend endpoints, leaving `useFeedbackStore` disconnected from real client feedback. Replace with `counselorApi.listFeedback()` and `adminApi.listFeedback()` / `moderateFeedback()`. |
| `useNotificationStore` (Zustand in-memory) | [`fe/src/features/notification/notificationStore.ts`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/features/notification/notificationStore.ts) | `KonselorPermintaanPage.tsx`, `AdminFeedbackPage.tsx` (writers only; `0` readers!) | **Cat. A** | `NotificationBell.tsx` already reads from `sicareApi.listNotifications()`. Calls to `addNotification` in `KonselorPermintaanPage` and `AdminFeedbackPage` write to an unread in-memory store. Remove when wiring those pages to backend RPCs (which create real DB notifications). |
| `localStorage["sicare.periods"]` | [`fe/src/lib/academicPeriods.ts`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/lib/academicPeriods.ts) | `AdminPeriodePage`, `AdminKonselingPage`, `AdminFeedbackPage`, `KonselorRiwayatPage`, `KepalaLMILaporanPage`, `KepalaLMIFeedbackPage` | **Cat. A** | Local browser-only period store with non-UUID slug IDs (`2025-2026-ganjil`). Replace with `adminApi.listPeriods()` (for Admin) and `getPublicPeriods()` (for Counselor/Head LMI). |
| `localStorage["sicare_admin_profile_v1"]` | [`AdminPengaturanPage.tsx`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/pages/admin/AdminPengaturanPage.tsx) | `AdminPengaturanPage.tsx` | **Cat. A** | Stores Admin profile edits in `localStorage`. Replace with `sicareApi.getProfile()` / `sicareApi.updateProfile()`. |
| `sessionStorage["sicare:konselor:riwayat-*"]` | [`fe/src/features/history/counselorHistoryAccess.ts`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/features/history/counselorHistoryAccess.ts) | `KonselorRiwayatPage.tsx`, `KonselorPengaturanPage.tsx` | **Cat. E** | Browser-only SHA-256 PIN gate (default `"1234"`). Per `AGENTS.md §3`, browser `sessionStorage` locks are **not** production security controls for counseling records. Keep only as a UI privacy screen while relying on backend `requireAuth` + `requireRole("counselor")` + owner scoping. |
| Inline `ACCOUNT` & `INITIAL` | [`KlienPengaturanPage.tsx`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/pages/client/KlienPengaturanPage.tsx) | `KlienPengaturanPage.tsx` | **Cat. A** | Hardcoded `"Yusli Ngongano"` (`2210011045`). Replace with `sicareApi.getProfile()`, `updateProfile()`, and `setWhatsAppConsent()`. |
| Inline `INITIAL_PROFILE` | [`KepalaLMIPengaturanPage.tsx`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/pages/headlmi/KepalaLMIPengaturanPage.tsx) | `KepalaLMIPengaturanPage.tsx` | **Cat. A** | Hardcoded `"Kepala LMI"` (`kepala.lmi@kampus.ac.id`). Replace with `sicareApi.getProfile()` and `updateProfile()`. |

---

## 9. Missing UI States & Error Handling Audit

Section 11 requires verifying whether each page handles: (1) Initial loading state, (2) Empty data state, (3) Network/server error state, (4) Validation error state, (5) Unauthorized/forbidden state, (6) Duplicate submission prevention, and (7) Refresh/invalidation after mutations.

| Role | Page | 1. Loading | 2. Empty | 3. Error | 4. Validation | 5. Auth/403 | 6. Anti-Double-Submit | 7. Post-Mutation Refresh | Audit Status & Missing States |
|---|---|---|---|---|---|---|---|---|---|
| Public | `HomePage.tsx` | Partial (graceful fallback) | Yes | Yes (silent fallback) | N/A | N/A | N/A | N/A | **OK** (`cancelled` flag prevents unmount races). |
| Public | `CounselorPage.tsx` | Yes (`loading`) | Yes | Yes (`error`) | N/A | N/A | N/A | N/A | **OK** |
| Public | `FeedbackPage.tsx` | Yes (`loading`) | Yes | Yes (`error`) | N/A | N/A | N/A | N/A | **OK** |
| Auth | `Login.tsx` | Yes (`submitting`) | N/A | Yes (`error`) | Yes | Yes (`ACCOUNT_INACTIVE`) | Yes (`disabled={submitting}`) | Yes (`signIn` hydrates profile) | **OK** |
| Auth | `Register.tsx` | Yes (`submitting`) | N/A | Yes (`error`) | Yes | N/A | Yes (`disabled={submitting}`) | Yes (`refreshProfile`) | **OK** |
| Shared | `NotificationBell.tsx` | Yes (`loading`) | Yes | Yes (`error`) | N/A | Yes (`auth: true`) | Yes (`busyId`) | Yes (updates state on confirm) | **OK** |
| Client | `KlienBerandaPage.tsx` | Yes (`loading`) | Yes | Yes (`error`) | N/A | Yes (`RequireRole`) | N/A | N/A | **OK** |
| Client | `KlienPesananPage.tsx` | Yes (`loadingCounselors`, `loadingSlots`) | Yes | Yes (`apiError`) | Yes (per-step) | Yes (`RequireRole`) | Yes (`submittingBooking`) | Yes (navigates to `/klien/aktivitas`) | **OK** |
| Client | `KlienAktivitasPage.tsx` | Yes (`loading`) | Yes | Yes (`error`, `actionError`) | Yes (reason/slot required) | Yes (`RequireRole`) | Yes (`submitting`) | Yes (`await loadBookings()`) | **OK** (needs counselor name lookup & cancelled/rejected visibility). |
| Client | `KlienKonselorPage.tsx` | **MISSING** | Yes (filter empty) | **MISSING** | N/A | Yes (`RequireRole`) | N/A | N/A | **Missing Loading & Error states** (currently synchronous mock). |
| Client | `KlienRiwayatPage.tsx` | Yes (`loading`) | Yes | Yes (`error`) | Yes (rating 1–5) | Yes (`RequireRole`) | Yes (`submittingRating`) | Yes (appends returned feedback) | **OK** (needs counselor name lookup). |
| Client | `KlienPengaturanPage.tsx` | **MISSING** | N/A | **MISSING** | Yes (phone/fields) | Yes (`RequireRole`) | **MISSING** (`save` is sync) | **MISSING** | **Missing Loading, API Error, Async Submit & Refresh states.** |
| Counselor | `KonselorBerandaPage.tsx` | **MISSING** | Yes | **MISSING** | **MISSING** (no format/reason) | Yes (`RequireRole`) | **MISSING** | **MISSING** | **All async API states missing** (uses synchronous `useCounselorDashboard`). |
| Counselor | `KonselorPermintaanPage.tsx` | **MISSING** | Yes | **MISSING** | Partial (missing format & reject reason) | Yes (`RequireRole`) | **MISSING** | **MISSING** | **All async API states missing** (uses synchronous `useBookingStore`). |
| Counselor | `KonselorAktivitasPage.tsx` | **MISSING** | Yes | **MISSING** | Yes | Yes (`RequireRole`) | **MISSING** | **MISSING** | **All async API states missing** (uses synchronous `buildDummySessions`). |
| Counselor | `KonselorRiwayatPage.tsx` | **MISSING** | Yes | **MISSING** | Yes (PIN) | Yes (`RequireRole`) | N/A | N/A | **Missing Loading & API Error states.** |
| Counselor | `KonselorJadwalPage.tsx` | **MISSING** | Yes | **MISSING** | Yes (time/conflict) | Yes (`RequireRole`) | **MISSING** | **MISSING** | **All async API states missing** (uses synchronous `createCounselorScheduleSeed`). |
| Counselor | `KonselorFeedbackPage.tsx` | **MISSING** | Yes | **MISSING** | N/A | Yes (`RequireRole`) | N/A | N/A | **Missing Loading & API Error states.** |
| Counselor | `KonselorPengaturanPage.tsx` | **MISSING** | N/A | **MISSING** | Yes | Yes (`RequireRole`) | **MISSING** | **MISSING** | **Missing Loading, API Error, Async Submit & Refresh states.** |
| Admin | `AdminBerandaPage.tsx` | **MISSING** | Yes | **MISSING** | N/A | Yes (`RequireRole`) | N/A | N/A | **Missing Loading & API Error states.** |
| Admin | `AdminAkunPage.tsx` | **MISSING** | Yes | **MISSING** | Partial (missing password) | Yes (`RequireRole`) | **MISSING** | **MISSING** | **All async API states missing** (including `409 LAST_ADMIN_REQUIRED` / `SELF_ADMIN_CHANGE_BLOCKED` error banners). |
| Admin | `AdminPeriodePage.tsx` | **MISSING** | Yes | **MISSING** | Yes | Yes (`RequireRole`) | **MISSING** | **MISSING** | **All async API states missing** (including `409 PERIOD_IN_USE` error handling). |
| Admin | `AdminKonselingPage.tsx` | **MISSING** | Yes | **MISSING** | N/A | Yes (`RequireRole`) | N/A | N/A | **Missing Loading & API Error states.** |
| Admin | `AdminFeedbackPage.tsx` | **MISSING** | Yes | **MISSING** | Yes (`disableReason`) | Yes (`RequireRole`) | **MISSING** | **MISSING** | **All async API states missing.** |
| Admin | `AdminLaporanPage.tsx` | **MISSING** | Yes | **MISSING** | N/A | Yes (`RequireRole`) | N/A | N/A | **Missing Loading & API Error states.** |
| Admin | `AdminAktivitasPage.tsx` | **MISSING** | **MISSING** | **MISSING** | N/A | Yes (`RequireRole`) | N/A | N/A | **Unimplemented stub (`<div>ActivityPage</div>`).** |
| Admin | `AdminPengaturanPage.tsx` | Yes (Hero CRUD); **No (Profile)** | Yes (Hero) | Yes (`heroError`, `heroModalError`) | Yes | Yes (`RequireRole`) | Yes (`heroSaving`, `heroDeleting`, `heroBusyId`) | Yes (Hero state updated from API) | **Hero CRUD has complete UI states; Admin Profile section lacks async API states.** |
| Head LMI | `KepalaLMIBerandaPage.tsx` | **MISSING** | Yes | **MISSING** | N/A | Yes (`RequireRole`) | N/A | N/A | **Missing Loading & API Error states.** |
| Head LMI | `KepalaLMILaporanPage.tsx` | **MISSING** | Yes | **MISSING** | N/A | Yes (`RequireRole`) | N/A | N/A | **Missing Loading & API Error states.** |
| Head LMI | `KepalaLMIFeedbackPage.tsx` | **MISSING** | Yes | **MISSING** | N/A | Yes (`RequireRole`) | **MISSING** (no review action) | **MISSING** | **Missing Loading, API Error, and Review Status Mutation states.** |
| Head LMI | `KepalaLMIPengaturanPage.tsx` | **MISSING** | N/A | **MISSING** | Yes | Yes (`RequireRole`) | **MISSING** | **MISSING** | **Missing Loading, API Error, Async Submit & Refresh states.** |

---

## 10. Deployment Connectivity & Environment Audit

### 10.1 Current Environment & Transport Configuration

- **Frontend (`fe/src/lib/api.ts` & `fe/.env.example`):**
  - `fe/.env.example` defines `VITE_API_BASE_URL=http://127.0.0.1:3000/api/v1`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_PUBLISHABLE_KEY`.
  - `getApiBaseUrl()` in `fe/src/lib/api.ts`:
    ```ts
    const configured = import.meta.env.VITE_API_BASE_URL?.trim();
    if (configured) return configured.replace(/\/+$/, "");
    if (import.meta.env.DEV) return "http://127.0.0.1:3000/api/v1";
    throw new ApiError("VITE_API_BASE_URL belum dikonfigurasi untuk environment produksi.", 500, "API_NOT_CONFIGURED");
    ```
  - All API wrapper paths start with `/` (e.g. `/public/counselors`, `/bookings`), so there is **no double `/api/v1/api/v1` prefix bug** as long as `VITE_API_BASE_URL` ends with `/api/v1`.
- **Backend (`be/app.js`, `be/src/config/env.js` & `be/.env.example`):**
  - `be/src/config/env.js` defaults `PORT=3000`, `API_PREFIX="/api/v1"`, and `FRONTEND_ORIGINS="http://localhost:5173,http://127.0.0.1:5173"`.
  - `be/app.js` enforces a strict CORS origin check: if an incoming browser request includes an `Origin` header not listed in `env.frontendOrigins`, the server returns `403 ORIGIN_NOT_ALLOWED` (`"Origin frontend tidak diizinkan."`).

### 10.2 Connectivity Matrix Across Deployment Topologies

| Topology | Frontend Origin | Backend Target (`VITE_API_BASE_URL`) | Works on Same Dev Machine? | Works for Remote / Mobile Testers? | Blockers & Failure Modes |
|---|---|---|---|---|---|
| **1. Local Frontend + Local Backend** | `http://localhost:5173` or `http://127.0.0.1:5173` | `http://127.0.0.1:3000/api/v1` | **YES** | **NO** | Standard local development topology; works out-of-the-box. |
| **2. Vercel Frontend + Local Backend (`127.0.0.1:3000`)** | `https://<app>.vercel.app` | `http://127.0.0.1:3000/api/v1` | **NO (Blocked by CORS & Mixed Content/PNA unless configured)** | **NO (Impossible — `127.0.0.1` is visitor's own device)** | 1. **Loopback Scope:** For any tester on another laptop/phone, `127.0.0.1:3000` resolves to *their own device*, not the developer's machine (`ERR_CONNECTION_REFUSED`).<br>2. **Mixed Content / Private Network Access (PNA):** Modern browsers block `https://*.vercel.app` from fetching `http://127.0.0.1:3000` unless Private Network Access preflight headers (`Access-Control-Allow-Private-Network: true`) and HTTPS/localhost exemptions apply.<br>3. **CORS Rejection (`403 ORIGIN_NOT_ALLOWED`):** Unless the Vercel domain is added to `FRONTEND_ORIGINS` in `be/.env`, `be/app.js` rejects all requests from `https://<app>.vercel.app`. |
| **3. Vercel Frontend + Deployed Backend (or HTTPS Tunnel)** | `https://<app>.vercel.app` | `https://<backend-domain>/api/v1` | **YES** | **YES** | Requires deploying `be/` (e.g. to Vercel/Render/Railway) or exposing local `be/` via an HTTPS tunnel, setting `VITE_API_BASE_URL=https://<backend>/api/v1` in Vercel Frontend env, and adding `https://<app>.vercel.app` to `FRONTEND_ORIGINS` in Backend env. |

---

## 11. Integration Completeness Metrics

All percentages below are calculated directly from the current repository files inspected in Sections 3–8 (no historical numbers copied without re-verification):

### Metric 1: Backend Endpoint Integration Coverage (Denominator = 58 `/api/v1/*` Route Handlers)

| Classification | Count | Percentage (of 58 `/api/v1/*` Endpoints) | Percentage (of 57 UI-Applicable Endpoints) | Endpoints Included |
|---|---:|---:|---:|---|
| **1. Invoked by Frontend UI (Total Integrated + Partial)** | **23** | **39.66%** | **40.35%** | **18 Fully Integrated + 5 Partially Integrated** |
| ├─ **Fully Integrated in UI (Cat. A + Cat. C)** | **18** | **31.03%** | **31.58%** | Auth (`4/4`), Public (`5/5`), Client Reschedule (`1`), Client Feedback Mine (`1`), Notifications (`3/3`), Admin Hero Motivations (`4/4`) |
| └─ **Partially Integrated in UI (Cat. D)** | **5** | **8.62%** | **8.77%** | `GET /bookings`, `POST /bookings`, `PATCH /bookings/:id/status`, `GET /sessions`, `POST /sessions/:sessionId/feedback` |
| **2. Typed Wrapper Exists, UI Not Connected (Cat. E)** | **34** | **58.62%** | **59.65%** | Profile (`3`), `GET /bookings/:id` (`1`), Sessions (`2`), Counselor (`6`), Feedback Counselor/Admin/Head LMI (`6`), Admin Accounts/Pub/Periods/Counseling/Activity (`12`), Reporting/Dashboards (`4`) |
| **3. Backend-Only Without Wrapper (Cat. F)** | **0** | **0.00%** | **0.00%** | None (all 57 UI-applicable endpoints have typed wrappers) |
| **4. Operational / Health Only (Cat. G)** | **1** | **1.72%** | *N/A (excluded from 57)* | `GET /api/v1/health` (plus root `GET /` metadata handler in `be/app.js`) |
| **Total `/api/v1/*` Route Handlers** | **58** | **100.00%** | **100.00% (57 UI-applicable)** | **57/58 (98.28%) have typed frontend wrappers** |

---

### Metric 2: Frontend Page Integration Coverage (Denominator = 33 Route Pages in `fe/src/app/router.tsx`)

| Page Category | Total Pages | Fully Integrated (Live API) | Partially Integrated (Live + Mock/Gap) | Static / Local Widget by Design | Unintegrated (100% Mock / `localStorage` / Stub) | Live API Connected Rate (Full + Partial / API-Backed Pages) |
|---|---:|---:|---:|---:|---:|---:|
| **Public Pages** (`/`, `/konselor`, `/feedback`, `/tentang-kami`, `/panduan`, `/mood-tracker`) | 6 | 3 (`HomePage`, `CounselorPage`, `FeedbackPage`) | 0 | 3 (`AboutPage`, `PanduanPage`, `MoodTrackerPage`) | 0 | **3 / 3 (100.00%)** *(6/6 = 100% route-ready)* |
| **Auth Pages** (`/login`, `/register`) | 2 | 2 (`Login`, `Register`) | 0 | 0 | 0 | **2 / 2 (100.00%)** |
| **Client Pages** (`/klien/*`) | 6 | 1 (`KlienBerandaPage`) | 3 (`KlienPesananPage`, `KlienAktivitasPage`, `KlienRiwayatPage`) | 0 | 2 (`KlienKonselorPage`, `KlienPengaturanPage`) | **4 / 6 (66.67%)** |
| **Counselor Pages** (`/konselor/*`) | 7 | 0 | 0 | 0 | 7 (`Beranda`, `Permintaan`, `Aktivitas`, `Riwayat`, `Jadwal`, `Feedback`, `Pengaturan`) | **0 / 7 (0.00%)** |
| **Admin Pages** (`/admin/*`) | 8 | 0 | 1 (`AdminPengaturanPage` — Hero live, Profile localStorage) | 0 | 7 (`Beranda`, `Akun`, `Periode`, `Konseling`, `Feedback`, `Laporan`, `Aktivitas` stub) | **1 / 8 (12.50%)** |
| **Head LMI Pages** (`/kepala-lmi/*`) | 4 | 0 | 0 | 0 | 4 (`Beranda`, `Laporan`, `Feedback`, `Pengaturan`) | **0 / 4 (0.00%)** |
| **Total All Route Pages** | **33** | **6 (18.18%)** | **4 (12.12%)** | **3 (9.09%)** | **20 (60.61%)** | **10 / 30 API-Backed Pages (33.33%)** *(13 / 33 = 39.39% including static pages)* |

---

### Metric 3: Role Readiness Coverage

| Role / Workspace | API-Backed Pages Connected | Role Endpoints Invoked by Role UI | Core Workflows Operational | Role Readiness Score & Summary |
|---|---:|---:|---:|---|
| **Public & Auth** | **5 / 5 (100.00%)** *(+3 static/widget)* | **9 / 9 (100.00%)** | **2 / 2 (100.00%)** | **100.00% Ready** — All public discovery, hero quote, counselor directory, availability, public feedback, registration, login, session restore, and logout flows are live. |
| **Client (`client`)** | **4 / 6 (66.67%)** | **11 / 14 (78.57%)** *(incl. Auth/Notif/Public)* | **4 / 6 (66.67%)** | **66.67% Ready** — Dashboard, booking creation, reschedule, cancellation, session history, feedback submission, and notifications are live. Missing: `/klien/konselor` live directory, `/klien/pengaturan` profile & WhatsApp consent, and counselor name resolution in Activity/History. |
| **Counselor (`counselor`)** | **0 / 7 (0.00%)** *(Layout Bell/Logout only)* | **5 / 19 (26.32%)** *(Only Auth + Notifications; `0/12` domain endpoints)* | **0 / 6 (0.00%)** | **0.00% Page Readiness** — All 7 counselor pages use mock fixtures/Zustand. Counselor cannot create real availability slots, confirm/reject real client bookings, transition real sessions, view real feedback, or update their counselor profile from UI. |
| **Admin (`admin`)** | **1 / 8 (12.50%)** *(Hero CRUD only)* | **9 / 29 (31.03%)** *(Auth + Notifications + 4 Hero endpoints; `0/20` other admin/report endpoints)* | **1 / 7 (14.29%)** | **12.50% Page Readiness** — Only Hero Motivation CRUD in `AdminPengaturanPage` is connected. Account management, academic periods, counseling monitoring, feedback moderation, dashboard, reports, and activity logs are 100% mock/localStorage/stub. |
| **Head LMI (`head_lmi`)** | **0 / 4 (0.00%)** *(Layout Bell/Logout only)* | **5 / 15 (33.33%)** *(Only Auth + Notifications; `0/8` dashboard/report/feedback/profile endpoints)* | **0 / 4 (0.00%)** | **0.00% Page Readiness** — All 4 Head LMI pages use mock data and `localStorage` periods. |

---

### Metric 4: Workflow Readiness Coverage (Denominator = 8 Core Business Workflows)

| Workflow | Status | Readiness % | Summary |
|---|---|---:|---|
| 1. Authentication & Session Lifecycle | **Complete** | **100.00%** | Register, login, `/auth/me` hydration, role route guards, and `/auth/logout` are fully wired. |
| 2. Public Information Flow | **Complete** | **100.00%** | Hero quotes, counselors, published periods, public availability, and public feedback are live. |
| 3. Booking Lifecycle | **Partial (Client Half Only)** | **42.86% (3/7 steps)** | Client create, reschedule, and cancel are live; Counselor availability creation, request queue, and confirm/reject/reschedule decision are still mock. |
| 4. Counseling Session Lifecycle | **Partial (Client Read Only)** | **25.00% (1/4 steps)** | Client session list is live; Counselor session list, detail, and `ongoing`/`completed`/`cancelled` transitions are still mock. |
| 5. Feedback Lifecycle | **Partial (Client & Public Only)** | **50.00% (3/6 steps)** | Client submit, client `/feedback/mine`, and public `/public/feedback` are live; Admin moderation, Head LMI review, and Counselor feedback view are still mock. |
| 6. Notification Lifecycle | **Complete** | **100.00%** | Server-side creation + `NotificationBell` list, unread badge, mark single read, and mark all read are live across all 4 roles. |
| 7. Admin Management Lifecycle | **Partial (Hero CRUD Only)** | **16.67% (1/6 modules)** | Hero Motivation CRUD is live; Accounts, Publication, Periods, Counseling Monitoring, and Activity Log are not integrated. |
| 8. Reporting & Executive Oversight | **Not Integrated** | **0.00% (0/4 modules)** | Admin Dashboard, Admin Reports, Head LMI Dashboard, and Head LMI Reports all read mock data. |
| **Overall Workflow Readiness** | **3 Complete / 4 Partial / 1 Unintegrated** | **54.31% avg** *(3/8 = 37.50% fully complete)* | Cross-role loops (Client <-> Counselor <-> Admin <-> Head LMI) are currently broken at the Counselor and Admin UI layers. |

---

### Metric 5: Mock Data Elimination Progress (Denominator = 24 Files in `fe/src/data/mock/` + 3 Zustand Stores)

| Metric | Count | Percentage | Details |
|---|---:|---:|---|
| **Mock Files (`fe/src/data/mock/*`)** | **24 total** | **100.00%** | |
| ├─ Static UI Copy / Form Option Catalogs (Keep by design — Cat. D) | 2 | 8.33% | `guideContent.tsx`, `intakeOptions.ts` (question labels) |
| ├─ Already Replaced by Live API in Pages (No active page runtime dependency) | 4 | 16.67% | `clientActivity.ts`, `clientHistory.ts`, `publicFeedback.ts` (used only by legacy `feedbackStore`), `publicShowcases.ts` (used only by unmounted components) |
| └─ **Still Actively Imported by Unintegrated Pages/Stores (Cat. A)** | **18** | **75.00%** | `academicPeriods.ts`, `adminAccounts.ts`, `adminCounseling.ts`, `adminFeedback.ts`, `adminReports.ts`, `clientCounselors.ts`, `counselorActivity.ts`, `counselorDashboard.ts`, `counselorFeedback.ts`, `counselorHistory.ts`, `counselorProfile.ts`, `counselorRequests.ts`, `counselorSchedule.ts`, `dashboardOverview.ts`, `headlmiFeedback.ts`, `headlmiReports.ts`, `index.ts`, `reportCommon.ts` |
| **Legacy In-Memory Zustand Stores (`bookingStore`, `feedbackStore`, `notificationStore`)** | **3 total** | **0.00% retired** | All 3 stores remain imported by Counselor/Admin pages and must be disconnected as those pages move to backend APIs. |

---

## 12. Critical & High-Priority Findings

### P0 — Critical Cross-Role Workflow Blockers

1. **`P0-01` — Counselor Workspace Has 0% Page Integration (`KonselorJadwalPage`, `KonselorPermintaanPage`, `KonselorAktivitasPage`, `KonselorBerandaPage`):**
   - Because all 7 counselor pages still use mock data and in-memory Zustand stores, the core multi-role loop (**Counselor creates availability -> Client books slot -> Counselor confirms/rejects/requests reschedule -> Session is created -> Counselor starts & completes session -> Client submits feedback**) cannot be completed through the UI.
2. **`P0-02` — Counselor Booking Decision Modal Violates Backend Contract (`KonselorPermintaanPage.tsx`, `KonselorBerandaPage.tsx`):**
   - `PATCH /api/v1/bookings/:id/status` requires `session_format: "online" | "offline"` when confirming (`status: "confirmed"`) and requires a non-empty `reason` when rejecting (`status: "rejected"`) or requesting reschedule (`status: "reschedule_requested"`). The current Counselor UI modals lack `session_format` selection, lack a rejection `reason` input, and lack a `"Minta Jadwal Ulang"` button.
3. **`P0-03` — Counselor Schedule Grid Lacks ISO Timestamp & Period Mapping (`KonselorJadwalPage.tsx`):**
   - `POST /api/v1/counselor/availability` requires UTC ISO `starts_at`/`ends_at`, `session_format`, `capacity`, `status`, and an active/published `academic_period_id` UUID, whereas `KonselorJadwalPage` uses local date keys (`YYYY-MM-DD`) and minute offsets (`540`) without slot UUIDs or period UUIDs.
4. **`P0-04` — Deployment Connectivity Blocker Between Vercel Frontend and Local Backend (`fe/src/lib/api.ts`, `be/src/config/env.js`):**
   - A frontend deployed on Vercel (`https://*.vercel.app`) cannot communicate with a backend running only on `http://127.0.0.1:3000` for external testers (`127.0.0.1` points to the visitor's own device, browsers block mixed-content/PNA requests, and `FRONTEND_ORIGINS` defaults to `localhost:5173`).

### P1 — High-Priority Role & Data Integrity Gaps

5. **`P1-01` — Admin Master Data & Governance Pages Are Unintegrated (`AdminAkunPage`, `AdminPeriodePage`, `AdminFeedbackPage`, `AdminKonselingPage`, `AdminBerandaPage`, `AdminLaporanPage`):**
   - Admin cannot create/disable real user accounts, publish counselors (`PATCH /admin/counselors/:id/publication`), manage real PostgreSQL `academic_periods` (needed by booking/availability RPCs!), or moderate real client feedback (`pending -> shown/disabled`) from the UI.
6. **`P1-02` — Academic Period Split-Brain (`localStorage["sicare.periods"]` vs. `public.academic_periods`):**
   - `AdminPeriodePage`, `AdminKonselingPage`, `AdminFeedbackPage`, `KonselorRiwayatPage`, `KepalaLMILaporanPage`, and `KepalaLMIFeedbackPage` all read `loadPeriods()` from `localStorage` with non-UUID slug IDs (`2025-2026-ganjil`), while backend endpoints (`GET /admin/feedback`, `GET /admin/counseling`, `GET /admin/reports`, `GET /head-lmi/reports`, `POST /counselor/availability`) require canonical PostgreSQL UUIDs for `academic_period_id`.
7. **`P1-03` — Client Directory Page Still Uses Mock Counselors (`KlienKonselorPage.tsx`):**
   - While `HomePage`, `CounselorPage`, `KlienBerandaPage`, and `KlienPesananPage` call `getPublicCounselors()`, `/klien/konselor` (`KlienKonselorPage.tsx`) still renders mock `CLIENT_DIRECTORY_COUNSELORS` with non-UUID IDs (`1, 2`), and clicking "Pesan Sesi" passes a mock counselor name that may not match published backend counselors.
8. **`P1-04` — Client Activity & History Pages Hardcode `"Konselor"` (`KlienAktivitasPage.tsx`, `KlienRiwayatPage.tsx`):**
   - Both pages display literal `"Konselor"` instead of resolving `booking.counselor_id` / `session.counselor_id` against `getPublicCounselors()`. Additionally, `KlienAktivitasPage` filters out `rejected` and `cancelled` bookings, hiding `booking.cancellation_reason` from the client.
9. **`P1-05` — Client & Role Profile Settings Are Disconnected (`KlienPengaturanPage`, `KonselorPengaturanPage`, `AdminPengaturanPage`, `KepalaLMIPengaturanPage`):**
   - `GET /api/v1/profile`, `PATCH /api/v1/profile`, `PATCH /api/v1/profile/whatsapp-consent`, `GET /api/v1/counselor/profile`, and `PATCH /api/v1/counselor/profile` have `0` callers in the frontend.
10. **`P1-06` — Head LMI Dashboard Navigation Bug & 0% Integration (`KepalaLMIBerandaPage`, `KepalaLMILaporanPage`, `KepalaLMIFeedbackPage`):**
    - `KepalaLMIBerandaPage` navigates to `/admin/laporan` (forbidden for `head_lmi`) instead of `/kepala-lmi/laporan`, and all Head LMI pages read mock data.

### P2 — Governance & SOP Boundaries (Must Not Be Improvised)

11. **`P2-01` — Clinical Intake, Informed Consent, Digital Signature & Session Notes Have No Backend Schema or Approved SOP:**
    - `KlienPesananPage` collects step-2 intake questionnaires and step-3 digital canvas signatures locally; `KonselorPermintaanPage`, `KonselorAktivitasPage`, and `KonselorRiwayatPage` display mock intakes and clinical notes (`noteCounselor`, `noteClient`, `plan`). Per `AGENTS.md §3`, **do not** invent database tables/columns for clinical records or claim they are saved to the server until official clinical SOPs are ratified.

---

## 13. Recommended Implementation Sequence & Detailed Roadmap (Batches 1.4b – 1.4f)

To eliminate mock dependencies methodically without regressions, frontend-backend integration should execute in **five focused, sequential batches (Batches 1.4b through 1.4f)** before unblocking the 4-account live ownership verification (Batch 1.3c re-run).

---

### Batch 1.4b — Client Remaining Integrations

- **Objective:** Bring the **Client (`client`)** workspace to 100% live integration across all 6 client pages.
- **Exact Features to Integrate:**
  1. **Client Counselor Directory (`/klien/konselor`):** Replace `CLIENT_DIRECTORY_COUNSELORS` with `getPublicCounselors()`, mapping `PublicCounselor` (`profile_id`, `public_name`, `headline`, `bio`, `specialties`, `years_experience`, `photo_path`) to the directory cards, and passing `counselorId: counselor.profile_id` on navigation to `/klien/pesanan`.
  2. **Counselor Name Resolution & Cancelled/Rejected Visibility in Client Activity & History (`/klien/aktivitas`, `/klien/riwayat`):** Load `getPublicCounselors()` in parallel with bookings/sessions (matching `KlienBerandaPage`) to display real counselor names and specialties instead of hardcoded `"Konselor"`. In `KlienAktivitasPage`, include `rejected` and `cancelled` bookings in a secondary section/filter so clients can see `cancellation_reason`.
  3. **Client Profile & WhatsApp Consent (`/klien/pengaturan`):** Replace hardcoded `ACCOUNT` (`Yusli Ngongano`) and `INITIAL` with `sicareApi.getProfile()`, `sicareApi.updateProfile({ full_name, phone_e164 })`, and `sicareApi.setWhatsAppConsent(whatsapp_opt_in)` (with `useAuth().refreshProfile()` after save). Keep unsupported demographic fields read-only or clearly labeled as campus master attributes.
- **Exact Frontend Files Involved:**
  - [`fe/src/pages/client/KlienKonselorPage.tsx`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/pages/client/KlienKonselorPage.tsx)
  - [`fe/src/pages/client/KlienAktivitasPage.tsx`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/pages/client/KlienAktivitasPage.tsx)
  - [`fe/src/pages/client/KlienRiwayatPage.tsx`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/pages/client/KlienRiwayatPage.tsx)
  - [`fe/src/pages/client/KlienPengaturanPage.tsx`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/pages/client/KlienPengaturanPage.tsx)
- **Exact Backend Endpoints Involved:**
  - `GET /api/v1/public/counselors`
  - `GET /api/v1/bookings`, `GET /api/v1/sessions`
  - `GET /api/v1/profile`, `PATCH /api/v1/profile`, `PATCH /api/v1/profile/whatsapp-consent`
- **Expected API Contracts:**
  - `PATCH /api/v1/profile` accepts `{ full_name?: string, phone_e164?: string | null }` (`^\+[1-9][0-9]{7,14}$`). Helper normalizes Indonesian `08...` inputs to `+628...` before sending.
  - `PATCH /api/v1/profile/whatsapp-consent` accepts `{ whatsapp_opt_in: boolean }` (requires `phone_e164` to be saved first when `whatsapp_opt_in === true`).
- **Dependencies:** None (all wrappers already exist in `publicApi.ts` and `sicareApi.ts`).
- **Acceptance Criteria:**
  1. Zero runtime imports of `CLIENT_DIRECTORY_COUNSELORS` in `KlienKonselorPage.tsx`.
  2. `KlienAktivitasPage` and `KlienRiwayatPage` display real counselor names from `counselor_id` lookup.
  3. `KlienPengaturanPage` loads real authenticated user profile, saves `full_name` and `phone_e164`, and toggles `whatsapp_opt_in` only after server confirmation.
  4. Loading, empty, validation, error, and anti-double-submit states work on all 4 modified pages.
- **Automated Validation:** `cd be && npm run check && npm test`, `cd fe && npm run lint && npm run build`.

---

### Batch 1.4c — Counselor Integrations

- **Objective:** Connect all **7 Counselor (`counselor`)** pages to live backend endpoints, completing the cross-role booking, schedule, session, feedback, and counselor profile loops.
- **Exact Features to Integrate:**
  1. **Counselor Schedule & Availability CRUD (`/konselor/jadwal`):** Wire `KonselorJadwalPage` to `counselorApi.listAvailability()`, `createAvailability()`, `updateAvailability()`, `deleteAvailability()`, and `getPublicPeriods()` (for active `academic_period_id` UUID). Convert UI date + hour slots to WITA (`+08:00`) ISO timestamps (`starts_at`, `ends_at`).
  2. **Counselor Incoming Booking Queue & Decisions (`/konselor/permintaan`):** Replace `useBookingStore` and mock `intakes` with `sicareApi.listBookings()` and `sicareApi.transitionBookingStatus(id, payload)`. Update the decision modal to support:
     - `status: "confirmed"` with required `session_format: "online" | "offline"` and optional `room` / `meeting_url`.
     - `status: "rejected"` with required `reason` (1–500 chars).
     - `status: "reschedule_requested"` with required `reason` (1–500 chars).
     - Display `booking.client_checkin_summary` as the client check-in note (do not render fake clinical `intakes`).
  3. **Counselor Active Sessions (`/konselor/aktivitas`):** Replace `buildDummySessions` with `sicareApi.listSessions()` (and `sicareApi.listBookings()` for booking context) and wire session status transitions (`ongoing`, `completed`, `cancelled`) to `counselorApi.transitionSessionStatus(id, status)`. Clearly gate/disable unbacked clinical note fields (`noteCounselor`, `noteClient`, `plan`) per `AGENTS.md §3`.
  4. **Counselor Dashboard (`/konselor`):** Replace `useCounselorDashboard` mock data with live `sicareApi.listBookings()`, `sicareApi.listSessions()`, `counselorApi.listFeedback()`, and `sicareApi.transitionBookingStatus()`.
  5. **Counselor Session History (`/konselor/riwayat`):** Replace mock `clients` (`counselorHistory.ts`) and `loadPeriods()` (`localStorage`) with `sicareApi.listSessions()` and `getPublicPeriods()`. Preserve the UI privacy screen if desired, but never display fake clinical notes.
  6. **Counselor Approved Feedback (`/konselor/feedback`):** Replace `feedbackData` and `useFeedbackStore` with `counselorApi.listFeedback()` and `getPublicPeriods()`.
  7. **Counselor Profile Settings (`/konselor/pengaturan`):** Replace `INITIAL_COUNSELOR_PROFILE` with `sicareApi.getProfile()` / `updateProfile()` (for `full_name`, `phone_e164`) and `counselorApi.getProfile()` / `updateProfile()` (for `public_name`, `headline`, `bio`, `specialties`, `years_experience`, `photo_path`). Do not send base64 data URLs to `photo_path` (max 1,000 chars).
- **Exact Frontend Files Involved:**
  - [`fe/src/pages/counselor/KonselorJadwalPage.tsx`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/pages/counselor/KonselorJadwalPage.tsx)
  - [`fe/src/pages/counselor/KonselorPermintaanPage.tsx`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/pages/counselor/KonselorPermintaanPage.tsx)
  - [`fe/src/pages/counselor/KonselorAktivitasPage.tsx`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/pages/counselor/KonselorAktivitasPage.tsx) & [`fe/src/components/counselor/activity/ActivityDialogs.tsx`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/components/counselor/activity/ActivityDialogs.tsx)
  - [`fe/src/pages/counselor/KonselorBerandaPage.tsx`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/pages/counselor/KonselorBerandaPage.tsx) & [`fe/src/features/counselor/dashboard/useCounselorDashboard.ts`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/features/counselor/dashboard/useCounselorDashboard.ts)
  - [`fe/src/pages/counselor/KonselorRiwayatPage.tsx`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/pages/counselor/KonselorRiwayatPage.tsx)
  - [`fe/src/pages/counselor/KonselorFeedbackPage.tsx`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/pages/counselor/KonselorFeedbackPage.tsx)
  - [`fe/src/pages/counselor/KonselorPengaturanPage.tsx`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/pages/counselor/KonselorPengaturanPage.tsx)
- **Exact Backend Endpoints Involved:**
  - `GET/POST/PATCH/DELETE /api/v1/counselor/availability*` (4)
  - `GET/PATCH /api/v1/counselor/profile` (2)
  - `GET /api/v1/bookings`, `GET /api/v1/bookings/:id`, `PATCH /api/v1/bookings/:id/status` (3)
  - `GET /api/v1/sessions`, `GET /api/v1/sessions/:id`, `PATCH /api/v1/sessions/:id/status` (3)
  - `GET /api/v1/feedback/counselor` (1)
  - `GET/PATCH /api/v1/profile` (2)
  - `GET /api/v1/public/periods` (1)
- **Dependencies:** Batch 1.4b recommended first so client-counselor flows are symmetric.
- **Acceptance Criteria:**
  1. All 7 counselor pages fetch and mutate live backend data using canonical UUIDs.
  2. Counselor can create availability slots, confirm/reject/request-reschedule on bookings, transition sessions (`ongoing -> completed / cancelled`), view approved feedback, and update counselor profile.
  3. Zero fake clinical notes or fake intake answers are displayed or claimed to be persisted.
- **Automated Validation:** `cd be && npm run check && npm test`, `cd fe && npm run lint && npm run build`.

---

### Batch 1.4d — Admin Integrations

- **Objective:** Connect all **8 Admin (`admin`)** pages to live backend endpoints, eliminating `localStorage["sicare.periods"]`, `localStorage["sicare_admin_profile_v1"]`, `useBookingStore`, `useFeedbackStore`, and `useNotificationStore`.
- **Exact Features to Integrate:**
  1. **Academic Period Management (`/admin/periode`):** Wire `AdminPeriodePage` to `adminApi.listPeriods()`, `createPeriod()`, `updatePeriod()`, `deletePeriod()`. Map UI fields to `{ code, name, starts_on, ends_on, is_active, is_published }`, add `is_active` and `is_published` toggles, and handle `409 PERIOD_IN_USE` on delete.
  2. **Account & Counselor Publication Management (`/admin/akun`):** Wire `AdminAkunPage` to `adminApi.listAccounts()`, `getAccount()`, `createAccount()`, `updateAccount()`, `disableAccount()`, and `setCounselorPublication()`. Add password input on account creation, map roles to `{ app_role, member_category }`, add counselor `is_public` toggle, and surface `409 SELF_ADMIN_CHANGE_BLOCKED` / `LAST_ADMIN_REQUIRED` errors.
  3. **Feedback Moderation (`/admin/feedback`):** Wire `AdminFeedbackPage` to `adminApi.listFeedback()`, `getFeedbackStatistics()`, `getFeedbackDetail()`, `moderateFeedback()`, and `adminApi.listPeriods()`. Remove `useFeedbackStore` and `useNotificationStore` calls (backend RPC `sicare_moderate_feedback` already creates client notifications).
  4. **Counseling Monitoring (`/admin/konseling`):** Wire `AdminKonselingPage` to `adminApi.listCounseling()`, `adminApi.listPeriods()`, and `getPublicCounselors()` (or `adminApi.listAccounts({ role: "counselor" })`). Render `client_alias` and administrative metadata from `AdminCounselingMonitoringItem`.
  5. **Admin Operational Dashboard (`/admin`):** Wire `AdminBerandaPage` and `DashboardSections.tsx` to `reportingApi.getAdminDashboard()` and `adminApi.listCounseling({ limit: 5 })`.
  6. **Admin Counseling Reports (`/admin/laporan`):** Wire `AdminLaporanPage` to `reportingApi.getAdminReports()`, `adminApi.listPeriods()`, and `adminApi.listCounseling()`.
  7. **Admin Activity Audit Log (`/admin/aktivitas`):** Replace the `<div>ActivityPage</div>` stub in `AdminAktivitasPage.tsx` with a real audit log table wired to `adminApi.listActivity()` (filterable by `actor_role`, `entity_type`, `action`).
  8. **Admin Profile Settings (`/admin/pengaturan`):** Keep the working Hero Motivation CRUD section intact and wire the Admin Profile panel to `sicareApi.getProfile()` and `sicareApi.updateProfile()` instead of `localStorage["sicare_admin_profile_v1"]`.
- **Exact Frontend Files Involved:**
  - [`fe/src/pages/admin/AdminPeriodePage.tsx`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/pages/admin/AdminPeriodePage.tsx)
  - [`fe/src/pages/admin/AdminAkunPage.tsx`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/pages/admin/AdminAkunPage.tsx)
  - [`fe/src/pages/admin/AdminFeedbackPage.tsx`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/pages/admin/AdminFeedbackPage.tsx)
  - [`fe/src/pages/admin/AdminKonselingPage.tsx`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/pages/admin/AdminKonselingPage.tsx)
  - [`fe/src/pages/admin/AdminBerandaPage.tsx`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/pages/admin/AdminBerandaPage.tsx) & [`fe/src/components/admin/dashboard/DashboardSections.tsx`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/components/admin/dashboard/DashboardSections.tsx)
  - [`fe/src/pages/admin/AdminLaporanPage.tsx`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/pages/admin/AdminLaporanPage.tsx)
  - [`fe/src/pages/admin/AdminAktivitasPage.tsx`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/pages/admin/AdminAktivitasPage.tsx)
  - [`fe/src/pages/admin/AdminPengaturanPage.tsx`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/pages/admin/AdminPengaturanPage.tsx)
- **Exact Backend Endpoints Involved:**
  - All 16 endpoints in `admin.routes.js`
  - `GET /api/v1/admin/feedback/statistics`, `GET /api/v1/admin/feedback`, `GET /api/v1/admin/feedback/:id`, `PATCH /api/v1/admin/feedback/:id/moderation`
  - `GET /api/v1/admin/dashboard`, `GET /api/v1/admin/reports`
  - `GET /api/v1/profile`, `PATCH /api/v1/profile`
- **Acceptance Criteria:**
  1. All 8 Admin pages read and mutate live backend data using canonical PostgreSQL UUIDs.
  2. Zero writes to `localStorage["sicare.periods"]` or `localStorage["sicare_admin_profile_v1"]`.
  3. Admin can manage accounts, toggle counselor publication, manage academic periods, moderate feedback, view privacy-safe counseling monitoring, inspect audit logs, and generate reports.
- **Automated Validation:** `cd be && npm run check && npm test`, `cd fe && npm run lint && npm run build`.

---

### Batch 1.4e — Head LMI Integrations

- **Objective:** Connect all **4 Head LMI (`head_lmi`)** pages to live backend endpoints for executive oversight, aggregate reporting, feedback review (`new -> reviewed -> resolved`), and account settings.
- **Exact Features to Integrate:**
  1. **Head LMI Executive Dashboard (`/kepala-lmi`):** Wire `KepalaLMIBerandaPage` and `components/headlmi/dashboard/DashboardSections.tsx` to `reportingApi.getHeadLmiDashboard()`. Fix the header CTA button to navigate to `/kepala-lmi/laporan` instead of `/admin/laporan`.
  2. **Head LMI Counseling Reports (`/kepala-lmi/laporan`):** Wire `KepalaLMILaporanPage` to `reportingApi.getHeadLmiReports()` and `getPublicPeriods()` (replacing `loadPeriods()` from `localStorage` and mock `SESSIONS`).
  3. **Head LMI Feedback Evaluation & Review (`/kepala-lmi/feedback`):** Wire `KepalaLMIFeedbackPage` to `adminApi.listFeedback()`, `adminApi.getFeedbackStatistics()`, `adminApi.reviewFeedback(id, reviewStatus)`, and `getPublicPeriods()`. Add UI controls on each feedback card allowing Head LMI to transition `review_status` (`new -> reviewed -> resolved`).
  4. **Head LMI Account Settings (`/kepala-lmi/pengaturan`):** Wire `KepalaLMIPengaturanPage` to `sicareApi.getProfile()` and `sicareApi.updateProfile({ full_name, phone_e164 })`.
- **Exact Frontend Files Involved:**
  - [`fe/src/pages/headlmi/KepalaLMIBerandaPage.tsx`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/pages/headlmi/KepalaLMIBerandaPage.tsx) & [`fe/src/components/headlmi/dashboard/DashboardSections.tsx`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/components/headlmi/dashboard/DashboardSections.tsx)
  - [`fe/src/pages/headlmi/KepalaLMILaporanPage.tsx`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/pages/headlmi/KepalaLMILaporanPage.tsx)
  - [`fe/src/pages/headlmi/KepalaLMIFeedbackPage.tsx`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/pages/headlmi/KepalaLMIFeedbackPage.tsx)
  - [`fe/src/pages/headlmi/KepalaLMIPengaturanPage.tsx`](file:///c:/Users/marco/Documents/codes/SiCARE/fe/src/pages/headlmi/KepalaLMIPengaturanPage.tsx)
- **Exact Backend Endpoints Involved:**
  - `GET /api/v1/head-lmi/dashboard`, `GET /api/v1/head-lmi/reports`
  - `GET /api/v1/admin/feedback/statistics`, `GET /api/v1/admin/feedback`, `GET /api/v1/admin/feedback/:id`, `PATCH /api/v1/admin/feedback/:id/review`
  - `GET /api/v1/public/periods`
  - `GET /api/v1/profile`, `PATCH /api/v1/profile`
- **Acceptance Criteria:**
  1. All 4 Head LMI pages fetch and update live backend data with loading, empty, error, and mutation states.
  2. Head LMI can update feedback `review_status` (`new`, `reviewed`, `resolved`) and export real CSV/PDF reports.
  3. CTA button on `/kepala-lmi` navigates cleanly to `/kepala-lmi/laporan`.
- **Automated Validation:** `cd be && npm run check && npm test`, `cd fe && npm run lint && npm run build`.

---

### Batch 1.4f — End-to-End Integration Verification & Mock Cleanup

- **Objective:** Retire dead mock data stores/files, verify all 57 UI-applicable backend endpoints have active UI callers or verified consumers, validate deployment connectivity, and execute end-to-end integration tests across all 4 roles.
- **Exact Scope:**
  1. **Retire Legacy In-Memory Stores & Unused Mock Modules:** Remove runtime dependencies on `useBookingStore`, `useFeedbackStore`, `useNotificationStore`, `localStorage["sicare.periods"]`, and the 18 Category-A mock files in `fe/src/data/mock/*` (preserving only Category-D static copy `guideContent.tsx` and `intakeOptions.ts`).
  2. **Clean Up Layout Props:** Remove unused `recipientId={DEMO_NOTIFICATION_RECIPIENTS.*}` props passed to `<NotificationBell />` in `KonselorLayout`, `AdminLayout`, and `KepalaLMILayout`.
  3. **Automated Integration & Contract Tests:** Add automated tests verifying that no role page imports Category-A mock data or legacy stores, and that all 30 API-backed pages invoke the canonical API wrappers.
  4. **Re-run Live Verification Suites:** Execute `npm run verify:live` and (once the 4 non-production test tokens and paired resources are supplied) `npm run verify:ownership` (Batch 1.3c) to confirm 100% live cross-user ownership and RLS enforcement.
- **Automated Validation:** `cd be && npm run check && npm test`, `cd fe && npm run lint && npm run build`, `npm run verify:live`, `npm run verify:ownership`.

---

## 14. Blockers & Dependencies

1. **Clinical SOP Blocker for Intake, Consent, Digital Signature & Session Notes (`AGENTS.md §3`):**
   - `KlienPesananPage` (intake answers & canvas signature), `KonselorPermintaanPage` (intake preview), `KonselorAktivitasPage` (counselor/client session notes & follow-up plan), and `KonselorRiwayatPage` (session notes) cannot persist sensitive clinical records until the SOP owner ratifies the exact fields, encryption/access controls, retention period, audit rules, and deletion policy, and a corresponding Supabase migration is approved.
2. **Backend Deployment / HTTPS Tunnel Dependency for External Team Testing:**
   - Before team testing on Vercel (`https://*.vercel.app`), the Express backend (`be/`) must either be deployed to a public HTTPS host (e.g., Vercel root `be/`) or exposed via a secure HTTPS tunnel, with `VITE_API_BASE_URL` pointing to that HTTPS URL and `FRONTEND_ORIGINS` on the backend updated to include the Vercel domain.
3. **Active & Published Academic Period Prerequisite in Database:**
   - `POST /api/v1/counselor/availability` and `POST /api/v1/bookings` require at least one `public.academic_periods` row with `is_active = true` and `is_published = true` whose date range covers the target slot dates. Integrating `AdminPeriodePage` (Batch 1.4d) or ensuring an active published period exists in Supabase is a prerequisite for live Counselor schedule creation and Client booking tests.
4. **Four-Account Live Ownership Verification (Batch 1.3c) Remains Deferred Until Post-Integration:**
   - Per project direction, live 4-account testing (`SICARE_CLIENT_A_TOKEN`, `SICARE_CLIENT_B_TOKEN`, `SICARE_COUNSELOR_A_TOKEN`, `SICARE_COUNSELOR_B_TOKEN`) is deferred until Batches 1.4b–1.4e complete the frontend-backend integrations so that both API/RLS ownership and full UI workflows can be tested together.
