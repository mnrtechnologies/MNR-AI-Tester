import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux"; // Added Redux hooks
import { resetPassword } from "../../services/operations/authAPIs"; // Import Redux action
import logo from "../../assets/MNR_AT.png";
import { Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { toast } from "react-hot-toast";

const UpdatePassword = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { token } = useParams(); 

  // Get loading state from Redux store
  const { loading } = useSelector((state) => state.auth);

  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: "",
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const { password, confirmPassword } = formData;

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const onUpdateSubmit = (e) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    // Dispatch the Redux action
    // Note: In your authAPI.js, it takes (password, confirmPassword, token, navigate)
    dispatch(resetPassword(password, confirmPassword, token, navigate));
    
    // Optional: If you want to show the CheckCircle2 UI locally before the 
    // Redux action redirects the user, you can keep the isSuccess state logic, 
    // but usually, the navigate("/") inside authAPI.js will trigger first.
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
        {!isSuccess ? (
          <>
            <div className="text-center mb-10">
              <div className="font-bold text-xl mb-2 text-blue-950">
                MNR <span className="text-orange-500 text-2xl">AT</span>
              </div>
              <p className="text-gray-500">
                Please enter your new password below
              </p>
            </div>

            <form onSubmit={onUpdateSubmit} className="space-y-6">
              {/* NEW PASSWORD */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New Password
                </label>
                <div className="relative">
                  <input
                    name="password"
                    value={password}
                    type={showPassword ? "text" : "password"}
                    required
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
              </div>

              {/* CONFIRM PASSWORD */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm Password
                </label>
                <input
                  name="confirmPassword"
                  value={confirmPassword}
                  type="password"
                  required
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-orange-100 rounded-xl focus:ring-2 focus:ring-orange-400 bg-orange-50/40 outline-none transition"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-orange-500 text-white py-3 rounded-xl font-bold hover:bg-orange-600 transition shadow-md disabled:opacity-50"
              >
                {loading ? "Updating..." : "Update Password"}
              </button>
            </form>
          </>
        ) : (
          <div className="text-center py-4">
            <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="text-green-600" size={32} />
            </div>
            <h2 className="text-2xl font-bold text-blue-950 mb-2">
              Password Updated!
            </h2>
            <p className="text-gray-500">
              Your password has been changed successfully. Redirecting you...
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default UpdatePassword;