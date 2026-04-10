const mongoose = require("mongoose");

// Plan limits 
const PLAN_LIMITS = {
  basic: 10,
  premium: 100,
  enterprise: -1, // Use -1 to represent "Unlimited"
  custom: 0,      // Custom plans require manual assignment
};

const subscriptionSchema = new mongoose.Schema({
  plan: {
    type: String,
    enum: ["basic", "premium", "enterprise", "custom"],
    required: true,
  },
  status: {
    type: String,
    enum: ["active", "expired"],
    default: "active",
  },
  planActivatedDate: { type: Date }, // when paid plan started
  planExpireDate: { type: Date }, // when paid plan expires
  remainingDays: { type: Number }, // optional snapshot

  paymentProviderCustomerId: { type: String }, // razorpay customer ID

  // Plan Details for Usage Tracking ---
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
  }
});

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      lowercase: true,
    },

    mobile: {
      type: String,
      trim: true,
    },

    country: {
      type: String,
      trim: true,
      default: "",
    },

    state: {
      type: String,
      trim: true,
      default: "",
    },

    city: {
      type: String,
      trim: true,
      default: "",
    },

    password: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      enum: ["Admin", "User"],
      required: true,
    },

    token: {
      type: String,
    },

    lastActive: {
      type: Date,
      default: Date.now,
    },
    sessionId: {
      type: String,
    },

    resetPasswordExpires: {
      type: Date,
    },
    subscription: [subscriptionSchema],
  },
  { timestamps: true },
);

// Mongoose Hook: Automatically set maxTestsAllowed before saving
userSchema.pre("save", async function () {
  // Check if the user has any subscriptions
  if (this.subscription && this.subscription.length > 0) {
    this.subscription.forEach((sub) => {
      // Only auto-set if it's not a custom plan
      if (sub.isModified("plan") || sub.isNew) {
        
        // CRITICAL FIX: Ensure planDetails exists for older users in the database
        // who are logging in and don't have this object yet.
        if (!sub.planDetails) {
          sub.planDetails = { testsUsed: 0 };
        }

        if (sub.plan !== "custom" && PLAN_LIMITS[sub.plan] !== undefined) {
          sub.planDetails.maxTestsAllowed = PLAN_LIMITS[sub.plan];
        }
      }
    });
  }
});

module.exports = mongoose.model("user", userSchema);