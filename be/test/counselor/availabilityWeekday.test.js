import test from "node:test";
import assert from "node:assert/strict";
import {
  slotSchema,
  isWeekendInOperationalZone,
  isDevelopmentAppEnv,
} from "../../src/validators/counselor.validator.js";

/** Menjalankan fn dengan APP_ENV sementara, lalu mengembalikan nilai aslinya. */
function withEnv(patch, fn) {
  const saved = { APP_ENV: process.env.APP_ENV };
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
  withEnv({ APP_ENV: "production" }, () => {
    for (const day of [6, 0]) {
      const result = slotSchema.safeParse(slot(nextWitaWeekday(day)));
      assert.equal(result.success, false);
      assert.match(result.error.issues.map((i) => i.message).join(" "), /hari kerja/);
    }
  });
});

test("counselor slots Monday to Friday are accepted", () => {
  withEnv({ APP_ENV: "production" }, () => {
    for (const day of [1, 2, 3, 4, 5]) {
      assert.equal(slotSchema.safeParse(slot(nextWitaWeekday(day))).success, true, `day ${day}`);
    }
  });
});

test("weekend slots are accepted in development so the flow can be tested on weekends", () => {
  withEnv({ APP_ENV: "development" }, () => {
    for (const day of [6, 0]) {
      assert.equal(slotSchema.safeParse(slot(nextWitaWeekday(day))).success, true, `day ${day}`);
    }
  });
});

test("weekend slots are rejected when APP_ENV is empty (defaults to production)", () => {
  withEnv({ APP_ENV: undefined }, () => {
    assert.equal(slotSchema.safeParse(slot(nextWitaWeekday(6))).success, false);
  });
});

test("development allows slots outside working hours", () => {
  withEnv({ APP_ENV: "development" }, () => {
    const late = nextWitaWeekday(3);
    late.setUTCHours(14, 0, 0, 0); // 22.00 WITA
    assert.equal(slotSchema.safeParse(slot(late)).success, true);
  });
});

test("APP_ENV switch: only 'development' relaxes the rules; NODE_ENV no longer matters", () => {
  assert.equal(isDevelopmentAppEnv({ APP_ENV: "development" }), true);
  assert.equal(isDevelopmentAppEnv({ APP_ENV: " Development " }), true);
  assert.equal(isDevelopmentAppEnv({ APP_ENV: "production" }), false);
  assert.equal(isDevelopmentAppEnv({}), false);
  assert.equal(isDevelopmentAppEnv({ NODE_ENV: "development" }), false);
  assert.equal(isDevelopmentAppEnv({ NODE_ENV: "test", WEEKDAY_ONLY: "false" }), false);
});
