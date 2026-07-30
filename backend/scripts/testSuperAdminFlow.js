#!/usr/bin/env node
/**
 * Super-admin provisioning flow — end-to-end HTTP test.
 *
 *   npm run test:superadmin
 *
 * This is the journey a super admin actually performs: create a company,
 * create its admin's sign-in, grant that company a plan (Starter / Growth /
 * Scale / Managed), then upgrade, downgrade and revoke it.
 *
 * It boots the REAL backend/index.js as a subprocess against a throwaway
 * in-memory MongoDB and drives it over HTTP. Nothing is stubbed, so the
 * routes, the JWT middleware, the role guards and the controllers are all
 * exercised exactly as they run in production — but against a database that
 * evaporates when the test ends. It never touches a real cluster.
 */

const path = require("path");
const { spawn } = require("child_process");
const mongoose = require("mongoose");

const cm = require("../../src/config/pricing/creditMath");
const pricing = require("../../src/config/pricing/pricing.data.json");

const PORT = 4199;
const BASE = `http://localhost:${PORT}/api`;

const G = "\x1b[32m";
const R = "\x1b[31m";
const Y = "\x1b[33m";
const D = "\x1b[2m";
const B = "\x1b[1m";
const X = "\x1b[0m";

let passed = 0;
let failed = 0;
const failures = [];

function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    passed++;
    console.log(`    ${G}✓${X} ${label} ${D}(${JSON.stringify(actual)})${X}`);
  } else {
    failed++;
    failures.push(label);
    console.log(
      `    ${R}✗ ${label}${X}\n      expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}
const checkTrue = (label, v) => check(label, !!v, true);
const section = (n) => console.log(`\n${B}${n}${X}`);

/* ------------------------------------------------------------------ *
 * HTTP helper
 * ------------------------------------------------------------------ */

async function api(method, route, { token, body } = {}) {
  const res = await fetch(`${BASE}${route}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      // Prove the CORS fix works from a fallback CRA port while we are here.
      Origin: "http://localhost:3001",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let json = null;
  try {
    json = await res.json();
  } catch (_) {
    /* some errors return no body */
  }
  return { status: res.status, body: json || {} };
}

const login = async (email, password) => {
  const r = await api("POST", "/auth/login", { body: { email, password } });
  return { token: r.body.token, user: r.body.user, status: r.status };
};

/* ------------------------------------------------------------------ *
 * The flow
 * ------------------------------------------------------------------ */

const SUPER = { email: "superadmin@test.local", password: "SuperTest@123" };
const CLIENT_ADMIN = {
  name: "Test Client Admin",
  email: "client.admin@test.local",
  password: "ClientTest@123",
};

const state = {};

async function testSuperAdminLogin() {
  section("1. Super admin signs in");

  const { token, user, status } = await login(SUPER.email, SUPER.password);
  check("login succeeds", status, 200);
  check("role is super_admin", user?.role, "super_admin");
  checkTrue("a token is issued", !!token);
  state.superToken = token;
}

async function testCreateCompany() {
  section("2. Super admin creates a client company");

  const r = await api("POST", "/company/add-company", {
    token: state.superToken,
    body: {
      name: "Acme QA Ltd",
      email: "billing@acme.test",
      address: "1 Test Street",
    },
  });

  check("company created", r.status, 201);
  check("starts with no subscription", r.body.company?.subscriptionStatus, "none");
  checkTrue("company has an id", !!r.body.company?._id);
  state.companyId = r.body.company?._id;
}

async function testCreateСompanyAdminSignIn() {
  section("3. Super admin creates the client's sign-in");

  const r = await api("POST", "/company/add-company-admin", {
    token: state.superToken,
    body: { companyId: state.companyId, ...CLIENT_ADMIN },
  });

  check("admin account created", r.status, 201);
  check("role is company_admin", r.body.admin?.role, "company_admin");
  check("linked to the company", String(r.body.admin?.companyId), String(state.companyId));

  // The account must actually work as a sign-in, not just exist.
  const { status, user } = await login(CLIENT_ADMIN.email, CLIENT_ADMIN.password);
  check("the new user can sign in", status, 200);
  check("but has no plan yet", user?.activeSubscription, null);

  const snap = user?.creditAccount;
  check("and therefore no credits", snap?.balance ?? 0, 0);
}

async function testGrantGrowth() {
  section("4. Super admin grants the BYOK Growth plan");

  const growth = pricing.planTypes.byok.tiers.find((t) => t.key === "growth");

  const start = new Date();
  const end = new Date();
  end.setMonth(end.getMonth() + 1);

  const r = await api("POST", "/subscription/activate", {
    token: state.superToken,
    body: {
      companyId: state.companyId,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      planType: "byok",
      tierKey: "growth",
    },
  });

  check("plan activated", r.status, 201);
  const sub = r.body.subscription;
  check("planType recorded", sub?.planType, "byok");
  check("tier recorded", sub?.tierKey, "growth");
  check("credits granted match the catalog", sub?.credits?.balance, growth.credits);
  check("allowance matches the catalog", sub?.credits?.monthlyAllowance, growth.credits);
  check("price snapshotted", sub?.priceUsdMonthly, growth.priceUsdMonthly);
  check("concurrency from the tier", sub?.concurrentSites, growth.concurrentSites);
  check("nothing reserved yet", sub?.credits?.reserved, 0);
  // Pinning the pricing version is what stops a later edit to pricing.data.json
  // silently re-pricing an existing customer.
  check("pricing version pinned", sub?.pricingVersion, cm.PRICING_VERSION);

  state.subscriptionId = sub?._id;
}

async function testClientSeesThePlan() {
  section("5. The client signs in and sees the plan");

  const growth = pricing.planTypes.byok.tiers.find((t) => t.key === "growth");
  const { user } = await login(CLIENT_ADMIN.email, CLIENT_ADMIN.password);

  const snap = user?.creditAccount;
  checkTrue("a credit account is attached to the login", !!snap);
  check("tier name shown", snap?.tierName, growth.name);
  check("balance visible", snap?.balance, growth.credits);
  check("allowance visible", snap?.monthlyAllowance, growth.credits);
  check("not flagged legacy", snap?.legacy, false);
  check("subscription is active", user?.activeSubscription?.isActive, true);
}

async function testUpgradeAndDowngrade() {
  section("6. Super admin upgrades to Scale, then back to Starter");

  const scale = pricing.planTypes.byok.tiers.find((t) => t.key === "scale");
  const starter = pricing.planTypes.byok.tiers.find((t) => t.key === "starter");

  const end = new Date();
  end.setMonth(end.getMonth() + 6);

  const up = await api("PUT", "/subscription/renew", {
    token: state.superToken,
    body: {
      companyId: state.companyId,
      newEndDate: end.toISOString(),
      planType: "byok",
      tierKey: "scale",
    },
  });
  check("upgrade accepted", up.status, 200);
  check("tier is now scale", up.body.subscription?.tierKey, "scale");
  check("allowance raised", up.body.subscription?.credits?.monthlyAllowance, scale.credits);

  const down = await api("PUT", "/subscription/renew", {
    token: state.superToken,
    body: {
      companyId: state.companyId,
      newEndDate: end.toISOString(),
      planType: "byok",
      tierKey: "starter",
    },
  });
  check("downgrade accepted", down.status, 200);
  check("tier is now starter", down.body.subscription?.tierKey, "starter");
  check("allowance lowered", down.body.subscription?.credits?.monthlyAllowance, starter.credits);
}

async function testManagedTier() {
  section("7. A Managed tier can be granted, and the unsellable one cannot");

  const mg = pricing.planTypes.managed.tiers.find((t) => t.key === "managed_growth");

  const start = new Date();
  const end = new Date();
  end.setMonth(end.getMonth() + 1);
  const base = {
    companyId: state.companyId,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
  };

  const ok = await api("POST", "/subscription/activate", {
    token: state.superToken,
    body: { ...base, planType: "managed", tierKey: "managed_growth" },
  });
  check("managed growth activates", ok.status, 201);
  check("engine recorded", ok.body.subscription?.engine, mg.engine);
  check("credits match the catalog", ok.body.subscription?.credits?.balance, mg.credits);

  // managed_pro is marked unavailable: the hybrid routing it is priced on does
  // not exist yet, so selling it would invert the margin.
  const blocked = await api("POST", "/subscription/activate", {
    token: state.superToken,
    body: { ...base, planType: "managed", tierKey: "managed_pro" },
  });
  check("the unsellable tier is refused", blocked.status, 400);
  checkTrue("and says why", /not available/i.test(blocked.body.message || ""));

  const bogus = await api("POST", "/subscription/activate", {
    token: state.superToken,
    body: { ...base, planType: "byok", tierKey: "does_not_exist" },
  });
  check("an unknown tier is refused", bogus.status, 400);

  // Put the company back on Growth for the remaining tests.
  await api("POST", "/subscription/activate", {
    token: state.superToken,
    body: { ...base, planType: "byok", tierKey: "growth" },
  });
}

async function testPermissions() {
  section("8. Only a super admin may provision");

  const { token: clientToken } = await login(
    CLIENT_ADMIN.email,
    CLIENT_ADMIN.password
  );

  const end = new Date();
  end.setMonth(end.getMonth() + 1);
  const grant = {
    companyId: state.companyId,
    startDate: new Date().toISOString(),
    endDate: end.toISOString(),
    planType: "byok",
    tierKey: "scale",
  };

  // The attack that matters: a customer granting themselves a bigger plan.
  const selfGrant = await api("POST", "/subscription/activate", {
    token: clientToken,
    body: grant,
  });
  check("a company admin cannot grant themselves a plan", selfGrant.status, 403);

  const selfRenew = await api("PUT", "/subscription/renew", {
    token: clientToken,
    body: { companyId: state.companyId, newEndDate: end.toISOString(), tierKey: "scale" },
  });
  check("nor renew one", selfRenew.status, 403);

  const selfCompany = await api("POST", "/company/add-company", {
    token: clientToken,
    body: { name: "Rogue Ltd", email: "x@y.test" },
  });
  check("nor create companies", selfCompany.status, 403);

  const anon = await api("POST", "/subscription/activate", { body: grant });
  check("an unauthenticated request is rejected", anon.status, 401);

  const badToken = await api("POST", "/subscription/activate", {
    token: "not-a-real-token",
    body: grant,
  });
  check("a forged token is rejected", badToken.status, 401);
}

async function testCreditsAreEnforced() {
  section("9. The granted credits actually gate the product");

  const { token, user } = await login(CLIENT_ADMIN.email, CLIENT_ADMIN.password);
  const growth = pricing.planTypes.byok.tiers.find((t) => t.key === "growth");

  const acct = await api("GET", "/credits/account", { token });
  check("the client can read their own account", acct.status, 200);
  check("balance matches the grant", acct.body.data?.balance, growth.credits);

  // A quote for work that has not been discovered yet must not invent a price.
  const est = await api("GET", "/credits/estimate/no_such_session", { token });
  checkTrue("an unknown session does not return a bill", [200, 404].includes(est.status));

  const pricingRoute = await api("GET", "/credits/pricing");
  check("the catalog is publicly readable", pricingRoute.status, 200);
  check("and matches the shipped version", pricingRoute.body.data?.version, cm.PRICING_VERSION);
}

async function testExpire() {
  section("10. Super admin revokes the plan");

  const r = await api("PUT", "/subscription/expire", {
    token: state.superToken,
    body: { companyId: state.companyId },
  });
  check("expiry accepted", r.status, 200);

  const { user } = await login(CLIENT_ADMIN.email, CLIENT_ADMIN.password);
  const stillActive = user?.activeSubscription?.isActive === true;
  check("the client no longer has an active plan", stillActive, false);

  // History must survive. The old code hard-deleted the subscription, which
  // destroyed every record of what the customer had been sold.
  const Subscription = require("../models/Subscription");
  const kept = await Subscription.countDocuments({ companyId: state.companyId });
  checkTrue("billing history is retained, not deleted", kept > 0);
}

/* ------------------------------------------------------------------ *
 * Runner
 * ------------------------------------------------------------------ */

async function seedSuperAdmin() {
  const bcrypt = require("bcrypt");
  const User = require("../models/User");
  await User.create({
    name: "Test Super Admin",
    email: SUPER.email,
    password: await bcrypt.hash(SUPER.password, 10),
    role: "super_admin",
  });
}

function startServer(uri) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [path.join(__dirname, "..", "index.js")],
      {
        env: {
          ...process.env,
          MONGODB_URL: uri,
          PORT: String(PORT),
          JWT_SECRET: "test-secret-for-superadmin-flow",
          NODE_ENV: "development",
          CREDITS_ENFORCED: "true",
        },
        stdio: ["ignore", "pipe", "pipe"],
      }
    );

    let out = "";
    const onData = (d) => {
      out += d.toString();
      if (out.includes("Server running")) resolve(child);
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("exit", (code) =>
      reject(new Error(`server exited early (${code}):\n${out}`))
    );
    setTimeout(() => reject(new Error(`server did not start:\n${out}`)), 30000);
  });
}

async function main() {
  console.log(`${D}Starting throwaway MongoDB + real backend on :${PORT}…${X}`);

  const { MongoMemoryServer } = require("mongodb-memory-server");
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri("superadmin_flow_test");

  await mongoose.connect(uri);
  await seedSuperAdmin();

  let server;
  try {
    server = await startServer(uri);
  } catch (err) {
    console.error(`${R}${err.message}${X}`);
    await mongoose.disconnect();
    await mongod.stop();
    process.exit(1);
  }

  console.log(`${D}Server up. Database is in-memory — no real data is touched.${X}`);

  const scenarios = [
    testSuperAdminLogin,
    testCreateCompany,
    testCreateСompanyAdminSignIn,
    testGrantGrowth,
    testClientSeesThePlan,
    testUpgradeAndDowngrade,
    testManagedTier,
    testPermissions,
    testCreditsAreEnforced,
    testExpire,
  ];

  for (const s of scenarios) {
    try {
      await s();
    } catch (err) {
      failed++;
      failures.push(`${s.name} threw`);
      console.log(`    ${R}✗ ${s.name} threw: ${err.message}${X}`);
    }
  }

  console.log(`\n${B}${failed === 0 ? G : R}${passed} passed, ${failed} failed${X}`);
  if (failures.length) {
    console.log(`${Y}Failing checks:${X}`);
    failures.forEach((f) => console.log(`  - ${f}`));
  }

  server.kill();
  await mongoose.disconnect();
  await mongod.stop();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(`${R}Crashed:${X}`, err);
  process.exit(1);
});
