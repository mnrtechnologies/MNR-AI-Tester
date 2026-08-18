const mongoose = require("mongoose");

/**
 * MobileCreditUsage — mirrors the `mobile_credit_usage` collection the
 * mobile backend's usageMeter.ts writes to directly via the raw MongoDB
 * driver. Same DB, two writers with two different drivers — that's fine,
 * Mongo doesn't care. This model exists ONLY so Express (Mongoose) can
 * query and claim rows; Express does not create these documents.
 *
 * Ownership split, same convention as ApiTestRun.js:
 *   Mobile backend writes — testCasesGenerated, userKey.*, platformKey.*,
 *                            status, creditsUsedEstimate
 *   Express owns          — billed, claimToken, claimedAt, billedAt,
 *                            chargedCredits, skippedReason
 */
const mobileCreditUsageSchema = new mongoose.Schema(
  {
    session_id: { type: String, required: true, unique: true, index: true },
    user_id: { type: String, required: true, index: true },
    parent_session: { type: String, default: null },
    platform: { type: String, default: "mobile" },
    app_package: { type: String, default: null },

    testCasesGenerated: { type: Number, default: 0 },
    userKey: {
      calls: { type: Number, default: 0 },
      inputTokens: { type: Number, default: 0 },
      outputTokens: { type: Number, default: 0 },
    },
    platformKey: {
      calls: { type: Number, default: 0 },
      inputTokens: { type: Number, default: 0 },
      outputTokens: { type: Number, default: 0 },
      model: { type: String, default: null },
    },
    provider: { type: String, default: null },

    creditsUsedEstimate: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["in_progress", "completed"],
      default: "in_progress",
      index: true,
    },

    /* ---------------- billing state — Express owns these ---------------- */
    billed: { type: Boolean, default: false, index: true },
    // Claimed BEFORE the debit is applied, so a crash mid-billing strands the
    // row visibly instead of letting a second pass charge it again.
    claimToken: { type: String, default: null, index: true },
    claimedAt: { type: Date, default: null },
    billedAt: { type: Date, default: null },
    chargedCredits: { type: Number, default: null },
    // Why nothing was charged, or why the row was force-completed:
    // "no_subscription", "force_completed_stale".
    skippedReason: { type: String, default: null },

    created_at: { type: Date, default: Date.now, index: true },
    updated_at: { type: Date, default: Date.now },
  },
  { collection: "mobile_credit_usage", timestamps: false }
);

// The reconciler's hot path: completed sessions that haven't been billed.
mobileCreditUsageSchema.index({ billed: 1, claimToken: 1, status: 1 });
// The stale-sweep's hot path: in-progress sessions untouched for a while.
mobileCreditUsageSchema.index({ status: 1, updated_at: 1 });

module.exports = mongoose.model(
  "MobileCreditUsage",
  mobileCreditUsageSchema,
  "mobile_credit_usage"
);