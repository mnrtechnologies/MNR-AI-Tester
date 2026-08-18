/**
 * internalRoutes — server-to-server only. Not behind /api, so it never
 * passes through the public CORS allowlist or the 100-req/15min rate
 * limiter meant for browsers.
 */
const DbTestRun = require("../models/DbTestRun");
const express = require("express");
const User = require("../models/User");
const credits = require("../services/creditService");

const router = express.Router();

router.get("/credits/status", async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res
        .status(400)
        .json({ success: false, error: "userId is required" });
    }

    const user = await User.findById(userId).select("companyId").lean();
    if (!user?.companyId) {
      return res.json({
        success: true,
        data: { hasSubscription: false, balance: 0, reserved: 0 },
      });
    }

    const subscription = await credits.getActiveSubscription(user.companyId);
    if (!subscription) {
      return res.json({
        success: true,
        data: { hasSubscription: false, balance: 0, reserved: 0 },
      });
    }

    return res.json({
      success: true,
      data: {
        hasSubscription: true,
        balance: subscription.credits?.balance ?? 0,
        reserved: subscription.credits?.reserved ?? 0,
        planType: subscription.planType,
      },
    });
  } catch (err) {
    console.error("⚠️ internal credit status check failed:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});
router.post("/usage/db-test", async (req, res) => {
  try {
    const {
      runId,
      userId,
      jobType,
      dbType,
      status,
      durationMs,
      testCasesGenerated,
      objectsScanned,
    } = req.body;

    await DbTestRun.findOneAndUpdate(
      { run_id: runId },
      {
        $setOnInsert: {
          run_id: runId,
          user_id: userId,
          job_type: jobType,
          db_type: dbType,
          status,
          durationMs,
          testCasesGenerated,
          objectsScanned,
          billed: false,
          claimToken: null,
        },
      },
      { upsert: true },
    );

    res.json({ success: true, data: { recorded: true } });
  } catch (err) {
    console.error("⚠️ db-test usage record failed:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
