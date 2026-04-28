// routes/dashboardRoutes.js
const express = require("express");
const router = express.Router();
const { getSuperAdminDashboardStats, getCompanyAdminDashboardStats } = require("../controllers/dashboardController");
const { auth, isSuperAdmin, isAdmin} = require("../middleware/auth");

router.get("/get-super-admin-dashboard-stats",auth,isSuperAdmin, getSuperAdminDashboardStats);

router.get("/get-company-admin-dashboard-stats",auth,isAdmin, getCompanyAdminDashboardStats);

module.exports = router;
