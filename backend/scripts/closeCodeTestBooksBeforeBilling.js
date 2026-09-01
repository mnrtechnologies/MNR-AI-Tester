/**
 * One-time cutover for GitHub Code Testing billing.
 *
 * WHY THIS EXISTS
 *
 * code_runs was written by the Python engine for weeks before any billing
 * fields existed. The moment the reconciler starts, billFinishedRuns() matches
 * every one of those historical runs -- `billed` is absent, which UNBILLED
 * ({ $ne: true }) correctly treats as "not yet billed" -- and charges them all
 * on its first pass.
 *
 * Worse, those runs predate `facts` too, so priceCodeRun() sees no work at all
 * and prices each at BASE_SECONDS_PER_RUN alone. The customer would be billed
 * a flat rate for runs whose real cost we cannot reconstruct, for work done
 * before the meter existed and largely during development of the feature
 * itself.
 *
 * Billing starts from the cutover, not retroactively. This marks everything
 * that finished before the meter went live as settled at zero, leaving an
 * explicit skippedReason on each row so the decision is auditable rather than
 * invisible.
 *
 * SAFETY
 *
 *   - Dry by default. Pass --apply to write.
 *   - Only touches runs in a TERMINAL state that are NOT yet billed. An
 *     in-flight run is left alone: it is real work happening now, it will
 *     accrue facts, and it should be charged normally.
 *   - Idempotent. A second run matches nothing, because the first set
 *     billed: true.
 *
 * Usage, from MNR-AI-Tester/backend:
 *   node scripts/closeCodeTestBooksBeforeBilling.js           # preview
 *   node scripts/closeCodeTestBooksBeforeBilling.js --apply   # commit
 */

require("dotenv").config();
const mongoose = require("mongoose");

const CodeRun = require("../models/CodeRun");

const APPLY = process.argv.includes("--apply");
const TERMINAL = ["completed", "failed", "cancelled"];
const UNBILLED = { $ne: true };

async function main() {
  const uri = process.env.MONGODB_URL || process.env.MONGO_URI;
  if (!uri) throw new Error("MONGODB_URL is not set");
  await mongoose.connect(uri);
  console.log(`connected to ${mongoose.connection.name}`);

  const selector = { billed: UNBILLED, status: { $in: TERMINAL } };

  const affected = await CodeRun.find(selector)
    .select("runId status createdAt facts")
    .lean();

  console.log(`\n${affected.length} terminal run(s) predate billing:\n`);
  for (const r of affected) {
    const f = r.facts || {};
    console.log(
      `  ${String(r.runId).padEnd(40)} ${String(r.status).padEnd(10)} ` +
        `${r.createdAt ? new Date(r.createdAt).toISOString().slice(0, 16) : "unknown"}  ` +
        `facts=${f.freshFilesAnalysed === undefined ? "none" : JSON.stringify(f)}`,
    );
  }

  const inFlight = await CodeRun.countDocuments({
    billed: UNBILLED,
    status: { $in: ["queued", "running"] },
  });
  if (inFlight) {
    console.log(
      `\n${inFlight} in-flight run(s) deliberately LEFT ALONE — they will be metered and billed normally.`,
    );
  }

  if (!APPLY) {
    console.log("\nDRY RUN — nothing written. Re-run with --apply to commit.");
    await mongoose.disconnect();
    return;
  }

  const result = await CodeRun.updateMany(selector, {
    $set: {
      billed: true,
      billedAt: new Date(),
      chargedCredits: 0,
      meteredCredits: 0,
      claimToken: null,
      skippedReason: "pre_billing_cutover",
    },
  });

  console.log(`\nAPPLIED — ${result.modifiedCount} run(s) closed at zero credits.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("cutover failed:", err.message);
  process.exit(1);
});
