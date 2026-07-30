const mongoose = require("mongoose");

/**
 * CreditUsage — one row per model call the AI engine made.
 *
 * WRITTEN BY THE PYTHON ENGINE, READ AND BILLED BY EXPRESS. Both services sit
 * on the same `AI-Tester` database, so Express reads the engine's own numbers
 * first-hand instead of trusting a figure relayed through the browser. The
 * engine is unauthenticated and the browser talks to it directly, so anything
 * it told us about money over HTTP could be forged.
 *
 * The engine records tokens ONLY — it never computes cost or credits. Money
 * math lives in usageMath.js so rates can change without redeploying Python.
 *
 * Rows are written for EVERY plan. BYOK usage is not charged (those customers
 * pay their model provider directly) but it is still worth having for capacity
 * planning and for showing a customer what their own key spent.
 */

const creditUsageSchema = new mongoose.Schema(
  {
    // Written by Python as strings; Express resolves company from user_id.
    user_id: { type: String, required: true, index: true },
    session_id: { type: String, default: null },
    parent_session: { type: String, default: null, index: true },

    provider: { type: String, enum: ["openai", "anthropic"], required: true },
    model: { type: String, required: true },

    // What the agent was doing when this call happened — "decide_action",
    // "scan_elements", "write_stories". Drives the live feed and lets a
    // customer see which phase their credits went to.
    action: { type: String, default: null },
    phase: { type: String, default: null },
    page_url: { type: String, default: null },

    inputTokens: { type: Number, default: 0 },
    outputTokens: { type: Number, default: 0 },
    cacheReadTokens: { type: Number, default: 0 },
    cacheWriteTokens: { type: Number, default: 0 },

    /* ---------------- billing state (Express owns these) ---------------- */

    // false until the reconciler has accounted for this row.
    billed: { type: Boolean, default: false, index: true },

    // Claimed BEFORE the debit is applied, so a crash mid-billing cannot
    // double-charge: a claimed row is never picked up by a second pass, and a
    // claim with no matching ledger row can be found and re-driven.
    claimToken: { type: String, default: null, index: true },
    claimedAt: { type: Date, default: null },

    billedAt: { type: Date, default: null },
    chargedCredits: { type: Number, default: null },
    chargedUsd: { type: Number, default: null },

    // Set when this row was priced at a guessed or unconfirmed rate.
    rateUnverified: { type: Boolean, default: false },

    created_at: { type: Date, default: Date.now, index: true },
  },
  { collection: "credit_usage", timestamps: false }
);

// The reconciler's hot path: unbilled, unclaimed rows for a user.
creditUsageSchema.index({ billed: 1, claimToken: 1, user_id: 1 });
// Per-run breakdown for the usage endpoint.
creditUsageSchema.index({ parent_session: 1, created_at: 1 });

module.exports = mongoose.model("CreditUsage", creditUsageSchema, "credit_usage");
