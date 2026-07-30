const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const { auth, isCompanyAdmin } = require("../middleware/auth");
const {
  createOrder,
  verifyPayment,
  razorpayWebhook,
  getPaymentHistory,
  abandonPayment,
} = require("../controllers/paymentController");

/**
 * Purchases are rare per user but each create-order costs a round trip to
 * Razorpay, so this sits below the global 100/15min rather than above it.
 */
const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many payment requests, please slow down." },
});

router.use(paymentLimiter);

router.post("/create-order", auth, isCompanyAdmin, createOrder);
router.post("/verify", auth, isCompanyAdmin, verifyPayment);
router.post("/:paymentId/abandon", auth, isCompanyAdmin, abandonPayment);

// Any company member may read their company's invoices.
router.get("/history", auth, getPaymentHistory);

/**
 * The webhook lives on its own router because it is mounted SEPARATELY and
 * EARLY in index.js — ahead of both express.json() and the /api rate limiter.
 * See the comment at the mount site; the ordering is load-bearing.
 *
 * type "*\/*" rather than "application/json": Razorpay's content-type has
 * varied, and a raw parser that declines to match leaves req.body as {} and
 * every signature check fails with no obvious cause.
 */
const webhookRouter = express.Router();

const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  // Generous on purpose: Razorpay retries a failed delivery for 24 hours, and
  // throttling that looks exactly like an outage while customers sit unfulfilled.
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

webhookRouter.post(
  "/",
  webhookLimiter,
  express.raw({ type: "*/*", limit: "1mb" }),
  razorpayWebhook
);

module.exports = router;
module.exports.webhookRouter = webhookRouter;
