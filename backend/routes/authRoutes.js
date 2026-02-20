const express = require("express");
const router = express.Router();

const {
  register,
  login,
  changePassword,
  getUserDetails,
  updateBasicInfo,
} = require("../controllers/authController");

const { auth } = require("../middleware/auth");

// public routes
router.post("/register", register);
router.post("/login", login);

// protected routes
router.get("/getUserDetails", auth, getUserDetails);
router.post("/change-password", auth, changePassword);
router.put("/update-profile", auth, updateBasicInfo);

module.exports = router;