/**
 * mobileCreditMath — CommonJS port of the mobile backend's own
 * creditMath.ts + pricing.constants.ts, so Express can recompute the
 * SAME number server-side rather than trusting mobile_credit_usage's
 * stored creditsUsedEstimate blindly.
 *
 * CRITICAL: if EXPLORATION_CALLS / CALLS_PER_STORY / CALLS_PER_CREDIT /
 * MODEL_RATES change in the mobile backend's pricing.constants.ts,
 * mirror the change here too — same discipline as apiTestMath.js.
 */

const EXPLORATION_CALLS = 62;
const CALLS_PER_STORY = 50;
const CALLS_PER_CREDIT = 162;
const USD_PER_CREDIT = 0.5;

const MODEL_RATES_USD_PER_1M = {
  "claude-sonnet-4-6": { in: 3, out: 15 },
  "claude-sonnet-5": { in: 3, out: 15 },
  "claude-haiku-4-5": { in: 1, out: 5 },
  "claude-opus-5": { in: 5, out: 25 },
  "claude-opus-4-8": { in: 5, out: 25 },
  "gpt-4.1-mini-2025-04-14": { in: 0.4, out: 1.6 },
  "gpt-4o-mini": { in: 0.15, out: 0.6 },
};

// "Fail expensive, not free" — an unrecognized model is priced at the
// most expensive known rate rather than silently going unbilled.
const MOST_EXPENSIVE_RATE = { in: 5, out: 25 };

function getModelRate(model) {
  return MODEL_RATES_USD_PER_1M[model] ?? MOST_EXPENSIVE_RATE;
}

function creditsForTestCases(testCases) {
  const calls = EXPLORATION_CALLS + CALLS_PER_STORY * Math.max(0, testCases);
  const credits = Math.floor((2 * calls + CALLS_PER_CREDIT) / (2 * CALLS_PER_CREDIT));
  return Math.max(1, credits);
}

function platformTokensToCredits(inputTokens, outputTokens, model) {
  const rate = getModelRate(model);
  const usd = (inputTokens / 1_000_000) * rate.in + (outputTokens / 1_000_000) * rate.out;
  return usd / USD_PER_CREDIT;
}

/**
 * Price a mobile_credit_usage document.
 * Same shape as mobile's totalCreditsForRun(), fed by the Mongo doc directly.
 */
function priceMobileRun(doc) {
  const testCasesGenerated = doc.testCasesGenerated || 0;
  const platformKey = doc.platformKey || { inputTokens: 0, outputTokens: 0 };

  const baseCredits = creditsForTestCases(testCasesGenerated);
  const hasPlatformUsage =
    (platformKey.inputTokens || 0) > 0 || (platformKey.outputTokens || 0) > 0;
  const platformUsageCredits = hasPlatformUsage
    ? platformTokensToCredits(
        platformKey.inputTokens || 0,
        platformKey.outputTokens || 0,
        platformKey.model || "unknown"
      )
    : 0;

  // Round once, here, so the charged amount is a whole credit regardless
  // of how the estimate displayed mid-run.
  const totalCredits = Math.max(1, Math.round(baseCredits + platformUsageCredits));

  return {
    baseCredits,
    platformUsageCredits,
    totalCredits,
    testCasesGenerated,
  };
}

module.exports = {
  creditsForTestCases,
  platformTokensToCredits,
  priceMobileRun,
};