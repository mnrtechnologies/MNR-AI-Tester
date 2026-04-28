const { default: mongoose } = require("mongoose");
const Company = require("../models/company"); // Updated Import
const User = require("../models/User");
const bcrypt = require("bcrypt");

// --------------------------------------------
// GET COMPANY BY ID (with full subscription details)
// --------------------------------------------
exports.getCompanyById = async (req, res) => {
  try {
    const { companyId } = req.params;

    let company;

    if (companyId === "all") {
      // Return all companies
      company = await Company.find({});
    } else {
      // Validate if companyId is a valid ObjectId first
      if (!mongoose.Types.ObjectId.isValid(companyId)) {
        return res.status(400).json({ success: false, message: "Invalid company ID" });
      }
      company = await Company.findById(companyId);
    }

    if (!company || (Array.isArray(company) && company.length === 0)) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    res.json({ success: true, data: company });
  } catch (err) {
    console.error("Get Company By ID Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// --------------------------------------------
// CREATE COMPANY  (Only Super Admin)
// --------------------------------------------
exports.createCompany = async (req, res) => {
  try {
    const { name, email, address } = req.body;

    const company = await Company.create({
      name,
      email,
      address,
      subscriptionStatus: "none",
    });

    return res.status(201).json({
      success: true,
      message: "Company created successfully",
      company,
    });

  } catch (error) {
    console.error("Create Company Error:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

// --------------------------------------------
// ADD COMPANY ADMIN
// --------------------------------------------
exports.addCompanyAdmin = async (req, res) => {
  try {
    const { companyId, name, email, password } = req.body;

    const hashedPassword = await bcrypt.hash(password, 10);

    const admin = await User.create({
      name,
      email,
      password: hashedPassword,
      companyId,
      role: "company_admin"
    });

    // Link the new admin to the Company's admins array
    await Company.findByIdAndUpdate(companyId, {
      $push: { admins: admin._id }
    });

    return res.status(201).json({
      success: true,
      message: "Company Admin created successfully",
      admin,
    });

  } catch (error) {
    console.error("Add Company Admin Error:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

// --------------------------------------------
// GET ALL COMPANIES
// --------------------------------------------
exports.getCompanies = async (req, res) => {
  try {
    // Fetch companies and populate the full active subscription document
    const companies = await Company.find()
      .sort({ createdAt: -1 })
      .populate("activeSubscriptionId"); // fetch all fields

    return res.status(200).json({
      success: true,
      companies,
    });

  } catch (error) {
    console.error("Get Companies Error:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

// --------------------------------------------
// EDIT COMPANY
// --------------------------------------------
exports.editCompany = async (req, res) => {
  try {
    const { companyId, name, email, address } = req.body;

    const updatedCompany = await Company.findByIdAndUpdate(
      companyId,
      { name, email, address },
      { new: true }
    );

    if (!updatedCompany) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Company updated successfully",
      updatedCompany,
    });

  } catch (error) {
    console.error("Edit Company Error:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

// --------------------------------------------
// DELETE COMPANY (Deletes company + all related users)
// --------------------------------------------
exports.deleteCompany = async (req, res) => {
  try {
    const { companyId } = req.body;

    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
      });
    }

    // Delete all users from that company
    await User.deleteMany({ companyId });

    // Delete company
    await Company.findByIdAndDelete(companyId);

    return res.status(200).json({
      success: true,
      message: "Company and all related users deleted successfully",
    });

  } catch (error) {
    console.error("Delete Company Error:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};