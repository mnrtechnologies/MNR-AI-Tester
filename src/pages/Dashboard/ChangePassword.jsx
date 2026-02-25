import React, { useState } from "react";
import axios from "axios";

const AUTH_BASE = process.env.REACT_APP_AUTH_URL || "http://localhost:4000/api";

const ChangePassword = () => {
  const [formData, setFormData] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handlePasswordChange = async () => {
    // 1. Frontend Validation
    if (
      !formData.oldPassword ||
      !formData.newPassword ||
      !formData.confirmPassword
    ) {
      setMessage({ type: "error", text: "All fields are required." });
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setMessage({ type: "error", text: "New passwords do not match." });
      return;
    }

    setLoading(true);
    setMessage({ type: "", text: "" });

    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${AUTH_BASE}/auth/change-password`,
        {
          oldPassword: formData.oldPassword,
          newPassword: formData.newPassword,
          confirmPassword: formData.confirmPassword,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (response.data.success) {
        setMessage({ type: "success", text: "Password changed successfully!" });
        setFormData({ oldPassword: "", newPassword: "", confirmPassword: "" });
      }
    } catch (error) {
      setMessage({
        type: "error",
        text: error.response?.data?.message || "Failed to change password.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto mt-10">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-800">Change Password</h2>
        <div className="h-0.5 w-full bg-slate-100 mt-2 border-b border-dashed border-slate-200"></div>
      </div>

      <div className="bg-white p-10 rounded-2xl shadow-sm border border-slate-100">
        {/* Success/Error Message Area */}
        {message.text && (
          <div
            className={`mb-6 p-4 rounded-lg text-xs font-bold border ${
              message.type === "success"
                ? "bg-green-50 text-green-600 border-green-100"
                : "bg-red-50 text-red-600 border-red-100"
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="space-y-6">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-tight">
              Old Password
            </label>
            <input
              type="password"
              name="oldPassword"
              value={formData.oldPassword}
              onChange={handleChange}
              className="w-full border border-slate-200 p-3 rounded-lg text-sm focus:ring-1 focus:ring-orange-500 outline-none transition-all"
              placeholder="••••••••"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-tight">
              New Password
            </label>
            <input
              type="password"
              name="newPassword"
              value={formData.newPassword}
              onChange={handleChange}
              className="w-full border border-slate-200 p-3 rounded-lg text-sm focus:ring-1 focus:ring-orange-500 outline-none transition-all"
              placeholder="••••••••"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-tight">
              Confirm New Password
            </label>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              className="w-full border border-slate-200 p-3 rounded-lg text-sm focus:ring-1 focus:ring-orange-500 outline-none transition-all"
              placeholder="••••••••"
            />
          </div>

          <div className="pt-4">
            <button
              onClick={handlePasswordChange}
              disabled={loading}
              className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-3 rounded-lg font-bold text-xs uppercase tracking-widest transition-all disabled:opacity-50"
            >
              {loading ? "Processing..." : "Change Password"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChangePassword;
