import assert from "node:assert/strict";
import { test } from "node:test";
import adminRoutes from "../src/routes/admin.routes.js";

test("admin routes load with Zod 4 schemas", () => {
  assert.ok(adminRoutes);
  assert.equal(typeof adminRoutes, "function");
});
