/**
 * specTestMath — pricing for test-case design runs.
 *
 * WHY THIS IS NOT PRICED LIKE WEB TESTING
 * ---------------------------------------
 * It used to reuse creditsForStories(), copied from dbTestMath. That was wrong
 * by roughly 50x. A web "story" is EXECUTED against a live browser and really
 * does cost ~50 model calls; a spec test case is a few lines of JSON and one
 * model call produces about seven of them. A 416-case document priced that way
 * came to 129 credits for ~60 model calls.
 *
 * BYOK plans meter our server capacity — those customers pay their model
 * provider directly, so charging them per token would bill twice for the same
 * call. So the unit here is worker seconds:
 *
 *   ESTIMATE   requirements x seconds-per-requirement(model)   (before the run)
 *   SETTLEMENT measured parse + design duration                (after the run)
 *
 * The estimate predicts from a per-model average so the gate can quote a price
 * up front; settlement charges the time actually consumed. They differ on
 * purpose — a run that was unusually fast should cost less, not the average.
 */

const cm = require("../../src/config/pricing/creditMath");

/** What we quote at the gate, before any design work happens. */
function estimateSpecRun({ requirements, model, parseDurationMs = 0 }) {
  const credits = cm.creditsForSpecRun(requirements, model, parseDurationMs);
  return {
    credits,
    requirements: Math.max(0, Number(requirements) || 0),
    model: model || null,
    secondsPerRequirement: cm.secondsPerRequirement(model),
    // Already spent by the time this is quoted — analysis runs before the gate.
    parseSeconds: Math.round((Number(parseDurationMs) || 0) / 1000),
    oversized: cm.isOversizedSpecRun(requirements),
    maxRequirements: cm.MAX_REQUIREMENTS_PER_RUN,
  };
}

/**
 * What the run actually cost.
 *
 * Falls back to the requirement-count estimate when durations are missing —
 * an older row, or a run that died before recording them. Never returns 0 for
 * a run that did work, because that would silently give the work away.
 */
function priceSpecTestRun(doc) {
  const measuredMs =
    (Number(doc?.design_duration_ms) || 0) + (Number(doc?.parse_duration_ms) || 0);

  if (measuredMs > 0) {
    const credits = cm.creditsForSpecDuration(measuredMs);
    return {
      credits,
      basis: "measured",
      seconds: Math.round(measuredMs / 1000),
      requirements: doc?.requirements_found ?? null,
      testCases: doc?.test_cases_generated ?? null,
      oversized: cm.isOversizedSpecRun(doc?.requirements_found),
    };
  }

  const credits = cm.creditsForSpecRun(doc?.requirements_found, doc?.model);
  return {
    credits,
    basis: "estimated",
    seconds: null,
    requirements: doc?.requirements_found ?? null,
    testCases: doc?.test_cases_generated ?? null,
    oversized: cm.isOversizedSpecRun(doc?.requirements_found),
  };
}

module.exports = {
  estimateSpecRun,
  priceSpecTestRun,
  MAX_REQUIREMENTS_PER_RUN: cm.MAX_REQUIREMENTS_PER_RUN,
};
