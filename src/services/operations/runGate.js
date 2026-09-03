import toast from "react-hot-toast";
import { creditPreflight } from "./creditAPIs";

/**
 * The one place a page asks "may this user start a billable run?".
 *
 * WHY THIS IS A SERVER CALL AND NOT A BALANCE COMPARISON
 * -----------------------------------------------------
 * Every page on the platform already holds a credit balance in Redux, and
 * gating on that number would be theatre: it can be stale, it can be edited in
 * a devtools console, and on an unlimited or overage-enabled plan it does not
 * decide the answer anyway. The decision belongs to the server, which owns the
 * subscription, the reservations and the enforcement flag. This helper is how
 * a page asks for that decision — see backend/controllers/creditController.js
 * `preflight`, which is the ONLY point at which a run is refused.
 *
 * WHY IT EXISTS AS A SHARED HELPER
 * --------------------------------
 * Web, API, Security and Test-Case-Designer each grew their own copy of this
 * five-line dance, and three products — Mobile, Database and Code — never grew
 * one at all. Those three billed after the fact: a user with a zero balance
 * could upload an APK, connect a database, or index a repository, watch the
 * work run to completion, and be charged into a negative balance for it. The
 * run was metered correctly; nothing ever refused to start it.
 *
 * Two of those three have no server-side gate to fall back on either. The
 * Database service is covered by its own Go middleware, so there the guard is
 * a courtesy that fails the user fast instead of at the API boundary. Mobile
 * and Code testing post to unauthenticated Python services directly from the
 * browser, so for them this call is the gate.
 *
 * That is also its limit, and it is worth being honest about: a browser-side
 * check stops a user who has run out of credits, not an attacker who bypasses
 * the browser. Closing that hole properly means the Mobile and Code services
 * verifying authorisation with Express before starting work, the way the Web
 * and Spec engines already check their run's authorisation in Mongo. This
 * helper is the correct fix for the reported defect and a placeholder for that
 * larger one.
 */

/**
 * @returns {{allowed: true} | {allowed: false, kind: "credits"|"error", message: string}}
 *
 * Never throws, and never fires a toast of its own — a caller rendering an
 * inline "not enough credits" panel with a top-up link wants the reason, not a
 * transient toast. Use `guardRun` when a toast is the right treatment.
 */
export async function checkRunAllowed(productLabel = "a test") {
  let preflight;
  try {
    preflight = await creditPreflight();
  } catch (err) {
    // creditPreflight normalises its own failures, so reaching here means
    // something unexpected. Fail CLOSED: an unverifiable balance must not
    // become an implicit allowance on the one product whose only gate this is.
    return {
      allowed: false,
      kind: "error",
      message: err?.message || "Could not verify your credit balance.",
    };
  }

  if (preflight?.ok) return { allowed: true };

  if (preflight?.code === "INSUFFICIENT_CREDITS") {
    return {
      allowed: false,
      kind: "credits",
      message:
        preflight.message ||
        `You don't have enough credits to start ${productLabel}.`,
    };
  }

  return {
    allowed: false,
    kind: "error",
    message: preflight?.message || "Could not verify your credit balance.",
  };
}

/**
 * Toast-rendering wrapper for the pages that report everything through toasts.
 *
 * @returns {Promise<boolean>} true when the run may proceed.
 */
export async function guardRun(productLabel = "a test") {
  const result = await checkRunAllowed(productLabel);
  if (result.allowed) return true;
  toast.error(result.message);
  return false;
}
