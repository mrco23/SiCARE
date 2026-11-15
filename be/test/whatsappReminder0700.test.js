import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { enqueueSessionReminders, witaMorning } from "../src/services/whatsappOutbox.service.js";
import { processOutboxJob } from "../src/workers/whatsapp.worker.js";
import { renderWhatsAppTemplate } from "../src/templates/whatsapp/index.js";

const migration = readFileSync(
  new URL("../../supabase/migrations/20261115130000_sicare_whatsapp_reminder_0700_wita.sql", import.meta.url),
  "utf8",
);

test("witaMorning returns 07.00 WITA (23.00 UTC the previous day)", () => {
  // 2030-01-02 11.00 WITA
  const startsAt = Date.parse("2030-01-02T03:00:00Z");
  assert.equal(witaMorning(startsAt, 0).toISOString(), "2030-01-01T23:00:00.000Z");
  assert.equal(witaMorning(startsAt, -1).toISOString(), "2029-12-31T23:00:00.000Z");
  // 00.30 WITA belongs to the same WITA day, even though UTC is still the previous date.
  assert.equal(witaMorning(Date.parse("2030-01-01T16:30:00Z"), 0).toISOString(), "2030-01-01T23:00:00.000Z");
});

function captureClient() {
  const rows = [];
  const check = { eq: () => check, gte: () => check, lt: () => check, limit: async () => ({ data: [], error: null }) };
  return {
    rows,
    from() {
      return {
        select: () => check,
        insert(row) {
          rows.push(row);
          return { select: () => ({ maybeSingle: async () => ({ data: { id: `r${rows.length}` }, error: null }) }) };
        },
      };
    },
  };
}

const booking = (startsIso) => ({
  id: "book-1",
  client_id: "client-1",
  counselor_id: "counselor-1",
  starts_at: startsIso,
  ends_at: new Date(Date.parse(startsIso) + 3600_000).toISOString(),
});

test("10.00 WITA session gets H-1 07.00, morning 07.00, and 1-hour reminders", async () => {
  const client = captureClient();
  await enqueueSessionReminders({ supabaseClient: client, booking: booking("2030-01-02T02:00:00Z") });
  const byType = (t) => client.rows.filter((r) => r.message_type === t).map((r) => new Date(r.scheduled_at).toISOString());
  assert.deepEqual(byType("reminder_h1"), ["2029-12-31T23:00:00.000Z", "2029-12-31T23:00:00.000Z"]);
  assert.deepEqual(byType("reminder_morning"), ["2030-01-01T23:00:00.000Z", "2030-01-01T23:00:00.000Z"]);
  assert.deepEqual(byType("reminder_day_of"), ["2030-01-02T01:00:00.000Z", "2030-01-02T01:00:00.000Z"]);
});

test("08.00 WITA session skips the morning reminder because the 1-hour reminder is also at 07.00", async () => {
  const client = captureClient();
  await enqueueSessionReminders({ supabaseClient: client, booking: booking("2030-01-02T00:00:00Z") });
  assert.equal(client.rows.filter((r) => r.message_type === "reminder_morning").length, 0);
  assert.equal(client.rows.filter((r) => r.message_type === "reminder_day_of").length, 2);
});

async function withNow(isoNow, fn) {
  const realNow = Date.now;
  Date.now = () => Date.parse(isoNow);
  try {
    return await fn();
  } finally {
    Date.now = realNow;
  }
}

// Sesi Selasa 2030-01-08 08.00 WITA (00:00 UTC). H-1 = Senin 07.00 WITA (2030-01-06 23:00 UTC).
const tuesdayEight = booking("2030-01-08T00:00:00Z");

test("confirmed on H-1 before 07.00: H-1 waits for 07.00 WITA", async () => {
  const client = captureClient();
  // Senin 06.00 WITA
  await withNow("2030-01-06T22:00:00Z", () => enqueueSessionReminders({ supabaseClient: client, booking: tuesdayEight }));
  const h1 = client.rows.filter((r) => r.message_type === "reminder_h1");
  assert.equal(h1.length, 2);
  for (const row of h1) assert.equal(new Date(row.scheduled_at).toISOString(), "2030-01-06T23:00:00.000Z");
});

test("confirmed on H-1 after 07.00 (Monday 13.00 WITA): H-1 is sent immediately", async () => {
  const client = captureClient();
  // Senin 13.00 WITA
  await withNow("2030-01-07T05:00:00Z", () => enqueueSessionReminders({ supabaseClient: client, booking: tuesdayEight }));
  const h1 = client.rows.filter((r) => r.message_type === "reminder_h1");
  assert.equal(h1.length, 2);
  for (const row of h1) assert.equal(new Date(row.scheduled_at).toISOString(), "2030-01-07T05:00:00.000Z");
  // Sesi 08.00: pengingat pagi bertabrakan dengan pengingat 1 jam, jadi hanya 1 jam yang dibuat.
  assert.equal(client.rows.filter((r) => r.message_type === "reminder_morning").length, 0);
  assert.equal(client.rows.filter((r) => r.message_type === "reminder_day_of").length, 2);
});

test("confirmed late on H-1 (23.30 WITA) still sends H-1 immediately", async () => {
  const client = captureClient();
  await withNow("2030-01-07T15:30:00Z", () => enqueueSessionReminders({ supabaseClient: client, booking: tuesdayEight }));
  assert.equal(client.rows.filter((r) => r.message_type === "reminder_h1").length, 2);
});

test("confirmed on the session day: no H-1", async () => {
  const client = captureClient();
  // Selasa 00.30 WITA
  await withNow("2030-01-07T16:30:00Z", () => enqueueSessionReminders({ supabaseClient: client, booking: tuesdayEight }));
  assert.equal(client.rows.filter((r) => r.message_type === "reminder_h1").length, 0);
  assert.equal(client.rows.filter((r) => r.message_type === "reminder_day_of").length, 2);
});

test("an H-1 already sent immediately is not queued a second time by the scheduler", async () => {
  const rows = [];
  const existing = [{ message_type: "reminder_h1", recipient_user_id: "client-1", scheduled_at: "2030-01-07T05:00:00Z" }];
  const client = {
    from() {
      return {
        select() {
          const f = {};
          const ranges = [];
          const q = {
            eq(c, v) { f[c] = v; return q; },
            gte(c, v) { ranges.push((r) => Date.parse(r[c]) >= Date.parse(v)); return q; },
            lt(c, v) { ranges.push((r) => Date.parse(r[c]) < Date.parse(v)); return q; },
            limit: async () => ({
              data: existing.filter((r) => r.message_type === f.message_type && r.recipient_user_id === f.recipient_user_id && ranges.every((m) => m(r))),
              error: null,
            }),
          };
          return q;
        },
        insert(row) {
          rows.push(row);
          return { select: () => ({ maybeSingle: async () => ({ data: { id: "x" }, error: null }) }) };
        },
      };
    },
  };
  // Putaran scheduler 10 menit kemudian
  await withNow("2030-01-07T05:10:00Z", () => enqueueSessionReminders({ supabaseClient: client, booking: tuesdayEight }));
  const h1 = rows.filter((r) => r.message_type === "reminder_h1").map((r) => r.recipient_user_id);
  assert.deepEqual(h1, ["counselor-1"]);
});

function workerClient({ bookingStatus, sessionStatus }) {
  const updates = [];
  const single = (data) => ({ eq: () => ({ maybeSingle: async () => ({ data, error: null }) }) });
  return {
    updates,
    from(table) {
      if (table === "bookings") return { select: () => single({ id: "book-1", status: bookingStatus }) };
      if (table === "counseling_sessions") return { select: () => single({ id: "s1", status: sessionStatus }) };
      if (table === "whatsapp_outbox") {
        return { update: (patch) => ({ eq: async () => { updates.push(patch); return { error: null }; } }) };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
}

test("worker cancels a reminder when the session is no longer scheduled", async () => {
  const client = workerClient({ bookingStatus: "confirmed", sessionStatus: "missed" });
  const result = await processOutboxJob({
    supabaseClient: client,
    job: { id: "job-1", booking_id: "book-1", message_type: "reminder_morning", recipient_user_id: "client-1" },
    service: { sendMessage: async () => { throw new Error("must not send"); } },
  });
  assert.equal(result.error, "REMINDER_NOT_APPLICABLE");
  assert.equal(client.updates[0].status, "cancelled");
});

test("worker cancels a reminder when the booking was cancelled", async () => {
  const client = workerClient({ bookingStatus: "cancelled", sessionStatus: "cancelled" });
  const result = await processOutboxJob({
    supabaseClient: client,
    job: { id: "job-2", booking_id: "book-1", message_type: "reminder_h1", recipient_user_id: "client-1" },
    service: { sendMessage: async () => { throw new Error("must not send"); } },
  });
  assert.equal(result.error, "REMINDER_NOT_APPLICABLE");
});

test("morning reminder template says the session is today", () => {
  const text = renderWhatsAppTemplate("reminder_morning", {
    recipient_name: "Ani",
    partner_name: "Konselor B",
    booking_id: "11111111-2222-3333-4444-555555555555",
    starts_at: "2030-01-02T02:00:00Z",
    ends_at: "2030-01-02T03:00:00Z",
  });
  assert.match(text, /jadwal sesi konseling hari ini/);
  assert.match(text, /Halo Ani/);
});

test("migration adds reminder_morning, aligns RPC H-1 reminders to 07.00 WITA, and stops consent reminders", () => {
  assert.match(migration, /'reminder_morning',/);
  assert.match(migration, /date_trunc\('day', p_at at time zone 'Asia\/Makassar'\)/);
  assert.match(migration, /\+ interval '7 hours'/);
  assert.match(migration, /before insert on public\.whatsapp_outbox[\s\S]*when \(new\.message_type = 'reminder_h1'\)/);
  assert.match(migration, /sicare_wita_morning\(v_starts_at, -1\)/);
  assert.match(migration, /elsif v_now < v_window_end then\s+-- Dikonfirmasi pada hari H-1 setelah 07\.00: kirim langsung\.\s+new\.scheduled_at := v_now;/);
  assert.match(migration, /where message_type = 'consent_reminder'\s+and status in \('pending', 'queued', 'retry_wait'\)/);
});
