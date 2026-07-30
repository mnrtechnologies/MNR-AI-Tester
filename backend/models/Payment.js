const mongoose = require("mongoose");

/**
 * Payment — one purchase attempt, from "user clicked Buy" to "entitlement
 * applied". The receipt behind every credit a customer paid cash for.
 *
 * NEVER DELETE A ROW HERE, and never rewrite one to hide a mistake. A payment
 * taken in error is corrected by setting status "refunded" and writing a
 * compensating negative row via POST /api/credits/adjust — exactly the
 * discipline CreditLedger documents. This collection is what a support agent
 * points at when a customer says "I paid and got nothing".
 *
 * THE STATUS FIELD IS THE IDEMPOTENCY LATCH.
 * Razorpay tells us a payment succeeded twice: once via the browser callback
 * (POST /payments/verify) and once via the webhook (POST /payments/webhook),
 * in either order, and the webhook may be delivered more than once. Credits
 * must be granted exactly once regardless. purchaseService.fulfilPayment does
 * a conditional findOneAndUpdate into "fulfilling" BEFORE any money moves —
 * the loser of that race never touches a balance. Same compare-and-set
 * discipline creditService uses for holds.
 */

const PAYMENT_STATUSES = [
  "created", // our doc and a Razorpay order exist; nothing charged yet
  "attempted", // checkout opened / payment.authorized seen
  "fulfilling", // CLAIMED by exactly one fulfiller — the latch
  "paid", // money captured AND entitlement applied
  "failed", // gateway declined, or order creation blew up
  "abandoned", // user dismissed the checkout modal
  "fulfilment_failed", // money captured, entitlement NOT applied — page a human
  "refunded",
];

const PAYMENT_KINDS = ["plan_purchase", "credit_topup"];

const paymentSchema = new mongoose.Schema(
  {
    /* ---------------- Who ---------------- */

    // Billing is company-scoped, not user-scoped: the credits this buys are
    // spent from a balance the whole company shares.
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "company",
      required: true,
      index: true,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },

    /* ---------------- What ---------------- */

    kind: { type: String, enum: PAYMENT_KINDS, required: true },

    planType: { type: String, enum: ["byok", "managed", null], default: null },
    // Free string, validated against pricing.data.json by purchaseQuote rather
    // than by an enum here — same reasoning as Subscription.tierKey.
    tierKey: { type: String, default: null },
    period: { type: String, enum: ["monthly", "semiAnnual", null], default: null },

    // Monthly allowance for a plan purchase, or the quantity for a top-up.
    creditsPurchased: { type: Number, default: null },

    /* ---------------- How much ---------------- */

    /**
     * The charged amount in MINOR UNITS — paise for INR, cents for USD.
     * Always read it together with `currency`; the number alone is meaningless.
     * Floats never touch an amount — see purchaseQuote.toMinor.
     */
    amountMinor: { type: Number, required: true, min: 1 },

    /**
     * INR for Indian buyers (UPI, netbanking, cards), USD for international
     * (cards only — UPI and netbanking are INR-settled rails Razorpay will not
     * offer on a USD order).
     */
    currency: { type: String, enum: ["INR", "USD"], required: true },

    // Snapshots so a later edit to pricing.data.json — or to the FX rate —
    // can never make an old receipt disagree with what was actually charged.
    amountUsdSnapshot: { type: Number, default: null },
    priceUsdSnapshot: { type: Number, default: null },
    pricingVersion: { type: String, default: null },
    fxRateInrPerUsd: { type: Number, default: null },

    /* ---------------- Razorpay ---------------- */

    // Uniqueness is enforced by a PARTIAL index below, not by `unique` here.
    // The doc is written before the order exists, so many rows sit at null, and
    // a `sparse` unique index does NOT help: sparse skips only documents where
    // the field is ABSENT, and `default: null` writes an explicit null. Two
    // concurrent pending orders would then collide on { razorpayOrderId: null }.
    razorpayOrderId: { type: String, default: null },
    razorpayPaymentId: { type: String, default: null, index: true, sparse: true },
    razorpaySignature: { type: String, default: null },
    // x-razorpay-event-id, kept for duplicate-delivery forensics. NOT the
    // idempotency guard — the status transition is.
    razorpayEventId: { type: String, default: null },
    method: { type: String, default: null }, // card / upi / netbanking

    /* ---------------- Lifecycle ---------------- */

    status: { type: String, enum: PAYMENT_STATUSES, default: "created", index: true },
    fulfilmentSource: { type: String, enum: ["callback", "webhook", null], default: null },

    // Written the instant the subscription is created or updated, and the
    // instant credits land. fulfilPayment reads them as resume markers so a
    // retry after a mid-way crash continues rather than granting twice.
    subscriptionId: { type: mongoose.Schema.Types.ObjectId, ref: "Subscription", default: null },
    creditsGranted: { type: Number, default: null },

    failureReason: { type: String, default: null },
    description: { type: String, default: null },

    verifiedAt: { type: Date, default: null },
    fulfilledAt: { type: Date, default: null },
    failedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

paymentSchema.index({ companyId: 1, createdAt: -1 });
paymentSchema.index({ status: 1, createdAt: -1 });

/**
 * One Payment per Razorpay order — the database-level backstop against a
 * duplicate order being recorded twice.
 *
 * Partial, not sparse: it must apply only once an order id actually exists, so
 * any number of orders can sit at null waiting for Razorpay to answer.
 */
paymentSchema.index(
  { razorpayOrderId: 1 },
  { unique: true, partialFilterExpression: { razorpayOrderId: { $type: "string" } } }
);

module.exports = mongoose.model("Payment", paymentSchema, "payments");
module.exports.PAYMENT_STATUSES = PAYMENT_STATUSES;
module.exports.PAYMENT_KINDS = PAYMENT_KINDS;
