/**
 * codeTestMath — credits for GitHub Code Testing runs (`code_runs`).
 *
 * The analogue of perfTestMath.js / apiTestMath.js, and deliberately the same
 * shape so the biller, the reconciler and the UI all treat it identically.
 *
 * TWO THINGS DIFFER FROM THE OTHER CAPACITY METERS, both on purpose:
 *
 * 1. It applies to BOTH plan families. Every other capacity meter is BYOK-only
 *    because Managed runs use OUR provider key and bill through modelRates
 *    instead. Code Testing always runs on the customer's own key whatever plan
 *    they hold, so there is no token cost of ours to pass through and the usage
 *    meter would charge nothing. Billing capacity here is meters.byok applied
 *    correctly, not an exception to it.
 *
 * 2. It bills WORK DONE, not wall-clock. Measured wall-clock for this engine is
 *    badly distorted by our own defects (a 22-file run took 8709s to a
 *    timeout-retry storm) and by cache reuse, so charging it would bill
 *    customers for our inefficiency. See pricing.data.json codeTestFormula
 *    ._calibration for the measurements behind that decision.
 *
 * The engine records facts and never a price (MNR_AT_Code_Testing/db.py
 * ::add_run_facts); all arithmetic lives here.
 */

const PRICING = require("./pricing.data.json");

const P = PRICING.codeTestFormula;

function nonNegative(n) {
  const v = Number(n);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
}

/**
 * Modelled seconds of our capacity a run consumed, from the work it actually
 * performed.
 *
 * LLM cache hits contribute nothing: `freshFilesAnalysed` and
 * `freshTestsGenerated` count only units that cost an LLM call on THIS run, so
 * resuming an interrupted run charges for the remainder rather than the whole
 * job again.
 *
 * Executed tests ARE a term, corrected from an earlier version that left them
 * out on the grounds that they correlate weakly with wall-clock (r=0.15). That
 * was the wrong test: correlation with wall-clock measures how well a unit
 * PREDICTS duration, not whether it CONSUMES capacity. Execution consumes
 * plenty — clone, dependency install, then the suite itself. Without this term
 * a fully cached re-run priced at the base alone, so a large repo could occupy
 * the runner for many minutes and bill a single credit; only fresh LLM work
 * was visible to the meter, and a re-run has none by definition.
 */
function billableSeconds(facts = {}) {
  const secs =
    P.BASE_SECONDS_PER_RUN +
    nonNegative(facts.freshFilesAnalysed) * P.SECONDS_PER_FILE_ANALYSED +
    nonNegative(facts.freshTestsGenerated) * P.SECONDS_PER_TEST_GENERATED +
    nonNegative(facts.testsExecuted) * P.SECONDS_PER_TEST_EXECUTED;
  return Math.min(secs, P.MAX_BILLABLE_SECONDS_PER_RUN);
}

/**
 * Credits for one code-testing run.
 *
 * Integer arithmetic rather than Math.round for the same reason creditMath and
 * perfTestMath use it: JS rounds half-up while Python uses banker's rounding,
 * so a value landing exactly on .5 would disagree across the two languages.
 *
 *   round(a/b) == floor((2a + b) / 2b)   for positive integers
 */
function creditsForRun(facts = {}) {
  const secs = Math.floor(billableSeconds(facts));
  const b = P.SECONDS_PER_CREDIT;
  return Math.max(1, Math.floor((2 * secs + b) / (2 * b)));
}

/**
 * The facts as they stand for a run still in flight.
 *
 * Simpler than perfTestMath.liveFacts, which has to re-derive the engine's
 * numbers from phase timestamps: this engine $inc's the counters as each file
 * completes, so the live values are already correct and merely need reading.
 * They only ever grow, so the live price converges UP to the final one and can
 * never overshoot into a refund the debit path has no semantics for.
 */
function liveFacts(doc = {}) {
  const f = doc.facts || {};
  return {
    freshFilesAnalysed: nonNegative(f.freshFilesAnalysed),
    freshTestsGenerated: nonNegative(f.freshTestsGenerated),
    // Written once, at completion — so mid-run this reads 0 and the live meter
    // simply does not charge for execution yet. Settlement then trues up the
    // difference. That ordering is deliberate: the meter must only ever
    // under-state, because the debit path has no way to issue a refund.
    testsExecuted: nonNegative(f.testsExecuted),
  };
}

/** Credits a still-running run has accrued so far. */
function creditsAccruedSoFar(doc = {}) {
  return creditsForRun(liveFacts(doc));
}

/**
 * What Express charges for a finished run, plus an advisory `oversized` flag
 * so the UI can warn before a very large run rather than after it.
 */
function priceCodeRun(doc = {}) {
  const credits = creditsForRun(liveFacts(doc));
  return { credits, oversized: credits > P.OVERSIZED_CREDITS };
}

/**
 * Pre-run estimate for the file picker, where nothing has been analysed yet.
 *
 * Assumes every selected file yields one test file, which is the worst case —
 * files with no testable logic generate none. Over-estimating is the right
 * direction for a quote shown before the customer commits.
 *
 * Executed tests have to be guessed too, since the count only exists once the
 * suite has run. ESTIMATED_TESTS_PER_FILE sits just above the observed rate so
 * the quote stays an upper bound: a quote that came in UNDER the eventual
 * charge is the one customers are entitled to complain about.
 */
function estimateCreditsForSelection(fileCount) {
  const n = nonNegative(fileCount);
  return creditsForRun({
    freshFilesAnalysed: n,
    freshTestsGenerated: n,
    testsExecuted: n * P.ESTIMATED_TESTS_PER_FILE,
  });
}

module.exports = {
  priceCodeRun,
  liveFacts,
  creditsAccruedSoFar,
  creditsForRun,
  billableSeconds,
  estimateCreditsForSelection,
};
