const User = require("../models/User");
const Company = require("../models/Company");
const Subscription = require("../models/Subscription");
const CreditLedger = require("../models/CreditLedger");
const credits = require("../services/creditService");

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

exports.getSuperAdminDashboardStats = async (req, res) => {
  try {
    const [
      totalCompanies,
      totalUsers,
      totalStaff,
      totalCompanyAdmins,
      totalSuperAdmins,
      activeSubscriptions,
      expiredPlans,
    ] = await Promise.all([
      Company.countDocuments(),
      User.countDocuments(),
      User.countDocuments({ role: "staff" }),
      User.countDocuments({ role: "company_admin" }),
      User.countDocuments({ role: "super_admin" }),
      Subscription.countDocuments({ isActive: true }),
      Subscription.countDocuments({ isActive: false }),
    ]);

    // This was `Subscription.find({})` followed by two reduce() passes, which
    // pulled every subscription document into memory just to add up two
    // numbers. One $group does it in the database.
    const [totals] = await Subscription.aggregate([
      {
        $group: {
          _id: null,
          totalAllowance: { $sum: "$credits.monthlyAllowance" },
          totalBalance: { $sum: "$credits.balance" },
          totalReserved: { $sum: "$credits.reserved" },
          totalCommitted: { $sum: "$credits.lifetimeCommitted" },
        },
      },
    ]);

    const [mrr] = await Subscription.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: null, mrrUsd: { $sum: { $ifNull: ["$priceUsdMonthly", 0] } } } },
    ]);

    const t = totals || {
      totalAllowance: 0,
      totalBalance: 0,
      totalReserved: 0,
      totalCommitted: 0,
    };

    // Actual credits spent today, from the ledger. The old `activeTestsToday`
    // counted *subscriptions with a recent lastTestDate*, not tests — it could
    // never exceed the number of companies.
    const [todayCommits] = await CreditLedger.aggregate([
      { $match: { type: "commit", createdAt: { $gte: startOfToday() } } },
      { $group: { _id: null, credits: { $sum: { $abs: "$credits" } } } },
    ]);
    const creditsUsedToday = todayCommits ? todayCommits.credits : 0;

    const creditsUsed = Math.max(0, t.totalAllowance - t.totalBalance - t.totalReserved);

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

        // Credit view
        totalCreditAllowance: t.totalAllowance,
        totalCreditsAvailable: t.totalBalance,
        totalCreditsReserved: t.totalReserved,
        totalCreditsCommitted: t.totalCommitted,
        creditsUsedToday,
        mrrUsd: mrr ? mrr.mrrUsd : 0,

        // @deprecated aliases so the pre-credits tiles keep rendering during
        // rollout. Remove once no client reads them.
        totalMaxTestsAllowed: t.totalAllowance,
        totalTestsUsed: creditsUsed,
        activeTestsToday: creditsUsedToday,
      },
    });
  } catch (error) {
    console.error("Dashboard Stats Error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

exports.getCompanyAdminDashboardStats = async (req, res) => {
  try {
    const userDetails = await User.findById(req.user.id);

    if (!userDetails || !userDetails.companyId) {
      return res.status(404).json({
        success: false,
        message: "User or associated company not found",
      });
    }

    const company = await Company.findById(userDetails.companyId).populate(
      "activeSubscriptionId"
    );

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
      });
    }

    const totalStaff = company.staff ? company.staff.length : 0;
    const totalCompanyAdmins = company.admins ? company.admins.length : 0;
    const totalUsers = totalStaff + totalCompanyAdmins;

    const sub = company.activeSubscriptionId;
    // getAccountSnapshot falls back to the legacy test quota when the
    // subscription has not been migrated yet, so this never renders blank.
    const account = credits.getAccountSnapshot(sub);

    let creditsUsedToday = 0;
    if (sub) {
      const [today] = await CreditLedger.aggregate([
        {
          $match: {
            companyId: company._id,
            type: "commit",
            createdAt: { $gte: startOfToday() },
          },
        },
        { $group: { _id: null, credits: { $sum: { $abs: "$credits" } } } },
      ]);
      creditsUsedToday = today ? today.credits : 0;
    }

    const allowance = account ? account.monthlyAllowance : 0;
    const balance = account ? account.balance : 0;
    const reserved = account ? account.reserved : 0;
    const used = Math.max(0, allowance - balance - reserved);

    res.status(200).json({
      success: true,
      data: {
        companyName: company.name,
        totalUsers,
        totalStaff,
        totalCompanyAdmins,

        credits: {
          status: company.subscriptionStatus,
          planType: account ? account.planType : null,
          tierName: account ? account.tierName : "N/A",
          engine: account ? account.engine : null,
          balance,
          reserved,
          used,
          monthlyAllowance: allowance,
          creditsUsedToday,
          nextResetAt: account ? account.nextResetAt : null,
          overageUsedThisPeriod: account ? account.overageUsedThisPeriod : 0,
          concurrentSites: account ? account.concurrentSites : 1,
          legacy: account ? account.legacy : false,
        },

        // @deprecated alias block — remove once no client reads it.
        subscription: {
          status: company.subscriptionStatus,
          planName: account ? account.tierName : "N/A",
          testsUsed: used,
          maxTestsAllowed: allowance,
          activeTestsToday: creditsUsedToday,
        },
      },
    });
  } catch (error) {
    console.error("Company Admin Dashboard Stats Error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};
