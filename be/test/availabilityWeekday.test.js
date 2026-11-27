import test from "node:test";
import assert from "node:assert/strict";
import {
  slotSchema,
  isWeekendInOperationalZone,
  isWeekdayOnlyEnforced,
} from "../src/validators/counselor.validator.js";

/** Menjalankan fn dengan NODE_ENV/WEEKDAY_ONLY sementara, lalu mengembalikan nilai aslinya. */
function withEnv(patch, fn) {
  const saved = { NODE_ENV: process.env.NODE_ENV, WEEKDAY_ONLY: process.env.WEEKDAY_ONLY };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return fn();
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

/** Returns the next date (>= 2 days ahead) whose WITA weekday matches, at 09:00 WITA (01:00 UTC). */
function nextWitaWeekday(targetDay) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 2);
  for (let i = 0; i < 14; i += 1) {
    const probe = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + i, 1, 0, 0));
    if (probe.getUTCDay() === targetDay) return probe;
  }
  throw new Error("unreachable");
}

const slot = (start) => ({
  starts_at: start.toISOString(),
  ends_at: new Date(start.getTime() + 60 * 60 * 1000).toISOString(),
});

test("weekday detection follows WITA, not UTC", () => {
  // Saturday 00:30 WITA is still Friday 16:30 UTC.
  assert.equal(isWeekendInOperationalZone("2026-11-20T16:30:00Z"), true);
  // Monday 07:00 WITA is Sunday 23:00 UTC.
  assert.equal(isWeekendInOperationalZone("2026-11-22T23:00:00Z"), false);
});

test("counselor slots on Saturday and Sunday are rejected in production", () => {
  withEnv({ NODE_ENV: "production", WEEKDAY_ONLY: undefined }, () => {
    for (const day of [6, 0]) {
      const result = slotSchema.safeParse(slot(nextWitaWeekday(day)));
      assert.equal(result.success, false);
      assert.match(result.error.issues.map((i) => i.message).join(" "), /hari kerja/);
    }
  });
});

test("counselor slots Monday to Friday are accepted", () => {
  withEnv({ NODE_ENV: "production", WEEKDAY_ONLY: undefined }, () => {
    for (const day of [1, 2, 3, 4, 5]) {
      assert.equal(slotSchema.safeParse(slot(nextWitaWeekday(day))).success, true, `day ${day}`);
    }
  });
});

test("weekend slots are accepted in development so the flow can be tested on weekends", () => {
  withEnv({ NODE_ENV: "development", WEEKDAY_ONLY: undefined }, () => {
    for (const day of [6, 0]) {
      assert.equal(slotSchema.safeParse(slot(nextWitaWeekday(day))).success, true, `day ${day}`);
    }
  });
});

test("weekday-only switch: WEEKDAY_ONLY overrides NODE_ENV; missing NODE_ENV stays enforced", () => {
  assert.equal(isWeekdayOnlyEnforced({ NODE_ENV: "production" }), true);
  assert.equal(isWeekdayOnlyEnforced({}), true);
  assert.equal(isWeekdayOnlyEnforced({ NODE_ENV: "development" }), false);
  assert.equal(isWeekdayOnlyEnforced({ NODE_ENV: "test" }), false);
  assert.equal(isWeekdayOnlyEnforced({ NODE_ENV: "development", WEEKDAY_ONLY: "true" }), true);
  assert.equal(isWeekdayOnlyEnforced({ NODE_ENV: "production", WEEKDAY_ONLY: "false" }), false);
});
