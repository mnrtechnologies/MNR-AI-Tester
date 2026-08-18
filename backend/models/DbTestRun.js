const mongoose = require("mongoose");

const dbTestRunSchema = new mongoose.Schema(
  {
    run_id: { type: String, required: true, unique: true },
    user_id: { type: String, required: true },
    job_type: { type: String, enum: ["diagnostic", "full_assessment"] },
    db_type: String,
    status: { type: String, enum: ["completed", "failed"] },
    durationMs: Number,
    testCasesGenerated: { type: Number, default: 0 },
    objectsScanned: { type: Number, default: 0 },
    billed: { type: Boolean, default: false },
    claimToken: { type: String, default: null },
    claimedAt: Date,
    billedAt: Date,
    chargedCredits: Number,
    skippedReason: String,
  },
  { timestamps: true },
);

module.exports = mongoose.model("DbTestRun", dbTestRunSchema);
