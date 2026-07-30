/**
 * The golden table.
 *
 * These nine rows are the published pricing contract — they appear in the
 * customer-facing spec. If a recalibration of EXPLORATION_CALLS /
 * CALLS_PER_STORY / CALLS_PER_CREDIT changes any of them, that is a PRICE
 * CHANGE and needs a version bump in pricing.data.json plus a decision about
 * existing customers (who are pinned by `pricingVersion` on their
 * subscription). Do not "fix" this test to match new constants without that
 * conversation.
 */

const cm = require("../creditMath");

describe("credit formula — golden table", () => {
  // stories, expected calls, expected credits, example page from the spec
  const TABLE = [
    [1, 112, 1, "Login"],
    [2, 162, 1, "Contact form"],
    [3, 212, 1, "Simple list"],
    [4, 262, 2, "Profile"],
    [5, 312, 2, "Settings"],
    [8, 462, 3, "Orders table"],
    [10, 562, 3, "Products grid"],
    [15, 812, 5, "Admin console"],
    [20, 1062, 7, "Inventory dashboard"],
  ];

  test.each(TABLE)(
    "%i stories -> %i calls, %i credits (%s)",
    (stories, calls, credits) => {
      expect(cm.callsForStories(stories)).toBe(calls);
      expect(cm.creditsForStories(stories)).toBe(credits);
    }
  );

  test("a URL with no stories still costs the 1-credit exploration pass", () => {
    // This is what makes the Phase-2 hold a down payment rather than an
    // extra charge. If this ever returns 0, the whole reservation model
    // double-bills.
    expect(cm.creditsForStories(0)).toBe(1);
  });

  test("per-row drift from true cost matches the published figures", () => {
    // These percentages are printed in the customer-facing spec next to each
    // row, so they are part of the contract too.
    const PUBLISHED_DRIFT_PCT = {
      1: +45, // single-story pages overpay — the one row outside the band
      2: 0,
      3: -24,
      4: +23,
      5: +4,
      8: +5,
      10: -14,
      15: 0,
      20: +7,
    };

    // 1pp tolerance: the published figures are rounded for print (the 4-story
    // row is really +23.7% but is printed as "+23%").
    for (const [stories, calls, credits] of TABLE) {
      const trueCredits = calls / cm.CONSTANTS.CALLS_PER_CREDIT;
      const driftPct = ((credits - trueCredits) / trueCredits) * 100;
      expect(Math.abs(driftPct - PUBLISHED_DRIFT_PCT[stories])).toBeLessThanOrEqual(1);
    }
  });

  test("charge stays within +/-25% of true cost from 2 stories up", () => {
    // The fairness claim the pricing rests on. A 1-story page is the known
    // exception (+45%): the fixed 62-call exploration pass dominates when
    // there is almost no execution work to amortise it over.
    for (const [stories, calls, credits] of TABLE) {
      if (stories < 2) continue;
      const trueCredits = calls / cm.CONSTANTS.CALLS_PER_CREDIT;
      const drift = (credits - trueCredits) / trueCredits;
      expect(Math.abs(drift)).toBeLessThanOrEqual(0.25);
    }
  });

  test("credits are monotonic in story count", () => {
    for (let n = 1; n <= 60; n++) {
      expect(cm.creditsForStories(n)).toBeGreaterThanOrEqual(
        cm.creditsForStories(n - 1)
      );
    }
  });

  test("integer form matches Math.round across the supported range", () => {
    // Guards the language-independent rewrite against an off-by-one.
    for (let n = 0; n <= 200; n++) {
      const expected = Math.max(
        1,
        Math.round(cm.callsForStories(n) / cm.CONSTANTS.CALLS_PER_CREDIT)
      );
      expect(cm.creditsForStories(n)).toBe(expected);
    }
  });

  test("junk input is treated as zero stories, never NaN", () => {
    for (const bad of [null, undefined, -5, "abc", NaN, Infinity]) {
      expect(cm.creditsForStories(bad)).toBe(1);
      expect(Number.isFinite(cm.callsForStories(bad))).toBe(true);
    }
  });

  test("fractional story counts floor rather than propagate", () => {
    expect(cm.creditsForStories(4.9)).toBe(cm.creditsForStories(4));
  });
});

describe("oversized URLs", () => {
  test("20 stories runs unattended, 21 requires approval", () => {
    expect(cm.isOversized(20)).toBe(false);
    expect(cm.isOversized(21)).toBe(true);
  });
});

describe("priceRun", () => {
  test("prices the spec's worked 10-page site at 29 credits", () => {
    const site = [2, 2, 3, 4, 4, 5, 12, 14, 16, 18].map((storyCount, i) => ({
      sessionId: "s" + i,
      pageUrl: "https://example.com/" + i,
      storyCount,
    }));

    const run = cm.priceRun(site);
    expect(run.urlCount).toBe(10);
    expect(run.totalStories).toBe(80);
    expect(run.totalCredits).toBe(29);
    expect(run.estimateIncomplete).toBe(false);
    expect(run.oversizedUrls).toHaveLength(0);
  });

  test("the six ordinary pages cost 9 and the four heavy ones cost 20", () => {
    const ordinary = [2, 2, 3, 4, 4, 5].map((storyCount) => ({ storyCount }));
    const heavy = [12, 14, 16, 18].map((storyCount) => ({ storyCount }));

    expect(cm.priceRun(ordinary).totalCredits).toBe(9);
    expect(cm.priceRun(heavy).totalCredits).toBe(20);
  });

  test("an unknown story count is priced at the ceiling and flagged", () => {
    const run = cm.priceRun([{ storyCount: null }, { storyCount: 2 }]);

    expect(run.estimateIncomplete).toBe(true);
    expect(run.lines[0].storyCountKnown).toBe(false);
    expect(run.lines[0].storyCount).toBe(cm.MAX_STORIES_PER_URL);
    // Fail expensive, not free.
    expect(run.lines[0].credits).toBe(cm.creditsForStories(cm.MAX_STORIES_PER_URL));
    expect(run.lines[1].storyCountKnown).toBe(true);
  });

  test("flags oversized URLs individually", () => {
    const run = cm.priceRun([{ storyCount: 5 }, { storyCount: 25 }]);
    expect(run.oversizedUrls).toHaveLength(1);
    expect(run.oversizedUrls[0].storyCount).toBe(25);
  });

  test("an empty run is free and complete", () => {
    const run = cm.priceRun([]);
    expect(run.totalCredits).toBe(0);
    expect(run.estimateIncomplete).toBe(false);
  });

  test("tolerates a non-array argument", () => {
    expect(cm.priceRun(undefined).totalCredits).toBe(0);
  });
});

describe("reservation TTL", () => {
  test("never drops below the floor", () => {
    expect(cm.reservationTtlMinutes(0)).toBe(90);
    expect(cm.reservationTtlMinutes(1)).toBe(90);
  });

  test("scales past the floor for large runs", () => {
    // 40 stories at 300s each is well over 90 minutes of real work.
    expect(cm.reservationTtlMinutes(40)).toBe(240);
  });
});

describe("tiers", () => {
  test("BYOK is the lead plan type", () => {
    expect(cm.leadPlanTypeKey()).toBe("byok");
  });

  test("every advertised tier resolves and is internally consistent", () => {
    for (const pt of cm.listPlanTypes()) {
      const tiers = cm.listTiers(pt.key);
      expect(tiers.length).toBeGreaterThan(0);

      for (const t of tiers) {
        expect(cm.getTier(pt.key, t.key)).toBe(t);

        if (t.custom) {
          expect(t.priceUsdMonthly).toBeNull();
          expect(t.credits).toBeNull();
        } else {
          expect(t.priceUsdMonthly).toBeGreaterThan(0);
          expect(t.credits).toBeGreaterThan(0);
          expect(t.concurrentSites).toBeGreaterThan(0);
          expect(t.extraCreditUsd).toBeGreaterThan(0);
        }
      }
    }
  });

  test("published tier figures match the spec", () => {
    expect(cm.getTier("byok", "starter")).toMatchObject({
      priceUsdMonthly: 199,
      credits: 250,
      concurrentSites: 1,
      extraCreditUsd: 1.0,
    });
    expect(cm.getTier("byok", "growth")).toMatchObject({
      priceUsdMonthly: 499,
      credits: 1000,
      concurrentSites: 2,
      extraCreditUsd: 0.75,
    });
    expect(cm.getTier("byok", "scale")).toMatchObject({
      priceUsdMonthly: 1299,
      credits: 3500,
      concurrentSites: 3,
      extraCreditUsd: 0.5,
    });
    expect(cm.getTier("managed", "managed_starter")).toMatchObject({
      priceUsdMonthly: 299,
      credits: 200,
      extraCreditUsd: 1.5,
    });
    expect(cm.getTier("managed", "managed_growth")).toMatchObject({
      priceUsdMonthly: 999,
      credits: 800,
      extraCreditUsd: 1.25,
    });
    expect(cm.getTier("managed", "managed_pro")).toMatchObject({
      priceUsdMonthly: 1899,
      credits: 320,
      extraCreditUsd: 5.93,
    });
  });

  test("Managed Pro is marked unavailable until hybrid routing ships", () => {
    // The engine it is sold on does not exist in the AI backend yet.
    const pro = cm.getTier("managed", "managed_pro");
    expect(pro.available).toBe(false);
    expect(pro.unavailableReason).toBeTruthy();
  });

  test("unknown keys return null rather than throwing", () => {
    expect(cm.getTier("nope", "starter")).toBeNull();
    expect(cm.getTier("byok", "nope")).toBeNull();
    expect(cm.listTiers("nope")).toEqual([]);
  });
});

describe("money", () => {
  test("INR is always derived from USD, never stored", () => {
    expect(cm.usdToInr(199)).toBe(199 * cm.FX_INR_PER_USD);
    expect(cm.usdToInr(null)).toBeNull();
  });

  test("semi-annual applies the configured discount", () => {
    expect(cm.semiAnnualUsd(199)).toBe(Math.round(199 * 6 * 0.9));
    expect(cm.semiAnnualUsd(null)).toBeNull();
  });

  test("formatPrice renders both currencies and the custom case", () => {
    expect(cm.formatPrice(199, "USD")).toBe("$199");
    expect(cm.formatPrice(199, "INR")).toContain("₹");
    expect(cm.formatPrice(null, "USD")).toBe("Custom");
  });
});

describe("internal cost anchors", () => {
  test("are present but flagged as depending on unshipped optimisations", () => {
    const internal = cm.PRICING.internal;
    expect(internal.costPerCreditCheapUsd).toBe(0.31);
    expect(internal.costPerCreditPremiumUsd).toBe(1.56);
    // Guards against quoting optimised margins as if they were real.
    expect(internal.optimisationsShipped).toBe(false);
  });
});
