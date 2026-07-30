/**
 * settlementRules — when held credits are earned, and when they go back.
 *
 * Pure logic, no database and no Mongoose, so it can be unit-tested and reused
 * from either side of the app. creditService.js is what applies these
 * decisions to real balances.
 *
 * CommonJS for the same reason as creditMath.js: Express requires it and
 * webpack imports it.
 */

/**
 * Decide whether one URL's held credits were actually spent.
 *
 * The rule that matters: work that FAILED after starting still burned model
 * calls, so it is charged. Work that never started (S3 download died, the
 * Excel would not parse) spent nothing and is refunded.
 *
 * The two scopes settle on different evidence:
 *
 *   phase2 — the existence of a user_excelsheet row IS the evidence. The
 *            engine only writes one after the exploration pass completed and
 *            produced a report, so the 1-credit down payment is earned the
 *            moment the row exists, regardless of whether the customer ever
 *            goes on to run Phase 3. Releasing it because Phase 3 never ran
 *            would give away work a model provider already billed us for.
 *
 *   phase3 — keyed off phase3_status, which the engine maintains.
 *
 * @param {object|undefined} sheet  the user_excelsheet doc, if any
 * @param {boolean} isExpired       has the reservation passed its TTL
 * @param {"phase2"|"phase3"} scope
 * @returns {"commit"|"release"|null}  null means "still running, decide later"
 */
function decideLine(sheet, isExpired, scope = "phase3") {
  if (!sheet) return isExpired ? "release" : null;

  if (scope === "phase2") return "commit";

  const status = sheet.phase3_status;
  const started = !!sheet.phase3_started_at;

  if (status === "completed") return "commit";

  // Failed and cancelled settle identically, and immediately — neither will
  // ever progress, so there is nothing to wait for. What was already spent is
  // charged; what never started is refunded. Deciding now rather than at the
  // TTL is the difference between a customer getting credits back in seconds
  // versus hours after they hit Stop.
  if (status === "failed" || status === "cancelled") {
    return started ? "commit" : "release";
  }

  if (!isExpired) return null; // still legitimately running

  // Past the TTL, decide rather than leak the hold forever.
  if (status === "in_progress") return "commit"; // assume the calls were spent
  return "release"; // never dispatched
}

/**
 * Split a run's total cost into per-URL reservation lines.
 *
 * settleReservation walks these lines and commits or releases each one, so
 * they MUST sum to exactly the amount held — otherwise credits are stranded
 * in `reserved` with nothing able to settle them.
 *
 * Each URL is charged its INCREMENTAL cost: its total minus the 1-credit down
 * payment discovery already holds for it. The deduction is conditional because
 * that hold may legitimately be absent (enforcement toggled on mid-run, or the
 * session arrived by another path); subtracting a down payment that was never
 * taken is what breaks the invariant.
 *
 * @param {Array<{sessionId, pageUrl, storyCount, credits}>} perUrl
 * @param {number} alreadyHeld  credits held by the discovery reservation
 * @param {number} amount       credits about to be held for this run
 */
function buildReservationLines(perUrl, alreadyHeld, amount) {
  const heldPerUrl = alreadyHeld >= perUrl.length ? 1 : 0;

  const lines = perUrl.map((l) => ({
    sessionId: l.sessionId,
    pageUrl: l.pageUrl,
    storyCount: l.storyCount,
    credits: Math.max(0, l.credits - heldPerUrl),
  }));

  // Belt and braces on the invariant. Rounding cannot break it today, but a
  // future change to the formula could, and a silent break here strands money.
  const total = lines.reduce((a, l) => a + l.credits, 0);
  if (total !== amount && lines.length > 0) {
    const last = lines[lines.length - 1];
    last.credits = Math.max(0, last.credits + (amount - total));
  }

  return lines;
}

module.exports = { decideLine, buildReservationLines };
