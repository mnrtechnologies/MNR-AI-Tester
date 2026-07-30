/**
 * Settlement rules and the reservation invariants they depend on.
 *
 * These test pure functions and arithmetic only — no database. The rules
 * themselves are the part worth pinning: getting them wrong either bills a
 * customer for work that never ran, or gives away model calls we paid for.
 */

const cm = require("../creditMath");
const { decideLine, buildReservationLines } = require("../settlementRules");

const sheet = (over = {}) => ({
  session_id: "s1",
  phase3_status: "pending",
  phase3_started_at: null,
  ...over,
});

describe("settlement decisions — phase 3", () => {
  test("completed work is charged", () => {
    expect(decideLine(sheet({ phase3_status: "completed" }), false, "phase3")).toBe(
      "commit"
    );
  });

  test("work that failed AFTER starting is charged — the calls were spent", () => {
    const s = sheet({ phase3_status: "failed", phase3_started_at: new Date() });
    expect(decideLine(s, false, "phase3")).toBe("commit");
  });

  test("work that failed BEFORE starting is refunded — nothing was spent", () => {
    // e.g. the S3 download died or the Excel would not parse.
    const s = sheet({ phase3_status: "failed", phase3_started_at: null });
    expect(decideLine(s, false, "phase3")).toBe("release");
  });

  test("a run still in flight is left alone until its TTL", () => {
    const s = sheet({ phase3_status: "in_progress", phase3_started_at: new Date() });
    expect(decideLine(s, false, "phase3")).toBeNull();
  });

  test("a run stuck in_progress past its TTL is charged, not refunded", () => {
    // A dead Celery worker still burned whatever it burned before dying.
    const s = sheet({ phase3_status: "in_progress", phase3_started_at: new Date() });
    expect(decideLine(s, true, "phase3")).toBe("commit");
  });

  test("a run never dispatched is refunded once past its TTL", () => {
    expect(decideLine(sheet({ phase3_status: "pending" }), true, "phase3")).toBe(
      "release"
    );
  });

  test("a cancelled run that had started is charged for what it spent", () => {
    // The user hit Stop mid-run. Those model calls were still billed to us.
    const s = sheet({ phase3_status: "cancelled", phase3_started_at: new Date() });
    expect(decideLine(s, false, "phase3")).toBe("commit");
  });

  test("a cancelled run that never started is refunded immediately", () => {
    // Refunded at once, not at the TTL — the customer should see their credits
    // return within seconds of pressing Stop, not hours later.
    const s = sheet({ phase3_status: "cancelled", phase3_started_at: null });
    expect(decideLine(s, false, "phase3")).toBe("release");
  });

  test("a missing sheet is refunded once past its TTL, never before", () => {
    expect(decideLine(undefined, false, "phase3")).toBeNull();
    expect(decideLine(undefined, true, "phase3")).toBe("release");
  });
});

describe("settlement decisions — phase 2 discovery", () => {
  test("an existing sheet means exploration ran, so it is always charged", () => {
    // The engine only writes a user_excelsheet row after the exploration pass
    // produced a report. Refunding this because the customer never ran Phase 3
    // would give away model calls we were genuinely billed for.
    expect(decideLine(sheet({ phase3_status: "pending" }), false, "phase2")).toBe(
      "commit"
    );
    expect(decideLine(sheet({ phase3_status: "failed" }), false, "phase2")).toBe(
      "commit"
    );
  });

  test("a URL that produced nothing is refunded at TTL", () => {
    expect(decideLine(undefined, true, "phase2")).toBe("release");
  });
});

describe("reservation invariant: sum(lines) === credits held", () => {
  // settleReservation walks lines and commits/releases each one, so the lines
  // must add up to exactly what was held or credits are stranded forever.
  const buildLines = buildReservationLines;

  const price = (storyCounts) =>
    cm.priceRun(storyCounts.map((storyCount, i) => ({ sessionId: "s" + i, storyCount })));

  test("holds with a discovery down payment in place", () => {
    const run = price([2, 4, 20]);
    const alreadyHeld = run.urlCount; // reconciled to 1 credit per URL
    const amount = run.totalCredits - alreadyHeld;

    const lines = buildLines(run.lines, alreadyHeld, amount);
    expect(lines.reduce((a, l) => a + l.credits, 0)).toBe(amount);
  });

  test("holds when the discovery hold is missing entirely", () => {
    // The regression this guards: subtracting a down payment that was never
    // taken leaves sum(lines) < credits, and settle can never balance.
    const run = price([2, 4, 20]);
    const alreadyHeld = 0;
    const amount = run.totalCredits - alreadyHeld;

    const lines = buildLines(run.lines, alreadyHeld, amount);
    expect(lines.reduce((a, l) => a + l.credits, 0)).toBe(amount);
  });

  test("holds for a single-page run", () => {
    const run = price([1]);
    const amount = run.totalCredits - run.urlCount;
    const lines = buildLines(run.lines, run.urlCount, amount);
    expect(lines.reduce((a, l) => a + l.credits, 0)).toBe(amount);
  });

  test("the discovery down payment is never billed twice", () => {
    // A 20-story page costs 7 total: 1 held at discovery, 6 topped up.
    const run = price([20]);
    expect(run.totalCredits).toBe(7);

    const amount = run.totalCredits - run.urlCount;
    expect(amount).toBe(6);

    const lines = buildLines(run.lines, run.urlCount, amount);
    expect(lines[0].credits).toBe(6);
    // Discovery hold + top-up must equal the quoted total, not more.
    expect(run.urlCount + amount).toBe(run.totalCredits);
  });
});

describe("reservation TTL covers the engine's real worst case", () => {
  test("a max-size URL outlives the floor", () => {
    // app.py allows 300s PER STORY. 20 stories is up to 100 minutes for one
    // URL alone, so a flat 90-minute TTL would settle mid-run.
    const worstCaseMinutes = (cm.MAX_STORIES_PER_URL * 300) / 60;
    expect(cm.reservationTtlMinutes(cm.MAX_STORIES_PER_URL)).toBeGreaterThanOrEqual(
      worstCaseMinutes
    );
  });

  test("a large multi-page run scales past the floor", () => {
    expect(cm.reservationTtlMinutes(100)).toBe(600);
  });
});
