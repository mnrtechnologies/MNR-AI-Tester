/**
 * vaptTestMath — pricing for security-testing (VAPT) runs.
 *
 * Same meter family as specTestMath: BYOK plans are charged on worker seconds,
 * because the customer pays their own model provider directly. Unlike spec there
 * is no requirement count known before the run, so the estimate is a flat hold
 * and settlement charges the measured scan duration.
 */

const cm = require("../../src/config/pricing/creditMath");

/** What we hold at the gate, before the scan runs. */
function estimateVaptRun() {
  return cm.estimateVaptRun();
}

/**
 * What the run actually cost, from measured worker occupancy.
 *
 * Never returns 0 for a run that did work — a scan that held a worker but
 * recorded no duration (older row / died before recording) falls back to the
 * flat estimate rather than being given away.
 */
function priceVaptRun(doc) {
  const measuredMs = Number(doc?.duration_ms) || 0;

  if (measuredMs > 0) {
    return {
      credits: cm.creditsForVaptDuration(measuredMs),
      basis: "measured",
      seconds: Math.round(measuredMs / 1000),
      confirmed: doc?.confirmed_findings ?? null,
      total: doc?.total_findings ?? null,
      steps: doc?.steps ?? null,
    };
  }

  const est = cm.estimateVaptRun();
  return {
    credits: est.credits,
    basis: "estimated",
    seconds: null,
    confirmed: doc?.confirmed_findings ?? null,
    total: doc?.total_findings ?? null,
    steps: doc?.steps ?? null,
  };
}

module.exports = { estimateVaptRun, priceVaptRun };
