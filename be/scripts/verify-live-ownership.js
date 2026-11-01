import { createClient } from "@supabase/supabase-js";
import { env } from "../src/config/env.js";

const baseUrl = (process.env.SICARE_API_URL || `http://${env.HOST}:${env.PORT}`).replace(/\/+$/, "");
const timeoutMs = Number(process.env.SICARE_VERIFY_TIMEOUT_MS || 10000);
const strictExit = process.env.SICARE_REQUIRE_OWNERSHIP_PASS === "1";

const TOKEN_ENV_KEYS = Object.freeze({
  CLIENT_A: "SICARE_CLIENT_A_TOKEN",
  CLIENT_B: "SICARE_CLIENT_B_TOKEN",
  COUNSELOR_A: "SICARE_COUNSELOR_A_TOKEN",
  COUNSELOR_B: "SICARE_COUNSELOR_B_TOKEN",
});

const EXPECTED_ROLES = Object.freeze({
  CLIENT_A: "client",
  CLIENT_B: "client",
  COUNSELOR_A: "counselor",
  COUNSELOR_B: "counselor",
});

const matrix = [];

function maskUuid(value) {
  if (typeof value !== "string" || value.length < 8) return "<none>";
  return `${value.slice(0, 8)}...`;
}

function recordResult({ id, layer, test, account, owner, expected, actual, status }) {
  matrix.push({ id, layer, test, account, owner, expected, actual, status });
  console.log(`[${status}] ${id} (${layer}) ${test} | account=${account} owner=${owner} | expected: ${expected} | actual: ${actual}`);
}

async function apiGet(path, token) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  return { status: response.status, payload };
}

function createAuthenticatedRlsClient(supabaseUrl, publishableKey, accessToken) {
  return createClient(supabaseUrl, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "X-Client-Info": "sicare-rls-verifier",
      },
    },
  });
}

console.log("================================================================================");
console.log("SiCARE Batch 1.3c — Live Cross-User Ownership & Authenticated RLS Verification");
console.log("Mode: STRICTLY READ-ONLY (GET / SELECT only; no mutations or RPC writes)");
console.log(`Target Backend API: ${baseUrl}`);
console.log(`Configured NODE_ENV: ${env.NODE_ENV}`);
console.log("================================================================================\n");

// ----------------------------------------------------------------------------
// 1. Environment Safety Gate
// ----------------------------------------------------------------------------
const publishableKey = env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || "";
const isProdEnv =
  env.NODE_ENV === "production" ||
  String(process.env.SICARE_ENV || "").toLowerCase() === "production";

if (isProdEnv) {
  console.error("BLOCKED: Environment is marked as production. Live ownership verification must run only on a non-production testing environment.");
  process.exitCode = 2;
  process.exit();
}

if (!env.SUPABASE_URL || !publishableKey) {
  console.error("BLOCKED: SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY (or SUPABASE_ANON_KEY) must be configured for authenticated RLS verification.");
  process.exitCode = 2;
  process.exit();
}

if (/^sb_secret_|service_role/i.test(publishableKey)) {
  console.error("BLOCKED: Public key slot contains a secret/service-role key. Refusing to run RLS checks.");
  process.exitCode = 2;
  process.exit();
}

const rawTokens = {};
const missingTokenVars = [];
for (const [slot, envKey] of Object.entries(TOKEN_ENV_KEYS)) {
  const val = (process.env[envKey] || "").trim();
  if (!val) {
    missingTokenVars.push(envKey);
  } else if (/^sb_secret_|service_role/i.test(val)) {
    console.error(`BLOCKED: ${envKey} appears to be a service-role/secret key rather than a user access token.`);
    process.exitCode = 2;
    process.exit();
  } else {
    rawTokens[slot] = val;
  }
}

let backendReachable = false;
try {
  const health = await apiGet("/api/v1/health");
  backendReachable = health.status === 200;
  console.log(`Backend health probe: HTTP ${health.status} (${backendReachable ? "reachable" : "unexpected status"})`);
} catch (error) {
  console.log(`Backend health probe: UNREACHABLE (${error?.code || error?.name || "Error"})`);
}

// ----------------------------------------------------------------------------
// 2. Account Identity Verification (when tokens are supplied)
// ----------------------------------------------------------------------------
const identities = {};
let identitiesVerified = false;
let identityBlockReason = "";

if (missingTokenVars.length > 0) {
  identityBlockReason = `Missing environment token(s): ${missingTokenVars.join(", ")}`;
  console.log(`BLOCKED prerequisite: ${identityBlockReason}`);
} else if (!backendReachable) {
  identityBlockReason = `Local backend API is not reachable at ${baseUrl}`;
  console.log(`BLOCKED prerequisite: ${identityBlockReason}`);
} else {
  const uniqueTokens = new Set(Object.values(rawTokens));
  if (uniqueTokens.size !== 4) {
    identityBlockReason = "All four token slots must contain distinct access tokens";
    console.log(`BLOCKED prerequisite: ${identityBlockReason}`);
  } else {
    let allOk = true;
    for (const [slot, token] of Object.entries(rawTokens)) {
      const res = await apiGet("/api/v1/auth/me", token);
      const userId = res.payload?.data?.user?.id;
      const profile = res.payload?.data?.profile;
      const expectedRole = EXPECTED_ROLES[slot];

      if (
        res.status !== 200 ||
        !userId ||
        !profile ||
        profile.id !== userId ||
        profile.account_status !== "active" ||
        profile.app_role !== expectedRole
      ) {
        allOk = false;
        identityBlockReason = `${slot} failed /auth/me verification (HTTP ${res.status}, role=${profile?.app_role ?? "none"}, status=${profile?.account_status ?? "none"}, expectedRole=${expectedRole})`;
        console.log(`BLOCKED identity check: ${identityBlockReason}`);
        break;
      }
      identities[slot] = {
        slot,
        id: userId,
        maskedId: maskUuid(userId),
        role: profile.app_role,
        status: profile.account_status,
        token,
        rlsClient: createAuthenticatedRlsClient(env.SUPABASE_URL, publishableKey, token),
      };
      console.log(`Verified ${slot}: id=${maskUuid(userId)} role=${profile.app_role} status=${profile.account_status}`);
    }

    if (allOk) {
      const uniqueIds = new Set(Object.values(identities).map((item) => item.id));
      if (uniqueIds.size !== 4) {
        identityBlockReason = "The four tokens do not resolve to four distinct Supabase user UUIDs";
        console.log(`BLOCKED identity check: ${identityBlockReason}`);
      } else {
        identitiesVerified = true;
      }
    }
  }
}

// ----------------------------------------------------------------------------
// 3. Resource Discovery & Cross-User Verification
// ----------------------------------------------------------------------------
const discovered = {
  bookingsA: null,
  bookingsB: null,
  counselorBookingsA: null,
  counselorBookingsB: null,
  bookingA: null,
  bookingB: null,
  sessionsA: null,
  sessionsB: null,
  sessionA: null,
  sessionB: null,
  feedbackClientA: null,
  feedbackClientB: null,
  feedbackCounselorA: null,
  feedbackCounselorB: null,
  notificationsClientA: null,
  notificationsClientB: null,
  notificationsCounselorA: null,
  notificationsCounselorB: null,
  slotsCounselorA: null,
  slotsCounselorB: null,
};

if (!identitiesVerified) {
  const reason = `BLOCKED (${identityBlockReason})`;
  // Record all Backend API checks as BLOCKED
  const blockedApiChecks = [
    ["API-BK-01", "Client A lists own bookings only", "Client A", "Client A", "HTTP 200, only Client A rows"],
    ["API-BK-02", "Client B lists own bookings only", "Client B", "Client B", "HTTP 200, only Client B rows"],
    ["API-BK-03", "Client A retrieves Booking A detail", "Client A", "Client A", "HTTP 200, Booking A"],
    ["API-BK-04", "Client B cannot retrieve Booking A detail", "Client B", "Client A", "HTTP 404 BOOKING_NOT_FOUND"],
    ["API-BK-05", "Client B retrieves Booking B detail", "Client B", "Client B", "HTTP 200, Booking B"],
    ["API-BK-06", "Client A cannot retrieve Booking B detail", "Client A", "Client B", "HTTP 404 BOOKING_NOT_FOUND"],
    ["API-BK-07", "Counselor A lists assigned bookings only", "Counselor A", "Counselor A", "HTTP 200, only Counselor A rows"],
    ["API-BK-08", "Counselor B lists assigned bookings only", "Counselor B", "Counselor B", "HTTP 200, only Counselor B rows"],
    ["API-BK-09", "Counselor A cannot retrieve Booking B detail", "Counselor A", "Counselor B", "HTTP 404 BOOKING_NOT_FOUND"],
    ["API-BK-10", "Counselor B cannot retrieve Booking A detail", "Counselor B", "Counselor A", "HTTP 404 BOOKING_NOT_FOUND"],
    ["API-SS-01", "Client A retrieves Session A detail", "Client A", "Client A / Counselor A", "HTTP 200, Session A"],
    ["API-SS-02", "Client B cannot retrieve Session A detail", "Client B", "Client A / Counselor A", "HTTP 404 SESSION_NOT_FOUND"],
    ["API-SS-03", "Counselor A retrieves Session A detail", "Counselor A", "Client A / Counselor A", "HTTP 200, Session A"],
    ["API-SS-04", "Counselor B cannot retrieve Session A detail", "Counselor B", "Client A / Counselor A", "HTTP 404 SESSION_NOT_FOUND"],
    ["API-SS-05", "Client B retrieves Session B detail", "Client B", "Client B / Counselor B", "HTTP 200, Session B"],
    ["API-SS-06", "Client A cannot retrieve Session B detail", "Client A", "Client B / Counselor B", "HTTP 404 SESSION_NOT_FOUND"],
    ["API-SS-07", "Counselor B retrieves Session B detail", "Counselor B", "Client B / Counselor B", "HTTP 200, Session B"],
    ["API-SS-08", "Counselor A cannot retrieve Session B detail", "Counselor A", "Client B / Counselor B", "HTTP 404 SESSION_NOT_FOUND"],
    ["API-FB-01", "Client A lists own feedback (/feedback/mine)", "Client A", "Client A", "HTTP 200, no Client B rows"],
    ["API-FB-02", "Client B lists own feedback (/feedback/mine)", "Client B", "Client B", "HTTP 200, no Client A rows"],
    ["API-FB-03", "Counselor A lists authorized shown feedback", "Counselor A", "Counselor A", "HTTP 200, only Counselor A shown rows"],
    ["API-FB-04", "Counselor B lists authorized shown feedback", "Counselor B", "Counselor B", "HTTP 200, only Counselor B shown rows"],
    ["API-NT-01", "Client A lists recipient notifications only", "Client A", "Client A", "HTTP 200, no other user notifications"],
    ["API-NT-02", "Client B lists recipient notifications only", "Client B", "Client B", "HTTP 200, no other user notifications"],
    ["API-NT-03", "Counselor A lists recipient notifications only", "Counselor A", "Counselor A", "HTTP 200, no other user notifications"],
    ["API-NT-04", "Counselor B lists recipient notifications only", "Counselor B", "Counselor B", "HTTP 200, no other user notifications"],
    ["API-CS-01", "Counselor A reads own management profile & availability", "Counselor A", "Counselor A", "HTTP 200, only Counselor A data"],
    ["API-CS-02", "Counselor B reads own management profile & availability", "Counselor B", "Counselor B", "HTTP 200, only Counselor B data"],
    ["API-CS-03", "Clients rejected from counselor management endpoints", "Client A & B", "Counselor A/B", "HTTP 403 FORBIDDEN"],
  ];
  for (const [id, test, account, owner, expected] of blockedApiChecks) {
    recordResult({ id, layer: "API", test, account, owner, expected, actual: reason, status: "BLOCKED" });
  }

  const blockedRlsChecks = [
    ["RLS-A-01", "profiles: Client A reads self only, 0 rows for Client B", "Client A", "Client A / B", "1 self row; 0 rows for Client B"],
    ["RLS-A-02", "profiles: Counselor A reads self only, 0 rows for Counselor B", "Counselor A", "Counselor A / B", "1 self row; 0 rows for Counselor B"],
    ["RLS-A-03", "feedback: submitter-only SELECT enforced across Client B & Counselor A", "Client A, B, Counselor A", "Client A", "Owner only; 0 rows for others"],
    ["RLS-A-04", "notifications: recipient-only SELECT enforced across all 4 accounts", "All 4 accounts", "Each recipient", "0 cross-recipient rows"],
    ["RLS-B-01", "bookings: Client B SELECT on Booking A returns 0 rows", "Client B", "Client A", "HTTP 200, 0 rows"],
    ["RLS-B-02", "bookings: Counselor B SELECT on Booking A returns 0 rows", "Counselor B", "Counselor A", "HTTP 200, 0 rows"],
    ["RLS-B-03", "booking_participants: non-party SELECT returns 0 rows", "Client B / Counselor B", "Booking A", "HTTP 200, 0 rows"],
    ["RLS-B-04", "counseling_sessions: non-party SELECT on Session A/B returns 0 rows", "Client B / Counselor B", "Session A", "HTTP 200, 0 rows"],
    ["RLS-B-05", "availability_slots: Counselor B cannot SELECT non-available slots of Counselor A", "Counselor B", "Counselor A", "HTTP 200, 0 rows"],
    ["RLS-C-01", "audit_events: direct authenticated SELECT denied", "Client A / Counselor A", "System", "Permission denied (42501)"],
    ["RLS-C-02", "whatsapp_outbox: direct authenticated SELECT denied", "Client A / Counselor A", "System", "Permission denied (42501)"],
    ["RLS-C-03", "hero_motivations: direct authenticated SELECT denied", "Client A / Counselor A", "System", "Permission denied (42501)"],
    ["RLS-C-04", "sicare_public_availability RPC: direct authenticated EXECUTE denied", "Client A / Counselor A", "System", "Permission denied (42501)"],
  ];
  for (const [id, test, account, owner, expected] of blockedRlsChecks) {
    recordResult({ id, layer: "RLS", test, account, owner, expected, actual: reason, status: "BLOCKED" });
  }
} else {
  const { CLIENT_A: cA, CLIENT_B: cB, COUNSELOR_A: kA, COUNSELOR_B: kB } = identities;

  // --- 7.A & 7.B Booking Collection Discovery & Isolation ---
  const [bkResCA, bkResCB, bkResKA, bkResKB] = await Promise.all([
    apiGet("/api/v1/bookings", cA.token),
    apiGet("/api/v1/bookings", cB.token),
    apiGet("/api/v1/bookings", kA.token),
    apiGet("/api/v1/bookings", kB.token),
  ]);

  discovered.bookingsA = Array.isArray(bkResCA.payload?.data) ? bkResCA.payload.data : [];
  discovered.bookingsB = Array.isArray(bkResCB.payload?.data) ? bkResCB.payload.data : [];
  discovered.counselorBookingsA = Array.isArray(bkResKA.payload?.data) ? bkResKA.payload.data : [];
  discovered.counselorBookingsB = Array.isArray(bkResKB.payload?.data) ? bkResKB.payload.data : [];

  discovered.bookingA =
    discovered.bookingsA.find((b) => b.counselor_id === kA.id) || discovered.bookingsA[0] || null;
  discovered.bookingB =
    discovered.bookingsB.find((b) => b.counselor_id === kB.id) || discovered.bookingsB[0] || null;

  const cAAllOwned = bkResCA.status === 200 && discovered.bookingsA.every((b) => b.client_id === cA.id);
  recordResult({
    id: "API-BK-01",
    layer: "API",
    test: "Client A lists own bookings only",
    account: "Client A",
    owner: "Client A",
    expected: "HTTP 200, all rows client_id=Client A",
    actual: `HTTP ${bkResCA.status}, rows=${discovered.bookingsA.length}, allOwned=${cAAllOwned}`,
    status: cAAllOwned ? "PASS" : "FAIL",
  });

  const cBAllOwned = bkResCB.status === 200 && discovered.bookingsB.every((b) => b.client_id === cB.id);
  recordResult({
    id: "API-BK-02",
    layer: "API",
    test: "Client B lists own bookings only",
    account: "Client B",
    owner: "Client B",
    expected: "HTTP 200, all rows client_id=Client B",
    actual: `HTTP ${bkResCB.status}, rows=${discovered.bookingsB.length}, allOwned=${cBAllOwned}`,
    status: cBAllOwned ? "PASS" : "FAIL",
  });

  if (!discovered.bookingA) {
    for (const [id, test, account, owner, expected] of [
      ["API-BK-03", "Client A retrieves Booking A detail", "Client A", "Client A", "HTTP 200"],
      ["API-BK-04", "Client B cannot retrieve Booking A detail", "Client B", "Client A", "HTTP 404 BOOKING_NOT_FOUND"],
      ["API-BK-10", "Counselor B cannot retrieve Booking A detail", "Counselor B", "Counselor A", "HTTP 404 BOOKING_NOT_FOUND"],
    ]) {
      recordResult({ id, layer: "API", test, account, owner, expected, actual: "BLOCKED (No Booking A exists for Client A)", status: "BLOCKED" });
    }
  } else {
    const detA = await apiGet(`/api/v1/bookings/${discovered.bookingA.id}`, cA.token);
    const detAByB = await apiGet(`/api/v1/bookings/${discovered.bookingA.id}`, cB.token);
    const detAByKB = await apiGet(`/api/v1/bookings/${discovered.bookingA.id}`, kB.token);

    recordResult({
      id: "API-BK-03",
      layer: "API",
      test: "Client A retrieves Booking A detail",
      account: "Client A",
      owner: "Client A",
      expected: "HTTP 200, id=Booking A",
      actual: `HTTP ${detA.status}, match=${detA.payload?.data?.id === discovered.bookingA.id}`,
      status: detA.status === 200 && detA.payload?.data?.id === discovered.bookingA.id ? "PASS" : "FAIL",
    });

    recordResult({
      id: "API-BK-04",
      layer: "API",
      test: "Client B cannot retrieve Booking A detail",
      account: "Client B",
      owner: "Client A",
      expected: "HTTP 404 BOOKING_NOT_FOUND",
      actual: `HTTP ${detAByB.status} (${detAByB.payload?.error?.code ?? "none"})`,
      status: detAByB.status === 404 ? "PASS" : "FAIL",
    });

    if (discovered.bookingA.counselor_id === kB.id) {
      recordResult({
        id: "API-BK-10",
        layer: "API",
        test: "Counselor B cannot retrieve Booking A detail",
        account: "Counselor B",
        owner: "Counselor A",
        expected: "HTTP 404 BOOKING_NOT_FOUND",
        actual: "BLOCKED (Booking A is assigned to Counselor B rather than Counselor A)",
        status: "BLOCKED",
      });
    } else {
      recordResult({
        id: "API-BK-10",
        layer: "API",
        test: "Counselor B cannot retrieve Booking A detail",
        account: "Counselor B",
        owner: "Counselor A",
        expected: "HTTP 404 BOOKING_NOT_FOUND",
        actual: `HTTP ${detAByKB.status} (${detAByKB.payload?.error?.code ?? "none"})`,
        status: detAByKB.status === 404 ? "PASS" : "FAIL",
      });
    }
  }

  if (!discovered.bookingB) {
    for (const [id, test, account, owner, expected] of [
      ["API-BK-05", "Client B retrieves Booking B detail", "Client B", "Client B", "HTTP 200"],
      ["API-BK-06", "Client A cannot retrieve Booking B detail", "Client A", "Client B", "HTTP 404 BOOKING_NOT_FOUND"],
      ["API-BK-09", "Counselor A cannot retrieve Booking B detail", "Counselor A", "Counselor B", "HTTP 404 BOOKING_NOT_FOUND"],
    ]) {
      recordResult({ id, layer: "API", test, account, owner, expected, actual: "BLOCKED (No Booking B exists for Client B)", status: "BLOCKED" });
    }
  } else {
    const detB = await apiGet(`/api/v1/bookings/${discovered.bookingB.id}`, cB.token);
    const detBByA = await apiGet(`/api/v1/bookings/${discovered.bookingB.id}`, cA.token);
    const detBByKA = await apiGet(`/api/v1/bookings/${discovered.bookingB.id}`, kA.token);

    recordResult({
      id: "API-BK-05",
      layer: "API",
      test: "Client B retrieves Booking B detail",
      account: "Client B",
      owner: "Client B",
      expected: "HTTP 200, id=Booking B",
      actual: `HTTP ${detB.status}, match=${detB.payload?.data?.id === discovered.bookingB.id}`,
      status: detB.status === 200 && detB.payload?.data?.id === discovered.bookingB.id ? "PASS" : "FAIL",
    });

    recordResult({
      id: "API-BK-06",
      layer: "API",
      test: "Client A cannot retrieve Booking B detail",
      account: "Client A",
      owner: "Client B",
      expected: "HTTP 404 BOOKING_NOT_FOUND",
      actual: `HTTP ${detBByA.status} (${detBByA.payload?.error?.code ?? "none"})`,
      status: detBByA.status === 404 ? "PASS" : "FAIL",
    });

    if (discovered.bookingB.counselor_id === kA.id) {
      recordResult({
        id: "API-BK-09",
        layer: "API",
        test: "Counselor A cannot retrieve Booking B detail",
        account: "Counselor A",
        owner: "Counselor B",
        expected: "HTTP 404 BOOKING_NOT_FOUND",
        actual: "BLOCKED (Booking B is assigned to Counselor A rather than Counselor B)",
        status: "BLOCKED",
      });
    } else {
      recordResult({
        id: "API-BK-09",
        layer: "API",
        test: "Counselor A cannot retrieve Booking B detail",
        account: "Counselor A",
        owner: "Counselor B",
        expected: "HTTP 404 BOOKING_NOT_FOUND",
        actual: `HTTP ${detBByKA.status} (${detBByKA.payload?.error?.code ?? "none"})`,
        status: detBByKA.status === 404 ? "PASS" : "FAIL",
      });
    }
  }

  const kAAllOwned = bkResKA.status === 200 && discovered.counselorBookingsA.every((b) => b.counselor_id === kA.id);
  recordResult({
    id: "API-BK-07",
    layer: "API",
    test: "Counselor A lists assigned bookings only",
    account: "Counselor A",
    owner: "Counselor A",
    expected: "HTTP 200, all rows counselor_id=Counselor A",
    actual: `HTTP ${bkResKA.status}, rows=${discovered.counselorBookingsA.length}, allOwned=${kAAllOwned}`,
    status: kAAllOwned ? "PASS" : "FAIL",
  });

  const kBAllOwned = bkResKB.status === 200 && discovered.counselorBookingsB.every((b) => b.counselor_id === kB.id);
  recordResult({
    id: "API-BK-08",
    layer: "API",
    test: "Counselor B lists assigned bookings only",
    account: "Counselor B",
    owner: "Counselor B",
    expected: "HTTP 200, all rows counselor_id=Counselor B",
    actual: `HTTP ${bkResKB.status}, rows=${discovered.counselorBookingsB.length}, allOwned=${kBAllOwned}`,
    status: kBAllOwned ? "PASS" : "FAIL",
  });

  // --- 7.C Session Isolation ---
  const [ssResCA, ssResCB] = await Promise.all([
    apiGet("/api/v1/sessions", cA.token),
    apiGet("/api/v1/sessions", cB.token),
  ]);
  discovered.sessionsA = Array.isArray(ssResCA.payload?.data) ? ssResCA.payload.data : [];
  discovered.sessionsB = Array.isArray(ssResCB.payload?.data) ? ssResCB.payload.data : [];
  discovered.sessionA = discovered.sessionsA.find((s) => s.counselor_id === kA.id) || discovered.sessionsA[0] || null;
  discovered.sessionB = discovered.sessionsB.find((s) => s.counselor_id === kB.id) || discovered.sessionsB[0] || null;

  if (!discovered.sessionA) {
    for (const [id, test, account] of [
      ["API-SS-01", "Client A retrieves Session A detail", "Client A"],
      ["API-SS-02", "Client B cannot retrieve Session A detail", "Client B"],
      ["API-SS-03", "Counselor A retrieves Session A detail", "Counselor A"],
      ["API-SS-04", "Counselor B cannot retrieve Session A detail", "Counselor B"],
    ]) {
      recordResult({ id, layer: "API", test, account, owner: "Client A / Counselor A", expected: "Session A required", actual: "BLOCKED (No Session A exists)", status: "BLOCKED" });
    }
  } else {
    const [sA_cA, sA_cB, sA_kA, sA_kB] = await Promise.all([
      apiGet(`/api/v1/sessions/${discovered.sessionA.id}`, cA.token),
      apiGet(`/api/v1/sessions/${discovered.sessionA.id}`, cB.token),
      apiGet(`/api/v1/sessions/${discovered.sessionA.id}`, kA.token),
      apiGet(`/api/v1/sessions/${discovered.sessionA.id}`, kB.token),
    ]);
    recordResult({ id: "API-SS-01", layer: "API", test: "Client A retrieves Session A detail", account: "Client A", owner: "Client A", expected: "HTTP 200", actual: `HTTP ${sA_cA.status}`, status: sA_cA.status === 200 ? "PASS" : "FAIL" });
    recordResult({ id: "API-SS-02", layer: "API", test: "Client B cannot retrieve Session A detail", account: "Client B", owner: "Client A", expected: "HTTP 404", actual: `HTTP ${sA_cB.status}`, status: sA_cB.status === 404 ? "PASS" : "FAIL" });
    recordResult({ id: "API-SS-03", layer: "API", test: "Counselor A retrieves Session A detail", account: "Counselor A", owner: "Counselor A", expected: "HTTP 200", actual: `HTTP ${sA_kA.status}`, status: discovered.sessionA.counselor_id === kA.id ? (sA_kA.status === 200 ? "PASS" : "FAIL") : "BLOCKED" });
    recordResult({ id: "API-SS-04", layer: "API", test: "Counselor B cannot retrieve Session A detail", account: "Counselor B", owner: "Counselor A", expected: "HTTP 404", actual: `HTTP ${sA_kB.status}`, status: discovered.sessionA.counselor_id !== kB.id ? (sA_kB.status === 404 ? "PASS" : "FAIL") : "BLOCKED" });
  }

  if (!discovered.sessionB) {
    for (const [id, test, account] of [
      ["API-SS-05", "Client B retrieves Session B detail", "Client B"],
      ["API-SS-06", "Client A cannot retrieve Session B detail", "Client A"],
      ["API-SS-07", "Counselor B retrieves Session B detail", "Counselor B"],
      ["API-SS-08", "Counselor A cannot retrieve Session B detail", "Counselor A"],
    ]) {
      recordResult({ id, layer: "API", test, account, owner: "Client B / Counselor B", expected: "Session B required", actual: "BLOCKED (No Session B exists)", status: "BLOCKED" });
    }
  } else {
    const [sB_cB, sB_cA, sB_kB, sB_kA] = await Promise.all([
      apiGet(`/api/v1/sessions/${discovered.sessionB.id}`, cB.token),
      apiGet(`/api/v1/sessions/${discovered.sessionB.id}`, cA.token),
      apiGet(`/api/v1/sessions/${discovered.sessionB.id}`, kB.token),
      apiGet(`/api/v1/sessions/${discovered.sessionB.id}`, kA.token),
    ]);
    recordResult({ id: "API-SS-05", layer: "API", test: "Client B retrieves Session B detail", account: "Client B", owner: "Client B", expected: "HTTP 200", actual: `HTTP ${sB_cB.status}`, status: sB_cB.status === 200 ? "PASS" : "FAIL" });
    recordResult({ id: "API-SS-06", layer: "API", test: "Client A cannot retrieve Session B detail", account: "Client A", owner: "Client B", expected: "HTTP 404", actual: `HTTP ${sB_cA.status}`, status: sB_cA.status === 404 ? "PASS" : "FAIL" });
    recordResult({ id: "API-SS-07", layer: "API", test: "Counselor B retrieves Session B detail", account: "Counselor B", owner: "Counselor B", expected: "HTTP 200", actual: `HTTP ${sB_kB.status}`, status: discovered.sessionB.counselor_id === kB.id ? (sB_kB.status === 200 ? "PASS" : "FAIL") : "BLOCKED" });
    recordResult({ id: "API-SS-08", layer: "API", test: "Counselor A cannot retrieve Session B detail", account: "Counselor A", owner: "Counselor B", expected: "HTTP 404", actual: `HTTP ${sB_kA.status}`, status: discovered.sessionB.counselor_id !== kA.id ? (sB_kA.status === 404 ? "PASS" : "FAIL") : "BLOCKED" });
  }

  // --- 7.D Feedback Isolation ---
  const [fbCA, fbCB, fbKA, fbKB] = await Promise.all([
    apiGet("/api/v1/feedback/mine", cA.token),
    apiGet("/api/v1/feedback/mine", cB.token),
    apiGet("/api/v1/feedback/counselor", kA.token),
    apiGet("/api/v1/feedback/counselor", kB.token),
  ]);
  const fbListCA = Array.isArray(fbCA.payload?.data) ? fbCA.payload.data : [];
  const fbListCB = Array.isArray(fbCB.payload?.data) ? fbCB.payload.data : [];
  const fbListKA = Array.isArray(fbKA.payload?.data) ? fbKA.payload.data : [];
  const fbListKB = Array.isArray(fbKB.payload?.data) ? fbKB.payload.data : [];

  const fbIdsCB = new Set(fbListCB.map((f) => f.id));
  const fbCAOverlap = fbListCA.some((f) => fbIdsCB.has(f.id));
  recordResult({
    id: "API-FB-01",
    layer: "API",
    test: "Client A lists own feedback (/feedback/mine)",
    account: "Client A",
    owner: "Client A",
    expected: "HTTP 200, 0 overlap with Client B",
    actual: `HTTP ${fbCA.status}, rows=${fbListCA.length}, overlap=${fbCAOverlap}`,
    status: fbCA.status === 200 && !fbCAOverlap ? "PASS" : "FAIL",
  });

  recordResult({
    id: "API-FB-02",
    layer: "API",
    test: "Client B lists own feedback (/feedback/mine)",
    account: "Client B",
    owner: "Client B",
    expected: "HTTP 200, 0 overlap with Client A",
    actual: `HTTP ${fbCB.status}, rows=${fbListCB.length}, overlap=${fbCAOverlap}`,
    status: fbCB.status === 200 && !fbCAOverlap ? "PASS" : "FAIL",
  });

  const fbKAOk = fbKA.status === 200 && fbListKA.every((f) => f.counselor_id === kA.id);
  recordResult({
    id: "API-FB-03",
    layer: "API",
    test: "Counselor A lists authorized shown feedback",
    account: "Counselor A",
    owner: "Counselor A",
    expected: "HTTP 200, all rows counselor_id=Counselor A",
    actual: `HTTP ${fbKA.status}, rows=${fbListKA.length}, allOwned=${fbKAOk}`,
    status: fbKAOk ? "PASS" : "FAIL",
  });

  const fbKBOk = fbKB.status === 200 && fbListKB.every((f) => f.counselor_id === kB.id);
  recordResult({
    id: "API-FB-04",
    layer: "API",
    test: "Counselor B lists authorized shown feedback",
    account: "Counselor B",
    owner: "Counselor B",
    expected: "HTTP 200, all rows counselor_id=Counselor B",
    actual: `HTTP ${fbKB.status}, rows=${fbListKB.length}, allOwned=${fbKBOk}`,
    status: fbKBOk ? "PASS" : "FAIL",
  });

  // --- 7.E Notification Isolation ---
  const [ntCA, ntCB, ntKA, ntKB] = await Promise.all([
    apiGet("/api/v1/notifications", cA.token),
    apiGet("/api/v1/notifications", cB.token),
    apiGet("/api/v1/notifications", kA.token),
    apiGet("/api/v1/notifications", kB.token),
  ]);
  const ntSets = {
    CLIENT_A: new Set((ntCA.payload?.data?.items ?? []).map((n) => n.id)),
    CLIENT_B: new Set((ntCB.payload?.data?.items ?? []).map((n) => n.id)),
    COUNSELOR_A: new Set((ntKA.payload?.data?.items ?? []).map((n) => n.id)),
    COUNSELOR_B: new Set((ntKB.payload?.data?.items ?? []).map((n) => n.id)),
  };
  for (const [id, slot, label, res] of [
    ["API-NT-01", "CLIENT_A", "Client A", ntCA],
    ["API-NT-02", "CLIENT_B", "Client B", ntCB],
    ["API-NT-03", "COUNSELOR_A", "Counselor A", ntKA],
    ["API-NT-04", "COUNSELOR_B", "Counselor B", ntKB],
  ]) {
    const ownIds = ntSets[slot];
    const hasLeak = Object.entries(ntSets)
      .filter(([otherSlot]) => otherSlot !== slot)
      .some(([, otherSet]) => [...ownIds].some((item) => otherSet.has(item)));
    recordResult({
      id,
      layer: "API",
      test: `${label} lists recipient notifications only`,
      account: label,
      owner: label,
      expected: "HTTP 200, 0 shared notification IDs with other accounts",
      actual: `HTTP ${res.status}, items=${ownIds.size}, leak=${hasLeak}`,
      status: res.status === 200 && !hasLeak ? "PASS" : "FAIL",
    });
  }

  // --- 7.F Counselor Profile & Availability Isolation ---
  const [cpKA, avKA, cpKB, avKB, cpByCA, avByCB] = await Promise.all([
    apiGet("/api/v1/counselor/profile", kA.token),
    apiGet("/api/v1/counselor/availability", kA.token),
    apiGet("/api/v1/counselor/profile", kB.token),
    apiGet("/api/v1/counselor/availability", kB.token),
    apiGet("/api/v1/counselor/profile", cA.token),
    apiGet("/api/v1/counselor/availability", cB.token),
  ]);
  const slotsKA = Array.isArray(avKA.payload?.data) ? avKA.payload.data : [];
  const slotsKB = Array.isArray(avKB.payload?.data) ? avKB.payload.data : [];
  const kAScoped =
    cpKA.status === 200 &&
    cpKA.payload?.data?.profile_id === kA.id &&
    avKA.status === 200 &&
    slotsKA.every((s) => s.counselor_id === kA.id);
  recordResult({
    id: "API-CS-01",
    layer: "API",
    test: "Counselor A reads own management profile & availability",
    account: "Counselor A",
    owner: "Counselor A",
    expected: "HTTP 200, profile_id & slots scoped to Counselor A",
    actual: `profile=${cpKA.status}, availability=${avKA.status} (${slotsKA.length} slots), scoped=${kAScoped}`,
    status: kAScoped ? "PASS" : "FAIL",
  });

  const kBScoped =
    cpKB.status === 200 &&
    cpKB.payload?.data?.profile_id === kB.id &&
    avKB.status === 200 &&
    slotsKB.every((s) => s.counselor_id === kB.id);
  recordResult({
    id: "API-CS-02",
    layer: "API",
    test: "Counselor B reads own management profile & availability",
    account: "Counselor B",
    owner: "Counselor B",
    expected: "HTTP 200, profile_id & slots scoped to Counselor B",
    actual: `profile=${cpKB.status}, availability=${avKB.status} (${slotsKB.length} slots), scoped=${kBScoped}`,
    status: kBScoped ? "PASS" : "FAIL",
  });

  recordResult({
    id: "API-CS-03",
    layer: "API",
    test: "Clients rejected from counselor management endpoints",
    account: "Client A & B",
    owner: "Counselor A/B",
    expected: "HTTP 403 FORBIDDEN",
    actual: `profile=${cpByCA.status}, availability=${avByCB.status}`,
    status: cpByCA.status === 403 && avByCB.status === 403 ? "PASS" : "FAIL",
  });

  // --- 8. Direct Authenticated PostgREST RLS Verification ---
  // Category A: Self-only tables (profiles, feedback, notifications)
  const { data: profCA, error: profCAErr } = await cA.rlsClient.from("profiles").select("id,app_role,account_status");
  const { data: profCAByB } = await cA.rlsClient.from("profiles").select("id").eq("id", cB.id);
  const rlsA01Ok = !profCAErr && Array.isArray(profCA) && profCA.length === 1 && profCA[0].id === cA.id && (profCAByB ?? []).length === 0;
  recordResult({
    id: "RLS-A-01",
    layer: "RLS",
    test: "profiles: Client A reads self only, 0 rows for Client B",
    account: "Client A",
    owner: "Client A / B",
    expected: "1 self row; 0 rows for Client B",
    actual: `selfRows=${profCA?.length ?? "err"}, crossRows=${profCAByB?.length ?? "err"}`,
    status: rlsA01Ok ? "PASS" : "FAIL",
  });

  const { data: profKA, error: profKAErr } = await kA.rlsClient.from("profiles").select("id,app_role,account_status");
  const { data: profKAByB } = await kA.rlsClient.from("profiles").select("id").eq("id", kB.id);
  const rlsA02Ok = !profKAErr && Array.isArray(profKA) && profKA.length === 1 && profKA[0].id === kA.id && (profKAByB ?? []).length === 0;
  recordResult({
    id: "RLS-A-02",
    layer: "RLS",
    test: "profiles: Counselor A reads self only, 0 rows for Counselor B",
    account: "Counselor A",
    owner: "Counselor A / B",
    expected: "1 self row; 0 rows for Counselor B",
    actual: `selfRows=${profKA?.length ?? "err"}, crossRows=${profKAByB?.length ?? "err"}`,
    status: rlsA02Ok ? "PASS" : "FAIL",
  });

  const { data: rlsFbCA, error: rlsFbCAErr } = await cA.rlsClient.from("feedback").select("id,client_id");
  const { data: rlsFbCross } = await cB.rlsClient.from("feedback").select("id,client_id").eq("client_id", cA.id);
  const { data: rlsFbCounselor } = await kA.rlsClient.from("feedback").select("id,client_id");
  const rlsA03Ok =
    !rlsFbCAErr &&
    (rlsFbCA ?? []).every((f) => f.client_id === cA.id) &&
    (rlsFbCross ?? []).length === 0 &&
    (rlsFbCounselor ?? []).length === 0;
  recordResult({
    id: "RLS-A-03",
    layer: "RLS",
    test: "feedback: submitter-only SELECT enforced across Client B & Counselor A",
    account: "Client A, B, Counselor A",
    owner: "Client A",
    expected: "Client A sees own only; Client B cross=0; Counselor A direct=0",
    actual: `ownOk=${(rlsFbCA ?? []).every((f) => f.client_id === cA.id)}, crossB=${rlsFbCross?.length ?? "err"}, counselorDirect=${rlsFbCounselor?.length ?? "err"}`,
    status: rlsA03Ok ? "PASS" : "FAIL",
  });

  const [rlsNtCA, rlsNtCB, rlsNtKA, rlsNtKB] = await Promise.all([
    cA.rlsClient.from("notifications").select("id,recipient_user_id"),
    cB.rlsClient.from("notifications").select("id,recipient_user_id"),
    kA.rlsClient.from("notifications").select("id,recipient_user_id"),
    kB.rlsClient.from("notifications").select("id,recipient_user_id"),
  ]);
  const rlsA04Ok =
    (rlsNtCA.data ?? []).every((n) => n.recipient_user_id === cA.id) &&
    (rlsNtCB.data ?? []).every((n) => n.recipient_user_id === cB.id) &&
    (rlsNtKA.data ?? []).every((n) => n.recipient_user_id === kA.id) &&
    (rlsNtKB.data ?? []).every((n) => n.recipient_user_id === kB.id);
  recordResult({
    id: "RLS-A-04",
    layer: "RLS",
    test: "notifications: recipient-only SELECT enforced across all 4 accounts",
    account: "All 4 accounts",
    owner: "Each recipient",
    expected: "Every row recipient_user_id === authenticated user",
    actual: `scoped=${rlsA04Ok}`,
    status: rlsA04Ok ? "PASS" : "FAIL",
  });

  // Category B: Party/relationship tables
  const { data: rlsBkCrossB } = await cB.rlsClient.from("bookings").select("id,client_id").eq("client_id", cA.id);
  recordResult({
    id: "RLS-B-01",
    layer: "RLS",
    test: "bookings: Client B SELECT on Client A bookings returns 0 rows",
    account: "Client B",
    owner: "Client A",
    expected: "0 rows",
    actual: `rows=${rlsBkCrossB?.length ?? "err"}`,
    status: Array.isArray(rlsBkCrossB) && rlsBkCrossB.length === 0 ? "PASS" : "FAIL",
  });

  const { data: rlsBkCrossKB } = await kB.rlsClient.from("bookings").select("id,counselor_id").eq("counselor_id", kA.id);
  recordResult({
    id: "RLS-B-02",
    layer: "RLS",
    test: "bookings: Counselor B SELECT on Counselor A bookings returns 0 rows",
    account: "Counselor B",
    owner: "Counselor A",
    expected: "0 rows",
    actual: `rows=${rlsBkCrossKB?.length ?? "err"}`,
    status: Array.isArray(rlsBkCrossKB) && rlsBkCrossKB.length === 0 ? "PASS" : "FAIL",
  });

  if (!discovered.bookingA) {
    recordResult({
      id: "RLS-B-03",
      layer: "RLS",
      test: "booking_participants: non-party SELECT returns 0 rows",
      account: "Client B / Counselor B",
      owner: "Booking A",
      expected: "0 rows",
      actual: "BLOCKED (No Booking A exists)",
      status: "BLOCKED",
    });
  } else {
    const { data: bpCross } = await cB.rlsClient.from("booking_participants").select("id,booking_id").eq("booking_id", discovered.bookingA.id);
    recordResult({
      id: "RLS-B-03",
      layer: "RLS",
      test: "booking_participants: non-party SELECT returns 0 rows",
      account: "Client B",
      owner: "Booking A",
      expected: "0 rows",
      actual: `rows=${bpCross?.length ?? "err"}`,
      status: Array.isArray(bpCross) && bpCross.length === 0 ? "PASS" : "FAIL",
    });
  }

  const { data: rlsSsCrossKB } = await kB.rlsClient.from("counseling_sessions").select("id,counselor_id").eq("counselor_id", kA.id);
  recordResult({
    id: "RLS-B-04",
    layer: "RLS",
    test: "counseling_sessions: Counselor B SELECT on Counselor A sessions returns 0 rows",
    account: "Counselor B",
    owner: "Counselor A",
    expected: "0 rows",
    actual: `rows=${rlsSsCrossKB?.length ?? "err"}`,
    status: Array.isArray(rlsSsCrossKB) && rlsSsCrossKB.length === 0 ? "PASS" : "FAIL",
  });

  const { data: rlsAvCrossKB } = await kB.rlsClient
    .from("availability_slots")
    .select("id,counselor_id,status")
    .eq("counselor_id", kA.id)
    .neq("status", "available");
  recordResult({
    id: "RLS-B-05",
    layer: "RLS",
    test: "availability_slots: Counselor B cannot SELECT non-available slots of Counselor A",
    account: "Counselor B",
    owner: "Counselor A",
    expected: "0 rows",
    actual: `rows=${rlsAvCrossKB?.length ?? "err"}`,
    status: Array.isArray(rlsAvCrossKB) && rlsAvCrossKB.length === 0 ? "PASS" : "FAIL",
  });

  // Category C: Server-only tables & privileged RPCs
  for (const [id, table] of [
    ["RLS-C-01", "audit_events"],
    ["RLS-C-02", "whatsapp_outbox"],
    ["RLS-C-03", "hero_motivations"],
  ]) {
    const { data, error } = await cA.rlsClient.from(table).select("id").limit(1);
    const denied = Boolean(error) || (Array.isArray(data) && data.length === 0);
    recordResult({
      id,
      layer: "RLS",
      test: `${table}: direct authenticated SELECT denied`,
      account: "Client A",
      owner: "System",
      expected: "Permission denied (42501)",
      actual: error ? `error=${error.code || "denied"}` : `rows=${data?.length ?? 0}`,
      status: denied && error?.code === "42501" ? "PASS" : "FAIL",
    });
  }

  const { error: rpcErr } = await cA.rlsClient.rpc("sicare_public_availability", {
    p_counselor_ids: [kA.id],
    p_from: "2026-01-01T00:00:00Z",
    p_to: "2026-01-02T00:00:00Z",
    p_limit: 1,
  });
  recordResult({
    id: "RLS-C-04",
    layer: "RLS",
    test: "sicare_public_availability RPC: direct authenticated EXECUTE denied",
    account: "Client A",
    owner: "System",
    expected: "Permission denied (42501)",
    actual: rpcErr ? `error=${rpcErr.code || "denied"}` : "allowed",
    status: rpcErr?.code === "42501" ? "PASS" : "FAIL",
  });
}

// ----------------------------------------------------------------------------
// 4. Mutation Ownership Checks (Strictly NOT TESTED in read-only Batch 1.3c)
// ----------------------------------------------------------------------------
const mutationChecks = [
  ["MUT-01", "API", "Client B PATCH /bookings/:idA/status (cancel)", "Client B", "Client A", "HTTP 403 BOOKING_FORBIDDEN"],
  ["MUT-02", "API", "Client B PATCH /bookings/:idA/reschedule", "Client B", "Client A", "HTTP 403 BOOKING_FORBIDDEN"],
  ["MUT-03", "API", "Counselor B PATCH /sessions/:sidA/status", "Counselor B", "Counselor A", "HTTP 403 SESSION_FORBIDDEN"],
  ["MUT-04", "API", "Client B PATCH /notifications/:nidA/read", "Client B", "Client A", "HTTP 404 NOTIFICATION_NOT_FOUND"],
  ["MUT-05", "API", "Counselor B PATCH/DELETE /counselor/availability/:slotA", "Counselor B", "Counselor A", "HTTP 404 AVAILABILITY_NOT_FOUND"],
  ["MUT-06", "API", "Client B POST /sessions/:sidA/feedback", "Client B", "Client A", "HTTP 409 FEEDBACK_NOT_ELIGIBLE"],
];
for (const [id, layer, test, account, owner, expected] of mutationChecks) {
  recordResult({
    id,
    layer,
    test,
    account,
    owner,
    expected,
    actual: "NOT TESTED (Batch 1.3c is strictly read-only)",
    status: "NOT TESTED",
  });
}

// ----------------------------------------------------------------------------
// 5. Separate Layer Summaries
// ----------------------------------------------------------------------------
function summarizeLayer(layerName) {
  const items = matrix.filter((row) => row.layer === layerName);
  return {
    total: items.length,
    pass: items.filter((r) => r.status === "PASS").length,
    fail: items.filter((r) => r.status === "FAIL").length,
    blocked: items.filter((r) => r.status === "BLOCKED").length,
    notTested: items.filter((r) => r.status === "NOT TESTED").length,
  };
}

const apiSummary = summarizeLayer("API");
const rlsSummary = summarizeLayer("RLS");

console.log("\n================================================================================");
console.log(`Backend API Summary : ${apiSummary.pass} PASS, ${apiSummary.fail} FAIL, ${apiSummary.blocked} BLOCKED, ${apiSummary.notTested} NOT TESTED (total ${apiSummary.total})`);
console.log(`Direct RLS Summary  : ${rlsSummary.pass} PASS, ${rlsSummary.fail} FAIL, ${rlsSummary.blocked} BLOCKED, ${rlsSummary.notTested} NOT TESTED (total ${rlsSummary.total})`);
console.log("================================================================================");

if (apiSummary.fail > 0 || rlsSummary.fail > 0) {
  process.exitCode = 1;
} else if (strictExit && (apiSummary.blocked > 0 || rlsSummary.blocked > 0)) {
  process.exitCode = 2;
} else {
  process.exitCode = 0;
}
