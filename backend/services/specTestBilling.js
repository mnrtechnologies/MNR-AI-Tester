/**
 * specTestBilling — turns finished test-case design runs into credit debits,
 * for BYOK plans only (Managed plans are billed on measured tokens instead,
 * via usageBilling).
 *
 * Mirrors dbTestBilling.js and apiTestRunBilling.js exactly: same
 * claim-then-debit-then-mark discipline, and for the same reason — claiming
 * first means a crash before the debit leaves a visible, re-drivable row
 * rather than charging the customer twice.
 *
 * Failed runs are still billed. A run that died during design has already
 * spent the model calls it made, and the engine records counts at each
 * milestone precisely so we can charge for the work that actually happened.
 */

const crypto = require("crypto");

const SpecTestRun = require("../models/SpecTestRun");
const CreditReservation = require("../models/CreditReservation");
const User = require("../models/User");
const credits = require("./creditService");
const stm = require("./specTestMath");

const UNATTRIBUTED = "unknown";
const TERMINAL = ["completed", "failed"];
const MAX_RUNS_PER_PASS = 200;

async function billFinishedRuns({ log = false } = {}) {
  const summary = {
    runsSeen: 0,
    charged: 0,
    credits: 0,
    skippedManaged: 0,
    skippedNoSub: 0,
    errors: [],
  };

  const pending = await SpecTestRun.find({
    billed: false,
    claimToken: null,
    status: { $in: TERMINAL },
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
            `💳 Spec test billed ${result.credits} credit(s) for run=${result.runId} ` +
              `(${result.testCases} test cases)`,
          );
        }
      }
    } catch (err) {
      summary.errors.push({ id: String(_id), error: err.message });
      console.error(`⚠️ Spec-test billing failed for ${_id}:`, err.message);
    }
  }

  return summary;
}

async function billOneRun(id) {
  const token = crypto.randomUUID();
  const now = new Date();

  // --- 1. Claim ---
  const claimed = await SpecTestRun.findOneAndUpdate(
    { _id: id, billed: false, claimToken: null },
    { $set: { claimToken: token, claimedAt: now } },
    { returnDocument: "after" },
  ).lean();
  if (!claimed) return { credits: 0, skipped: "already_claimed" };

  const priced = stm.priceSpecTestRun(claimed);

  // Release the gate's hold FIRST, then charge what the run actually cost.
  //
  // The hold was an estimate made before the work; the debit below is measured
  // from real worker occupancy. Leaving the hold in place and debiting on top
  // would bill a BYOK customer twice for one run.
  //
  // settleReservation() with an empty `lines` array and force:true releases the
  // whole hold — their tested, idempotent path, so a browser and the reconciler
  // racing here cannot double-release.
  await releaseHold(claimed.run_id);

  // A run that produced nothing is closed out at zero rather than left
  // pending forever, so it stops being re-examined on every pass.
  if (priced.credits === 0) {
    await SpecTestRun.updateOne(
      { _id: id },
      {
        $set: {
          billed: true,
          billedAt: new Date(),
          chargedCredits: 0,
          skippedReason: "no_output",
        },
      },
    );
    return { credits: 0, skipped: "no_output", runId: claimed.run_id };
  }

  // --- 2. Resolve payer, decide if this plan bills here ---
  const user = await User.findById(claimed.user_id).select("companyId").lean();
  const subscription = user?.companyId
    ? await credits.getActiveSubscription(user.companyId)
    : null;

  if (!subscription || subscription.planType === "managed") {
    const reason = subscription ? "managed" : "no_subscription";
    await SpecTestRun.updateOne(
      { _id: id },
      {
        $set: {
          billed: true,
          billedAt: new Date(),
          chargedCredits: 0,
          skippedReason: reason,
        },
      },
    );
    return { credits: 0, skipped: reason, runId: claimed.run_id };
  }

  // --- 3. Debit ---
  await credits.debitUsageCredits(subscription._id, priced.credits, {
    parentSession: claimed.run_id,
    note:
      `Test case design: ${priced.requirements ?? "?"} requirements, ` +
      `${priced.testCases ?? 0} test cases from ${claimed.doc_filename || "a document"} ` +
      `(${priced.basis}${priced.seconds ? `, ${priced.seconds}s` : ""})` +
      (claimed.status === "failed" ? " (run failed partway)" : "") +
      (priced.oversized ? " — OVERSIZED, review this charge" : ""),
  });

  // --- 4. Mark billed ---
  await SpecTestRun.updateOne(
    { _id: id },
    {
      $set: {
        billed: true,
        billedAt: new Date(),
        chargedCredits: priced.credits,
        skippedReason: null,
      },
    },
  );

  return {
    credits: priced.credits,
    testCases: priced.testCases,
    runId: claimed.run_id,
  };
}

/**
 * Give back the credits the gate held for this run.
 *
 * Safe to call when there is no hold: enforcement may be off, or the run may
 * predate the gate. Never throws — a failure here must not stop the debit,
 * because the alternative is a run that is never billed at all.
 */
async function releaseHold(runId) {
  try {
    const reservation = await CreditReservation.findOne({
      idempotencyKey: `${runId}:spec`,
      status: "held",
    }).select("_id");
    if (!reservation) return;

    await credits.settleReservation(reservation._id, { force: true });
  } catch (err) {
    console.error(`⚠️ Could not release spec hold for ${runId}:`, err.message);
  }
}

async function releaseStaleClaims(olderThanMinutes = 15) {
  const cutoff = new Date(Date.now() - olderThanMinutes * 60 * 1000);
  const result = await SpecTestRun.updateMany(
    { billed: false, claimToken: { $ne: null }, claimedAt: { $lt: cutoff } },
    { $set: { claimToken: null, claimedAt: null } },
  );
  if (result.modifiedCount) {
    console.log(`♻️  released ${result.modifiedCount} stale spec-test claims`);
  }
  return result.modifiedCount;
}

async function runSummary(runId, userId) {
  const doc = await SpecTestRun.findOne({
    run_id: runId,
    ...(userId ? { user_id: String(userId) } : {}),
  }).lean();
  if (!doc) return null;

  const priced = stm.priceSpecTestRun(doc);
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
  releaseHold,
  releaseStaleClaims,
  runSummary,
};
