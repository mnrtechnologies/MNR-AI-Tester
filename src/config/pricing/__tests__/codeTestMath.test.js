/**
 * The golden table for GitHub Code Testing runs.
 *
 * These constants are MODELLED, not measured — see `codeTestFormula
 * ._calibration` in pricing.data.json for why wall-clock could not be used and
 * what has to be collected before they can be replaced. Until then the rows
 * below are the contract: if a recalibration moves any of them that is a PRICE
 * CHANGE, needing a version bump and a decision about existing customers,
 * exactly as it does for creditMath and apiTestMath. Do not "fix" this test to
 * match new constants without that conversation.
 */

const ctm = require("../codeTestMath");
const PRICING = require("../pricing.data.json");

const P = PRICING.codeTestFormula;

describe("code-testing formula — golden table", () => {
  // freshFiles, freshTests, expected credits, what the row represents
  const TABLE = [
    [0, 0, 1, "nothing fresh — a fully cached re-run still pays the base"],
    [1, 1, 1, "single small file"],
    [5, 5, 2, "a focused selection"],
    [10, 10, 4, "a medium module"],
    [22, 22, 7, "the 22-file repo measured on 2026-08-31"],
    [31, 31, 9, "the 31-file repo measured on 2026-08-31"],
    [50, 50, 15, "a large selection"],
  ];

  test.each(TABLE)(
    "%i files / %i tests -> %i credits (%s)",
    (files, tests, expected) => {
      expect(ctm.creditsForRun({ freshFilesAnalysed: files, freshTestsGenerated: tests })).toBe(expected);
    },
  );
});

describe("resume must not re-charge cached work", () => {
  test("a run that reused everything costs only the base", () => {
    const full = ctm.creditsForRun({ freshFilesAnalysed: 31, freshTestsGenerated: 24 });
    const resumed = ctm.creditsForRun({ freshFilesAnalysed: 0, freshTestsGenerated: 0 });
    expect(resumed).toBeLessThan(full);
    expect(resumed).toBe(1);
  });

  test("a partial resume costs less than the original run", () => {
    // The real case: 20 of 24 test files reused, 4 regenerated.
    const original = ctm.creditsForRun({ freshFilesAnalysed: 31, freshTestsGenerated: 24 });
    const resumed = ctm.creditsForRun({ freshFilesAnalysed: 0, freshTestsGenerated: 4 });
    expect(resumed).toBeLessThan(original);
  });
});

describe("guards", () => {
  test("never charges zero — every run consumes a worker slot", () => {
    expect(ctm.creditsForRun({})).toBeGreaterThanOrEqual(1);
    expect(ctm.creditsForRun({ freshFilesAnalysed: -5, freshTestsGenerated: -5 })).toBeGreaterThanOrEqual(1);
  });

  test("junk facts are treated as zero rather than throwing", () => {
    expect(ctm.creditsForRun({ freshFilesAnalysed: "abc", freshTestsGenerated: null })).toBe(1);
    expect(ctm.creditsForRun(undefined)).toBe(1);
  });

  test("billable seconds are clamped so one run cannot bill unbounded", () => {
    const huge = ctm.billableSeconds({ freshFilesAnalysed: 1e9, freshTestsGenerated: 1e9 });
    expect(huge).toBe(P.MAX_BILLABLE_SECONDS_PER_RUN);
  });

  test("oversized is advisory, not a cap on the charge", () => {
    const priced = ctm.priceCodeRun({
      facts: { freshFilesAnalysed: 5000, freshTestsGenerated: 5000 },
    });
    expect(priced.oversized).toBe(true);
    expect(priced.credits).toBeGreaterThan(P.OVERSIZED_CREDITS);
  });
});

describe("live metering", () => {
  test("accrues upward as the engine increments its counters", () => {
    const early = ctm.creditsAccruedSoFar({ facts: { freshFilesAnalysed: 2, freshTestsGenerated: 0 } });
    const later = ctm.creditsAccruedSoFar({ facts: { freshFilesAnalysed: 20, freshTestsGenerated: 15 } });
    expect(later).toBeGreaterThan(early);
  });

  test("never exceeds the final price, so the true-up can never be negative", () => {
    const doc = { facts: { freshFilesAnalysed: 22, freshTestsGenerated: 22 } };
    expect(ctm.creditsAccruedSoFar(doc)).toBe(ctm.priceCodeRun(doc).credits);
  });

  test("a run with no facts yet accrues the base, not zero", () => {
    expect(ctm.creditsAccruedSoFar({})).toBe(1);
  });
});

describe("pre-run estimate", () => {
  test("assumes one test per file — the worst case, so quotes do not under-promise", () => {
    expect(ctm.estimateCreditsForSelection(22)).toBe(
      ctm.creditsForRun({ freshFilesAnalysed: 22, freshTestsGenerated: 22 }),
    );
  });

  test("an empty selection still quotes the base", () => {
    expect(ctm.estimateCreditsForSelection(0)).toBe(1);
  });
});

describe("platform consistency", () => {
  test("uses the shared cost anchor, not a private one", () => {
    // 236s/credit comes from internal.creditsPerServerMonth and describes OUR
    // cost basis; a product-specific value here would silently reprice the
    // platform's whole capacity model.
    expect(P.SECONDS_PER_CREDIT).toBe(PRICING.apiTestFormula.SECONDS_PER_CREDIT);
    expect(P.SECONDS_PER_CREDIT).toBe(PRICING.perfTestFormula.SECONDS_PER_CREDIT);
  });
});
