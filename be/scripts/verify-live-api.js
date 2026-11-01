const baseUrl = (process.env.SICARE_API_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");
const timeoutMs = Number(process.env.SICARE_VERIFY_TIMEOUT_MS || 10000);
const requireAllRoles = process.env.SICARE_REQUIRE_ALL_ROLES === "1";
const results = [];

async function request(method, path, token) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(method !== "GET" ? { "Content-Type": "application/json" } : {}),
    },
    ...(method !== "GET" ? { body: "{}" } : {}),
    signal: AbortSignal.timeout(timeoutMs),
  });
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    // Keep status diagnostics useful even if an unexpected response is not JSON.
  }
  return { status: response.status, payload };
}

async function check(label, method, path, expectedStatus, token) {
  try {
    const response = await request(method, path, token);
    const passed = response.status === expectedStatus;
    results.push({ label, passed, expectedStatus, actualStatus: response.status });
    console.log(`${passed ? "PASS" : "FAIL"} ${label}: expected ${expectedStatus}, got ${response.status}`);
    if (!passed && response.payload?.error) {
      console.log(`     API error: ${response.payload.error.code || "unknown"} - ${response.payload.error.message || "no message"}`);
    }
  } catch (error) {
    results.push({ label, passed: false, expectedStatus, actualStatus: null });
    console.log(`FAIL ${label}: ${error.name || "Error"} - ${error.message || "request failed"}`);
  }
}

console.log(`SiCARE live API verification: ${baseUrl}`);
console.log("Read-only checks only, except role-denial PATCH checks that must stop at authorization middleware. No records are created or changed.\n");

const publicChecks = [
  ["health", "GET", "/api/v1/health", 200],
  ["public counselor directory", "GET", "/api/v1/public/counselors", 200],
  ["public hero motivations", "GET", "/api/v1/public/hero-motivations", 200],
  ["public academic periods", "GET", "/api/v1/public/periods", 200],
  ["public availability", "GET", "/api/v1/public/availability", 200],
  ["public approved feedback", "GET", "/api/v1/public/feedback", 200],
];
for (const [label, method, path, status] of publicChecks) await check(label, method, path, status);

const protectedChecks = [
  ["profile rejects missing token", "GET", "/api/v1/profile", 401],
  ["bookings reject missing token", "GET", "/api/v1/bookings", 401],
  ["sessions reject missing token", "GET", "/api/v1/sessions", 401],
  ["notifications reject missing token", "GET", "/api/v1/notifications", 401],
  ["admin accounts reject missing token", "GET", "/api/v1/admin/accounts", 401],
  ["admin hero motivations reject missing token", "GET", "/api/v1/admin/hero-motivations", 401],
  ["counselor profile rejects missing token", "GET", "/api/v1/counselor/profile", 401],
  ["Head LMI dashboard rejects missing token", "GET", "/api/v1/head-lmi/dashboard", 401],
  ["feedback moderation rejects missing token", "GET", "/api/v1/admin/feedback", 401],
];
for (const [label, method, path, status] of protectedChecks) await check(label, method, path, status);

const roleChecks = {
  client: {
    allowed: [
      ["profile", "GET", "/api/v1/profile"],
      ["bookings", "GET", "/api/v1/bookings"],
      ["sessions", "GET", "/api/v1/sessions"],
      ["my feedback", "GET", "/api/v1/feedback/mine"],
      ["notifications", "GET", "/api/v1/notifications"],
    ],
    denied: [
      ["admin accounts", "GET", "/api/v1/admin/accounts"],
      ["counselor profile", "GET", "/api/v1/counselor/profile"],
      ["Head LMI dashboard", "GET", "/api/v1/head-lmi/dashboard"],
    ],
  },
  counselor: {
    allowed: [
      ["profile", "GET", "/api/v1/profile"],
      ["bookings", "GET", "/api/v1/bookings"],
      ["sessions", "GET", "/api/v1/sessions"],
      ["counselor profile", "GET", "/api/v1/counselor/profile"],
      ["availability", "GET", "/api/v1/counselor/availability"],
      ["approved counselor feedback", "GET", "/api/v1/feedback/counselor"],
      ["notifications", "GET", "/api/v1/notifications"],
    ],
    denied: [
      ["admin accounts", "GET", "/api/v1/admin/accounts"],
      ["client feedback list", "GET", "/api/v1/feedback/mine"],
      ["Head LMI dashboard", "GET", "/api/v1/head-lmi/dashboard"],
    ],
  },
  admin: {
    allowed: [
      ["profile", "GET", "/api/v1/profile"],
      ["accounts", "GET", "/api/v1/admin/accounts"],
      ["academic periods", "GET", "/api/v1/admin/periods"],
      ["hero motivations", "GET", "/api/v1/admin/hero-motivations"],
      ["dashboard", "GET", "/api/v1/admin/dashboard"],
      ["reports", "GET", "/api/v1/admin/reports"],
      ["activity", "GET", "/api/v1/admin/activity"],
      ["counseling list", "GET", "/api/v1/admin/counseling"],
      ["feedback moderation queue", "GET", "/api/v1/admin/feedback"],
      ["feedback statistics", "GET", "/api/v1/admin/feedback/statistics"],
      ["notifications", "GET", "/api/v1/notifications"],
    ],
    denied: [
      ["counselor profile", "GET", "/api/v1/counselor/profile"],
      ["Head LMI dashboard", "GET", "/api/v1/head-lmi/dashboard"],
      ["Head LMI review action", "PATCH", "/api/v1/admin/feedback/00000000-0000-4000-8000-000000000000/review"],
    ],
  },
  head_lmi: {
    allowed: [
      ["profile", "GET", "/api/v1/profile"],
      ["dashboard", "GET", "/api/v1/head-lmi/dashboard"],
      ["reports", "GET", "/api/v1/head-lmi/reports"],
      ["counseling list", "GET", "/api/v1/admin/counseling"],
      ["feedback review queue", "GET", "/api/v1/admin/feedback"],
      ["feedback statistics", "GET", "/api/v1/admin/feedback/statistics"],
      ["notifications", "GET", "/api/v1/notifications"],
    ],
    denied: [
      ["admin accounts", "GET", "/api/v1/admin/accounts"],
      ["academic period management", "GET", "/api/v1/admin/periods"],
      ["admin moderation action", "PATCH", "/api/v1/admin/feedback/00000000-0000-4000-8000-000000000000/moderation"],
    ],
  },
};

let missingRoleTokens = 0;
for (const [role, checks] of Object.entries(roleChecks)) {
  const token = process.env[`SICARE_${role.toUpperCase()}_TOKEN`];
  if (!token) {
    missingRoleTokens += 1;
    console.log(`\nSKIP role checks for ${role}: SICARE_${role.toUpperCase()}_TOKEN is not set.`);
    continue;
  }
  console.log(`\nRole checks: ${role}`);
  for (const [name, method, path] of checks.allowed) {
    await check(`${role} allowed: ${name}`, method, path, 200, token);
  }
  for (const [name, method, path] of checks.denied) {
    await check(`${role} forbidden: ${name}`, method, path, 403, token);
  }
}

if (requireAllRoles && missingRoleTokens > 0) {
  results.push({ label: "all role tokens supplied", passed: false, expectedStatus: null, actualStatus: null });
  console.log(`\nFAIL strict role verification: ${missingRoleTokens} role token(s) missing.`);
}

const passed = results.filter((item) => item.passed).length;
const failed = results.length - passed;
console.log(`\nSummary: ${passed} passed, ${failed} failed, ${missingRoleTokens} role token(s) skipped.`);
if (missingRoleTokens > 0 && !requireAllRoles) {
  console.log("Note: public/unauthenticated checks do not replace role verification. Set all four role tokens to run the complete matrix.");
}
process.exitCode = failed > 0 ? 1 : 0;
