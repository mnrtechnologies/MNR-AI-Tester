const Subscription = require("../models/Subscription");
const Company = require("../models/Company");
const CreditReservation = require("../models/CreditReservation");
const credits = require("../services/creditService");
const purchases = require("../services/purchaseService");
const cm = require("../../src/config/pricing/creditMath");

/**
 * DEPRECATED — POST /api/subscription/usage/increment
 *
 * The flat "+1 test" meter this endpoint implemented has been replaced by the
 * credit model (POST /api/credits/authorize-run then /settle). It is kept for
 * one release, returning 410, so a browser still running a cached bundle gets
 * a clear message instead of a 404. Delete it after the next release.
 */
exports.incrementTestUsage = async (req, res) => {
  return res.status(410).json({
    success: false,
    code: "ENDPOINT_REMOVED",
    error: "ENDPOINT_REMOVED",
    message:
      "Per-test usage counting has been replaced by credits. Reload the app to pick up the new version.",
  });
};

// GET SUBSCRIPTION BY ID (FULL DETAILS)
exports.getSubscriptionById = async (req, res) => {
  try {
    const { subscriptionId } = req.params;

    if (!subscriptionId) {
      return res
        .status(400)
        .json({ success: false, message: "Subscription ID is required" });
    }

    const subscription = await Subscription.findById(subscriptionId)
      .populate({
        path: "companyId",
        model: "company",
        select: "-__v",
      })
      .populate({
        path: "activatedBy",
        model: "user",
        select: "-password -__v -token",
      });

    if (!subscription) {
      return res
        .status(404)
        .json({ success: false, message: "Subscription not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Subscription fetched successfully",
      subscription,
      creditAccount: credits.getAccountSnapshot(subscription),
    });
  } catch (error) {
    console.error("Get Subscription By ID Error:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

/**
 * Resolve a requested tier into the values we snapshot onto the subscription.
 * Returns { error } for anything the pricing config does not recognise, so an
 * unknown tier can never quietly create a zero-credit subscription.
 */
function resolveTier({ planType, tierKey, customCredits, customPriceUsd }) {
  const tier = cm.getTier(planType, tierKey);
  if (!tier) {
    return {
      error: `Unknown plan/tier "${planType}/${tierKey}". Valid tiers for ${planType}: ${
        cm.allTierKeys(planType).join(", ") || "(unknown plan type)"
      }`,
    };
  }

  let allowance = tier.credits;
  let priceUsd = tier.priceUsdMonthly;

  if (tier.custom) {
    // self_hosted / enterprise carry no published figures — they must be
    // supplied per deal rather than defaulted to zero.
    if (customCredits === undefined || customCredits === null || Number(customCredits) < 0) {
      return { error: `customCredits is required for the "${tier.name}" tier` };
    }
    allowance = Number(customCredits);
    priceUsd = customPriceUsd !== undefined && customPriceUsd !== null ? Number(customPriceUsd) : null;
  } else if (customCredits !== undefined && customCredits !== null && Number(customCredits) >= 0) {
    // Allow a super admin to override a published allowance for a one-off deal.
    allowance = Number(customCredits);
  }

  return { tier, allowance, priceUsd };
}

// ACTIVATE SUBSCRIPTION (Super Admin Only)
exports.activateSubscription = async (req, res) => {
  try {
    const activatedBy = req.user.id;
    const {
      companyId,
      startDate,
      endDate,
      planType,
      tierKey,
      customCredits,
      customPriceUsd,
      rolloverPolicy,
      overageEnabled,
    } = req.body;

    if (!companyId || !startDate || !endDate || !planType || !tierKey) {
      return res.status(400).json({
        success: false,
        message: "companyId, startDate, endDate, planType and tierKey are required",
      });
    }

    const resolved = resolveTier({ planType, tierKey, customCredits, customPriceUsd });
    if (resolved.error) {
      return res.status(400).json({ success: false, message: resolved.error });
    }
    const { tier, allowance, priceUsd } = resolved;

    if (tier.available === false) {
      return res.status(400).json({
        success: false,
        message: `The "${tier.name}" tier is not available for sale yet. ${tier.unavailableReason || ""}`.trim(),
      });
    }

    // Deactivate any previous subscription for this company.
    await Subscription.updateMany({ companyId, isActive: true }, { isActive: false });

    // The document shape — credits sub-document, price snapshots, opening
    // ledger row, Company pointer — lives in purchaseService so this
    // super-admin path and the paid path in paymentController cannot drift.
    const subscription = await purchases.createSubscriptionForTier({
      companyId,
      actorUserId: activatedBy,
      actorRole: req.user.role,
      planType,
      tierKey,
      tier,
      allowance,
      priceUsd,
      startDate,
      endDate,
      rolloverPolicy,
      overageEnabled,
      note: `Subscription activated: ${planType}/${tierKey}`,
    });

    return res.status(201).json({
      success: true,
      message: `Subscription activated on ${tier.name} with ${allowance} credits`,
      subscription,
      creditAccount: credits.getAccountSnapshot(subscription),
    });
  } catch (error) {
    console.error("Activate Subscription Error:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

// RENEW SUBSCRIPTION (Super Admin Only)
exports.renewSubscription = async (req, res) => {
  try {
    const {
      companyId,
      newEndDate,
      planType,
      tierKey,
      customCredits,
      customPriceUsd,
      rolloverPolicy,
    } = req.body;

    const subscription = await Subscription.findOne({ companyId, isActive: true });
    if (!subscription) {
      return res
        .status(400)
        .json({ success: false, message: "No active subscription found." });
    }

    const nextPlanType = planType || subscription.planType;
    const nextTierKey = tierKey || subscription.tierKey;

    const resolved = resolveTier({
      planType: nextPlanType,
      tierKey: nextTierKey,
      customCredits,
      customPriceUsd,
    });
    if (resolved.error) {
      return res.status(400).json({ success: false, message: resolved.error });
    }
    const { tier, allowance, priceUsd } = resolved;

    if (newEndDate) subscription.endDate = newEndDate;
    subscription.planType = nextPlanType;
    subscription.tierKey = nextTierKey;
    subscription.legacyPlan = null;
    // Re-snapshot: a renewal is a new agreement at today's prices.
    subscription.pricingVersion = cm.PRICING_VERSION;
    subscription.priceUsdMonthly = priceUsd;
    subscription.fxRateInrPerUsd = cm.FX_INR_PER_USD;
    subscription.concurrentSites = tier.concurrentSites || 1;
    subscription.engine = tier.engine || null;
    subscription.isActive = true;
    if (rolloverPolicy) {
      subscription.credits.rolloverPolicy = rolloverPolicy === "carry" ? "carry" : "none";
    }
    subscription.credits.overageRateUsd = tier.extraCreditUsd || null;
    subscription.credits.needsManualReview = false;

    await subscription.save();

    const nextResetAt = new Date();
    nextResetAt.setMonth(nextResetAt.getMonth() + 1);

    const rollover = subscription.credits.rolloverPolicy === "carry";

    // grantAllowance does the atomic balance write and the ledger row.
    const updated = await credits.grantAllowance(subscription._id, allowance, {
      mode: rollover ? "add" : "set",
      // Credits the customer BOUGHT are not part of the allowance and must
      // survive a renewal — "set" would otherwise delete them alongside the
      // unused allowance. See credits.purchasedBalance on the schema.
      preservePurchased: rollover ? undefined : credits.survivingPurchased(subscription),
      type: "grant",
      nextResetAt,
      actorUserId: req.user.id,
      actorRole: req.user.role,
      note: `Subscription renewed on ${nextPlanType}/${nextTierKey}`,
    });

    await Company.findByIdAndUpdate(companyId, {
      subscriptionStatus: "active",
      activeSubscriptionId: subscription._id,
    });

    return res.status(200).json({
      success: true,
      message: `Subscription renewed on ${tier.name} with ${allowance} credits`,
      subscription: updated || subscription,
      creditAccount: credits.getAccountSnapshot(updated || subscription),
    });
  } catch (error) {
    console.error("Renew Subscription Error:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

/**
 * EXPIRE SUBSCRIPTION (Super Admin Only)
 *
 * This used to findOneAndDelete. That is unacceptable once credits exist:
 * deleting the subscription destroys the record of a balance the customer paid
 * for, along with every ledger row's parent. It is now a soft expiry.
 *
 * The remaining balance is deliberately LEFT INTACT so a renewal restores it.
 * Forfeiting credits is an explicit super-admin decision via
 * POST /api/credits/adjust with a negative delta — never a side effect.
 */
exports.expireSubscription = async (req, res) => {
  try {
    const { companyId } = req.body;
    if (!companyId) {
      return res.status(400).json({ success: false, message: "companyId is required" });
    }

    const subscription = await Subscription.findOne({ companyId, isActive: true });
    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: "No active subscription found for this Company.",
      });
    }

    // Return anything held for runs that will now never complete.
    const heldReservations = await CreditReservation.find({
      subscriptionId: subscription._id,
      status: "held",
    }).select("_id");

    for (const r of heldReservations) {
      await credits.settleReservation(r._id, { force: true });
    }

    const fresh = await Subscription.findById(subscription._id);

    fresh.isActive = false;
    fresh.endDate = new Date();
    fresh.remainingDays = 0;
    await fresh.save();

    await credits.writeLedger({
      companyId: fresh.companyId,
      subscriptionId: fresh._id,
      type: "expire",
      credits: 0,
      balanceAfter: fresh.credits.balance,
      reservedAfter: fresh.credits.reserved,
      actorUserId: req.user.id,
      actorRole: req.user.role,
      note: `Subscription expired with ${fresh.credits.balance} credits preserved (${heldReservations.length} reservation(s) settled)`,
    });

    await Company.findByIdAndUpdate(companyId, {
      subscriptionStatus: "expired",
      activeSubscriptionId: null,
    });

    return res.status(200).json({
      success: true,
      message: `Subscription expired. ${fresh.credits.balance} credits preserved for renewal.`,
      data: {
        preservedCredits: fresh.credits.balance,
        reservationsSettled: heldReservations.length,
      },
    });
  } catch (error) {
    console.error("Expire Subscription Error:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};
