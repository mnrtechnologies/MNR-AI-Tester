const mongoose = require("mongoose");

/**
 * ApiTestRun — one document per API security scan.
 *
 * WRITTEN BY THE PYTHON API-TESTING ENGINE, READ AND BILLED BY EXPRESS. The
 * engine (API_Testing/db.py::record_run_facts) upserts this at each pipeline
 * milestone; it records raw counts and never prices them. This is the
 * API-testing analogue of `story_count` on `user_excelsheet`.
 *
 * Both services sit on the same `AI-Tester` database, so Express reads the
 * engine's own numbers first-hand rather than trusting a figure relayed through
 * the browser — the engine is unauthenticated and the browser posts to it
 * directly, so anything it asserted over HTTP could be forged. `user_id` is
 * likewise asserted by the caller, not verified, which is exactly why the gate
 * that decides whether a run may start lives in Express and not in the engine.
 *
 * Milestones are written as the run progresses rather than once at the end: a
 * run that dies in Phase 3 still burned the discovery and generation work, and
 * we need the counts to charge for what actually happened.
 */

const apiTestRunSchema = new mongoose.Schema(
  {
    run_id: { type: String, required: true, unique: true, index: true },

    // Written by Python as a string; Express resolves company from it.
    // "unknown" when the run was started without a user in context.
    user_id: { type: String, required: true, index: true },
    target_url: { type: String, default: null },

    // Marks which engine produced the row, so a future second writer to this
    // collection cannot be billed by the wrong meter.
    source: { type: String, default: "api_testing", index: true },

    /* ------------------- the two integers we price from ------------------ */

    // Unique endpoints discovered in Phase 1. Recorded for the ledger note and
    // for support; the charge is driven by test_count. See apiTestMath.js.
    api_count: { type: Number, default: null },
    // Test cases generated in Phase 2 — the cost driver, because Phase 3
    // replays every one of them against the target on a fixed delay.
    test_count: { type: Number, default: null },

    status: {
      type: String,
      enum: ["queued", "running", "completed", "failed"],
      default: "queued",
      index: true,
    },
    phase: { type: Number, default: 0 },
    error: { type: String, default: null },

    /* ---------------- billing state (Express owns these) ---------------- */

    billed: { type: Boolean, default: false, index: true },

    // Claimed BEFORE the debit is applied, so a crash mid-billing strands the
    // row visibly instead of letting a second pass charge it again.
    claimToken: { type: String, default: null, index: true },
    claimedAt: { type: Date, default: null },

    billedAt: { type: Date, default: null },
    chargedCredits: { type: Number, default: null },
    // Why nothing was charged, when nothing was: "managed" (billed on tokens
    // instead), "no_subscription", "unattributed".
    skippedReason: { type: String, default: null },

    created_at: { type: Date, default: Date.now, index: true },
    updated_at: { type: Date, default: Date.now },
    completed_at: { type: Date, default: null },
  },
  { collection: "api_test_run", timestamps: false }
);

// The reconciler's hot path: terminal runs that have not been billed yet.
apiTestRunSchema.index({ billed: 1, claimToken: 1, status: 1 });

module.exports = mongoose.model("ApiTestRun", apiTestRunSchema, "api_test_run");
