const User = require("../models/User");

exports.incrementTestUsage = async (req, res) => {
  try {
    // 1. Get the user ID from your standard auth middleware (e.g., JWT)
    const userId = req.user.id; 

    // 2. Fetch the user from the database
    const user = await User.findById(userId);
    
    
    if (!user || !user.subscription || user.subscription.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: "Active subscription not found." 
      });
    }

    // 3. Get the current (latest) subscription
    const currentSub = user.subscription[user.subscription.length - 1];

    // 4. Backend Security Check: Is the plan expired?
    if (currentSub.status === "expired") {
      return res.status(403).json({ 
        success: false, 
        error: "Subscription has expired." 
      });
    }

    // 5. Backend Security Check: Did they hit the limit?
    const maxLimit = currentSub.planDetails?.maxTestsAllowed || 0;
    const testsUsed = currentSub.planDetails?.testsUsed || 0;

    // If maxLimit is -1, it means Enterprise/Unlimited, so we skip the block
    if (maxLimit !== -1 && testsUsed >= maxLimit) {
      return res.status(429).json({ 
        success: false, 
        error: "Limit reached",
        message: "Test limit exhausted for the current plan."
      });
    }

    // 6. All checks passed -> Increment the count
    if (maxLimit !== -1) {
      currentSub.planDetails.testsUsed += 1;
    }
    
    // Update the timestamp for when they last ran a test
    currentSub.planDetails.lastTestDate = new Date();

    // 7. Save to MongoDB
    await user.save();

    // 8. Return success and the exact new count so Redux can update instantly
    return res.status(200).json({
      success: true,
      message: "Test usage recorded successfully.",
      data: {
        testsUsed: currentSub.planDetails.testsUsed,
        maxTestsAllowed: currentSub.planDetails.maxTestsAllowed
      }
    });

  } catch (error) {
    console.error("Error incrementing test usage:", error);
    return res.status(500).json({ 
      success: false, 
      error: "Internal server error." 
    });
  }
};