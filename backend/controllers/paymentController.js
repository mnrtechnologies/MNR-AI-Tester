const Payment = require("../models/Payments");
const User = require("../models/User");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const axios = require("axios");
require("dotenv").config();

const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY,
  key_secret: process.env.RAZORPAY_SECRET,
});

exports.orderPayment = async (req, res) => {
  const { amount } = req.body;

  // Validate amount
  if (!amount || amount <= 0) {
    return res.status(400).json({
      success: false,
      message: "Please provide a valid amount greater than zero",
    });
  }

  const options = {
    amount: amount * 100, // Convert to smallest currency unit (paise)
    currency: "INR",
    receipt: `receipt_${Date.now()}`,
  };

  try {
    // Create order with Razorpay
    const paymentResponse = await razorpayInstance.orders.create(options);
    //console.log(paymentResponse);

    res.json({
      success: true,
      data: paymentResponse,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Could not initiate order.",
    });
  }
};

//verify payment
exports.verifyPayment = async (req, res) => {
  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    plan,
    days,
  } = req.body;

  if (!plan) {
    return res
      .status(400)
      .json({ success: false, message: "Plan is required" });
  }

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({
      success: false,
      message: "Missing required payment fields",
    });
  }

  const userId = req.user?.id;

  if (!userId) {
    return res.status(400).json({ error: "userid required" });
  }

  const body = `${razorpay_order_id}|${razorpay_payment_id}`;

  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_SECRET)
    .update(body.toString())
    .digest("hex");

  if (expectedSignature === razorpay_signature) {
    try {
      // Save payment
      const payment = new Payment({
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        plan: plan,
        days: days,
        userId: userId,
      });

      await payment.save();

      // Find user
      const user = await User.findById(userId);
      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }

      //  Calculate expiry and days
      const currentDate = new Date();
      let expireDate;
      let remainingDays;

      if (Number(days) === 30) {
        expireDate = new Date(currentDate.getTime() + 30 * 24 * 60 * 60 * 1000);
        remainingDays = 30;
      } else {
        expireDate = new Date(
          currentDate.getTime() + 365 * 24 * 60 * 60 * 1000
        );
        remainingDays = 365;
      }

      // Expire any active subscriptions
      if (Array.isArray(user.subscription)) {
        user.subscription.forEach((sub) => {
          if (sub.status === "active" || sub.status === "trialing") {
            sub.status = "expired";
          }
        });
      } else {
        user.subscription = [];
      }

      // ✅ Push new subscription
      user.subscription.push({
        plan: plan.toLowerCase(),
        status: "active",
        planActivatedDate: currentDate,
        planExpireDate: expireDate,
        remainingDays: remainingDays,
        paymentProviderCustomerId: razorpay_payment_id,
      });

      await user.save();

      try {
        const response = await axios.post(
          "https://mnr-pppvue-jira-backend.onrender.com/upgraded_plan_flow",
          { userid: userId },
          { headers: { "Content-Type": "application/json" } }
        );
        console.log("response",response.data);
      } catch (error) {
        console.error("response error",error.response?.data || error.message);
      }

      return res.json({
        success: true,
        message: "Payment verified & saved successfully",
        paymentId: payment._id,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        success: false,
        message: "Payment verified but saving failed",
      });
    }
  } else {
    return res.status(400).json({
      success: false,
      message: "Invalid payment signature",
    });
  }
};
