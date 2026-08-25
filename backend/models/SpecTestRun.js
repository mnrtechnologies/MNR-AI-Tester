const mongoose = require("mongoose");

/**
 * SpecTestRun — one document per test-case design run.
 *
 * WRITTEN BY THE PYTHON SPEC-TESTING ENGINE, READ AND BILLED BY EXPRESS. The
 * engine (MNR_AI_Tester-AI_Backend-Spec_Testing/utils/db.py) upserts this at
 * each pipeline milestone; it records raw counts and never prices them. This is
 * the spec-testing analogue of `test_count` on ApiTestRun and `story_count` on
 * `user_excelsheet`.
 *
 * Both services sit on the same `AI-Tester` database, so Express reads the
 * engine's own numbers first-hand rather than trusting a figure relayed through
 * the browser — the engine is unauthenticated and the browser posts to it
 * directly, so anything it asserted over HTTP could be forged. `user_id` is
 * likewise asserted by the caller, not verified, which is exactly why the gate
 * that decides whether a run may start lives in Express and not in the engine.
 *
 * Unlike the web and API engines there is no target application here: the input
 * is a requirements document for a site that has not been built yet, so there
 * are no URLs to reserve capacity against. Counts are reported once the design
 * pass is over and billed by the reconciler.
 */

const specTestRunSchema = new mongoose.Schema(
  {
    run_id: { type: String, required: true, unique: true, index: true },

    // Written by Python as a string; Express resolves company from it.
    // "unknown" when the run was started without a user in context.
    user_id: { type: String, required: true, index: true },

    // Marks which engine produced the row, so a future second writer to this
    // collection cannot be billed by the wrong meter.
    source: { type: String, default: "spec_testing", index: true },

    // The uploaded requirements document this run was generated from.
    doc_id: { type: String, default: null },
    doc_filename: { type: String, default: null },
    depth: { type: String, default: "standard" },

    /* ------------------- the integers we price from ---------------------- */

    // Requirements extracted from the document. Recorded for the ledger note
    // and for support; the charge is driven by test_cases_generated.
    requirements_found: { type: Number, default: null },

    // The cost driver: one model call per requirement produces these, and they
    // are the deliverable the customer receives.
    test_cases_generated: { type: Number, default: null },

    // Gaps found in the requirements document. Never charged — it is a quality
    // signal, and charging for it would discourage reporting it.
    open_questions: { type: Number, default: null },

    /* ---------------- calibration inputs (written by Python) ------------- */

    // BYOK plans are metered on how long a run occupies a worker, and that rate
    // differs by model — so the rate must be MEASURED per model rather than
    // modelled once. These fields are what the aggregation in
    // scripts/calibrate_rates.py derives SECONDS_PER_REQUIREMENT from.
    //
    // `model` is the model that ACTUALLY ran, taken from the engine's own call
    // tally: a run that rate-limits on OpenAI and completes on Anthropic must
    // be priced as Anthropic, not as what the customer's keys implied.
    model: { type: String, default: null, index: true },
    model_calls: { type: Object, default: null },

    document_chars: { type: Number, default: null },
    parse_duration_ms: { type: Number, default: null },
    // The phase that scales with requirement count; the pricing input.
    design_duration_ms: { type: Number, default: null },
    seconds_per_requirement: { type: Number, default: null },
    total_duration_ms: { type: Number, default: null },

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
    // Set once the document has been delivered to the customer and removed
    // from S3. Deletion happens only after the bytes are sent.
    document_deleted: { type: Boolean, default: false },
    downloaded_at: { type: String, default: null },

    /* ---------------- authorization (Express owns these) ----------------- */

    // The gate. Express sets these when it has held credits for the run, and
    // the ENGINE READS THEM before starting the expensive design phase — it is
    // unauthenticated and the browser posts to it directly, so the decision
    // cannot travel in the request. It has to come through the database, where
    // only Express can have written it.
    //
    // These must stay declared here: mongoose runs strict by default and
    // SILENTLY DROPS unknown fields from an update, so an undeclared flag would
    // make authorize-spec-run report success while writing nothing, and every
    // generate call would be refused with 402.
    authorized: { type: Boolean, default: false, index: true },
    authorized_credits: { type: Number, default: null },
    authorized_at: { type: Date, default: null },
    authorization_id: { type: mongoose.Schema.Types.ObjectId, default: null },

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

    created_at: { type: String, default: null },
    finished_at: { type: String, default: null },
  },
  { collection: "spec_test_run", timestamps: false }
);

// The reconciler's hot path: terminal runs that have not been billed yet.
specTestRunSchema.index({ billed: 1, claimToken: 1, status: 1 });

module.exports = mongoose.model("SpecTestRun", specTestRunSchema, "spec_test_run");
