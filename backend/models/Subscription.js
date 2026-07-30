const mongoose = require("mongoose");

/**
 * Subscription — a company's plan and its credit balance.
 *
 * WHY THE BALANCE LIVES HERE and not in its own collection:
 * authController already attaches the active Subscription to the user payload
 * on both login and getUserDetails, so entitlement reaches the UI with no new
 * plumbing. It also means every balance mutation is a single-document
 * findOneAndUpdate, which gives us atomicity for free — see creditService.js.
 *
 * NEVER mutate credits.* with `doc.save()`. A save writes the whole document
 * from a snapshot that may already be stale, silently clobbering a concurrent
 * $inc. All mutations go through creditService.
 */

/**
 * Legacy plan -> test allowance. Retained ONLY so unmigrated subscriptions can
 * still be read (see creditService.getAccountSnapshot). New subscriptions are
 * priced from src/config/pricing/pricing.data.json.
 * @deprecated remove once every subscription has a pricingVersion.
 */
const PLAN_LIMITS = {
  basic: 10,
  premium: 100,
  custom: 0,
};

const subscriptionSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "company",
      required: true,
      index: true,
    },

    /* ---------------- Plan identity ---------------- */

    // "byok"    — customer supplies their own AI key; credits meter our capacity
    // "managed" — we supply the AI key and carry the token cost
    // "legacy"  — pre-credits subscription that has not been migrated yet
    planType: {
      type: String,
      enum: ["byok", "managed", "legacy"],
      default: "legacy",
      index: true,
    },

    // Tier key within the plan type, e.g. "starter" / "managed_pro".
    // Validated against pricing.data.json by the controller, not by an enum
    // here, so adding a tier is a config change rather than a migration.
    tierKey: { type: String, default: null },

    // Snapshots taken at activation. Editing pricing.data.json must never
    // silently re-price an existing customer, so we freeze what they bought.
    pricingVersion: { type: String, default: null, index: true },
    priceUsdMonthly: { type: Number, default: null },
    fxRateInrPerUsd: { type: Number, default: null },
    concurrentSites: { type: Number, default: 1 },
    engine: { type: String, default: null },

    /**
     * The old ["basic","premium","custom"] plan.
     * @deprecated read-only fallback during migration; dropped once every
     * subscription carries a pricingVersion.
     */
    legacyPlan: {
      type: String,
      enum: ["basic", "premium", "custom", null],
      default: null,
    },

    activatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    remainingDays: { type: Number },
    isActive: { type: Boolean, default: true, index: true },

    /* ---------------- Credits ---------------- */

    credits: {
      // AVAILABLE credits. Excludes anything currently reserved.
      balance: { type: Number, default: 0, min: 0 },

      // Held against in-flight runs: neither spendable nor yet spent.
      // Invariant (checked hourly by creditReconciler):
      //   credits.reserved === sum(credits of reservations with status "held")
      reserved: { type: Number, default: 0, min: 0 },

      monthlyAllowance: { type: Number, default: 0 },
      allowanceGrantedAt: { type: Date, default: null },
      nextResetAt: { type: Date, default: null, index: true },

      // "none"  — unused credits expire at reset (default)
      // "carry" — unused credits roll into the next period
      rolloverPolicy: { type: String, enum: ["none", "carry"], default: "none" },

      overageEnabled: { type: Boolean, default: false },
      overageRateUsd: { type: Number, default: null },
      overageUsedThisPeriod: { type: Number, default: 0 },

      lifetimeGranted: { type: Number, default: 0 },
      lifetimeCommitted: { type: Number, default: 0 },

      // Set by the migration when a legacy "unlimited" (-1) plan is converted.
      // Never auto-convert unlimited to a finite number without a human.
      needsManualReview: { type: Boolean, default: false },
    },

    /* ---------------- Deprecated derived mirrors ---------------- */

    /**
     * @deprecated Derived mirror of credits.* — written by creditService on
     * every mutation purely so the pre-credits dashboards and guards keep
     * rendering during rollout. NEVER read these for enforcement.
     * Remove once no client reads them (rollout phase 7).
     */
    planDetails: {
      maxTestsAllowed: { type: Number, default: 0 },
      testsUsed: { type: Number, default: 0 },
      lastTestDate: { type: Date },
    },
  },
  { timestamps: true }
);

/*
 * There was a pre("save") hook here that set planDetails.maxTestsAllowed from
 * PLAN_LIMITS. It declared `next` but never called it on any path, so under
 * Mongoose's callback-style middleware contract the save chain had no way to
 * advance. It is deliberately NOT replaced:
 *
 *   - Tier resolution now happens explicitly in subscriptionController via
 *     creditMath.getTier(), where it can be validated and reported on.
 *   - A hook that mutates the document would fight the atomic $inc updates
 *     creditService relies on.
 *
 * Do not add save middleware to this schema.
 */

subscriptionSchema.index({ companyId: 1, isActive: 1 });

module.exports = mongoose.model("Subscription", subscriptionSchema);
module.exports.PLAN_LIMITS = PLAN_LIMITS;
