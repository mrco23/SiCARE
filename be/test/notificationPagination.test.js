import assert from "node:assert/strict";
import { test } from "node:test";
import { notificationService } from "../src/services/notification.service.js";

function makeRows(n, offset = 0) {
  return Array.from({ length: n }, (_, i) => ({ id: `notif-${offset + i}`, created_at: "2026-11-13T00:00:00Z" }));
}

function mockClient({ rangeRows, unreadCount = 0 }) {
  return {
    from(table) {
      assert.equal(table, "notifications");
      return {
        select(_columns, options) {
          if (options?.count === "exact" && options?.head) {
            // unread_count query
            return {
              eq: () => ({ is: async () => ({ count: unreadCount, error: null }) }),
            };
          }
          // main list query
          return {
            eq: () => ({
              order: () => ({
                range: async (_from, _to) => ({ data: rangeRows, error: null }),
              }),
            }),
          };
        },
      };
    },
  };
}

test("listNotifications requests PAGE_SIZE+1 rows and reports has_more=true when an extra row comes back", async () => {
  const supa = mockClient({ rangeRows: makeRows(11), unreadCount: 3 });
  const result = await notificationService.listNotifications({
    userId: "user-1",
    unreadOnly: "false",
    limit: 10,
    offset: 0,
    supabaseClient: supa,
  });

  assert.equal(result.items.length, 10, "slices off the extra lookahead row");
  assert.equal(result.has_more, true);
  assert.equal(result.unread_count, 3);
});

test("listNotifications reports has_more=false on the last page", async () => {
  const supa = mockClient({ rangeRows: makeRows(4), unreadCount: 0 });
  const result = await notificationService.listNotifications({
    userId: "user-1",
    unreadOnly: "false",
    limit: 10,
    offset: 10,
    supabaseClient: supa,
  });

  assert.equal(result.items.length, 4);
  assert.equal(result.has_more, false);
});
