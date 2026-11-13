import assert from "node:assert/strict";
import { test } from "node:test";
import {
  calculateRetryDelayMs,
  cancelObsoleteReminders,
  enqueueBookingNotifications,
  enqueueOutboxMessage,
  enqueueSessionReminders,
  generateIdempotencyKey,
} from "../src/services/whatsappOutbox.service.js";

test("generateIdempotencyKey produces deterministic keys", () => {
  const key = generateIdempotencyKey("book-123", "booking_accepted", "user-456");
  assert.equal(key, "booking:book-123:booking_accepted:user-456");

  const keyWithQualifier = generateIdempotencyKey("book-123", "reminder_h1", "user-456", "2026-11-10T09:00:00Z");
  assert.equal(keyWithQualifier, "booking:book-123:reminder_h1:user-456:2026-11-10T09:00:00Z");

  assert.throws(() => generateIdempotencyKey("", "type", "user"), /required/);
  assert.throws(() => generateIdempotencyKey("book", "", "user"), /required/);
  assert.throws(() => generateIdempotencyKey("book", "type", ""), /required/);
});

test("calculateRetryDelayMs produces expected backoff with jitter", () => {
  // Attempt 1: ~60s (between 50s and 70s)
  const d1 = calculateRetryDelayMs(1);
  assert.ok(d1 >= 50000 && d1 <= 75000, `d1 ${d1} out of range`);

  // Attempt 2: ~300s (between 250s and 350s)
  const d2 = calculateRetryDelayMs(2);
  assert.ok(d2 >= 250000 && d2 <= 350000, `d2 ${d2} out of range`);

  // Attempt 3: ~900s (between 750s and 1050s)
  const d3 = calculateRetryDelayMs(3);
  assert.ok(d3 >= 750000 && d3 <= 1050000, `d3 ${d3} out of range`);

  // Attempt 4: ~3600s (between 3000s and 4200s)
  const d4 = calculateRetryDelayMs(4);
  assert.ok(d4 >= 3000000 && d4 <= 4200000, `d4 ${d4} out of range`);
});

test("enqueueOutboxMessage inserts row and handles duplicate idempotency gracefully", async () => {
  const insertedRows = [];
  const mockClient = {
    from(table) {
      assert.equal(table, "whatsapp_outbox");
      return {
        insert(row) {
          if (insertedRows.some((r) => r.idempotency_key === row.idempotency_key)) {
            return {
              select: () => ({
                maybeSingle: async () => ({
                  data: null,
                  error: { code: "23505", message: "duplicate key value violates unique constraint" },
                }),
              }),
            };
          }
          insertedRows.push(row);
          return {
            select: () => ({
              maybeSingle: async () => ({ data: { id: "outbox-uuid-1" }, error: null }),
            }),
          };
        },
      };
    },
  };

  const res1 = await enqueueOutboxMessage({
    supabaseClient: mockClient,
    bookingId: "b-1",
    recipientUserId: "u-1",
    messageType: "booking_accepted",
  });

  assert.equal(res1.success, true);
  assert.equal(res1.outboxId, "outbox-uuid-1");
  assert.equal(insertedRows.length, 1);

  // Duplicate attempt must be skipped safely
  const res2 = await enqueueOutboxMessage({
    supabaseClient: mockClient,
    bookingId: "b-1",
    recipientUserId: "u-1",
    messageType: "booking_accepted",
  });

  assert.equal(res2.success, true);
  assert.equal(res2.skippedDuplicate, true);
  assert.equal(insertedRows.length, 1);
});

test("enqueueBookingNotifications handles booking_created event for client and counselor", async () => {
  const rows = [];
  const mockClient = {
    from() {
      return {
        insert(row) {
          rows.push(row);
          return {
            select: () => ({
              maybeSingle: async () => ({ data: { id: "outbox-" + rows.length }, error: null }),
            }),
          };
        },
      };
    },
  };

  const booking = {
    id: "booking-101",
    client_id: "client-uuid",
    counselor_id: "counselor-uuid",
    starts_at: "2026-11-10T09:00:00Z",
    ends_at: "2026-11-10T10:00:00Z",
    service_type: "individual",
  };

  const result = await enqueueBookingNotifications({
    supabaseClient: mockClient,
    booking,
    eventType: "booking_created",
    clientName: "Budi Klien",
    counselorName: "Dr. Siti Konselor",
  });

  assert.equal(result.enqueued, 2);
  assert.equal(rows.length, 2);

  const counselorJob = rows.find((r) => r.message_type === "booking_requested");
  assert.ok(counselorJob);
  assert.equal(counselorJob.recipient_user_id, "counselor-uuid");
  assert.equal(counselorJob.payload.counselor_name, "Dr. Siti Konselor");

  const clientJob = rows.find((r) => r.message_type === "booking_received");
  assert.ok(clientJob);
  assert.equal(clientJob.recipient_user_id, "client-uuid");
  assert.equal(clientJob.payload.client_name, "Budi Klien");
});

test("cancelObsoleteReminders updates pending and retry_wait reminders to cancelled", async () => {
  let updatedPayload = null;
  let eqBookingId = null;
  const mockClient = {
    from(table) {
      assert.equal(table, "whatsapp_outbox");
      return {
        update(patch) {
          updatedPayload = patch;
          return {
            eq(col, val) {
              eqBookingId = val;
              return {
                in() {
                  return {
                    in() {
                      return {
                        select: async () => ({ data: [{ id: "rem-1" }, { id: "rem-2" }], error: null }),
                      };
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  };

  const count = await cancelObsoleteReminders("b-cancelled-123", mockClient);
  assert.equal(count, 2);
  assert.equal(eqBookingId, "b-cancelled-123");
  assert.equal(updatedPayload.status, "cancelled");
});

function reminderOutboxMock(existingRows, { failCheck = false } = {}) {
  const insertedRows = [];
  const client = {
    from(table) {
      assert.equal(table, "whatsapp_outbox");
      return {
        select() {
          const filters = {};
          const query = {
            eq(column, value) {
              filters[column] = value;
              return query;
            },
            limit: async () => {
              if (failCheck) return { data: null, error: { message: "network" } };
              const rows = [...existingRows, ...insertedRows].filter((row) =>
                Object.entries(filters).every(([column, value]) =>
                  column === "scheduled_at"
                    ? new Date(row[column]).getTime() === new Date(value).getTime()
                    : row[column] === value,
                ),
              );
              return { data: rows.map((row) => ({ id: row.id ?? "new" })), error: null };
            },
          };
          return query;
        },
        insert(row) {
          insertedRows.push(row);
          return { select: () => ({ maybeSingle: async () => ({ data: { id: `new-${insertedRows.length}` }, error: null }) }) };
        },
      };
    },
  };
  return { client, insertedRows };
}

const reminderBooking = {
  id: "book-dup",
  client_id: "client-1",
  counselor_id: "counselor-1",
  // JSON format returned by Supabase; the booking RPC writes keys with "2030-01-02 03:00:00+00".
  starts_at: "2030-01-02T03:00:00+00:00",
  ends_at: "2030-01-02T04:00:00+00:00",
};

function rpcReminderRow(messageType, recipientUserId, scheduledAt) {
  return {
    id: `rpc-${messageType}-${recipientUserId}`,
    booking_id: reminderBooking.id,
    message_type: messageType,
    recipient_user_id: recipientUserId,
    // Postgres text format for the same instant, as written by the RPC
    scheduled_at: scheduledAt,
    idempotency_key: `booking:${reminderBooking.id}:${messageType}:${recipientUserId}:2030-01-02 03:00:00+00`,
    status: "failed",
  };
}

test("enqueueSessionReminders does not duplicate reminders the booking RPC already queued", async () => {
  const existing = ["client-1", "counselor-1"].flatMap((userId) => [
    rpcReminderRow("reminder_h1", userId, "2030-01-01 03:00:00+00"),
    rpcReminderRow("reminder_day_of", userId, "2030-01-02 02:00:00+00"),
  ]);
  const { client, insertedRows } = reminderOutboxMock(existing);

  const result = await enqueueSessionReminders({ supabaseClient: client, booking: reminderBooking });

  assert.equal(insertedRows.length, 0);
  assert.equal(result.enqueued, 0);
});

test("enqueueSessionReminders only fills in reminders that are missing", async () => {
  const existing = [
    rpcReminderRow("reminder_h1", "client-1", "2030-01-01 03:00:00+00"),
    rpcReminderRow("reminder_day_of", "client-1", "2030-01-02 02:00:00+00"),
  ];
  const { client, insertedRows } = reminderOutboxMock(existing);

  const result = await enqueueSessionReminders({ supabaseClient: client, booking: reminderBooking });

  assert.equal(result.enqueued, 2);
  assert.deepEqual(
    insertedRows.map((row) => `${row.message_type}:${row.recipient_user_id}`).sort(),
    ["reminder_day_of:counselor-1", "reminder_h1:counselor-1"],
  );
});

test("enqueueSessionReminders skips enqueueing when the existing-reminder check fails", async () => {
  const { client, insertedRows } = reminderOutboxMock([], { failCheck: true });

  const result = await enqueueSessionReminders({ supabaseClient: client, booking: reminderBooking });

  assert.equal(insertedRows.length, 0);
  assert.equal(result.enqueued, 0);
});
