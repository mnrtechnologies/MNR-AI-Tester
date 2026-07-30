/**
 * usageBilling — turns recorded model calls into credit debits, for Managed
 * plans only.
 *
 * The engine writes token counts to `credit_usage` and stops there. This module
 * is the only thing that reads them, prices them, and moves money. Keeping the
 * conversion here (rather than in Python) means provider rate changes are a
 * config edit and a restart of Express, not a redeploy of the AI engine.
 *
 * BYOK plans are metered but not charged. Their customers pay the model
 * provider directly, so billing them per token would charge twice for one call.
 * Their rows are still marked billed (with zero credits) so they don't
 * accumulate forever and re-scan on every pass.
 */

const crypto = require("crypto");

const CreditUsage = require("../models/CreditUsage");
const User = require("../models/User");
const ExcelSheet = require("../models/ExcelSheet");
const credits = require("./creditService");
const um = require("../../src/config/pricing/usageMath");

// What the engine writes when it has no user in context.
const UNATTRIBUTED = "unknown";

// How many rows one pass will claim for a single user. A long run produces
// hundreds; bounding the batch keeps a single pass predictable and lets the
// next tick pick up the rest.
const MAX_ROWS_PER_PASS = 2000;

/**
 * Bill everything recorded since the last pass.
 *
 * The ordering here is the whole correctness argument:
 *
 *   1. CLAIM the rows (stamp a token) — an atomic updateMany that no second
 *      pass can match again.
 *   2. Read back exactly what we claimed.
 *   3. Debit once for the batch.
 *   4. Mark the claimed rows billed.
 *
 * Claiming before debiting is what makes this safe to crash. A crash between
 * (1) and (3) strands rows in a claimed-but-unbilled state where they are
 * visible and re-drivable, and — crucially — cannot be picked up and charged a
 * second time. The opposite order (debit, then mark) would double-charge on a
 * crash, which is the failure that actually costs a customer money.
 */
/**
 * Attach an owner to rows that arrived without one.
 *
 * The engine has several entry points — Celery tasks, direct FastAPI routes,
 * the visual-verify path — and not all of them carry a user in context. Rather
 * than chase every call site (and re-chase each new one someone adds), recover
 * the owner from the run itself: `user_excelsheet` records who a parent session
 * belongs to, and is already indexed on exactly that pair.
 *
 * Without this, a run started through an un-instrumented path is silently free.
 */
async function attributeOrphanRows() {
  const sessions = await CreditUsage.distinct("parent_session", {
    user_id: UNATTRIBUTED,
    billed: false,
    parent_session: { $ne: null },
  });
  if (!sessions.length) return 0;

  let fixed = 0;
  for (const parentSession of sessions) {
    const sheet = await ExcelSheet.findOne({ parent_session: parentSession })
      .select("user_id")
      .lean();
    if (!sheet?.user_id) continue; // genuinely unknown — leave it visible

    const res = await CreditUsage.updateMany(
      { parent_session: parentSession, user_id: UNATTRIBUTED, billed: false },
      { $set: { user_id: String(sheet.user_id) } }
    );
    fixed += res.modifiedCount || 0;
  }

  if (fixed) console.log(`🔗 attributed ${fixed} orphan usage rows to their owner`);
  return fixed;
}

async function billUnbilledUsage({ log = false } = {}) {
  const summary = { usersSeen: 0, charged: 0, skippedByok: 0, credits: 0, errors: [] };

  // Recover owners first, so rows rescued this pass are billed in this pass.
  try {
    summary.attributed = await attributeOrphanRows();
  } catch (err) {
    console.error("⚠️ orphan attribution failed:", err.message);
  }

  // Distinct users with pending rows. Billing is per company, but the engine
  // only knows user_id, so resolve through the user.
  const userIds = await CreditUsage.distinct("user_id", {
    billed: false,
    claimToken: null,
    // Anything still unattributed after the pass above has no recoverable
    // owner. Leave it unbilled and visible rather than guessing whose credits
    // to spend — a stuck row is a bug report, a wrong charge is a refund.
    user_id: { $ne: UNATTRIBUTED },
  });

  for (const userId of userIds) {
    summary.usersSeen++;
    try {
      const result = await billForUser(userId);
      if (result.skipped === "byok") summary.skippedByok++;
      else if (result.credits > 0) {
        summary.charged++;
        summary.credits += result.credits;
      }
      if (log && result.credits > 0) {
        console.log(
          `💳 metered ${result.credits} credits for user=${userId} ` +
            `(${result.calls} calls, $${result.usd.toFixed(4)})`
        );
      }
    } catch (err) {
      summary.errors.push({ userId, error: err.message });
      console.error(`⚠️ usage billing failed for user=${userId}:`, err.message);
    }
  }

  return summary;
}

async function billForUser(userId) {
  const token = crypto.randomUUID();
  const now = new Date();

  // --- 1. Claim. Atomic: a concurrent pass cannot match these rows again. ---
  const claim = await CreditUsage.updateMany(
    { user_id: String(userId), billed: false, claimToken: null },
    { $set: { claimToken: token, claimedAt: now } }
  );
  if (!claim.modifiedCount) return { credits: 0, calls: 0, usd: 0 };

  // --- 2. Read back exactly what we claimed. ---
  const rows = await CreditUsage.find({ claimToken: token })
    .limit(MAX_ROWS_PER_PASS)
    .lean();
  if (!rows.length) return { credits: 0, calls: 0, usd: 0 };

  const totals = um.summarize(rows);

  // --- Resolve the payer, and decide whether this plan is billed at all. ---
  const user = await User.findById(userId).select("companyId").lean();
  const subscription = user?.companyId
    ? await credits.getActiveSubscription(user.companyId)
    : null;

  const isManaged = subscription?.planType === "managed";

  if (!isManaged) {
    // BYOK, legacy, or no subscription: record the usage, charge nothing.
    // Marked billed so these rows stop being rescanned every 60 seconds.
    await CreditUsage.updateMany(
      { claimToken: token },
      {
        $set: {
          billed: true,
          billedAt: new Date(),
          chargedCredits: 0,
          chargedUsd: totals.usd,
          rateUnverified: totals.unverifiedRates,
        },
      }
    );
    return {
      skipped: subscription ? "byok" : "no_subscription",
      credits: 0,
      calls: rows.length,
      usd: totals.usd,
    };
  }

  // --- 3. Debit once for the whole batch. ---
  const parentSession = rows.find((r) => r.parent_session)?.parent_session || null;

  await credits.debitUsageCredits(subscription._id, totals.credits, {
    parentSession,
    amountUsd: totals.usd,
    note:
      `Metered: ${rows.length} model calls, ` +
      `${totals.inputTokens + totals.cacheReadTokens} in / ${totals.outputTokens} out` +
      (totals.unverifiedRates ? " (contains unverified rates)" : ""),
  });

  // --- 4. Mark billed. Safe to repeat; the rows are already claimed. ---
  await CreditUsage.updateMany(
    { claimToken: token },
    {
      $set: {
        billed: true,
        billedAt: new Date(),
        chargedCredits: totals.credits,
        chargedUsd: totals.usd,
        rateUnverified: totals.unverifiedRates,
      },
    }
  );

  return {
    credits: totals.credits,
    calls: rows.length,
    usd: totals.usd,
    unverifiedRates: totals.unverifiedRates,
  };
}

/**
 * Recover rows claimed by a pass that died before marking them billed.
 *
 * Without this they would sit claimed forever and never be charged. A claim
 * older than the cutoff means no live pass owns it, so release it back for the
 * next tick to pick up. Erring toward re-billing is wrong; erring toward a
 * delayed bill is fine, so the cutoff is generous.
 */
async function releaseStaleClaims(olderThanMinutes = 15) {
  const cutoff = new Date(Date.now() - olderThanMinutes * 60 * 1000);
  const result = await CreditUsage.updateMany(
    { billed: false, claimToken: { $ne: null }, claimedAt: { $lt: cutoff } },
    { $set: { claimToken: null, claimedAt: null } }
  );
  if (result.modifiedCount) {
    console.log(`♻️  released ${result.modifiedCount} stale usage claims`);
  }
  return result.modifiedCount;
}

/** Itemised breakdown of one run, for the UI and for support. */
async function usageForParentSession(parentSession, userId) {
  const rows = await CreditUsage.find({
    parent_session: parentSession,
    ...(userId ? { user_id: String(userId) } : {}),
  })
    .sort({ created_at: 1 })
    .lean();

  const totals = um.summarize(rows);
  return {
    parentSession,
    ...totals,
    settled: rows.length > 0 && rows.every((r) => r.billed),
  };
}

module.exports = {
  billUnbilledUsage,
  billForUser,
  releaseStaleClaims,
  usageForParentSession,
  MAX_ROWS_PER_PASS,
};
