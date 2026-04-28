const User = require("../models/User");
const Company = require("../models/Company");
const Subscription = require("../models/Subscription");

exports.getSuperAdminDashboardStats = async (req, res) => {
  try {
    // Total Companies 
    const totalCompanies = await Company.countDocuments();

    // Total Users
    const totalUsers = await User.countDocuments();

    // Total Staff 
    const totalStaff = await User.countDocuments({ role: "staff" });
    
    const totalCompanyAdmins = await User.countDocuments({ role: "company_admin" });

    const totalSuperAdmins = await User.countDocuments({ role: "super_admin" });

    // Active Subscriptions
    const activeSubscriptions = await Subscription.countDocuments({ isActive: true });

    // Expired Subscriptions
    const expiredPlans = await Subscription.countDocuments({ isActive: false });

    // ⭐ TOTAL TESTS ALLOWED & USED (Replacing API limits)
    // We fetch all subscriptions to aggregate the totals from the planDetails object
    const allSubscriptions = await Subscription.find({});
    
    const totalMaxTestsAllowed = allSubscriptions.reduce(
      (sum, sub) => {
        if (sub.planDetails && sub.planDetails.maxTestsAllowed) {
          return sum + sub.planDetails.maxTestsAllowed;
        }
        return sum;
      },
      0
    );

    const totalTestsUsed = allSubscriptions.reduce(
      (sum, sub) => {
        if (sub.planDetails && sub.planDetails.testsUsed) {
          return sum + sub.planDetails.testsUsed;
        }
        return sum;
      },
      0
    );

    // Optional: Find how many subscriptions were active TODAY
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const activeTestsToday = allSubscriptions.filter(sub => 
      sub.planDetails && 
      sub.planDetails.lastTestDate && 
      new Date(sub.planDetails.lastTestDate) >= today
    ).length;

    // SEND RESPONSE
    res.status(200).json({
      success: true,
      data: {
        totalCompanies,
        totalUsers,
        totalStaff,
        totalCompanyAdmins,
        totalSuperAdmins,
        activeSubscriptions,
        expiredPlans,
        totalTestsUsed,
        totalMaxTestsAllowed,
        activeTestsToday
      }
    });

  } catch (error) {
    console.error("Dashboard Stats Error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

exports.getCompanyAdminDashboardStats = async (req, res) => {
  try {
    // 1. Get logged-in user to find their associated company
    const userDetails = await User.findById(req.user.id);

    if (!userDetails || !userDetails.companyId) {
      return res.status(404).json({
        success: false,
        message: "User or associated company not found",
      });
    }

    // 2. Fetch the company AND populate the active subscription in one single query
    const company = await Company.findById(userDetails.companyId)
      .populate("activeSubscriptionId");

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
      });
    }

    // 3. Fast Counts: Use the arrays directly from your schema
    const totalStaff = company.staff ? company.staff.length : 0;
    const totalCompanyAdmins = company.admins ? company.admins.length : 0;
    const totalUsers = totalStaff + totalCompanyAdmins;

    // 4. Extract Subscription Stats
    let planName = "N/A";
    let testsUsed = 0;
    let maxTestsAllowed = 0;
    let activeTestsToday = 0;

    // Because we used .populate(), company.activeSubscriptionId is now the full subscription document
    if (company.activeSubscriptionId) {
      const sub = company.activeSubscriptionId;
      planName = sub.plan || "Standard";

      // Extract plan details for the widget
      if (sub.planDetails) {
        testsUsed = sub.planDetails.testsUsed || 0;
        maxTestsAllowed = sub.planDetails.maxTestsAllowed || 0;

        // Check if a test was run today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (sub.planDetails.lastTestDate && new Date(sub.planDetails.lastTestDate) >= today) {
          activeTestsToday = 1; 
        }
      }
    }

    // 5. Send Response
    res.status(200).json({
      success: true,
      data: {
        companyName: company.name,
        totalUsers,
        totalStaff,
        totalCompanyAdmins,
        subscription: {
          // Pulling directly from your schema's built-in enum
          status: company.subscriptionStatus, 
          planName: planName,
          testsUsed,
          maxTestsAllowed,
          activeTestsToday
        }
      }
    });

  } catch (error) {
    console.error("Company Admin Dashboard Stats Error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

