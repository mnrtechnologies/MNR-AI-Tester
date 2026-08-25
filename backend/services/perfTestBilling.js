/**
 * perfTestBilling — turns finished performance/load runs into credit debits,
 * for BYOK plans only (the Python engine holds no billing logic at all).
 *
 * Mirrors dbTestBilling.js and apiTestRunBilling.js exactly: same
 * claim-then-debit-then-mark discipline, same reasoning for why claiming
 * happens first (a crash before the debit leaves a visible, re-drivable row
 * rather than a double charge).
 *
 * Cancelled runs are billed like failed ones. A run cancelled after twenty
 * minutes of browser discovery consumed exactly as much of this platform as
 * one that finished — the customer stopped it, not us, and the engine already
 * recorded the seconds it actually used.
 */

const crypto = require("crypto");
const mongoose = require("mongoose");

const PerfRun = require("../models/PerfRun");
const User = require("../models/User");
const credits = require("./creditService");
const ptm = require("../../src/config/pricing/perfTestMath");

const UNATTRIBUTED = "unknown";

/**
 * The engine stores user_id as a free-form string, so a run can carry
 * something that is not an ObjectId at all — seeded/demo rows like
 * "cust_billing_demo" do. User.findById THROWS a CastError on those rather
 * than returning null, which aborts that run's billing pass and leaves it to
 * be retried, and fail, every 20 seconds forever. Treat an unusable id the
 * same as an unknown payer instead.
 */
async function payerFor(userId) {
  if (!userId || userId === UNATTRIBUTED || !mongoose.isValidObjectId(userId)) return null;
  const user = await User.findById(userId).select("companyId").lean();
  if (!user?.companyId) return null;
  return credits.getActiveSubscription(user.companyId);
}
const TERMINAL = ["completed", "failed", "cancelled"];
const IN_FLIGHT = ["queued", "running"];

// `billed: false` does NOT match a document where the field is absent, and
// the engine wrote perf_runs long before these billing fields existed — so
// every run predating them was invisible to the biller forever. Match "not
// yet billed" explicitly instead, which covers false, null and missing alike.
const UNBILLED = { $ne: true };

// A run only keeps accruing while it is demonstrably alive. The engine writes
// updated_at on every phase transition and on every soak chunk, and its
// longest legitimate gap between writes is SOAK_CHUNK_DURATION_SECONDS (900s,
// see limits.py), so silence for twice that means the run is not progressing
// — a worker was killed, the machine slept, the process died. Metering past
// that point would bill a customer for a run nothing is executing, all the
// way up to the 24h clamp in perfTestMath. Observed for real: an orphaned run
// sat at "running" for 59 minutes after its worker was killed.
const STALE_AFTER_MS =
  Number(process.env.PERF_METER_STALE_AFTER_MS) || 30 * 60 * 1000;
// Nothing is allowed to run longer than this (limits.MAX_TOTAL_RUN_DURATION_
// SECONDS), so a run still "in flight" past it is broken by definition.
const MAX_RUN_MS = 6 * 60 * 60 * 1000;

/** Is this run still plausibly executing, or has it been abandoned? */
function isAlive(run, nowMs) {
  const lastSeen = run.updated_at ? new Date(run.updated_at).getTime() : NaN;
  if (Number.isFinite(lastSeen) && nowMs - lastSeen > STALE_AFTER_MS) return false;
  const created = run.created_at ? new Date(run.created_at).getTime() : NaN;
  if (Number.isFinite(created) && nowMs - created > MAX_RUN_MS) return false;
  return true;
}
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

  const pending = await PerfRun.find({
    billed: UNBILLED,
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
        // Count what this pass actually MOVED, not the run total — most of a
        // metered run's cost was already debited while it was running, and
        // summing the total here would double-count it in the pass summary.
        summary.credits += result.remainder;
        if (log) {
          console.log(
            `💳 Perf test settled run=${result.runId}: ${result.credits} credit(s) total ` +
              `(${result.alreadyMetered} metered in flight, ${result.remainder} charged now) ` +
              `— ${result.engineSeconds}s engine, ${result.peakVus} peak VUs`,
          );
        }
      }
    } catch (err) {
      summary.errors.push({ id: String(_id), error: err.message });
      console.error(`⚠️ Perf-test billing failed for ${_id}:`, err.message);
    }
  }

  return summary;
}

async function billOneRun(id) {
  const token = crypto.randomUUID();
  const now = new Date();

  // --- 1. Claim ---
  const claimed = await PerfRun.findOneAndUpdate(
    { _id: id, billed: UNBILLED, claimToken: null },
    { $set: { claimToken: token, claimedAt: now } },
    { returnDocument: "after" },
  ).lean();
  if (!claimed) return { credits: 0, skipped: "already_claimed" };

  const priced = ptm.pricePerfRun(claimed);

  // --- 2. Resolve payer, decide if this plan bills here ---
  const subscription = await payerFor(claimed.user_id);

  if (!subscription || subscription.planType === "managed") {
    const reason = subscription ? "managed" : "no_subscription";
    await PerfRun.updateOne(
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

  // --- 3. Debit whatever the live meter did not already take ---
  // meterRunningRuns charges as the run proceeds; this is the true-up, so a
  // run costs pricePerfRun() in total no matter how it was split. The live
  // meter only ever under-states (see perfTestMath.liveFacts), so this is
  // normally >= 0 — clamped anyway rather than silently issuing a refund
  // through a path that has no refund semantics.
  const alreadyMetered = claimed.meteredCredits || 0;
  const remainder = Math.max(0, priced.credits - alreadyMetered);

  await credits.debitUsageCredits(subscription._id, remainder, {
    parentSession: claimed.run_id,
    note:
      `Performance test (${claimed.test_intent || "load"}, ` +
      `${claimed.engine_seconds || 0}s, peak ${claimed.peak_vus || 0} VUs)` +
      (claimed.status !== "completed" ? ` (${claimed.status})` : "") +
      (alreadyMetered ? ` — final ${remainder} of ${priced.credits}, ${alreadyMetered} metered in flight` : "") +
      (priced.oversized ? " — OVERSIZED, review this charge" : ""),
  });

  // --- 4. Mark billed ---
  await PerfRun.updateOne(
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
    remainder,
    alreadyMetered,
    engineSeconds: claimed.engine_seconds,
    peakVus: claimed.peak_vus,
    runId: claimed.run_id,
  };
}


/**
 * Charge in-flight runs for what they have consumed SO FAR.
 *
 * Why this exists: web/app testing hold credits up front through Express
 * (POST /api/credits/reserve-exploration), so the balance visibly drops the
 * moment a run starts. Perf runs cannot do that — the React page talks
 * straight to the Python engine (REACT_APP_PERF_TESTER_BACKEND_URL), so
 * Express never sees the start and has nothing to hold against. Metering from
 * this side gets the same outcome for the customer without re-routing the
 * engine's API through Express: the balance ticks down every pass instead of
 * standing still for the whole run and then jumping.
 *
 * Each pass charges only the DELTA between what the run has accrued and what
 * it has already been metered, so passes are naturally idempotent and the
 * total still lands exactly on pricePerfRun().
 */
async function meterRunningRuns({ log = false } = {}) {
  const summary = { runsSeen: 0, metered: 0, credits: 0, stale: 0, errors: [] };
  const now = Date.now();

  const inFlight = await PerfRun.find({
    billed: UNBILLED,
    status: { $in: IN_FLIGHT },
    user_id: { $ne: UNATTRIBUTED },
  })
    .limit(MAX_RUNS_PER_PASS)
    .lean();

  for (const run of inFlight) {
    summary.runsSeen++;
    try {
      const result = await meterOneRun(run, now);
      if (result.skipped === "stale") summary.stale++;
      if (result.credits > 0) {
        summary.metered++;
        summary.credits += result.credits;
        if (log) {
          console.log(
            `⏱️  Perf test metered ${result.credits} credit(s) mid-run for run=${run.run_id} ` +
              `(${result.engineSeconds}s so far, ${result.accrued} accrued total)`,
          );
        }
      }
    } catch (err) {
      summary.errors.push({ id: String(run._id), error: err.message });
      console.error(`⚠️ Perf-test metering failed for ${run.run_id}:`, err.message);
    }
  }

  return summary;
}

async function meterOneRun(run, nowMs = Date.now()) {
  // Never charge for a run nothing is actually executing. The final
  // settlement still handles it if it ever reaches a terminal state.
  if (!isAlive(run, nowMs)) return { credits: 0, skipped: "stale" };

  const already = run.meteredCredits || 0;
  const facts = ptm.liveFacts(run, nowMs);
  const accrued = ptm.creditsForRun({
    engineSeconds: facts.engineSeconds,
    vuSeconds: facts.vuSeconds,
  });
  const delta = accrued - already;
  if (delta <= 0) return { credits: 0 };

  const subscription = await payerFor(run.user_id);

  // Managed plans bill from measured tokens, not capacity — same rule the
  // final settlement applies. Leave meteredCredits at 0 so billOneRun still
  // takes its normal skip path when the run finishes.
  if (!subscription || subscription.planType === "managed") return { credits: 0, skipped: true };

  // Record the increment BEFORE spending it, and only if nobody else moved
  // the counter in the meantime. Two overlapping passes then cannot both
  // charge the same delta; the loser sees a changed meteredCredits and backs
  // off. Marking first means a crash here under-charges by one delta rather
  // than double-charging, which is the failure direction to prefer — the same
  // reasoning as claiming before debiting in billOneRun.
  // `{ meteredCredits: 0 }` would NOT match here: the engine writes these
  // documents and knows nothing about this field, so on the first pass it is
  // ABSENT, and Mongo does not treat an absent field as 0. Matching on null
  // as well covers absent and null alike — without it every first pass thinks
  // it lost the race, backs off, and the meter silently never charges
  // anything (confirmed exactly that on a real run).
  const expected = already === 0 ? { $in: [0, null] } : already;
  const claimed = await PerfRun.findOneAndUpdate(
    { _id: run._id, billed: UNBILLED, meteredCredits: expected },
    { $set: { meteredCredits: accrued, meteredAt: new Date() } },
  ).lean();
  if (!claimed) return { credits: 0, skipped: "raced" };

  await credits.debitUsageCredits(subscription._id, delta, {
    parentSession: run.run_id,
    note:
      `Performance test in progress (${run.test_intent || "load"}, ` +
      `${facts.engineSeconds}s so far, peak ${facts.peakVus} VUs)`,
  });

  return { credits: delta, accrued, engineSeconds: facts.engineSeconds, runId: run.run_id };
}

async function releaseStaleClaims(olderThanMinutes = 15) {
  const cutoff = new Date(Date.now() - olderThanMinutes * 60 * 1000);
  const result = await PerfRun.updateMany(
    { billed: UNBILLED, claimToken: { $ne: null }, claimedAt: { $lt: cutoff } },
    { $set: { claimToken: null, claimedAt: null } },
  );
  if (result.modifiedCount) {
    console.log(`♻️  released ${result.modifiedCount} stale perf-test claims`);
  }
  return result.modifiedCount;
}

module.exports = { billFinishedRuns, billOneRun, meterRunningRuns, meterOneRun, isAlive, releaseStaleClaims };
