const mongoose = require("mongoose");

/**
 * CreditLedger — append-only audit trail for every credit movement.
 *
 * NEVER update or delete a row here. If something was wrong, write a
 * compensating "adjust" row. This collection is the evidence a support agent
 * uses to adjudicate a refund, and the source for the super-admin margin view.
 *
 * It is also why expireSubscription no longer hard-deletes: destroying the
 * subscription would orphan the record of credits the customer paid for.
 */

const LEDGER_TYPES = [
  "grant", // allowance granted at activation / renewal
  "hold", // credits reserved against an in-flight run
  "commit", // reserved credits actually spent
  "release", // reserved credits returned unspent
  "overage", // credits consumed beyond the monthly allowance
  "adjust", // manual super-admin correction (refunds, forfeiture)
  "reset", // start of a new billing period
  "migration", // one-time conversion from the legacy test quota
  "expire", // subscription expired
];

const creditLedgerSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "company", required: true, index: true },
    subscriptionId: { type: mongoose.Schema.Types.ObjectId, ref: "Subscription" },
    reservationId: { type: mongoose.Schema.Types.ObjectId, ref: "CreditReservation", default: null },

    type: { type: String, enum: LEDGER_TYPES, required: true, index: true },

    // Signed: positive adds spendable credits, negative removes them.
    credits: { type: Number, required: true },

    // Balances AFTER this movement, so the ledger can be replayed and
    // reconciled without recomputing from the beginning of time.
    balanceAfter: { type: Number, default: null },
    reservedAfter: { type: Number, default: null },

    parentSession: { type: String, default: null, index: true },
    sessionId: { type: String, default: null },
    pageUrl: { type: String, default: null },
    storyCount: { type: Number, default: null },

    // Populated for "overage" rows only.
    unitRateUsd: { type: Number, default: null },
    amountUsd: { type: Number, default: null },

    actorUserId: { type: mongoose.Schema.Types.ObjectId, ref: "user", default: null },
    actorRole: { type: String, default: null },
    note: { type: String, default: null },

    createdAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false }
);

creditLedgerSchema.index({ companyId: 1, createdAt: -1 });
creditLedgerSchema.index({ type: 1, createdAt: -1 });

module.exports = mongoose.model("CreditLedger", creditLedgerSchema, "credit_ledger");
module.exports.LEDGER_TYPES = LEDGER_TYPES;
