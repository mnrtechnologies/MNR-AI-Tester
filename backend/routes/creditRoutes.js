const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const { auth, isSuperAdmin } = require("../middleware/auth");
const {
  getAccount,
  getEstimate,
  getLedger,
  getRunUsage,
  preflight,
  getPricingConfig,
  reserveExploration,
  authorizeRun,
  settleRun,
  releaseRun,
  grantCredits,
  adjustCredits,
  getAdminOverview,
} = require("../controllers/creditController");

/**
 * The global limiter in index.js allows 100 requests per 15 minutes across all
 * of /api. The Phase Review screen refreshes its estimate on every load and
 * after every save, so credit reads would eat that budget and surface as a
 * baffling intermittent failure. Give this router its own, higher ceiling.
 */
const creditLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many credit requests, please slow down." },
});

router.use(creditLimiter);

/* ---------------- Reads ---------------- */

// Public tier tables (internal cost anchors are stripped by the controller).
router.get("/pricing", getPricingConfig);

router.get("/account", auth, getAccount);
router.get("/estimate", auth, getEstimate);
router.get("/ledger", auth, getLedger);

// Itemised model spend for one run — the receipt behind a charge.
router.get("/usage/:parentSession", auth, getRunUsage);

/* ---------------- Metering ---------------- */

// Can this account start a run at all? Both meters. The only refusal point on
// a Managed plan — once running, the balance is allowed to go negative.
router.post("/preflight", auth, preflight);

// Hold the crawler's page ceiling before Phase 2 starts. 402 when short.
router.post("/reserve-exploration", auth, reserveExploration);

// The gate. 200 authorized / 402 insufficient / 409 oversized URL.
router.post("/authorize-run", auth, authorizeRun);

// Idempotent. The reconciler is the authoritative settler; this is the fast path.
router.post("/settle", auth, settleRun);

// Explicit abandon.
router.post("/release", auth, releaseRun);

/* ---------------- Super admin ---------------- */

router.post("/grant", auth, isSuperAdmin, grantCredits);
router.post("/adjust", auth, isSuperAdmin, adjustCredits);
router.get("/admin/overview", auth, isSuperAdmin, getAdminOverview);

module.exports = router;
