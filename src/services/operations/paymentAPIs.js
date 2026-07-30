import { apiConnector } from "../apiConnector";
import { toast } from "react-hot-toast";
import { paymentEndpoints } from "../api";
import { getUserDetails } from "./authAPIs";
import { ensureRazorpayLoaded, openCheckout } from "../../utils/razorpayCheckout";

const {
  CREATE_ORDER_API,
  VERIFY_PAYMENT_API,
  PAYMENT_HISTORY_API,
  ABANDON_PAYMENT_API,
} = paymentEndpoints;

const authHeader = () => {
  const token = JSON.parse(localStorage.getItem("token"));
  return { Authorization: `Bearer ${token}` };
};

/**
 * Discriminated result, same convention as creditAPIs.
 *
 * A payment flow has several outcomes that mean very different things to a
 * user — "you were not charged" versus "you were charged and it is landing" —
 * so the caller must be able to branch on `code`. Never collapse it to a
 * message string.
 */
function toResult(error) {
  const status = error?.response?.status;
  const body = error?.response?.data || {};
  return {
    ok: false,
    status,
    code: body.code || "REQUEST_FAILED",
    message: body.message || error?.message || "Request failed",
    data: body,
  };
}

/* ------------------------------------------------------------------ *
 * Raw calls
 * ------------------------------------------------------------------ */

/**
 * Ask the server to quote and open an order.
 *
 * Note what is NOT sent: an amount. The server prices the request itself from
 * pricing.data.json, so nothing the browser says can change what is charged.
 */
export const createPaymentOrder = async ({
  kind,
  planType,
  tierKey,
  period,
  credits,
  currency,
}) => {
  try {
    const body =
      kind === "credit_topup"
        ? { kind, credits, currency }
        : { kind, planType, tierKey, period, currency };
    const response = await apiConnector("POST", CREATE_ORDER_API, body, authHeader());
    return { ok: true, data: response.data.data };
  } catch (error) {
    return toResult(error);
  }
};

export const verifyPayment = async (payload) => {
  try {
    const response = await apiConnector("POST", VERIFY_PAYMENT_API, payload, authHeader());
    return { ok: true, data: response.data.data, alreadyFulfilled: response.data.alreadyFulfilled };
  } catch (error) {
    return toResult(error);
  }
};

export const getPaymentHistory = async ({ page = 1, limit = 25 } = {}) => {
  try {
    const response = await apiConnector(
      "GET",
      PAYMENT_HISTORY_API,
      null,
      authHeader(),
      { page, limit }
    );
    return { ok: true, data: response.data.data };
  } catch (error) {
    return toResult(error);
  }
};

/** Best-effort tidy-up when the modal is closed. Failure is not worth a toast. */
export const abandonPayment = async (paymentId) => {
  try {
    await apiConnector("POST", ABANDON_PAYMENT_API(paymentId), null, authHeader());
  } catch (_) {
    /* the order simply expires at Razorpay instead */
  }
};

/* ------------------------------------------------------------------ *
 * The whole journey
 * ------------------------------------------------------------------ */

/**
 * order -> checkout -> verify -> refresh entitlement.
 *
 * A thunk because on success it must dispatch getUserDetails(): user.creditAccount
 * feeds SubscriptionGuard, the header balance and UpgradePlan's own "Current"
 * badge, so without the refresh the user pays and the UI still shows the old plan.
 *
 * @returns {(dispatch) => Promise<{ok: boolean, code?: string, message?: string, data?: object}>}
 *
 * Result codes the caller should distinguish:
 *   ok                  — plan/credits are live
 *   CHECKOUT_DISMISSED  — user closed the modal. NOT an error; show nothing.
 *   PAYMENT_FAILED      — the gateway declined. Nothing was charged.
 *   SIGNATURE_MISMATCH  — do not retry, escalate to support.
 *   FULFILMENT_PENDING  — CHARGED but not yet applied. Must never be shown as
 *                         a failure; the webhook completes it within seconds.
 */
export function purchase({ kind, planType, tierKey, period, credits, currency }) {
  return async (dispatch) => {
    const loaded = await ensureRazorpayLoaded();
    if (!loaded) {
      const message =
        "Could not load the payment window. Please disable any ad blocker for this site and try again.";
      toast.error(message);
      return { ok: false, code: "CHECKOUT_UNAVAILABLE", message };
    }

    const order = await createPaymentOrder({
      kind,
      planType,
      tierKey,
      period,
      credits,
      currency,
    });
    if (!order.ok) {
      toast.error(order.message);
      return order;
    }

    const {
      paymentId,
      razorpayOrderId,
      amountMinor,
      // The server is the authority on both of these: it decides the currency
      // it created the order in, and which methods that currency supports.
      currency: chargedCurrency,
      methods,
      keyId,
      description,
      prefill,
    } = order.data;

    const outcome = await openCheckout({
      keyId,
      orderId: razorpayOrderId,
      amountMinor,
      currency: chargedCurrency,
      methods,
      description,
      prefill,
      notes: { paymentId },
    });

    if (outcome.status === "dismissed") {
      await abandonPayment(paymentId);
      return { ok: false, code: "CHECKOUT_DISMISSED", message: "Payment cancelled." };
    }

    if (outcome.status === "failed" || outcome.status === "unavailable") {
      toast.error(outcome.error || "The payment could not be completed.");
      return { ok: false, code: "PAYMENT_FAILED", message: outcome.error };
    }

    const verified = await verifyPayment(outcome.payload);

    if (!verified.ok) {
      // THE CAREFUL CASE: the card HAS been charged. Whatever went wrong here
      // is on our side, and the webhook will finish the job. Telling the user
      // "payment failed" would be false and would invite a second payment.
      if (verified.code === "FULFILMENT_PENDING" || !verified.status || verified.status >= 500) {
        const message =
          "Your payment went through. We are activating your plan now — this usually takes a few seconds.";
        toast.success(message);
        // Give the webhook a moment, then pick the new entitlement up.
        setTimeout(() => dispatch(getUserDetails()), 4000);
        setTimeout(() => dispatch(getUserDetails()), 12000);
        return { ok: false, code: "FULFILMENT_PENDING", message };
      }

      if (verified.code === "SIGNATURE_MISMATCH") {
        toast.error(
          "We could not verify this payment. Please contact support before trying again."
        );
        return verified;
      }

      toast.error(verified.message);
      return verified;
    }

    await dispatch(getUserDetails());

    toast.success(
      kind === "credit_topup" ? "Credits added to your balance." : "Your plan is live."
    );

    return { ok: true, data: verified.data };
  };
}
