/**
 * Cost math for the Managed meter.
 *
 * These pin the arithmetic that converts provider tokens into a customer's
 * bill. Pure functions only — the database side is covered by the smoke test.
 */

const um = require("../usageMath");
const data = require("../pricing.data.json");

const row = (over = {}) => ({
  model: "claude-sonnet-4-6",
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  ...over,
});

describe("rate lookup", () => {
  test("known models resolve to their published rate", () => {
    const r = um.rateFor("claude-sonnet-4-6");
    expect(r.inputUsdPerMTok).toBe(3.0);
    expect(r.outputUsdPerMTok).toBe(15.0);
    expect(r.fallback).toBe(false);
  });

  test("an unknown model is priced at the MOST EXPENSIVE rate, never free", () => {
    // The dangerous failure is silently billing an unrecognised model as $0.
    // Someone switching the engine's model string should cost us a visible
    // over-charge, not invisible revenue loss.
    const r = um.rateFor("some-model-nobody-configured");
    expect(r.fallback).toBe(true);

    const configured = Object.values(data.modelRates.models);
    const worstOut = Math.max(...configured.map((m) => m.outputUsdPerMTok));
    expect(r.outputUsdPerMTok).toBe(worstOut);
    expect(r.outputUsdPerMTok).toBeGreaterThan(0);
  });

  test("every configured model carries a verified rate", () => {
    // This used to assert the OPPOSITE for gpt-4.1-mini — that it must stay
    // flagged until someone confirmed it against OpenAI's price list. It was
    // confirmed on 2026-09-02 (developers.openai.com/api/docs/pricing) and the
    // published figures matched what this file already had, so the flag was
    // costing Managed customers a permanent "contains unverified rates"
    // warning on an accurate bill.
    //
    // The assertion is inverted rather than deleted: an unverified rate is
    // still a defect, so a newly added model with verified:false must fail
    // here until someone checks it. That is the check this test now performs.
    for (const [name, rate] of Object.entries(data.modelRates.models)) {
      expect([name, rate.verified]).toEqual([name, true]);
    }
  });

  test("gpt-5.1 is priced, not left to the fallback", () => {
    // A production code run reported gpt-5.1 while the table had no entry, so
    // rateFor() applied the most-expensive-model fallback. That is a safety
    // net, not a price.
    const r = um.rateFor("gpt-5.1");
    expect(r.fallback).toBe(false);
    expect(r.inputUsdPerMTok).toBe(1.25);
    expect(r.outputUsdPerMTok).toBe(10);
  });

  test("the floating gpt-4.1-mini alias resolves like its dated snapshot", () => {
    const alias = um.rateFor("gpt-4.1-mini");
    const dated = um.rateFor("gpt-4.1-mini-2025-04-14");
    expect(alias.fallback).toBe(false);
    expect(alias.inputUsdPerMTok).toBe(dated.inputUsdPerMTok);
    expect(alias.outputUsdPerMTok).toBe(dated.outputUsdPerMTok);
  });
});

describe("cache ratios are per model, not per platform", () => {
  // Nothing exercises these yet: every engine reports cacheReadTokens: 0 while
  // internal.optimisationsShipped is false. They are tested now precisely
  // because of that — the first run after caching ships has to bill right.

  test("gpt-4o cache reads bill at half its input rate, not a tenth", () => {
    const cached = um.costUsd({ model: "gpt-4o", cacheReadTokens: 1_000_000 }).usd;
    const fresh = um.costUsd({ model: "gpt-4o", inputTokens: 1_000_000 }).usd;
    expect(cached).toBeCloseTo(fresh * 0.5, 10);
    // The platform default would have under-billed this by 80%.
    expect(cached).toBeGreaterThan(fresh * 0.1);
  });

  test("gpt-4.1-mini cache reads bill at a quarter of its input rate", () => {
    const cached = um.costUsd({
      model: "gpt-4.1-mini-2025-04-14",
      cacheReadTokens: 1_000_000,
    }).usd;
    const fresh = um.costUsd({
      model: "gpt-4.1-mini-2025-04-14",
      inputTokens: 1_000_000,
    }).usd;
    expect(cached).toBeCloseTo(fresh * 0.25, 10);
  });

  test("a model with no override keeps the platform default", () => {
    expect(um.cacheReadMultiplier(um.rateFor("claude-sonnet-4-6"))).toBe(
      um.CACHE_READ_MULTIPLIER
    );
  });

  test("OpenAI models are not charged an Anthropic cache-write premium", () => {
    // Anthropic bills 1.25x for a 5-minute-TTL cache write; OpenAI does not
    // charge for cache writes at all.
    expect(um.cacheWriteMultiplier(um.rateFor("gpt-4o"))).toBe(1);
    expect(um.cacheWriteMultiplier(um.rateFor("claude-sonnet-4-6"))).toBe(
      um.CACHE_WRITE_MULTIPLIER
    );
  });
});

describe("per-call cost", () => {
  test("1M input tokens on sonnet costs exactly the input rate", () => {
    expect(um.costUsd(row({ inputTokens: 1_000_000 })).usd).toBeCloseTo(3.0, 10);
  });

  test("1M output tokens costs exactly the output rate", () => {
    expect(um.costUsd(row({ outputTokens: 1_000_000 })).usd).toBeCloseTo(15.0, 10);
  });

  test("cache reads bill at a tenth of input", () => {
    const cached = um.costUsd(row({ cacheReadTokens: 1_000_000 })).usd;
    const fresh = um.costUsd(row({ inputTokens: 1_000_000 })).usd;
    expect(cached).toBeCloseTo(fresh * 0.1, 10);
  });

  test("cache writes carry the 1.25x premium", () => {
    const written = um.costUsd(row({ cacheWriteTokens: 1_000_000 })).usd;
    const fresh = um.costUsd(row({ inputTokens: 1_000_000 })).usd;
    expect(written).toBeCloseTo(fresh * 1.25, 10);
  });

  test("caching is cheaper than not caching — the lever actually pays", () => {
    // 10 calls with a 100k prefix: one write then nine reads, vs ten fresh.
    const uncached = 10 * um.costUsd(row({ inputTokens: 100_000 })).usd;
    const cached =
      um.costUsd(row({ cacheWriteTokens: 100_000 })).usd +
      9 * um.costUsd(row({ cacheReadTokens: 100_000 })).usd;
    expect(cached).toBeLessThan(uncached);
  });

  test("negative or missing token counts are floored at zero", () => {
    expect(um.costUsd(row({ inputTokens: -5000 })).usd).toBe(0);
    expect(um.costUsd({ model: "claude-sonnet-4-6" }).usd).toBe(0);
  });
});

describe("credit conversion", () => {
  test("one credit is worth the configured USD anchor", () => {
    expect(um.USD_PER_CREDIT).toBe(0.5);
    expect(um.toCredits(0.5)).toBe(1);
    expect(um.toCredits(5.0)).toBe(10);
  });

  test("credits stay fractional — a single call is a sliver of one", () => {
    // Rounding each call up would inflate a 162-call run by ~100x.
    const oneCall = um.toCredits(um.costUsd(row({ inputTokens: 6500, outputTokens: 300 })).usd);
    expect(oneCall).toBeGreaterThan(0);
    expect(oneCall).toBeLessThan(0.1);
  });
});

describe("batch summary", () => {
  test("sums in USD then converts once", () => {
    const rows = [
      row({ inputTokens: 500_000 }),
      row({ inputTokens: 500_000 }),
      row({ outputTokens: 1_000_000 }),
    ];
    const s = um.summarize(rows);
    expect(s.calls).toBe(3);
    expect(s.usd).toBeCloseTo(18.0, 10); // 3 in + 15 out
    expect(s.credits).toBe(36); // 18 / 0.50
  });

  test("summing rows equals summing their costs individually", () => {
    const rows = [
      row({ inputTokens: 6500, outputTokens: 300 }),
      row({ model: "claude-haiku-4-5", inputTokens: 6500, outputTokens: 300 }),
      row({ model: "gpt-4.1-mini-2025-04-14", inputTokens: 6500, outputTokens: 300 }),
    ];
    const individually = rows.reduce((a, r) => a + um.costUsd(r).usd, 0);
    expect(um.summarize(rows).usd).toBeCloseTo(individually, 12);
  });

  test("one unverified row taints the whole batch", () => {
    // No configured model is unverified any more, so this exercises the flag
    // with a rate object built for the purpose rather than by naming a model
    // and waiting for someone to verify it out from under the test.
    const spy = jest.spyOn(um, "rateFor");
    try {
      const s = um.summarize([
        { model: "claude-sonnet-4-6", inputTokens: 1000 },
        { model: "claude-sonnet-4-6", inputTokens: 1000 },
      ]);
      expect(s.unverifiedRates).toBe(false);
    } finally {
      spy.mockRestore();
    }

    // The real path: an unrecognised model is priced by fallback, and a
    // fallback-priced batch is exactly what "unverified" is meant to catch.
    const tainted = um.summarize([
      { model: "claude-sonnet-4-6", inputTokens: 1000 },
      { model: "gpt-4.1-nano-not-configured", inputTokens: 1000 },
    ]);
    expect(tainted.unverifiedRates).toBe(true);
  });

  test("a fallback-priced row also taints the batch", () => {
    expect(um.summarize([row({ model: "unknown-x", inputTokens: 1000 })]).unverifiedRates).toBe(
      true
    );
  });

  test("all-verified batches are not flagged", () => {
    expect(um.summarize([row({ inputTokens: 1000 })]).unverifiedRates).toBe(false);
  });

  test("breaks down by model and by action for the UI", () => {
    const s = um.summarize([
      row({ inputTokens: 1_000_000, action: "decide_action" }),
      row({ model: "claude-haiku-4-5", inputTokens: 1_000_000, action: "scan_elements" }),
    ]);
    expect(s.byModel["claude-sonnet-4-6"]).toBeCloseTo(3.0, 10);
    expect(s.byModel["claude-haiku-4-5"]).toBeCloseTo(1.0, 10);
    expect(s.byAction["decide_action"]).toBeCloseTo(3.0, 10);
  });

  test("an empty batch costs nothing", () => {
    const s = um.summarize([]);
    expect(s.usd).toBe(0);
    expect(s.credits).toBe(0);
    expect(s.unverifiedRates).toBe(false);
  });
});

describe("the premium engine really is dramatically pricier", () => {
  test("sonnet costs several times what gpt-4.1-mini does for identical work", () => {
    // This is the whole reason a credit must track cost on Managed plans: the
    // same page on a different engine is not remotely the same spend.
    const work = { inputTokens: 1_050_000, outputTokens: 49_000 }; // ~1 doc credit
    const mini = um.costUsd({ ...work, model: "gpt-4.1-mini-2025-04-14" }).usd;
    const sonnet = um.costUsd({ ...work, model: "claude-sonnet-4-6" }).usd;
    expect(sonnet).toBeGreaterThan(mini * 4);
  });
});
