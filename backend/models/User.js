const mongoose = require("mongoose");

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
      enum: ["super_admin", "company_admin", "staff"],
      required: true,
    },

    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "company",
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

  },
  { timestamps: true },
);

module.exports = mongoose.model("user", userSchema);