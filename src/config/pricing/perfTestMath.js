/**
 * perfTestMath — the credit model for PERFORMANCE / load test runs.
 *
 * The capacity meter for `perf_runs`, the analogue of creditMath.js (web) and
 * apiTestMath.js (API scans). Same CommonJS rule and same reason: Express
 * requires it to charge, the React page imports it to display, and there is
 * deliberately no second implementation in the Python engine to drift out of
 * sync. That engine records three integers per run and stops — see
 * MNR_AT_Performance_Testing/limits.py ("DO NOT ADD PRICING LOGIC").
 *
 * WHICH PLANS THIS APPLIES TO
 * ---------------------------
 * BYOK only, per pricing.data.json `meters`, exactly like every other capacity
 * meter here. Managed runs bill from `modelRates` against reported tokens.
 *
 * WHY PERFORMANCE RUNS NEED THEIR OWN METER
 * -----------------------------------------
 * Every other engine does roughly one thing at a time: one browser, or one
 * request stream. A load test deliberately does the opposite — it holds many
 * concurrent connections open for the whole phase, each a live greenlet with
 * its own socket. Wall-clock seconds alone cannot tell a 2-user run from a
 * 200-user one, yet they cost this platform very differently, so charging perf
 * runs on plain duration (as apiTestMath does) would undercharge exactly the
 * runs that consume the most.
 *
 * THE MODEL
 * ---------
 *   billableSeconds = engineSeconds + vuSeconds / VU_SECONDS_PER_ENGINE_SECOND
 *   credits         = max(1, round(billableSeconds / SECONDS_PER_CREDIT))
 *
 * Two components, because a perf run has two genuinely different cost phases:
 *
 *   - `engineSeconds` covers the whole run end to end, and prices the
 *     single-threaded work: browser discovery (5-15 min per persona on a
 *     mixed run), planning, scenario generation, analysis, reporting. This is
 *     the same kind of cost apiTestMath meters.
 *
 *   - `vuSeconds` (concurrent users x seconds held) prices the load itself,
 *     divided down because N virtual users cost far less than N separate
 *     runs — they share one process and one event loop. The divisor is what
 *     expresses "concurrency is cheaper than duration, but not free".
 *
 * A run that generated no load at all still costs at least 1 credit: it
 * planned, drove a real browser, and discovered endpoints before failing or
 * being cancelled. Mirrors creditsForStories(0) === 1 and apiTestMath's
 * minimum for a scan that produced no tests.
 */

const PRICING = require("./pricing.data.json");

const P = PRICING.perfTestFormula;

function nonNegative(n) {
  const v = Number(n);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
}

/**
 * Duration-equivalent seconds a run is charged for: its real wall-clock time
 * plus a concurrency surcharge derived from how much load it actually drove.
 */
function billableSeconds({ engineSeconds, vuSeconds }) {
  const wall = nonNegative(engineSeconds);
  const load = nonNegative(vuSeconds) / P.VU_SECONDS_PER_ENGINE_SECOND;
  return Math.min(wall + load, P.MAX_BILLABLE_SECONDS_PER_RUN);
}

/**
 * Credits charged for one performance run.
 *
 * Integer arithmetic rather than Math.round for the same reason creditMath
 * uses it: JS rounds half-up and Python uses banker's rounding, so a value
 * landing exactly on .5 would disagree across the two languages.
 *
 *   round(a/b) == floor((2a + b) / 2b)   for positive integers
 */
function creditsForRun({ engineSeconds, vuSeconds }) {
  const secs = Math.floor(billableSeconds({ engineSeconds, vuSeconds }));
  const b = P.SECONDS_PER_CREDIT;
  return Math.max(1, Math.floor((2 * secs + b) / (2 * b)));
}

/**
 * The same three facts the engine records at the END of a run, derived for a
 * run that is still going.
 *
 * A perf run's cost accrues the whole time it is running, but the engine only
 * writes engine_seconds/vu_seconds once the run reaches a terminal state (see
 * db.py::_load_facts, which this mirrors exactly). Billing purely off those
 * final numbers means the balance sits perfectly still through a forty-minute
 * load test and then lurches, which reads as "credits aren't being charged"
 * -- every other meter here ticks down mid-run, and this one should too.
 *
 * Deliberately mirrors the engine's own derivation rather than inventing a
 * second one: wall-clock since created_at, plus vus_avg x phase duration
 * summed over whatever phases have finished so far. Phases still in flight
 * contribute no VU-seconds yet, so the live number only ever UNDER-states the
 * final one -- it converges up to it, and can never overshoot into a refund.
 */
function liveFacts(doc, nowMs = Date.now()) {
  const created = doc.created_at ? new Date(doc.created_at).getTime() : NaN;
  const engineSeconds = Number.isFinite(created)
    ? Math.max(0, Math.floor((nowMs - created) / 1000))
    : 0;

  let vuSeconds = 0;
  let peakVus = 0;
  for (const m of Object.values(doc.phase_results || {})) {
    if (!m || typeof m !== "object") continue;
    const startedAt = new Date(m.started_at).getTime();
    const endedAt = new Date(m.ended_at).getTime();
    if (!Number.isFinite(startedAt) || !Number.isFinite(endedAt)) continue;
    const held = Math.max(0, (endedAt - startedAt) / 1000);
    const vus = Number(m.vus_avg) || 0;
    vuSeconds += vus * held;
    peakVus = Math.max(peakVus, vus);
  }
  return { engineSeconds, vuSeconds: Math.floor(vuSeconds), peakVus: Math.round(peakVus) };
}

/**
 * Credits a still-running run has accrued so far. The biller charges the
 * DIFFERENCE between this and what it has already metered, so this being an
 * under-estimate early on is harmless -- it just tops up as the run proceeds.
 */
function creditsAccruedSoFar(doc, nowMs = Date.now()) {
  return creditsForRun(liveFacts(doc, nowMs));
}

/**
 * What Express charges for a finished perf run, plus an advisory `oversized`
 * flag so the UI can warn before a very large run rather than after it.
 */
function pricePerfRun(doc) {
  const credits = creditsForRun({
    engineSeconds: doc.engine_seconds,
    vuSeconds: doc.vu_seconds,
  });
  return { credits, oversized: credits > P.OVERSIZED_CREDITS };
}

module.exports = {
  pricePerfRun,
  liveFacts,
  creditsAccruedSoFar,
  creditsForRun,
  billableSeconds,
};
