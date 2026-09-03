/**
 * dbTestMath — pricing for database diagnostic and assessment runs.
 *
 * WHY THIS NO LONGER PRICES ON creditsForStories()
 * ------------------------------------------------
 * It used to. specTestMath.js opens by explaining that it inherited exactly
 * that mistake FROM THIS FILE — "It used to reuse creditsForStories(), copied
 * from dbTestMath. That was wrong by roughly 50x." The copy was fixed; the
 * original never was.
 *
 * The error is the same one in both places. A web "story" is EXECUTED against
 * a live browser and genuinely costs ~50 model calls, which is what
 * creditsForStories() prices. A database test case is a SQL statement the
 * assessment generates and runs. Charging it as a browser story priced a
 * 141-test-case assessment at 44 credits for a few minutes of server time.
 *
 * WHAT IT PRICES ON INSTEAD
 * -------------------------
 * Measured worker seconds, like every other BYOK meter on this platform
 * (spec, VAPT, perf, code). The Go service has reported `durationMs` all
 * along — api/internal/services/usage.go labelled the field "kept for
 * logging/future tiering, not pricing" — so the metric this needed was
 * already arriving and being ignored in favour of a guess.
 *
 * That also disposes of the calibration problem rather than solving it. The
 * old OBJECTS_PER_CREDIT_BY_TYPE table carried a comment conceding it was
 * guesswork ("calibrate karna baaki hai apne data se"), and its numbers said a
 * PostgreSQL diagnostic that walked 3 tables cost a full credit — 236 seconds
 * of server time — while a Redis scan could walk 10,000 keys for the same
 * credit, a 3,300x spread nobody had measured. Duration needs no such table.
 *
 * Constants live in pricing.data.json under `dbTestFormula`, so this can be
 * repriced without a deploy.
 */

const cm = require("../../src/config/pricing/creditMath");

const D = cm.PRICING.dbTestFormula;

function nonNegative(n) {
  const v = Number(n);
  return Number.isFinite(v) && v > 0 ? v : 0;
}

/**
 * Seconds to credits, clamped and floored at 1.
 *
 * ceil() rather than round(): a run that consumed any worker time at all cost
 * us something, and the platform's other duration meters all round up.
 */
function creditsForSeconds(seconds) {
  const billable = Math.min(nonNegative(seconds), D.MAX_BILLABLE_SECONDS_PER_RUN);
  if (billable === 0) return 0;
  return Math.max(1, Math.ceil(billable / D.SECONDS_PER_CREDIT));
}

/**
 * Fallback for a row with no recorded duration.
 *
 * Estimates the seconds the work would have taken rather than reaching for a
 * different unit, so the fallback and the real meter produce comparable
 * numbers instead of two unrelated prices. Never returns 0 for a run that did
 * work — that would silently give it away.
 */
function fallbackSeconds(doc) {
  if (doc.job_type === "full_assessment") {
    return nonNegative(doc.testCasesGenerated) * D.FALLBACK_SECONDS_PER_TEST_CASE;
  }
  return nonNegative(doc.objectsScanned) * D.FALLBACK_SECONDS_PER_OBJECT;
}

/**
 * What one finished run cost.
 *
 * @returns {{credits, basis, seconds, oversized}} — `basis` distinguishes a
 * measured charge from an estimated one, so a support question about a bill
 * can be answered without guessing which path produced it.
 */
function priceDbTestRun(doc) {
  const measuredSeconds = nonNegative(doc?.durationMs) / 1000;

  if (measuredSeconds > 0) {
    const credits = creditsForSeconds(measuredSeconds);
    return {
      credits,
      basis: "measured",
      seconds: Math.round(measuredSeconds),
      oversized: credits > D.OVERSIZED_CREDITS,
    };
  }

  const seconds = fallbackSeconds(doc || {});
  const credits = creditsForSeconds(seconds);
  return {
    credits,
    basis: "estimated",
    seconds: Math.round(seconds),
    oversized: credits > D.OVERSIZED_CREDITS,
  };
}

module.exports = {
  priceDbTestRun,
  creditsForSeconds,
  fallbackSeconds,
  DB_SECONDS_PER_CREDIT: D.SECONDS_PER_CREDIT,
  DB_MAX_BILLABLE_SECONDS_PER_RUN: D.MAX_BILLABLE_SECONDS_PER_RUN,
};
