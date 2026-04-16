const express = require("express");
const { orderPayment, verifyPayment } = require("../controllers/paymentController");
const { auth } = require("../middleware/auth");
const router = express.Router();

//Book
router.post('/user/order',orderPayment)
router.post('/user/verify',auth,verifyPayment);

module.exports = router;