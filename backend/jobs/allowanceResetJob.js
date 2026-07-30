const Subscription = require("../models/Subscription");
const credits = require("../services/creditService");

/**
 * allowanceResetJob — starts each subscription's new billing period.
 *
 * The old model never reset anything: testsUsed only ever went up, so a
 * "100 tests / month" plan was really "100 tests, ever". Credits reset on a
 * monthly cadence, per subscription, from its own nextResetAt.
 *
 * rolloverPolicy:
 *   "none"  — balance is replaced by the allowance (unused credits expire)
 *   "carry" — allowance is added to whatever is left
 *
 * Reserved credits are deliberately untouched: they belong to a run that is
 * still in flight and are settled by the reconciler, not by the calendar.
 */

const CHECK_INTERVAL_MS = Number(process.env.ALLOWANCE_RESET_INTERVAL_MS) || 60 * 60 * 1000;

let timer = null;
let running = false;

function addOneMonth(from) {
  const d = new Date(from);
  const day = d.getDate();
  d.setMonth(d.getMonth() + 1);
  // Guard the 31st-of-a-30-day-month rollover: setMonth would skip a month.
  if (d.getDate() < day) d.setDate(0);
  return d;
}

async function runResets() {
  if (running) return;
  running = true;
  try {
    const due = await Subscription.find({
      isActive: true,
      "credits.nextResetAt": { $ne: null, $lte: new Date() },
    }).limit(500);

    for (const sub of due) {
      try {
        const allowance = sub.credits.monthlyAllowance || 0;
        const rollover = sub.credits.rolloverPolicy === "carry";

        // Keep advancing until the next reset is genuinely in the future, so
        // a server that was down for two months does not grant twice.
        let next = addOneMonth(sub.credits.nextResetAt);
        while (next <= new Date()) next = addOneMonth(next);

        await credits.grantAllowance(sub._id, allowance, {
          mode: rollover ? "add" : "set",
          type: "reset",
          nextResetAt: next,
          actorRole: "system",
          note: `Billing period reset (${rollover ? "carried over" : "unused credits expired"})`,
        });

        console.log(
          `🔄 reset allowance for subscription ${sub._id}: ${allowance} credits, next ${next.toISOString()}`
        );
      } catch (err) {
        console.error(`⚠️ allowance reset failed for ${sub._id}:`, err.message);
      }
    }
  } catch (err) {
    console.error("⚠️ allowance reset sweep failed:", err.message);
  } finally {
    running = false;
  }
}

function start() {
  if (process.env.CREDIT_JOBS_ENABLED === "false") {
    console.log("⏸️  allowance reset job disabled (CREDIT_JOBS_ENABLED=false)");
    return;
  }
  if (timer) return;

  timer = setInterval(runResets, CHECK_INTERVAL_MS);
  if (timer.unref) timer.unref();
  console.log(`🔄 allowance reset job started (every ${CHECK_INTERVAL_MS / 60000} min)`);
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = { start, stop, runResets, addOneMonth };
