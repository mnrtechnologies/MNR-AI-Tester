/**
 * mobileCreditBilling — turns finished mobile testing sessions into credit
 * debits.
 *
 * Unlike apiTestRunBilling (BYOK-only) and usageBilling (Managed-only),
 * mobile's creditMath already combines capacity + platform-usage into ONE
 * number per session (see mobileCreditMath.js), so every completed session
 * gets debited here regardless of plan type — there is no meter split to
 * skip. If a session stopped early (user hit Stop), testCasesGenerated only
 * reflects what actually happened, so the charge is naturally proportional
 * to the work done, not the full run.
 *
 * Same claim-before-debit discipline as apiTestRunBilling.js: claiming first
 * means a crash mid-billing strands the row visibly (claimed, unbilled) and
 * re-drivable, instead of risking a double charge.
 */

const crypto = require("crypto");

const MobileCreditUsage = require("../models/MobileCreditUsage");
const User = require("../models/User");
const credits = require("./creditService");
const mcm = require("../../src/config/pricing/mobileCreditMath");

const UNATTRIBUTED = "unknown";
const MAX_RUNS_PER_PASS = 200;

/**
 * Bill every completed, unbilled mobile session.
 */
async function billFinishedRuns({ log = false } = {}) {
  const summary = {
    runsSeen: 0,
    charged: 0,
    credits: 0,
    skippedNoSub: 0,
    errors: [],
  };

  const pending = await MobileCreditUsage.find({
    billed: false,
    claimToken: null,
    status: "completed",
    user_id: { $ne: UNATTRIBUTED },
  })
    .limit(MAX_RUNS_PER_PASS)
    .select("_id")
    .lean();

  for (const { _id } of pending) {
    summary.runsSeen++;
    try {
      const result = await billOneSession(_id);
      if (result.skipped) {
        summary.skippedNoSub++;
      } else if (result.credits > 0) {
        summary.charged++;
        summary.credits += result.credits;
        if (log) {
          console.log(
            `📱 Mobile session billed ${result.credits} credit(s) for session=${result.sessionId} ` +
              `(${result.testCasesGenerated} test cases)`
          );
        }
      }
    } catch (err) {
      summary.errors.push({ id: String(_id), error: err.message });
      console.error(`⚠️ Mobile credit billing failed for ${_id}:`, err.message);
    }
  }

  return summary;
}

async function billOneSession(id) {
  const token = crypto.randomUUID();
  const now = new Date();

  // --- 1. Claim. Atomic: a concurrent pass cannot match this row again. ---
  const claimed = await MobileCreditUsage.findOneAndUpdate(
    { _id: id, billed: false, claimToken: null },
    { $set: { claimToken: token, claimedAt: now } },
    { returnDocument: "after" }
  ).lean();
  if (!claimed) return { credits: 0, skipped: "already_claimed" };

  const priced = mcm.priceMobileRun(claimed);

  // --- 2. Resolve the payer. ---
  const user = await User.findById(claimed.user_id).select("companyId").lean();
  const subscription = user?.companyId
    ? await credits.getActiveSubscription(user.companyId)
    : null;

  if (!subscription) {
    await MobileCreditUsage.updateOne(
      { _id: id },
      {
        $set: {
          billed: true,
          billedAt: new Date(),
          chargedCredits: 0,
          skippedReason: "no_subscription",
        },
      }
    );
    return { credits: 0, skipped: "no_subscription", sessionId: claimed.session_id };
  }

  // --- 3. Debit. This alone triggers the existing company:room socket emit
  //         inside creditService.debitUsageCredits — no new socket code needed. ---
  await credits.debitUsageCredits(subscription._id, priced.totalCredits, {
    parentSession: claimed.parent_session || claimed.session_id,
    sessionId: claimed.session_id,
    note:
      `Mobile test run: ${priced.testCasesGenerated} test cases` +
      (priced.platformUsageCredits > 0 ? " (includes platform-key usage)" : "") +
      (claimed.status === "completed" && claimed.skippedReason === "force_completed_stale"
        ? " (session force-completed after inactivity)"
        : ""),
  });

  // --- 4. Mark billed. Safe to repeat; the row is already claimed. ---
  await MobileCreditUsage.updateOne(
    { _id: id },
    {
      $set: {
        billed: true,
        billedAt: new Date(),
        chargedCredits: priced.totalCredits,
        skippedReason: null,
      },
    }
  );

  return {
    credits: priced.totalCredits,
    testCasesGenerated: priced.testCasesGenerated,
    sessionId: claimed.session_id,
  };
}

/**
 * Recover sessions claimed by a pass that died before marking them billed.
 * Without this they sit claimed forever and are never charged.
 */
async function releaseStaleClaims(olderThanMinutes = 15) {
  const cutoff = new Date(Date.now() - olderThanMinutes * 60 * 1000);
  const result = await MobileCreditUsage.updateMany(
    { billed: false, claimToken: { $ne: null }, claimedAt: { $lt: cutoff } },
    { $set: { claimToken: null, claimedAt: null } }
  );
  if (result.modifiedCount) {
    console.log(`♻️  released ${result.modifiedCount} stale mobile-session claims`);
  }
  return result.modifiedCount;
}

/**
 * Force-complete sessions abandoned by a process that died before its
 * finally block ran (hard crash, OOM kill, pm2 restart without a clean
 * stop). Without this, such a session sits at status:"in_progress" forever
 * and is never billed for the partial work it actually did.
 *
 * Conservative on purpose — a session only qualifies after being untouched
 * for a while, so a slow-but-alive run is never force-closed mid-flight.
 * usageMeter.ts flushes every ~10s, so updated_at tracks real progress
 * closely; only the stuck *status* needs correcting here.
 */
async function forceCompleteStaleSessions(olderThanMinutes = 30) {
  const cutoff = new Date(Date.now() - olderThanMinutes * 60 * 1000);
  const result = await MobileCreditUsage.updateMany(
    { status: "in_progress", updated_at: { $lt: cutoff } },
    {
      $set: {
        status: "completed",
        updated_at: new Date(),
        skippedReason: "force_completed_stale",
      },
    }
  );
  if (result.modifiedCount) {
    console.log(`♻️  force-completed ${result.modifiedCount} stale mobile session(s)`);
  }
  return result.modifiedCount;
}

module.exports = {
  billFinishedRuns,
  releaseStaleClaims,
  forceCompleteStaleSessions,
};