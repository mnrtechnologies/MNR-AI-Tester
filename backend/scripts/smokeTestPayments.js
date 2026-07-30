#!/usr/bin/env node
/**
 * Payment / purchase smoke test.
 *
 *   node backend/scripts/smokeTestPayments.js
 *
 * Runs the purchase lifecycle against a REAL MongoDB — an in-memory one by
 * default, or a scratch database if you point it somewhere:
 *
 *   SMOKE_MONGODB_URL=mongodb://localhost:27017/at_smoke node backend/scripts/smokeTestPayments.js
 *
 * A real database is the point. The two things most likely to be wrong in a
 * payment system are the compare-and-set that stops a double grant when the
 * webhook and the browser callback race, and the sparse unique index on
 * razorpayOrderId — neither of which a mock would exercise.
 *
 * Razorpay itself is never called: razorpayService is the only module that
 * talks to the gateway and it is not imported here. Everything below drives
 * purchaseService directly, exactly as paymentController does once a signature
 * has been verified.
 *
 * NEVER point this at production: it writes and deletes freely.
 */

const mongoose = require("mongoose");

const Subscription = require("../models/Subscription");
const Company = require("../models/Company");
const Payment = require("../models/Payment");
const CreditLedger = require("../models/CreditLedger");
const credits = require("../services/creditService");
const purchases = require("../services/purchaseService");
const allowanceResetJob = require("../jobs/allowanceResetJob");
const cm = require("../../src/config/pricing/creditMath");
const pq = require("../../src/config/pricing/purchaseQuote");

/* ------------------------------------------------------------------ *
 * Tiny test harness (same shape as smokeTestCredits.js)
 * ------------------------------------------------------------------ */

let passed = 0;
let failed = 0;
const failures = [];

const G = "\x1b[32m";
const R = "\x1b[31m";
const Y = "\x1b[33m";
const D = "\x1b[2m";
const B = "\x1b[1m";
const X = "\x1b[0m";

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

function section(name) {
  console.log(`\n${B}${name}${X}`);
}

/* ------------------------------------------------------------------ *
 * Fixtures
 * ------------------------------------------------------------------ */

const COMPANY_ID = new mongoose.Types.ObjectId();
const USER_ID = new mongoose.Types.ObjectId();

async function resetWorld() {
  await Promise.all([
    Subscription.deleteMany({}),
    Payment.deleteMany({}),
    CreditLedger.deleteMany({}),
    Company.deleteMany({}),
  ]);

  await Company.create({
    _id: COMPANY_ID,
    name: "Smoke Test Ltd",
    email: "smoke@example.com",
    subscriptionStatus: "none",
  });
}

/** The Payment row paymentController would have written at create-order. */
async function seedOrder({ kind = "plan_purchase", planType = "byok", tierKey = "growth", period = "monthly", quantity, currency } = {}) {
  const quote =
    kind === "plan_purchase"
      ? pq.quotePlan({ planType, tierKey, period, currency })
      : pq.quoteCredits({ planType, tierKey, quantity, currency });

  if (!quote.ok) throw new Error(`fixture quote failed: ${quote.code} ${quote.message}`);

  return Payment.create({
    companyId: COMPANY_ID,
    createdBy: USER_ID,
    kind: quote.kind,
    planType: quote.planType,
    tierKey: quote.tierKey,
    period: quote.period || null,
    creditsPurchased: kind === "plan_purchase" ? quote.credits : quote.quantity,
    amountMinor: quote.amountMinor,
    currency: quote.currency,
    amountUsdSnapshot: quote.amountUsd,
    priceUsdSnapshot: kind === "plan_purchase" ? quote.unitPriceUsdMonthly : quote.unitPriceUsd,
    pricingVersion: quote.pricingVersion,
    fxRateInrPerUsd: quote.fxRateInrPerUsd,
    description: quote.description,
    razorpayOrderId: `order_${new mongoose.Types.ObjectId()}`,
    status: "created",
  });
}

const fresh = () => Subscription.findOne({ companyId: COMPANY_ID }).lean();
const ledgerOf = (type) => CreditLedger.countDocuments({ companyId: COMPANY_ID, type });

/* ------------------------------------------------------------------ *
 * Scenarios
 * ------------------------------------------------------------------ */

async function testFirstPurchaseCreatesSubscription() {
  section("A first purchase turns a company on");
  await resetWorld();

  const payment = await seedOrder({ tierKey: "growth", period: "monthly" });
  const growth = cm.getTier("byok", "growth");

  const result = await purchases.fulfilPayment(payment._id, {
    source: "callback",
    razorpayPaymentId: "pay_first",
  });

  check("fulfilled", result.fulfilled, true);

  const sub = await fresh();
  check("subscription created", !!sub, true);
  check("on the tier that was bought", sub.tierKey, "growth");
  check("credits match the catalog", sub.credits.balance, growth.credits);
  check("allowance matches the catalog", sub.credits.monthlyAllowance, growth.credits);
  check("nothing in the purchased bucket yet", sub.credits.purchasedBalance, 0);
  check("price snapshotted", sub.priceUsdMonthly, growth.priceUsdMonthly);
  check("pricing version pinned", sub.pricingVersion, cm.PRICING_VERSION);

  const company = await Company.findById(COMPANY_ID).lean();
  check("company marked active", company.subscriptionStatus, "active");
  check("company points at the subscription", String(company.activeSubscriptionId), String(sub._id));

  const paid = await Payment.findById(payment._id).lean();
  check("payment marked paid", paid.status, "paid");
  check("payment linked to the subscription", String(paid.subscriptionId), String(sub._id));
  check("exactly one purchase ledger row", await ledgerOf("purchase"), 1);
}

async function testFulfilmentIsIdempotent() {
  section("The webhook and the callback race — credits land exactly once");
  await resetWorld();

  const payment = await seedOrder({ tierKey: "growth", period: "monthly" });
  const growth = cm.getTier("byok", "growth");

  // Both paths fire at the same instant, which is exactly what happens when
  // the browser is fast and the webhook is prompt.
  const [a, b] = await Promise.all([
    purchases.fulfilPayment(payment._id, { source: "callback", razorpayPaymentId: "pay_race" }),
    purchases.fulfilPayment(payment._id, { source: "webhook", razorpayPaymentId: "pay_race" }),
  ]);

  const winners = [a, b].filter((r) => r.fulfilled).length;
  check("exactly one caller fulfils", winners, 1);

  const loser = [a, b].find((r) => !r.fulfilled);
  checkTrue("the loser reports a reason rather than an error", !!loser.reason);

  const sub = await fresh();
  check("credits granted once, not twice", sub.credits.balance, growth.credits);
  check("one purchase ledger row, not two", await ledgerOf("purchase"), 1);

  // A duplicate webhook delivery hours later must also be a no-op.
  const replay = await purchases.fulfilPayment(payment._id, {
    source: "webhook",
    razorpayPaymentId: "pay_race",
  });
  check("a replayed webhook is refused", replay.fulfilled, false);
  check("and reports it was already done", replay.reason, "already_fulfilled");
  check("balance still untouched", (await fresh()).credits.balance, growth.credits);
}

async function testSameTierExtendsWithoutBonusCredits() {
  section("Re-buying the same tier buys TIME, not a second allowance");
  await resetWorld();

  const first = await seedOrder({ tierKey: "growth", period: "monthly" });
  await purchases.fulfilPayment(first._id, { source: "callback", razorpayPaymentId: "pay_1" });

  const before = await fresh();
  // Spend some so a bonus grant would be obvious.
  await credits.adjustCredits(before._id, -400, { type: "adjust", note: "smoke: simulate usage" });
  const spent = await fresh();
  check("balance after usage", spent.credits.balance, 600);

  const second = await seedOrder({ tierKey: "growth", period: "monthly" });
  const result = await purchases.fulfilPayment(second._id, {
    source: "callback",
    razorpayPaymentId: "pay_2",
  });
  check("fulfilled", result.fulfilled, true);

  const after = await fresh();
  check("balance UNCHANGED — no free allowance", after.credits.balance, 600);
  check("allowance unchanged", after.credits.monthlyAllowance, 1000);
  check(
    "reset date unchanged, so the monthly cadence is preserved",
    new Date(after.credits.nextResetAt).getTime(),
    new Date(spent.credits.nextResetAt).getTime()
  );
  checkTrue(
    "end date pushed out by a month",
    new Date(after.endDate).getTime() > new Date(spent.endDate).getTime()
  );

  const paid = await Payment.findById(second._id).lean();
  check("the extension granted zero credits", paid.creditsGranted, 0);
}

async function testSixMonthPurchaseGrantsOneMonthAtATime() {
  section("A 6-month purchase buys six monthly grants, not 6x credits");
  await resetWorld();

  const payment = await seedOrder({ tierKey: "starter", period: "semiAnnual" });
  const starter = cm.getTier("byok", "starter");

  // Paise — the default billing currency is INR. $199 x 6 x 0.9 = $1,075 -> ₹94,600.
  check("charged the discounted 6-month price", payment.amountMinor, 9460000);
  checkTrue("which is cheaper than six monthly payments", payment.amountMinor < 1751200 * 6);

  await purchases.fulfilPayment(payment._id, { source: "callback", razorpayPaymentId: "pay_6mo" });

  const sub = await fresh();
  check("ONE month's allowance on day one", sub.credits.balance, starter.credits);
  check("allowance is the monthly figure", sub.credits.monthlyAllowance, starter.credits);

  const now = Date.now();
  const monthsOut = (d) => (new Date(d).getTime() - now) / (1000 * 60 * 60 * 24 * 30.4);
  checkTrue("plan runs for ~6 months", monthsOut(sub.endDate) > 5.5 && monthsOut(sub.endDate) < 6.5);
  checkTrue(
    "but credits reset in ~1 month, so allowanceResetJob delivers the rest",
    monthsOut(sub.credits.nextResetAt) > 0.8 && monthsOut(sub.credits.nextResetAt) < 1.3
  );
}

async function testTopUpDoesNotRewriteTheAllowance() {
  section("A credit top-up adds credits and changes nothing else");
  await resetWorld();

  const plan = await seedOrder({ tierKey: "growth", period: "monthly" });
  await purchases.fulfilPayment(plan._id, { source: "callback", razorpayPaymentId: "pay_plan" });

  const before = await fresh();
  const topUp = await seedOrder({ kind: "credit_topup", tierKey: "growth", quantity: 50 });
  // Growth is $0.75/credit -> ₹66/credit at ₹88 to the dollar.
  check("priced at the tier's extra-credit rate", topUp.amountMinor, 50 * 6600);

  const result = await purchases.fulfilPayment(topUp._id, {
    source: "callback",
    razorpayPaymentId: "pay_topup",
  });
  check("fulfilled", result.fulfilled, true);

  const after = await fresh();
  check("balance went up by the quantity bought", after.credits.balance, before.credits.balance + 50);
  // THE REGRESSION THIS SCENARIO EXISTS FOR: grantAllowance would have $set
  // monthlyAllowance to 50, silently downgrading a 1,000-credit plan.
  check("monthly allowance UNCHANGED", after.credits.monthlyAllowance, before.credits.monthlyAllowance);
  check("credits landed in the purchased bucket", after.credits.purchasedBalance, 50);
  check("end date unchanged", new Date(after.endDate).getTime(), new Date(before.endDate).getTime());
  check("two purchase ledger rows — the plan and the top-up", await ledgerOf("purchase"), 2);
}

async function testPurchasedCreditsSurviveTheMonthlyReset() {
  section("The monthly reset expires the allowance but keeps bought credits");
  await resetWorld();

  const plan = await seedOrder({ tierKey: "growth", period: "monthly" });
  await purchases.fulfilPayment(plan._id, { source: "callback", razorpayPaymentId: "pay_plan" });

  const topUp = await seedOrder({ kind: "credit_topup", tierKey: "growth", quantity: 50 });
  await purchases.fulfilPayment(topUp._id, { source: "callback", razorpayPaymentId: "pay_topup" });

  const sub = await fresh();
  check("rollover policy is the default", sub.credits.rolloverPolicy, "none");
  check("balance before reset", sub.credits.balance, 1050);

  // Make the reset due.
  await Subscription.updateOne(
    { _id: sub._id },
    { $set: { "credits.nextResetAt": new Date(Date.now() - 1000) } }
  );
  await allowanceResetJob.runResets();

  const after = await fresh();
  // 1000 fresh allowance + the 50 that were paid for in cash. Without
  // preservePurchased this would be a flat 1000 and the customer would be
  // quietly robbed of credits they bought.
  check("allowance renewed AND purchased credits kept", after.credits.balance, 1050);
  check("purchased bucket still tracked", after.credits.purchasedBalance, 50);
  checkTrue("next reset moved into the future", new Date(after.credits.nextResetAt) > new Date());
}

async function testSwitchingTierKeepsPurchasedCredits() {
  section("Changing tier restarts the period but never destroys bought credits");
  await resetWorld();

  const plan = await seedOrder({ tierKey: "scale", period: "monthly" });
  await purchases.fulfilPayment(plan._id, { source: "callback", razorpayPaymentId: "pay_scale" });

  const topUp = await seedOrder({ kind: "credit_topup", tierKey: "scale", quantity: 100 });
  await purchases.fulfilPayment(topUp._id, { source: "callback", razorpayPaymentId: "pay_topup" });

  check("on Scale with a top-up", (await fresh()).credits.balance, 3600);

  // Downgrade — the case where a naive "set" wipes everything.
  const down = await seedOrder({ tierKey: "starter", period: "monthly" });
  const result = await purchases.fulfilPayment(down._id, {
    source: "callback",
    razorpayPaymentId: "pay_starter",
  });
  check("fulfilled", result.fulfilled, true);

  const after = await fresh();
  check("now on Starter", after.tierKey, "starter");
  check("allowance is Starter's", after.credits.monthlyAllowance, 250);
  check("balance is the new allowance PLUS the 100 bought credits", after.credits.balance, 350);
  check("purchased bucket preserved", after.credits.purchasedBalance, 100);
  check("the extra-credit rate is now Starter's", after.credits.overageRateUsd, 1.0);
}

async function testSubscriptionIsUpdatedNotReplaced() {
  section("A purchase never orphans an in-flight run's reservation");
  await resetWorld();

  const first = await seedOrder({ tierKey: "starter", period: "monthly" });
  await purchases.fulfilPayment(first._id, { source: "callback", razorpayPaymentId: "pay_a" });
  const originalId = String((await fresh())._id);

  const upgrade = await seedOrder({ tierKey: "growth", period: "monthly" });
  await purchases.fulfilPayment(upgrade._id, { source: "callback", razorpayPaymentId: "pay_b" });

  check("same subscription document", String((await fresh())._id), originalId);
  check("only one subscription exists for the company", await Subscription.countDocuments({ companyId: COMPANY_ID }), 1);
  // Reservations and ledger rows reference subscriptionId. A replaced document
  // would settle held credits onto a dead subscription and lose them.
}

async function testTopUpWithoutASubscriptionIsRefused() {
  section("Credits cannot be bought without a plan to put them on");
  await resetWorld();

  const topUp = await seedOrder({ kind: "credit_topup", tierKey: "growth", quantity: 50 });

  let threw = false;
  try {
    await purchases.fulfilPayment(topUp._id, { source: "callback", razorpayPaymentId: "pay_orphan" });
  } catch (err) {
    threw = true;
  }

  check("fulfilment refuses rather than inventing a subscription", threw, true);

  const paid = await Payment.findById(topUp._id).lean();
  // Money was captured and nothing was delivered. This state exists so a human
  // can find it — it must never be silently swallowed.
  check("payment flagged for a human", paid.status, "fulfilment_failed");
  checkTrue("with a reason recorded", !!paid.failureReason);
  check("no subscription conjured up", await Subscription.countDocuments({ companyId: COMPANY_ID }), 0);
}

async function testFailedFulfilmentCanBeRetried() {
  section("A fulfilment that failed can be retried without double-granting");
  await resetWorld();

  const plan = await seedOrder({ tierKey: "growth", period: "monthly" });
  await purchases.fulfilPayment(plan._id, { source: "callback", razorpayPaymentId: "pay_x" });

  const balanceAfterFirst = (await fresh()).credits.balance;

  // Simulate a crash AFTER the entitlement landed but BEFORE the payment was
  // marked paid — the exact window the resume markers exist for.
  await Payment.updateOne(
    { _id: plan._id },
    { $set: { status: "fulfilment_failed", failureReason: "smoke: simulated crash" } }
  );

  const retry = await purchases.fulfilPayment(plan._id, {
    source: "webhook",
    razorpayPaymentId: "pay_x",
  });

  check("the retry is claimable", retry.fulfilled, true);
  check("but it resumes rather than granting again", (await fresh()).credits.balance, balanceAfterFirst);
  check("still exactly one purchase ledger row", await ledgerOf("purchase"), 1);
  check("payment now settled", (await Payment.findById(plan._id).lean()).status, "paid");
}

async function testOrderIdIsUniqueButNullsAreAllowed() {
  section("The unique index stops a duplicate order without blocking new ones");
  await resetWorld();

  // Two payments that have not reached Razorpay yet both carry a null order id.
  const a = await Payment.create({
    companyId: COMPANY_ID, createdBy: USER_ID, kind: "plan_purchase",
    amountMinor: 1751200, currency: "INR",
  });
  const b = await Payment.create({
    companyId: COMPANY_ID, createdBy: USER_ID, kind: "plan_purchase",
    amountMinor: 1751200, currency: "INR",
  });
  checkTrue("two orders can both be pending", !!a && !!b);

  await Payment.updateOne({ _id: a._id }, { $set: { razorpayOrderId: "order_dupe" } });

  let rejected = false;
  try {
    await Payment.collection.updateOne(
      { _id: b._id },
      { $set: { razorpayOrderId: "order_dupe" } }
    );
  } catch (err) {
    rejected = err.code === 11000;
  }
  check("the same Razorpay order cannot be recorded twice", rejected, true);
}

async function testEitherCurrencyBuysTheSameEntitlement() {
  section("INR and USD differ in what is charged, never in what is delivered");
  await resetWorld();

  const inr = await seedOrder({ tierKey: "growth", period: "monthly", currency: "INR" });
  check("an INR order is priced in paise", inr.amountMinor, 4391200);
  check("and records the currency", inr.currency, "INR");
  check("with the USD catalog figure kept for the receipt", inr.amountUsdSnapshot, 499);

  await purchases.fulfilPayment(inr._id, { source: "callback", razorpayPaymentId: "pay_inr" });
  const afterInr = await fresh();
  check("credits from the INR purchase", afterInr.credits.balance, 1000);

  // A second company paying in USD must receive exactly the same plan.
  await resetWorld();
  const usd = await seedOrder({ tierKey: "growth", period: "monthly", currency: "USD" });
  check("a USD order is priced in cents", usd.amountMinor, 49900);
  check("and records the currency", usd.currency, "USD");

  await purchases.fulfilPayment(usd._id, { source: "callback", razorpayPaymentId: "pay_usd" });
  const afterUsd = await fresh();
  check("identical credits from the USD purchase", afterUsd.credits.balance, 1000);
  check("identical tier", afterUsd.tierKey, afterInr.tierKey);
  // The subscription always snapshots the USD catalog price, whichever
  // currency the customer happened to pay in.
  check("and the same USD price snapshot", afterUsd.priceUsdMonthly, afterInr.priceUsdMonthly);
}

async function testPaymentMethodsFollowTheCurrency() {
  section("UPI and netbanking are offered on INR only");

  const inr = pq.quotePlan({ planType: "byok", tierKey: "growth", period: "monthly", currency: "INR" });
  check("INR offers UPI", inr.methods.upi, true);
  check("INR offers netbanking", inr.methods.netbanking, true);

  const usd = pq.quotePlan({ planType: "byok", tierKey: "growth", period: "monthly", currency: "USD" });
  // Not a policy choice: these are India-domestic rails that settle in INR, so
  // Razorpay will not render them on a USD order however we configure checkout.
  check("USD does NOT offer UPI", usd.methods.upi, false);
  check("USD does NOT offer netbanking", usd.methods.netbanking, false);
  check("USD still offers cards", usd.methods.card, true);

  check(
    "an unsupported currency is refused, not defaulted",
    pq.quotePlan({ planType: "byok", tierKey: "growth", period: "monthly", currency: "EUR" }).code,
    "INVALID_CURRENCY"
  );
}

async function testUnsellableTiersNeverReachAnOrder() {
  section("Tiers that are not for sale are refused before any money moves");

  check("managed_pro is refused", pq.quotePlan({ planType: "managed", tierKey: "managed_pro", period: "monthly" }).code, "TIER_UNAVAILABLE");
  check("self_hosted is refused", pq.quotePlan({ planType: "byok", tierKey: "self_hosted", period: "monthly" }).code, "TIER_CUSTOM");
  check("enterprise is refused", pq.quotePlan({ planType: "managed", tierKey: "enterprise", period: "monthly" }).code, "TIER_CUSTOM");
  check("an unknown tier is refused", pq.quotePlan({ planType: "byok", tierKey: "free", period: "monthly" }).code, "TIER_NOT_FOUND");
}

/* ------------------------------------------------------------------ *
 * Runner
 * ------------------------------------------------------------------ */

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

  await mongoose.connect(uri);
  // The unique index on razorpayOrderId is what the duplicate-order scenario
  // asserts, and Mongoose builds indexes lazily.
  await Payment.init();

  console.log(`${D}Connected: ${uri.replace(/\/\/.*@/, "//***@")}${X}`);
  console.log(`${D}Pricing version ${cm.PRICING_VERSION}${X}`);

  const scenarios = [
    testFirstPurchaseCreatesSubscription,
    testFulfilmentIsIdempotent,
    testSameTierExtendsWithoutBonusCredits,
    testSixMonthPurchaseGrantsOneMonthAtATime,
    testTopUpDoesNotRewriteTheAllowance,
    testPurchasedCreditsSurviveTheMonthlyReset,
    testSwitchingTierKeepsPurchasedCredits,
    testSubscriptionIsUpdatedNotReplaced,
    testTopUpWithoutASubscriptionIsRefused,
    testFailedFulfilmentCanBeRetried,
    testOrderIdIsUniqueButNullsAreAllowed,
    testEitherCurrencyBuysTheSameEntitlement,
    testPaymentMethodsFollowTheCurrency,
    testUnsellableTiersNeverReachAnOrder,
  ];

  for (const scenario of scenarios) {
    try {
      await scenario();
    } catch (err) {
      failed++;
      failures.push(`${scenario.name} threw`);
      console.log(`    ${R}✗ ${scenario.name} threw: ${err.message}${X}`);
      console.log(`${D}${err.stack}${X}`);
    }
  }

  console.log(`\n${B}${failed === 0 ? G : R}${passed} passed, ${failed} failed${X}`);
  if (failures.length) {
    console.log(`${Y}Failing checks:${X}`);
    failures.forEach((f) => console.log(`  - ${f}`));
  }

  await mongoose.disconnect();
  if (mongod) await mongod.stop();

  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error(`${R}Smoke test crashed:${X}`, err);
  try {
    await mongoose.disconnect();
  } catch (_) {
    /* already disconnected */
  }
  process.exit(1);
});
