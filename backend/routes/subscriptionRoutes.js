const express = require('express');
const router = express.Router();
const { auth,isSuperAdmin } = require("../middleware/auth");
const {
  incrementTestUsage,
  activateSubscription,
  renewSubscription,
  expireSubscription,
  getSubscriptionById
} = require("../controllers/subscriptionController");

// increase api usage count
router.post('/usage/increment', auth, incrementTestUsage);

//get Subscription Details
router.get("/get-subscription-by-id/:subscriptionId", auth, getSubscriptionById);

// Activate subscription
router.post("/activate", auth, isSuperAdmin, activateSubscription);

// Renew subscription
router.put("/renew", auth, isSuperAdmin, renewSubscription);

// Expire subscription
router.put("/expire", auth, isSuperAdmin, expireSubscription);

module.exports = router;