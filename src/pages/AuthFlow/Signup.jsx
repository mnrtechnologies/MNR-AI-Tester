import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux"; // Added Redux hooks
import { signUp } from "../../services/operations/authAPIs"; // Import Redux action
import logo from "../../assets/MNR_AT.png";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "react-hot-toast";

const Signup = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  // Get loading state from Redux
  const { loading } = useSelector((state) => state.auth);

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    mobile: "",
  });

  const [emailError, setEmailError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const { name, email, password, confirmPassword, mobile } = form;

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Email validation
    if (name === "email") {
      if (value && !value.endsWith("@mnrtechnologies.com")) {
        setEmailError("Only @mnrtechnologies.com emails are allowed");
      } else {
        setEmailError("");
      }
    }
  };

  const onSignupSubmit = (e) => {
    e.preventDefault();

    if (emailError) return;

    if (!name || !email || !password || !confirmPassword || !mobile) {
      toast.error("Please fill all fields");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    // Dispatching the signUp action from authAPI.js
    // Note: If your backend needs 'mobile', ensure your authAPI.js signUp function 
    // is updated to accept it as well.
    dispatch(signUp(name, email, password, confirmPassword,mobile, navigate));
  };

  return (
    <div className="min-h-screen bg-orange-50">
      <div className="p-6 cursor-pointer" onClick={() => navigate("/")}>
        <img
          src={logo}
          alt="MNR AT"
          className="h-14 w-auto object-contain rounded-2xl p-1 border border-blue-900"
        />
      </div>

      <div className="flex items-center justify-center px-4 pb-12">
        <div className="w-full max-w-md p-8 bg-white rounded-2xl shadow-md border border-orange-100">
          <div className="text-center mb-10">
            <div className="font-bold text-xl mb-2 text-blue-950">
              MNR <span className="text-orange-500 text-2xl">AT</span>
            </div>
            <p className="text-gray-500">Create your account</p>
          </div>

          <form className="space-y-4" onSubmit={onSignupSubmit}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Name
              </label>
              <input
                type="text"
                name="name"
                value={name}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-orange-100 rounded-xl outline-none focus:ring-2 focus:ring-orange-400 bg-orange-50/40"
                placeholder="John Doe"
              />
            </div>

            {/* EMAIL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                name="email"
                value={email}
                onChange={handleChange}
                className={`w-full px-4 py-3 border rounded-xl outline-none focus:ring-2 
                ${
                  emailError
                    ? "border-red-300 focus:ring-red-400 bg-red-50"
                    : "border-orange-100 focus:ring-orange-400 bg-orange-50/40"
                }`}
                placeholder="name@mnrtechnologies.com"
              />

              {emailError && (
                <p className="text-red-500 text-xs mt-1 font-medium">
                  {emailError}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mobile
              </label>
              <input
                type="text"
                name="mobile"
                value={mobile}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-orange-100 rounded-xl outline-none focus:ring-2 focus:ring-orange-400 bg-orange-50/40"
                placeholder="9876543210"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>

              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={password}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-orange-100 rounded-xl outline-none focus:ring-2 focus:ring-orange-400 bg-orange-50/40 pr-12"
                  placeholder="••••••••"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-orange-500"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password
              </label>

              <div className="relative">
                <input
                  type={showConfirm ? "text" : "password"}
                  name="confirmPassword"
                  value={confirmPassword}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-orange-100 rounded-xl outline-none focus:ring-2 focus:ring-orange-400 bg-orange-50/40 pr-12"
                  placeholder="••••••••"
                />

                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-orange-500"
                >
                  {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || emailError}
              className="w-full bg-orange-500 text-white py-3 rounded-xl font-bold hover:bg-orange-600 transition shadow-md mt-4 disabled:opacity-50"
            >
              {loading ? "Creating..." : "Sign Up"}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-gray-500">
            Already have an account?{" "}
            <Link
              to="/login"
              className="text-orange-500 font-bold hover:underline"
            >
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Signup;