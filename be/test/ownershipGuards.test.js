import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import http from "node:http";
import { PassThrough } from "node:stream";
import { test } from "node:test";
import app from "../app.js";
import { setSupabaseAdminClientForTests } from "../src/config/supabase.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const auth = read("../src/middleware/auth.js");
const booking = read("../src/routes/booking.routes.js");
const session = read("../src/routes/session.routes.js");
const feedback = read("../src/routes/feedback.routes.js");
const notification = read("../src/routes/notification.routes.js");
const counselor = read("../src/routes/counselor.routes.js");
const admin = read("../src/routes/admin.routes.js");
const coreMigration = read("../../supabase/migrations/20261027000000_sicare_core_schema.sql");
const domainMigration = read("../../supabase/migrations/20261028000000_sicare_booking_sessions_feedback_notifications.sql");
const apiTypes = read("../../fe/src/types/api.ts");

const migrationsDir = new URL("../../supabase/migrations/", import.meta.url);
const sortedMigrations = readdirSync(migrationsDir)
  .filter((name) => name.endsWith(".sql"))
  .sort((a, b) => a.localeCompare(b))
  .map((filename) => ({
    filename,
    sql: readFileSync(new URL(filename, migrationsDir), "utf8"),
  }));

/**
 * Discovers the latest migration (in chronological filename order) that defines or
 * replaces `public.<functionName>`, and extracts its active SQL definition and
 * subsequent privilege statements.
 */
function latestFunctionDefinition(functionName) {
  const marker = `create or replace function public.${functionName}`;
  let found = null;
  for (const entry of sortedMigrations) {
    const start = entry.sql.toLowerCase().indexOf(marker.toLowerCase());
    if (start !== -1) {
      const rest = entry.sql.slice(start);
      const endMatch = /\$\$\s*;/i.exec(rest);
      assert.ok(endMatch, `Missing closing $$; for ${functionName} in ${entry.filename}`);
      const bodyEnd = start + endMatch.index + endMatch[0].length;
      found = {
        filename: entry.filename,
        body: entry.sql.slice(start, bodyEnd),
        tail: entry.sql.slice(bodyEnd),
      };
    }
  }
  assert.ok(found, `Function public.${functionName} not found in any migration`);
  return found;
}

// ============================================================================
// PART 1: Static & Active SQL Migration Ownership Guards
// ============================================================================

test("authentication binds the profile to the verified Supabase user and rejects inactive accounts", () => {
  assert.match(auth, /auth\.getUser\(match\[1\]\)/);
  assert.match(auth, /\.eq\("id", authData\.user\.id\)/);
  assert.match(auth, /profile\.account_status !== "active"/);
  assert.match(auth, /roles\.includes\(request\.auth\.profile\.app_role\)/);
});

test("booking list, detail, and active SQL transition enforce party ownership", () => {
  assert.match(booking, /query = profile\.app_role === "client" \? query\.eq\("client_id", profile\.id\) : query\.eq\("counselor_id", profile\.id\)/);
  assert.match(booking, /query\.eq\("client_id", request\.auth\.user\.id\)/);
  assert.match(booking, /query\.eq\("counselor_id", request\.auth\.user\.id\)/);

  const transition = latestFunctionDefinition("sicare_transition_booking");
  assert.equal(
    transition.filename,
    "20261031180000_sicare_group_consent_workflow.sql",
    "Must inspect the latest active sicare_transition_booking definition rather than the superseded migration",
  );
  assert.match(transition.body, /where p\.id = p_actor_id and p\.account_status = 'active'/);
  assert.match(transition.body, /if v_actor_role = 'counselor' and v_booking\.counselor_id = p_actor_id then/);
  assert.match(transition.body, /elsif v_actor_role = 'client' and v_booking\.client_id = p_actor_id then/);
  assert.match(transition.body, /if p_target_status <> 'cancelled'/);
  assert.match(transition.body, /BOOKING_SESSION_ALREADY_STARTED/);
  assert.match(transition.body, /else\s+raise exception using errcode = 'P0001', message = 'BOOKING_FORBIDDEN'/);
  assert.match(transition.tail, /revoke all on function public\.sicare_transition_booking\(uuid, uuid, text, text, text, text\)\s+from public, anon, authenticated/i);
  assert.match(transition.tail, /grant execute on function public\.sicare_transition_booking\(uuid, uuid, text, text, text, text\)\s+to service_role/i);
});

test("booking creation and rescheduling validate the canonical client identity", () => {
  const create = latestFunctionDefinition("sicare_create_booking");
  assert.match(create.body, /p\.id = p_client_id and p\.app_role = 'client' and p\.account_status = 'active'/);

  const reschedule = latestFunctionDefinition("sicare_reschedule_booking");
  assert.equal(reschedule.filename, "20261031120000_sicare_whatsapp_outbox_fonnte.sql");
  assert.match(reschedule.body, /v_booking\.client_id <> p_client_id/);
  assert.match(reschedule.body, /p\.id = p_client_id[\s\S]*p\.app_role = 'client'[\s\S]*p\.account_status = 'active'/);
  assert.match(reschedule.body, /v_slot\.counselor_id <> v_booking\.counselor_id/);
});

test("session list/detail and state changes enforce booking-party or counselor ownership", () => {
  assert.match(session, /bookingQuery\.eq\("client_id", request\.auth\.user\.id\)/);
  assert.match(session, /bookingQuery\.eq\("counselor_id", request\.auth\.user\.id\)/);
  const transition = latestFunctionDefinition("sicare_transition_session");
  assert.match(transition.body, /v_session\.counselor_id <> p_actor_id/);
  assert.match(transition.body, /p\.app_role = 'counselor' and p\.account_status = 'active'/);
});

test("feedback reads are scoped by client or counselor and submission requires an eligible owned session", () => {
  assert.match(feedback, /\.eq\("client_id", _request\.auth\.user\.id\)/);
  assert.match(feedback, /\.eq\("counselor_id", request\.auth\.user\.id\)/);
  const submit = latestFunctionDefinition("sicare_submit_feedback");
  assert.match(submit.body, /s\.id = p_session_id and s\.status = 'completed' and b\.client_id = p_client_id/);
  assert.match(submit.body, /p\.id = p_client_id and p\.app_role = 'client' and p\.account_status = 'active'/);
  assert.match(coreMigration, /constraint feedback_one_per_client_session unique \(session_id, client_id\)/);
});

test("notifications are limited to their recipient for listing and read mutations", () => {
  assert.match(notification, /\.eq\("recipient_user_id", request\.auth\.user\.id\)/);
  assert.match(notification, /\.eq\("id", request\.params\.id\)\s*\.eq\("recipient_user_id", request\.auth\.user\.id\)/);
  assert.match(coreMigration, /create policy notifications_select_recipient[\s\S]*using \(recipient_user_id = \(select auth\.uid\(\)\)\)/);
});

test("counselor profile and availability writes use the authenticated counselor identity", () => {
  assert.match(counselor, /\.eq\("profile_id", req\.auth\.user\.id\)/);
  assert.match(counselor, /p_counselor_id: req\.auth\.user\.id/);
  const saveSlot = latestFunctionDefinition("sicare_save_availability_slot");
  const cancelSlot = latestFunctionDefinition("sicare_cancel_availability_slot");
  assert.match(saveSlot.body, /p\.id = p_counselor_id and p\.app_role = 'counselor' and p\.account_status = 'active'/);
  assert.match(saveSlot.body, /s\.id = p_slot_id and s\.counselor_id = p_counselor_id/);
  assert.match(cancelSlot.body, /s\.id = p_slot_id and s\.counselor_id = p_counselor_id/);
});

test("admin data routes require admin authorization and privileged domain RPCs are server-only", () => {
  assert.match(admin, /router\.get\("\/accounts", authenticate, allowRoles\("admin"\)/);
  assert.match(admin, /router\.patch\("\/accounts\/:id", authenticate, allowRoles\("admin"\)/);
  assert.match(coreMigration, /revoke all on public\.bookings from anon, authenticated/);
  assert.match(coreMigration, /revoke all on public\.counseling_sessions from anon, authenticated/);
  assert.match(domainMigration, /revoke all on function public\.sicare_create_booking\(uuid, uuid, uuid, text, text, jsonb\) from public, anon, authenticated/);
  assert.match(domainMigration, /grant execute on function public\.sicare_create_booking\(uuid, uuid, uuid, text, text, jsonb\) to service_role/);
});

test("canonical API resource identifiers are represented as strings rather than numeric fixture IDs", () => {
  assert.match(apiTypes, /export interface BookingRecordBaseDto \{\s*id: string;\s*client_id: string;\s*counselor_id: string;/);
  assert.match(apiTypes, /export interface SessionListItemDto \{\s*id: string;\s*booking_id: string;\s*counselor_id: string;/);
  assert.match(apiTypes, /export interface ClientFeedbackDto \{\s*id: string;\s*session_id: string;\s*counselor_id: string;/);
  assert.match(apiTypes, /export interface NotificationDto \{\s*id: string;/);
});

// ============================================================================
// PART 2: Runtime Ownership & Negative Authorization Test Harness
// ============================================================================

const IDS = Object.freeze({
  CLIENT_A: "11111111-1111-4111-8111-111111111111",
  CLIENT_B: "22222222-2222-4222-8222-222222222222",
  COUNSELOR_A: "33333333-3333-4333-8333-333333333333",
  COUNSELOR_B: "44444444-4444-4444-8444-444444444444",
  ADMIN: "55555555-5555-4555-8555-555555555555",
  HEAD_LMI: "66666666-6666-4666-8666-666666666666",
  INACTIVE_CLIENT: "77777777-7777-4777-8777-777777777777",
  SLOT_A1: "aaaa1111-1111-4111-8111-111111111111",
  SLOT_A2: "aaaa2222-2222-4222-8222-222222222222",
  SLOT_B1: "bbbb1111-1111-4111-8111-111111111111",
  BOOKING_A: "b0001111-1111-4111-8111-111111111111",
  BOOKING_B: "b0002222-2222-4222-8222-222222222222",
  SESSION_A_COMPLETED: "c0001111-1111-4111-8111-111111111111",
  SESSION_A_SCHEDULED: "c0001112-1111-4111-8111-111111111112",
  SESSION_B_SCHEDULED: "c0002222-2222-4222-8222-222222222222",
  FEEDBACK_A_SHOWN: "f0001111-1111-4111-8111-111111111111",
  FEEDBACK_A_PENDING: "f0001112-1111-4111-8111-111111111112",
  FEEDBACK_B_SHOWN: "f0002222-2222-4222-8222-222222222222",
  NOTIF_CLIENT_A: "d0001111-1111-4111-8111-111111111111",
  NOTIF_CLIENT_B: "d0002222-2222-4222-8222-222222222222",
  NOTIF_COUNSELOR_A: "d0003333-3333-4333-8333-333333333333",
});

const TOKENS = Object.freeze({
  CLIENT_A: "tok-client-a",
  CLIENT_B: "tok-client-b",
  COUNSELOR_A: "tok-counselor-a",
  COUNSELOR_B: "tok-counselor-b",
  ADMIN: "tok-admin",
  HEAD_LMI: "tok-head-lmi",
  INACTIVE_CLIENT: "tok-inactive-client",
});

/**
 * Creates a fresh, isolated in-memory Supabase mock populated with records owned by
 * both User A and User B across every domain, plus full query/mutation/RPC tracking.
 *
 * Because records for both User A and User B are present simultaneously, a query only
 * excludes User A's data when the route handler explicitly applies the authenticated
 * user's ownership filter.
 */
function createOwnershipMockDb() {
  const tokenToUser = new Map([
    [TOKENS.CLIENT_A, { id: IDS.CLIENT_A, email: "client.a@example.test" }],
    [TOKENS.CLIENT_B, { id: IDS.CLIENT_B, email: "client.b@example.test" }],
    [TOKENS.COUNSELOR_A, { id: IDS.COUNSELOR_A, email: "counselor.a@example.test" }],
    [TOKENS.COUNSELOR_B, { id: IDS.COUNSELOR_B, email: "counselor.b@example.test" }],
    [TOKENS.ADMIN, { id: IDS.ADMIN, email: "admin@example.test" }],
    [TOKENS.HEAD_LMI, { id: IDS.HEAD_LMI, email: "head.lmi@example.test" }],
    [TOKENS.INACTIVE_CLIENT, { id: IDS.INACTIVE_CLIENT, email: "inactive@example.test" }],
  ]);

  const tables = {
    profiles: [
      { id: IDS.CLIENT_A, identity_code: "CA001", full_name: "Client A", app_role: "client", member_category: "student", account_status: "active", phone_e164: "+628111111111", whatsapp_opt_in: false, created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z" },
      { id: IDS.CLIENT_B, identity_code: "CB002", full_name: "Client B", app_role: "client", member_category: "student", account_status: "active", phone_e164: "+628222222222", whatsapp_opt_in: false, created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z" },
      { id: IDS.COUNSELOR_A, identity_code: "COA01", full_name: "Counselor A", app_role: "counselor", member_category: "faculty_staff", account_status: "active", phone_e164: "+628333333333", whatsapp_opt_in: true, created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z" },
      { id: IDS.COUNSELOR_B, identity_code: "COB02", full_name: "Counselor B", app_role: "counselor", member_category: "faculty_staff", account_status: "active", phone_e164: "+628444444444", whatsapp_opt_in: true, created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z" },
      { id: IDS.ADMIN, identity_code: "ADM01", full_name: "Admin Utama", app_role: "admin", member_category: "faculty_staff", account_status: "active", phone_e164: "+628555555555", whatsapp_opt_in: false, created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z" },
      { id: IDS.HEAD_LMI, identity_code: "LMI01", full_name: "Kepala LMI", app_role: "head_lmi", member_category: "faculty_staff", account_status: "active", phone_e164: "+628666666666", whatsapp_opt_in: false, created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z" },
      { id: IDS.INACTIVE_CLIENT, identity_code: "INC01", full_name: "Client Nonaktif", app_role: "client", member_category: "student", account_status: "disabled", phone_e164: null, whatsapp_opt_in: false, created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z" },
    ],
    counselor_profiles: [
      { profile_id: IDS.COUNSELOR_A, public_name: "Konselor A", headline: "Headline A", bio: "Bio A", specialties: ["Akademik"], years_experience: 5, photo_path: null, is_public: true, created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z" },
      { profile_id: IDS.COUNSELOR_B, public_name: "Konselor B", headline: "Headline B", bio: "Bio B", specialties: ["Karier"], years_experience: 4, photo_path: null, is_public: true, created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z" },
    ],
    availability_slots: [
      { id: IDS.SLOT_A1, counselor_id: IDS.COUNSELOR_A, academic_period_id: null, starts_at: "2027-03-10T09:00:00.000Z", ends_at: "2027-03-10T10:00:00.000Z", status: "available", created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z" },
      { id: IDS.SLOT_A2, counselor_id: IDS.COUNSELOR_A, academic_period_id: null, starts_at: "2027-03-11T09:00:00.000Z", ends_at: "2027-03-11T10:00:00.000Z", status: "available", created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z" },
      { id: IDS.SLOT_B1, counselor_id: IDS.COUNSELOR_B, academic_period_id: null, starts_at: "2027-03-10T09:00:00.000Z", ends_at: "2027-03-10T10:00:00.000Z", status: "available", created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z" },
    ],
    bookings: [
      { id: IDS.BOOKING_A, client_id: IDS.CLIENT_A, counselor_id: IDS.COUNSELOR_A, availability_slot_id: IDS.SLOT_A1, service_type: "individual", group_name: null, participant_count: 1, starts_at: "2027-03-10T09:00:00.000Z", ends_at: "2027-03-10T10:00:00.000Z", status: "reschedule_requested", cancellation_reason: null, reschedule_reason: "Perlu ganti jam", booking_participants: [], created_at: "2026-10-02T00:00:00Z", updated_at: "2026-10-02T00:00:00Z" },
      { id: IDS.BOOKING_B, client_id: IDS.CLIENT_B, counselor_id: IDS.COUNSELOR_B, availability_slot_id: IDS.SLOT_B1, service_type: "individual", group_name: null, participant_count: 1, starts_at: "2027-03-10T09:00:00.000Z", ends_at: "2027-03-10T10:00:00.000Z", status: "waiting_confirmation", cancellation_reason: null, reschedule_reason: null, booking_participants: [], created_at: "2026-10-03T00:00:00Z", updated_at: "2026-10-03T00:00:00Z" },
    ],
    counseling_sessions: [
      { id: IDS.SESSION_A_COMPLETED, booking_id: IDS.BOOKING_A, counselor_id: IDS.COUNSELOR_A, starts_at: "2026-10-05T09:00:00.000Z", ends_at: "2026-10-05T10:00:00.000Z", status: "completed", format: "online", room: null, started_at: "2026-10-05T09:00:00.000Z", completed_at: "2026-10-05T10:00:00.000Z", created_at: "2026-10-02T00:00:00Z", updated_at: "2026-10-05T10:00:00Z" },
      { id: IDS.SESSION_A_SCHEDULED, booking_id: IDS.BOOKING_A, counselor_id: IDS.COUNSELOR_A, starts_at: "2027-03-10T09:00:00.000Z", ends_at: "2027-03-10T10:00:00.000Z", status: "scheduled", format: "online", room: null, started_at: null, completed_at: null, created_at: "2026-10-02T00:00:00Z", updated_at: "2026-10-02T00:00:00Z" },
      { id: IDS.SESSION_B_SCHEDULED, booking_id: IDS.BOOKING_B, counselor_id: IDS.COUNSELOR_B, starts_at: "2027-03-10T09:00:00.000Z", ends_at: "2027-03-10T10:00:00.000Z", status: "scheduled", format: "offline", room: "Ruang 101", started_at: null, completed_at: null, created_at: "2026-10-03T00:00:00Z", updated_at: "2026-10-03T00:00:00Z" },
    ],
    feedback: [
      { id: IDS.FEEDBACK_A_SHOWN, session_id: IDS.SESSION_A_COMPLETED, client_id: IDS.CLIENT_A, counselor_id: IDS.COUNSELOR_A, rating: 5, comment: "Konselor A sangat membantu", moderation_status: "shown", review_status: "new", disabled_reason: null, created_at: "2026-10-06T00:00:00Z", updated_at: "2026-10-06T00:00:00Z" },
      { id: IDS.FEEDBACK_A_PENDING, session_id: IDS.SESSION_A_SCHEDULED, client_id: IDS.CLIENT_A, counselor_id: IDS.COUNSELOR_A, rating: 4, comment: "Masih pending moderasi", moderation_status: "pending", review_status: "new", disabled_reason: null, created_at: "2026-10-06T01:00:00Z", updated_at: "2026-10-06T01:00:00Z" },
      { id: IDS.FEEDBACK_B_SHOWN, session_id: IDS.SESSION_B_SCHEDULED, client_id: IDS.CLIENT_B, counselor_id: IDS.COUNSELOR_B, rating: 5, comment: "Feedback milik Client B", moderation_status: "shown", review_status: "new", disabled_reason: null, created_at: "2026-10-06T02:00:00Z", updated_at: "2026-10-06T02:00:00Z" },
    ],
    notifications: [
      { id: IDS.NOTIF_CLIENT_A, recipient_user_id: IDS.CLIENT_A, type: "booking.created", title: "Notif Client A", body: "Pesan A", entity_type: "booking", entity_id: IDS.BOOKING_A, created_at: "2026-10-07T00:00:00Z", read_at: null },
      { id: IDS.NOTIF_CLIENT_B, recipient_user_id: IDS.CLIENT_B, type: "booking.created", title: "Notif Client B", body: "Pesan B", entity_type: "booking", entity_id: IDS.BOOKING_B, created_at: "2026-10-07T00:00:00Z", read_at: null },
      { id: IDS.NOTIF_COUNSELOR_A, recipient_user_id: IDS.COUNSELOR_A, type: "booking.created", title: "Notif Counselor A", body: "Pesan Konselor A", entity_type: "booking", entity_id: IDS.BOOKING_A, created_at: "2026-10-07T00:00:00Z", read_at: null },
    ],
    academic_periods: [],
    hero_motivations: [],
    audit_events: [],
  };

  const operations = [];
  const rpcCalls = [];

  function createQueryBuilder(table) {
    const op = {
      table,
      type: "select",
      filters: [],
      patch: null,
      inserted: null,
      head: false,
      countMode: null,
      limitCount: null,
    };
    operations.push(op);

    function matchingRows() {
      const source = tables[table] ?? [];
      return source.filter((row) =>
        op.filters.every((f) => {
          if (f.kind === "eq") return row[f.column] === f.value;
          if (f.kind === "in") return Array.isArray(f.values) && f.values.includes(row[f.column]);
          if (f.kind === "is") return row[f.column] === f.value;
          if (f.kind === "gte") return String(row[f.column] ?? "") >= String(f.value);
          if (f.kind === "not_is") return row[f.column] !== f.value;
          return true;
        }),
      );
    }

    function execute() {
      if (op.type === "insert") {
        const rows = Array.isArray(op.inserted) ? op.inserted : [op.inserted];
        const created = rows.map((r) => ({ id: "99999999-9999-4999-8999-999999999999", ...r }));
        tables[table].push(...created);
        return { data: Array.isArray(op.inserted) ? created : created[0], error: null };
      }
      const matched = matchingRows();
      if (op.type === "update") {
        for (const row of matched) Object.assign(row, op.patch);
        return { data: matched.map((r) => ({ ...r })), error: null };
      }
      if (op.type === "delete") {
        tables[table] = (tables[table] ?? []).filter((r) => !matched.includes(r));
        return { data: matched.map((r) => ({ ...r })), error: null };
      }
      const limited = op.limitCount != null ? matched.slice(0, op.limitCount) : matched;
      if (op.head) {
        return { data: null, count: matched.length, error: null };
      }
      return { data: limited.map((r) => ({ ...r })), count: matched.length, error: null };
    }

    const builder = {
      select(_columns, options) {
        if (options?.count) op.countMode = options.count;
        if (options?.head) op.head = true;
        return builder;
      },
      insert(payload) {
        op.type = "insert";
        op.inserted = payload;
        return builder;
      },
      update(patch) {
        op.type = "update";
        op.patch = patch;
        return builder;
      },
      delete() {
        op.type = "delete";
        return builder;
      },
      eq(column, value) {
        op.filters.push({ kind: "eq", column, value });
        return builder;
      },
      in(column, values) {
        op.filters.push({ kind: "in", column, values });
        return builder;
      },
      is(column, value) {
        op.filters.push({ kind: "is", column, value });
        return builder;
      },
      gte(column, value) {
        op.filters.push({ kind: "gte", column, value });
        return builder;
      },
      not(column, operator, value) {
        if (operator === "is") op.filters.push({ kind: "not_is", column, value });
        return builder;
      },
      order() {
        return builder;
      },
      limit(n) {
        op.limitCount = n;
        return builder;
      },
      maybeSingle() {
        const res = execute();
        const rows = Array.isArray(res.data) ? res.data : res.data ? [res.data] : [];
        return Promise.resolve({ data: rows[0] ?? null, error: res.error });
      },
      single() {
        const res = execute();
        const rows = Array.isArray(res.data) ? res.data : res.data ? [res.data] : [];
        if (!rows.length) {
          return Promise.resolve({ data: null, error: { code: "PGRST116", message: "No rows" } });
        }
        return Promise.resolve({ data: rows[0], error: null });
      },
      // biome-ignore lint/suspicious/noThenProperty: Supabase PostgREST builders are thenable.
      then(onFulfilled, onRejected) {
        return Promise.resolve(execute()).then(onFulfilled, onRejected);
      },
    };
    return builder;
  }

  const client = {
    auth: {
      async getUser(token) {
        const user = tokenToUser.get(token);
        if (!user) return { data: { user: null }, error: { message: "Invalid token" } };
        return { data: { user }, error: null };
      },
      admin: {
        async getUserById(id) {
          const found = [...tokenToUser.values()].find((u) => u.id === id);
          return { data: { user: found ?? null }, error: found ? null : { message: "Not found" } };
        },
      },
    },
    from(table) {
      return createQueryBuilder(table);
    },
    async rpc(functionName, params) {
      rpcCalls.push({ functionName, params });

      if (functionName === "sicare_create_booking") {
        const actor = tables.profiles.find((p) => p.id === params.p_client_id && p.app_role === "client" && p.account_status === "active");
        if (!actor) return { data: null, error: { code: "P0001", message: "BOOKING_CLIENT_NOT_ALLOWED" } };
        const slot = tables.availability_slots.find((s) => s.id === params.p_slot_id && s.counselor_id === params.p_counselor_id && s.status === "available");
        if (!slot) return { data: null, error: { code: "P0001", message: "BOOKING_SLOT_UNAVAILABLE" } };
        const newId = "b0009999-9999-4999-8999-999999999999";
        tables.bookings.push({
          id: newId,
          client_id: params.p_client_id,
          counselor_id: params.p_counselor_id,
          availability_slot_id: params.p_slot_id,
          service_type: params.p_service_type,
          group_name: params.p_group_name,
          participant_count: 1,
          starts_at: slot.starts_at,
          ends_at: slot.ends_at,
          status: "waiting_confirmation",
          cancellation_reason: null,
          reschedule_reason: null,
          booking_participants: [],
          created_at: "2026-10-10T00:00:00Z",
          updated_at: "2026-10-10T00:00:00Z",
        });
        return { data: newId, error: null };
      }

      if (functionName === "sicare_reschedule_booking") {
        const target = tables.bookings.find((b) => b.id === params.p_booking_id);
        if (!target) return { data: null, error: { code: "P0001", message: "BOOKING_NOT_FOUND" } };
        if (target.client_id !== params.p_client_id) {
          return { data: null, error: { code: "P0001", message: "BOOKING_FORBIDDEN" } };
        }
        if (target.status !== "reschedule_requested") {
          return { data: null, error: { code: "P0001", message: "BOOKING_RESCHEDULE_NOT_ALLOWED" } };
        }
        const slot = tables.availability_slots.find(
          (s) => s.id === params.p_slot_id && s.counselor_id === target.counselor_id && s.id !== target.availability_slot_id && s.status === "available",
        );
        if (!slot) return { data: null, error: { code: "P0001", message: "BOOKING_SLOT_UNAVAILABLE" } };
        target.availability_slot_id = slot.id;
        target.status = "waiting_confirmation";
        return { data: target.id, error: null };
      }

      if (functionName === "sicare_transition_booking") {
        const actor = tables.profiles.find((p) => p.id === params.p_actor_id && p.account_status === "active");
        if (!actor) return { data: null, error: { code: "P0001", message: "BOOKING_ACTOR_INACTIVE" } };
        const target = tables.bookings.find((b) => b.id === params.p_booking_id);
        if (!target) return { data: null, error: { code: "P0001", message: "BOOKING_NOT_FOUND" } };
        const isAssignedCounselor = actor.app_role === "counselor" && target.counselor_id === params.p_actor_id;
        const isOwnerClient = actor.app_role === "client" && target.client_id === params.p_actor_id;
        if (!isAssignedCounselor && !isOwnerClient) {
          return { data: null, error: { code: "P0001", message: "BOOKING_FORBIDDEN" } };
        }
        if (isOwnerClient && params.p_target_status !== "cancelled") {
          return { data: null, error: { code: "P0001", message: "BOOKING_TRANSITION_NOT_ALLOWED" } };
        }
        target.status = params.p_target_status;
        return { data: target.id, error: null };
      }

      if (functionName === "sicare_transition_session") {
        const target = tables.counseling_sessions.find((s) => s.id === params.p_session_id);
        if (!target) return { data: null, error: { code: "P0001", message: "SESSION_NOT_FOUND" } };
        const actor = tables.profiles.find((p) => p.id === params.p_actor_id && p.app_role === "counselor" && p.account_status === "active");
        if (!actor || target.counselor_id !== params.p_actor_id) {
          return { data: null, error: { code: "P0001", message: "SESSION_FORBIDDEN" } };
        }
        const allowed =
          (target.status === "scheduled" && ["ongoing", "cancelled"].includes(params.p_target_status)) ||
          (target.status === "ongoing" && ["completed", "cancelled"].includes(params.p_target_status));
        if (!allowed) {
          return { data: null, error: { code: "P0001", message: "SESSION_TRANSITION_NOT_ALLOWED" } };
        }
        target.status = params.p_target_status;
        return { data: target.id, error: null };
      }

      if (functionName === "sicare_submit_feedback") {
        const targetSession = tables.counseling_sessions.find((s) => s.id === params.p_session_id);
        const parentBooking = targetSession ? tables.bookings.find((b) => b.id === targetSession.booking_id) : null;
        if (!targetSession || targetSession.status !== "completed" || !parentBooking || parentBooking.client_id !== params.p_client_id) {
          return { data: null, error: { code: "P0001", message: "FEEDBACK_SESSION_NOT_ELIGIBLE" } };
        }
        const newId = "f0009999-9999-4999-8999-999999999999";
        tables.feedback.push({
          id: newId,
          session_id: params.p_session_id,
          client_id: params.p_client_id,
          counselor_id: parentBooking.counselor_id,
          rating: params.p_rating,
          comment: params.p_comment,
          moderation_status: "pending",
          review_status: "new",
          disabled_reason: null,
          created_at: "2026-10-10T00:00:00Z",
          updated_at: "2026-10-10T00:00:00Z",
        });
        return { data: newId, error: null };
      }

      if (functionName === "sicare_save_availability_slot") {
        const actor = tables.profiles.find((p) => p.id === params.p_counselor_id && p.app_role === "counselor" && p.account_status === "active");
        if (!actor) return { data: null, error: { code: "P0001", message: "AVAILABILITY_FORBIDDEN" } };
        if (params.p_slot_id) {
          const existing = tables.availability_slots.find((s) => s.id === params.p_slot_id && s.counselor_id === params.p_counselor_id);
          if (!existing) return { data: null, error: { code: "P0001", message: "AVAILABILITY_NOT_FOUND" } };
          existing.starts_at = params.p_starts_at;
          existing.ends_at = params.p_ends_at;
          return { data: existing.id, error: null };
        }
        const newSlotId = "aaaa9999-9999-4999-8999-999999999999";
        tables.availability_slots.push({
          id: newSlotId,
          counselor_id: params.p_counselor_id,
          academic_period_id: params.p_academic_period_id,
          starts_at: params.p_starts_at,
          ends_at: params.p_ends_at,
          status: "available",
          created_at: "2026-10-10T00:00:00Z",
          updated_at: "2026-10-10T00:00:00Z",
        });
        return { data: newSlotId, error: null };
      }

      if (functionName === "sicare_cancel_availability_slot") {
        const existing = tables.availability_slots.find((s) => s.id === params.p_slot_id && s.counselor_id === params.p_counselor_id);
        if (!existing) return { data: null, error: { code: "P0001", message: "AVAILABILITY_NOT_FOUND" } };
        existing.status = "cancelled";
        return { data: "cancelled", error: null };
      }

      return { data: null, error: { code: "P0001", message: `UNEXPECTED_RPC:${functionName}` } };
    },
  };

  return { client, tables, operations, rpcCalls };
}

/**
 * Dispatches an HTTP request directly through the Express `app` pipeline in memory
 * (without binding a TCP socket) while executing full middleware, routing, Zod
 * validation, mock Supabase queries/RPCs, and error handling.
 */
async function requestApp(mockDb, { method = "GET", path, token, body }) {
  setSupabaseAdminClientForTests(mockDb.client);
  try {
    return await new Promise((resolve, reject) => {
      const socket = new PassThrough();
      socket.remoteAddress = "127.0.0.1";
      const req = new http.IncomingMessage(socket);
      req.method = method.toUpperCase();
      req.url = path;
      const rawBody = body !== undefined ? JSON.stringify(body) : null;
      req.headers = {
        host: "127.0.0.1",
        accept: "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(rawBody !== null
          ? {
              "content-type": "application/json",
              "content-length": String(Buffer.byteLength(rawBody)),
            }
          : {}),
      };

      const res = new http.ServerResponse(req);
      const chunks = [];
      const origWrite = res.write.bind(res);
      const origEnd = res.end.bind(res);

      res.write = (chunk, encoding, cb) => {
        if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
        return origWrite(chunk, encoding, cb);
      };

      res.end = (chunk, encoding, cb) => {
        if (chunk && typeof chunk !== "function") {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
        }
        origEnd(chunk, encoding, cb);
        const text = Buffer.concat(chunks).toString("utf8");
        let parsed = null;
        try {
          parsed = text ? JSON.parse(text) : null;
        } catch {
          parsed = null;
        }
        resolve({ status: res.statusCode, body: parsed });
        return res;
      };

      try {
        app(req, res);
        if (rawBody !== null) req.push(Buffer.from(rawBody));
        req.push(null);
      } catch (error) {
        reject(error);
      }
    });
  } finally {
    setSupabaseAdminClientForTests(null);
  }
}

// ============================================================================
// Runtime Authentication & Profile Isolation Tests
// ============================================================================

test("runtime auth: inactive accounts are rejected with 403 ACCOUNT_INACTIVE and profile updates cannot spoof identity or role", async () => {
  const db = createOwnershipMockDb();

  const inactiveRes = await requestApp(db, {
    method: "GET",
    path: "/api/v1/bookings",
    token: TOKENS.INACTIVE_CLIENT,
  });
  assert.equal(inactiveRes.status, 403);
  assert.equal(inactiveRes.body.error.code, "ACCOUNT_INACTIVE");

  // Attempt to inject another user's ID or elevate app_role on /api/v1/profile
  const spoofAttempt = await requestApp(db, {
    method: "PATCH",
    path: "/api/v1/profile",
    token: TOKENS.CLIENT_A,
    body: { id: IDS.CLIENT_B, app_role: "admin", full_name: "Injected" },
  });
  assert.equal(spoofAttempt.status, 400);
  assert.equal(spoofAttempt.body.error.code, "VALIDATION_ERROR");
  assert.equal(db.tables.profiles.find((p) => p.id === IDS.CLIENT_B).full_name, "Client B");
  assert.equal(db.tables.profiles.find((p) => p.id === IDS.CLIENT_A).app_role, "client");
});

// ============================================================================
// Section 6.A: Runtime Booking Ownership Tests
// ============================================================================

test("runtime booking ownership: Client A accesses only Client A's booking while Client B is isolated from collection and detail", async () => {
  const db = createOwnershipMockDb();

  // 1. Client A lists and retrieves Client A's own booking
  const listA = await requestApp(db, { method: "GET", path: "/api/v1/bookings", token: TOKENS.CLIENT_A });
  assert.equal(listA.status, 200);
  assert.deepEqual(listA.body.data.map((b) => b.id), [IDS.BOOKING_A]);

  const detailA = await requestApp(db, { method: "GET", path: `/api/v1/bookings/${IDS.BOOKING_A}`, token: TOKENS.CLIENT_A });
  assert.equal(detailA.status, 200);
  assert.equal(detailA.body.data.id, IDS.BOOKING_A);
  assert.equal(detailA.body.data.client_id, IDS.CLIENT_A);

  // 2. Client B lists bookings: receives only Client B's booking, never Client A's
  const listB = await requestApp(db, { method: "GET", path: "/api/v1/bookings", token: TOKENS.CLIENT_B });
  assert.equal(listB.status, 200);
  assert.deepEqual(listB.body.data.map((b) => b.id), [IDS.BOOKING_B]);

  // 3. Client B cannot retrieve Client A's booking by manipulating the UUID
  const crossDetail = await requestApp(db, { method: "GET", path: `/api/v1/bookings/${IDS.BOOKING_A}`, token: TOKENS.CLIENT_B });
  assert.equal(crossDetail.status, 404);
  assert.equal(crossDetail.body.error.code, "BOOKING_NOT_FOUND");

  const lastBookingSelect = [...db.operations].reverse().find((op) => op.table === "bookings");
  assert.deepEqual(lastBookingSelect.filters, [
    { kind: "eq", column: "id", value: IDS.BOOKING_A },
    { kind: "eq", column: "client_id", value: IDS.CLIENT_B },
  ]);
});

test("runtime booking ownership: clients cannot create bookings under another client's identity", async () => {
  const db = createOwnershipMockDb();

  // Attempt to pass client_id in request body is rejected before RPC invocation
  const spoofCreate = await requestApp(db, {
    method: "POST",
    path: "/api/v1/bookings",
    token: TOKENS.CLIENT_B,
    body: {
      client_id: IDS.CLIENT_A,
      counselor_id: IDS.COUNSELOR_A,
      availability_slot_id: IDS.SLOT_A2,
      service_type: "individual",
    },
  });
  assert.equal(spoofCreate.status, 400);
  assert.equal(spoofCreate.body.error.code, "VALIDATION_ERROR");
  assert.equal(db.rpcCalls.length, 0);

  // Valid creation binds p_client_id strictly to authenticated user (Client B)
  const validCreate = await requestApp(db, {
    method: "POST",
    path: "/api/v1/bookings",
    token: TOKENS.CLIENT_B,
    body: {
      counselor_id: IDS.COUNSELOR_A,
      availability_slot_id: IDS.SLOT_A2,
      service_type: "individual",
    },
  });
  assert.equal(validCreate.status, 201);
  assert.equal(db.rpcCalls.length, 1);
  assert.equal(db.rpcCalls[0].functionName, "sicare_create_booking");
  assert.equal(db.rpcCalls[0].params.p_client_id, IDS.CLIENT_B);
  assert.equal(validCreate.body.data.client_id, IDS.CLIENT_B);
});

test("runtime booking ownership: counselors cannot access or transition bookings assigned to another counselor", async () => {
  const db = createOwnershipMockDb();

  // Counselor B lists only Counselor B's bookings
  const listCounselorB = await requestApp(db, { method: "GET", path: "/api/v1/bookings", token: TOKENS.COUNSELOR_B });
  assert.equal(listCounselorB.status, 200);
  assert.deepEqual(listCounselorB.body.data.map((b) => b.id), [IDS.BOOKING_B]);

  // Counselor B cannot read Counselor A's booking by UUID
  const detailCounselorB = await requestApp(db, { method: "GET", path: `/api/v1/bookings/${IDS.BOOKING_A}`, token: TOKENS.COUNSELOR_B });
  assert.equal(detailCounselorB.status, 404);
  assert.equal(detailCounselorB.body.error.code, "BOOKING_NOT_FOUND");

  // Counselor B cannot transition Counselor A's booking
  const transitionOtherCounselor = await requestApp(db, {
    method: "PATCH",
    path: `/api/v1/bookings/${IDS.BOOKING_A}/status`,
    token: TOKENS.COUNSELOR_B,
    body: { status: "confirmed", session_format: "online" },
  });
  assert.equal(transitionOtherCounselor.status, 403);
  assert.equal(transitionOtherCounselor.body.error.code, "BOOKING_FORBIDDEN");
  assert.equal(db.tables.bookings.find((b) => b.id === IDS.BOOKING_A).status, "reschedule_requested");
});

test("runtime booking ownership: unauthorized rescheduling and cancellation attempts are rejected", async () => {
  const db = createOwnershipMockDb();

  // Client B cannot reschedule Client A's booking
  const rescheduleByOtherClient = await requestApp(db, {
    method: "PATCH",
    path: `/api/v1/bookings/${IDS.BOOKING_A}/reschedule`,
    token: TOKENS.CLIENT_B,
    body: { availability_slot_id: IDS.SLOT_A2 },
  });
  assert.equal(rescheduleByOtherClient.status, 403);
  assert.equal(rescheduleByOtherClient.body.error.code, "BOOKING_FORBIDDEN");
  assert.equal(db.tables.bookings.find((b) => b.id === IDS.BOOKING_A).availability_slot_id, IDS.SLOT_A1);

  // Client B cannot cancel Client A's booking
  const cancelByOtherClient = await requestApp(db, {
    method: "PATCH",
    path: `/api/v1/bookings/${IDS.BOOKING_A}/status`,
    token: TOKENS.CLIENT_B,
    body: { status: "cancelled", reason: "Mencoba membatalkan milik orang lain" },
  });
  assert.equal(cancelByOtherClient.status, 403);
  assert.equal(cancelByOtherClient.body.error.code, "BOOKING_FORBIDDEN");
  assert.equal(db.tables.bookings.find((b) => b.id === IDS.BOOKING_A).status, "reschedule_requested");

  // Client A cannot perform counselor-only booking confirmation
  const confirmByClient = await requestApp(db, {
    method: "PATCH",
    path: `/api/v1/bookings/${IDS.BOOKING_A}/status`,
    token: TOKENS.CLIENT_A,
    body: { status: "confirmed", session_format: "online" },
  });
  assert.equal(confirmByClient.status, 403);
  assert.equal(confirmByClient.body.error.code, "BOOKING_FORBIDDEN");
});

// ============================================================================
// Section 6.B: Runtime Counseling Session Ownership Tests
// ============================================================================

test("runtime session ownership: Client A and Counselor A can access their sessions while Client B and Counselor B are rejected", async () => {
  const db = createOwnershipMockDb();

  // 1. Client A accesses own sessions
  const clientAList = await requestApp(db, { method: "GET", path: "/api/v1/sessions", token: TOKENS.CLIENT_A });
  assert.equal(clientAList.status, 200);
  assert.deepEqual(
    clientAList.body.data.map((s) => s.id),
    [IDS.SESSION_A_COMPLETED, IDS.SESSION_A_SCHEDULED],
  );

  const clientADetail = await requestApp(db, { method: "GET", path: `/api/v1/sessions/${IDS.SESSION_A_COMPLETED}`, token: TOKENS.CLIENT_A });
  assert.equal(clientADetail.status, 200);
  assert.equal(clientADetail.body.data.booking.client_id, IDS.CLIENT_A);

  // 2. Client B cannot access Client A's session
  const clientBCrossDetail = await requestApp(db, { method: "GET", path: `/api/v1/sessions/${IDS.SESSION_A_COMPLETED}`, token: TOKENS.CLIENT_B });
  assert.equal(clientBCrossDetail.status, 404);
  assert.equal(clientBCrossDetail.body.error.code, "SESSION_NOT_FOUND");

  // 3. Counselor A accesses assigned session
  const counselorADetail = await requestApp(db, { method: "GET", path: `/api/v1/sessions/${IDS.SESSION_A_SCHEDULED}`, token: TOKENS.COUNSELOR_A });
  assert.equal(counselorADetail.status, 200);
  assert.equal(counselorADetail.body.data.counselor_id, IDS.COUNSELOR_A);

  // 4. Counselor B cannot access Counselor A's session
  const counselorBCrossDetail = await requestApp(db, { method: "GET", path: `/api/v1/sessions/${IDS.SESSION_A_SCHEDULED}`, token: TOKENS.COUNSELOR_B });
  assert.equal(counselorBCrossDetail.status, 404);
  assert.equal(counselorBCrossDetail.body.error.code, "SESSION_NOT_FOUND");
});

test("runtime session ownership: unauthorized session state transitions and identity overrides are rejected", async () => {
  const db = createOwnershipMockDb();

  // Client A cannot transition session status (counselor-only route)
  const clientTransition = await requestApp(db, {
    method: "PATCH",
    path: `/api/v1/sessions/${IDS.SESSION_A_SCHEDULED}/status`,
    token: TOKENS.CLIENT_A,
    body: { status: "ongoing" },
  });
  assert.equal(clientTransition.status, 403);
  assert.equal(clientTransition.body.error.code, "FORBIDDEN");
  assert.equal(db.rpcCalls.length, 0);

  // Counselor B cannot transition Counselor A's session
  const counselorBTransition = await requestApp(db, {
    method: "PATCH",
    path: `/api/v1/sessions/${IDS.SESSION_A_SCHEDULED}/status`,
    token: TOKENS.COUNSELOR_B,
    body: { status: "ongoing" },
  });
  assert.equal(counselorBTransition.status, 403);
  assert.equal(counselorBTransition.body.error.code, "SESSION_FORBIDDEN");
  assert.equal(db.tables.counseling_sessions.find((s) => s.id === IDS.SESSION_A_SCHEDULED).status, "scheduled");

  // Submitted counselor_id / p_actor_id fields in body are rejected by strict validation
  const overrideAttempt = await requestApp(db, {
    method: "PATCH",
    path: `/api/v1/sessions/${IDS.SESSION_A_SCHEDULED}/status`,
    token: TOKENS.COUNSELOR_B,
    body: { status: "ongoing", counselor_id: IDS.COUNSELOR_A },
  });
  assert.equal(overrideAttempt.status, 400);
  assert.equal(overrideAttempt.body.error.code, "VALIDATION_ERROR");

  // Counselor A can transition own scheduled session to ongoing
  const validTransition = await requestApp(db, {
    method: "PATCH",
    path: `/api/v1/sessions/${IDS.SESSION_A_SCHEDULED}/status`,
    token: TOKENS.COUNSELOR_A,
    body: { status: "ongoing" },
  });
  assert.equal(validTransition.status, 200);
  assert.equal(validTransition.body.data.status, "ongoing");
});

// ============================================================================
// Section 6.C: Runtime Feedback Ownership Tests
// ============================================================================

test("runtime feedback ownership: clients and counselors only see authorized feedback and cannot submit or mutate across accounts", async () => {
  const db = createOwnershipMockDb();

  // 1. Client B cannot retrieve Client A's feedback via /feedback/mine
  const clientBMine = await requestApp(db, { method: "GET", path: "/api/v1/feedback/mine", token: TOKENS.CLIENT_B });
  assert.equal(clientBMine.status, 200);
  assert.deepEqual(clientBMine.body.data.map((f) => f.id), [IDS.FEEDBACK_B_SHOWN]);

  // 2. Counselor A sees only shown feedback for Counselor A (excludes pending and Counselor B's feedback)
  const counselorAFeedback = await requestApp(db, { method: "GET", path: "/api/v1/feedback/counselor", token: TOKENS.COUNSELOR_A });
  assert.equal(counselorAFeedback.status, 200);
  assert.deepEqual(counselorAFeedback.body.data.map((f) => f.id), [IDS.FEEDBACK_A_SHOWN]);

  // 3. Feedback submission requires an eligible completed session owned by the authenticated client
  const submitOnOtherClientSession = await requestApp(db, {
    method: "POST",
    path: `/api/v1/sessions/${IDS.SESSION_A_COMPLETED}/feedback`,
    token: TOKENS.CLIENT_B,
    body: { rating: 5, comment: "Bukan sesi milik Client B" },
  });
  assert.equal(submitOnOtherClientSession.status, 409);
  assert.equal(submitOnOtherClientSession.body.error.code, "FEEDBACK_NOT_ELIGIBLE");

  const submitOnUnfinishedSession = await requestApp(db, {
    method: "POST",
    path: `/api/v1/sessions/${IDS.SESSION_A_SCHEDULED}/feedback`,
    token: TOKENS.CLIENT_A,
    body: { rating: 5, comment: "Sesi belum selesai" },
  });
  assert.equal(submitOnUnfinishedSession.status, 409);
  assert.equal(submitOnUnfinishedSession.body.error.code, "FEEDBACK_NOT_ELIGIBLE");

  // 4 & 5. Manipulating feedback UUIDs for detail, moderation, or review is blocked for unauthorized roles
  for (const token of [TOKENS.CLIENT_A, TOKENS.CLIENT_B, TOKENS.COUNSELOR_A]) {
    const detailRes = await requestApp(db, {
      method: "GET",
      path: `/api/v1/admin/feedback/${IDS.FEEDBACK_A_SHOWN}`,
      token,
    });
    assert.equal(detailRes.status, 403);

    const modRes = await requestApp(db, {
      method: "PATCH",
      path: `/api/v1/admin/feedback/${IDS.FEEDBACK_A_SHOWN}/moderation`,
      token,
      body: { moderation_status: "disabled", disabled_reason: "Unauthorized" },
    });
    assert.equal(modRes.status, 403);
  }
  assert.equal(db.tables.feedback.find((f) => f.id === IDS.FEEDBACK_A_SHOWN).moderation_status, "shown");
});

// ============================================================================
// Section 6.D: Runtime Notification Ownership Tests
// ============================================================================

test("runtime notification ownership: listing and mark-as-read mutations are strictly recipient-scoped", async () => {
  const db = createOwnershipMockDb();

  // 1 & 2. Client A lists only Client A's notifications; Client B lists only Client B's notifications
  const listA = await requestApp(db, { method: "GET", path: "/api/v1/notifications", token: TOKENS.CLIENT_A });
  assert.equal(listA.status, 200);
  assert.deepEqual(listA.body.data.items.map((n) => n.id), [IDS.NOTIF_CLIENT_A]);
  assert.equal(listA.body.data.unread_count, 1);

  const listB = await requestApp(db, { method: "GET", path: "/api/v1/notifications", token: TOKENS.CLIENT_B });
  assert.equal(listB.status, 200);
  assert.deepEqual(listB.body.data.items.map((n) => n.id), [IDS.NOTIF_CLIENT_B]);

  // 3. Client B cannot mark Client A's notification as read
  const clientBReadA = await requestApp(db, {
    method: "PATCH",
    path: `/api/v1/notifications/${IDS.NOTIF_CLIENT_A}/read`,
    token: TOKENS.CLIENT_B,
  });
  assert.equal(clientBReadA.status, 404);
  assert.equal(clientBReadA.body.error.code, "NOTIFICATION_NOT_FOUND");
  assert.equal(db.tables.notifications.find((n) => n.id === IDS.NOTIF_CLIENT_A).read_at, null);

  // 4. Counselor B cannot modify Counselor A's notification
  const counselorBReadA = await requestApp(db, {
    method: "PATCH",
    path: `/api/v1/notifications/${IDS.NOTIF_COUNSELOR_A}/read`,
    token: TOKENS.COUNSELOR_B,
  });
  assert.equal(counselorBReadA.status, 404);
  assert.equal(counselorBReadA.body.error.code, "NOTIFICATION_NOT_FOUND");
  assert.equal(db.tables.notifications.find((n) => n.id === IDS.NOTIF_COUNSELOR_A).read_at, null);

  // 5. read-all by Client B only marks Client B's notifications, leaving Client A and Counselor A untouched
  const readAllB = await requestApp(db, {
    method: "PATCH",
    path: "/api/v1/notifications/read-all",
    token: TOKENS.CLIENT_B,
  });
  assert.equal(readAllB.status, 200);
  assert.equal(readAllB.body.data.marked_read, 1);
  assert.notEqual(db.tables.notifications.find((n) => n.id === IDS.NOTIF_CLIENT_B).read_at, null);
  assert.equal(db.tables.notifications.find((n) => n.id === IDS.NOTIF_CLIENT_A).read_at, null);
  assert.equal(db.tables.notifications.find((n) => n.id === IDS.NOTIF_COUNSELOR_A).read_at, null);
});

// ============================================================================
// Section 6.E: Runtime Counselor Profile & Availability Ownership Tests
// ============================================================================

test("runtime counselor ownership: counselors can only read/modify their own profile and availability slots", async () => {
  const db = createOwnershipMockDb();

  // 1. Counselor A accesses own profile and availability
  const profileA = await requestApp(db, { method: "GET", path: "/api/v1/counselor/profile", token: TOKENS.COUNSELOR_A });
  assert.equal(profileA.status, 200);
  assert.equal(profileA.body.data.profile_id, IDS.COUNSELOR_A);

  const slotsA = await requestApp(db, { method: "GET", path: "/api/v1/counselor/availability", token: TOKENS.COUNSELOR_A });
  assert.equal(slotsA.status, 200);
  assert.deepEqual(slotsA.body.data.map((s) => s.id), [IDS.SLOT_A1, IDS.SLOT_A2]);

  // 2. Counselor B cannot modify Counselor A's profile or inject profile_id / is_public
  const injectProfileId = await requestApp(db, {
    method: "PATCH",
    path: "/api/v1/counselor/profile",
    token: TOKENS.COUNSELOR_B,
    body: { profile_id: IDS.COUNSELOR_A, headline: "Hijacked" },
  });
  assert.equal(injectProfileId.status, 400);
  assert.equal(injectProfileId.body.error.code, "VALIDATION_ERROR");

  const updateB = await requestApp(db, {
    method: "PATCH",
    path: "/api/v1/counselor/profile",
    token: TOKENS.COUNSELOR_B,
    body: { headline: "Headline B Updated" },
  });
  assert.equal(updateB.status, 200);
  assert.equal(db.tables.counselor_profiles.find((cp) => cp.profile_id === IDS.COUNSELOR_B).headline, "Headline B Updated");
  assert.equal(db.tables.counselor_profiles.find((cp) => cp.profile_id === IDS.COUNSELOR_A).headline, "Headline A");

  // 3. Counselor B cannot update or cancel Counselor A's availability slot
  const editSlotAAsB = await requestApp(db, {
    method: "PATCH",
    path: `/api/v1/counselor/availability/${IDS.SLOT_A1}`,
    token: TOKENS.COUNSELOR_B,
    body: { starts_at: "2027-04-01T09:00:00Z", ends_at: "2027-04-01T10:00:00Z" },
  });
  assert.equal(editSlotAAsB.status, 404);
  assert.equal(editSlotAAsB.body.error.code, "AVAILABILITY_NOT_FOUND");
  assert.equal(db.tables.availability_slots.find((s) => s.id === IDS.SLOT_A1).starts_at, "2027-03-10T09:00:00.000Z");

  const cancelSlotAAsB = await requestApp(db, {
    method: "DELETE",
    path: `/api/v1/counselor/availability/${IDS.SLOT_A1}`,
    token: TOKENS.COUNSELOR_B,
  });
  assert.equal(cancelSlotAAsB.status, 404);
  assert.equal(cancelSlotAAsB.body.error.code, "AVAILABILITY_NOT_FOUND");
  assert.equal(db.tables.availability_slots.find((s) => s.id === IDS.SLOT_A1).status, "available");

  // 4. Submitted counselor_id cannot override authenticated counselor identity
  const injectCounselorId = await requestApp(db, {
    method: "POST",
    path: "/api/v1/counselor/availability",
    token: TOKENS.COUNSELOR_B,
    body: {
      counselor_id: IDS.COUNSELOR_A,
      starts_at: "2027-04-02T09:00:00Z",
      ends_at: "2027-04-02T10:00:00Z",
    },
  });
  assert.equal(injectCounselorId.status, 400);
  assert.equal(injectCounselorId.body.error.code, "VALIDATION_ERROR");
});

// ============================================================================
// Section 6.F: Runtime Admin & Head LMI Authorization Tests
// ============================================================================

test("runtime admin & head_lmi authorization: role boundaries are enforced and Admin/Head LMI permissions are not interchangeable", async () => {
  const db = createOwnershipMockDb();

  // 1 & 2. Clients and Counselors are rejected from all admin and Head LMI routes
  for (const token of [TOKENS.CLIENT_A, TOKENS.COUNSELOR_A]) {
    for (const path of [
      "/api/v1/admin/accounts",
      `/api/v1/admin/accounts/${IDS.CLIENT_A}`,
      "/api/v1/admin/periods",
      "/api/v1/admin/hero-motivations",
      "/api/v1/admin/activity",
      "/api/v1/admin/dashboard",
      "/api/v1/admin/reports",
      "/api/v1/admin/counseling",
      "/api/v1/head-lmi/dashboard",
      "/api/v1/head-lmi/reports",
    ]) {
      const res = await requestApp(db, { method: "GET", path, token });
      assert.equal(res.status, 403, `Expected 403 for ${path}`);
      assert.equal(res.body.error.code, "FORBIDDEN");
    }
  }

  // 3. Head LMI cannot access admin-only administration routes or feedback moderation
  for (const path of [
    "/api/v1/admin/accounts",
    `/api/v1/admin/accounts/${IDS.CLIENT_A}`,
    "/api/v1/admin/periods",
    "/api/v1/admin/hero-motivations",
    "/api/v1/admin/activity",
    "/api/v1/admin/dashboard",
    "/api/v1/admin/reports",
  ]) {
    const res = await requestApp(db, { method: "GET", path, token: TOKENS.HEAD_LMI });
    assert.equal(res.status, 403, `Head LMI must be forbidden from ${path}`);
    assert.equal(res.body.error.code, "FORBIDDEN");
  }

  const headLmiModerate = await requestApp(db, {
    method: "PATCH",
    path: `/api/v1/admin/feedback/${IDS.FEEDBACK_A_PENDING}/moderation`,
    token: TOKENS.HEAD_LMI,
    body: { moderation_status: "shown" },
  });
  assert.equal(headLmiModerate.status, 403);
  assert.equal(db.tables.feedback.find((f) => f.id === IDS.FEEDBACK_A_PENDING).moderation_status, "pending");

  // 4. Admin cannot access Head LMI dashboard/reports or Head LMI feedback review
  for (const path of ["/api/v1/head-lmi/dashboard", "/api/v1/head-lmi/reports"]) {
    const res = await requestApp(db, { method: "GET", path, token: TOKENS.ADMIN });
    assert.equal(res.status, 403, `Admin must be forbidden from ${path}`);
    assert.equal(res.body.error.code, "FORBIDDEN");
  }

  const adminReview = await requestApp(db, {
    method: "PATCH",
    path: `/api/v1/admin/feedback/${IDS.FEEDBACK_A_SHOWN}/review`,
    token: TOKENS.ADMIN,
    body: { review_status: "reviewed" },
  });
  assert.equal(adminReview.status, 403);
  assert.equal(db.tables.feedback.find((f) => f.id === IDS.FEEDBACK_A_SHOWN).review_status, "new");

  // Authorized operations succeed for their designated role
  const adminModOk = await requestApp(db, {
    method: "PATCH",
    path: `/api/v1/admin/feedback/${IDS.FEEDBACK_A_PENDING}/moderation`,
    token: TOKENS.ADMIN,
    body: { moderation_status: "shown" },
  });
  assert.equal(adminModOk.status, 200);
  assert.equal(adminModOk.body.data.moderation_status, "shown");

  const headLmiReviewOk = await requestApp(db, {
    method: "PATCH",
    path: `/api/v1/admin/feedback/${IDS.FEEDBACK_A_SHOWN}/review`,
    token: TOKENS.HEAD_LMI,
    body: { review_status: "reviewed" },
  });
  assert.equal(headLmiReviewOk.status, 200);
  assert.equal(headLmiReviewOk.body.data.review_status, "reviewed");

  // Admin self-demotion / self-deactivation safeguard
  const selfDemote = await requestApp(db, {
    method: "PATCH",
    path: `/api/v1/admin/accounts/${IDS.ADMIN}`,
    token: TOKENS.ADMIN,
    body: { app_role: "counselor" },
  });
  assert.equal(selfDemote.status, 409);
  assert.equal(selfDemote.body.error.code, "SELF_ADMIN_CHANGE_BLOCKED");
});
