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
