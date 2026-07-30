/**
 * creditService — the ONLY module permitted to mutate a credit balance.
 *
 * Every mutation is a conditional findOneAndUpdate with $inc. The filter and
 * the increment are evaluated atomically on a single document, so two racing
 * holds cannot both pass a `balance >= amount` check. Never use doc.save() to
 * change credits.*: save writes the whole document from a possibly-stale
 * snapshot and will clobber a concurrent $inc.
 *
 * The credit model, in one paragraph:
 *   calls   = 62 + 50 * stories ; credits = round(calls / 162), min 1.
 *   The 62 exploration calls are INSIDE that formula, so credits(0) === 1 and
 *   the 1 credit held per URL during discovery is a DOWN PAYMENT on that
 *   URL's total, not an extra charge. The top-up at the approval gate is
 *   therefore (total - alreadyHeld). See creditMath.js.
 */

const Subscription = require("../models/Subscription");
const CreditReservation = require("../models/CreditReservation");
const CreditLedger = require("../models/CreditLedger");
const ExcelSheet = require("../models/ExcelSheet");
const cm = require("../../src/config/pricing/creditMath");
// Pure settlement logic — kept out of this file so it can be unit-tested
// without dragging Mongoose into the test environment.
const { decideLine } = require("../../src/config/pricing/settlementRules");

/**
 * Enforcement kill switch. When false, estimates and balances are computed and
 * displayed exactly as normal but nothing is ever blocked and no credits are
 * held — which is what makes the rollout reversible with one env var.
 * Defaults to enforcing.
 */
const ENFORCED = process.env.CREDITS_ENFORCED !== "false";

/* ------------------------------------------------------------------ *
 * Internals
 * ------------------------------------------------------------------ */

/** Keep the deprecated planDetails mirror in step with credits.*. */
function mirrorSet(credits) {
  const allowance = credits.monthlyAllowance || 0;
  return {
    "planDetails.maxTestsAllowed": allowance,
    "planDetails.testsUsed": Math.max(0, allowance - (credits.balance || 0)),
  };
}

/**
 * Push the new balance to every teammate watching.
 *
 * Credits are company-scoped, not per-user: a run started by one person moves
 * the balance for everyone on the plan. Without this, two teammates can each
 * look at a stale "1,000 credits" and both believe they can afford a full run.
 *
 * Best-effort by construction. The socket layer is a notification, never a
 * source of truth — if it throws, the money movement has already happened and
 * clients recover on their next poll.
 */
function emitCreditUpdate(sub) {
  try {
    if (!global.io || !sub?.companyId) return;
    global.io.to(`company:${sub.companyId}`).emit("credits:update", {
      account: getAccountSnapshot(sub),
      at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("⚠️ credit socket emit failed:", err.message);
  }
}

async function writeLedger(entry) {
  try {
    return await CreditLedger.create(entry);
  } catch (err) {
    // A failed audit row must never fail the transaction that produced it —
    // the money movement already happened and is the thing that matters.
    console.error("⚠️ credit ledger write failed:", err.message, entry.type);
    return null;
  }
}

function activeFilter(subscriptionId) {
  return {
    _id: subscriptionId,
    isActive: true,
    endDate: { $gt: new Date() },
  };
}

/** Resolve the company's live subscription, or null. */
async function getActiveSubscription(companyId) {
  if (!companyId) return null;
  return Subscription.findOne({ companyId, isActive: true });
}

/* ------------------------------------------------------------------ *
 * Balance mutations
 * ------------------------------------------------------------------ */

/**
 * Move `amount` from balance to reserved.
 * Returns the updated subscription, or null when the balance is insufficient
 * or the subscription is inactive/expired. Callers map null to HTTP 402.
 */
async function holdCredits(subscriptionId, amount, meta = {}) {
  if (amount <= 0) return Subscription.findById(subscriptionId);

  const sub = await Subscription.findOneAndUpdate(
    { ...activeFilter(subscriptionId), "credits.balance": { $gte: amount } },
    { $inc: { "credits.balance": -amount, "credits.reserved": amount } },
    { returnDocument: "after" }
  );
  if (!sub) return null;

  await Subscription.updateOne({ _id: sub._id }, { $set: mirrorSet(sub.credits) });

  await writeLedger({
    companyId: sub.companyId,
    subscriptionId: sub._id,
    reservationId: meta.reservationId || null,
    type: "hold",
    credits: -amount,
    balanceAfter: sub.credits.balance,
    reservedAfter: sub.credits.reserved,
    parentSession: meta.parentSession || null,
    actorUserId: meta.actorUserId || null,
    actorRole: meta.actorRole || null,
    note: meta.note || null,
  });

  emitCreditUpdate(sub);
  return sub;
}

/** Move `amount` out of reserved permanently — the work was performed. */
async function commitCredits(subscriptionId, amount, meta = {}) {
  if (amount <= 0) return Subscription.findById(subscriptionId);

  const sub = await Subscription.findOneAndUpdate(
    { _id: subscriptionId, "credits.reserved": { $gte: amount } },
    {
      $inc: {
        "credits.reserved": -amount,
        "credits.lifetimeCommitted": amount,
      },
      $set: { "planDetails.lastTestDate": new Date() },
    },
    { returnDocument: "after" }
  );
  if (!sub) return null;

  await Subscription.updateOne({ _id: sub._id }, { $set: mirrorSet(sub.credits) });

  await writeLedger({
    companyId: sub.companyId,
    subscriptionId: sub._id,
    reservationId: meta.reservationId || null,
    type: "commit",
    credits: -amount,
    balanceAfter: sub.credits.balance,
    reservedAfter: sub.credits.reserved,
    parentSession: meta.parentSession || null,
    sessionId: meta.sessionId || null,
    pageUrl: meta.pageUrl || null,
    storyCount: meta.storyCount != null ? meta.storyCount : null,
    note: meta.note || null,
  });

  emitCreditUpdate(sub);
  return sub;
}

/** Move `amount` from reserved back to balance — nothing was spent. */
async function releaseCredits(subscriptionId, amount, meta = {}) {
  if (amount <= 0) return Subscription.findById(subscriptionId);

  const sub = await Subscription.findOneAndUpdate(
    { _id: subscriptionId, "credits.reserved": { $gte: amount } },
    { $inc: { "credits.reserved": -amount, "credits.balance": amount } },
    { returnDocument: "after" }
  );
  if (!sub) return null;

  await Subscription.updateOne({ _id: sub._id }, { $set: mirrorSet(sub.credits) });

  await writeLedger({
    companyId: sub.companyId,
    subscriptionId: sub._id,
    reservationId: meta.reservationId || null,
    type: "release",
    credits: amount,
    balanceAfter: sub.credits.balance,
    reservedAfter: sub.credits.reserved,
    parentSession: meta.parentSession || null,
    sessionId: meta.sessionId || null,
    note: meta.note || null,
  });

  emitCreditUpdate(sub);
  return sub;
}

/** Super-admin grant or correction. Signed: negative removes credits. */
async function adjustCredits(subscriptionId, delta, meta = {}) {
  const filter = { _id: subscriptionId };
  if (delta < 0) filter["credits.balance"] = { $gte: Math.abs(delta) };

  const inc = { "credits.balance": delta };
  if (delta > 0) inc["credits.lifetimeGranted"] = delta;

  const sub = await Subscription.findOneAndUpdate(
    filter,
    { $inc: inc },
    { returnDocument: "after" }
  );
  if (!sub) return null;

  await Subscription.updateOne({ _id: sub._id }, { $set: mirrorSet(sub.credits) });

  await writeLedger({
    companyId: sub.companyId,
    subscriptionId: sub._id,
    type: meta.type || "adjust",
    credits: delta,
    balanceAfter: sub.credits.balance,
    reservedAfter: sub.credits.reserved,
    actorUserId: meta.actorUserId || null,
    actorRole: meta.actorRole || null,
    note: meta.note || null,
  });

  emitCreditUpdate(sub);
  return sub;
}

/**
 * Debit for metered usage on a Managed plan — work that has ALREADY happened.
 *
 * Deliberately different from holdCredits in two ways:
 *
 *   1. No reserve step. There is nothing to hold: pay-as-you-go bills after the
 *      model call, not before it.
 *   2. It ALLOWS THE BALANCE TO GO NEGATIVE. This is the one place in the
 *      service without a sufficiency guard, and that is intentional — the
 *      alternative is refusing to record spend that a provider has already
 *      billed us for, which loses the money and the audit trail together.
 *      A customer who overruns mid-run finishes their run and lands in
 *      overage; the guard against that belongs at run START, not here.
 *
 * Returns the updated subscription, or null if it no longer exists.
 */
async function debitUsageCredits(subscriptionId, credits, meta = {}) {
  if (!(credits > 0)) return Subscription.findById(subscriptionId);

  const sub = await Subscription.findOneAndUpdate(
    { _id: subscriptionId },
    {
      $inc: {
        "credits.balance": -credits,
        "credits.lifetimeCommitted": credits,
      },
      $set: { "planDetails.lastTestDate": new Date() },
    },
    { returnDocument: "after" }
  );
  if (!sub) return null;

  await Subscription.updateOne({ _id: sub._id }, { $set: mirrorSet(sub.credits) });

  await writeLedger({
    companyId: sub.companyId,
    subscriptionId: sub._id,
    // Past the allowance the customer is in overage, and the ledger should say
    // so plainly rather than burying it in a generic "commit".
    type: sub.credits.balance < 0 ? "overage" : "commit",
    credits: -credits,
    balanceAfter: sub.credits.balance,
    reservedAfter: sub.credits.reserved,
    parentSession: meta.parentSession || null,
    sessionId: meta.sessionId || null,
    amountUsd: meta.amountUsd ?? null,
    note: meta.note || null,
  });

  emitCreditUpdate(sub);
  return sub;
}

/**
 * Grant a period's allowance. Used at activation, renewal, and monthly reset.
 * `mode` "set" replaces the balance (rolloverPolicy "none"); "add" tops it up.
 */
async function grantAllowance(subscriptionId, credits, { mode = "set", type = "grant", note, actorUserId, actorRole, nextResetAt } = {}) {
  const update = {
    $inc: { "credits.lifetimeGranted": credits },
    $set: {
      "credits.monthlyAllowance": credits,
      "credits.allowanceGrantedAt": new Date(),
      "credits.overageUsedThisPeriod": 0,
    },
  };
  if (nextResetAt) update.$set["credits.nextResetAt"] = nextResetAt;
  if (mode === "set") update.$set["credits.balance"] = credits;
  else update.$inc["credits.balance"] = credits;

  const sub = await Subscription.findOneAndUpdate(
    { _id: subscriptionId },
    update,
    { returnDocument: "after" }
  );
  if (!sub) return null;

  await Subscription.updateOne({ _id: sub._id }, { $set: mirrorSet(sub.credits) });

  await writeLedger({
    companyId: sub.companyId,
    subscriptionId: sub._id,
    type,
    credits,
    balanceAfter: sub.credits.balance,
    reservedAfter: sub.credits.reserved,
    actorUserId: actorUserId || null,
    actorRole: actorRole || null,
    note: note || null,
  });

  emitCreditUpdate(sub);
  return sub;
}

/* ------------------------------------------------------------------ *
 * Estimation
 * ------------------------------------------------------------------ */

/**
 * Price a run from MongoDB. The browser supplies only a parentSession — every
 * billable quantity is re-derived here from what the AI engine wrote.
 *
 * @param {string} parentSession
 * @param {string} userId  the AI engine stores user_id as a plain string
 * @param {{pendingOnly?: boolean}} opts
 */
async function computeEstimate(parentSession, userId, opts = {}) {
  const query = { parent_session: parentSession, user_id: String(userId) };
  if (opts.pendingOnly) query.phase3_status = "pending";

  const sheets = await ExcelSheet.find(query).lean();

  const priced = cm.priceRun(
    sheets.map((s) => ({
      sessionId: s.session_id,
      pageUrl: s.page_url,
      storyCount: s.story_count,
    }))
  );

  // What discovery already holds for this parent session, if anything.
  const phase2 = await CreditReservation.findOne({
    idempotencyKey: `${parentSession}:phase2`,
    status: "held",
  }).lean();

  const phase3 = await CreditReservation.findOne({
    idempotencyKey: `${parentSession}:phase3`,
  }).lean();

  const alreadyHeld = phase2 ? phase2.credits : 0;

  // credits(0) === 1 per URL, so the discovery hold is a down payment on the
  // same total. Charging totalCredits again would double-bill.
  const topUpRequired = Math.max(0, priced.totalCredits - alreadyHeld);

  return {
    parentSession,
    perUrl: priced.lines,
    urlCount: priced.urlCount,
    totalStories: priced.totalStories,
    totalCredits: priced.totalCredits,
    alreadyHeld,
    topUpRequired,
    oversizedUrls: priced.oversizedUrls,
    estimateIncomplete: priced.estimateIncomplete,
    alreadyAuthorized: !!phase3,
    authorizationStatus: phase3 ? phase3.status : null,
  };
}

/**
 * Discovery cannot know how many URLs a site has — the crawler only learns
 * that after Phase 1 finishes. So we hold the crawler's own page ceiling and
 * reconcile down as soon as the real count is known.
 */
async function reconcileExplorationHold(parentSession, userId) {
  const reservation = await CreditReservation.findOne({
    idempotencyKey: `${parentSession}:phase2`,
    status: "held",
  });
  if (!reservation) return null;

  const actualUrls = await ExcelSheet.countDocuments({
    parent_session: parentSession,
    user_id: String(userId),
  });

  // Nothing discovered yet — the crawl may still be running. Leave the cap.
  if (actualUrls <= 0) return reservation;

  const sheets = await ExcelSheet.find({
    parent_session: parentSession,
    user_id: String(userId),
  })
    .select("session_id page_url story_count")
    .lean();

  // Attach one line per discovered URL — exactly the 1-credit down payment
  // that credits(0) === 1 represents. Without lines, settleReservation has
  // nothing to decide against and would hand back credits for exploration
  // work that definitely ran.
  reservation.lines = sheets.map((s) => ({
    sessionId: s.session_id,
    pageUrl: s.page_url || "",
    storyCount: s.story_count ?? 0,
    credits: 1,
  }));

  const excess = reservation.credits - actualUrls;
  if (excess > 0) {
    const released = await releaseCredits(reservation.subscriptionId, excess, {
      reservationId: reservation._id,
      parentSession,
      note: `Discovery reconciled: ${actualUrls} URLs found, ${excess} of ${reservation.credits} held credits returned`,
    });
    if (!released) return reservation;

    reservation.credits = actualUrls;
    reservation.releasedCredits += excess;
  }

  await reservation.save();
  return reservation;
}

/* ------------------------------------------------------------------ *
 * Settlement
 * ------------------------------------------------------------------ */

/**
 * Settle a reservation. Idempotent and safe to call concurrently from the
 * browser and the reconciler: the reservation row is flipped with a
 * conditional update BEFORE the balance moves, so a loser of that race skips
 * the money movement entirely.
 */
async function settleReservation(reservationId, { force = false } = {}) {
  const reservation = await CreditReservation.findById(reservationId);
  if (!reservation || reservation.status !== "held") {
    return { settled: false, reason: "not_held" };
  }

  const isExpired = force || reservation.expiresAt <= new Date();

  const sheets = await ExcelSheet.find({
    parent_session: reservation.parentSession,
  }).lean();
  const sheetBySession = new Map(sheets.map((s) => [s.session_id, s]));

  let toCommit = 0;
  let toRelease = 0;
  let undecided = 0;
  const lines = [];

  for (const line of reservation.lines) {
    const decision = decideLine(
      sheetBySession.get(line.sessionId),
      isExpired,
      reservation.scope
    );
    if (decision === "commit") {
      toCommit += line.credits;
      lines.push({ ...line.toObject(), settled: "committed" });
    } else if (decision === "release") {
      toRelease += line.credits;
      lines.push({ ...line.toObject(), settled: "released" });
    } else {
      undecided += line.credits;
      lines.push(line.toObject());
    }
  }

  // A phase2 reservation has no per-URL lines until it is reconciled; if the
  // TTL passed with nothing recorded, return the whole hold.
  if (reservation.lines.length === 0) {
    if (!isExpired) return { settled: false, reason: "still_running" };
    toRelease = reservation.credits;
  }

  if (undecided > 0 && !isExpired) {
    return { settled: false, reason: "still_running", undecided };
  }

  const finalStatus =
    undecided > 0
      ? "expired"
      : toCommit > 0 && toRelease > 0
        ? "partially_committed"
        : toCommit > 0
          ? "committed"
          : "released";

  // Flip the reservation FIRST. If another worker already did, we stop here
  // and never touch the balance — this is what makes settle idempotent.
  const claimed = await CreditReservation.findOneAndUpdate(
    { _id: reservation._id, status: "held" },
    {
      $set: {
        status: finalStatus,
        lines,
        committedCredits: toCommit,
        releasedCredits: toRelease + (undecided > 0 ? undecided : 0),
        committedAt: toCommit > 0 ? new Date() : null,
        releasedAt: toRelease > 0 ? new Date() : null,
      },
    },
    { returnDocument: "after" }
  );
  if (!claimed) return { settled: false, reason: "already_settled" };

  if (toCommit > 0) {
    await commitCredits(reservation.subscriptionId, toCommit, {
      reservationId: reservation._id,
      parentSession: reservation.parentSession,
      storyCount: reservation.storyCountTotal,
      note: isExpired ? "Settled by reconciler (TTL reached)" : "Run completed",
    });
  }

  const releaseTotal = toRelease + (undecided > 0 ? undecided : 0);
  if (releaseTotal > 0) {
    await releaseCredits(reservation.subscriptionId, releaseTotal, {
      reservationId: reservation._id,
      parentSession: reservation.parentSession,
      note: undecided > 0 ? "Reservation expired with work still undecided" : "Work never dispatched",
    });
  }

  return {
    settled: true,
    status: finalStatus,
    committed: toCommit,
    released: releaseTotal,
  };
}

/**
 * Give back the credits held for a run the user abandoned before executing.
 *
 * Deliberately limited to the phase3 hold. The phase2 discovery hold pays for
 * exploration that has already happened and been billed to us by the model
 * provider — refunding it just because the customer changed their mind about
 * Phase 3 would be giving away real spend. The reconciler settles that one
 * against the sheets the engine produced.
 */
async function releaseParentSession(parentSession, companyId) {
  const held = await CreditReservation.find({
    parentSession,
    companyId,
    status: "held",
    scope: "phase3",
  });
  let released = 0;

  for (const reservation of held) {
    const claimed = await CreditReservation.findOneAndUpdate(
      { _id: reservation._id, status: "held" },
      {
        $set: {
          status: "released",
          releasedCredits: reservation.credits,
          releasedAt: new Date(),
        },
      },
      { returnDocument: "after" }
    );
    if (!claimed) continue;

    await releaseCredits(reservation.subscriptionId, reservation.credits, {
      reservationId: reservation._id,
      parentSession,
      note: "Run abandoned before execution",
    });
    released += reservation.credits;
  }

  return released;
}

/* ------------------------------------------------------------------ *
 * Read models
 * ------------------------------------------------------------------ */

/**
 * The compact entitlement object the UI reads. Also the read-only fallback for
 * subscriptions that predate the migration, so an unmigrated company degrades
 * to the old numbers rather than erroring.
 *
 * Never include pricing.data.json's `internal` block here — it is super-admin
 * only and this object goes to every logged-in user.
 */
function getAccountSnapshot(sub) {
  if (!sub) return null;

  const tier = cm.getTier(sub.planType, sub.tierKey);
  const migrated = !!sub.pricingVersion;

  if (!migrated) {
    // Legacy fallback: synthesise a credit view from the old test quota so
    // nothing 404s or renders blank mid-migration.
    const allowance = sub.planDetails?.maxTestsAllowed || 0;
    const used = sub.planDetails?.testsUsed || 0;
    const unlimited = allowance === -1;
    return {
      legacy: true,
      meter: "capacity",
      // Everyone on a legacy plan supplies their own key, so they are never
      // charged for tokens they already paid their provider for.
      billsUsage: false,
      planType: "legacy",
      tierKey: sub.legacyPlan || null,
      tierName: sub.legacyPlan ? sub.legacyPlan.replace(/^\w/, (c) => c.toUpperCase()) : "Legacy plan",
      engine: null,
      concurrentSites: 1,
      balance: unlimited ? Number.MAX_SAFE_INTEGER : Math.max(0, allowance - used),
      reserved: 0,
      monthlyAllowance: unlimited ? Number.MAX_SAFE_INTEGER : allowance,
      unlimited,
      nextResetAt: null,
      overageEnabled: false,
      overageRateUsd: null,
      overageUsedThisPeriod: 0,
      isActive: sub.isActive,
      remainingDays: sub.remainingDays,
      endDate: sub.endDate,
    };
  }

  const c = sub.credits || {};
  return {
    legacy: false,
    // EVERY plan pays the capacity charge — the story formula, quoted up front
    // and approved before Phase 3. This is not a choice between two meters.
    meter: "capacity",

    // Managed plans pay that capacity charge AND the model usage on top,
    // because we are the ones buying the tokens. BYOK usage is still recorded
    // (useful for capacity planning) but never charged: that customer already
    // paid their own provider for those exact calls.
    //
    // So this flag only ever ADDS a charge. It never removes the capacity one.
    billsUsage: sub.planType === "managed",
    planType: sub.planType,
    tierKey: sub.tierKey,
    tierName: tier ? tier.name : sub.tierKey,
    engine: sub.engine,
    engineLabel: tier ? tier.engineLabel || null : null,
    concurrentSites: sub.concurrentSites || 1,
    balance: c.balance || 0,
    reserved: c.reserved || 0,
    monthlyAllowance: c.monthlyAllowance || 0,
    unlimited: false,
    nextResetAt: c.nextResetAt || null,
    rolloverPolicy: c.rolloverPolicy || "none",
    overageEnabled: !!c.overageEnabled,
    overageRateUsd: c.overageRateUsd,
    overageUsedThisPeriod: c.overageUsedThisPeriod || 0,
    lifetimeCommitted: c.lifetimeCommitted || 0,
    needsManualReview: !!c.needsManualReview,
    priceUsdMonthly: sub.priceUsdMonthly,
    pricingVersion: sub.pricingVersion,
    isActive: sub.isActive,
    remainingDays: sub.remainingDays,
    endDate: sub.endDate,
    lowCreditThreshold: Math.ceil(((c.monthlyAllowance || 0) * cm.LOW_CREDIT_WARN_PCT) / 100),
  };
}

/** Snapshot for a company, resolving the active subscription first. */
async function getAccountSnapshotForCompany(companyId) {
  const sub = await getActiveSubscription(companyId);
  return { subscription: sub, snapshot: getAccountSnapshot(sub) };
}

module.exports = {
  ENFORCED,
  holdCredits,
  commitCredits,
  releaseCredits,
  adjustCredits,
  debitUsageCredits,
  grantAllowance,
  computeEstimate,
  reconcileExplorationHold,
  settleReservation,
  releaseParentSession,
  getAccountSnapshot,
  getAccountSnapshotForCompany,
  getActiveSubscription,
  writeLedger,
  mirrorSet,
  decideLine,
};
