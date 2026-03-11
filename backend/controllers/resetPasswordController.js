const {
  passwordUpdated
} = require("../mail/templates/passwordUpdate");
const { passwordResetEmail } = require("../mail/templates/passwordResetEmail")
const User = require("../models/User");
const mailSender = require("../utils/mailSender");
const bcrypt = require("bcrypt");
const crypto = require("crypto");

exports.resetPasswordToken = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      // Security: Don't tell the user the email doesn't exist
      return res.json({
        success: true,
        message: "If this email is registered, a reset link has been sent.",
      });
    }

    const token = crypto.randomBytes(20).toString("hex");

    await User.findOneAndUpdate(
      { email },
      {
        token: token,
        resetPasswordExpires: Date.now() + 3600000,
      },
    );

    const url = `${process.env.FRONTEND_URL}/update-password/${token}`;

    await mailSender(
      email,
      "Password Reset Request",
      passwordResetEmail(url, user.name),
    );

    return res.status(200).json({
      success: true,
      message: "Email Sent Successfully",
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Error in sending reset email" });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { password, confirmPassword, token } = req.body;

    if (password !== confirmPassword) {
      return res
        .status(400)
        .json({ success: false, message: "Passwords do not match" });
    }

    // 1. Find user by token AND ensure token hasn't expired in one query
    const userDetails = await User.findOne({
      token: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!userDetails) {
      return res
        .status(403)
        .json({ success: false, message: "Token is invalid or expired" });
    }

    // 2. Hash and Save
    const encryptedPassword = await bcrypt.hash(password, 10);

    // 3. Update password and CLEAR the token so it can't be used again
    await User.findOneAndUpdate(
      { token: token },
      {
        password: encryptedPassword,
        token: null,
        resetPasswordExpires: null,
      },
    );

    // 4. Send Confirmation (Don't let email failure block the response)
    mailSender(
      userDetails.email,
      "Password Updated",
      passwordUpdated(userDetails.email, userDetails.name),
    ).catch((err) => console.error("Notification Email Failed", err));

    return res
      .status(200)
      .json({ success: true, message: "Password updated successfully" });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Update failed" });
  }
};
