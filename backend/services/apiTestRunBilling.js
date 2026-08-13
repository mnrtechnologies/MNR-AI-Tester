/**
 * apiTestRunBilling — turns finished API security scans into credit debits,
 * for BYOK plans only.
 *
 * This is the capacity meter, and the mirror image of usageBilling.js:
 *
 *   BYOK    → charged here, per run, on our server time  (pricing `meters`)
 *   Managed → charged by usageBilling, per token, on modelRates
 *
 * Exactly one meter bills any given run. A Managed run is skipped here and
 * picked up there; charging it on both would bill the same work twice, once as
 * capacity and once as cost. That split is declared in pricing.data.json
 * `meters` and is the same rule web testing follows.
 *
 * The Python engine writes `api_test_run` and stops. It never converts counts
 * to credits and never blocks a run — it is unauthenticated, so any gate it
 * enforced could be bypassed by posting to it directly. Enforcement is the
 * preflight check Express does before the run is ever started.
 */

const crypto = require("crypto");

const ApiTestRun = require("../models/ApiTestRun");
const User = require("../models/User");
const credits = require("./creditService");
const am = require("../../src/config/pricing/apiTestMath");

// What the engine writes when it has no user in context.
const UNATTRIBUTED = "unknown";

// A run is only billable once it has stopped. A "running" row is still
// accumulating counts, and charging it early would bill a partial test_count.
const TERMINAL = ["completed", "failed"];

// Bound one pass. A backlog drains over successive ticks rather than in one
// long transaction that could time out halfway.
const MAX_RUNS_PER_PASS = 200;

/**
 * Bill every finished, unbilled scan.
 *
 * The ordering is the correctness argument, and it is the same one usageBilling
 * makes: CLAIM, then read back, then debit, then mark billed. Claiming first
 * means a crash before the debit strands the row in a claimed-but-unbilled
 * state that is visible and re-drivable, and that no second pass can match.
 * Debiting first and marking after would double-charge on a crash, which is the
 * failure that actually costs a customer money.
 */
async function billFinishedRuns({ log = false } = {}) {
  const summary = {
    runsSeen: 0,
    charged: 0,
    credits: 0,
    skippedManaged: 0,
    skippedNoSub: 0,
    errors: [],
  };

  const pending = await ApiTestRun.find({
    billed: false,
    claimToken: null,
    status: { $in: TERMINAL },
    // A run with no recoverable owner is left unbilled and visible. Unlike web
    // testing there is no per-URL sheet to recover the owner from, so there is
    // nothing to guess with — and a stuck row is a bug report, whereas a wrong
    // charge is a refund.
    user_id: { $ne: UNATTRIBUTED },
  })
    .limit(MAX_RUNS_PER_PASS)
    .select("_id")
    .lean();

  for (const { _id } of pending) {
    summary.runsSeen++;
    try {
      const result = await billOneRun(_id);
      if (result.skipped === "managed") summary.skippedManaged++;
      else if (result.skipped) summary.skippedNoSub++;
      else if (result.credits > 0) {
        summary.charged++;
        summary.credits += result.credits;
        if (log) {
          console.log(
            `💳 API scan billed ${result.credits} credit(s) for run=${result.runId} ` +
              `(${result.tests} tests, ${result.apiCount} endpoints)`
          );
        }
      }
    } catch (err) {
      summary.errors.push({ id: String(_id), error: err.message });
      console.error(`⚠️ API run billing failed for ${_id}:`, err.message);
    }
  }

  return summary;
}

async function billOneRun(id) {
  const token = crypto.randomUUID();
  const now = new Date();

  // --- 1. Claim. Atomic: a concurrent pass cannot match this row again. ---
  const claimed = await ApiTestRun.findOneAndUpdate(
    { _id: id, billed: false, claimToken: null },
    { $set: { claimToken: token, claimedAt: now } },
    { returnDocument: "after" }
  ).lean();
  if (!claimed) return { credits: 0, skipped: "already_claimed" };

  const priced = am.priceApiRun(claimed);

  // --- 2. Resolve the payer, and decide whether this plan bills here. ---
  const user = await User.findById(claimed.user_id).select("companyId").lean();
  const subscription = user?.companyId
    ? await credits.getActiveSubscription(user.companyId)
    : null;

  if (!subscription || subscription.planType === "managed") {
    // Managed runs are billed on tokens by usageBilling; anything without a
    // subscription has nothing to charge against. Mark them billed either way
    // so they stop being rescanned on every tick.
    const reason = subscription ? "managed" : "no_subscription";
    await ApiTestRun.updateOne(
      { _id: id },
      {
        $set: {
          billed: true,
          billedAt: new Date(),
          chargedCredits: 0,
          skippedReason: reason,
        },
      }
    );
    return { credits: 0, skipped: reason, runId: claimed.run_id };
  }

  // --- 3. Debit once for the run. ---
  await credits.debitUsageCredits(subscription._id, priced.credits, {
    parentSession: claimed.run_id,
    note:
      `API security scan: ${priced.tests} tests across ${priced.apiCount} endpoints` +
      (claimed.status === "failed" ? " (run failed part-way)" : "") +
      (priced.oversized ? " — OVERSIZED, review this charge" : ""),
  });

  // --- 4. Mark billed. Safe to repeat; the row is already claimed. ---
  await ApiTestRun.updateOne(
    { _id: id },
    {
      $set: {
        billed: true,
        billedAt: new Date(),
        chargedCredits: priced.credits,
        skippedReason: null,
      },
    }
  );

  return {
    credits: priced.credits,
    tests: priced.tests,
    apiCount: priced.apiCount,
    runId: claimed.run_id,
  };
}

/**
 * Recover runs claimed by a pass that died before marking them billed.
 *
 * Without this they sit claimed forever and are never charged. A claim older
 * than the cutoff means no live pass owns it. Erring toward a delayed bill is
 * fine; erring toward re-billing is not, so the cutoff is generous.
 */
async function releaseStaleClaims(olderThanMinutes = 15) {
  const cutoff = new Date(Date.now() - olderThanMinutes * 60 * 1000);
  const result = await ApiTestRun.updateMany(
    { billed: false, claimToken: { $ne: null }, claimedAt: { $lt: cutoff } },
    { $set: { claimToken: null, claimedAt: null } }
  );
  if (result.modifiedCount) {
    console.log(`♻️  released ${result.modifiedCount} stale API-run claims`);
  }
  return result.modifiedCount;
}

/** What one scan cost and why — for the UI and for support. */
async function runSummary(runId, userId) {
  const doc = await ApiTestRun.findOne({
    run_id: runId,
    ...(userId ? { user_id: String(userId) } : {}),
  }).lean();
  if (!doc) return null;

  const priced = am.priceApiRun(doc);
  return {
    runId,
    status: doc.status,
    ...priced,
    settled: doc.billed === true,
    chargedCredits: doc.chargedCredits,
    skippedReason: doc.skippedReason,
  };
}

module.exports = {
  billFinishedRuns,
  releaseStaleClaims,
  runSummary,
};
