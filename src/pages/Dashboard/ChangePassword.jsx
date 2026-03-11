import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { changePassword } from "../../services/operations/authAPIs"; // Adjust path as needed
import { toast } from "react-hot-toast";
import { Eye, EyeOff } from "lucide-react"; // Imported Icons

const ChangePassword = () => {
  const dispatch = useDispatch();
  
  // Access loading state from Redux (auth slice)
  const { loading } = useSelector((state) => state.auth);

  const [formData, setFormData] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  // State for toggling password visibility
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handlePasswordChange = (e) => {
    e.preventDefault();

    // 1. Frontend Validation
    if (
      !formData.oldPassword ||
      !formData.newPassword ||
      !formData.confirmPassword
    ) {
      toast.error("All fields are required.");
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      toast.error("New passwords do not match.");
      return;
    }

    // 2. Dispatch Redux Action
    dispatch(
      changePassword(
        formData.oldPassword, 
        formData.newPassword, 
        formData.confirmPassword, 
        () => {
          // Clears the form on success
          setFormData({ oldPassword: "", newPassword: "", confirmPassword: "" });
          // Reset visibility toggles
          setShowOldPassword(false);
          setShowNewPassword(false);
          setShowConfirmPassword(false);
        }
      )
    );
  };

  return (
    <div className="max-w-xl mx-auto mt-10">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-800">Change Password</h2>
        <div className="h-0.5 w-full bg-slate-100 mt-2 border-b border-dashed border-slate-200"></div>
      </div>

      <div className="bg-white p-10 rounded-2xl shadow-sm border border-slate-100">
        <form onSubmit={handlePasswordChange} className="space-y-6">
          
          {/* OLD PASSWORD */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-tight">
              Old Password
            </label>
            <div className="relative">
              <input
                type={showOldPassword ? "text" : "password"}
                name="oldPassword"
                value={formData.oldPassword}
                onChange={handleChange}
                className="w-full border border-slate-200 p-3 pr-10 rounded-lg text-sm focus:ring-1 focus:ring-orange-500 outline-none transition-all"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowOldPassword(!showOldPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-orange-500 transition-colors"
              >
                {showOldPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* NEW PASSWORD */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-tight">
              New Password
            </label>
            <div className="relative">
              <input
                type={showNewPassword ? "text" : "password"}
                name="newPassword"
                value={formData.newPassword}
                onChange={handleChange}
                className="w-full border border-slate-200 p-3 pr-10 rounded-lg text-sm focus:ring-1 focus:ring-orange-500 outline-none transition-all"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-orange-500 transition-colors"
              >
                {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* CONFIRM NEW PASSWORD */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-tight">
              Confirm New Password
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                className="w-full border border-slate-200 p-3 pr-10 rounded-lg text-sm focus:ring-1 focus:ring-orange-500 outline-none transition-all"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-orange-500 transition-colors"
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={loading}
              className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-3 rounded-lg font-bold text-xs uppercase tracking-widest transition-all disabled:opacity-50"
            >
              {loading ? "Processing..." : "Change Password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChangePassword;