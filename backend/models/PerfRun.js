const mongoose = require("mongoose");

/**
 * Read model over the `perf_runs` collection that the Python performance
 * engine writes (MNR_AT_Performance_Testing/db.py). The collection name is
 * pinned explicitly — Mongoose would otherwise pluralise this to "perfruns"
 * and silently read an empty collection.
 *
 * Everything here except the billing bookkeeping is written by the engine and
 * is READ-ONLY from Express's point of view. The engine records facts
 * (engine_seconds, vu_seconds, peak_vus) and never a price; the credit
 * arithmetic lives in src/config/pricing/perfTestMath.js.
 */
const perfRunSchema = new mongoose.Schema(
  {
    run_id: { type: String, required: true, unique: true },
    user_id: { type: String, required: true },
    target_url: String,
    status: { type: String },        // queued | running | completed | failed | cancelled
    test_intent: String,             // browse | login | signup | mixed

    // Written by the engine at creation; Express derives a RUNNING run's
    // accrued cost from these two so the balance can tick down mid-run
    // instead of only at the end (see perfTestMath.liveFacts).
    created_at: Date,
    updated_at: Date,
    phase_results: { type: mongoose.Schema.Types.Mixed, default: {} },

    // Billing facts recorded by the engine.
    engine_seconds: { type: Number, default: 0 },  // wall-clock time the run held the engine
    vu_seconds: { type: Number, default: 0 },      // concurrent users x seconds held
    peak_vus: { type: Number, default: 0 },

    // Billing bookkeeping — the only fields Express writes.
    billed: { type: Boolean, default: false },
    // Credits already charged WHILE the run was in flight. The final
    // settlement charges only the remainder, so a long run that was metered
    // every few seconds still costs exactly what pricePerfRun says in total.
    meteredCredits: { type: Number, default: 0 },
    meteredAt: Date,
    claimToken: { type: String, default: null },
    claimedAt: Date,
    billedAt: Date,
    chargedCredits: Number,
    skippedReason: String,
  },
  { collection: "perf_runs", timestamps: false },
);

module.exports = mongoose.model("PerfRun", perfRunSchema);
