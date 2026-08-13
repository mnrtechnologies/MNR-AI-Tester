/**
 * apiTestMath — the credit model for API security scans.
 *
 * The capacity meter for `api_test_run`, exactly as creditMath.js is for web
 * testing. Same CommonJS rule and same reason: Express requires it to charge,
 * the React page imports it to display, and there is deliberately no second
 * implementation in the Python engine to drift out of sync. The engine records
 * two integers per run and stops — see API_Testing/pricing_limits.py.
 *
 * WHICH PLANS THIS APPLIES TO
 * ---------------------------
 * BYOK only, per pricing.data.json `meters`. BYOK customers pay their model
 * provider directly, so their credits meter OUR server capacity. Managed API
 * runs bill from `modelRates` against reported tokens, like every other Managed
 * run. Charging a Managed run on both meters would bill it twice.
 *
 * THE MODEL
 * ---------
 *   1 credit = ~236 seconds of engine time = ~118 generated test cases.
 *
 *   seconds = SECONDS_PER_TEST * tests
 *   credits = max(1, round(seconds / SECONDS_PER_CREDIT))
 *
 * Cost is driven by test count, not endpoint count. Phase 3 replays every
 * generated test against the target on a fixed delay, and that dominates the
 * run; endpoints only matter insofar as they produce tests. See `_calibration`
 * in pricing.data.json for the measurements behind the constants.
 *
 * A run that produced no tests still costs 1 credit. It logged in, crawled and
 * discovered endpoints before failing or finding nothing to test — real work on
 * a real server. This mirrors creditsForStories(0) === 1 on the web side.
 */

const PRICING = require("./pricing.data.json");

const A = PRICING.apiTestFormula;

/** Seconds of engine time a run generating `tests` cases is expected to take. */
function secondsForTests(tests) {
  return A.SECONDS_PER_TEST * normaliseTests(tests);
}

/**
 * Credits charged for an API scan that generated `tests` test cases.
 *
 * Integer arithmetic rather than Math.round for the same reason creditMath
 * uses it: JS rounds half-up and Python uses banker's rounding, so a value
 * landing exactly on .5 would disagree across the two languages.
 *
 *   round(a/b) == floor((2a + b) / 2b)   for positive integers
 */
function creditsForApiRun(tests) {
  const seconds = secondsForTests(tests);
  const credits = Math.floor(
    (2 * seconds + A.SECONDS_PER_CREDIT) / (2 * A.SECONDS_PER_CREDIT)
  );
  return Math.max(1, credits);
}

/**
 * True when a run produced more tests than we will bill without a human
 * looking. Not a hard cap — the run has already happened by the time anything
 * reads this — but a signal that a target blew past the expected envelope and
 * the charge is worth checking before it lands.
 */
function isOversizedRun(tests) {
  return normaliseTests(tests) > A.MAX_TESTS_PER_RUN;
}

function normaliseTests(tests) {
  const n = Number(tests);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

/**
 * Price one `api_test_run` document.
 *
 * `apiCount` is carried through for the ledger note and for support questions
 * ("why did this scan cost 3 credits?"), never used in the arithmetic.
 */
function priceApiRun(doc = {}) {
  const tests = normaliseTests(doc.test_count);
  const credits = creditsForApiRun(tests);
  return {
    credits,
    tests,
    apiCount: normaliseTests(doc.api_count),
    seconds: secondsForTests(tests),
    oversized: isOversizedRun(tests),
  };
}

module.exports = {
  secondsForTests,
  creditsForApiRun,
  isOversizedRun,
  priceApiRun,
  CONSTANTS: A,
};
