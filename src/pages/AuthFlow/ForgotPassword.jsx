import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux"; // Added Redux hooks
import { getPasswordResetToken } from "../../services/operations/authAPIs"; // Import Redux action
import logo from "../../assets/MNR_AT.png";
import { ArrowLeft, MailCheck } from "lucide-react";

const ForgotPassword = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  // Get loading state from Redux store
  const { loading } = useSelector((state) => state.auth);

  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [isSent, setIsSent] = useState(false); // Used as 'setEmailSent' in the action

  const handleEmailChange = (e) => {
    const value = e.target.value;
    setEmail(value);

    if (
      value &&
      !(
        value.endsWith("@mnrtechnologies.com") ||
        value.endsWith("@adventglobal.com")
      )
    ) {
      setEmailError(
        "Only @mnrtechnologies.com or @adventglobal.com emails are allowed",
      );
    } else {
      setEmailError("");
    }
  };

  const onSubmit = (e) => {
    e.preventDefault();
    if (emailError || !email) return;

    // Dispatch the Redux action
    // Note: getPasswordResetToken(email, setEmailSent)
    dispatch(getPasswordResetToken(email, setIsSent));
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-orange-50 relative">
      {/* Logo */}
      <div
        className="absolute top-8 left-10 cursor-pointer"
        onClick={() => navigate("/")}
      >
        <img
          src={logo}
          alt="MNR AT"
          className="h-14 w-auto object-contain rounded-2xl p-1 border border-blue-900"
        />
      </div>

      <div className="w-full max-w-md p-8 bg-white rounded-2xl shadow-md border border-orange-100">
        {!isSent ? (
          <>
            <div className="text-center mb-10">
              <div className="font-bold text-xl mb-2 text-blue-950">
                MNR <span className="text-orange-500 text-2xl">AT</span>
              </div>
              <p className="text-gray-500">
                Enter your email to receive a reset link
              </p>
            </div>

            <form onSubmit={onSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={handleEmailChange}
                  className={`w-full px-4 py-3 border rounded-xl outline-none transition focus:ring-2
                  ${emailError ? "border-red-300 focus:ring-red-400 bg-red-50" : "border-orange-100 focus:ring-orange-400 bg-orange-50/40"}`}
                  placeholder="name@mnrtechnologies.com"
                />
                {emailError && (
                  <p className="text-red-500 text-xs mt-1 font-medium">
                    {emailError}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || emailError}
                className="w-full bg-orange-500 text-white py-3 rounded-xl font-bold hover:bg-orange-600 transition shadow-md disabled:opacity-50"
              >
                {loading ? "Sending..." : "Send Reset Link"}
              </button>
            </form>
          </>
        ) : (
          <div className="text-center py-4">
            <div className="bg-orange-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
              <MailCheck className="text-orange-600" size={32} />
            </div>
            <h2 className="text-2xl font-bold text-blue-950 mb-2">
              Check your email
            </h2>
            <p className="text-gray-500 mb-8">
              We've sent a password reset link to <br />
              <span className="font-semibold text-gray-700">{email}</span>
            </p>
            <button
              onClick={() => setIsSent(false)}
              className="text-orange-500 font-bold hover:underline block mx-auto"
            >
              Didn't receive the email? Try again
            </button>
          </div>
        )}

        <div className="mt-8 text-center">
          <Link
            to="/login"
            className="inline-flex items-center text-sm text-gray-500 hover:text-orange-500 font-medium transition"
          >
            <ArrowLeft size={16} className="mr-2" />
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
