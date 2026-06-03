const User = require("../models/User");
const Subscription = require("../models/Subscription");
const Company = require("../models/Company");

exports.incrementTestUsage = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user || !user.companyId) {
      return res.status(404).json({
        success: false,
        error: "User or associated company not found.",
      });
    }

    const currentSub = await Subscription.findOne({
      companyId: user.companyId,
      isActive: true,
    });

    if (!currentSub) {
      return res.status(404).json({
        success: false,
        error: "No active subscription found.",
      });
    }

    const now = new Date();
    if (currentSub.endDate < now) {
      currentSub.isActive = false;
      await currentSub.save();
      return res.status(403).json({
        success: false,
        error: "Subscription has expired.",
      });
    }

    const maxLimit = currentSub.planDetails?.maxTestsAllowed || 0;
    const testsUsed = currentSub.planDetails?.testsUsed || 0;

    if (maxLimit !== -1 && testsUsed >= maxLimit) {
      return res.status(429).json({
        success: false,
        error: "Limit reached",
        message: "Test limit exhausted for the current plan.",
      });
    }

    if (maxLimit !== -1) {
      currentSub.planDetails.testsUsed += 1;
    }

    currentSub.planDetails.lastTestDate = new Date();

    await currentSub.save();

    return res.status(200).json({
      success: true,
      message: "Test usage recorded successfully.",
      data: {
        testsUsed: currentSub.planDetails.testsUsed,
        maxTestsAllowed: currentSub.planDetails.maxTestsAllowed,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Internal server error.",
    });
  }
};

// GET SUBSCRIPTION BY ID (FULL DETAILS)
exports.getSubscriptionById = async (req, res) => {
  try {
    const { subscriptionId } = req.params;

    if (!subscriptionId) {
      return res
        .status(400)
        .json({ success: false, message: "Subscription ID is required" });
    }

    const subscription = await Subscription.findById(subscriptionId)
      .populate({
        path: "companyId", // FIXED: lowercase 'c' to match schema
        model: "company", // FIXED: matches module.exports = mongoose.model("company")
        select: "-__v",
      })
      .populate({
        path: "activatedBy",
        model: "user", // Match the ref name in your schema
        select: "-password -__v -token",
      });

    if (!subscription) {
      return res
        .status(404)
        .json({ success: false, message: "Subscription not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Subscription fetched successfully",
      subscription,
    });
  } catch (error) {
    console.error("Get Subscription By ID Error:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

// ACTIVATE SUBSCRIPTION (Super Admin Only)
exports.activateSubscription = async (req, res) => {
  try {
    // FIXED: Changed to companyId and added plan & custom limits
    const activatedBy = req.user.id;
    const { companyId, startDate, endDate, plan, customMaxTests } = req.body;
    

    // Validate required fields
    if (!companyId || !startDate || !endDate || !plan) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields" });
    }

    // Deactivate old subscription if exists
    await Subscription.updateMany(
      { companyId: companyId, isActive: true }, // FIXED: lowercase 'c'
      { isActive: false },
    );

    // Prepare plan details based on schema
    let planDetails = { testsUsed: 0};

    // // If it's a custom plan, we must set the limit manually because the pre-save hook ignores "custom"
    if (plan === "custom") {
      if (customMaxTests === undefined) {
        return res
          .status(400)
          .json({
            success: false,
            message: "customMaxTests is required for custom plans",
          });
      }
      planDetails.maxTestsAllowed = customMaxTests;
    }

    // Create new subscription
    const subscription = await Subscription.create({
      companyId, // FIXED
      activatedBy,
      startDate,
      endDate,
      plan, // FIXED: Dynamic instead of hardcoded "premium"
      planDetails, // FIXED: Matches schema instead of API limits
      isActive: true,
    });

    // Update Company info
    await Company.findByIdAndUpdate(companyId, {
      // FIXED
      subscriptionStatus: "active",
      activeSubscriptionId: subscription._id,
    });

    return res.status(201).json({
      success: true,
      message: "Subscription activated successfully",
      subscription,
    });
  } catch (error) {
    console.error("Activate Subscription Error:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

// RENEW SUBSCRIPTION (Super Admin Only)
exports.renewSubscription = async (req, res) => {
  try {
    // Extract 'plan' from req.body as well
    const { companyId, newEndDate, newCustomMaxTests, plan } = req.body;

    const subscription = await Subscription.findOne({
      companyId: companyId,
      isActive: true,
    });

    if (!subscription) {
      return res
        .status(400)
        .json({ success: false, message: "No active subscription found." });
    }

    // Update the end date
    subscription.endDate = newEndDate;

    // Update the plan if the frontend provided a new one
    if (plan) {
      subscription.plan = plan;
    }

    // Unconditionally update the max tests if a value was provided,
    // removing the old (subscription.plan === "custom") restriction.
    if (newCustomMaxTests !== undefined) {
      subscription.planDetails.maxTestsAllowed = newCustomMaxTests;
    }

    await subscription.save();

    return res.status(200).json({
      success: true,
      message: "Subscription renewed successfully",
      subscription,
    });
  } catch (error) {
    console.error("Renew Subscription Error:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

// EXPIRE SUBSCRIPTION (Super Admin Only)
// exports.expireSubscription = async (req, res) => {
//   try {
//     const { companyId } = req.body; // FIXED: Changed to companyId

//     // Find active subscription
//     const subscription = await Subscription.findOne({
//       companyId: companyId, // FIXED
//       isActive: true,
//     });

//     if (!subscription) {
//       return res
//         .status(404)
//         .json({
//           success: false,
//           message: "No active subscription found for this Company.",
//         });
//     }

//     // Mark subscription expired (SOFT DELETE - Keeps History)
//     subscription.isActive = false;
//     subscription.endDate = new Date(); // Optional: truncates the end date to now
//     await subscription.save();

//     // Remove active subscription from Company
//     await Company.findByIdAndUpdate(companyId, {
//       // FIXED
//       subscriptionStatus: "expired",
//       activeSubscriptionId: null,
//     });

//     // NOTE: I removed the `findByIdAndDelete` here.
//     // Usually, you want to keep billing/subscription history.
//     // Setting `isActive: false` is enough to "expire" it.

//     return res.status(200).json({
//       success: true,
//       message: "Subscription expired successfully", // Updated message
//     });
//   } catch (error) {
//     console.error("Expire Subscription Error:", error);
//     return res.status(500).json({ success: false, message: "Server Error" });
//   }
// };

exports.expireSubscription = async (req, res) => {
  try {
    const { companyId } = req.body;

    const subscription = await Subscription.findOneAndDelete({
      companyId: companyId,
      isActive: true,
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: "No active subscription found for this Company.",
      });
    }

    await Company.findByIdAndUpdate(companyId, {
      subscriptionStatus: "expired",
      activeSubscriptionId: null,
    });

    return res.status(200).json({
      success: true,
      message: "Subscription deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({ 
      success: false, 
      message: "Server Error" 
    });
  }
};