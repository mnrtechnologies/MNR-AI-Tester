const express = require("express");
const router = express.Router();

const {
  register,
  login,
  changePassword,
  getUserDetails,
  updateBasicInfo,
  getAllUser,
  editUser,
  deleteUser
} = require("../controllers/authController");
const { 
    resetPasswordToken, 
    resetPassword 
} = require("../controllers/resetPasswordController");

const { auth,isAdmin } = require("../middleware/auth");

// public routes
// router.post("/signup", register);
router.post("/login", login);

// protected routes
router.get("/getUserDetails", auth, getUserDetails);
router.post("/change-password", auth, changePassword);
router.put("/update-profile", auth, updateBasicInfo);

//forgot password - Password Reset Routes
router.post("/reset-password-token", resetPasswordToken);
router.post("/reset-password", resetPassword);

//ADMIN Routes
// Route for user register
router.post("/register",auth,isAdmin, register)
//get all user
router.get("/get-all-users",auth, getAllUser);
// Edit User Details
router.put("/edit-user/:userId", auth, isAdmin, editUser);
// Delete User
router.delete("/delete-user/:userId", auth, isAdmin, deleteUser);

module.exports = router;