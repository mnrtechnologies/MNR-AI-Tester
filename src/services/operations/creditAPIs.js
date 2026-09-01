import { apiConnector } from "../apiConnector";
import { toast } from "react-hot-toast";
import { creditEndpoints } from "../api";
import {
  setCreditAccount,
  applyCreditDelta,
  setCreditRates,
} from "../../slices/profileSlice";

const {
  GET_CREDIT_ACCOUNT_API,
  GET_CREDIT_ESTIMATE_API,
  GET_CREDIT_LEDGER_API,
  GET_RUN_USAGE_API,
  CREDIT_PREFLIGHT_API,
  RESERVE_EXPLORATION_API,
  AUTHORIZE_RUN_API,
  SPEC_ESTIMATE_API,
  AUTHORIZE_SPEC_RUN_API,
  AUTHORIZE_VAPT_RUN_API,
  SETTLE_RUN_API,
  RELEASE_RUN_API,
  GRANT_CREDITS_API,
  ADJUST_CREDITS_API,
  ADMIN_CREDIT_OVERVIEW_API,
} = creditEndpoints;

const authHeader = () => {
  const token = JSON.parse(localStorage.getItem("token"));
  return { Authorization: `Bearer ${token}` };
};

/**
 * Normalise an axios error into a shape the credit gate can branch on.
 *
 * The rest of this app fires a generic toast and returns null on error. That
 * loses everything the gate needs: 402 carries the shortfall and the tier's
 * overage rate, 409 carries the list of oversized URLs. So these calls return
 * a discriminated result instead of throwing, and the caller decides what to
 * render. Never collapse `code` into a message string.
 */
function toResult(error) {
  const status = error?.response?.status;
  const body = error?.response?.data || {};
  return {
    ok: false,
    status,
    code: body.code || (status === 402 ? "INSUFFICIENT_CREDITS" : "REQUEST_FAILED"),
    message: body.message || error?.message || "Request failed",
    data: body,
  };
}

/* ------------------------------------------------------------------ *
 * Reads
 * ------------------------------------------------------------------ */

/** Fetch the company's credit account and push it into Redux. */
export function fetchCreditAccount() {
  return async (dispatch) => {
    try {
      const response = await apiConnector("GET", GET_CREDIT_ACCOUNT_API, null, authHeader());
      if (!response.data.success) throw new Error(response.data.message);
      dispatch(setCreditAccount(response.data.data));
      // Only present for Managed plans — the live meter needs them to convert
      // streamed token counts into credits without a round trip per call.
      if (response.data.modelRates) {
        dispatch(
          setCreditRates({
            modelRates: response.data.modelRates,
            usdPerCredit: response.data.usdPerCredit,
          })
        );
      }
      return { ok: true, data: response.data.data };
    } catch (error) {
      // Silent: a missing subscription is a normal state for a brand-new
      // company and should not fire a toast on every page load.
      return toResult(error);
    }
  };
}

/** Price a run. Read-only — never mutates a balance. */
export const getCreditEstimate = async (parentSession) => {
  try {
    const response = await apiConnector(
      "GET",
      `${GET_CREDIT_ESTIMATE_API}?parentSession=${encodeURIComponent(parentSession)}`,
      null,
      authHeader()
    );
    if (!response.data.success) throw new Error(response.data.message);
    return { ok: true, data: response.data.data };
  } catch (error) {
    return toResult(error);
  }
};

/**
 * Can this account start a run? The only refusal point on a Managed plan —
 * once work is under way the balance is allowed to go negative rather than
 * killing a run the customer has already partly paid for.
 */
export const creditPreflight = async () => {
  try {
    const response = await apiConnector("POST", CREDIT_PREFLIGHT_API, {}, authHeader());
    if (!response.data.success) throw new Error(response.data.message);
    return { ok: true, data: response.data.data };
  } catch (error) {
    return toResult(error);
  }
};

/** Itemised model spend for one run — the receipt behind a charge. */
export const getRunUsage = async (parentSession) => {
  try {
    const response = await apiConnector(
      "GET",
      `${GET_RUN_USAGE_API}/${encodeURIComponent(parentSession)}`,
      null,
      authHeader()
    );
    if (!response.data.success) throw new Error(response.data.message);
    return { ok: true, data: response.data.data };
  } catch (error) {
    return toResult(error);
  }
};

export const getCreditLedger = async ({ companyId, page = 1, limit = 50 } = {}) => {
  try {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (companyId) params.set("companyId", companyId);

    const response = await apiConnector(
      "GET",
      `${GET_CREDIT_LEDGER_API}?${params.toString()}`,
      null,
      authHeader()
    );
    if (!response.data.success) throw new Error(response.data.message);
    return { ok: true, data: response.data.data };
  } catch (error) {
    return toResult(error);
  }
};

/* ------------------------------------------------------------------ *
 * Metering
 * ------------------------------------------------------------------ */

/**
 * Hold credits before discovery starts. Returns ok:false with
 * code "INSUFFICIENT_CREDITS" (HTTP 402) when the balance is too low.
 */
export const reserveExploration = async (parentSession) => {
  try {
    const response = await apiConnector(
      "POST",
      RESERVE_EXPLORATION_API,
      { parentSession },
      authHeader()
    );
    return { ok: true, data: response.data.data, message: response.data.message };
  } catch (error) {
    return toResult(error);
  }
};

/**
 * The gate. Three outcomes the caller MUST handle separately:
 *   ok:true                              -> proceed to Phase 3
 *   INSUFFICIENT_CREDITS (402)           -> blocking modal, offer upgrade
 *   OVERSIZED_URL_REQUIRES_APPROVAL (409)-> per-URL confirmation, then retry
 *                                           with acknowledgedOversized: true
 */
export const authorizeRun = async (parentSession, { acknowledgedOversized = false } = {}) => {
  try {
    const response = await apiConnector(
      "POST",
      AUTHORIZE_RUN_API,
      { parentSession, acknowledgedOversized },
      authHeader()
    );
    return { ok: true, data: response.data.data, message: response.data.message };
  } catch (error) {
    return toResult(error);
  }
};

/**
 * What will a test case design run cost? Read-only — holds nothing.
 *
 * Priced server-side from the run record the engine wrote. The browser only
 * supplies the run id; it never computes or asserts a price.
 */
export const getSpecEstimate = async (runId) => {
  try {
    const response = await apiConnector(
      "GET",
      `${SPEC_ESTIMATE_API}?runId=${encodeURIComponent(runId)}`,
      null,
      authHeader()
    );
    return { ok: true, data: response.data.data, message: response.data.message };
  } catch (error) {
    return toResult(error);
  }
};

/**
 * The gate for a test case design run. Holds the estimated credits and stamps
 * the run as authorized so the engine will accept the design request.
 *
 * 402 -> not enough credits.  409 -> unusually large document, needs
 * acknowledgedOversized: true to proceed.
 */
export const authorizeSpecRun = async (runId, { acknowledgedOversized = false } = {}) => {
  try {
    const response = await apiConnector(
      "POST",
      AUTHORIZE_SPEC_RUN_API,
      { runId, acknowledgedOversized },
      authHeader()
    );
    return { ok: true, data: response.data.data, message: response.data.message };
  } catch (error) {
    return toResult(error);
  }
};

/**
 * The gate for a security-testing (VAPT) scan. Holds a flat estimate and stamps
 * the run authorized so the engine will run it; the reconciler settles the real
 * cost from measured duration afterward.
 *
 * ok:true -> proceed to start the scan.  402 -> not enough credits.
 */
export const authorizeVaptRun = async (runId, targetUrl) => {
  try {
    const response = await apiConnector(
      "POST",
      AUTHORIZE_VAPT_RUN_API,
      { runId, targetUrl },
      authHeader()
    );
    return { ok: true, data: response.data.data, message: response.data.message };
  } catch (error) {
    return toResult(error);
  }
};

/**
 * Fast-path settle when the run finishes. The server-side reconciler is the
 * authoritative settler, so a failure here is not worth interrupting the user.
 */
export function settleRun(parentSession) {
  return async (dispatch) => {
    try {
      const response = await apiConnector(
        "POST",
        SETTLE_RUN_API,
        { parentSession },
        authHeader()
      );
      const account = response.data?.data?.account;
      if (account) dispatch(setCreditAccount(account));
      return { ok: true, data: response.data.data };
    } catch (error) {
      console.warn("Credit settle failed; the reconciler will handle it.", error?.message);
      return toResult(error);
    }
  };
}

/** Give back held credits when the user abandons a run. */
export function releaseRun(parentSession) {
  return async (dispatch) => {
    try {
      const response = await apiConnector(
        "POST",
        RELEASE_RUN_API,
        { parentSession },
        authHeader()
      );
      dispatch(fetchCreditAccount());
      return { ok: true, data: response.data.data };
    } catch (error) {
      return toResult(error);
    }
  };
}

/** Patch the header pill immediately after a hold, without a refetch. */
export function patchCreditBalance({ balance, reserved }) {
  return (dispatch) => dispatch(applyCreditDelta({ balance, reserved }));
}

/* ------------------------------------------------------------------ *
 * Super admin
 * ------------------------------------------------------------------ */

export const grantCredits = async ({ companyId, credits, note }) => {
  try {
    const response = await apiConnector(
      "POST",
      GRANT_CREDITS_API,
      { companyId, credits, note },
      authHeader()
    );
    toast.success(response.data.message || "Credits granted");
    return { ok: true, data: response.data.data };
  } catch (error) {
    const result = toResult(error);
    toast.error(result.message);
    return result;
  }
};

export const adjustCredits = async ({ companyId, delta, note }) => {
  try {
    const response = await apiConnector(
      "POST",
      ADJUST_CREDITS_API,
      { companyId, delta, note },
      authHeader()
    );
    toast.success(response.data.message || "Balance adjusted");
    return { ok: true, data: response.data.data };
  } catch (error) {
    const result = toResult(error);
    toast.error(result.message);
    return result;
  }
};

export const getAdminCreditOverview = async () => {
  try {
    const response = await apiConnector("GET", ADMIN_CREDIT_OVERVIEW_API, null, authHeader());
    if (!response.data.success) throw new Error(response.data.message);
    return { ok: true, data: response.data.data };
  } catch (error) {
    return toResult(error);
  }
};
