const CreditReservation = require("../models/CreditReservation");
const Subscription = require("../models/Subscription");
const credits = require("../services/creditService");
const usageBilling = require("../services/usageBilling");

/**
 * creditReconciler — the authoritative settler.
 *
 * The browser fires POST /api/credits/settle when a run finishes, but a
 * browser that is closed, crashed, or simply on a train never fires anything.
 * Worse, a dead Celery worker leaves user_excelsheet rows at "in_progress"
 * forever. Without this job those held credits are lost to the customer
 * permanently, which is the single worst failure mode in the whole system.
 *
 * Three responsibilities:
 *   1. Settle reservations whose TTL has passed (commit or release per URL) —
 *      the BYOK capacity meter.
 *   2. Bill recorded model usage — the Managed cost meter. This is the only
 *      thing that debits for measured tokens, so a stalled reconciler means
 *      Managed runs are free until it recovers.
 *   3. Verify the invariant  credits.reserved === sum(held reservations)
 *      and write a compensating ledger row when it drifts.
 */

const SWEEP_INTERVAL_MS = Number(process.env.CREDIT_RECONCILER_INTERVAL_MS) || 60 * 1000;
// Usage billing runs more often than settlement: it drives the balance a
// customer watches tick down mid-run, so a minute of lag is visible.
const BILLING_INTERVAL_MS = Number(process.env.CREDIT_BILLING_INTERVAL_MS) || 20 * 1000;
const INVARIANT_INTERVAL_MS = 60 * 60 * 1000;

let sweepTimer = null;
let invariantTimer = null;
let billingTimer = null;
let running = false;
let billing = false;

async function sweepExpiredReservations() {
  if (running) return; // never overlap sweeps
  running = true;
  try {
    const due = await CreditReservation.find({
      status: "held",
      expiresAt: { $lte: new Date() },
    })
      .select("_id parentSession credits")
      .limit(200);

    for (const reservation of due) {
      try {
        const result = await credits.settleReservation(reservation._id);
        if (result.settled) {
          console.log(
            `♻️  reconciler settled ${reservation.parentSession}: ` +
              `${result.status} (committed ${result.committed}, released ${result.released})`
          );
        }
      } catch (err) {
        console.error(`⚠️ reconciler failed on ${reservation._id}:`, err.message);
      }
    }
  } catch (err) {
    console.error("⚠️ credit reconciler sweep failed:", err.message);
  } finally {
    running = false;
  }
}

/**
 * Bill measured token usage (Managed plans).
 *
 * Deliberately separate from the reservation sweep and separately guarded: a
 * failure in one meter must not stop the other. BYOK settlement and Managed
 * billing are independent money paths.
 */
async function billMeteredUsage() {
  if (billing) return;
  billing = true;
  try {
    // Recover rows stranded by a pass that died mid-flight, before billing.
    await usageBilling.releaseStaleClaims();
    const result = await usageBilling.billUnbilledUsage({ log: true });
    if (result.errors.length) {
      console.warn(`⚠️ usage billing had ${result.errors.length} failures`);
    }
  } catch (err) {
    console.error("⚠️ usage billing pass failed:", err.message);
  } finally {
    billing = false;
  }
}

/**
 * Drift here means a hold or a settle half-applied — the money is real, so we
 * correct the subscription to match the reservations (which are the record of
 * intent) and leave an "adjust" row explaining why, rather than silently
 * rewriting a balance.
 */
async function verifyReservedInvariant() {
  try {
    const grouped = await CreditReservation.aggregate([
      { $match: { status: "held" } },
      { $group: { _id: "$subscriptionId", held: { $sum: "$credits" } } },
    ]);
    const heldBySub = new Map(grouped.map((g) => [String(g._id), g.held]));

    const subs = await Subscription.find({
      $or: [{ "credits.reserved": { $gt: 0 } }, { _id: { $in: grouped.map((g) => g._id) } }],
    }).select("_id companyId credits");

    for (const sub of subs) {
      const expected = heldBySub.get(String(sub._id)) || 0;
      const actual = sub.credits?.reserved || 0;
      if (expected === actual) continue;

      const delta = expected - actual;
      console.warn(
        `⚠️ reserved drift on subscription ${sub._id}: reserved=${actual}, held=${expected}`
      );

      await Subscription.updateOne(
        { _id: sub._id },
        { $set: { "credits.reserved": expected } }
      );

      // Reserved credits are not spendable, so correcting them downward hands
      // the difference back to the customer's available balance.
      if (delta < 0) {
        await Subscription.updateOne(
          { _id: sub._id },
          { $inc: { "credits.balance": -delta } }
        );
      }

      await credits.writeLedger({
        companyId: sub.companyId,
        subscriptionId: sub._id,
        type: "adjust",
        credits: -delta,
        note: `Reconciler corrected reserved drift: was ${actual}, held reservations total ${expected}`,
        actorRole: "system",
      });
    }
  } catch (err) {
    console.error("⚠️ reserved-invariant check failed:", err.message);
  }
}

function start() {
  if (process.env.CREDIT_JOBS_ENABLED === "false") {
    console.log("⏸️  credit reconciler disabled (CREDIT_JOBS_ENABLED=false)");
    return;
  }
  if (sweepTimer) return;

  sweepTimer = setInterval(sweepExpiredReservations, SWEEP_INTERVAL_MS);
  billingTimer = setInterval(billMeteredUsage, BILLING_INTERVAL_MS);
  invariantTimer = setInterval(verifyReservedInvariant, INVARIANT_INTERVAL_MS);
  if (sweepTimer.unref) sweepTimer.unref();
  if (billingTimer.unref) billingTimer.unref();
  if (invariantTimer.unref) invariantTimer.unref();

  console.log(
    `♻️  credit reconciler started (settle ${SWEEP_INTERVAL_MS / 1000}s, ` +
      `meter ${BILLING_INTERVAL_MS / 1000}s)`
  );
}

function stop() {
  if (sweepTimer) clearInterval(sweepTimer);
  if (billingTimer) clearInterval(billingTimer);
  if (invariantTimer) clearInterval(invariantTimer);
  sweepTimer = null;
  billingTimer = null;
  invariantTimer = null;
}

module.exports = {
  start,
  stop,
  sweepExpiredReservations,
  billMeteredUsage,
  verifyReservedInvariant,
};
