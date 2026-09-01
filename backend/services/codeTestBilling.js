/**
 * codeTestBilling — turns GitHub Code Testing runs into credit debits.
 *
 * Mirrors perfTestBilling.js deliberately: same claim-then-debit-then-mark
 * discipline, same reason for claiming first (a crash before the debit leaves a
 * visible, re-drivable row rather than a double charge), same live-meter plus
 * final true-up split.
 *
 * ONE RULE DIFFERS, on purpose. Every other capacity meter skips Managed plans
 * because Managed runs use OUR provider key and bill through modelRates
 * instead. Code Testing always runs on the customer's own key whatever plan
 * they hold — the run form requires it — so we never pay for its tokens and the
 * usage meter would have nothing to pass through. Billing capacity for both
 * plan families is `meters.byok = "capacity"` applied correctly here, not an
 * exception to it. A customer buys one plan and it covers this engine like
 * every other.
 *
 * Cancelled runs are billed like failed ones: a run cancelled after twenty
 * minutes of analysis consumed exactly as much of this platform as one that
 * finished. The customer stopped it, not us, and the engine already recorded
 * the work it actually did.
 */

const crypto = require("crypto");
const mongoose = require("mongoose");

const CodeRun = require("../models/CodeRun");
const User = require("../models/User");
const credits = require("./creditService");
const ctm = require("../../src/config/pricing/codeTestMath");

const UNATTRIBUTED = "unknown";

/**
 * The engine stores userId as a free-form string, so a run can carry something
 * that is not an ObjectId at all. User.findById THROWS a CastError on those
 * rather than returning null, which would abort the pass and leave the run to
 * fail again every 20 seconds forever. Treat an unusable id as an unknown
 * payer instead.
 */
async function payerFor(userId) {
  if (!userId || userId === UNATTRIBUTED || !mongoose.isValidObjectId(userId)) return null;
  const user = await User.findById(userId).select("companyId").lean();
  if (!user?.companyId) return null;
  return credits.getActiveSubscription(user.companyId);
}

const TERMINAL = ["completed", "failed", "cancelled"];
const IN_FLIGHT = ["queued", "running"];

// `billed: false` does NOT match a document where the field is absent, and the
// engine wrote code_runs long before these billing fields existed — so every
// run predating them would be invisible to the biller forever. Match "not yet
// billed" explicitly instead, covering false, null and missing alike.
const UNBILLED = { $ne: true };

// BILLING EPOCH — the moment this meter went live.
//
// code_runs existed for weeks before any billing field did. UNBILLED below
// correctly treats an absent `billed` as "not yet billed", which means the
// first reconciler pass would otherwise sweep up every historical run and
// charge it. Those runs also predate `facts`, so priceCodeRun() sees no work
// and prices each at BASE_SECONDS_PER_RUN — a flat charge for work done
// before the meter existed, most of it during development of this feature.
//
// Billing starts at the cutover, never retroactively. Enforcing that here
// rather than only in a one-time migration means it holds even if the
// migration is never run, is run late, or a forgotten pre-epoch run is
// resurrected by a status change. Deployments elsewhere can set their own
// epoch; the default is the date this shipped.
// Note the time, not just the date: development runs were still being made on
// the morning of the cutover day, and a midnight epoch would bill those too.
const BILLING_EPOCH = new Date(
  process.env.CODE_BILLING_EPOCH || "2026-08-31T11:20:00Z",
);

/** Did this run finish before the meter existed? Then it is never billable. */
function predatesBilling(run) {
  const created = run.createdAt ? new Date(run.createdAt).getTime() : NaN;
  // An undated run cannot be shown to be post-epoch, so treat it as pre-epoch:
  // the safe direction is to under-charge, never to invent a charge.
  if (!Number.isFinite(created)) return true;
  return created < BILLING_EPOCH.getTime();
}

// A run only keeps accruing while it is demonstrably alive. The engine writes
// updatedAt on every stage transition and every progress tick, and its longest
// legitimate silence is dependency installation (INSTALL_TIMEOUT_SECONDS, 900s)
// followed by test execution (TEST_TIMEOUT_SECONDS, 600s) — neither of which
// emits progress. 30 minutes clears both with headroom. Metering past that
// point would bill for a run nothing is executing; observed for real on this
// engine when a worker was killed mid-analysis and the run sat at "running".
const STALE_AFTER_MS =
  Number(process.env.CODE_METER_STALE_AFTER_MS) || 30 * 60 * 1000;
// Nothing here legitimately runs longer than this, so a run still in flight
// past it is broken by definition.
const MAX_RUN_MS = 6 * 60 * 60 * 1000;

/** Is this run still plausibly executing, or has it been abandoned? */
function isAlive(run, nowMs) {
  const lastSeen = run.updatedAt ? new Date(run.updatedAt).getTime() : NaN;
  if (Number.isFinite(lastSeen) && nowMs - lastSeen > STALE_AFTER_MS) return false;
  const created = run.createdAt ? new Date(run.createdAt).getTime() : NaN;
  if (Number.isFinite(created) && nowMs - created > MAX_RUN_MS) return false;
  return true;
}

const MAX_RUNS_PER_PASS = 200;

/** Human-readable note for the ledger line. */
function noteFor(run, priced, alreadyMetered, remainder) {
  const f = run.facts || {};
  let note =
    `Code testing (${f.freshFilesAnalysed || 0} file(s) analysed, ` +
    `${f.freshTestsGenerated || 0} test file(s) generated`;
  if (f.testsExecuted) note += `, ${f.testsExecuted} test(s) run`;
  note += ")";
  if (run.status !== "completed") note += ` (${run.status})`;
  if (alreadyMetered) {
    note += ` — final ${remainder} of ${priced.credits}, ${alreadyMetered} metered in flight`;
  }
  if (priced.oversized) note += " — OVERSIZED, review this charge";
  return note;
}

async function billOneRun(id) {
  const token = crypto.randomUUID();
  const now = new Date();

  // --- 1. Claim ---
  const claimed = await CodeRun.findOneAndUpdate(
    { _id: id, billed: UNBILLED, claimToken: null },
    { $set: { claimToken: token, claimedAt: now } },
    { returnDocument: "after" },
  ).lean();
  if (!claimed) return { credits: 0, skipped: "already_claimed" };

  // Close the books on anything from before the meter existed, at zero, with
  // an auditable reason -- rather than leaving it to match forever.
  if (predatesBilling(claimed)) {
    await CodeRun.updateOne(
      { _id: id },
      {
        $set: {
          billed: true,
          billedAt: new Date(),
          chargedCredits: 0,
          meteredCredits: 0,
          claimToken: null,
          skippedReason: "pre_billing_cutover",
        },
      },
    );
    return { credits: 0, skipped: "pre_billing_cutover", runId: claimed.runId };
  }

  const priced = ctm.priceCodeRun(claimed);

  // --- 2. Resolve payer ---
  // NOTE: no managed-plan skip here, unlike perfTestBilling — see the header.
  const subscription = await payerFor(claimed.userId);

  if (!subscription) {
    await CodeRun.updateOne(
      { _id: id },
      {
        $set: {
          billed: true,
          billedAt: new Date(),
          chargedCredits: 0,
          skippedReason: "no_subscription",
        },
      },
    );
    return { credits: 0, skipped: "no_subscription", runId: claimed.runId };
  }

  // --- 3. Debit whatever the live meter did not already take ---
  // meterRunningRuns charges as the run proceeds; this is the true-up, so a run
  // costs priceCodeRun() in total however it was split. The live meter only
  // ever under-states (facts only grow), so this is normally >= 0 — clamped
  // anyway rather than silently issuing a refund through a path that has no
  // refund semantics.
  const alreadyMetered = claimed.meteredCredits || 0;
  const remainder = Math.max(0, priced.credits - alreadyMetered);

  if (remainder > 0) {
    await credits.debitUsageCredits(subscription._id, remainder, {
      parentSession: claimed.runId,
      note: noteFor(claimed, priced, alreadyMetered, remainder),
    });
  }

  // --- 4. Mark billed ---
  await CodeRun.updateOne(
    { _id: id },
    {
      $set: {
        billed: true,
        billedAt: new Date(),
        chargedCredits: priced.credits,
        claimToken: null,
      },
    },
  );

  return {
    credits: priced.credits,
    remainder,
    alreadyMetered,
    runId: claimed.runId,
    files: (claimed.facts || {}).freshFilesAnalysed || 0,
  };
}

async function billFinishedRuns({ log = false } = {}) {
  const summary = {
    runsSeen: 0,
    charged: 0,
    credits: 0,
    skippedNoSub: 0,
    skippedPreEpoch: 0,
    errors: [],
  };

  const pending = await CodeRun.find({
    billed: UNBILLED,
    claimToken: null,
    status: { $in: TERMINAL },
    userId: { $ne: UNATTRIBUTED },
  })
    .limit(MAX_RUNS_PER_PASS)
    .select("_id")
    .lean();

  for (const { _id } of pending) {
    summary.runsSeen++;
    try {
      const result = await billOneRun(_id);
      if (result.skipped === "no_subscription") summary.skippedNoSub++;
      else if (result.skipped === "pre_billing_cutover") summary.skippedPreEpoch++;
      else if (result.credits > 0) {
        summary.charged++;
        // Count what this pass actually MOVED, not the run total — most of a
        // metered run's cost was already debited while it ran, and summing the
        // total here would double-count it in the pass summary.
        summary.credits += result.remainder;
        if (log) {
          console.log(
            `💳 Code test settled run=${result.runId}: ${result.credits} credit(s) total ` +
              `(${result.alreadyMetered} metered in flight, ${result.remainder} charged now) ` +
              `— ${result.files} file(s) analysed`,
          );
        }
      }
    } catch (err) {
      summary.errors.push({ id: String(_id), error: err.message });
      console.error(`⚠️ Code-test billing failed for ${_id}:`, err.message);
    }
  }

  return summary;
}

async function meterOneRun(run, nowMs = Date.now()) {
  // Never charge for a run nothing is actually executing. The final settlement
  // still handles it if it ever reaches a terminal state.
  if (!isAlive(run, nowMs)) return { credits: 0, skipped: "stale" };
  if (predatesBilling(run)) return { credits: 0, skipped: "pre_billing_cutover" };

  const already = run.meteredCredits || 0;
  const accrued = ctm.creditsAccruedSoFar(run);
  const delta = accrued - already;
  if (delta <= 0) return { credits: 0 };

  const subscription = await payerFor(run.userId);
  if (!subscription) return { credits: 0, skipped: true };

  // Record the increment BEFORE spending it, and only if nobody else moved the
  // counter meanwhile. Two overlapping passes then cannot both charge the same
  // delta; the loser sees a changed meteredCredits and backs off. Marking first
  // means a crash here under-charges by one delta rather than double-charging,
  // which is the failure direction to prefer — the same reasoning as claiming
  // before debiting in billOneRun.
  //
  // `{ meteredCredits: 0 }` would NOT match on the first pass: the engine
  // writes these documents and knows nothing about this field, so it is
  // ABSENT, and Mongo does not treat an absent field as 0. Matching null as
  // well covers absent and null alike — without it every first pass thinks it
  // lost the race, backs off, and the meter silently never charges anything
  // (confirmed exactly that on the perf engine).
  const expected = already === 0 ? { $in: [0, null] } : already;
  const claimed = await CodeRun.findOneAndUpdate(
    { _id: run._id, billed: UNBILLED, meteredCredits: expected },
    { $set: { meteredCredits: accrued, meteredAt: new Date() } },
  ).lean();
  if (!claimed) return { credits: 0, skipped: "raced" };

  const f = run.facts || {};
  await credits.debitUsageCredits(subscription._id, delta, {
    parentSession: run.runId,
    note:
      `Code testing in progress (${f.freshFilesAnalysed || 0} file(s) analysed, ` +
      `${f.freshTestsGenerated || 0} test file(s) generated so far)`,
  });

  return { credits: delta, accrued, runId: run.runId, files: f.freshFilesAnalysed || 0 };
}

async function meterRunningRuns({ log = false } = {}) {
  const summary = { runsSeen: 0, metered: 0, credits: 0, stale: 0, errors: [] };
  const now = Date.now();

  const inFlight = await CodeRun.find({
    billed: UNBILLED,
    status: { $in: IN_FLIGHT },
    userId: { $ne: UNATTRIBUTED },
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
            `⏱️  Code test metered ${result.credits} credit(s) mid-run for run=${result.runId} ` +
              `(${result.files} file(s) analysed, ${result.accrued} accrued total)`,
          );
        }
      }
    } catch (err) {
      summary.errors.push({ id: String(run._id), error: err.message });
      console.error(`⚠️ Code-test metering failed for ${run.runId}:`, err.message);
    }
  }

  return summary;
}

async function releaseStaleClaims(olderThanMinutes = 15) {
  const cutoff = new Date(Date.now() - olderThanMinutes * 60 * 1000);
  const result = await CodeRun.updateMany(
    { billed: UNBILLED, claimToken: { $ne: null }, claimedAt: { $lt: cutoff } },
    { $set: { claimToken: null, claimedAt: null } },
  );
  if (result.modifiedCount) {
    console.log(`♻️  released ${result.modifiedCount} stale code-test claims`);
  }
  return result.modifiedCount;
}

module.exports = {
  billFinishedRuns,
  billOneRun,
  meterRunningRuns,
  meterOneRun,
  isAlive,
  predatesBilling,
  BILLING_EPOCH,
  releaseStaleClaims,
};
