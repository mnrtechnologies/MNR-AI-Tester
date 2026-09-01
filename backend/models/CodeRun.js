const mongoose = require("mongoose");

/**
 * Read model over the `code_runs` collection that the Python GitHub Code
 * Testing engine writes (MNR_AT_Code_Testing/db.py). The collection name is
 * pinned explicitly — Mongoose would otherwise pluralise this to "coderuns"
 * and silently read an empty collection.
 *
 * The engine writes camelCase (unlike the perf engine's snake_case), so the
 * field names here follow it rather than PerfRun's.
 *
 * Everything except the billing bookkeeping is written by the engine and is
 * READ-ONLY from Express's point of view. The engine records facts
 * (facts.freshFilesAnalysed, facts.freshTestsGenerated) and never a price; the
 * credit arithmetic lives in src/config/pricing/codeTestMath.js.
 */
const codeRunSchema = new mongoose.Schema(
  {
    runId: { type: String, required: true, unique: true },
    userId: { type: String, required: true },
    repoId: String,
    branch: String,
    commitSha: String,
    provider: String,                // openai | anthropic
    status: { type: String },        // queued | running | completed | failed | cancelled
    stage: String,                   // cloning | analyzing | generating | executing | reporting

    // Written by the engine on every stage transition and on every progress
    // tick, so Express can tell a busy run from an abandoned one (isAlive).
    createdAt: Date,
    updatedAt: Date,
    finishedAt: Date,

    /**
     * Billing facts recorded by the engine.
     *
     * These are FRESH counts — units that actually cost an LLM call on THIS
     * run, excluding anything served from the resume cache. A resumed run must
     * not be charged again for analysis the customer already paid for, and the
     * total file count cannot express that.
     *
     * engineSeconds is recorded for CALIBRATION ONLY and is deliberately not
     * billed: measured wall-clock is distorted by our own defects and by cache
     * reuse (see codeTestFormula._calibration).
     */
    facts: {
      freshFilesAnalysed: { type: Number, default: 0 },
      freshTestsGenerated: { type: Number, default: 0 },
      testsExecuted: { type: Number, default: 0 },
      engineSeconds: { type: Number, default: 0 },
    },

    // The engine's own LLM spend on the CUSTOMER'S key. Recorded for display
    // only — it is their provider bill, not ours, and must never be confused
    // with the credits charged below.
    costUsd: { type: Number, default: 0 },

    // Billing bookkeeping — the only fields Express writes.
    billed: { type: Boolean, default: false },
    // Credits already charged WHILE the run was in flight. The final
    // settlement charges only the remainder, so a long run metered repeatedly
    // still costs exactly what priceCodeRun says in total.
    meteredCredits: { type: Number, default: 0 },
    meteredAt: Date,
    claimToken: { type: String, default: null },
    claimedAt: Date,
    billedAt: Date,
    chargedCredits: Number,
    skippedReason: String,
  },
  { collection: "code_runs", timestamps: false },
);

module.exports = mongoose.model("CodeRun", codeRunSchema);
