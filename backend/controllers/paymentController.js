const User = require("../models/User");
const Company = require("../models/Company");
const Payment = require("../models/Payment");
const credits = require("../services/creditService");
const purchases = require("../services/purchaseService");
const razorpay = require("../services/razorpayService");
const pq = require("../../src/config/pricing/purchaseQuote");

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

/** Same error envelope creditController uses, so clients branch on `code`. */
function fail(res, status, code, message, extra = {}) {
  return res.status(status).json({ success: false, code, error: code, message, ...extra });
}

/**
 * Map a purchaseQuote refusal onto an HTTP status.
 *
 * Unbuyable and custom tiers are 409 with contactSales, not 400: the request
 * was well-formed, the tier simply is not sold self-serve, and the UI needs to
 * open the contact-sales modal rather than show a validation error.
 */
function quoteRefusalStatus(code) {
  if (code === "TIER_UNAVAILABLE" || code === "TIER_CUSTOM") return 409;
  return 400;
}

/* ------------------------------------------------------------------ *
 * POST /api/payments/create-order
 * ------------------------------------------------------------------ */

/**
 * Quote server-side, create a Razorpay order, and record the intent.
 *
 * THE BROWSER SENDS NO AMOUNT. The entire trusted input is which tier, period
 * and currency (or how many credits); every figure is re-derived here from
 * pricing.data.json. A tampered request can change WHAT is bought and WHICH
 * CURRENCY it is billed in, never what it costs.
 *
 * Currency is deliberately the caller's choice: an Indian buyer needs an INR
 * order to get UPI and netbanking at all, and an international buyer needs USD.
 * Both are priced from the same USD catalog figure, so choosing one cannot make
 * a purchase cheaper — only differently denominated.
 */
exports.createOrder = async (req, res) => {
  try {
    if (!razorpay.isConfigured()) {
      return fail(
        res,
        503,
        "PAYMENTS_UNAVAILABLE",
        "Online payment is not configured on this server. Please contact sales."
      );
    }

    const companyId = req.companyId;
    const { kind, currency } = req.body || {};

    if (!["plan_purchase", "credit_topup"].includes(kind)) {
      return fail(res, 400, "INVALID_KIND", 'kind must be "plan_purchase" or "credit_topup".');
    }

    let quote;

    if (kind === "credit_topup") {
      // Refuse BEFORE taking money: there must be a subscription to add to.
      const subscription = await credits.getActiveSubscription(companyId);
      if (!subscription) {
        return fail(
          res,
          409,
          "NO_ACTIVE_SUBSCRIPTION",
          "Buy a plan before topping up credits."
        );
      }

      quote = pq.quoteCredits({
        planType: subscription.planType,
        tierKey: subscription.tierKey,
        quantity: req.body.credits,
        currency,
        // The subscription's snapshotted rate wins, so a customer pinned to an
        // older pricingVersion is charged what they signed up for.
        extraCreditUsdOverride: subscription.credits?.overageRateUsd,
      });
    } else {
      quote = pq.quotePlan({
        planType: req.body.planType,
        tierKey: req.body.tierKey,
        period: req.body.period,
        currency,
      });
    }

    if (!quote.ok) {
      return fail(res, quoteRefusalStatus(quote.code), quote.code, quote.message, {
        contactSales: quote.code === "TIER_UNAVAILABLE" || quote.code === "TIER_CUSTOM",
      });
    }

    const payment = await Payment.create({
      companyId,
      createdBy: req.user.id,
      kind: quote.kind,
      planType: quote.planType,
      tierKey: quote.tierKey,
      period: quote.period || null,
      creditsPurchased: quote.kind === "plan_purchase" ? quote.credits : quote.quantity,
      amountMinor: quote.amountMinor,
      currency: quote.currency,
      amountUsdSnapshot: quote.amountUsd,
      priceUsdSnapshot:
        quote.kind === "plan_purchase" ? quote.unitPriceUsdMonthly : quote.unitPriceUsd,
      pricingVersion: quote.pricingVersion,
      fxRateInrPerUsd: quote.fxRateInrPerUsd,
      description: quote.description,
      status: "created",
    });

    let order;
    try {
      order = await razorpay.createOrder({
        amountMinor: quote.amountMinor,
        currency: quote.currency,
        receipt: `pay_${payment._id}`,
        notes: {
          paymentId: String(payment._id),
          companyId: String(companyId),
          kind: quote.kind,
          tierKey: quote.tierKey || "",
          period: quote.period || "",
        },
      });
    } catch (err) {
      // Surface Razorpay's own message verbatim. On a first run this is
      // overwhelmingly "international payments not enabled", and flattening it
      // to "payment failed" sends someone debugging the wrong thing for a day.
      const reason =
        err?.error?.description || err?.description || err?.message || "Order creation failed";
      await Payment.updateOne(
        { _id: payment._id },
        { $set: { status: "failed", failureReason: reason, failedAt: new Date() } }
      );
      console.error("Razorpay order creation failed:", reason);
      return fail(res, 502, "GATEWAY_ERROR", `Payment gateway error: ${reason}`);
    }

    await Payment.updateOne({ _id: payment._id }, { $set: { razorpayOrderId: order.id } });

    const user = await User.findById(req.user.id).select("name email mobile");

    return res.status(201).json({
      success: true,
      message: "Order created",
      data: {
        paymentId: payment._id,
        razorpayOrderId: order.id,
        amountMinor: quote.amountMinor,
        amountCharged: quote.amountCharged,
        amountFormatted: quote.amountFormatted,
        amountUsd: quote.amountUsd,
        currency: quote.currency,
        // Which methods Checkout may display. UPI and netbanking only exist on
        // an INR order; sending them on a USD one renders an unusable option.
        methods: quote.methods,
        keyId: razorpay.publicKeyId(),
        description: quote.description,
        prefill: {
          name: user?.name || "",
          email: user?.email || "",
          contact: user?.mobile || "",
        },
        quote: {
          kind: quote.kind,
          tierName: quote.tierName,
          tierKey: quote.tierKey,
          planType: quote.planType,
          period: quote.period || null,
          months: quote.months || null,
          credits: quote.kind === "plan_purchase" ? quote.credits : quote.quantity,
        },
      },
    });
  } catch (error) {
    console.error("Create Order Error:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

/* ------------------------------------------------------------------ *
 * POST /api/payments/verify
 * ------------------------------------------------------------------ */

/**
 * The browser callback. Fast path only — the webhook is the authority and will
 * fulfil this payment anyway if the browser never gets here.
 */
exports.verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return fail(
        res,
        400,
        "MISSING_FIELDS",
        "razorpay_order_id, razorpay_payment_id and razorpay_signature are required."
      );
    }

    const payment = await Payment.findOne({ razorpayOrderId: razorpay_order_id });
    if (!payment) {
      return fail(res, 404, "PAYMENT_NOT_FOUND", "No such order.");
    }

    // Ownership. Without this, any company admin could replay another
    // company's order id and claim its fulfilment response.
    if (String(payment.companyId) !== String(req.companyId)) {
      return fail(res, 403, "FORBIDDEN", "This order belongs to another company.");
    }

    if (
      !razorpay.verifyCheckoutSignature({
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        signature: razorpay_signature,
      })
    ) {
      /**
       * REFUSE, BUT DO NOT TOUCH THE PAYMENT.
       *
       * A bad signature says the CALLER cannot be trusted. It says nothing
       * about whether Razorpay captured the money. Marking the payment
       * "failed" here would let anyone who can guess an order id poison a
       * genuine purchase: "failed" is not a claimable status, so the real
       * callback AND the webhook would both then be locked out and the
       * customer would pay and receive nothing, permanently.
       *
       * Only an authenticated signal — a valid callback signature, or a
       * webhook signed with RAZORPAY_WEBHOOK_SECRET — may move this state.
       */
      console.error(
        `⚠️ checkout signature mismatch for order ${razorpay_order_id} (payment left untouched)`
      );
      return fail(
        res,
        400,
        "SIGNATURE_MISMATCH",
        "We could not verify this payment. Please contact support before retrying."
      );
    }

    const result = await purchases.fulfilPayment(payment._id, {
      source: "callback",
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
    });

    const subscription =
      result.subscription || (await credits.getActiveSubscription(payment.companyId));

    return res.status(200).json({
      success: true,
      // NOT an error: it means the webhook won the race and already applied
      // the entitlement. The user's plan is live either way.
      alreadyFulfilled: !result.fulfilled,
      message: result.fulfilled ? "Payment verified" : "Payment already applied",
      data: {
        status: result.payment?.status || "paid",
        creditAccount: credits.getAccountSnapshot(subscription),
      },
    });
  } catch (error) {
    console.error("Verify Payment Error:", error);
    // The money is captured; the webhook will retry fulfilment. Say so rather
    // than reporting a failure the customer would read as "I was not charged".
    return res.status(500).json({
      success: false,
      code: "FULFILMENT_PENDING",
      error: "FULFILMENT_PENDING",
      message:
        "Your payment went through but we could not activate it immediately. It will complete shortly — please refresh in a minute.",
    });
  }
};

/* ------------------------------------------------------------------ *
 * POST /api/payments/webhook  (no auth — signature IS the auth)
 * ------------------------------------------------------------------ */

/**
 * The authority on what was actually captured.
 *
 * req.body is a Buffer here: this route is mounted with express.raw() ahead of
 * the global express.json() in index.js, because the signature is an HMAC over
 * the exact bytes Razorpay sent and re-serialised JSON produces different ones.
 */
exports.razorpayWebhook = async (req, res) => {
  const signature = req.get("x-razorpay-signature");

  if (!razorpay.verifyWebhookSignature(req.body, signature)) {
    // Do not parse, do not log the body — it is unauthenticated input.
    console.error("⚠️ webhook rejected: signature verification failed");
    return res.status(401).json({ success: false, message: "Invalid signature" });
  }

  let event;
  try {
    event = JSON.parse(Buffer.isBuffer(req.body) ? req.body.toString("utf8") : req.body);
  } catch (err) {
    return res.status(400).json({ success: false, message: "Malformed payload" });
  }

  const eventId = req.get("x-razorpay-event-id") || null;
  const entity = event?.payload?.payment?.entity;

  try {
    if (event.event !== "payment.captured" && event.event !== "payment.failed") {
      return res.status(200).json({ received: true, ignored: true });
    }

    if (!entity) {
      return res.status(200).json({ received: true, ignored: true });
    }

    const paymentId = entity.notes?.paymentId;
    const payment = paymentId
      ? await Payment.findById(paymentId).catch(() => null)
      : await Payment.findOne({ razorpayOrderId: entity.order_id });

    if (!payment) {
      // Razorpay also delivers events for dashboard test activity that has no
      // Payment here. A 4xx would make it retry that forever.
      console.warn(`webhook: no local payment for order ${entity.order_id}`);
      return res.status(200).json({ received: true, unknownOrder: true });
    }

    if (event.event === "payment.failed") {
      await Payment.updateOne(
        { _id: payment._id, status: { $in: ["created", "attempted"] } },
        {
          $set: {
            status: "failed",
            razorpayPaymentId: entity.id,
            failureReason: entity.error_description || entity.error_reason || "Payment failed",
            failedAt: new Date(),
          },
        }
      );
      return res.status(200).json({ received: true });
    }

    /* payment.captured */

    // Amount tamper check. The order was created for a server-computed amount
    // in a specific currency; if either differs from what was captured, do not
    // grant anything on trust. Both halves matter — 19900 paise and 19900 cents
    // are the same number and wildly different sums of money.
    if (entity.amount !== payment.amountMinor || entity.currency !== payment.currency) {
      const detail = `captured ${entity.amount} ${entity.currency}, expected ${payment.amountMinor} ${payment.currency}`;
      await Payment.updateOne(
        { _id: payment._id },
        {
          $set: {
            status: "fulfilment_failed",
            razorpayPaymentId: entity.id,
            failureReason: `amount mismatch: ${detail}`,
            failedAt: new Date(),
          },
        }
      );
      console.error(`🚨 amount mismatch on payment ${payment._id}: ${detail}`);
      return res.status(200).json({ received: true, mismatch: true });
    }

    await purchases.fulfilPayment(payment._id, {
      source: "webhook",
      razorpayPaymentId: entity.id,
      method: entity.method || null,
      eventId,
    });

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("Razorpay Webhook Error:", error);
    // 500 so Razorpay retries with backoff for 24h. The payment is left in
    // fulfilment_failed and the retry resumes from its markers.
    return res.status(500).json({ success: false, message: "Fulfilment failed" });
  }
};

/* ------------------------------------------------------------------ *
 * Reads
 * ------------------------------------------------------------------ */

/** GET /api/payments/history — company-scoped, like creditController.getLedger. */
exports.getPaymentHistory = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("role companyId");
    if (!user) return fail(res, 404, "USER_NOT_FOUND", "User not found.");

    const companyId =
      user.role === "super_admin" && req.query.companyId ? req.query.companyId : user.companyId;

    if (!companyId) {
      return fail(res, 404, "NO_COMPANY", "This user is not linked to a company.");
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));

    // Orders nobody completed are noise on an invoice list.
    const query = { companyId, status: { $nin: ["created", "abandoned"] } };
    if (req.query.status) query.status = req.query.status;

    const [rows, total] = await Promise.all([
      Payment.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select("-razorpaySignature -__v")
        .lean(),
      Payment.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      message: "Payment history fetched successfully",
      data: { rows, page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Get Payment History Error:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

/**
 * POST /api/payments/:paymentId/abandon
 *
 * Advisory tidy-up when the user closes the checkout modal. Conditional on
 * status "created", so it can never touch a payment that is being fulfilled or
 * has already been paid — including one captured a moment before the user
 * dismissed the window.
 */
exports.abandonPayment = async (req, res) => {
  try {
    await Payment.updateOne(
      { _id: req.params.paymentId, companyId: req.companyId, status: "created" },
      { $set: { status: "abandoned" } }
    );
    return res.status(200).json({ success: true, message: "Order abandoned" });
  } catch (error) {
    console.error("Abandon Payment Error:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};
