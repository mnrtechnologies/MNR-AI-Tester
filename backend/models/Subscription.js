const mongoose = require("mongoose");

const PLAN_LIMITS = {
  basic: 10,
  premium: 100,
  custom: 0,
};

const subscriptionSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "company",
    required: true
  },
  plan: {
    type: String,
    enum: ["basic", "premium", "custom"],
    required: true,
  },
  activatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
  },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  remainingDays: { type: Number },
  planDetails: {
    maxTestsAllowed: {
      type: Number,
      required: true,
      default: 0, 
    },
    testsUsed: {
      type: Number,
      default: 0,
    },
    lastTestDate: {
      type: Date,
    },
  },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

/**
 * PRE-SAVE HOOK
 * Automatically sets the test limit based on the plan name.
 */
subscriptionSchema.pre("save", function (next) {
  // Only set the limit if the plan is new or has been modified
  if (this.isModified("plan")) {
    // If it's a custom plan, we don't overwrite it (allowing manual assignment)
    // Otherwise, we pull the limit from our PLAN_LIMITS constant
    if (this.plan !== "custom") {
      this.planDetails.maxTestsAllowed = PLAN_LIMITS[this.plan];
    }
  }
});

module.exports = mongoose.model("Subscription", subscriptionSchema);