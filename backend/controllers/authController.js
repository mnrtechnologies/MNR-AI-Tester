const User = require("../models/User");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { signupEmail } = require("../mail/templates/signupEmail");
const mailSender = require("../utils/mailSender");


//register
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
    } = req.body;

    // validation
    if (
      !name ||
      !email ||
      !password ||
      !confirmPassword ||
      !mobile
    ) {
      return res.status(400).json({
        success: false,
        message: "All required fields must be filled",
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Password and Confirm Password do not match",
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

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      mobile,
      country,
      state,
      city,
    });

    user.password = undefined;

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

// Login controller for authenticating users
exports.login = async (req, res) => {
  try {
    // Destructure fields from the request body
    const { email, password } = req.body;
    // Check if All Details are there or not
    if (!email || !password ) {
      return res.status(403).send({
        success: false,
        message: "All Fields are required",
      });
    }



    // Find user with provided email
    const user = await User.findOne({ email });

    // If user not found with provided email
    if (!user) {
      // Return 401 Unauthorized status code with error message
      return res.status(401).json({
        success: false,
        message: `User is not Registered with Us Please SignUp to Continue`,
      });
    }


    // Generate JWT token and Compare Password
    if (await bcrypt.compare(password, user.password)) {
      const payload = {
        email: user.email,
        id: user._id,
        role: user.role,
      };
      const token = jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: "24h",
      });

      // Save token to user document in database
      user.token = token;
      user.lastActive = new Date();
      await user.save();
      user.password = undefined;
      // Set cookie for token and return success response
      const options = {
        expires: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        httpOnly: true,
      };
      res.cookie("token", token, options).status(200).json({
        success: true,
        token,
        user,
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
      userDetails.password
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

    // Fetch user (exclude password)
    const user = await User.findById(userId).select("-password -token");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // -------------------------------
    res.status(200).json({
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
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updatedData,
      { new: true }
    ).select("-password -token");

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

// Get all users with total count
exports.getAllUser = async (req, res) => {
  try {
   
    const allUsers = await User.find({}).select("-password -token");
    const count = await User.countDocuments();

    return res.status(200).json({
      success: true,
      message: "Users fetched successfully",
      count,
      users: allUsers,
    });
  } catch (error) {
    console.error("Error fetching all users:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong while fetching all users",
      error: error.message,
    });
  }
};


