/**
 * creditMath — the single source of truth for the credit pricing model.
 *
 * WHY THIS FILE IS COMMONJS
 * -------------------------
 * It is consumed by BOTH sides of the product:
 *   - the Express backend, via `require("../../src/config/pricing/creditMath")`
 *   - the React frontend, via `import { creditsForStories } from ".../creditMath"`
 * webpack handles CJS interop transparently; Node cannot handle ESM here.
 * Do not convert this to `export`/`import` syntax — it will break the backend.
 *
 * WHY PYTHON HAS NO COPY OF THIS
 * ------------------------------
 * The AI engine reports facts (how many stories a URL produced). Express prices
 * them. There is deliberately no second implementation of this formula to drift.
 * See MNR_AI_Tester-AI_Backend-Web_Testing/pricing_limits.py.
 *
 * THE MODEL
 * ---------
 *   1 credit = 1 URL with up to 2 test stories ~= 162 model calls.
 *
 *   calls   = EXPLORATION_CALLS + CALLS_PER_STORY * stories
 *   credits = max(1, round(calls / CALLS_PER_CREDIT))
 *
 * READ THIS BEFORE CHANGING ANY CHARGING LOGIC:
 * The 62 exploration calls are INSIDE the same formula, so a URL's TOTAL cost
 * (Phase 2 exploration + Phase 3 execution) is exactly `creditsForStories(n)`,
 * and `creditsForStories(0) === 1`. The 1 credit held per URL during discovery
 * is therefore a DOWN PAYMENT on that same total, not an additional charge.
 * A 20-story URL costs 7 credits total: 1 held at discovery, 6 topped up at the
 * approval gate. Any other reading double-bills the customer.
 */

const RAW_PRICING = require("./pricing.data.json");

// 1. Determine the dynamic exchange rate from env, falling back to the JSON file
const FX_INR_PER_USD = Number(
  process.env.REACT_APP_FX_INR_PER_USD 
);

// 2. Clone and mutate the PRICING object so the rest of the file 
// and external consumers use the injected live rate consistently.
const PRICING = {
  ...RAW_PRICING,
  fx: {
    ...RAW_PRICING.fx,
    inrPerUsd: FX_INR_PER_USD,
  },
};

const F = PRICING.formula;

/* ------------------------------------------------------------------ *
 * Core formula
 * ------------------------------------------------------------------ */

/** Model calls a URL with `stories` test stories will make. */
function callsForStories(stories) {
  const n = normaliseStories(stories);
  return F.EXPLORATION_CALLS + F.CALLS_PER_STORY * n;
}

/**
 * Credits charged for a URL with `stories` test stories.
 *
 * Uses integer arithmetic rather than Math.round(calls / CALLS_PER_CREDIT)
 * on purpose. JS `Math.round` is half-up while Python's `round` is banker's
 * rounding; no story count in 1..20 currently lands on a .5 boundary so the
 * two happen to agree today, but that is luck, not a guarantee once the
 * constants are recalibrated. This form is exact and language-independent:
 *
 *   round(a/b)  ==  floor((2a + b) / 2b)     for positive integers
 */
function creditsForStories(stories) {
  const calls = callsForStories(stories);
  const credits = Math.floor(
    (2 * calls + F.CALLS_PER_CREDIT) / (2 * F.CALLS_PER_CREDIT)
  );
  return Math.max(1, credits);
}

/** True when a single URL produced more stories than we will run unattended. */
function isOversized(stories) {
  return normaliseStories(stories) > F.MAX_STORIES_PER_URL;
}

function normaliseStories(stories) {
  const n = Number(stories);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

/**
 * Price a whole run.
 *
 * @param {Array<{sessionId?, pageUrl?, storyCount?}>} sheets
 * @returns {{lines: Array, totalStories: number, totalCredits: number,
 *             urlCount: number, oversizedUrls: Array, estimateIncomplete: boolean}}
 *
 * A sheet whose storyCount is null/undefined has never been through Phase
 * Review, so we have no authoritative count for it. We price it at the
 * MAX_STORIES_PER_URL ceiling — fail expensive, not free — and flag the
 * estimate as incomplete so the UI can tell the user to open the review tab
 * for an exact quote.
 */
function priceRun(sheets) {
  const list = Array.isArray(sheets) ? sheets : [];
  let estimateIncomplete = false;

  const lines = list.map((s) => {
    const known = s.storyCount !== null && s.storyCount !== undefined;
    if (!known) estimateIncomplete = true;

    const storyCount = known
      ? normaliseStories(s.storyCount)
      : F.MAX_STORIES_PER_URL;

    return {
      sessionId: s.sessionId || null,
      pageUrl: s.pageUrl || "",
      storyCount,
      storyCountKnown: known,
      calls: callsForStories(storyCount),
      credits: creditsForStories(storyCount),
      oversized: isOversized(storyCount),
    };
  });

  return {
    lines,
    urlCount: lines.length,
    totalStories: lines.reduce((a, l) => a + l.storyCount, 0),
    totalCredits: lines.reduce((a, l) => a + l.credits, 0),
    oversizedUrls: lines.filter((l) => l.oversized),
    estimateIncomplete,
  };
}

/**
 * How long a reservation may sit "held" before the reconciler settles it.
 *
 * app.py applies a 300s timeout PER STORY, so a max-size URL can legitimately
 * run for ~100 minutes. A fixed TTL that is too short releases credits
 * mid-run and then commits them again, producing a ledger nobody can read.
 */
function reservationTtlMinutes(totalStories) {
  const t = PRICING.reservationTtl;
  return Math.max(t.minMinutes, normaliseStories(totalStories) * t.minutesPerStory);
}

/* ------------------------------------------------------------------ *
 * Tiers
 * ------------------------------------------------------------------ */

function listPlanTypes() {
  return Object.values(PRICING.planTypes).map((pt) => ({
    key: pt.key,
    label: pt.label,
    shortLabel: pt.shortLabel,
    lead: !!pt.lead,
    blurb: pt.blurb,
  }));
}

function leadPlanTypeKey() {
  const lead = Object.values(PRICING.planTypes).find((pt) => pt.lead);
  return lead ? lead.key : Object.keys(PRICING.planTypes)[0];
}

/** All tiers for a plan type, in display order. Returns [] for unknown types. */
function listTiers(planTypeKey) {
  const pt = PRICING.planTypes[planTypeKey];
  return pt ? pt.tiers.slice() : [];
}

/** A single tier, or null when either key is unknown. Never throws. */
function getTier(planTypeKey, tierKey) {
  const pt = PRICING.planTypes[planTypeKey];
  if (!pt) return null;
  return pt.tiers.find((t) => t.key === tierKey) || null;
}

/** Convenience for error messages and admin selects. */
function allTierKeys(planTypeKey) {
  return listTiers(planTypeKey).map((t) => t.key);
}

/* ------------------------------------------------------------------ *
 * Money
 * ------------------------------------------------------------------ */

/** USD is canonical. Never store an INR literal anywhere. */
function usdToInr(usd) {
  if (usd === null || usd === undefined) return null;
  return Math.round(Number(usd) * PRICING.fx.inrPerUsd);
}

/** Six-month price, derived — the spec ships no explicit semi-annual figures. */
function semiAnnualUsd(monthlyUsd) {
  if (monthlyUsd === null || monthlyUsd === undefined) return null;
  const gross = Number(monthlyUsd) * 6;
  return Math.round(gross * (1 - PRICING.semiAnnualDiscountPct / 100));
}

function formatPrice(usd, currency) {
  if (usd === null || usd === undefined) return "Custom";
  if (currency === "INR") return "₹" + usdToInr(usd).toLocaleString("en-IN");
  return "$" + Number(usd).toLocaleString("en-US");
}

/* ------------------------------------------------------------------ *
 * Exports
 * ------------------------------------------------------------------ */


/* ------------------------------------------------------------------ *
 * Test Case Designer (spec_test_run)
 *
 * A different meter from web testing, because the work is different. A web
 * "story" is EXECUTED against a live browser and costs ~50 model calls; a spec
 * test case is a few lines of JSON, and one model call produces about seven of
 * them. Pricing spec runs with creditsForStories() overcharges by ~50x.
 *
 * So this meters what a run actually consumes: worker seconds. Requirements
 * drive that (one call each), which is also why the estimate is honest — the
 * requirement count is known BEFORE the expensive phase, so the customer can be
 * told the price before committing.
 * ------------------------------------------------------------------ */

const SF = PRICING.specTestFormula;

/** Seconds one requirement takes on a given model. Unmeasured models get the pessimistic default. */
function secondsPerRequirement(model) {
  return (
    (model && SF.SECONDS_PER_REQUIREMENT_BY_MODEL[model]) ||
    SF.SECONDS_PER_REQUIREMENT_DEFAULT
  );
}

/**
 * ESTIMATE — what a run will cost, quoted at the gate.
 *
 * Two parts, and only one of them is a prediction:
 *
 *   parseMs        ALREADY MEASURED. Analysis has finished by the time we
 *                  quote, so its duration is a fact, not a guess. Leaving it
 *                  out made the quote systematically low — the parse phase is
 *                  ~28s of real worker time that settlement charges for, which
 *                  on a small document is the whole difference between 1 credit
 *                  and 2.
 *   design         predicted, from the per-model rate.
 *
 * Both go through the same ceil() as creditsForSpecDuration(), so the quote and
 * the charge agree unless the run itself deviates from the model's average.
 */
function creditsForSpecRun(requirements, model, parseMs = 0) {
  const n = Math.max(0, Math.floor(Number(requirements) || 0));
  if (n === 0) return 0;
  const measuredParse = Math.max(0, Number(parseMs) || 0) / 1000;
  const predictedDesign = n * secondsPerRequirement(model);
  return Math.max(
    1,
    Math.ceil((measuredParse + predictedDesign) / SF.SECONDS_PER_CREDIT),
  );
}

/**
 * SETTLEMENT — what a run actually cost, from measured worker occupancy.
 *
 * Deliberately not the estimate: the estimate predicts from a per-model average,
 * this is the real time the run held a worker. A capacity meter should charge
 * for capacity actually consumed.
 */
function creditsForSpecDuration(durationMs) {
  const seconds = Math.max(0, Number(durationMs) || 0) / 1000;
  if (seconds === 0) return 0;
  return Math.max(1, Math.ceil(seconds / SF.SECONDS_PER_CREDIT));
}

/** Documents past this need explicit confirmation rather than a silent bill. */
function isOversizedSpecRun(requirements) {
  return (Number(requirements) || 0) > SF.MAX_REQUIREMENTS_PER_RUN;
}

module.exports = {
  PRICING,
  CONSTANTS: F,
  PRICING_VERSION: PRICING.version,

  callsForStories,
  creditsForStories,

  secondsPerRequirement,
  creditsForSpecRun,
  creditsForSpecDuration,
  isOversizedSpecRun,
  MAX_REQUIREMENTS_PER_RUN: SF.MAX_REQUIREMENTS_PER_RUN,
  SPEC_SECONDS_PER_CREDIT: SF.SECONDS_PER_CREDIT,
  isOversized,
  priceRun,
  reservationTtlMinutes,

  listPlanTypes,
  leadPlanTypeKey,
  listTiers,
  getTier,
  allTierKeys,

  usdToInr,
  semiAnnualUsd,
  formatPrice,

  MAX_STORIES_PER_URL: F.MAX_STORIES_PER_URL,
  PHASE2_MAX_URLS: F.PHASE2_MAX_URLS,
  LOW_CREDIT_WARN_PCT: PRICING.lowCreditWarnPct,
  FX_INR_PER_USD: PRICING.fx.inrPerUsd,
  LEGACY_TEST_TO_CREDIT_FACTOR: PRICING.legacyTestToCreditFactor,
};