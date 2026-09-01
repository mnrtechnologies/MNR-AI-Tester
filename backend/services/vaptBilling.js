/**
 * vaptBilling — turns finished security-testing runs into credit debits, for
 * BYOK plans (Managed plans are billed on measured tokens via usageBilling).
 *
 * Mirrors specTestBilling.js exactly: the same claim → release-hold → debit →
 * mark discipline, and for the same reason — claiming first means a crash before
 * the debit leaves a visible, re-drivable row rather than charging twice.
 *
 * Failed runs are still billed: a scan that died partway has already spent the
 * worker time it used, and the engine records duration at finish precisely so we
 * can charge for the work that actually happened.
 */

const crypto = require("crypto");

const VaptRun = require("../models/VaptRun");
const CreditReservation = require("../models/CreditReservation");
const User = require("../models/User");
const credits = require("./creditService");
const vtm = require("./vaptTestMath");

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

  const pending = await VaptRun.find({
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
            `💳 VAPT scan billed ${result.credits} credit(s) for run=${result.runId} ` +
              `(${result.seconds ?? "?"}s)`,
          );
        }
      }
    } catch (err) {
      summary.errors.push({ id: String(_id), error: err.message });
      console.error(`⚠️ VAPT billing failed for ${_id}:`, err.message);
    }
  }

  return summary;
}

async function billOneRun(id) {
  const token = crypto.randomUUID();
  const now = new Date();

  // --- 1. Claim ---
  const claimed = await VaptRun.findOneAndUpdate(
    { _id: id, billed: false, claimToken: null },
    { $set: { claimToken: token, claimedAt: now } },
    { returnDocument: "after" },
  ).lean();
  if (!claimed) return { credits: 0, skipped: "already_claimed" };

  const priced = vtm.priceVaptRun(claimed);

  // Release the gate's hold FIRST, then charge what the run actually cost.
  await releaseHold(claimed.run_id);

  // A run that consumed nothing is closed out at zero rather than re-examined
  // on every pass.
  if (priced.credits === 0) {
    await VaptRun.updateOne(
      { _id: id },
      { $set: { billed: true, billedAt: new Date(), chargedCredits: 0, skippedReason: "no_work" } },
    );
    return { credits: 0, skipped: "no_work", runId: claimed.run_id };
  }

  // --- 2. Resolve payer, decide if this plan bills here ---
  const user = await User.findById(claimed.user_id).select("companyId").lean();
  const subscription = user?.companyId
    ? await credits.getActiveSubscription(user.companyId)
    : null;

  if (!subscription || subscription.planType === "managed") {
    const reason = subscription ? "managed" : "no_subscription";
    await VaptRun.updateOne(
      { _id: id },
      { $set: { billed: true, billedAt: new Date(), chargedCredits: 0, skippedReason: reason } },
    );
    return { credits: 0, skipped: reason, runId: claimed.run_id };
  }

  // --- 3. Debit ---
  await credits.debitUsageCredits(subscription._id, priced.credits, {
    parentSession: claimed.run_id,
    note:
      `Security testing: ${priced.confirmed ?? 0} confirmed finding(s) ` +
      `on ${claimed.target_url || "a target"} ` +
      `(${priced.basis}${priced.seconds ? `, ${priced.seconds}s` : ""})` +
      (claimed.status === "failed" ? " (run failed partway)" : ""),
  });

  // --- 4. Mark billed ---
  await VaptRun.updateOne(
    { _id: id },
    { $set: { billed: true, billedAt: new Date(), chargedCredits: priced.credits, skippedReason: null } },
  );

  return { credits: priced.credits, seconds: priced.seconds, runId: claimed.run_id };
}

/** Give back the credits the gate held for this run. Never throws. */
async function releaseHold(runId) {
  try {
    const reservation = await CreditReservation.findOne({
      idempotencyKey: `${runId}:vapt`,
      status: "held",
    }).select("_id");
    if (!reservation) return;
    await credits.settleReservation(reservation._id, { force: true });
  } catch (err) {
    console.error(`⚠️ Could not release VAPT hold for ${runId}:`, err.message);
  }
}

async function releaseStaleClaims(olderThanMinutes = 15) {
  const cutoff = new Date(Date.now() - olderThanMinutes * 60 * 1000);
  const result = await VaptRun.updateMany(
    { billed: false, claimToken: { $ne: null }, claimedAt: { $lt: cutoff } },
    { $set: { claimToken: null, claimedAt: null } },
  );
  if (result.modifiedCount) {
    console.log(`♻️  released ${result.modifiedCount} stale VAPT claims`);
  }
  return result.modifiedCount;
}

module.exports = { billFinishedRuns, releaseHold, releaseStaleClaims };
