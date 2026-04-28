const mongoose = require("mongoose");

const companySchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true }, // for sending subscription emails
  address: { type: String },

  subscriptionStatus: {
    type: String,
    enum: ["active", "expired", "none"],
    default: "none",
  },

  activeSubscriptionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Subscription",
  },

  staff: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
    }
  ],

  admins: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
    }
  ],

}, { timestamps: true });

module.exports = mongoose.models.company || mongoose.model("company", companySchema);
