const mongoose = require("mongoose");

/**
 * VaptRun — one document per security-testing (VAPT) run.
 *
 * WRITTEN BY THE PYTHON VAPT ENGINE, READ AND BILLED BY EXPRESS. The engine
 * (Security-Testing/webservice/db.py) upserts this as the scan progresses; it
 * records raw counts + worker duration and never prices them. This is the VAPT
 * analogue of SpecTestRun — same shared `AI-Tester` database, same
 * authorize-then-settle discipline.
 *
 * Like the spec and API engines it is BYOK-metered on worker seconds: the
 * customer brings their own OpenAI/Anthropic key, so charging per token would
 * bill them twice. `duration_ms` is the pricing input.
 */

const vaptRunSchema = new mongoose.Schema(
  {
    run_id: { type: String, required: true, unique: true, index: true },

    // Written by Python as a string; Express resolves company from it.
    user_id: { type: String, required: true, index: true },

    source: { type: String, default: "security_testing", index: true },

    target_url: { type: String, default: null },

    /* ------------------- the numbers recorded for the ledger ------------- */
    confirmed_findings: { type: Number, default: null },
    total_findings: { type: Number, default: null },
    critical: { type: Number, default: null },
    high: { type: Number, default: null },
    medium: { type: Number, default: null },
    low: { type: Number, default: null },

    /* ---------------- the pricing input (worker occupancy) --------------- */
    // The BYOK meter: how long the scan held a worker. Recorded by the engine
    // when the run finishes; the reconciler prices from it.
    duration_ms: { type: Number, default: null },
    steps: { type: Number, default: null },

    status: {
      type: String,
      enum: ["queued", "running", "completed", "failed"],
      default: "queued",
      index: true,
    },
    error: { type: String, default: null },

    /* ------------------- delivery state --------------------------------- */
    s3_key: { type: String, default: null },
    s3_download_url: { type: String, default: null },
    document_deleted: { type: Boolean, default: false },
    downloaded_at: { type: String, default: null },

    /* ---------------- authorization (Express owns these) ----------------- */
    // The gate. Express sets these when it has held credits; the engine reads
    // `authorized` before running. Must stay declared — mongoose strict mode
    // silently drops unknown fields, which would make authorize report success
    // while writing nothing.
    authorized: { type: Boolean, default: false, index: true },
    authorized_credits: { type: Number, default: null },
    authorized_at: { type: Date, default: null },
    authorization_id: { type: mongoose.Schema.Types.ObjectId, default: null },

    /* ---------------- billing state (Express owns these) ---------------- */
    billed: { type: Boolean, default: false, index: true },
    claimToken: { type: String, default: null, index: true },
    claimedAt: { type: Date, default: null },
    billedAt: { type: Date, default: null },
    chargedCredits: { type: Number, default: null },
    skippedReason: { type: String, default: null },

    created_at: { type: String, default: null },
    finished_at: { type: String, default: null },
  },
  { collection: "vapt_run", timestamps: false }
);

// The reconciler's hot path: terminal runs not yet billed.
vaptRunSchema.index({ billed: 1, claimToken: 1, status: 1 });

module.exports = mongoose.model("VaptRun", vaptRunSchema, "vapt_run");
