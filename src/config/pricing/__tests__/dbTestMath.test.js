/**
 * dbTestMath — database run pricing.
 *
 * Lives here rather than beside the module because CRA's jest only collects
 * from `src`, and a test the CI never runs is decoration. The module itself is
 * backend-only (backend/services/dbTestMath.js), hence the reach across.
 */

const dtm = require("../../../../backend/services/dbTestMath");
const data = require("../pricing.data.json");

const D = data.dbTestFormula;

/** What the old formula charged, reproduced so the regression stays visible. */
function legacyCreditsForStories(n) {
  const calls = data.formula.EXPLORATION_CALLS + data.formula.CALLS_PER_STORY * n;
  return Math.max(
    1,
    Math.floor((2 * calls + data.formula.CALLS_PER_CREDIT) / (2 * data.formula.CALLS_PER_CREDIT))
  );
}

describe("the 50x overcharge this module was built on", () => {
  // specTestMath.js documents the bug and names this file as where it was
  // copied FROM: "It used to reuse creditsForStories(), copied from
  // dbTestMath. That was wrong by roughly 50x." The copy was fixed in 2026;
  // the original was not. These two tests are the fix, stated as prices.

  test("a 141-test-case assessment costs single digits, not 44 credits", () => {
    const priced = dtm.priceDbTestRun({
      job_type: "full_assessment",
      testCasesGenerated: 141,
      durationMs: 6 * 60 * 1000,
    });
    expect(legacyCreditsForStories(141)).toBe(44); // what it used to charge
    expect(priced.credits).toBe(2);
    expect(priced.basis).toBe("measured");
  });

  test("a 900-object PostgreSQL diagnostic costs 1 credit, not 300", () => {
    // The old OBJECTS_PER_CREDIT_BY_TYPE table put postgresql at 3 objects per
    // credit — 236 seconds of server time for walking three tables — while
    // redis got 10,000 for the same credit. Nobody had measured either.
    expect(Math.ceil(900 / 3)).toBe(300); // what it used to charge
    const priced = dtm.priceDbTestRun({
      job_type: "diagnostic",
      db_type: "postgresql",
      objectsScanned: 900,
      durationMs: 40 * 1000,
    });
    expect(priced.credits).toBe(1);
  });

  test("db_type no longer changes the price of identical work", () => {
    // The spread between postgresql (3/credit) and redis (10,000/credit) was
    // 3,300x, applied to a scan that is the same schema walk either way.
    const run = (db_type) =>
      dtm.priceDbTestRun({
        job_type: "diagnostic",
        db_type,
        objectsScanned: 900,
        durationMs: 40 * 1000,
      }).credits;
    expect(run("postgresql")).toBe(run("redis"));
    expect(run("mongodb")).toBe(run("pinecone"));
  });
});

describe("measured duration is the meter", () => {
  test("credits follow SECONDS_PER_CREDIT", () => {
    const oneCredit = dtm.priceDbTestRun({ durationMs: D.SECONDS_PER_CREDIT * 1000 });
    expect(oneCredit.credits).toBe(1);

    const threeCredits = dtm.priceDbTestRun({
      durationMs: D.SECONDS_PER_CREDIT * 3 * 1000,
    });
    expect(threeCredits.credits).toBe(3);
  });

  test("any work at all costs at least one credit", () => {
    expect(dtm.priceDbTestRun({ durationMs: 1 }).credits).toBe(1);
  });

  test("a run that did nothing costs nothing", () => {
    expect(dtm.priceDbTestRun({ job_type: "diagnostic", objectsScanned: 0 }).credits).toBe(0);
    expect(dtm.priceDbTestRun({}).credits).toBe(0);
  });

  test("rounds up — partial worker time is still consumed worker time", () => {
    expect(dtm.priceDbTestRun({ durationMs: (D.SECONDS_PER_CREDIT + 1) * 1000 }).credits).toBe(2);
  });

  test("a hung run is clamped and flagged, not billed to infinity", () => {
    const priced = dtm.priceDbTestRun({ durationMs: 30 * 86400 * 1000 });
    const ceiling = Math.ceil(D.MAX_BILLABLE_SECONDS_PER_RUN / D.SECONDS_PER_CREDIT);
    expect(priced.credits).toBe(ceiling);
    expect(priced.oversized).toBe(true);
  });

  test("garbage durations do not produce garbage prices", () => {
    for (const durationMs of [null, undefined, NaN, -5000, "abc", Infinity]) {
      const priced = dtm.priceDbTestRun({ durationMs });
      expect(Number.isFinite(priced.credits)).toBe(true);
      expect(priced.credits).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("fallback for rows with no recorded duration", () => {
  test("an assessment falls back to its test-case count", () => {
    const priced = dtm.priceDbTestRun({
      job_type: "full_assessment",
      testCasesGenerated: 10,
    });
    expect(priced.basis).toBe("estimated");
    expect(priced.seconds).toBe(10 * D.FALLBACK_SECONDS_PER_TEST_CASE);
  });

  test("a diagnostic falls back to its object count", () => {
    const priced = dtm.priceDbTestRun({ job_type: "diagnostic", objectsScanned: 400 });
    expect(priced.basis).toBe("estimated");
    expect(priced.seconds).toBe(400 * D.FALLBACK_SECONDS_PER_OBJECT);
  });

  test("a measured duration always wins over the fallback", () => {
    // Otherwise a row carrying both would be priced by the guess.
    const priced = dtm.priceDbTestRun({
      job_type: "full_assessment",
      testCasesGenerated: 5000,
      durationMs: 10 * 1000,
    });
    expect(priced.basis).toBe("measured");
    expect(priced.credits).toBe(1);
  });

  test("the fallback is expressed in seconds, so both paths are comparable", () => {
    // The point of routing the fallback through seconds rather than a separate
    // unit: an estimated price and a measured one are the same kind of number.
    const estimated = dtm.priceDbTestRun({
      job_type: "full_assessment",
      testCasesGenerated: 8,
    });
    const measured = dtm.priceDbTestRun({
      durationMs: 8 * D.FALLBACK_SECONDS_PER_TEST_CASE * 1000,
    });
    expect(estimated.credits).toBe(measured.credits);
  });
});

describe("constants are data, not code", () => {
  test("the meter reads its rate from pricing.data.json", () => {
    // The whole block used to be literals in backend/services/dbTestMath.js,
    // which meant DB testing could not be repriced without a deploy.
    expect(dtm.DB_SECONDS_PER_CREDIT).toBe(D.SECONDS_PER_CREDIT);
    expect(dtm.DB_MAX_BILLABLE_SECONDS_PER_RUN).toBe(D.MAX_BILLABLE_SECONDS_PER_RUN);
  });

  test("it shares the platform's cost basis rather than inventing one", () => {
    // 236 = internal.creditsPerServerMonth over a 30-day server-month. Every
    // duration meter must agree on it; a product-specific value here would
    // mean the same second of server time cost different amounts by product.
    expect(D.SECONDS_PER_CREDIT).toBe(data.apiTestFormula.SECONDS_PER_CREDIT);
    expect(D.SECONDS_PER_CREDIT).toBe(data.perfTestFormula.SECONDS_PER_CREDIT);
    expect(D.SECONDS_PER_CREDIT).toBe(data.vaptFormula.SECONDS_PER_CREDIT);
  });
});
