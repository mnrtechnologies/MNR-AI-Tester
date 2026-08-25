const mongoose = require("mongoose");

/**
 * CreditReservation — credits held against an in-flight test run.
 *
 * Lifecycle:
 *   held ──▶ committed            all the work happened, charge it
 *        ├─▶ released             nothing was spent, give it back
 *        ├─▶ partially_committed  some URLs ran, some never dispatched
 *        └─▶ expired              reconciler gave up (see creditReconciler)
 *
 * DOUBLE-CHARGE PROTECTION IS THE UNIQUE INDEX ON idempotencyKey, not
 * application logic. Two concurrent authorize calls for the same parent
 * session race to insert the same key; exactly one wins and the loser gets a
 * duplicate-key error, which the controller reports as "already authorized"
 * rather than as a failure.
 *
 * NOTE ON RETRIES: Celery's run_phase3 is bind=True with no autoretry_for, so
 * a task never silently re-runs today. If retries are ever added, each retry
 * spends model calls again and this reservation would need to widen (or the
 * retry be charged separately) — it does not currently account for that.
 */

const reservationLineSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true },
    pageUrl: { type: String, default: "" },
    // Snapshot of the story count AT AUTHORIZATION TIME. Settle compares
    // against the live value so a drift can be logged rather than silently
    // mispriced. (Phase Review can only edit the Expected Result column, so
    // drift should be impossible today — this guards a future feature.)
    storyCount: { type: Number, default: 0 },
    credits: { type: Number, default: 0 },
    settled: { type: String, enum: ["pending", "committed", "released"], default: "pending" },
  },
  { _id: false }
);

const creditReservationSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "company", required: true },
    subscriptionId: { type: mongoose.Schema.Types.ObjectId, ref: "Subscription", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "user" },

    parentSession: { type: String, required: true, index: true },

    // "phase2" — the up-front discovery cap (we cannot know the URL count yet)
    // "phase3" — the priced top-up authorized at the review gate
    scope: { type: String, enum: ["phase2", "phase3", "spec"], required: true },

    // `${parentSession}:${scope}` — see the class comment.
    idempotencyKey: { type: String, required: true, unique: true },

    credits: { type: Number, required: true, min: 0 },
    storyCountTotal: { type: Number, default: null },
    lines: { type: [reservationLineSchema], default: [] },

    status: {
      type: String,
      enum: ["held", "committed", "released", "partially_committed", "expired"],
      default: "held",
      index: true,
    },

    committedCredits: { type: Number, default: 0 },
    releasedCredits: { type: Number, default: 0 },

    heldAt: { type: Date, default: Date.now },
    committedAt: { type: Date, default: null },
    releasedAt: { type: Date, default: null },

    // Past this, the reconciler settles the reservation without waiting for
    // the browser. Computed from the story count, not fixed: the engine
    // allows 300s PER STORY, so a max-size URL can legitimately run for well
    // over an hour. See creditMath.reservationTtlMinutes.
    expiresAt: { type: Date, required: true },

    note: { type: String, default: null },
  },
  { timestamps: true }
);

creditReservationSchema.index({ companyId: 1, status: 1 });
creditReservationSchema.index({ status: 1, expiresAt: 1 });

module.exports = mongoose.model("CreditReservation", creditReservationSchema, "credit_reservations");
