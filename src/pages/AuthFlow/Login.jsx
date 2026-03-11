import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux"; // Added Redux hooks
import { login } from "../../services/operations/authAPIs"; // Import your login action
import logo from "../../assets/MNR_AT.png";
import { Eye, EyeOff } from "lucide-react";

const Login = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch(); // Initialize dispatch
  
  // Get loading state from Redux slice (optional, replaces local loading)
  const { loading } = useSelector((state) => state.auth);

  useEffect(() => {
    const token = localStorage.getItem("token");
    // If token exists, redirect to dashboard
    if (token) {
      navigate("/dashboard");
    }
  }, [navigate]);

  const [formData, setFormData] = useState({ email: "", password: "" });
  const [emailError, setEmailError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const { email, password } = formData;

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (name === "email") {
      if (value && !value.endsWith("@mnrtechnologies.com")) {
        setEmailError("Only @mnrtechnologies.com emails are allowed");
      } else {
        setEmailError("");
      }
    }
  };

  const onLoginSubmit = (e) => {
    e.preventDefault();
    if (emailError) return;

    // Dispatch the Redux action
    // It handles the API call, Toast, and Navigation internally
    dispatch(login(email, password, navigate));
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-orange-50 relative">
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
        <div className="text-center mb-10">
          <div className="font-bold text-xl mb-2 text-blue-950">
            MNR <span className="text-orange-500 text-2xl">AT</span>
          </div>
          <p className="text-gray-500">Sign in to your account</p>
        </div>

        <form onSubmit={onLoginSubmit} className="space-y-6">
          {/* EMAIL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>

            <input
              name="email"
              type="email"
              required
              value={email}
              onChange={handleChange}
              className={`w-full px-4 py-3 border rounded-xl outline-none transition focus:ring-2
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

          {/* PASSWORD */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>

            <div className="relative">
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={handleChange}
                className="w-full px-4 py-3 pr-12 border border-orange-100 rounded-xl focus:ring-2 focus:ring-orange-400 bg-orange-50/40 outline-none transition"
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
            <div className="flex justify-end mt-2">
              <Link 
                to="/forgot-password" 
                className="text-xs font-semibold text-gray-500 hover:text-orange-500 transition"
              >
                Forgot Password?
              </Link>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || emailError}
            className="w-full bg-orange-500 text-white py-3 rounded-xl font-bold hover:bg-orange-600 transition shadow-md disabled:opacity-50"
          >
            {loading ? "Signing In..." : "Sign In"}
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-gray-500">
          New here?
          <Link
            to="/signup"
            className="text-orange-500 font-bold hover:underline ml-1"
          >
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;