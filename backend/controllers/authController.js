const User = require("../models/User");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { signupEmail } = require("../mail/templates/signupEmail");
const mailSender = require("../utils/mailSender");
const crypto = require("crypto");
const axios = require("axios");
const Company = require("../models/Company");
const Subscription = require("../models/Subscription");
const mongoose = require("mongoose");
require("dotenv").config();

// const isValidEmail = (email) => {
//   const regex = /^[\w.-]+@(mnrtechnologies\.com|adventglobal\.com)$/i;
//   return regex.test(email);
// };

// Login controller for authenticating users
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(403).send({
        success: false,
        message: "All Fields are required",
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: `User is not Registered with Us Please SignUp to Continue`,
      });
    }

    if (await bcrypt.compare(password, user.password)) {
      
      // STEP 1 — FORCE LOGOUT OLD DEVICE
      const oldSocketId = global.userSockets?.[user._id.toString()];

      if (oldSocketId) {
        try {
          await axios.post(process.env.AI_BACKEND_API_TERMINATE);
          global.io.to(oldSocketId).emit("forceLogout");
        } catch (err) {
          console.error("Error terminating old session:", err);
        }
      }

      // STEP 2 — CREATE NEW SESSION ID
      const sessionId = crypto.randomUUID();

      const payload = {
        email: user.email,
        id: user._id,
        role: user.role,
        sessionId,
      };

      const token = jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: "24h",
      });

      user.token = token;
      user.sessionId = sessionId;
      user.lastActive = new Date();
      await user.save();

      // Convert Mongoose doc to plain object to attach custom properties safely
      const userResponse = user.toObject();
      userResponse.password = undefined;
      userResponse.activeSubscription = null;

      // STEP 3 — FETCH AND ATTACH ACTIVE SUBSCRIPTION
      if (userResponse.companyId) {
        const currentSub = await Subscription.findOne({
          companyId: userResponse.companyId,
          isActive: true,
        });

        if (currentSub && currentSub.endDate) {
          const today = new Date();
          const diff = currentSub.endDate - today;
          
          const remainingDays = Math.max(
            Math.ceil(diff / (1000 * 60 * 60 * 24)),
            0
          );

          currentSub.remainingDays = remainingDays;

          if (remainingDays === 0 && currentSub.isActive) {
            currentSub.isActive = false;
          }

          await currentSub.save();
          userResponse.activeSubscription = currentSub;
        }
      }

      const options = {
        expires: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        httpOnly: true,
      };

      return res.cookie("token", token, options).status(200).json({
        success: true,
        token,
        user: userResponse,
        message: `User Login Success`,
      });
    } else {
      return res.status(401).json({
        success: false,
        message: `Password is incorrect`,
      });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Login Failure Please Try Again",
    });
  }
};

//Controller for Changing Password
exports.changePassword = async (req, res) => {
  try {
    const userDetails = await User.findById(req.user.id);

    const { oldPassword, newPassword, confirmPassword } = req.body;

    if (!oldPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "New password and confirm password do not match",
      });
    }

    const isPasswordMatch = await bcrypt.compare(
      oldPassword,
      userDetails.password,
    );

    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: "Old password is incorrect",
      });
    }

    const encryptedPassword = await bcrypt.hash(newPassword, 10);

    await User.findByIdAndUpdate(req.user.id, {
      password: encryptedPassword,
    });

    return res.status(200).json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Error occurred while updating password",
    });
  }
};

//get user details
exports.getUserDetails = async (req, res) => {
  try {
    const userId = req.user.id;

    // Use .lean() to convert the Mongoose document to a plain JavaScript object.
    // This allows us to attach the activeSubscription property later.
    const user = await User.findById(userId).select("-password -token").lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Initialize the subscription as null by default
    user.activeSubscription = null;

    // 1. Check if the user is linked to a company
    if (user.companyId) {
      // 2. Fetch the active subscription for that company
      const currentSub = await Subscription.findOne({
        companyId: user.companyId,
        isActive: true,
      });

      if (currentSub && currentSub.endDate) {
        // 3. Compute remaining days
        const today = new Date();
        const diff = currentSub.endDate - today;

        const remainingDays = Math.max(
          Math.ceil(diff / (1000 * 60 * 60 * 24)),
          0
        );

        currentSub.remainingDays = remainingDays;

        // 4. Auto-Expire Logic
        if (remainingDays === 0 && currentSub.isActive) {
          currentSub.isActive = false;
        }

        // Save updated fields back to the Subscription database
        await currentSub.save();
        
        // Attach the subscription data to the user object for the frontend
        user.activeSubscription = currentSub;
      }
    }

    return res.status(200).json({
      success: true,
      message: "User details fetched successfully",
      user,
    });
  } catch (error) {
    console.error("Error fetching user details:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong while fetching user details",
      error: error.message,
    });
  }
};

//update info
exports.updateBasicInfo = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, email, mobile, country, state, city } = req.body;

    const updatedData = {};

    // 1. Mandatory Fields (Must not be empty)
    if (name && name.trim()) updatedData.name = name.trim();

    // 2. Optional Fields (Allow them to be updated to empty strings "")
    if (mobile !== undefined) updatedData.mobile = mobile.trim();
    if (country !== undefined) updatedData.country = country.trim();
    if (state !== undefined) updatedData.state = state.trim();
    if (city !== undefined) updatedData.city = city.trim();

    // 3. Email duplicate check
    if (email && email.trim()) {
      const existingEmail = await User.findOne({
        email: email.trim(),
        _id: { $ne: userId },
      });

      if (existingEmail) {
        return res.status(409).json({
          success: false,
          message: "Email already in use",
        });
      }
      updatedData.email = email.trim();
    }

    // 4. Check if there's anything to update
    if (Object.keys(updatedData).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields provided",
      });
    }

    // 5. Update Database
    const updatedUser = await User.findByIdAndUpdate(userId, updatedData, {
      new: true,
    }).select("-password -token");

    return res.status(200).json({
      success: true,
      message: "User profile updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

//ADMIN----------------------------------------------------

//register
// exports.register = async (req, res) => {
//   try {
//     const {
//       name,
//       email,
//       password,
//       confirmPassword,
//       mobile,
//       country,
//       state,
//       city,
//       role,
//     } = req.body;

//     // validation
//     if (!name || !email || !password || !confirmPassword || !role) {
//       return res.status(400).json({
//         success: false,
//         message: "All required fields must be filled",
//       });
//     }

//     // Validate email domain
//     // if (!isValidEmail(email)) {
//     //   return res.status(400).json({
//     //     success: false,
//     //     message: "Mail must be @mnrtechnologies.com or @adventglobal",
//     //   });
//     // }

//     if (password !== confirmPassword) {
//       return res.status(400).json({
//         success: false,
//         message: "Password and Confirm Password do not match",
//       });
//     }

//     // check existing user
//     const existingUser = await User.findOne({ email });
//     if (existingUser) {
//       return res.status(409).json({
//         success: false,
//         message: "User already exists. Please login.",
//       });
//     }

//     // hash password
//     const hashedPassword = await bcrypt.hash(password, 10);

//     const user = await User.create({
//       name,
//       email,
//       password: hashedPassword,
//       mobile,
//       country,
//       state,
//       city,
//       role: role,
//       subscription: []
//     });

//     user.password = undefined;

//     try {
//       await mailSender(
//         email,
//         "Welcome to MNR AI Tester - Account Created",
//         signupEmail(email, name),
//       );
//     } catch (mailError) {
//       console.error("Mail sending failed:", mailError.message);
//     }

//     return res.status(201).json({
//       success: true,
//       user,
//       message: "User registered successfully.",
//     });
//   } catch (error) {
//     console.error(error);
//     return res.status(500).json({
//       success: false,
//       message: "User cannot be registered. Please try again.",
//     });
//   }
// };

exports.register = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      confirmPassword,
      mobile,
      country,
      state,
      city,
      role,
      companyId,
    } = req.body;

    // validation
    if (!name || !email || !password || !confirmPassword || !role) {
      return res.status(400).json({
        success: false,
        message: "All required fields must be filled",
      });
    }

    // Validate email domain
    // if (!isValidEmail(email)) {
    //   return res.status(400).json({
    //     success: false,
    //     message: "Mail must be @mnrtechnologies.com or @adventglobal",
    //   });
    // }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Password and Confirm Password do not match",
      });
    }

    // If they are registering as a company admin (or staff), they MUST provide a companyId.
    if ((role === "company_admin" || role === "staff") && !companyId) {
      return res.status(400).json({
        success: false,
        message: `Company ID is required to register as ${role.replace('_', ' ')}.`,
      });
    }

    // check existing user
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "User already exists. Please login.",
      });
    }

    // hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Validate CompanyId if provided
    let validCompanyId = null;
    if (companyId) {
      if (!mongoose.Types.ObjectId.isValid(companyId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid companyId",
        });
      }
      validCompanyId = companyId;
    }

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      mobile,
      country,
      state,
      city,
      role: role,
      companyId: validCompanyId,
    });

    user.password = undefined;

    // ---- ADD USER TO COMAPNY SCHEMA ----
    if (validCompanyId && role !== "super_admin") {
      const company = await Company.findById(companyId);

      if (!company) {
        return res.status(404).json({
          success: false,
          message: "company not found",
        });
      }

      switch (role) {
        case "staff":
          company.staff.push(user._id); // NOW WORKS: company is defined
          break;

        case "company_admin":
          // Note: Ensure "company_admin" matches the exact role string in your User schema.
          company.admins.push(user._id); // NOW WORKS: company is defined
          break;
      }

      await company.save();
    }

    try {
      await mailSender(
        email,
        "Welcome to MNR AI Tester - Account Created",
        signupEmail(email, name),
      );
    } catch (mailError) {
      console.error("Mail sending failed:", mailError.message);
    }

    return res.status(201).json({
      success: true,
      user,
      message: "User registered successfully.",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "User cannot be registered. Please try again.",
    });
  }
};

// Get all users with total count
exports.getAllUser = async (req, res) => {
  try {
    const users = await User.find().select("-password");
    const count = await User.countDocuments();

    // If no users found
    if (!users || users.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No users found",
      });
    }

    // Return the user list
    return res.status(200).json({
      success: true,
      message: "Users fetched successfully",
      users,
      count,
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch users",
      error: error.message,
    });
  }
};

// Edit User Details by ID
// exports.editUser = async (req, res) => {
//   try {
//     const { userId } = req.params; // user ID from URL params
//     const { name, email,phoneno, role,companyId } = req.body; // fields to update

//     if (!name && !email && !role) {
//       return res.status(400).json({
//         success: false,
//         message: "At least one field (name, email, role) is required to update",
//       });
//     }

//     // Update user (exclude password updates here)
//     const updatedUser = await User.findByIdAndUpdate(
//       userId,
//       { $set: { name, email,phoneno, role,companyId } },
//       { new: true, runValidators: true, select: "-password" },
//     );

    

//     if (!updatedUser) {
//       return res.status(404).json({
//         success: false,
//         message: "User not found",
//       });
//     }

//     return res.status(200).json({
//       success: true,
//       message: "User details updated successfully",
//       user: updatedUser,
//     });
//   } catch (error) {
//     console.error("Error updating user details:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Error updating user details",
//       error: error.message,
//     });
//   }
// };

// Edit User Details by ID
exports.editUser = async (req, res) => {
  try {
    const { userId } = req.params; // user ID from URL params [cite: 24]
    const { name, email, phoneno, role, companyId } = req.body; // fields to update [cite: 25]

    if (!name && !email && !role && !companyId && !phoneno) {
      return res.status(400).json({
        success: false,
        message: "At least one field is required to update",
      });
    }

    // 1. Fetch the existing user first to compare old vs. new values
    const existingUser = await User.findById(userId);
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const oldCompanyId = existingUser.companyId;
    const oldRole = existingUser.role;

    // Determine the new values (fallback to old if not provided in req.body)
    const newCompanyId = companyId !== undefined ? companyId : oldCompanyId;
    const newRole = role || oldRole;

    const companyChanged = String(oldCompanyId) !== String(newCompanyId);
    const roleChanged = oldRole !== newRole;

    // 2. If the company OR the role has changed, update the Company documents
    if (companyChanged || roleChanged) {
      
      // A. Remove user from the old company's array
      if (oldCompanyId && oldRole !== "super_admin") {
        const oldCompany = await Company.findById(oldCompanyId);
        if (oldCompany) {
          if (oldRole === "staff") {
            oldCompany.staff.pull(userId);
          } else if (oldRole === "company_admin") {
            oldCompany.admins.pull(userId);
          }
          await oldCompany.save();
        }
      }

      // B. Add user to the new company's array
      if (newCompanyId && newRole !== "super_admin") {
        const newCompany = await Company.findById(newCompanyId);
        if (!newCompany) {
          return res.status(404).json({
            success: false,
            message: "The new company was not found",
          });
        }
        
        if (newRole === "staff") {
          newCompany.staff.push(userId); // Add to staff array [cite: 15]
        } else if (newRole === "company_admin") {
          newCompany.admins.push(userId); // Add to admins array [cite: 18]
        }
        await newCompany.save();
      }
    }

    // 3. Update the User document
    // Note: Mapped phoneno to mobile to match your User schema
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: { name, email, mobile: phoneno, role: newRole, companyId: newCompanyId } },
      { new: true, runValidators: true, select: "-password" },
    );

    return res.status(200).json({
      success: true,
      message: "User details updated successfully",
      user: updatedUser,
    });

  } catch (error) {
    console.error("Error updating user details:", error);
    return res.status(500).json({
      success: false,
      message: "Error updating user details",
      error: error.message,
    }); 
  }
};

// deletd user by id and also remove from company
exports.deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.companyId) {
      await Company.findByIdAndUpdate(user.companyId, {
        $pull: {
          staff: userId,
          admins: userId
        }
      });
    }

    await User.findByIdAndDelete(userId);

    return res.status(200).json({
      success: true,
      message: "User deleted successfully and removed from company records",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error deleting user",
      error: error.message,
    });
  }
};

//get user by id bodyuserid
exports.getUserDetailsById = async (req, res) => {
  try {
    const userId = req.body.userid;

    let user = await User.findById(userId).select("-password -token");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      user,
      message: "User details fetched successfully",
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while fetching user",
    });
  }
};

// Get All Staff for a Specific Company
exports.getCompanyStaff = async (req, res) => {
 try {
    // Step 1: Get the logged-in user's company ID
    // Assuming your auth middleware attaches the user payload to req.user
    const loggedInUserId = req.user.id;
    const loggedInUser = await User.findById(loggedInUserId);

    if (!loggedInUser || !loggedInUser.companyId) {
      return res.status(400).json({
        success: false,
        message: "User is not associated with any company",
      });
    }

    const companyId = loggedInUser.companyId;

    // Step 2: Fetch the company and populate the admins and staff arrays
    const companyData = await Company.findById(companyId)
      .populate({
        path: "admins",
        select: "-password -__v -token", // Exclude sensitive fields
      })
      .populate({
        path: "staff",
        select: "-password -__v -token",
      });

    if (!companyData) {
      return res.status(404).json({
        success: false,
        message: "Company record not found",
      });
    }

    // Step 3: Combine the populated arrays into one flat roster
    // Default to empty arrays just in case they are undefined in the DB
    const admins = companyData.admins || [];
    const staff = companyData.staff || [];
    
    const allPersonnel = [...admins, ...staff];

    if (allPersonnel.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No personnel found for this company",
      });
    }

    // Step 4: Return the combined array
    // Note: We return it as 'staff' so it perfectly aligns with your frontend's response.data.staff expectation
    return res.status(200).json({
      success: true,
      count: allPersonnel.length,
      staff: allPersonnel, 
      message: "Company personnel fetched successfully",
    });

  } catch (error) {
    console.error("Error fetching company personnel:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while fetching company personnel",
      error: error.message,
    });
  }
};

//Company Admin
// Get All compnay Users (excluding passwords)
exports.getCompanyUsers = async (req, res) => {
  try {
    // Step 1: Get logged-in user (full document)
    const loggedInUser = await User.findById(req.user.id);

    if (!loggedInUser) {
      return res.status(404).json({
        success: false,
        message: "Logged-in user not found",
      });
    }

    // Step 2: Validate companyId
    if (!loggedInUser.companyId) {
      return res.status(400).json({
        success: false,
        message: "User is not associated with any company",
      });
    }

    // Step 3: Fetch all users from the same company (exclude super_admin)
    const users = await User.find({
      companyId: loggedInUser.companyId,
      role: { $ne: "super_admin" },
    }).select("-password");

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No users found for this company",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Users fetched successfully",
      users,
    });
  } catch (error) {
    console.error("Error fetching company users:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch users",
      error: error.message,
    });
  }
};
