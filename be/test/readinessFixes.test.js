import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { classifySignInError } from "../src/services/auth.service.js";
import { bookingRepository } from "../src/repositories/booking.repository.js";
import { sessionRepository } from "../src/repositories/session.repository.js";
import { bookingListQuerySchema } from "../src/validators/booking.validator.js";
import { sessionListQuerySchema } from "../src/validators/session.validator.js";

/** Chainable fake of a PostgREST query that records every call and resolves to `result`. */
function fakeClient(result) {
  const calls = [];
  const query = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "then") return (resolve) => resolve(result);
        return (...args) => {
          calls.push([prop, ...args]);
          return query;
        };
      },
    },
  );
  return { calls, client: { from: (table) => (calls.push(["from", table]), query) } };
}

test("classifySignInError separates wrong password, throttling, and outages", () => {
  assert.equal(classifySignInError({ status: 400, code: "invalid_credentials", message: "Invalid login credentials" }), "invalid");
  assert.equal(classifySignInError({ status: 429, code: "over_request_rate_limit", message: "Request rate limit reached" }), "rate_limited");
  assert.equal(classifySignInError({ status: 400, message: "Too many requests" }), "rate_limited");
  assert.equal(classifySignInError({ status: 503, message: "Service Unavailable" }), "unavailable");
  assert.equal(classifySignInError({ name: "AuthRetryableFetchError", status: 0, message: "fetch failed" }), "unavailable");
  assert.equal(classifySignInError(null), "invalid");
});

test("booking and session list queries accept an offset that defaults to 0", () => {
  assert.equal(bookingListQuerySchema.parse({}).offset, 0);
  assert.equal(bookingListQuerySchema.parse({ limit: "100", offset: "200" }).offset, 200);
  assert.equal(sessionListQuerySchema.parse({ offset: "100" }).offset, 100);
  assert.equal(sessionListQuerySchema.safeParse({ offset: "-1" }).success, false);
});

test("bookingRepository.list pages with range(offset, offset + limit - 1)", async () => {
  const { calls, client } = fakeClient({ data: [], error: null });
  await bookingRepository.list(client, { userId: "u1", role: "client", limit: 100, offset: 200 });
  assert.deepEqual(calls.find(([name]) => name === "range"), ["range", 200, 299]);
  assert.deepEqual(calls.find(([name]) => name === "eq"), ["eq", "client_id", "u1"]);
});

test("sessionRepository.list filters a counselor by counselor_id without a booking id list", async () => {
  const { calls, client } = fakeClient({ data: [{ id: "s1" }], error: null });
  const rows = await sessionRepository.list(client, { userId: "c1", role: "counselor", limit: 50, offset: 0 });
  assert.deepEqual(rows, [{ id: "s1" }]);
  assert.deepEqual(calls.filter(([name]) => name === "from"), [["from", "counseling_sessions"]]);
  assert.equal(calls.some(([name]) => name === "in"), false);
  assert.deepEqual(calls.find(([name]) => name === "eq"), ["eq", "counselor_id", "c1"]);
  assert.deepEqual(calls.find(([name]) => name === "range"), ["range", 0, 49]);
});

test("sessionRepository.list filters a client through the booking join and strips the join column", async () => {
  const { calls, client } = fakeClient({ data: [{ id: "s1", status: "scheduled", bookings: { client_id: "u1" } }], error: null });
  const rows = await sessionRepository.list(client, { userId: "u1", role: "client", limit: 100, offset: 100 });
  assert.deepEqual(rows, [{ id: "s1", status: "scheduled" }]);
  const select = calls.find(([name]) => name === "select");
  assert.match(select[1], /bookings!inner\(client_id\)$/);
  assert.deepEqual(calls.find(([name]) => name === "eq"), ["eq", "bookings.client_id", "u1"]);
  assert.deepEqual(calls.find(([name]) => name === "range"), ["range", 100, 199]);
});

test("createBooking reports intake_saved so the client is told when the form was not stored", () => {
  const source = readFileSync(new URL("../src/services/booking.service.js", import.meta.url), "utf8");
  assert.match(source, /intakeSaved = false;/);
  assert.match(source, /intake_saved: intakeSaved/);
});

/* ---------------- Audit 2026-11-17: consent link, availability paging ---------------- */

test("consent invitations stay valid until the session ends (at least 72 hours)", async () => {
  const { invitationHoursUntil } = await import("../src/services/consent.service.js");
  const now = Date.parse("2026-11-17T00:00:00Z");
  assert.equal(invitationHoursUntil(null, now), 72);
  assert.equal(invitationHoursUntil("2026-11-18T00:00:00Z", now), 72);
  assert.equal(invitationHoursUntil("2026-11-27T01:30:00Z", now), 242);
});

test("consent invitation link uses the guest invite route with an encoded token", async () => {
  const { buildConsentInvitationLink } = await import("../src/services/consent.service.js");
  assert.match(buildConsentInvitationLink("abc+/="), /\/consent\/invite\?token=abc%2B%2F%3D$/);
});

test("resending an invitation requires a confirmed booking and returns the link to the authorized party", () => {
  const source = readFileSync(new URL("../src/services/consent.service.js", import.meta.url), "utf8");
  const fn = source.slice(source.indexOf("export async function resendConsentInvitation"));
  assert.match(fn, /booking\.status !== "confirmed"[\s\S]*BOOKING_NOT_CONFIRMED/);
  assert.match(fn, /SESSION_WINDOW_PASSED/);
  assert.match(fn, /invitation_link: buildConsentInvitationLink\(inv\.rawToken\)/);
  assert.match(fn, /expiresInHours: invitationHoursUntil\(booking\.ends_at\)/);
});

test("counselor availability list pages with range instead of a fixed oldest-200 limit", () => {
  const source = readFileSync(new URL("../src/services/counselor/availability.service.js", import.meta.url), "utf8");
  assert.match(source, /\.range\(offset, offset \+ limit - 1\)/);
  assert.doesNotMatch(source, /\.limit\(200\)/);
});

test("Fonnte webhook fails closed in production when no secret is configured", () => {
  const source = readFileSync(new URL("../src/routes/webhook.routes.js", import.meta.url), "utf8");
  assert.match(source, /if \(!configuredSecret\) return env\.NODE_ENV !== "production";/);
});

/* ---------------- Bagian B (2026-11-17) ---------------- */

/** Minimal in-memory PostgREST fake: select/eq/neq/in/update/insert/maybeSingle/then. */
function memoryDb(tables) {
  const writes = [];
  function builder(table) {
    const filters = [];
    let patch = null;
    let insertRow = null;
    const rows = () =>
      (tables[table] ?? []).filter((row) =>
        filters.every(([kind, col, val]) =>
          kind === "eq" ? row[col] === val : kind === "neq" ? row[col] !== val : val.includes(row[col]),
        ),
      );
    const run = () => {
      if (insertRow) {
        (tables[table] ??= []).push(insertRow);
        writes.push({ table, insert: insertRow });
        return { data: insertRow, error: null };
      }
      const matched = rows();
      if (patch) {
        matched.forEach((row) => Object.assign(row, patch));
        writes.push({ table, patch, count: matched.length });
      }
      return { data: matched.map((row) => ({ ...row })), error: null };
    };
    const q = {
      select() { return q; },
      eq(col, val) { filters.push(["eq", col, val]); return q; },
      neq(col, val) { filters.push(["neq", col, val]); return q; },
      in(col, vals) { filters.push(["in", col, vals]); return q; },
      update(p) { patch = p; return q; },
      insert(r) { insertRow = r; return q; },
      async maybeSingle() { const r = run(); return { data: r.data[0] ?? null, error: null }; },
      then(resolve, reject) { return Promise.resolve(run()).then(resolve, reject); },
    };
    return q;
  }
  return { writes, tables, from: builder };
}

test("cancelling a session requires a reason", async () => {
  const { sessionStatusSchema } = await import("../src/validators/session.validator.js");
  assert.equal(sessionStatusSchema.safeParse({ status: "cancelled" }).success, false);
  assert.equal(sessionStatusSchema.safeParse({ status: "cancelled", reason: "Konselor sakit" }).success, true);
  assert.equal(sessionStatusSchema.safeParse({ status: "ongoing" }).success, true);
});

test("closing bookings of a deactivated counselor cancels upcoming ones and keeps ongoing sessions", async () => {
  const { cancelActiveBookingsForProfile } = await import("../src/services/bookingClosure.service.js");
  const db = memoryDb({
    bookings: [
      { id: "b1", client_id: "c1", counselor_id: "k1", status: "confirmed", starts_at: "2026-12-01T01:00:00Z", ends_at: "2026-12-01T02:00:00Z", service_type: "individual" },
      { id: "b2", client_id: "c2", counselor_id: "k1", status: "confirmed", starts_at: "2026-12-01T03:00:00Z", ends_at: "2026-12-01T04:00:00Z", service_type: "individual" },
      { id: "b3", client_id: "c3", counselor_id: "k1", status: "waiting_confirmation", starts_at: "2026-12-02T01:00:00Z", ends_at: "2026-12-02T02:00:00Z", service_type: "individual" },
    ],
    counseling_sessions: [
      { booking_id: "b1", status: "scheduled" },
      { booking_id: "b2", status: "ongoing" },
    ],
    booking_participants: [],
    profiles: [],
    notifications: [],
    whatsapp_outbox: [],
    consent_invitations: [],
  });
  const result = await cancelActiveBookingsForProfile({ supabaseClient: db, profileId: "k1", side: "counselor", reason: "Konselor tidak tersedia" });
  assert.equal(result.cancelled, 2);
  assert.equal(result.skipped, 1);
  assert.equal(db.tables.bookings.find((b) => b.id === "b1").status, "cancelled");
  assert.equal(db.tables.bookings.find((b) => b.id === "b2").status, "confirmed");
  assert.equal(db.tables.counseling_sessions.find((s) => s.booking_id === "b1").status, "cancelled");
  assert.equal(db.tables.notifications.length, 2);
  assert.deepEqual(db.tables.notifications.map((n) => n.recipient_user_id).sort(), ["c1", "c3"]);
  assert.ok(db.tables.whatsapp_outbox.some((m) => m.message_type === "booking_cancelled" && m.recipient_user_id === "c1"));
});

test("removing a group member: only unsigned non-representatives, keeping at least 2 active", async () => {
  const { removeGroupParticipant } = await import("../src/services/consent.service.js");
  const fresh = () => memoryDb({
    bookings: [{ id: "b1", client_id: "rep", counselor_id: "k1", status: "confirmed", service_type: "group" }],
    counseling_sessions: [{ booking_id: "b1", status: "scheduled" }],
    booking_participants: [
      { id: "p-rep", booking_id: "b1", is_primary: true, is_representative: true, participant_status: "registered", informed_consents: [] },
      { id: "p-signed", booking_id: "b1", is_primary: false, is_representative: false, participant_status: "registered", informed_consents: [{ status: "signed" }] },
      { id: "p-open", booking_id: "b1", is_primary: false, is_representative: false, participant_status: "registered", informed_consents: [{ status: "pending" }] },
    ],
    consent_invitations: [{ booking_participant_id: "p-open", status: "sent" }],
    whatsapp_outbox: [],
  });
  const call = (db, participantId, authUser = { id: "rep" }, authRole = "client") =>
    removeGroupParticipant({ supabaseClient: db, bookingId: "b1", participantId, authUser, authRole });

  await assert.rejects(call(fresh(), "p-rep"), { code: "PARTICIPANT_IS_REPRESENTATIVE" });
  await assert.rejects(call(fresh(), "p-signed"), { code: "CONSENT_ALREADY_SIGNED" });
  await assert.rejects(call(fresh(), "p-open", { id: "stranger" }), { code: "BOOKING_FORBIDDEN" });

  const db = fresh();
  const result = await call(db, "p-open");
  assert.equal(result.active_participants, 2);
  assert.equal(db.tables.booking_participants.find((p) => p.id === "p-open").participant_status, "removed");
  assert.equal(db.tables.consent_invitations[0].status, "revoked");

  db.tables.booking_participants.find((p) => p.id === "p-signed").informed_consents = [];
  await assert.rejects(call(db, "p-signed"), { code: "GROUP_TOO_SMALL" });
});

test("password reset only accepts a recent recovery session", async () => {
  const { recoverySignInTime, resetPasswordWithRecovery } = await import("../src/services/auth.service.js");
  const token = (amr) => `x.${Buffer.from(JSON.stringify({ amr })).toString("base64url")}.y`;
  const nowSec = Math.floor(Date.now() / 1000);
  assert.equal(recoverySignInTime(token([{ method: "password", timestamp: nowSec }])), null);
  assert.equal(recoverySignInTime(token([{ method: "recovery", timestamp: nowSec }])), nowSec * 1000);
  assert.equal(recoverySignInTime("not-a-jwt"), null);

  await assert.rejects(
    resetPasswordWithRecovery({ user: { id: "u1" }, token: token([{ method: "password", timestamp: nowSec }]) }, { new_password: "Aa1!aaaa" }),
    { code: "RECOVERY_SESSION_REQUIRED" },
  );
  await assert.rejects(
    resetPasswordWithRecovery({ user: { id: "u1" }, token: token([{ method: "recovery", timestamp: nowSec - 7200 }]) }, { new_password: "Aa1!aaaa" }),
    { code: "RECOVERY_SESSION_REQUIRED" },
  );
});

test("forgot-password and reset-password routes are registered", () => {
  const source = readFileSync(new URL("../src/routes/auth.routes.js", import.meta.url), "utf8");
  assert.match(source, /router\.post\("\/forgot-password", asyncHandler/);
  assert.match(source, /router\.post\("\/reset-password", authenticate, asyncHandler/);
});

/* ---------------- Perbaikan consent/booking/laporan (2026-11-17) ---------------- */

test("consent cannot be signed for inactive bookings or closed sessions", async () => {
  const { assertBookingAcceptsConsent } = await import("../src/services/consent.service.js");
  const db = (bookingStatus, sessionStatus) => memoryDb({
    bookings: [{ id: "b1", status: bookingStatus }],
    counseling_sessions: sessionStatus ? [{ booking_id: "b1", status: sessionStatus }] : [],
  });
  await assert.rejects(assertBookingAcceptsConsent(db("cancelled"), "b1"), { code: "BOOKING_NOT_ACTIVE" });
  await assert.rejects(assertBookingAcceptsConsent(db("expired"), "b1"), { code: "BOOKING_NOT_ACTIVE" });
  await assert.rejects(assertBookingAcceptsConsent(db("confirmed", "missed"), "b1"), { code: "SESSION_CLOSED" });
  await assertBookingAcceptsConsent(db("confirmed", "scheduled"), "b1");
  await assertBookingAcceptsConsent(db("waiting_confirmation"), "b1");
});

test("guest signing compares the registered member phone, and resend audit uses an allowed event", () => {
  const source = readFileSync(new URL("../src/services/consent.service.js", import.meta.url), "utf8");
  assert.match(source, /authRole === "guest" && registeredPhone[\s\S]*CONSENT_PHONE_MISMATCH/);
  assert.doesNotMatch(source, /eventType: "invitation_resent"/);
});

test("group members need a valid, unique WhatsApp number (normalized to +62)", async () => {
  const { createBookingSchema, normalizeParticipantPhone } = await import("../src/validators/booking.validator.js");
  assert.equal(normalizeParticipantPhone("0812-3456-7890"), "+6281234567890");
  assert.equal(normalizeParticipantPhone("6281234567890"), "+6281234567890");
  const base = {
    counselor_id: "11111111-1111-4111-8111-111111111111",
    availability_slot_id: "22222222-2222-4222-8222-222222222222",
    service_type: "group",
    group_name: "Kelompok A",
  };
  const rep = { display_name: "Perwakilan", is_representative: true };
  const ok = createBookingSchema.safeParse({ ...base, participants: [rep, { display_name: "Budi", phone_e164: "081234567890" }] });
  assert.equal(ok.success, true);
  assert.equal(ok.data.participants[1].phone_e164, "+6281234567890");
  assert.equal(createBookingSchema.safeParse({ ...base, participants: [rep, { display_name: "Budi" }] }).success, false);
  assert.equal(createBookingSchema.safeParse({ ...base, participants: [rep, { display_name: "Budi", phone_e164: "12345" }] }).success, false);
  assert.equal(
    createBookingSchema.safeParse({
      ...base,
      participants: [rep, { display_name: "Budi", phone_e164: "081234567890" }, { display_name: "Ani", phone_e164: "+6281234567890" }],
    }).success,
    false,
  );
  assert.equal(
    createBookingSchema.safeParse({
      ...base,
      participants: [rep, { display_name: "Budi", phone_e164: "081234567890" }, { display_name: " budi ", phone_e164: "081234567891" }],
    }).success,
    false,
  );
});

test("clients cannot cancel a confirmed booking less than 2 hours before it starts", async () => {
  const { isPastClientCancelCutoff } = await import("../src/services/booking.service.js");
  const now = Date.parse("2026-11-20T00:00:00Z");
  assert.equal(isPastClientCancelCutoff({ status: "confirmed", starts_at: "2026-11-20T01:00:00Z" }, now), true);
  assert.equal(isPastClientCancelCutoff({ status: "confirmed", starts_at: "2026-11-20T03:00:00Z" }, now), false);
  assert.equal(isPastClientCancelCutoff({ status: "waiting_confirmation", starts_at: "2026-11-20T00:30:00Z" }, now), false);
});

test("reports bucket months in WITA and start 11 WITA months back", async () => {
  const { witaMonthKey, reportWindowStart } = await import("../src/services/reporting.service.js");
  assert.equal(witaMonthKey("2026-10-31T17:00:00Z"), "2026-11");
  assert.equal(witaMonthKey("2026-10-31T15:59:00Z"), "2026-10");
  assert.equal(reportWindowStart(Date.parse("2026-11-17T00:00:00Z")), "2025-11-30T16:00:00.000Z");
  const source = readFileSync(new URL("../src/services/reporting.service.js", import.meta.url), "utf8");
  assert.match(source, /\.range\(offset, offset \+ REPORT_PAGE_SIZE - 1\)/);
  assert.doesNotMatch(source, /\.limit\(1000\)/);
});

test("migration 20261117120000 uses WITA dates, client limits, and template-independent readiness", () => {
  const sql = readFileSync(new URL("../../supabase/migrations/20261117120000_sicare_wita_dates_booking_limits.sql", import.meta.url), "utf8");
  assert.doesNotMatch(sql, /starts_at::date|ends_at::date/);
  assert.equal((sql.match(/at time zone 'Asia\/Makassar'\)::date/g) ?? []).length, 5);
  assert.match(sql, /BOOKING_CLIENT_OVERLAP/);
  assert.match(sql, /\) >= 2 then\s+raise exception using errcode = 'P0001', message = 'BOOKING_CLIENT_LIMIT_REACHED'/);
  assert.doesNotMatch(sql, /ic\.consent_template_id = v_active_template\.id;/);
});

test("new booking error codes map to 409", async () => {
  const source = readFileSync(new URL("../src/lib/domainRpc.js", import.meta.url), "utf8");
  assert.match(source, /BOOKING_CLIENT_OVERLAP: \[409/);
  assert.match(source, /BOOKING_CLIENT_LIMIT_REACHED: \[409/);
});
