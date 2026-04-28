const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const User = require("../models/User");

dotenv.config();

// This function is used as middleware to authenticate user requests
exports.auth = async (req, res, next) => {
  try {
    // Extracting JWT from request cookies, body or header
    const token =
      req.header("Authorization")?.replace("Bearer ", "") ||
      req.cookies.token ||
      req.body.token;

    // If JWT is missing, return 401 Unauthorized response
    if (!token) {
      return res.status(401).json({ success: false, message: `Token Missing` });
    }

    let decode;

    try {
      // Verifying the JWT using the secret key stored in environment variables
      decode = await jwt.verify(token, process.env.JWT_SECRET);
      //console.log(decode);
      // Storing the decoded JWT payload in the request object for further use
      req.user = decode;
    } catch (error) {
      // If JWT verification fails, return 401 Unauthorized response
      return res
        .status(401)
        .json({ success: false, message: "token is invalid" });
    }

    // 🔑new Verify token against DB-------------------------------
    const user = await User.findById(decode.id);

    if (!user || user.sessionId !== decode.sessionId) {
      return res.status(401).json({
        success: false,
        message: "Session expired (logged in elsewhere)",
      });
    }

    // ✅ Update lastActive
    await User.findByIdAndUpdate(decode.id, {
      lastActive: new Date(),
    });

    // If JWT is valid, move on to the next middleware or request handler
    next();
  } catch (error) {
    // If there is an error during the authentication process, return 401 Unauthorized response
    return res.status(401).json({
      success: false,
      message: `Something Went Wrong While Validating the Token`,
    });
  }
};

exports.isAdmin = async (req, res, next) => {
  try {
    const userDetails = await User.findOne({ email: req.user.email });

    // Allowed Roles
    const allowedRoles = ["super_admin", "company_admin"];

    if (!allowedRoles.includes(userDetails.role)) {
      return res.status(401).json({
        success: false,
        message: "This is a Protected Route for Admins Only",
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "User Role can't be verified",
      error: error.message,
    });
  }
};

exports.isSuperAdmin = async (req, res, next) => {
  try {
    const userDetails = await User.findOne({ email: req.user.email });

    if (!userDetails) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Only super_admin allowed
    if (userDetails.role !== "super_admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only Super Admin can access this route.",
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to verify Super Admin role",
      error: error.message,
    });
  }
};


exports.isUser = async (req, res, next) => {
  try {
    const userDetails = await User.findOne({ email: req.user.email });
    console.log(userDetails);

    if (userDetails.role !== "User") {
      return res.status(401).json({
        success: false,
        message: "This is a Protected Route for User",
      });
    }
    next();
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: `User Role Can't be Verified` });
  }
};
