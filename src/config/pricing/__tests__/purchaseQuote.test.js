/**
 * The purchase golden table.
 *
 * Every number below is an amount a customer actually gets charged. If a change
 * to pricing.data.json moves any of them, that is a PRICE CHANGE: it needs a
 * version bump in pricing.data.json and a decision about existing customers,
 * who are pinned by `pricingVersion` on their subscription. Do not "fix" this
 * test to match new constants without that conversation.
 *
 * Amounts are asserted in MINOR UNITS — paise for INR, cents for USD — because
 * minor units are what reaches Razorpay.
 */

const pq = require("../purchaseQuote");

describe("quotePlan — golden table (minor units)", () => {
  // planType, tierKey, INR monthly, INR semiAnnual, USD monthly, USD semiAnnual, credits
  const TABLE = [
    ["byok", "starter", 3300000, 17820000, 37500, 202500, 250],
    ["byok", "growth", 8800000, 47520000, 100000, 540000, 1000],
    ["byok", "scale", 22000000, 118800000, 250000, 1350000, 3500],
    ["managed", "managed_starter", 4972000, 26848800, 56500, 305100, 250],
    ["managed", "managed_growth", 16720000, 90288000, 190000, 1026000, 1000],
  ];

  test.each(TABLE)(
    "%s/%s -> INR %i / %i paise, USD %i / %i cents",
    (planType, tierKey, inrM, inrS, usdM, usdS, credits) => {
      const cases = [
        ["INR", "monthly", inrM, 1],
        ["INR", "semiAnnual", inrS, 6],
        ["USD", "monthly", usdM, 1],
        ["USD", "semiAnnual", usdS, 6],
      ];

      for (const [currency, period, expected, months] of cases) {
        const q = pq.quotePlan({ planType, tierKey, period, currency });
        expect(q.ok).toBe(true);
        expect(q.amountMinor).toBe(expected);
        expect(q.currency).toBe(currency);
        expect(q.months).toBe(months);

        // THE CONTRACT: `credits` is the MONTHLY allowance and is identical for
        // both periods AND both currencies. A 6-month purchase buys six monthly
        // grants delivered by allowanceResetJob, not 6x credits on day one. If
        // this ever varies, a customer can burn half a year of capacity in a week.
        expect(q.credits).toBe(credits);
      }
    }
  );

  test("the currency changes the amount but never the entitlement", () => {
    for (const [planType, tierKey] of TABLE) {
      const inr = pq.quotePlan({ planType, tierKey, period: "monthly", currency: "INR" });
      const usd = pq.quotePlan({ planType, tierKey, period: "monthly", currency: "USD" });
      expect(inr.credits).toBe(usd.credits);
      expect(inr.months).toBe(usd.months);
      // USD is canonical in both: the INR figure is derived from it.
      expect(inr.amountUsd).toBe(usd.amountUsd);
    }
  });

  test("the 6-month price is cheaper than six monthly payments, in both currencies", () => {
    for (const [planType, tierKey] of TABLE) {
      for (const currency of ["INR", "USD"]) {
        const m = pq.quotePlan({ planType, tierKey, period: "monthly", currency });
        const s = pq.quotePlan({ planType, tierKey, period: "semiAnnual", currency });
        expect(s.amountMinor).toBeLessThan(m.amountMinor * 6);
      }
    }
  });

  test("every amount is a whole number of minor units", () => {
    for (const [planType, tierKey] of TABLE) {
      for (const currency of ["INR", "USD"]) {
        for (const period of ["monthly", "semiAnnual"]) {
          const q = pq.quotePlan({ planType, tierKey, period, currency });
          expect(Number.isInteger(q.amountMinor)).toBe(true);
        }
      }
    }
  });
});

describe("payment methods follow the currency", () => {
  // This is not cosmetic. UPI and netbanking are India-domestic rails that
  // settle in INR; offering them on a USD order produces a payment page
  // Razorpay cannot fulfil.
  test("INR offers UPI and netbanking", () => {
    const q = pq.quotePlan({ planType: "byok", tierKey: "growth", period: "monthly", currency: "INR" });
    expect(q.methods).toEqual({ card: true, upi: true, netbanking: true, wallet: true });
  });

  test("USD offers cards ONLY", () => {
    const q = pq.quotePlan({ planType: "byok", tierKey: "growth", period: "monthly", currency: "USD" });
    expect(q.methods.card).toBe(true);
    expect(q.methods.upi).toBe(false);
    expect(q.methods.netbanking).toBe(false);
    expect(q.methods.wallet).toBe(false);
  });

  test("an unsupported currency is refused rather than defaulted", () => {
    const q = pq.quotePlan({ planType: "byok", tierKey: "growth", period: "monthly", currency: "GBP" });
    expect(q.ok).toBe(false);
    expect(q.code).toBe("INVALID_CURRENCY");
  });

  test("omitting the currency bills in INR", () => {
    // The default serves the Indian market, where UPI and netbanking matter.
    const q = pq.quotePlan({ planType: "byok", tierKey: "growth", period: "monthly" });
    expect(q.currency).toBe("INR");
  });
});

describe("quotePlan — tiers that must never reach checkout", () => {
  test("managed_pro is refused: priced, but not for sale", () => {
    // available:false in pricing.data.json. The hybrid Haiku+Sonnet routing it
    // assumes is not implemented and margins invert on the unoptimised path.
    const q = pq.quotePlan({
      planType: "managed",
      tierKey: "managed_pro",
      period: "monthly",
    });
    expect(q.ok).toBe(false);
    expect(q.code).toBe("TIER_UNAVAILABLE");
  });

  test.each([
    ["byok", "self_hosted"],
    ["managed", "enterprise"],
  ])("%s/%s is custom-priced and refused", (planType, tierKey) => {
    const q = pq.quotePlan({ planType, tierKey, period: "monthly" });
    expect(q.ok).toBe(false);
    expect(q.code).toBe("TIER_CUSTOM");
  });

  test("an unknown tier is refused rather than priced at zero", () => {
    expect(pq.quotePlan({ planType: "byok", tierKey: "nope", period: "monthly" }).code).toBe(
      "TIER_NOT_FOUND"
    );
    expect(pq.quotePlan({ planType: "nope", tierKey: "starter", period: "monthly" }).code).toBe(
      "TIER_NOT_FOUND"
    );
  });

  test("an unknown period is refused", () => {
    const q = pq.quotePlan({ planType: "byok", tierKey: "starter", period: "weekly" });
    expect(q.ok).toBe(false);
    expect(q.code).toBe("INVALID_PERIOD");
  });

  test("refusals return, they never throw", () => {
    expect(() => pq.quotePlan()).not.toThrow();
    expect(() => pq.quotePlan({})).not.toThrow();
    expect(pq.quotePlan({}).ok).toBe(false);
  });
});

describe("quoteCredits — top-up pricing", () => {
  // tier -> per-credit rate: USD cents, then INR paise (derived at ₹88/USD)
  const RATES = [
    ["byok", "starter", 100, 8800],
    ["byok", "growth", 75, 6600],
    ["byok", "scale", 50, 4400],
    ["managed", "managed_starter", 215, 18900],
    ["managed", "managed_growth", 180, 15800],
  ];

  test.each(RATES)(
    "%s/%s charges %i cents or %i paise per credit",
    (planType, tierKey, unitCents, unitPaise) => {
      const usd = pq.quoteCredits({ planType, tierKey, quantity: 10, currency: "USD" });
      expect(usd.ok).toBe(true);
      expect(usd.amountMinor).toBe(unitCents * 10);

      const inr = pq.quoteCredits({ planType, tierKey, quantity: 10, currency: "INR" });
      expect(inr.ok).toBe(true);
      expect(inr.amountMinor).toBe(unitPaise * 10);

      expect(usd.quantity).toBe(10);
      expect(inr.quantity).toBe(10);
    }
  );

  test("minor units are multiplied, not major ones — no float drift", () => {
    // 0.75 * 3 is 2.2500000000000004 in IEEE 754. Growth's rate is exactly
    // that, so this row is the reason toMinor runs before the multiply.
    const q = pq.quoteCredits({ planType: "byok", tierKey: "growth", quantity: 3, currency: "USD" });
    expect(q.amountMinor).toBe(225);
    expect(Number.isInteger(q.amountMinor)).toBe(true);
  });

  test("the INR total always divides by the advertised per-credit price", () => {
    // The unit rate is converted and rounded BEFORE the multiply, so a customer
    // shown "₹66 per credit" is charged exactly 66 x quantity. Converting the
    // total instead would give a figure that does not divide by the unit price.
    for (const [planType, tierKey] of RATES) {
      const q = pq.quoteCredits({ planType, tierKey, quantity: 7, currency: "INR" });
      expect(q.amountCharged % q.unitPriceCharged).toBe(0);
      expect(q.amountCharged).toBe(q.unitPriceCharged * 7);
    }
  });

  test("the subscription's snapshotted rate wins over today's price", () => {
    // A customer pinned to an older pricingVersion pays what they signed up
    // for. The server passes credits.overageRateUsd from their subscription.
    const q = pq.quoteCredits({
      planType: "byok",
      tierKey: "growth",
      quantity: 10,
      currency: "USD",
      extraCreditUsdOverride: 0.5,
    });
    expect(q.amountMinor).toBe(500);
    expect(q.unitPriceUsd).toBe(0.5);
  });

  test.each([[0], [-5], [1.5], ["ten"], [null], [10001]])(
    "quantity %p is refused",
    (quantity) => {
      const q = pq.quoteCredits({ planType: "byok", tierKey: "growth", quantity });
      expect(q.ok).toBe(false);
      expect(q.code).toBe("INVALID_QUANTITY");
    }
  );

  test("a custom tier has no extra-credit rate to charge", () => {
    const q = pq.quoteCredits({ planType: "byok", tierKey: "self_hosted", quantity: 10 });
    expect(q.ok).toBe(false);
    // Refused as custom before the rate is even considered.
    expect(q.code).toBe("TIER_CUSTOM");
  });

  test("a top-up below the minimum chargeable amount is refused", () => {
    // Scale is 50c/credit, so a single credit is under the $1 floor Razorpay
    // will accept. The same credit is ₹44 and clears the ₹1 floor easily —
    // the minimum bites per currency, not per tier.
    expect(
      pq.quoteCredits({ planType: "byok", tierKey: "scale", quantity: 1, currency: "USD" }).code
    ).toBe("AMOUNT_TOO_SMALL");
    expect(
      pq.quoteCredits({ planType: "byok", tierKey: "scale", quantity: 1, currency: "INR" }).ok
    ).toBe(true);
  });
});

describe("toMinor", () => {
  test.each([
    [199, 19900],
    [0.75, 75],
    [1.25, 125],
    [5.93, 593],
    [17512, 1751200],
    [0, 0],
  ])("%p -> %i minor units", (major, minor) => {
    expect(pq.toMinor(major)).toBe(minor);
  });

  test("null and non-numbers return null rather than NaN", () => {
    expect(pq.toMinor(null)).toBeNull();
    expect(pq.toMinor(undefined)).toBeNull();
    expect(pq.toMinor("abc")).toBeNull();
  });
});
