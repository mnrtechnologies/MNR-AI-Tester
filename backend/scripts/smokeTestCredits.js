#!/usr/bin/env node
/**
 * Credit system smoke test.
 *
 *   node backend/scripts/smokeTestCredits.js
 *
 * Runs the whole credit lifecycle against a REAL MongoDB — an in-memory one by
 * default, or MONGODB_URL if you point it at a scratch database:
 *
 *   SMOKE_MONGODB_URL=mongodb://localhost:27017/at_smoke node backend/scripts/smokeTestCredits.js
 *
 * A real database matters here. The things most likely to be wrong in a credit
 * system are the atomic compare-and-set on the balance and the unique index
 * that stops double-charging — neither of which a mock would exercise.
 *
 * NEVER point this at production: it writes and deletes freely.
 */

const mongoose = require("mongoose");

const Subscription = require("../models/Subscription");
const CreditReservation = require("../models/CreditReservation");
const CreditLedger = require("../models/CreditLedger");
const ExcelSheet = require("../models/ExcelSheet");
const CreditUsage = require("../models/CreditUsage");
const User = require("../models/User");
const credits = require("../services/creditService");
const usageBilling = require("../services/usageBilling");
const cm = require("../../src/config/pricing/creditMath");
const um = require("../../src/config/pricing/usageMath");

/* ------------------------------------------------------------------ *
 * Tiny test harness (no jest — this talks to a database and runs as a
 * standalone script so it can be pointed at a real environment)
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

function checkTrue(label, value) {
  check(label, !!value, true);
}

function section(name) {
  console.log(`\n${B}${name}${X}`);
}

/* ------------------------------------------------------------------ *
 * Fixtures
 * ------------------------------------------------------------------ */

const COMPANY_ID = new mongoose.Types.ObjectId();
const USER_ID = new mongoose.Types.ObjectId();

async function resetWorld({ balance = 250, allowance = 250 } = {}) {
  await Promise.all([
    Subscription.deleteMany({}),
    CreditReservation.deleteMany({}),
    CreditLedger.deleteMany({}),
    ExcelSheet.deleteMany({}),
    CreditUsage.deleteMany({}),
    // Usage billing resolves the payer through the user, so scenarios seed one
    // at a fixed _id. Clear it here or the second scenario to do so collides.
    User.deleteMany({}),
  ]);

  const endDate = new Date();
  endDate.setFullYear(endDate.getFullYear() + 1);

  return Subscription.create({
    companyId: COMPANY_ID,
    planType: "byok",
    tierKey: "starter",
    pricingVersion: cm.PRICING_VERSION,
    priceUsdMonthly: 199,
    fxRateInrPerUsd: cm.FX_INR_PER_USD,
    concurrentSites: 1,
    startDate: new Date(),
    endDate,
    isActive: true,
    credits: {
      balance,
      reserved: 0,
      monthlyAllowance: allowance,
      overageRateUsd: 1.0,
      lifetimeGranted: allowance,
    },
    planDetails: { maxTestsAllowed: allowance, testsUsed: 0 },
  });
}

/** Stand in for what the Python engine writes after Phase 2 finishes a URL. */
async function seedSheet(parentSession, sessionId, storyCount, over = {}) {
  return ExcelSheet.create({
    session_id: sessionId,
    parent_session: parentSession,
    user_id: String(USER_ID),
    page_url: `https://example.com/${sessionId}`,
    target_website: "https://example.com",
    s3_excel_key: `key/${sessionId}.xlsx`,
    s3_download_url: `https://s3/${sessionId}.xlsx`,
    story_count: storyCount,
    phase3_status: "pending",
    ...over,
  });
}

const fresh = () => Subscription.findOne({ companyId: COMPANY_ID }).lean();

/** Stand in for what usage_meter.py writes after each model call. */
async function seedUsage(parentSession, over = {}) {
  return CreditUsage.create({
    user_id: String(USER_ID),
    session_id: `${parentSession}_url001`,
    parent_session: parentSession,
    provider: "anthropic",
    model: "claude-sonnet-4-6",
    action: "decide_action",
    phase: "execution",
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    billed: false,
    claimToken: null,
    ...over,
  });
}

/** Flip the company onto a Managed tier so the usage meter applies. */
async function makeManaged() {
  await Subscription.updateOne(
    { companyId: COMPANY_ID },
    { $set: { planType: "managed", tierKey: "managed_growth", engine: "gpt-4.1-mini" } }
  );
}

/* ------------------------------------------------------------------ *
 * Scenarios
 * ------------------------------------------------------------------ */

async function testHappyPath() {
  section("1. Happy path — discovery, quote, approve, run, settle");

  const sub = await resetWorld();
  const pid = "smoke_happy";

  // Discovery holds the crawler's page ceiling: the URL count is not knowable
  // until Phase 1 has finished crawling.
  const held = await credits.holdCredits(sub._id, cm.PHASE2_MAX_URLS, {
    parentSession: pid,
  });
  await CreditReservation.create({
    companyId: COMPANY_ID,
    subscriptionId: sub._id,
    userId: USER_ID,
    parentSession: pid,
    scope: "phase2",
    idempotencyKey: `${pid}:phase2`,
    credits: cm.PHASE2_MAX_URLS,
    status: "held",
    expiresAt: new Date(Date.now() + 3600e3),
  });

  check("balance after discovery hold", held.credits.balance, 240);
  check("reserved after discovery hold", held.credits.reserved, 10);

  // Phase 2 finds 3 URLs: 2, 4 and 20 stories -> 1 + 2 + 7 = 10 credits total.
  await seedSheet(pid, "u1", 2);
  await seedSheet(pid, "u2", 4);
  await seedSheet(pid, "u3", 20);

  const reconciled = await credits.reconcileExplorationHold(pid, USER_ID);
  check("discovery hold reconciled to real URL count", reconciled.credits, 3);
  check("reconciled hold has one line per URL", reconciled.lines.length, 3);

  const afterReconcile = await fresh();
  check("over-held credits returned", afterReconcile.credits.balance, 247);
  check("reserved now matches URL count", afterReconcile.credits.reserved, 3);

  const est = await credits.computeEstimate(pid, USER_ID, { pendingOnly: true });
  check("quoted total", est.totalCredits, 10);
  check("already held from discovery", est.alreadyHeld, 3);
  check("top-up charged at the gate", est.topUpRequired, 7);
  check("story total", est.totalStories, 26);
  check("estimate is complete", est.estimateIncomplete, false);
  // 20 stories is exactly the ceiling that still runs unattended; only 21+
  // triggers the stop-and-ask.
  check("20 stories does NOT require approval", est.oversizedUrls.length, 0);

  // Approve.
  const {
    buildReservationLines,
  } = require("../../src/config/pricing/settlementRules");
  const lines = buildReservationLines(est.perUrl, est.alreadyHeld, est.topUpRequired);
  check(
    "reservation lines sum to the amount held",
    lines.reduce((a, l) => a + l.credits, 0),
    est.topUpRequired
  );

  const phase3 = await CreditReservation.create({
    companyId: COMPANY_ID,
    subscriptionId: sub._id,
    userId: USER_ID,
    parentSession: pid,
    scope: "phase3",
    idempotencyKey: `${pid}:phase3`,
    credits: est.topUpRequired,
    storyCountTotal: est.totalStories,
    lines,
    status: "held",
    expiresAt: new Date(Date.now() + 3600e3),
  });
  await credits.holdCredits(sub._id, est.topUpRequired, {
    reservationId: phase3._id,
    parentSession: pid,
  });

  const afterAuth = await fresh();
  check("balance after approval", afterAuth.credits.balance, 240);
  check("reserved after approval", afterAuth.credits.reserved, 10);
  check(
    "discovery hold + top-up never exceeds the quote",
    est.alreadyHeld + est.topUpRequired,
    est.totalCredits
  );

  // The run completes.
  await ExcelSheet.updateMany(
    { parent_session: pid },
    { $set: { phase3_status: "completed", phase3_started_at: new Date() } }
  );

  await credits.settleReservation(phase3._id);
  await credits.settleReservation(reconciled._id);

  const done = await fresh();
  check("nothing left reserved", done.credits.reserved, 0);
  check("balance reflects the full 10-credit run", done.credits.balance, 240);
  check("lifetime committed", done.credits.lifetimeCommitted, 10);

  // The deprecated mirror must stay consistent or the old dashboards lie.
  check("legacy mirror maxTestsAllowed", done.planDetails.maxTestsAllowed, 250);
  check("legacy mirror testsUsed", done.planDetails.testsUsed, 10);

  const ledger = await CreditLedger.find({ companyId: COMPANY_ID }).lean();
  const types = ledger.map((r) => r.type).sort();
  checkTrue("ledger recorded holds", types.includes("hold"));
  checkTrue("ledger recorded commits", types.includes("commit"));
  checkTrue("ledger recorded the reconciliation release", types.includes("release"));
}

async function testInsufficientCredits() {
  section("2. Insufficient credits — the hold must refuse, not overdraw");

  const sub = await resetWorld({ balance: 4, allowance: 250 });

  const ok = await credits.holdCredits(sub._id, 4, { parentSession: "x" });
  checkTrue("a hold within balance succeeds", !!ok);
  check("balance drained to zero", ok.credits.balance, 0);

  const over = await credits.holdCredits(sub._id, 1, { parentSession: "x" });
  check("a hold beyond balance returns null (-> HTTP 402)", over, null);

  const after = await fresh();
  check("balance never went negative", after.credits.balance, 0);
}

async function testConcurrentHolds() {
  section("3. Concurrency — two racing holds for the last credits");

  const sub = await resetWorld({ balance: 10, allowance: 250 });

  // The exact race the old findOne->mutate->save could not survive: both
  // callers read the same balance and both decided they could afford it.
  const [a, b] = await Promise.all([
    credits.holdCredits(sub._id, 10, { parentSession: "race-a" }),
    credits.holdCredits(sub._id, 10, { parentSession: "race-b" }),
  ]);

  const winners = [a, b].filter(Boolean).length;
  check("exactly one of two racing holds succeeds", winners, 1);

  const after = await fresh();
  check("balance is zero, not negative", after.credits.balance, 0);
  check("only one hold is reserved", after.credits.reserved, 10);
}

async function testIdempotency() {
  section("4. Idempotency — double-charge protection is the unique index");

  const sub = await resetWorld();
  const pid = "smoke_idem";

  const make = () =>
    CreditReservation.create({
      companyId: COMPANY_ID,
      subscriptionId: sub._id,
      userId: USER_ID,
      parentSession: pid,
      scope: "phase3",
      idempotencyKey: `${pid}:phase3`,
      credits: 5,
      status: "held",
      expiresAt: new Date(Date.now() + 3600e3),
    });

  await make();

  let duplicateRejected = false;
  let errorCode = null;
  try {
    await make();
  } catch (err) {
    duplicateRejected = true;
    errorCode = err.code;
  }

  checkTrue("a duplicate authorization is rejected", duplicateRejected);
  check("rejected with a duplicate-key error (-> 200 alreadyAuthorized)", errorCode, 11000);
  check(
    "only one reservation exists",
    await CreditReservation.countDocuments({ parentSession: pid }),
    1
  );
}

async function testSettleIsIdempotent() {
  section("5. Settling twice — browser and reconciler may both fire");

  const sub = await resetWorld();
  const pid = "smoke_settle2";

  await seedSheet(pid, "s1", 4, {
    phase3_status: "completed",
    phase3_started_at: new Date(),
  });

  const r = await CreditReservation.create({
    companyId: COMPANY_ID,
    subscriptionId: sub._id,
    userId: USER_ID,
    parentSession: pid,
    scope: "phase3",
    idempotencyKey: `${pid}:phase3`,
    credits: 2,
    lines: [{ sessionId: "s1", pageUrl: "u", storyCount: 4, credits: 2 }],
    status: "held",
    expiresAt: new Date(Date.now() + 3600e3),
  });
  await credits.holdCredits(sub._id, 2, { reservationId: r._id, parentSession: pid });

  const first = await credits.settleReservation(r._id);
  const second = await credits.settleReservation(r._id);

  check("first settle commits", first.committed, 2);
  check("second settle is a no-op", second.settled, false);
  check("second settle explains why", second.reason, "not_held");

  const after = await fresh();
  check("charged exactly once", after.credits.lifetimeCommitted, 2);
  check("nothing stranded in reserved", after.credits.reserved, 0);
  check("balance reduced once, not twice", after.credits.balance, 248);
}

async function testFailureRefunds() {
  section("6. Failure handling — charge what ran, refund what didn't");

  const sub = await resetWorld();
  const pid = "smoke_fail";

  // Ran and failed: the model calls were spent, so it is charged.
  await seedSheet(pid, "ran", 4, {
    phase3_status: "failed",
    phase3_started_at: new Date(),
  });
  // Died before dispatch (S3 download or Excel parse): nothing was spent.
  await seedSheet(pid, "never", 4, {
    phase3_status: "failed",
    phase3_started_at: null,
  });

  const r = await CreditReservation.create({
    companyId: COMPANY_ID,
    subscriptionId: sub._id,
    userId: USER_ID,
    parentSession: pid,
    scope: "phase3",
    idempotencyKey: `${pid}:phase3`,
    credits: 2,
    lines: [
      { sessionId: "ran", pageUrl: "a", storyCount: 4, credits: 1 },
      { sessionId: "never", pageUrl: "b", storyCount: 4, credits: 1 },
    ],
    status: "held",
    expiresAt: new Date(Date.now() + 3600e3),
  });
  await credits.holdCredits(sub._id, 2, { reservationId: r._id, parentSession: pid });

  const result = await credits.settleReservation(r._id);

  check("work that started is charged", result.committed, 1);
  check("work that never started is refunded", result.released, 1);
  check("reservation marked partially committed", result.status, "partially_committed");

  const after = await fresh();
  check("customer billed only for real work", after.credits.balance, 249);
  check("nothing left reserved", after.credits.reserved, 0);
}

async function testStuckWorkerRelease() {
  section("7. Dead worker — the TTL sweep must not leak the hold");

  const sub = await resetWorld();
  const pid = "smoke_stuck";

  // Never dispatched, and the reservation has already expired.
  await seedSheet(pid, "pending1", 4);

  const r = await CreditReservation.create({
    companyId: COMPANY_ID,
    subscriptionId: sub._id,
    userId: USER_ID,
    parentSession: pid,
    scope: "phase3",
    idempotencyKey: `${pid}:phase3`,
    credits: 1,
    lines: [{ sessionId: "pending1", pageUrl: "a", storyCount: 4, credits: 1 }],
    status: "held",
    expiresAt: new Date(Date.now() - 1000),
  });
  await credits.holdCredits(sub._id, 1, { reservationId: r._id, parentSession: pid });

  const beforeSweep = await fresh();
  check("credit is held before the sweep", beforeSweep.credits.reserved, 1);

  const reconciler = require("../jobs/creditReconciler");
  await reconciler.sweepExpiredReservations();

  const after = await fresh();
  check("reconciler returned the stranded credit", after.credits.balance, 250);
  check("nothing left reserved", after.credits.reserved, 0);
}

async function testExplorationIsNotRefunded() {
  section("8. Abandoned run — exploration is real spend and stays charged");

  const sub = await resetWorld();
  const pid = "smoke_abandon";

  await seedSheet(pid, "e1", 3);
  await seedSheet(pid, "e2", 3);

  await CreditReservation.create({
    companyId: COMPANY_ID,
    subscriptionId: sub._id,
    userId: USER_ID,
    parentSession: pid,
    scope: "phase2",
    idempotencyKey: `${pid}:phase2`,
    credits: cm.PHASE2_MAX_URLS,
    status: "held",
    expiresAt: new Date(Date.now() - 1000),
  });
  await credits.holdCredits(sub._id, cm.PHASE2_MAX_URLS, { parentSession: pid });

  const rec = await credits.reconcileExplorationHold(pid, USER_ID);
  check("hold reconciled to 2 URLs", rec.credits, 2);

  // The user walks away without ever running Phase 3.
  const released = await credits.releaseParentSession(pid, COMPANY_ID);
  check("abandoning releases no discovery credits", released, 0);

  await credits.settleReservation(rec._id, { force: true });

  const after = await fresh();
  check("exploration charged for both URLs", after.credits.lifetimeCommitted, 2);
  check("balance reflects exploration spend", after.credits.balance, 248);
  check("nothing left reserved", after.credits.reserved, 0);
}

async function testUnknownStoryCountFailsExpensive() {
  section("9. Uncounted page — priced at the ceiling, never as free");

  await resetWorld();
  const pid = "smoke_unknown";

  await seedSheet(pid, "known", 2);
  await seedSheet(pid, "unknown", null); // written before story_count existed

  const est = await credits.computeEstimate(pid, USER_ID, { pendingOnly: true });

  check("estimate flagged incomplete", est.estimateIncomplete, true);
  check(
    "unknown page priced at the max, not zero",
    est.perUrl.find((l) => l.sessionId === "unknown").credits,
    cm.creditsForStories(cm.MAX_STORIES_PER_URL)
  );
  check("total = 1 (known) + 7 (ceiling)", est.totalCredits, 8);
}

async function testOversizedFlag() {
  section("10. Oversized page — the stop-and-ask boundary");

  await resetWorld();
  const pid = "smoke_oversized";

  await seedSheet(pid, "normal", 20); // at the ceiling
  await seedSheet(pid, "huge", 21); // over it

  const est = await credits.computeEstimate(pid, USER_ID, { pendingOnly: true });

  check("exactly one page needs approval", est.oversizedUrls.length, 1);
  check("and it is the 21-story page", est.oversizedUrls[0].sessionId, "huge");
  // Without acknowledgedOversized the controller answers 409 rather than
  // silently running up the bill.
  checkTrue("boundary matches the published limit", cm.MAX_STORIES_PER_URL === 20);
}

async function testReservedDriftCorrection() {
  section("11. Reserved drift — the invariant check repairs and records it");

  const sub = await resetWorld();

  // Simulate a half-applied hold: reserved says 5, no reservation backs it.
  await Subscription.updateOne(
    { _id: sub._id },
    { $set: { "credits.reserved": 5 }, $inc: { "credits.balance": -5 } }
  );

  const reconciler = require("../jobs/creditReconciler");
  await reconciler.verifyReservedInvariant();

  const after = await fresh();
  check("phantom reservation cleared", after.credits.reserved, 0);
  check("credits returned to the customer", after.credits.balance, 250);

  const adjust = await CreditLedger.findOne({ type: "adjust" }).lean();
  checkTrue("correction is recorded in the ledger, not silent", !!adjust);
}

async function testLegacyFallback() {
  section("12. Unmigrated subscription — degrades, never blanks out");

  await Subscription.deleteMany({});
  const endDate = new Date();
  endDate.setFullYear(endDate.getFullYear() + 1);

  const legacy = await Subscription.create({
    companyId: COMPANY_ID,
    planType: "legacy",
    legacyPlan: "premium",
    pricingVersion: null, // the marker for "not migrated"
    startDate: new Date(),
    endDate,
    isActive: true,
    planDetails: { maxTestsAllowed: 100, testsUsed: 30 },
  });

  const snap = credits.getAccountSnapshot(legacy);
  check("flagged as legacy", snap.legacy, true);
  check("balance derived from remaining tests", snap.balance, 70);
  check("allowance derived from the old limit", snap.monthlyAllowance, 100);
  checkTrue("still has a display name", !!snap.tierName);
}

/* ================================================================== *
 * The Managed meter — measured tokens, not the story formula
 * ================================================================== */

async function testMeteredBilling() {
  section("14. Managed plan — billed on real token usage");

  await resetWorld();
  await makeManaged();
  // The engine looks up the owner by user_id, so the user must exist.
  await User.create({
    _id: USER_ID,
    name: "Metered User",
    email: "metered@test.local",
    password: "x",
    role: "company_admin",
    companyId: COMPANY_ID,
  });

  const pid = "smoke_metered";

  // 1M input + 1M output on sonnet = $3 + $15 = $18 = 36 credits at $0.50.
  await seedUsage(pid, { inputTokens: 1_000_000 });
  await seedUsage(pid, { outputTokens: 1_000_000, action: "write_assertions" });

  const before = await fresh();
  check("balance before metering", before.credits.balance, 250);

  const result = await usageBilling.billUnbilledUsage();
  check("one account billed", result.charged, 1);
  check("charged the measured cost, not a formula", result.credits, 36);

  const after = await fresh();
  check("balance reduced by exactly the metered amount", after.credits.balance, 214);
  check("lifetime committed reflects real spend", after.credits.lifetimeCommitted, 36);

  const rows = await CreditUsage.find({ parent_session: pid }).lean();
  checkTrue("every row marked billed", rows.every((r) => r.billed));
  check("rows carry the charge for audit", rows[0].chargedCredits, 36);

  const ledger = await CreditLedger.findOne({ type: "commit" }).lean();
  checkTrue("a ledger row records the spend", !!ledger);
  checkTrue("and the USD it came from", ledger.amountUsd > 0);
}

/**
 * The case that defines the whole design: a Managed run pays the SAME capacity
 * credits a BYOK run would, and the model usage ON TOP. If either half goes
 * missing this test fails, which is the point.
 */
async function testManagedPaysCapacityPlusUsage() {
  section("14a. Managed — capacity credits AND model usage, added together");

  await resetWorld();
  await makeManaged();
  await User.deleteMany({});
  await User.create({
    _id: USER_ID,
    name: "Additive User",
    email: "additive@test.local",
    password: "x",
    role: "company_admin",
    companyId: COMPANY_ID,
  });

  const pid = "smoke_additive";

  // --- the capacity half: one 4-story page = 1 credit (same as BYOK) ---
  await seedSheet(pid, "u1", 4, {
    phase3_status: "completed",
    phase3_started_at: new Date(),
  });

  // 62 + 50×4 = 262 calls; 262/162 rounds to 2 — the doc's published table.
  const capacityCredits = cm.creditsForStories(4);
  check("capacity priced by the story formula", capacityCredits, 2);

  const sub = await fresh();
  const reservation = await CreditReservation.create({
    companyId: COMPANY_ID,
    subscriptionId: sub._id,
    userId: USER_ID,
    parentSession: pid,
    scope: "phase3",
    idempotencyKey: `${pid}:phase3`,
    credits: capacityCredits,
    lines: [{ sessionId: "u1", pageUrl: "u", storyCount: 4, credits: capacityCredits }],
    status: "held",
    expiresAt: new Date(Date.now() + 3600e3),
  });
  await credits.holdCredits(sub._id, capacityCredits, { parentSession: pid });
  await credits.settleReservation(reservation._id);

  const afterCapacity = await fresh();
  check("capacity charged", afterCapacity.credits.balance, 250 - capacityCredits);

  // --- the usage half: $3 of model spend = 6 credits at $0.50 ---
  await seedUsage(pid, { inputTokens: 1_000_000 });
  await usageBilling.billUnbilledUsage();

  const afterBoth = await fresh();
  const usageCredits = 6;

  check(
    "usage charged ON TOP, not instead",
    afterBoth.credits.balance,
    250 - capacityCredits - usageCredits
  );
  check(
    "lifetime committed is the SUM of both halves",
    afterBoth.credits.lifetimeCommitted,
    capacityCredits + usageCredits
  );

  // Both charges must be independently visible, or support cannot explain a bill.
  const commits = await CreditLedger.find({ companyId: COMPANY_ID, type: "commit" }).lean();
  checkTrue("two separate ledger entries — capacity and usage", commits.length >= 2);
  checkTrue(
    "one of them carries the USD the model cost",
    commits.some((c) => c.amountUsd > 0)
  );
  checkTrue(
    "and one carries no USD (that's the capacity charge)",
    commits.some((c) => !c.amountUsd)
  );
}

async function testByokPaysCapacityOnly() {
  section("14b. BYOK — the same run, capacity only");

  await resetWorld();
  await User.deleteMany({});
  await User.create({
    _id: USER_ID,
    name: "Capacity Only User",
    email: "capacity@test.local",
    password: "x",
    role: "company_admin",
    companyId: COMPANY_ID,
  });
  // resetWorld leaves planType "byok".

  const pid = "smoke_byok_same_run";
  await seedSheet(pid, "u1", 4, {
    phase3_status: "completed",
    phase3_started_at: new Date(),
  });

  const capacityCredits = cm.creditsForStories(4);
  const sub = await fresh();
  const reservation = await CreditReservation.create({
    companyId: COMPANY_ID,
    subscriptionId: sub._id,
    userId: USER_ID,
    parentSession: pid,
    scope: "phase3",
    idempotencyKey: `${pid}:phase3`,
    credits: capacityCredits,
    lines: [{ sessionId: "u1", pageUrl: "u", storyCount: 4, credits: capacityCredits }],
    status: "held",
    expiresAt: new Date(Date.now() + 3600e3),
  });
  await credits.holdCredits(sub._id, capacityCredits, { parentSession: pid });
  await credits.settleReservation(reservation._id);

  // Identical model spend to the Managed run above.
  await seedUsage(pid, { inputTokens: 1_000_000 });
  await usageBilling.billUnbilledUsage();

  const after = await fresh();
  check(
    "charged capacity ONLY — the same work costs less on BYOK",
    after.credits.balance,
    250 - capacityCredits
  );
  check("usage added nothing", after.credits.lifetimeCommitted, capacityCredits);

  const row = await CreditUsage.findOne({ parent_session: pid }).lean();
  checkTrue("but the usage was still recorded", !!row);
  check("at zero charge", row.chargedCredits, 0);
}

/** Both plans quote and gate; only Managed adds a usage charge. */
async function testSnapshotFlags() {
  section("14c. Account snapshot — capacity is universal, usage is additive");

  await resetWorld();
  const byok = credits.getAccountSnapshot(await fresh());
  check("BYOK quotes on capacity", byok.meter, "capacity");
  check("BYOK does not bill usage", byok.billsUsage, false);

  await makeManaged();
  const managed = credits.getAccountSnapshot(await fresh());
  check("Managed ALSO quotes on capacity", managed.meter, "capacity");
  check("and additionally bills usage", managed.billsUsage, true);
}

async function testMeteredIdempotency() {
  section("15. Metering twice — the claim guard");

  const pid = "smoke_metered_twice";
  await seedUsage(pid, { inputTokens: 1_000_000 });

  const first = await usageBilling.billUnbilledUsage();
  const second = await usageBilling.billUnbilledUsage();

  check("first pass charges", first.credits, 6); // $3 / 0.50
  check("second pass finds nothing", second.charged, 0);
  check("and charges nothing", second.credits, 0);

  const after = await fresh();
  // 214 from the previous scenario, minus 6.
  check("charged exactly once", after.credits.balance, 208);
}

async function testByokIsNeverCharged() {
  section("16. BYOK — usage recorded, never charged");

  await resetWorld();
  await User.deleteMany({});
  await User.create({
    _id: USER_ID,
    name: "BYOK User",
    email: "byok@test.local",
    password: "x",
    role: "company_admin",
    companyId: COMPANY_ID,
  });
  // resetWorld leaves planType "byok" — the customer pays their own provider.

  const pid = "smoke_byok";
  await seedUsage(pid, { inputTokens: 5_000_000 }); // would be 30 credits if billed

  const result = await usageBilling.billUnbilledUsage();
  check("recognised as a capacity plan", result.skippedByok, 1);
  check("nothing charged", result.credits, 0);

  const after = await fresh();
  check("balance untouched", after.credits.balance, 250);
  check("nothing committed", after.credits.lifetimeCommitted || 0, 0);

  const rows = await CreditUsage.find({ parent_session: pid }).lean();
  checkTrue("but the usage IS recorded", rows.length > 0);
  check("marked billed so it stops rescanning", rows[0].billed, true);
  check("with an explicit zero charge", rows[0].chargedCredits, 0);
  checkTrue("and the USD it would have cost, for capacity planning", rows[0].chargedUsd > 0);
}

async function testOrphanAttribution() {
  section("17. Usage with no owner — recovered from the run");

  await resetWorld();
  await makeManaged();
  await User.deleteMany({});
  await User.create({
    _id: USER_ID,
    name: "Orphan Owner",
    email: "orphan@test.local",
    password: "x",
    role: "company_admin",
    companyId: COMPANY_ID,
  });

  const pid = "smoke_orphan";
  // The sheet is what records who a run belongs to.
  await seedSheet(pid, "orphan1", 4);
  // A row written by an entry point that had no user in context.
  await seedUsage(pid, { user_id: "unknown", inputTokens: 1_000_000 });

  const result = await usageBilling.billUnbilledUsage();
  check("the orphan was attributed", result.attributed, 1);
  check("and then billed", result.credits, 6);

  const after = await fresh();
  check("the right account paid", after.credits.balance, 244);
}

async function testUnattributableUsageIsNotGuessed() {
  section("18. Truly unknown usage is left alone, not charged to someone");

  await resetWorld();
  await makeManaged();

  // No sheet, so no way to know whose run this was.
  await seedUsage("smoke_no_owner", { user_id: "unknown", inputTokens: 1_000_000 });

  const result = await usageBilling.billUnbilledUsage();
  check("nothing was attributed", result.attributed, 0);
  check("nothing was charged", result.credits, 0);

  const after = await fresh();
  check("no innocent account was debited", after.credits.balance, 250);

  const row = await CreditUsage.findOne({ parent_session: "smoke_no_owner" }).lean();
  check("the row stays unbilled and visible", row.billed, false);
}

async function testOverageRatherThanKillingARun() {
  section("19. Balance exhausted mid-run — bill it, don't kill it");

  await resetWorld({ balance: 2, allowance: 250 });
  await makeManaged();
  await User.deleteMany({});
  await User.create({
    _id: USER_ID,
    name: "Overage User",
    email: "overage@test.local",
    password: "x",
    role: "company_admin",
    companyId: COMPANY_ID,
  });

  // 10 credits of work against a 2-credit balance.
  await seedUsage("smoke_overage", { inputTokens: 1_000_000, outputTokens: 200_000 });

  await usageBilling.billUnbilledUsage();

  const after = await fresh();
  // Deliberately negative: refusing to record spend a provider already billed
  // us for would lose the money AND the audit trail.
  checkTrue("balance is allowed to go negative", after.credits.balance < 0);
  check("the full cost was recorded", after.credits.lifetimeCommitted, 12);

  const ledger = await CreditLedger.findOne({ type: "overage" }).lean();
  checkTrue("and the ledger calls it overage, not a normal commit", !!ledger);
}

async function testUnverifiedRatesAreFlagged() {
  section("20. Unverified provider rates are surfaced, not hidden");

  await resetWorld();
  await makeManaged();
  await User.deleteMany({});
  await User.create({
    _id: USER_ID,
    name: "Rates User",
    email: "rates@test.local",
    password: "x",
    role: "company_admin",
    companyId: COMPANY_ID,
  });

  // gpt-4.1-mini is the Managed default engine and its rates are unconfirmed.
  await seedUsage("smoke_rates", {
    provider: "openai",
    model: "gpt-4.1-mini-2025-04-14",
    inputTokens: 1_000_000,
  });

  await usageBilling.billUnbilledUsage();

  const row = await CreditUsage.findOne({ parent_session: "smoke_rates" }).lean();
  check("the row is flagged for review", row.rateUnverified, true);
  checkTrue("but it was still charged, not skipped", row.chargedCredits > 0);
}

async function testStaleClaimRecovery() {
  section("21. A pass that died mid-billing releases its claim");

  await resetWorld();
  await makeManaged();

  const pid = "smoke_stale_claim";
  await seedUsage(pid, { inputTokens: 1_000_000 });

  // Simulate a crash after claiming but before billing.
  const stale = new Date(Date.now() - 60 * 60 * 1000);
  await CreditUsage.updateMany(
    { parent_session: pid },
    { $set: { claimToken: "dead-worker", claimedAt: stale } }
  );

  const stuck = await usageBilling.billUnbilledUsage();
  check("a claimed row is not picked up by another pass", stuck.credits, 0);

  const released = await usageBilling.releaseStaleClaims(15);
  check("the stale claim is released", released, 1);

  const row = await CreditUsage.findOne({ parent_session: pid }).lean();
  check("and the row is billable again", row.claimToken, null);
  check("still unbilled — nothing was lost", row.billed, false);
}

/**
 * The migration is the highest-risk script in the system — it rewrites the
 * collection holding customers' paid balances. Run the REAL script as a
 * subprocess rather than re-implementing its logic here, so what is verified
 * is what actually ships.
 */
async function testMigration(uri) {
  section("13. Legacy migration — dry run, then commit");

  const { execFileSync } = require("child_process");
  const path = require("path");

  await Subscription.deleteMany({});
  await CreditLedger.deleteMany({});

  const endDate = new Date();
  endDate.setFullYear(endDate.getFullYear() + 1);
  const base = { startDate: new Date(), endDate, isActive: true, planType: "legacy" };

  const ids = {
    basic: new mongoose.Types.ObjectId(),
    premium: new mongoose.Types.ObjectId(),
    unlimited: new mongoose.Types.ObjectId(),
    victim: new mongoose.Types.ObjectId(),
  };

  // Written through the raw collection so the documents look exactly like
  // pre-migration ones: a `plan` field, and no credits sub-document.
  await mongoose.connection.collection("subscriptions").insertMany([
    { ...base, companyId: ids.basic, plan: "basic", planDetails: { maxTestsAllowed: 10, testsUsed: 4 } },
    { ...base, companyId: ids.premium, plan: "premium", planDetails: { maxTestsAllowed: 100, testsUsed: 100 } },
    { ...base, companyId: ids.unlimited, plan: "custom", planDetails: { maxTestsAllowed: -1, testsUsed: 500 } },
    // The pre-save-hook victims: limit 0, so they could never run anything.
    { ...base, companyId: ids.victim, plan: "basic", planDetails: { maxTestsAllowed: 0, testsUsed: 0 } },
  ]);

  const script = path.join(__dirname, "migrateToCredits.js");
  const run = (args) =>
    execFileSync(process.execPath, [script, ...args], {
      env: { ...process.env, MONGODB_URL: uri },
      encoding: "utf8",
    });

  // --- dry run must not write ---
  const dry = run([]);
  checkTrue("dry run reports what it would do", /Would migrate: 4/.test(dry));
  check(
    "dry run wrote nothing",
    await Subscription.countDocuments({ pricingVersion: { $ne: null } }),
    0
  );

  // --- commit ---
  const committed = run(["--commit"]);
  checkTrue("commit reports 4 migrated", /Migrated: 4/.test(committed));

  const basic = await Subscription.findOne({ companyId: ids.basic }).lean();
  check("basic -> byok/starter", `${basic.planType}/${basic.tierKey}`, "byok/starter");
  check("starter allowance from config", basic.credits.monthlyAllowance, 250);
  check("balance = remaining tests (10 - 4)", basic.credits.balance, 6);
  checkTrue("pricing version pinned", !!basic.pricingVersion);

  const premium = await Subscription.findOne({ companyId: ids.premium }).lean();
  check("premium -> byok/growth", `${premium.planType}/${premium.tierKey}`, "byok/growth");
  check("a fully-used plan migrates to zero, not negative", premium.credits.balance, 0);

  const unlimited = await Subscription.findOne({ companyId: ids.unlimited }).lean();
  checkTrue(
    "unlimited flagged for a human, never silently made finite",
    unlimited.credits.needsManualReview
  );

  const victim = await Subscription.findOne({ companyId: ids.victim }).lean();
  // These companies were locked out from day one by the old pre-save hook, so
  // converting "0 remaining" literally would migrate them to a dead account.
  check("a never-usable plan gets the full allowance", victim.credits.balance, 250);

  check(
    "every migration wrote an audit row",
    await CreditLedger.countDocuments({ type: "migration" }),
    4
  );

  // --- re-run must be a no-op ---
  const again = run(["--commit"]);
  checkTrue("re-running is safe", /Nothing to do|Migrated: 0/.test(again));
  check(
    "no duplicate audit rows",
    await CreditLedger.countDocuments({ type: "migration" }),
    4
  );
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
  console.log(`${D}Connected: ${uri.replace(/\/\/.*@/, "//***@")}${X}`);
  console.log(`${D}Pricing version ${cm.PRICING_VERSION} · enforcement ${credits.ENFORCED}${X}`);

  const scenarios = [
    testHappyPath,
    testInsufficientCredits,
    testConcurrentHolds,
    testIdempotency,
    testSettleIsIdempotent,
    testFailureRefunds,
    testStuckWorkerRelease,
    testExplorationIsNotRefunded,
    testUnknownStoryCountFailsExpensive,
    testOversizedFlag,
    testReservedDriftCorrection,
    testLegacyFallback,
    testManagedPaysCapacityPlusUsage,
    testByokPaysCapacityOnly,
    testSnapshotFlags,
    testMeteredBilling,
    testMeteredIdempotency,
    testByokIsNeverCharged,
    testOrphanAttribution,
    testUnattributableUsageIsNotGuessed,
    testOverageRatherThanKillingARun,
    testUnverifiedRatesAreFlagged,
    testStaleClaimRecovery,
    testMigration,
  ];

  for (const scenario of scenarios) {
    try {
      await scenario(uri);
    } catch (err) {
      failed++;
      failures.push(`${scenario.name} threw`);
      console.log(`    ${R}✗ ${scenario.name} threw: ${err.message}${X}`);
      console.log(`${D}${err.stack}${X}`);
    }
  }

  console.log(
    `\n${B}${failed === 0 ? G : R}${passed} passed, ${failed} failed${X}`
  );
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
