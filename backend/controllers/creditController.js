const User = require("../models/User");
const Subscription = require("../models/Subscription");
const CreditReservation = require("../models/CreditReservation");
const CreditLedger = require("../models/CreditLedger");
const credits = require("../services/creditService");
const usageBilling = require("../services/usageBilling");
const cm = require("../../src/config/pricing/creditMath");
const { buildReservationLines } = require("../../src/config/pricing/settlementRules");
const SpecTestRun = require("../models/SpecTestRun");
const stm = require("../services/specTestMath");

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

/**
 * Resolve the caller's company and its active subscription in one place.
 * Returns { error } when the caller is not billable, so each handler can
 * return early without repeating the checks.
 */
async function resolveBillingContext(req) {
  const user = await User.findById(req.user.id);
  if (!user) return { error: { status: 404, code: "USER_NOT_FOUND", message: "User not found." } };
  if (!user.companyId) {
    return {
      error: { status: 404, code: "NO_COMPANY", message: "This user is not linked to a company." },
    };
  }

  const subscription = await credits.getActiveSubscription(user.companyId);
  if (!subscription) {
    return {
      error: {
        status: 404,
        code: "NO_SUBSCRIPTION",
        message: "No active subscription found for your company.",
      },
    };
  }

  if (subscription.endDate < new Date()) {
    return {
      error: {
        status: 403,
        code: "SUBSCRIPTION_EXPIRED",
        message: "Your company's subscription has expired.",
      },
    };
  }

  return { user, subscription };
}

function fail(res, error) {
  return res.status(error.status).json({
    success: false,
    code: error.code,
    error: error.code,
    message: error.message,
  });
}

/** HTTP 402 — the account exists, it just cannot pay. */
function insufficient(res, { required, available, subscription, snapshot }) {
  return res.status(402).json({
    success: false,
    code: "INSUFFICIENT_CREDITS",
    error: "INSUFFICIENT_CREDITS",
    message: `This run needs ${required} credit${required === 1 ? "" : "s"} but only ${available} ${available === 1 ? "is" : "are"} available.`,
    required,
    available,
    shortfall: Math.max(0, required - available),
    planType: subscription.planType,
    tierKey: subscription.tierKey,
    extraCreditUsd: snapshot ? snapshot.overageRateUsd : null,
    upgradeUrl: "/upgrade-plan",
  });
}

/* ------------------------------------------------------------------ *
 * Reads
 * ------------------------------------------------------------------ */

// GET /api/credits/account
exports.getAccount = async (req, res) => {
  try {
    const ctx = await resolveBillingContext(req);
    if (ctx.error) return fail(res, ctx.error);

    const snapshot = credits.getAccountSnapshot(ctx.subscription);

    return res.status(200).json({
      success: true,
      message: "Credit account fetched successfully",
      data: snapshot,
      // Only a Managed customer needs these, and only they are billed on them:
      // the live meter converts streamed token counts into credits client-side
      // so the figure moves in real time instead of waiting on the reconciler.
      modelRates: snapshot?.billsUsage ? cm.PRICING.modelRates : undefined,
      usdPerCredit: snapshot?.billsUsage ? cm.PRICING.usdPerCredit : undefined,
      enforced: credits.ENFORCED,
    });
  } catch (error) {
    console.error("Get Credit Account Error:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

/**
 * GET /api/credits/usage/:parentSession
 *
 * Itemised model spend for one run — what each phase and model cost. Serves the
 * live meter on Managed plans, and doubles as the receipt a customer or support
 * agent can point at when a charge is questioned.
 *
 * Available on BYOK too: those rows are recorded but never billed, so this is
 * how a BYOK customer sees what their own key spent.
 */
exports.getRunUsage = async (req, res) => {
  try {
    const { parentSession } = req.params;
    if (!parentSession) {
      return res
        .status(400)
        .json({ success: false, message: "parentSession is required" });
    }

    const ctx = await resolveBillingContext(req);
    if (ctx.error) return fail(res, ctx.error);

    const usage = await usageBilling.usageForParentSession(parentSession, ctx.user._id);
    const snapshot = credits.getAccountSnapshot(ctx.subscription);

    return res.status(200).json({
      success: true,
      message: "Run usage fetched successfully",
      data: {
        ...usage,
        // True when this usage is charged ON TOP of the run's capacity credits
        // (Managed). On BYOK it is recorded for visibility but never billed —
        // say so explicitly rather than letting a customer read a number they
        // will never be charged.
        billable: !!snapshot?.billsUsage,
      },
    });
  } catch (error) {
    console.error("Get Run Usage Error:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

/**
 * POST /api/credits/preflight
 *
 * Can this account start a run at all? Applies to both meters.
 *
 * This is the ONLY place a Managed run is refused. Once work is under way the
 * balance is allowed to go negative — killing a run at the moment its credits
 * run out throws away everything already spent on it and leaves the customer
 * with no report to show for the money.
 */
exports.preflight = async (req, res) => {
  try {
    const ctx = await resolveBillingContext(req);
    if (ctx.error) return fail(res, ctx.error);

    const snapshot = credits.getAccountSnapshot(ctx.subscription);

    if (!credits.ENFORCED) {
      return res.status(200).json({
        success: true,
        message: "Enforcement disabled",
        data: { allowed: true, enforced: false, account: snapshot },
      });
    }

    const balance = snapshot?.balance ?? 0;
    const allowed = snapshot?.unlimited || snapshot?.overageEnabled || balance > 0;

    if (!allowed) {
      return insufficient(res, {
        required: 1,
        available: Math.max(0, balance),
        subscription: ctx.subscription,
        snapshot,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Ready to run",
      data: { allowed: true, enforced: true, account: snapshot },
    });
  } catch (error) {
    console.error("Credit Preflight Error:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

// GET /api/credits/estimate?parentSession=...
exports.getEstimate = async (req, res) => {
  try {
    const { parentSession } = req.query;
    if (!parentSession) {
      return res
        .status(400)
        .json({ success: false, message: "parentSession is required" });
    }

    const ctx = await resolveBillingContext(req);
    if (ctx.error) return fail(res, ctx.error);

    // Discovery held the crawler's page ceiling because the URL count was not
    // knowable yet. Now that Phase 2 has produced sheets, give back the excess.
    await credits.reconcileExplorationHold(parentSession, req.user.id);

    const estimate = await credits.computeEstimate(parentSession, req.user.id, {
      pendingOnly: true,
    });
    const snapshot = credits.getAccountSnapshot(
      await credits.getActiveSubscription(ctx.user.companyId)
    );

    return res.status(200).json({
      success: true,
      message: "Estimate computed successfully",
      data: {
        ...estimate,
        balance: snapshot.balance,
        reserved: snapshot.reserved,
        sufficient: snapshot.balance >= estimate.topUpRequired,
        shortfall: Math.max(0, estimate.topUpRequired - snapshot.balance),
        overageRateUsd: snapshot.overageRateUsd,
        balanceAfterRun: snapshot.balance - estimate.topUpRequired,
        enforced: credits.ENFORCED,
      },
    });
  } catch (error) {
    console.error("Get Credit Estimate Error:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

// GET /api/credits/ledger?companyId=&page=&limit=
exports.getLedger = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));

    let companyId = req.query.companyId;

    // Only a super admin may look at another company's ledger.
    if (req.user.role !== "super_admin") {
      const user = await User.findById(req.user.id);
      if (!user || !user.companyId) {
        return res
          .status(404)
          .json({ success: false, message: "This user is not linked to a company." });
      }
      companyId = user.companyId;
    }

    if (!companyId) {
      return res.status(400).json({ success: false, message: "companyId is required" });
    }

    const [rows, total] = await Promise.all([
      CreditLedger.find({ companyId })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      CreditLedger.countDocuments({ companyId }),
    ]);

    return res.status(200).json({
      success: true,
      message: "Ledger fetched successfully",
      data: { rows, page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Get Ledger Error:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

/* ------------------------------------------------------------------ *
 * Writes — the metering flow
 * ------------------------------------------------------------------ */

/**
 * POST /api/credits/reserve-exploration  { parentSession }
 *
 * Phase 1 crawls before it knows how many URLs exist, so we cannot price the
 * run yet. Hold the crawler's own page ceiling and reconcile down at the
 * estimate step. Idempotent per parent session.
 */
exports.reserveExploration = async (req, res) => {
  try {
    const { parentSession } = req.body;
    if (!parentSession) {
      return res.status(400).json({ success: false, message: "parentSession is required" });
    }

    const ctx = await resolveBillingContext(req);
    if (ctx.error) return fail(res, ctx.error);

    const { subscription, user } = ctx;
    const idempotencyKey = `${parentSession}:phase2`;

    const existing = await CreditReservation.findOne({ idempotencyKey }).lean();
    if (existing) {
      return res.status(200).json({
        success: true,
        message: "Exploration credits already reserved for this run.",
        data: {
          alreadyReserved: true,
          reservationId: existing._id,
          creditsHeld: existing.credits,
        },
      });
    }

    const amount = cm.PHASE2_MAX_URLS;
    const snapshot = credits.getAccountSnapshot(subscription);

    if (!credits.ENFORCED) {
      return res.status(200).json({
        success: true,
        message: "Enforcement disabled — no credits held.",
        data: { enforced: false, creditsHeld: 0, wouldHold: amount },
      });
    }

    if (snapshot.balance < amount) {
      return insufficient(res, {
        required: amount,
        available: snapshot.balance,
        subscription,
        snapshot,
      });
    }

    let reservation;
    try {
      reservation = await CreditReservation.create({
        companyId: subscription.companyId,
        subscriptionId: subscription._id,
        userId: user._id,
        parentSession,
        scope: "phase2",
        idempotencyKey,
        credits: amount,
        lines: [],
        status: "held",
        // Generous: a full crawl plus an exploration pass over every page can
        // legitimately run for hours. Expiring early would settle the hold
        // while the work is still happening.
        expiresAt: new Date(
          Date.now() + cm.reservationTtlMinutes(amount * 3) * 60 * 1000
        ),
        note: `Discovery hold: up to ${amount} URLs`,
      });
    } catch (err) {
      // Unique index on idempotencyKey — another request won the race.
      if (err && err.code === 11000) {
        const winner = await CreditReservation.findOne({ idempotencyKey }).lean();
        return res.status(200).json({
          success: true,
          message: "Exploration credits already reserved for this run.",
          data: { alreadyReserved: true, reservationId: winner?._id, creditsHeld: winner?.credits },
        });
      }
      throw err;
    }

    const held = await credits.holdCredits(subscription._id, amount, {
      reservationId: reservation._id,
      parentSession,
      actorUserId: user._id,
      actorRole: req.user.role,
      note: "Discovery hold",
    });

    if (!held) {
      // Balance moved between the check and the hold. Undo the reservation so
      // nothing is left dangling, then report insufficient funds.
      await CreditReservation.deleteOne({ _id: reservation._id, status: "held" });
      const fresh = await credits.getActiveSubscription(user.companyId);
      return insufficient(res, {
        required: amount,
        available: fresh ? fresh.credits.balance : 0,
        subscription,
        snapshot,
      });
    }

    return res.status(200).json({
      success: true,
      message: `Held ${amount} credits while we discover your pages. Unused credits are returned automatically.`,
      data: {
        reservationId: reservation._id,
        creditsHeld: amount,
        balance: held.credits.balance,
        reserved: held.credits.reserved,
      },
    });
  } catch (error) {
    console.error("Reserve Exploration Error:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

/**
 * POST /api/credits/authorize-run  { parentSession, acknowledgedOversized }
 *
 * The gate. Recomputes the price server-side from MongoDB — the browser's
 * numbers are advisory only.
 *   200 authorized (or already authorized)
 *   402 insufficient credits
 *   409 a URL produced more stories than we run unattended
 */
exports.authorizeRun = async (req, res) => {
  try {
    const { parentSession, acknowledgedOversized } = req.body;
    if (!parentSession) {
      return res.status(400).json({ success: false, message: "parentSession is required" });
    }

    const ctx = await resolveBillingContext(req);
    if (ctx.error) return fail(res, ctx.error);

    const { subscription, user } = ctx;
    const idempotencyKey = `${parentSession}:phase3`;

    const existing = await CreditReservation.findOne({ idempotencyKey }).lean();
    if (existing) {
      return res.status(200).json({
        success: true,
        message: "This run is already authorized.",
        data: {
          alreadyAuthorized: true,
          authorizationId: existing._id,
          parentSession,
          creditsHeld: existing.credits,
          expiresAt: existing.expiresAt,
        },
      });
    }

    await credits.reconcileExplorationHold(parentSession, req.user.id);
    const estimate = await credits.computeEstimate(parentSession, req.user.id, {
      pendingOnly: true,
    });

    if (estimate.urlCount === 0) {
      return res.status(400).json({
        success: false,
        code: "NOTHING_TO_RUN",
        message: "No pending pages found for this session.",
      });
    }

    // Stop-and-ask before silently running up a large bill.
    if (estimate.oversizedUrls.length > 0 && acknowledgedOversized !== true) {
      return res.status(409).json({
        success: false,
        code: "OVERSIZED_URL_REQUIRES_APPROVAL",
        error: "OVERSIZED_URL_REQUIRES_APPROVAL",
        message: `${estimate.oversizedUrls.length} page${estimate.oversizedUrls.length === 1 ? "" : "s"} produced more than ${cm.MAX_STORIES_PER_URL} test stories. Please confirm before we run them.`,
        maxStoriesPerUrl: cm.MAX_STORIES_PER_URL,
        oversizedUrls: estimate.oversizedUrls,
        totalCredits: estimate.totalCredits,
        topUpRequired: estimate.topUpRequired,
      });
    }

    const snapshot = credits.getAccountSnapshot(subscription);
    const amount = estimate.topUpRequired;

    if (!credits.ENFORCED) {
      return res.status(200).json({
        success: true,
        message: "Enforcement disabled — run authorized without holding credits.",
        data: {
          enforced: false,
          authorizationId: null,
          parentSession,
          creditsHeld: 0,
          wouldHold: amount,
          estimate,
        },
      });
    }

    if (snapshot.balance < amount) {
      return insufficient(res, {
        required: amount,
        available: snapshot.balance,
        subscription,
        snapshot,
      });
    }

    // Per-URL incremental cost, guaranteed to sum to `amount`.
    const lines = buildReservationLines(
      estimate.perUrl,
      estimate.alreadyHeld,
      amount
    );

    let reservation;
    try {
      reservation = await CreditReservation.create({
        companyId: subscription.companyId,
        subscriptionId: subscription._id,
        userId: user._id,
        parentSession,
        scope: "phase3",
        idempotencyKey,
        credits: amount,
        storyCountTotal: estimate.totalStories,
        lines,
        status: "held",
        expiresAt: new Date(
          Date.now() + cm.reservationTtlMinutes(estimate.totalStories) * 60 * 1000
        ),
        note: `${estimate.urlCount} URLs, ${estimate.totalStories} stories`,
      });
    } catch (err) {
      if (err && err.code === 11000) {
        const winner = await CreditReservation.findOne({ idempotencyKey }).lean();
        return res.status(200).json({
          success: true,
          message: "This run is already authorized.",
          data: {
            alreadyAuthorized: true,
            authorizationId: winner?._id,
            parentSession,
            creditsHeld: winner?.credits,
          },
        });
      }
      throw err;
    }

    const held = await credits.holdCredits(subscription._id, amount, {
      reservationId: reservation._id,
      parentSession,
      actorUserId: user._id,
      actorRole: req.user.role,
      note: `Run authorized: ${estimate.urlCount} URLs / ${estimate.totalStories} stories`,
    });

    if (!held) {
      await CreditReservation.deleteOne({ _id: reservation._id, status: "held" });
      const fresh = await credits.getActiveSubscription(user.companyId);
      return insufficient(res, {
        required: amount,
        available: fresh ? fresh.credits.balance : 0,
        subscription,
        snapshot,
      });
    }

    return res.status(200).json({
      success: true,
      message: `Authorized. ${amount} credit${amount === 1 ? "" : "s"} held for this run.`,
      data: {
        authorizationId: reservation._id,
        parentSession,
        creditsHeld: amount,
        totalCredits: estimate.totalCredits,
        expiresAt: reservation.expiresAt,
        balance: held.credits.balance,
        reserved: held.credits.reserved,
        estimate,
      },
    });
  } catch (error) {
    console.error("Authorize Run Error:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

/**
 * POST /api/credits/settle  { parentSession }
 *
 * Fast path only — the reconciler is the authoritative settler. Untrusted but
 * harmless: settleReservation re-derives every decision from MongoDB.
 * Always 200; settling something already settled is not an error.
 */
exports.settleRun = async (req, res) => {
  try {
    const { parentSession } = req.body;
    if (!parentSession) {
      return res.status(400).json({ success: false, message: "parentSession is required" });
    }

    const user = await User.findById(req.user.id);
    if (!user || !user.companyId) {
      return res.status(404).json({ success: false, message: "User or company not found." });
    }

    const reservations = await CreditReservation.find({
      parentSession,
      companyId: user.companyId,
      status: "held",
    }).select("_id");

    const results = [];
    for (const r of reservations) {
      results.push(await credits.settleReservation(r._id));
    }

    const snapshot = credits.getAccountSnapshot(
      await credits.getActiveSubscription(user.companyId)
    );

    return res.status(200).json({
      success: true,
      message: "Settlement processed.",
      data: { results, account: snapshot },
    });
  } catch (error) {
    console.error("Settle Run Error:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};


/* ------------------------------------------------------------------ *
 * Test Case Designer (spec_test_run)
 *
 * A different gate from web testing, because the cost is knowable in advance.
 * The engine extracts requirements first, and design is one model call per
 * requirement — so once analysis is done we can quote a real price BEFORE the
 * expensive phase, instead of holding a ceiling and reconciling down.
 * ------------------------------------------------------------------ */

/**
 * GET /api/credits/spec-estimate?runId=...
 *
 * What will this run cost? Read-only — holds nothing. Priced server-side from
 * the spec_test_run row the engine wrote; the browser's numbers are never
 * trusted, it only supplies the run id.
 */
exports.getSpecEstimate = async (req, res) => {
  try {
    const runId = req.query.runId;
    if (!runId) {
      return res.status(400).json({ success: false, message: "runId is required" });
    }

    const ctx = await resolveBillingContext(req);
    if (ctx.error) return fail(res, ctx.error);

    const run = await SpecTestRun.findOne({ run_id: runId }).lean();
    if (!run) {
      return res.status(404).json({ success: false, message: `No run found for ${runId}` });
    }
    if (String(run.user_id) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: "This run belongs to another user." });
    }
    if (!run.requirements_found) {
      return res.status(409).json({
        success: false,
        code: "NOT_ANALYSED",
        message: "This document has not been analysed yet.",
      });
    }

    const estimate = stm.estimateSpecRun({
      requirements: run.requirements_found,
      model: run.model,
      parseDurationMs: run.parse_duration_ms,
    });
    const snapshot = credits.getAccountSnapshot(ctx.subscription);
    const existing = await CreditReservation.findOne({
      idempotencyKey: `${runId}:spec`,
    }).lean();

    return res.status(200).json({
      success: true,
      message: "Estimate ready",
      data: {
        runId,
        ...estimate,
        enforced: credits.ENFORCED,
        alreadyAuthorized: Boolean(existing),
        // Managed plans bill measured tokens, so the capacity figure above is
        // indicative for them rather than what they will be charged.
        meter: ctx.subscription?.planType === "managed" ? "usage" : "capacity",
        account: snapshot,
        sufficient:
          !credits.ENFORCED ||
          snapshot?.unlimited === true ||
          snapshot?.overageEnabled === true ||
          (snapshot?.balance ?? 0) >= estimate.credits,
      },
    });
  } catch (error) {
    console.error("Spec Estimate Error:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

/**
 * POST /api/credits/authorize-spec-run  { runId, acknowledgedOversized }
 *
 * The gate. Holds the estimated credits and stamps the run as authorized so the
 * engine — which is unauthenticated and cannot be trusted to decide this — will
 * accept the design request.
 *   200 authorized (or already authorized)
 *   402 insufficient credits
 *   409 unusually large document, needs explicit confirmation
 *
 * The hold is released and replaced by the real charge when the reconciler
 * settles the finished run against measured duration (specTestBilling).
 */
exports.authorizeSpecRun = async (req, res) => {
  try {
    const { runId, acknowledgedOversized } = req.body;
    if (!runId) {
      return res.status(400).json({ success: false, message: "runId is required" });
    }

    const ctx = await resolveBillingContext(req);
    if (ctx.error) return fail(res, ctx.error);

    const { subscription, user } = ctx;
    const idempotencyKey = `${runId}:spec`;

    const existing = await CreditReservation.findOne({ idempotencyKey }).lean();
    if (existing) {
      return res.status(200).json({
        success: true,
        message: "This run is already authorized.",
        data: {
          alreadyAuthorized: true,
          authorizationId: existing._id,
          runId,
          creditsHeld: existing.credits,
          expiresAt: existing.expiresAt,
        },
      });
    }

    const run = await SpecTestRun.findOne({ run_id: runId }).lean();
    if (!run) {
      return res.status(404).json({ success: false, message: `No run found for ${runId}` });
    }
    if (String(run.user_id) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: "This run belongs to another user." });
    }
    if (!run.requirements_found) {
      return res.status(409).json({
        success: false,
        code: "NOT_ANALYSED",
        message: "Analyse the document before authorizing a design run.",
      });
    }

    const estimate = stm.estimateSpecRun({
      requirements: run.requirements_found,
      model: run.model,
      parseDurationMs: run.parse_duration_ms,
    });

    // Stop-and-ask before silently running up a large bill.
    if (estimate.oversized && acknowledgedOversized !== true) {
      return res.status(409).json({
        success: false,
        code: "OVERSIZED_RUN_REQUIRES_APPROVAL",
        error: "OVERSIZED_RUN_REQUIRES_APPROVAL",
        message: `This document has ${run.requirements_found} requirements, above the ${estimate.maxRequirements} we run unattended. Estimated cost ${estimate.credits} credits.`,
        data: { runId, ...estimate },
      });
    }

    const amount = estimate.credits;
    const snapshot = credits.getAccountSnapshot(subscription);

    if (!credits.ENFORCED) {
      await SpecTestRun.updateOne(
        { run_id: runId },
        { $set: { authorized: true, authorized_credits: 0, authorized_at: new Date() } },
      );
      return res.status(200).json({
        success: true,
        message: "Enforcement disabled - no credits held.",
        data: { enforced: false, creditsHeld: 0, wouldHold: amount, runId },
      });
    }

    if (snapshot.balance < amount && !snapshot.unlimited && !snapshot.overageEnabled) {
      return insufficient(res, {
        required: amount,
        available: snapshot.balance,
        subscription,
        snapshot,
      });
    }

    let reservation;
    try {
      reservation = await CreditReservation.create({
        companyId: subscription.companyId,
        subscriptionId: subscription._id,
        userId: user._id,
        // The spec engine's run_id plays the role parentSession does for web:
        // the key everything about one run hangs off. settle/release already
        // work on it unchanged.
        parentSession: runId,
        scope: "spec",
        idempotencyKey,
        credits: amount,
        // Deliberately empty. settleReservation() returns "still_running" for a
        // lineless hold and releases the whole thing once the TTL passes, which
        // is exactly right for a run the user abandons after authorizing.
        lines: [],
        status: "held",
        expiresAt: new Date(Date.now() + cm.reservationTtlMinutes(amount * 3) * 60 * 1000),
        note: `Test case design: ${run.requirements_found} requirements`,
      });
    } catch (err) {
      if (err && err.code === 11000) {
        const winner = await CreditReservation.findOne({ idempotencyKey }).lean();
        return res.status(200).json({
          success: true,
          message: "This run is already authorized.",
          data: { alreadyAuthorized: true, authorizationId: winner?._id, runId, creditsHeld: winner?.credits },
        });
      }
      throw err;
    }

    const held = await credits.holdCredits(subscription._id, amount, {
      reservationId: reservation._id,
      parentSession: runId,
      actorUserId: user._id,
      actorRole: req.user.role,
      note: "Test case design hold",
    });

    if (!held) {
      // Balance moved between the check and the hold. Undo the reservation so
      // nothing dangles, then report insufficient funds.
      await CreditReservation.deleteOne({ _id: reservation._id, status: "held" });
      const fresh = await credits.getActiveSubscription(user.companyId);
      return insufficient(res, {
        required: amount,
        available: fresh ? fresh.credits.balance : 0,
        subscription,
        snapshot,
      });
    }

    // The engine reads this. It is unauthenticated, so the decision has to
    // reach it through the shared database rather than be asserted by the
    // browser it talks to.
    await SpecTestRun.updateOne(
      { run_id: runId },
      {
        $set: {
          authorized: true,
          authorized_credits: amount,
          authorized_at: new Date(),
          authorization_id: reservation._id,
        },
      },
    );

    return res.status(200).json({
      success: true,
      message: `Held ${amount} credit${amount === 1 ? "" : "s"} for this run. Unused credits are returned automatically.`,
      data: {
        authorizationId: reservation._id,
        runId,
        creditsHeld: amount,
        estimate,
        expiresAt: reservation.expiresAt,
      },
    });
  } catch (error) {
    console.error("Authorize Spec Run Error:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

/** POST /api/credits/release  { parentSession } — user abandoned the run. */
exports.releaseRun = async (req, res) => {
  try {
    const { parentSession } = req.body;
    if (!parentSession) {
      return res.status(400).json({ success: false, message: "parentSession is required" });
    }

    const user = await User.findById(req.user.id);
    if (!user || !user.companyId) {
      return res.status(404).json({ success: false, message: "User or company not found." });
    }

    const released = await credits.releaseParentSession(parentSession, user.companyId);

    return res.status(200).json({
      success: true,
      message: released > 0 ? `Returned ${released} held credits.` : "Nothing to release.",
      data: { released },
    });
  } catch (error) {
    console.error("Release Run Error:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

/* ------------------------------------------------------------------ *
 * Super-admin
 * ------------------------------------------------------------------ */

/** POST /api/credits/grant  { companyId, credits, note } */
exports.grantCredits = async (req, res) => {
  try {
    const { companyId, credits: amount, note } = req.body;

    if (!companyId || !amount) {
      return res
        .status(400)
        .json({ success: false, message: "companyId and credits are required" });
    }
    const delta = Number(amount);
    if (!Number.isFinite(delta) || delta <= 0) {
      return res
        .status(400)
        .json({ success: false, message: "credits must be a positive number" });
    }
    if (!note || !String(note).trim()) {
      return res
        .status(400)
        .json({ success: false, message: "A note is required so the ledger stays auditable." });
    }

    const subscription = await credits.getActiveSubscription(companyId);
    if (!subscription) {
      return res
        .status(404)
        .json({ success: false, message: "No active subscription for this company." });
    }

    const updated = await credits.adjustCredits(subscription._id, delta, {
      type: "grant",
      note: String(note).trim(),
      actorUserId: req.user.id,
      actorRole: req.user.role,
    });

    return res.status(200).json({
      success: true,
      message: `Granted ${delta} credits.`,
      data: credits.getAccountSnapshot(updated),
    });
  } catch (error) {
    console.error("Grant Credits Error:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

/** POST /api/credits/adjust  { companyId, delta, note } — signed correction. */
exports.adjustCredits = async (req, res) => {
  try {
    const { companyId, delta, note } = req.body;

    if (!companyId || delta === undefined) {
      return res
        .status(400)
        .json({ success: false, message: "companyId and delta are required" });
    }
    const amount = Number(delta);
    if (!Number.isFinite(amount) || amount === 0) {
      return res
        .status(400)
        .json({ success: false, message: "delta must be a non-zero number" });
    }
    if (!note || !String(note).trim()) {
      return res
        .status(400)
        .json({ success: false, message: "A note is required so the ledger stays auditable." });
    }

    const subscription = await credits.getActiveSubscription(companyId);
    if (!subscription) {
      return res
        .status(404)
        .json({ success: false, message: "No active subscription for this company." });
    }

    const updated = await credits.adjustCredits(subscription._id, amount, {
      type: "adjust",
      note: String(note).trim(),
      actorUserId: req.user.id,
      actorRole: req.user.role,
    });

    if (!updated) {
      return res.status(400).json({
        success: false,
        code: "INSUFFICIENT_CREDITS",
        message: "Balance is too low for that deduction.",
      });
    }

    return res.status(200).json({
      success: true,
      message: `Adjusted balance by ${amount > 0 ? "+" : ""}${amount} credits.`,
      data: credits.getAccountSnapshot(updated),
    });
  } catch (error) {
    console.error("Adjust Credits Error:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

/**
 * GET /api/credits/admin/overview
 *
 * Shows MODELLED margin next to MEASURED consumption. Never present the
 * modelled figure alone: the cost anchors assume prompt caching and Haiku
 * routing that are not implemented in the AI engine yet.
 */
exports.getAdminOverview = async (req, res) => {
  try {
    const internal = cm.PRICING.internal;

    const [totals] = await Subscription.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: null,
          activeSubscriptions: { $sum: 1 },
          totalAllowance: { $sum: "$credits.monthlyAllowance" },
          totalBalance: { $sum: "$credits.balance" },
          totalReserved: { $sum: "$credits.reserved" },
          totalCommitted: { $sum: "$credits.lifetimeCommitted" },
          mrrUsd: { $sum: { $ifNull: ["$priceUsdMonthly", 0] } },
        },
      },
    ]);

    const t = totals || {
      activeSubscriptions: 0,
      totalAllowance: 0,
      totalBalance: 0,
      totalReserved: 0,
      totalCommitted: 0,
      mrrUsd: 0,
    };

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const monthCommits = await CreditLedger.aggregate([
      { $match: { type: "commit", createdAt: { $gte: startOfMonth } } },
      { $group: { _id: null, credits: { $sum: { $abs: "$credits" } } } },
    ]);
    const creditsConsumedThisMonth = monthCommits[0] ? monthCommits[0].credits : 0;

    // Modelled only — see the note below and internal.optimisationsShipped.
    const rate = internal.optimisationsShipped
      ? internal.costPerCreditCheapUsd
      : internal.costPerCreditCheapUnoptimisedUsd;
    const modelledAiCostUsd = creditsConsumedThisMonth * rate;
    const infraUsd = internal.infraMonthlyUsd;
    const modelledCostUsd = modelledAiCostUsd + infraUsd;
    const modelledMarginPct =
      t.mrrUsd > 0 ? ((t.mrrUsd - modelledCostUsd) / t.mrrUsd) * 100 : null;

    return res.status(200).json({
      success: true,
      message: "Overview fetched successfully",
      data: {
        ...t,
        creditsConsumedThisMonth,
        mrrUsd: t.mrrUsd,
        modelled: {
          costPerCreditUsd: rate,
          aiCostUsd: Math.round(modelledAiCostUsd * 100) / 100,
          infraUsd,
          totalCostUsd: Math.round(modelledCostUsd * 100) / 100,
          marginPct: modelledMarginPct === null ? null : Math.round(modelledMarginPct * 10) / 10,
        },
        capacity: {
          creditsPerServerMonth: internal.creditsPerServerMonth,
          serversImplied: Math.ceil(
            creditsConsumedThisMonth / internal.creditsPerServerMonth
          ),
        },
        caveat:
          "Costs are MODELLED from the engine's loop ceilings, not measured — there is no token instrumentation in the AI backend yet." +
          (internal.optimisationsShipped
            ? ""
            : " Prompt caching and Haiku routing are also not implemented, so real costs are materially higher than the optimised anchors."),
      },
    });
  } catch (error) {
    console.error("Admin Overview Error:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

/** GET /api/credits/pricing — the public tier tables, minus internal costs. */
exports.getPricingConfig = async (req, res) => {
  try {
    // `modelRates` is stripped alongside `internal`. The per-token rates are
    // published by the providers, but pairing them with usdPerCredit hands any
    // visitor our gross margin on Managed plans. Authenticated Managed
    // customers get them on /account, where they are needed to render a live
    // meter; nobody else has a reason to see them.
    const { internal, modelRates, ...publicConfig } = cm.PRICING;
    return res.status(200).json({
      success: true,
      message: "Pricing config fetched successfully",
      data: publicConfig,
    });
  } catch (error) {
    console.error("Get Pricing Config Error:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};
