/**
 * purchaseService — turns a captured payment into an entitlement.
 *
 * Deliberately contains no HTTP and no Razorpay: paymentController does the
 * request handling, razorpayService does the gateway, and everything in between
 * lives here so it can be driven directly by backend/scripts/smokeTestPayments.js.
 *
 * THE ONE INVARIANT THIS FILE EXISTS TO PROTECT
 * ---------------------------------------------
 * Razorpay reports a successful payment TWICE — once through the browser
 * (POST /payments/verify) and once through the webhook — in either order, and
 * the webhook may be delivered repeatedly. Credits must land EXACTLY ONCE.
 * fulfilPayment claims the Payment document with a conditional
 * findOneAndUpdate before any balance moves; the loser of that race never
 * touches money. Same compare-and-set discipline creditService uses for holds.
 *
 * WHY THE SUBSCRIPTION IS UPDATED IN PLACE AND NEVER REPLACED
 * ----------------------------------------------------------
 * CreditReservation.subscriptionId and CreditLedger.subscriptionId point at a
 * specific document, and settleReservation commits against
 * reservation.subscriptionId. If a purchase deactivated the old subscription
 * and created a new one while a run was in flight, those held credits would
 * settle onto a dead subscription and the customer would lose them.
 */

const Subscription = require("../models/Subscription");
const Company = require("../models/Company");
const Payment = require("../models/Payment");
const credits = require("./creditService");
const cm = require("../../src/config/pricing/creditMath");
const pq = require("../../src/config/pricing/purchaseQuote");
const { addOneMonth } = require("../jobs/allowanceResetJob");
const mailSender = require("../utils/mailSender");
const { paymentReceiptEmail } = require("../mail/templates/paymentReceiptEmail");

/**
 * Add n calendar months, reusing the reset job's month arithmetic so the
 * 31st-of-a-30-day-month rollover is handled identically in both places.
 */
function addMonths(from, n) {
  let d = new Date(from);
  for (let i = 0; i < n; i += 1) d = addOneMonth(d);
  return d;
}

/**
 * What a Payment entitles its buyer to.
 *
 * Read from the PAYMENT, not re-quoted from pricing.data.json: the price and
 * allowance were snapshotted when the order was created, and an edit to the
 * catalog between order and capture must not change what the customer receives.
 */
function entitlementFromPayment(p) {
  return {
    planType: p.planType,
    tierKey: p.tierKey,
    period: p.period,
    months: pq.PERIODS[p.period] || 1,
    allowance: p.creditsPurchased,
    priceUsdMonthly: p.priceUsdSnapshot,
  };
}

/* ------------------------------------------------------------------ *
 * Subscription writes
 * ------------------------------------------------------------------ */

/**
 * Create a company's first subscription on a tier.
 *
 * Shared by the paid path and by the super-admin POST /api/subscription/activate
 * so the shape of a brand-new subscription — the credits sub-document, the
 * price snapshots, the opening ledger row and the Company pointer — is written
 * in exactly one place and cannot drift between the two.
 */
async function createSubscriptionForTier({
  companyId,
  actorUserId,
  actorRole,
  planType,
  tierKey,
  tier,
  allowance,
  priceUsd,
  startDate,
  endDate,
  rolloverPolicy,
  overageEnabled,
  note,
  paymentId,
}) {
  const now = new Date();

  const subscription = await Subscription.create({
    companyId,
    activatedBy: actorUserId,
    startDate,
    endDate,
    planType,
    tierKey,
    // Snapshot the price and the config version so editing pricing.data.json
    // never silently re-prices an existing customer.
    pricingVersion: cm.PRICING_VERSION,
    priceUsdMonthly: priceUsd,
    fxRateInrPerUsd: cm.FX_INR_PER_USD,
    concurrentSites: tier.concurrentSites || 1,
    engine: tier.engine || null,
    isActive: true,
    credits: {
      balance: allowance,
      reserved: 0,
      monthlyAllowance: allowance,
      allowanceGrantedAt: now,
      // Credits reset MONTHLY regardless of the billing period. A 6-month
      // purchase buys six monthly grants delivered by allowanceResetJob, not
      // six allowances up front.
      nextResetAt: addOneMonth(now),
      rolloverPolicy: rolloverPolicy === "carry" ? "carry" : "none",
      overageEnabled: !!overageEnabled,
      overageRateUsd: tier.extraCreditUsd || null,
      overageUsedThisPeriod: 0,
      purchasedBalance: 0,
      lifetimeGranted: allowance,
      lifetimeCommitted: 0,
    },
    // @deprecated derived mirror — keeps the pre-credits UI rendering.
    planDetails: { maxTestsAllowed: allowance, testsUsed: 0 },
  });

  await credits.writeLedger({
    companyId: subscription.companyId,
    subscriptionId: subscription._id,
    paymentId: paymentId || null,
    // "purchase" when money changed hands, "grant" when a super admin
    // provisioned it. The distinction is what a refund conversation turns on.
    type: paymentId ? "purchase" : "grant",
    credits: allowance,
    balanceAfter: allowance,
    reservedAfter: 0,
    actorUserId: actorUserId || null,
    actorRole: actorRole || null,
    note: note || `Subscription activated: ${planType}/${tierKey}`,
  });

  await Company.findByIdAndUpdate(companyId, {
    subscriptionStatus: "active",
    activeSubscriptionId: subscription._id,
  });

  return subscription;
}

/**
 * Apply a paid plan entitlement to a company. Three modes:
 *
 *   "created"  — no subscription yet; make one.
 *   "extended" — same tier, still live. endDate moves and NOTHING else. A
 *                renewal must not hand out a bonus allowance mid-period, and
 *                must not restart a period the customer is halfway through.
 *   "switched" — different tier, or the old one expired. A new period starts
 *                today at the new tier's allowance.
 *
 * @returns {Promise<{subscription, mode: "created"|"extended"|"switched"}>}
 */
async function applyPlanEntitlement({
  companyId,
  actorUserId,
  actorRole,
  entitlement,
  paymentId,
  note,
}) {
  const { planType, tierKey, months, allowance, priceUsdMonthly } = entitlement;
  const tier = cm.getTier(planType, tierKey);
  if (!tier) throw new Error(`Unknown plan/tier "${planType}/${tierKey}" at fulfilment`);

  const now = new Date();
  const existing = await credits.getActiveSubscription(companyId);

  /* ---------------- created ---------------- */
  if (!existing) {
    const subscription = await createSubscriptionForTier({
      companyId,
      actorUserId,
      actorRole,
      planType,
      tierKey,
      tier,
      allowance,
      priceUsd: priceUsdMonthly,
      startDate: now,
      endDate: addMonths(now, months),
      note,
      paymentId,
    });
    return { subscription, mode: "created" };
  }

  const sameTier = existing.planType === planType && existing.tierKey === tierKey;
  const stillLive = existing.endDate > now;

  /* ---------------- extended ---------------- */
  if (sameTier && stillLive) {
    const newEnd = addMonths(existing.endDate, months);

    // Only endDate is touched. Balance, monthlyAllowance and nextResetAt are
    // left exactly as they are, so allowanceResetJob keeps delivering the
    // monthly grant on the customer's existing cadence.
    await Subscription.updateOne(
      { _id: existing._id },
      { $set: { endDate: newEnd, isActive: true } }
    );

    const fresh = await Subscription.findById(existing._id);

    await credits.writeLedger({
      companyId: fresh.companyId,
      subscriptionId: fresh._id,
      paymentId: paymentId || null,
      type: "purchase",
      // Zero: the customer bought TIME, not credits. Their monthly allowance
      // continues to arrive on schedule.
      credits: 0,
      balanceAfter: fresh.credits.balance,
      reservedAfter: fresh.credits.reserved,
      actorUserId: actorUserId || null,
      actorRole: actorRole || null,
      note: note || `Plan extended by ${months} month(s) to ${newEnd.toISOString().slice(0, 10)}`,
    });

    await Company.findByIdAndUpdate(companyId, {
      subscriptionStatus: "active",
      activeSubscriptionId: fresh._id,
    });

    return { subscription: fresh, mode: "extended" };
  }

  /* ---------------- switched ---------------- */

  const rollover = existing.credits.rolloverPolicy === "carry";
  // Snapshot before the write: credits bought with cash survive a tier change
  // even though the unused allowance does not.
  const purchased = credits.survivingPurchased(existing);

  await Subscription.updateOne(
    { _id: existing._id },
    {
      $set: {
        planType,
        tierKey,
        legacyPlan: null,
        // A switch is a new agreement at today's prices.
        pricingVersion: cm.PRICING_VERSION,
        priceUsdMonthly,
        fxRateInrPerUsd: cm.FX_INR_PER_USD,
        concurrentSites: tier.concurrentSites || 1,
        engine: tier.engine || null,
        startDate: now,
        endDate: addMonths(now, months),
        isActive: true,
        // Dotted paths, never a whole-subdocument assignment — a full credits
        // write would clobber a concurrent $inc from an in-flight run.
        "credits.overageRateUsd": tier.extraCreditUsd || null,
        "credits.needsManualReview": false,
      },
    }
  );

  const updated = await credits.grantAllowance(existing._id, allowance, {
    mode: rollover ? "add" : "set",
    // "add" leaves the purchased bucket alone; "set" would wipe it without this.
    preservePurchased: rollover ? undefined : purchased,
    type: "purchase",
    paymentId,
    nextResetAt: addOneMonth(now),
    actorUserId,
    actorRole,
    note: note || `Plan changed to ${planType}/${tierKey}`,
  });

  await Company.findByIdAndUpdate(companyId, {
    subscriptionStatus: "active",
    activeSubscriptionId: existing._id,
  });

  return { subscription: updated, mode: "switched" };
}

/**
 * Add credits bought mid-period. Changes the balance and nothing else — no
 * endDate change, no monthlyAllowance change.
 *
 * @returns {Promise<{subscription, creditsGranted} | {error: {code, message}}>}
 */
async function applyCreditTopup({
  companyId,
  actorUserId,
  actorRole,
  quantity,
  unitRateUsd,
  amountUsd,
  paymentId,
  note,
}) {
  const sub = await credits.getActiveSubscription(companyId);
  if (!sub) {
    return {
      error: {
        code: "NO_ACTIVE_SUBSCRIPTION",
        message: "There is no active subscription to add credits to.",
      },
    };
  }

  const subscription = await credits.addPurchasedCredits(sub._id, quantity, {
    paymentId,
    unitRateUsd,
    amountUsd,
    actorUserId,
    actorRole,
    note: note || `Purchased ${quantity} extra credit${quantity === 1 ? "" : "s"}`,
  });

  return { subscription, creditsGranted: quantity };
}

/* ------------------------------------------------------------------ *
 * Fulfilment
 * ------------------------------------------------------------------ */

/**
 * Statuses a payment can be claimed FROM.
 *
 * "fulfilment_failed" is included on purpose: money was captured but the
 * entitlement did not land, so a retry must be able to pick it back up. The
 * subscriptionId / creditsGranted markers below make that retry resume rather
 * than grant a second time.
 */
const CLAIMABLE = ["created", "attempted", "fulfilment_failed"];

/** Best-effort receipt. Never allowed to fail a fulfilment — the money moved. */
async function sendReceipt(payment, subscription) {
  try {
    const company = await Company.findById(payment.companyId).select("name email");
    if (!company?.email) return;
    await mailSender(
      company.email,
      "Payment received — MNR AI Tester",
      paymentReceiptEmail({
        companyName: company.name,
        description: payment.description,
        // What was actually charged, in the currency it was charged in.
        amountCharged: payment.amountMinor / 100,
        currency: payment.currency,
        // The USD catalog figure, shown only as a reference on an INR receipt.
        amountUsd: payment.amountUsdSnapshot,
        razorpayPaymentId: payment.razorpayPaymentId,
        creditsGranted: payment.creditsGranted,
        balance: subscription?.credits?.balance ?? null,
        endDate: subscription?.endDate || null,
      })
    );
  } catch (err) {
    console.error("⚠️ payment receipt email failed:", err.message);
  }
}

/**
 * Apply a payment's entitlement, exactly once.
 *
 * Safe to call concurrently from the browser callback and the webhook. The
 * caller must ALREADY have verified the Razorpay signature — this function
 * trusts that it is being told about a real capture.
 *
 * @returns {Promise<{fulfilled: boolean, reason?: string, payment, subscription?}>}
 *          `fulfilled: false` with reason "already_fulfilled" is a SUCCESS for
 *          the caller — it means the other path won the race.
 * @throws  when the entitlement could not be applied. The payment is left in
 *          "fulfilment_failed" and the webhook must return 500 so Razorpay
 *          retries.
 */
async function fulfilPayment(
  paymentId,
  { source, razorpayPaymentId, razorpaySignature, method, eventId } = {}
) {
  // CLAIM FIRST, before a single credit moves.
  const claimed = await Payment.findOneAndUpdate(
    { _id: paymentId, status: { $in: CLAIMABLE } },
    {
      $set: {
        status: "fulfilling",
        razorpayPaymentId: razorpayPaymentId || null,
        razorpaySignature: razorpaySignature || null,
        method: method || null,
        razorpayEventId: eventId || null,
        fulfilmentSource: source || null,
        verifiedAt: new Date(),
      },
    },
    { returnDocument: "after" }
  );

  if (!claimed) {
    const current = await Payment.findById(paymentId);
    return {
      fulfilled: false,
      reason: current?.status === "paid" ? "already_fulfilled" : "not_claimable",
      payment: current,
    };
  }

  try {
    let subscription = null;

    if (claimed.kind === "plan_purchase") {
      if (claimed.subscriptionId) {
        // A previous attempt already applied the plan and died before marking
        // the payment paid. Resume, do not re-apply.
        subscription = await Subscription.findById(claimed.subscriptionId);
      } else {
        const result = await applyPlanEntitlement({
          companyId: claimed.companyId,
          actorUserId: claimed.createdBy,
          actorRole: "company_admin",
          entitlement: entitlementFromPayment(claimed),
          paymentId: claimed._id,
          note: `Paid: ${claimed.description}`,
        });
        subscription = result.subscription;
        await Payment.updateOne(
          { _id: claimed._id },
          {
            $set: {
              subscriptionId: subscription._id,
              creditsGranted: result.mode === "extended" ? 0 : claimed.creditsPurchased,
            },
          }
        );
      }
    } else {
      if (claimed.creditsGranted !== null && claimed.creditsGranted !== undefined) {
        subscription = await Subscription.findById(claimed.subscriptionId);
      } else {
        const result = await applyCreditTopup({
          companyId: claimed.companyId,
          actorUserId: claimed.createdBy,
          actorRole: "company_admin",
          quantity: claimed.creditsPurchased,
          unitRateUsd: claimed.priceUsdSnapshot,
          // CreditLedger.amountUsd is a USD field, so pass the canonical
          // catalog figure — not the charged amount, which may be in rupees.
          amountUsd: claimed.amountUsdSnapshot ?? null,
          paymentId: claimed._id,
          note: `Paid: ${claimed.description}`,
        });
        if (result.error) throw new Error(result.error.message);
        subscription = result.subscription;
        await Payment.updateOne(
          { _id: claimed._id },
          {
            $set: {
              subscriptionId: subscription._id,
              creditsGranted: result.creditsGranted,
            },
          }
        );
      }
    }

    await Payment.updateOne(
      { _id: claimed._id },
      { $set: { status: "paid", fulfilledAt: new Date(), failureReason: null } }
    );

    const payment = await Payment.findById(claimed._id);
    await sendReceipt(payment, subscription);

    return { fulfilled: true, payment, subscription };
  } catch (err) {
    await Payment.updateOne(
      { _id: claimed._id },
      {
        $set: {
          status: "fulfilment_failed",
          failureReason: err.message,
          failedAt: new Date(),
        },
      }
    );
    // Money was captured and the customer has nothing. This is the one failure
    // in the payment flow that needs a human, so make it impossible to miss.
    console.error(
      `🚨 PAYMENT FULFILMENT FAILED — payment ${claimed._id}, company ${claimed.companyId}, ` +
        `${claimed.amountMinor / 100} ${claimed.currency} captured but not applied: ${err.message}`
    );
    throw err;
  }
}

module.exports = {
  addMonths,
  entitlementFromPayment,
  createSubscriptionForTier,
  applyPlanEntitlement,
  applyCreditTopup,
  fulfilPayment,
  CLAIMABLE,
};
