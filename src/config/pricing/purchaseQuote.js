/**
 * purchaseQuote — the single source of truth for what a purchase COSTS.
 *
 * WHY THIS FILE IS COMMONJS
 * -------------------------
 * Same reason as creditMath.js, and the same rule: it is consumed by BOTH
 *   - the Express backend, which computes the amount it charges, and
 *   - the React frontend, which renders the amount the user confirms.
 * One function, so the displayed price and the charged price cannot drift.
 * Do not convert this to `export`/`import` syntax — it will break the backend.
 *
 * THE BROWSER NEVER SENDS AN AMOUNT.
 * The client sends only { planType, tierKey, period, currency } or
 * { quantity, currency }; the server re-derives every figure here from
 * pricing.data.json. A tampered request can change WHAT is bought and WHICH
 * CURRENCY it is billed in, but never what it costs.
 *
 * TWO CURRENCIES, AND WHY
 * -----------------------
 * UPI and netbanking are India-domestic rails that settle in INR only —
 * Razorpay will not offer either on a USD-denominated order, which is why a
 * USD checkout shows cards and nothing else. So:
 *
 *   INR  -> Indian buyers. UPI, netbanking, cards, wallets.
 *   USD  -> international buyers. Cards only.
 *
 * USD remains the AUTHORED price: one number per tier in pricing.data.json, as
 * it has always been. The INR figure is DERIVED here via creditMath.usdToInr,
 * and the rate used is snapshotted onto the Payment so that changing
 * fx.inrPerUsd later re-prices new orders only and never makes an old receipt
 * disagree with what was actually charged.
 *
 * WHAT A 6-MONTH PURCHASE BUYS
 * ----------------------------
 * A tier's `credits` figure is PER MONTH ("250 credits / month"). A semiAnnual
 * purchase is six monthly allowances at a discount, NOT a lump of 6x credits on
 * day one. `credits` on a quote is therefore identical for both periods, and
 * only `months` differs. Handing over six months of capacity up front would let
 * a customer consume half a year of our concurrency in a week — credits meter
 * capacity, not a prepaid wallet.
 *
 * EVERY FUNCTION RETURNS, NEVER THROWS.
 * A refusal is `{ ok: false, code, message }`. Callers on both sides branch on
 * `code`, so a new refusal reason never surfaces as a 500.
 */

const cm = require("./creditMath");

/** Purchasable billing periods, and how many months each adds. */
const PERIODS = { monthly: 1, semiAnnual: 6 };

/**
 * Billable currencies.
 *
 * `methods` is what Razorpay Checkout is allowed to display. It is not
 * cosmetic: offering UPI on a USD order produces a payment page the gateway
 * cannot fulfil.
 */
const CURRENCIES = {
  INR: {
    code: "INR",
    symbol: "₹",
    locale: "en-IN",
    methods: { card: true, upi: true, netbanking: true, wallet: true },
  },
  USD: {
    code: "USD",
    symbol: "$",
    locale: "en-US",
    // Cards only. UPI and netbanking are INR-settled and simply will not appear.
    methods: { card: true, upi: false, netbanking: false, wallet: false },
  },
};

const DEFAULT_CURRENCY = "INR";

/**
 * Razorpay rejects an order below the smallest chargeable amount. That is $1.00
 * and ₹1.00 respectively — 100 minor units either way, so one constant covers
 * both. Far below any real tier, so this only ever catches a misconfigured tier
 * or a top-up so small it rounds away.
 */
const MIN_AMOUNT_MINOR = 100;

/**
 * Ceiling on a single top-up. Not a business limit — a guard so a fat-fingered
 * or scripted quantity cannot create a five-figure order.
 */
const MAX_TOPUP_CREDITS = 10000;

/**
 * Major units -> integer minor units (cents for USD, paise for INR).
 *
 * Every amount that reaches Razorpay goes through here, and all downstream
 * arithmetic is done ON THE MINOR UNITS. Pricing a 10-credit top-up as
 * Math.round(10 * 0.75 * 100) invites float drift; toMinor(0.75) * 10 cannot.
 */
function toMinor(amount) {
  if (amount === null || amount === undefined) return null;
  const n = Number(amount);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

/**
 * Convert a canonical USD figure into the currency actually being charged.
 * USD passes through; INR is rounded to whole rupees before any multiplication
 * so a customer is never quoted a fractional paisa.
 */
function inCurrency(amountUsd, currency) {
  return currency === "INR" ? cm.usdToInr(amountUsd) : amountUsd;
}

/** Render an amount for display, e.g. "$199" or "₹17,512". */
function formatCharge(amount, currency) {
  const c = CURRENCIES[currency] || CURRENCIES[DEFAULT_CURRENCY];
  const n = Number(amount);
  return `${c.symbol}${n.toLocaleString(c.locale, {
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
  })}`;
}

/** Payment methods Razorpay Checkout may show for a currency. */
function methodsFor(currency) {
  return (CURRENCIES[currency] || CURRENCIES[DEFAULT_CURRENCY]).methods;
}

function refuse(code, message) {
  return { ok: false, code, message };
}

/** Normalise and validate a requested currency. */
function resolveCurrency(currency) {
  const code = String(currency || DEFAULT_CURRENCY).toUpperCase();
  if (!CURRENCIES[code]) {
    return refuse(
      "INVALID_CURRENCY",
      `Unsupported currency "${currency}". Expected one of: ${Object.keys(CURRENCIES).join(", ")}.`
    );
  }
  return { ok: true, code };
}

/**
 * Resolve a tier and refuse everything that must never reach checkout.
 * Shared by both quote functions so the rules cannot be applied to one and
 * forgotten on the other.
 */
function resolvePurchasableTier(planType, tierKey) {
  const tier = cm.getTier(planType, tierKey);

  if (!tier) {
    return refuse(
      "TIER_NOT_FOUND",
      `Unknown plan/tier "${planType}/${tierKey}".`
    );
  }

  // managed_pro is priced but deliberately not for sale — the hybrid model
  // routing it assumes does not exist in the AI engine yet and margins invert
  // on the unoptimised path. pricing.data.json carries the reason; surface it.
  if (tier.available === false) {
    return refuse(
      "TIER_UNAVAILABLE",
      `The "${tier.name}" tier is not available for purchase yet.`
    );
  }

  // self_hosted and enterprise publish no price at all. They are negotiated per
  // deal and provisioned by a super admin, so they stay on contact-sales.
  if (tier.custom === true) {
    return refuse(
      "TIER_CUSTOM",
      `The "${tier.name}" tier is priced per deal — please contact sales.`
    );
  }

  return { ok: true, tier };
}

/**
 * Price a plan purchase.
 *
 * @param {{planType: string, tierKey: string, period: "monthly"|"semiAnnual",
 *          currency?: "INR"|"USD"}} args
 * @returns {{ok: false, code: string, message: string} |
 *           {ok: true, kind: "plan_purchase", planType, tierKey, tierName,
 *            period, months, unitPriceUsdMonthly, amountUsd, currency,
 *            amountCharged, amountMinor, amountFormatted, methods, credits,
 *            concurrentSites, engine, extraCreditUsd, pricingVersion,
 *            fxRateInrPerUsd, description}}
 */
function quotePlan({ planType, tierKey, period, currency } = {}) {
  const cur = resolveCurrency(currency);
  if (!cur.ok) return cur;

  const resolved = resolvePurchasableTier(planType, tierKey);
  if (!resolved.ok) return resolved;
  const { tier } = resolved;

  const months = PERIODS[period];
  if (!months) {
    return refuse(
      "INVALID_PERIOD",
      `Unknown billing period "${period}". Expected one of: ${Object.keys(PERIODS).join(", ")}.`
    );
  }

  // semiAnnualUsd applies the published discount to 6x the monthly price. It is
  // the same helper the pricing cards render from, so the headline figure the
  // user saw and the figure we charge are produced by one function.
  const amountUsd =
    period === "semiAnnual"
      ? cm.semiAnnualUsd(tier.priceUsdMonthly)
      : tier.priceUsdMonthly;

  const amountCharged = inCurrency(amountUsd, cur.code);
  const amountMinor = toMinor(amountCharged);

  if (amountMinor === null || amountMinor < MIN_AMOUNT_MINOR) {
    return refuse(
      "AMOUNT_TOO_SMALL",
      `The computed amount for "${tier.name}" is below the minimum chargeable amount.`
    );
  }

  return {
    ok: true,
    kind: "plan_purchase",
    planType,
    tierKey,
    tierName: tier.name,
    period,
    months,
    unitPriceUsdMonthly: tier.priceUsdMonthly,
    // The canonical catalog figure, always USD, kept for the record.
    amountUsd,
    // What the customer is actually billed.
    currency: cur.code,
    amountCharged,
    amountMinor,
    amountFormatted: formatCharge(amountCharged, cur.code),
    methods: methodsFor(cur.code),
    // PER MONTH, for both periods. See the file header.
    credits: tier.credits,
    concurrentSites: tier.concurrentSites || 1,
    engine: tier.engine || null,
    extraCreditUsd: tier.extraCreditUsd ?? null,
    pricingVersion: cm.PRICING_VERSION,
    fxRateInrPerUsd: cm.FX_INR_PER_USD,
    description:
      period === "semiAnnual" ? `${tier.name} — 6 months` : `${tier.name} — 1 month`,
  };
}

/**
 * Price a mid-period credit top-up at the tier's extra-credit rate.
 *
 * `extraCreditUsdOverride` exists so the SERVER can pass the subscription's own
 * snapshotted `credits.overageRateUsd`. A customer pinned to an older
 * pricingVersion must be charged the rate they signed up for, not whatever
 * pricing.data.json says today. The frontend omits it and gets today's rate,
 * which is correct for the estimate it renders before the server quotes.
 *
 * @param {{planType, tierKey, quantity: number, currency?: "INR"|"USD",
 *          extraCreditUsdOverride?: number}} args
 * @returns {{ok: false, code, message} |
 *           {ok: true, kind: "credit_topup", planType, tierKey, tierName,
 *            quantity, unitPriceUsd, unitPriceCharged, amountUsd, currency,
 *            amountCharged, amountMinor, amountFormatted, methods,
 *            pricingVersion, fxRateInrPerUsd, description}}
 */
function quoteCredits({
  planType,
  tierKey,
  quantity,
  currency,
  extraCreditUsdOverride,
} = {}) {
  const cur = resolveCurrency(currency);
  if (!cur.ok) return cur;

  const resolved = resolvePurchasableTier(planType, tierKey);
  if (!resolved.ok) return resolved;
  const { tier } = resolved;

  const qty = Number(quantity);
  if (!Number.isInteger(qty) || qty < 1 || qty > MAX_TOPUP_CREDITS) {
    return refuse(
      "INVALID_QUANTITY",
      `Credit quantity must be a whole number between 1 and ${MAX_TOPUP_CREDITS}.`
    );
  }

  const rate =
    extraCreditUsdOverride !== undefined &&
    extraCreditUsdOverride !== null &&
    Number.isFinite(Number(extraCreditUsdOverride))
      ? Number(extraCreditUsdOverride)
      : tier.extraCreditUsd;

  if (rate === null || rate === undefined || !Number.isFinite(Number(rate)) || Number(rate) <= 0) {
    return refuse(
      "NO_EXTRA_CREDIT_RATE",
      `The "${tier.name}" tier has no published extra-credit rate.`
    );
  }

  // Convert the PER-CREDIT rate first, then multiply.
  //
  // Rounding the unit rather than the total is what keeps the price
  // explainable: the customer is shown "₹66 per credit" and charged exactly
  // 66 x quantity. Converting the total instead yields a figure that does not
  // divide by the advertised unit price.
  const unitPriceCharged = inCurrency(Number(rate), cur.code);
  // Multiply the MINOR UNITS by the quantity, never the major ones. See toMinor.
  const amountMinor = toMinor(unitPriceCharged) * qty;
  const amountCharged = unitPriceCharged * qty;

  if (amountMinor < MIN_AMOUNT_MINOR) {
    return refuse(
      "AMOUNT_TOO_SMALL",
      `That top-up comes to less than the minimum chargeable amount — please buy more credits.`
    );
  }

  return {
    ok: true,
    kind: "credit_topup",
    planType,
    tierKey,
    tierName: tier.name,
    quantity: qty,
    unitPriceUsd: Number(rate),
    unitPriceCharged,
    amountUsd: Number(rate) * qty,
    currency: cur.code,
    amountCharged,
    amountMinor,
    amountFormatted: formatCharge(amountCharged, cur.code),
    methods: methodsFor(cur.code),
    pricingVersion: cm.PRICING_VERSION,
    fxRateInrPerUsd: cm.FX_INR_PER_USD,
    description: `${qty} extra credit${qty === 1 ? "" : "s"} — ${tier.name}`,
  };
}

module.exports = {
  quotePlan,
  quoteCredits,
  toMinor,
  inCurrency,
  formatCharge,
  methodsFor,
  PERIODS,
  CURRENCIES,
  DEFAULT_CURRENCY,
  MIN_AMOUNT_MINOR,
  MAX_TOPUP_CREDITS,
};
