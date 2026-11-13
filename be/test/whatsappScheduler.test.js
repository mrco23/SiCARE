import assert from "node:assert/strict";
import { test } from "node:test";
import { scanUpcomingSessionsAndEnqueueReminders } from "../src/workers/whatsapp.scheduler.js";

test("scanUpcomingSessionsAndEnqueueReminders generates H-1 and Day-of reminders for upcoming confirmed sessions", async () => {
  const futureDate = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const futureEndDate = new Date(Date.now() + 49 * 60 * 60 * 1000).toISOString();

  const sessions = [
    {
      id: "sess-1",
      booking_id: "book-1",
      counselor_id: "counselor-1",
      starts_at: futureDate,
      ends_at: futureEndDate,
      status: "scheduled",
      format: "offline",
      room: "Ruang 102",
      bookings: {
        id: "book-1",
        client_id: "client-1",
        counselor_id: "counselor-1",
        status: "confirmed",
        starts_at: futureDate,
        ends_at: futureEndDate,
      },
    },
  ];

  const enqueuedRows = [];
  const mockClient = {
    from(table) {
      if (table === "counseling_sessions") {
        return {
          select() {
            return {
              eq() {
                return {
                  gte() {
                    return {
                      lte() {
                        return {
                          order: async () => ({ data: sessions, error: null }),
                        };
                      },
                    };
                  },
                };
              },
            };
          },
        };
      }
      if (table === "profiles") {
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle: async () => ({ data: { full_name: "Mahasiswa A" }, error: null }),
                };
              },
            };
          },
        };
      }
      if (table === "counselor_profiles") {
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle: async () => ({ data: { public_name: "Konselor B" }, error: null }),
                };
              },
            };
          },
        };
      }
      if (table === "whatsapp_outbox") {
        const existingCheck = {
          eq: () => existingCheck,
          limit: async () => ({ data: [], error: null }),
        };
        return {
          select: () => existingCheck,
          insert(row) {
            enqueuedRows.push(row);
            return {
              select: () => ({
                maybeSingle: async () => ({ data: { id: "rem-" + enqueuedRows.length }, error: null }),
              }),
            };
          },
        };
      }
      throw new Error(`Unexpected table ${table}`);
    },
  };

  const result = await scanUpcomingSessionsAndEnqueueReminders({
    supabaseClient: mockClient,
    lookaheadDays: 7,
  });

  assert.equal(result.scannedSessions, 1);
  // 2 recipients (client + counselor) * 2 reminders (H-1 + Day-of) = 4 reminders
  assert.equal(result.enqueuedReminders, 4);
  assert.equal(enqueuedRows.length, 4);

  const h1Rows = enqueuedRows.filter((r) => r.message_type === "reminder_h1");
  const dayOfRows = enqueuedRows.filter((r) => r.message_type === "reminder_day_of");
  assert.equal(h1Rows.length, 2);
  assert.equal(dayOfRows.length, 2);
});

test("scanUpcomingSessionsAndEnqueueReminders cancels obsolete reminders for cancelled bookings", async () => {
  const sessions = [
    {
      id: "sess-2",
      booking_id: "book-cancelled",
      counselor_id: "counselor-1",
      starts_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      ends_at: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString(),
      status: "scheduled",
      bookings: {
        id: "book-cancelled",
        client_id: "client-1",
        counselor_id: "counselor-1",
        status: "cancelled", // CANCELLED
      },
    },
  ];

  let cancelCalled = false;
  const mockClient = {
    from(table) {
      if (table === "counseling_sessions") {
        return {
          select() {
            return {
              eq() {
                return {
                  gte() {
                    return {
                      lte() {
                        return {
                          order: async () => ({ data: sessions, error: null }),
                        };
                      },
                    };
                  },
                };
              },
            };
          },
        };
      }
      if (table === "whatsapp_outbox") {
        return {
          update() {
            return {
              eq(col, val) {
                assert.equal(val, "book-cancelled");
                return {
                  in() {
                    return {
                      in() {
                        cancelCalled = true;
                        return {
                          select: async () => ({ data: [{ id: "c1" }], error: null }),
                        };
                      },
                    };
                  },
                };
              },
            };
          },
        };
      }
      throw new Error(`Unexpected table ${table}`);
    },
  };

  const result = await scanUpcomingSessionsAndEnqueueReminders({
    supabaseClient: mockClient,
  });

  assert.equal(result.scannedSessions, 1);
  assert.equal(result.enqueuedReminders, 0);
  assert.equal(result.cleanedReminders, 1);
  assert.equal(cancelCalled, true);
});
