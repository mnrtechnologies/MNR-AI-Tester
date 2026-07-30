#!/usr/bin/env node
/**
 * migrateToCredits — one-time conversion from the flat test quota to credits.
 *
 *   node backend/scripts/migrateToCredits.js              # dry run (default)
 *   node backend/scripts/migrateToCredits.js --commit     # actually write
 *   node backend/scripts/migrateToCredits.js --commit --company <id>
 *
 * TAKE A MONGODUMP BEFORE --commit. This touches the collection that holds
 * customers' paid balances.
 *
 * Safe to re-run: any subscription that already has a pricingVersion is
 * skipped, so an interrupted run can simply be run again.
 *
 * Mapping
 *   basic   -> byok/starter
 *   premium -> byok/growth
 *   custom  -> byok/self_hosted, allowance = its customised maxTestsAllowed
 *
 * Balance = (maxTestsAllowed - testsUsed) * legacyTestToCreditFactor,
 * clamped to [0, allowance].
 *
 * Two cases deliberately do NOT follow that formula:
 *   maxTestsAllowed === -1  "unlimited". Never silently converted to a finite
 *                           number — flagged needsManualReview for a human.
 *   maxTestsAllowed === 0   These companies could never run anything (the old
 *                           pre-save hook left basic/premium at 0), so they
 *                           are granted the full tier allowance rather than
 *                           migrated to a zero balance.
 */

require("dotenv").config();
const mongoose = require("mongoose");
const Subscription = require("../models/Subscription");
const CreditLedger = require("../models/CreditLedger");
const cm = require("../../src/config/pricing/creditMath");

const args = process.argv.slice(2);
const COMMIT = args.includes("--commit");
const companyFlagIndex = args.indexOf("--company");
const ONLY_COMPANY = companyFlagIndex !== -1 ? args[companyFlagIndex + 1] : null;

// A generous but finite allowance for former "unlimited" plans. It exists so
// the account is usable while a human decides the real number; the
// needsManualReview flag is what actually surfaces it.
const UNLIMITED_SENTINEL_CREDITS = 100000;

const PLAN_MAP = {
  basic: { planType: "byok", tierKey: "starter" },
  premium: { planType: "byok", tierKey: "growth" },
  custom: { planType: "byok", tierKey: "self_hosted" },
};

function planOf(sub) {
  // `plan` is the pre-migration field name; `legacyPlan` is where a partially
  // migrated document would have moved it.
  return sub.legacyPlan || sub.plan || sub.get?.("plan") || null;
}

function decide(sub) {
  const legacyPlan = planOf(sub);
  const mapping = PLAN_MAP[legacyPlan];

  if (!mapping) {
    return { skip: true, reason: `unrecognised legacy plan "${legacyPlan}"` };
  }

  const tier = cm.getTier(mapping.planType, mapping.tierKey);
  if (!tier) {
    return { skip: true, reason: `pricing config has no tier ${mapping.planType}/${mapping.tierKey}` };
  }

  const maxTests = sub.planDetails?.maxTestsAllowed ?? 0;
  const testsUsed = sub.planDetails?.testsUsed ?? 0;

  let allowance;
  let balance;
  let needsManualReview = false;
  let note;

  if (maxTests === -1) {
    allowance = UNLIMITED_SENTINEL_CREDITS;
    balance = UNLIMITED_SENTINEL_CREDITS;
    needsManualReview = true;
    note = "Legacy unlimited plan — granted a sentinel allowance, needs a human to set the real tier";
  } else if (maxTests === 0) {
    // Victims of the old pre-save hook: they were never able to run a test.
    allowance = tier.custom ? 0 : tier.credits;
    balance = allowance;
    needsManualReview = tier.custom;
    note = "Legacy plan had a 0 test limit (never usable) — granted the full tier allowance";
  } else {
    allowance = tier.custom ? maxTests : tier.credits;
    const remaining = Math.max(0, maxTests - testsUsed);
    balance = Math.round(remaining * cm.LEGACY_TEST_TO_CREDIT_FACTOR);
    balance = Math.max(0, Math.min(balance, allowance));
    note = `Converted ${remaining} remaining tests to ${balance} credits (factor ${cm.LEGACY_TEST_TO_CREDIT_FACTOR})`;
  }

  return {
    skip: false,
    legacyPlan,
    planType: mapping.planType,
    tierKey: mapping.tierKey,
    tier,
    allowance,
    balance,
    needsManualReview,
    note,
    before: { maxTests, testsUsed },
  };
}

function pad(value, width) {
  const s = String(value);
  return s.length >= width ? s.slice(0, width) : s + " ".repeat(width - s.length);
}

async function main() {
  if (!process.env.MONGODB_URL) {
    console.error("❌ MONGODB_URL is not set. Add it to your .env before running.");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URL);
  console.log(`\n✅ Connected to MongoDB`);
  console.log(`   Mode: ${COMMIT ? "\x1b[31mCOMMIT (writes will happen)\x1b[0m" : "DRY RUN (no writes)"}`);
  console.log(`   Pricing version: ${cm.PRICING_VERSION}`);
  if (ONLY_COMPANY) console.log(`   Restricted to company: ${ONLY_COMPANY}`);
  console.log("");

  const query = { pricingVersion: null };
  if (ONLY_COMPANY) query.companyId = ONLY_COMPANY;

  const subs = await Subscription.find(query);
  const alreadyMigrated = await Subscription.countDocuments({
    pricingVersion: { $ne: null },
  });

  console.log(`Found ${subs.length} unmigrated subscription(s). ${alreadyMigrated} already migrated.\n`);

  if (subs.length === 0) {
    console.log("Nothing to do.");
    await mongoose.disconnect();
    return;
  }

  console.log(
    pad("COMPANY", 26) +
      pad("LEGACY", 9) +
      pad("-> TIER", 22) +
      pad("TESTS", 12) +
      pad("ALLOWANCE", 11) +
      pad("BALANCE", 9) +
      "FLAG"
  );
  console.log("-".repeat(100));

  let migrated = 0;
  let skipped = 0;
  let flagged = 0;

  for (const sub of subs) {
    const d = decide(sub);

    if (d.skip) {
      skipped++;
      console.log(
        pad(String(sub.companyId), 26) + `\x1b[33mSKIP\x1b[0m — ${d.reason}`
      );
      continue;
    }

    console.log(
      pad(String(sub.companyId), 26) +
        pad(d.legacyPlan, 9) +
        pad(`${d.planType}/${d.tierKey}`, 22) +
        pad(`${d.before.testsUsed}/${d.before.maxTests}`, 12) +
        pad(d.allowance, 11) +
        pad(d.balance, 9) +
        (d.needsManualReview ? "\x1b[33mREVIEW\x1b[0m" : "")
    );

    if (d.needsManualReview) flagged++;

    if (!COMMIT) {
      migrated++;
      continue;
    }

    const now = new Date();
    const nextResetAt = new Date(now);
    nextResetAt.setMonth(nextResetAt.getMonth() + 1);

    await Subscription.updateOne(
      { _id: sub._id, pricingVersion: null }, // re-check: never migrate twice
      {
        $set: {
          planType: d.planType,
          tierKey: d.tierKey,
          legacyPlan: d.legacyPlan,
          pricingVersion: cm.PRICING_VERSION,
          priceUsdMonthly: d.tier.priceUsdMonthly,
          fxRateInrPerUsd: cm.FX_INR_PER_USD,
          concurrentSites: d.tier.concurrentSites || 1,
          engine: d.tier.engine || null,
          "credits.balance": d.balance,
          "credits.reserved": 0,
          "credits.monthlyAllowance": d.allowance,
          "credits.allowanceGrantedAt": now,
          "credits.nextResetAt": nextResetAt,
          "credits.rolloverPolicy": "none",
          "credits.overageEnabled": false,
          "credits.overageRateUsd": d.tier.extraCreditUsd || null,
          "credits.overageUsedThisPeriod": 0,
          "credits.lifetimeGranted": d.allowance,
          "credits.lifetimeCommitted": 0,
          "credits.needsManualReview": d.needsManualReview,
          // Keep the deprecated mirror consistent from the very first moment.
          "planDetails.maxTestsAllowed": d.allowance,
          "planDetails.testsUsed": Math.max(0, d.allowance - d.balance),
        },
        $unset: { plan: "" },
      }
    );

    await CreditLedger.create({
      companyId: sub.companyId,
      subscriptionId: sub._id,
      type: "migration",
      credits: d.balance,
      balanceAfter: d.balance,
      reservedAfter: 0,
      actorRole: "system",
      note:
        `${d.note}. Before: plan=${d.legacyPlan}, ` +
        `testsUsed=${d.before.testsUsed}/${d.before.maxTests}. ` +
        `After: ${d.planType}/${d.tierKey}, allowance=${d.allowance}.`,
    });

    migrated++;
  }

  console.log("-".repeat(100));
  console.log(
    `\n${COMMIT ? "Migrated" : "Would migrate"}: ${migrated}   Skipped: ${skipped}   Needs manual review: ${flagged}`
  );

  if (flagged > 0) {
    console.log(
      `\n\x1b[33m⚠️  ${flagged} subscription(s) flagged for review\x1b[0m — former "unlimited" or custom plans.\n` +
        `   They have a working balance but the tier is a guess. Set the real tier via the\n` +
        `   super-admin Subscription Management screen, then the flag clears on renewal.`
    );
  }

  if (!COMMIT) {
    console.log(
      `\nThis was a dry run. Re-run with \x1b[1m--commit\x1b[0m to apply.\n` +
        `Take a mongodump first — this writes to the collection holding paid balances.`
    );
  }

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("\n❌ Migration failed:", err);
  try {
    await mongoose.disconnect();
  } catch (_) {
    /* already disconnected */
  }
  process.exit(1);
});
