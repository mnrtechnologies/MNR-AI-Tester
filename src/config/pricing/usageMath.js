/**
 * usageMath — token usage to money to credits, for Managed plans.
 *
 * Pure functions, no database and no Mongoose, so this can be unit-tested and
 * reused from either side of the app. usageBilling.js applies these numbers to
 * real balances.
 *
 * CommonJS for the same reason as creditMath.js: Express requires it and
 * webpack imports it.
 *
 * This is the MANAGED meter. BYOK plans bill through creditMath.js instead —
 * see `meters` in pricing.data.json for why the two differ.
 */

const data = require("./pricing.data.json");

const USD_PER_CREDIT = data.usdPerCredit;
const RATES = data.modelRates.models;
const CACHE_READ_MULTIPLIER = data.modelRates._cacheMultipliers.read;
const CACHE_WRITE_MULTIPLIER = data.modelRates._cacheMultipliers.write;

/**
 * Cache ratios are per model, defaulting to the shared figures above.
 *
 * The defaults are Anthropic's, and they are wrong for most of OpenAI's line:
 * gpt-4o caches input at 0.5x its base rate and gpt-4.1-mini at 0.25x, not
 * 0.1x. Billing every provider at a flat 0.1x would under-charge a cached
 * gpt-4o token by 80%. Nothing exercises this yet — every engine reports
 * cacheReadTokens: 0 while internal.optimisationsShipped is false — which is
 * the whole reason to get it right now: the first run after caching ships
 * must bill correctly, not be discovered wrong from a margin report later.
 */
function cacheReadMultiplier(rate) {
  const m = Number(rate && rate.cacheReadMultiplier);
  return Number.isFinite(m) && m >= 0 ? m : CACHE_READ_MULTIPLIER;
}

function cacheWriteMultiplier(rate) {
  const m = Number(rate && rate.cacheWriteMultiplier);
  return Number.isFinite(m) && m >= 0 ? m : CACHE_WRITE_MULTIPLIER;
}

/**
 * Look up a model's rates.
 *
 * An unrecognised model is priced at the MOST EXPENSIVE configured rate, not
 * skipped and not zero. A model we have never seen is usually a model someone
 * just switched the engine to, and the failure that costs real money is
 * silently billing it as free. Over-charging is visible and refundable;
 * under-charging is neither.
 */
function rateFor(model) {
  const known = RATES[model];
  if (known) {
    return { ...known, model, fallback: false };
  }

  let worst = null;
  for (const [name, r] of Object.entries(RATES)) {
    if (!worst || r.outputUsdPerMTok > worst.outputUsdPerMTok) {
      worst = { ...r, model: name };
    }
  }

  return { ...worst, model, fallback: true, fallbackFrom: worst.model };
}

/**
 * Cost in USD of a single recorded call.
 *
 * Input tokens are split three ways because they bill at three different
 * rates: fresh input at a discount, cache reads at a discount, and cache
 * writes at a premium. Both discounts are per model — see cacheReadMultiplier.
 * The engine does no prompt caching today so the cache figures are zero — but
 * the arithmetic is here so that turning caching on shows up as a cost drop
 * rather than requiring a billing change.
 */
function costUsd(row) {
  const rate = rateFor(row.model);

  const inTok = Math.max(0, row.inputTokens || 0);
  const outTok = Math.max(0, row.outputTokens || 0);
  const cacheRead = Math.max(0, row.cacheReadTokens || 0);
  const cacheWrite = Math.max(0, row.cacheWriteTokens || 0);

  const usd =
    (inTok * rate.inputUsdPerMTok +
      cacheRead * rate.inputUsdPerMTok * cacheReadMultiplier(rate) +
      cacheWrite * rate.inputUsdPerMTok * cacheWriteMultiplier(rate) +
      outTok * rate.outputUsdPerMTok) /
    1_000_000;

  return { usd, rate };
}

/**
 * USD to credits. Fractional on purpose — a single model call is a tiny
 * fraction of a credit, and rounding each one up would inflate a 162-call run
 * by orders of magnitude. Rounding happens once, at the point of debit.
 */
function toCredits(usd) {
  return usd / USD_PER_CREDIT;
}

/** Round a fractional credit total for display and for the ledger. */
function roundCredits(credits) {
  return Math.round(credits * 10000) / 10000;
}

/**
 * Total a batch of usage rows.
 *
 * Sums in USD and converts once at the end. Converting per row and summing the
 * credits would accumulate float error across the hundreds of rows a single
 * run produces.
 */
function summarize(rows) {
  let usd = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheReadTokens = 0;
  let cacheWriteTokens = 0;
  let unverifiedRates = false;
  const byModel = {};
  const byAction = {};

  for (const row of rows) {
    const { usd: rowUsd, rate } = costUsd(row);
    usd += rowUsd;
    inputTokens += row.inputTokens || 0;
    outputTokens += row.outputTokens || 0;
    cacheReadTokens += row.cacheReadTokens || 0;
    cacheWriteTokens += row.cacheWriteTokens || 0;

    if (rate.fallback || rate.verified === false) unverifiedRates = true;

    byModel[row.model] = (byModel[row.model] || 0) + rowUsd;
    if (row.action) {
      byAction[row.action] = (byAction[row.action] || 0) + rowUsd;
    }
  }

  return {
    calls: rows.length,
    usd,
    credits: roundCredits(toCredits(usd)),
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheWriteTokens,
    // True when any row was priced at a guessed or unconfirmed rate — surface
    // it rather than presenting an uncertain number as exact.
    unverifiedRates,
    byModel,
    byAction,
  };
}

module.exports = {
  USD_PER_CREDIT,
  CACHE_READ_MULTIPLIER,
  CACHE_WRITE_MULTIPLIER,
  rateFor,
  cacheReadMultiplier,
  cacheWriteMultiplier,
  costUsd,
  toCredits,
  roundCredits,
  summarize,
};
