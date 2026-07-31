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

module.exports = {
  PRICING,
  CONSTANTS: F,
  PRICING_VERSION: PRICING.version,

  callsForStories,
  creditsForStories,
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