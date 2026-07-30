#!/usr/bin/env node
/**
 * The self-serve purchase flow, end to end over HTTP.
 *
 *   node backend/scripts/testPaymentFlow.js
 *
 * This is the PRODUCT'S MAIN PATH, so it is tested as a user experiences it
 * rather than through the service layer:
 *
 *   a super admin creates the company and its admin account — and stops there.
 *   the company admin signs in with no plan, and buys one themselves.
 *
 * Everything is real: the Express app, the auth middleware, the signature
 * verification, the fulfilment latch and a real MongoDB. The ONLY stub is the
 * outbound network call to Razorpay, because we are not testing Razorpay.
 *
 * Companion to smokeTestPayments.js, which covers the credit arithmetic at the
 * service layer. This one covers the HTTP surface: status codes, error codes,
 * who is allowed to do what, and the states an untrusted caller can reach.
 *
 * NEVER point this at production: it writes and deletes freely.
 */

const path = require("path");
const crypto = require("crypto");

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

function section(name) {
  console.log(`\n${B}${name}${X}`);
}

const PORT = 5701;
const BASE = `http://127.0.0.1:${PORT}/api`;

async function api(method, route, { body, token } = {}) {
  const res = await fetch(BASE + route, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch (_) {
    /* some routes answer with no body */
  }
  return { status: res.status, body: json };
}

async function main() {
  let mongod = null;
  let uri = process.env.SMOKE_MONGODB_URL;

  if (!uri) {
    console.log(`${D}Starting an in-memory MongoDB (first run downloads a binary)…${X}`);
    const { MongoMemoryServer } = require("mongodb-memory-server");
    mongod = await MongoMemoryServer.create();
    uri = mongod.getUri();
  } else if (/prod/i.test(uri)) {
    console.error(`${R}Refusing to run against a URL containing "prod".${X}`);
    process.exit(1);
  }

  // Set BEFORE index.js loads dotenv — dotenv does not overwrite existing vars.
  process.env.MONGODB_URL = uri;
  process.env.PORT = String(PORT);
  process.env.NODE_ENV = "development";
  process.env.JWT_SECRET = process.env.JWT_SECRET || "payment-flow-test-secret";
  process.env.RAZORPAY_KEY = process.env.RAZORPAY_KEY || "rzp_test_flow";
  process.env.RAZORPAY_SECRET = process.env.RAZORPAY_SECRET || "flow_api_secret";
  process.env.RAZORPAY_WEBHOOK_SECRET = "flow_webhook_secret";
  // The reconciler and reset job would fight the assertions below.
  process.env.CREDIT_JOBS_ENABLED = "false";

  // Stub the one outbound call. Signature verification is deliberately NOT
  // stubbed — it is a large part of what this script exists to check.
  const razorpay = require("../services/razorpayService");
  razorpay.createOrder = async ({ amountMinor, currency, receipt, notes }) => ({
    id: `order_${crypto.randomBytes(8).toString("hex")}`,
    amount: amountMinor,
    currency,
    receipt,
    notes,
    status: "created",
  });

  require(path.join(__dirname, "..", "index.js"));
  await new Promise((r) => setTimeout(r, 2500));

  const bcrypt = require("bcrypt");
  const User = require("../models/User");
  const Payment = require("../models/Payment");

  const apiSecret = process.env.RAZORPAY_SECRET;
  const signCheckout = (orderId, paymentId) =>
    crypto.createHmac("sha256", apiSecret).update(`${orderId}|${paymentId}`).digest("hex");
  const signWebhook = (raw) =>
    crypto
      .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(Buffer.from(raw))
      .digest("hex");

  const postWebhook = async (raw, signature) => {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/payments/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-razorpay-signature": signature },
      body: raw,
    });
    let json = null;
    try {
      json = await res.json();
    } catch (_) {}
    return { status: res.status, body: json };
  };

  const state = {};

  /* ---------------------------------------------------------------- */
  section("1. A super admin creates the account — and only the account");

  await User.create({
    name: "Root Admin",
    email: "root@flowtest.com",
    mobile: "9999999999",
    password: await bcrypt.hash("Passw0rd!", 10),
    role: "super_admin",
  });

  const rootLogin = await api("POST", "/auth/login", {
    body: { email: "root@flowtest.com", password: "Passw0rd!" },
  });
  check("super admin signs in", rootLogin.status, 200);
  state.rootToken = rootLogin.body?.token;

  const company = await api("POST", "/company/add-company", {
    token: state.rootToken,
    body: { name: "Acme QA", email: "billing@acme.test", address: "1 Test Street" },
  });
  check("company created", company.status, 201);
  check("and starts with NO plan, by design", company.body.company?.subscriptionStatus, "none");
  state.companyId = company.body.company?._id;

  const admin = await api("POST", "/company/add-company-admin", {
    token: state.rootToken,
    body: {
      name: "Ada",
      email: "ada@acme.test",
      mobile: "8888888888",
      password: "Passw0rd!",
      companyId: state.companyId,
    },
  });
  check("company admin created", admin.status, 201);

  // The super admin does NOT call /subscription/activate. That endpoint still
  // exists as a manual override for negotiated deals, but it is not this path.

  /* ---------------------------------------------------------------- */
  section("2. The company admin signs in with no plan at all");

  const adminLogin = await api("POST", "/auth/login", {
    body: { email: "ada@acme.test", password: "Passw0rd!" },
  });
  check("signing in works without a plan", adminLogin.status, 200);
  check("and reports no credit account", adminLogin.body.user?.creditAccount, null);
  state.adminToken = adminLogin.body?.token;

  const emptyAccount = await api("GET", "/credits/account", { token: state.adminToken });
  check("the credit account reads as absent, not as an error page", emptyAccount.status, 404);
  check("with a code the UI can branch on", emptyAccount.body?.code, "NO_SUBSCRIPTION");

  /* ---------------------------------------------------------------- */
  section("3. They buy their own first plan");

  const topUpTooEarly = await api("POST", "/payments/create-order", {
    token: state.adminToken,
    body: { kind: "credit_topup", credits: 50 },
  });
  check("credits cannot be bought before a plan exists", topUpTooEarly.status, 409);
  check("and it is refused BEFORE any money moves", topUpTooEarly.body?.code, "NO_ACTIVE_SUBSCRIPTION");

  // An INR order — the Indian path, and the default.
  const order = await api("POST", "/payments/create-order", {
    token: state.adminToken,
    body: {
      kind: "plan_purchase",
      planType: "byok",
      tierKey: "growth",
      period: "monthly",
      currency: "INR",
    },
  });
  check("an order is created with no prior subscription", order.status, 201);
  check("priced server-side from the catalog, in paise", order.body.data?.amountMinor, 4391200);
  check("in INR", order.body.data?.currency, "INR");
  check("offering UPI", order.body.data?.methods?.upi, true);
  check("offering netbanking", order.body.data?.methods?.netbanking, true);
  state.orderId = order.body.data?.razorpayOrderId;
  state.paymentId = order.body.data?.paymentId;

  // The same tier in USD — the international path.
  const usdOrder = await api("POST", "/payments/create-order", {
    token: state.adminToken,
    body: {
      kind: "plan_purchase",
      planType: "byok",
      tierKey: "growth",
      period: "monthly",
      currency: "USD",
    },
  });
  check("a USD order is priced in cents", usdOrder.body.data?.amountMinor, 49900);
  // Not a policy choice: UPI and netbanking settle in INR, so Razorpay cannot
  // render them on a USD order however checkout is configured.
  check("USD offers NO UPI", usdOrder.body.data?.methods?.upi, false);
  check("USD offers NO netbanking", usdOrder.body.data?.methods?.netbanking, false);
  check("USD still offers cards", usdOrder.body.data?.methods?.card, true);

  const badCurrency = await api("POST", "/payments/create-order", {
    token: state.adminToken,
    body: {
      kind: "plan_purchase",
      planType: "byok",
      tierKey: "growth",
      period: "monthly",
      currency: "GBP",
    },
  });
  check("an unsupported currency is refused", badCurrency.body?.code, "INVALID_CURRENCY");

  /* ---------------------------------------------------------------- */
  section("4. The browser cannot dictate the price");

  const tampered = await api("POST", "/payments/create-order", {
    token: state.adminToken,
    body: {
      kind: "plan_purchase",
      planType: "byok",
      tierKey: "scale",
      period: "monthly",
      currency: "INR",
      // All of this is ignored: the server never reads an amount from a client.
      amountMinor: 1,
      amountCents: 1,
      amount: 1,
      priceUsdMonthly: 0.01,
    },
  });
  check("a hand-edited amount changes nothing", tampered.body.data?.amountMinor, 11431200);

  for (const [label, tierKey, planType, code] of [
    ["managed_pro is not for sale", "managed_pro", "managed", "TIER_UNAVAILABLE"],
    ["self_hosted is negotiated", "self_hosted", "byok", "TIER_CUSTOM"],
    ["enterprise is negotiated", "enterprise", "managed", "TIER_CUSTOM"],
    ["an invented tier is refused", "unlimited_free", "byok", "TIER_NOT_FOUND"],
  ]) {
    const res = await api("POST", "/payments/create-order", {
      token: state.adminToken,
      body: { kind: "plan_purchase", planType, tierKey, period: "monthly" },
    });
    check(label, res.body?.code, code);
  }

  /* ---------------------------------------------------------------- */
  section("5. A forged signature must not be able to poison a real payment");

  const forged = await api("POST", "/payments/verify", {
    token: state.adminToken,
    body: {
      razorpay_order_id: state.orderId,
      razorpay_payment_id: "pay_forged",
      razorpay_signature: "deadbeef",
    },
  });
  check("the forged callback is refused", forged.status, 400);
  check("with a code support can act on", forged.body?.code, "SIGNATURE_MISMATCH");

  // THE REGRESSION THIS SECTION EXISTS FOR.
  // Marking the payment "failed" on an unauthenticated claim would lock out
  // both the genuine callback and the webhook, and the customer would pay and
  // receive nothing. A bad signature means the CALLER is untrusted; it says
  // nothing about whether Razorpay captured the money.
  const afterForgery = await Payment.findById(state.paymentId).lean();
  check("the payment is left untouched", afterForgery.status, "created");
  check("and no failure was recorded against it", afterForgery.failureReason, null);

  /* ---------------------------------------------------------------- */
  section("6. The genuine callback activates the plan immediately");

  const verify = await api("POST", "/payments/verify", {
    token: state.adminToken,
    body: {
      razorpay_order_id: state.orderId,
      razorpay_payment_id: "pay_genuine",
      razorpay_signature: signCheckout(state.orderId, "pay_genuine"),
    },
  });
  check("verification succeeds", verify.status, 200);
  check("the plan is live", verify.body.data?.creditAccount?.tierKey, "growth");
  check("credits are spendable straight away", verify.body.data?.creditAccount?.balance, 1000);
  check("and it is not reported as a duplicate", verify.body.alreadyFulfilled, false);

  /* ---------------------------------------------------------------- */
  section("7. The webhook arrives late and must not grant a second time");

  const capturedEvent = JSON.stringify({
    event: "payment.captured",
    payload: {
      payment: {
        entity: {
          id: "pay_genuine",
          order_id: state.orderId,
          amount: 4391200,
          currency: "INR",
          method: "upi",
          notes: { paymentId: String(state.paymentId) },
        },
      },
    },
  });

  check("an unsigned webhook is rejected", (await postWebhook(capturedEvent, "")).status, 401);
  check("a forged webhook is rejected", (await postWebhook(capturedEvent, "deadbeef")).status, 401);
  // A short signature would make crypto.timingSafeEqual throw if the length
  // guard were ever removed, turning a refusal into a 500.
  check("a truncated signature is rejected cleanly", (await postWebhook(capturedEvent, "ab")).status, 401);

  const good = await postWebhook(capturedEvent, signWebhook(capturedEvent));
  check("a correctly signed webhook is accepted", good.status, 200);

  let account = await api("GET", "/credits/account", { token: state.adminToken });
  check("the balance did NOT move a second time", account.body.data?.balance, 1000);

  const replay = await postWebhook(capturedEvent, signWebhook(capturedEvent));
  check("a replayed delivery is accepted so Razorpay stops retrying", replay.status, 200);
  account = await api("GET", "/credits/account", { token: state.adminToken });
  check("and still did not move the balance", account.body.data?.balance, 1000);

  /* ---------------------------------------------------------------- */
  section("8. A captured amount that disagrees with the order is not honoured");

  const secondOrder = await api("POST", "/payments/create-order", {
    token: state.adminToken,
    body: { kind: "plan_purchase", planType: "byok", tierKey: "scale", period: "monthly" },
  });
  const mismatchEvent = JSON.stringify({
    event: "payment.captured",
    payload: {
      payment: {
        entity: {
          id: "pay_short",
          order_id: secondOrder.body.data.razorpayOrderId,
          amount: 100, // paid ₹1 for a ₹114,312 plan
          currency: "INR",
          notes: { paymentId: String(secondOrder.body.data.paymentId) },
        },
      },
    },
  });
  const mismatch = await postWebhook(mismatchEvent, signWebhook(mismatchEvent));
  check("the webhook is acknowledged", mismatch.status, 200);
  check("but flagged as a mismatch", mismatch.body?.mismatch, true);

  const notUpgraded = await api("GET", "/credits/account", { token: state.adminToken });
  check("the plan was NOT upgraded on an underpayment", notUpgraded.body.data?.tierKey, "growth");
  const mismatchRow = await Payment.findById(secondOrder.body.data.paymentId).lean();
  check("and the payment is flagged for a human", mismatchRow.status, "fulfilment_failed");

  /* ---------------------------------------------------------------- */
  section("9. Staff can use the product but cannot spend company money");

  await User.create({
    name: "Bob",
    email: "bob@acme.test",
    mobile: "7777777777",
    password: await bcrypt.hash("Passw0rd!", 10),
    role: "staff",
    companyId: state.companyId,
  });
  const staffLogin = await api("POST", "/auth/login", {
    body: { email: "bob@acme.test", password: "Passw0rd!" },
  });
  check("staff sign in normally", staffLogin.status, 200);
  check("and inherit the company's plan", staffLogin.body.user?.creditAccount?.tierKey, "growth");

  const staffBuy = await api("POST", "/payments/create-order", {
    token: staffLogin.body?.token,
    body: { kind: "plan_purchase", planType: "byok", tierKey: "scale", period: "monthly" },
  });
  check("but cannot open an order", staffBuy.status, 403);
  check("with a code the UI branches on to show 'ask your admin'", staffBuy.body?.code, "NOT_COMPANY_ADMIN");

  const anon = await api("POST", "/payments/create-order", {
    body: { kind: "plan_purchase", planType: "byok", tierKey: "growth", period: "monthly" },
  });
  check("an unauthenticated request is rejected", anon.status, 401);

  /* ---------------------------------------------------------------- */
  section("10. One company admin cannot touch another company's order");

  await User.create({
    name: "Mallory",
    email: "mallory@evil.test",
    mobile: "6666666666",
    password: await bcrypt.hash("Passw0rd!", 10),
    role: "company_admin",
    companyId: (
      await api("POST", "/company/add-company", {
        token: state.rootToken,
        body: { name: "Evil Corp", email: "evil@evil.test", address: "2 Test Street" },
      })
    ).body.company._id,
  });
  const malloryLogin = await api("POST", "/auth/login", {
    body: { email: "mallory@evil.test", password: "Passw0rd!" },
  });

  const steal = await api("POST", "/payments/verify", {
    token: malloryLogin.body?.token,
    body: {
      razorpay_order_id: state.orderId,
      razorpay_payment_id: "pay_genuine",
      razorpay_signature: signCheckout(state.orderId, "pay_genuine"),
    },
  });
  // Even holding a VALID signature for someone else's order.
  check("replaying another company's order is refused", steal.status, 403);
  check("with a forbidden code", steal.body?.code, "FORBIDDEN");

  const nosyHistory = await api("GET", "/payments/history", { token: malloryLogin.body?.token });
  check("and their history shows none of it", nosyHistory.body.data?.rows?.length, 0);

  /* ---------------------------------------------------------------- */
  section("11. Credits can now be topped up, and the receipts read back");

  const topUp = await api("POST", "/payments/create-order", {
    token: state.adminToken,
    body: { kind: "credit_topup", credits: 40 },
  });
  check("a top-up is allowed once a plan exists", topUp.status, 201);
  // $0.75/credit -> ₹66/credit at ₹88 to the dollar, x40.
  check("priced at Growth's published extra-credit rate", topUp.body.data?.amountMinor, 264000);

  const topUpVerify = await api("POST", "/payments/verify", {
    token: state.adminToken,
    body: {
      razorpay_order_id: topUp.body.data.razorpayOrderId,
      razorpay_payment_id: "pay_topup",
      razorpay_signature: signCheckout(topUp.body.data.razorpayOrderId, "pay_topup"),
    },
  });
  check("the credits land", topUpVerify.body.data?.creditAccount?.balance, 1040);
  check("without disturbing the monthly allowance", topUpVerify.body.data?.creditAccount?.monthlyAllowance, 1000);

  const history = await api("GET", "/payments/history", { token: state.adminToken });
  check("history is readable", history.status, 200);
  const paidRows = history.body.data.rows.filter((r) => r.status === "paid");
  check("both completed purchases appear", paidRows.length, 2);
  check("and no card signature is ever returned", paidRows.every((r) => !r.razorpaySignature), true);

  /* ---------------------------------------------------------------- */

  console.log(`\n${B}${failed === 0 ? G : R}${passed} passed, ${failed} failed${X}`);
  if (failures.length) {
    console.log(`${Y}Failing checks:${X}`);
    failures.forEach((f) => console.log(`  - ${f}`));
  }

  if (mongod) await mongod.stop();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(`${R}Payment flow test crashed:${X}`, err);
  process.exit(1);
});
