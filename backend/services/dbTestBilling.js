/**
 * dbTestBilling — turns finished database diagnostic/assessment jobs into
 * credit debits, for BYOK plans only (Go server holds no AI/DB keys).
 *
 * Mirrors apiTestRunBilling.js exactly: same claim-then-debit-then-mark
 * discipline, same reasoning for why claiming happens first (a crash before
 * the debit leaves a visible, re-drivable row rather than a double charge).
 */

const crypto = require("crypto");

const DbTestRun = require("../models/DbTestRun");
const User = require("../models/User");
const credits = require("./creditService");
const dtm = require("./dbTestMath");

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

  const pending = await DbTestRun.find({
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
            `💳 DB test billed ${result.credits} credit(s) for run=${result.runId} ` +
              `(${result.jobType}, ${result.dbType})`,
          );
        }
      }
    } catch (err) {
      summary.errors.push({ id: String(_id), error: err.message });
      console.error(`⚠️ DB-test billing failed for ${_id}:`, err.message);
    }
  }

  return summary;
}

async function billOneRun(id) {
  const token = crypto.randomUUID();
  const now = new Date();

  // --- 1. Claim ---
  const claimed = await DbTestRun.findOneAndUpdate(
    { _id: id, billed: false, claimToken: null },
    { $set: { claimToken: token, claimedAt: now } },
    { returnDocument: "after" },
  ).lean();
  if (!claimed) return { credits: 0, skipped: "already_claimed" };

  const priced = dtm.priceDbTestRun(claimed);

  // --- 2. Resolve payer, decide if this plan bills here ---
  const user = await User.findById(claimed.user_id).select("companyId").lean();
  const subscription = user?.companyId
    ? await credits.getActiveSubscription(user.companyId)
    : null;

  if (!subscription || subscription.planType === "managed") {
    const reason = subscription ? "managed" : "no_subscription";
    await DbTestRun.updateOne(
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
      `DB test (${claimed.job_type}, ${claimed.db_type})` +
      (claimed.status === "failed" ? " (job failed)" : "") +
      (priced.oversized ? " — OVERSIZED, review this charge" : ""),
  });

  // --- 4. Mark billed ---
  await DbTestRun.updateOne(
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
    jobType: claimed.job_type,
    dbType: claimed.db_type,
    runId: claimed.run_id,
  };
}

async function releaseStaleClaims(olderThanMinutes = 15) {
  const cutoff = new Date(Date.now() - olderThanMinutes * 60 * 1000);
  const result = await DbTestRun.updateMany(
    { billed: false, claimToken: { $ne: null }, claimedAt: { $lt: cutoff } },
    { $set: { claimToken: null, claimedAt: null } },
  );
  if (result.modifiedCount) {
    console.log(`♻️  released ${result.modifiedCount} stale DB-test claims`);
  }
  return result.modifiedCount;
}

async function runSummary(runId, userId) {
  const doc = await DbTestRun.findOne({
    run_id: runId,
    ...(userId ? { user_id: String(userId) } : {}),
  }).lean();
  if (!doc) return null;

  const priced = dtm.priceDbTestRun(doc);
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
