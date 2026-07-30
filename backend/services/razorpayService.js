/**
 * razorpayService — the only module that talks to Razorpay.
 *
 * Deliberately knows nothing about plans, credits or subscriptions: it creates
 * orders and it verifies signatures. All the domain logic lives in
 * purchaseService, which is therefore testable without a gateway.
 *
 * TWO DIFFERENT SECRETS, DO NOT MIX THEM UP
 * -----------------------------------------
 *   RAZORPAY_SECRET         — the API key secret. Signs the CHECKOUT callback
 *                             and authenticates our REST calls.
 *   RAZORPAY_WEBHOOK_SECRET — a separate string you choose when creating the
 *                             webhook in the Razorpay dashboard. Signs WEBHOOK
 *                             deliveries. It is not derived from the API keys.
 *
 * Note the env var is RAZORPAY_KEY, not the RAZORPAY_KEY_ID most Razorpay docs
 * use — that is what already exists in backend/.env.
 */

// Node's built-in crypto. `require("crypto")` resolves to core even though an
// abandoned `crypto@1.0.1` shim sits in package.json dependencies; core always
// wins for built-in module names. Do not "fix" this to a relative path.
const crypto = require("crypto");
const Razorpay = require("razorpay");

let client = null;

function isConfigured() {
  return !!(process.env.RAZORPAY_KEY && process.env.RAZORPAY_SECRET);
}

/**
 * The publishable key id. Safe to hand to an authenticated browser — it is the
 * same value that would otherwise sit in a REACT_APP_* variable, and returning
 * it from create-order means rotating the key needs no frontend rebuild.
 */
function publicKeyId() {
  return process.env.RAZORPAY_KEY || null;
}

/**
 * Memoised client. Fails LOUDLY and specifically on missing config: a generic
 * 500 here would send someone hunting through the payment flow for a bug that
 * is really an unset environment variable.
 */
function getClient() {
  if (client) return client;
  if (!isConfigured()) {
    throw new Error(
      "Razorpay is not configured: set RAZORPAY_KEY and RAZORPAY_SECRET in backend/.env"
    );
  }
  client = new Razorpay({
    key_id: process.env.RAZORPAY_KEY,
    key_secret: process.env.RAZORPAY_SECRET,
  });
  return client;
}

/**
 * Create an order.
 *
 * @param {{amountMinor:number, currency:"INR"|"USD", receipt:string, notes:object}} args
 * @returns {Promise<{id:string, amount:number, currency:string, receipt:string, status:string}>}
 *
 * `amountMinor` is paise for INR and cents for USD. Razorpay caps `receipt` at
 * 40 characters and `notes` at 15 keys.
 *
 * CURRENCY DETERMINES WHICH PAYMENT METHODS EXIST.
 * An INR order can be paid by UPI, netbanking, cards or wallets. A USD order
 * can only be paid by card — UPI and netbanking are India-domestic rails that
 * settle in INR and Razorpay will not display them.
 *
 * A USD order additionally requires INTERNATIONAL PAYMENTS to be enabled on the
 * Razorpay account. If it is not, this rejects at creation with a
 * BAD_REQUEST_ERROR naming international payments — the caller surfaces that
 * message verbatim rather than flattening it to "payment failed", because it is
 * the single most likely first-run misconfiguration.
 */
async function createOrder({ amountMinor, currency, receipt, notes = {} }) {
  const order = await getClient().orders.create({
    amount: amountMinor,
    currency,
    receipt: String(receipt).slice(0, 40),
    notes,
    payment_capture: 1,
  });
  return order;
}

/** Look a payment up out of band — what support uses to adjudicate a dispute. */
async function fetchPayment(razorpayPaymentId) {
  return getClient().payments.fetch(razorpayPaymentId);
}

/* ------------------------------------------------------------------ *
 * Signatures
 * ------------------------------------------------------------------ */

/**
 * Constant-time compare of two hex digests.
 *
 * The length guard is NOT optional: crypto.timingSafeEqual THROWS on buffers of
 * different lengths, so without it a forged or truncated signature becomes an
 * unhandled 500 instead of a clean refusal — and the throw itself leaks that
 * the length was wrong.
 */
function safeEqualHex(expectedHex, givenHex) {
  if (typeof givenHex !== "string" || typeof expectedHex !== "string") return false;
  const a = Buffer.from(expectedHex, "utf8");
  const b = Buffer.from(givenHex, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function hmacHex(secret, payload) {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Verify the signature Razorpay Checkout hands the browser after a successful
 * payment: HMAC_SHA256(`${order_id}|${payment_id}`, RAZORPAY_SECRET).
 *
 * This proves the browser is reporting a real payment for a real order. It does
 * NOT prove capture — the webhook is the authority for that.
 */
function verifyCheckoutSignature({ orderId, paymentId, signature }) {
  if (!orderId || !paymentId || !signature) return false;
  if (!process.env.RAZORPAY_SECRET) return false;
  const expected = hmacHex(process.env.RAZORPAY_SECRET, `${orderId}|${paymentId}`);
  return safeEqualHex(expected, signature);
}

/**
 * Verify a webhook delivery: HMAC_SHA256(RAW BODY, RAZORPAY_WEBHOOK_SECRET).
 *
 * `rawBody` MUST be the exact bytes Razorpay sent. Re-serialising the parsed
 * JSON produces different bytes (key order, whitespace, unicode escaping) and
 * the HMAC will never match — which is why the webhook route is mounted with
 * express.raw() ahead of the global express.json() in index.js.
 */
function verifyWebhookSignature(rawBody, signature) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    console.error(
      "⚠️ RAZORPAY_WEBHOOK_SECRET is not set — every webhook will be refused."
    );
    return false;
  }
  if (!rawBody || !signature) return false;
  const payload = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody), "utf8");
  const expected = hmacHex(secret, payload);
  return safeEqualHex(expected, signature);
}

module.exports = {
  isConfigured,
  publicKeyId,
  getClient,
  createOrder,
  fetchPayment,
  verifyCheckoutSignature,
  verifyWebhookSignature,
};
