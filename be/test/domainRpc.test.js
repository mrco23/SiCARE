import assert from "node:assert/strict";
import { test } from "node:test";
import { handleDomainRpcError } from "../src/lib/domainRpc.js";
import { HttpError } from "../src/lib/http.js";

test("domain RPC maps an unavailable booking slot to a conflict", () => {
  assert.throws(
    () => handleDomainRpcError({ code: "P0001", message: "BOOKING_SLOT_UNAVAILABLE" }),
    (error) => error instanceof HttpError && error.status === 409 && error.code === "SLOT_UNAVAILABLE",
  );
});

test("domain RPC maps an unauthorized booking transition to forbidden", () => {
  assert.throws(
    () => handleDomainRpcError({ code: "P0001", message: "BOOKING_FORBIDDEN" }),
    (error) => error instanceof HttpError && error.status === 403 && error.code === "BOOKING_FORBIDDEN",
  );
});

test("domain RPC maps an ineligible feedback session to conflict", () => {
  assert.throws(
    () => handleDomainRpcError({ code: "P0001", message: "FEEDBACK_SESSION_NOT_ELIGIBLE" }),
    (error) => error instanceof HttpError && error.status === 409 && error.code === "FEEDBACK_NOT_ELIGIBLE",
  );
});

test("domain RPC maps duplicate constraint violations to conflict", () => {
  assert.throws(
    () => handleDomainRpcError({ code: "23505", message: "duplicate key" }),
    (error) => error instanceof HttpError && error.status === 409 && error.code === "CONFLICT",
  );
});


test("domain RPC maps an ineligible reschedule request to a conflict", () => {
  assert.throws(
    () => handleDomainRpcError({ code: "P0001", message: "BOOKING_RESCHEDULE_NOT_ALLOWED" }),
    (error) => error instanceof HttpError && error.status === 409 && error.code === "BOOKING_RESCHEDULE_NOT_ALLOWED",
  );
});

test("domain RPC maps a missing reschedule reason to a validation error", () => {
  assert.throws(
    () => handleDomainRpcError({ code: "P0001", message: "BOOKING_RESCHEDULE_REASON_REQUIRED" }),
    (error) => error instanceof HttpError && error.status === 400 && error.code === "BOOKING_RESCHEDULE_REASON_REQUIRED",
  );
});
