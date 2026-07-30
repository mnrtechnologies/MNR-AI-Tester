/**
 * Razorpay Checkout, wrapped so callers never touch the global.
 *
 * checkout.js is loaded from a <script> in public/index.html, so window.Razorpay
 * is normally present by the time anyone clicks Buy. "Normally" is the problem:
 * an ad blocker, a corporate proxy or an offline first paint all leave the
 * global undefined, and a bare `new window.Razorpay(...)` throws a TypeError
 * that reads like an application crash. Everything here returns a result
 * instead.
 */

const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

/**
 * Resolve once window.Razorpay is usable, or false if it never becomes usable.
 * Injects the script if index.html's copy was blocked or removed.
 */
export function ensureRazorpayLoaded(timeoutMs = 8000) {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.Razorpay) return resolve(true);

    const existing = document.querySelector(`script[src="${CHECKOUT_SRC}"]`);
    const script = existing || document.createElement("script");

    const done = (ok) => {
      clearTimeout(timer);
      resolve(ok && !!window.Razorpay);
    };

    const timer = setTimeout(() => done(false), timeoutMs);

    script.addEventListener("load", () => done(true), { once: true });
    script.addEventListener("error", () => done(false), { once: true });

    if (!existing) {
      script.src = CHECKOUT_SRC;
      script.async = true;
      document.body.appendChild(script);
    }
  });
}

/**
 * Open the checkout modal and resolve with what happened.
 *
 * @returns {Promise<{status: "success"|"dismissed"|"failed"|"unavailable",
 *                    payload?: {razorpay_order_id, razorpay_payment_id, razorpay_signature},
 *                    error?: string}>}
 *
 * NEVER throws and NEVER resolves twice. Razorpay can fire both `handler` and
 * `modal.ondismiss` on some flows (the modal closes after a successful
 * payment), so a `settled` latch is required or a success gets overwritten by
 * a spurious "dismissed" and the user is told their payment failed.
 */
export function openCheckout({
  keyId,
  orderId,
  amountMinor,
  currency = "INR",
  description,
  prefill = {},
  notes = {},
  methods,
}) {
  return new Promise((resolve) => {
    if (!window.Razorpay) {
      return resolve({ status: "unavailable", error: "Razorpay checkout is not available." });
    }

    let settled = false;
    const settle = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    let rzp;
    try {
      /**
       * Which methods Checkout may show.
       *
       * The server decides this from the order currency, because it is not a
       * preference — UPI and netbanking are India-domestic rails that settle in
       * INR, so on a USD order Razorpay will not render them no matter what we
       * ask for. Passing the map explicitly also suppresses EMI and pay-later,
       * which we do not support.
       *
       * Falls back to INR's method set, matching the server default.
       */
      const method = methods || { card: true, upi: true, netbanking: true, wallet: true };

      rzp = new window.Razorpay({
        key: keyId,
        order_id: orderId,
        amount: amountMinor,
        currency,
        name: "MNR AI Tester",
        description,
        image:
          "https://res.cloudinary.com/dceqx37jk/image/upload/v1773217190/MNR_AT_egci7h.png",
        prefill,
        notes,
        method: { ...method, emi: false, paylater: false },
        theme: { color: "#f97316" },
        modal: {
          // Closing mid-payment is a normal thing to do, not an error.
          ondismiss: () => settle({ status: "dismissed" }),
          escape: true,
        },
        handler: (response) => settle({ status: "success", payload: response }),
      });

      rzp.on("payment.failed", (response) => {
        settle({
          status: "failed",
          error:
            response?.error?.description ||
            response?.error?.reason ||
            "The payment could not be completed.",
        });
      });

      rzp.open();
    } catch (err) {
      settle({ status: "unavailable", error: err?.message || "Could not open checkout." });
    }
  });
}
