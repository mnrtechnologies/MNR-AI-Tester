const express = require("express");
const router = express.Router();
const {
  createCompany,
  addCompanyAdmin,
  getCompanies,
  editCompany,
  deleteCompany,
  getCompanyById,
} = require("../controllers/companyController"); 

const { auth, isSuperAdmin } = require("../middleware/auth");

// Get All Companies
// NOTE: Reordered "all" above "/:companyId" to prevent Express from treating "all" as an ID
router.get("/get-all-companies", auth, isSuperAdmin, getCompanies);

// Get Company By company ID
router.get("/get-company-details/:companyId", auth, getCompanyById);

// Create Company
router.post("/add-company", auth, isSuperAdmin, createCompany);

// Add Company Admin
router.post("/add-company-admin", auth, isSuperAdmin, addCompanyAdmin);

// Edit Company
router.put("/edit-company-details", auth, isSuperAdmin, editCompany);

// Delete Company
router.delete("/delete-company", auth, isSuperAdmin, deleteCompany);

module.exports = router;