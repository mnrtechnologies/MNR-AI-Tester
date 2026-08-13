/**
 * The golden table for API security scans.
 *
 * Unlike the web formula these constants are MEASURED, not modelled — see
 * `apiTestFormula._calibration` in pricing.data.json for the runs behind them.
 * That makes the anchor rows below falsifiable: the 222-test row corresponds to
 * a real scan that took 447 seconds of wall clock, and the formula predicts
 * 444. If a recalibration moves any row here, that is a PRICE CHANGE and needs
 * a version bump plus a decision about existing customers, exactly as it does
 * for creditMath. Do not "fix" this test to match new constants without that
 * conversation.
 */

const am = require("../apiTestMath");
const PRICING = require("../pricing.data.json");

describe("API scan formula — golden table", () => {
  // tests, expected seconds, expected credits, what the row represents
  const TABLE = [
    [0, 0, 1, "failed before generating anything — still a down payment"],
    [83, 166, 1, "27 endpoints, measured at 145s"],
    [118, 236, 1, "exactly one credit of engine time"],
    [197, 394, 2, "50 endpoints, second run"],
    [222, 444, 2, "50 endpoints, measured at 447s"],
    [500, 1000, 4, "large surface"],
    [2000, 4000, 17, "very large surface"],
  ];

  test.each(TABLE)(
    "%i tests -> %i seconds, %i credits (%s)",
    (tests, seconds, expected) => {
      expect(am.secondsForTests(tests)).toBe(seconds);
      expect(am.creditsForApiRun(tests)).toBe(expected);
    }
  );
});

describe("invariants", () => {
  test("never charges zero — a scan that ran at all costs a credit", () => {
    for (const t of [0, 1, 10, 59]) {
      expect(am.creditsForApiRun(t)).toBeGreaterThanOrEqual(1);
    }
  });

  test("monotonic: more tests never costs less", () => {
    let prev = 0;
    for (let t = 0; t <= 3000; t++) {
      const c = am.creditsForApiRun(t);
      expect(c).toBeGreaterThanOrEqual(prev);
      prev = c;
    }
  });

  test("garbage input is treated as zero work, not as a crash", () => {
    for (const bad of [null, undefined, NaN, -5, "abc", {}]) {
      expect(am.creditsForApiRun(bad)).toBe(1);
    }
  });

  test("fractional test counts floor rather than rounding up a charge", () => {
    expect(am.creditsForApiRun(236.9)).toBe(am.creditsForApiRun(236));
  });
});

describe("oversized runs", () => {
  test("flags a run past the review ceiling", () => {
    const max = PRICING.apiTestFormula.MAX_TESTS_PER_RUN;
    expect(am.isOversizedRun(max)).toBe(false);
    expect(am.isOversizedRun(max + 1)).toBe(true);
  });

  test("flagging carries no surcharge — price stays continuous across it", () => {
    const max = PRICING.apiTestFormula.MAX_TESTS_PER_RUN;
    const at = am.creditsForApiRun(max);
    const justOver = am.creditsForApiRun(max + 1);
    // Crossing the ceiling must not jump the price. It is a review signal for
    // a human, not a penalty band.
    expect(justOver).toBeGreaterThanOrEqual(at);
    expect(justOver - at).toBeLessThanOrEqual(1);
  });
});

describe("priceApiRun", () => {
  test("prices a run document and carries endpoint count for the ledger", () => {
    expect(am.priceApiRun({ test_count: 222, api_count: 50 })).toEqual({
      credits: 2,
      tests: 222,
      apiCount: 50,
      seconds: 444,
      oversized: false,
    });
  });

  test("endpoint count never affects the charge", () => {
    const few = am.priceApiRun({ test_count: 222, api_count: 1 });
    const many = am.priceApiRun({ test_count: 222, api_count: 900 });
    expect(few.credits).toBe(many.credits);
  });

  test("a document missing its counts still prices to the floor", () => {
    expect(am.priceApiRun({}).credits).toBe(1);
    expect(am.priceApiRun().credits).toBe(1);
  });
});
