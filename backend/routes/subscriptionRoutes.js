const express = require('express');
const router = express.Router();
const { auth } = require("../middleware/auth");
const { incrementTestUsage } = require('../controllers/subscriptionController');

router.post('/usage/increment', auth, incrementTestUsage);

module.exports = router;